import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ItemsService } from './items.service';
import { ExpenseItem } from './schemas/item.schema';
import { ExpenseReport } from '../reports/schemas/report.schema';

const userId = new Types.ObjectId().toString();
const reportId = new Types.ObjectId().toString();
const itemId = new Types.ObjectId().toString();

const makeReport = (status: string) => ({
  _id: reportId,
  userId: new Types.ObjectId(userId),
  status,
  totalAmount: 0,
});

const makeItem = (amount: number) => ({
  _id: new Types.ObjectId().toString(),
  reportId: new Types.ObjectId(reportId),
  amount,
  currency: 'USD',
  category: 'Transport',
  merchantName: 'Uber',
  transactionDate: new Date('2024-01-15'),
  receiptUrl: null,
  aiExtracted: null,
});

describe('ItemsService', () => {
  let service: ItemsService;
  let mockReportModel: Record<string, jest.Mock>;
  let mockItemModel: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockReportModel = {
      findOne: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    mockItemModel = {
      create: jest.fn(),
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      aggregate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemsService,
        {
          provide: getModelToken(ExpenseItem.name),
          useValue: mockItemModel,
        },
        {
          provide: getModelToken(ExpenseReport.name),
          useValue: mockReportModel,
        },
      ],
    }).compile();

    service = module.get<ItemsService>(ItemsService);
  });

  const mockExec = (value: unknown) => ({
    exec: jest.fn().mockResolvedValue(value),
  });

  describe('create', () => {
    const dto = {
      amount: 50,
      currency: 'USD',
      category: 'Transport',
      merchantName: 'Uber',
      transactionDate: '2024-01-15',
    };

    it('creates item successfully when report is DRAFT', async () => {
      const item = makeItem(50);
      mockReportModel.findOne.mockReturnValue(mockExec(makeReport('DRAFT')));
      mockItemModel.create.mockResolvedValue(item);
      mockItemModel.aggregate.mockReturnValue(mockExec([{ total: 50 }]));
      mockReportModel.findByIdAndUpdate.mockReturnValue(mockExec(null));

      const result = await service.create(reportId, userId, dto);

      expect(result).toEqual(item);
      expect(mockItemModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 50, currency: 'USD' }),
      );
    });

    it('throws NotFoundException when report does not exist', async () => {
      mockReportModel.findOne.mockReturnValue(mockExec(null));

      await expect(service.create(reportId, userId, dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when report is SUBMITTED', async () => {
      mockReportModel.findOne.mockReturnValue(
        mockExec(makeReport('SUBMITTED')),
      );

      await expect(service.create(reportId, userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when report is APPROVED', async () => {
      mockReportModel.findOne.mockReturnValue(mockExec(makeReport('APPROVED')));

      await expect(service.create(reportId, userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when report is REJECTED', async () => {
      mockReportModel.findOne.mockReturnValue(mockExec(makeReport('REJECTED')));

      await expect(service.create(reportId, userId, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('recomputes totalAmount after successful create', async () => {
      mockReportModel.findOne.mockReturnValue(mockExec(makeReport('DRAFT')));
      mockItemModel.create.mockResolvedValue(makeItem(50));
      mockItemModel.aggregate.mockReturnValue(mockExec([{ total: 80 }]));
      mockReportModel.findByIdAndUpdate.mockReturnValue(mockExec(null));

      await service.create(reportId, userId, dto);

      expect(mockReportModel.findByIdAndUpdate).toHaveBeenCalledWith(reportId, {
        totalAmount: 80,
      });
    });
  });

  describe('remove', () => {
    it('recomputes totalAmount after successful delete', async () => {
      mockReportModel.findOne.mockReturnValue(mockExec(makeReport('DRAFT')));
      mockItemModel.findOneAndDelete.mockReturnValue(mockExec(makeItem(30)));
      mockItemModel.aggregate.mockReturnValue(mockExec([{ total: 50 }]));
      mockReportModel.findByIdAndUpdate.mockReturnValue(mockExec(null));

      await service.remove(itemId, reportId, userId);

      expect(mockReportModel.findByIdAndUpdate).toHaveBeenCalledWith(reportId, {
        totalAmount: 50,
      });
    });

    it('handles empty items list (totalAmount becomes 0)', async () => {
      mockReportModel.findOne.mockReturnValue(mockExec(makeReport('DRAFT')));
      mockItemModel.findOneAndDelete.mockReturnValue(mockExec(makeItem(30)));
      mockItemModel.aggregate.mockReturnValue(mockExec([]));
      mockReportModel.findByIdAndUpdate.mockReturnValue(mockExec(null));

      await service.remove(itemId, reportId, userId);

      expect(mockReportModel.findByIdAndUpdate).toHaveBeenCalledWith(reportId, {
        totalAmount: 0,
      });
    });

    it('throws BadRequestException when report is not DRAFT', async () => {
      mockReportModel.findOne.mockReturnValue(
        mockExec(makeReport('SUBMITTED')),
      );

      await expect(service.remove(itemId, reportId, userId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
