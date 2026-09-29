import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { updateEventSchema } from './dto/update-event.dto';
import { createEventSchema } from './dto/create-event.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithSession } from '../auth/jwt-auth.guard';
import { assertAdmin } from '../auth/assert-admin';
import { RevalidatesSite } from '../site-revalidation/revalidates-site.decorator';

@UseGuards(JwtAuthGuard)
@RevalidatesSite('planazo')
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

  // Eliminar es solo para administradores (no hay papelera: queda una copia en
  // el historial de versiones, ver events.service.ts).
  @Delete(':id')
  remove(@Req() req: RequestWithSession, @Param('id') id: string) {
    assertAdmin(req);
    return this.eventsService.remove(id);
  }
}
