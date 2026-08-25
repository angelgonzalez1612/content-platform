import { Module } from '@nestjs/common';
import { ReportajesController } from './reportajes.controller';
import { CmsReportajesController } from './cms-reportajes.controller';
import { ReportajesService } from './reportajes.service';

@Module({
  controllers: [ReportajesController, CmsReportajesController],
  providers: [ReportajesService],
})
export class ReportajesModule {}
