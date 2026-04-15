# Implementation Plan — Gradion Expense Report Assessment

> Claude Code: read this file alongside CLAUDE.md before starting any phase.
> Mark tasks `[x]` as they are completed. Never skip a phase.
> Commit after every meaningful unit of work — not at the end of a phase.

---

## Phase 1 — Foundation

Goal: Repo structure, docker-compose, and both apps scaffolded and bootable.

```
[x] Create pnpm-workspace.yaml at repo root
[x] Create root package.json with workspace scripts and concurrently
[x] Scaffold apps/backend with NestJS CLI
      → cd apps && npx @nestjs/cli new backend --package-manager pnpm --skip-git
[x] Scaffold apps/frontend with create-next-app
      → cd apps && npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*" --skip-install
[x] Create docker-compose.yml at repo root
      → services: mongodb (mongo:7), minio (minio/minio), backend (port 3001), frontend (port 3000)
[x] Create .env.example at repo root with all variables from CLAUDE.md section 9
[x] Create apps/backend/.env (copy from .env.example, fill local values)
[x] Create apps/frontend/.env.local with NEXT_PUBLIC_API_URL=http://localhost:3001
[x] Verify docker-compose up starts mongodb and minio cleanly
[x] Add MongooseModule.forRoot() to AppModule using MONGODB_URI from ConfigModule
[x] Verify backend connects to MongoDB on startup
```

Commit: `chore: scaffold monorepo with NestJS backend and Next.js frontend`

---

## Phase 2 — Auth Module

Goal: Signup, login, JWT issuance, global guards wired up.

```
[ ] Install backend deps: @nestjs/passport, @nestjs/jwt, passport, passport-jwt,
      bcrypt, @types/bcrypt, @nestjs/config, class-validator, class-transformer
[ ] Create common/decorators/public.decorator.ts  (@Public())
[ ] Create common/decorators/roles.decorator.ts   (@Roles(...roles))
[ ] Create User schema (email, passwordHash select:false, role enum)
[ ] Create signup.dto.ts and login.dto.ts with class-validator decorators
[ ] Implement AuthService
      → signup: hash password with bcrypt (rounds: 10), save user, return { id, email, role }
      → login: find by email, compare hash, sign JWT, return { accessToken }
      → JWT payload: { sub: userId, email, role }
[ ] Implement JwtStrategy (validate returns { id, email, role })
[ ] Implement JwtAuthGuard (extends AuthGuard('jwt'), skips @Public() routes)
[ ] Implement RolesGuard (reads @Roles() via Reflector, returns 403 if mismatch)
[ ] Register JwtAuthGuard and RolesGuard as global APP_GUARDs in AppModule
[ ] Implement AuthController
      → POST /auth/signup  (@Public())
      → POST /auth/login   (@Public())
[ ] Create common/filters/http-exception.filter.ts and register globally
[ ] Create common/interceptors/transform.interceptor.ts (strips passwordHash)
[ ] Create common/pipes/validation.pipe.ts and register globally
[ ] Manual test: signup → login → get accessToken
```

Commit: `feat(auth): implement JWT signup, login, and global guards`

---

## Phase 3 — Reports Module + State Machine

Goal: Full CRUD on own reports, submit endpoint, state machine unit tested.

```
[ ] Create ExpenseReport schema (userId ref, title, description, status, totalAmount)
[ ] Create report-state-machine.ts
      → ReportStatus type
      → VALID_TRANSITIONS record
      → canTransition(from, to): boolean
      → assertTransition(from, to): void  — throws BadRequestException on invalid
[ ] Write report-state-machine.spec.ts
      → test every valid transition passes
      → test every invalid transition throws (including APPROVED → anything)
[ ] Run tests: pnpm --filter backend test — all must pass before proceeding
[ ] Create create-report.dto.ts and update-report.dto.ts
[ ] Implement ReportsService
      → create(userId, dto): report starts as DRAFT, totalAmount: 0
      → findAll(userId, status?): list own reports with optional status filter
      → findOne(id, userId): find by { _id: id, userId } — 404 if not found
      → update(id, userId, dto): only if DRAFT, else 400
      → delete(id, userId): only if DRAFT, else 400
      → submit(id, userId): assertTransition(DRAFT, SUBMITTED), save
[ ] Implement ReportsController
      → GET    /reports          (@Roles not needed — authenticated user only)
      → POST   /reports
      → GET    /reports/:id
      → PATCH  /reports/:id
      → DELETE /reports/:id
      → POST   /reports/:id/submit
[ ] Manual test: full CRUD cycle + submit
```

Commit: `feat(reports): add report CRUD, submit endpoint, and state machine`
Commit: `test(reports): unit tests for all state machine transitions`

---

## Phase 4 — Items Module

Goal: Expense item CRUD with DRAFT lock, totalAmount recomputed on every mutation.

```
[ ] Create ExpenseItem schema (reportId ref, amount, currency, category,
      merchantName, transactionDate, receiptUrl, aiExtracted sub-doc)
[ ] Create create-item.dto.ts and update-item.dto.ts
[ ] Implement ItemsService
      → assertReportDraft(reportId, userId): fetches report, throws 400 if not DRAFT,
           throws 404 if report not found or not owned by user
      → recomputeTotal(reportId): aggregates $sum of items.amount, updates report
      → create(reportId, userId, dto): assertReportDraft → save item → recomputeTotal
      → findAll(reportId, userId): verify ownership then list items
      → update(itemId, reportId, userId, dto): assertReportDraft → update → recomputeTotal
      → delete(itemId, reportId, userId): assertReportDraft → delete → recomputeTotal
[ ] Write items.service.spec.ts
      → create succeeds when report is DRAFT
      → create throws 400 when report is SUBMITTED / APPROVED / REJECTED
      → totalAmount is recomputed correctly after create
      → totalAmount is recomputed correctly after delete
[ ] Run tests: all must pass before proceeding
[ ] Implement ItemsController (nested under /reports/:reportId/items)
      → GET    /reports/:reportId/items
      → POST   /reports/:reportId/items
      → PATCH  /reports/:reportId/items/:itemId
      → DELETE /reports/:reportId/items/:itemId
[ ] Manual test: add two items, verify totalAmount on report, submit, try to edit → 400
```

Commit: `feat(items): add expense item CRUD with DRAFT lock and totalAmount recomputation`
Commit: `test(items): unit tests for DRAFT lock and totalAmount recomputation`

---

## Phase 5 — Uploads & AI Extraction

Goal: Receipt file upload to MinIO, Claude vision extraction, fields returned to frontend.

```
[ ] Install backend deps: @nestjs/platform-express (already included), multer,
      @types/multer, minio, @anthropic-ai/sdk
[ ] Implement UploadsService
      → onModuleInit: create MinIO client from env vars, ensure bucket exists
      → upload(buffer, mimetype, originalname): generates UUID key,
           streams to MinIO, returns { url: key }
[ ] Implement ExtractionService
      → extract(buffer, mimetype): calls Anthropic claude-sonnet-4-5 vision API
           prompt: extract merchantName, amount, currency, transactionDate as JSON
           wraps entire call in try/catch
           on success: parse JSON, return { merchantName, amount, currency, transactionDate }
           on failure: log error, return { merchantName: null, amount: null, currency: null, transactionDate: null }
[ ] Implement UploadsController
      → POST /items/:itemId/receipt
      → Multer intercepts file (fileFilter: image/*, application/pdf; limit: 10MB)
      → UploadsService.upload() → get receiptUrl
      → ExtractionService.extract() → get aiExtracted fields
      → ItemsService.attachReceipt(itemId, receiptUrl, aiExtracted) → update item
      → Return updated item
[ ] Add attachReceipt method to ItemsService
      → does NOT go through assertReportDraft — receipt can be attached at any status
      → updates receiptUrl and aiExtracted fields only
[ ] Manual test: upload a receipt image, verify MinIO bucket, verify aiExtracted
      fields returned in response
```

Commit: `feat(uploads): add MinIO file upload and Claude vision receipt extraction`

---

## Phase 6 — Admin Module

Goal: Admin can list all reports and approve or reject submitted ones.

```
[ ] Implement AdminService
      → findAll(status?): find all reports across all users, with optional status filter
           populate userId with { email } for display
      → approve(reportId): find report, assertTransition(SUBMITTED, APPROVED), save
      → reject(reportId): find report, assertTransition(SUBMITTED, REJECTED), save
[ ] Implement AdminController
      → all routes decorated with @Roles('admin')
      → GET  /admin/reports          ?status= filter
      → POST /admin/reports/:id/approve
      → POST /admin/reports/:id/reject
[ ] Manual test: submit a report as user, approve as admin, verify terminal state
```

Commit: `feat(admin): add admin list, approve, and reject endpoints`

---

## Phase 7 — Integration Test

Goal: End-to-end happy path test passing in CI without docker.

```
[ ] Install test deps in apps/backend: mongodb-memory-server, supertest, @types/supertest
[ ] Configure jest e2e config to use mongodb-memory-server
[ ] Write test/app.e2e-spec.ts covering full sequence from CLAUDE.md section 12:
      1.  POST /auth/signup (user)
      2.  POST /auth/login → JWT
      3.  POST /reports → DRAFT
      4.  POST /reports/:id/items (×2)
      5.  GET  /reports/:id → totalAmount correct
      6.  POST /reports/:id/submit → SUBMITTED
      7.  PATCH /reports/:id/items/:id → expect 400 (locked)
      8.  POST /auth/signup (admin)
      9.  POST /auth/login (admin) → admin JWT
      10. POST /admin/reports/:id/approve → APPROVED
      11. GET  /reports/:id → status APPROVED, totalAmount unchanged
      12. POST /admin/reports/:id/approve → expect 400 (terminal)
[ ] Run: pnpm --filter backend test:e2e — must pass
```

Commit: `test(e2e): happy path DRAFT → SUBMITTED → APPROVED integration test`

---

## Phase 8 — Frontend: Auth Pages

Goal: Login and signup pages functional, JWT stored, redirects working.

```
[ ] Install frontend deps: axios, jwt-decode
[ ] Create lib/auth.ts
      → getToken(): string | null
      → setToken(token: string): void
      → clearToken(): void
      → getRole(): 'user' | 'admin' | null  (decode JWT)
      → isAuthenticated(): boolean
[ ] Create lib/api.ts
      → axios instance with baseURL = NEXT_PUBLIC_API_URL
      → request interceptor: attach Authorization header
      → response interceptor: on 401 clear token + redirect to /login
[ ] Create app/(auth)/login/page.tsx
      → form: email + password
      → calls POST /auth/login
      → on success: setToken, redirect to /reports (user) or /admin/reports (admin)
[ ] Create app/(auth)/signup/page.tsx
      → form: email + password + role select (user/admin)
      → calls POST /auth/signup, then auto-login, redirect
[ ] Create app/(user)/layout.tsx
      → client component, checks isAuthenticated() on mount
      → redirects to /login if not authenticated
      → redirects to /admin/reports if role === 'admin'
[ ] Create app/(admin)/layout.tsx
      → checks isAuthenticated() and getRole() === 'admin'
      → redirects non-admins to /reports
[ ] Manual test: signup → login → redirect to reports → protected route blocks unauthenticated
```

Commit: `feat(frontend): add auth pages, JWT helpers, and route guards`

---

## Phase 9 — Frontend: User Report Flow

Goal: Full user journey from report list through item entry and submission.

```
[ ] Create components/StatusBadge.tsx
      → DRAFT=gray, SUBMITTED=blue, APPROVED=green, REJECTED=red
      → Tailwind pill with label
[ ] Create components/ReportCard.tsx
      → title, status badge, totalAmount, date, link to detail
[ ] Create app/(user)/reports/page.tsx
      → fetch GET /reports on load
      → list of ReportCards
      → "New Report" button
      → status filter tabs (All / Draft / Submitted / Approved / Rejected)
[ ] Create app/(user)/reports/new/page.tsx
      → form: title + description
      → POST /reports on submit
      → redirect to /reports/:id on success
[ ] Create app/(user)/reports/[id]/page.tsx
      → fetch report + items
      → show title, status badge, totalAmount
      → items table: merchant, amount, currency, date, receipt icon
      → "Add Item" button (disabled if not DRAFT)
      → "Submit Report" button (disabled if not DRAFT)
      → submit calls POST /reports/:id/submit, refreshes status
[ ] Create components/ExtractionPreview.tsx
      → displays extracted fields as read-only preview with "Override" affordance
[ ] Create components/ReceiptUploader.tsx
      → file input (accept: image/*, application/pdf)
      → manages ExtractionState discriminated union:
           idle / uploading / extracting / complete / error
      → on file select: POST /items/:itemId/receipt
      → on complete: calls onExtracted(fields) callback to pre-fill form
[ ] Create app/(user)/reports/[id]/items/new/page.tsx
      → form: amount, currency, category, merchantName, transactionDate
      → ReceiptUploader at top — pre-fills form on extraction complete
      → all fields remain editable after pre-fill
      → POST /reports/:reportId/items on save
[ ] Create app/(user)/reports/[id]/items/[itemId]/edit/page.tsx
      → same form, pre-filled with existing item data
      → PATCH /reports/:reportId/items/:itemId on save
[ ] Manual test: create report → add 2 items with receipts → verify totalAmount → submit
```

Commit: `feat(frontend): add report list, detail, and item form with receipt upload`

---

## Phase 10 — Frontend: Admin View

Goal: Admin can see all reports and approve or reject submitted ones.

```
[ ] Create app/(admin)/admin/reports/page.tsx
      → fetch GET /admin/reports on load
      → table: user email, report title, status badge, totalAmount, date, actions
      → status filter (All / Submitted / Approved / Rejected)
      → "Approve" button (only shown for SUBMITTED reports)
      → "Reject" button (only shown for SUBMITTED reports)
      → approve calls POST /admin/reports/:id/approve, refreshes row
      → reject calls POST /admin/reports/:id/reject, refreshes row
      → clicking report title navigates to read-only detail view
[ ] Manual test: submit report as user, approve as admin, verify status update in both views
```

Commit: `feat(frontend): add admin report list with approve and reject actions`

---

## Phase 11 — Documentation & Polish

Goal: Assessment deliverables complete, git history clean, reviewer can run in 5 minutes.

```
[ ] Write DECISIONS.md covering:
      → Stack choices and why (NestJS, Next.js, MongoDB, MinIO)
      → REJECTED → DRAFT (not direct re-submit) — rationale
      → Synchronous extraction — rationale and acknowledged trade-off
      → totalAmount as stored computed field — rationale and drift prevention
      → MongoDB vs PostgreSQL — honest trade-off
      → "One more day" section (~300–600 words): async extraction with BullMQ,
           confidence scores in UI, per-report audit trail
[ ] Write README.md covering:
      → Prerequisites (Node.js 20+, pnpm, Docker)
      → Setup: clone → cp .env.example .env → docker-compose up → pnpm install → pnpm dev
      → Running tests: pnpm test, pnpm test:e2e
      → Architecture overview (2 paragraphs)
      → AI usage note: which tools, how they helped, where output was corrected
[ ] Review git log — ensure no single giant commit, messages follow convention
[ ] Verify docker-compose up → pnpm install → pnpm dev boots cleanly on a cold start
[ ] Verify pnpm test and pnpm test:e2e both pass
[ ] Final check: no console.log left in production code paths
[ ] Final check: .env not committed (only .env.example)
[ ] Final check: passwordHash never appears in any API response
```

Commit: `docs: add DECISIONS.md, README.md, and AI usage note`

---

## Definition of Done

The submission is ready when ALL of the following are true:

- [ ] `docker-compose up` starts all services without errors
- [ ] `pnpm install && pnpm dev` boots backend (3001) and frontend (3000)
- [ ] A user can sign up, log in, create a report, add items, upload a receipt,
       see AI-extracted fields pre-fill the form, and submit the report
- [ ] An admin can log in, see all reports, approve or reject a submitted report
- [ ] `pnpm test` passes (unit tests)
- [ ] `pnpm test:e2e` passes (integration test)
- [ ] `DECISIONS.md` exists and covers all required trade-offs
- [ ] `README.md` has setup instructions a reviewer can follow in under 5 minutes
- [ ] Git history has meaningful, incremental commits
- [ ] `.claude/` or `docs/` directory contains AI artifact evidence
