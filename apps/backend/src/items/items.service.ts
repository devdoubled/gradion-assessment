import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExpenseItem, ExpenseItemDocument } from './schemas/item.schema';
import {
  ExpenseReport,
  ExpenseReportDocument,
} from '../reports/schemas/report.schema';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItemsService {
  constructor(
    @InjectModel(ExpenseItem.name)
    private readonly itemModel: Model<ExpenseItemDocument>,
    @InjectModel(ExpenseReport.name)
    private readonly reportModel: Model<ExpenseReportDocument>,
  ) {}

  private async assertReportDraft(
    reportId: string,
    userId: string,
  ): Promise<ExpenseReportDocument> {
    const report = await this.reportModel
      .findOne({ _id: reportId, userId: new Types.ObjectId(userId) })
      .exec();
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== 'DRAFT') {
      throw new BadRequestException(
        'Items can only be modified on DRAFT reports',
      );
    }
    return report;
  }

  private async recomputeTotal(reportId: string): Promise<void> {
    const result = await this.itemModel
      .aggregate<{
        total: number;
      }>([
        { $match: { reportId: new Types.ObjectId(reportId) } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
      .exec();
    const total = result[0]?.total ?? 0;
    await this.reportModel
      .findByIdAndUpdate(reportId, { totalAmount: total })
      .exec();
  }

  async create(
    reportId: string,
    userId: string,
    dto: CreateItemDto,
  ): Promise<ExpenseItemDocument> {
    await this.assertReportDraft(reportId, userId);
    const item = await this.itemModel.create({
      ...dto,
      reportId: new Types.ObjectId(reportId),
      receiptUrl: null,
      aiExtracted: null,
    });
    await this.recomputeTotal(reportId);
    return item;
  }

  async findAll(
    reportId: string,
    userId: string,
  ): Promise<ExpenseItemDocument[]> {
    const report = await this.reportModel
      .findOne({ _id: reportId, userId: new Types.ObjectId(userId) })
      .exec();
    if (!report) throw new NotFoundException('Report not found');
    return this.itemModel
      .find({ reportId: new Types.ObjectId(reportId) })
      .sort({ createdAt: 1 })
      .exec();
  }

  async update(
    itemId: string,
    reportId: string,
    userId: string,
    dto: UpdateItemDto,
  ): Promise<ExpenseItemDocument> {
    await this.assertReportDraft(reportId, userId);
    const item = await this.itemModel
      .findOneAndUpdate(
        { _id: itemId, reportId: new Types.ObjectId(reportId) },
        dto,
        { new: true },
      )
      .exec();
    if (!item) throw new NotFoundException('Item not found');
    await this.recomputeTotal(reportId);
    return item;
  }

  async remove(
    itemId: string,
    reportId: string,
    userId: string,
  ): Promise<void> {
    await this.assertReportDraft(reportId, userId);
    const item = await this.itemModel
      .findOneAndDelete({ _id: itemId, reportId: new Types.ObjectId(reportId) })
      .exec();
    if (!item) throw new NotFoundException('Item not found');
    await this.recomputeTotal(reportId);
  }

  async attachReceipt(
    itemId: string,
    receiptUrl: string,
    aiExtracted: {
      merchantName: string | null;
      amount: number | null;
      currency: string | null;
      transactionDate: string | null;
    } | null,
  ): Promise<ExpenseItemDocument> {
    const item = await this.itemModel
      .findByIdAndUpdate(itemId, { receiptUrl, aiExtracted }, { new: true })
      .exec();
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }
}
