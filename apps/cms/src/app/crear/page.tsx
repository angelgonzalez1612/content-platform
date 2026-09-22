import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { CmsShell } from "@/components/cms/cms-shell";
import { Icon } from "@/components/icon";
import { LamiraCrearTypePicker } from "@/components/cms/lamira/crear-type-picker";
import { PlanazoCrearTypePicker } from "@/components/cms/planazo/crear-type-picker";

const PIN_ICON = "M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z";
const NEWSPAPER_ICON = "M4 5h16v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5zM8 9h8M8 13h8M8 17h5";
const ARROW_ICON = "M5 12h14M13 6l6 6-6 6";
const CHECK_ICON = "M5 13l4 4L19 7";

export default async function CrearPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { site } = await searchParams;
  const isLamira = site === "lamira";
  const isPlanazo = site === "planazo";
  const step: 1 | 2 = isLamira || isPlanazo ? 2 : 1;

  return (
    <CmsShell user={session} title="Crear">
      <div className="mx-auto max-w-[760px] p-[26px] pb-[60px]">
        <Steps step={step} />

        {step === 1 ? (
          <div className="text-center">
            <h1 className="mb-1.5 text-[24px] font-semibold tracking-tight">¿En qué proyecto quieres crear?</h1>
            <p className="mx-auto mb-8 max-w-[52ch] text-[13.5px] leading-[1.6] text-ink-soft">
              Cada proyecto tiene su propio tipo de contenido y su propio sitio en vivo.
            </p>
            <SitePicker />
          </div>
        ) : isLamira ? (
          <div className="text-center">
            <ProjectPill icon={NEWSPAPER_ICON} label="La Mira" />
            <h1 className="mb-1.5 text-[24px] font-semibold tracking-tight">¿Qué quieres crear?</h1>
            <p className="mx-auto mb-8 max-w-[52ch] text-[13.5px] leading-[1.6] text-ink-soft">
              Elige el tipo de contenido y cómo quieres armarlo — con IA a partir de un tema, o llenando la ficha tú mismo.
            </p>
            <LamiraCrearTypePicker />
          </div>
        ) : (
          <div className="text-center">
            <ProjectPill icon={PIN_ICON} label="Planazo" />
            <h1 className="mb-1.5 text-[24px] font-semibold tracking-tight">¿Qué quieres crear?</h1>
            <p className="mx-auto mb-8 max-w-[52ch] text-[13.5px] leading-[1.6] text-ink-soft">
              Elige el tipo de contenido y cómo quieres armarlo — con IA a partir del nombre, o llenando la ficha tú mismo.
            </p>
            <PlanazoCrearTypePicker />
          </div>
        )}
      </div>
    </CmsShell>
  );
}

/** Franja de pasos del wizard — el paso 1 (Proyecto) enlaza de vuelta a
 * /crear cuando ya se avanzó al paso 2, para poder cambiar de proyecto sin
 * perder el lugar donde se estaba. */
function Steps({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-9 flex items-center justify-center gap-3">
      <StepBadge n={1} label="Proyecto" state={step === 1 ? "current" : "done"} href={step === 2 ? "/crear" : undefined} />
      <span className={`h-px w-12 flex-none transition-colors ${step === 2 ? "bg-brand" : "bg-border"}`} />
      <StepBadge n={2} label="Cómo crear" state={step === 2 ? "current" : "upcoming"} />
    </div>
  );
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

/** Recuerda en qué proyecto se está creando — el paso 1 ya no es visible
 * en el paso 2, así que sin esto no hay ninguna pista en pantalla de si
 * se está viendo Planazo o La Mira. */
function ProjectPill({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="mb-4 flex justify-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[12px] font-medium text-ink-soft">
        <Icon d={icon} size={12} strokeWidth={1.8} />
        {label}
      </span>
    </div>
  );
}

function SitePicker() {
  return (
    <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
      <Link
        href="/crear?site=planazo"
        className="group flex flex-col gap-4 rounded-[16px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#FFE2CC] hover:shadow-[0_16px_32px_-16px_rgba(253,105,13,.28)]"
      >
        <div className="grid size-[44px] place-items-center rounded-[13px] border border-[#FFE2CC] bg-accent">
          <Icon d={PIN_ICON} size={20} strokeWidth={1.6} className="text-brand" />
        </div>
        <div>
          <h2 className="mb-1 text-[15.5px] font-semibold tracking-tight">Planazo</h2>
          <p className="text-[13px] leading-[1.55] text-ink-soft">Lugares, eventos y guías para explorar CDMX.</p>
        </div>
        <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-brand">
          Elegir Planazo
          <Icon d={ARROW_ICON} size={14} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </Link>

      <Link
        href="/crear?site=lamira"
        className="group flex flex-col gap-4 rounded-[16px] border border-border bg-card p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#E0DBD4] hover:shadow-[0_16px_32px_-16px_rgba(23,20,17,.12)]"
      >
        <div className="grid size-[44px] place-items-center rounded-[13px] border border-border bg-background">
          <Icon d={NEWSPAPER_ICON} size={20} strokeWidth={1.6} className="text-ink" />
        </div>
        <div>
          <h2 className="mb-1 text-[15.5px] font-semibold tracking-tight">La Mira</h2>
          <p className="text-[13px] leading-[1.55] text-ink-soft">Noticias, alertas y guías del periódico digital.</p>
        </div>
        <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          Elegir La Mira
          <Icon d={ARROW_ICON} size={14} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </span>
      </Link>
    </div>
  );
}
