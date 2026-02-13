# Claude Agent Teams

Green Goods uses a package-aware pair model:
- 3 lanes: `chain`, `middleware`, `app`
- each lane has `driver + observer`
- lead is an adversarial final integrator

This is a contributor workflow, not a runtime product feature.

## Shortcuts

- `/teams ship <target>`: full paired build/maintain flow
- `/teams review <target>`: review-only flow
- `/teams entropy <target>`: audit and reduce entropy flow

## Team Topology

- `chain-driver` + `chain-observer`: `contracts` + `indexer`
- `middleware-driver` + `middleware-observer`: `shared`
- `app-driver` + `app-observer`: `client` + `admin` (+ `agent` when touched)
- Lead: adversarial integration reviewer

## Pair Rules

- Driver proposes implementation/findings.
- Observer challenges and validates in parallel.
- Lane is not complete without observer sign-off or explicit lead override.

## Task Token Contract

Every task must include:

```text
[scope:<middleware|shared|client|admin|contracts|indexer|integration|docs>] [gate:<required|advisory>] [check:<quick|full>]
```

Notes:
- Use `middleware` for the shared lane.
- `shared` remains supported for compatibility.

Defaults:
- `gate=advisory`
- `check=quick`
- missing scope => no blocking checks

## Copy/Paste Prompt (`/teams ship`)

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
- adversarial final reviewer
- coordination only while teammates are active
- reject non-compliant outputs
- require integration-level validation
- return final PASS/FAIL verdict with reasons

Task requirements:
- every task includes [scope:*] [gate:*] [check:*]
- use [gate:required] [check:full] for release blockers
```

## Review Shortcut (`/teams review`)

Use the same 6-teammate lane model but findings-only output.
No direct implementation; deliver severity-ranked findings with evidence.

## Entropy Shortcut (`/teams entropy`)

Use the same 6-teammate lane model to:
- identify architectural entropy hotspots
- propose minimal safe simplifications
- produce a prioritized execution order with risks

## Hook Gates

- `TaskCompleted` -> `.claude/scripts/task-completion-gate.sh`
  - blocks only for `gate=required` failures
- `TeammateIdle` -> `.claude/scripts/teammate-idle-gate.sh`
  - blocks idle completion when reason signals error/failure

## Cleanup

1. Shut down teammates.
2. Confirm no active teammates.
3. Lead runs cleanup: `Clean up the team`.

## Fallback

If team capability is unavailable, use subagents with the same lane ownership and token contract.
