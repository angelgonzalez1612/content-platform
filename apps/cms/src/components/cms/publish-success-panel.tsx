"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";

const CHECK_ICON = "M20 6 9 17l-5-5";

// Pantalla que se muestra al terminar de crear, en vez de navegar de
// inmediato — solo cuando viene de PublishFlow (Publicar desde content-radar,
// donde la IA no sabe de antemano el sitio y puede convenir publicarlo en
// los dos). Fuera de ese flujo, cada GenerateXFlow sigue navegando directo
// al contenido creado, sin pasar por aquí.
export function PublishSuccessPanel({
  name,
  viewHref,
  otherSiteLabel,
  onPublishOther,
  publishingOther,
}: {
  name: string;
  viewHref: string;
  otherSiteLabel?: string;
  onPublishOther?: () => void;
  publishingOther?: boolean;
}) {
  return (
    <div className="mx-auto max-w-[560px] p-[26px] pb-[60px] text-center">
      <div className="mx-auto mb-4 grid size-[46px] place-items-center rounded-2xl border border-[#CFEBD8] bg-[#EAF7EE]">
        <Icon d={CHECK_ICON} size={20} strokeWidth={2.4} className="text-[#2F9E52]" />
      </div>
      <h1 className="mb-1.5 text-[20px] font-semibold tracking-tight">¡Publicado!</h1>
      <p className="mx-auto mb-7 max-w-[42ch] text-[13.5px] leading-[1.6] text-ink-soft">
        &quot;{name}&quot; ya se guardó correctamente.
      </p>
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link
          href={viewHref}
          className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] hover:bg-brand-pressed"
        >
          Ver publicado
        </Link>
        {otherSiteLabel && onPublishOther && (
          <button
            type="button"
            onClick={onPublishOther}
            disabled={publishingOther}
            className="rounded-[10px] border border-border bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-default disabled:opacity-60"
          >
            {publishingOther ? "Preparando…" : `También publicar en ${otherSiteLabel}`}
          </button>
        )}
      </div>
    </div>
  );
}
