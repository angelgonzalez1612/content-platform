import { Module } from '@nestjs/common';
import { AutomationController } from './automation.controller';
import { AutomationCronController } from './automation-cron.controller';
import { AutomationRulesService } from './automation-rules.service';
import { AutomationRunnerService } from './automation-runner.service';
import { AiModule } from '../ai/ai.module';
import { CategoriesModule } from '../categories/categories.module';
import { ContentRadarPublishedModule } from '../content-radar-published/content-radar-published.module';
import { PlacesModule } from '../places/places.module';
import { EventsModule } from '../events/events.module';
import { NoticiasModule } from '../lamira-noticias/noticias.module';
import { AlertasModule } from '../lamira-alertas/alertas.module';
import { ReportajesModule } from '../lamira-reportajes/reportajes.module';

@Module({
  imports: [AiModule, CategoriesModule, ContentRadarPublishedModule, PlacesModule, EventsModule, NoticiasModule, AlertasModule, ReportajesModule],
  controllers: [AutomationController, AutomationCronController],
  providers: [AutomationRulesService, AutomationRunnerService],
})
export class AutomationModule {}
