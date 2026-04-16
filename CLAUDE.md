# Gradion Expense Report Assessment — Claude Code Context

> This file is the single source of truth for Claude Code across all sessions.
> Read this fully before doing anything. Never violate the rules in section 5.

---

## 1. Project Overview

Full-stack Expense Report Management System built as a take-home assessment for Gradion.

**Two actor types:**
- `user` — creates expense reports, adds items, attaches receipts, submits for approval
- `admin` — reviews submitted reports, approves or rejects them

**Core complexity:**
- State machine governing report lifecycle (enforced at service layer only)
- JWT-based auth with role-based access control
- File upload pipeline with AI receipt extraction via Claude vision API
- Computed `totalAmount` on reports (always server-side, never trusted from client)

---

## 2. Monorepo Structure

```
gradion-assessment/              ← repo root
├── apps/
│   ├── backend/                 ← NestJS API (port 3001)
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── reports/
│   │   │   ├── items/
│   │   │   ├── uploads/
│   │   │   ├── admin/
│   │   │   └── common/
│   │   └── test/
│   └── frontend/                ← Next.js 14 App Router (port 3000)
│       ├── app/
│       │   ├── (auth)/
│       │   ├── (user)/
│       │   └── (admin)/
│       ├── components/
│       └── lib/
├── docs/
│   ├── architecture.md
│   └── plan.md
├── .claude/
│   └── commands/
├── CLAUDE.md                    ← this file
├── DECISIONS.md
├── README.md
├── docker-compose.yml
├── .env.example
├── pnpm-workspace.yaml
└── package.json                 ← root (scripts only, no app deps)
```

---

## 3. Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Backend | NestJS + TypeScript | `apps/backend/` |
| Frontend | Next.js 14 App Router + TypeScript | `apps/frontend/` |
| Database | MongoDB + Mongoose | via docker-compose |
| File storage | MinIO | S3-compatible, local only |
| Auth | `@nestjs/jwt` + Passport | JWT, no sessions |
| AI extraction | Anthropic Claude API (vision) | Synchronous, claude-sonnet-4-5 model |
| Package manager | pnpm workspaces | root `pnpm-workspace.yaml` |
| Testing | Jest + Supertest + mongodb-memory-server | backend only |
| API Docs | `@nestjs/swagger` | Swagger UI at `http://localhost:3001/api/docs` |

### Swagger Setup
- Configured in `apps/backend/src/main.ts` via `DocumentBuilder` + `SwaggerModule`.
- UI served at `/api/docs`; JSON spec at `/api/docs-json`.
- All DTOs use `@ApiProperty` / `@ApiPropertyOptional` from `@nestjs/swagger`.
- `UpdateReportDto` and `UpdateItemDto` extend `PartialType` from `@nestjs/swagger` (not `@nestjs/mapped-types`) so Swagger inherits parent properties.
- All authenticated controllers carry `@ApiBearerAuth()`. Use the **Authorize** button in the UI and paste the JWT from `/auth/login`.

---

## 4. Backend Module Map

```
src/
├── app.module.ts
├── main.ts
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts        POST /auth/signup, POST /auth/login
│   ├── auth.service.ts           bcrypt hashing, JWT signing
│   ├── jwt.strategy.ts           Passport JWT strategy
│   ├── jwt-auth.guard.ts         Applied globally via APP_GUARD
│   ├── roles.guard.ts            Checks @Roles() metadata
│   └── dto/
│       ├── signup.dto.ts
│       └── login.dto.ts
│
├── reports/
│   ├── reports.module.ts
│   ├── reports.controller.ts     GET/POST/PATCH/DELETE /reports
│   │                             POST /reports/:id/submit
│   ├── reports.service.ts        State machine calls live HERE only
│   ├── report-state-machine.ts   Pure functions, no side effects
│   ├── schemas/
│   │   └── report.schema.ts
│   └── dto/
│       ├── create-report.dto.ts
│       └── update-report.dto.ts
│
├── items/
│   ├── items.module.ts
│   ├── items.controller.ts       CRUD under /reports/:reportId/items
│   ├── items.service.ts          Guards all mutations behind DRAFT check
│   ├── schemas/
│   │   └── item.schema.ts
│   └── dto/
│       ├── create-item.dto.ts
│       └── update-item.dto.ts
│
├── uploads/
│   ├── uploads.module.ts
│   ├── uploads.controller.ts     POST /items/:id/receipt
│   ├── uploads.service.ts        Multer → MinIO
│   └── extraction.service.ts     Anthropic API call, returns structured fields
│
├── admin/
│   ├── admin.module.ts
│   ├── admin.controller.ts       GET /admin/reports
│   │                             POST /admin/reports/:id/approve
│   │                             POST /admin/reports/:id/reject
│   └── admin.service.ts
│
└── common/
    ├── decorators/
    │   ├── roles.decorator.ts    @Roles('admin')
    │   └── public.decorator.ts   @Public() skips JwtAuthGuard
    ├── filters/
    │   └── http-exception.filter.ts   { statusCode, message, error }
    ├── interceptors/
    │   └── transform.interceptor.ts   strips passwordHash from all responses
    └── pipes/
        └── validation.pipe.ts    global class-validator enforcement
```

---

## 5. Architectural Rules — Never Violate

1. **Business logic belongs in services, never in controllers.**
   Controllers handle HTTP only: parse input, call service, return response.

2. **State machine transitions are validated in `ReportsService` only.**
   No other file is allowed to set `report.status` directly.

3. **`totalAmount` is always recomputed server-side.**
   Never accept `totalAmount` as user input. Recompute via `$sum` aggregation
   on every item `create`, `update`, and `delete`.

4. **Never return `passwordHash` from any endpoint.**
   Use `select: false` on the schema field. Use `TransformInterceptor` as backup.

5. **Ownership checks live in service queries, not guards.**
   Always filter by `{ _id: reportId, userId: req.user.id }` so unauthorized
   access returns 404, not 403 (avoids leaking resource existence).

6. **Item mutations require the parent report to be in `DRAFT` state.**
   `ItemsService` fetches the parent report and throws `BadRequestException`
   if status is not `DRAFT` before performing any create/update/delete.

7. **Receipt upload must succeed before item is updated.**
   Upload to MinIO first, get the URL, then call `ItemsService.update()`.
   Never save a broken receipt URL on an item.

8. **AI extraction failure must never block the upload flow.**
   Wrap `ExtractionService` call in try/catch. Return null fields on failure.
   The receipt URL is still saved. Log the error server-side.

9. **Every response uses the standard envelope — no exceptions.**
   Success: `{ status, message, messageCode, data }` via `TransformInterceptor`.
   Error: `{ status, message, messageCode, data: null, path, timestamp }` via `HttpExceptionFilter`.
   HTTP method infers default message/code. Override per-handler with `@ResponseMeta(message, code)`.
   Codes: GET=001, POST=002, PATCH=003, DELETE=004, submit=005, approve=006, reject=007.
   Error codes: `E` + HTTP status (E400, E401, E403, E404, E409, E500).

---

## 6. State Machine (Source of Truth)

```
User actions                         Admin actions
────────────────────────────────────────────────────

DRAFT ──[submit]──► SUBMITTED ──[approve]──► APPROVED (terminal)
  ▲                     │
  │                     └──[reject]──► REJECTED
  │                                       │
  └───────────────────────────────────────┘
              (user edits, then submits again)
```

Valid transitions:
- `DRAFT` → `SUBMITTED` (user: submit)
- `SUBMITTED` → `APPROVED` (admin: approve)
- `SUBMITTED` → `REJECTED` (admin: reject)
- `REJECTED` → `DRAFT` (user: explicit via `POST /reports/:id/reopen`)

Invalid (must throw `BadRequestException`):
- Any transition not listed above
- Any attempt to leave `APPROVED`

**Re-submit decision:** `REJECTED → DRAFT` first (via reopen endpoint), then user
calls submit again (`DRAFT → SUBMITTED`). Direct `REJECTED → SUBMITTED` is not allowed.
Rationale: forces user to acknowledge the rejection and re-confirm their edits.
The frontend shows a "Re-open & Edit" button on REJECTED reports that calls the
reopen endpoint, returning the report to DRAFT so items can be edited again.

---

## 7. Data Schemas

### User
```
_id, email (unique), passwordHash (select:false), role ('user'|'admin'),
createdAt, updatedAt
```

### ExpenseReport
```
_id, userId (ref:User), title, description,
status ('DRAFT'|'SUBMITTED'|'APPROVED'|'REJECTED'),
totalAmount (number, server-computed),
statusHistory: [{
  from: ReportStatus|null, to: ReportStatus,
  actorId (ref:User), actorRole ('user'|'admin'),
  note: string|null, timestamp: Date
}],
createdAt, updatedAt
```

`statusHistory` is appended on every state transition (including initial DRAFT creation).
`from` is null for the first entry. Never mutated after appending.

### ExpenseItem
```
_id, reportId (ref:ExpenseReport),
amount (number), currency (string, ISO 4217),
category (string), merchantName (string),
transactionDate (Date), receiptUrl (string|null),
aiExtracted: {
  merchantName: { value: string|null, confidence: number|null },
  amount:       { value: number|null, confidence: number|null },
  currency:     { value: string|null, confidence: number|null },
  transactionDate: { value: string|null, confidence: number|null }
} | null,
createdAt, updatedAt
```

`aiExtracted` stores raw LLM output with per-field confidence scores (0.0–1.0).
`confidence: null` means extraction failed or pre-dates Phase 13.
User overrides are saved on the top-level fields, not inside `aiExtracted`.

---

## 8. API Endpoints

### Auth (public)
```
POST /auth/signup      body: { email, password }
POST /auth/login       body: { email, password }  → { accessToken }
```

### Reports (authenticated user)
```
GET    /reports                   list own reports, ?status= filter
POST   /reports                   create (starts as DRAFT)
GET    /reports/:id               get own report
PATCH  /reports/:id               update (DRAFT only)
DELETE /reports/:id               delete (DRAFT only)
POST   /reports/:id/submit        DRAFT → SUBMITTED
POST   /reports/:id/reopen        REJECTED → DRAFT  (code 008)
```

### Items (authenticated user)
```
GET    /reports/:reportId/items              list items
POST   /reports/:reportId/items              add item (DRAFT only)
PATCH  /reports/:reportId/items/:itemId      edit item (DRAFT only)
DELETE /reports/:reportId/items/:itemId      delete item (DRAFT only)
POST   /items/:itemId/receipt                upload receipt + extract
```

### Admin (admin role only)
```
GET  /admin/reports                  all reports, ?status= filter
GET  /admin/reports/:id              get single report (with userId populated, includes statusHistory)
GET  /admin/reports/:id/items        list items for any report (no ownership check)
POST /admin/reports/:id/approve      SUBMITTED → APPROVED
POST /admin/reports/:id/reject       SUBMITTED → REJECTED  body: { note?: string }
```

---

## 9. Environment Variables

```
# Backend (apps/backend/.env)
MONGODB_URI=mongodb://localhost:27017/gradion
JWT_SECRET=supersecretkey
JWT_EXPIRES_IN=7d

MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=receipts

ANTHROPIC_API_KEY=sk-ant-...

# Frontend (apps/frontend/.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 10. Frontend Structure

```
apps/frontend/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx              ← guest guard: redirects authenticated users to their dashboard
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (user)/
│   │   ├── layout.tsx              ← auth guard: redirects to /login if no JWT
│   │   └── reports/
│   │       ├── page.tsx            ← report list + StatusBadge
│   │       ├── new/page.tsx
│   │       └── [id]/
│   │           ├── page.tsx        ← detail, items table, submit button
│   │           └── items/
│   │               ├── new/page.tsx
│   │               └── [itemId]/edit/page.tsx
│   └── (admin)/
│       ├── layout.tsx              ← auth guard: redirects non-admins
│       └── admin/reports/
│           ├── page.tsx            ← all reports, approve/reject, status filter tabs
│           └── [id]/page.tsx       ← read-only detail, approve/reject, audit trail (Phase 14)
├── components/
│   ├── StatusBadge.tsx
│   ├── ReportCard.tsx
│   ├── ReceiptUploader.tsx         ← manages extraction states (idle/uploading/extracting/complete/error)
│   ├── ExtractionPreview.tsx       ← pre-filled fields + confidence badges (Phase 13)
│   ├── ConfirmDialog.tsx           ← reusable confirm/destructive alert dialog
│   └── AuditTimeline.tsx           ← Phase 14: renders statusHistory entries
└── lib/
    ├── api.ts                      ← axios instance, JWT interceptor
    ├── auth.ts                     ← token helpers, role decode
    ├── format.ts                   ← formatAmount, formatDate, groupByCurrency
    └── types.ts                    ← ReportStatus, ExpenseReport, ExpenseItem, AuthResponse
```

**Route guard rules (enforced via layout.tsx in each route group):**
```
(auth)/layout.tsx   — guest guard: if isAuthenticated(), redirect to /admin/reports or /reports
(user)/layout.tsx   — auth guard: if !isAuthenticated(), redirect to /login
                      if role === 'admin', redirect to /admin/reports
(admin)/layout.tsx  — auth guard: if !isAuthenticated(), redirect to /login
                      if role !== 'admin', redirect to /reports
```
Rule: authenticated users can never access /login or /signup (browser back included).
Rule: unauthenticated users can never access protected routes.
Rule: users and admins are always redirected to their own dashboard.

**AI extraction UI states (explicit, never inferred):**
```
idle       → no file selected
uploading  → file being sent to server
extracting → server calling Claude API (spinner + message)
complete   → fields pre-populated, all editable
error      → failed, manual entry required
```

---

## 11. Docker Compose Services

```
mongodb    → port 27017
minio      → API port 9000, Console port 9001
backend    → port 3001 (depends on mongodb, minio)
frontend   → port 3000 (depends on backend)
```

All services on shared `app-network` bridge.

---

## 12. Testing Requirements

### Unit tests (apps/backend/src/reports/report-state-machine.spec.ts)
Every valid and invalid transition. Zero external dependencies.

### Unit tests (apps/backend/src/items/items.service.spec.ts)
Item mutations on non-DRAFT reports throw `BadRequestException`.

### Integration test (apps/backend/test/app.e2e-spec.ts)
Full happy path using Supertest + mongodb-memory-server:
1. POST /auth/signup (user)
2. POST /auth/login (user) → JWT
3. POST /reports → DRAFT report
4. POST /reports/:id/items × 2
5. POST /reports/:id/submit → SUBMITTED
6. POST /auth/login (admin) → admin JWT
7. POST /admin/reports/:id/approve → APPROVED
8. GET /reports/:id → verify status=APPROVED, totalAmount correct

---

## 13. Commit Convention

```
feat(auth): implement JWT signup and login
feat(reports): add state machine with transition validation
feat(items): enforce DRAFT lock on item mutations
feat(uploads): add MinIO storage and receipt upload endpoint
feat(extraction): integrate Claude vision API for receipt parsing
feat(admin): add approve and reject endpoints
feat(frontend): add report list and detail pages
test(reports): unit tests for all state machine transitions
test(e2e): happy path DRAFT → SUBMITTED → APPROVED
chore: add docker-compose with MongoDB and MinIO
docs: add DECISIONS.md and architecture notes
```

---

## 14. Implementation Progress

Track status here. Update as modules are completed.

```
[x] Phase 1 — Foundation (monorepo, docker-compose, env)
[x] Phase 2 — Auth module
[x] Phase 3 — Reports module + state machine + unit tests
[x] Phase 4 — Items module
[x] Phase 5 — Uploads + extraction
[x] Phase 6 — Admin module
[x] Phase 7 — Integration test
[x] Phase 8 — Frontend: auth pages
[x] Phase 9 — Frontend: user report flow
[x] Phase 10 — Frontend: admin view
[x] Phase 11 — DECISIONS.md + README.md + polish
[ ] Phase 12 — Optional: async extraction queue (BullMQ + Redis)
[x] Phase 13 — Optional: confidence scores in extraction UI
[x] Phase 14 — Optional: per-report audit trail with rejection notes
```
