# Bug Triage - 2026-04-20

Scope: triage only for #385, #428, and #431. No fixes were made.

Source note: `gh issue view` was attempted first, but the sandbox could not connect to `api.github.com`. I used the GitHub connector for issue bodies/comments, then read the suspected files locally. The requested sprint board path (`.plans/active/admin-ui-revamp/execution-board-2026-04-20.md`) is not present in this worktree, so Claude overlap is inferred from the current admin UI plan/status/handoffs and the Day 1/Day 2 constraints in the lane brief.

## #385 - Chrome PWA install fails with "still adding previous sites"

### Suspected Files

- `packages/client/vite.config.ts`
  - PWA plugin config, `includeAssets`, Workbox caching, manifest `id`, `start_url`, `scope`, and icon declarations.
- `packages/client/public/**`
  - Manifest assets referenced by VitePWA. The currently referenced assets appear to exist locally (`apple-icon.png`, `icon-192.png`, `icon-512.png`, `maskable-icon-512.png`, Android/Apple/MS icons).
- `packages/client/public/sw-custom.js`
  - Imported into Workbox via `importScripts`; worth checking during an install repro.
- `packages/client/src/App.tsx`
  - Notes service worker registration path; low-risk suspect only if install state is stale after config validation.

### Complexity

S/M. The issue comment points to missing PWA assets plus a missing manifest `id`; the current config now has `manifest.id` and matching assets, so this may already be partially fixed. Remaining work is mostly Android Chrome install repro, generated manifest inspection, and stale service-worker/cache cleanup validation.

### Claude-Owned Overlap

No direct Day 1 or Day 2 GreenWill collision.

Possible Claude/UI overlap only if Claude is actively touching client shell/PWA release behavior. It does not overlap the explicit Day 2 GreenWill UI files (`packages/admin/src/views/Actions/GreenWillPanel.tsx`, `packages/client/src/views/Profile/Badges.tsx`).

### Recommended Dispatch Window

Dispatch as a small client-platform validation pass after Lane B Day 1. It can run before Day 2 GreenWill UI validation as long as it stays inside PWA config/assets and does not reshape client navigation.

## #428 - Garden view controls and notification affordances break down on smaller screens

### Suspected Files

- `packages/client/src/components/Navigation/TopNav.tsx`
  - The nav shell uses fixed height/padding/top offsets, an absolute center layer for children, and a right-side vertical stack for notification/governance/endowment buttons.
- `packages/client/src/views/Home/Garden/index.tsx`
  - Garden header/banner/title/Join button layout places TopNav over a fixed banner and keeps Join in the title/meta row.
- `packages/client/src/views/Home/Garden/Notifications.tsx`
  - Notification item cards use fixed padding/scale hover treatment and should be verified in the drawer at small widths.
- `packages/client/src/components/Dialogs/ModalDrawer.tsx`
  - The drawer already has close button, overlay click, and Escape close wiring, but the issue reported close/backdrop affordance problems. It needs device QA rather than blind rewrite.
- `packages/client/src/__tests__/components/TopNav.test.tsx`
  - Existing tests cover notification visibility, not responsive collision or drawer close behavior.

### Complexity

M. This is a responsive layout and interaction polish bug, not a data-path issue. It likely needs mobile viewport QA and focused component tests around TopNav overflow and drawer dismissal.

### Claude-Owned Overlap

Yes. This overlaps Claude-owned client UI surfaces if Claude is sequencing garden/mobile shell work:

- `packages/client/src/components/Navigation/TopNav.tsx`
- `packages/client/src/views/Home/Garden/index.tsx`
- `packages/client/src/views/Home/Garden/Notifications.tsx`
- potentially `packages/client/src/components/Dialogs/ModalDrawer.tsx`

It does not overlap Lane B Day 1 contract/readiness files.

### Recommended Dispatch Window

Day 2+ after Claude sequences the client responsive pass. It should not be bundled with Lane B GreenWill deployment-readiness work.

## #431 - Assessment loading, deep links, and detail views inconsistent across client/admin

### Suspected Files

- `packages/client/src/views/Home/Garden/Assessment.tsx`
  - Still reads assessments through `useGardens(DEFAULT_CHAIN_ID)` and nested garden data. EAS explorer links are now routed through `getEASExplorerUrl`, so the old hardcoded explorer URL portion appears reduced.
- `packages/admin/src/views/Garden/Assessment.tsx`
  - Uses `useGardenAssessments(id, selectedChainId)` and `getEASExplorerUrl(selectedChainId, attestation.id)`. The remaining open issue appears to be admin in-app detail behavior rather than only link generation.
- `packages/shared/src/hooks/assessment/useGardenAssessments.ts`
  - Shared EAS query hook used by admin and likely the intended client convergence path.
- `packages/shared/src/modules/data/eas.ts`
  - EAS GraphQL fetch/parse path for garden assessments.
- `packages/shared/src/utils/eas/explorers.ts`
  - Chain-aware EAS explorer URL utility.
- `packages/shared/src/config/query-keys/invalidation.ts`
  - Assessment invalidation path if the fix touches create/detail navigation.

### Complexity

L if fully closing the issue. Comments indicate EAS URL handling and admin loading have moved forward, but the remaining admin in-app detail view and client/admin convergence touches shared data hooks plus both app surfaces. A narrow "admin detail view only" patch could be M, but closing the bug confidently is cross-package.

### Claude-Owned Overlap

Yes. This overlaps Claude-owned Day 1/Day 2 UI/data surfaces:

- `packages/admin/src/views/Garden/Assessment.tsx`
- `packages/client/src/views/Home/Garden/Assessment.tsx`
- `packages/shared/src/hooks/assessment/useGardenAssessments.ts`
- `packages/shared/src/modules/data/eas.ts`

It does not overlap the explicit Day 2 GreenWill UI files unless the same person is also touching shared EAS/query infrastructure.

### Recommended Dispatch Window

Defer until Claude explicitly sequences assessment detail work. If split, do the shared hook/client convergence first, then admin in-app detail navigation in a separate UI pass.
