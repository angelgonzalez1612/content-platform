"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Category } from "@planazo/types";
import { apiConfig, siteConfig } from "@planazo/config";
import { Icon } from "@/components/icon";
import { fieldClass, labelClass } from "@/components/cms/dynamic-field";
import { ViewPublishedLink } from "@/components/cms/view-published-link";
import { timeAgo } from "@/lib/time-ago";
import { LAMIRA_TYPE_PATH } from "@/lib/lamira-paths";
import {
  AUTOMATABLE_CONTENT_TYPES,
  OUTCOME_META,
  type AutomatableContentType,
  type AutomationRule,
  type AutomationRun,
  type AutomationQueue,
} from "@/lib/automation-types";

const SPARK_ICON = "M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z";

const TYPE_LABEL: Record<AutomatableContentType, string> = {
  noticia: "Noticia (La Mira)",
  alerta: "Alerta (La Mira)",
  reportaje: "Reportaje (La Mira)",
  place: "Lugar (Planazo)",
  "evento-planazo": "Evento (Planazo)",
};
const TYPE_SITE: Record<AutomatableContentType, "la-mira" | "planazo"> = {
  noticia: "la-mira",
  alerta: "la-mira",
  reportaje: "la-mira",
  place: "planazo",
  "evento-planazo": "planazo",
};
const SITE_LABEL: Record<"la-mira" | "planazo", string> = { "la-mira": "La Mira", planazo: "Planazo" };
const PROVIDER_LABEL: Record<AutomationRule["provider"], string> = {
  openai: "OpenAI",
  "claude-cli": "Claude (sesión)",
  "codex-cli": "Codex (sesión)",
};
const EDIT_PATH: Partial<Record<AutomatableContentType, string>> = {
  noticia: "lamira/noticia",
  alerta: "lamira/alerta",
  reportaje: "lamira/reportaje",
  "evento-planazo": "planazo-evento",
};
// Segmento de ruta pública de Planazo por tipo — equivalente a LAMIRA_TYPE_PATH
// pero solo cubre los 2 tipos de Planazo que la automatización puede crear.
const PLANAZO_TYPE_PATH: Partial<Record<AutomatableContentType, string>> = {
  place: "lugares",
  "evento-planazo": "eventos",
};

function contentHref(contentType: string | null, contentId: string | null): string | null {
  if (!contentType || !contentId) return null;
  if (contentType === "place") return `/contenido/${contentId}`;
  const path = EDIT_PATH[contentType as AutomatableContentType];
  return path ? `/contenido/${path}/${contentId}` : null;
}

// URL pública real (La Mira/Planazo en vivo) para una corrida ya publicada —
// distinto de contentHref, que apunta al editor del CMS. Solo aplica cuando
// outcome === 'published' (un borrador todavía no está vivo en el sitio).
function publicUrl(run: AutomationRun): string | null {
  if (!run.contentType || !run.contentSlug) return null;
  const type = run.contentType as AutomatableContentType;
  if (run.site === "la-mira") {
    const path = LAMIRA_TYPE_PATH[type];
    return path ? `${siteConfig.lamiraUrl}/${path}/${run.contentSlug}` : null;
  }
  if (run.site === "planazo") {
    const path = PLANAZO_TYPE_PATH[type];
    return path ? `${siteConfig.planazoUrl}/${path}/${run.contentSlug}` : null;
  }
  return null;
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

interface RuleFormState {
  name: string;
  active: boolean;
  site: "" | "la-mira" | "planazo";
  categorySlugs: string[];
  contentTypes: AutomatableContentType[];
  provider: AutomationRule["provider"];
  dailyLimit: number;
  expandIfShort: boolean;
  includeSearchPhrases: boolean;
}

const EMPTY_FORM: RuleFormState = {
  name: "",
  active: true,
  site: "",
  categorySlugs: [],
  contentTypes: [],
  provider: "claude-cli",
  dailyLimit: 3,
  expandIfShort: false,
  includeSearchPhrases: false,
};

function ruleToForm(rule: AutomationRule): RuleFormState {
  return {
    name: rule.name,
    active: rule.active,
    site: rule.site ?? "",
    categorySlugs: rule.categorySlugs,
    contentTypes: rule.contentTypes,
    provider: rule.provider,
    dailyLimit: rule.dailyLimit,
    expandIfShort: rule.expandIfShort,
    includeSearchPhrases: rule.includeSearchPhrases,
  };
}

export function AutomationView({
  initialRules,
  initialRuns,
  initialStatus,
  lamiraCategories,
  planazoCategories,
}: {
  initialRules: AutomationRule[];
  initialRuns: AutomationRun[];
  initialStatus: { lastCheckedAt: string | null; checkIntervalMinutes: number };
  lamiraCategories: Category[];
  planazoCategories: Category[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [runs, setRuns] = useState(initialRuns);
  const [status, setStatus] = useState(initialStatus);
  const [queue, setQueue] = useState<AutomationQueue | null>(null);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<RuleFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ evaluated: number; created: number } | null>(null);
  const [siteFilter, setSiteFilter] = useState<"all" | "la-mira" | "planazo" | "ambos">("all");
  const [phraseTab, setPhraseTab] = useState<"pending" | "processed">("pending");
  const [rightTab, setRightTab] = useState<"bitacora" | "phrases">("bitacora");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | AutomationRun["outcome"]>("all");
  const [dateFrom, setDateFrom] = useState(""); // yyyy-mm-dd, vacío = sin tope
  const [dateTo, setDateTo] = useState("");

  function set<K extends keyof RuleFormState>(key: K, value: RuleFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startCreate() {
    setForm(EMPTY_FORM);
    setEditingId("new");
    setError("");
  }

  function startEdit(rule: AutomationRule) {
    setForm(ruleToForm(rule));
    setEditingId(rule.id);
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setError("");
  }

  async function refreshAll() {
    const [rulesRes, runsRes, statusRes, queueRes] = await Promise.all([
      fetch(`${apiConfig.baseUrl}/cms/automation/rules`, { credentials: "include" }),
      fetch(`${apiConfig.baseUrl}/cms/automation/runs`, { credentials: "include" }),
      fetch(`${apiConfig.baseUrl}/cms/automation/status`, { credentials: "include" }),
      fetch(`${apiConfig.baseUrl}/cms/automation/queue`, { credentials: "include" }),
    ]);
    if (rulesRes.ok) setRules(await rulesRes.json());
    if (runsRes.ok) setRuns(await runsRes.json());
    if (statusRes.ok) setStatus(await statusRes.json());
    if (queueRes.ok) setQueue(await queueRes.json());
  }

  // La cola no viene de props (page.tsx no la pide todavía) — se trae al
  // montar, igual que AutomationActivityCard del Dashboard, así el nuevo
  // apartado de frases de búsqueda no bloquea el render inicial de la página.
  useEffect(() => {
    fetch(`${apiConfig.baseUrl}/cms/automation/queue`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setQueue(data));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError("");
    const payload = {
      name: form.name,
      active: form.active,
      site: form.site || null,
      categorySlugs: form.categorySlugs,
      contentTypes: form.contentTypes,
      provider: form.provider,
      dailyLimit: form.dailyLimit,
      expandIfShort: form.expandIfShort,
      includeSearchPhrases: form.includeSearchPhrases,
    };
    try {
      const isNew = editingId === "new";
      const res = await fetch(`${apiConfig.baseUrl}/cms/automation/rules${isNew ? "" : `/${editingId}`}`, {
        method: isNew ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(body?.message ?? "No se pudo guardar la regla.");
        setSaving(false);
        return;
      }
      await refreshAll();
      setEditingId(null);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(rule: AutomationRule) {
    await fetch(`${apiConfig.baseUrl}/cms/automation/rules/${rule.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    await refreshAll();
  }

  async function removeRule(rule: AutomationRule) {
    if (!confirm(`¿Borrar la regla "${rule.name}"? Esto no borra el contenido que ya haya creado, solo la regla.`)) return;
    await fetch(`${apiConfig.baseUrl}/cms/automation/rules/${rule.id}`, { method: "DELETE", credentials: "include" });
    await refreshAll();
  }

  async function runNow() {
    setRunning(true);
    setRunResult(null);
    try {
      const res = await fetch(`${apiConfig.baseUrl}/cms/automation/run-now`, { method: "POST", credentials: "include" });
      if (res.ok) setRunResult(await res.json());
      await refreshAll();
    } finally {
      setRunning(false);
    }
  }

  function toggleContentType(type: AutomatableContentType) {
    set(
      "contentTypes",
      form.contentTypes.includes(type) ? form.contentTypes.filter((t) => t !== type) : [...form.contentTypes, type],
    );
  }

  function toggleCategorySlug(slug: string) {
    set(
      "categorySlugs",
      form.categorySlugs.includes(slug) ? form.categorySlugs.filter((s) => s !== slug) : [...form.categorySlugs, slug],
    );
  }

  // Categorías ofrecidas en el picker — si la regla ya elige un sitio, solo
  // las de ese sitio; si es "Ambos", las de los dos (con etiqueta de cuál es cuál).
  const availableCategories: Array<Category & { siteLabel: string }> =
    form.site === "la-mira"
      ? lamiraCategories.map((c) => ({ ...c, siteLabel: "La Mira" }))
      : form.site === "planazo"
        ? planazoCategories.map((c) => ({ ...c, siteLabel: "Planazo" }))
        : [...lamiraCategories.map((c) => ({ ...c, siteLabel: "La Mira" })), ...planazoCategories.map((c) => ({ ...c, siteLabel: "Planazo" }))];

  // Los tipos ofrecidos también se filtran por sitio — elegir "La Mira" no
  // debería dejar marcar "Lugar (Planazo)".
  const availableTypes = AUTOMATABLE_CONTENT_TYPES.filter((t) => !form.site || TYPE_SITE[t] === form.site);

  // Badges de sitio para filtrar la lista — con 25+ reglas, verlas todas en
  // una sola columna plana era el origen del scroll excesivo. Un acordeón
  // (versión anterior) obligaba a abrir/cerrar grupos para comparar; un
  // filtro de un clic es más directo.
  const siteTabs = [
    { key: "all" as const, label: "Todos", count: rules.length },
    { key: "la-mira" as const, label: "La Mira", count: rules.filter((r) => r.site === "la-mira").length },
    { key: "planazo" as const, label: "Planazo", count: rules.filter((r) => r.site === "planazo").length },
    { key: "ambos" as const, label: "Ambos sitios", count: rules.filter((r) => !r.site).length },
  ].filter((t) => t.key === "all" || t.count > 0);

  const visibleRules =
    siteFilter === "all" ? rules : siteFilter === "ambos" ? rules.filter((r) => !r.site) : rules.filter((r) => r.site === siteFilter);

  // Filtros de la bitácora — por estatus y por rango de fecha (sobre las
  // corridas ya cargadas, findRecentRuns() trae hasta 100).
  const filteredRuns = runs.filter((run) => {
    if (outcomeFilter !== "all" && run.outcome !== outcomeFilter) return false;
    const day = run.ranAt.slice(0, 10);
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    return true;
  });
  const runFiltersActive = outcomeFilter !== "all" || !!dateFrom || !!dateTo;

  // Apartado nuevo: frases reales de "Qué busca la gente" (Content Radar) —
  // separado de la cola/bitácora de arriba (que mezcla todo) para que se vea
  // aparte qué está pasando específicamente con esta fuente más arriesgada.
  const phrasePending = queue?.pending.filter((p) => p.source === "search-phrase") ?? [];
  const phraseRuns = runs.filter((r) => r.source === "search-phrase");
  const rulesWithPhrases = rules.filter((r) => r.includeSearchPhrases);

  return (
    <div className="p-[26px] pb-[60px]">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Automatizaciones</h1>
          <p className="flex items-center gap-1.5 text-[12px] text-ink-faint">
            <span className={`size-[6px] rounded-full ${status.lastCheckedAt && Date.now() - new Date(status.lastCheckedAt).getTime() < 30 * 60 * 1000 ? "bg-positive" : "bg-ink-faint"}`} />
            Última revisión: {timeAgo(status.lastCheckedAt)}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2.5">
          <button
            type="button"
            onClick={runNow}
            disabled={running}
            className="flex items-center gap-2 rounded-[10px] border border-border bg-white px-4 py-2.5 text-[13.5px] font-semibold text-ink shadow-[0_1px_2px_rgba(23,20,17,.03)] transition-colors hover:border-ink-faint disabled:cursor-default disabled:opacity-60"
          >
            <Icon d={SPARK_ICON} size={14} strokeWidth={1.8} className={running ? "animate-spin text-brand" : "text-brand"} />
            {running ? "Ejecutando…" : "Ejecutar ahora"}
          </button>
          <button
            type="button"
            onClick={startCreate}
            className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed"
          >
            + Nueva regla
          </button>
        </div>
      </div>

      {runResult && (
        <p className="mb-5 rounded-lg bg-accent px-3.5 py-2.5 text-[13px] font-medium text-accent-fg">
          Corrida terminada: {runResult.evaluated} tema(s) evaluados, {runResult.created} pieza(s) creada(s). Revisa el detalle abajo, en
          la bitácora.
        </p>
      )}

      {editingId && (
        <div className="mb-6 flex flex-col gap-5 rounded-[14px] border border-border bg-white p-6 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
          <h2 className="text-[15px] font-semibold tracking-tight">{editingId === "new" ? "Nueva regla" : "Editar regla"}</h2>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="rule-name" className={labelClass}>
              Nombre
            </label>
            <input
              id="rule-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="ej. Noticias y alertas de La Mira"
              className={`${fieldClass} max-w-[420px]`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Sitio</span>
            <div className="flex gap-2">
              {(["", "la-mira", "planazo"] as const).map((s) => (
                <button
                  key={s || "ambos"}
                  type="button"
                  onClick={() => set("site", s)}
                  className={`rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                    form.site === s ? "border-brand bg-accent text-accent-fg" : "border-border bg-white text-ink-soft hover:border-ink-faint"
                  }`}
                >
                  {s === "" ? "Ambos sitios" : SITE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Tipos de contenido</span>
            <p className="text-[11.5px] leading-[1.4] text-ink-faint">
              Vacío = cualquiera de estos (la IA clasifica). Solo estos 5 tipos se pueden publicar solos — guía, evento y lugar de La Mira
              necesitan datos que un humano tiene que llenar a mano, así que no aparecen aquí.
            </p>
            <div className="flex flex-wrap gap-2">
              {availableTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleContentType(t)}
                  className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                    form.contentTypes.includes(t) ? "border-brand bg-accent text-accent-fg" : "border-border bg-white text-ink-soft hover:border-ink-faint"
                  }`}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className={labelClass}>Categorías</span>
            <p className="text-[11.5px] leading-[1.4] text-ink-faint">Vacío = cualquier categoría del sitio elegido.</p>
            <div className="flex max-h-[220px] flex-wrap gap-2 overflow-y-auto rounded-xl border border-border-soft bg-background p-3">
              {availableCategories.length === 0 && <span className="text-[12.5px] text-ink-faint">Elige un sitio arriba para ver sus categorías.</span>}
              {availableCategories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategorySlug(c.slug)}
                  title={form.site === "" ? c.siteLabel : undefined}
                  className={`rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                    form.categorySlugs.includes(c.slug) ? "border-brand bg-accent text-accent-fg" : "border-border bg-white text-ink-soft hover:border-ink-faint"
                  }`}
                >
                  {c.name}
                  {form.site === "" && <span className="ml-1 text-[10.5px] text-ink-faint">· {c.siteLabel}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>Proveedor de IA</span>
              <div className="flex gap-2">
                {(["claude-cli", "codex-cli", "openai"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set("provider", p)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-[12.5px] font-medium transition-colors ${
                      form.provider === p ? "border-brand bg-accent text-accent-fg" : "border-border bg-white text-ink-soft hover:border-ink-faint"
                    }`}
                  >
                    {PROVIDER_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="rule-limit" className={labelClass}>
                Tope diario de publicaciones
              </label>
              <input
                id="rule-limit"
                type="number"
                min={1}
                max={50}
                value={form.dailyLimit}
                onChange={(e) => set("dailyLimit", Number(e.target.value) || 1)}
                className={`${fieldClass} max-w-[140px]`}
              />
              <p className="text-[11.5px] leading-[1.4] text-ink-faint">Protege contra gastar todos los créditos de IA en una sola corrida.</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2.5 text-[13px] font-medium text-ink">
              <input
                type="checkbox"
                checked={form.expandIfShort}
                onChange={(e) => set("expandIfShort", e.target.checked)}
                className="size-4 rounded border-border accent-brand"
              />
              Agregar más contenido con IA si queda corto
            </label>
            <p className="ml-[26px] text-[11.5px] leading-[1.4] text-ink-faint">
              Si el borrador no llega al mínimo de longitud recomendado, le pide a la IA 1-3 secciones más antes de crear la pieza. Solo
              aplica a noticias y reportajes (los únicos tipos con cuerpo de texto propio) — y como ese contenido extra nunca pasó por la
              revisión de calidad del borrador original, la pieza siempre queda como borrador para que la revises, en vez de publicarse
              sola.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2.5 text-[13px] font-medium text-ink">
              <input
                type="checkbox"
                checked={form.includeSearchPhrases}
                onChange={(e) => set("includeSearchPhrases", e.target.checked)}
                className="size-4 rounded border-border accent-brand"
              />
              Incluir frases de búsqueda real (&quot;Qué busca la gente&quot;)
            </label>
            <p className="ml-[26px] text-[11.5px] leading-[1.4] text-ink-faint">
              Además de las noticias del reporte, también considera las frases reales que la gente busca en Google (sección
              &quot;Qué busca la gente&quot; de Content Radar) como semilla de contenido — sin artículo que citar, la IA redacta directo
              respondiendo esa intención de búsqueda. Es una fuente más arriesgada que una noticia con fuente real, por eso empieza
              apagado.
            </p>
          </div>

          <label className="flex items-center gap-2.5 text-[13px] font-medium text-ink">
            <input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} className="size-4 rounded border-border accent-brand" />
            Regla activa
          </label>

          {error && <p className="rounded-lg bg-[#FDECEA] px-3 py-2 text-[13px] font-medium text-[#C4453A]">{error}</p>}

          <div className="flex items-center gap-3 border-t border-border-soft pt-5">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.name}
              className="rounded-[10px] bg-brand px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed disabled:cursor-default disabled:opacity-60"
            >
              {saving ? "Guardando…" : "Guardar regla"}
            </button>
            <button type="button" onClick={cancelEdit} className="text-[13px] font-medium text-ink-soft hover:text-brand">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-start">
        <div className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
          <div className="flex items-center justify-between border-b border-border-soft px-5 py-3.5">
            <h2 className="text-[15px] font-semibold tracking-tight">Reglas</h2>
            {rules.length > 0 && (
              <span className="font-mono text-[11px] text-ink-faint">
                {rules.filter((r) => r.active).length}/{rules.length} activas
              </span>
            )}
          </div>

          {rules.length === 0 && !editingId ? (
            <p className="p-6 text-center text-[13.5px] text-ink-faint">
              Todavía no hay reglas — sin ninguna activa, nada se publica solo. Crea la primera con &quot;+ Nueva regla&quot;.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 border-b border-border-soft px-3 py-2.5">
                {siteTabs.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSiteFilter(t.key)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                      siteFilter === t.key ? "border-brand bg-accent text-accent-fg" : "border-border bg-white text-ink-soft hover:border-ink-faint"
                    }`}
                  >
                    {t.label}
                    <span
                      className={`rounded-full px-1.5 font-mono text-[10.5px] ${siteFilter === t.key ? "bg-white/60" : "bg-background text-ink-faint"}`}
                    >
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex max-h-[560px] flex-col divide-y divide-border-soft overflow-y-auto">
                {visibleRules.map((rule) => (
                  <div key={rule.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {rule.name}
                        <span className={`ml-2 text-[10.5px] font-medium ${rule.active ? "text-positive" : "text-ink-faint"}`}>
                          {rule.active ? "· activa" : "· pausada"}
                        </span>
                      </p>
                      <p className="truncate text-[11.5px] text-ink-faint">
                        {rule.contentTypes.length ? rule.contentTypes.map((t) => TYPE_LABEL[t]).join(", ") : "cualquier tipo"}
                        {" · "}
                        {rule.categorySlugs.length ? `${rule.categorySlugs.length} categoría(s)` : "cualquier categoría"}
                        {" · "}
                        {PROVIDER_LABEL[rule.provider]}
                        {" · hasta "}
                        {rule.dailyLimit}/día
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-1">
                      <button type="button" onClick={() => toggleActive(rule)} className="rounded-md border border-border bg-white px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-ink-faint">
                        {rule.active ? "Pausar" : "Activar"}
                      </button>
                      <button type="button" onClick={() => startEdit(rule)} className="rounded-md border border-border bg-white px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-ink-faint">
                        Editar
                      </button>
                      <button type="button" onClick={() => removeRule(rule)} className="rounded-md border border-border bg-white px-2 py-1 text-[11px] font-medium text-negative transition-colors hover:border-negative">
                        Borrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft px-4 py-2.5">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setRightTab("bitacora")}
                className={`rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${
                  rightTab === "bitacora" ? "border-brand bg-accent text-accent-fg" : "border-border bg-white text-ink-soft hover:border-ink-faint"
                }`}
              >
                Bitácora — qué hizo la IA
              </button>
              <button
                type="button"
                onClick={() => setRightTab("phrases")}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors ${
                  rightTab === "phrases" ? "border-brand bg-accent text-accent-fg" : "border-border bg-white text-ink-soft hover:border-ink-faint"
                }`}
              >
                Qué busca la gente (frases reales)
                {queue && (
                  <span className={`rounded-full px-1.5 font-mono text-[10.5px] ${rightTab === "phrases" ? "bg-white/60" : "bg-background text-ink-faint"}`}>
                    {phrasePending.length}
                  </span>
                )}
              </button>
            </div>
            {rightTab === "bitacora" && runs.length > 0 && (
              <span className="font-mono text-[11px] text-ink-faint">
                {runFiltersActive ? `${filteredRuns.length} de ${runs.length}` : `${runs.length} corrida(s)`}
              </span>
            )}
          </div>

          {rightTab === "phrases" ? (
            <>
              <p className="border-b border-border-soft px-4 py-2.5 text-[11.5px] text-ink-faint">
                Frases reales de autocompletado de Google, tomadas del reporte de Content Radar — sin artículo que citar, la IA redacta
                directo respondiendo la intención de búsqueda.{" "}
                {rulesWithPhrases.length === 0
                  ? "Ninguna regla las incluye todavía."
                  : `${rulesWithPhrases.length} regla(s) las incluye(n): ${rulesWithPhrases.map((r) => r.name).join(", ")}.`}
              </p>

              <div className="flex gap-1.5 border-b border-border-soft px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setPhraseTab("pending")}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                    phraseTab === "pending" ? "border-brand bg-accent text-accent-fg" : "border-border bg-white text-ink-soft hover:border-ink-faint"
                  }`}
                >
                  Pendientes de hoy
                  <span className={`rounded-full px-1.5 font-mono text-[10.5px] ${phraseTab === "pending" ? "bg-white/60" : "bg-background text-ink-faint"}`}>
                    {phrasePending.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPhraseTab("processed")}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium transition-colors ${
                    phraseTab === "processed" ? "border-brand bg-accent text-accent-fg" : "border-border bg-white text-ink-soft hover:border-ink-faint"
                  }`}
                >
                  Ya procesadas
                  <span className={`rounded-full px-1.5 font-mono text-[10.5px] ${phraseTab === "processed" ? "bg-white/60" : "bg-background text-ink-faint"}`}>
                    {phraseRuns.length}
                  </span>
                </button>
              </div>

              {phraseTab === "pending" ? (
                !queue ? (
                  <p className="px-4 py-3.5 text-[12px] text-ink-faint">Cargando…</p>
                ) : phrasePending.length === 0 ? (
                  <p className="px-4 py-3.5 text-[12px] text-ink-faint">
                    Sin frases pendientes hoy — o ya se evaluaron todas, o ninguna regla activa las incluye.
                  </p>
                ) : (
                  <div className="max-h-[560px] overflow-y-auto">
                    {phrasePending.map((p) => (
                      <div key={p.title} className="flex items-center gap-2 border-b border-border-soft px-4 py-2 last:border-b-0">
                        <p className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">{p.title}</p>
                        {!p.hasCandidateRule && (
                          <span className="flex-none rounded-md bg-background px-1.5 py-0.5 font-mono text-[10px] text-ink-faint">sin regla</span>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : phraseRuns.length === 0 ? (
                <p className="px-4 py-3.5 text-[12px] text-ink-faint">Todavía no se ha generado contenido a partir de estas frases.</p>
              ) : (
                <div className="max-h-[560px] overflow-y-auto">
                  {phraseRuns.slice(0, 30).map((run) => {
                    const meta = OUTCOME_META[run.outcome];
                    const live = run.outcome === "published" ? publicUrl(run) : null;
                    const href = !live ? contentHref(run.contentType, run.contentId) : null;
                    return (
                      <div key={run.id} className="flex items-center gap-2 border-b border-border-soft px-4 py-2 last:border-b-0">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium text-ink">{run.topic}</p>
                          <p className="truncate text-[11px] text-ink-faint">{run.ruleName ?? "—"}</p>
                        </div>
                        <span
                          className="flex-none rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium"
                          style={{ background: meta.bg, color: meta.fg }}
                        >
                          {meta.label}
                        </span>
                        {live ? (
                          <ViewPublishedLink compact href={live} available />
                        ) : (
                          href && (
                            <Link href={href} className="flex-none text-[12px] font-medium text-brand hover:text-brand-pressed">
                              Ver →
                            </Link>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
          {runs.length > 0 && (
            <div className="flex flex-col gap-2 border-b border-border-soft px-4 py-2.5">
              <div className="flex flex-wrap gap-1.5">
                {(["all", "published", "draft", "skipped_no_match", "skipped_duplicate", "error"] as const).map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOutcomeFilter(o)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      outcomeFilter === o ? "border-brand bg-accent text-accent-fg" : "border-border bg-white text-ink-soft hover:border-ink-faint"
                    }`}
                  >
                    {o === "all" ? "Todos" : OUTCOME_META[o].label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  max={dateTo || undefined}
                  className={`${fieldClass} w-auto py-1 text-[11.5px]`}
                />
                <span className="text-[11px] text-ink-faint">a</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  min={dateFrom || undefined}
                  className={`${fieldClass} w-auto py-1 text-[11.5px]`}
                />
                {runFiltersActive && (
                  <button
                    type="button"
                    onClick={() => {
                      setOutcomeFilter("all");
                      setDateFrom("");
                      setDateTo("");
                    }}
                    className="text-[11px] font-medium text-ink-faint hover:text-brand"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>
          )}

          {runs.length === 0 ? (
            <p className="p-6 text-center text-[13.5px] text-ink-faint">Todavía no hay corridas registradas.</p>
          ) : filteredRuns.length === 0 ? (
            <p className="p-6 text-center text-[13.5px] text-ink-faint">Ninguna corrida coincide con estos filtros.</p>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              {filteredRuns.map((run) => {
                const meta = OUTCOME_META[run.outcome];
                const live = run.outcome === "published" ? publicUrl(run) : null;
                const href = !live ? contentHref(run.contentType, run.contentId) : null;
                return (
                  <div key={run.id} className="flex items-center gap-3 border-b border-border-soft px-4 py-3 last:border-b-0">
                    <span className="w-[70px] flex-none font-mono text-[11px] text-ink-faint">{formatDateTime(run.ranAt)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{run.topic}</p>
                      <p className="truncate text-[11.5px] text-ink-faint">
                        {run.ruleName ?? "—"}
                        {run.categoryLabel ? ` · ${run.categoryLabel}` : ""}
                        {run.detail ? ` · ${run.detail}` : ""}
                      </p>
                    </div>
                    <span
                      className="flex-none rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[.03em]"
                      style={{ background: meta.bg, color: meta.fg }}
                    >
                      {meta.label}
                    </span>
                    {live ? (
                      <ViewPublishedLink compact href={live} available />
                    ) : (
                      href && (
                        <Link href={href} className="flex-none text-[12px] font-medium text-brand hover:text-brand-pressed">
                          Ver →
                        </Link>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
