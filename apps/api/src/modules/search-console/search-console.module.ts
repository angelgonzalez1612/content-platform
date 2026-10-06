import { Module } from '@nestjs/common';
import { SearchConsoleController } from './search-console.controller';
import { SearchConsoleService } from './search-console.service';

@Module({
  controllers: [SearchConsoleController],
  providers: [SearchConsoleService],
})
export class SearchConsoleModule {}
