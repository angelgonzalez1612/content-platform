import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { CmsEventsController } from './cms-events.controller';
import { EventsService } from './events.service';

@Module({
  controllers: [EventsController, CmsEventsController],
  providers: [EventsService],
})
export class EventsModule {}
