import { matchesSearch, searchRelevance } from "./search.ts";

export function directoryPage<T extends {id:string;name?:string;title?:string;createdAt?:string;body?:string;description?:string}>(items:T[],kind:'spaces'|'boards'|'pages',favorites:string[],query:string,page:number,pageSize:number) {
 const favorite=new Set(favorites);
 const title=(item:T)=>item.title||item.name||'';
 const sorted=items.map((item,index)=>({item,index})).filter(({item})=>matchesSearch(query,title(item),item.body,item.description)).sort((a,b)=>
  (query.trim() ? searchRelevance(query,title(b.item))-searchRelevance(query,title(a.item)) : 0) ||
  Number(favorite.has(kind+':'+b.item.id))-Number(favorite.has(kind+':'+a.item.id)) ||
  (Date.parse(b.item.createdAt||'')||0)-(Date.parse(a.item.createdAt||'')||0) || a.index-b.index).map(({item})=>item);
 const pages=Math.max(1,Math.ceil(sorted.length/pageSize)),current=Math.max(1,Math.min(pages,page));
 return {items:sorted.slice((current-1)*pageSize,current*pageSize),page:current,pages,total:sorted.length};
}
