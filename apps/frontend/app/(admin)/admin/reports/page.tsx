'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ExpenseReport, ReportStatus } from '@/lib/types';
import { formatAmount, formatDate } from '@/lib/format';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  CheckCircle2,
  XCircle,
  AlertCircle,
  ClipboardList,
  Loader2,
} from 'lucide-react';

type TabValue = 'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

const TABS: { value: TabValue; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

interface AdminReport extends ExpenseReport {
  userId: { _id: string; email: string };
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [tab, setTab] = useState<TabValue>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Approve flow
  const [approveId, setApproveId] = useState<string | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);

  // Reject flow
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = tab !== 'ALL' ? `?status=${tab}` : '';
      const { data: res } = await api.get(`/admin/reports${params}`);
      setReports(res.data);
    } catch {
      setError('Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  async function confirmApprove() {
    if (!approveId) return;
    const targetId = approveId;
    setApproveLoading(true);
    setActionError(null);
    try {
      const { data: res } = await api.post(`/admin/reports/${targetId}/approve`);
      setReports((prev) =>
        prev.map((r) => (r._id === targetId ? { ...r, status: res.data.status as ReportStatus } : r)),
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message ?? 'Failed to approve report';
      setActionError(Array.isArray(raw) ? raw.join(', ') : raw);
    } finally {
      setApproveLoading(false);
      setApproveId(null);
    }
  }

  async function confirmReject() {
    if (!rejectId) return;
    const targetId = rejectId;
    setRejectLoading(true);
    setActionError(null);
    try {
      const { data: res } = await api.post(`/admin/reports/${targetId}/reject`);
      setReports((prev) =>
        prev.map((r) => (r._id === targetId ? { ...r, status: res.data.status as ReportStatus } : r)),
      );
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message ?? 'Failed to reject report';
      setActionError(Array.isArray(raw) ? raw.join(', ') : raw);
    } finally {
      setRejectLoading(false);
      setRejectId(null);
    }
  }

  const filtered =
    tab === 'ALL' ? reports : reports.filter((r) => r.status === tab);

  return (
    <>
      {/* Header */}
      <div className="border-b border-border bg-white dark:bg-card px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">All Reports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review and action submitted expense reports
            </p>
          </div>
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

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <TabsList>
            {TABS.map(({ value, label }) => (
              <TabsTrigger key={value} value={value}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">No reports found</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {tab === 'ALL'
                ? 'No expense reports have been submitted yet.'
                : `No ${tab.toLowerCase()} reports at this time.`}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && filtered.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground">User</TableHead>
                  <TableHead className="font-semibold text-foreground">Title</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-foreground">Total</TableHead>
                  <TableHead className="font-semibold text-foreground">Date</TableHead>
                  <TableHead className="w-36" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((report) => {
                  const userEmail =
                    typeof report.userId === 'object'
                      ? report.userId.email
                      : report.userId;
                  const isSubmitted = report.status === 'SUBMITTED';
                  const isApprovingThis = approveLoading && approveId === report._id;
                  const isRejectingThis = rejectLoading && rejectId === report._id;

                  return (
                    <TableRow
                      key={report._id}
                      className="hover:bg-muted/30 cursor-pointer"
                      onClick={() => router.push(`/admin/reports/${report._id}`)}
                    >
                      <TableCell className="text-muted-foreground text-sm">
                        {userEmail}
                      </TableCell>
                      <TableCell className="font-medium">{report.title}</TableCell>
                      <TableCell>
                        <StatusBadge status={report.status} />
                      </TableCell>
                      <TableCell>
                        {report.totalAmount > 0
                          ? new Intl.NumberFormat('en-US', {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            }).format(report.totalAmount)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(report.createdAt)}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {isSubmitted && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400"
                              disabled={isApprovingThis || isRejectingThis}
                              onClick={() => setApproveId(report._id)}
                            >
                              {isApprovingThis ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50"
                              disabled={isApprovingThis || isRejectingThis}
                              onClick={() => setRejectId(report._id)}
                            >
                              {isRejectingThis ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <XCircle className="h-3 w-3 mr-1" />
                              )}
                              Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Approve confirmation */}
      <ConfirmDialog
        open={approveId !== null}
        onOpenChange={(open) => { if (!open) setApproveId(null); }}
        title="Approve report?"
        description="This will mark the report as approved. The submitter will see the updated status."
        confirmLabel="Approve"
        loading={approveLoading}
        onConfirm={confirmApprove}
      />

      {/* Reject confirmation */}
      <ConfirmDialog
        open={rejectId !== null}
        onOpenChange={(open) => { if (!open) setRejectId(null); }}
        title="Reject report?"
        description="This will mark the report as rejected and allow the user to revise and resubmit."
        confirmLabel="Reject"
        destructive
        loading={rejectLoading}
        onConfirm={confirmReject}
      />
    </>
  );
}
