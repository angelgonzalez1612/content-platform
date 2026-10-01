// Códigos de salida de Windows (NTSTATUS) con los que un CLI muere antes de
// empezar — sin stderr, así que el mensaje crudo ("código 3221225794") no
// dice nada. Casi siempre es falta de memoria del equipo.
const WINDOWS_EXIT_HINTS: Record<number, string> = {
  3221225794: 'Windows no pudo iniciar el CLI (0xC0000142): casi siempre es poca memoria libre. Cierra programas y vuelve a intentar.',
  3221225495: 'El equipo se quedó sin memoria (0xC0000017). Cierra programas y vuelve a intentar.',
};

/** Explicación legible para un código de salida de Windows conocido, o null. */
export function windowsExitHint(code: number | string | null | undefined): string | null {
  const n = typeof code === 'string' ? Number(code) : code;
  return n != null && Number.isFinite(n) ? (WINDOWS_EXIT_HINTS[n] ?? null) : null;
}
