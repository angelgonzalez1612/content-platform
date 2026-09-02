import { Controller, Get, Query } from '@nestjs/common';
import { CategoriesService } from './categories.service';

// Endpoint público (sin JwtAuthGuard, a diferencia de CmsCategoriesController)
// — La Mira y Planazo lo consumen directo para dejar de depender de un
// categories.json fijo en cada repo. Mismo servicio, misma data real.
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(@Query('site') site?: string) {
    return this.categoriesService.findAll(site);
  }
}
