# Testing Context

Loaded when writing, wiring, or diagnosing tests (Vitest unit/integration; Playwright E2E). Extends CLAUDE.md § Validation Intent Ladder and `.claude/context/validation-pipeline.md`. (`bun run test` vs `bun test`, `test:fast`: see CLAUDE.md § Commands.)

## Test-utils barrel — `@green-goods/shared/testing`

Alias → `packages/shared/src/__tests__/test-utils/`. Import test helpers from here, not deep paths.

- `renderHookWithProviders` / `renderWithProviders` (= `renderWithQuery`) — wrap in QueryClient + `IntlProvider` (react-intl `MISSING_TRANSLATION` silenced).
- `createTestQueryClient` (retry off, `gcTime`/`staleTime` 0); call `resetTestQueryClient()` in `afterEach`.
- Mock factories (`mock-factories.ts`): `createMockGarden`, `createMockWork`, `createMockAction`, `createMockAuthContext`, `createMockSmartAccountClient`, `createMockFile`, … (18 factories).
- Offline helpers (`offline-helpers.ts`): `createMockOfflineWork`/`Conflict`, `mockFetch`/`mockFetchSequence`/`mockFetchError`, `simulateNetworkConditions.{offline,online,slow}`.
- `createSharedBarrelMock(actual, overrides)` — mock the shared barrel via `vi.importActual`, overriding only hooks (real exports auto-inherit; new hooks fail loud).
- Re-exports `@testing-library/react` + `userEvent`.

## Repo-tuned Vitest config (per-package `vitest.config.ts`)

- jsdom env, `globals: true`, `pool: "threads"`, `isolate: true`, `testTimeout: 10000`.
- React deduped + aliased to the workspace-root runtime so hooks share one dispatcher — never add a second React instance.
- Heavy SDKs alias-mocked to skip dep chains: EAS SDK → `src/__mocks__/eas-sdk.ts`, WalletConnect utils → `src/__mocks__/walletconnect-utils.ts`; `zod`/`viem`/`wagmi`/`multiformats` force-inlined via `server.deps.inline`.
- Setup files: shared/client `setupTests.ts`, admin/agent `setup.ts` — all extend `packages/shared/src/__tests__/setupTests.base.ts`.
- `agent` package differs: `node` env, `fileParallelism: false`, much lower thresholds (10/20/20/20).

## GG mock / jsdom conventions (`setupTests.base.ts` + per-package setup)

- Strict `fetch`: any unmocked call throws ("Mock this endpoint explicitly") — mock via MSW or `mockFetch`.
- MSW GraphQL server from `@green-goods/shared/mocks` (`src/__mocks__/server/`); admin runs `server.listen({ onUnhandledRequest: "error" })` and resets per test.
- Reown AppKit module-mocked (no network/403); `react-hot-toast` mocked in admin.
- jsdom polyfills so Radix / floating-ui primitives render: `HTMLDialogElement.showModal/close`, `matchMedia`, `ResizeObserver`, `IntersectionObserver`, `scrollIntoView` (admin); `fake-indexeddb/auto` for IndexedDB. Drive dialogs/menus with `fireEvent` (jsdom has no real pointer events). These live in setup — don't re-stub per test.

## Coverage

Enforced global thresholds live in each `vitest.config.ts` (branches/functions/lines/statements): **shared** 52/59/62/61 · **client** 56/62/64/63 · **admin** 47/44/53/51. Pull request Test jobs run plain `bun run test`; `.github/workflows/coverage-nightly.yml` enforces these floors nightly and after every push to `main`. Local coverage commands still generate `coverage/index.html`; CI omits HTML.

The first ratchet review is 2026-09-22. Once coverage supports it, raise every configured metric by two percentage points and update the matching arrays in `scripts/quality/workflow-performance-parity.test.mjs` in the same change. Policy targets remain critical paths ≥80% and auth/crypto 100%. Contracts use Foundry, not Vitest — see `.claude/context/contracts.md` and `docs/docs/builders/testing/forge.mdx`.

## Critical paths (deepest coverage in `packages/shared/src/`)

Auth / work / job-queue / vault / blockchain surfaces are the `critical` tier in **CLAUDE.md § Criticality Matrix** — follow it, don't restate. Coverage-specific additions:

- Contract errors — `utils/errors/{contract-errors,mutation-error-handler}.ts`
- Garden ops — `hooks/garden/**`; Role mgmt — `hooks/roles/**`
- Query keys — `config/query-keys/**` (cache correctness across all queries)
- Offline sync — `hooks/app/useOffline.ts` + `modules/job-queue/**`

## Test-type conventions

- Mutation hooks: assert the error path at both hook level (`isError` + handler/`logger.error` called) and component level (error toast surfaced). Errors are never swallowed.
- Hook cleanup: verify timers cleared, listeners removed, `isMounted` guards on unmount — i.e. `.claude/rules/react-patterns.md` Rules 1-3.
- Offline: `fake-indexeddb/auto` + `simulateNetworkConditions` / `navigator.onLine` spy; assert job-queue jobs transition pending → completed.
- E2E (Playwright): critical journeys only, client PWA + admin with platform-specific auth (passkey / wallet-injection / mock-auth). Scope, helpers, runner: `tests/README.md`. Config + fixtures: `docs/docs/builders/testing/playwright.mdx`.

## Risk-triggered state and invariant matrix

Use a written matrix before implementing tests when behavior depends on a financial state machine,
mutable dependency, retry/grace window, cross-chain acknowledgment, asynchronous projection, or
upgradeable storage. Select the relevant axes from:

`action × lifecycle state × actor/role overlap × rail/denomination × pause/pool state × time boundary × dependency generation`

Each material row names the expected effect or revert, cleanup of active indexes/reservations,
history that must remain immutable, external calls, and proof. Include dual-role actors, terminal
states, duplicates/retries, and before/after time boundaries when applicable. The contracts-specific
invariants live in `.claude/context/contracts.md`.

## Regression and tooling closure

- A behavior defect gets a negative test for the original trigger plus a bounded sibling search for
  the same root-cause class. Record checked-unaffected paths instead of claiming the whole repo is
  safe.
- An intentionally unsupported capability gets an explicit rejection test; do not fabricate the
  missing authority, receipt, secret, or deployment state in order to make a happy path pass.
- Validation and migration tools need failure-path tests for unknown arguments, malformed input,
  path confinement, idempotency, atomic updates, partial failure, and accurate summaries where those
  concerns apply.

## CI authentication seam

Set up auth **before navigation**: `setupAuthenticatedClient` for client CI and the spec-local `setupAuthenticatedAdmin` pattern for admin CI. Both use the dev `mockAuth` seam read by `AuthGate` and `DevAuthProvider`; the client setup also installs the schema-correct `mock-backend` fixtures for the indexer, EAS, and RPC boundaries. Treat these helpers and fixtures as the canonical CI auth boundary.

Do not use `injectWalletAuth` for CI authentication — it is a legacy wallet-storage fallback that depends on wagmi accepting a real connector and is unreliable in headless CI. Keep it only for its narrow platform/auth-path coverage. Matching Playwright CI projects: `PLAYWRIGHT_APP=client APP_ENV=test bunx playwright test --project=client-ci` / `PLAYWRIGHT_APP=admin … --project=admin-ci`.

## QA-speed proof substitutes

Under QA Speed Mode (CLAUDE.md § Validation Intent Ladder), a fix may record instead of a new test:

- `not_applicable` — behavior unchanged (copy, docs, static config, visual token/class with no logic path).
- `proof_limit` — a targeted test would be brittler/slower than direct proof (one-off visual layout, staging-only, authenticated-browser-only state).

Always record the substitute evidence (file re-read, existing targeted test, package-local typecheck/build, or authenticated Brave rendered proof). Never for auth/crypto/job-queue/mutation behavior, shared public-API changes, or release readiness — those need tests + the appropriate gate.
