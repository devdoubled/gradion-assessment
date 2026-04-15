import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { randomUUID } from 'crypto';
import * as path from 'path';

@Injectable()
export class UploadsService implements OnModuleInit {
  private client: Minio.Client;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'receipts');
    this.client = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.configService.get<string>('MINIO_PORT', '9000'), 10),
      useSSL: this.configService.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', ''),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', ''),
    });

    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  async upload(
    buffer: Buffer,
    mimetype: string,
    originalname: string,
  ): Promise<string> {
    const ext = path.extname(originalname);
    const key = `receipts/${randomUUID()}${ext}`;
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimetype,
    });
    return key;
  }

  getUrl(key: string): string {
    const endpoint = this.configService.get<string>(
      'MINIO_ENDPOINT',
      'localhost',
    );
    const port = this.configService.get<string>('MINIO_PORT', '9000');
    return `http://${endpoint}:${port}/${this.bucket}/${key}`;
  }
}
