import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExpenseReport, ExpenseReportDocument } from './schemas/report.schema';
import { ExpenseItem, ExpenseItemDocument } from '../items/schemas/item.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { assertTransition } from './report-state-machine';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(ExpenseReport.name)
    private readonly reportModel: Model<ExpenseReportDocument>,
    @InjectModel(ExpenseItem.name)
    private readonly itemModel: Model<ExpenseItemDocument>,
  ) {}

  async create(
    userId: string,
    dto: CreateReportDto,
  ): Promise<ExpenseReportDocument> {
    const report = new this.reportModel({
      ...dto,
      userId: new Types.ObjectId(userId),
      status: 'DRAFT',
      totalAmount: 0,
      statusHistory: [
        {
          from: null,
          to: 'DRAFT',
          actorId: new Types.ObjectId(userId),
          actorRole: 'user',
          note: null,
          timestamp: new Date(),
        },
      ],
    });
    return report.save();
  }

  async findAll(
    userId: string,
    status?: string,
  ): Promise<ExpenseReportDocument[]> {
    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };
    if (status) filter.status = status;
    return this.reportModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async findOneOwned(
    id: string,
    userId: string,
  ): Promise<ExpenseReportDocument> {
    const report = await this.reportModel
      .findOne({ _id: id, userId: new Types.ObjectId(userId) })
      .exec();
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateReportDto,
  ): Promise<ExpenseReportDocument> {
    const report = await this.findOneOwned(id, userId);
    if (report.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT reports can be edited');
    }
    Object.assign(report, dto);
    return report.save();
  }

  async remove(id: string, userId: string): Promise<void> {
    const report = await this.findOneOwned(id, userId);
    if (report.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT reports can be deleted');
    }
    await this.itemModel.deleteMany({ reportId: report._id });
    await report.deleteOne();
  }

  async reopen(id: string, userId: string): Promise<ExpenseReportDocument> {
    const report = await this.findOneOwned(id, userId);
    assertTransition(report.status, 'DRAFT');
    report.statusHistory.push({
      from: report.status,
      to: 'DRAFT',
      actorId: new Types.ObjectId(userId),
      actorRole: 'user',
      note: null,
      timestamp: new Date(),
    } as never);
    report.status = 'DRAFT';
    return report.save();
  }

  async submit(id: string, userId: string): Promise<ExpenseReportDocument> {
    const report = await this.findOneOwned(id, userId);
    assertTransition(report.status, 'SUBMITTED');

    const itemCount = await this.itemModel.countDocuments({
      reportId: new Types.ObjectId(id),
    });
    if (itemCount === 0) {
      throw new BadRequestException(
        'Cannot submit a report with no expense items',
      );
    }

    report.statusHistory.push({
      from: report.status,
      to: 'SUBMITTED',
      actorId: new Types.ObjectId(userId),
      actorRole: 'user',
      note: null,
      timestamp: new Date(),
    } as never);
    report.status = 'SUBMITTED';
    return report.save();
  }
}
