import 'reflect-metadata';
import express from 'express';
import { resolve } from 'node:path';
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
  // The container is exposed only to the local Nginx proxy, which overwrites XFF.
  app.getHttpAdapter().getInstance().set('trust proxy',1);
  app.useGlobalFilters(new ProblemFilter());
  app.use('/admin', express.static(resolve(process.cwd(), 'admin-web'), {
    setHeaders(res) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    },
  }));
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
      .setVersion('0.17.0')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }
  return { app, env };
}
