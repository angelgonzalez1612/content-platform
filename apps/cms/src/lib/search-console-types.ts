// Mismas formas que devuelve /api/cms/search-console (ver
// apps/api/src/modules/search-console/search-console.service.ts).

export type ScSite = "la-mira" | "planazo";

export interface ScStatus {
  configured: boolean;
  serviceAccountEmail: string | null;
  properties: { site: ScSite; siteUrl: string | null; permissionLevel: string | null }[];
  error?: string;
}

export interface ScRow {
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
  totals: ScRow;
  byDate: { date: string; clicks: number; impressions: number }[];
  topQueries: (ScRow & { query: string })[];
  topPages: (ScRow & { page: string })[];
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

export const SC_SITE_LABEL: Record<ScSite, string> = { "la-mira": "La Mira", planazo: "Planazo" };

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
