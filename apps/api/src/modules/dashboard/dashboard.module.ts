import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { VercelDeploymentsService } from './vercel-deployments.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService, VercelDeploymentsService],
})
export class DashboardModule {}
