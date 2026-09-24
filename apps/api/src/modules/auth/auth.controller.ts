import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { loginSchema } from './dto/login.dto';
import { JwtAuthGuard, type RequestWithSession } from './jwt-auth.guard';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_MAX_AGE_MS } from './jwt';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const dto = loginSchema.parse(body);
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])?.trim() || req.ip || 'unknown';
    const { token, user } = await this.authService.login(dto, clientIp);

    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get<string>('NODE_ENV') === 'production',
      maxAge: SESSION_COOKIE_MAX_AGE_MS,
      path: '/',
    });

    return { user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: RequestWithSession) {
    const user = await this.authService.findById(req.session!.sub);
    return { user };
  }
}
