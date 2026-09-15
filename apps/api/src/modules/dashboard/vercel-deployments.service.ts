import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LastDeploy {
  project: string;
  label: string;
  deployedAt: string | null;
  state: string | null;
  url: string | null;
}

const TEAM_ID = 'team_XWD2Gh2vHhU2guH0kpPLUmBD';

// Los 4 proyectos reales de Vercel de este monorepo/repos hermanos — ver
// .vercel/project.json de cada uno (apps/api, apps/cms, la-mira,
// planazo_fronted/apps/web). IDs, no son secretos (mismo criterio que el
// Search Engine ID de Google, están pensados para ser públicos).
const PROJECTS: { id: string; label: string }[] = [
  { id: 'prj_xo1kjLtN04C3kSh47ZWqAHxXEPrN', label: 'API' },
  { id: 'prj_ZJach11cE9naXAy678PWYo6BUj77', label: 'CMS' },
  { id: 'prj_OWmHTN97qSdWhW8WV4IEzXp2x8WN', label: 'La Mira' },
  { id: 'prj_9G9d50R5m0QdbK0kO4abqEw3oaI6', label: 'Planazo' },
];

interface VercelDeploymentsResponse {
  deployments: { ready?: number; created: number; readyState: string; url: string }[];
}

/** "Cuándo fue la última vez que se subió a prod" del Dashboard del CMS —
 * antes había que pedírmelo y yo corría `vercel ls --prod` a mano por cada
 * proyecto. Ahora lo mismo, pero vía la REST API de Vercel
 * (https://vercel.com/docs/rest-api/deployments/list-deployments), para que
 * se vea directo en el Dashboard sin depender de que alguien lo pregunte. */
@Injectable()
export class VercelDeploymentsService {
  private readonly logger = new Logger(VercelDeploymentsService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get('VERCEL_API_TOKEN');
  }

  async getLastDeploys(): Promise<LastDeploy[]> {
    const token = this.config.get<string>('VERCEL_API_TOKEN');
    if (!token) {
      return PROJECTS.map((p) => ({ project: p.id, label: p.label, deployedAt: null, state: null, url: null }));
    }

    return Promise.all(
      PROJECTS.map(async (p) => {
        try {
          const url =
            `https://api.vercel.com/v7/deployments?` +
            new URLSearchParams({ projectId: p.id, target: 'production', limit: '1', teamId: TEAM_ID }).toString();
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(8_000),
          });
          if (!res.ok) {
            this.logger.warn(`Vercel API respondió ${res.status} para ${p.label}`);
            return { project: p.id, label: p.label, deployedAt: null, state: 'error', url: null };
          }
          const data = (await res.json()) as VercelDeploymentsResponse;
          const dep = data.deployments[0];
          if (!dep) return { project: p.id, label: p.label, deployedAt: null, state: null, url: null };
          const at = dep.ready ?? dep.created;
          return {
            project: p.id,
            label: p.label,
            deployedAt: new Date(at).toISOString(),
            state: dep.readyState,
            url: dep.url ? `https://${dep.url}` : null,
          };
        } catch (err) {
          this.logger.warn(`Vercel API falló para ${p.label}: ${(err as Error).message}`);
          return { project: p.id, label: p.label, deployedAt: null, state: 'error', url: null };
        }
      }),
    );
  }
}
