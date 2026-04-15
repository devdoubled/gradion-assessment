import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface ExtractedFields {
  merchantName: string | null;
  amount: number | null;
  currency: string | null;
  transactionDate: string | null;
}

@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  private client: Anthropic;

  constructor(private readonly configService: ConfigService) {
    this.client = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  async extract(buffer: Buffer, mimetype: string): Promise<ExtractedFields> {
    const nullResult: ExtractedFields = {
      merchantName: null,
      amount: null,
      currency: null,
      transactionDate: null,
    };

    try {
      const base64 = buffer.toString('base64');
      const isPdf = mimetype === 'application/pdf';

      type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
      const fileContent = isPdf
        ? ({
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: base64,
            },
          })
        : ({
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: mimetype as ImageMediaType,
              data: base64,
            },
          });

      const response = await this.client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              fileContent,
              {
                type: 'text',
                text: `Extract the following fields from this receipt and return ONLY valid JSON with no markdown, no explanation, no extra text:
{
  "merchantName": "string or null",
  "amount": number or null,
  "currency": "ISO 4217 code e.g. USD or null",
  "transactionDate": "ISO 8601 date string or null"
}
If a field cannot be determined, use null.`,
              },
            ],
          },
        ],
      });

      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');

      return JSON.parse(text) as ExtractedFields;
    } catch (err) {
      this.logger.error('Receipt extraction failed', err);
      return nullResult;
    }
  }
}
