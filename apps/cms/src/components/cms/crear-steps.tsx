import Link from "next/link";
import { Icon } from "@/components/icon";

const PIN_ICON = "M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z";
const NEWSPAPER_ICON = "M4 5h16v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zM8 9h8M8 13h8M8 17h5";
const CHECK_ICON = "M5 13l4 4L19 7";

/** Franja de pasos del flujo de Crear — compartida entre /crear (pasos 1 y
 * 2) y /centro-ia (paso 3, donde antes había una barra de pestañas
 * Planazo/La Mira separada y sin relación visual con el resto del flujo).
 * Los pasos ya completados enlazan de vuelta para poder cambiar de
 * proyecto o de método sin perder el lugar donde se estaba. */
export function CrearSteps({ current, site }: { current: 1 | 2 | 3; site?: "lamira" | "planazo" }) {
  const step2Href = site ? `/crear?site=${site}` : "/crear";
  return (
    <div className="mb-9 flex items-center justify-center gap-3">
      <StepBadge n={1} label="Proyecto" state={current === 1 ? "current" : "done"} href={current > 1 ? "/crear" : undefined} />
      <Connector active={current > 1} />
      <StepBadge n={2} label="Cómo crear" state={current === 2 ? "current" : current > 2 ? "done" : "upcoming"} href={current > 2 ? step2Href : undefined} />
      <Connector active={current > 2} />
      <StepBadge n={3} label="Redactar" state={current === 3 ? "current" : "upcoming"} />
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return <span className={`h-px w-12 flex-none transition-colors ${active ? "bg-brand" : "bg-border"}`} />;
}

function StepBadge({
  n,
  label,
  state,
  href,
}: {
  n: number;
  label: string;
  state: "done" | "current" | "upcoming";
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-2">
      <span
        className={`grid size-7 flex-none place-items-center rounded-full text-[12px] font-semibold transition-colors ${
          state === "done" ? "bg-brand text-white" : state === "current" ? "bg-ink-solid text-white" : "border border-border bg-card text-ink-faint"
        }`}
      >
        {state === "done" ? <Icon d={CHECK_ICON} size={12} strokeWidth={2.4} /> : n}
      </span>
      <span className={`text-[12.5px] font-medium ${state === "upcoming" ? "text-ink-faint" : "text-ink"}`}>{label}</span>
    </div>
  );

  return href ? (
    <Link href={href} className="rounded-lg transition-opacity hover:opacity-70">
      {content}
    </Link>
  ) : (
    content
  );
}

/** Recuerda en qué proyecto se está trabajando — usado en el paso 2 (Crear)
 * y el paso 3 (Centro IA), donde ya no se ve el paso 1. */
export function ProjectPill({ site }: { site: "lamira" | "planazo" }) {
  const label = site === "lamira" ? "La Mira" : "Planazo";
  const icon = site === "lamira" ? NEWSPAPER_ICON : PIN_ICON;
  return (
    <div className="mb-4 flex justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[12px] font-medium text-ink-soft">
        <Icon d={icon} size={12} strokeWidth={1.8} />
        {label}
      </span>
    </div>
  );
}
