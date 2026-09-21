import { BadRequestException, Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiSettingsService } from './ai-settings.service';
import { updateAiSettingsSchema, updateProviderPreferenceSchema } from './dto/ai-settings.dto';
import { ProviderRegistry, AI_PROVIDER_IDS, type AiProviderId } from './provider-registry.service';

@UseGuards(JwtAuthGuard)
@Controller('cms/settings/ai')
export class AiSettingsController {
  constructor(
    private readonly settings: AiSettingsService,
    private readonly providers: ProviderRegistry,
  ) {}

  @Get()
  getStatus() {
    return this.settings.getStatus();
  }

  @Put()
  update(@Body() body: unknown) {
    const { openaiApiKey } = updateAiSettingsSchema.parse(body);
    return this.settings.setOpenAiApiKey(openaiApiKey);
  }

  @Put('preference')
  updatePreference(@Body() body: unknown) {
    const { preferredProvider, fallbackProvider } = updateProviderPreferenceSchema.parse(body);
    return this.settings.setProviderPreference(preferredProvider, fallbackProvider);
  }

  // Prueba real y bajo demanda (nunca automática — cada corrida gasta un
  // llamado real al proveedor) para que "Probar conexión" en Configuración
  // diga la verdad: si un botón de una regla real fallaría, este check
  // también debe fallar, no solo reportar "hay una key guardada".
  @Post('check/:provider')
  checkConnection(@Param('provider') provider: string) {
    if (!AI_PROVIDER_IDS.includes(provider as AiProviderId)) {
      throw new BadRequestException(`Proveedor desconocido: "${provider}"`);
    }
    return this.providers.get(provider as AiProviderId).checkConnection();
  }
}
