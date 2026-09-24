import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type RequestWithSession } from '../auth/jwt-auth.guard';
import { assertAdmin } from '../auth/assert-admin';
import { DashboardService } from './dashboard.service';
import { VercelDeploymentsService } from './vercel-deployments.service';

@UseGuards(JwtAuthGuard)
@Controller('cms/dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly vercelDeployments: VercelDeploymentsService,
  ) {}

  @Get('stats')
  getStats() {
    return this.dashboard.getStats();
  }

  @Get('deploys')
  getDeploys() {
    return this.vercelDeployments.getLastDeploys();
  }

  @Post('deploys/:project')
  triggerDeploy(@Req() req: RequestWithSession, @Param('project') project: string) {
    assertAdmin(req);
    return this.vercelDeployments.triggerDeploy(project);
  }
}
