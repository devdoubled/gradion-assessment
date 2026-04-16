export type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface User {
  _id: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface StatusHistoryEntry {
  from: ReportStatus | null;
  to: ReportStatus;
  actorId: string;
  actorRole: 'user' | 'admin';
  note: string | null;
  timestamp: string;
}

export interface ExpenseReport {
  _id: string;
  userId: string | { _id: string; email: string };
  title: string;
  description: string;
  status: ReportStatus;
  totalAmount: number;
  statusHistory: StatusHistoryEntry[];
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
    merchantName: { value: string | null; confidence: number | null };
    amount: { value: number | null; confidence: number | null };
    currency: { value: string | null; confidence: number | null };
    transactionDate: { value: string | null; confidence: number | null };
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
}
