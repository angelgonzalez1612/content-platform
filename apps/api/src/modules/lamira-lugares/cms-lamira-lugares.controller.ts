import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { LamiraLugaresService } from './lamira-lugares.service';
import { createLamiraLugarSchema, updateLamiraLugarSchema } from './dto/lamira-lugar.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cms/lamira/lugares')
export class CmsLamiraLugaresController {
  constructor(private readonly lugaresService: LamiraLugaresService) {}

  @Get()
  findAll() {
    return this.lugaresService.findAllForCms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lugaresService.findByIdForCms(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.lugaresService.create(createLamiraLugarSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.lugaresService.update(id, updateLamiraLugarSchema.parse(body));
  }
}
