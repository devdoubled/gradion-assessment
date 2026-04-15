Read CLAUDE.md section 14 (Implementation Progress) and docs/plan.md.

Find the next unchecked [ ] task in the current phase of plan.md.

Before implementing:
1. Re-read the relevant section in docs/architecture.md for this task
2. Re-read the architectural rules in CLAUDE.md section 5

Then implement the task fully:
- Follow the exact file paths from docs/architecture.md
- Business logic in services only, never in controllers
- Add class-validator decorators on all DTOs
- Handle errors with proper HTTP status codes

When done:
1. Mark the task [x] in docs/plan.md
2. Make a git commit using the convention in CLAUDE.md section 13
3. Tell me what was completed and what the next task is