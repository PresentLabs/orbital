import {fileFormat} from './files-library';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
export async function fileThumbnail(blob:Blob,name:string):Promise<Blob>{
 const canvas=document.createElement('canvas');canvas.width=480;canvas.height=300;const ctx=canvas.getContext('2d')!;
 ctx.fillStyle=`hsl(${fileFormat(name,blob.type).hue} 70% 94%)`;ctx.fillRect(0,0,480,300);
 let drawn=false;
 if(['image/png','image/jpeg','image/webp','image/gif'].includes(blob.type)){
  const bitmap=await createImageBitmap(blob,{resizeWidth:480,resizeQuality:'high'});const ratio=Math.min(480/bitmap.width,300/bitmap.height);ctx.drawImage(bitmap,(480-bitmap.width*ratio)/2,(300-bitmap.height*ratio)/2,bitmap.width*ratio,bitmap.height*ratio);bitmap.close();drawn=true;
 }else if(blob.type==='application/pdf'){
  const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
  const task=pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer())});
  try{const pdf=await task.promise,page=await pdf.getPage(1),base=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(480/base.width,300/base.height)});const sheet=document.createElement('canvas');sheet.width=Math.ceil(viewport.width);sheet.height=Math.ceil(viewport.height);await page.render({canvas:sheet,viewport}).promise;ctx.drawImage(sheet,(480-sheet.width)/2,(300-sheet.height)/2);drawn=true;}finally{await task.destroy();}
 }
 if(!drawn){
  const ext=(name.split('.').pop()||'ARCHIVO').slice(0,7).toUpperCase();
  ctx.fillStyle=`hsl(${fileFormat(name,blob.type).hue} 35% 38%)`;ctx.font='500 30px sans-serif';ctx.textAlign='center';ctx.fillText(ext,240,160);
  
 }
 return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('No pudimos generar la miniatura.')),'image/webp',.72));
}
