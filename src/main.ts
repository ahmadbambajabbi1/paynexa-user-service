import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  app.enableCors({
    origin:
      !corsOrigin || corsOrigin === '*'
        ? true
        : corsOrigin.split(',').map((s) => s.trim()),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: true,
    }),
  );
  await app.listen(process.env.PORT ?? 5001, '::');
}
bootstrap();
