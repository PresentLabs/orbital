import {addDays, adjustEventRange, calendarSegments, eventDates, eventRange, type CalendarItem} from '../lib/saas/date-ranges';
import {timelineWindow} from '../lib/saas/task-presentation';
import {installDatePointer} from './date-pointer';

type Context = {
  events: () => CalendarItem[];
  writable: () => boolean;
  mutate: (fn: () => void) => void;
  create: (day: string, time?: string, through?: string) => void;
  edit: (id: string, focusEnd?: boolean) => void;
  notify: (message: string, action?: {label: string; run: () => void}) => void;
  today: () => string;
  milestones: () => {start: string; end: string; title: string; board: string}[];
};
type Mode = 'week' | 'month';
type Edge = 'start' | 'end' | 'move';
const minuteMs = 60000;
const dayMs = 86400000;
const hourHeight = 56;
const slotHeight = hourHeight / 4;
const midnight = (day: string) => Date.parse(day + 'T00:00:00Z');
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]!));
const tone = (id: string) => Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4;
const stamp = (day: string) => new Date(midnight(day)).toLocaleDateString('es-CL', {day:'numeric', month:'short', timeZone:'UTC'});
const dateLabel = (day: string) => new Date(midnight(day)).toLocaleDateString('es-CL', {weekday:'short', day:'numeric', month:'short', timeZone:'UTC'});
const daysFrom = (start: string, count: number) => Array.from({length:count}, (_, index) => addDays(start, index));
const lastDay = (end: number) => new Date(end - 1).toISOString().slice(0,10);

function rangeText(event: CalendarItem, compact = false) {
  const {start, end} = eventRange(event);
  const dates = eventDates(start, end);
  const through = lastDay(end);
  if (event.allDay) return dates.date === through
    ? `${stamp(dates.date)} · Todo el día`
    : `${stamp(dates.date)} – ${stamp(through)} · Todo el día`;
  if (dates.date === dates.endDate) return `${dates.time} – ${dates.endTime}`;
  return compact ? `${stamp(dates.date)} – ${stamp(through)}`
    : `${stamp(dates.date)}, ${dates.time} → ${stamp(dates.endDate)}, ${dates.endTime}`;
}
function spanInDays(event: CalendarItem, days: string[]) {
  const low = midnight(days[0]), high = low + days.length * dayMs;
  const {start, end} = eventRange(event);
  return {
    first: Math.max(0, Math.floor((start - low) / dayMs)),
    end: Math.min(days.length, Math.ceil((end - low) / dayMs)),
    startsHere: start >= low,
    endsHere: end <= high,
  };
}

export function installProjectCalendar(ctx: Context) {
  const host = document.querySelector<HTMLElement>('#calendar-grid')!;
  const panel = host.closest<HTMLElement>('.calendar-panel')!;
  const weekdays = panel.querySelector<HTMLElement>('.calendar-weekdays')!;
  const content = host.parentElement!;
  const title = panel.querySelector('#calendar-month')!;
  const rangeButton = panel.querySelector<HTMLButtonElement>('[data-calendar-select-range]')!;
  const instructions = panel.querySelector<HTMLElement>('#calendar-range-instructions')!;
  const detail = panel.querySelector<HTMLElement>('#calendar-overflow')!;
  const preview = panel.querySelector<HTMLElement>('#calendar-drag-preview')!;
  let mode: Mode = 'week';
  let anchor = ctx.today();
  let scrollTop = 8 * hourHeight;
  let scrollLeft = 0;
  let headObserver: ResizeObserver | undefined;
  let selecting = false;
  let rangeStart: string | undefined;

  function handle(edge: 'start' | 'end', axis: 'days' | 'hours') {
    if (!ctx.writable()) return '';
    const endpoint = edge === 'start' ? 'inicio' : 'término';
    return `<button type="button" data-date-handle="${edge}" data-resize-axis="${axis}" class="calendar-resize-handle ${axis} ${edge}" aria-label="Cambiar ${endpoint} por ${axis === 'days' ? 'días' : 'horas'}"></button>`;
  }
  function milestone(day: string) {
    return ctx.milestones().filter(item => item.start === day || item.end === day).map(item =>
      `<button class="calendar-milestone" data-calendar-board="${esc(item.board)}">${item.start === day ? 'Inicio' : 'Fin'}: ${esc(item.title)}</button>`).join('');
  }
  const spanning = (event: CalendarItem) => {
    const {start, end} = eventRange(event);
    return event.allDay || Math.floor(start / dayMs) !== Math.floor((end - 1) / dayMs);
  };

  function eventCard(event: CalendarItem, classes: string, inside: string, day: string, style: string, grips: string) {
    const label = `${event.title} · ${rangeText(event)}`;
    return `<div class="${classes} tone-${tone(event.id)}" data-calendar-event="${esc(event.id)}" data-segment-day="${day}" style="${style}" title="${esc(label)}">
      <button class="calendar-event-open" type="button" data-calendar-edit="${esc(event.id)}" aria-label="${ctx.writable() ? 'Cambiar fecha y hora de' : 'Ver evento'} ${esc(label)}">${inside}</button>${grips}
    </div>`;
  }

  function eventBars(days: string[], events: CalendarItem[], month: boolean) {
    const laneEnds: number[] = [];
    const overflow = days.map(() => 0);
    const spans = events.map(event => ({event, ...spanInDays(event,days)}))
      .filter(span => span.first < span.end)
      .sort((a,b) => a.first - b.first || b.end - a.end);
    const bars = spans.map(({event, first, end, startsHere, endsHere}) => {
      let lane = laneEnds.findIndex(last => last <= first);
      if (lane < 0) lane = laneEnds.length;
      laneEnds[lane] = end;
      if (month && lane >= 3) {
        for (let index = first; index < end; index++) overflow[index]++;
        return '';
      }
      const grips = (startsHere ? handle('start','days') : '') + (endsHere ? handle('end','days') : '')
        + (ctx.writable() && !event.allDay && endsHere
          ? `<button type="button" class="calendar-quick-time" data-quick-time="${esc(event.id)}" aria-label="Elegir hora de término" title="Elegir hora de término"></button>`
          : '');
      return eventCard(event, `calendar-span-event ${month ? 'event-chip calendar-month-event' : 'calendar-hour-event'}${startsHere ? '' : ' continues-before'}${endsHere ? '' : ' continues-after'}`,
        `<strong>${esc(event.title)}</strong><small>${esc(rangeText(event,true))}</small>`,days[first],`grid-column:${first + 1}/${end + 1};grid-row:${lane + 1}`,grips);
    });
    return {bars:bars.join(''), lanes:month ? Math.min(laneEnds.length,3) : laneEnds.length, overflow};
  }

  function dayEntries(day: string) {
    const entries = ctx.events().filter(event => {
      const {first,end} = spanInDays(event,[day]);
      return first < end;
    }).sort((a,b) => eventRange(a).start - eventRange(b).start);
    if (!entries.length) return '<p class="empty-state">No hay eventos ese día.</p>';
    return `<ul class="calendar-day-event-list">${entries.map(event =>
      `<li><button type="button" data-calendar-edit="${esc(event.id)}"><strong>${esc(event.title)}</strong><span>${esc(spanning(event) ? rangeText(event) : `${dateLabel(event.date)} · ${rangeText(event)}`)}</span></button></li>`).join('')}</ul>`;
  }

  function monthView() {
    const date = new Date(midnight(anchor)), month = date.getUTCMonth();
    date.setUTCDate(1);
    const monthStart = date.toISOString().slice(0,10);
    const gridStart = addDays(monthStart, -((date.getUTCDay() + 6) % 7));
    const weeks = Math.ceil((new Date(Date.UTC(date.getUTCFullYear(),month + 1,0)).getUTCDate()
      + (midnight(monthStart)-midnight(gridStart))/dayMs)/7);
    title.textContent = date.toLocaleDateString('es-CL',{month:'long',year:'numeric',timeZone:'UTC'});
    weekdays.hidden = false;
    host.className = 'calendar-grid project-month-grid';
    const previousTop = content.scrollTop;
    const previousLeft = content.scrollLeft;
    host.innerHTML = Array.from({length:weeks}, (_, index) => {
      const days = daysFrom(addDays(gridStart,index * 7),7);
      const {bars,lanes,overflow} = eventBars(days,ctx.events(),true);
      return `<div class="calendar-month-week" data-span-start="${days[0]}" data-span-days="7" style="--event-lanes:${lanes}">
        ${days.map((day,i) => `<div class="calendar-day ${Number(day.slice(5,7)) !== month + 1 ? 'outside' : ''} ${day === ctx.today() ? 'today' : ''}" data-calendar-cell="${day}">
          <button type="button" class="calendar-month-date calendar-date" data-select-calendar-day="${day}" aria-label="${esc(ctx.writable() ? dateLabel(day) + ', seleccionar fecha' : `Ver eventos del ${dateLabel(day)}`)}">${Number(day.slice(8))}</button>
          ${overflow[i] ? `<button type="button" class="calendar-more-events" data-calendar-overflow="${day}">+${overflow[i]} ${overflow[i] === 1 ? 'evento' : 'eventos'}</button>` : ''}
          ${milestone(day)}
        </div>`).join('')}
        <div class="calendar-event-bars">${bars}</div>
      </div>`;
    }).join('');
    content.scrollTop = previousTop;
    content.scrollLeft = previousLeft;
  }

  function hourView() {
    const days = timelineWindow(anchor,0);
    const events = ctx.events();
    const span = eventBars(days,events.filter(spanning),false);
    const segments = calendarSegments(events.filter(event => !spanning(event)),days);
    const spanRow = span.lanes ? `<div class="calendar-week-spans" data-span-start="${days[0]}" data-span-days="${days.length}">
      <span class="calendar-zone">Varios días</span><div class="calendar-event-bars">${span.bars}</div></div>` : '';
    title.textContent = `${stamp(days[0])} — ${stamp(days.at(-1)!)}`;
    host.className = 'project-hour-calendar';
    host.innerHTML = `<div class="calendar-hour-scroll" tabindex="0" role="region" aria-label="Cuadrícula horaria" style="--calendar-days:${days.length}">
      <div class="calendar-fixed-head">
        <div class="calendar-hour-head"><span class="calendar-zone">Hora</span>${days.map(day =>
          `<div class="calendar-day-label ${day === ctx.today() ? 'is-today' : ''}" data-calendar-heading="${day}"><strong>${esc(dateLabel(day))}</strong>${milestone(day)}</div>`).join('')}</div>${spanRow}
      </div>
      <div class="calendar-hour-body">
        <div class="calendar-hour-labels">${Array.from({length:24},(_,hour) => `<span style="top:${hour * hourHeight}px">${String(hour).padStart(2,'0')}:00</span>`).join('')}</div>
        ${days.map((day,index) => `<div class="calendar-hour-column ${day === ctx.today() ? 'is-today' : ''}" data-calendar-cell="${day}">
          ${ctx.writable() ? Array.from({length:96},(_,slot) => {
            const time = `${String(Math.floor(slot / 4)).padStart(2,'0')}:${String(slot % 4 * 15).padStart(2,'0')}`;
            return `<button class="calendar-slot" type="button" tabindex="-1" data-calendar-slot="${day}" data-slot-time="${time}" style="top:${slot * slotHeight}px" aria-label="Crear evento el ${stamp(day)} a las ${time}"></button>`;
          }).join('') : ''}
          ${segments.filter(segment => segment.index === index).map(segment => {
            const {event,start,end,lane,lanes,first,last} = segment;
            const className = end-start < 30 ? ' is-short' : end-start <= 60 ? ' is-compact' : '';
            return eventCard(event,`calendar-hour-event${className}`,
              `<strong>${esc(event.title)}</strong><span class="calendar-event-time">${esc(rangeText(event))}</span>`,day,
              `top:${start / 60 * hourHeight}px;height:${Math.max(28,(end-start)/60*hourHeight)}px;left:calc(${lane/lanes*100}% + 3px);width:calc(${100/lanes}% - 6px)`,
              (first ? handle('start','hours') : '') + (last ? handle('end','hours') : ''));
          }).join('')}
        </div>`).join('')}
      </div>
    </div>`;
    const scroller = host.querySelector<HTMLElement>('.calendar-hour-scroll')!;
    const head = scroller.querySelector<HTMLElement>('.calendar-fixed-head')!;
    const updateInset = () => scroller.style.setProperty('--calendar-sticky-head',`${head.offsetHeight}px`);
    updateInset();
    headObserver = new ResizeObserver(updateInset);
    headObserver.observe(head);
    scroller.scrollTop = scrollTop;
    scroller.scrollLeft = scrollLeft;
    scroller.addEventListener('scroll',() => {
      scrollTop = scroller.scrollTop;
      scrollLeft = scroller.scrollLeft;
    },{passive:true});
  }

  function render() {
    headObserver?.disconnect();
    panel.dataset.calendarMode = mode;
    panel.setAttribute('aria-label','Calendario de proyecto');
    weekdays.hidden = true;
    panel.querySelectorAll<HTMLButtonElement>('button[data-calendar-mode]').forEach(button => {
      const active = button.dataset.calendarMode === mode;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    rangeButton.hidden = mode !== 'month' || !ctx.writable();
    rangeButton.setAttribute('aria-pressed',String(selecting));
    instructions.hidden = !selecting;
    if (mode === 'month') {
      monthView();
    } else {
      hourView();
    }
  }

  function stopSelecting() {
    rangeStart = undefined;
    selecting = false;
    instructions.hidden = true;
    rangeButton.setAttribute('aria-pressed','false');
    host.querySelector('.calendar-range-start')?.classList.remove('calendar-range-start');
  }
  function chooseDay(day: string, extend: boolean) {
    if (!ctx.writable()) return showDay(day);
    if (!selecting && !extend) return ctx.create(day);
    if (!rangeStart) {
      rangeStart = day;
      selecting = true;
      rangeButton.setAttribute('aria-pressed','true');
      host.querySelector(`[data-calendar-cell="${day}"]`)?.classList.add('calendar-range-start');
      instructions.hidden = false;
      instructions.textContent = `${dateLabel(day)} seleccionado. Elige el otro extremo.`;
      return;
    }
    const [start,through] = [rangeStart,day].sort();
    stopSelecting();
    ctx.create(start,undefined,through);
  }
  rangeButton.onclick = () => {
    if (selecting) return stopSelecting();
    selecting = true;
    rangeButton.setAttribute('aria-pressed','true');
    instructions.textContent = 'Elige el primer día y luego el último.';
    instructions.hidden = false;
    (host.querySelector<HTMLElement>(`[data-select-calendar-day="${anchor}"]`)
      ?? host.querySelector<HTMLElement>('[data-select-calendar-day]'))?.focus();
  };

  let overflowTrigger: HTMLElement | null = null;
  function showDay(day: string) {
    detail.hidden = false;
    detail.innerHTML = `<div class="calendar-overflow-heading"><h3>Eventos del ${esc(dateLabel(day))}</h3><button type="button" class="button secondary" data-close-calendar-overflow>Cerrar</button></div>${dayEntries(day)}`;
    detail.querySelector<HTMLElement>('button')?.focus();
  }
  panel.addEventListener('click', event => {
    const target = event.target as Element;
    const close = target.closest('[data-close-calendar-overflow]');
    if (close) {
      detail.hidden = true;
      overflowTrigger?.focus();
      return;
    }
    const edit = target.closest<HTMLElement>('[data-calendar-edit],[data-quick-time]');
    const card = target.closest<HTMLElement>('[data-calendar-event]');
    const id = edit?.dataset.calendarEdit || edit?.dataset.quickTime || card?.dataset.calendarEvent;
    if (id && !target.closest('[data-date-handle]')) {
      panel.querySelector('.calendar-event-selected')?.classList.remove('calendar-event-selected');
      card?.classList.add('calendar-event-selected');
      return ctx.edit(id,!!edit?.dataset.quickTime);
    }
    const more = target.closest<HTMLElement>('[data-calendar-overflow]');
    if (more) {
      overflowTrigger = more;
      return showDay(more.dataset.calendarOverflow!);
    }
    if (target.closest('[data-calendar-event],[data-calendar-board]')) return;
    const slot = target.closest<HTMLElement>('[data-calendar-slot]');
    if (slot) return ctx.create(slot.dataset.calendarSlot!,slot.dataset.slotTime);
    const cell = target.closest<HTMLElement>('[data-calendar-cell]');
    if (cell && mode === 'month') {
      overflowTrigger = cell.querySelector('button');
      chooseDay(cell.dataset.calendarCell!,event.shiftKey);
    }
  });
  panel.querySelectorAll<HTMLButtonElement>('button[data-calendar-mode]').forEach(button => button.onclick = () => {
    mode = button.dataset.calendarMode as Mode;
    stopSelecting();
    detail.hidden = true;
    render();
  });

  function updateEvent(item: CalendarItem, next: ReturnType<typeof eventDates>) {
    const before = {date:item.date,time:item.time,endDate:item.endDate,endTime:item.endTime};
    const changed = eventRange(next), original = eventRange(item);
    if (changed.start === original.start && changed.end === original.end) return false;
    ctx.mutate(() => Object.assign(item,next));
    ctx.notify('Evento actualizado.',{label:'Deshacer',run:() => {
      const current = ctx.events().find(event => event.id === item.id);
      if (!current || !ctx.writable() || Object.entries(next).some(([key,value]) => current[key as keyof CalendarItem] !== value)) {
        ctx.notify('Ya no se puede deshacer este cambio.');
        return;
      }
      ctx.mutate(() => Object.assign(current,before));
      ctx.notify('Se restauró el horario anterior.');
    }});
    return true;
  }

  installDatePointer(host,'[data-calendar-event]',(node,event) => {
    if (!ctx.writable() || (event.target as Element).closest('[data-quick-time]')) return null;
    const item = ctx.events().find(event => event.id === node.dataset.calendarEvent);
    if (!item) return null;
    const grip = (event.target as Element).closest<HTMLElement>('[data-date-handle]');
    const edge = (grip?.dataset.dateHandle || 'move') as Edge;
    const axis = grip?.dataset.resizeAxis;
    const spanRow = node.closest<HTMLElement>('[data-span-start]');
    const cell = node.closest<HTMLElement>('[data-calendar-cell]');
    const scroller = host.querySelector<HTMLElement>('.calendar-hour-scroll');
    const width = spanRow ? spanRow.querySelector('.calendar-event-bars')!.getBoundingClientRect().width / Number(spanRow.dataset.spanDays) : cell!.getBoundingClientRect().width;
    const original = eventRange(item), initialScroll = scroller?.scrollTop || 0;
    const monthCell = (x: number,y: number) => document.elementsFromPoint(x,y)
      .map(element => element.closest<HTMLElement>('[data-calendar-cell]')).find(Boolean)?.dataset.calendarCell;
    const originDay = mode === 'month' ? monthCell(event.clientX,event.clientY) : undefined;
    const before = node.style.cssText;
    let next = eventDates(original.start,original.end);
    let highlighted: Element | null = null;
    const clear = () => {
      preview.hidden = true;
      highlighted?.classList.remove('calendar-drag-target');
      node.style.cssText = before;
    };
    return {
      move: pointer => {
        const dayDelta = Math.round((pointer.clientX-event.clientX)/width);
        const minuteDelta = Math.round((pointer.clientY-event.clientY+(scroller?.scrollTop || 0)-initialScroll)/slotHeight)*15;
        let delta = dayDelta * 1440;
        const targetDay = mode === 'month' ? monthCell(pointer.clientX,pointer.clientY) : undefined;
        if (spanRow && targetDay) {
          const base = edge === 'end' ? lastDay(original.end) : edge === 'start' ? item.date : originDay;
          if (base) delta = (midnight(targetDay)-midnight(base))/minuteMs;
        }
        if (!spanRow) delta = axis === 'hours' ? minuteDelta : delta + minuteDelta;
        next = delta ? adjustEventRange(item,edge,delta) : eventDates(original.start,original.end);
        const changed = eventRange(next);
        if (spanRow) {
          const days = daysFrom(spanRow.dataset.spanStart!,Number(spanRow.dataset.spanDays));
          const span = spanInDays({...item,...next},days);
          if (span.first < span.end && (!targetDay || days.includes(targetDay))) {
            node.style.gridColumn = `${span.first + 1}/${span.end + 1}`;
            node.style.transform = '';
          } else {
            node.style.transform = `translate(${pointer.clientX-event.clientX}px,${mode === 'month' ? pointer.clientY-event.clientY : 0}px)`;
          }
        } else if (edge === 'move') {
          node.style.transform = `translate(${dayDelta*width}px,${minuteDelta/60*hourHeight}px)`;
        } else {
          const day = midnight(node.dataset.segmentDay!);
          const start = Math.max(0,(changed.start-day)/minuteMs);
          const end = Math.min(1440,(changed.end-day)/minuteMs);
          node.style.top = `${start/60*hourHeight}px`;
          node.style.height = `${Math.max(28,(end-start)/60*hourHeight)}px`;
        }
        const activeDay = edge === 'end' ? lastDay(changed.end) : next.date;
        highlighted?.classList.remove('calendar-drag-target');
        highlighted = host.querySelector(`[data-calendar-cell="${activeDay}"]`);
        highlighted?.classList.add('calendar-drag-target');
        preview.textContent = item.allDay ? rangeText({...item,...next}) :
          `${stamp(next.date)}, ${next.time} → ${stamp(next.endDate)}, ${next.endTime}`;
        preview.style.left = `${Math.max(12,Math.min(pointer.clientX+12,window.innerWidth-270))}px`;
        preview.style.top = `${Math.max(12,Math.min(pointer.clientY+18,window.innerHeight-58))}px`;
        preview.hidden = false;
      },
      cancel: clear,
      commit: () => {
        clear();
        const current = ctx.events().find(event => event.id === item.id);
        if (!current || !ctx.writable()) return;
        const live = eventRange(current);
        if (live.start === original.start && live.end === original.end) updateEvent(current,next);
        else ctx.notify('El evento cambió durante el arrastre. Vuelve a intentarlo.');
      },
    };
  });

  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape' && selecting) {
      event.preventDefault();
      stopSelecting();
      rangeButton.focus();
      return;
    }
    const target = event.target as HTMLElement;
    const node = target.closest<HTMLElement>('[data-calendar-event]');
    if (!node || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    const grip = target.closest<HTMLElement>('[data-date-handle]');
    if (!grip && !event.altKey) return;
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    if (grip && horizontal !== (grip.dataset.resizeAxis === 'days')) return;
    const item = ctx.events().find(item => item.id === node.dataset.calendarEvent);
    if (!item || !ctx.writable() || (!horizontal && node.classList.contains('calendar-span-event'))) return;
    event.preventDefault();
    event.stopPropagation();
    const edge = (grip?.dataset.dateHandle || 'move') as Edge;
    const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const next = adjustEventRange(item,edge,direction*(horizontal ? 1440 : 15));
    if (!updateEvent(item,next)) return;
    const updated = [...host.querySelectorAll<HTMLElement>('[data-calendar-event]')].filter(element => element.dataset.calendarEvent === item.id);
    const eventNode = edge === 'end' ? updated.at(-1) : updated[0];
    const restored = grip && eventNode?.querySelector<HTMLElement>(`[data-date-handle="${edge}"][data-resize-axis="${grip.dataset.resizeAxis}"]`);
    (restored || eventNode?.querySelector<HTMLElement>('button'))?.focus({preventScroll:true});
  });

  return {
    render,
    shift(direction: number) {
      if (mode === 'month') {
        const date = new Date(midnight(anchor));
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth()+direction);
        anchor = date.toISOString().slice(0,10);
      } else {
        anchor = addDays(anchor,direction*7);
      }
      stopSelecting();
      detail.hidden = true;
      render();
    },
    today() {
      anchor = ctx.today();
      stopSelecting();
      detail.hidden = true;
      render();
    },
  };
}
