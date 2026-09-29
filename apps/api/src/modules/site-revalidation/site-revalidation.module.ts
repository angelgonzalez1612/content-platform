import { Global, Module } from '@nestjs/common';
import { SiteRevalidationService } from './site-revalidation.service';

// Global: la usan los 9 controladores de contenido del CMS sin tener que
// importarla módulo por módulo.
@Global()
@Module({
  providers: [SiteRevalidationService],
  exports: [SiteRevalidationService],
})
export class SiteRevalidationModule {}
