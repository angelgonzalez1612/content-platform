"use client";

import { useEffect, useState } from "react";
import { apiConfig } from "@planazo/config";

// Misma forma que GET /api/cms/adsense-plan (ver adsense-plan.service.ts).
interface PlanCriterion {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}
interface PlanTask {
  id: string;
  label: string;
  help: string;
  link?: string;
  final?: boolean;
  done: boolean;
  doneAt: string | null;
}
interface AdsensePlan {
  ready: boolean;
  passed: number;
  total: number;
  criteria: PlanCriterion[];
  tasks: PlanTask[];
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiConfig.clientBaseUrl}/cms/adsense-plan${path}`, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok) throw new Error(body?.message ?? `Error ${res.status}`);
  return body as T;
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      className="mt-1 flex size-4 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ background: ok ? "#2E9B4F" : "#C98A12" }}
      aria-hidden
    >
      {ok ? "✓" : "!"}
    </span>
  );
}

export function AdsensePlanView() {
  const [plan, setPlan] = useState<AdsensePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    call<AdsensePlan>("")
      .then(setPlan)
      .catch((e: Error) => setError(e.message));
  }, []);

  async function toggle(task: PlanTask) {
    setSaving(task.id);
    try {
      setPlan(await call<AdsensePlan>(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ done: !task.done }) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  if (error && !plan) {
    return (
      <div className="mx-auto w-full max-w-[920px] p-4 md:p-6">
        <p className="rounded-[14px] border border-border bg-card p-4 text-[13px] text-negative">{error}</p>
      </div>
    );
  }
  if (!plan) {
    return (
      <div className="mx-auto w-full max-w-[920px] p-4 md:p-6">
        <p className="rounded-[14px] border border-border bg-card p-4 text-[13px] text-ink-faint">
          Revisando criterios… la primera revisión del día consulta a Google y tarda unos segundos.
        </p>
      </div>
    );
  }

  const pct = Math.round((plan.passed / plan.total) * 100);
  const pending = plan.tasks.filter((t) => !t.final);
  const finals = plan.tasks.filter((t) => t.final);

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-4 p-4 md:p-6">
      <section
        className={`rounded-[14px] p-5 ${plan.ready ? "bg-[#EAF7EF] text-[#1F6B3A]" : "bg-ink-solid text-white"}`}
      >
        <p className="text-[12px] font-semibold tracking-wide uppercase opacity-80">Listo para pedir la revisión</p>
        <p className="mt-1 text-[22px] font-semibold tracking-tight">
          {plan.ready ? "Sí: ya puedes pedir la revisión de AdSense" : `Todavía no: ${plan.passed} de ${plan.total} puntos`}
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-[12.5px] opacity-80">
          Nadie puede garantizar la aprobación, pero cumplir todo esto quita las causas conocidas del rechazo por
          &ldquo;contenido de poco valor&rdquo;.
        </p>
      </section>

      <section className="rounded-[14px] border border-border bg-card p-4">
        <h2 className="mb-1 text-[13.5px] font-semibold tracking-tight">Se revisa solo</h2>
        <p className="mb-3 text-[11.5px] text-ink-faint">Con datos de Search Console y del dominio; se actualiza una vez al día.</p>
        <ul className="flex flex-col divide-y divide-border-soft">
          {plan.criteria.map((c) => (
            <li key={c.id} className="flex gap-2.5 py-2.5">
              <Dot ok={c.ok} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] font-medium">{c.label}</span>
                <span className="text-[11.5px] text-ink-faint">{c.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[14px] border border-border bg-card p-4">
        <h2 className="mb-1 text-[13.5px] font-semibold tracking-tight">Pendientes que marcas tú</h2>
        <p className="mb-3 text-[11.5px] text-ink-faint">Lo que solo se puede hacer desde Google o Vercel. Márcalo cuando esté hecho.</p>
        <TaskList tasks={pending} saving={saving} onToggle={toggle} />
      </section>

      <section className="rounded-[14px] border border-border bg-card p-4">
        <h2 className="mb-1 text-[13.5px] font-semibold tracking-tight">Pedir la revisión</h2>
        <p className="mb-3 text-[11.5px] text-ink-faint">
          {plan.ready ? "Ya cumples todo lo anterior." : "Hazlo cuando todo lo de arriba esté en verde."}
        </p>
        <TaskList tasks={finals} saving={saving} onToggle={toggle} />
      </section>

      {error && <p className="text-[12.5px] text-negative">{error}</p>}
    </div>
  );
}

function TaskList({ tasks, saving, onToggle }: { tasks: PlanTask[]; saving: string | null; onToggle: (t: PlanTask) => void }) {
  return (
    <ul className="flex flex-col divide-y divide-border-soft">
      {tasks.map((t) => (
        <li key={t.id} className="flex gap-3 py-2.5">
          <input
            type="checkbox"
            checked={t.done}
            disabled={saving === t.id}
            onChange={() => onToggle(t)}
            className="mt-0.5 size-4 flex-none cursor-pointer accent-[var(--color-brand)] disabled:cursor-wait"
            aria-label={t.label}
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className={`text-[13px] font-medium ${t.done ? "text-ink-faint line-through" : ""}`}>{t.label}</span>
            <span className="text-[11.5px] leading-[1.45] text-ink-faint">{t.help}</span>
            <span className="flex flex-wrap gap-3 text-[11px]">
              {t.link && (
                <a href={t.link} target="_blank" rel="noreferrer" className="font-medium text-brand">
                  Abrir →
                </a>
              )}
              {t.done && t.doneAt && (
                <span className="text-ink-faint">Hecho el {new Date(t.doneAt).toLocaleDateString("es-MX")}</span>
              )}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
