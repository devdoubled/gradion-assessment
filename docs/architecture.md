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
│       │               ├── page.tsx
│       │               └── [id]/
│       │                   └── page.tsx
│       ├── components/
│       │   ├── StatusBadge.tsx
│       │   ├── ReportCard.tsx
│       │   ├── ReceiptUploader.tsx
│       │   ├── ExtractionPreview.tsx  (Phase 13: adds confidence badges)
│       │   ├── ConfirmDialog.tsx
│       │   └── AuditTimeline.tsx      (Phase 14: status history timeline)
│       ├── lib/
│       │   ├── api.ts
│       │   ├── auth.ts
│       │   ├── format.ts
│       │   └── types.ts
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
  statusHistory: [{             // Phase 14 — appended on every transition
    from:       ReportStatus | null   // null for initial DRAFT creation
    to:         ReportStatus
    actorId:    ObjectId              // ref: 'User'
    actorRole:  'user' | 'admin'
    note:       string | null         // populated on rejection
    timestamp:  Date
  }]
  createdAt:    Date
  updatedAt:    Date
}
```

`statusHistory` is append-only — entries are never mutated after writing. The
initial DRAFT creation appends the first entry with `from: null`.

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
  aiExtracted: {                  // raw LLM output with confidence — Phase 13
    merchantName:    { value: string | null, confidence: number | null }
    amount:          { value: number | null, confidence: number | null }
    currency:        { value: string | null, confidence: number | null }
    transactionDate: { value: string | null, confidence: number | null }
  } | null
  createdAt:    Date
  updatedAt:    Date
}
```

`aiExtracted` stores raw extraction output with per-field confidence scores (0.0–1.0).
`confidence: null` means the item pre-dates Phase 13 or extraction failed.
User overrides are saved on the top-level fields, not inside `aiExtracted`.

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

**REJECTED → re-submit:** Users call `POST /reports/:id/reopen` to transition
`REJECTED → DRAFT`, then edit their report, then call the submit endpoint
(`DRAFT → SUBMITTED`). Direct `REJECTED → SUBMITTED` is not allowed. This forces
the user to consciously acknowledge the rejection and re-confirm their edits before
re-entering the admin queue, producing a cleaner audit trail with a visible DRAFT
state between rejections. The frontend surfaces this as a "Re-open & Edit" button
shown only when a report's status is REJECTED.

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
        │                    prompt requests JSON with value + confidence per field
        │                    wraps in try/catch — returns null fields on failure
        ▼
5. ItemsService.attachReceipt()  sets item.receiptUrl = url
        │                        sets item.aiExtracted = { field: { value, confidence } }
        │                        does NOT auto-save extracted values to top-level fields
        ▼
6. HTTP 200 response         returns updated item including aiExtracted
        │
        ▼
Frontend ReceiptUploader     reads aiExtracted, pre-populates form fields
                             ExtractionPreview shows confidence badge per field
                             all fields immediately editable
                             user saves explicitly via form submit
```

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
  | { status: 'uploading' }
  | { status: 'extracting' }                        // awaiting synchronous API response
  | { status: 'complete'; extracted: ExtractedFields }
  | { status: 'error'; message: string }
```

State transitions are always explicit — never inferred from loading flags or
undefined checks. This prevents the UI from entering an ambiguous state.

On `complete`, the parent `ItemForm` receives extracted fields via callback and
pre-populates the controlled form inputs. All fields remain editable immediately.

### ExtractionPreview component (Phase 13 — confidence badges)

Each pre-filled field renders a confidence badge alongside the value:
- `confidence >= 0.85` → green "High" chip
- `confidence 0.60–0.84` → amber "Review" chip with tooltip "AI is uncertain — please verify"
- `confidence < 0.60` → red "Low" chip — field highlighted for manual check
- `confidence === null` → no badge (extraction pre-dates confidence scoring)

### AuditTimeline component (Phase 14)

Renders `statusHistory` entries as a vertical timeline, newest-first. Each entry
shows the actor role chip (`User` / `Admin`), a status transition arrow
(`DRAFT → SUBMITTED`), an optional rejection note, and a formatted timestamp.
Used on the admin detail page and (read-only rejection note only) on the user
detail page.

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

## 10. API Response Envelope

Every response — success and error — uses the same top-level shape.

### Success (via `TransformInterceptor`)

```json
{
  "status": "success",
  "message": "Create successfully",
  "messageCode": "002",
  "data": {}
}
```

`message` and `messageCode` are inferred from the HTTP method by default.
Use `@ResponseMeta(message, code)` on a handler to override.

| HTTP method | Default message | Default code |
|---|---|---|
| GET | Fetch successfully | `001` |
| POST | Create successfully | `002` |
| PATCH / PUT | Update successfully | `003` |
| DELETE | Delete successfully | `004` |

Special-purpose POST endpoints override via `@ResponseMeta`:

| Endpoint | Message | Code |
|---|---|---|
| POST /reports/:id/submit | Submit successfully | `005` |
| POST /admin/reports/:id/approve | Approve successfully | `006` |
| POST /admin/reports/:id/reject | Reject successfully | `007` |
| POST /reports/:id/reopen | Reopened successfully | `008` |

`data` is `null` for DELETE responses (service returns `void`).

### Error (via `HttpExceptionFilter`)

```json
{
  "status": "error",
  "message": "Invalid status transition: APPROVED → DRAFT",
  "messageCode": "E400",
  "data": null,
  "path": "/reports/abc123/submit",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

`messageCode` is always `E` + the HTTP status code (e.g. `E401`, `E404`, `E409`, `E500`).

Validation errors join all field messages into a single comma-separated string:

```json
{
  "status": "error",
  "message": "amount must be a positive number, currency must be a valid ISO 4217 code",
  "messageCode": "E400",
  "data": null
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

## 12. Optional Enhancements — Implementation Guide

These three features correspond to Phases 12–14 in `docs/plan.md`.
See that file for full task breakdowns.

### Phase 12 — Async Extraction Queue (BullMQ + Redis)

**New module:** `src/extraction-queue/` — `ExtractionQueueModule` + `ExtractionProcessor`.

**Changed:** `UploadsController` no longer awaits `ExtractionService`; enqueues a
job and returns `{ receiptUrl, jobId }` immediately. New endpoint
`GET /items/:itemId/extraction-status` proxies job status from BullMQ.

**Frontend change:** `ReceiptUploader` gains a `'pending'` state; polls status
endpoint every 2 s until `'complete'` or `'failed'`.

**Infrastructure:** Redis at port 6379 added to `docker-compose.yml` and
`apps/backend/.env`.

### Phase 13 — Confidence Scores

**Changed:** `ExtractionService` prompt and return type. Each field becomes
`{ value: T|null, confidence: number }` instead of `T|null`.

**Changed:** `aiExtracted` sub-document schema on `ExpenseItem` updated to the
new shape. Pre-existing items have `confidence: null` (backwards compatible).

**Frontend change:** `ExtractionPreview` renders a colour-coded confidence badge
(green / amber / red) alongside each pre-filled value.

### Phase 14 — Per-report Audit Trail

**Changed:** `ExpenseReport` schema gains a `statusHistory` array. Every service
method that changes status appends an entry (actor, transition, note, timestamp).

**Changed:** `AdminService.reject()` accepts an optional `note: string` parameter.
The reject DTO and endpoint body are updated accordingly.

**Frontend changes:**
- `AuditTimeline` component renders history entries on the admin detail page.
- Reject `ConfirmDialog` gains an optional textarea for the rejection reason.
- User detail page shows a rejection note banner when status is `REJECTED`.
