# QA Session Report Generator - State/API Handoff

## Lane

- Owner: Claude
- Branch: set when work begins using `<type>/<work-description>`
- Status: pending implementation

## Scope

- Implement `scripts/agents/qa-report.ts` (pure model + renderer + thin CLI) and
  `scripts/agents/qa-report.test.ts` per `spec.md`; type `kind` on `CatalogCase`; add the
  `qa:report` package script; wire the routine, both QA skills, the parent template, and the QA
  contract per `spec.md` § Wiring.
- No QA app, Blob, Linear, Discord, or Sheet changes.

## TDD Proof

- RED (2026-09-02T03:12:16Z): `bun --bun x vitest run scripts/agents/qa-report.test.ts` →
  `Test Files 1 failed` — `Cannot find module './qa-report'`; the seven Step 2 specs (window
  parsing and inclusivity, bucket reconciliation across priority/kind/tab, standing state, attributed
  issues, per-tester counts) were unrun because the module did not exist.
- GREEN (2026-09-02T03:13:56Z): same command → `Tests 7 passed (7)`;
  `bun --bun x vitest run --dir scripts/agents` → `Test Files 11 passed (11)`, `Tests 165 passed (165)`.
- Proof limit: none recorded

## Batch 1 (Steps 1–3) — what changed

- `qa-workbook-build.ts`: `kind` on `CatalogCase`, `CatalogKind` + `kinds` on `Catalog`. The
  `statuses` typing planned in Step 1 is deferred: `feature/qa-report` is based on `develop`, and the
  lifecycle fields live on the unmerged `chore/qa-lifecycle-polish`; the generator needs only `kind`
  and `priority`.
- `qa-report.ts`: `parseWindow`, `buildReportModel` (session-window scoping, buckets by priority,
  kind, and tab, issues with session notes, never-walked and stale gaps, standing fail/blocked,
  per-tester touched/decided). `delta` is typed `null` until Step 5 adds the `--previous` baseline.
- Test fixtures in `qa-status`, `qa-state`, and `qa-workbook-build` gained `kind`.

## Batch 2 (Steps 4–6) — what changed

- RED (2026-09-02T03:26:03Z): ten new specs (renderer parity and privacy, delta and gaps, CLI
  parsing and file writes) failed on the missing exports; the seven Batch 1 specs stayed green.
- GREEN (2026-09-02T03:29:15Z): `bun --bun x vitest run scripts/agents/qa-report.test.ts` →
  `Tests 17 passed (17)`; `--dir scripts/agents` → `Test Files 11 passed (11)`, `Tests 175 passed (175)`;
  `oxlint --deny-warnings` clean on both files.
- `qa-report.ts`: `renderReport` (private/public; "Results by priority" lines match the parent
  template with zero segments dropped; the public variant carries no label, note, or address —
  asserted on a fixture containing all three), `--previous` standing-verdict delta with an
  unknown/retired trailer, `parseArgs` in the `qa-status` style, `runReport` (reads the pulled
  `qa-state.json`, writes `report.md` and optionally `report.public.md`, never echoes file
  contents in errors), `import.meta.main` entry. `package.json` gained `qa:report`.
- Rendering call made after a real-catalog smoke: never-walked gaps list P0 IDs in full and
  collapse P1/P2 to counts — a lightly walked session otherwise printed a hundred IDs inline.

## Batch 3 (Step 7) — what changed

- Guidance only, no runtime change. `linear-templates.md` § QA session report gained the
  `## Results by kind` block and states both results blocks are pasted verbatim from
  `report.md`; `qa-call-report.md` runs `qa:report` after the pull (re-run with `--build` once
  Phase 4 has the deploys, `--public` for the Discord lede), pastes the blocks in Phase 7, and
  its capability check and anti-patterns name the script; `qa-triage` § Call mode mirrors the
  routine; `qa-session` Phase 4 runs `qa:report` after `qa:pull` (window = the session's OBS span)
  and the receipt embeds the generated blocks; `qa.md` § Pull and the artifact table name
  `report.md` / `report.public.md` and the variant rule; `scripts/README.md` documents the script
  and its test.
- Proof (2026-09-02T03:34:40Z): `bun run test:review-guardrails` → 198 pass, 0 fail;
  `node scripts/quality/check-guidance-links.mjs` → 61 guidance files OK;
  `node scripts/harness/plan-hub.mjs validate` → 29 hubs valid.
- Decision 1's solo-session parent is recorded as a `qa-triage` follow-up in `spec.md` and
  `plan.todo.md`, not asserted in the wiring.

## What remains

- Step 8 docs clause after the `chore/qa-lifecycle-polish` PR merges (the page differs between
  the branches); Step 9 first real report from the 2026-09-02 call (needs the pulled session and
  the cloud routine prompt re-pasted after `qa:report` reaches `develop`).

## Validation

- `bun --bun x vitest run --dir scripts/agents` green at the GREEN timestamp above (see receipt at
  lane close; this is batch evidence, not the terminal receipt).

## Validation Receipt

- Tested implementation commit SHA: `642a708c09d0872f35153e664991621ce7171b00` (PR
  [#793](https://github.com/greenpill-dev-guild/green-goods/pull/793) head after merging
  `origin/develop` at `96cc9f484`, which carried PR #792)
- Run at (UTC): `2026-09-02T07:54:20Z`
- Exact command(s): `bun --bun x vitest run --dir scripts/agents`;
  `bun run test:validation-system`; `bun run test:review-guardrails`;
  `bun run check:qa-id-ledger`; `bun run check:docs-generated`;
  `node scripts/quality/check-guidance-links.mjs`; `node scripts/quality/check-ontology.mjs`;
  `node scripts/dev/ci-local.js --intent push --reuse-passing-receipts`
- Result: agent tools 11 files / 177 tests passed; validation-system 193 pass / 0 fail;
  review guardrails 202 pass / 0 fail; ledger guard 139 ids none removed since `origin/develop`;
  18 projections current; 61 guidance files OK; ontology guards passed; push plan passed
  (format, lint, docs-authority, agent-guidance, agent-tools-test)
- Validated paths: `scripts/agents/qa-report.ts`, `scripts/agents/qa-report.test.ts`,
  `scripts/agents/qa-workbook-build.ts`, `package.json`, `scripts/data/validation-policy.json`
- Worktree identity command and result:
  `git status --porcelain=v1 --untracked-files=all -- scripts/agents/qa-report.ts scripts/agents/qa-report.test.ts scripts/agents/qa-workbook-build.ts package.json scripts/data/validation-policy.json`
  → empty
- Superseded receipt: `a371f05eb3f2195eb3729ba7f3211033eb14d53d` (2026-09-02T04:15:57Z) — the merge
  changed `package.json` and the validation policy, so a fresh run was required rather than an
  evidence-only citation.
- Publication: PR #793 → `develop`, mergeable after the merge commit; readiness follows
  current-head GitHub CI, not this local receipt.
