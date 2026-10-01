import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { ProviderQuotaExceededError } from '../modules/ai/provider-health';

const LABEL: Record<string, string> = { 'codex-cli': 'Codex', 'claude-cli': 'Claude', openai: 'OpenAI' };

// Sin esto, un proveedor de IA sin tokens/uso (ProviderQuotaExceededError,
// ver provider-health.ts) llegaba al CMS como un 500 "Internal server error"
// en cualquier pantalla de IA. Se responde 429 con un mensaje que dice qué
// proveedor se quedó sin uso y, si el CLI lo informa, hasta cuándo.
@Catch(ProviderQuotaExceededError)
export class ProviderQuotaFilter implements ExceptionFilter {
  catch(exception: ProviderQuotaExceededError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const name = LABEL[exception.provider] ?? exception.provider;
    const until = exception.message.match(/try again at ([^.\n]+)/i)?.[1]?.trim();
    response.status(429).json({
      statusCode: 429,
      error: 'Too Many Requests',
      provider: exception.provider,
      message: `${name} se quedó sin uso disponible${until ? ` (se libera: ${until})` : ''}. Elige otro proveedor de IA o vuelve a intentar más tarde.`,
    });
  }
}
