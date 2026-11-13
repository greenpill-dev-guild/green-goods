# Garden membership dates: data implementation

Local implementation is complete in the current shared checkout on `fix/work-approval-feedback`, based on `a0d503abcb40d835ef95992e91e78b7a7305f16f`. Changes are uncommitted; this is working-tree evidence, not a commit-attributed Validation Receipt. Lane certification remains pending.

## Changes

Indexer retains immutable GardenRoleEvent facts alongside existing roster handling. The Shared reader validates every row and every page, sorts by block/log, and derives separate first join, current membership, and current-role dates. The hook scopes cache by chain, garden and account. New Shared component composes existing inset FactRow presentation. Locale strings exist in English, Spanish and Portuguese.

Shared package manifest adds two export entries only: the history hook and dates component. Storybook preview registers the hook spy. No dependency or lockfile change belongs to this task. Existing unrelated manifest edits were preserved.

## Verification

- `bun run --cwd packages/indexer codegen` and `bun run --cwd packages/indexer build`: passed.
- Focused indexer HatsModule suite: 24 passed; RED had four new failures and 20 existing passes.
- `bun run --cwd packages/indexer check:indexing-boundary`: 15 passed; 24 contracts/four chains retained.
- `bun run --cwd packages/shared test -- src/__tests__/modules/garden-member-history.test.ts src/__tests__/hooks/garden/useGardenMemberHistory.test.ts src/__tests__/components/GardenMembershipDates.test.tsx`: 14 passed. Final component cleanup recheck: 4 passed.
- `bun run --cwd packages/shared typecheck` and `bun run --cwd packages/shared typecheck --scope tests`: passed; source typecheck repeated after final component cleanup.
- Root-focused Oxlint and Biome formatting: passed.
- `bun run --filter @green-goods/shared build-storybook`: passed; 494 components, 2845 stories.
- Shared story coverage 339/339 and story-quality 301 files: passed. Staged module isolation: passed.
- Token, vocabulary, design projections, em-dash, brand parity and five DesignMD lints: passed. Em-dash/brand checker tests: 11 passed.
- `node scripts/harness/plan-hub.mjs validate`:32 hubs passed before final evidence update; recheck follows.

## Limits and rollout

Source structure reports existing unrelated file-size violations in Client Public/Fund.tsx and Shared useCommitmentDialogController.ts. Ontology checker tests passed 92/92, but the live sidecar check reports existing QA catalog persona mismatches; none name the new entity or membership paths. No baselines were expanded.

The checkpoint selector incorrectly selected an unrelated Agent suite/typecheck because the Shared manifest gained only UI exports. The validation pipeline's explicit guard for workspace-importer changes applies: no Agent suite was started. Shared and actual consumers have source/test type proof.

Publish indexer schema, replay all historical HatsModule events, verify known first grants/removals/rejoins and catch-up, then publish the UIs. Pagination completeness alone does not establish historical replay completeness. No deployment, replay, external records, commit, push, or on-chain membership change was performed.

Task record: garden-membership-dates | Type: feature | Outcome: local implementation complete; publication pending
Agent/model: Codex / exact model unknown | Coverage: approved implementation segment

| Phase | Start → end (UTC) | Result |
| --- | --- | --- |
| investigate | 2026-11-12 02: 43:13 → 02: 46:02 | Scope, owning code, and accepted date meanings established |
| implement | 2026-11-12 02: 46:02 → 03:05:23 | Indexer facts, Shared reader/hook/view, Client and Admin wired |
| verify | 2026-11-12 02: 47:54 → 2026-11-12T03:09:55.590952+00:00 | Working-tree focused tests, types, static build and rendered proof below |

Human corrections: 0 observed in this segment; attention: unknown. Intervals include parallel work and must not be summed.

Final verification boundary: 2026-11-12T03:12:03.992276+00:00. Final scoped formatting/diff checks and 32-hub plan validation passed. No publication or membership change occurred.
