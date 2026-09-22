import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { validateEnv } from './config/env';
import { DbModule } from './db/db.module';
import { SitesModule } from './modules/sites/sites.module';
import { PlacesModule } from './modules/places/places.module';
import { EventsModule } from './modules/events/events.module';
import { PlanazoGuidesModule } from './modules/planazo-guides/guides.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ContentRadarPublishedModule } from './modules/content-radar-published/content-radar-published.module';
import { NoticiasModule } from './modules/lamira-noticias/noticias.module';
import { AlertasModule } from './modules/lamira-alertas/alertas.module';
import { GuiasModule } from './modules/lamira-guias/guias.module';
import { LamiraEventosModule } from './modules/lamira-eventos/lamira-eventos.module';
import { LamiraLugaresModule } from './modules/lamira-lugares/lamira-lugares.module';
import { ReportajesModule } from './modules/lamira-reportajes/reportajes.module';
import { AuthModule } from './modules/auth/auth.module';
import { AiModule } from './modules/ai/ai.module';
import { AutomationModule } from './modules/automation/automation.module';
import { ContentVersionsModule } from './modules/content-versions/content-versions.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { MediaModule } from './modules/media/media.module';
import { UsersModule } from './modules/users/users.module';
import { EntidadesModule } from './modules/entidades/entidades.module';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ScheduleModule.forRoot(),
    DbModule,
    SitesModule,
    PlacesModule,
    EventsModule,
    PlanazoGuidesModule,
    ArticlesModule,
    CategoriesModule,
    LocationsModule,
    ContentRadarPublishedModule,
    NoticiasModule,
    AlertasModule,
    GuiasModule,
    LamiraEventosModule,
    LamiraLugaresModule,
    ReportajesModule,
    AuthModule,
    AiModule,
    AutomationModule,
    ContentVersionsModule,
    DashboardModule,
    CalendarModule,
    MediaModule,
    UsersModule,
    EntidadesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
