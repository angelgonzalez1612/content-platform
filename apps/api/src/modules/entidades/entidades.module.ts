import { Module } from '@nestjs/common';
import { EntidadesController } from './entidades.controller';
import { GoogleTrendsService } from './google-trends.service';
import { LocalSearchService } from './local-search.service';
import { WebSearchModule } from '../automation/web-search.module';

@Module({
  imports: [WebSearchModule],
  controllers: [EntidadesController],
  providers: [GoogleTrendsService, LocalSearchService],
})
export class EntidadesModule {}
