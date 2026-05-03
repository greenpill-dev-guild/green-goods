# Admin Dashboard Stabilization Spec

## Summary

This hub captures the admin dashboard stabilization audit as a durable backlog
artifact. It covers the live admin route graph, `CanvasLayout` shell contract,
auth and role loading, garden eligibility, React Query persistence, Zustand
stores, and the unified Storybook harness. The first pass is documentation and
planning only; follow-up implementation requires explicit scope lock.

## Users

- Primary: Green Goods maintainers and agent operators working on admin routes,
  admin Storybook stories, and shared admin state hooks.
- Secondary: reviewers who need a clear distinction between production build
  health, Storybook harness failures, and real runtime loading bugs.

## Current Architecture Map

| Area | Current Shape | Source Of Truth | Stabilization Note |
|---|---|---|---|
| Admin boot | `main.tsx` wraps persisted TanStack Query, AppKit, `AuthGate`, `AppProvider`, then `RouterProvider` | `packages/admin/src/main.tsx` | Boot shape is coherent; failures are downstream of auth/garden/story state. |
| Router | Browser/hash router with `/` `IndexRoute`, pathless `CanvasShell`, canonical canvas children, and admin 404 | `packages/admin/src/router.tsx`, `packages/admin/src/routes/views.tsx`, ADR-019 | Keep canonical routes; do not restore retired compatibility paths. |
| Shell | `CanvasLayout` renders `AppBar + MainSheet + NavigationBar`, sheets, command palette, garden URL sync, stale garden guard | `packages/admin/src/components/Layout/CanvasLayout.tsx` | Shell is canonical; fix access-state inputs rather than replacing it. |
| Home terminal states | `/` handles checking, disconnected, embedded wallet, indexer error, no access, and redirect to `/hub` | `packages/admin/src/routes/IndexRoute.tsx` | This is the strongest terminal-state ladder and should become the shared behavior. |
| Direct canvas routes | `/hub`, `/garden`, `/community`, `/actions`, `/profile` enter `CanvasLayout` first | `packages/admin/src/routes/views.tsx` | Direct routes need the same terminal-state contract as `/`, not ad-hoc shell loading. |
| Data fetching | TanStack Query with persisted cache and seeded Storybook query clients | `packages/admin/src/main.tsx`, `packages/shared/.storybook/decorators.tsx` | Storybook seeds must be isolated per story and match intended auth role. |
| Auth | Real `AuthProvider` in runtime; `DevAuthProvider` for dev/story harness identity | `packages/shared/src/providers/Auth.tsx`, `packages/shared/src/providers/DevAuthProvider.tsx` | Dev mock role persists in session storage and must not leak across stories. |
| Roles | `useRole` resolves deployer/operator/user from deployment permissions and operator-garden query | `packages/shared/src/hooks/gardener/useRole.ts` | `/actions` policy should be deployer-only across routes, controllers, and stories. |
| Garden eligibility | `useEligibleAdminGardens` merges base-list role matches with role-confirmed operator stubs | `packages/shared/src/hooks/garden/useEligibleAdminGardens.ts` | Downstream consumers must use the same resolved eligible-garden truth. |
| Garden detail data | `useGardenDetailData` fetches detail slices by ID but resolves `garden` from the base garden list only | `packages/shared/src/hooks/garden/useGardenDetailData.ts` | Role-confirmed stubs are not consistently usable yet. |
| Toolbar permissions | `useEffectiveToolbarPermissions` reads selected garden plus base garden list and role | `packages/shared/src/hooks/roles/useEffectiveToolbarPermissions.ts` | Toolbar visibility can diverge from eligible-garden recovery state. |
| Storybook harness | Shared Storybook hosts admin stories with admin identity, seeded query client, selected garden, and canvas frame decorators | `packages/shared/.storybook`, admin workspace stories | Failing Storybook CI points to harness isolation and Actions role mismatch. |

## Functional Requirements

1. Record a source-grounded architecture audit for admin routing, auth loading,
   data/query state, garden selection, roles, and Storybook runtime harnesses.
2. Preserve `CanvasLayout`, `/hub` as the reference route, ADR-019 canonical
   route inventory, and deployer-only `/actions`.
3. Define a later remediation lane for Storybook/admin state isolation across
   Zustand stores, session storage, dev auth role, and seeded QueryClient state.
4. Define a later remediation lane for a shared admin access-state hook that
   returns typed terminal states: checking, disconnected, embedded-wallet,
   indexer-error, no-access, and ready.
5. Define a later remediation lane for an admin-owned terminal-state renderer
   consumed by both `/` and direct canvas routes without changing the shell.
6. Define a later remediation lane that makes garden detail data and toolbar
   permissions consume the same eligible-garden fallback truth.
7. Define a later remediation lane that aligns `/actions` route, controller,
   and Storybook behavior to deployer-only access.

## Research Evidence

- `bun --bun tsc --noEmit -p packages/admin/tsconfig.json` passed.
- `bun run --filter @green-goods/shared check:stories` passed with
  `162/162` required Storybook surfaces covered.
- `bun run --filter @green-goods/shared check:story-quality` passed.
- `bun run --filter @green-goods/admin test:hub` passed after sandbox
  escalation for registry/network access.
- `bun run --filter @green-goods/admin build` passed after sandbox escalation.
  The initial sandbox failure came from Varlock/1Password access for
  `PINATA_JWT`, not an admin code failure.
- `bun run --filter @green-goods/shared test:stories:ci` failed with Storybook
  render failures: 7 failed, 96 passed, 169 skipped.
- Isolated Hub Storybook CI passed; a smaller grouped admin run narrowed
  persistent failures to Actions, ActionsSheetDescriptor, and CommandPalette,
  while the full suite showed broader empty-frame failures consistent with
  cross-story state leakage.
- Current worktree on `develop` is dirty with many unrelated package and plan
  changes; this hub must not revert or normalize those changes.

## Implementation Evidence

Codex implemented this hub under the explicit 2026-05-02 user scope lock.

- Added shared Storybook admin state isolation, shared admin access-state logic,
  fallback-aware garden detail/toolbar consumers, and deployer-only Actions
  controller policy.
- Added admin terminal-state renderer reuse for `/` and direct canvas routes
  while preserving `CanvasLayout`, `/hub`, ADR-019 canonical routes, and
  deployer-only `/actions`.
- Focused shared tests passed: 4 files, 18 tests.
- Focused admin route/actions tests passed: 3 files, 36 tests.
- `bun --bun tsc --noEmit -p packages/admin/tsconfig.json` passed.
- `bun run --filter @green-goods/admin test:hub` passed 13 files, 96 tests.
- `bun run --filter @green-goods/shared check:stories` passed 163/163 required surfaces.
- `bun run --filter @green-goods/shared check:story-quality` passed 134 story files.
- `bun run --filter @green-goods/admin build` passed with existing Rollup chunk warnings.
- `bun run --filter @green-goods/shared test:stories:ci` now fails one
  public-browser story outside this hub scope:
  `PublicBrowserSurfaces.stories.tsx` expects `/green goods logo/i`, while the
  rendered `SiteHeader` link is named `Green Goods`. Admin Storybook failures
  observed during this pass were resolved.

## Findings

### 1. Storybook state leaks make admin story failures hard to trust

- Evidence: `withSelectedAdminGarden` mutates the singleton admin store;
  sheet state, garden workspace state, and dev mock auth role also persist
  through session/local storage surfaces.
- Why it matters: admin workspace stories can pass in isolation and fail in the
  full suite, so Storybook stops being a reliable development signal.
- Smallest credible fix: add a Storybook admin reset boundary that clears the
  relevant stores/storage before each admin story and keeps seeded QueryClient
  state isolated to each story render.

### 2. Direct canvas routes do not share the `/` terminal-state ladder

- Evidence: `IndexRoute` handles disconnected, embedded wallet, indexer error,
  no access, and redirect states; `CanvasLayout` mainly spinner-gates readiness
  and redirects authenticated no-garden users back to `/`.
- Why it matters: direct bookmarks such as `/hub/work` can behave differently
  from `/`, especially when auth, embedded wallet, or garden eligibility is not
  ready.
- Smallest credible fix: introduce a shared admin access-state hook and an
  admin-owned terminal-state renderer used by both `IndexRoute` and the canvas
  branch.

### 3. Eligible-garden fallback is not consumed consistently

- Evidence: `useEligibleAdminGardens` can synthesize operator-garden stubs from
  role data, but `useGardenDetailData` and `useEffectiveToolbarPermissions`
  still depend on the base garden list for important decisions.
- Why it matters: the app can prove an operator is eligible while detail data or
  toolbar visibility treats the same garden as missing.
- Smallest credible fix: centralize the resolved eligible garden and make detail
  data plus toolbar permissions consume that same fallback-aware source.

### 4. `/actions` policy is split between route gate, controller, and stories

- Evidence: routes gate `/actions` to deployers, while the controller currently
  treats deployer or operator as able to manage actions; Storybook admin seeds
  default to an operator identity.
- Why it matters: Actions stories exercise a route that the seeded identity is
  not authorized to enter, producing brittle failures and ambiguous product
  intent.
- Smallest credible fix: keep `/actions` deployer-only, align
  `canManageActions` to deployer-only, and run Actions stories with deployer
  identity/seeds.

## Human Judgment Points

- Confirm no runtime code should change until this hub is explicitly activated.
- Confirm direct canvas routes should render terminal states in place rather
  than redirecting to `/`.
- Confirm `/actions` remains deployer-only for v1 stabilization.
- Confirm Storybook isolation belongs in shared Storybook harness helpers rather
  than each individual admin story.

## Non-Functional Constraints

- Package boundaries: production hooks remain in `@green-goods/shared`; admin
  owns shell rendering, route terminal views, and admin-only workflows.
- Public APIs: no external production API changes; one shared admin access-state
  hook is allowed if later implementation needs it.
- Routing: no route additions, no legacy compatibility aliases, no
  `DashboardLayout` or sidebar resurrection.
- Localization: later UI copy changes must update `en`, `es`, and `pt`.
- Design: preserve the operator cockpit contract and Warm Earth admin dialect.
- Security: no contract, deployment, key, or auth-provider behavior changes in
  the audit pass.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | Admin terminal-state renderer, `/` and canvas branch wiring, route/story expectations. |
| State / API | `state_api` | Storybook isolation helpers, shared access-state hook, eligible-garden/detail/toolbar alignment, Actions controller policy. |
| Contracts | `contracts` | `n/a`; no Solidity, deployment, or indexer work. |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential review of story reliability, direct-route terminal states, and validation evidence. |

## Risks

- Risk: this expands into an admin redesign.
- Mitigation: keep `CanvasLayout`, `/hub`, ADR-019 routes, and deployer-only
  `/actions` fixed.
- Risk: Storybook fixes hide real runtime bugs by overfitting the harness.
- Mitigation: pair Storybook isolation with direct route/auth tests and admin
  build validation.
- Risk: garden fallback fixes make partial stubs look like fully indexed garden
  records.
- Mitigation: expose explicit fallback/stale-base-list state where UI decisions
  need to distinguish recovered eligibility from full garden detail.
- Risk: validation claims exceed proof.
- Mitigation: record command output, sandbox/Varlock caveats, and dirty worktree
  context in lane handoffs before marking lanes complete.
