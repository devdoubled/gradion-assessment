# Frontend Skill — Next.js 14 App Router + TypeScript + Tailwind

> Claude Code reads this file before generating any frontend code.
> Every pattern here is the single correct way to do that thing in this project.
> Do not deviate. Do not invent alternatives.

---

## 1. App Router File Conventions

```
app/
├── (auth)/              ← route group, no URL segment
│   ├── login/
│   │   └── page.tsx     ← /login
│   └── signup/
│       └── page.tsx     ← /signup
├── (user)/
│   ├── layout.tsx       ← wraps all /reports/* routes, auth guard lives here
│   └── reports/
│       ├── page.tsx     ← /reports
│       ├── new/
│       │   └── page.tsx ← /reports/new
│       └── [id]/
│           ├── page.tsx ← /reports/:id
│           └── items/
│               ├── new/page.tsx
│               └── [itemId]/edit/page.tsx
└── (admin)/
    ├── layout.tsx       ← admin auth guard lives here
    └── admin/
        └── reports/
            └── page.tsx ← /admin/reports
```

Rules:
- Route group folders `(name)` do not appear in the URL
- `layout.tsx` wraps all children and persists across navigations
- `page.tsx` is the unique UI for that route
- Auth guards live in `layout.tsx`, never in `page.tsx`

---

## 2. Component Classification

Decide the rendering strategy before writing any component.

**Server Component** (default — no `'use client'`):
- Read-only data display
- No useState, useEffect, or browser APIs
- No event handlers
- Fetches data directly (can be async)

```typescript
// app/(user)/reports/page.tsx — Server Component
import { cookies } from 'next/headers';
import { ReportCard } from '@/components/ReportCard';

async function getReports(token: string) {
  const res = await fetch(`${process.env.API_URL}/reports`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to fetch reports');
  return res.json();
}

export default async function ReportsPage() {
  const token = cookies().get('token')?.value ?? '';
  const reports = await getReports(token);

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <ReportCard key={report._id} report={report} />
      ))}
    </div>
  );
}
```

**Client Component** (`'use client'` at top):
- Needs useState, useEffect, useReducer
- Has event handlers (onClick, onChange, onSubmit)
- Uses browser APIs (localStorage, window)
- Uses hooks from external libraries

```typescript
'use client';
// components/ReceiptUploader.tsx — Client Component
import { useState } from 'react';
```

Rule: push `'use client'` as deep as possible. A page can be a Server Component
that imports a single Client Component form. Do not make entire pages client-side
unless the whole page is interactive.

---

## 3. API Client (`lib/api.ts`)

Single axios instance used everywhere. Never call `fetch` directly in components.

```typescript
// lib/api.ts
import axios from 'axios';
import { getToken, clearToken } from './auth';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
```

---

## 4. Auth Helpers (`lib/auth.ts`)

```typescript
// lib/auth.ts
import { jwtDecode } from 'jwt-decode';

interface JwtPayload {
  sub: string;
  email: string;
  role: 'user' | 'admin';
  exp: number;
}

const TOKEN_KEY = 'accessToken';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getRole(): 'user' | 'admin' | null {
  const token = getToken();
  if (!token) return null;
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    return decoded.role;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    return decoded.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}
```

---

## 5. Layout Auth Guard Pattern

Both `(user)/layout.tsx` and `(admin)/layout.tsx` must be Client Components
because they use `localStorage`.

```typescript
// app/(user)/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getRole } from '@/lib/auth';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login');
      return;
    }
    if (getRole() === 'admin') {
      router.replace('/admin/reports');
    }
  }, [router]);

  if (!isAuthenticated()) return null;

  return <>{children}</>;
}
```

```typescript
// app/(admin)/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated, getRole } from '@/lib/auth';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated() || getRole() !== 'admin') {
      router.replace('/login');
    }
  }, [router]);

  if (!isAuthenticated() || getRole() !== 'admin') return null;

  return <>{children}</>;
}
```

---

## 6. Form Pattern

All forms are Client Components. Use controlled inputs with `useState`.
Never use uncontrolled inputs or `ref` to read form values.

```typescript
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface FormState {
  title: string;
  description: string;
}

export default function NewReportPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ title: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post('/reports', form);
      router.push(`/reports/${data._id}`);
    } catch (err: unknown) {
      const msg = err?.response?.data?.message ?? 'Something went wrong';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          type="text"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm
                   hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Creating...' : 'Create Report'}
      </button>
    </form>
  );
}
```

Rules:
- Always `e.preventDefault()` in form submit handlers
- Always show a loading state while the API call is in flight
- Always show error state if the API call fails
- Extract error message from `err.response.data.message` (can be string or array)

---

## 7. StatusBadge Component

```typescript
// components/StatusBadge.tsx
type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

const STATUS_STYLES: Record<ReportStatus, string> = {
  DRAFT:     'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-100 text-blue-700',
  APPROVED:  'bg-green-100 text-green-700',
  REJECTED:  'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  DRAFT:     'Draft',
  SUBMITTED: 'Submitted',
  APPROVED:  'Approved',
  REJECTED:  'Rejected',
};

interface StatusBadgeProps {
  status: ReportStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full
                      text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
```

---

## 8. ReceiptUploader Component

Manages the five-state extraction lifecycle with explicit discriminated union.
Never infer state from boolean flags.

```typescript
'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { api } from '@/lib/api';

export interface ExtractedFields {
  merchantName:    string | null;
  amount:          number | null;
  currency:        string | null;
  transactionDate: string | null;
}

type ExtractionState =
  | { status: 'idle' }
  | { status: 'uploading' }
  | { status: 'extracting' }
  | { status: 'complete'; extracted: ExtractedFields }
  | { status: 'error'; message: string };

interface ReceiptUploaderProps {
  itemId: string;
  onExtracted: (fields: ExtractedFields) => void;
}

export function ReceiptUploader({ itemId, onExtracted }: ReceiptUploaderProps) {
  const [state, setState] = useState<ExtractionState>({ status: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setState({ status: 'uploading' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      setState({ status: 'extracting' });

      const { data } = await api.post(`/items/${itemId}/receipt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const extracted: ExtractedFields = data.aiExtracted ?? {
        merchantName: null, amount: null, currency: null, transactionDate: null,
      };

      setState({ status: 'complete', extracted });
      onExtracted(extracted);
    } catch (err: unknown) {
      const message = err?.response?.data?.message ?? 'Upload failed';
      setState({ status: 'error', message });
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={handleFileChange}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={state.status === 'uploading' || state.status === 'extracting'}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm
                   hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state.status === 'idle' && 'Upload Receipt'}
        {state.status === 'uploading' && 'Uploading...'}
        {state.status === 'extracting' && 'Extracting data...'}
        {state.status === 'complete' && 'Receipt uploaded ✓'}
        {state.status === 'error' && 'Retry Upload'}
      </button>

      {state.status === 'extracting' && (
        <p className="text-xs text-blue-600 flex items-center gap-1">
          <span className="inline-block w-3 h-3 border-2 border-blue-600
                           border-t-transparent rounded-full animate-spin" />
          Extracting receipt data with AI...
        </p>
      )}

      {state.status === 'complete' && (
        <p className="text-xs text-green-600">
          Fields pre-filled from receipt. Review and edit before saving.
        </p>
      )}

      {state.status === 'error' && (
        <p className="text-xs text-red-600">{state.message}</p>
      )}
    </div>
  );
}
```

---

## 9. Item Form with Extraction Pre-fill

```typescript
'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ReceiptUploader, ExtractedFields } from '@/components/ReceiptUploader';

interface ItemFormProps {
  reportId: string;
  itemId?: string;          // present when editing
  initialValues?: Partial<ItemFormValues>;
}

interface ItemFormValues {
  amount:          string;
  currency:        string;
  category:        string;
  merchantName:    string;
  transactionDate: string;
}

const EMPTY_FORM: ItemFormValues = {
  amount: '', currency: 'USD', category: '',
  merchantName: '', transactionDate: '',
};

export function ItemForm({ reportId, itemId, initialValues }: ItemFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<ItemFormValues>({
    ...EMPTY_FORM,
    ...initialValues,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill from AI extraction
  function handleExtracted(fields: ExtractedFields) {
    setForm((prev) => ({
      ...prev,
      merchantName:    fields.merchantName    ?? prev.merchantName,
      amount:          fields.amount != null  ? String(fields.amount) : prev.amount,
      currency:        fields.currency        ?? prev.currency,
      transactionDate: fields.transactionDate
        ? fields.transactionDate.slice(0, 10)  // ISO date → YYYY-MM-DD for input[type=date]
        : prev.transactionDate,
    }));
  }

  function set(field: keyof ItemFormValues) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = { ...form, amount: parseFloat(form.amount) };
      if (itemId) {
        await api.patch(`/reports/${reportId}/items/${itemId}`, payload);
      } else {
        await api.post(`/reports/${reportId}/items`, payload);
      }
      router.push(`/reports/${reportId}`);
    } catch (err: unknown) {
      const msg = err?.response?.data?.message ?? 'Failed to save item';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {/* Receipt uploader — only shown for new items (no itemId yet) */}
      {!itemId && (
        <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-sm text-gray-600 mb-2">
            Upload a receipt to auto-fill the fields below.
          </p>
          {/* Note: itemId not available until item is created.
              Alternative: create item first (draft), then upload receipt.
              For simplicity: upload is available on edit page after creation. */}
        </div>
      )}

      {/* Receipt uploader on edit page — item already exists */}
      {itemId && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium text-gray-700 mb-2">Receipt</p>
          <ReceiptUploader itemId={itemId} onExtracted={handleExtracted} />
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Amount
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={set('amount')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Currency
          </label>
          <input
            type="text"
            value={form.currency}
            onChange={set('currency')}
            placeholder="USD"
            maxLength={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Merchant
        </label>
        <input
          type="text"
          value={form.merchantName}
          onChange={set('merchantName')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Category
        </label>
        <input
          type="text"
          value={form.category}
          onChange={set('category')}
          placeholder="Transport, Meals, Accommodation..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Date
        </label>
        <input
          type="date"
          value={form.transactionDate}
          onChange={set('transactionDate')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm
                     hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : itemId ? 'Save Changes' : 'Add Item'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg
                     text-sm hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
```

---

## 10. Tailwind Class Conventions

Consistent classes used throughout the project. Always use these — do not invent
new patterns for the same element type.

```
Page wrapper:         className="p-6 max-w-4xl mx-auto"
Section heading:      className="text-xl font-semibold text-gray-900 mb-4"
Card:                 className="bg-white border border-gray-200 rounded-xl p-4"
Table wrapper:        className="overflow-x-auto"
Table:                className="w-full text-sm text-left"
Table header row:     className="border-b border-gray-200"
Table header cell:    className="px-4 py-3 font-medium text-gray-500 uppercase text-xs"
Table body row:       className="border-b border-gray-100 hover:bg-gray-50"
Table body cell:      className="px-4 py-3 text-gray-700"
Primary button:       className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
Secondary button:     className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
Danger button:        className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
Text input:           className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
Error message:        className="p-3 bg-red-50 text-red-700 rounded-lg text-sm"
Success message:      className="p-3 bg-green-50 text-green-700 rounded-lg text-sm"
Empty state:          className="text-center py-12 text-gray-400 text-sm"
Loading spinner:      className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
```

---

## 11. Error Handling Pattern

Always handle API errors the same way across all components:

```typescript
} catch (err: unknown) {
  const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
  const raw = axiosErr?.response?.data?.message ?? 'Something went wrong';
  setError(Array.isArray(raw) ? raw.join(', ') : raw);
}
```

Never show raw `err.message` to users — it leaks implementation details.
Always show `error` state in the UI when it is non-null.
Always clear `error` at the start of a new submission attempt.

---

## 12. Navigation Patterns

```typescript
// Programmatic navigation after async action
const router = useRouter();
router.push(`/reports/${id}`);     // navigate forward
router.replace('/login');          // redirect (no back history entry)
router.back();                     // cancel / go back

// Link component for static navigation
import Link from 'next/link';
<Link href={`/reports/${id}`} className="text-blue-600 hover:underline text-sm">
  View Report
</Link>
```

Use `router.replace` for auth redirects (login, unauthorized).
Use `router.push` after successful form submissions.
Use `<Link>` for all static navigation in lists and cards.

---

## 13. Data Fetching Patterns

**From a Server Component page** (preferred for read-only data):

```typescript
// Direct fetch with Authorization header from cookie
async function getData(path: string, token: string) {
  const res = await fetch(`${process.env.API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

**From a Client Component** (for interactive pages with mutations):

```typescript
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  api.get('/reports')
    .then(({ data }) => setData(data))
    .catch(() => setError('Failed to load'))
    .finally(() => setLoading(false));
}, []);
```

**After a mutation, refresh data by:**
- Calling `router.refresh()` to revalidate Server Component data
- Or re-fetching the specific resource with `api.get(...)` and calling `setState`
- Never mutate local state optimistically without a server confirmation

---

## 14. TypeScript Types

Define all API response types in `lib/types.ts`:

```typescript
// lib/types.ts

export type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface User {
  _id: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseReport {
  _id: string;
  userId: string;
  title: string;
  description: string;
  status: ReportStatus;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseItem {
  _id: string;
  reportId: string;
  amount: number;
  currency: string;
  category: string;
  merchantName: string;
  transactionDate: string;
  receiptUrl: string | null;
  aiExtracted: {
    merchantName: string | null;
    amount: number | null;
    currency: string | null;
    transactionDate: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
}
```

Always import types from `@/lib/types` — never re-declare inline.

---

## 15. Common Mistakes to Avoid

| Mistake | Correct approach |
|---|---|
| `'use client'` on every component | Only add when component uses hooks or events |
| Reading form values with `ref` | Use controlled inputs with `useState` |
| Calling `fetch` directly in components | Always use `api` from `lib/api.ts` |
| Showing `err.message` to users | Extract from `err.response.data.message` |
| Optimistic UI updates | Always confirm from server before updating state |
| `router.push('/login')` for auth redirect | Use `router.replace('/login')` |
| Inlining Tailwind class strings | Use the class conventions in section 10 |
| `any` type on API responses | Import from `lib/types.ts` |
| Re-declaring types already in lib/types.ts | Always import from `@/lib/types` |
| Missing `disabled` state on submit buttons | Always disable while `loading === true` |
| Not clearing error before new submission | Always `setError(null)` at start of submit handler |