import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CmsShell } from "@/components/cms/cms-shell";

const ROLE_LABELS: Record<string, string> = { admin: "Administrador", editor: "Editor" };

export default async function PerfilPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const initials = session.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <CmsShell user={session} title="Perfil">
      <div className="mx-auto max-w-[560px] p-[26px] pb-[60px]">
        <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Perfil</h1>
        <p className="mb-6 text-[13.5px] text-ink-soft">Tu información de cuenta en Planazo CMS.</p>

        <div className="flex flex-col gap-5 rounded-[14px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
          <div className="flex items-center gap-3.5">
            <div className="grid size-[52px] flex-none place-items-center rounded-full bg-ink text-[16px] font-semibold text-white">
              {initials}
            </div>
            <div className="flex flex-col leading-[1.3]">
              <span className="text-[16px] font-semibold tracking-tight">{session.name}</span>
              <span className="text-[13px] text-ink-faint">{ROLE_LABELS[session.role] ?? session.role}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 border-t border-border-soft pt-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">Correo</span>
              <span className="text-[14px] text-ink">{session.email}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">Rol</span>
              <span className="text-[14px] text-ink">{ROLE_LABELS[session.role] ?? session.role}</span>
            </div>
          </div>
        </div>
      </div>
    </CmsShell>
  );
}
