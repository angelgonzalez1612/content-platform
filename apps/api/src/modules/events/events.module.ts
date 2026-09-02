import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { CmsEventsController } from './cms-events.controller';
import { EventsService } from './events.service';

@Module({
  controllers: [EventsController, CmsEventsController],
  providers: [EventsService],
  exports: [EventsService], // AutomationModule lo usa para crear eventos solo
})
export class EventsModule {}
