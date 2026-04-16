# Gradion Expense Report System

A full-stack Expense Report Management System built as a take-home assessment for Gradion.
Users create and submit expense reports with receipt uploads and AI-powered field extraction.
Admins review, approve, or reject submitted reports.

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 20+ |
| pnpm | 9+ |
| Docker + Docker Compose | any recent version |

Install pnpm if you don't have it: `npm install -g pnpm`

---

## Quick Start

```bash
# 1. Clone the repo
git clone <repo-url>
cd gradion-assessment

# 2. Set up backend environment
cp .env.example apps/backend/.env
# Open apps/backend/.env and fill in your ANTHROPIC_API_KEY
# All other values work as-is for local development

# 3. Set up frontend environment
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > apps/frontend/.env.local

# 4. Start infrastructure (MongoDB + MinIO)
pnpm dev:infra
# Or: docker-compose up mongodb minio -d

# 5. Install dependencies
pnpm install

# 6. Start both apps
pnpm dev
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Swagger UI: http://localhost:3001/api/docs
- MinIO Console: http://localhost:9001 (user: minioadmin / minioadmin)

**First-time setup:** Create an account via the Sign Up page. Select role `user` to
create and submit expense reports, or `admin` to review and approve them.

---

## Running Tests

```bash
# Unit tests (state machine, items service, reports service, admin service)
pnpm test

# Integration test (full happy path via Supertest + in-memory MongoDB)
pnpm test:e2e
```

50 unit tests + 1 e2e test. All run entirely in-process — no Docker or running services required.

---

## Project Structure

```
gradion-assessment/
├── apps/
│   ├── backend/          NestJS API (port 3001)
│   └── frontend/         Next.js 16 App Router (port 3000)
├── docs/
│   ├── architecture.md   Detailed architecture reference
│   └── plan.md           Implementation plan with phase tracking
├── CLAUDE.md             Claude Code project context (AI artifact)
├── DECISIONS.md          Architectural decisions and trade-offs
├── docker-compose.yml
└── .env.example
```

---

## Architecture Overview

The backend is a NestJS API with five modules: auth (JWT signup/login), reports
(CRUD + state machine), items (expense line items with DRAFT lock), uploads (MinIO
file storage + Anthropic vision extraction), and admin (cross-user report review).
Business logic lives exclusively in services — controllers handle HTTP only. A
global `TransformInterceptor` wraps every response in a consistent
`{ status, message, messageCode, data }` envelope, and a global
`HttpExceptionFilter` gives errors the same shape.

The frontend is a Next.js 16 App Router app split into three route groups:
`(auth)` for guest pages, `(user)` for the employee dashboard, and `(admin)` for
the admin console. Each group's `layout.tsx` enforces its own auth guard so
unauthenticated and cross-role access is structurally blocked. API calls go through
a single Axios instance (`lib/api.ts`) with a request interceptor that attaches the
JWT and a response interceptor that clears the token and redirects on 401.

The report lifecycle is governed by a state machine
(`DRAFT → SUBMITTED → APPROVED | REJECTED → DRAFT`) implemented as a pure
function module with no side effects, making every transition unit-testable in
isolation.

Two optional enhancements are included beyond the core requirements. **Confidence
scores:** the Claude extraction prompt returns `{ value, confidence }` per field;
the UI renders colour-coded badges (green/amber/red) beside each pre-filled value so
users know which fields to verify carefully. **Audit trail:** every status transition
appends an immutable entry to `statusHistory` on the report — actor, transition,
optional rejection note, and timestamp. Admins see the full timeline on the detail
view; users see a rejection note banner when their report is rejected.

See `DECISIONS.md` for the rationale behind key design choices.

---

## API Documentation

Interactive Swagger UI is available at **http://localhost:3001/api/docs** while
the backend is running. Use the **Authorize** button and paste a JWT from
`POST /auth/login` to authenticate all requests.

---

## AI Usage

This project was built with Claude Code (Anthropic) as the primary AI coding tool.
Claude helped scaffold all backend modules, generate DTO boilerplate, write unit
and integration tests, and build the full frontend UI from a design spec written
into `CLAUDE.md` and `.claude/skills/frontend/SKILL.md`. The AI artifacts
committed to the repo (`CLAUDE.md`, `docs/plan.md`, `docs/architecture.md`,
`.claude/`) are genuine working context files that were actively used to maintain
coherence across sessions — not generated after the fact for the submission.

Where I overrode or corrected AI output: the initial state machine implementation
had no enforcement of the `REJECTED → DRAFT` re-open path (the transition was
defined but no endpoint triggered it). I identified the gap by cross-checking the
state machine code against the requirement diagram, added the `POST /reports/:id/reopen`
endpoint, and updated the frontend to surface the "Re-open & Edit" CTA. The AI also
initially missed the admin items access issue — the detail view was calling the
user-owned `/reports/:id/items` endpoint which would fail for admin users, requiring
a dedicated `/admin/reports/:id/items` endpoint backed by a bypass method in
`ItemsService`. These corrections are examples of where the AI produced structurally
plausible but functionally incomplete code that required deliberate review.
