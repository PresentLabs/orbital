import {directoryPage} from '@/lib/saas/directory';
import {uiIcon} from '@/lib/saas/icons';
import {directoryKeys,type DirectoryKey,type DirectorySettings} from '../../services/payload/src/directory-preferences';
type Item={id:string;name?:string;title?:string;createdAt?:string;body?:string;description?:string};
type Pref={favoriteKeys?:string[];directories?:DirectorySettings};
export function installDirectories(ctx:{get:()=>Pref|undefined;update:(p:Pref)=>void;render:()=>void;notify:(s:string)=>void}) {
 const queries=new Map<string,string>(),pages=new Map<string,number>();
 const validKey=(v:unknown):v is DirectoryKey=>directoryKeys.includes(v as DirectoryKey);
 function reset(key:DirectoryKey){queries.delete(key);pages.set(key,1);}
 function render<T extends Item>(key:DirectoryKey,items:T[],kind:'spaces'|'boards'|'pages',hostId:string,toolbarId:string,paginationId:string,viewClass:string,card:(item:T,favorite:boolean)=>string){
  const host=document.getElementById(hostId)!,toolbar=document.getElementById(toolbarId)!,pagination=document.getElementById(paginationId)!;
  const pref=ctx.get(),favorites=pref?.favoriteKeys||[],setting=pref?.directories?.[key]||{view:'grid',pageSize:9};
  const privateArea=key.startsWith('private-'),size=privateArea?Math.min(9,setting.pageSize):setting.pageSize;
  const label=key.endsWith('spaces')?'espacios':key.endsWith('tasks')?'tableros de tareas':'notas';
  if(toolbar.dataset.directoryKey!==key){
   toolbar.dataset.directoryKey=key;toolbar.className='directory-toolbar view-toolbar';
   toolbar.innerHTML=`<label class="filter-search">${uiIcon('search',16)}<input data-directory-search="${key}" list="suggestions-${key}" autocomplete="off" aria-label="Buscar ${label}" placeholder="Buscar ${label}…"/></label><datalist id="suggestions-${key}"></datalist><div class="directory-controls"><div class="segmented directory-view-switch layout-page-switch" role="group" aria-label="Vista de ${label} y cantidad por página"><button data-directory-view="grid" data-directory-key="${key}" aria-label="Ver ${label} en grilla">${uiIcon('grid',17)}</button><button data-directory-view="list" data-directory-key="${key}" aria-label="Ver ${label} en lista">${uiIcon('list',17)}</button><select data-directory-size="${key}" aria-label="${label[0].toUpperCase()+label.slice(1)} por página">${(privateArea?[3,6,9]:[6,9,18,36]).map(n=>`<option value="${n}">${n}</option>`).join('')}</select></div></div>`;
  }
  const input=toolbar.querySelector('input')!;if(document.activeElement!==input)input.value=queries.get(key)||'';
  toolbar.querySelector('select')!.value=String(size);
  toolbar.querySelectorAll<HTMLButtonElement>('[data-directory-view]').forEach(b=>{b.classList.toggle('active',b.dataset.directoryView===setting.view);b.setAttribute('aria-pressed',String(b.dataset.directoryView===setting.view));});
  const query=queries.get(key)||'';
  const result=directoryPage(items,kind,favorites,query,pages.get(key)||1,size);pages.set(key,result.page);
  const suggestions=directoryPage(items,kind,favorites,query,1,8).items;
  toolbar.querySelector('datalist')!.replaceChildren(...[...new Set(suggestions.map(item=>item.title||item.name||'').filter(Boolean))].map(title=>new Option(title,title)));
  host.className=viewClass+' directory-content'+(setting.view==='list'?' directory-list':'');
  host.innerHTML=result.items.map(item=>card(item,favorites.includes(kind+':'+item.id))).join('')||'<p class="empty-state">No hay elementos que coincidan. Puedes crear uno o cambiar la búsqueda.</p>';
  pagination.innerHTML=`<span>${result.total} ${result.total===1?'elemento':'elementos'} · Página ${result.page} de ${result.pages}</span><div><button class="button secondary" data-directory-page="${result.page-1}" data-directory-key="${key}" ${result.page===1?'disabled':''}>← Anterior</button><button class="button secondary" data-directory-page="${result.page+1}" data-directory-key="${key}" ${result.page===result.pages?'disabled':''}>Siguiente →</button></div>`;
 }
 document.addEventListener('input',e=>{const el=e.target as HTMLInputElement,key=el.dataset.directorySearch;if(validKey(key)){queries.set(key,el.value);pages.set(key,1);ctx.render();}});
 document.addEventListener('change',e=>{const el=e.target as HTMLSelectElement,key=el.dataset.directorySize;if(!validKey(key))return;const size=Number(el.value);if(!(key.startsWith('private-')?[3,6,9]:[6,9,18,36]).includes(size))return;pages.set(key,1);const all=ctx.get()?.directories||{};ctx.update({directories:{...all,[key]:{view:all[key]?.view||'grid',pageSize:size}}});});
 document.addEventListener('click',e=>{
  const b=(e.target as HTMLElement).closest<HTMLButtonElement>('button');if(!b)return;
  if(b.dataset.favoriteKey){
   const value=b.dataset.favoriteKey,old=ctx.get()?.favoriteKeys||[];
   if(!old.includes(value)&&old.length>=1000){ctx.notify('Puedes guardar hasta 1000 favoritos.');return;}
   for(const key of directoryKeys)pages.set(key,1);
   ctx.update({favoriteKeys:old.includes(value)?old.filter(k=>k!==value):[...old,value]});return;
  }
  const key=b.dataset.directoryKey;if(!validKey(key))return;
  if(b.dataset.directoryView==='grid'||b.dataset.directoryView==='list'){const all=ctx.get()?.directories||{};ctx.update({directories:{...all,[key]:{view:b.dataset.directoryView,pageSize:all[key]?.pageSize||9}}});}
  if(b.dataset.directoryPage){pages.set(key,Number(b.dataset.directoryPage));ctx.render();}
 });
 return {render,reset};
}
