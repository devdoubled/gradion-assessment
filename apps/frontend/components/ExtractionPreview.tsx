import { ExpenseItem } from '@/lib/types';
import { formatAmount, formatDate } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Sparkles } from 'lucide-react';

type AiExtracted = NonNullable<ExpenseItem['aiExtracted']>;

interface ConfidenceBadgeProps {
  confidence: number | null;
}

function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  if (confidence === null) return null;

  if (confidence >= 0.85) {
    return (
      <Badge
        variant="outline"
        className="text-[10px] px-1.5 py-0 h-4 border-emerald-300 bg-emerald-50 text-emerald-700"
      >
        High
      </Badge>
    );
  }

  if (confidence >= 0.6) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 border-amber-300 bg-amber-50 text-amber-700 cursor-help"
            >
              Review
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-48">
            AI is uncertain — please verify this value
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge
      variant="outline"
      className="text-[10px] px-1.5 py-0 h-4 border-red-300 bg-red-50 text-red-700"
    >
      Low
    </Badge>
  );
}

interface Props {
  extracted: AiExtracted;
}

export function ExtractionPreview({ extracted }: Props) {
  const fields: {
    label: string;
    displayValue: string | null;
    confidence: number | null;
  }[] = [
    {
      label: 'Merchant',
      displayValue: extracted.merchantName.value,
      confidence: extracted.merchantName.confidence,
    },
    {
      label: 'Amount',
      displayValue:
        extracted.amount.value != null && extracted.currency.value
          ? formatAmount(extracted.amount.value, extracted.currency.value)
          : extracted.amount.value != null
            ? String(extracted.amount.value)
            : null,
      confidence: extracted.amount.confidence,
    },
    {
      label: 'Currency',
      displayValue: extracted.currency.value,
      confidence: extracted.currency.confidence,
    },
    {
      label: 'Date',
      displayValue: extracted.transactionDate.value
        ? formatDate(extracted.transactionDate.value)
        : null,
      confidence: extracted.transactionDate.confidence,
    },
  ].filter(
    (f): f is { label: string; displayValue: string; confidence: number | null } =>
      f.displayValue != null,
  );

  if (fields.length === 0) return null;

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
          AI extracted from receipt
        </span>
        <Badge
          variant="outline"
          className="text-xs border-emerald-300 text-emerald-700 bg-white ml-auto"
        >
          Pre-filled below
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
        {fields.map(({ label, displayValue, confidence }) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground mb-0.5">{label}</dt>
            <dd className="flex items-center gap-1.5">
              <span className="text-sm font-medium">{displayValue}</span>
              <ConfidenceBadge confidence={confidence} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-muted-foreground">
        All fields are editable — review and correct if needed.
      </p>
    </div>
  );
}
