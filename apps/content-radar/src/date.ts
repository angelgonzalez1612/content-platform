// Fecha local (no UTC) en formato YYYY-MM-DD. Importante: usar toISOString() aquí
// es un bug clásico — después de ~18:00 hora CDMX (UTC-6), la fecha UTC ya cruzó a
// "mañana", así que los reportes/nombres de archivo terminan fechados un día adelante
// del calendario real del usuario.
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
