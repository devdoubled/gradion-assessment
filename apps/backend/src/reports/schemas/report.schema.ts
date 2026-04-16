import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type ExpenseReportDocument = ExpenseReport & Document;

@Schema({ _id: false })
class StatusHistoryEntry {
  @Prop({ type: String, default: null })
  from: ReportStatus | null;

  @Prop({ required: true, type: String })
  to: ReportStatus;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  actorId: Types.ObjectId;

  @Prop({ required: true, enum: ['user', 'admin'], type: String })
  actorRole: 'user' | 'admin';

  @Prop({ type: String, default: null })
  note: string | null;

  @Prop({ required: true, type: Date })
  timestamp: Date;
}

const StatusHistoryEntrySchema = SchemaFactory.createForClass(StatusHistoryEntry);

@Schema({ timestamps: true, collection: 'expense_reports' })
export class ExpenseReport {
  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'],
    default: 'DRAFT',
  })
  status: ReportStatus;

  @Prop({ type: Number, default: 0 })
  totalAmount: number;

  @Prop({ type: [StatusHistoryEntrySchema], default: [] })
  statusHistory: StatusHistoryEntry[];
}

export const ExpenseReportSchema = SchemaFactory.createForClass(ExpenseReport);
