# Repository adapter: Green Goods

Installed as `.agents/adapter.md` in the Green Goods repository. The kit skills (review, debug, plan, ship, research) read their own section here plus `## checks`. Field names follow `TEMPLATE.md`. Where a field points to a Green Goods file, that file owns the rule: follow it when it and this summary differ.

## checks

### Guide
`.claude/context/validation-pipeline.md` owns the intent ladder, exact gates, conditional checks, receipt freshness, and stop rules. `AGENTS.md` § Validation summarizes it.

### Base
The live PR base when one exists, otherwise `origin/develop`. Fetch it before computing the change set. Never assume `origin/main`. A release promotion (a `release/*` head into `main`) compares against `origin/develop` (**Guide** § Ready-for-CI Push Gate).

### Command rules
- Bun for repository scripts and package operations: `bun run test`, never `bun test`.
- Contract and indexer builds and tests go through the Bun scripts in `AGENTS.md` and the package guides, never raw Forge.

### Selector
`bun run check --plan -- --intent <intent>`. It combines intent, changed paths, dependency impact, and criticality; execute the returned plan instead of inventing a broader set.
- Intents: `diagnose` (read-only evidence), `qa` (focused iteration, QA slices), `checkpoint` (cross-package checkpoint), `push` (before publication), `review` (change review); `readiness`, `ship`, `merge`, and `release` only for the matching request.
- Review: `--intent review`, which also covers a live PR's direct local evidence (then inspect required CI at the current head SHA). Explicit offline or full-local readiness: `--intent readiness`, which stays non-mutating and lets criticality only add checks. Review intent classifies risk but selects no override checks: when it reports `critical`, also render `--intent push` with the owner's `--test-path` and run that plan's mandatory override.
- QA slices: `--intent qa` for the touched paths.
- Focus: `--test-path <surface>:<path>` gives the selector direct proof. A `needs-focus` plan starts nothing: provide a focused test, narrow the change, or choose an existing explicit acceptance check.
- Selector unavailable or failing: follow **Guide** directly, report the selector problem, and preserve every hard gate.

### Tiers
| Tier | Green Goods name | Command |
|---|---|---|
| targeted | QA Speed Mode | `bun run --filter <pkg> test <path/to/file>`, or the focused proof in the owning package guide |
| style | QA Speed Mode, style only | `bunx @biomejs/biome format --no-errors-on-unmatched <changed-files...>`; for changed JavaScript or TypeScript, `bunx oxlint <changed-source-files...> --deny-warnings` |
| checkpoint | Repo Quick Gate | `node scripts/dev/ci-local.js --quick` |
| push | Ready-for-CI Push Gate | `node scripts/dev/ci-local.js --intent push --reuse-passing-receipts --test-path <surface>:<focused-test-path>` |
| readiness | Production Review Readiness Gate | `bun run format --check && bun run lint && bun run test && VITE_CHAIN_ID=11155111 bun run build`, every stage fresh |
| full | Ship Gate | `bun format && bun lint && bun run test && bun run build` |
| release | release gate | `node scripts/dev/ci-local.js --intent release`, adding `--attest browser-proof="<engine, session, date, what was observed>"` when the change touches the authenticated surface class |

A format or lint fix outside any gate: `bun format && bun lint`.

### Conditional checks
- Contract-touching change, including a review `--fix` or a debug fix: `bun run check --only contracts-verify-fast`.
- Vocabulary, enum, EAS schema, or glossary-entity edit: `bun run check --only ontology`.
- Plan Hub references moved at closeout: `bun run check --only ontology` and `bun run check --only docs-generated`.
- Every other surface (design tokens, i18n and copy, em dashes, brand voice, stories, source structure, frontend guidance, Playwright CI projects, fork tests, Agent and Docs builds): **Guide** § Production Review Readiness Gate, conditional additions.

### Criticality
`AGENTS.md` § Change Criticality owns the tiers.
- Critical: contract source and release tooling; Shared Auth, JobQueue, and Work providers and modules, workflows, and auth, work, and vault hooks; any other Shared code that signs, sends a transaction, moves funds, or changes auth, session, or queue state. Read every touched line.
- Mandatory override: for Shared, the owner's typecheck and focused suite plus every consumer's typechecks, with CI owning the consumer suites and builds at the current head; for contracts, the full local gate, consumer suites and builds included.
- Sensitive and routine tiers: same section of `AGENTS.md`.

### CI
GitHub. Every required workflow selected for the changed paths must pass at the PR's current head SHA before PR approval; green CI is the broad regression authority. PR CI owns production builds, the Storybook build, the browser presets, whole package suites, and consumer fanout: an ordinary Shared implementation change never runs the full Client, Admin, and Agent suites locally.

### Rendered proof
`AGENTS.md` § Browser Evidence owns the rules. Label every rendered proof by engine and session. Authenticated-class surfaces need authenticated Brave proof or are recorded as pending; clean-room proof is never presented as authenticated. The `browser-proof` check is advisory: record it as pending, never blocked.

## review

### Scopes
`contracts`, `indexer`, `shared`, `client`, `admin`, `agent`, `qa` → `packages/<name>/**`; `docs` → `docs/**`; `guidance` → `.claude/**` plus root `CLAUDE.md`, `AGENTS.md`, and `ONBOARDING.md`. Agent-guidance changes are reviewable scope like any other.

### Special scopes
`--scope design-system`: delegate to `.claude/skills/design/system-alignment-review.md`, read-only, and return its sections directly instead of mixing them into diff findings. It fires only on explicit invocation, on a DESIGN.md-dialect change together with theme or token changes, or when a change touches two or more visual surfaces at once.

### Dependency order
- `--scope cross-package` blast radius: contracts → shared → indexer → apps (client, admin) → agent.
- Layering for the placement lens: `contracts → shared → indexer → client/admin/agent`.

### Requirement sources
- The PR description and any Linear issue linked there with `Fixes`, `Refs`, or `Relates to`, plus the legacy `Closes` and `Linear:` forms while existing PRs transition.
- Any `.plans/` lane the request, PR, or issue references: `brief.md`, `spec.md`, `plan.todo.md`, `status.json`.
- Directly applicable package documentation those sources reference.

### Invariants
The durable list lives in `AGENTS.md` § Essential rules and `.claude/context/<pkg>.md`. Check the diff for:
- hooks only in `@green-goods/shared`;
- imports only from declared `packages/shared/package.json#exports` paths, never `shared/src/**` internals;
- addresses from deployment artifacts, typed with `Address`;
- no package-level `.env`;
- `bun run test`, never `bun test`;
- user-facing strings localized in en, es, and pt;
- `parseContractError` and `createMutationErrorHandler` on mutation paths;
- `logger`, not `console.log`;
- query keys through the `queryKeys.*` helpers;
- vocabulary, enum, EAS-schema, or glossary-entity edits update the ontology sidecar in the same change, gated by `bun run check --only ontology` (protocol: `.claude/context/ontology.md`).

### Quality bar
`.claude/context/values.md` § Implementation Quality Contract. Judge against it; do not restate textbook principles.

### Architecture guide
`.claude/context/codebase-architecture.md`: its depth, locality, leverage, export-taxonomy, and proof model, and its reuse and capability-ownership contract.

### State lens
- Triggers: financial state machines, mutable dependency identity, retry or grace windows, cross-chain acknowledgments, asynchronous projections, upgradeable storage.
- Matrix: the risk-triggered matrix in `.claude/context/testing.md`. Domain rules: `.claude/context/contracts.md`.

### Critical lenses
- Contract source plus deploy, upgrade, migration, release, size, and storage-validation tooling → contracts-security lens: access control, UUPS and storage rules, checks-effects-interactions, transaction boundaries, and tooling failure safety.
- JobQueue, Work, and Auth providers and mutation hooks → mutation-reliability lens: no log-only failure handling, offline queue integrity, retry visibility (invariants in `.claude/context/shared.md`).
- Apply the matrix's sensitive tier to indexer retry and lifecycle handlers, Plan Hub evidence, and agent dispatch scripts.

### Test budget
`.claude/context/testing.md#test-budget`.

### Deep pass
The harness's built-in `/code-review` (effort levels, verify pass). Say so and use it rather than hand-rolling depth.

### Gap shapes
- Feature availability: undeployed contracts need the `isGreenWillDeployed`-style "not available on this network" branch, not a generic empty state.
- A new component or story-covered surface with no story update.
- New user-facing strings missing es or pt mirrors: the locale-coverage gate fails later, so catch it here.
- Unhandled offline states on touched views.

### Not findings
Zero or missing deployment addresses on new contract work are a pending broadcast, unless a broadcast was claimed or the deploy, persist, or config path itself is missing.

### Immutable records
Dated reports under `.plans/**/reports/`.

### Tracker
Linear, through `.claude/context/linear-routing-rules.md`; prompt before creating anything.

## debug

### Context
`AGENTS.md` and the nearest package guide for codebase patterns; `.claude/context/*.md` for per-package invariants; error-handling and testing invariants in `.claude/context/shared.md` and `.claude/context/testing.md`.

### Reporters
Any external party: a user, gardener, steward, customer, team member, or partner. Match meaning, not words: "a gardener said", "the Hypercert team can't", a named teammate "got an error", "steward reports", "someone is hitting", "a user said", a forwarded support message, an attached user screenshot, a paraphrased complaint.

### Safety
- `AGENTS.md` § Multi-Agent Repo Safety.
- In docs and examples, prefer `node -e 'fetch(...)'` over `curl` or `wget`, which are blocked in this environment.

### Real surface
The authenticated Brave QA profile against `localhost`, or production in Brave, with the real auth mode, the real garden, and the real entry path.

### Layers
- Triage: UI render, fetch boundary, server response, contract call, indexer drift, deployment artifact.
- Data classification: component state or query cache, shared hook, shared module, API or indexer, RPC or provider, deployment config, contract ABI or address, on-chain contract state.
- Data-protocol symptoms include RPC errors, indexer drift, deployment artifacts, and contract behavior. Capture as failing evidence also: query key, tx hash, receipt, revert reason, deployment artifact.

### Data path
- Visible output or failing assertion → hook and query key → shared module → provider, indexer, or RPC → contract address, ABI, event, or schema.
- Offline pipeline: the IndexedDB and job-queue implementation in Shared → upload module → contract receipt → indexer event and schema → query cache. Start at the failing output and traverse only the implicated links.

### Environment truth
Chain ID, deployment JSON, indexer config, schema UID, contract address, RPC URL, and the package guide for the touched surface.

### Boundary probes
- Contract: `cast call` against the deployed address.
- Contract and indexer builds and tests: the Bun scripts (`## checks` **Command rules**), never Forge directly.

### Known errors
- `TypeError: Failed to fetch`: one `fetch('/health', {mode:'no-cors'})` against the same host. Success means CORS or the app layer; failure means real connectivity.
- `NotReadableError` on a `File`: the file handle was invalidated by a mobile background and foreground cycle; test with a fresh pick.
- `DOMException` from React reconciliation: check for a stale chunk or service-worker version skew (a cross-bundle callback going undefined) before chasing component logic.
- `Error: Network error`: a category to disambiguate, like the others.

### UI gotchas
- Interaction state to inspect includes the Zustand store.
- Shared-component layout bugs: the Tailwind v4 shared JSX scanning gotcha in `packages/shared/AGENTS.md`.

### Known symptoms
| Symptom | Likely cause | Diagnostic |
|---|---|---|
| "Invalid hook call" | hook defined outside `@green-goods/shared` | `bash .claude/scripts/validate-hook-location.sh` |
| Stale query data | missing query invalidation after a mutation | TanStack Query DevTools |
| Transaction silently fails | wrong auth mode (wallet or passkey) | log `authMode` before the contract call |
| Indexer missing events | contract address mismatch in config | compare `deployments/*.json` with `config.yaml` |
| Storage quota errors | too many offline photos | `getStorageQuota()` |
| Service worker not updating | aggressive caching | `Cache-Control` headers for `/sw.js` |

Hook-location complaints in general: `bash .claude/scripts/validate-hook-location.sh`.

### Evidence map
- Development and service entrypoints: `scripts/README.md` and the nearest package README.
- Package constraints and health boundaries: the nearest package `AGENTS.md`, supported by `.claude/context/client.md`, `.claude/context/shared.md`, `.claude/context/indexer.md`, `.claude/context/contracts.md`, and `.claude/context/agent.md` where the failure crosses package seams.
- Offline pipeline: **Data path**. Telemetry questions: **Telemetry**.
- Current events, health endpoints, and logger interfaces: their code and package exports.

### Telemetry
PostHog measures scale, version range, regional distribution, and session patterns; Sentry supplies stack, release, and suspect-code context. Curated question library and privacy-safe outputs: `docs/routines/posthog-questions.md` and `docs/routines/README.md`.

### Known-failure notes
A project memory per subsystem, such as `project_<subsystem>_known_failures.md`.

### Slices
- Source: the latest `QA session YYYY-MM-DD` parent on the Product team in Linear, written by `/qa-triage --call` after a team QA call, or by its unattended mode after an automated pass. List its open sub-issues and its related already-tracked issues in priority order.
- Available to take: `Todo`, `Backlog`. Someone's active work, shown as context and never selected: `In Progress`, `In Review`.
- Not a slice: a sub-issue with no `package:*` label, such as the `Product decisions from QA session YYYY-MM-DD` child, which is context for a design call.
- Seeded priority derives from catalog walk priority plus verdict, not judged severity.
- Fix posture: `.claude/context/qa.md` § Fix posture: history first (shipping PR, Plan Hub, new versus established), map the feature's modules and seams, hold the update-or-remove-over-add default.
- Branch: `fix/<work-description>` for this slice off fresh `develop`, describing the work, never the session, date, or issue number (`.claude/context/linear-routing-rules.md` § Branch and PR naming). `AGENTS.md` § Multi-Agent Repo Safety applies: a concurrent session may share this checkout.
- PR: `Fixes PRD-NNN`, one slice per PR; traceability lives on that line.
- Done when: the catalog Test IDs' expected results.
- Validation: `bun run check --plan -- --intent qa` for the touched paths, plus the slice's named validation command.
- States: `In Progress` when work starts; back to `Todo` with a comment saying why if stopped before then; `In Review` with the PR linked at hand-back. Once the PR merges, run the closeout in `.claude/context/linear-routing-rules.md` § After a merge. `Done` only when the slice's Test IDs re-record as pass in the QA app; whoever recorded the fail re-records.
- Parent: when the last open slice lands, close the parent against its `Done when`: every slice Done or explicitly deferred with re-QA re-recorded, the decisions child Done or Canceled, no open investigate line. An unruled decisions child or an open investigate line keeps the parent open.

### Tracker
Read-only on Linear while debugging, except the slice states above (only on the slice being worked) and the merge closeout the routing rules authorize. Shared core (team routing, `.plans` and `source:plans`, projects, labels, privacy, prompt before create): `.claude/context/linear-routing-rules.md`. After a bug is reproduced and root-caused:
- raw user or telemetry signal → a Linear Customer Need on the Product team, with the body Source / Customer type / Need statement / Evidence / Disposition;
- accepted fixes, QA follow-ups, or product investigations → a Product issue with `activity:build` (`activity:maintenance` for hygiene), the relevant `package:*`, and `protocol:*`;
- PostHog and Sentry privacy for Linear: `AGENTS.md` § Linear Workspace and `docs/routines/README.md`.

## plan

### Context
`AGENTS.md` for entry points, agent routing, Green Goods conventions, and compliance rules; layering rules in `AGENTS.md` and `.claude/context/*.md`; test conventions in `.claude/context/testing.md`.

### Quality bar
`.claude/context/values.md` § Implementation Quality Contract.

### Priorities
offline correctness → security → UX → DX → elegance (`.claude/context/values.md`).

### Design sections
- Architecture names the packages and modules.
- Data flow covers mutations, queries, onchain calls, and indexer entities.
- Offline behavior: what works without network, per `.claude/context/values.md`.

### Architecture guide
`.claude/context/codebase-architecture.md`: vocabulary, every candidate-card field it requires, and the candidate lifecycle. Plan owns repository-wide opportunity discovery and the design of human-selected improvements; it never certifies an implemented seam.

### Seam registry
Unselected and deferred cards stay in the owning Plan Hub, never in the machine registry. A selected critical module or hotspot may enter `scripts/data/module-seam-registry.json`; implementation advances it to `IMPLEMENTED`, and the read-only `module-seams-review` certifies it as `CERTIFIED` only with fresh evidence.

### Plan location
Foldered feature hubs (Plan Hubs) in `.plans/{ideas|backlog|active}/<feature-slug>/`, with kebab-case slugs. Closed hubs are deleted at closeout and indexed in `.plans/ARCHIVE.md`; Git history is the only archive. Code, tests, and CI never read `.plans/`.

### Plan files
- Minimum per hub: `brief.md`, `spec.md`, `plan.todo.md`, `eval.md`, `status.json`, `handoffs/`.
- `status.json` is the machine-readable contract for automations; the Markdown files stay optimized for humans. Machine-readable lane state belongs in `.plans/active/<feature-slug>/status.json`.
- Architecture spec: a Linear project or issue document, or the owning hub's `spec.md`. Implementation plan and task checklist: `.plans/active/<feature-slug>/plan.todo.md`. Evaluation plan: `.plans/active/<feature-slug>/eval.md`. Idea brief: `.plans/ideas/<feature-slug>/brief.md`.
- Brainstorm: write the brief to `.plans/ideas/<feature-slug>/brief.md`; on approval move it to `.plans/active/<feature-slug>/brief.md`, then create `spec.md`, `plan.todo.md`, and `status.json`.

### Lanes and proof
- Implementation lanes `ui`, `state_api`, and `contracts` are proof-gated for behavior-changing work. `.claude/context/testing.md` is the RED and GREEN source of truth.
- Detailed RED and GREEN proof goes in the lane handoff; machine-readable proof through `node scripts/harness/plan-hub.mjs record-tdd`.
- No behavior change: set the lane TDD mode to `not_applicable` with a concrete note. TDD cannot honestly apply: set `proof_limit` with fallback validation evidence and a concrete note.
- `status.json` lane state and `record-tdd` prove orchestration and TDD state, not current validation. The lane handoff's Validation Receipt carries validation; receipts are not added to the Plan Hub machine schema.
- Legacy boundary: lanes already terminal before 2026-08-11 keep their recorded evidence and status. A reopened lane or a new terminal claim after that date needs the receipt; never rewrite historical dated reports to retrofit it.

### Dependency order
- Cross-package breaking changes, schema migrations, and deployment-affecting work: create or update the owning feature hub first, then contracts → shared → indexer → client/admin → agent, with explicit blast-radius analysis.
- Step order within a plan: contracts → indexer → shared → client/admin → agent.

### Always-separate
Contract changes and frontend changes are always separate steps.

### Plan triggers
- Modifies contracts: deployment and migration implications.
- Changes the data model: schema migration and re-indexing.
- New user-facing feature: UX decisions, i18n, and offline behavior.
- Contracts plans always include tests; frontend plans must too.

### Start gate
Linear sync is the default first step before code changes or agent dispatch on active implementation work.
1. Run `node scripts/harness/plan-hub.mjs linear-sync --feature <feature-slug> --json`.
2. Respect `manifest.stateSyncMode`: `preserve` actions are read-only; verify their issue IDs against live Linear without writing fields, and apply only `create` and `update` actions. Respect `manifest.laneSyncMode`: when it is `parent_only`, create or update only the parent mirror and no lane issues unless Afo explicitly expands the Linear footprint; record that mode with `--lane-sync-mode parent_only`.
3. When `manifest.laneSyncMode` is `lane_issues` and the manifest shows a missing parent or actionable lane issue, create or update the Linear mirror before work begins. Parent and lane issues carry `source:plans` and `protocol:green-goods`; Linear is only for visibility, prioritization, and coordination.
4. Record the identifiers back to the hub. Parent only: `node scripts/harness/plan-hub.mjs record-linear --feature <feature-slug> --parent PRD-123 --lane-sync-mode parent_only --actor <agent>`. Lane issues: `node scripts/harness/plan-hub.mjs record-linear --feature <feature-slug> --parent PRD-123 --lane ui=PRD-124 --lane-sync-mode lane_issues --actor <agent>`.
5. `.plans/<stage>/<feature-slug>/status.json` stays execution truth: lane status, TDD proof, handoffs, and validation evidence go there first.

Every prompt for an agent starting active implementation begins with this gate and requires `record-linear` once Linear IDs exist. Backlog and idea hubs need it only when promoted, accepted for execution, or in need of cross-functional research tracking.

### Tracker mirror
- `.plans` is the execution truth; Linear is a visibility and coordination mirror. GitHub's issue tracker is never used for backlog work; GitHub PRs stay valid for code review and implementation discussion.
- Mirror only for roadmap visibility, cross-functional coordination, stakeholder tracking, or accepted execution or research tracking. Linear metadata is optional and never required for every plan; add the `**Linear Issue**`, `**Linear Project**`, and `**Linear Source**: source:plans` header lines only when mirroring. A Linear record that mirrors a `.plans` item uses `source:plans`.
- Team routing, project attachment, label namespaces, and the privacy boundary: `.claude/context/linear-routing-rules.md`, not restated here. Linear project descriptions (not issues): `.claude/context/linear-project-template.md`.
- A synced execution sub-lane's `linear.parentIssue` is the hub's parent issue or null. To nest sub-lanes under an umbrella tracker that is itself a child of that parent, record the tracker in `linear.trackers` (`name: issue`) and point their `parentIssue` at it. The manifest parents those lanes under the tracker and never writes the tracker issue itself.
- For a reconciled mirror whose live state is independent of local certification, set `linear.stateSyncMode` to `preserve_existing`. Existing parent, canonical-lane, and execution records become read-only `action: preserve` entries holding only the issue ID and optional lane key; include every recorded canonical and execution mirror (inactive, terminal, aggregate, and sync-disabled lanes too), even in parent-only mode; verification creates no lane issue. Never submit them as updates: keep their state, title, body, labels, priority, project, schedule, and dependencies. New issues keep stage-derived create fields. Follow-ups need separately authorized comments, successors, or verified forward-only writes; a Done issue's description stays intact. Never infer Done from uncertified lanes or reopen Canceled scope.
- A `linear-sync` update record leaves out any field the hub does not record (parent, milestone, due date, project); keep that field's current Linear value. On a create record, null means the new issue starts without that field, except the project: a create record with no project routes by routing rule 4 to the active release project, looked up by name, and that release project is not recorded in the hub.
- Record `linear.project` only for a bounded project that owns the hub's work, never a release project: each release opens a new one, so the pin goes stale at the cut, and later creates or non-`preserve_existing` updates would land in a completed project.
- Progress: update `.plans/.../status.json` and the plan files first; if a Linear issue exists, mirror only safe, stakeholder-relevant status within the routing-rules privacy boundary.
- Closing a mirrored hub (plan skill, Close a plan, step 4):
  1. While the PR is open, apply the current `linear-sync` manifest so terminal implementation issues and their active parent are `In Review`, applying only create and update actions. With `preserve_existing`, verify each read-only `preserve` entry against live Linear without changing its fields, and verify any separately authorized forward advancement. Never move Done backward or reopen Canceled scope.
  2. After a human merges delivered implementation, run the closeout in `.claude/context/linear-routing-rules.md` § After a merge for the issue the PR's reference line names; when it comments, the comment says in one or two sentences what shipped and what is still open. The hub's other mirrored implementation issues and parent change only through step 1's create and update actions: verify them against live Linear, and ask before any other write to them. Nothing reaches `Done` before a person's review; preserve already-Done bodies and Canceled scope. Research-only reconciliation never marks research Done; verify its independently owned status without advancing it.
  3. Run `node scripts/harness/plan-hub.mjs confirm-linear-sync --feature <slug> --actor <actor>` as the last hub edit before the closeout-record commit, only after the writes and live verification above. A preservation manifest alone is not sync confirmation, and archiving refuses a mirror that changed after its last confirmation.
- PR linkage: a PR description may link the hub and the Linear issue with the single reference line the routing rules define (§ After a merge). That line never closes a mirrored record: after a merge it belongs in `In Review`, and `Done` follows a person's review.

### Closeout
- When: the PR that finishes a hub carries its closeout record (steps 1 to 5); the archive commit (step 6) lands right after the human merge. The weekly `/audit drift plans` pass lists hubs that shipped without one.
- Resolutions: `completed` (every lane terminal with its receipts), `closed` (shipped without certified lanes), `superseded`, `paused`, `cancelled`, `closed_stale`. The archive ledger keeps the Linear parent key; Git history keeps the closed hub.
- Reference scan: `git grep -n ".plans/<stage>/<slug>"` outside the hub, and a search of other hubs for relative links (`../<slug>/`). Move any data code, tests, or CI read into its package first. Update ontology `spec_source` and evidence paths, `scripts/data/validation-policy.json`, workflow `paths:` filters, and other hubs' `status.json` links, then regenerate with `node scripts/quality/check-ontology.mjs --generate` and `node scripts/docs/generate.mjs`. Never edit dated `reports/`.
- Record: in `plan.todo.md`, set `**Status**` to `CLOSED: <what shipped>`, update `**Last Updated**`, and append a `## Closeout (<date>)` section from the kit template. In `status.json`, append a `closeout_recorded` history entry, leave uncertified lanes as they are, and trim `links` to the hub's top-level files plus confined `reports/` paths; the archive refuses links into `handoffs/`, other hubs, or packages.
- Commit the record by itself as `docs(plans): record the closeout of <slug>`, after formatting `status.json` with Biome.
- Archive: `node scripts/harness/plan-hub.mjs move --feature <slug> --to archive --resolution <resolution> --reason "<one or two sentences>"`. The reason becomes the `.plans/ARCHIVE.md` row and must not contain `.plans/active/`, `.plans/backlog/`, or `.plans/ideas/` paths. Commit the deletion, the ledger row, and the reference updates together as `chore(plans): close <slug>`.
- Verify: `node scripts/harness/plan-hub.mjs validate` and, when references moved, `bun run check --only ontology` and `bun run check --only docs-generated`. Confirm `git show <archive-commit>^:.plans/<stage>/<slug>/plan.todo.md` shows the closeout section.
- Stage moves (`--to backlog` or `--to ideas`) keep the hub and take one commit: run the reference scan, update the `**Stage**` and `**Status**` headers, add a `status.json` history entry saying why, and move a mirrored parent to `Backlog` in Linear.
- A superseded hub closes with `--resolution superseded`; its reports stay recoverable from Git history. Never hand-delete a report-bearing hub outside `plan-hub.mjs move`.

### Lifecycle
- Stale plans: the weekly `/audit drift plans` pass reviews any plan untouched for 14+ days or whose work already merged; close with an honest resolution (`closed_stale`, `paused`, ...).
- Raw transcripts and meeting notes go in `notes/`, Customer Needs, or safe comments on linked Linear or PR records, never in `.plans/`.
- Accepted audit findings go to Linear after approval.
- Dated reports under `.plans/**/reports/` are immutable: never edit or delete one; add a new correction, closure, or superseding report that links the historical input.

### Templates
- Header fields: `**Linear Issue**: PRD-### (optional)`, `**Linear Project**: <bounded project name> (optional)`, `**Linear Source**: source:plans (only when mirrored to Linear)`.
- Compliance items: hooks in the shared package; i18n for UI strings; deployment artifacts for addresses; Implementation Quality Contract applied.
- Machine state, `status.json` lanes:

  ```json
  {
    "feature": { "slug": "feature-slug", "stage": "active" },
    "lanes": {
      "ui": { "owner": "<agent>", "status": "ready", "branch": "feature/profile-avatar-editor" },
      "state_api": { "owner": "<agent>", "status": "ready", "branch": "feature/profile-avatar-storage" },
      "contracts": { "owner": "<agent>", "status": "n/a", "branch": null },
      "qa_pass_1": { "owner": "<agent>", "status": "blocked", "depends_on": ["ui", "state_api", "contracts"] },
      "qa_pass_2": { "owner": "<agent>", "status": "blocked", "depends_on": ["qa_pass_1"] }
    }
  }
  ```

- Handoff record: the task and phase record in `.claude/context/task-handoffs.md`, included in batch and lane handoffs; keep validation receipts with their proof.

### Teams
- Preflight: `bash .claude/scripts/check-agent-teams-readiness.sh`. Dispatching teammates also run `bash .claude/scripts/check-codex-lane-readiness.sh`, which uses the shared binary resolver and checks the dispatcher binary, the canonical output schema `.codex/output-schema.json`, `jq`, the worktree parent, and that delegated lanes get only the fixed non-secret environment allowlist; it never links the root `.env` into a worktree. If preflight fails, use subagents with the same ownership model.
- Harness: agent teams are an experimental harness feature, already enabled in `.claude/settings.json`, the canonical harness settings and hooks surface. Display mode is in-process (`teammateMode: "in-process"`); `"tmux"` gives split panes. The harness's agent-teams documentation covers the in-process controls.
- Lane model for cross-package work (suggested, not mandatory): a lead plus a chain specialist (contracts and indexer), a middleware specialist (shared), and an app specialist (client and admin).
- Ownership: chain owns `packages/contracts/**` and `packages/indexer/**`; middleware owns `packages/shared/**`; app owns `packages/client/**` and `packages/admin/**`; no lane touches the others'. When two teammates need Shared, split by directory, for example `shared/src/hooks/garden/` and `shared/src/hooks/work/`.
- Plan approval before changes: any Solidity contract modification, deploy script changes, and changes affecting on-chain state.
- Completion hooks: `TeammateIdle` runs `.claude/scripts/teammate-idle-gate.sh`; `TaskCompleted` runs `.claude/scripts/task-completion-gate.sh`. Exit code 2 keeps the teammate working or prevents completion, only on error signals; otherwise the hook reports an advisory pass.
- Dispatcher: `.claude/scripts/dispatch-codex-lane.sh` is the single entry point. Required: `--lane`, `--base`, `--branch <type>/<work-description>`, and `--prompt` or `--prompt-file` (typically `.plans/active/<feature-slug>/handoffs/<lane>.md`). Optional: `--schema` (default `.codex/output-schema.json`). It creates the worktree `/tmp/gg-codex-<lane>` on the caller-supplied work branch and runs the dispatched CLI with `exec --approve-for-me` (which already selects workspace-write and cannot be combined with `-s`), a fixed non-secret environment, and closed stdin. The root `.env` is never linked, so secret-backed validation stays a parent-session or human-run gate. Stdout is JSON with `result_file`, `worktree`, `branch`, and `dispatch_exit`; open `result_file` and require `status == success` and `tests_passed == true`. It does no cleanup: after review and a `--no-ff` merge into `feature/<feature-slug>`, the teammate runs `git worktree remove /tmp/gg-codex-<lane>` and `git branch -d <work-branch>`. Environment overrides: `CODEX` (binary path), `CODEX_HOME` (state directory), `CODEX_WORKTREE_PARENT` (default `/tmp`). Re-check the CLI's `exec --help` before changing these flags; its surface changes between releases.
- Prompt guide for dispatched lanes: `https://developers.openai.com/codex/prompting`. The dispatched CLI loads `AGENTS.md` on its own.
- References: CLI config `.codex/config.toml`; plan-specific orchestration in the current feature hub's `handoffs/` directory.

## ship

### Branch check
`node scripts/quality/branch-name-policy.mjs "$(git branch --show-current)"`. Naming rules: `.claude/context/linear-routing-rules.md` § Branch and PR naming.

### Protected branches
`main`, `master`, `develop`.

### PR issue line
Every PR names exactly one Linear issue on an explicit reference line in its body: `Fixes <ID>`, `Refs <ID>`, or `Relates to <ID>`, using the identifier Linear gave the issue, such as `PRD-123` or `RESR-45`. Never infer it from the branch. When the work has no issue yet, find or file one before opening the PR (`.claude/context/linear-routing-rules.md` § Every pull request names an issue). `.github/pull_request_template.md` gives the meanings: `Fixes` completes the issue, `Refs` is partial or stacked work, `Relates to` is context only; bot PRs leave the line out.

### Hooks
Pre-commit runs `lint-staged` only and is not a readiness gate. Pre-push runs the push tier and may reuse an exact passing receipt from a manual run.

### Commit format
Conventional commits: `type(scope): description`, with the repository's allowed types and scopes.

### Push gate
- The push tier is a thin pre-check: format, lint, cheap repository checks, owner and consumer typechecks, docs drift, and focused tests. Its plan lists the builds, Storybook build, browser presets, and whole suites it leaves to PR CI. A critical contracts change keeps its full local gate, consumer suites and builds included.
- Hard limits: 90 seconds for routine work, 180 seconds for sensitive work. A saturated host (1-minute load above 1.5 times the host CPU count) suspends the limit, so it stops no check.
- `needs-focus` and `budget-exceeded` block publication.
- A passing receipt is reusable only when the commit, working-tree fingerprint, command, policy, toolchain, validated paths, and environment match exactly. The pre-push hook calls the same command and may reuse that exact pass.

### PR
Create only when requested, using `.github/pull_request_template.md`, the draft label, the automation label, validation evidence, and the Linear reference line.

### Merge
Merge commits by default for authorized PR merges into `develop` and `main`, including promotions from `develop` to `main`. Squash only when documented repository policy calls for it or the user explicitly requests it for that PR. Verify that GitHub allows the selected method and pass it explicitly to the merge tool; if it is unavailable, ask before merging (`AGENTS.md` § Scope and workflow).

### After merge
`.claude/context/linear-routing-rules.md` § After a merge owns the steps, their conditions, and what the closeout may write; `Done` waits for a person's review.

### Report line
The Linear line: the issue the PR names with its observed state (saying when the closeout linked or filed it after the merge), `bot PR` for an exempt bot PR, or `not checked`.

### Unattended
Unattended maintenance PRs: 20 changed files or fewer, as drafts with the required labels. Do not modify deployment or upgrade scripts or environment files, add packages or top-level directories, or edit agent operating guidance unless the assigned task explicitly requests it.

## research

### Plan entry point
For an owning Plan Hub, read its `status.json` links and its document map first, then open only the targeted canonical documents those pointers identify.

### Neighbor skills
Repository-health or drift classification → `audit`.

### Durable evidence
Follow the owning repository convention: one focused evidence artifact, as a report in the owning Plan Hub only when it is direct evidence for that feature (dated reports there are immutable). Accepted product or architecture decisions return to `plan` and enter the canonical Plan Hub files.

### Mapping workflow
Wayfinder. The map-ready handoff is its escalation contract; it does not implement Wayfinder.

### Tracker
Linear.
