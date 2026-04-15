import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ExpenseReport, ExpenseReportDocument } from './schemas/report.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { assertTransition } from './report-state-machine';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(ExpenseReport.name)
    private readonly reportModel: Model<ExpenseReportDocument>,
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
    await report.deleteOne();
  }

  async submit(id: string, userId: string): Promise<ExpenseReportDocument> {
    const report = await this.findOneOwned(id, userId);
    assertTransition(report.status, 'SUBMITTED');
    report.status = 'SUBMITTED';
    return report.save();
  }
}
