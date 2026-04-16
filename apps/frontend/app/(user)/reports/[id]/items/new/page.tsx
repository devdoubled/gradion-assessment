'use client';

import { use, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ExpenseItem } from '@/lib/types';
import { CURRENCIES } from '@/lib/currencies';
import { ExtractionPreview } from '@/components/ExtractionPreview';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Upload,
  Loader2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'extracting' }
  | { status: 'complete'; fields: NonNullable<ExpenseItem['aiExtracted']> }
  | { status: 'error'; message: string };

const CATEGORIES = [
  'Travel',
  'Meals & Entertainment',
  'Accommodation',
  'Transport',
  'Office Supplies',
  'Software',
  'Marketing',
  'Other',
];

const TODAY = new Date().toISOString().split('T')[0];

export default function NewItemPage({ params }: PageProps) {
  const { id: reportId } = use(params);
  const router = useRouter();

  const [form, setForm] = useState({
    merchantName: '',
    amount: '',
    currency: 'USD',
    category: '',
    transactionDate: TODAY,
  });
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle' });
  // If receipt upload pre-created an item, track its ID so we PATCH instead of POST
  const [preCreatedItemId, setPreCreatedItemId] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<NonNullable<ExpenseItem['aiExtracted']> | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function patchForm(fields: NonNullable<ExpenseItem['aiExtracted']>) {
    setForm((prev) => ({
      merchantName: fields.merchantName.value ?? prev.merchantName,
      amount: fields.amount.value != null ? String(fields.amount.value) : prev.amount,
      currency: fields.currency.value ?? prev.currency,
      category: prev.category,
      transactionDate: fields.transactionDate.value
        ? new Date(fields.transactionDate.value).toISOString().split('T')[0]
        : prev.transactionDate,
    }));
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadState({ status: 'uploading' });
    setError(null);

    try {
      // Step 1: create a stub item to get an ID for the receipt upload
      const stubPayload = {
        merchantName: 'Pending',
        amount: 0.01,
        currency: 'USD',
        category: 'Other',
        transactionDate: TODAY,
      };
      const { data: itemRes } = await api.post(`/reports/${reportId}/items`, stubPayload);
      const newItemId: string = itemRes.data._id;
      setPreCreatedItemId(newItemId);

      // Step 2: upload + extract
      const requestPromise = api.post(
        `/items/${newItemId}/receipt`,
        (() => {
          const fd = new FormData();
          fd.append('file', file);
          return fd;
        })(),
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );

      const timer = setTimeout(
        () =>
          setUploadState((prev) =>
            prev.status === 'uploading' ? { status: 'extracting' } : prev,
          ),
        600,
      );

      const { data: uploadRes } = await requestPromise;
      clearTimeout(timer);

      const updatedItem: ExpenseItem = uploadRes.data;
      const fields = updatedItem.aiExtracted ?? {
        merchantName: { value: null, confidence: null },
        amount: { value: null, confidence: null },
        currency: { value: null, confidence: null },
        transactionDate: { value: null, confidence: null },
      };

      setExtracted(fields);
      patchForm(fields);
      setUploadState({ status: 'complete', fields });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message ?? 'Upload failed. You can fill in details manually.';
      setUploadState({ status: 'error', message: Array.isArray(raw) ? raw.join(', ') : raw });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      merchantName: form.merchantName,
      amount: parseFloat(form.amount),
      currency: form.currency,
      category: form.category,
      transactionDate: form.transactionDate,
    };

    try {
      if (preCreatedItemId) {
        await api.patch(`/reports/${reportId}/items/${preCreatedItemId}`, payload);
      } else {
        await api.post(`/reports/${reportId}/items`, payload);
      }
      router.push(`/reports/${reportId}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message ?? 'Failed to save item';
      setError(Array.isArray(raw) ? raw.join(', ') : raw);
    } finally {
      setSaving(false);
    }
  }

  const isBusy = uploadState.status === 'uploading' || uploadState.status === 'extracting';

  return (
    <>
      {/* Header */}
      <div className="border-b border-border bg-white dark:bg-card px-8 py-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push(`/reports/${reportId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Add Expense Item</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Upload a receipt to auto-fill details, or enter them manually.</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-8">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Receipt uploader card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Receipt (optional)</CardTitle>
              <CardDescription>
                Upload an image or PDF — AI will extract the details and pre-fill the form below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />

              {uploadState.status === 'idle' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Receipt
                </Button>
              )}

              {uploadState.status === 'uploading' && (
                <Button type="button" variant="outline" size="sm" disabled>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </Button>
              )}

              {uploadState.status === 'extracting' && (
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

              {uploadState.status === 'complete' && (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isBusy}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Receipt Uploaded
                  </Button>
                  <p className="text-xs text-muted-foreground">Click to replace receipt.</p>
                </div>
              )}

              {uploadState.status === 'error' && (
                <div className="space-y-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setUploadState({ status: 'idle' });
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Retry Upload
                  </Button>
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{uploadState.message}</AlertDescription>
                  </Alert>
                </div>
              )}

              {extracted && <ExtractionPreview extracted={extracted} />}
            </CardContent>
          </Card>

          <Separator />

          {/* Item details form */}
          <Card>
            <CardHeader>
              <CardTitle>Item Details</CardTitle>
              <CardDescription>
                Review and complete all fields before saving.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="merchantName">Merchant Name</Label>
                  <Input
                    id="merchantName"
                    value={form.merchantName}
                    onChange={(e) => setForm({ ...form, merchantName: e.target.value })}
                    placeholder="Acme Corp"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="amount">Amount</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={form.currency}
                      onValueChange={(v) => setForm({ ...form, currency: v ?? 'USD' })}
                    >
                      <SelectTrigger id="currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map(({ code, name, flag }) => (
                          <SelectItem key={code} value={code} className="py-2">
                            <span className="text-base leading-none">{flag}</span>
                            <span className="font-medium">{code}</span>
                            <span className="text-muted-foreground">{name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={form.category}
                      onValueChange={(v) => setForm({ ...form, category: v ?? '' })}
                      required
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c} className="py-2">
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="transactionDate">Transaction Date</Label>
                    <Input
                      id="transactionDate"
                      type="date"
                      value={form.transactionDate}
                      onChange={(e) => setForm({ ...form, transactionDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <Button type="submit" disabled={saving || isBusy}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {saving ? 'Saving...' : 'Save Item'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/reports/${reportId}`)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
