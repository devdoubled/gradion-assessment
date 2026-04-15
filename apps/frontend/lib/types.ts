export type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface User {
  _id: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseReport {
  _id: string;
  userId: string | { _id: string; email: string };
  title: string;
  description: string;
  status: ReportStatus;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseItem {
  _id: string;
  reportId: string;
  amount: number;
  currency: string;
  category: string;
  merchantName: string;
  transactionDate: string;
  receiptUrl: string | null;
  aiExtracted: {
    merchantName: string | null;
    amount: number | null;
    currency: string | null;
    transactionDate: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
}
