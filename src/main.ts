import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.enableCors({
    origin: [
      'http://localhost:3001', // Tu frontend web en Next.js
      'http://localhost:3000', // Por si haces pruebas locales cruzadas
      // 'https://vink-erp.tu-dominio.com', // <- Descomentarás esto en producción
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, // ⚠️ OBLIGATORIO: Permite que Next.js reciba y envíe la Cookie HttpOnly
  });

  app.setGlobalPrefix('api');
  
  // Activa la validación automática para todos los DTOs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  await app.listen(3000);
}
bootstrap();
