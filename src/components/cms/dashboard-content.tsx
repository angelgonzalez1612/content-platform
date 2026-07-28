import type { AuthUser } from "@planazo/types";
import {
  getAlerts,
  getActivity,
  getKpis,
  getNeedsUpdate,
  getSeoOpportunities,
  getTopArticles,
} from "@/data/dashboard";
import { Icon } from "@/components/icon";

function greeting(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function DashboardContent({ user }: { user: AuthUser }) {
  const now = new Date();
  const firstName = user.name.split(" ")[0];
  const rawDateLabel = new Intl.DateTimeFormat("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const dateLabel = rawDateLabel.charAt(0).toUpperCase() + rawDateLabel.slice(1);

  const kpis = getKpis();
  const topArticles = getTopArticles();
  const needsUpdate = getNeedsUpdate();
  const seoOpportunities = getSeoOpportunities();
  const alerts = getAlerts();
  const activity = getActivity();

  return (
    <div className="max-w-[1320px] p-[26px] pb-[60px]">
      <div className="mb-[22px] flex items-end gap-4">
        <div>
          <h1 className="mb-1 text-[25px] font-semibold tracking-tight">
            {greeting(now.getHours())}, {firstName}
          </h1>
          <p className="text-[13.5px] text-ink-soft">
            {dateLabel} · 3 artículos se publican hoy, 2 esperan tu revisión.
          </p>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          title="Próximamente"
          className="flex items-center gap-2 rounded-[10px] bg-brand px-[15px] py-2.5 font-sans text-[13px] font-semibold text-white shadow-[0_1px_2px_rgba(253,105,13,.35)] transition-colors hover:bg-brand-pressed"
        >
          <Icon d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" size={15} strokeWidth={1.8} />
          Nuevo con IA
        </button>
      </div>

      <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(196px,1fr))] gap-px overflow-hidden rounded-[14px] border border-border bg-border">
        {kpis.map((k) => (
          <div key={k.label} className="flex min-w-0 flex-col gap-2 bg-white px-4 pt-[15px] pb-3.5 transition-colors hover:bg-[#FEFCFA]">
            <span className="text-[11.5px] text-[#8A837B]">{k.label}</span>
            <div className="flex flex-wrap items-baseline gap-[7px]">
              <span className="text-[23px] font-semibold tracking-tight [font-variant-numeric:tabular-nums]">{k.value}</span>
              <span className="font-mono text-[10.5px] font-medium" style={{ color: k.deltaColor }}>
                {k.delta}
              </span>
            </div>
            <div className="flex h-[22px] items-end gap-0.5">
              {k.spark.map((h, i) => (
                <span key={i} className="flex-1 rounded-[1px]" style={{ background: k.barColor, height: `${h}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(420px,1fr))] items-start gap-4">
        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-[14px] border border-border bg-white shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <div className="flex items-center gap-2.5 border-b border-border-soft px-4 py-3.5">
              <span className="text-[13.5px] font-semibold tracking-tight">Mejor rendimiento · últimos 7 días</span>
              <div className="flex-1" />
              <span className="text-[12px] text-ink-soft">Ver todo</span>
            </div>
            <div className="grid grid-cols-[1fr_78px_68px_68px_82px] gap-0 px-4 pt-2 pb-1 font-mono text-[9px] tracking-[.1em] text-[#BDB6AE] uppercase">
              <span>Artículo</span>
              <span className="text-right">Visitas</span>
              <span className="text-right">CTR</span>
              <span className="text-right">RPM</span>
              <span className="text-right">Ingresos</span>
            </div>
            {topArticles.map((a) => (
              <div
                key={a.title}
                className="grid grid-cols-[1fr_78px_68px_68px_82px] items-center gap-0 border-t border-border-soft px-4 py-2.5 transition-colors hover:bg-[#FEFCFA]"
              >
                <div className="flex min-w-0 flex-col gap-[3px] pr-3">
                  <span className="truncate text-[13px] font-medium tracking-tight">{a.title}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded font-mono text-[9.5px] text-[#8A837B]" style={{ background: "#F3F0EC", padding: "1px 5px" }}>
                      {a.category}
                    </span>
                    {a.ai && (
                      <span className="rounded font-mono text-[9.5px] text-accent-fg" style={{ background: "#FFF2E8", padding: "1px 5px" }}>
                        IA
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-right text-[13px] [font-variant-numeric:tabular-nums]">{a.visits}</span>
                <span className="text-right text-[13px] text-[#5C564F] [font-variant-numeric:tabular-nums]">{a.ctr}</span>
                <span className="text-right text-[13px] text-[#5C564F] [font-variant-numeric:tabular-nums]">{a.rpm}</span>
                <span className="text-right text-[13px] font-semibold [font-variant-numeric:tabular-nums]">{a.revenue}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
            <div className="rounded-[14px] border border-border bg-white p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[13.5px] font-semibold tracking-tight">Necesitan actualización</span>
                <span className="rounded font-mono text-[9.5px] text-warning" style={{ background: "#FEF6E7", padding: "1px 5px" }}>
                  {needsUpdate.length}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {needsUpdate.map((u) => (
                  <div key={u.title} className="flex items-center gap-2.5">
                    <span className="h-[26px] w-[3px] flex-none rounded-sm" style={{ background: u.color }} />
                    <div className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="truncate text-[12.5px] font-medium">{u.title}</span>
                      <span className="text-[10.5px] text-ink-faint">{u.why}</span>
                    </div>
                    <button
                      type="button"
                      className="flex-none rounded-md border border-border bg-white px-2 py-1 font-sans text-[11px] font-medium text-[#5C564F] transition-colors hover:border-brand hover:text-brand"
                    >
                      Refrescar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[14px] border border-border bg-white p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[13.5px] font-semibold tracking-tight">Oportunidades SEO</span>
                <div className="flex-1" />
                <span className="text-[11.5px] text-ink-soft">Keywords</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {seoOpportunities.map((o) => (
                  <div key={o.keyword} className="flex items-center gap-2.5 rounded-[9px] border border-border-soft px-2.5 py-2 transition-colors hover:border-[#FFD9BB] hover:bg-[#FFFCF9]">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[12.5px] font-medium">{o.keyword}</span>
                      <span className="font-mono text-[9.5px] text-ink-faint">
                        Vol {o.volume} · KD {o.kd} · {o.gap}
                      </span>
                    </div>
                    <span className="font-mono text-[10.5px] font-semibold text-positive">{o.score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-[14px] bg-ink p-4 text-white">
            <div
              className="absolute -right-[30px] -bottom-10 size-[150px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(253,105,13,.5), transparent 65%)" }}
            />
            <div className="relative">
              <div className="mb-[11px] flex items-center gap-1.5">
                <Icon d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6L12 4z" size={14} strokeWidth={1.8} className="text-brand" />
                <span className="text-[12.5px] font-semibold tracking-tight">Resumen del copiloto</span>
              </div>
              <p className="mb-[13px] text-[13px] leading-[1.55] text-white/78">
                Detecté <strong className="font-semibold text-white">14 keywords nuevas</strong> sobre brunch en
                Condesa con volumen creciente. Puedo armar un cluster de 5 artículos y programarlos para agosto.
              </p>
              <div className="flex gap-1.5">
                <button type="button" className="rounded-lg bg-brand px-3 py-[7px] font-sans text-[12px] font-semibold text-white">
                  Ver plan
                </button>
                <button type="button" className="rounded-lg border border-white/18 bg-transparent px-3 py-[7px] font-sans text-[12px] text-white/80">
                  Descartar
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border border-border bg-white p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <span className="mb-3 block text-[13.5px] font-semibold tracking-tight">Alertas</span>
            <div className="flex flex-col gap-2.5">
              {alerts.map((al) => (
                <div key={al.title} className="flex items-start gap-2.5">
                  <span
                    className="mt-px flex size-4 flex-none items-center justify-center rounded-[5px] text-[10px] font-bold"
                    style={{ background: al.bg, color: al.fg }}
                  >
                    {al.icon}
                  </span>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-[12.5px] leading-[1.35] font-medium">{al.title}</span>
                    <span className="text-[11px] leading-[1.4] text-ink-faint">{al.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[14px] border border-border bg-white p-4 shadow-[0_1px_2px_rgba(23,20,17,.03)]">
            <span className="mb-[13px] block text-[13.5px] font-semibold tracking-tight">Actividad reciente</span>
            <div className="flex flex-col">
              {activity.map((ac, i) => (
                <div key={i} className="flex gap-2.5 pb-[13px]">
                  <div className="flex w-5 flex-none flex-col items-center">
                    <span className="mt-1 size-[7px] rounded-full" style={{ background: ac.dot }} />
                    {i < activity.length - 1 && <span className="mt-[3px] w-px flex-1 bg-border-soft" />}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5">
                    <span className="text-[12.5px] leading-[1.4] text-[#3D382F]">{ac.text}</span>
                    <span className="font-mono text-[9.5px] text-[#BDB6AE]">
                      {ac.who} · {ac.when}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
