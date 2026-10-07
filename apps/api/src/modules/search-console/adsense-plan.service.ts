import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { promises as dns } from 'node:dns';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { adsensePlanTasks } from '../../db/schema';
import { SearchConsoleService, type ScHealth, type ScSite } from './search-console.service';

// Fecha en que se reenviaron los sitemaps tras la limpieza (Fase 1 del plan):
// una lectura de Google posterior significa que ya vio los sitios limpios.
const SITEMAP_RESUBMITTED_AT = new Date('2026-10-07T16:48:00Z');
const SITE_LABEL: Record<ScSite, string> = { 'la-mira': 'La Mira', planazo: 'Planazo' };

export interface PlanCriterion {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface PlanTask {
  id: string;
  label: string;
  help: string;
  link?: string;
  /** Las tareas finales (pedir la revisión) no cuentan para "listo para pedirla". */
  final?: boolean;
  done: boolean;
  doneAt: string | null;
}

export interface AdsensePlan {
  ready: boolean;
  passed: number;
  total: number;
  criteria: PlanCriterion[];
  tasks: PlanTask[];
}

const TASKS: Omit<PlanTask, 'done' | 'doneAt'>[] = [
  {
    id: 'correo-prueba',
    label: 'Mandar un correo de prueba a redaccion@lamira.mx y confirmar que llega',
    help: 'Configura el reenvío del dominio (Cloudflare Email Routing o ImprovMX) hacia tu Gmail y prueba desde otra cuenta. Las páginas de Contacto, Publicidad y Quiénes somos citan ese correo.',
  },
  {
    id: 'indexacion-lamira',
    label: 'Pedir la indexación de las páginas clave de La Mira',
    help: 'En Search Console: Inspección de URLs → Solicitar indexación. Portada, Quiénes somos, las guías nuevas y las mejores notas. Unas 10 al día.',
    link: 'https://search.google.com/search-console',
  },
  {
    id: 'indexacion-planazo',
    label: 'Pedir la indexación de las páginas clave de Planazo',
    help: 'Portada, Quiénes somos, las fichas reescritas más fuertes (Antropología, Bellas Artes, Contramar, El Califa de León…) y las guías.',
    link: 'https://search.google.com/search-console',
  },
  {
    id: 'validar-breadcrumbs',
    label: 'Validar la corrección de "Rutas de exploración" en La Mira',
    help: 'En Search Console de La Mira: Mejoras → Rutas de exploración → abrir el error "Falta el campo item" → Validar corrección.',
    link: 'https://search.google.com/search-console',
  },
  {
    id: 'revisar-errores',
    label: 'Revisar que no haya errores nuevos en Mejoras e Indexación de páginas',
    help: 'En los dos sitios. Si aparece algo, pégaselo a Claude para revisarlo.',
    link: 'https://search.google.com/search-console',
  },
  {
    id: 'llave-vercel',
    label: 'Poner GOOGLE_SERVICE_ACCOUNT_JSON en el proyecto API de Vercel',
    help: 'Settings → Environment Variables → pegar el contenido del JSON de la cuenta de servicio → Redeploy. Así la tarjeta y esta pantalla también funcionan en el CMS en línea.',
    link: 'https://vercel.com',
  },
  {
    id: 'pedir-adsense-lamira',
    label: 'Pedir la revisión de AdSense para La Mira',
    help: 'Cuando todo lo de arriba esté en verde. En AdSense: Sitios → lamira.mx → Solicitar revisión.',
    link: 'https://adsense.google.com',
    final: true,
  },
  {
    id: 'pedir-adsense-planazo',
    label: 'Pedir la revisión de AdSense para Planazo',
    help: 'Después de que aprueben La Mira, o si Planazo ya cumple por su cuenta.',
    link: 'https://adsense.google.com',
    final: true,
  },
];

/** "Camino a AdSense": criterios que se revisan solos + tareas que marca el editor. */
@Injectable()
export class AdsensePlanService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly searchConsole: SearchConsoleService,
  ) {}

  private async hasMx(domain: string): Promise<boolean> {
    try {
      return (await dns.resolveMx(domain)).length > 0;
    } catch {
      return false;
    }
  }

  private healthCriteria(health: ScHealth[]): PlanCriterion[] {
    const criteria: PlanCriterion[] = [];
    for (const site of ['la-mira', 'planazo'] as ScSite[]) {
      const h = health.find((x) => x.site === site);
      const label = SITE_LABEL[site];
      if (!h) {
        criteria.push({ id: `datos-${site}`, label: `${label}: datos de Search Console`, ok: false, detail: 'Sin datos todavía.' });
        continue;
      }
      const read = h.sitemap?.lastDownloaded ? new Date(h.sitemap.lastDownloaded) : null;
      criteria.push({
        id: `sitemap-${site}`,
        label: `${label}: Google leyó el sitemap después del reenvío`,
        ok: !!read && read > SITEMAP_RESUBMITTED_AT,
        detail: read ? `Última lectura: ${read.toLocaleDateString('es-MX')}` : 'Google no lo ha leído.',
      });
      criteria.push({
        id: `sitemap-errores-${site}`,
        label: `${label}: sitemap sin errores`,
        ok: !!h.sitemap && h.sitemap.errors === 0,
        detail: h.sitemap ? `${h.sitemap.errors} errores, ${h.sitemap.warnings} advertencias` : 'No hay sitemap enviado.',
      });
      const pct = h.sample.checked ? h.sample.indexed / h.sample.checked : 0;
      criteria.push({
        id: `indexadas-${site}`,
        label: `${label}: al menos la mitad de las páginas recientes indexadas`,
        ok: h.sample.checked > 0 && pct >= 0.5,
        detail: `${h.sample.indexed} de ${h.sample.checked} en la última revisión`,
      });
    }
    return criteria;
  }

  async get(): Promise<AdsensePlan> {
    const status = await this.searchConsole.status();
    const connected = status.configured && status.properties.every((p) => p.siteUrl);
    const criteria: PlanCriterion[] = [
      {
        id: 'search-console',
        label: 'Search Console conectado a los dos sitios',
        ok: connected,
        detail: connected ? 'La cuenta de servicio ve las dos propiedades.' : (status.error ?? 'Falta la cuenta de servicio o su acceso a alguna propiedad.'),
      },
      {
        id: 'correo-lamira',
        label: 'El dominio lamira.mx puede recibir correo (registros MX)',
        ok: await this.hasMx('lamira.mx'),
        detail: 'Sin registros MX, redaccion@lamira.mx y publicidad@lamira.mx no reciben mensajes.',
      },
    ];
    if (connected) {
      const health = await this.searchConsole.health().catch(() => [] as ScHealth[]);
      criteria.push(...this.healthCriteria(health));
    }

    const rows = await this.db.query.adsensePlanTasks.findMany();
    const tasks: PlanTask[] = TASKS.map((t) => {
      const row = rows.find((r) => r.id === t.id);
      return { ...t, done: !!row?.done, doneAt: row?.doneAt ? row.doneAt.toISOString() : null };
    });

    const required = [...criteria.map((c) => c.ok), ...tasks.filter((t) => !t.final).map((t) => t.done)];
    const passed = required.filter(Boolean).length;
    return { ready: passed === required.length, passed, total: required.length, criteria, tasks };
  }

  async setTask(id: string, done: boolean): Promise<AdsensePlan> {
    if (!TASKS.some((t) => t.id === id)) throw new BadRequestException(`Tarea desconocida: ${id}`);
    const doneAt = done ? new Date() : null;
    await this.db
      .insert(adsensePlanTasks)
      .values({ id, done, doneAt })
      .onConflictDoUpdate({ target: adsensePlanTasks.id, set: { done, doneAt } });
    return this.get();
  }
}
