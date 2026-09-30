"use client";

import { useState } from "react";

/**
 * ¿Hay cambios sin guardar? Compara lo que se está editando (`snapshot`, todo
 * lo que el formulario manda al guardar) contra cómo estaba al abrir la pieza
 * o tras el último guardado. `markSaved()` toma como nueva base el siguiente
 * render — así incluye lo que el guardado haya ajustado (p.ej. el SEO que se
 * genera solo al guardar).
 */
export function useDirty(snapshot: unknown): { isDirty: boolean; markSaved: () => void } {
  const current = JSON.stringify(snapshot);
  const [baseline, setBaseline] = useState<string | null>(current);
  // Actualización en render (no en efecto): la base se fija con el estado ya guardado.
  if (baseline === null) setBaseline(current);
  return { isDirty: baseline !== null && current !== baseline, markSaved: () => setBaseline(null) };
}
