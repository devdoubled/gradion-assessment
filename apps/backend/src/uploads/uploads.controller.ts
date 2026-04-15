import {
  Controller,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UploadsService } from './uploads.service';
import { ExtractionService } from './extraction.service';
import { ItemsService } from '../items/items.service';
import { ExpenseItemDocument } from '../items/schemas/item.schema';

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('items')
export class UploadsController {
  constructor(
    private readonly uploadsService: UploadsService,
    private readonly extractionService: ExtractionService,
    private readonly itemsService: ItemsService,
  ) {}

  @Post(':itemId/receipt')
  @ApiOperation({ summary: 'Upload a receipt image/PDF and extract fields' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'image/jpeg',
          'image/png',
          'image/webp',
          'application/pdf',
        ];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Only JPEG, PNG, WEBP, and PDF files are allowed',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadReceipt(
    @Param('itemId') itemId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ExpenseItemDocument> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const key = await this.uploadsService.upload(
      file.buffer,
      file.mimetype,
      file.originalname,
    );
    const receiptUrl = this.uploadsService.getUrl(key);

    const aiExtracted = await this.extractionService.extract(
      file.buffer,
      file.mimetype,
    );

    return this.itemsService.attachReceipt(itemId, receiptUrl, aiExtracted);
  }
}
