import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import type { LoginDto } from './auth.dto';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from './auth.constants';
import { Public } from './public.decorator';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { email, password } = body;

    if (!email || !password) {
      throw new UnauthorizedException('请输入账号和密码');
    }

    const tokens = await this.authService.login(email, password);
    this.setAuthCookies(res, tokens);

    return { email };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE];

    if (!refreshToken) {
      throw new UnauthorizedException('缺少刷新令牌');
    }

    const tokens = await this.authService.refresh(refreshToken);
    this.setAuthCookies(res, tokens);

    return { ok: true };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE);
    res.clearCookie(REFRESH_TOKEN_COOKIE);

    return { ok: true };
  }

  private setAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    const accessMaxAge = 10 * 60 * 60 * 1000;
    // secure=true 的 Cookie 只能通过 https 下发，
    // 局域网内用 http://192.168.x.x 访问时会导致「账号密码正确却登录不上」，
    // 所以默认关闭，只有明确配置 COOKIE_SECURE=true（走 https）时才开启。
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: process.env.COOKIE_SECURE === 'true',
      path: '/',
    };

    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      ...cookieOptions,
      maxAge: accessMaxAge,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, cookieOptions);
  }
}
