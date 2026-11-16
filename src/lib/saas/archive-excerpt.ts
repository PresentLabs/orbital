type Entry = { name: string; method: number; size: number; compressed: number; offset: number };
const maxEntry = 1024 * 1024;
const decoder = new TextDecoder();

async function directory(blob: Blob): Promise<Entry[]> {
  const tail = new DataView(await blob.slice(Math.max(0, blob.size - 65557)).arrayBuffer());
  for (let end = tail.byteLength - 22; end >= 0; end--) {
    if (tail.getUint32(end, true) !== 0x06054b50 || end + 22 + tail.getUint16(end + 20, true) !== tail.byteLength) continue;
    const length = tail.getUint32(end + 12, true);
    const start = tail.getUint32(end + 16, true);
    if (length > maxEntry || start + length > blob.size) return [];
    const bytes = await blob.slice(start, start + length).arrayBuffer();
    const data = new DataView(bytes);
    const entries: Entry[] = [];
    for (let index = 0; index + 46 <= data.byteLength && entries.length < 1000;) {
      if (data.getUint32(index, true) !== 0x02014b50) break;
      const nameLength = data.getUint16(index + 28, true);
      const next = index + 46 + nameLength + data.getUint16(index + 30, true) + data.getUint16(index + 32, true);
      if (next > data.byteLength) break;
      const name = decoder.decode(bytes.slice(index + 46, index + 46 + nameLength));
      if (!(data.getUint16(index + 8, true) & 1)) {
        entries.push({
          name,
          method: data.getUint16(index + 10, true),
          compressed: data.getUint32(index + 20, true),
          size: data.getUint32(index + 24, true),
          offset: data.getUint32(index + 42, true),
        });
      }
      index = next;
    }
    return entries;
  }
  return [];
}

async function xmlEntry(blob: Blob, entry?: Entry) {
  if (!entry || entry.size > maxEntry || entry.compressed > maxEntry) return;
  const header = new DataView(await blob.slice(entry.offset, entry.offset + 30).arrayBuffer());
  if (header.byteLength !== 30 || header.getUint32(0, true) !== 0x04034b50) return;
  const start = entry.offset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
  if (start + entry.compressed > blob.size) return;
  const content = blob.slice(start, start + entry.compressed);
  let text: string;
  if (entry.method === 0) text = await content.text();
  else if (entry.method === 8) {
    const reader = content.stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
    text = "";
    let length = 0;
    const utf8 = new TextDecoder();
    try {
      for (;;) {
        const result = await reader.read();
        if (result.done) break;
        length += result.value.byteLength;
        if (length > maxEntry) return;
        text += utf8.decode(result.value, {stream:true});
      }
      text += utf8.decode();
    } finally { await reader.cancel(); }
  } else return;
  if (/<!DOCTYPE/i.test(text)) return;
  return new DOMParser().parseFromString(text, "application/xml");
}

export async function archiveExcerpt(blob: Blob, filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension || !["docx", "pptx", "xlsx", "zip"].includes(extension)) return;
  const entries = await directory(blob);
  const read = (name: string) => xmlEntry(blob, entries.find(entry => entry.name === name));
  const tagged = (node: Document | Element, tag: string) => Array.from(node.getElementsByTagNameNS("*", tag));
  const textOf = (node: Document | Element) => tagged(node, "t").map(el => el.textContent).join("");
  if (extension === "zip") return entries.filter(entry => !entry.name.endsWith("/")).slice(0, 20).map(entry => entry.name).join("\n") || undefined;
  if (extension === "docx") {
    const doc = await read("word/document.xml");
    return doc && tagged(doc, "p").slice(0, 30).map(textOf).filter(Boolean).join("\n");
  }
  if (extension === "pptx") {
    const firstSlide = entries.filter(entry => /^ppt\/slides\/slide\d+\.xml$/.test(entry.name))
      .sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric:true}))[0];
    const doc = await xmlEntry(blob, firstSlide);
    return doc && tagged(doc, "p").slice(0, 30).map(textOf).filter(Boolean).join("\n");
  }
  const firstSheet = entries.filter(entry => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name))
    .sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric:true}))[0];
  const [sheet, strings] = await Promise.all([xmlEntry(blob, firstSheet), read("xl/sharedStrings.xml")]);
  if (!sheet) return;
  const shared = strings ? tagged(strings, "si").map(textOf) : [];
  return tagged(sheet, "row").slice(0, 20).map(row => tagged(row, "c").slice(0, 8).map(cell => {
    const raw = tagged(cell, "v")[0]?.textContent ?? "";
    return cell.getAttribute("t") === "s" ? shared[Number(raw)] || "" : raw || textOf(cell);
  }).join("  ·  ")).join("\n");
}
