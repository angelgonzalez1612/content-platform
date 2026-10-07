import { BadGatewayException, BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { searchConsoleHealth } from '../../db/schema';
import { GoogleTokenProvider, parseServiceAccount } from './google-service-account';

export type ScSite = 'la-mira' | 'planazo';

// Dominio de cada sitio — la propiedad de Search Console se detecta sola
// entre las que la cuenta de servicio puede ver (de dominio o de prefijo).
const SITE_DOMAINS: Record<ScSite, string> = { 'la-mira': 'lamira.mx', planazo: 'planazo.com.mx' };

const WEBMASTERS = 'https://www.googleapis.com/webmasters/v3';
const INSPECTION = 'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect';

export interface ScProperty {
  site: ScSite;
  siteUrl: string | null;
  permissionLevel: string | null;
}

export interface ScStatus {
  configured: boolean;
  serviceAccountEmail: string | null;
  properties: ScProperty[];
  error?: string;
}

interface Row {
  keys?: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface ScSummary {
  site: ScSite;
  siteUrl: string;
  startDate: string;
  endDate: string;
  totals: { clicks: number; impressions: number; ctr: number; position: number };
  byDate: { date: string; clicks: number; impressions: number }[];
  topQueries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  topPages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[];
  sitemaps: {
    path: string;
    lastSubmitted: string | null;
    lastDownloaded: string | null;
    isPending: boolean;
    errors: number;
    warnings: number;
    submitted: number;
  }[];
}

export interface ScInspection {
  url: string;
  verdict: string | null;
  coverageState: string | null;
  indexingState: string | null;
  robotsTxtState: string | null;
  pageFetchState: string | null;
  lastCrawlTime: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  inspectedAt: string;
}

export interface ScHealth {
  site: ScSite;
  siteUrl: string;
  checkedAt: string;
  sitemap: { path: string; lastDownloaded: string | null; submitted: number; errors: number; warnings: number } | null;
  week: { clicks: number; impressions: number; prevClicks: number; prevImpressions: number };
  sample: {
    checked: number;
    indexed: number;
    notKnown: number;
    other: number;
    items: { url: string; verdict: string | null; coverageState: string | null }[];
  };
  issues: string[];
}

const SUMMARY_TTL = 30 * 60_000;
const INSPECTION_TTL = 6 * 60 * 60_000;
// El parte de salud se recalcula a lo más una vez al día (gasta cuota de inspección).
const HEALTH_TTL = 20 * 60 * 60_000;
const HEALTH_SAMPLE = 8;

// Sitemap público de cada sitio y qué secciones son contenido (no listados).
const HEALTH_SOURCES: Record<ScSite, { sitemap: string; sections: RegExp }> = {
  'la-mira': { sitemap: 'https://lamira.mx/sitemap.xml', sections: /\/(noticias|guias|reportajes)\/[^/]+$/ },
  planazo: { sitemap: 'https://www.planazo.com.mx/sitemap.xml', sections: /\/(lugares|guias)\/[^/]+$/ },
};

/**
 * Search Console de los dos sitios, de solo lectura, con una cuenta de
 * servicio (GOOGLE_SERVICE_ACCOUNT_JSON) agregada como usuario en cada
 * propiedad. Los datos de rendimiento llegan con ~2 días de retraso; la
 * inspección de URLs tiene cuota (2,000 al día por propiedad), por eso todo
 * se cachea en memoria.
 */
@Injectable()
export class SearchConsoleService {
  private readonly logger = new Logger(SearchConsoleService.name);
  private readonly tokens: GoogleTokenProvider | null;
  private readonly configError: string | null = null;
  private propertiesCache: { at: number; list: { siteUrl: string; permissionLevel: string }[] } | null = null;
  private readonly summaryCache = new Map<string, { at: number; value: ScSummary }>();
  private readonly inspectionCache = new Map<string, ScInspection>();

  private readonly healthInFlight = new Map<ScSite, Promise<ScHealth>>();

  constructor(
    config: ConfigService,
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
  ) {
    let tokens: GoogleTokenProvider | null = null;
    try {
      const account = parseServiceAccount(config.get<string>('GOOGLE_SERVICE_ACCOUNT_JSON'));
      if (account) tokens = new GoogleTokenProvider(account, ['https://www.googleapis.com/auth/webmasters.readonly']);
    } catch (err) {
      this.configError = err instanceof Error ? err.message : 'GOOGLE_SERVICE_ACCOUNT_JSON inválido.';
      this.logger.warn(this.configError);
    }
    this.tokens = tokens;
  }

  private requireTokens(): GoogleTokenProvider {
    if (!this.tokens) {
      throw new ServiceUnavailableException(this.configError ?? 'Search Console no está configurado: falta GOOGLE_SERVICE_ACCOUNT_JSON en el servidor.');
    }
    return this.tokens;
  }

  private async google<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = await this.requireTokens().getToken();
    const res = await fetch(url, {
      ...init,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
    const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) {
      const message = body.error?.message ?? `Search Console respondió ${res.status}`;
      if (res.status === 403) {
        throw new BadGatewayException(`Sin permiso en Search Console: agrega ${this.tokens?.email} como usuario de la propiedad. (${message})`);
      }
      throw new BadGatewayException(message);
    }
    return body;
  }

  private async listProperties(force = false) {
    if (!force && this.propertiesCache && Date.now() - this.propertiesCache.at < SUMMARY_TTL) return this.propertiesCache.list;
    const data = await this.google<{ siteEntry?: { siteUrl: string; permissionLevel: string }[] }>(`${WEBMASTERS}/sites`);
    const list = (data.siteEntry ?? []).filter((s) => s.permissionLevel !== 'siteUnverifiedUser');
    // Una lista vacía no se guarda: casi siempre es porque todavía no se
    // agrega la cuenta como usuario, y debe verse en cuanto se agregue.
    this.propertiesCache = list.length ? { at: Date.now(), list } : null;
    return list;
  }

  /** Propiedad del sitio: la de dominio si existe, si no la de prefijo con https y www o sin www. */
  private async propertyFor(site: ScSite): Promise<{ siteUrl: string; permissionLevel: string } | null> {
    const domain = SITE_DOMAINS[site];
    const find = (list: { siteUrl: string; permissionLevel: string }[]) =>
      list.find((p) => p.siteUrl === `sc-domain:${domain}`) ??
      list.find((p) => /^https?:\/\//.test(p.siteUrl) && new URL(p.siteUrl).hostname.replace(/^www\./, '') === domain) ??
      null;
    // Si no está en la lista guardada, se vuelve a pedir: la cuenta pudo
    // agregarse a esa propiedad después de la última consulta.
    return find(await this.listProperties()) ?? find(await this.listProperties(true));
  }

  private async requireProperty(site: ScSite): Promise<string> {
    const prop = await this.propertyFor(site);
    if (!prop) {
      throw new BadRequestException(
        `La cuenta de servicio no ve ninguna propiedad de ${SITE_DOMAINS[site]} en Search Console. Agrega ${this.tokens?.email} como usuario de esa propiedad.`,
      );
    }
    return prop.siteUrl;
  }

  async status(): Promise<ScStatus> {
    if (!this.tokens) {
      return { configured: false, serviceAccountEmail: null, properties: [], error: this.configError ?? undefined };
    }
    try {
      const properties = await Promise.all(
        (Object.keys(SITE_DOMAINS) as ScSite[]).map(async (site) => {
          const prop = await this.propertyFor(site);
          return { site, siteUrl: prop?.siteUrl ?? null, permissionLevel: prop?.permissionLevel ?? null };
        }),
      );
      return { configured: true, serviceAccountEmail: this.tokens.email, properties };
    } catch (err) {
      return { configured: true, serviceAccountEmail: this.tokens.email, properties: [], error: err instanceof Error ? err.message : String(err) };
    }
  }

  async summary(site: ScSite, days: number): Promise<ScSummary> {
    const key = `${site}|${days}`;
    const hit = this.summaryCache.get(key);
    if (hit && Date.now() - hit.at < SUMMARY_TTL) return hit.value;

    const siteUrl = await this.requireProperty(site);
    // Search Console tarda ~2 días en consolidar los datos.
    const end = new Date(Date.now() - 2 * 86_400_000);
    const start = new Date(end.getTime() - (days - 1) * 86_400_000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const base = { startDate: iso(start), endDate: iso(end), dataState: 'all' };
    const query = (body: Record<string, unknown>) =>
      this.google<{ rows?: Row[] }>(`${WEBMASTERS}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
        method: 'POST',
        body: JSON.stringify({ ...base, ...body }),
      });

    const [totals, byDate, queries, pages, sitemaps] = await Promise.all([
      query({}),
      query({ dimensions: ['date'], rowLimit: days + 5 }),
      query({ dimensions: ['query'], rowLimit: 25 }),
      query({ dimensions: ['page'], rowLimit: 25 }),
      this.google<{ sitemap?: { path: string; lastSubmitted?: string; lastDownloaded?: string; isPending?: boolean; errors?: string; warnings?: string; contents?: { submitted?: string }[] }[] }>(
        `${WEBMASTERS}/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
      ),
    ]);

    const t = totals.rows?.[0];
    const value: ScSummary = {
      site,
      siteUrl,
      startDate: base.startDate,
      endDate: base.endDate,
      totals: { clicks: t?.clicks ?? 0, impressions: t?.impressions ?? 0, ctr: t?.ctr ?? 0, position: t?.position ?? 0 },
      byDate: (byDate.rows ?? []).map((r) => ({ date: r.keys?.[0] ?? '', clicks: r.clicks, impressions: r.impressions })),
      topQueries: (queries.rows ?? []).map((r) => ({ query: r.keys?.[0] ?? '', clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
      topPages: (pages.rows ?? []).map((r) => ({ page: r.keys?.[0] ?? '', clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
      sitemaps: (sitemaps.sitemap ?? []).map((s) => ({
        path: s.path,
        lastSubmitted: s.lastSubmitted ?? null,
        lastDownloaded: s.lastDownloaded ?? null,
        isPending: !!s.isPending,
        errors: Number(s.errors ?? 0),
        warnings: Number(s.warnings ?? 0),
        submitted: (s.contents ?? []).reduce((a, c) => a + Number(c.submitted ?? 0), 0),
      })),
    };
    this.summaryCache.set(key, { at: Date.now(), value });
    return value;
  }

  async inspect(site: ScSite, url: string, fresh = false): Promise<ScInspection> {
    const domain = SITE_DOMAINS[site];
    let host: string;
    try {
      host = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      throw new BadRequestException('La URL no es válida.');
    }
    if (host !== domain) throw new BadRequestException(`La URL no es de ${domain}.`);

    const hit = this.inspectionCache.get(url);
    if (!fresh && hit && Date.now() - new Date(hit.inspectedAt).getTime() < INSPECTION_TTL) return hit;

    const siteUrl = await this.requireProperty(site);
    const data = await this.google<{
      inspectionResult?: {
        indexStatusResult?: {
          verdict?: string;
          coverageState?: string;
          indexingState?: string;
          robotsTxtState?: string;
          pageFetchState?: string;
          lastCrawlTime?: string;
          googleCanonical?: string;
          userCanonical?: string;
        };
      };
    }>(INSPECTION, { method: 'POST', body: JSON.stringify({ inspectionUrl: url, siteUrl, languageCode: 'es-MX' }) });

    const r = data.inspectionResult?.indexStatusResult ?? {};
    const value: ScInspection = {
      url,
      verdict: r.verdict ?? null,
      coverageState: r.coverageState ?? null,
      indexingState: r.indexingState ?? null,
      robotsTxtState: r.robotsTxtState ?? null,
      pageFetchState: r.pageFetchState ?? null,
      lastCrawlTime: r.lastCrawlTime ?? null,
      googleCanonical: r.googleCanonical ?? null,
      userCanonical: r.userCanonical ?? null,
      inspectedAt: new Date().toISOString(),
    };
    this.inspectionCache.set(url, value);
    return value;
  }

  /**
   * Parte de salud de los sitios con propiedad visible (tarjeta del Dashboard).
   * Se lee de la base y solo se recalcula si tiene más de HEALTH_TTL o si se
   * pide `refresh`, para no gastar cuota de inspección en cada visita.
   */
  async health(refresh = false): Promise<ScHealth[]> {
    this.requireTokens();
    const results: ScHealth[] = [];
    for (const site of Object.keys(SITE_DOMAINS) as ScSite[]) {
      const stored = await this.db.query.searchConsoleHealth.findFirst({ where: eq(searchConsoleHealth.site, site) });
      const fresh = stored && Date.now() - stored.checkedAt.getTime() < HEALTH_TTL;
      if (stored && fresh && !refresh) {
        results.push(stored.data as ScHealth);
        continue;
      }
      if (!(await this.propertyFor(site))) continue;
      // Si ya hay un cálculo en curso para este sitio, se reutiliza.
      let pending = this.healthInFlight.get(site);
      if (!pending) {
        pending = this.computeHealth(site).finally(() => this.healthInFlight.delete(site));
        this.healthInFlight.set(site, pending);
      }
      try {
        results.push(await pending);
      } catch (err) {
        this.logger.warn(`No se pudo calcular la salud de ${site}: ${err instanceof Error ? err.message : String(err)}`);
        if (stored) results.push(stored.data as ScHealth);
      }
    }
    return results;
  }

  private async searchTotals(siteUrl: string, start: Date, end: Date) {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const data = await this.google<{ rows?: Row[] }>(`${WEBMASTERS}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      method: 'POST',
      body: JSON.stringify({ startDate: iso(start), endDate: iso(end), dataState: 'all' }),
    });
    return { clicks: data.rows?.[0]?.clicks ?? 0, impressions: data.rows?.[0]?.impressions ?? 0 };
  }

  /** Las páginas de contenido más recientes del sitemap público. */
  private async recentUrls(site: ScSite): Promise<string[]> {
    const { sitemap, sections } = HEALTH_SOURCES[site];
    const res = await fetch(sitemap, { headers: { 'user-agent': 'PlanazoCMS/1.0 (salud en Google)' } });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
      loc: m[1].match(/<loc>([^<]+)<\/loc>/)?.[1] ?? '',
      lastmod: m[1].match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? '',
    }));
    const content = entries.filter((e) => sections.test(e.loc));
    // Con fecha, las más recientes primero; sin fecha se respeta el orden del sitemap.
    content.sort((a, b) => (b.lastmod || '').localeCompare(a.lastmod || ''));
    return content.slice(0, HEALTH_SAMPLE).map((e) => e.loc);
  }

  private async computeHealth(site: ScSite): Promise<ScHealth> {
    const siteUrl = await this.requireProperty(site);
    const day = 86_400_000;
    const end = new Date(Date.now() - 2 * day);
    const [current, previous, sitemaps, urls] = await Promise.all([
      this.searchTotals(siteUrl, new Date(end.getTime() - 6 * day), end),
      this.searchTotals(siteUrl, new Date(end.getTime() - 13 * day), new Date(end.getTime() - 7 * day)),
      this.google<{ sitemap?: { path: string; lastDownloaded?: string; errors?: string; warnings?: string; contents?: { submitted?: string }[] }[] }>(
        `${WEBMASTERS}/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
      ),
      this.recentUrls(site),
    ]);

    // Una por una, para no golpear el límite por minuto de la API de inspección.
    const items: ScHealth['sample']['items'] = [];
    for (const url of urls) {
      try {
        const r = await this.inspect(site, url);
        items.push({ url, verdict: r.verdict, coverageState: r.coverageState });
      } catch (err) {
        items.push({ url, verdict: null, coverageState: err instanceof Error ? err.message : 'Error al inspeccionar' });
      }
    }
    const indexed = items.filter((i) => i.verdict === 'PASS').length;
    const notKnown = items.filter((i) => /no reconoce|unknown/i.test(i.coverageState ?? '')).length;

    const main = sitemaps.sitemap?.[0];
    const sitemap = main
      ? {
          path: main.path,
          lastDownloaded: main.lastDownloaded ?? null,
          submitted: (main.contents ?? []).reduce((a, c) => a + Number(c.submitted ?? 0), 0),
          errors: Number(main.errors ?? 0),
          warnings: Number(main.warnings ?? 0),
        }
      : null;

    const issues: string[] = [];
    if (!sitemap) issues.push('No hay sitemap enviado en Search Console.');
    else {
      const daysSinceRead = sitemap.lastDownloaded ? (Date.now() - new Date(sitemap.lastDownloaded).getTime()) / day : Infinity;
      if (daysSinceRead > 7) issues.push(`Google no ha leído el sitemap en ${Number.isFinite(daysSinceRead) ? `${Math.floor(daysSinceRead)} días` : 'mucho tiempo'}.`);
      if (sitemap.errors) issues.push(`El sitemap tiene ${sitemap.errors} error(es).`);
    }
    if (items.length && notKnown / items.length > 0.5) {
      issues.push(`Google todavía no conoce ${notKnown} de las ${items.length} páginas más recientes.`);
    }
    if (previous.clicks >= 10 && current.clicks < previous.clicks * 0.7) {
      issues.push(`Los clics bajaron ${Math.round((1 - current.clicks / previous.clicks) * 100)}% contra la semana anterior.`);
    }

    const value: ScHealth = {
      site,
      siteUrl,
      checkedAt: new Date().toISOString(),
      sitemap,
      week: { clicks: current.clicks, impressions: current.impressions, prevClicks: previous.clicks, prevImpressions: previous.impressions },
      sample: { checked: items.length, indexed, notKnown, other: items.length - indexed - notKnown, items },
      issues,
    };
    await this.db
      .insert(searchConsoleHealth)
      .values({ site, data: value, checkedAt: new Date() })
      .onConflictDoUpdate({ target: searchConsoleHealth.site, set: { data: value, checkedAt: new Date() } });
    return value;
  }
}
