import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { updateEventSchema } from './dto/update-event.dto';
import { createEventSchema } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cms/events')
export class CmsEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  findAll() {
    return this.eventsService.findAllForCms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findByIdForCms(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.eventsService.create(createEventSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.eventsService.update(id, updateEventSchema.parse(body));
  }
}
