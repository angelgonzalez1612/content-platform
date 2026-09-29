import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type PublicSite = 'la-mira' | 'planazo';

const DEFAULT_URLS: Record<PublicSite, string> = {
  'la-mira': 'https://lamira.mx/api/revalidate',
  planazo: 'https://www.planazo.com.mx/api/revalidate',
};

const TIMEOUT_MS = 5_000;

/**
 * Avisa a los sitios públicos que borren su caché de la API cuando cambia el
 * contenido (crear, editar, publicar, despublicar, eliminar). Sin esto, una
 * pieza despublicada o eliminada seguía viéndose: Next solo reemplaza su
 * caché con respuestas 200, así que el 404 nuevo nunca pisaba la versión
 * vieja (visto con planazo.com.mx/lugares/ulises-lara, 2026-09-29).
 *
 * Fire-and-forget: si el sitio no responde, la edición igual se guarda (el
 * sitio vuelve a su revalidación normal de 60 s para lo que sí existe). Sin
 * SITES_REVALIDATE_SECRET configurado no hace nada.
 */
@Injectable()
export class SiteRevalidationService {
  private readonly logger = new Logger(SiteRevalidationService.name);
  private warnedMissingSecret = false;

  constructor(private readonly config: ConfigService) {}

  trigger(site: PublicSite): void {
    const secret = this.config.get<string>('SITES_REVALIDATE_SECRET');
    if (!secret) {
      if (!this.warnedMissingSecret) {
        this.logger.warn('SITES_REVALIDATE_SECRET no está configurado: los sitios no se enteran de los cambios hasta su revalidación normal.');
        this.warnedMissingSecret = true;
      }
      return;
    }
    const url =
      (site === 'la-mira' ? this.config.get<string>('LAMIRA_REVALIDATE_URL') : this.config.get<string>('PLANAZO_REVALIDATE_URL')) ??
      DEFAULT_URLS[site];

    void fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
      .then((res) => {
        if (!res.ok) this.logger.warn(`Revalidación de ${site} respondió ${res.status}`);
      })
      .catch((err: Error) => this.logger.warn(`No se pudo avisar a ${site} (${url}): ${err.message}`));
  }
}
