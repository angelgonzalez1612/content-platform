import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-[380px] rounded-2xl border border-border bg-card p-7 shadow-[0_20px_50px_-24px_rgba(25,21,18,0.25)]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-[12.5px] font-bold text-brand">
          Planazo CMS
        </span>
        <h1 className="mt-3.5 text-2xl font-bold tracking-tight text-ink">Inicia sesión</h1>
        <p className="mt-1.5 text-[14px] text-ink-soft">
          Panel interno para generar y publicar contenido.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
