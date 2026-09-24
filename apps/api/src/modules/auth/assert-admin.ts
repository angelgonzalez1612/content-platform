import { ForbiddenException } from '@nestjs/common';
import type { RequestWithSession } from './jwt-auth.guard';

export function assertAdmin(req: RequestWithSession): void {
  if (req.session?.role !== 'admin') {
    throw new ForbiddenException('Solo un administrador puede hacer esto.');
  }
}
