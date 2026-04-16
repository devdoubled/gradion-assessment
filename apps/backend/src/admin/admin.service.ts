import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ExpenseReport,
  ExpenseReportDocument,
} from '../reports/schemas/report.schema';
import { assertTransition } from '../reports/report-state-machine';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(ExpenseReport.name)
    private readonly reportModel: Model<ExpenseReportDocument>,
  ) {}

  async findAll(status?: string): Promise<ExpenseReportDocument[]> {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    return this.reportModel
      .find(filter)
      .populate('userId', 'email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(reportId: string): Promise<ExpenseReportDocument> {
    const report = await this.reportModel
      .findById(reportId)
      .populate('userId', 'email')
      .exec();
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async approve(
    reportId: string,
    adminId: string,
  ): Promise<ExpenseReportDocument> {
    const report = await this.reportModel.findById(reportId).exec();
    if (!report) throw new NotFoundException('Report not found');
    assertTransition(report.status, 'APPROVED');
    report.statusHistory.push({
      from: report.status,
      to: 'APPROVED',
      actorId: new Types.ObjectId(adminId),
      actorRole: 'admin',
      note: null,
      timestamp: new Date(),
    } as never);
    report.status = 'APPROVED';
    return report.save();
  }

  async reject(
    reportId: string,
    adminId: string,
    note?: string,
  ): Promise<ExpenseReportDocument> {
    const report = await this.reportModel.findById(reportId).exec();
    if (!report) throw new NotFoundException('Report not found');
    assertTransition(report.status, 'REJECTED');
    report.statusHistory.push({
      from: report.status,
      to: 'REJECTED',
      actorId: new Types.ObjectId(adminId),
      actorRole: 'admin',
      note: note ?? null,
      timestamp: new Date(),
    } as never);
    report.status = 'REJECTED';
    return report.save();
  }
}
