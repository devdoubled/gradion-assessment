# Frontend Skill — Next.js App Router + TypeScript + Tailwind + shadcn/ui

> Claude Code reads this file before generating any frontend code.
> Every pattern here is the single correct way to do that thing in this project.
> Do not deviate. Do not invent alternatives.
> UI must be **professional, polished, and beautiful** — reference modern SaaS dashboards
> (Linear, Vercel, Notion, Stripe). Never ship plain or unstyled UI.

---

## 0. UI Design System — Non-Negotiable

This project uses **shadcn/ui** as the component library. Every UI element must use
shadcn components. Never use raw HTML inputs, buttons, or divs where a shadcn
component exists.

### Design principles
- **Clean, spacious layouts** — generous padding, breathable whitespace
- **Consistent typography** — Inter via `next/font/google`, clear hierarchy
- **Subtle depth** — soft shadows (`shadow-sm`), not flat
- **Purposeful color** — neutral base (zinc/slate), one brand accent (indigo)
- **Microinteractions** — hover states, loading spinners, smooth transitions
- **Empty states** — never show a blank screen; always show an icon + message
- **Skeleton loading** — use `Skeleton` from shadcn while data loads

### Color palette (Tailwind v4 CSS variables via shadcn)
```
Primary action:   bg-primary (indigo)
Destructive:      bg-destructive (red)
Muted text:       text-muted-foreground
Card background:  bg-card
Border:           border-border
Input:            bg-input
```

### Typography scale
```
Page title:        text-2xl font-bold tracking-tight
Section heading:   text-lg font-semibold
Card title:        text-base font-semibold
Body:              text-sm text-muted-foreground
Label:             text-sm font-medium
Micro:             text-xs text-muted-foreground
```

### Layout structure
All authenticated pages use a **sidebar + main content** shell:
```
┌─────────────────────────────────────────────────┐
│  Sidebar (w-64, fixed)  │  Main content area     │
│  - Logo + app name      │  - Page header          │
│  - Nav links            │  - Breadcrumb (optional)│
│  - User info at bottom  │  - Content              │
└─────────────────────────────────────────────────┘
```

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
│   ├── layout.tsx       ← auth guard + sidebar shell
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
    ├── layout.tsx       ← admin auth guard + admin sidebar shell
    └── admin/
        └── reports/
            └── page.tsx ← /admin/reports
```

Rules:
- Route group folders `(name)` do not appear in the URL
- `layout.tsx` wraps all children and persists across navigations
- Auth guards AND the sidebar shell live in `layout.tsx`, never in `page.tsx`
- `params` is a **Promise** in Next.js 16 — always `await params` in async pages

---

## 2. shadcn/ui Setup

shadcn/ui is initialized with:
```bash
pnpm dlx shadcn@latest init
```

Components are added with:
```bash
pnpm dlx shadcn@latest add <component-name>
```

Import from `@/components/ui/<component>`:
```typescript
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
```

Icons come from **lucide-react** (ships with shadcn):
```typescript
import {
  FileText, Plus, Send, CheckCircle2, XCircle, Clock,
  Receipt, Pencil, Trash2, ChevronRight, LogOut,
  LayoutDashboard, Users, BarChart3, Loader2,
  AlertCircle, Upload, Sparkles, ArrowLeft,
} from 'lucide-react';
```

---

## 3. Component Classification

**Server Component** (default — no `'use client'`):
- Read-only data display, no hooks, no browser APIs
- Fetches data directly (can be async)

**Client Component** (`'use client'` at top):
- Needs useState, useEffect, useReducer, event handlers, browser APIs

Rule: push `'use client'` as deep as possible. Pages should be Server Components
that import isolated Client Component islands for interactivity.

---

## 4. API Client (`lib/api.ts`)

Single axios instance. Never call `fetch` directly in components.

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

The response envelope from the backend is:
```typescript
{ status: number, message: string, messageCode: string, data: T }
```
Always unwrap via `response.data.data` to get the actual payload.

---

## 5. Auth Helpers (`lib/auth.ts`)

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
  try { return jwtDecode<JwtPayload>(token).role; } catch { return null; }
}
export function getUserEmail(): string | null {
  const token = getToken();
  if (!token) return null;
  try { return jwtDecode<JwtPayload>(token).email; } catch { return null; }
}
export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    return decoded.exp * 1000 > Date.now();
  } catch { return false; }
}
```

---

## 6. Layout Auth Guard + Sidebar Shell

Both layouts must be Client Components. They do two jobs:
1. Auth guard (redirect if not authenticated / wrong role)
2. Render the sidebar shell that wraps all child pages

```typescript
// app/(user)/layout.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { isAuthenticated, getRole, getUserEmail, clearToken } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { FileText, Plus, LogOut, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/reports',     label: 'My Reports', icon: FileText },
  { href: '/reports/new', label: 'New Report',  icon: Plus     },
];

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated()) { router.replace('/login'); return; }
    if (getRole() === 'admin') router.replace('/admin/reports');
  }, [router]);

  if (!isAuthenticated()) return null;

  const email = getUserEmail() ?? '';

  return (
    <div className="flex h-screen bg-zinc-50">
      {/* Sidebar */}
      <aside className="flex flex-col w-64 border-r border-border bg-white shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 px-6 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-tight">ExpenseFlow</span>
        </div>
        <Separator />
        {/* Nav */}
        <nav className="flex flex-col gap-1 p-3 flex-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                pathname === href || (href !== '/reports/new' && pathname.startsWith(href))
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <Separator />
        {/* User */}
        <div className="flex items-center gap-3 px-4 py-4">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {email.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-medium truncate">{email}</span>
            <span className="text-xs text-muted-foreground">User</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => { clearToken(); router.replace('/login'); }}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex flex-col flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
```

---

## 7. Form Pattern — shadcn/ui

All forms use shadcn `Input`, `Label`, `Button`, `Textarea`. Never raw HTML inputs.

```typescript
'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

export default function NewReportPage() {
  const router = useRouter();
  const [form, setForm] = useState({ title: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data: res } = await api.post('/reports', form);
      router.push(`/reports/${res.data._id}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
      const raw = axiosErr?.response?.data?.message ?? 'Something went wrong';
      setError(Array.isArray(raw) ? raw.join(', ') : raw);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="Q1 Travel Expenses"
          required
        />
      </div>
      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? 'Creating...' : 'Create Report'}
      </Button>
    </form>
  );
}
```

Rules:
- Always `e.preventDefault()` in form submit handlers
- Always show loading with `<Loader2 className="animate-spin" />` inside Button
- Always show errors with `<Alert variant="destructive">`
- Always clear `error` at the start of each submission
- Unwrap backend response as `res.data` (envelope: `{ data: T }`)

---

## 8. StatusBadge Component

Use shadcn `Badge` with semantic variants and lucide icons:

```typescript
// components/StatusBadge.tsx
import { Badge } from '@/components/ui/badge';
import { Clock, Send, CheckCircle2, XCircle } from 'lucide-react';
import { ReportStatus } from '@/lib/types';

const CONFIG: Record<ReportStatus, {
  label: string;
  variant: 'secondary' | 'default' | 'outline' | 'destructive';
  icon: React.ElementType;
  className: string;
}> = {
  DRAFT:     { label: 'Draft',     variant: 'secondary',   icon: Clock,         className: 'text-zinc-600' },
  SUBMITTED: { label: 'Submitted', variant: 'default',     icon: Send,          className: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' },
  APPROVED:  { label: 'Approved',  variant: 'outline',     icon: CheckCircle2,  className: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50' },
  REJECTED:  { label: 'Rejected',  variant: 'destructive', icon: XCircle,       className: '' },
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
```

---

## 9. ReceiptUploader Component

Five-state discriminated union. Use shadcn `Button`, `Alert`, lucide icons.

```typescript
'use client';
// See section 8 of old SKILL.md for state machine logic.
// UI: use shadcn Button for trigger, Alert for errors, Badge for success state.
// Show animated Loader2 icon during uploading/extracting states.
// Show Sparkles icon when extraction is complete.
// Show Upload icon in idle state.
```

Full implementation:
- `idle`       → Button with `<Upload>` icon: "Upload Receipt"
- `uploading`  → Button disabled with `<Loader2 animate-spin>`: "Uploading..."
- `extracting` → Button disabled with `<Loader2 animate-spin>` + Alert info: "Extracting with AI..."
- `complete`   → Button with `<Sparkles>` in green variant: "Receipt Uploaded" + green Alert
- `error`      → Button "Retry Upload" + `<Alert variant="destructive">`

---

## 10. Page Shell Pattern

Every authenticated page follows this exact shell:

```typescript
// Page header
<div className="border-b border-border bg-white px-8 py-6">
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Page Title</h1>
      <p className="text-sm text-muted-foreground mt-0.5">Subtitle or description</p>
    </div>
    <div className="flex items-center gap-3">
      {/* Action buttons */}
    </div>
  </div>
</div>

// Page body
<div className="p-8 space-y-6">
  {/* Content */}
</div>
```

Form pages (new report, new item, edit item) use a **centered card** shell:
```typescript
<div className="border-b border-border bg-white px-8 py-6">
  {/* Back button + title */}
</div>
<div className="p-8">
  <div className="max-w-2xl mx-auto">
    <Card>
      <CardHeader>
        <CardTitle>Form Title</CardTitle>
        <CardDescription>Helper text</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Form */}
      </CardContent>
    </Card>
  </div>
</div>
```

---

## 11. Loading Skeleton Pattern

Every data-fetching page must show skeletons while loading:

```typescript
// In a Client Component while data is null/loading:
if (loading) {
  return (
    <div className="p-8 space-y-4">
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="space-y-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

---

## 12. Empty State Pattern

Every list page must show a friendly empty state when there is no data:

```typescript
// When list is empty:
<div className="flex flex-col items-center justify-center py-20 text-center">
  <div className="rounded-full bg-muted p-4 mb-4">
    <FileText className="h-8 w-8 text-muted-foreground" />
  </div>
  <h3 className="text-base font-semibold mb-1">No reports yet</h3>
  <p className="text-sm text-muted-foreground mb-6 max-w-xs">
    Create your first expense report to get started.
  </p>
  <Button asChild>
    <Link href="/reports/new">
      <Plus className="mr-2 h-4 w-4" />
      New Report
    </Link>
  </Button>
</div>
```

---

## 13. Table Pattern — shadcn/ui

Always use shadcn `Table` components. Add hover state and clickable rows.

```typescript
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';

<div className="rounded-lg border border-border overflow-hidden">
  <Table>
    <TableHeader>
      <TableRow className="bg-muted/50 hover:bg-muted/50">
        <TableHead className="font-semibold text-foreground">Merchant</TableHead>
        <TableHead className="font-semibold text-foreground">Amount</TableHead>
        <TableHead className="font-semibold text-foreground">Date</TableHead>
        <TableHead className="w-24" />
      </TableRow>
    </TableHeader>
    <TableBody>
      {items.map((item) => (
        <TableRow key={item._id} className="cursor-pointer hover:bg-muted/30">
          <TableCell className="font-medium">{item.merchantName}</TableCell>
          <TableCell>{item.currency} {item.amount.toFixed(2)}</TableCell>
          <TableCell className="text-muted-foreground">
            {new Date(item.transactionDate).toLocaleDateString()}
          </TableCell>
          <TableCell>
            {/* Actions */}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

---

## 14. Error Handling Pattern

```typescript
} catch (err: unknown) {
  const axiosErr = err as { response?: { data?: { message?: string | string[] } } };
  const raw = axiosErr?.response?.data?.message ?? 'Something went wrong';
  setError(Array.isArray(raw) ? raw.join(', ') : raw);
}
```

Always display with `<Alert variant="destructive">`, never raw text.
Always `setError(null)` at the start of each new submission.

---

## 15. TypeScript Types (`lib/types.ts`)

```typescript
export type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface User {
  _id: string; email: string; role: 'user' | 'admin';
  createdAt: string; updatedAt: string;
}

export interface ExpenseReport {
  _id: string; userId: string | { _id: string; email: string };
  title: string; description: string;
  status: ReportStatus; totalAmount: number;
  createdAt: string; updatedAt: string;
}

export interface ExpenseItem {
  _id: string; reportId: string;
  amount: number; currency: string; category: string;
  merchantName: string; transactionDate: string;
  receiptUrl: string | null;
  aiExtracted: {
    merchantName: string | null; amount: number | null;
    currency: string | null; transactionDate: string | null;
  } | null;
  createdAt: string; updatedAt: string;
}

export interface AuthResponse { accessToken: string; }
```

---

## 16. Navigation Patterns

```typescript
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Programmatic (after async action)
router.push(`/reports/${id}`);   // forward
router.replace('/login');        // redirect (no history entry)
router.back();                   // cancel

// Static links — use Button asChild for styled links:
<Button variant="ghost" size="sm" asChild>
  <Link href={`/reports/${id}`}>View</Link>
</Button>

// Back button at top of form pages:
<Button variant="ghost" size="sm" onClick={() => router.back()}>
  <ArrowLeft className="mr-2 h-4 w-4" />
  Back
</Button>
```

---

## 17. Key shadcn Components to Use Per Page

| Page | Key shadcn components |
|---|---|
| Login / Signup | Card, Input, Label, Button, Alert, Separator |
| Report list | Card, Badge, Button, Skeleton, Table, Tabs |
| New report | Card, Input, Textarea, Label, Button, Alert |
| Report detail | Card, Badge, Button, Table, Separator, Dialog |
| New/edit item | Card, Input, Label, Button, Alert, Select |
| Admin reports | Card, Badge, Button, Table, Tabs, Dialog |

---

## 18. Common Mistakes to Avoid

| Mistake | Correct approach |
|---|---|
| Raw `<input>` / `<button>` HTML | Use shadcn `Input` / `Button` always |
| Plain error text | Use `<Alert variant="destructive">` |
| Blank loading state | Use shadcn `Skeleton` |
| No empty state | Always show icon + message + CTA |
| `'use client'` on every component | Only add when component needs hooks/events |
| `fetch` directly in components | Always use `api` from `lib/api.ts` |
| `response.data` directly | Unwrap envelope: `response.data.data` |
| `router.push('/login')` for redirects | Use `router.replace('/login')` |
| `any` type on responses | Import from `@/lib/types` |
| `params` accessed synchronously | Always `await params` — it's a Promise in Next.js 16 |
| Missing `disabled` on submit buttons | Always disable while `loading === true` |
| Optimistic UI updates | Always confirm from server before updating state |
