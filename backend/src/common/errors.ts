import { HttpException } from '@nestjs/common';

export class ApiError extends HttpException {
  constructor(status: number, code: string, messageFa: string) {
    super({ code, messageFa }, status);
  }
}

export function errorBody(error: ApiError): { code: string; messageFa: string } {
  return error.getResponse() as { code: string; messageFa: string };
}
