import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  // CORS_ORIGINS is a comma-separated list, or "*". Unset means no cross-origin access.
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: origins.includes('*') ? true : origins.length > 0 ? origins : false,
    credentials: true,
    methods: '*',
    allowedHeaders: '*',
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
