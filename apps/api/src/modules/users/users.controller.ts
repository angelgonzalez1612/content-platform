import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type RequestWithSession } from '../auth/jwt-auth.guard';
import { assertAdmin } from '../auth/assert-admin';
import { UsersService } from './users.service';
import { createUserSchema, resetPasswordSchema, updateUserSchema } from './dto/user.dto';

// Cualquier sesión válida puede ver el listado (es el "quién es quién" del
// equipo, no información sensible) — solo crear/editar/eliminar requiere
// rol admin. Sin un RolesGuard reusable todavía en el proyecto (ningún otro
// endpoint lo necesitó hasta ahora), el check va inline aquí en vez de
// construir esa abstracción para un solo consumidor.
@UseGuards(JwtAuthGuard)
@Controller('cms/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Req() req: RequestWithSession, @Body() body: unknown) {
    assertAdmin(req);
    return this.users.create(createUserSchema.parse(body));
  }

  @Patch(':id')
  update(@Req() req: RequestWithSession, @Param('id') id: string, @Body() body: unknown) {
    assertAdmin(req);
    return this.users.update(id, updateUserSchema.parse(body));
  }

  @Patch(':id/password')
  async resetPassword(@Req() req: RequestWithSession, @Param('id') id: string, @Body() body: unknown) {
    assertAdmin(req);
    await this.users.resetPassword(id, resetPasswordSchema.parse(body));
    return { ok: true };
  }

  @Delete(':id')
  async remove(@Req() req: RequestWithSession, @Param('id') id: string) {
    assertAdmin(req);
    await this.users.remove(id, req.session!.sub);
    return { ok: true };
  }
}
