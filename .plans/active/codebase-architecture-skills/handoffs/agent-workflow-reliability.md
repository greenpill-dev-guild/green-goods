# Agent workflow reliability follow-up

Status: locally implemented with one verified pre-existing validation failure. Scope is the user's
2026-09-26 approved plan; the original hub lane status, architecture decisions, and historical
receipts remain unchanged. This is not a publication or merge-readiness approval.

## Decisions

- Preserve production enforcement: warning in Claude, block in Codex. Direct Forge and Fly
  restrictions remain Codex-specific. Existing sandbox and permission configuration is unchanged.
- Keep completion and idle hooks advisory. Existing validation selection and evidence own
  completion; no transcript reader, automatic retry, or duplicated completion framework is added.
- Keep personal skill checks warning-only and local. Check expected discovery paths and resolved
  files, not whether a model followed instructions.
- Keep Linear parent-only. The initial `linear-sync` manifest identified existing parent PRD-835
  and no lane issues. No external update is part of this follow-up.

## RED evidence

`node scripts/dev/node-cli.js node --test --test-name-pattern 'completion reports|idle is advisory|advisory hooks|harmless shell|restricted command|deployment and direct|hook inspection|personal skill|hook and doctor' scripts/harness/agent-hooks.test.mjs scripts/lib/dev-shared.test.mjs scripts/quality/select-validation.test.mjs`

Before implementation: 33 selected tests, 7 passed, 26 failed. Fixtures reproduced lost event
identity, false positives on quoted data, missed commands in chains, absent skill readiness, and
missing validation routing. Test input was never executed as a command.

## Working-tree verification

Verified 2026-09-26 against the uncommitted working tree based on
`a3bae421b3f36b193db68e17fb5690de2535a1d4`. The base commit does not contain this follow-up;
no commit-attributed passing receipt or completed hub lane is claimed.

- `bun run check --plan -- --intent qa --json`: selected format, lint,
  `validation-system-test`, `agent-guidance`, and `review-guardrails-test`. Hook and doctor
  changes select their direct regression suites. Receipt fixtures prove implementation,
  registration, policy, and test changes invalidate cached proof using existing fingerprints.
- `bun run check -- --intent qa`: format and lint passed. The first validation-system run
  exposed the pre-existing Git failure plus an obsolete exact-comment assertion. The latter
  was removed after real completion-event fixtures proved the advisory behavior.
- `bun run check --only validation-system-test`: final result **314/315 passed**. The sole
  failure is `clearing git's repository-local variables releases a hook's binding and keeps
  the rest`: the fixture finds `GIT_INTERNAL_SUPER_PREFIX` missing from the existing cleanup
  list. Running the unchanged helper and test from `HEAD` in a temporary fixture reproduced
  the same failure. The unrelated Git helper was not repaired in this follow-up.
- `bun run check --only review-guardrails-test`: **252/252 passed**, including 44 hook cases.
- `bun run check --only agent-guidance`: passed Codex consistency, 15 skill scenarios,
  15 task routes, and guidance links across 77 files.
- `bun run dev:health -- --profile web --json` and its text form: ready, zero failures,
  both engineering skill files available through both harness paths. A second run with an
  empty temporary `CLAUDE_CONFIG_DIR` produced two skill warnings and remained ready with
  exit status zero. No skill, symlink, or global setting was modified.
- `node scripts/harness/plan-hub.mjs validate`: 28 hubs validated.
- Shell syntax validation and `git diff --check`: passed.

The new hook fixtures run through checked-in Claude and Codex registrations; the existing
Supply Chain Guardrails workflow now also calls them. Skill-file checks cover missing files,
broken symlinks, permission errors, and non-file paths. No command carried in an event is
executed by either the policy or its tests.

Checked boundaries: unrelated edit, session, Linear, and stop hooks; global skills; permission
settings; and `CLAUDE.md` remain unchanged. Sensitive edits are limited to the named agent
instructions/hooks, validation policy and tests, CI test wiring, and this follow-up record.

Live Desktop Code/Codex session loading and the five-task pilot remain pending in the hub
evaluation document. The existing billed skill-description evaluator was not run.
