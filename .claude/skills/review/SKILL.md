---
name: review
description: Full change review for Green Goods — regressions, remaining gaps, and production quality in one pass. Use when the user asks for a review, asks "any regressions?", "remaining gaps?", "is this production quality / ready?", or wants a PR, branch, working-copy, or cross-package change reviewed. Produces severity-ordered findings, a gap list vs intent, validation evidence, and a verdict.
argument-hint: "[package|PR#|file ...] [--fix] [--scope cross-package|design-system]"
user-invocable: true
---

# Review

One command for the standing request: **"review this — ensure no regressions, no remaining gaps, and production quality."** Three passes over one resolved scope, then a verdict. Read-only unless `--fix` is explicitly requested.

It answers three questions with fresh evidence: **regression safety** (Pass 1), **requirement closure** (Pass 2), **production readiness** (Pass 3). `APPROVE` is a bounded, evidence-backed readiness verdict for the reviewed scope — not a claim that unrelated repository or production failures are impossible.

## Scoping

Resolve scope **before** inspecting code and state it in the Summary so the user can redirect.

1. **Explicit args** — package name(s), PR ref, or file path(s). Multiple combine as a union.
2. **Natural language** — "review the shared package", "review PR 42".
3. **Auto-inference** — no scope given: `git diff --name-only` against the merge-base, infer touched packages, print the inferred scope. Nothing modified → ask what to review.

Valid package scopes map to `packages/<name>/**` (contracts, indexer, shared, client, admin, agent), `docs` → `docs/**`, and `guidance` → `.claude/**` + root `CLAUDE.md`/`AGENTS.md`/`ONBOARDING.md` (agent-guidance changes are reviewable scope like any other). Special scopes:

- `--scope cross-package` — verify blast radius in dependency order (contracts → shared → indexer → apps → agent); only cross-boundary findings.
- `--scope design-system` — delegate to [`design/system-alignment-review.md`](../design/system-alignment-review.md), read-only; return its sections directly, don't mix into diff findings. Fires only on explicit invocation, on DESIGN.md-dialect + theme/tokens co-changes, or when a change touches ≥2 visual surfaces at once.

### Authoritative requirements

After resolving the code scope, establish the requirement baseline in this order: (1) the user's current request and explicit acceptance criteria; (2) the PR description and any linked Linear issue; (3) the Linear issue parsed from a conventional branch name (`<user>/<team-key>-<id>-<slug>` via Linear MCP — skip silently if it doesn't parse); (4) any `.plans/` lane referenced by the request, PR, or issue (`brief.md`, `spec.md`, `plan.todo.md`, `status.json`); (5) directly applicable package documentation those sources reference. Record which sources were available. If no authoritative requirements can be established, continue with useful findings but set the final verdict to `COMMENT_ONLY` — do not claim that no gaps remain.

If scope resolves to >800 LOC, split it into declared review batches and keep a coverage ledger of reviewed vs remaining files; never narrow or imply completeness unless the user explicitly changes the scope.

Package, lane, or pinned-range reviews are supporting evidence only. Before a PR-wide verdict, review
the exact union of changed files from the resolved base through the declared upper bound, including
trailing commits. If code review is pinned below the checkout HEAD, first prove the relevant tree is
identical before using checkout lines or validation as evidence. Never silently extend or narrow a
review range.

## Pass 1 — Regressions

Correctness of what changed. Prioritize high-signal risk areas:

- runtime behavior and edge cases in the changed paths
- shared-boundary violations and permission checks moved, wrapped, or removed
- hidden fallbacks and error-swallowing (silent `catch` with no handling path)
- retry, trust-boundary, migration, or destructive-operation changes
- missing or misleading tests on changed behavior (bugfix with no regression test; public API change with no test update)

**Repo invariants** (the durable list lives in CLAUDE.md § Key Patterns and `.claude/context/<pkg>.md` — check the diff against them): hooks only in `@green-goods/shared`; imports only from declared `packages/shared/package.json#exports` paths (never `shared/src/**` internals); addresses from deployment artifacts; `Address` type; no package-level `.env`; `bun run test` never `bun test`; user-facing strings localized (en/es/pt); `parseContractError` + `createMutationErrorHandler` on mutation paths; `logger` not `console.log`; query keys via `queryKeys.*` helpers; vocabulary/enum/EAS-schema/glossary-entity edits update the ontology sidecar in the same change — `bun run check:ontology` gates it (protocol: `.claude/context/ontology.md`).

**Structural lenses** — apply when the diff shows the signal, not ritually:

- *Boundary/placement*: hook or module landing outside its owning package; first-time cross-package import; layering breaks (`contracts → shared → indexer → client/admin/agent`); a public surface becoming a junk drawer. Prefer the smallest structural fix; never prescribe new layers without a deletion story.
- *Coherence*: new wrapper/abstraction with one call site and no concrete pressure; near-duplicate of adjacent code (flag only when divergence creates real maintenance risk); a function accumulating unrelated concerns. Don't equate size with bad design; confirm harm before reporting. The canonical quality bar is [`values.md § Implementation Quality Contract`](../../context/values.md) — judge against it, don't restate textbook principles.
- *State and invariant*: financial state machines, mutable dependency identity, retry or grace
  windows, cross-chain acknowledgments, asynchronous projections, or upgradeable storage → build
  the risk-triggered matrix from `.claude/context/testing.md` and apply the domain rules in
  `.claude/context/contracts.md`. Exercise material role overlaps, terminal cleanup, time boundaries,
  and dependency generations; a prose lifecycle summary is not proof.
- *Critical surfaces* (CLAUDE.md § Criticality Matrix): contract source plus deploy, upgrade,
  migration, release, size, and storage-validation tooling → **contracts-security** lens (access
  control, UUPS/storage rules, CEI, transaction boundaries, and tooling failure safety); JobQueue,
  Work, and Auth providers and mutation hooks → **mutation-reliability** lens (no log-only failure
  handling, offline queue integrity, retry visibility — invariants in `.claude/context/shared.md`).
  Read every touched line on these surfaces. Apply the matrix's sensitive tier to indexer
  retry/lifecycle handlers, Plan Hub evidence, and agent dispatch scripts.

For large or critical diffs where an adversarial deep pass is warranted, the built-in `/code-review` (effort levels, verify pass) is the engine of choice — say so and use it rather than hand-rolling depth.

## Pass 2 — Remaining Gaps

Completeness against the authoritative requirements established during scoping. Map every requirement to implementation and evidence with an explicit status: `SATISFIED`, `MISSING`, `BLOCKED`, or `OUT_OF_SCOPE`. Any `MISSING` requirement produces `REQUEST_CHANGES`; any `BLOCKED` requirement prevents `APPROVE` and produces `COMMENT_ONLY` unless other findings already require changes.

Then sweep for the repo's recurring gap shapes:

- requirement present in intent but absent or half-wired in code (lead with these — never bury a requirement miss under style notes)
- UI reachable state with no route/entry wired, or wired but dead (feature-availability: undeployed contracts need the `isGreenWillDeployed`-style "not available on this network" branch, not a generic empty state)
- changed behavior with no test; new component/story-covered surface with no story update
- new user-facing strings missing es/pt mirrors (locale-coverage gate will fail later — catch it here)
- unhandled error / empty / loading / offline states on touched views
- TODO/FIXME/HACK introduced by this change; commented-out code left behind
- docs or context files invalidated by the change (commands renamed, envs added)

Report gaps in their own section — a gap is not a defect; it's unfinished intent.

## Pass 3 — Production Quality

Plain review runs the non-mutating **Review Readiness Gate** defined in [`.claude/context/validation-pipeline.md`](../../context/validation-pipeline.md) (`format:check`, lint, tests, pinned `VITE_CHAIN_ID=11155111` build, plus its scope-conditional additions). Run every required stage fresh in this invocation — never reuse stale evidence. A required stage that fails → `REQUEST_CHANGES`; a required stage that cannot run → `COMMENT_ONLY`, never silently downgraded or substituted.

For narrower explicit intents, pick the lightest honest rung per CLAUDE.md § Validation Intent Ladder:

- isolated fix → targeted package-local test/proof
- cross-package or shared-surface impact → Repo Quick Gate
- explicit ship/merge readiness → full Ship Gate + conditional design/vocab/story gates when those surfaces moved

State what ran with real output. Record the tested commit SHA, UTC timestamp, exact command, and
summarized result. Write green, passed, or merge-ready claims only after those commands finish in the
current review. An evidence-only follow-up may cite the tested parent only with a recorded,
path-scoped `git diff --exit-code <tested>..HEAD -- <validated paths>` proving all validated
implementation, dependency, configuration, and validation-entrypoint surfaces are unchanged. If a
rung can't run here (env-gated, needs authenticated browser), say
"unverified: X" instead of hedging. Visible-UI claims need rendered proof via the authenticated Brave
QA path or are reported as blocked (CLAUDE.md § Agentic Modern Web Standard). Dated reports under
`.plans/**/reports/` are immutable audit inputs; put corrections or closure evidence in a new report.

## Finding Closure

Treat each confirmed finding as evidence of a possible failure class, not an isolated line edit.
In a read-only review, these are closure criteria for the author: record missing coverage or proof as
the finding's next step and do not edit files. Execute steps 3-5 only in explicitly authorized
`--fix` mode or verify evidence the author has already supplied.

1. Name the root-cause class and the invariant or repository rule it violates.
2. Search the changed scope and its direct consumers for sibling instances. Record the affected and
   checked-unaffected paths so absence claims are bounded.
3. Add negative or boundary coverage that fails for the original trigger when behavior changed. If a
   test is genuinely inapplicable, state the concrete proof substitute.
4. Re-run the relevant validation at the current SHA before resolving the finding.
5. After all targeted fixes, perform one final recurrence sweep for every approved root-cause class.

Do not convert an explicit product or security boundary into implementation scope. An intentionally
unsupported payment rail, unauthenticated receipt, secret-sharing path, or deployment phase remains a
boundary unless authoritative requirements change it; test or document the rejection instead of
inventing a capability.

## False-Positive Guardrails

- Don't expand a diff review into a repo audit; don't report style preferences or low-confidence hunches.
- Don't flag "missing abstraction" unless the diff creates repeated cost now.
- Don't demand tests for purely mechanical, non-behavioral edits.
- Zero/missing deployment addresses on new contract work = **pending broadcast**, not a finding — unless broadcast was claimed or the deploy/persist/config path itself is missing.
- Every finding needs file:line evidence, why it matters, and a credible next step. Drop the rest.

## Output Contract

Lead with findings, keep the list actionable:

1. **Summary** — scope, blast radius, lenses that fired (with triggering signal), intent sources used
2. **Must-Fix** (critical/high) · **Should-Fix** (medium) · **Nice-to-Have** (low, keep short)
3. **Remaining Gaps** — unfinished intent, each with the smallest completing step
4. **Human Call-Outs** — dependencies, auth/permissions, migrations, contract deploys, trust-boundary changes (never auto-fix these)
5. **Verification** — what ran, real results, what remains unverified
6. **Verdict** — `APPROVE` | `REQUEST_CHANGES` | `COMMENT_ONLY`. Rules: any `MISSING` requirement or failed required check → `REQUEST_CHANGES`; any `BLOCKED` requirement/check, or no authoritative requirements available → `COMMENT_ONLY`; `APPROVE` only when every requirement is `SATISFIED`/`OUT_OF_SCOPE` and the readiness gate passed fresh.

Finding format: `[Title] — severity · type · file:line · why it matters · next step`.

## --fix Mode

Only on explicit request ("fix the findings", `--fix`). Report first, then group approved must-fix and
should-fix items by root-cause class and address at most three classes per iteration; leave
nice-to-have and all Human Call-Outs alone. Complete the sibling and recurrence sweeps from Finding
Closure, then re-run the Pass 3 rung. Contract-touching fixes also run
`bun run verify:contracts:fast`.

## Linear Routing

Review output is read-only. If the user accepts findings for tracking, route via the shared contract: [`.claude/context/linear-routing-rules.md`](../../context/linear-routing-rules.md) — prompt before creating anything.

## GitHub Posting

Only post to a PR when PR context exists and the user asks; otherwise findings stay in chat.
