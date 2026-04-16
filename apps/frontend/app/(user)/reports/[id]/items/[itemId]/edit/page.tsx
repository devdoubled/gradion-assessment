'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ExpenseItem } from '@/lib/types';
import { CURRENCIES } from '@/lib/currencies';
import { ReceiptUploader } from '@/components/ReceiptUploader';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, AlertCircle, Loader2 } from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string; itemId: string }>;
}

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

export default function EditItemPage({ params }: PageProps) {
  const { id: reportId, itemId } = use(params);
  const router = useRouter();

  const [form, setForm] = useState({
    merchantName: '',
    amount: '',
    currency: 'USD',
    category: '',
    transactionDate: '',
  });
  const [extracted, setExtracted] = useState<NonNullable<ExpenseItem['aiExtracted']> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data: res } = await api.get(`/reports/${reportId}/items`);
        const items: ExpenseItem[] = res.data;
        const item = items.find((i) => i._id === itemId);
        if (!item) {
          setError('Item not found.');
          return;
        }
        setForm({
          merchantName: item.merchantName,
          amount: String(item.amount),
          currency: item.currency,
          category: item.category,
          transactionDate: new Date(item.transactionDate).toISOString().split('T')[0],
        });
        if (item.aiExtracted) setExtracted(item.aiExtracted);
      } catch {
        setError('Failed to load item.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reportId, itemId]);

  function handleExtracted(fields: NonNullable<ExpenseItem['aiExtracted']>) {
    setExtracted(fields);
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
      await api.patch(`/reports/${reportId}/items/${itemId}`, payload);
      router.push(`/reports/${reportId}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message ?? 'Failed to save item';
      setError(Array.isArray(raw) ? raw.join(', ') : raw);
    } finally {
      setSaving(false);
    }
  }

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="border-b border-border bg-white dark:bg-card px-8 py-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => router.push(`/reports/${reportId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Expense Item</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Update details or upload a new receipt.</p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-8">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* Receipt uploader card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Receipt</CardTitle>
              <CardDescription>
                Replace or add a receipt — AI will re-extract and update the fields below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ReceiptUploader itemId={itemId} onExtracted={handleExtracted} />
              {extracted && <ExtractionPreview extracted={extracted} />}
            </CardContent>
          </Card>

          <Separator />

          {/* Item details form */}
          <Card>
            <CardHeader>
              <CardTitle>Item Details</CardTitle>
              <CardDescription>
                All fields are editable — update any values before saving.
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
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {saving ? 'Saving...' : 'Save Changes'}
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
