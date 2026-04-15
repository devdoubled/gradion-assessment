Write tests for $ARGUMENTS following the testing strategy in
docs/architecture.md section 11.

Determine test type from the argument:
- "state-machine" → pure unit tests, zero mocks, test every transition in
  CLAUDE.md section 6 including all invalid ones
- "items-service"  → unit tests with mocked Mongoose models, test DRAFT lock
  and totalAmount recomputation
- "e2e"            → integration test in apps/backend/test/app.e2e-spec.ts
  using Supertest + mongodb-memory-server, follow the 12-step sequence in
  docs/architecture.md section 11

Rules for all tests:
- Test file lives next to the source file (*.spec.ts) except e2e
- Test names must be human-readable sentences describing the behaviour
- No implementation details in test names — describe the outcome, not the code
- Each test must be independently runnable (no shared mutable state)

After writing tests:
1. Run them: pnpm --filter backend test (or test:e2e for integration)
2. Fix any failures before finishing
3. Mark relevant tasks [x] in docs/plan.md
4. Commit with prefix test($ARGUMENTS):