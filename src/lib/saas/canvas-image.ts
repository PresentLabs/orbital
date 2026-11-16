const types = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp']);
export function normalizeCanvasImageFile(file:File):File|null {
  const aliases:Record<string,string>={'image/jpg':'image/jpeg','image/x-png':'image/png','image/x-ms-bmp':'image/bmp'};
  const extensions:Record<string,string>={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif',bmp:'image/bmp'};
  const mime=aliases[file.type]||file.type||extensions[file.name.split('.').pop()?.toLowerCase()||''];
  if(!types.has(mime))return null;
  return file.type===mime?file:new File([file],file.name||'pantallazo.png',{type:mime,lastModified:file.lastModified});
}
export function clipboardImageFiles(data: Pick<DataTransfer, 'items' | 'files'> | null): File[] {
  if (!data) return [];
  const normalize=(files:File[])=>files.map(normalizeCanvasImageFile).filter((file):file is File=>!!file);
  const items=normalize(Array.from(data.items||[]).filter(item=>item.kind==='file').map(item=>item.getAsFile()).filter((file):file is File=>!!file));
  return items.length?items:normalize(Array.from(data.files||[]));
}
export function canvasImageSize(width: number, height: number, maxSide = 2560) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width * height > 64_000_000) throw Error('El pantallazo tiene dimensiones demasiado grandes.');
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale))};
}
export async function prepareCanvasScreenshot(file: File, options: {maxSide?:number;maxWidth?:number;maxLength?:number;keepSize?:boolean; vision?:boolean} = {}): Promise<string> {
  if (!types.has(file.type) || file.size > 20 * 1024 * 1024 || !file.size) throw Error('Pega una imagen de hasta 20 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const size = canvasImageSize(bitmap.width, bitmap.height, options.maxWidth
      ? Math.max(bitmap.width, bitmap.height) * Math.min(1, options.maxWidth / bitmap.width)
      : options.maxSide || 2560);
    const canvas = document.createElement('canvas');
    const limit = options.maxLength || 2_000_000;
    if (size.width === bitmap.width && size.height === bitmap.height &&
        (options.vision ? file.type === "image/webp" : options.keepSize && /^image\/(png|jpeg|webp)$/.test(file.type))) {
      const original = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      if (original.length <= limit) return original;
    }
    canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw Error('No pudimos preparar el pantallazo.');
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    let encoded = '';
    if (options.keepSize) {
      encoded = canvas.toDataURL("image/png");
      if (encoded.length <= limit) return encoded;
    }
    if (options.vision) {
      for (let attempt = 0; attempt < 9; attempt++) {
        for (const quality of [.98, .94, .90]) {
          const webp = canvas.toDataURL("image/webp", quality);
          if (webp.startsWith("data:image/webp;") && webp.length <= limit) return webp;
        }
        canvas.width = Math.max(1, Math.round(canvas.width * .83));
        canvas.height = Math.max(1, Math.round(canvas.height * .83));
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      }
      throw Error("No pudimos optimizar la imagen para el vision board.");
    }
    for(let attempt=0;attempt<(options.maxLength && !options.keepSize ? 5 : 1);attempt++){
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of options.keepSize ? [.98, .95, .92, .89, .86] : [.94, .86, .76]) {
        encoded = canvas.toDataURL('image/webp', quality);
        if (encoded.length <= (options.maxLength || 2_000_000)) return encoded;
      }
      canvas.width=Math.max(1,Math.round(canvas.width*.75));canvas.height=Math.max(1,Math.round(canvas.height*.75));
    }
    throw Error(options.keepSize ? 'La imagen supera 1,5 MB con la calidad mínima admitida. Elige otra imagen.' : 'No pudimos reducir el pantallazo. Prueba con una captura más pequeña.');
  } finally { bitmap.close(); }
}
