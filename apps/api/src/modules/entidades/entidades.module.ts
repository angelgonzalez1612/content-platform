import { Module } from '@nestjs/common';
import { EntidadesController } from './entidades.controller';
import { GoogleTrendsService } from './google-trends.service';

@Module({
  controllers: [EntidadesController],
  providers: [GoogleTrendsService],
})
export class EntidadesModule {}
