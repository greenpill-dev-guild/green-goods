---
name: qa-session
user-invocable: true
description: Run a live, paired, role-choreographed, or transcript-based Green Goods product-experience QA walk. Capture stable OBS records, triage bounded fix-now work, revalidate in the serving checkout, hand deferred findings to qa-triage with exact Test IDs, and lock user-approved design decisions at close. Fires on "QA session", "QA walk/walkthrough", "I'll walk the flows and call out issues", "fix live while I test", "we're QAing together", or a dictated-walk transcript. Not for meeting-notes triage (qa-triage), a single reported bug (debug), or diff review (review).
argument-hint: "[<transcript-path>] [--surface admin|pwa|website|docs|all] [--cases <IDs|area>] [--paired] [--journey <id>] [--part <lane>]"
---

# QA Session Skill

Copilot for founder-led product-experience QA: the user walks real flows on the local stack
against production data, dictating what they see; the agent logs every observation, fixes what is
safely fixable in the same running checkout so the user can revalidate within the session, and
routes everything else into the durable triage machinery. Design decisions locked during the
session compound into the design guidance.

This skill owns the **live loop** only. It links to the owners of everything else — it does not
duplicate them:

| Need | Owner |
|---|---|
| QA layers, artifact ownership, privacy, verdict rollup, roster, state queries, Test ID linkage, workbook exception | [`.claude/context/qa.md`](../../context/qa.md) |
| Retrospective meeting-notes triage, PostHog cross-ref, Linear + Sheet writes | [`qa-triage`](../qa-triage/SKILL.md) (this skill hands off to it) |
| Linear payload templates, label scheme, disposition rules | [`qa-triage/linear-templates.md`](../qa-triage/linear-templates.md) |
| Sheet/workbook schemas, surface vocabulary, severity defaults | [`qa-triage/sheet-schema.md`](../qa-triage/sheet-schema.md) |
| Reproduce-first diagnosis, rendered-DOM-geometry-first UI regression protocol | [`debug`](../debug/SKILL.md) § User-Facing Bug Triage, § User-Observed UI Regression Protocol |
| Casual phrase → `data-component`/`data-region` resolution (admin) | [`design/defect-grammar.md`](../design/defect-grammar.md) |
| Locked design decisions (DL-NNN ledger, graduation ladder) | [`design/decision-log.md`](../design/decision-log.md) |
| In-session fast validation rungs (QA Speed Mode) | [`.claude/context/validation-pipeline.md`](../../context/validation-pipeline.md) § Partial rungs |
| Journey matrices, receipt fields, defect labels, evidence hierarchy | `docs/docs/builders/quality/product-experience-qa.mdx` |
| Post-call report + fix slices for team calls (app + Meet notes → Linear) | [`qa-call-report`](../../../docs/routines/qa-call-report.md) routine / `/qa-triage --call` |
| Fix posture for any QA fix (history, seams, update-over-add) | [`.claude/context/qa.md § Fix posture`](../../context/qa.md) |
| Pre-merge gate at close | [`ship`](../ship/SKILL.md) |

## Activation

| Trigger | Action |
|---------|--------|
| `/qa-session` | Live copilot mode: run pre-flight, then capture dictated observations as they arrive |
| `/qa-session <transcript-path>` | Batch mode: ingest a recorded dictation transcript of a completed walk |
| `/qa-session --surface admin` | Scope the session (and the printed walk checklist) to one surface; aliases `admin\|pwa\|website\|docs\|all` (catalog v2 merged the installed-PWA tabs; scope device rows with `--cases PWA-IOS-…`/`PWA-AND-…` instead) |
| `/qa-session --cases ADM-012,ADM-013` | Scope to specific catalog Test IDs or an `Area` name |
| `/qa-session --paired` | Two testers walking different surfaces at once, each with their own agent; section-scoped handoffs (§ Paired sessions) |
| `/qa-session --journey service-relay --part protocol-review` | Role-choreographed pairing: follow one guided journey and one Act/Verify lane across surfaces (§ Paired sessions) |
| Prose: "starting a QA session", "I'll walk the app and dictate", "fix these live while I test" | Same as `/qa-session` |
| Prose: "Gui and I are QAing together", "we're both walking", "I'll take PWA, he'll take the website" | Same as `--paired` |

**Boundaries** — route away when:

- The input is **meeting notes** or a past sync's bug list → `qa-triage`.
- A single party **reported one bug** and the job is diagnosis → `debug` (passive).
- The ask is to **review a change or PR** → `review`.
- The ask is design direction or polish guidance without a walkthrough → `design`.

## Mode selection

- **Solo live copilot** (default): one walker, dictating now. Per-item micro-consent — the user
  is watching, so each fix-now proposal is a one-line ask.
- **Paired sectioned**: two testers walking different surfaces at once, each dictating to their
  OWN agent, with the QA app as the shared record. The unit of work is a **section**, not an
  observation: the walker finishes a surface or area, hands that slice to their agent, and keeps
  walking while the agent works. See § Paired sessions.
- **Paired journey**: two testers select the same QA Journey and different Parts, keep one wallet
  identity each, and meet at the authored handoffs across surfaces. Act/Verify lanes coordinate
  depth; they do not replace the split-by-surface style used for broad coverage. See § Paired
  sessions.
- **Batch transcript**: the walk already happened; the input is a transcript file. Same phases,
  three deltas (§ Batch mode): parse first, a **scope-lock gate before any edit**, and
  agent-side reproduction/validation per the `debug` protocols with asynchronous founder
  revalidation.

## Phase 0 — Pre-flight

Run before the user starts walking. Print the checklist results compactly; stop on a hard fail.

1. **Same-checkout guard.** Live fixes only render if they land in the checkout serving the
   ports. Primary check: `bun run dev:stack status` — it reports each surface's lease owner and
   compatibility key without external tools (the Codex container has no `lsof`). If another
   owner holds 3001/3002, stop and say so — do not restart another session's stack. Where
   available, `lsof -nP -iTCP:3001 -sTCP:LISTEN` (then the pid's cwd) is a secondary
   cross-check that the listener really serves THIS repo root.
   **Never `EnterWorktree` during a session**; fixes land in this checkout.
2. **Stack.** `bun run dev:prod` (docs, admin, client, storybook against real Arbitrum, hosted
   indexer, production agent) if not already up. `dev:prod:mirror` when the session needs a local
   indexer. Health: `bun run dev:doctor -- --profile prod`.
3. **Warm-up and profile state.** Load every in-scope surface once BEFORE dictation begins. Also
   record the QA profile's stored preferences that change rendering — most importantly
   `localStorage["gg-language"]`, which overrides browser locale: a Portuguese UI on an English
   browser is a saved preference, not a defect. Note the active locale in the session header so
   language rendering is judged against the right expectation. The client boot
   watchdog shows recovery UI when React has not mounted within ~4.5s — a cold Vite transform can
   trip it. A fallback on a **cold** first load is instrumentation, not a defect; reproduce warm
   before logging it as one. Watch the dev log for `new dependencies optimized` — that line means
   a full reload just ate the flow (optimizeDeps drift); note it as an env event, fix the
   `optimizeDeps.include` list after the session.
4. **Identity plan.** Authenticated Brave QA profile via the Chrome-extension path for
   authenticated proof (per `CLAUDE.md § Claude Tool Routing`). Probe reachability with a
   tab-context call, NOT the connected-browsers listing — the listing lags registration and
   reads empty while the extension works; declare the lane Blocked (no substitute browser)
   only after the tab-context probe itself fails. **Use `?mockAuth=deployer` for read-only production
   passes** — verified 2026-08-28 to render real garden data (work queues, submissions, media).
   `?mockAuth=steward` currently resolves to an address with **no garden assignment in the
   production indexer** and lands on the "no garden access" empty state, so it proves the gate,
   not the journey. Mock auth changes the app's role context but does not disable transaction
   hooks. Disconnect any wallet session before a mock-auth pass; cancel an unexpected wallet
   prompt and treat the setup as invalid. Both roles are **loopback-only**: use them solely on
   `localhost`/`127.0.0.1` sessions, never over `dev:tunnel` or any non-loopback URL
   (a tunneled dev server would hand production-backed steward views to anyone with the link) —
   those checks go through authenticated Brave instead. The mock role persists in **per-tab**
   sessionStorage and removing the query param does not restore real auth: run wallet-write
   flows in a **fresh tab that never carried `?mockAuth`**, and never reuse a mock tab for a
   write flow. `?presentation=pwa` once per tab for the PWA shell on desktop.
   `?gardenId=<address>` switches between the user's garden and the community garden.
   The loopback rule is also **enforced in code**: `hasMockAuthOverride` ignores the mock seam
   on any non-loopback hostname, so a LAN device hitting the dev server gets the real
   AuthProvider. **Passkey ceremonies cannot run on localhost** (RP-ID `greengoods.app`):
   catalog cases marked `requiresProduction` or `requiresDevice` (camera, app relaunch, touch
   gestures) are pre-marked `Blocked` in `--local` run sheets — desktop PWA-shell observations
   about those journeys go in OBS notes, never into the installed-device rows.
5. **Real-write boundary.** dev:prod wallet transactions are REAL Arbitrum writes. Ask once,
   before the walk: *which flows may broadcast transactions, and which stop at the review step?*
   Record the answer in the session header and respect it absolutely.
6. **Workspace — no branch changes.** Clean tree required. Define the session slug ONCE:
   `<slug>` = `YYYY-MM-DD`, with a `-2`/`-3` suffix if `tmp/qa-session/<slug>/` already exists —
   and reuse that exact slug for every artifact this session (directory, log, results, receipt,
   handoff). Create `tmp/qa-session/<slug>/` and open
   `qa-session-<slug>.md` with the header: commit SHA, branch, surfaces in scope, gardens,
   identity modes, pairing style, Journey and Part assignments when used, write boundary, and the
   in-scope catalog case IDs. The session **stays on the
   current branch** — per `AGENTS.md § Multi-Agent Repo Safety`, never create or switch branches
   without the user explicitly asking for that branch action; branching is decided at the first
   accepted fix (Phase 3), not at session start.
7. **Recording readiness.** Apply the recording, attribution, and workbook-exception contract in
   [`.claude/context/qa.md`](../../context/qa.md). Confirm its app pre-flight before the walk; use
   the app as the checklist and read the catalog only to print requested scope. For a guided walk,
   confirm both people can select the same Journey, each person's Part is correct, All surfaces is
   available, and each person remains signed into their own allowlisted wallet.

## Phase 1 — Capture

Log every dictated item to `tmp/qa-session/<slug>/qa-session-<slug>.md` **immediately**, before any discussion. Never stall the
walk with diagnosis monologues — one-line acknowledgment plus the triage question, nothing more.

```markdown
### OBS-07 · 14:32 · admin /hub/work · defect
> "the approve button is below the fold again on review"
resolved: ReviewForm actions not routed through AdminDialog.actions (defect-grammar Tier 1)
case: ADM-012
```

- **Types**: `defect | polish | idea | question | decision | blocked`. `decision` = the user
  states a preference or ruling to lock. `blocked` = capability blocked (name what is missing).
- **Verbatim quote always** — the user's words are the primary record.
- Sequential `OBS-NN`, timestamped, with surface + route. IDs never reused within a session.
- **Component resolution happens quietly**: admin surfaces via
  [`defect-grammar.md`](../design/defect-grammar.md) Tier 1 (live DOM `data-component` /
  `data-region`), client via route + grep. Unresolvable → log with `resolved: pending`, move on.
- `case: <Test ID>` when the observation maps to a catalog row — exact IDs make the downstream
  qa-triage match deterministic instead of fuzzy.

## Phase 2 — Live triage

Immediately after capture, propose a disposition in ONE line:

> "OBS-07 logged — fix-now candidate (~10 min, ReviewForm + LeftInspectorDialog). Now, at the
> fix window, or defer?"

**Fix-now requires ALL of:**

- **Size**: estimate ≤ 30 min and ≤ 3 files. The timebox is binding — if the estimate breaks
  mid-fix, abandon, revert, re-disposition as deferred.
- **Blast radius**: presentation, copy, layout, or single-component behavior only. **Never
  fix-now**: auth, offline queue, chain-write paths, `packages/contracts`, indexer schema,
  dependency changes, cross-package refactors, public API/type changes.
- **HMR-validatable**: the user can revalidate visually in their open tab. Edits that restart
  the dev server (vite/tailwind config) wait for the end-of-session fix window.
- **Reversible**: lands as a single revertable commit.

Ambiguity defers. The user can overrule ("just fix it") — record `override: user` on the OBS.
`question` items get answered or deferred; `decision` items are parked for the Phase 4 lock gate.
Fixes can apply immediately or batch into a **fix window** the user calls (e.g. after finishing a
surface) — their choice, per item or standing.

## Phase 3 — Fix-now loop

**Branch decision (first accepted fix only):** if the current branch is `develop` or `main`, ask
the user once for the branch action and proceed only on their explicit yes — never create or
switch branches without that ask. Propose a name describing the WORK, derived from the first
accepted fix per `AGENTS.md § Branch + PR` (`fix/<work-description>`, e.g.
`fix/pin-review-dialog-actions`) — never a session/date/orchestration name like
`fix/qa-session-…`. Session traceability lives in the commit messages (`OBS-NN` refs), not the
branch name. On an existing work branch, commit there.

Fixes follow [`.claude/context/qa.md § Fix posture`](../../context/qa.md) scaled to the fix-now
gate — even a 10-minute fix edits the owning component rather than adding a parallel one.

Per accepted fix (or batched in a fix window):

1. Edit in THIS checkout → Vite HMR → the user revalidates in their open tab. On a full reload,
   remind them the boot watchdog may flash on slow transforms.
2. Mechanical proof at QA-Speed depth (validation-pipeline § Partial rungs): path-scoped
   format/lint for style-only edits, `bun run --filter <pkg> test <file>` for behavior, or
   `bun run validation:plan -- --intent qa` when the touched set is broader. Full rungs wait for
   close.
3. Record on the OBS: `fix: <files> · proof: <command → result> · revalidated: yes|no`.
4. Commit per fix: `fix(<pkg>): <what> (qa-session <slug> OBS-NN)`. Commits stay local until
   close.

## Phase 4 — Close

1. **Disposition sweep.** Every OBS must end `fixed | deferred | answered | decision | blocked |
   dropped`. No silent items.
2. **Deferred handoff — deferred items ONLY.** Do not re-implement qa-triage, and do not hand it
   the full session log: qa-triage files every parsed item and does not understand session
   dispositions, so fixed/answered/dropped observations would be re-filed as duplicates.
   Generate `tmp/qa-session/<slug>/deferred-<slug>.md` containing only the OBS entries whose
   disposition is `deferred` (same numbered/typed/verbatim format, exact `case:` IDs), then run
   `/qa-triage tmp/qa-session/<slug>/deferred-<slug>.md --no-codex` — the slugged filename gives
   each handoff its own qa-triage workspace, and the Codex dual-extraction pass exists for messy
   meeting notes; this input is agent-authored and structured. qa-triage's PostHog cross-ref,
   scope lock, Linear templates, and Sheet Defects flow run unchanged. If the user is out of
   time, the handoff command is the named next step in the receipt.
3. **Pull results, then report.** Run `bun run qa:pull --slug <slug>`, then
   `bun run qa:report --slug <slug> --window <walk start>..<walk end>` — the UTC times the walk
   actually began and ended, noted at pre-flight and at close (an OBS span would drop pass-only
   stretches, and an all-pass session has no OBS at all; the slug day is the fallback) — to write
   `tmp/qa-session/<slug>/report.md` — the deterministic core
   every session record shares: results by priority and by kind, the fail/blocked list, coverage
   gaps, standing state, per-tester coverage. Inspect the close-out artifacts under
   `tmp/qa-session/<slug>/`. Apply the result, rollup, severity, and privacy contract in
   [`.claude/context/qa.md`](../../context/qa.md); never transcribe app results by hand.
4. **Decision lock gate.** List all `decision` OBS verbatim and ask: *"Lock which of these as
   design decisions? (numbers / all / none)"*. Locked ones append to
   [`design/decision-log.md`](../design/decision-log.md) as `DL-NNN` rows (`Status: locked`),
   each with a proposed codification target per the ledger's graduation ladder. Small
   codifications may land in the same session; larger ones become deferred items in the handoff.
5. **Receipt — privacy-gated upload.** Write `tmp/qa-session/<slug>/receipt.md`: environment
   header (commit, branch, surfaces, gardens, identities, write boundary), the results-by-priority
   and results-by-kind blocks and the fail/blocked list from `report.md` (never re-counted), OBS
   totals by disposition, fix list (OBS → commit SHA →
   revalidated), deferred list, locked DL IDs, environment notes (watchdog trips,
   dep-optimization reloads, restarts), remaining risk. When the session has a Linear parent (a team call, or a solo session that
   produced slices), show the user the privacy-grepped `report.md` and ask, in one line, whether to attach it to that
   parent as the `QA session <slug> · full report` document per
   [linear-templates.md § Full report document](../qa-triage/linear-templates.md); attach only on
   an explicit yes — this is the one Linear write this skill makes itself, and the review of that
   exact payload is its confirmation gate — then upload the receipt; the receipt and any media go to the restricted Drive QA folder. Apply the text,
   media, destination, and public-repository boundary in
   [`.claude/context/qa.md`](../../context/qa.md). An unresolved
   privacy finding fails closed; do not upload or delete the local evidence.
6. **Ship — only when the session changed the repo.** If the session produced commits, run the
   full `bun run validation:plan -- --intent review` on the accumulated branch, then the
   [`ship`](../ship/SKILL.md) skill for the push/PR decision. A session with no repository
   changes (all-pass, or every observation deferred) has nothing to ship: skip the push/PR path
   entirely — the receipt, results, and handoff complete the session, and `ship` would rightly
   refuse to run on an unchanged `develop`. Delete
   `tmp/qa-session/<slug>/` only after the handoff completed AND every retained artifact
   (receipt, results, screenshots/recordings) is uploaded — deleting first destroys the visual
   proof behind filed defects. Keep the directory for resume on failure or interruption.

## Paired sessions

The QA app supports two paired styles. Choose one in pre-flight and record it in the session header:
**split by surface** for breadth, or **follow one Journey by role** for a connected workflow. The QA
app is the shared record in both. Each tester writes only their own address-owned shard, so
simultaneous recording cannot collide.

### Split by surface

Two people walk different surfaces at the same time, each dictating to their own agent. The OBS log
and fix branch are **per walker**. Divide work by surface and use overlap deliberately rather than by
accident:

- Each tester owns whole surfaces for the session (e.g. one takes PWA, the other Public
  Website). Agree the split in the session header before anyone starts.
- Use the app's *showing* selector to check what your partner has already covered before walking
  something outside your split — the point of the split is to spend the hour on breadth.
- Deliberate overlap is for cases where a second opinion is worth more than a second surface:
  anything previously disputed, anything a decision was locked on, and the smoke path. Recording
  the same case twice is supported and is signal, not duplication.

### Follow one Journey by role

Two people select the same Journey in the QA app. Each selects their own Part while **View** remains
free to show their own, their partner's, or the Overview results. Use two distinct allowlisted
wallets and never exchange identities or role assignments midway through the flow.

- Read the lane's role before starting and verify each wallet can actually hold it. For the service
  relay, **Protocol & review** stays outside both contributor rosters; **Garden & member** is a
  steward and member of the test Garden.
- Follow the phase order. **Act** identifies the person changing state; **Verify** identifies the
  person who must independently observe it. The actor waits at every named handoff.
- Both people may record their own verdict on cases explicitly shared for verification. A known gate
  never records Blocked automatically: attempt the step, name the visible gate when it blocks, then
  continue the remaining non-value steps.
- Preserve the product model in observations: the protocol Request stays in the protocol pool; the
  Garden's member obligation is a separate Garden commitment; a Protocol treasury top-up has no
  commitment ID and is not earned compensation; a starting assessment is context, not a cycle gate.

One agent may guide both people on the same call, or each person may use their own agent. With two
agents, the per-walker OBS logs, branch rules, and collision rule below still apply.

**The section is the unit.** Unlike solo mode's per-observation micro-consent, work is handed
off a slice at a time:

1. Walk a section — one surface, or one `Area` within it. Dictate observations as normal;
   verdicts and short notes go in the app, narrative goes in the OBS log.
2. When the section is done, say so. The agent restates the slice for confirmation: the section
   name, its catalog case IDs, and the OBS items raised in it with proposed dispositions.
3. On the walker's go, the agent works that slice while the walker starts the next section.
   Phase 3's fix rules still bind (≤30 min, ≤3 files, presentation-level blast radius,
   reversible) — the timebox is now per slice, not per observation.
4. The walker revalidates when they return to that section, or at close. Fixes are no longer
   HMR-immediate under the walker's eye, so **the agent states plainly what it could not verify
   itself** rather than implying the walker watched it land.

**Two agents, one codebase — the collision rule.** Each walker's agent works in that walker's own
checkout and produces its own branch and PR. The surface split keeps most fixes disjoint, but
`packages/shared` is common ground and two agents editing it in parallel conflict at merge.
So: **a fix that touches `packages/shared` is not a fix-now in paired mode.** Defer it, name it
in the handoff, and let one agent take it after the session with the other's slice merged. The
same-checkout guard (Phase 0.1) applies per walker — a fix must land in the checkout serving
that walker's ports.

**Close is shared, once.** A single `bun run qa:pull` collects both testers' work; it does not
need running per person. For a team call where walkers recorded app-only, the per-walker
artifacts in this section do **not** apply — with no per-walker agent there is no OBS log,
deferred handoff, or per-walker receipt to produce, and none should be fabricated. That call's
close IS the [`qa-call-report`](../../../docs/routines/qa-call-report.md) routine or
`/qa-triage --call`: it joins the app state with the Meet notes, and the Linear session report
plus slices are the close-out artifacts. Per-walker artifacts remain required only for walks an
agent drove: each agent-driven walker still produces their own OBS log, deferred handoff, and
receipt, because dispositions and fixes are theirs. The decision lock gate (Phase 4.4) runs
**once, together** — a design ruling is not per walker.

## Batch mode (recorded transcript)

Same skill and phases; three deltas:

| Aspect | Live copilot | Batch transcript |
|---|---|---|
| Input | Dictation in-session | `/qa-session <transcript-path>` (any text/markdown transcript; one speaker, no required structure) |
| Consent | Per-item micro-consent | **Scope-lock gate before ANY edit**: parse the full transcript → present the complete OBS list with proposed dispositions → the user locks the fix-now set by number (mirror qa-triage Phase 4 discipline) |
| Verification | User revalidates via HMR | **Reproduce first** per `debug` § user_bug_triage (≤5 min, authenticated Brave, rendered surface before telemetry); after fixing, self-validate via authenticated Brave with screenshots into the session dir; the user revalidates asynchronously at close |

Phase 0 runs without the warm-up-for-dictation step (still warm before reproduction); Phases 3–4
are identical.

## Completion contract

A session is complete when: the receipt is written and uploaded (or explicitly parked), every
OBS carries a terminal disposition, deferred items are handed to qa-triage or named in the
receipt as the next step, the decision gate was asked and answered, and the branch passed the
close-out validation or its failure is recorded in the receipt.

## Anti-patterns

- **Diagnosing aloud mid-walk.** Capture, acknowledge, keep the user moving. Diagnosis depth
  belongs to the fix window or the deferred path.
- **Fixing outside the serving checkout.** A fix the user cannot see is not a live fix.
- **Calling a cold-start fallback a product Blocker.** Reproduce warm first; label environment
  artifacts as such (the defect-writing standard's `QA harness defect` / `Capability blocked`
  labels, naming the harness).
- **Stating sandbox limits as universal.** A capability block names WHICH harness is blocked
  (e.g. an isolated sandbox vs Claude Code with the authenticated Brave profile vs human-only).
- **Letting the timebox slide.** 30 minutes means abandon, revert, defer — the session's value
  is breadth with immediate validation, not one deep rabbit hole.
- **Fixing shared code in a paired session.** Two agents editing `packages/shared` in parallel
  conflict at merge. Defer it and name it in the handoff.

## Related Skills

- [`qa-triage`](../qa-triage/SKILL.md) — downstream owner of deferred items (Linear + Sheet).
- [`debug`](../debug/SKILL.md) — diagnosis protocols borrowed in batch mode and fix windows.
- [`design`](../design/SKILL.md) — decision ledger, defect grammar, interaction contract.
- [`review`](../review/SKILL.md) / [`ship`](../ship/SKILL.md) — close-out gates for the branch.
