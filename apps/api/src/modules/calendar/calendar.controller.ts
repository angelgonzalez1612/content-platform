import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CalendarService } from './calendar.service';

@UseGuards(JwtAuthGuard)
@Controller('cms/calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get()
  getMonth(@Query('year') yearRaw: string, @Query('month') monthRaw: string) {
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new BadRequestException('"year" y "month" (1-12) son requeridos.');
    }
    return this.calendar.getMonth(year, month);
  }
}
