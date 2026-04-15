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
      merchantName: { type: String, default: null },
      amount: { type: Number, default: null },
      currency: { type: String, default: null },
      transactionDate: { type: String, default: null },
    },
    default: null,
  })
  aiExtracted: {
    merchantName: string | null;
    amount: number | null;
    currency: string | null;
    transactionDate: string | null;
  } | null;
}

export const ExpenseItemSchema = SchemaFactory.createForClass(ExpenseItem);
