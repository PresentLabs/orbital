const encoder = new TextEncoder();
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
export function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
/** ZIP stored entries: files are already compressed PDFs/images; UTF-8 names, no dependencies. */
export async function documentZip(files: { name: string; blob: Blob }[]) {
  if (!files.length || files.length > 1000) throw Error('Selecciona entre 1 y 1000 documentos.');
  if (files.reduce((sum, f) => sum + f.blob.size, 0) > 100 * 1024 * 1024)
    throw Error('La selección supera los 100 MB. Descarga los documentos en grupos más pequeños.');
  const parts: BlobPart[] = [], central: BlobPart[] = [], names = new Set<string>();
  let offset = 0, centralSize = 0;
  for (const file of files) {
    const clean = file.name.replace(/[\\/\x00-\x1f]/g, '_').replace(/^\.+/, '_').slice(0, 180) || 'documento';
    let name = clean, n = 1;
    const dot = clean.lastIndexOf('.'), base = dot > 0 ? clean.slice(0, dot) : clean, ext = dot > 0 ? clean.slice(dot) : '';
    while (names.has(name.toLowerCase())) name = `${base} (${++n})${ext}`;
    names.add(name.toLowerCase());
    const filename = encoder.encode(name), bytes = new Uint8Array(await file.blob.arrayBuffer()), crc = crc32(bytes);
    const header = new ArrayBuffer(30), h = new DataView(header);
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x800, true);
    h.setUint16(12, 33, true); h.setUint32(14, crc, true); h.setUint32(18, bytes.length, true); h.setUint32(22, bytes.length, true); h.setUint16(26, filename.length, true);
    parts.push(header, filename, bytes);
    const dir = new ArrayBuffer(46), d = new DataView(dir);
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x800, true); d.setUint16(14, 33, true);
    d.setUint32(16, crc, true); d.setUint32(20, bytes.length, true); d.setUint32(24, bytes.length, true); d.setUint16(28, filename.length, true); d.setUint32(42, offset, true);
    central.push(dir, filename); centralSize += 46 + filename.length; offset += 30 + filename.length + bytes.length;
  }
  const end = new ArrayBuffer(22), e = new DataView(end);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, centralSize, true); e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}
