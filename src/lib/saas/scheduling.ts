export const schedulingSections = [
  { id: "dashboard", path: "", label: "Resumen", description: "Revisa el movimiento de tu agenda y las próximas horas de atención." },
  { id: "agenda", path: "agenda", label: "Agenda", description: "Consulta y administra las horas agendadas de tu negocio." },
  { id: "service", path: "servicios", label: "Servicios", description: "Define tus servicios, precios y tiempos de atención." },
  { id: "package", path: "paquetes", label: "Paquetes", description: "Organiza los servicios y las sesiones incluidas en cada paquete.", admin: true },
  { id: "extra", path: "extras", label: "Extras", description: "Define complementos, precios y tiempos adicionales para tus servicios.", admin: true },
  { id: "category", path: "categorias", label: "Categorías", description: "Agrupa tus servicios y organiza sus categorías.", admin: true },
  { id: "professional", path: "profesionales", label: "Profesionales", description: "Organiza tu equipo de atención y sus horarios." },
  { id: "location", path: "sucursales", label: "Sucursales", description: "Administra los lugares donde atiende tu negocio." },
  { id: "resource", path: "recursos", label: "Recursos", description: "Controla las salas y el equipamiento de tus atenciones." },
  { id: "customer", path: "clientes", label: "Clientes", description: "Mantén a mano los datos de contacto de tus clientes.", admin: true },
  { id: "settings", path: "configuracion", label: "Configuración", description: "Ajusta los horarios, días de atención y preferencias del negocio.", admin: true },
] as const;
export type SchedulingSection = typeof schedulingSections[number]["id"];
export function schedulingSection(path: string): SchedulingSection | undefined {
  const segments = path.replace(/^\/app\/?/, "").replace(/\/$/, "").split("/");
  if (!["agendamiento", "reservas"].includes(segments[0]) || segments.length > 2) return undefined;
  return schedulingSections.find((section) => section.path === (segments[1] || ""))?.id;
}
export function schedulingPath(id: SchedulingSection) {
  const section = schedulingSections.find((section) => section.id === id)!;
  return "/app/agendamiento" + (section.path ? "/" + section.path : "");
}
