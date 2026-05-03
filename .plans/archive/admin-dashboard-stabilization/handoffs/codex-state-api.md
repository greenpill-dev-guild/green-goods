# State / API Handoff

**Actor**: Codex
**Date**: 2026-05-02
**Status**: implementation complete, QA still blocked by full Storybook CI

## Scope Implemented

- Added shared admin access-state classification in `@green-goods/shared` with
  `checking`, `disconnected`, `embedded-wallet`, `indexer-error`, `no-access`,
  and `ready` states.
- Preserved role-confirmed eligible-garden fallback: eligible gardens recovered
  from role data keep access `ready` instead of collapsing to indexer error or
  no-access.
- Added shared Storybook admin isolation that resets admin store, sheet
  orchestrator state, garden workspace state, create/work/hypercert stores,
  dev mock auth storage, and seeded query clients per story.
- Aligned `useGardenDetailData` and `useEffectiveToolbarPermissions` to consume
  the same fallback-aware eligible-garden truth without hiding stale base-list
  or indexer error state.
- Aligned Actions controller manage permission to deployer-only via
  `canManageActionsForRole`.
- Kept hooks in shared; no package-local admin hooks were added.

## TDD Evidence

RED:

`bun run --filter @green-goods/shared test -- src/__tests__/hooks/admin-ui/useAdminAccessState.test.ts src/__tests__/hooks/roles/useEffectiveToolbarPermissions.test.ts src/__tests__/hooks/garden/useGardenDetailData.fallback.test.ts src/__tests__/storybook/admin-story-isolation.test.ts`

Evidence: failed before implementation because the shared access-state hook and
storybook reset helper did not exist, and fallback-aware detail/toolbar behavior
was not implemented.

GREEN:

`bun run --filter @green-goods/shared test -- src/__tests__/hooks/admin-ui/useAdminAccessState.test.ts src/__tests__/hooks/roles/useEffectiveToolbarPermissions.test.ts src/__tests__/hooks/garden/useGardenDetailData.fallback.test.ts src/__tests__/storybook/admin-story-isolation.test.ts`

Evidence: passed 4 test files, 18 tests.

Additional proof:

- `bun run --filter @green-goods/admin test:hub` passed 13 files, 96 tests.
- `bun run --filter @green-goods/shared check:stories` passed 163/163 required surfaces.
- `bun run --filter @green-goods/shared check:story-quality` passed 134 story files.

## Remaining Blocker

`bun run --filter @green-goods/shared test:stories:ci` now reaches story
execution but fails one public-browser story outside this hub scope:
`packages/client/src/views/PublicBrowserSurfaces.stories.tsx` expects a link
named `/green goods logo/i`, while the rendered `SiteHeader` link is named
`Green Goods`. The previous admin CommandPalette failure from deployer-only
Actions policy was fixed by running that real-provider story as deployer.
