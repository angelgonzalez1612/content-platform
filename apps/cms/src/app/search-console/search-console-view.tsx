"use client";

import { useEffect, useState } from "react";
import { apiConfig } from "@planazo/config";
import {
  SC_SITE_LABEL,
  type ScInspection,
  type ScSite,
  type ScStatus,
  type ScSummary,
} from "@/lib/search-console-types";

const DAYS = [7, 28, 90] as const;

const num = (n: number) => Math.round(n).toLocaleString("es-MX");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const pos = (n: number) => n.toFixed(1);
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(`${iso}T12:00:00`));

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiConfig.clientBaseUrl}/cms/search-console${path}`, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => null)) as (T & { message?: string }) | null;
  if (!res.ok) throw new Error(body?.message ?? `Error ${res.status}`);
  return body as T;
}

export function SearchConsoleView() {
  const [status, setStatus] = useState<ScStatus | null>(null);
  const [site, setSite] = useState<ScSite>("la-mira");
  const [days, setDays] = useState<(typeof DAYS)[number]>(28);
  // Resultado de la última consulta, marcado con su sitio+periodo: la carga
  // y el error se derivan de si corresponde a la selección actual.
  const [result, setResult] = useState<{ key: string; summary?: ScSummary; error?: string } | null>(null);

  useEffect(() => {
    api<ScStatus>("/status")
      .then(setStatus)
      .catch((e: Error) => setStatus({ configured: false, serviceAccountEmail: null, properties: [], error: e.message }));
  }, []);

  const ready = status?.configured && status.properties.some((p) => p.site === site && p.siteUrl);
  const key = `${site}|${days}`;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    api<ScSummary>(`/summary?site=${site}&days=${days}`)
      .then((data) => !cancelled && setResult({ key: `${site}|${days}`, summary: data }))
      .catch((e: Error) => !cancelled && setResult({ key: `${site}|${days}`, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [ready, site, days]);

  const current = result?.key === key ? result : null;
  const summary = current?.summary ?? null;
  const error = current?.error ?? null;
  const loading = !!ready && !current;

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-card p-0.5">
          {(Object.keys(SC_SITE_LABEL) as ScSite[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSite(s)}
              className={`rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${site === s ? "bg-brand text-white" : "text-ink-soft hover:text-ink"}`}
            >
              {SC_SITE_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-border bg-card p-0.5">
          {DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors ${days === d ? "bg-accent text-accent-fg" : "text-ink-soft hover:text-ink"}`}
            >
              {d} días
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {summary && summary.site === site && (
          <span className="text-[11.5px] text-ink-faint">
            {summary.siteUrl} · {shortDate(summary.startDate)} – {shortDate(summary.endDate)} · los datos llegan con ~2 días de retraso
          </span>
        )}
      </div>

      {!status ? (
        <Card>
          <p className="text-[13px] text-ink-faint">Cargando…</p>
        </Card>
      ) : !ready ? (
        <SetupCard status={status} site={site} />
      ) : (
        <>
          {error && (
            <Card>
              <p className="text-[13px] text-negative">{error}</p>
            </Card>
          )}
          {loading && !summary && (
            <Card>
              <p className="text-[13px] text-ink-faint">Consultando Search Console…</p>
            </Card>
          )}
          {summary && summary.site === site && <SummaryView summary={summary} site={site} />}
          <InspectorCard site={site} />
        </>
      )}
    </div>
  );
}

function Card({ title, aside, children }: { title?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
      {title && (
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-[13.5px] font-semibold tracking-tight">{title}</h2>
          <span className="flex-1" />
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

function SetupCard({ status, site }: { status: ScStatus; site: ScSite }) {
  const email = status.serviceAccountEmail;
  return (
    <Card title="Conectar Search Console">
      {status.error && <p className="mb-3 text-[12.5px] text-negative">{status.error}</p>}
      {!status.configured ? (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] leading-relaxed text-ink-soft">
          <li>En Google Cloud, crea un proyecto y activa la <strong>Google Search Console API</strong>.</li>
          <li>Crea una cuenta de servicio y descarga su llave en formato JSON.</li>
          <li>
            Guarda el contenido de ese JSON en la variable <code className="font-mono text-[12px]">GOOGLE_SERVICE_ACCOUNT_JSON</code> de la
            API (en local, en <code className="font-mono text-[12px]">apps/api/.env</code>; en producción, en Vercel) y reinicia.
          </li>
          <li>En Search Console, agrega el correo de la cuenta de servicio como usuario de cada propiedad.</li>
        </ol>
      ) : (
        <p className="text-[13px] leading-relaxed text-ink-soft">
          La cuenta de servicio está configurada, pero no ve ninguna propiedad de <strong>{SC_SITE_LABEL[site]}</strong>. En Search Console,
          entra a Configuración → Usuarios y permisos de esa propiedad y agrega a{" "}
          <code className="font-mono text-[12px] break-all">{email}</code> con permiso restringido.
        </p>
      )}
    </Card>
  );
}

function SummaryView({ summary, site }: { summary: ScSummary; site: ScSite }) {
  const t = summary.totals;
  const kpis = [
    { label: "Clics", value: num(t.clicks) },
    { label: "Impresiones", value: num(t.impressions) },
    { label: "CTR promedio", value: pct(t.ctr) },
    { label: "Posición media", value: t.impressions ? pos(t.position) : "—" },
  ];
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-[14px] border border-border bg-card p-4">
            <p className="text-[11.5px] text-ink-faint">{k.label}</p>
            <p className="mt-1 text-[22px] font-semibold tracking-tight">{k.value}</p>
          </div>
        ))}
      </div>

      <Card
        title="Clics e impresiones por día"
        aside={
          <span className="flex items-center gap-3 text-[11px] text-ink-faint">
            <Legend color="var(--color-brand)" label="Clics" />
            <Legend color="var(--color-ink-faint)" label="Impresiones" />
          </span>
        }
      >
        <TrendChart data={summary.byDate} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Búsquedas con las que te encuentran">
          <MetricTable rows={summary.topQueries.map((r) => ({ ...r, label: r.query }))} empty="Todavía no hay búsquedas con clics o impresiones en este periodo." />
        </Card>
        <Card title="Páginas con más impresiones">
          <PagesTable site={site} rows={summary.topPages} />
        </Card>
      </div>

      <Card title="Sitemaps">
        {summary.sitemaps.length === 0 ? (
          <p className="text-[13px] text-ink-faint">
            No hay sitemaps enviados. En Search Console, ve a Sitemaps y envía <code className="font-mono text-[12px]">sitemap.xml</code>.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-border-soft">
            {summary.sitemaps.map((s) => (
              <div key={s.path} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-[12.5px]">
                <span className="min-w-0 flex-1 font-mono text-[11.5px] break-all">{s.path}</span>
                <span className="text-ink-faint">{num(s.submitted)} URLs enviadas</span>
                <span className="text-ink-faint">
                  Leído {s.lastDownloaded ? new Date(s.lastDownloaded).toLocaleDateString("es-MX") : "—"}
                </span>
                <span className={s.errors ? "text-negative" : s.warnings ? "text-warning" : "text-positive"}>
                  {s.isPending ? "Pendiente" : s.errors ? `${s.errors} errores` : s.warnings ? `${s.warnings} advertencias` : "Sin errores"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="inline-block h-0.5 w-3 rounded" style={{ background: color }} />
      {label}
    </span>
  );
}

function TrendChart({ data }: { data: ScSummary["byDate"] }) {
  if (data.length < 2) return <p className="text-[13px] text-ink-faint">Todavía no hay suficientes datos para la gráfica.</p>;
  const W = 1000;
  const H = 180;
  const pad = 6;
  const maxClicks = Math.max(1, ...data.map((d) => d.clicks));
  const maxImpr = Math.max(1, ...data.map((d) => d.impressions));
  const x = (i: number) => pad + (i * (W - pad * 2)) / (data.length - 1);
  const line = (key: "clicks" | "impressions", max: number) =>
    data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${(H - pad - (d[key] / max) * (H - pad * 2)).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[180px] w-full" preserveAspectRatio="none" role="img" aria-label="Clics e impresiones por día">
        <path d={line("impressions", maxImpr)} fill="none" stroke="var(--color-ink-faint)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <path d={line("clicks", maxClicks)} fill="none" stroke="var(--color-brand)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex justify-between text-[10.5px] text-ink-faint">
        <span>{shortDate(data[0].date)}</span>
        <span>
          máx. {num(maxClicks)} clics · {num(maxImpr)} impresiones al día
        </span>
        <span>{shortDate(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}

function MetricTable({ rows, empty }: { rows: { label: string; clicks: number; impressions: number; ctr: number; position: number }[]; empty: string }) {
  if (!rows.length) return <p className="text-[13px] text-ink-faint">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-left text-[11px] text-ink-faint">
            <th className="pb-2 font-medium">Búsqueda</th>
            <th className="pb-2 text-right font-medium">Clics</th>
            <th className="pb-2 text-right font-medium">Impr.</th>
            <th className="pb-2 text-right font-medium">Pos.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-border-soft">
              <td className="py-1.5 pr-2">{r.label}</td>
              <td className="py-1.5 text-right tabular-nums">{num(r.clicks)}</td>
              <td className="py-1.5 text-right tabular-nums">{num(r.impressions)}</td>
              <td className="py-1.5 text-right tabular-nums">{pos(r.position)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PagesTable({ site, rows }: { site: ScSite; rows: ScSummary["topPages"] }) {
  if (!rows.length) return <p className="text-[13px] text-ink-faint">Todavía no hay páginas con impresiones en este periodo.</p>;
  return (
    <div className="flex flex-col divide-y divide-border-soft">
      {rows.map((r) => (
        <div key={r.page} className="flex flex-col gap-1 py-2">
          <div className="flex items-center gap-2 text-[12.5px]">
            <a href={r.page} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:text-brand">
              {r.page.replace(/^https?:\/\/(www\.)?[^/]+/, "") || "/"}
            </a>
            <span className="tabular-nums text-ink-faint">
              {num(r.clicks)} clics · {num(r.impressions)} impr.
            </span>
          </div>
          <InspectInline site={site} url={r.page} />
        </div>
      ))}
    </div>
  );
}

function verdictTone(v: string | null) {
  return v === "PASS" ? "text-positive" : v === "FAIL" ? "text-negative" : "text-warning";
}

function InspectionResult({ r }: { r: ScInspection }) {
  return (
    <div className="flex flex-col gap-0.5 text-[11.5px] leading-snug">
      <span className={`font-semibold ${verdictTone(r.verdict)}`}>
        {r.verdict === "PASS" ? "Indexada" : r.verdict === "FAIL" ? "No indexada" : "Con observaciones"} · {r.coverageState ?? "sin estado"}
      </span>
      <span className="text-ink-faint">
        Último rastreo: {r.lastCrawlTime ? new Date(r.lastCrawlTime).toLocaleString("es-MX") : "nunca"}
        {r.googleCanonical && r.userCanonical && r.googleCanonical !== r.userCanonical ? ` · Google eligió otra canónica: ${r.googleCanonical}` : ""}
      </span>
    </div>
  );
}

function InspectInline({ site, url }: { site: ScSite; url: string }) {
  const [result, setResult] = useState<ScInspection | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  if (result) return <InspectionResult r={result} />;
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={state === "loading"}
        onClick={() => {
          setState("loading");
          api<ScInspection>("/inspect", { method: "POST", body: JSON.stringify({ site, url }) })
            .then((r) => {
              setResult(r);
              setState("idle");
            })
            .catch((e: Error) => {
              setMessage(e.message);
              setState("error");
            });
        }}
        className="rounded-md border border-border px-2 py-0.5 text-[10.5px] font-semibold text-ink-soft hover:border-brand hover:text-brand disabled:opacity-50"
      >
        {state === "loading" ? "Revisando…" : "¿Está indexada?"}
      </button>
      {state === "error" && <span className="text-[11px] text-negative">{message}</span>}
    </div>
  );
}

function InspectorCard({ site }: { site: ScSite }) {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<ScInspection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  return (
    <Card title="Revisar una URL" aside={<span className="text-[10.5px] text-ink-faint">Cuota: 2,000 revisiones al día por sitio</span>}>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setLoading(true);
          setError(null);
          setResult(null);
          api<ScInspection>("/inspect", { method: "POST", body: JSON.stringify({ site, url: url.trim(), fresh: true }) })
            .then(setResult)
            .catch((err: Error) => setError(err.message))
            .finally(() => setLoading(false));
        }}
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={site === "la-mira" ? "https://lamira.mx/noticias/…" : "https://www.planazo.com.mx/lugares/…"}
          className="min-w-[240px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="rounded-lg bg-brand px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Revisando…" : "Revisar indexación"}
        </button>
      </form>
      {error && <p className="mt-2 text-[12.5px] text-negative">{error}</p>}
      {result && (
        <div className="mt-3">
          <InspectionResult r={result} />
        </div>
      )}
    </Card>
  );
}
