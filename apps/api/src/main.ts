import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const clientOrigin = process.env.CLIENT_ORIGIN ?? 'http://localhost:3000';

  app.use(cookieParser());
  app.enableCors({
    origin: clientOrigin,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
