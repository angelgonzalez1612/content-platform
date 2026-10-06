import { BadGatewayException, BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

const SUMMARY_TTL = 30 * 60_000;
const INSPECTION_TTL = 6 * 60 * 60_000;

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

  constructor(config: ConfigService) {
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
}
