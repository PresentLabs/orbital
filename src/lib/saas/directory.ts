export function directoryPage<T extends {id:string;name?:string;title?:string;createdAt?:string}>(items:T[],kind:'spaces'|'boards'|'pages',favorites:string[],query:string,page:number,pageSize:number) {
 const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const favorite=new Set(favorites),term=normalize(query.trim());
 const sorted=items.map((item,index)=>({item,index})).filter(({item})=>normalize(item.name||item.title||'').includes(term)).sort((a,b)=>
  Number(favorite.has(kind+':'+b.item.id))-Number(favorite.has(kind+':'+a.item.id)) ||
  (Date.parse(b.item.createdAt||'')||0)-(Date.parse(a.item.createdAt||'')||0) || a.index-b.index).map(({item})=>item);
 const pages=Math.max(1,Math.ceil(sorted.length/pageSize)),current=Math.max(1,Math.min(pages,page));
 return {items:sorted.slice((current-1)*pageSize,current*pageSize),page:current,pages,total:sorted.length};
}
