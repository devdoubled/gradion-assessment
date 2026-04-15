import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const message =
      typeof raw === 'object'
        ? ((raw as Record<string, unknown>).message ?? 'An error occurred')
        : raw;

    const normalizedMessage = Array.isArray(message)
      ? (message as string[]).join(', ')
      : typeof message === 'string'
        ? message
        : 'An error occurred';

    response.status(status).json({
      status: 'error',
      message: normalizedMessage,
      messageCode: `E${status}`,
      data: null,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
