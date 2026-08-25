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
      <div className="relative hidden w-[44%] flex-none flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,.9) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -right-20 size-[480px] rounded-full [animation:pz-drift_14s_ease-in-out_infinite]"
          style={{ background: "radial-gradient(circle, rgba(253,105,13,.55), transparent 65%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-[360px] rounded-full [animation:pz-drift_18s_ease-in-out_infinite_reverse]"
          style={{ background: "radial-gradient(circle, rgba(253,105,13,.25), transparent 65%)" }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 [box-shadow:inset_0_0_140px_60px_rgba(23,20,17,.55)]" />

        <div className="relative flex items-center gap-2.5 [animation:pz-rise_.5s_cubic-bezier(.22,1,.36,1)_both]">
          <Image src="/logo.jpg" alt="Planazo" width={30} height={30} className="rounded-[8px] object-cover" style={{ mixBlendMode: "screen" }} />
          <div className="flex flex-col leading-[1.1]">
            <span className="text-[15px] font-semibold tracking-tight">Planazo</span>
            <span className="font-mono text-[9px] font-medium tracking-[.14em] text-white/60 uppercase">CMS · CDMX</span>
          </div>
        </div>

        <div className="relative">
          <h2
            className="max-w-[17ch] text-[42px] leading-[1.05] font-semibold tracking-[-.035em] text-balance [animation:pz-rise_.6s_cubic-bezier(.22,1,.36,1)_.05s_both]"
          >
            El motor de contenido de Planazo.
          </h2>
          <p className="mt-4 max-w-[36ch] text-[14.5px] leading-[1.6] text-white/70 [animation:pz-rise_.6s_cubic-bezier(.22,1,.36,1)_.1s_both]">
            Investigación, redacción y publicación asistidas por IA, con un editor
            humano siempre al mando antes de salir a producción.
          </p>

          <div className="mt-10 flex flex-col gap-3.5">
            {FEATURES.map((f, i) => (
              <div
                key={f.text}
                className="flex items-center gap-3 [animation:pz-rise_.5s_cubic-bezier(.22,1,.36,1)_both]"
                style={{ animationDelay: `${0.18 + i * 0.07}s` }}
              >
                <span className="grid size-8 flex-none place-items-center rounded-lg border border-white/12 bg-white/[.06]">
                  <Icon d={f.icon} size={15} strokeWidth={1.7} className="text-brand" />
                </span>
                <span className="text-[13.5px] leading-[1.4] text-white/80">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <span className="relative font-mono text-[10.5px] text-white/40 [animation:pz-rise_.5s_cubic-bezier(.22,1,.36,1)_.3s_both]">
          © {new Date().getFullYear()} Planazo · panel interno
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-[380px] [animation:pz-rise_.5s_cubic-bezier(.22,1,.36,1)_both]">
          <div className="mb-7 flex items-center gap-2.5 lg:hidden">
            <Image src="/logo.jpg" alt="Planazo" width={28} height={28} className="rounded-[8px] object-cover" style={{ mixBlendMode: "multiply" }} />
            <span className="text-[15px] font-semibold tracking-tight">Planazo CMS</span>
          </div>

          <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ink">Bienvenido de vuelta</h1>
          <p className="mt-1.5 text-[14px] text-ink-soft">Inicia sesión para entrar al panel de contenido.</p>

          <div className="mt-7">
            <LoginForm />
          </div>

          <p className="mt-7 text-center font-mono text-[10.5px] text-ink-faint">Planazo CMS · build interno</p>
        </div>
      </div>
    </div>
  );
}
