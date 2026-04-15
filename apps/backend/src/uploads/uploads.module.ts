import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { ExtractionService } from './extraction.service';
import { ItemsModule } from '../items/items.module';

@Module({
  imports: [ItemsModule],
  controllers: [UploadsController],
  providers: [UploadsService, ExtractionService],
})
export class UploadsModule {}
