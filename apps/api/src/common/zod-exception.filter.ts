import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

// Sin esto, un `schema.parse(body)` que falla (ej. "Ubicación" vacía al crear
// un evento) tiraba una excepción sin capturar — NestJS la convertía en un
// 500 genérico ("Internal server error"), sin decir qué campo falló. El CMS
// solo podía mostrar su propio mensaje de respaldo ("revisa que los campos
// requeridos estén llenos"), sin apuntar a cuál. Este filtro arma un mensaje
// legible con los campos reales.
@Catch(ZodError)
export class ZodExceptionFilter implements ExceptionFilter {
  catch(exception: ZodError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    const details = exception.issues.map((issue) => {
      const field = issue.path.length ? issue.path.join('.') : '(raíz)';
      // El mensaje default de Zod para "campo vacío" (string mínimo 1
      // carácter, el caso más común de un "requerido" en este proyecto) es
      // técnico ("Too small: expected string to have >=1 characters") — no
      // ayuda a un editor sin contexto de Zod. "Requerido" sí dice qué hacer.
      const isEmptyRequired = issue.code === 'too_small' && 'minimum' in issue && issue.minimum === 1;
      const message = isEmptyRequired ? 'requerido' : issue.message;
      return `${field} (${message})`;
    });

    response.status(400).json({
      statusCode: 400,
      error: 'Bad Request',
      message: `Faltan datos o hay campos inválidos — ${details.join('; ')}.`,
      fields: details,
    });
  }
}
