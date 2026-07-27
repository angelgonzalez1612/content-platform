"use client";

import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch(`${apiConfig.baseUrl}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="rounded-lg border border-border px-3.5 py-2 text-[13.5px] font-semibold text-ink-soft transition-colors hover:border-brand hover:text-brand"
    >
      Cerrar sesión
    </button>
  );
}
