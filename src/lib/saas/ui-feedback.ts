import {uiIcon} from './icons';
export type NoticeKind='success'|'info'|'warning'|'error';
const interactions=new WeakMap<HTMLElement,AbortController>();
const notices=new WeakMap<HTMLElement,ReturnType<typeof setTimeout>>();
export function showNotice(host:HTMLElement,message:string,kind?:NoticeKind,action?:{label:string;run:()=>void}){
  clearTimeout(notices.get(host));
  if(!message){host.hidden=true;host.classList.remove('visible');return;}
  kind??=/no pud|error|falló|no se pudo/i.test(message)?'error':/revisa|selecciona|elige|no tienes|no permite/i.test(message)?'warning':/guardad|cread|enviad|actualizad|eliminad|conectad|añadid/i.test(message)?'success':'info';
  host.replaceChildren();host.classList.add('ui-toast','visible');host.hidden=false;host.dataset.kind=kind;
  host.setAttribute('role',kind==='error'?'alert':'status');
  const icon=document.createElement('span');icon.className='ui-toast-icon';icon.innerHTML=uiIcon(({success:'noticeCheck',info:'info',warning:'alert',error:'noticeClose'})[kind],22);
  const copy=document.createElement('span');copy.className='ui-toast-copy';const title=document.createElement('strong');title.textContent=({success:'Listo',info:'Información',warning:'Revisa este detalle',error:'No se pudo completar'})[kind];const description=document.createElement('span');description.textContent=message;copy.append(title,description);
  const close=document.createElement('button');close.type='button';close.className='ui-toast-close';close.setAttribute('aria-label','Cerrar aviso');close.innerHTML=uiIcon('noticeClose',18);
  const dismiss=()=>{host.classList.remove('visible');host.hidden=true;clearTimeout(notices.get(host));};close.onclick=dismiss;host.append(icon,copy);
  if (action) {
    const button=document.createElement('button');
    button.type='button';button.className='ui-toast-action';button.textContent=action.label;
    button.onclick=()=>{dismiss();action.run();};
    copy.append(button);
  }
  host.append(close);
  const schedule=()=>notices.set(host,setTimeout(dismiss,kind==='error'?10000:6000));host.onmouseenter=()=>clearTimeout(notices.get(host));host.onmouseleave=schedule;interactions.get(host)?.abort();const controller=new AbortController();interactions.set(host,controller);host.addEventListener('focusin',()=>clearTimeout(notices.get(host)),{signal:controller.signal});host.addEventListener('focusout',schedule,{signal:controller.signal});schedule();
}
export function installDrawer(dialog:HTMLDialogElement){
  let timer:ReturnType<typeof setTimeout>|undefined;
  const protectedSpace=()=>document.body.classList.contains('canvas-fullscreen');
  let beforeClose: (()=>boolean)|undefined;
  const close=(force=false)=>{
    if(!dialog.open||(!force&&beforeClose&&!beforeClose()))return;
    clearTimeout(timer);
    if(protectedSpace()||matchMedia('(prefers-reduced-motion: reduce)').matches){dialog.close();return;}
    dialog.dataset.drawerState='closing';timer=setTimeout(()=>{dialog.close();delete dialog.dataset.drawerState;},360);
  };
  const open=()=>{clearTimeout(timer);delete dialog.dataset.drawerState;dialog.classList.toggle('ui-drawer',!protectedSpace());if(!dialog.open)dialog.showModal();};
  dialog.addEventListener('cancel',event=>{if(!protectedSpace()){event.preventDefault();close();}});
  dialog.addEventListener('click',event=>{if(event.target!==dialog||protectedSpace())return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();});
  return {open,close,setBeforeClose:(check?:()=>boolean)=>{beforeClose=check;}};
}
