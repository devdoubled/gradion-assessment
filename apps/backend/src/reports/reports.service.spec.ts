import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ReportsService } from './reports.service';
import { ExpenseReport } from './schemas/report.schema';
import { ExpenseItem } from '../items/schemas/item.schema';

const userId = new Types.ObjectId().toString();
const reportId = new Types.ObjectId().toString();

function makeReport(status: string, history: unknown[] = []) {
  return {
    _id: reportId,
    userId: new Types.ObjectId(userId),
    status,
    totalAmount: 100,
    statusHistory: [...history],
    save: jest.fn().mockImplementation(function (this: { status: string; statusHistory: unknown[] }) {
      return Promise.resolve(this);
    }),
  };
}

describe('ReportsService — statusHistory', () => {
  let service: ReportsService;
  let mockReportModel: Record<string, jest.Mock>;
  let mockItemModel: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockReportModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    mockItemModel = {
      countDocuments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getModelToken(ExpenseReport.name),
          useValue: mockReportModel,
        },
        {
          provide: getModelToken(ExpenseItem.name),
          useValue: mockItemModel,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  const mockExec = (value: unknown) => ({
    exec: jest.fn().mockResolvedValue(value),
  });

  describe('submit()', () => {
    it('appends DRAFT→SUBMITTED history entry', async () => {
      const report = makeReport('DRAFT', [
        { from: null, to: 'DRAFT', actorRole: 'user', note: null },
      ]);
      mockReportModel.findOne.mockReturnValue(mockExec(report));
      mockItemModel.countDocuments.mockResolvedValue(2);

      await service.submit(reportId, userId);

      const lastEntry = report.statusHistory[report.statusHistory.length - 1] as {
        from: string;
        to: string;
        actorRole: string;
      };
      expect(lastEntry.from).toBe('DRAFT');
      expect(lastEntry.to).toBe('SUBMITTED');
      expect(lastEntry.actorRole).toBe('user');
      expect(report.status).toBe('SUBMITTED');
    });

    it('throws BadRequestException when report has no items', async () => {
      const report = makeReport('DRAFT');
      mockReportModel.findOne.mockReturnValue(mockExec(report));
      mockItemModel.countDocuments.mockResolvedValue(0);

      await expect(service.submit(reportId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when report does not exist', async () => {
      mockReportModel.findOne.mockReturnValue(mockExec(null));

      await expect(service.submit(reportId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reopen()', () => {
    it('appends REJECTED→DRAFT history entry', async () => {
      const report = makeReport('REJECTED', [
        { from: null, to: 'DRAFT', actorRole: 'user', note: null },
        { from: 'DRAFT', to: 'SUBMITTED', actorRole: 'user', note: null },
        { from: 'SUBMITTED', to: 'REJECTED', actorRole: 'admin', note: 'Missing receipts' },
      ]);
      mockReportModel.findOne.mockReturnValue(mockExec(report));

      await service.reopen(reportId, userId);

      const lastEntry = report.statusHistory[report.statusHistory.length - 1] as {
        from: string;
        to: string;
        actorRole: string;
      };
      expect(lastEntry.from).toBe('REJECTED');
      expect(lastEntry.to).toBe('DRAFT');
      expect(lastEntry.actorRole).toBe('user');
      expect(report.status).toBe('DRAFT');
    });

    it('throws BadRequestException when report is not REJECTED', async () => {
      const report = makeReport('SUBMITTED');
      mockReportModel.findOne.mockReturnValue(mockExec(report));

      await expect(service.reopen(reportId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('statusHistory across full cycle: submit → reject → reopen → submit', () => {
    it('accumulates 5 entries across the full lifecycle', async () => {
      // Start: report has initial DRAFT entry
      const report = makeReport('DRAFT', [
        { from: null, to: 'DRAFT', actorRole: 'user', note: null },
      ]);

      // Step 1: submit (DRAFT → SUBMITTED)
      mockReportModel.findOne.mockReturnValue(mockExec(report));
      mockItemModel.countDocuments.mockResolvedValue(1);
      await service.submit(reportId, userId);
      expect(report.statusHistory).toHaveLength(2);

      // Step 2: simulate admin rejection (set status directly for next step)
      report.status = 'REJECTED';
      (report.statusHistory as unknown[]).push({
        from: 'SUBMITTED',
        to: 'REJECTED',
        actorRole: 'admin',
        note: 'Missing invoice',
      });

      // Step 3: reopen (REJECTED → DRAFT)
      mockReportModel.findOne.mockReturnValue(mockExec(report));
      await service.reopen(reportId, userId);
      expect(report.statusHistory).toHaveLength(4);

      // Step 4: re-submit (DRAFT → SUBMITTED)
      mockReportModel.findOne.mockReturnValue(mockExec(report));
      mockItemModel.countDocuments.mockResolvedValue(1);
      await service.submit(reportId, userId);
      expect(report.statusHistory).toHaveLength(5);

      const entries = report.statusHistory as Array<{ from: string | null; to: string }>;
      expect(entries[0]).toMatchObject({ from: null, to: 'DRAFT' });
      expect(entries[1]).toMatchObject({ from: 'DRAFT', to: 'SUBMITTED' });
      expect(entries[2]).toMatchObject({ from: 'SUBMITTED', to: 'REJECTED' });
      expect(entries[3]).toMatchObject({ from: 'REJECTED', to: 'DRAFT' });
      expect(entries[4]).toMatchObject({ from: 'DRAFT', to: 'SUBMITTED' });
    });
  });
});
