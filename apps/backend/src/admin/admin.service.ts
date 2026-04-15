import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExpenseReport, ExpenseReportDocument } from '../reports/schemas/report.schema';
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

  async approve(reportId: string): Promise<ExpenseReportDocument> {
    const report = await this.reportModel.findById(reportId).exec();
    if (!report) throw new NotFoundException('Report not found');
    assertTransition(report.status, 'APPROVED');
    report.status = 'APPROVED';
    return report.save();
  }

  async reject(reportId: string): Promise<ExpenseReportDocument> {
    const report = await this.reportModel.findById(reportId).exec();
    if (!report) throw new NotFoundException('Report not found');
    assertTransition(report.status, 'REJECTED');
    report.status = 'REJECTED';
    return report.save();
  }
}
