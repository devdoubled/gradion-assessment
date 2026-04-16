'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ExpenseReport, ExpenseItem } from '@/lib/types';
import { formatAmount, formatDate, groupByCurrency } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { StatusHistoryEntry } from '@/lib/types';
import {
  ArrowLeft,
  Plus,
  Send,
  Pencil,
  Trash2,
  Receipt,
  AlertCircle,
  Loader2,
  RotateCcw,
  MessageSquareWarning,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ReportDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [report, setReport] = useState<ExpenseReport | null>(null);
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [reopenLoading, setReopenLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteReportOpen, setDeleteReportOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  async function loadData() {
    try {
      const [{ data: rRes }, { data: iRes }] = await Promise.all([
        api.get(`/reports/${id}`),
        api.get(`/reports/${id}/items`),
      ]);
      setReport(rRes.data);
      setItems(iRes.data);
    } catch {
      setError('Failed to load report.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSubmit() {
    if (items.length === 0) {
      setError('Add at least one expense item before submitting.');
      return;
    }
    setSubmitLoading(true);
    setError(null);
    try {
      const { data: res } = await api.post(`/reports/${id}/submit`);
      setReport(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message ?? 'Failed to submit report';
      setError(Array.isArray(raw) ? raw.join(', ') : raw);
    } finally {
      setSubmitLoading(false);
    }
  }

  async function handleReopen() {
    setReopenLoading(true);
    setError(null);
    try {
      const { data: res } = await api.post(`/reports/${id}/reopen`);
      setReport(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message ?? 'Failed to re-open report';
      setError(Array.isArray(raw) ? raw.join(', ') : raw);
    } finally {
      setReopenLoading(false);
    }
  }

  async function confirmDeleteReport() {
    setDeleteLoading(true);
    setError(null);
    try {
      await api.delete(`/reports/${id}`);
      router.replace('/reports');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message ?? 'Failed to delete report';
      setError(Array.isArray(raw) ? raw.join(', ') : raw);
      setDeleteLoading(false);
    }
  }

  async function confirmDeleteItem() {
    if (!deleteItemId) return;
    const targetId = deleteItemId; // capture before state updates (React state is async)
    setDeletingId(targetId);
    setDeleteItemId(null);
    setError(null);
    try {
      await api.delete(`/reports/${id}/items/${targetId}`);
      const [{ data: iRes }, { data: rRes }] = await Promise.all([
        api.get(`/reports/${id}/items`),
        api.get(`/reports/${id}`),
      ]);
      setItems(iRes.data);
      setReport(rRes.data);
    } catch {
      setError('Failed to delete item.');
    } finally {
      setDeletingId(null);
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
        <Button className="mt-4 cursor-pointer" variant="outline" onClick={() => router.push('/reports')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Reports
        </Button>
      </div>
    );
  }

  const isDraft = report.status === 'DRAFT';
  const isRejected = report.status === 'REJECTED';

  // Find the most recent rejection note (if any)
  const rejectionNote = isRejected
    ? ([...(report.statusHistory ?? [])]
        .reverse()
        .find((e: StatusHistoryEntry) => e.to === 'REJECTED')?.note ?? null)
    : null;

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
              onClick={() => router.push('/reports')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl font-bold tracking-tight truncate">{report.title}</h1>
                <StatusBadge status={report.status} />
              </div>
              {report.description && (
                <p className="text-sm text-muted-foreground mt-0.5 truncate">
                  {report.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isDraft && (
              <Button
                size="sm"
                variant="destructive"
                disabled={deleteLoading}
                onClick={() => setDeleteReportOpen(true)}
              >
                {deleteLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </Button>
            )}
            {isRejected && (
              <Button
                size="sm"
                variant="outline"
                disabled={reopenLoading}
                onClick={handleReopen}
              >
                {reopenLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                {reopenLoading ? 'Reopening...' : 'Re-open & Edit'}
              </Button>
            )}
            <Button size="sm" disabled={!isDraft || submitLoading} onClick={handleSubmit}>
              {submitLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {submitLoading ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-8 space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Rejection note banner */}
        {isRejected && (
          <Alert className="border-red-200 bg-red-50/60 dark:bg-red-950/20">
            <MessageSquareWarning className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">
              <span className="font-semibold">Report rejected.</span>
              {rejectionNote ? (
                <span className="ml-1">Reason: &ldquo;{rejectionNote}&rdquo;</span>
              ) : (
                <span className="ml-1 text-red-600/80">No reason was provided.</span>
              )}
              <span className="block mt-0.5 text-xs text-red-600/70">
                Click &ldquo;Re-open &amp; Edit&rdquo; to revise and resubmit.
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-6">
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
                  // Mixed currencies — show per-currency breakdown
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
                  Created
                </dt>
                <dd className="text-lg font-semibold mt-1">
                  {formatDate(report.createdAt)}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Items section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Expense Items</h2>
            {isDraft && (
              <Link
                href={`/reports/${id}/items/new`}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Link>
            )}
          </div>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center border-2 border-dashed border-border rounded-xl">
              <div className="rounded-full bg-muted p-3 mb-3">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold mb-1">No items yet</h3>
              <p className="text-sm text-muted-foreground mb-5 max-w-xs">
                Add expense items with receipts and let AI extract the details.
              </p>
              {isDraft && (
                <Link
                  href={`/reports/${id}/items/new`}
                  className={cn(buttonVariants({ size: 'sm' }))}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Link>
              )}
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
                    {isDraft && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item._id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{item.merchantName}</TableCell>
                      <TableCell className="text-muted-foreground">{item.category}</TableCell>
                      <TableCell>
                        {formatAmount(item.amount, item.currency)}
                      </TableCell>
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
                      {isDraft && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Link
                              href={`/reports/${id}/items/${item._id}/edit`}
                              className={cn(
                                buttonVariants({ variant: 'ghost', size: 'icon' }),
                                'h-7 w-7',
                              )}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              disabled={deletingId === item._id}
                              onClick={() => setDeleteItemId(item._id)}
                            >
                              {deletingId === item._id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {/* Delete report confirmation */}
      <ConfirmDialog
        open={deleteReportOpen}
        onOpenChange={setDeleteReportOpen}
        title="Delete report?"
        description="This will permanently delete the report and all its expense items. This action cannot be undone."
        confirmLabel="Delete Report"
        destructive
        loading={deleteLoading}
        onConfirm={confirmDeleteReport}
      />

      {/* Delete item confirmation */}
      <ConfirmDialog
        open={deleteItemId !== null}
        onOpenChange={(open) => { if (!open) setDeleteItemId(null); }}
        title="Delete item?"
        description="This expense item will be permanently removed from the report."
        confirmLabel="Delete Item"
        destructive
        onConfirm={confirmDeleteItem}
      />
    </>
  );
}
