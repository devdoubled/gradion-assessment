import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExpenseReportDocument = ExpenseReport & Document;

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
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

  @Prop({ type: Number, default: 0 })
  totalAmount: number;
}

export const ExpenseReportSchema = SchemaFactory.createForClass(ExpenseReport);
