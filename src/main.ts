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

  const origins = process.env.CORS_ORIGINS.split(',').map((o) => o.trim()) || [
    '*',
  ];

  app.enableCors({
    origin: origins.includes('*') ? true : origins,
    credentials: true,
    methods: '*',
    allowedHeaders: '*',
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
