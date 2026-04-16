'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ExpenseReport, ExpenseItem, ReportStatus } from '@/lib/types';
import { formatAmount, formatDate, groupByCurrency } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { AuditTimeline } from '@/components/AuditTimeline';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  ArrowLeft,
  Receipt,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface AdminReport extends ExpenseReport {
  userId: { _id: string; email: string };
}

export default function AdminReportDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [report, setReport] = useState<AdminReport | null>(null);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [approveOpen, setApproveOpen] = useState(false);
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectNote, setRejectNote] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [{ data: rRes }, { data: iRes }] = await Promise.all([
          api.get(`/admin/reports/${id}`),
          api.get(`/admin/reports/${id}/items`),
        ]);
        setReport(rRes.data);
        setItems(iRes.data);
      } catch {
        setError('Failed to load report.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  async function confirmApprove() {
    setApproveLoading(true);
    setActionError(null);
    try {
      const { data: res } = await api.post(`/admin/reports/${id}/approve`);
      setReport((prev) =>
        prev
          ? {
              ...prev,
              status: res.data.status as ReportStatus,
              statusHistory: res.data.statusHistory ?? prev.statusHistory,
            }
          : prev,
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message ?? 'Failed to approve report';
      setActionError(Array.isArray(raw) ? raw.join(', ') : raw);
    } finally {
      setApproveLoading(false);
      setApproveOpen(false);
    }
  }

  async function confirmReject() {
    setRejectLoading(true);
    setActionError(null);
    try {
      const { data: res } = await api.post(`/admin/reports/${id}/reject`, {
        note: rejectNote.trim() || undefined,
      });
      setReport((prev) =>
        prev
          ? {
              ...prev,
              status: res.data.status as ReportStatus,
              statusHistory: res.data.statusHistory ?? prev.statusHistory,
            }
          : prev,
      );
      setRejectNote('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message ?? 'Failed to reject report';
      setActionError(Array.isArray(raw) ? raw.join(', ') : raw);
    } finally {
      setRejectLoading(false);
      setRejectOpen(false);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (!report) {
    return (
      <div className="p-8 max-w-lg">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Report not found.</AlertDescription>
        </Alert>
        <Button className="mt-4 cursor-pointer" variant="outline" onClick={() => router.push('/admin/reports')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reports
        </Button>
      </div>
    );
  }

  const isSubmitted = report.status === 'SUBMITTED';
  const userEmail = typeof report.userId === 'object' ? report.userId.email : report.userId;

  return (
    <>
      {/* Header */}
      <div className="border-b border-border bg-white dark:bg-card px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 cursor-pointer"
              onClick={() => router.push('/admin/reports')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight truncate">{report.title}</h1>
                <StatusBadge status={report.status} />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Submitted by <span className="font-medium text-foreground">{userEmail}</span>
              </p>
            </div>
          </div>

          {isSubmitted && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400"
                disabled={approveLoading || rejectLoading}
                onClick={() => setApproveOpen(true)}
              >
                {approveLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50"
                disabled={approveLoading || rejectLoading}
                onClick={() => setRejectOpen(true)}
              >
                {rejectLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-8 space-y-6">
        {actionError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {/* Summary card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-4 gap-6">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Total Amount
                </dt>
                {(() => {
                  const grouped = groupByCurrency(items);
                  if (grouped.length === 0) {
                    return <dd className="text-2xl font-bold mt-1">—</dd>;
                  }
                  if (grouped.length === 1) {
                    return (
                      <dd className="text-2xl font-bold mt-1">
                        {formatAmount(grouped[0].total, grouped[0].currency)}
                      </dd>
                    );
                  }
                  return (
                    <dd className="mt-1 space-y-0.5">
                      {grouped.map(({ currency, total }) => (
                        <div key={currency} className="text-lg font-bold leading-tight">
                          {formatAmount(total, currency)}
                        </div>
                      ))}
                      <p className="text-xs text-muted-foreground pt-0.5">Mixed currencies</p>
                    </dd>
                  );
                })()}
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Items
                </dt>
                <dd className="text-2xl font-bold mt-1">{items.length}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Submitted By
                </dt>
                <dd className="text-sm font-semibold mt-1 truncate">{userEmail}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Created
                </dt>
                <dd className="text-lg font-semibold mt-1">{formatDate(report.createdAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Items section */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Expense Items</h2>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center border-2 border-dashed border-border rounded-xl">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold mb-1">No items</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                This report has no expense items.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Merchant</TableHead>
                    <TableHead className="font-semibold text-foreground">Category</TableHead>
                    <TableHead className="font-semibold text-foreground">Amount</TableHead>
                    <TableHead className="font-semibold text-foreground">Date</TableHead>
                    <TableHead className="font-semibold text-foreground w-16">Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item._id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{item.merchantName}</TableCell>
                      <TableCell className="text-muted-foreground">{item.category}</TableCell>
                      <TableCell>{formatAmount(item.amount, item.currency)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(item.transactionDate)}
                      </TableCell>
                      <TableCell>
                        {item.receiptUrl ? (
                          <Receipt className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Receipt className="h-4 w-4 text-muted-foreground/25" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Audit trail */}
        {report.statusHistory && report.statusHistory.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                Status History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AuditTimeline history={report.statusHistory} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Approve confirmation */}
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve report?"
        description="This will mark the report as approved. This action cannot be undone."
        confirmLabel="Approve"
        loading={approveLoading}
        onConfirm={confirmApprove}
      />

      {/* Reject confirmation — includes optional reason textarea */}
      <ConfirmDialog
        open={rejectOpen}
        onOpenChange={(open) => {
          setRejectOpen(open);
          if (!open) setRejectNote('');
        }}
        title="Reject report?"
        description="This will mark the report as rejected and allow the user to revise and resubmit."
        confirmLabel="Reject"
        destructive
        loading={rejectLoading}
        onConfirm={confirmReject}
        note={rejectNote}
        onNoteChange={setRejectNote}
        notePlaceholder="Reason for rejection (shown to the submitter)..."
        noteLabel="Rejection reason (optional)"
      />
    </>
  );
}
