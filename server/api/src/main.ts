import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './filters/http-exception.filter';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });
  
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
  }));

  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.setGlobalPrefix('api');

  const port = process.env.SERVER_PORT || 3000;
  await app.listen(port);
  
  const url = await app.getUrl();
  logger.log(`🚀 Server ready at ${url}`);
  logger.log(`📊 API: ${url}/api`);
  logger.log(`🌐 Web: ${url.replace(':3000', ':8080')}`);
}

bootstrap();