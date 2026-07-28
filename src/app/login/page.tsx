import Image from "next/image";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";
import { Icon } from "@/components/icon";

export const metadata: Metadata = { title: "Iniciar sesión" };

const FEATURES = [
  { icon: "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z", text: "Genera artículos con IA en minutos" },
  { icon: "M4 17a8 8 0 1 1 16 0M12 13l4-3", text: "SEO y keywords integrados en cada publicación" },
  { icon: "M6 5h5v5H6zM13 14h5v5h-5zM8.5 10v6.5H13", text: "Publica directo al sitio, sin pasos manuales" },
];

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-[42%] flex-none flex-col justify-between overflow-hidden bg-ink p-11 text-white lg:flex">
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(253,105,13,.45), transparent 65%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 size-[320px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(253,105,13,.22), transparent 65%)" }}
        />

        <div className="relative flex items-center gap-2.5">
          <Image src="/logo.jpg" alt="Planazo" width={30} height={30} className="rounded-[8px] object-cover" style={{ mixBlendMode: "screen" }} />
          <div className="flex flex-col leading-[1.1]">
            <span className="text-[15px] font-semibold tracking-tight">Planazo</span>
            <span className="font-mono text-[9px] font-medium tracking-[.14em] text-white/50 uppercase">CMS · CDMX</span>
          </div>
        </div>

        <div className="relative">
          <span className="font-mono text-[10px] font-medium tracking-[.14em] text-brand uppercase">Panel interno</span>
          <h2 className="mt-3 max-w-[19ch] text-[32px] leading-[1.12] font-semibold tracking-tight">
            El motor de contenido de Planazo, en un solo lugar.
          </h2>
          <div className="mt-9 flex flex-col gap-4">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <span className="grid size-8 flex-none place-items-center rounded-lg border border-white/12 bg-white/[.06]">
                  <Icon d={f.icon} size={15} strokeWidth={1.7} className="text-brand" />
                </span>
                <span className="text-[13.5px] leading-[1.4] text-white/80">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <span className="relative font-mono text-[10.5px] text-white/35">© {new Date().getFullYear()} Planazo</span>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[380px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 font-mono text-[10.5px] font-medium tracking-[.08em] text-accent-fg uppercase">
            ✦ Acceso CMS
          </span>
          <h1 className="mt-4 text-[26px] font-semibold tracking-tight text-ink">Bienvenido de vuelta</h1>
          <p className="mt-1.5 text-[14px] text-ink-soft">Inicia sesión para entrar al panel de contenido.</p>

          <div className="mt-7">
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
