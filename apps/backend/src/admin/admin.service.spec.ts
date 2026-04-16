import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AdminService } from './admin.service';
import { ExpenseReport } from '../reports/schemas/report.schema';

const adminId = new Types.ObjectId().toString();
const reportId = new Types.ObjectId().toString();

function makeReport(status: string) {
  return {
    _id: reportId,
    status,
    statusHistory: [] as unknown[],
    save: jest.fn().mockImplementation(function (this: { status: string; statusHistory: unknown[] }) {
      return Promise.resolve(this);
    }),
  };
}

describe('AdminService — statusHistory', () => {
  let service: AdminService;
  let mockReportModel: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockReportModel = {
      findById: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getModelToken(ExpenseReport.name),
          useValue: mockReportModel,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  const mockExec = (value: unknown) => ({
    exec: jest.fn().mockResolvedValue(value),
    populate: jest.fn().mockReturnThis(),
  });

  describe('approve()', () => {
    it('appends SUBMITTED→APPROVED history entry with admin actor', async () => {
      const report = makeReport('SUBMITTED');
      mockReportModel.findById.mockReturnValue(mockExec(report));

      await service.approve(reportId, adminId);

      const entry = report.statusHistory[0] as {
        from: string;
        to: string;
        actorRole: string;
        note: null;
      };
      expect(entry.from).toBe('SUBMITTED');
      expect(entry.to).toBe('APPROVED');
      expect(entry.actorRole).toBe('admin');
      expect(entry.note).toBeNull();
      expect(report.status).toBe('APPROVED');
    });

    it('throws NotFoundException when report does not exist', async () => {
      mockReportModel.findById.mockReturnValue(mockExec(null));

      await expect(service.approve(reportId, adminId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reject()', () => {
    it('appends SUBMITTED→REJECTED history entry with note', async () => {
      const report = makeReport('SUBMITTED');
      mockReportModel.findById.mockReturnValue(mockExec(report));

      await service.reject(reportId, adminId, 'Missing original receipts');

      const entry = report.statusHistory[0] as {
        from: string;
        to: string;
        actorRole: string;
        note: string;
      };
      expect(entry.from).toBe('SUBMITTED');
      expect(entry.to).toBe('REJECTED');
      expect(entry.actorRole).toBe('admin');
      expect(entry.note).toBe('Missing original receipts');
      expect(report.status).toBe('REJECTED');
    });

    it('stores null note when no reason is provided', async () => {
      const report = makeReport('SUBMITTED');
      mockReportModel.findById.mockReturnValue(mockExec(report));

      await service.reject(reportId, adminId);

      const entry = report.statusHistory[0] as { note: null };
      expect(entry.note).toBeNull();
    });

    it('throws NotFoundException when report does not exist', async () => {
      mockReportModel.findById.mockReturnValue(mockExec(null));

      await expect(service.reject(reportId, adminId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
