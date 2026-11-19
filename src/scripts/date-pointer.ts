export type DateGesture={move:(event:PointerEvent)=>void;commit:()=>void;cancel:()=>void};
/** One transaction per drag, cancellable with Escape; prevents the following editor click. */
export function installDatePointer(root:HTMLElement,selector:string,begin:(node:HTMLElement,event:PointerEvent)=>DateGesture|null){
  let suppressUntil=0;
  root.addEventListener('click',event=>{if(Date.now()<suppressUntil||(event.target as Element).closest('[data-date-handle]')){event.preventDefault();event.stopImmediatePropagation();}},true);
  root.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;const node=(event.target as Element).closest<HTMLElement>(selector);if(!node)return;
    const gesture=begin(node,event);if(!gesture)return;
    event.preventDefault();event.stopPropagation();const x=event.clientX,y=event.clientY;let moved=false;
    const controller=new AbortController(),options={signal:controller.signal};
    const finish=(commit:boolean)=>{controller.abort();node.classList.remove('date-dragging');if(moved){suppressUntil=Date.now()+500;commit?gesture.commit():gesture.cancel();}else gesture.cancel();};
    document.addEventListener('pointermove',e=>{if(e.pointerId!==event.pointerId)return;if(Math.hypot(e.clientX-x,e.clientY-y)>=4)moved=true;if(moved){node.classList.add('date-dragging');gesture.move(e);}},{...options,passive:true});
    document.addEventListener('pointerup',e=>{if(e.pointerId===event.pointerId)finish(true);},options);
    document.addEventListener('pointercancel',e=>{if(e.pointerId===event.pointerId)finish(false);},options);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finish(false);}},options);
    window.addEventListener('blur',()=>finish(false),options);
  });
}
