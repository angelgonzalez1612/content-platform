import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CmsShell } from "@/components/cms/cms-shell";
import { Icon } from "@/components/icon";
import { CopyableId } from "@/components/cms/copyable-id";
import { ProfileLogoutButton } from "@/components/cms/profile-logout-button";

const ROLE_LABELS: Record<string, string> = { admin: "Administrador", editor: "Editor" };

function formatJoinDate(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

export default async function PerfilPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const initials = session.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const roleLabel = ROLE_LABELS[session.role] ?? session.role;

  const details = [
    { icon: "M4 6h16v12H4zM4 6l8 7 8-7", label: "Correo", value: session.email },
    { icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0", label: "Rol", value: roleLabel },
    { icon: "M5 6h14v14H5zM5 10h14M9 4v4M15 4v4", label: "Miembro desde", value: formatJoinDate(session.createdAt) },
  ];

  return (
    <CmsShell user={session} title="Perfil">
      <div className="mx-auto max-w-[680px] p-[26px] pb-[60px] [animation:pz-in_.4s_ease-out_both]">
        <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Perfil</h1>
        <p className="mb-6 text-[13.5px] text-ink-soft">Tu información de cuenta en Planazo CMS.</p>

        <div className="relative overflow-hidden rounded-[18px] bg-ink px-7 py-8 text-white">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(255,255,255,.9) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-16 size-[280px] rounded-full [animation:pz-drift_16s_ease-in-out_infinite]"
            style={{ background: "radial-gradient(circle, rgba(253,105,13,.5), transparent 65%)" }}
          />

          <div className="relative flex items-center gap-4">
            <div className="grid size-[64px] flex-none place-items-center rounded-full border-2 border-white/15 bg-white/10 text-[21px] font-semibold backdrop-blur-sm">
              {initials}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[19px] font-semibold tracking-tight">{session.name}</span>
                <span className="rounded-full bg-brand px-2 py-0.5 font-mono text-[9.5px] font-medium tracking-[.06em] text-white uppercase">
                  {roleLabel}
                </span>
              </div>
              <span className="text-[13px] text-white/65">{session.email}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {details.map((d) => (
            <div key={d.label} className="flex items-start gap-3 rounded-[14px] border border-border bg-white p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
              <span className="grid size-8 flex-none place-items-center rounded-lg bg-accent">
                <Icon d={d.icon} size={14} strokeWidth={1.6} className="text-brand" />
              </span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-mono text-[9.5px] font-medium tracking-[.1em] text-ink-faint uppercase">{d.label}</span>
                <span className="truncate text-[13.5px] text-ink">{d.value}</span>
              </div>
            </div>
          ))}

          <div className="flex items-start gap-3 rounded-[14px] border border-border bg-white p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <span className="grid size-8 flex-none place-items-center rounded-lg bg-accent">
              <Icon d="M7 4h10l1 3h2v12H4V7h2z" size={14} strokeWidth={1.6} className="text-brand" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-mono text-[9.5px] font-medium tracking-[.1em] text-ink-faint uppercase">ID de cuenta</span>
              <CopyableId id={session.id} />
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-[14px] border border-border bg-white p-5 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13.5px] font-medium text-ink">Cerrar sesión</span>
            <span className="text-[12px] text-ink-faint">Salir de tu cuenta en este dispositivo.</span>
          </div>
          <ProfileLogoutButton />
        </div>
      </div>
    </CmsShell>
  );
}
