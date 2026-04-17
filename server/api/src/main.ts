import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  app.enableCors();

  app.setGlobalPrefix('api');

  const port = process.env.SERVER_PORT || 3000;
  await app.listen(port);
  
  console.log(`UPS Server running on port ${port}`);
}

bootstrap();