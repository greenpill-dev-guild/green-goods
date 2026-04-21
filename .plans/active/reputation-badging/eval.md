# Reputation & Badging Evaluation Plan

## Release Gates

1. **Correctness:** Greenwill issuer evaluates each of the 6 badge criteria per user against live Green Goods data, grants Unlock keys, and writes `GreenGoodsBadge` EAS attestations; issuance is idempotent (no duplicate key/attestation for the same user + badge + tier).
2. **Portability:** `GreenGoodsBadge` EAS schema + Unlock lock addresses resolve identically in at least one sibling project (Coop or WEFA) via the shared `useBadges(address)` hook; non-transferable / soulbound property holds for all 6 locks.
3. **Regression safety:** GreenWill broadcast gate — upgrade-preservation unit coverage, GreenWill workflow integration coverage, and an Arbitrum fork support-flow test — all pass before mainnet rollout. Issuer downtime does not corrupt state (evaluator resumes at last processed block).

## Acceptance Checks

| ID | Check | Owner | Evidence |
|---|---|---|---|
| AC-1 | 6 badge evaluators implemented with locked criteria (Verified Gardener, Active Contributor, Stewardship, Garden Operator, Community Builder, Impact Verified) | `state_api` | `packages/agent/src/badges/__tests__/*.test.ts` green; criterion thresholds match spec |
| AC-2 | 6 Unlock locks deployed on Arbitrum (non-transferable, key manager = greenwill issuer address); lock addresses persisted in `deployments/{chainId}-latest.json` | `contracts` | `bun script/deploy.ts ... --broadcast` artifact; deployment JSON diff shows 6 lock entries |
| AC-3 | `GreenGoodsBadge` EAS schema registered; schema UID persisted in `deployments/{chainId}-latest.json` | `contracts` | EAS block-explorer read of registered schema; schema UID committed |
| AC-4 | Greenwill issuer idempotent: re-running the evaluator for the same user + badge does not mint a duplicate key or write a duplicate attestation | `state_api` | Integration test replaying the same eval window; Unlock key count + EAS attestation count ≤ 1 per (user, badge) |
| AC-5 | `useBadges(address)` in `@green-goods/shared` returns merged Unlock + EAS state; client + admin render the same badge list | `state_api` | Hook unit test; admin + client screenshots of same address in `artifacts/` |
| AC-6 | Badges portable — one sibling project (Coop or WEFA) renders a Green Goods badge for a cross-project address via the same shared schema | `qa_pass_1` | Sibling-project screenshot + `grep` confirming same EAS schema UID + lock address are consumed |
| AC-7 | GreenWill contracts confidence gate passed: upgrade-preservation unit coverage, GreenWill workflow integration coverage, Arbitrum fork support-flow test all green | `contracts` | `cd packages/contracts && bun run test` outputs cited in `history[]`; fork test log in `artifacts/` |
| AC-8 | Badges active in ≥ 3 Season One pilot gardens; outcome milestone #16 closed | `qa_pass_2` | Milestone closed with per-garden badge issuance counts in `history[]` |

## Test Strategy

- Unit: per-badge criterion evaluators, `unlockClient.ts`, `easBadgeWriter.ts`, `useBadges.ts` hook, tier-formatting in `modules/badges.ts`.
- Integration: Greenwill issuer loop against a fixture dataset spanning all 6 badge types; idempotency under replay; Unlock + EAS writes on Sepolia fork.
- E2E / Playwright: client profile renders badge shelf; admin operator sees gardener badges inline in `WorkReview`.
- Manual checks:
  - Greenwill issuer address funded on Arbitrum for Unlock key grants + EAS attestation gas.
  - Cross-project recognition confirmed by Coop or WEFA maintainer.
  - Badge tier formatting (bronze / silver / gold) matches `modules/badges.ts` metadata.

## QA Sequence

### Claude QA Pass 1

- Verify badge display in client + admin via Storybook + Chrome MCP.
- Record cross-project recognition evidence (sibling-project screenshot + schema UID + lock address match).
- Validate i18n for badge names, descriptions, earned-at formatting.
- If blocked on sibling-project integration timing, record in `handoffs/claude-qa-pass-1.md` and defer AC-6 to post-pilot.

### Codex QA Pass 2

- Start only after `qa_pass_1` is passed and `claude/qa-pass-1/reputation-badging` exists.
- Re-run issuer idempotency tests + GreenWill workflow integration + Arbitrum fork support-flow test.
- Audit non-transferable / soulbound property on each of the 6 locks via Unlock factory read.
- Close the loop on any residual defects before outcome milestone #16 close.
