"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

type SiteKey = "la-mira" | "planazo";
const SITES: { key: SiteKey; label: string }[] = [
  { key: "la-mira", label: "La Mira" },
  { key: "planazo", label: "Planazo" },
];

// Lo que mide Google por sitio (filas de la tabla). El id del criterio es `${prefix}${site}`.
const GOOGLE_METRICS: { prefix: string; label: string; hint: string }[] = [
  { prefix: "sitemap-", label: "Leyó el sitemap nuevo", hint: "Después del reenvío del 7 de octubre" },
  { prefix: "indexadas-", label: "Páginas recientes indexadas", hint: "Al menos la mitad de la muestra" },
  { prefix: "sitemap-errores-", label: "Sitemap sin errores", hint: "Según Search Console" },
];

const LINK_LABEL: Record<string, string> = {
  "https://search.google.com/search-console": "Abrir Search Console",
  "https://vercel.com": "Abrir Vercel",
  "https://adsense.google.com": "Abrir AdSense",
};

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

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

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
    if (!plan) return;
    setSaving(task.id);
    setError(null);
    // Optimista: la casilla responde al momento; si falla, se revierte.
    const previous = plan;
    setPlan({ ...plan, tasks: plan.tasks.map((t) => (t.id === task.id ? { ...t, done: !t.done, doneAt: t.done ? null : new Date().toISOString() } : t)) });
    try {
      setPlan(await call<AdsensePlan>(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ done: !task.done }) }));
    } catch (e) {
      setPlan(previous);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  if (!plan) return <Shell>{error ? <ErrorNote message={error} /> : <LoadingSkeleton />}</Shell>;

  const criterion = (id: string) => plan.criteria.find((c) => c.id === id);
  const mailOk = criterion("correo-lamira")?.ok ?? true;
  const scOk = criterion("search-console")?.ok ?? true;

  const todo = plan.tasks.filter((t) => !t.final && !t.done);
  const finals = plan.tasks.filter((t) => t.final);
  const completed = plan.tasks.filter((t) => !t.final && t.done);
  const googleCriteria = plan.criteria.filter((c) => c.id !== "correo-lamira" && c.id !== "search-console");
  const googlePending = googleCriteria.filter((c) => !c.ok).length;
  const googleDone = googleCriteria.filter((c) => c.ok).length;
  const yoursPending = todo.length + (scOk ? 0 : 1);
  const missing = plan.total - plan.passed;

  return (
    <Shell>
      {/* Resumen: la respuesta a "¿ya puedo pedirla?" y quién tiene que moverse. */}
      <section className="rounded-[14px] border border-border bg-card p-5">
        <p className="text-[12.5px] font-medium text-ink-soft">¿Listo para pedir la revisión de AdSense?</p>
        <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-balance">
          {plan.ready ? "Sí, ya puedes pedirla." : `Todavía no: faltan ${missing} ${missing === 1 ? "punto" : "puntos"}.`}
        </h2>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border-soft"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={plan.total}
          aria-valuenow={plan.passed}
          aria-label={`${plan.passed} de ${plan.total} puntos cumplidos`}
        >
          <div
            className="h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out"
            style={{ width: `${(plan.passed / plan.total) * 100}%` }}
          />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center sm:text-left">
          <Counter label="Te tocan a ti" value={yoursPending} tone={yoursPending ? "brand" : "positive"} />
          <Counter label="Esperando a Google" value={googlePending} tone={googlePending ? "warning" : "positive"} />
          <Counter label="Ya cumplidos" value={plan.passed} tone="positive" />
        </dl>
      </section>

      {error && <ErrorNote message={error} />}

      {/* 1. Lo accionable, en orden. El primero es "el siguiente paso". */}
      <Section
        title="Te toca a ti"
        description={todo.length ? "En este orden. Márcalo cuando esté hecho y se guarda la fecha." : undefined}
      >
        {!scOk && (
          <div className="rounded-[12px] border border-border p-3.5">
            <p className="text-[13.5px] font-semibold">Conectar Search Console</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">{criterion("search-console")?.detail}</p>
            <Link href="/search-console" className="mt-2 inline-block text-[12.5px] font-semibold text-accent-fg hover:underline">
              Ir a Search Console del CMS →
            </Link>
          </div>
        )}
        {todo.length === 0 ? (
          <p className="rounded-[12px] bg-hover p-3.5 text-[13px] text-ink-soft">
            No tienes pendientes. Lo que falta depende de Google y se revisa solo cada día.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {todo.map((t, i) => (
              <TaskItem
                key={t.id}
                task={t}
                step={i + 1}
                next={i === 0}
                saving={saving === t.id}
                onToggle={toggle}
                warning={t.id === "correo-prueba" && !mailOk ? "Todavía no: el dominio lamira.mx no tiene registros MX." : undefined}
              />
            ))}
          </ol>
        )}
      </Section>

      {/* 2. Lo que depende de Google, por sitio, lado a lado. */}
      <Section
        title="Lo que mide Google"
        description="No requiere que hagas nada: se revisa solo una vez al día. Pedir la indexación ayuda a que avance más rápido."
      >
        <div className="overflow-x-auto rounded-[12px] border border-border">
          <table className="w-full min-w-[460px] text-[13px]">
            <thead>
              <tr className="bg-hover text-left text-[12px] text-ink-soft">
                <th className="px-3.5 py-2.5 font-medium">Revisión</th>
                {SITES.map((s) => (
                  <th key={s.key} className="px-3.5 py-2.5 font-semibold text-ink">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GOOGLE_METRICS.map((m) => (
                <tr key={m.prefix} className="border-t border-border-soft align-top">
                  <th scope="row" className="px-3.5 py-3 text-left font-medium">
                    {m.label}
                    <span className="mt-0.5 block text-[11.5px] font-normal text-ink-soft">{m.hint}</span>
                  </th>
                  {SITES.map((s) => {
                    const c = criterion(`${m.prefix}${s.key}`);
                    return (
                      <td key={s.key} className="px-3.5 py-3">
                        {c ? <StatusCell ok={c.ok} detail={c.detail} /> : <span className="text-[12px] text-ink-soft">Sin datos todavía</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {googleDone > 0 && googlePending === 0 && (
          <p className="text-[12.5px] text-positive">Todo lo que mide Google está en orden.</p>
        )}
      </Section>

      {/* 3. El paso final, bloqueado hasta que todo lo anterior esté listo. */}
      <Section
        title="Pedir la revisión"
        description={plan.ready ? "Ya cumples todo. Pide primero La Mira; Planazo después." : `Se habilita cuando no falte nada (faltan ${missing}).`}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {finals.map((t) => (
            <FinalItem key={t.id} task={t} ready={plan.ready} saving={saving === t.id} onToggle={toggle} />
          ))}
        </div>
      </Section>

      {completed.length > 0 && (
        <details className="group rounded-[14px] border border-border bg-card px-4 py-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
            <span
              className="text-ink-soft motion-safe:transition-transform motion-safe:duration-200 group-open:rotate-90"
              aria-hidden
            >
              ›
            </span>
            Ya hechos ({completed.length})
          </summary>
          <ul className="mt-2 flex flex-col">
            {completed.map((t) => (
              <li key={t.id} className="flex items-center gap-3 border-t border-border-soft py-2.5 first:border-t-0">
                <Checkbox task={t} saving={saving === t.id} onToggle={toggle} />
                <span className="flex-1 text-[13px] text-ink-soft">{t.label}</span>
                {t.doneAt && <span className="text-[12px] text-ink-soft">{shortDate(t.doneAt)}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 p-4 md:p-6">{children}</div>;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        {description && <p className="mt-0.5 max-w-[68ch] text-[12.5px] leading-relaxed text-ink-soft">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone: "brand" | "warning" | "positive" }) {
  const color = tone === "brand" ? "text-accent-fg" : tone === "warning" ? "text-warning" : "text-positive";
  return (
    <div className="rounded-[10px] bg-hover px-3 py-2.5">
      <dt className="text-[11.5px] text-ink-soft">{label}</dt>
      <dd className={`text-[20px] font-semibold tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}

function StatusCell({ ok, detail }: { ok: boolean; detail: string }) {
  return (
    <span className="flex items-start gap-2">
      <span
        className={`mt-[3px] inline-flex size-4 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white ${ok ? "bg-positive" : "bg-warning"}`}
        aria-hidden
      >
        {ok ? "✓" : "…"}
      </span>
      <span className="flex flex-col">
        <span className={`text-[12.5px] font-semibold text-ink`}>{ok ? "Listo" : "Esperando"}</span>
        <span className="text-[12px] text-ink-soft">{detail}</span>
      </span>
    </span>
  );
}

function Checkbox({ task, saving, onToggle, disabled }: { task: PlanTask; saving: boolean; onToggle: (t: PlanTask) => void; disabled?: boolean }) {
  return (
    <input
      type="checkbox"
      checked={task.done}
      disabled={saving || disabled}
      onChange={() => onToggle(task)}
      className="size-[18px] flex-none cursor-pointer rounded accent-[var(--color-brand)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
      aria-label={task.done ? `Desmarcar: ${task.label}` : `Marcar como hecho: ${task.label}`}
    />
  );
}

function ActionLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[12px] font-semibold text-ink transition-colors hover:border-accent-fg hover:text-accent-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {LINK_LABEL[href] ?? "Abrir"} <span aria-hidden>↗</span>
    </a>
  );
}

function TaskItem({
  task,
  step,
  next,
  saving,
  onToggle,
  warning,
}: {
  task: PlanTask;
  step: number;
  next: boolean;
  saving: boolean;
  onToggle: (t: PlanTask) => void;
  warning?: string;
}) {
  return (
    <li
      className={`flex gap-3 rounded-[12px] border p-3.5 motion-safe:transition-colors motion-safe:duration-200 ${next ? "border-accent-fg/30 bg-accent" : "border-border bg-card"}`}
    >
      <span
        className={`mt-px flex size-6 flex-none items-center justify-center rounded-full text-[12px] font-semibold tabular-nums ${next ? "bg-accent-fg text-card" : "bg-hover text-ink-soft"}`}
        aria-hidden
      >
        {step}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[13.5px] font-semibold leading-snug">{task.label}</p>
          {next && <span className="rounded-full border border-accent-fg/30 bg-card px-2 py-0.5 text-[10.5px] font-semibold text-accent-fg">Siguiente paso</span>}
        </div>
        <p className="max-w-[68ch] text-[12.5px] leading-relaxed text-ink-soft">{task.help}</p>
        {warning && <p className="text-[12px] font-medium text-warning">{warning}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-3">
          {task.link && <ActionLink href={task.link} />}
          <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-ink-soft">
            <Checkbox task={task} saving={saving} onToggle={onToggle} />
            {saving ? "Guardando…" : "Ya lo hice"}
          </label>
        </div>
      </div>
    </li>
  );
}

function FinalItem({ task, ready, saving, onToggle }: { task: PlanTask; ready: boolean; saving: boolean; onToggle: (t: PlanTask) => void }) {
  const locked = !ready && !task.done;
  return (
    <div className={`flex flex-col gap-2 rounded-[12px] border p-3.5 ${task.done ? "border-positive/40" : "border-border"} ${locked ? "bg-hover" : "bg-card"}`}>
      <p className={`text-[13.5px] font-semibold ${locked ? "text-ink-soft" : ""}`}>{task.label}</p>
      <p className="text-[12.5px] leading-relaxed text-ink-soft">{task.help}</p>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-1">
        {locked ? (
          <span className="text-[12px] font-medium text-ink-soft">Bloqueado hasta cumplir todo lo anterior</span>
        ) : (
          <>
            {task.link && <ActionLink href={task.link} />}
            <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-ink-soft">
              <Checkbox task={task} saving={saving} onToggle={onToggle} />
              {task.done && task.doneAt ? `Pedida el ${shortDate(task.doneAt)}` : "Ya la pedí"}
            </label>
          </>
        )}
      </div>
    </div>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-[12px] border border-negative/30 bg-card p-3.5 text-[13px] text-negative">
      {message}
    </p>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Revisando criterios">
      <div className="h-[150px] rounded-[14px] bg-hover motion-safe:animate-pulse" />
      <div className="h-[220px] rounded-[14px] bg-hover motion-safe:animate-pulse" />
      <p className="text-[12.5px] text-ink-soft">La primera revisión del día consulta a Google y tarda unos segundos.</p>
    </div>
  );
}
