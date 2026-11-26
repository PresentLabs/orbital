export type SearchKind =
  "space" | "task" | "page" | "event" | "document" | "order" | "section";
export interface SearchEntry {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  view?: string;
  content?: string;
}
export const normalizeSearch = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function matchesSearch(query: string, ...values: unknown[]) {
  const text = normalizeSearch(values.join(" "));
  return normalizeSearch(query)
    .replace(/^#(?=\d)/, "")
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => text.includes(term));
}
export function searchRelevance(query: string, title: string) {
  const normalizedTitle = normalizeSearch(title);
  const term = normalizeSearch(query);
  if (normalizedTitle === term) return 3;
  if (normalizedTitle.startsWith(term)) return 2;
  return Number(matchesSearch(query, title));
}
export function searchExcerpt(query: string, content?: string) {
  if (!content) return "";
  const text = content.replace(/\s+/g, " ").trim();
  const normalized = normalizeSearch(text);
  const offset = normalizeSearch(query).split(/\s+/).map(term => normalized.indexOf(term)).filter(index => index >= 0);
  const start = Math.max(0, (offset.length ? Math.min(...offset) : 0) - 30);
  return (start > 0 ? "…" : "") + text.slice(start, start + 115).trim() + (text.length > start + 115 ? "…" : "");
}
export const searchLabels: Record<SearchKind, string> = {
  space: "Espacio",
  task: "Tarea",
  page: "Nota",
  event: "Evento",
  document: "Documento",
  order: "Pedido",
  section: "Sección",
};
