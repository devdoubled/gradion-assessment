import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        const doc = data as Record<string, unknown> | null;
        if (doc && typeof doc['toObject'] === 'function') {
          return stripPasswordHash((doc['toObject'] as () => unknown)());
        }
        return stripPasswordHash(data);
      }),
    );
  }
}
