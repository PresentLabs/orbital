export const roleOptions = [
  { value: "admin", label: "Administrador" },
  { value: "editor", label: "Editor" },
  { value: "member", label: "Colaborador" },
  { value: "viewer", label: "Lector" },
] as const;
export const roleLabel = (role: string) =>
  role === "owner"
    ? "Administrador"
    : roleOptions.find((r) => r.value === role)?.label || "Colaborador";
