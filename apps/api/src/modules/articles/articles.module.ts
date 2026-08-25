import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { CmsArticlesController } from './cms-articles.controller';
import { ArticlesService } from './articles.service';

@Module({
  controllers: [ArticlesController, CmsArticlesController],
  providers: [ArticlesService],
})
export class ArticlesModule {}
