import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // En Render la app está detrás de un proxy: así req.ip es la IP real de cada persona
  // (si no, el límite de intentos contaría a todos como una sola IP)
  app.set('trust proxy', 1);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`Rifa corriendo en http://localhost:${port}`);
}

bootstrap();
