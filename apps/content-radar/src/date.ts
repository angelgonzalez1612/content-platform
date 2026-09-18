// Fecha local (no UTC) en formato YYYY-MM-DD. Importante: usar toISOString() aquí
// es un bug clásico — después de ~18:00 hora CDMX (UTC-6), la fecha UTC ya cruzó a
// "mañana", así que los reportes/nombres de archivo terminan fechados un día adelante
// del calendario real del usuario.
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// HHmm local — para que cada corrida del día (7am, 12pm, "Actualizar" a
// mano, etc.) guarde su propio snapshot en vez de pisar el reporte del día.
export function nowLocalTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;
}
