"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${apiConfig.baseUrl}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "Correo o contraseña incorrectos.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo conectar con el servidor. ¿Está corriendo la API?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <div className="flex flex-col gap-1.5 text-left">
        <label htmlFor="email" className="text-sm font-semibold text-ink">
          Correo
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="tu@correo.com"
          className="rounded-xl border border-border bg-background px-4 py-3 text-[15px] text-ink outline-none focus:border-brand"
        />
      </div>

      <div className="flex flex-col gap-1.5 text-left">
        <label htmlFor="password" className="text-sm font-semibold text-ink">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="rounded-xl border border-border bg-background px-4 py-3 text-[15px] text-ink outline-none focus:border-brand"
        />
      </div>

      {error && <p className="text-[13px] font-semibold text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="mt-1.5 rounded-xl bg-brand px-4 py-3 text-[15px] font-bold text-white transition-colors hover:bg-brand-pressed disabled:opacity-60"
      >
        {loading ? "Entrando…" : "Iniciar sesión"}
      </button>
    </form>
  );
}
