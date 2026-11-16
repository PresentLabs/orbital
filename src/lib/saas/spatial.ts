export const noteColors = {
  amarillo: "#ffd514",
  verde: "#00f94d",
  turquesa: "#00f5da",
  rosa: "#eb4cf3",
  coral: "#ff7953",
  verdeLima: "#9afa00",
} as const;

export function noteTextColor(_value?: NoteColor) {
  return "#241b27";
}

const legacyNoteColors = { lima: "verde", lila: "rosa", naranja: "amarillo" } as const;
export type NoteColor = keyof typeof noteColors | keyof typeof legacyNoteColors;
export function isNoteColor(value: string) {
  return Object.hasOwn(noteColors, value) || Object.hasOwn(legacyNoteColors, value);
}
export function visibleNoteColor(value?: NoteColor): keyof typeof noteColors {
  if (value && Object.hasOwn(noteColors, value)) return value as keyof typeof noteColors;
  return value ? legacyNoteColors[value as keyof typeof legacyNoteColors] ?? "amarillo" : "amarillo";
}

export type SpatialBlock = {
  type: "web" | "media" | "sketch" | "stack" | "group";
  url?: string;
  fileId?: string;
  mime?: string;
  data?: string;
  preview?: string;
  autoPreview?: boolean;
  members?: string[];
  collapsed?: boolean;
  strokes?: number[][][];
};
export function spatialUrl(value: string) {
  try {
    const u = new URL(value.trim());
    return ["https:", "http:"].includes(u.protocol) &&
      !u.username &&
      !u.password &&
      u.href.length <= 2000
      ? u.href
      : null;
  } catch {
    return null;
  }
}
export function validSpatial(n: any) {
  if (
    n.width !== undefined &&
    (!Number.isFinite(n.width) || n.width < 180 || n.width > 1000)
  )
    return false;
  if (
    n.height !== undefined &&
    (!Number.isFinite(n.height) || n.height < 120 || n.height > 1200)
  )
    return false;
  const s = n.spatial;
  if (s === undefined) return true;
  if (!s || !["web", "media", "sketch", "stack", "group"].includes(s.type))
    return false;
  if (
    s.url !== undefined &&
    (typeof s.url !== "string" || s.url.length > 2000 || !spatialUrl(s.url))
  )
    return false;
  if (
    s.fileId !== undefined &&
    (typeof s.fileId !== "string" ||
      s.fileId.length > 150 ||
      !/^[-\w:]+$/.test(s.fileId))
  )
    return false;
  if (
    s.mime !== undefined &&
    (typeof s.mime !== "string" || !/^[-\w.+]+\/[-\w.+]+$/.test(s.mime))
  )
    return false;
  if (
    s.data !== undefined &&
    (typeof s.data !== "string" ||
      s.data.length > 2100000 ||
      !/^data:(video\/(mp4|webm|quicktime)|audio\/(mpeg|mp3|wav|ogg|webm)|image\/gif);base64,[A-Za-z0-9+/=]+$/.test(
        s.data,
      ))
  )
    return false;
  if (
    s.preview !== undefined &&
    (typeof s.preview !== "string" ||
      s.preview.length > 2100000 ||
      !/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(s.preview))
  )
    return false;
  if (
    s.members !== undefined &&
    (!Array.isArray(s.members) ||
      s.members.length > 100 ||
      new Set(s.members).size !== s.members.length ||
      s.members.some(
        (v: any) =>
          typeof v !== "string" || !/^[-\w ]{1,100}$/.test(v) || v === n.id,
      ))
  )
    return false;
  if (s.autoPreview !== undefined && typeof s.autoPreview !== "boolean") return false;
  if (s.collapsed !== undefined && typeof s.collapsed !== "boolean")
    return false;
  if (
    s.strokes !== undefined &&
    (!Array.isArray(s.strokes) ||
      s.strokes.length > 100 ||
      s.strokes.some(
        (line: any) =>
          !Array.isArray(line) ||
          line.length > 2000 ||
          line.some(
            (p: any) =>
              !Array.isArray(p) ||
              p.length !== 2 ||
              p.some((v: any) => !Number.isFinite(v) || v < 0 || v > 300),
          ),
      ))
  )
    return false;
  return true;
}
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
/** Plain-text-first Markdown import; HTML and unsafe links remain inert text. */
export function markdownHtml(source: string) {
  let code = false;
  return (
    source
      .slice(0, 30000)
      .split(/\r?\n/)
      .map((line) => {
        if (/^```/.test(line)) {
          code = !code;
          return code ? "<pre>" : "</pre>";
        }
        if (code) return esc(line) + "\n";
        let html = esc(line)
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/\*(.+?)\*/g, "<em>$1</em>")
          .replace(/`([^`]+)`/g, "<code>$1</code>");
        const heading = html.match(/^(#{1,3})\s+(.+)$/);
        if (heading)
          return `<h${heading[1].length}>${heading[2]}</h${heading[1].length}>`;
        if (/^[-*]\s+/.test(line))
          return `<ul><li>${html.replace(/^[-*]\s+/, "")}</li></ul>`;
        if (/^\d+\.\s+/.test(line))
          return `<ol><li>${html.replace(/^\d+\.\s+/, "")}</li></ol>`;
        if (/^>\s?/.test(line))
          return `<blockquote>${html.replace(/^&gt;\s?/, "")}</blockquote>`;
        return `<p>${html || "<br>"}</p>`;
      })
      .join("")
      .replace(/<\/ul><ul>/g, "")
      .replace(/<\/ol><ol>/g, "") + (code ? "</pre>" : "")
  );
}
export function textBookmarks(text: string): { url: string; title: string }[] {
  try {
    const value = JSON.parse(text),
      items = Array.isArray(value)
        ? value
        : Array.isArray(value.bookmarks)
          ? value.bookmarks
          : [];
    return items.slice(0, 100).flatMap((v: any) => {
      const url = spatialUrl(
        typeof v === "string" ? v : String(v?.url || v?.href || ""),
      );
      return url
        ? [
            {
              url,
              title: String(v?.title || v?.name || new URL(url).hostname).slice(
                0,
                120,
              ),
            },
          ]
        : [];
    });
  } catch {}
  return text
    .split(/\r?\n/)
    .slice(0, 100)
    .flatMap((line) => {
      const url = spatialUrl(line);
      return url ? [{ url, title: new URL(url).hostname }] : [];
    });
}
