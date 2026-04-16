'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ExpenseReport } from '@/lib/types';
import { ReportCard } from '@/components/ReportCard';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { Plus, FileText, AlertCircle } from 'lucide-react';

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
] as const;

export default function ReportsPage() {
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = tab !== 'all' ? { status: tab } : {};
        const { data: res } = await api.get('/reports', { params });
        setReports(res.data);
      } catch {
        setError('Failed to load reports. Please refresh.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tab]);

  return (
    <>
      {/* Header */}
      <div className="border-b border-border bg-white dark:bg-card px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Reports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage and track your expense reports
            </p>
          </div>
          <Link href="/reports/new" className={cn(buttonVariants())}>
            <Plus className="mr-2 h-4 w-4" />
            New Report
          </Link>
        </div>
      </div>

      {/* Body */}
      <div className="p-8 space-y-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {STATUS_TABS.map(({ value, label }) => (
              <TabsTrigger key={value} value={value}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-72" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">
              {tab === 'all' ? 'No reports yet' : `No ${tab.toLowerCase()} reports`}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-xs">
              {tab === 'all'
                ? 'Create your first expense report to get started.'
                : 'No reports match this status filter.'}
            </p>
            {tab === 'all' && (
              <Link href="/reports/new" className={cn(buttonVariants())}>
                <Plus className="mr-2 h-4 w-4" />
                New Report
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <ReportCard key={report._id} report={report} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
