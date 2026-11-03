import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { classifyProblem } from './problem.js';

@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const problem = classifyProblem(exception);
    if (!(exception instanceof HttpException)) {
      this.logger.error(`${request.method} ${request.path} failed: ${problem.code}`);
    }
    response.status(problem.status).json(problem);
  }
}
