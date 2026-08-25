import { Module } from '@nestjs/common';
import { CmsCategoriesController } from './cms-categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  controllers: [CmsCategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
