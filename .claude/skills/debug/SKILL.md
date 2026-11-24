---
name: debug
description: Find a bug's root cause before fixing it, then prove the fix with fresh evidence. Use when the user describes a bug, pastes an error, stack trace, or log, reports unexpected behavior or a broken UI, mentions a failing test or build, signals an incident, relays a bug someone else reported, or asks to work QA findings filed in the tracker.
user-invocable: false
argument-hint: "[error-description]"
---

# Debug

## Adapter

Read `.agents/adapter.md` at the repository root: section `## debug`, plus `## checks` for commands. If the file, a section, or a field is missing, say so in one line and use the defaults written as "(default: ...)". Adapter fields are the bold names that follow `## checks` or carry a "(default: ...)". Without `## checks`, take commands from the repository's package scripts, Makefile, or CI config, name the ones you used, and treat auth, payment, and deploy code as critical. **Context** lists the guides that hold codebase patterns and per-package invariants (default: the repository and nearest package agent guides).

## Core principle

Root cause before any fix. Evidence before any claim. For a bug someone can see or touch, start at the rendered surface before tracing data.

## Modes

Pick the mode from the prompt and name it in the report.

| Mode | Signals | Focus |
|---|---|---|
| `default` | "debug this", "why is X failing?", a pasted error, trace, or log, "X should do Y but does Z", a visible UI regression (cannot click, select, or tap; missing selected state or border; collapsed or blank cards; invisible content; broken scroll or refresh; visible but unusable controls), a test or build failure with no clear pattern | Phase 1 and the matching protocol |
| `incident_hotfix` | "production is down", incident, hotfix, emergency, urgent, "customers can't..." | the smallest stabilizing fix, not the ideal root cause |
| `tdd_bugfix` | red test output with a clear failing assertion; "write a failing test for X, then fix it" | reproduce in a test, then fix |
| `user_bug_triage` | anyone outside the session reports broken behavior, whatever the phrasing, role (**Reporters**; default: a user, customer, teammate, or partner), or channel: a forwarded message, a screenshot, a paraphrased complaint | Reported-bug triage |
| `qa_slice_fix` | "pull in the QA issues", "work the QA slices", "fix what we found in QA", "start on the QA findings" | Slice loop |
| verification | "verify this works", "prove completion", "evidence this is done" | Verify |

## Safety

- Recover without destroying work: no `git checkout -- .`, no repository deletion, no forced resets.
- Stay on the current branch. Stash, branch, or rewrite another session's work only when the user authorizes that git action. Follow **Safety** for repository rules and probe commands (default: none beyond these).

## Phase 1: Reproduce and route

Make no fix yet. Reproduce with exact steps, read the full error, and check `git log --oneline -20` for recent changes. Then route:
- a reported bug → Reported-bug triage, which decides the next protocol;
- a visible UI symptom → UI protocol;
- a data, API, service, or deployment symptom → Data protocol;
- QA slices from the tracker → Slice loop, which wraps the protocols.

### Reported-bug triage

1. **Reproduce with the reporter's exact inputs** on the real surface (**Real surface**; default: the same environment, account type, data, and entry path). Aim to trigger it yourself within 5 minutes, with telemetry still closed. If you cannot reproduce, write down why and continue with that caveat.
2. **Name the failing layer** by where the symptom surfaces, not where you suspect it (**Layers**; default: UI render, fetch boundary, server response, external service, deployed configuration).
3. **Probe that boundary** with the exact inputs: send the real HTTP request with the reporter's origin, auth, and headers, and read the raw status, headers, and body; for UI, inspect the DOM at the failing moment; for other layers, use **Boundary probes** (default: call the service or tool directly with the same inputs). One round trip beats a hundred metric reads.
4. **Treat an opaque runtime error as a category**, not a cause, and disambiguate it with one cheap probe before committing to it (**Known errors**; default: none).
5. **State one hypothesis in one sentence.** If you cannot, you do not have one: return to step 3.
6. **Run the cheapest test that would falsify it**, not one that confirms it. A hypothesis you cannot refute cheaply is too vague.
7. **Only now read telemetry** (**Telemetry**; default: the repository's logs and metrics) for scale, versions, regions, sessions, stacks, and releases. It never replaces the boundary proof.
8. **Refuse** these moves: treating separate sessions with similar symptoms as one bug without independent proof; building a story from telemetry before reproducing; overruling the reporter's firsthand observation with a single metric; accepting an opaque category as a diagnosis.
9. **After the fix**, record a reusable symptom-to-cause mapping in **Known-failure notes** (default: project memory).

### Slice loop

A slice is one filed finding from a QA pass. One slice is one branch and one PR, and the posture is repair, not feature building. **Slices** names the source, states, branch naming, validation, and done rule (default: ask the user which tracker issues are the slices and what marks each one done).
1. **List** the slices and the related already-tracked issues in priority order. Only available items can be taken; one already in progress or in review is someone's active work: show it as context and keep its state. Items **Slices** marks as context are never selected. Confirm which slice to take, or take the top available one when the user already said to work through them.
2. **Take one slice.** Mark it in progress only when work actually starts, after grounding and the branch go; a slice stopped before then (design call, declined branch, unsuitable checkout) goes back to available with a comment saying why. Never batch slices into one branch. Sanity-check its seeded priority and re-rank a plainly cosmetic or plainly worse defect.
3. **Ground it** per the fix posture **Slices** names: history first, then the feature's modules and seams, and default to updating or removing over adding. A slice that turns out to need a new module or a design call goes back to the user before any code.
4. **Diagnose** with the UI or Data protocol, chosen by symptom; reproduce before fixing.
5. **Branch only on the user's explicit go**, asked once per slice: propose a branch named for this slice's work from a fresh base, never reusing the previous slice's branch. A standing "work through them all" covers taking slices, not branch actions.
6. **Repair to the slice's "Done when"** and stop there.
7. **Validate** with the check plan for the touched paths (`## checks` **Selector**) plus the slice's named validation command, never an invented fixed suite.
8. **Ship** through the `ship` skill: one slice per PR, the PR referencing its issue.
9. **Hand back**: issue to in review with the PR linked; after the merge, run the tracker closeout. It reaches done only when the re-verification **Slices** names passes.
10. **Next slice or stop** is the user's call at each boundary. When the last open slice lands, close the parent against its "Done when", or say what still holds it open.

### UI protocol

When the user describes what they can see or touch, prove the rendered surface before suspecting providers, queries, auth, or data.
1. Reproduce or simulate the exact visible symptom on the real component path; click or tap the real element, not a mocked child.
2. Inspect rendered geometry and styles: bounding rect, width and height, opacity, display, pointer-events, z-index, overflow, disabled state, selected classes, computed border or ring.
3. Check whether interaction changes state: component state, store, router state, form state, or DOM data attributes after the click or tap.
4. Trace the component stack outward-in: visible element, then its card, button, or input, then its wrapper (carousel, sheet, dialog), then the state setter. Only then hooks, providers, queries, and data.
5. Read the recent history of the visible component and its wrapper (`git log --follow`, focused `git show`) before proposing a fix.
6. Check **UI gotchas** (default: none) before chasing data-layer hypotheses.
7. Text or data present in the DOM with a control collapsed, invisible, untappable, or missing its selected look is a component or CSS regression until browser or DOM evidence proves otherwise.

### Data protocol

For missing or wrong data, failed reads or writes, service or RPC errors, sync drift, deployment artifacts, or service behavior, start at the failing output and trace backward; spend no first pass on CSS or geometry.
1. Capture the failing evidence: request and response body, cache key, log line, failing test, build output, plus the evidence kinds in **Layers**.
2. Classify the failing layer (**Layers**) before proposing a fix.
3. Trace the data path backward from the visible output or failing assertion (**Data path**; default: view, state or cache, client module, API, data store).
4. Verify environment truth first (**Environment truth**; default: environment variables, config files, and deployed versions for the touched surface).
5. Run builds and tests through the repository's own wrappers (`## checks` **Command rules**).
6. Keep a confirmed data or service failure out of styling work unless the data is present and the rendered control is still collapsed, invisible, or unusable.

### Hard-bug loop gate

Use when the symptom has no exact failing assertion or observable loop, spans layers, or survives the first evidence-backed fix. Before widening the hypothesis set:
1. Establish one **red** signal that fails for the reported symptom, not for unrelated setup: a targeted test, exact command, boundary probe, or real-surface interaction.
2. Minimize the reproduction while it still fails; remove unrelated setup and inputs, never the boundary where the symptom occurs.
3. Make the loop tight: deterministic, quick to repeat, runnable by you here. Record the exact input and failing output.
4. Change one variable, rerun the same loop, and drop every explanation it falsifies.

The gate never replaces required real-surface proof: a mocked or lower-layer test cannot certify an authenticated UI, signing, deployment, or production-only symptom. Without a red loop, state that proof limit and do not claim the change fixed the original symptom.

## Phase 2: Hypotheses

Form one specific hypothesis ("X calls Y with null", not "something is wrong with the API") and change one variable at a time. After 3 failed fixes, STOP fixing: question the architecture and your assumptions before a fourth.

## Fix sizing

A fix under 10 lines in one file with a proven root cause goes in directly. A multi-file, pattern-changing, or test-needing fix goes to the user first: root cause, evidence, and the smallest fix; implement after approval.

## Verify

Choose the tier from `## checks` **Tiers** (`targeted` for an isolated fix) and add `## checks` **Conditional checks** for touched surfaces. Report fresh observed evidence with exact commands, name anything unverified, and never substitute a guessed command for planned proof.

## Where to look

**Evidence map** (default: the repository README and package guides) names the owning sources for entrypoints, package constraints, pipelines, telemetry questions, events, and health endpoints. **Known symptoms** (default: none) maps common symptoms to a diagnostic. Prefer the owning source over a copied command list.

## Tracker

Stay read-only on the tracker while debugging. The exceptions are the slice loop's state moves on the slice being worked and the after-merge closeout. After a bug is reproduced and root-caused, route raw reports and accepted fixes per **Tracker** (default: ask before creating anything).

## Report

- **Summary**: symptom, scope, and the mode used.
- **Root cause**: an evidence-backed statement.
- **Actions**: the fix applied, or recommended if report-only.
- **Verification**: commands run and their outcomes, including conditional checks.
- **Next step**: `DONE`, `NEEDS_INPUT`, or `ESCALATE`.

After a fix, the `review` skill checks the change for regressions and gaps.
