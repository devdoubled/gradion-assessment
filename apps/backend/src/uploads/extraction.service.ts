import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

export interface ExtractedFieldValue<T> {
  value: T | null;
  confidence: number | null;
}

export interface ExtractedFields {
  merchantName: ExtractedFieldValue<string>;
  amount: ExtractedFieldValue<number>;
  currency: ExtractedFieldValue<string>;
  transactionDate: ExtractedFieldValue<string>;
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
      merchantName: { value: null, confidence: null },
      amount: { value: null, confidence: null },
      currency: { value: null, confidence: null },
      transactionDate: { value: null, confidence: null },
    };

    try {
      const base64 = buffer.toString('base64');
      const isPdf = mimetype === 'application/pdf';

      type ImageMediaType =
        | 'image/jpeg'
        | 'image/png'
        | 'image/webp'
        | 'image/gif';
      const fileContent = isPdf
        ? {
            type: 'document' as const,
            source: {
              type: 'base64' as const,
              media_type: 'application/pdf' as const,
              data: base64,
            },
          }
        : {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: mimetype as ImageMediaType,
              data: base64,
            },
          };

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
                          "merchantName": { "value": "string or null", "confidence": 0.0 },
                          "amount": { "value": number or null, "confidence": 0.0 },
                          "currency": { "value": "ISO 4217 code e.g. USD or null", "confidence": 0.0 },
                          "transactionDate": { "value": "ISO 8601 date string or null", "confidence": 0.0 }
                        }
                      confidence is a number from 0.0 (not at all confident) to 1.0 (completely certain).
                      Use null for value if a field cannot be determined. Use a low confidence score for uncertain extractions.`,
              },
            ],
          },
        ],
      });

      const raw = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');

      // Strip markdown code fences if Claude wraps the JSON (e.g. ```json ... ```)
      const text = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      return JSON.parse(text) as ExtractedFields;
    } catch (err) {
      this.logger.error('Receipt extraction failed', err);
      return nullResult;
    }
  }
}
