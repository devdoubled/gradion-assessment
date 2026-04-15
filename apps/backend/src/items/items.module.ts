import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { ExpenseItem, ExpenseItemSchema } from './schemas/item.schema';
import {
  ExpenseReport,
  ExpenseReportSchema,
} from '../reports/schemas/report.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExpenseItem.name, schema: ExpenseItemSchema },
      { name: ExpenseReport.name, schema: ExpenseReportSchema },
    ]),
  ],
  controllers: [ItemsController],
  providers: [ItemsService],
  exports: [ItemsService],
})
export class ItemsModule {}
