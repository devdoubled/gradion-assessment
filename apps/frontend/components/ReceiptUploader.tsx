'use client';

import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { ExpenseItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Loader2, Sparkles, AlertCircle } from 'lucide-react';

type ExtractionState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'extracting' }
  | { status: 'complete'; fields: NonNullable<ExpenseItem['aiExtracted']> }
  | { status: 'error'; message: string };

const NULL_FIELDS: NonNullable<ExpenseItem['aiExtracted']> = {
  merchantName: { value: null, confidence: null },
  amount: { value: null, confidence: null },
  currency: { value: null, confidence: null },
  transactionDate: { value: null, confidence: null },
};

interface Props {
  itemId: string;
  onExtracted: (fields: NonNullable<ExpenseItem['aiExtracted']>) => void;
}

export function ReceiptUploader({ itemId, onExtracted }: Props) {
  const [state, setState] = useState<ExtractionState>({ status: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);
  const onExtractedRef = useRef(onExtracted);

  useEffect(() => {
    onExtractedRef.current = onExtracted;
  }, [onExtracted]);

  async function handleFile(file: File) {
    setState({ status: 'uploading' });
    try {
      const formData = new FormData();
      formData.append('file', file);
      setState({ status: 'extracting' });

      const { data: res } = await api.post(
        `/items/${itemId}/receipt`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      const item = res.data as ExpenseItem;
      const fields = item.aiExtracted ?? NULL_FIELDS;
      setState({ status: 'complete', fields });
      onExtractedRef.current(fields);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message ?? 'Upload failed. Please try again.';
      setState({ status: 'error', message: Array.isArray(raw) ? raw.join(', ') : raw });
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      e.target.value = ''; // allow re-selecting same file
      handleFile(file);
    }
  }

  const isBusy = state.status === 'uploading' || state.status === 'extracting';

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleInputChange}
      />

      {state.status === 'idle' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload Receipt
        </Button>
      )}

      {state.status === 'uploading' && (
        <Button type="button" variant="outline" size="sm" disabled>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Uploading...
        </Button>
      )}

      {state.status === 'extracting' && (
        <div className="space-y-2">
          <Button type="button" variant="outline" size="sm" disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Extracting with AI...
          </Button>
          <Alert className="border-blue-200 bg-blue-50/60 dark:bg-blue-950/20">
            <Sparkles className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-xs text-blue-700">
              Claude is reading your receipt and extracting details...
            </AlertDescription>
          </Alert>
        </div>
      )}

      {state.status === 'complete' && (
        <div className="space-y-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            onClick={() => inputRef.current?.click()}
            disabled={isBusy}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Receipt Uploaded
          </Button>
          <p className="text-xs text-muted-foreground">Click to replace receipt.</p>
        </div>
      )}

      {state.status === 'error' && (
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setState({ status: 'idle' });
              inputRef.current?.click();
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            Retry Upload
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">{state.message}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
