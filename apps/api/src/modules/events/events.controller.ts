import { Controller, Get, Param, Query } from '@nestjs/common';
import { EventsService } from './events.service';
import { queryEventsSchema } from './dto/query-events.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll(@Query() query: Record<string, unknown>) {
    return this.eventsService.findAll(queryEventsSchema.parse(query));
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.eventsService.findBySlug(slug);
  }
}
