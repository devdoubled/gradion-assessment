import { Badge } from '@/components/ui/badge';
import { Clock, Send, CheckCircle2, XCircle } from 'lucide-react';
import { ReportStatus } from '@/lib/types';

const CONFIG: Record<
  ReportStatus,
  {
    label: string;
    icon: React.ElementType;
    className: string;
  }
> = {
  DRAFT: {
    label: 'Draft',
    icon: Clock,
    className: 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-100',
  },
  SUBMITTED: {
    label: 'Submitted',
    icon: Send,
    className: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100',
  },
  APPROVED: {
    label: 'Approved',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50',
  },
  REJECTED: {
    label: 'Rejected',
    icon: XCircle,
    className: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-50',
  },
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  const { label, icon: Icon, className } = CONFIG[status];
  return (
    <Badge variant="outline" className={`gap-1.5 font-medium ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
