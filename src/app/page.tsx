import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-bold tracking-tight text-ink">Planazo CMS</span>
        <div className="flex items-center gap-3">
          <span className="text-[13.5px] text-ink-soft">
            {session.name} <span className="text-ink-soft/70">· {session.role}</span>
          </span>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto max-w-[800px] px-6 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Hola, {session.name} 👋
        </h1>
        <p className="mt-2 text-[15px] text-ink-soft">
          El login ya está listo. Los flujos de generación de contenido con IA
          se construyen a partir de aquí.
        </p>
      </main>
    </div>
  );
}
