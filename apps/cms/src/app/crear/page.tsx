import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { CmsShell } from "@/components/cms/cms-shell";
import { Icon } from "@/components/icon";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";
const PENCIL_ICON = "M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3zM14 6l4 4";

export default async function CrearPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <CmsShell user={session} title="Crear">
      <div className="mx-auto max-w-[760px] p-[26px] pb-[60px] text-center">
        <h1 className="mb-1.5 text-[24px] font-semibold tracking-tight">¿Cómo quieres crear el lugar?</h1>
        <p className="mx-auto mb-8 max-w-[52ch] text-[13.5px] leading-[1.6] text-ink-soft">
          Elige generar un borrador con IA a partir del nombre, o llenar la ficha tú mismo desde cero.
        </p>

        <div className="grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
          <Link
            href="/centro-ia"
            className="group flex flex-col gap-4 rounded-[16px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#FFE2CC] hover:shadow-[0_16px_32px_-16px_rgba(253,105,13,.28)]"
          >
            <div className="grid size-[44px] place-items-center rounded-[13px] border border-[#FFE2CC] bg-accent">
              <Icon d={SPARK_ICON} size={20} strokeWidth={1.6} className="text-brand" />
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <h2 className="text-[15.5px] font-semibold tracking-tight">Crear con IA</h2>
                <span className="rounded font-mono text-[9.5px] font-medium text-white" style={{ padding: "1px 5px", background: "#FD690D" }}>
                  IA
                </span>
              </div>
              <p className="text-[13px] leading-[1.55] text-ink-soft">
                Dale el nombre de un lugar real y lo que ya sabes de él. Escribimos la descripción, categoría y
                etiquetas — tú revisas y completas dirección, teléfono y precio.
              </p>
            </div>
            <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-brand">
              Empezar con IA
              <Icon d="M5 12h14M13 6l6 6-6 6" size={14} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </Link>

          <Link
            href="/crear/manual"
            className="group flex flex-col gap-4 rounded-[16px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)] transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#E0DBD4] hover:shadow-[0_16px_32px_-16px_rgba(23,20,17,.12)]"
          >
            <div className="grid size-[44px] place-items-center rounded-[13px] border border-border bg-background">
              <Icon d={PENCIL_ICON} size={20} strokeWidth={1.6} className="text-ink" />
            </div>
            <div>
              <h2 className="mb-1 text-[15.5px] font-semibold tracking-tight">Crear manualmente</h2>
              <p className="text-[13px] leading-[1.55] text-ink-soft">
                Llena la ficha completa tú mismo — nombre, descripción, categoría, zona, precio y contacto — como en
                cualquier CMS tradicional.
              </p>
            </div>
            <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              Llenar formulario
              <Icon d="M5 12h14M13 6l6 6-6 6" size={14} strokeWidth={2} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </div>
    </CmsShell>
  );
}
