// Capture the requested mode before canonical navigation rewrites the initial URL.
export const demoMode = typeof location !== "undefined" && new URLSearchParams(location.search).get("demo") === "1";
export function demoPath(path: string, demo = demoMode) {
  if (!demo || !/^\/app(?:[/?#]|$)/.test(path)) return path;
  const url = new URL(path, "http://orbita.invalid");
  url.searchParams.set("demo", "1");
  return url.pathname + url.search + url.hash;
}
export const routeNames: Record<string, string> = {
  modules: "modulos",
  overview: "vista-general",
  trash: "papelera",
  customers: "tienda/clientes",
  customer: "tienda/clientes/ver",
  "private-index": "mi-area-privada",
  search: "buscar",
  event: "calendario/eventos",
  canvas: "espacios",
  tasks: "tareas",
  calendar: "calendario",
  files: "archivos",
  analytics: "tienda/metricas",
  pages: "notas",
  settings: "configuracion",
  profile: "perfil",
  documents: "documentos",
  document: "documentos/ver",
  vault: "accesos",
  team: "equipo",
  polls: "equipo/votaciones",
  orders: "tienda/pedidos",
  invoices: "tienda/facturas-y-boletas",
  private: "mi-area-privada",
  task: "tareas/detalle",
  page: "notas/detalle",
  blocked: "sin-acceso",
};
export const settingRoutes: Record<string, string> = {
  company: "empresa",
  brand: "logo-y-marca",
  preferences: "preferencias",
  social: "redes-sociales",
  integrations: "integraciones",
};
export function slugify(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "elemento"
  );
}
type Named = { id: string; name?: string; title?: string };
export function entitySlug(entity: Named, all: Named[]) {
  const slug = slugify(entity.name || entity.title || entity.id);
  return all.filter((e) => slugify(e.name || e.title || e.id) === slug).length >
    1
    ? slug + "-" + slugify(entity.id)
    : slug;
}
export function findEntity<T extends Named>(slug: string, all: T[]) {
  return all.find((e) => entitySlug(e, all) === slug || e.id === slug);
}
