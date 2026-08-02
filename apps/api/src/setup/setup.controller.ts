import { Controller, Get, NotFoundException, Res } from '@nestjs/common';
import type { Response } from 'express';
import forge from 'node-forge';
import fs from 'fs';
import { Public } from '../auth/public.decorator';
import { resolveHttpsFiles } from './https.config';

/**
 * 证书安装引导用的公开接口。
 *
 * 必须是公开的：手机在信任证书之前还没登录，也只能用 http 访问，
 * 所以下载地址不能要求登录、也不能只在 https 上提供。
 */
@Public()
@Controller('setup')
export class SetupController {
  @Get('ca.crt')
  downloadCa(@Res() res: Response) {
    const files = resolveHttpsFiles();
    if (!fs.existsSync(files.caPath)) {
      throw new NotFoundException(
        '还没有生成证书，请先在电脑上运行 create-cert 脚本',
      );
    }

    const body = fs.readFileSync(files.caPath);
    // iOS 靠这个 MIME 类型触发「安装描述文件」流程
    res.setHeader('Content-Type', 'application/x-x509-ca-cert');
    res.setHeader('Content-Disposition', 'attachment; filename="clothes-ca.crt"');
    res.send(body);
  }

  @Get('status')
  status() {
    const files = resolveHttpsFiles();
    const httpsPort = Number(process.env.HTTPS_PORT ?? 3444);
    const webHttpsPort = Number(process.env.WEB_HTTPS_PORT ?? 3443);

    if (!files.available || !fs.existsSync(files.caPath)) {
      return {
        certificateReady: false,
        httpsPort,
        webHttpsPort,
        hosts: [] as string[],
        expiresAt: null as string | null,
      };
    }

    let hosts: string[] = [];
    let expiresAt: string | null = null;

    try {
      const cert = forge.pki.certificateFromPem(
        fs.readFileSync(files.certPath, 'utf8'),
      );
      expiresAt = cert.validity.notAfter.toISOString();
      const altName = cert.extensions.find(
        (item: { name?: string }) => item.name === 'subjectAltName',
      ) as { altNames?: Array<{ type: number; value?: string; ip?: string }> };
      hosts = (altName?.altNames ?? [])
        .map((item) => (item.type === 7 ? item.ip : item.value))
        .filter((value): value is string => Boolean(value));
    } catch {
      // 证书解析失败时只返回基本信息，不影响页面显示
    }

    return {
      certificateReady: true,
      httpsPort,
      webHttpsPort,
      hosts,
      expiresAt,
    };
  }
}
