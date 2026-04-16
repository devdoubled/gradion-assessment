import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { ExpenseReport } from '@/lib/types';
import { ChevronRight, Receipt } from 'lucide-react';

interface Props {
  report: ExpenseReport;
}

export function ReportCard({ report }: Props) {
  return (
    <Link href={`/reports/${report._id}`} className="block group">
      <Card className="shadow-sm group-hover:shadow-md group-hover:border-border/80 transition-all">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold truncate">{report.title}</h3>
                  <StatusBadge status={report.status} />
                </div>
                {report.description && (
                  <p className="text-sm text-muted-foreground truncate">{report.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {new Intl.NumberFormat('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    }).format(report.totalAmount)}
                  </span>
                  <span>·</span>
                  <span>{formatDate(report.createdAt)}</span>
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
