import 'reflect-metadata';
import express from 'express';
import { existsSync } from 'node:fs';
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
    bodyParser: false,
  });
  // Photo messages are JSON base64, same ceiling as care-media uploads (~1.5MB decoded).
  app.use(express.json({ limit: '3mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.useLogger(app.get(Logger));
  // The container is exposed only to the local Nginx proxy, which overwrites XFF.
  app.getHttpAdapter().getInstance().set('trust proxy',1);
  app.useGlobalFilters(new ProblemFilter());
  const bundledAdmin = resolve(process.cwd(), 'admin-web');
  const adminDir = existsSync(bundledAdmin) ? bundledAdmin : resolve(process.cwd(), '..', 'admin');
  const bundledDoctor = resolve(process.cwd(), 'doctor-web');
  const doctorDir = existsSync(bundledDoctor) ? bundledDoctor : resolve(process.cwd(), '..', 'doctor');
  const staffStatic = {
    setHeaders(res: express.Response) {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; img-src 'self' blob: data:; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      );
    },
  };
  const doctorIndex = resolve(doctorDir, 'index.html');
  const http = app.getHttpAdapter().getInstance();
  const sendDoctorIndex = (_req: express.Request, res: express.Response) => {
    staffStatic.setHeaders(res);
    res.sendFile(doctorIndex, (err) => {
      if (err && !res.headersSent) res.status(500).end();
    });
  };
  http.get('/doctor/', sendDoctorIndex);
  http.get('/doctor', (_req: express.Request, res: express.Response) => res.redirect(302, '/doctor/'));
  http.use('/admin', express.static(adminDir, staffStatic));
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
