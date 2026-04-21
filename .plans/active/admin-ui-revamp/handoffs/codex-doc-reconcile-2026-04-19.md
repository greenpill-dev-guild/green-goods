# Codex Lane — Doc reconciliation only (2026-04-19)

**Hard rule: no code changes in this lane. Docs only.**

## Scope

Two live drift items surfaced by the Saturday 2026-04-19 release-manager verification pass:

### Drift 1 — `unlock.locks.<badgeId>` wording in reputation-badging plan

**File:** `.plans/active/reputation-badging/plan.todo.md`
**Line:** ~108 — `Record 6 lock addresses under \`unlock.locks.<badgeId>\` in packages/contracts/deployments/42161-latest.json`

**Repo-true implementation** (see `packages/contracts/script/deploy/badge-locks.ts`): lock addresses persist under `unlock.locks.<camelCaseKey>` where `<camelCaseKey>` is `verifiedGardener` / `activeContributor` / `stewardship` / `gardenOperator` / `communityBuilder` / `impactVerified`. Each entry is an object of shape `{ badgeId: "verified-gardener", address, name, expirationDuration, transferrable }` — so the kebab-case badge ID lives inside the nested value, not as the key.

**Fix:** rewrite that one line so it accurately describes the implemented shape. For example:

> Record 6 lock addresses under `unlock.locks.<camelCaseKey>` in `packages/contracts/deployments/42161-latest.json`, where `<camelCaseKey>` is one of `verifiedGardener`, `activeContributor`, `stewardship`, `gardenOperator`, `communityBuilder`, `impactVerified`. Each entry holds `{ badgeId, address, name, expirationDuration, transferrable }`.

Do not change any other line in this file in this lane.

### Drift 2 — Archive README sprint-board link

**File:** `.plans/active/admin-ui-revamp/handoffs/archive/2026-04-20/README.md`
**Line:** ~27 — `Sprint board: \`../../execution-board-2026-04-20.md\`.`

`../../` from `handoffs/archive/2026-04-20/` resolves to `handoffs/`, not `admin-ui-revamp/`. The sprint board lives at `.plans/active/admin-ui-revamp/execution-board-2026-04-20.md`, three levels up.

**Fix:** change `../../` to `../../../`:

```md
Sprint board: `../../../execution-board-2026-04-20.md`.
```

Validate by resolving from the README's directory with `ls` (the file must exist under the resolved path).

## Validation

- `rg -n 'unlock\.locks\.<badgeId>' .plans/active` — expect zero matches after fix.
- `cd .plans/active/admin-ui-revamp/handoffs/archive/2026-04-20 && ls ../../../execution-board-2026-04-20.md` — expect the file to resolve.
- `bun run format:check` — expect `No fixes applied.`.

## Out of scope

- Any code change — runtime is settled.
- Any touch to `packages/contracts/**`, `packages/admin/**`, `packages/shared/**`.
- Any other doc in `.plans/**` except the two lines above.
- Any dated lane file inside `handoffs/archive/` — the body of those files is historical provenance and stays frozen.
- No broadcast. No deployment. No `--broadcast` flag anywhere.

## Commit expectation

Single commit, conventional form, scope `plans` (the documentation scope we already use for `.plans/**`):

`docs(plans): reconcile unlock.locks key wording and archive README sprint-board link`

Report back with `codex-result.md`:
- `files_modified`: the two paths above
- `validation_output`: literal tail of the three validation commands
- `issues`: empty unless you find a third adjacent drift in the same README
