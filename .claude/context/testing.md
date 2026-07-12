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

Enforced global thresholds live in each `vitest.config.ts` (source of truth): **shared** 70/70/70/70 · **admin** 70/70/70/70 · **client** 75 branches / 80 funcs·lines·stmts. Policy targets (not config-enforced): critical paths ≥80%, auth/crypto 100%. Contracts use Foundry, not Vitest — see `.claude/context/contracts.md` and `docs/docs/builders/testing/forge.mdx`. Report: `bun run test --coverage` → `coverage/index.html`.

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

## QA-speed proof substitutes

Under QA Speed Mode (CLAUDE.md § Validation Intent Ladder), a fix may record instead of a new test:

- `not_applicable` — behavior unchanged (copy, docs, static config, visual token/class with no logic path).
- `proof_limit` — a targeted test would be brittler/slower than direct proof (one-off visual layout, staging-only, authenticated-browser-only state).

Always record the substitute evidence (file re-read, existing targeted test, package-local typecheck/build, or authenticated Brave rendered proof). Never for auth/crypto/job-queue/mutation behavior, shared public-API changes, or release readiness — those need tests + the appropriate gate.
