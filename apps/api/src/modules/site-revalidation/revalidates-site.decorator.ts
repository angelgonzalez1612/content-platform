import { applyDecorators, CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata, UseInterceptors } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { SiteRevalidationService, type PublicSite } from './site-revalidation.service';

const REVALIDATES_SITE = 'revalidatesSite';

@Injectable()
export class SiteRevalidationInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly revalidation: SiteRevalidationService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const site = this.reflector.get<PublicSite | undefined>(REVALIDATES_SITE, context.getClass());
    const method = context.switchToHttp().getRequest<{ method: string }>().method;
    if (!site || method === 'GET') return next.handle();
    // Solo si la escritura salió bien (tap no corre si el handler lanza).
    return next.handle().pipe(tap(() => this.revalidation.trigger(site)));
  }
}

/** En un controlador del CMS: cada POST/PATCH/DELETE exitoso borra la caché del sitio público. */
export const RevalidatesSite = (site: PublicSite) => applyDecorators(SetMetadata(REVALIDATES_SITE, site), UseInterceptors(SiteRevalidationInterceptor));
