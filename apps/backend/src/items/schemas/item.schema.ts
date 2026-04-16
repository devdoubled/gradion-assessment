import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExpenseItemDocument = ExpenseItem & Document;

@Schema({ timestamps: true, collection: 'expense_items' })
export class ExpenseItem {
  @Prop({ required: true, type: Types.ObjectId, ref: 'ExpenseReport' })
  reportId: Types.ObjectId;

  @Prop({ required: true, type: Number, min: 0 })
  amount: number;

  @Prop({ required: true, trim: true, uppercase: true })
  currency: string;

  @Prop({ required: true, trim: true })
  category: string;

  @Prop({ required: true, trim: true })
  merchantName: string;

  @Prop({ required: true, type: Date })
  transactionDate: Date;

  @Prop({ type: String, default: null })
  receiptUrl: string | null;

  @Prop({
    type: {
      merchantName: {
        value: { type: String, default: null },
        confidence: { type: Number, default: null },
      },
      amount: {
        value: { type: Number, default: null },
        confidence: { type: Number, default: null },
      },
      currency: {
        value: { type: String, default: null },
        confidence: { type: Number, default: null },
      },
      transactionDate: {
        value: { type: String, default: null },
        confidence: { type: Number, default: null },
      },
    },
    default: null,
  })
  aiExtracted: {
    merchantName: { value: string | null; confidence: number | null };
    amount: { value: number | null; confidence: number | null };
    currency: { value: string | null; confidence: number | null };
    transactionDate: { value: string | null; confidence: number | null };
  } | null;
}

export const ExpenseItemSchema = SchemaFactory.createForClass(ExpenseItem);
