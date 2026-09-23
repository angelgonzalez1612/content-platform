"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiConfig } from "@planazo/config";
import { Icon } from "@/components/icon";
import { MexicoMap } from "./mexico-map";
import { ZmvmMap } from "./zmvm-map";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";
const PIN_ICON = "M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12zM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z";
const ARROW_ICON = "M5 12h14M13 6l6 6-6 6";

// Google Trends no tiene datos confiables a nivel municipio/alcaldía (se
// probó en vivo, ver zmvm-municipios-map.ts) — el drill-down de la Zona
// Metropolitana solo existe para estos dos estados, cuyas frases/valor
// siguen siendo los del estado completo.
const ZMVM_STATE_CODES = new Set(["cmx", "mex"]);

// Mismos 5 ids/keywords que apps/api/src/modules/entidades/entidades-categories.ts
// — sin paquete compartido entre api/cms para una lista tan chica, igual que
// MODE_LABEL en publish-flow.tsx duplica sus propias categorías fijas.
const CATEGORIES = [
  { id: "noticias", label: "Noticias" },
  { id: "que-hacer", label: "Qué hacer" },
  { id: "eventos", label: "Eventos" },
  { id: "clima", label: "Clima" },
  { id: "trafico", label: "Tráfico" },
];

interface RelatedQuery {
  query: string;
  value: number;
  breakout: boolean;
}

interface StatePhrases {
  top: RelatedQuery[];
  rising: RelatedQuery[];
}

async function fetchJson<T>(path: string): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(`${apiConfig.clientBaseUrl}${path}`, { credentials: "include" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      return { data: null, error: body?.message ?? "No se pudo cargar la información." };
    }
    return { data: (await res.json()) as T, error: null };
  } catch {
    return { data: null, error: "No se pudo conectar con el servidor." };
  }
}

interface InterestState {
  key: string;
  interest: Record<string, number> | null;
  error: string | null;
}

interface PhrasesState {
  key: string;
  phrases: StatePhrases | null;
  error: string | null;
}

export function EntidadesExplorer() {
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [retryToken, setRetryToken] = useState(0);
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const [municipio, setMunicipio] = useState<{ code: string; name: string } | null>(null);
  const [showZmvm, setShowZmvm] = useState(false);

  // `key` guarda para qué categoría (o estado+categoría) es el resultado
  // guardado — mientras no coincida con el pedido actual, se considera
  // "cargando". Evita llamar setState de forma síncrona en el cuerpo del
  // efecto (ver regla react-hooks/set-state-in-effect): el estado solo se
  // actualiza dentro del callback async, nunca antes de pedir el fetch.
  const interestKey = `${categoryId}:${retryToken}`;
  const [interestState, setInterestState] = useState<InterestState>({ key: "", interest: null, error: null });
  const interestLoading = interestState.key !== interestKey;
  const interest = interestState.key === interestKey ? interestState.interest : null;
  const interestError = interestState.key === interestKey ? interestState.error : null;

  const phrasesKey = selected ? `${selected.code}:${categoryId}` : "";
  const [phrasesState, setPhrasesState] = useState<PhrasesState>({ key: "", phrases: null, error: null });
  const phrasesLoading = !!selected && phrasesState.key !== phrasesKey;
  const phrases = phrasesState.key === phrasesKey ? phrasesState.phrases : null;
  const phrasesError = phrasesState.key === phrasesKey ? phrasesState.error : null;

  const categoryLabel = CATEGORIES.find((c) => c.id === categoryId)?.label ?? categoryId;

  useEffect(() => {
    let cancelled = false;
    const key = interestKey;
    fetchJson<{ code: string; name: string; value: number }[]>(`/cms/entidades/interest?category=${categoryId}`).then(({ data, error }) => {
      if (cancelled) return;
      setInterestState({
        key,
        interest: error ? null : Object.fromEntries((data ?? []).map((s) => [s.code, s.value])),
        error,
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- interestKey ya deriva de [categoryId, retryToken]
  }, [interestKey]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const key = phrasesKey;
    fetchJson<StatePhrases>(`/cms/entidades/phrases?category=${categoryId}&state=${selected.code}`).then(({ data, error }) => {
      if (cancelled) return;
      setPhrasesState({ key, phrases: error ? null : data, error });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- phrasesKey ya deriva de [selected, categoryId]
  }, [phrasesKey]);

  function selectState(code: string, name: string) {
    setSelected({ code, name });
    setMunicipio(null);
  }

  function selectMunicipio(code: string, name: string, parentState: "cmx" | "mex") {
    const parentName = parentState === "cmx" ? "Ciudad de México" : "Estado de México";
    setSelected({ code: parentState, name: parentName });
    setMunicipio({ code, name });
  }

  const locationLabel = municipio ? `${municipio.name}, ${selected?.name}` : (selected?.name ?? "");

  function centroIaHref(query: string) {
    const hints = `Frase real de Google Trends en ${locationLabel} (categoría: ${categoryLabel}): "${query}". Sin fuentes adicionales — trátalo como tema, no inventes datos verificables (fecha, ubicación, cifras).`;
    const params = new URLSearchParams({ name: query, hints, source: "entidades" });
    return `/centro-ia?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-5 p-[26px] pb-[60px] lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div>
          <h1 className="mb-1 text-[20px] font-semibold tracking-tight">Entidades</h1>
          <p className="max-w-[62ch] text-[13px] leading-[1.55] text-ink-soft">
            Interés real de búsqueda por estado (Google Trends) — un vistazo geográfico a qué busca la gente, para encontrar temas antes de escribir.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 rounded-full border border-border bg-background p-0.5" style={{ width: "fit-content" }}>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${
                categoryId === c.id ? "bg-card text-ink shadow-[0_1px_2px_rgba(23,20,17,.08)]" : "text-ink-faint hover:text-ink"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="rounded-[16px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
          {interestError ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-[13px] font-medium text-ink-soft">Datos de tendencia no disponibles ahora mismo.</p>
              <p className="max-w-[40ch] text-[12px] text-ink-faint">{interestError}</p>
              <button
                type="button"
                onClick={() => setRetryToken((n) => n + 1)}
                className="mt-1 rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-ink-faint"
              >
                Reintentar
              </button>
            </div>
          ) : showZmvm ? (
            <>
              <button
                type="button"
                onClick={() => setShowZmvm(false)}
                className="mb-2 flex items-center gap-1 text-[12px] font-semibold text-ink-soft transition-colors hover:text-ink"
              >
                <Icon d={ARROW_ICON} size={12} strokeWidth={2} className="rotate-180" />
                Volver al mapa nacional
              </button>
              <ZmvmMap selected={municipio?.code ?? null} onSelect={selectMunicipio} />
            </>
          ) : (
            <MexicoMap interest={interestLoading ? null : interest} selected={selected?.code ?? null} onSelect={selectState} />
          )}
        </div>

        {!interestError && (
          <div className="flex items-center gap-2 text-[11.5px] text-ink-faint">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-border-soft)" }} />
            Menos interés
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "var(--color-brand)" }} />
            Más interés
          </div>
        )}
      </div>

      <div className="flex w-full flex-none flex-col gap-3 rounded-[16px] border border-border bg-card p-5 shadow-[0_1px_2px_rgba(23,20,17,.03)] lg:w-[340px]">
        {!selected ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Icon d={PIN_ICON} size={22} strokeWidth={1.4} className="text-ink-faint" />
            <p className="text-[13px] text-ink-faint">Elige un estado en el mapa para ver qué busca la gente ahí.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Icon d={PIN_ICON} size={16} strokeWidth={1.6} className="text-brand" />
              <h2 className="text-[15px] font-semibold tracking-tight">{locationLabel}</h2>
            </div>
            <p className="text-[11.5px] text-ink-faint">
              Frases relacionadas con &quot;{categoryLabel.toLowerCase()}&quot; en {municipio ? "este estado (Trends no tiene dato propio por alcaldía/municipio)" : "este estado"}.
            </p>

            {ZMVM_STATE_CODES.has(selected.code) && (
              <button
                type="button"
                onClick={() => setShowZmvm(true)}
                className="flex w-fit items-center gap-1.5 rounded-lg border border-dashed border-border px-2.5 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-brand hover:text-brand"
              >
                <Icon d={PIN_ICON} size={12} strokeWidth={1.8} />
                {municipio ? `Cambiar alcaldía/municipio (${municipio.name})` : "Ver alcaldías / municipios"}
              </button>
            )}

            {phrasesLoading && <p className="py-6 text-center text-[12.5px] text-ink-faint">Consultando Google Trends…</p>}
            {phrasesError && (
              <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                <p className="text-[12.5px] font-medium text-ink-soft">No disponible ahora mismo.</p>
                <p className="text-[11.5px] text-ink-faint">{phrasesError}</p>
              </div>
            )}
            {phrases && !phrasesLoading && !phrasesError && (
              <PhraseLists phrases={phrases} centroIaHref={centroIaHref} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function PhraseLists({ phrases, centroIaHref }: { phrases: StatePhrases; centroIaHref: (query: string) => string }) {
  if (phrases.top.length === 0 && phrases.rising.length === 0) {
    return <p className="py-6 text-center text-[12.5px] text-ink-faint">Sin frases suficientes para esta combinación todavía.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {phrases.top.length > 0 && (
        <PhraseGroup title="Más buscadas" items={phrases.top} centroIaHref={centroIaHref} />
      )}
      {phrases.rising.length > 0 && (
        <PhraseGroup title="En crecimiento" items={phrases.rising} centroIaHref={centroIaHref} />
      )}
    </div>
  );
}

function PhraseGroup({ title, items, centroIaHref }: { title: string; items: RelatedQuery[]; centroIaHref: (query: string) => string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10.5px] font-semibold tracking-[.02em] text-ink-faint uppercase">{title}</span>
      <div className="flex flex-col gap-1">
        {items.slice(0, 8).map((item) => (
          <div key={item.query} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-hover">
            <div className="min-w-0">
              <span className="block truncate text-[12.5px] font-medium text-ink">{item.query}</span>
              {item.breakout && <span className="text-[10px] font-semibold text-brand">Breakout</span>}
            </div>
            <Link
              href={centroIaHref(item.query)}
              className="flex flex-none items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
              title="Generar contenido con esta frase en Centro IA"
            >
              <Icon d={SPARK_ICON} size={10} strokeWidth={2} />
              Generar
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
