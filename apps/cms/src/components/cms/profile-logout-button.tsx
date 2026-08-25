"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiConfig } from "@planazo/config";

export function ProfileLogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch(`${apiConfig.baseUrl}/auth/logout`, { method: "POST", credentials: "include" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="rounded-[10px] border border-[#F3D4CF] bg-white px-4 py-2 text-[13px] font-semibold text-negative transition-colors duration-150 hover:bg-[#FDECEA] disabled:opacity-60"
    >
      {loading ? "Saliendo…" : "Cerrar sesión"}
    </button>
  );
}
