"use client";

import { usePathname } from "next/navigation";
import { getCopilotBrief, getCopilotLog } from "@/data/dashboard";
import { Icon } from "@/components/icon";

export function CopilotPanel({ screenTitle, onClose }: { screenTitle: string; onClose: () => void }) {
  const pathname = usePathname();
  const { context, actions } = getCopilotBrief(pathname, screenTitle);
  const log = getCopilotLog();

  return (
    <aside className="flex h-full w-[326px] flex-none flex-col border-l border-border bg-card">
      <div className="flex flex-none items-center gap-2 border-b border-border-soft px-4 py-3.5">
        <Icon d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" size={14} strokeWidth={1.8} className="text-brand" />
        <span className="text-[13px] font-semibold tracking-tight">Copiloto</span>
        <span className="rounded font-mono text-[9px] text-ink-soft" style={{ background: "#F3F0EC", padding: "1.5px 5px" }}>
          {screenTitle}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar copiloto"
          className="grid size-6 place-items-center rounded-md text-ink-faint hover:bg-[#F5F3F0]"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-3">
          <div className="rounded-[11px] border border-border bg-[#FCFBFA] px-[13px] py-3">
            <span className="font-mono text-[9px] tracking-[.11em] text-[#BDB6AE] uppercase">Contexto de pantalla</span>
            <p className="mt-2 text-[12.5px] leading-[1.55]">{context}</p>
          </div>

          <div className="flex flex-col gap-[7px]">
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                className="flex items-center gap-2.5 rounded-[10px] border border-border bg-white px-[11px] py-2.5 text-left font-sans text-[12.5px] transition-colors hover:border-brand hover:text-brand"
              >
                <span className="size-[5px] flex-none rounded-full bg-brand" />
                {action}
              </button>
            ))}
          </div>

          <div className="border-t border-border-soft pt-[13px]">
            <span className="font-mono text-[9px] tracking-[.11em] text-[#BDB6AE] uppercase">Últimas acciones IA</span>
            <div className="mt-[11px] flex flex-col gap-[11px]">
              {log.map((entry) => (
                <div key={entry.text} className="flex flex-col gap-0.5">
                  <span className="text-[12px] leading-[1.4]">{entry.text}</span>
                  <span className="font-mono text-[9.5px] text-[#BDB6AE]">
                    {entry.when} · {entry.cost}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-none border-t border-border-soft px-3.5 py-3">
        <div className="flex items-center gap-2 rounded-[10px] border border-[#E4E0DA] px-[11px] py-2.5">
          <span className="flex-1 text-[12.5px] text-[#B4ADA5]">Pregúntame sobre esta pantalla…</span>
          <span className="font-mono text-[9.5px] text-[#C4BDB5]">⏎</span>
        </div>
      </div>
    </aside>
  );
}
