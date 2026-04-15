# Architecture — Gradion Expense Report System

> **Purpose:** Primary architectural reference for Claude Code during implementation
> and AI-assisted architecture artifact for the assessment submission.
> All structural decisions are documented here with rationale.

---

## 1. System Overview

The system is a full-stack web application for submitting, reviewing, and approving expense reports. Two actor types exist — regular users who create and submit reports, and admins who review and act on them.

Core domain complexity lives in three places:
- The **state machine** governing report lifecycle
- The **authorization model** combining JWT authentication with ownership scoping
- The **AI extraction pipeline** that processes receipt images/PDFs via Claude vision

```
Browser (User / Admin)
        │
        ▼
┌───────────────────────────────────┐
│     Next.js 14 (App Router)       │  port 3000
│  SSR pages + client components    │
│  apps/frontend/                   │
└──────────────┬────────────────────┘
               │ REST/JSON
               ▼
┌───────────────────────────────────┐
│         NestJS API                │  port 3001
│  apps/backend/                    │
│                                   │
│  ┌────────┐  ┌─────────────────┐  │
│  │  Auth  │  │    Reports      │  │
│  │ module │  │    module       │  │
│  └────────┘  └─────────────────┘  │
│  ┌─────────┐  ┌────────────────┐  │
│  │  Items  │  │    Uploads     │  │
│  │  module │  │    module      │  │
│  └─────────┘  └────────────────┘  │
│  ┌─────────────────────────────┐  │
│  │        Admin module         │  │
│  └─────────────────────────────┘  │
└──────────┬──────────────┬─────────┘
           │              │
    ┌──────▼──────┐  ┌────▼────────┐
    │   MongoDB   │  │    MinIO    │
    │  port 27017 │  │  port 9000  │
    └─────────────┘  └──────┬──────┘
                            │ base64 file
                    ┌───────▼───────┐
                    │ Anthropic API │
                    │ Claude vision │
                    └───────────────┘
```

---

## 2. Monorepo Layout

```
gradion-assessment/
├── apps/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── roles.guard.ts
│   │   │   │   └── dto/
│   │   │   │       ├── signup.dto.ts
│   │   │   │       └── login.dto.ts
│   │   │   ├── reports/
│   │   │   │   ├── reports.module.ts
│   │   │   │   ├── reports.controller.ts
│   │   │   │   ├── reports.service.ts
│   │   │   │   ├── report-state-machine.ts
│   │   │   │   ├── report-state-machine.spec.ts
│   │   │   │   ├── schemas/
│   │   │   │   │   └── report.schema.ts
│   │   │   │   └── dto/
│   │   │   │       ├── create-report.dto.ts
│   │   │   │       └── update-report.dto.ts
│   │   │   ├── items/
│   │   │   │   ├── items.module.ts
│   │   │   │   ├── items.controller.ts
│   │   │   │   ├── items.service.ts
│   │   │   │   ├── items.service.spec.ts
│   │   │   │   ├── schemas/
│   │   │   │   │   └── item.schema.ts
│   │   │   │   └── dto/
│   │   │   │       ├── create-item.dto.ts
│   │   │   │       └── update-item.dto.ts
│   │   │   ├── uploads/
│   │   │   │   ├── uploads.module.ts
│   │   │   │   ├── uploads.controller.ts
│   │   │   │   ├── uploads.service.ts
│   │   │   │   └── extraction.service.ts
│   │   │   ├── admin/
│   │   │   │   ├── admin.module.ts
│   │   │   │   ├── admin.controller.ts
│   │   │   │   └── admin.service.ts
│   │   │   └── common/
│   │   │       ├── decorators/
│   │   │       │   ├── roles.decorator.ts
│   │   │       │   └── public.decorator.ts
│   │   │       ├── filters/
│   │   │       │   └── http-exception.filter.ts
│   │   │       ├── interceptors/
│   │   │       │   └── transform.interceptor.ts
│   │   │       └── pipes/
│   │   │           └── validation.pipe.ts
│   │   ├── test/
│   │   │   └── app.e2e-spec.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsconfig.build.json
│   │   └── nest-cli.json
│   └── frontend/
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/
│       │   │   │   └── page.tsx
│       │   │   └── signup/
│       │   │       └── page.tsx
│       │   ├── (user)/
│       │   │   ├── layout.tsx
│       │   │   └── reports/
│       │   │       ├── page.tsx
│       │   │       ├── new/
│       │   │       │   └── page.tsx
│       │   │       └── [id]/
│       │   │           ├── page.tsx
│       │   │           └── items/
│       │   │               ├── new/
│       │   │               │   └── page.tsx
│       │   │               └── [itemId]/
│       │   │                   └── edit/
│       │   │                       └── page.tsx
│       │   └── (admin)/
│       │       ├── layout.tsx
│       │       └── admin/
│       │           └── reports/
│       │               └── page.tsx
│       ├── components/
│       │   ├── StatusBadge.tsx
│       │   ├── ReportCard.tsx
│       │   ├── ReceiptUploader.tsx
│       │   ├── ExtractionPreview.tsx
│       │   └── SubmitButton.tsx
│       ├── lib/
│       │   ├── api.ts
│       │   └── auth.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── next.config.ts
├── docs/
│   ├── architecture.md          ← this file
│   └── plan.md
├── .claude/
│   └── commands/
│       ├── next-task.md
│       ├── implement-module.md
│       └── write-tests.md
├── CLAUDE.md
├── DECISIONS.md
├── README.md
├── docker-compose.yml
├── .env.example
├── pnpm-workspace.yaml
└── package.json
```

---

## 3. Tech Stack Decisions

### NestJS (backend)

NestJS enforces the separation of concerns that this assessment explicitly evaluates — modules, guards, services, and controllers are first-class architectural concepts. Business logic is structurally prevented from leaking into controllers. The opinionated structure also speeds up scaffolding considerably in a time-boxed exercise.

TypeScript throughout both apps eliminates a class of runtime errors and enables confident refactoring, particularly important for the state machine and authorization logic where correctness is non-negotiable.

### Next.js 14 App Router (frontend)

The App Router's route group layout system (`(user)/layout.tsx`, `(admin)/layout.tsx`) makes it clean to implement the user vs. admin split as separate authenticated trees. Server Components handle data-heavy read views cheaply; Client Components handle interactive forms and the AI extraction loading state. No separate hosting needed — it runs alongside the backend in docker-compose.

### MongoDB + Mongoose

The expense report domain maps naturally to documents. A report owns its items, and the dominant read pattern is "give me this report and all its items" — a pattern that fits document storage well. MongoDB's flexible schema also accommodates the `aiExtracted` sub-document on items without a migration concern.

**Trade-off:** PostgreSQL would give stricter referential integrity and easier ad-hoc aggregation. For this scope, MongoDB's simplicity and Mongoose's ergonomics win. If cross-report analytics or complex joins were required, the trade-off reverses.

### MinIO (file storage)

S3-compatible API locally — switching to AWS S3 in production is a one-line config change. No cloud dependency during development or assessment review.

### Anthropic Claude API (AI extraction)

Claude's vision capability handles both PDF and image receipts natively without a separate OCR pipeline. The model returns structured JSON; fields that cannot be determined with confidence are returned as `null`, which the UI surfaces as empty pre-fill rather than a confident wrong value.

### Synchronous extraction

The upload endpoint calls the Anthropic API, awaits the result, and returns extracted fields in the same HTTP response. The frontend shows an explicit loading state during this window (~2–4 seconds). An async queue approach (BullMQ + Redis) would be more scalable and resilient but adds substantial complexity not justified for this scope. This decision is documented explicitly in `DECISIONS.md`.

### pnpm workspaces (monorepo)

Single repository, single Git history, shared tooling. `apps/backend` and `apps/frontend` are independent workspaces with their own `package.json` and `node_modules`. The root `package.json` contains only dev orchestration scripts (`dev`, `test`) and `concurrently` as the sole root dependency.

---

## 4. Data Models

### User

```typescript
{
  _id:          ObjectId
  email:        string          // unique index
  passwordHash: string          // select: false — excluded from all queries by default
  role:         'user' | 'admin'
  createdAt:    Date
  updatedAt:    Date
}
```

### ExpenseReport

```typescript
{
  _id:          ObjectId
  userId:       ObjectId        // ref: 'User' — owner
  title:        string
  description:  string
  status:       'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'
  totalAmount:  number          // computed — never accepted from client
  createdAt:    Date
  updatedAt:    Date
}
```

`totalAmount` is a stored computed field. It is recalculated by `ItemsService`
on every item `create`, `update`, and `delete` using a MongoDB `$sum` aggregation
piped back into the parent report via `findByIdAndUpdate`. This makes list-view
reads fast (no aggregation at read time) and avoids N+1 queries. Drift is
prevented by never accepting `totalAmount` as input anywhere in the API.

### ExpenseItem

```typescript
{
  _id:             ObjectId
  reportId:        ObjectId       // ref: 'ExpenseReport'
  amount:          number
  currency:        string         // ISO 4217 e.g. 'USD', 'VND', 'EUR'
  category:        string
  merchantName:    string
  transactionDate: Date
  receiptUrl:      string | null  // MinIO object key
  aiExtracted: {                  // raw LLM output — stored for audit
    merchantName:    string | null
    amount:          number | null
    currency:        string | null
    transactionDate: string | null  // ISO 8601 string from LLM
  } | null
  createdAt:    Date
  updatedAt:    Date
}
```

`aiExtracted` stores the raw extraction result regardless of what the user
saves on the top-level fields. This allows future audit or confidence comparison.

---

## 5. State Machine

Implemented as a pure module — no Mongoose imports, no HTTP, no side effects.
This makes every transition trivially unit-testable in isolation.

```typescript
// apps/backend/src/reports/report-state-machine.ts

export type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export const VALID_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  DRAFT:     ['SUBMITTED'],
  SUBMITTED: ['APPROVED', 'REJECTED'],
  APPROVED:  [],                     // terminal — no exits
  REJECTED:  ['DRAFT'],
};

export function canTransition(from: ReportStatus, to: ReportStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ReportStatus, to: ReportStatus): void {
  if (!canTransition(from, to)) {
    throw new BadRequestException(
      `Invalid status transition: ${from} → ${to}`
    );
  }
}
```

`ReportsService` calls `assertTransition` before every `findOneAndUpdate`.
No controller, guard, or other service calls this function directly.

**REJECTED → re-submit:** Users transition `REJECTED → DRAFT` (via edit or
explicit reset), then call the submit endpoint (`DRAFT → SUBMITTED`). Direct
`REJECTED → SUBMITTED` is not allowed. This forces the user to consciously
re-confirm their edits before re-entering the admin queue and produces a cleaner
audit trail with a visible DRAFT state between rejections.

---

## 6. Authorization Model

Two layered guards applied globally via `APP_GUARD` in `AppModule`:

```
Incoming request
      │
      ▼
JwtAuthGuard          → 401 Unauthorized if token missing or invalid
      │
      ▼
RolesGuard            → 403 Forbidden if @Roles('admin') and user.role !== 'admin'
      │
      ▼
Service ownership     → 404 Not Found if resource.userId !== req.user.id
```

Routes decorated with `@Public()` skip `JwtAuthGuard` entirely (signup, login).
Admin routes use `@Roles('admin')` which `RolesGuard` reads via `Reflector`.

Ownership checks are service-layer query conditions, not guards. Querying
`{ _id: reportId, userId: req.user.id }` means a user hitting another user's
report ID gets 404 (not found), not 403 (forbidden). This avoids leaking the
existence of resources owned by other users.

---

## 7. Receipt Upload & AI Extraction Pipeline

```
POST /items/:itemId/receipt
        │
        ▼
1. JwtAuthGuard              validates token
        │
        ▼
2. Multer middleware          validates file type (image/jpeg, image/png,
        │                    image/webp, application/pdf), max 10 MB
        ▼
3. UploadsService            streams buffer to MinIO
        │                    key: receipts/{uuid}.{ext}
        │                    returns: { url: string }
        ▼
4. ExtractionService         sends base64-encoded file to Claude vision API
        │                    prompt requests JSON: { merchantName, amount,
        │                    currency, transactionDate }
        │                    wraps in try/catch — returns null fields on failure
        ▼
5. ItemsService.update()     sets item.receiptUrl = url
        │                    sets item.aiExtracted = extracted fields
        │                    does NOT auto-save extracted values to top-level fields
        ▼
6. HTTP 200 response         returns updated item including aiExtracted
        │
        ▼
Frontend ReceiptUploader     reads aiExtracted, pre-populates form fields
                             all fields immediately editable
                             user saves explicitly via form submit
```

If the Anthropic API call fails, the error is logged server-side, `aiExtracted`
is stored as `null`, and the response still returns 200 with the receipt URL.
The upload is not rolled back. The frontend shows empty pre-fill and a dismissible
extraction error notice.

---

## 8. Frontend Component Architecture

### Route groups and auth guards

`(user)/layout.tsx` — reads JWT from `localStorage`, redirects to `/login` if
absent or expired. Decodes role; redirects admins to `/admin/reports`.

`(admin)/layout.tsx` — same JWT check plus role check; redirects non-admins to
`/reports`.

### API client (`lib/api.ts`)

Axios instance with `baseURL = process.env.NEXT_PUBLIC_API_URL`.

Request interceptor — attaches `Authorization: Bearer <token>` header from
`localStorage` on every outgoing request.

Response interceptor — on 401 response, clears token and redirects to `/login`.
This handles JWT expiry transparently without requiring manual checks in components.

### ReceiptUploader component

Manages five explicit states as a discriminated union:

```typescript
type ExtractionState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | { status: 'extracting' }
  | { status: 'complete'; extracted: ExtractedFields }
  | { status: 'error'; message: string }
```

State transitions are explicit (`setState({ status: 'extracting' })`) — never
inferred from loading flags or undefined checks. This prevents the UI from
showing stale data or entering an ambiguous state.

On `complete`, the parent `ItemForm` receives extracted fields via callback and
pre-populates the controlled form inputs. All fields remain editable immediately.

### StatusBadge component

Maps `ReportStatus` to a color-coded pill:
- `DRAFT` — gray
- `SUBMITTED` — blue
- `APPROVED` — green
- `REJECTED` — red

---

## 9. Root Configuration Files

### `pnpm-workspace.yaml`
```yaml
packages:
  - 'apps/*'
```

### Root `package.json`
```json
{
  "name": "gradion-assessment",
  "private": true,
  "scripts": {
    "dev:backend":  "pnpm --filter backend dev",
    "dev:frontend": "pnpm --filter frontend dev",
    "dev":          "concurrently \"pnpm dev:backend\" \"pnpm dev:frontend\"",
    "test":         "pnpm --filter backend test",
    "test:e2e":     "pnpm --filter backend test:e2e",
    "build":        "pnpm --filter backend build && pnpm --filter frontend build"
  },
  "devDependencies": {
    "concurrently": "^8.0.0"
  }
}
```

### `docker-compose.yml` (overview)
```yaml
services:
  mongodb:
    image: mongo:7
    ports: ["27017:27017"]

  minio:
    image: minio/minio
    ports: ["9000:9000", "9001:9001"]
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin

  backend:
    build: ./apps/backend
    ports: ["3001:3001"]
    depends_on: [mongodb, minio]
    env_file: .env

  frontend:
    build: ./apps/frontend
    ports: ["3000:3000"]
    depends_on: [backend]
    env_file: .env
```

---

## 10. API Error Response Shape

All errors return a consistent JSON shape via `HttpExceptionFilter`:

```json
{
  "statusCode": 400,
  "message": "Invalid status transition: APPROVED → DRAFT",
  "error": "Bad Request",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "path": "/reports/abc123/submit"
}
```

Validation errors from `class-validator` return `message` as an array of
field-level error strings:

```json
{
  "statusCode": 422,
  "message": [
    "amount must be a positive number",
    "currency must be a valid ISO 4217 code"
  ],
  "error": "Unprocessable Entity"
}
```

---

## 11. Testing Strategy

### Unit: state machine (`report-state-machine.spec.ts`)

Pure function tests. Zero dependencies, zero mocks.

```
✓ DRAFT → SUBMITTED is valid
✓ SUBMITTED → APPROVED is valid
✓ SUBMITTED → REJECTED is valid
✓ REJECTED → DRAFT is valid
✗ DRAFT → APPROVED throws BadRequestException
✗ DRAFT → REJECTED throws BadRequestException
✗ SUBMITTED → DRAFT throws BadRequestException
✗ APPROVED → anything throws BadRequestException
✗ REJECTED → SUBMITTED throws BadRequestException
```

### Unit: items service (`items.service.spec.ts`)

Uses `@nestjs/testing` with mocked Mongoose models.

```
✓ create item succeeds when report is DRAFT
✗ create item throws when report is SUBMITTED
✗ create item throws when report is APPROVED
✗ create item throws when report is REJECTED
✓ totalAmount recomputed after item create
✓ totalAmount recomputed after item delete
```

### Integration: happy path (`test/app.e2e-spec.ts`)

Uses `Supertest` + `mongodb-memory-server`. No docker required for CI.

```
1.  POST /auth/signup               { email, password, role: 'user' }
2.  POST /auth/login                → { accessToken }
3.  POST /reports                   → report { status: 'DRAFT' }
4.  POST /reports/:id/items         → item 1 { amount: 50 }
5.  POST /reports/:id/items         → item 2 { amount: 30 }
6.  GET  /reports/:id               → totalAmount === 80
7.  POST /reports/:id/submit        → { status: 'SUBMITTED' }
8.  PATCH /reports/:id/items/:iid   → 400 (locked — not DRAFT)
9.  POST /auth/signup               { email, password, role: 'admin' }
10. POST /auth/login (admin)        → { accessToken }
11. POST /admin/reports/:id/approve → { status: 'APPROVED' }
12. GET  /reports/:id               → status === 'APPROVED', totalAmount === 80
13. POST /admin/reports/:id/approve → 400 (already APPROVED — terminal)
```

---

## 12. What Would Come Next

### Priority 1 — Async extraction pipeline

Replace the synchronous Anthropic API call with a BullMQ job queue backed by
Redis. The upload endpoint returns immediately with a `jobId`. The frontend polls
`GET /items/:itemId/extraction-status` until complete. This removes the ~3–5
second blocking wait, enables automatic retries on API failure, and opens the
door to confidence score display — the job result payload can include per-field
confidence percentages (0–1) that the UI surfaces alongside pre-filled values,
letting users know which fields the model is uncertain about.

### Priority 2 — Per-report audit trail

A `statusHistory` array on each `ExpenseReport` document, appended on every
state transition:

```typescript
statusHistory: [{
  from:      ReportStatus
  to:        ReportStatus
  actorId:   ObjectId
  actorRole: 'user' | 'admin'
  note:      string | null
  timestamp: Date
}]
```

Admins see this history inline on the report detail view. Immediately useful for
dispute resolution and compliance — auditors can see exactly who approved what
and when, and whether a report was ever rejected and resubmitted.
