import { Module } from '@nestjs/common';
import { PlacesModule } from '../places/places.module';
import { EventsModule } from '../events/events.module';
import { NoticiasModule } from '../lamira-noticias/noticias.module';
import { ReportajesModule } from '../lamira-reportajes/reportajes.module';
import { AlertasModule } from '../lamira-alertas/alertas.module';
import { TransferController } from './transfer.controller';

// Mover piezas entre sitios (hoy: Planazo -> La Mira).
@Module({
  imports: [PlacesModule, EventsModule, NoticiasModule, ReportajesModule, AlertasModule],
  controllers: [TransferController],
})
export class TransferModule {}
