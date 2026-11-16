/** Shared policy. Contains no server code or secrets and is also used by Astro. */
export const sections = [
  "overview",
  "profile",
  "documents",
  "orders",
  "customers",
  "invoices",
  "canvas",
  "tasks",
  "calendar",
  "files",
  "analytics",
  "pages",
  "integrations",
  "vault",
  "team",
  "settings",
] as const;
export type Section = (typeof sections)[number];
export const defaultPermissions: Section[] = [
  "overview",
  "canvas",
  "tasks",
  "calendar",
  "files",
  "analytics",
  "pages",
];
export interface Actor {
  id?: string | number;
  role?: string | null;
  permissions?: string[] | null;
  disabled?: boolean | null;
  workspace?: unknown;
}
export function isAdmin(user: Actor | null | undefined) {
  return (
    !!user && !user.disabled && ["owner", "admin"].includes(user.role || "")
  );
}
export function canView(user: Actor | null | undefined, section: Section) {
  if (!user || user.disabled) return false;
  if (isAdmin(user)) return true;
  if (section === "profile") return true;
  if (
    section === "analytics" ||
    section === "documents" ||
    section === "orders" ||
    section === "customers" ||
    section === "invoices" ||
    section === "team" ||
    section === "settings" ||
    section === "integrations"
  )
    return false;
  return (user.permissions ?? defaultPermissions).includes(section);
}
export function canWrite(user: Actor | null | undefined, section: Section) {
  return (
    canView(user, section) && (section === "profile" || user?.role !== "viewer")
  );
}
export const documentSections: Record<string, Section> = {
  goals: "overview",
  focus: "profile",
  tasks: "tasks",
  boards: "tasks",
  nodes: "canvas",
  spaces: "canvas",
  edges: "canvas",
  events: "calendar",
  pages: "pages",
  settings: "settings",
};
export function sectionForKey(key: unknown): Section | undefined {
  if (typeof key !== "string") return;
  return documentSections[key.split(":")[0]];
}
