import { SetMetadata } from '@nestjs/common';

export const RESPONSE_META_KEY = 'responseMeta';

export interface ResponseMeta {
  message: string;
  messageCode: string;
}

export const ResponseMeta = (message: string, messageCode: string) =>
  SetMetadata(RESPONSE_META_KEY, {
    message,
    messageCode,
  } satisfies ResponseMeta);
