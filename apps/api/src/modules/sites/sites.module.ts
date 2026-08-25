import { Global, Module } from '@nestjs/common';
import { SitesService } from './sites.service';

@Global()
@Module({
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
