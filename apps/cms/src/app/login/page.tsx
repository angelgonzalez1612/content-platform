import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-[380px]">
        <h1 className="text-[27px] font-semibold tracking-[-.03em] text-ink">Bienvenido</h1>

        <div className="mt-7">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
