import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import http from 'http';
import https from 'https';
import { AppModule } from './app.module';
import { readHttpsOptions, resolveHttpsFiles } from './setup/https.config';

/** 局域网地址：localhost、127.0.0.1、10.x、192.168.x、172.16-31.x */
const LAN_ORIGIN =
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})(:\d+)?$/i;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CLIENT_ORIGIN 支持逗号分隔的多个地址
  const allowList = (process.env.CLIENT_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // 手机、平板通过局域网 IP 访问时来源是 http://192.168.x.x:3000，
  // 默认放行局域网来源，避免每换一次 IP 都要改配置。
  const allowLan = process.env.ALLOW_LAN_ORIGINS !== 'false';

  app.use(cookieParser());
  app.enableCors({
    origin: (origin, callback) => {
      // 同源请求或非浏览器请求（如 curl）没有 Origin 头
      if (!origin) {
        return callback(null, true);
      }
      if (allowList.includes(origin) || (allowLan && LAN_ORIGIN.test(origin))) {
        return callback(null, true);
      }
      return callback(new Error(`不允许的来源: ${origin}`), false);
    },
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3001);
  const httpsPort = Number(process.env.HTTPS_PORT ?? 3444);
  const httpsFiles = resolveHttpsFiles();
  const httpsOptions = readHttpsOptions(httpsFiles);

  if (!httpsOptions) {
    await app.listen(port);
    console.log(`API (http)  http://localhost:${port}`);
    console.log(
      'HTTPS is off (no certificate found). Phone camera scanning needs HTTPS -',
      'run create-cert to enable it.',
    );
    return;
  }

  // http 和 https 共用同一个 Nest 应用实例，这样只有一份数据库连接。
  // http 不能关掉：手机在信任证书之前只能通过 http 下载证书。
  await app.init();
  const instance = app.getHttpAdapter().getInstance();

  http.createServer(instance).listen(port);
  https.createServer(httpsOptions, instance).listen(httpsPort);

  console.log(`API (http)   http://localhost:${port}`);
  console.log(`API (https)  https://localhost:${httpsPort}`);
}
bootstrap();
