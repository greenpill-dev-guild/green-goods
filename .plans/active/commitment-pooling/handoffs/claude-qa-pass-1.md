# Commitment Pooling - Claude QA Pass 1 Handoff

## Status

- Machine lane: qa_pass_1
- Owner: Claude
- Branch signal: claude/qa-pass-1/commitment-pooling
- Current state: manually blocked
- Linear context: parent_only; no QA child issue is created

## Inputs

- GREEN contracts, indexer, shared, and required August UI handoffs (`ui_client`, `ui_admin`, `editorial`, `docs`, `docs_guides`); September Community is excluded
- Settlement external-gate evidence or an explicit proof-limit record
- Authenticated Brave access, real-device PWA access, and `acceptance-matrix.md`

## Outputs

- Human-flow QA record across member, gardener/provider, operator, evaluator, funder, and collaborator/steward roles.
- Verified pass/visible defect/external blocker separation.
- Evidence for direction-aware confirmation, claims recovery, offline sync, dispute recovery, batching/oracle states, public claims, accessibility, and locales.
- Defect list routed back to the owning lane; no implementation in the QA handoff.

## Acceptance

- Member/client and admin flows are exercised through authenticated Brave; installed PWA/offline/restart/member-delivery behavior is exercised on a real device.
- Every loading, empty, offline, pending, waiting, declined, superseded, failed, retry, reported, checking, oracle-invalid, Verified, and delivery-disabled state in scope has an exit.
- Offer recipient and Request creator confirmation are correct; provider exclusion holds in ordinary and fallback flows.
- Batch cap 24, immutable rejected batch, per-member recovery, and Functions-only verification are visible and coherent.
- Public/editorial/docs claims distinguish planned, reported, and oracle-verified behavior.
- Accessible names, focus order, touch targets, contrast, screen-reader announcements, reduced motion, and en/es/pt are checked.

## RED / GREEN or proof limit

- RED: a named role/state path fails its acceptance fixture, a required lane command fails, or rendered/authenticated evidence disagrees with the spec.
- GREEN: every in-scope role/state path has current evidence, all owning-lane commands pass, and defects are dispositioned without hiding external blockers.
- Proof limit: QA adds no product behavior. A missing live Functions, Celo, Safe, AA, authenticated-browser, or real-device path is an external blocker, never a pass; record the exact unavailable evidence once.

## Exact Bun commands

Run the targeted commands named in each GREEN handoff, then:

- bun run --filter @green-goods/contracts test
- bun run --filter @green-goods/indexer test
- bun run --filter @green-goods/shared typecheck
- bun run --filter @green-goods/client test
- bun run --filter @green-goods/admin test
- bun run docs:audit
- bun run lint:vocab
- bun run agentic:check
- bun run check:design-md
- bun run check:design-generated
- bun run check:design-tokens

## Out of scope

- Fixing defects, changing specs, isolated Playwright/DevTools profiles as authenticated proof, manual receipt verification, garden-held member claims, broad ship-readiness claims, or Linear issue creation.

## Unblock evidence

- Required August implementation handoffs are GREEN; the independent September Community handoff is not an August dependency.
- Settlement gate record names Functions, GoodDollar, Safe, AA, and any proof limits.
- Authenticated Brave and real-device access are confirmed.
- QA result separates passes, defects, and external blockers with route/role/state evidence.
