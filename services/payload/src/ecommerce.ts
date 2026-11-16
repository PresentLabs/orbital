export const ecommerceRoles = [
  { value: "propietario-tienda", label: "Propietario de la tienda" },
  { value: "gerente-ecommerce", label: "Gerente de ecommerce" },
  { value: "gestor-catalogo", label: "Gestor de catálogo" },
  { value: "gestor-pedidos", label: "Gestor de pedidos" },
  { value: "atencion-cliente", label: "Atención al cliente" },
  { value: "marketing", label: "Marketing y contenido" },
  { value: "logistica", label: "Logística y despacho" },
  { value: "finanzas", label: "Finanzas y facturación" },
] as const;
export function validSocialLinks(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([key, url]) =>
      [
        "instagram",
        "facebook",
        "tiktok",
        "linkedin",
        "youtube",
        "pinterest",
        "x",
      ].includes(key) &&
      typeof url === "string" &&
      url.length <= 500 &&
      (!url ||
        (() => {
          try {
            const u = new URL(url);
            return u.protocol === "https:" && !u.username && !u.password;
          } catch {
            return false;
          }
        })()),
  );
}
