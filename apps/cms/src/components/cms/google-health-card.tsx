"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiConfig } from "@planazo/config";
import { relativeTimeLabel } from "@/lib/dashboard-api";
import { SC_SITE_LABEL, type ScHealth } from "@/lib/search-console-types";

type State =
  | { kind: "loading" }
  | { kind: "ready"; data: ScHealth[] }
  | { kind: "unconfigured" }
  | { kind: "error"; message: string };

async function fetchHealth(refresh: boolean): Promise<State> {
  const res = await fetch(`${apiConfig.clientBaseUrl}/cms/search-console/health${refresh ? "?refresh=1" : ""}`, {
    credentials: "include",
  });
  const body = (await res.json().catch(() => null)) as (ScHealth[] & { message?: string }) | null;
  if (res.status === 503) return { kind: "unconfigured" };
  if (!res.ok || !Array.isArray(body)) return { kind: "error", message: body?.message ?? `Error ${res.status}` };
  return { kind: "ready", data: body };
}

const daysAgo = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) : null);

/**
 * "Salud en Google" del Dashboard: sitemap, clics de la semana y una muestra
 * de páginas recientes inspeccionadas en Search Console. La API guarda el
 * resultado y lo recalcula a lo más una vez al día; "Revisar ahora" fuerza
 * un cálculo nuevo (tarda unos segundos y gasta cuota de inspección).
 */
export function GoogleHealthCard() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchHealth(false)
      .then((s) => !cancelled && setState(s))
      .catch(() => !cancelled && setState({ kind: "error", message: "No se pudo consultar Search Console." }));
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setRefreshing(true);
    try {
      setState(await fetchHealth(true));
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[13.5px] font-semibold tracking-tight">Salud en Google</span>
        <span className="flex-1" />
        {state.kind === "ready" && (
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="rounded-md border border-border px-2 py-1 text-[10.5px] font-semibold text-ink-soft transition-colors hover:border-brand hover:text-brand disabled:cursor-wait disabled:opacity-50"
          >
            {refreshing ? "Revisando…" : "Revisar ahora"}
          </button>
        )}
      </div>

      {state.kind === "loading" && (
        <p className="text-[12.5px] text-ink-faint">Revisando en Google… la primera revisión del día tarda unos segundos.</p>
      )}
      {state.kind === "unconfigured" && (
        <p className="text-[12.5px] text-ink-faint">
          Search Console no está conectado en este servidor.{" "}
          <Link href="/search-console" className="font-medium text-brand">
            Ver cómo conectarlo
          </Link>
        </p>
      )}
      {state.kind === "error" && <p className="text-[12.5px] text-negative">{state.message}</p>}

      {state.kind === "ready" && (
        <div className="flex flex-col gap-3.5">
          {state.data.length === 0 && <p className="text-[12.5px] text-ink-faint">Sin propiedades visibles en Search Console.</p>}
          {state.data.map((h) => {
            const read = daysAgo(h.sitemap?.lastDownloaded ?? null);
            // Con muy pocos clics el porcentaje engaña (de 1 a 0 sería "-100%").
            const delta = h.week.prevClicks >= 5 ? Math.round(((h.week.clicks - h.week.prevClicks) / h.week.prevClicks) * 100) : null;
            const ok = h.issues.length === 0;
            return (
              <div key={h.site} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="size-1.5 flex-none rounded-full" style={{ background: ok ? "#2E9B4F" : "#C98A12" }} />
                  <span className="text-[12.5px] font-semibold">{SC_SITE_LABEL[h.site]}</span>
                  <span className="flex-1" />
                  <span className="text-[10.5px] text-ink-faint">revisado {relativeTimeLabel(h.checkedAt)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px] leading-tight">
                  <div>
                    <p className="text-ink-faint">Recientes indexadas</p>
                    <p className="mt-0.5 text-[13px] font-semibold">
                      {h.sample.indexed}/{h.sample.checked}
                    </p>
                  </div>
                  <div>
                    <p className="text-ink-faint">Sitemap leído</p>
                    <p className="mt-0.5 text-[13px] font-semibold">{read === null ? "—" : read === 0 ? "hoy" : `hace ${read} d`}</p>
                  </div>
                  <div>
                    <p className="text-ink-faint">Clics 7 días</p>
                    <p className="mt-0.5 text-[13px] font-semibold">
                      {h.week.clicks.toLocaleString("es-MX")}
                      {delta !== null && (
                        <span className={`ml-1 text-[10.5px] font-medium ${delta >= 0 ? "text-positive" : "text-negative"}`}>
                          {delta >= 0 ? "+" : ""}
                          {delta}%
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                {h.issues.map((issue) => (
                  <p key={issue} className="text-[11px] leading-[1.4] text-ink-soft">
                    <span className="mr-1 font-bold" style={{ color: "#9A6B12" }}>
                      !
                    </span>
                    {issue}
                  </p>
                ))}
              </div>
            );
          })}
          <Link href="/search-console" className="text-[11.5px] font-medium text-brand">
            Ver detalle en Search Console →
          </Link>
        </div>
      )}
    </div>
  );
}
