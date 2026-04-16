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
[x] Install backend deps: @nestjs/passport, @nestjs/jwt, passport, passport-jwt,
      bcrypt, @types/bcrypt, @nestjs/config, class-validator, class-transformer
[x] Create common/decorators/public.decorator.ts  (@Public())
[x] Create common/decorators/roles.decorator.ts   (@Roles(...roles))
[x] Create User schema (email, passwordHash select:false, role enum)
[x] Create signup.dto.ts and login.dto.ts with class-validator decorators
[x] Implement AuthService
      → signup: hash password with bcrypt (rounds: 10), save user, return { id, email, role }
      → login: find by email, compare hash, sign JWT, return { accessToken }
      → JWT payload: { sub: userId, email, role }
[x] Implement JwtStrategy (validate returns { id, email, role })
[x] Implement JwtAuthGuard (extends AuthGuard('jwt'), skips @Public() routes)
[x] Implement RolesGuard (reads @Roles() via Reflector, returns 403 if mismatch)
[x] Register JwtAuthGuard and RolesGuard as global APP_GUARDs in AppModule
[x] Implement AuthController
      → POST /auth/signup  (@Public())
      → POST /auth/login   (@Public())
[x] Create common/filters/http-exception.filter.ts and register globally
[x] Create common/interceptors/transform.interceptor.ts (strips passwordHash)
[x] Create common/pipes/validation.pipe.ts and register globally
[x] Manual test: signup → login → get accessToken
```

Commit: `feat(auth): implement JWT signup, login, and global guards`

---

## Phase 3 — Reports Module + State Machine

Goal: Full CRUD on own reports, submit endpoint, state machine unit tested.

```
[x] Create ExpenseReport schema (userId ref, title, description, status, totalAmount)
[x] Create report-state-machine.ts
      → ReportStatus type
      → VALID_TRANSITIONS record
      → canTransition(from, to): boolean
      → assertTransition(from, to): void  — throws BadRequestException on invalid
[x] Write report-state-machine.spec.ts
      → test every valid transition passes
      → test every invalid transition throws (including APPROVED → anything)
[x] Run tests: pnpm --filter backend test — all must pass before proceeding
[x] Create create-report.dto.ts and update-report.dto.ts
[x] Implement ReportsService
      → create(userId, dto): report starts as DRAFT, totalAmount: 0
      → findAll(userId, status?): list own reports with optional status filter
      → findOne(id, userId): find by { _id: id, userId } — 404 if not found
      → update(id, userId, dto): only if DRAFT, else 400
      → delete(id, userId): only if DRAFT, else 400
      → submit(id, userId): assertTransition(DRAFT, SUBMITTED), save
[x] Implement ReportsController
      → GET    /reports          (@Roles not needed — authenticated user only)
      → POST   /reports
      → GET    /reports/:id
      → PATCH  /reports/:id
      → DELETE /reports/:id
      → POST   /reports/:id/submit
[x] Manual test: full CRUD cycle + submit
```

Commit: `feat(reports): add report CRUD, submit endpoint, and state machine`
Commit: `test(reports): unit tests for all state machine transitions`

---

## Phase 4 — Items Module

Goal: Expense item CRUD with DRAFT lock, totalAmount recomputed on every mutation.

```
[x] Create ExpenseItem schema (reportId ref, amount, currency, category,
      merchantName, transactionDate, receiptUrl, aiExtracted sub-doc)
[x] Create create-item.dto.ts and update-item.dto.ts
[x] Implement ItemsService
      → assertReportDraft(reportId, userId): fetches report, throws 400 if not DRAFT,
           throws 404 if report not found or not owned by user
      → recomputeTotal(reportId): aggregates $sum of items.amount, updates report
      → create(reportId, userId, dto): assertReportDraft → save item → recomputeTotal
      → findAll(reportId, userId): verify ownership then list items
      → update(itemId, reportId, userId, dto): assertReportDraft → update → recomputeTotal
      → delete(itemId, reportId, userId): assertReportDraft → delete → recomputeTotal
[x] Write items.service.spec.ts
      → create succeeds when report is DRAFT
      → create throws 400 when report is SUBMITTED / APPROVED / REJECTED
      → totalAmount is recomputed correctly after create
      → totalAmount is recomputed correctly after delete
[x] Run tests: all must pass before proceeding
[x] Implement ItemsController (nested under /reports/:reportId/items)
      → GET    /reports/:reportId/items
      → POST   /reports/:reportId/items
      → PATCH  /reports/:reportId/items/:itemId
      → DELETE /reports/:reportId/items/:itemId
[x] Manual test: add two items, verify totalAmount on report, submit, try to edit → 400
```

Commit: `feat(items): add expense item CRUD with DRAFT lock and totalAmount recomputation`
Commit: `test(items): unit tests for DRAFT lock and totalAmount recomputation`

---

## Phase 5 — Uploads & AI Extraction

Goal: Receipt file upload to MinIO, Claude vision extraction, fields returned to frontend.

```
[x] Install backend deps: @nestjs/platform-express (already included), multer,
      @types/multer, minio, @anthropic-ai/sdk
[x] Implement UploadsService
      → onModuleInit: create MinIO client from env vars, ensure bucket exists
      → upload(buffer, mimetype, originalname): generates UUID key,
           streams to MinIO, returns { url: key }
[x] Implement ExtractionService
      → extract(buffer, mimetype): calls Anthropic claude-sonnet-4-5 vision API
           prompt: extract merchantName, amount, currency, transactionDate as JSON
           wraps entire call in try/catch
           on success: parse JSON, return { merchantName, amount, currency, transactionDate }
           on failure: log error, return { merchantName: null, amount: null, currency: null, transactionDate: null }
[x] Implement UploadsController
      → POST /items/:itemId/receipt
      → Multer intercepts file (fileFilter: image/*, application/pdf; limit: 10MB)
      → UploadsService.upload() → get receiptUrl
      → ExtractionService.extract() → get aiExtracted fields
      → ItemsService.attachReceipt(itemId, receiptUrl, aiExtracted) → update item
      → Return updated item
[x] Add attachReceipt method to ItemsService
      → does NOT go through assertReportDraft — receipt can be attached at any status
      → updates receiptUrl and aiExtracted fields only
[x] Manual test: upload a receipt image, verify MinIO bucket, verify aiExtracted
      fields returned in response
```

Commit: `feat(uploads): add MinIO file upload and Claude vision receipt extraction`

---

## Phase 6 — Admin Module

Goal: Admin can list all reports and approve or reject submitted ones.

```
[x] Implement AdminService
      → findAll(status?): find all reports across all users, with optional status filter
           populate userId with { email } for display
      → approve(reportId): find report, assertTransition(SUBMITTED, APPROVED), save
      → reject(reportId): find report, assertTransition(SUBMITTED, REJECTED), save
[x] Implement AdminController
      → all routes decorated with @Roles('admin')
      → GET  /admin/reports          ?status= filter
      → POST /admin/reports/:id/approve
      → POST /admin/reports/:id/reject
[x] Manual test: submit a report as user, approve as admin, verify terminal state
```

Commit: `feat(admin): add admin list, approve, and reject endpoints`

---

## Phase 7 — Integration Test

Goal: End-to-end happy path test passing in CI without docker.

```
[x] Install test deps in apps/backend: mongodb-memory-server, supertest, @types/supertest
[x] Configure jest e2e config to use mongodb-memory-server
[x] Write test/app.e2e-spec.ts covering full sequence from CLAUDE.md section 12:
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
[x] Run: pnpm --filter backend test:e2e — must pass
```

Commit: `test(e2e): happy path DRAFT → SUBMITTED → APPROVED integration test`

---

## Phase 8 — Frontend: Auth Pages

Goal: Login and signup pages functional, JWT stored, redirects working.

```
[x] Install frontend deps: axios, jwt-decode
[x] Create lib/auth.ts
      → getToken(): string | null
      → setToken(token: string): void
      → clearToken(): void
      → getRole(): 'user' | 'admin' | null  (decode JWT)
      → isAuthenticated(): boolean
[x] Create lib/api.ts
      → axios instance with baseURL = NEXT_PUBLIC_API_URL
      → request interceptor: attach Authorization header
      → response interceptor: on 401 clear token + redirect to /login
[x] Create app/(auth)/login/page.tsx
      → form: email + password
      → calls POST /auth/login
      → on success: setToken, redirect to /reports (user) or /admin/reports (admin)
[x] Create app/(auth)/signup/page.tsx
      → form: email + password + role select (user/admin)
      → calls POST /auth/signup, then auto-login, redirect
[x] Create app/(user)/layout.tsx
      → client component, checks isAuthenticated() on mount
      → redirects to /login if not authenticated
      → redirects to /admin/reports if role === 'admin'
[x] Create app/(admin)/layout.tsx
      → checks isAuthenticated() and getRole() === 'admin'
      → redirects non-admins to /reports
[x] Manual test: signup → login → redirect to reports → protected route blocks unauthenticated
```

Commit: `feat(frontend): add auth pages, JWT helpers, and route guards`

---

## Phase 9 — Frontend: User Report Flow

Goal: Full user journey from report list through item entry and submission.

```
[x] Create components/StatusBadge.tsx
      → DRAFT=gray, SUBMITTED=blue, APPROVED=green, REJECTED=red
      → Tailwind pill with label
[x] Create components/ReportCard.tsx
      → title, status badge, totalAmount, date, link to detail
[x] Create app/(user)/reports/page.tsx
      → fetch GET /reports on load
      → list of ReportCards
      → "New Report" button
      → status filter tabs (All / Draft / Submitted / Approved / Rejected)
[x] Create app/(user)/reports/new/page.tsx
      → form: title + description
      → POST /reports on submit
      → redirect to /reports/:id on success
[x] Create app/(user)/reports/[id]/page.tsx
      → fetch report + items
      → show title, status badge, totalAmount
      → items table: merchant, amount, currency, date, receipt icon
      → "Add Item" button (disabled if not DRAFT)
      → "Submit Report" button (disabled if not DRAFT)
      → "Re-open & Edit" button shown when REJECTED → POST /reports/:id/reopen → DRAFT
      → submit calls POST /reports/:id/submit, refreshes status
[x] Create components/ExtractionPreview.tsx
      → displays extracted fields as read-only preview with "Override" affordance
[x] Create components/ReceiptUploader.tsx
      → file input (accept: image/*, application/pdf)
      → manages ExtractionState discriminated union:
           idle / uploading / extracting / complete / error
      → on file select: POST /items/:itemId/receipt
      → on complete: calls onExtracted(fields) callback to pre-fill form
[x] Create app/(user)/reports/[id]/items/new/page.tsx
      → form: amount, currency, category, merchantName, transactionDate
      → ReceiptUploader at top — pre-fills form on extraction complete
      → all fields remain editable after pre-fill
      → POST /reports/:reportId/items on save
[x] Create app/(user)/reports/[id]/items/[itemId]/edit/page.tsx
      → same form, pre-filled with existing item data
      → PATCH /reports/:reportId/items/:itemId on save
[x] Manual test: create report → add 2 items with receipts → verify totalAmount → submit
```

Backend additions made during Phase 9:
- POST /reports/:id/reopen  (REJECTED → DRAFT) — ReportsService.reopen(), code 008

Commit: `feat(frontend): add report list, detail, and item form with receipt upload`

---

## Phase 10 — Frontend: Admin View

Goal: Admin can see all reports and approve or reject submitted ones.

```
[x] Create app/(admin)/admin/reports/page.tsx
      → fetch GET /admin/reports on load
      → table: user email, report title, status badge, totalAmount, date, actions
      → status filter (All / Submitted / Approved / Rejected)
      → "Approve" button (only shown for SUBMITTED reports)
      → "Reject" button (only shown for SUBMITTED reports)
      → approve calls POST /admin/reports/:id/approve, refreshes row
      → reject calls POST /admin/reports/:id/reject, refreshes row
      → clicking row navigates to read-only detail view
[x] Create app/(admin)/admin/reports/[id]/page.tsx
      → fetch GET /admin/reports/:id + GET /admin/reports/:id/items
      → read-only items table (no edit/delete)
      → summary card: totalAmount, item count, submitted-by, created date
      → "Approve" / "Reject" buttons with confirmation dialog (SUBMITTED only)
      → back button to /admin/reports
[x] Manual test: submit report as user, approve as admin, verify status update in both views
```

Backend additions made during Phase 10:
- GET /admin/reports/:id           — AdminService.findOne() (with userId populated)
- GET /admin/reports/:id/items     — ItemsService.findAllForAdmin() (no ownership check)

Commit: `feat(frontend): add admin report list with approve and reject actions`

---

## Phase 11 — Documentation & Polish

Goal: Assessment deliverables complete, git history clean, reviewer can run in 5 minutes.

```
[x] Write DECISIONS.md covering:
      → Stack choices and why (NestJS, Next.js, MongoDB, MinIO)
      → REJECTED → DRAFT (not direct re-submit) — rationale
      → Synchronous extraction — rationale and acknowledged trade-off
      → totalAmount as stored computed field — rationale and drift prevention
      → MongoDB vs PostgreSQL — honest trade-off
      → Ownership checks in service queries (404 not 403)
      → API response envelope design
      → "One more day" section: async extraction with BullMQ + confidence scores,
           per-report audit trail with rejection notes, role-scoped admin item access
[x] Write README.md covering:
      → Prerequisites (Node.js 20+, pnpm, Docker)
      → Setup: clone → cp .env.example → fill ANTHROPIC_API_KEY → pnpm dev:infra → pnpm install → pnpm dev
      → Running tests: pnpm test, pnpm test:e2e
      → Architecture overview (2 paragraphs)
      → AI usage note: which tools, how they helped, where output was corrected
[x] Review git log — no single giant commit, messages follow convention
[x] Verify pnpm test and pnpm test:e2e both pass (39 tests passing)
[x] Final check: no console.log left in production code paths
[x] Final check: .env not committed (only .env.example) — confirmed gitignored
[x] Final check: passwordHash never appears in any API response (select:false + TransformInterceptor)
```

Commit: `docs: add DECISIONS.md, README.md, and AI usage note`

---

## Phase 12 — Optional: Async Receipt Processing (BullMQ + Redis)

Goal: Replace blocking Anthropic API call with a job queue. Upload returns immediately;
frontend polls for extraction result. Enables retries and removes 2–5 s blocking wait.

```
[ ] Add redis service to docker-compose.yml (image: redis:7, port 6379)
[ ] Add REDIS_HOST and REDIS_PORT to .env.example and apps/backend/.env
[ ] Install backend deps: @nestjs/bull, bull, @types/bull, ioredis
[ ] Create src/extraction-queue/extraction-queue.module.ts
      → registers BullModule.forFeature({ name: 'extraction' })
      → imports UploadsModule, ItemsModule
[ ] Create src/extraction-queue/extraction.processor.ts
      → @Processor('extraction') class
      → @Process() handler: receives { itemId, buffer (base64), mimetype }
      → calls ExtractionService.extract() → calls ItemsService.attachReceipt()
      → on failure: logs error, sets aiExtracted: null on item
      → job options: attempts: 3, backoff: { type: 'exponential', delay: 2000 }
[ ] Update UploadsController POST /items/:itemId/receipt
      → uploads to MinIO → returns { receiptUrl, jobId } immediately
      → enqueues extraction job — does NOT await ExtractionService
      → sets item.receiptUrl via ItemsService.attachReceipt() (aiExtracted: null for now)
[ ] Add GET /items/:itemId/extraction-status endpoint in UploadsController
      → fetches job from queue by jobId
      → returns { status: 'pending' | 'processing' | 'complete' | 'failed', aiExtracted? }
[ ] Update ReceiptUploader component (frontend)
      → add 'pending' state to ExtractionState discriminated union
      → after upload success: enter 'pending' state with jobId
      → poll GET /items/:itemId/extraction-status every 2 s (max 60 s)
      → on complete: enter 'complete' state with aiExtracted fields
      → on failed / timeout: enter 'error' state
[ ] Unit test: extraction processor succeeds and calls attachReceipt
[ ] Unit test: extraction processor handles Anthropic API failure gracefully
```

Commit: `feat(extraction): async BullMQ queue for receipt processing`

---

## Phase 13 — Optional: Confidence Scores in UI

Goal: Surface per-field confidence from the LLM so users know which extracted
values to trust and which to verify carefully.

```
[x] Update ExtractionService prompt
      → request JSON shape: { merchantName: { value: string|null, confidence: number },
           amount: { value: number|null, confidence: number },
           currency: { value: string|null, confidence: number },
           transactionDate: { value: string|null, confidence: number } }
      → confidence range: 0.0 (no confidence) – 1.0 (certain)
[x] Update ExtractedFields interface to include confidence per field
[x] Update aiExtracted sub-document schema on ExpenseItem
      → each field becomes { value: T|null, confidence: number|null }
      → keep backwards-compatible: confidence defaults to null for pre-existing items
[x] Update ItemsService.attachReceipt() to accept the new aiExtracted shape
[x] Update ExtractionPreview component
      → each pre-filled field shows a confidence badge alongside the value:
           ≥ 0.85 → green "High" badge
           0.60–0.84 → amber "Review" badge with tooltip "AI is uncertain — please verify"
           < 0.60 → red "Low" badge — field is highlighted as needing manual check
      → no confidence (null) → no badge shown (legacy/failed extraction)
[x] Update new/edit item forms to receive and pass confidence to ExtractionPreview
[x] TooltipProvider added to root layout for tooltip support
```

Commit: `feat(extraction): confidence scores per field in UI`

---

## Phase 14 — Optional: Per-report Audit Trail

Goal: Every status transition is recorded with actor, timestamp, and optional
rejection note. Admins see the full history on the report detail view.

```
[x] Add statusHistory sub-document to ExpenseReport schema
      → type StatusHistoryEntry = {
           from: ReportStatus | null   (null for initial DRAFT creation)
           to:   ReportStatus
           actorId:   ObjectId (ref: User)
           actorRole: 'user' | 'admin'
           note: string | null
           timestamp: Date
         }
      → statusHistory: [StatusHistoryEntry]  (default: [])
[x] Append history entry on every transition:
      → ReportsService.create(): append { from: null, to: 'DRAFT', actorRole: 'user', ... }
      → ReportsService.submit(): append { from: 'DRAFT', to: 'SUBMITTED', ... }
      → ReportsService.reopen(): append { from: 'REJECTED', to: 'DRAFT', ... }
      → AdminService.approve(): append { from: 'SUBMITTED', to: 'APPROVED', ... }
      → AdminService.reject(note?): append { from: 'SUBMITTED', to: 'REJECTED', note, ... }
[x] Update AdminService.reject() to accept optional note: string parameter
[x] Update admin reject endpoint body DTO: { note?: string }  (admin/dto/reject-report.dto.ts)
[x] Update ConfirmDialog used for rejection in frontend to include optional textarea
      → "Reason for rejection (optional)" field in the reject dialog
      → passes note to POST /admin/reports/:id/reject body
[x] Update admin detail page to render statusHistory timeline
      → list of entries, newest first
      → each entry: actor role chip, status transition arrow, note (if any), timestamp
[x] Update user detail page to show rejection note when status is REJECTED
      → prominent banner: "Rejected — [note]" if note is present
[x] Unit test: statusHistory grows correctly across submit → reject → reopen → submit cycle
      (reports.service.spec.ts — 6 tests)
[x] Unit test: rejection note is stored and returned correctly
      (admin.service.spec.ts — 4 tests)
```

Commit: `feat(audit): per-report status history with rejection notes`

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
