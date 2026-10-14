# Steward Access Requests - State/API Handoff

## Lane

- Owner: Codex
- Branch: `release/october-2-0-0`
- Status: implementation and automated lane proof passed; release publication blocked

## Scope

- Implement the signed request contracts, kind-scoped hooks/query keys, API authorization and encrypted persistence accepted in `plan.todo.md`, `spec.md`, and `eval.md`.
- Keep reusable hooks in `packages/shared/src/hooks`.

## TDD Proof

- RED: Agent admission/API/chain command in status.json failed 11 cases, with 48 passed, at 2026-10-08T06:55:11Z. Missing signed kind binding, steward admission and strict target role confirmation were observed in command output. No persisted RED log exists.
- RED: Shared protocol/transport/hooks initially failed 22 cases with 49 passed; supplemental passkey proof failed 9 with 20 passed. Local logs: `/private/tmp/green-goods-steward-shared-red.log` and `/private/tmp/green-goods-steward-shared-passkey-red.log`.
- GREEN: Shared 108 focused tests; Agent 519 unit tests plus one skipped and 174 SQLite tests; package typechecks/lint/builds passed on the provisional tree. Local logs: `/private/tmp/green-goods-steward-shared-final-proof.log`, `/private/tmp/green-goods-steward-agent-unit-coverage.log` and `/private/tmp/green-goods-steward-agent-sqlite.log`.
- Proof limit: authenticated passkey signing, deployed API and real onchain role assignment are unverified. No production transactions were performed.

## Validation

- Signed proof, authorization grants, query keys, list/self/withdraw/resolve and mutation barriers distinguish membership from stewardship. Legacy omitted kind retains existing membership bytes. Old availability responses enable membership only. The server advertises supported kinds.
- Role confirmation requires Operator or Owner for stewardship; gardener membership is insufficient. Existing gardeners may request stewardship, closed joining does not block it, and existing stewards are rejected as already admitted.
- SQLite schema version 8 migrates the pending uniqueness index by request kind under an immediate transaction, preserving records and encrypted payloads. Garden caps remain aggregate and rate limits unchanged.
- Parent read the changed authorization, service, storage and transport lines. Peer API/protocol review found no additional actionable issue. Fresh committed proof is recorded below.

## Validation Receipt

- Tested implementation commit SHA: `6cf9020c771b22010310293c2d4bbb75e3772de0`
- Run at (UTC): 2026-10-08T08:01:56Z
- Exact command(s): `node scripts/dev/ci-local.js --intent release`; then `node scripts/dev/ci-local.js --intent diagnose --only ontology --only story-quality` and `node --test scripts/harness/plan-hub.test.mjs`.
- Result: release command exited 1 at the unrelated immutable-report guard, after 33 fresh automated passes; final story check was unrun there. Independent ontology/story checks passed, and all 69 plan-hub fixture tests passed. Shared 7,267 tests plus 19 skipped, Admin 1,282, Client 1,686, Agent 519 unit plus one skipped and 174 SQLite, Indexer, Contracts 2,100 plus 320 contract-script tests, contract release verification, package typechecks/builds, documentation and other guards passed. This is lane proof, not a passing release gate or CI claim.
- Local evidence: `/private/tmp/green-goods-steward-current-release.log`, `/private/tmp/green-goods-steward-final-supplemental.log`, `/private/tmp/green-goods-steward-final-plan-tests.log`.
- Validated paths: `packages/shared/`, `packages/agent/`, `packages/contracts/`, `packages/indexer/`, `package.json`, `bun.lock`, `docs/`, `scripts/`, `.github/`, `.husky/`, `AGENTS.md`, `.claude/`. The unrelated historical report is excluded from lane cleanliness and remains a release blocker.
- Worktree identity command and result: `git rev-parse --show-toplevel` returned `/Users/afo/Code/greenpill/green-goods`; `git branch --show-current` returned `release/october-2-0-0`. `git status --porcelain=v1 --untracked-files=all -- packages/shared packages/agent packages/contracts packages/indexer package.json bun.lock docs scripts .github .husky AGENTS.md .claude` returned no output: the validated paths are clean.
- Evidence-only diff command and result (if applicable): `git diff --exit-code 6cf9020c771b22010310293c2d4bbb75e3772de0..HEAD -- packages/shared packages/agent packages/contracts packages/indexer package.json bun.lock docs scripts .github .husky AGENTS.md .claude` returned exit 0, no output, at receipt write. The follow-up changes only this hub; the same command is rerun after its commit and reported in chat.
- Evidence-only worktree-status command and result (if applicable): `git status --porcelain=v1 --untracked-files=all -- packages/shared packages/agent packages/contracts packages/indexer package.json bun.lock docs scripts .github .husky AGENTS.md .claude` returned no output before recording the receipt. It is rerun after the evidence-only commit.

The 2026-10-08 layout correction changes only Admin presentation. The scoped equality command above was rerun at 2026-10-08T15:29:39Z against `adc6af623fe6f2511293e98c3bd6f0600e554c8c` and returned exit 0, with clean validated paths. Shared/Agent proof is retained; UI proof is replaced by the latest UI handoff.

## Risks / Blockers

- Release and push remain blocked by `.plans/active/agent-messaging-channels/reports/2026-10-04-conversation-experience-review.md`, an unrelated 19-line historical append. Its contents were preserved untouched; approval to move the append to a new dated artifact remains pending. No guard was bypassed and no push, tag, deployment or merge occurred.
- Authenticated passkey/API/role-grant proof remains pending; Storybook is the rendered evidence class.
