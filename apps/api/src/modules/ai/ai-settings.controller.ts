import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiSettingsService } from './ai-settings.service';
import { updateAiSettingsSchema } from './dto/ai-settings.dto';

@UseGuards(JwtAuthGuard)
@Controller('cms/settings/ai')
export class AiSettingsController {
  constructor(private readonly settings: AiSettingsService) {}

  @Get()
  getStatus() {
    return this.settings.getStatus();
  }

  @Put()
  update(@Body() body: unknown) {
    const { openaiApiKey } = updateAiSettingsSchema.parse(body);
    return this.settings.setOpenAiApiKey(openaiApiKey);
  }
}
