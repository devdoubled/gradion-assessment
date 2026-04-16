import { StatusHistoryEntry, ReportStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';

const STATUS_ICON: Record<ReportStatus, React.ElementType> = {
  DRAFT: Clock,
  SUBMITTED: Send,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
};

const STATUS_COLOR: Record<ReportStatus, string> = {
  DRAFT: 'text-zinc-500',
  SUBMITTED: 'text-blue-600',
  APPROVED: 'text-emerald-600',
  REJECTED: 'text-red-600',
};

const STATUS_DOT: Record<ReportStatus, string> = {
  DRAFT: 'bg-zinc-400',
  SUBMITTED: 'bg-blue-500',
  APPROVED: 'bg-emerald-500',
  REJECTED: 'bg-red-500',
};

function formatTimestamp(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface Props {
  history: StatusHistoryEntry[];
}

export function AuditTimeline({ history }: Props) {
  if (history.length === 0) return null;

  // newest first
  const entries = [...history].reverse();

  return (
    <ol className="relative space-y-0">
      {entries.map((entry, idx) => {
        const Icon = entry.to ? STATUS_ICON[entry.to] ?? Clock : Clock;
        const dotColor = entry.to ? STATUS_DOT[entry.to] ?? 'bg-zinc-400' : 'bg-zinc-400';
        const isLast = idx === entries.length - 1;

        return (
          <li key={idx} className="flex gap-4">
            {/* Timeline spine */}
            <div className="flex flex-col items-center">
              <div className={cn('mt-1 h-2.5 w-2.5 rounded-full shrink-0', dotColor)} />
              {!isLast && <div className="w-px flex-1 bg-border mt-1 mb-0" />}
            </div>

            {/* Content */}
            <div className={cn('pb-5', isLast && 'pb-0')}>
              {/* Transition line */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {entry.from ? (
                  <>
                    <span className={cn('text-xs font-semibold', STATUS_COLOR[entry.from])}>
                      {entry.from}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </>
                ) : null}
                <span className={cn('text-xs font-semibold flex items-center gap-1', STATUS_COLOR[entry.to])}>
                  <Icon className="h-3 w-3" />
                  {entry.to}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] px-1.5 py-0 h-4 ml-0.5',
                    entry.actorRole === 'admin'
                      ? 'border-violet-300 bg-violet-50 text-violet-700'
                      : 'border-zinc-300 bg-zinc-50 text-zinc-600',
                  )}
                >
                  {entry.actorRole === 'admin' ? 'Admin' : 'User'}
                </Badge>
              </div>

              {/* Rejection note */}
              {entry.note && (
                <p className="mt-1 text-xs text-muted-foreground italic border-l-2 border-red-200 pl-2">
                  &ldquo;{entry.note}&rdquo;
                </p>
              )}

              {/* Timestamp */}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatTimestamp(entry.timestamp)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
