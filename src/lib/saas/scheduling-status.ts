export const bookingStatuses: Record<string, { label: string; commerce: string }> = {
  pending: { label: "Por confirmar", commerce: "pending" },
  confirmed: { label: "Confirmada", commerce: "processing" },
  completed: { label: "Realizada", commerce: "completed" },
  canceled: { label: "Cancelada", commerce: "cancelled" },
  no_show: { label: "No asistió", commerce: "failed" },
};
export function bookingStatus(status: string) {
  return bookingStatuses[status] || { label: "Sin estado", commerce: "other" };
}
