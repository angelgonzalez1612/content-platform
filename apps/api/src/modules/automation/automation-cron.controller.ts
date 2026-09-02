import { Controller, ForbiddenException, Get, Headers } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AutomationRunnerService } from './automation-runner.service';

// Disparador externo para Vercel Cron (ver vercel.json) — reemplaza el
// @Interval en memoria de AutomationRunnerService, que en un serverless
// function no sirve (el proceso no queda vivo entre invocaciones, así que
// un setInterval registrado nunca llega a dispararse solo). Vercel llama
// este endpoint cada 15 min con un header Authorization: Bearer <CRON_SECRET>
// automático — sin CRON_SECRET configurado, este endpoint rechaza todo.
@Controller('cron')
export class AutomationCronController {
  constructor(
    private readonly runner: AutomationRunnerService,
    private readonly config: ConfigService,
  ) {}

  @Get('automation')
  async run(@Headers('authorization') authorization?: string) {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret || authorization !== `Bearer ${secret}`) {
      throw new ForbiddenException();
    }
    return this.runner.run();
  }
}
