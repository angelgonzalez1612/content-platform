import { Module } from '@nestjs/common';
import { AdsensePlanController } from './adsense-plan.controller';
import { AdsensePlanService } from './adsense-plan.service';
import { SearchConsoleController } from './search-console.controller';
import { SearchConsoleService } from './search-console.service';

@Module({
  controllers: [SearchConsoleController, AdsensePlanController],
  providers: [SearchConsoleService, AdsensePlanService],
})
export class SearchConsoleModule {}
