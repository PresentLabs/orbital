import type {Task,WorkspaceMember} from './model';
import {validAvatar} from '../../../services/payload/src/formats.ts';
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function taskProgress(task:Pick<Task,'status'|'description'>){
  const marks=task.description.split(/\r?\n/).map(line=>line.match(/^\s*(?:[-*•]\s+\[([ xX])\]|([□☐☑✓]))\s+\S/)).filter(Boolean);
  const total=marks.length||1,done=task.status==='done'?total:marks.length?marks.filter(m=>/[xX☑✓]/.test(m![1]||m![2])).length:0;
  return {total,done,percent:Math.round(done/total*100),hasChecklist:marks.length>0};
}
export function memberAvatar(member:Pick<WorkspaceMember,"name"|"avatarData">|undefined){
  if(!member)return '<span class="task-person-avatar unassigned" title="Sin asignar" aria-label="Sin asignar">—</span>';
  const initials=member.name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('');
  return `<span class="task-person-avatar" title="${esc(member.name)}" aria-label="${esc(member.name)}">${member.avatarData && validAvatar(member.avatarData)?`<img src="${esc(member.avatarData)}" alt=""/>`:esc(initials)}</span>`;
}
export function timelineWindow(today:string,offset=0){
  const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-((date.getUTCDay()+6)%7)+offset*7);
  return Array.from({length:7},(_,index)=>{const day=new Date(date);day.setUTCDate(day.getUTCDate()+index);return day.toISOString().slice(0,10);});
}
export function taskRange(task:Task){
  const start=task.startDate||task.due,end=task.due||task.startDate;
  return start&&end?{start,end}:null;
}
export function timelineRows(tasks:Task[],group:'tasks'|'projects'){
  if(group==='tasks')return tasks.map(task=>({id:task.id,name:task.title,tasks:[task],range:taskRange(task)}));
  const groups=new Map<string,Task[]>();for(const task of tasks){const key=task.project.trim()||'Sin proyecto';groups.set(key,[...(groups.get(key)||[]),task]);}
  return [...groups].map(([name,tasks])=>{const ranges=tasks.map(taskRange).filter((r):r is NonNullable<typeof r>=>!!r);return{id:name,name,tasks,range:ranges.length?{start:ranges.map(r=>r.start).sort()[0],end:ranges.map(r=>r.end).sort().at(-1)!}:null};});
}
