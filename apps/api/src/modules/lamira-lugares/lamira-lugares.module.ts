import { Module } from '@nestjs/common';
import { LamiraLugaresController } from './lamira-lugares.controller';
import { CmsLamiraLugaresController } from './cms-lamira-lugares.controller';
import { LamiraLugaresService } from './lamira-lugares.service';

@Module({
  controllers: [LamiraLugaresController, CmsLamiraLugaresController],
  providers: [LamiraLugaresService],
})
export class LamiraLugaresModule {}
