"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

const SUGGESTIONS = [
  { icon: "✳", bg: "#FFF2E8", fg: "#C0561A", label: "Quiero escribir sobre cafeterías en Roma Norte.", hint: "⏎" },
  { icon: "✳", bg: "#FFF2E8", fg: "#C0561A", label: "¿Qué contenido perdió tráfico este mes?" },
];

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/28 pt-[14vh] backdrop-blur-[2px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[560px] max-w-[92vw] overflow-hidden rounded-2xl border border-[#E4E0DA] bg-white shadow-[0_20px_50px_rgba(23,20,17,.22)]"
      >
        <div className="flex items-center gap-2.5 border-b border-border-soft px-4 py-3.5">
          <Icon d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" size={15} strokeWidth={1.8} className="text-brand" />
          <input
            autoFocus
            placeholder="Escribe un comando o pregunta a la IA…"
            className="flex-1 border-0 bg-transparent text-[14.5px] outline-none placeholder:text-[#B4ADA5]"
          />
          <span className="rounded border border-border px-[5px] py-0.5 font-mono text-[9.5px] text-ink-faint">esc</span>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          <div className="px-2.5 pt-1.5 pb-1 font-mono text-[9px] tracking-[.11em] text-[#BDB6AE] uppercase">
            Preguntar a la IA
          </div>
          {SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={onClose}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-[#F5F3F0]"
            >
              <span
                className="grid size-6 flex-none place-items-center rounded-md text-[11px]"
                style={{ background: s.bg, color: s.fg }}
              >
                {s.icon}
              </span>
              <span className="flex-1">{s.label}</span>
              {s.hint && <span className="font-mono text-[9.5px] text-ink-faint">{s.hint}</span>}
            </button>
          ))}

          <div className="px-2.5 pt-3 pb-1 font-mono text-[9px] tracking-[.11em] text-[#BDB6AE] uppercase">Acciones</div>
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/");
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-[#F5F3F0]"
          >
            <span className="grid size-6 flex-none place-items-center rounded-md bg-[#F3F0EC] text-[11px] text-ink-soft">◱</span>
            <span className="flex-1">Ir al Dashboard</span>
            <span className="font-mono text-[9.5px] text-ink-faint">G D</span>
          </button>
        </div>
      </div>
    </div>
  );
}
