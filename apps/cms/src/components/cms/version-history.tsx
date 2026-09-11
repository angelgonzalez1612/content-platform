"use client";

import { useEffect, useState } from "react";
import { apiConfig } from "@planazo/config";

interface ContentVersion {
  id: string;
  label: string;
  createdAt: string;
}

/**
 * Historial navegable de versiones — una entrada por cada vez que se guardó
 * un cambio real (a mano o "Mejorar con IA" aplicado). Las flechitas mueven
 * el CURSOR entre versiones guardadas (no hacen nada por sí solas); "Restaurar
 * esta versión" es la acción que de verdad revierte el contenido — reemplaza
 * la fila en vivo con el snapshot elegido, y a su vez guarda el estado actual
 * como una versión nueva antes de hacerlo (restaurar también es reversible).
 */
export function VersionHistory({ contentType, contentId }: { contentType: string; contentId: string }) {
  const [versions, setVersions] = useState<ContentVersion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`${apiConfig.baseUrl}/cms/content-versions?contentType=${encodeURIComponent(contentType)}&contentId=${encodeURIComponent(contentId)}`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setVersions(data);
      })
      .catch(() => {
        if (!cancelled) setVersions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [contentType, contentId]);

  if (!versions || versions.length === 0) return null;

  const selected = versions[index];

  async function restore() {
    setRestoring(true);
    setError("");
    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/content-versions/${selected.id}/restore`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      window.location.reload();
    } catch {
      setError("No se pudo restaurar — intenta de nuevo.");
      setRestoring(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-border bg-white px-3.5 py-2 text-[12.5px]">
      <span className="font-medium text-ink-faint">Historial:</span>
      <button
        type="button"
        onClick={() => setIndex((i) => Math.min(i + 1, versions.length - 1))}
        disabled={index >= versions.length - 1}
        aria-label="Versión anterior"
        className="flex size-6 items-center justify-center rounded-md border border-border text-ink-soft transition-colors hover:border-ink-faint disabled:opacity-30"
      >
        ◀
      </button>
      <span className="text-ink">
        Versión {index + 1} de {versions.length}
        <span className="text-ink-faint"> · {selected.label} · {new Date(selected.createdAt).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
      </span>
      <button
        type="button"
        onClick={() => setIndex((i) => Math.max(i - 1, 0))}
        disabled={index === 0}
        aria-label="Versión siguiente"
        className="flex size-6 items-center justify-center rounded-md border border-border text-ink-soft transition-colors hover:border-ink-faint disabled:opacity-30"
      >
        ▶
      </button>
      <button
        type="button"
        onClick={restore}
        disabled={restoring}
        className="rounded-md border border-border bg-white px-2.5 py-1 text-[11.5px] font-semibold text-brand transition-colors hover:border-brand disabled:cursor-default disabled:opacity-60"
      >
        {restoring ? "Restaurando…" : "Restaurar esta versión"}
      </button>
      {error && <span className="text-negative">{error}</span>}
    </div>
  );
}
