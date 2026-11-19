export type DateRange = {start:string;end:string};
export type EventDates = {date:string;time:string;endDate?:string;endTime?:string};
export function addDays(day:string,delta:number){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10);}
export function adjustTaskRange(range:DateRange,mode:'move'|'start'|'end',days:number):DateRange {
  if(mode==='move')return{start:addDays(range.start,days),end:addDays(range.end,days)};
  if(mode==='start')return{start:[addDays(range.start,days),range.end].sort()[0],end:range.end};
  return{start:range.start,end:[range.start,addDays(range.end,days)].sort()[1]};
}
const clock=/^([01]\d|2[0-3]):[0-5]\d$/;
export function eventRange(event:EventDates){
  const start=Date.parse(`${event.date}T${event.time}:00Z`);
  const end=event.endDate&&event.endTime?Date.parse(`${event.endDate}T${event.endTime}:00Z`):start+3600000;
  return{start,end:Number.isFinite(end)&&end>start?end:start+3600000};
}
export function eventDates(start:number,end:number):Required<EventDates>{
  const a=new Date(start).toISOString(),b=new Date(end).toISOString();
  return{date:a.slice(0,10),time:a.slice(11,16),endDate:b.slice(0,10),endTime:b.slice(11,16)};
}
export function validEventDates(event:EventDates){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(event.date)||!clock.test(event.time))return false;
  const stamp=Date.parse(event.date+'T00:00:00Z');if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==event.date)return false;
  if(event.endDate===undefined&&event.endTime===undefined)return true;
  if(!event.endDate||!event.endTime||!/^\d{4}-\d{2}-\d{2}$/.test(event.endDate)||!clock.test(event.endTime))return false;
  const end=Date.parse(`${event.endDate}T${event.endTime}:00Z`),start=Date.parse(`${event.date}T${event.time}:00Z`);
  return Number.isFinite(end)&&new Date(end).toISOString().slice(0,10)===event.endDate&&end>start;
}
export function adjustEventRange(event:EventDates,mode:'move'|'start'|'end',minutes:number){
  const {start,end}=eventRange(event),delta=minutes*60000;
  return eventDates(mode==='end'?start:mode==='start'?Math.min(start+delta,end-900000):start+delta,mode==='start'?end:mode==='end'?Math.max(end+delta,start+900000):end+delta);
}
export type CalendarItem=EventDates&{id:string;title:string;description:string};
export function calendarSegments(events:CalendarItem[],days:string[]){
  return days.flatMap((day,index)=>{
    const midnight=Date.parse(day+'T00:00:00Z');
    const items=events.map(event=>{const range=eventRange(event);return{event,day,index,start:Math.max(0,(range.start-midnight)/60000),end:Math.min(1440,(range.end-midnight)/60000),first:range.start>=midnight,last:range.end<=midnight+86400000,lane:0,lanes:1};}).filter(s=>s.start<1440&&s.end>0&&s.start<s.end).sort((a,b)=>a.start-b.start||b.end-a.end);
    let cluster:typeof items=[],laneEnds:number[]=[],clusterEnd=0;
    const finish=()=>{cluster.forEach(s=>s.lanes=laneEnds.length);cluster=[];laneEnds=[];};
    for(const item of items){if(cluster.length&&item.start>=clusterEnd)finish();let lane=laneEnds.findIndex(end=>end<=item.start);if(lane<0)lane=laneEnds.length;laneEnds[lane]=item.end;item.lane=lane;cluster.push(item);clusterEnd=Math.max(...cluster.map(s=>s.end));}finish();return items;
  });
}
