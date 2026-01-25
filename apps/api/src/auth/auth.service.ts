import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import type { StringValue } from 'ms';

const TOKEN_ISSUER = 'clothes-stock';

@Injectable()
export class AuthService implements OnModuleInit {
  private adminEmail = '';
  private passwordHash = '';

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit() {
    const email = this.configService.get<string>('ADMIN_EMAIL');
    const password = this.configService.get<string>('ADMIN_PASSWORD');

    if (!email || !password) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
    }

    this.adminEmail = email;
    this.passwordHash = await bcrypt.hash(password, 10);
  }

  async validateAdmin(email: string, password: string) {
    if (email !== this.adminEmail) {
      return false;
    }

    return bcrypt.compare(password, this.passwordHash);
  }

  async login(email: string, password: string) {
    const isValid = await this.validateAdmin(email, password);

    if (!isValid) {
      throw new UnauthorizedException('账号或密码错误');
    }

    return this.issueTokens({ sub: 'admin', email });
  }

  async refresh(refreshToken: string) {
    const secret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new UnauthorizedException('缺少刷新密钥');
    }

    const payload = await this.jwtService.verifyAsync<{ sub: string; email: string }>(
      refreshToken,
      { secret },
    );

    return this.issueTokens({ sub: payload.sub, email: payload.email });
  }

  private async issueTokens(payload: { sub: string; email: string }) {
    const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');

    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT secrets are required.');
    }

    const accessExpiresIn =
      (this.configService.get<string>('JWT_ACCESS_EXPIRES') ??
        '15m') as StringValue;
    const refreshExpiresIn =
      (this.configService.get<string>('JWT_REFRESH_EXPIRES') ??
        '7d') as StringValue;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        issuer: TOKEN_ISSUER,
        secret: accessSecret,
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        issuer: TOKEN_ISSUER,
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
