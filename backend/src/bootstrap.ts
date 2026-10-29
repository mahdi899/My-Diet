import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { ProblemFilter } from './common/problem.filter.js';
import { loadEnv, type Env } from './config/env.js';

export async function createApp(): Promise<{
  app: INestApplication;
  env: Env;
}> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule.forRoot(), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new ProblemFilter());
  app.enableShutdownHooks();
  if (env.CORS_ORIGINS) {
    app.enableCors({
      origin: env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    });
  } else if (env.NODE_ENV !== 'production') {
    app.enableCors();
  }
  if (env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Sabzine')
      .setDescription('Sabzine HTTP API')
      .setVersion('0.4.0')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }
  return { app, env };
}
