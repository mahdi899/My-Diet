import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    let status = 500;
    let code = 'internal';
    let messageFa = 'خطای داخلی رخ داد';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body && 'code' in body) {
        const record = body as { code?: unknown; messageFa?: unknown };
        code = String(record.code ?? code);
        if (typeof record.messageFa === 'string') messageFa = record.messageFa;
      } else if (status === 404) {
        code = 'not_found';
        messageFa = 'یافت نشد';
      } else if (status === 400) {
        code = 'validation';
        messageFa = 'اطلاعات واردشده ناقص یا نادرست است';
      }
    } else {
      this.logger.error(
        `${request.method} ${request.path} failed: ${
          exception instanceof Error ? exception.message : 'unknown'
        }`,
      );
    }

    response.status(status).json({ code, messageFa, status });
  }
}
