# /teams - Green Goods Pair-Team Workflow

Developer-friendly team shortcuts for package-level delivery, review, and entropy reduction.

## Trigger

- `/teams ship [target]` - Default build/maintain flow (paired lanes + strict integration)
- `/teams review [target]` - Review-focused paired team (no implementation)
- `/teams entropy [target]` - Audit + reduce entropy (architecture simplification/refactor plan)
- `/teams preflight` - Validate readiness only
- `/teams cleanup` - Shut down teammates and clean up resources

## Lane Model (All Shortcuts)

One team with 6 teammates (3 pairs):
- `chain-driver` + `chain-observer` (`contracts` + `indexer`)
- `middleware-driver` + `middleware-observer` (`shared` package)
- `app-driver` + `app-observer` (`client` + `admin` + `agent` when needed)

Lead role is adversarial integrator:
- challenge assumptions
- reject non-compliant work
- require evidence for architecture/test/integration quality
- return explicit PASS/FAIL verdict

Use delegate mode (`Shift+Tab`) so lead remains coordination-only while teammates are active.

## Task Metadata Contract (Required)

Every task must include tokens:

```text
[scope:<middleware|shared|client|admin|contracts|indexer|integration|docs>] [gate:<required|advisory>] [check:<quick|full>]
```

Notes:
- `middleware` maps to `packages/shared` for gate checks.
- `shared` remains supported as a compatibility alias.

Defaults when omitted:
- `gate=advisory`
- `check=quick`
- missing scope => no blocking checks

## Shortcut Templates

### `/teams ship [target]`

```text
Run preflight first: bash .claude/scripts/check-agent-teams-readiness.sh

If preflight passes, create one team for <TARGET> with 6 teammates:
chain-driver, chain-observer, middleware-driver, middleware-observer, app-driver, app-observer.

Model:
- chain pair owns contracts+indexer
- middleware pair owns shared package
- app pair owns client/admin (and agent if touched)
- driver implements, observer validates
- lane completion requires observer sign-off

Lead behavior:
- adversarial final reviewer and integrator
- coordination-only while teammates are active
- reject non-compliant outputs
- require integration-level validation
- final PASS/FAIL verdict with reasons

Task requirements:
- every task includes [scope:*] [gate:*] [check:*]
- use [gate:required] [check:full] for release blockers
```

### `/teams review [target]`

```text
Run preflight first: bash .claude/scripts/check-agent-teams-readiness.sh

Create the same 6-teammate pair model for review-only work on <TARGET>.
No implementation; findings only.

Focus:
- chain pair: contract/indexer risk review
- middleware pair: shared hooks/types/query-key and boundary review
- app pair: client/admin behavior/perf/usability review

Lead is adversarial reviewer:
- challenge weak findings
- require file/line evidence
- publish final severity-ranked report (Critical/High/Medium/Low)
```

### `/teams entropy [target]`

```text
Run preflight first: bash .claude/scripts/check-agent-teams-readiness.sh

Create the same 6-teammate pair model for entropy reduction on <TARGET>.
Goal: simplify architecture, remove duplication, tighten boundaries.

Per lane:
- identify entropy hotspots
- propose minimal safe refactors
- provide risk + rollout order

Lead is adversarial architecture reviewer:
- reject speculative or high-risk churn
- require measurable simplification outcomes
- deliver final entropy-reduction plan with execution order
```

## Pair Behavior Contract

For each lane:
- Driver owns implementation/findings draft.
- Observer challenges and validates in parallel.
- Lane completion requires observer sign-off or explicit lead override.

## Cleanup

1. Ask all teammates to shut down.
2. Confirm no teammates remain active.
3. From lead only: `Clean up the team`.

## Fallback (Dual-Mode)

If team surfaces are unavailable, run subagents using the same lane ownership and token contract.
