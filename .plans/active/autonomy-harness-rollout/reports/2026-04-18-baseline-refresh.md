# Baseline Refresh — 2026-04-18

## Scope

- Compared `.plans/clean/agent-3-dead-code.md` against the current branch tip.
- Re-verified the three silent-failure mutation paths called out by the research map.
- Recorded stale and reclassified cleanup findings in the live active hub instead of widening cleanup scope.

## Silent-Failure Mutation Bugs

| Site | Current status | Why it is still open | Next bounded fix |
|---|---|---|---|
| `packages/shared/src/providers/Work.tsx:280` | CLOSED | The provider now rethrows rejected `mutateAsync(...)` submissions after debug logging, so callers can observe failure instead of receiving a false success path. | Landed with a focused provider regression test. |
| `packages/shared/src/providers/JobQueue.tsx:253` | CLOSED | Auto-flush failures now surface through `lastEvent`, `queueToasts.syncError()`, `setIsProcessing(false)`, and stats refresh rather than being swallowed. | Landed with a focused provider regression test. |
| `packages/admin/src/components/Hypercerts/CreateListingDialog.tsx:93` | CLOSED | The dialog now owns a visible fallback error state when `createListing()` rejects before hook-owned error state becomes visible. | Landed with a focused dialog regression test. |

## Cleanup Audit Refresh

- Safe dead-infrastructure deletions from `.plans/clean/agent-3-dead-code.md` are already complete on this branch:
  - `packages/admin/src/components/Action/index.ts`
  - `packages/admin/src/components/Assessment/index.ts`
  - `packages/admin/src/components/Hypercerts/index.ts`
  - `packages/admin/src/components/TrendIndicator.tsx`
  - `packages/admin/src/components/Vault/assetTotals.ts`

- The report's orphan-view deletion guidance is now stale in two important places:
  1. `.plans/clean/agent-3-dead-code.md:27` and `.plans/clean/agent-3-dead-code.md:30` list `packages/admin/src/views/Garden/Assessment.tsx` and `packages/admin/src/views/Actions/GreenWillPanel.tsx` as safe orphan-view deletions, and `.plans/clean/agent-3-dead-code.md:432` repeats that recommendation. The current router still does not mount those views (`packages/admin/src/router.tsx:101`, `packages/admin/src/router.tsx:165`), but route-unreachability alone is no longer a sufficient delete rule:
     - `packages/admin/src/views/Actions/GreenWillPanel.tsx` was restored because it is dormant legacy UI rather than dead infrastructure.
     - `packages/admin/src/views/Garden/Assessment.tsx` still renders a richer assessment-card surface (`packages/admin/src/views/Garden/Assessment.tsx:107`) than the live hub assessment/certification surfaces (`packages/admin/src/views/Hub/components/HubAssessmentQueue.tsx:72`, `packages/admin/src/views/Hub/components/HubCertificationInspector.tsx:23`), so deletion remains parity-gated.
  2. `.plans/clean/agent-3-dead-code.md:101` marks `packages/admin/src/components/Layout/index.ts` as a dead barrel, but `packages/admin/src/views/Hub/index.tsx:26` imports from that barrel on the current branch tip. It is not currently orphaned.

## Outcome

- Step 5 is complete as a refresh and reporting step.
- The three verified silent-failure mutation bugs called out by the research map are now closed on the current branch tip.
- No new deletion is authorized by this refresh pass.
- The next narrow moves are bounded cleanup or validation-hygiene work; repo-quick now passes end to end via `packages/admin` `test:hub`, the earlier `packages/client` stall is closed, the default `packages/admin` `bun run test` gate now exits cleanly after being aligned with the package contract, and the separately excluded legacy admin view-heavy surface remains a dedicated hardening decision rather than an inner-loop blocker.
