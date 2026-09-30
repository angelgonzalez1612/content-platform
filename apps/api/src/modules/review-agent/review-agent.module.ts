import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { NoticiasModule } from '../lamira-noticias/noticias.module';
import { ReportajesModule } from '../lamira-reportajes/reportajes.module';
import { GuiasModule } from '../lamira-guias/guias.module';
import { PlacesModule } from '../places/places.module';
import { EventsModule } from '../events/events.module';
import { PlanazoGuidesModule } from '../planazo-guides/guides.module';
import { ReviewAgentController } from './review-agent.controller';
import { ReviewAgentService } from './review-agent.service';

@Module({
  imports: [AiModule, NoticiasModule, ReportajesModule, GuiasModule, PlacesModule, EventsModule, PlanazoGuidesModule],
  controllers: [ReviewAgentController],
  providers: [ReviewAgentService],
})
export class ReviewAgentModule {}
