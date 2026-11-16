export type SearchKind =
  "space" | "task" | "page" | "event" | "document" | "order" | "section";
export interface SearchEntry {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle: string;
  view?: string;
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
export const searchLabels: Record<SearchKind, string> = {
  space: "Espacio",
  task: "Tarea",
  page: "Nota",
  event: "Evento",
  document: "Documento",
  order: "Pedido",
  section: "Sección",
};
