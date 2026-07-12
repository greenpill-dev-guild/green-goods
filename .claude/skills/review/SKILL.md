---
name: review
description: Full change review for Green Goods — regressions, remaining gaps, and production quality in one pass. Use when the user asks for a review, asks "any regressions?", "remaining gaps?", "is this production quality / ready?", or wants a PR, branch, working-copy, or cross-package change reviewed. Produces severity-ordered findings, a gap list vs intent, validation evidence, and a verdict.
argument-hint: "[package|PR#|file ...] [--fix] [--scope cross-package|design-system]"
user-invocable: true
---

# Review

One command for the standing request: **"review this — ensure no regressions, no remaining gaps, and production quality."** Three passes over one resolved scope, then a verdict. Read-only unless `--fix` is explicitly requested.

## Scoping

Resolve scope **before** inspecting code and state it in the Summary so the user can redirect.

1. **Explicit args** — package name(s), PR ref, or file path(s). Multiple combine as a union.
2. **Natural language** — "review the shared package", "review PR 42".
3. **Auto-inference** — no scope given: `git diff --name-only` against the merge-base, infer touched packages, print the inferred scope. Nothing modified → ask what to review.

Valid package scopes map to `packages/<name>/**` (contracts, indexer, shared, client, admin, agent) plus `docs` → `docs/**`. Special scopes:

- `--scope cross-package` — verify blast radius in dependency order (contracts → shared → indexer → apps → agent); only cross-boundary findings.
- `--scope design-system` — delegate to [`design/system-alignment-review.md`](../design/system-alignment-review.md), read-only; return its sections directly, don't mix into diff findings. Fires only on explicit invocation, on DESIGN.md-dialect + theme/tokens co-changes, or when a change touches ≥2 visual surfaces at once.

If scope resolves to >800 LOC, warn and offer to narrow before continuing. If the branch matches the Linear convention (`<user>/<team-key>-<id>-<slug>`), pull the linked Issue via Linear MCP and use its acceptance criteria as intent input for Pass 2; skip silently if it doesn't parse.

## Pass 1 — Regressions

Correctness of what changed. Prioritize high-signal risk areas:

- runtime behavior and edge cases in the changed paths
- shared-boundary violations and permission checks moved, wrapped, or removed
- hidden fallbacks and error-swallowing (silent `catch` with no handling path)
- retry, trust-boundary, migration, or destructive-operation changes
- missing or misleading tests on changed behavior (bugfix with no regression test; public API change with no test update)

**Repo invariants** (the durable list lives in CLAUDE.md § Key Patterns and `.claude/context/<pkg>.md` — check the diff against them): hooks only in `@green-goods/shared`; barrel imports; addresses from deployment artifacts; `Address` type; no package-level `.env`; `bun run test` never `bun test`; user-facing strings localized (en/es/pt); `parseContractError` + `createMutationErrorHandler` on mutation paths; `logger` not `console.log`; query keys via `queryKeys.*` helpers.

**Structural lenses** — apply when the diff shows the signal, not ritually:

- *Boundary/placement*: hook or module landing outside its owning package; first-time cross-package import; layering breaks (`contracts → shared → indexer → client/admin/agent`); a public surface becoming a junk drawer. Prefer the smallest structural fix; never prescribe new layers without a deletion story.
- *Coherence*: new wrapper/abstraction with one call site and no concrete pressure; near-duplicate of adjacent code (flag only when divergence creates real maintenance risk); a function accumulating unrelated concerns. Don't equate size with bad design; confirm harm before reporting.
- *Critical surfaces* (CLAUDE.md § Criticality Matrix): `packages/contracts/src/**` → **contracts-security** lens (access control, UUPS/storage-gap rules, CEI — checklist in `.claude/context/contracts.md`); JobQueue/Work/Auth providers and mutation hooks → **mutation-reliability** lens (no log-only failure handling, offline queue integrity, retry visibility — invariants in `.claude/context/shared.md`). Read every touched line on these surfaces.

For large or critical diffs where an adversarial deep pass is warranted, the built-in `/code-review` (effort levels, verify pass) is the engine of choice — say so and use it rather than hand-rolling depth.

## Pass 2 — Remaining Gaps

Completeness against intent. Sources of intent, in order: the user's request this session, the active `.plans/active/<feature>/plan.todo.md` if one matches, Linear acceptance criteria from the branch issue, the PR description.

Map each stated requirement to concrete code. Then sweep for the repo's recurring gap shapes:

- requirement present in intent but absent or half-wired in code (lead with these — never bury a requirement miss under style notes)
- UI reachable state with no route/entry wired, or wired but dead (feature-availability: undeployed contracts need the `isGreenWillDeployed`-style "not available on this network" branch, not a generic empty state)
- changed behavior with no test; new component/story-covered surface with no story update
- new user-facing strings missing es/pt mirrors (locale-coverage gate will fail later — catch it here)
- unhandled error / empty / loading / offline states on touched views
- TODO/FIXME/HACK introduced by this change; commented-out code left behind
- docs or context files invalidated by the change (commands renamed, envs added)

Report gaps in their own section — a gap is not a defect; it's unfinished intent.

## Pass 3 — Production Quality

Pick the lightest honest rung per CLAUDE.md § Validation Intent Ladder and run it — commands are defined once in [`.claude/context/validation-pipeline.md`](../../context/validation-pipeline.md):

- isolated fix → targeted package-local test/proof
- cross-package or shared-surface impact → Repo Quick Gate
- explicit ship/merge readiness → full Ship Gate + conditional design/vocab/story gates when those surfaces moved

State what ran with real output. **Never claim quality without evidence** — if a rung can't run here (env-gated, needs authenticated browser), say "unverified: X" instead of hedging. Visible-UI claims need rendered proof via the authenticated Brave QA path or are reported as blocked (CLAUDE.md § Agentic Modern Web Standard).

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
6. **Verdict** — `APPROVE` | `REQUEST_CHANGES` | `COMMENT_ONLY`

Finding format: `[Title] — severity · type · file:line · why it matters · next step`.

## --fix Mode

Only on explicit request ("fix the findings", `--fix`). Report first, then fix must-fix and should-fix items; leave nice-to-have and all Human Call-Outs alone. Re-run the Pass 3 rung after fixing. Contract-touching fixes also run `bun run verify:contracts:fast`.

## Linear Routing

Review output is read-only. If the user accepts findings for tracking, route via the shared contract: [`.claude/context/linear-routing-rules.md`](../../context/linear-routing-rules.md) — prompt before creating anything.

## GitHub Posting

Only post to a PR when PR context exists and the user asks; otherwise findings stay in chat.
