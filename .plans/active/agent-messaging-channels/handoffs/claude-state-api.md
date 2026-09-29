# Agent reporting — State/API handoff

## Lane

- Owner: Opus 5.5 (Claude)
- Branch: `feature/agent-reporting-core` (PR #2), stacked on `chore/whatsapp-prototype-scope-lock`
  (PR #864) at pinned parent `8457b8aa2f82b4de41bd8de1551d7d9f5a36da8e`
- Status: in progress (see status.json). PR #2 scope is implemented and fixture-tested; live gates
  and the WhatsApp transport (PR #3) remain. Independent review by Astra has not happened yet.
- Support owner: Afolabi, [afo@wefa.world](mailto:afo@wefa.world)

## Start gate

Completed on 2026-09-27: `linear-sync` and `record-linear` kept `parent_only` under PRD-998 and
recorded this branch for the state_api and ui lanes. No lane issues were created.

## What changed in PR #2

The [capability record](../reports/2026-09-27-reporting-core-capability-record.md) lists every
capability with its implemented, fixture-tested, live-tested and shipped state. In short:

- Shared: report and review rules, lifecycles, envelopes, canonical digests, proof messages, the
  ceremony wire contract and client, Kernel call rules and the permission builder.
- Agent: SQLite schema with `user_version` migrations; durable inbox, conversation leases with
  fencing, revision CAS, jobs, outbox with dispatch-time consent and binding checks, delivery
  status; the story-first coordinator with deterministic questions; consent, expiry and cleanup;
  owner publication with attempts, outcomes, watchdog and receipt or range reconciliation; steward
  review; recovery with epochs; Kernel grants and a restricted executor (disabled); operator controls.
- Content: OpenAI Responses extraction and Jev decisions with fallbacks; photos, PDFs, Word,
  spreadsheets with visible-literal arithmetic; voice notes behind a separate consent and control;
  bounded local tools; private storage.
- Configuration (decided 2026-09-27 and 28): every garden accepts chat reports, read from the
  indexer; the environment holds only secrets (the key list, which turns reporting on, and the
  model keys); chat channels (WhatsApp, Telegram) are defined in code and each takes reports only
  while its operator control is on; intake, model processing, documents, voice and publication are
  operator controls that start off; model versions and the browser origin are fixed in code.
  Capability record section 5 has the details.
- Harness: in-process Hono tests with real temporary SQLite, injected clock and IDs, fixture
  chain, catalog, transport and wallets; the loopback driver with `walkthrough.http`, samples and
  `reporting:walkthrough`. Both driver scripts are registered in `scripts/data/command-policy.json`.

Defects found and fixed while building, each with a regression test: a racing insert could
create a second channel subject; an unmined reported hash was treated as a receipt conflict; the
delegated executor stranded confirmed reports when publishing paused or a grant lapsed, and could
use a grant that expired while it awaited the chain; with model processing off (the default), a
file that was only stored was reported as read; and the reporting database and media defaulted to
the image's working directory instead of the Agent's volume, so a deploy would have wiped them.

## What remains

- PR #3: the WhatsApp and Telegram channel adapters, Telegram on the existing bot (capability
  record section 6).
- Live gates in capability record section 4, including real receipts, Kernel proof verification on
  RPC, model evaluation and the Agent image build.
- Delegation stays disabled until the section 9.3 owner-revocation path and module compatibility
  are proven.

## TDD Proof

- RED: `AGENT_SQLITE_INTEGRATION=true bun --bun run vitest run src/__tests__/reporting/publish-owner.sqlite.test.ts -t "not mined yet"`
  (in `packages/agent`) failed before `575a987a5`: the operation recorded `receipt_mismatch` for a
  hash whose transaction was not mined yet.
- GREEN: the same command passes after the fix; the full SQLite lane passes.
- Further proof that the tests guard behavior: removing the voice consent gate fails four voice
  tests; returning "done" on a publication pause fails the delegated pause test.

## Validation

Selector: `node scripts/dev/ci-local.js --plan --intent push --base 8457b8aa2f82b4de41bd8de1551d7d9f5a36da8e`
selects the critical push plan (critical overrides on shared-test, client-test, admin-test and
agent-test). The contracts checks need the contract submodules, initialized in this worktree with
`git submodule update --init --recursive`. Focused runs during the work:

- `bun run --cwd packages/agent test` and `bun run --cwd packages/agent test --scope sqlite`
- `bun run --cwd packages/agent typecheck --scope tests`
- `node scripts/quality/check-source-structure.js --base 8457b8aa2f82b4de41bd8de1551d7d9f5a36da8e`
- `bash scripts/quality/check-test-quality.sh`; `bun run lint`

## Validation Receipt

- Tested implementation commit SHA: `5005199ea54f327f70e63a71d183d6a4eb288821`
- Run at (UTC): 2026-09-29T00:15:14Z
- Exact command(s): the pre-push hook's
  `node scripts/dev/node-cli.js scripts/dev/ci-local.js --intent push --reuse-passing-receipts`
  (critical push plan against the PR base, `chore/whatsapp-prototype-scope-lock`)
- Result: every automated check passed: format, lint, validation-system-test, test-quality,
  abi-artifacts, the Shared, Client, Admin, Agent and Indexer typecheck, test and build legs,
  contracts-build, contracts-test, contracts-verify-fast, docs-authority, docs-test, docs-build,
  staged-modules, source-structure, design-guardrails, agent-guidance, supply-chain and
  story-quality. The Agent test legs ran in full: 347 passed and 1 skipped, and the SQLite lane 85.
  Turbo replayed the Shared, Client and Admin test legs, whose inputs are unchanged since `53e4dc7`,
  where they ran in full (Shared 6005 passed and 17 skipped, Client 1415, Admin 1069).
  `browser-proof` stays pending (manual).
- Validated paths: `.github bun.lock docs packages scripts` (everything the branch changes outside this hub)
- Worktree identity command and result:
  `git status --porcelain=v1 --untracked-files=all -- .github bun.lock docs packages scripts` → empty
- Evidence-only diff command and result (if applicable):
  `git diff --exit-code 5005199ea54f327f70e63a71d183d6a4eb288821..HEAD -- .github bun.lock docs packages scripts`
  → empty; the receipt commit changes only `.plans/`
- Evidence-only worktree-status command and result (if applicable):
  `git status --porcelain=v1 --untracked-files=all -- .github bun.lock docs packages scripts` → empty

## Risks / Blockers

Model quality, provider behavior, wallet and bundler compatibility and chain inclusion are not
established by fixtures. `.env.schema` declares the three reporting secrets; their 1Password
references still need adding to `.env.template`. LibreOffice conversion waits on a package decision.
