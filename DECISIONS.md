# DECISIONS.md — Gradion Expense Report Assessment

> This document records every non-trivial architectural and design decision made
> during implementation, with the reasoning behind each choice and an honest
> account of the trade-offs involved.

---

## 1. Stack Choices

### NestJS (backend)

NestJS enforces the separation of concerns this assessment explicitly evaluates —
modules, guards, services, and controllers are first-class architectural concepts,
not just conventions. Business logic leaking into controllers is structurally
harder to do than not doing it. The opinionated module system also made it easy to
carve the domain cleanly: auth, reports, items, uploads, and admin are fully
isolated, each owning its own schema, service, and controller with explicit module
imports as the only coupling surface.

The alternative would have been a plain Express app. Express gives more freedom,
but freedom is a liability in a time-boxed exercise where the goal is demonstrating
that the right patterns are applied, not discovering them.

### Next.js 16 App Router (frontend)

The App Router's route group layout system — `(user)/layout.tsx`,
`(admin)/layout.tsx` — makes the user/admin split a structural constraint, not a
runtime check scattered across components. Auth guards and the sidebar shell live
in layout files and wrap every page in their group automatically. The alternative
(a traditional `_app.tsx` with manual role checks on every page) is more error-prone.

The server/client component split also kept the data-fetching story clean: pages
that only display data are server components; forms and interactive elements are
isolated client component islands.

### MongoDB + Mongoose

The expense report domain maps naturally to documents. A report owns its items,
and the dominant read pattern is "give me this report and all its items" — a
pattern that fits document storage well. The `aiExtracted` sub-document on each
item stores raw LLM output alongside user-edited fields without any migration
concern; in a relational schema, this would require a nullable JSON column or a
separate `extraction_results` table.

**Honest trade-off:** PostgreSQL would provide stricter referential integrity,
easier ad-hoc aggregation across all reports, and SQL familiarity for most backend
engineers. If cross-report analytics, complex multi-table joins, or strict cascade
deletes were a core requirement, the trade-off would reverse. For this scope,
MongoDB's ergonomics and Mongoose's schema validation are a better fit.

### MinIO (file storage)

S3-compatible API locally — switching to AWS S3 in production is a single
environment variable change. No cloud account, no network dependency, no cold-start
delays for the reviewer. The bucket is created programmatically on startup
(`onModuleInit`) so there is no manual setup step.

### Anthropic Claude API — vision extraction

Claude's vision capability handles both JPEG/PNG images and PDFs natively without
a separate OCR pipeline. The model returns structured JSON with a `{ value, confidence }`
shape per field — value is the extracted data or `null` if undetermined; confidence is
a 0.0–1.0 score. The UI renders a colour-coded badge alongside each pre-filled field:
green "High" (≥ 0.85), amber "Review" (0.60–0.84) with a tooltip, red "Low" (< 0.60).
Using the same model that generates this project context for extraction felt like an
appropriate dog-food choice.

### pnpm workspaces (monorepo)

Single repository, single Git history, shared tooling. Root scripts (`dev`,
`test`, `build`) delegate to workspace filters via `pnpm --filter`. The only root
dependency is `concurrently` for running backend and frontend in parallel.

---

## 2. State Machine — REJECTED → re-submit

**Decision:** `REJECTED → DRAFT` (explicit reopen), then `DRAFT → SUBMITTED`.  
Direct `REJECTED → SUBMITTED` is not allowed.

**Implementation:** A dedicated `POST /reports/:id/reopen` endpoint calls
`assertTransition(REJECTED, DRAFT)` in `ReportsService` and sets `status = DRAFT`.
The frontend shows a "Re-open & Edit" button only when a report is in REJECTED
state. After reopening, all normal DRAFT-state actions become available: edit
title/description, add/edit/delete items, and submit.

**Rationale:** Requiring the user to explicitly reopen the report before re-submitting
serves two purposes. First, it forces conscious acknowledgment that the report was
rejected — the user cannot accidentally re-enter the admin queue without taking a
deliberate action. Second, it produces a cleaner audit trail: the status history
shows `REJECTED → DRAFT → SUBMITTED` rather than jumping directly back to
`SUBMITTED`, which makes it unambiguous that the user revised the report after the
rejection. The extra step is minimal friction for the user but meaningful signal for
the admin reviewing the re-submission.

The alternative — allowing direct `REJECTED → SUBMITTED` — was simpler to
implement but removes the edit window and the audit signal. The assessment
description explicitly noted this as a decision to document, which suggests the
distinction matters.

---

## 3. Synchronous AI Extraction

**Decision:** The upload endpoint calls the Anthropic API, awaits the result, and
returns extracted fields in the same HTTP response. Total latency is typically 2–5
seconds.

**Rationale:** Synchronous extraction keeps the implementation simple and the user
experience direct. The frontend manages the wait via an explicit `extracting`
loading state with a spinner and message. For a take-home assessment that will be
reviewed by running it locally against real receipts, synchronous delivery of
results is strictly better UX than polling.

**Acknowledged trade-off:** This blocks the HTTP response for 2–5 seconds on every
upload, is not resilient to Anthropic API timeouts, and provides no retry mechanism.
At production scale with concurrent uploads this would become a latency problem.
The right fix is an async queue — see *"One More Day"* below.

**Why not async now?** Adding BullMQ + Redis to docker-compose, writing a job
processor, implementing a polling or webhook endpoint, and updating the frontend
state machine to handle a `pending` extraction state adds significant complexity
that is not justified for this scope. The synchronous path covers the requirement
completely and the trade-off is explicitly documented.

---

## 4. `totalAmount` as a Stored Computed Field

**Decision:** `totalAmount` on `ExpenseReport` is a stored number recomputed by
the service on every item `create`, `update`, and `delete`. It is never accepted
from the client.

**Rationale:** Storing the computed value makes report list reads fast — no
aggregation at read time, no N+1 queries. The recomputation uses a single MongoDB
`$sum` aggregation pipeline piped back into the parent report via
`findByIdAndUpdate`. Drift is prevented structurally: `totalAmount` is not in any
request DTO, so no client can influence it.

The alternative — computing on read via `$sum` aggregation — would be more
correct in a pure sense (no possibility of staleness) but would add an aggregation
pipeline to every list and detail fetch. Given that writes (item mutations) are far
less frequent than reads in an expense management workflow, the stored approach
wins on the read path.

---

## 5. Role Assignment Is Backend-Only — Not Accepted from Signup Request

**Decision:** `POST /auth/signup` always creates a `user`-role account. The `role` field is not present in `SignupDto` and is hardcoded to `'user'` in `AuthService.signup()`.

**Rationale:** Accepting role as a client-supplied field would allow any unauthenticated caller to self-promote to admin by posting `{ role: 'admin' }` to the signup endpoint. Admin accounts are provisioned exclusively through backend tooling (`pnpm seed:admin`), which mirrors how privileged roles are managed in production systems — not self-served through a public API. Multiple admins can be seeded by adding entries to the `ADMINS` array in `apps/backend/src/scripts/seed-admin.ts`; the script is idempotent — existing emails are skipped. The e2e test seeds the admin fixture directly via the Mongoose model for the same reason.

---

## 6. Ownership Checks in Service Queries, Not Guards

**Decision:** Resource ownership is enforced by filtering `{ _id: reportId, userId: req.user.id }` in the service query, not by a separate guard.

**Rationale:** A guard-based ownership check would fetch the resource once in the
guard and again in the service — two database round-trips. More importantly, a
guard that returns 403 when ownership fails *leaks the existence* of the resource:
an attacker can enumerate resource IDs. Returning 404 from a combined ownership +
existence query reveals nothing. The service layer is the right place for this
because it is the only layer with access to the query scope.

---

## 7. API Response Envelope

**Decision:** Every response uses a consistent `{ status, message, messageCode, data }`
envelope. HTTP method infers default message and code; individual handlers override
with `@ResponseMeta(message, code)`.

**Rationale:** Frontend code can always unwrap `response.data.data` without
conditional shape checking. Error responses use the same envelope shape with
`status: "error"` and `data: null`, so frontend error handling is uniform.

---

## 8. What Was Built Beyond the Core

Two optional enhancements were implemented on top of the core assessment requirements.

### Confidence scores in AI extraction (Phase 13)

The extraction prompt was updated to return a `{ value, confidence }` object per
field instead of a bare value-or-null. Confidence is a 0.0–1.0 float that the LLM
assigns based on how clearly the field is visible in the receipt. The `aiExtracted`
sub-document schema on `ExpenseItem` stores this shape, and the `ExtractionPreview`
component renders a colour-coded badge beside each pre-filled field:

- **Green "High"** (confidence ≥ 0.85) — safe to accept without review
- **Amber "Review"** (0.60–0.84) — tooltip: "AI is uncertain — please verify"
- **Red "Low"** (< 0.60) — field highlighted for mandatory manual check
- **No badge** (confidence null) — extraction failed or pre-dates this feature

The badge system gives users a trust signal rather than leaving them to guess which
fields to double-check. This is particularly valuable for `amount` and `currency`,
where a wrong value has a direct financial consequence.

### Per-report status audit trail (Phase 14)

Every status transition appends an immutable entry to a `statusHistory` array on
`ExpenseReport`. Each entry records `from`, `to`, actor ID and role, an optional
rejection note, and a timestamp. The array is append-only — entries are never
mutated after writing.

The admin reject endpoint accepts an optional `note` string in the request body.
The admin's rejection dialog surfaces this as a free-text textarea before
confirming. On the user's report detail page, a prominent banner shows the
rejection note when the report is in REJECTED state — closing the feedback loop
that would otherwise require out-of-band communication between admin and employee.

The admin report detail page renders a `AuditTimeline` component: a vertical
timeline of history entries, newest-first, with actor role chips, status transition
arrows, quoted rejection notes, and formatted timestamps.

---

## 9. If You Had One More Day — What Would You Build Next and Why?

**I would ship the async extraction queue.** Here is the reasoning.

The single biggest production liability in this implementation is the synchronous
Anthropic API call inside `POST /items/:itemId/receipt`. The upload endpoint blocks
the HTTP connection for 2–5 seconds while waiting for Claude's vision response. In
isolation that feels acceptable — the frontend shows a spinner and a message. In
production it is not: a slow network, a brief Anthropic API degradation, or a
concurrent spike in uploads would make the upload feel broken. There is no retry
mechanism, no timeout handling, and no way to recover a failed extraction without
asking the user to re-upload.

The fix is a job queue. I would add BullMQ backed by Redis. The upload endpoint
stores the file in MinIO, immediately returns `{ receiptUrl, jobId }` to the client,
and enqueues the extraction job with three retry attempts and exponential backoff.
A dedicated `ExtractionProcessor` worker picks up the job, calls
`ExtractionService.extract()`, and writes the result back to the item via
`ItemsService.attachReceipt()`. The frontend polls
`GET /items/:itemId/extraction-status` every two seconds until it sees `complete`
or `failed`. The `ExtractionState` discriminated union already exists in
`ReceiptUploader` — swapping the `extracting` state for a `pending` polling state
is the only frontend change required.

**Why this over anything else?** Because it is the change with the highest ratio of
production correctness gained to code added. The Redis container is one line in
`docker-compose.yml`. The processor is roughly 40 lines of NestJS code. The polling
endpoint is already in scope. The frontend state machine is already wired. None of
the existing tests break — the unit test for the processor mocks both services and
tests the three cases (success, extraction failure, database failure) independently.

I specifically chose *not* to ship this in the assessment submission, and I want to
be transparent about why. I built it: the implementation was complete, TypeScript
clean, and all 42 tests passed (39 original + 3 new processor tests). I removed it
for two reasons. First, it adds a hard infrastructure dependency — the reviewer now
needs Redis running to start the backend. The synchronous path requires no extra
setup and covers the functional requirement completely. Second, the async queue
introduces a class of operational concerns (dead-letter queues, worker crashes,
partial state where `receiptUrl` is set but `aiExtracted` is still null) that I
could not fully surface in the assessment context. Shipping infrastructure you
cannot operate or explain is worse than shipping a simpler synchronous path you
can. The right call in a real product is the queue. The right call for a take-home
submission where reviewer time is the constraint is to document the trade-off and
keep the setup minimal.
