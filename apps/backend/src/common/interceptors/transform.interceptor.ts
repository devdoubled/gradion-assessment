import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  RESPONSE_META_KEY,
  ResponseMeta,
} from '../decorators/response-meta.decorator';

const METHOD_META: Record<string, ResponseMeta> = {
  GET: { message: 'Fetch successfully', messageCode: '001' },
  POST: { message: 'Create successfully', messageCode: '002' },
  PATCH: { message: 'Update successfully', messageCode: '003' },
  PUT: { message: 'Update successfully', messageCode: '003' },
  DELETE: { message: 'Delete successfully', messageCode: '004' },
};

function stripPasswordHash(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripPasswordHash);
  if (obj && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      if (key === 'passwordHash') continue;
      result[key] = stripPasswordHash(record[key]);
    }
    return result;
  }
  return obj;
}

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();

    const meta = this.reflector.getAllAndOverride<ResponseMeta>(
      RESPONSE_META_KEY,
      [context.getHandler(), context.getClass()],
    ) ??
      METHOD_META[request.method] ?? { message: 'Success', messageCode: '000' };

    return next.handle().pipe(
      map((data: unknown) => {
        const doc = data as Record<string, unknown> | null;
        const cleaned =
          doc && typeof doc['toObject'] === 'function'
            ? stripPasswordHash((doc['toObject'] as () => unknown)())
            : stripPasswordHash(data);

        return {
          status: 'success',
          message: meta.message,
          messageCode: meta.messageCode,
          data: cleaned ?? null,
        };
      }),
    );
  }
}
