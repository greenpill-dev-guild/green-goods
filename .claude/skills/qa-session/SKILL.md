---
name: qa-session
user-invocable: true
description: Live product-experience QA copilot — the user walks Green Goods flows locally against production data (dev:prod) while dictating observations, or supplies a recorded dictation transcript of such a walk. Captures each observation with a stable OBS ID, triages fix-now vs defer in real time, applies safe fixes in the same running checkout for immediate revalidation, hands deferred items to qa-triage, and locks design decisions at close. Fires on "QA session", "QA walk/walkthrough", "I'll walk the flows and call out issues", "fix live while I test", or a dictated-walk transcript. Not for triaging meeting notes (qa-triage), a single reported bug (debug), or reviewing a diff (review).
argument-hint: "[<transcript-path>] [--surface admin|pwa|ios|android|website|docs|all] [--cases <IDs|area>]"
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
| Retrospective meeting-notes triage, PostHog cross-ref, Linear + Sheet writes | [`qa-triage`](../qa-triage/SKILL.md) (this skill hands off to it) |
| Linear payload templates, label scheme, disposition rules | [`qa-triage/linear-templates.md`](../qa-triage/linear-templates.md) |
| Sheet/workbook schemas, surface vocabulary, severity defaults | [`qa-triage/sheet-schema.md`](../qa-triage/sheet-schema.md) |
| Reproduce-first diagnosis, rendered-DOM-geometry-first UI regression protocol | [`debug`](../debug/SKILL.md) § User-Facing Bug Triage, § User-Observed UI Regression Protocol |
| Casual phrase → `data-component`/`data-region` resolution (admin) | [`design/defect-grammar.md`](../design/defect-grammar.md) |
| Locked design decisions (DL-NNN ledger, graduation ladder) | [`design/decision-log.md`](../design/decision-log.md) |
| In-session fast validation rungs (QA Speed Mode) | [`.claude/context/validation-pipeline.md`](../../context/validation-pipeline.md) § Partial rungs |
| Test-case definitions (the walk checklist) | `scripts/data/qa-test-catalog.json` + `bun run qa:workbook` |
| Journey matrices, receipt fields, defect labels, evidence hierarchy | `docs/docs/builders/quality/product-experience-qa.mdx` |
| Pre-merge gate at close | [`ship`](../ship/SKILL.md) |

## Activation

| Trigger | Action |
|---------|--------|
| `/qa-session` | Live copilot mode: run pre-flight, then capture dictated observations as they arrive |
| `/qa-session <transcript-path>` | Batch mode: ingest a recorded dictation transcript of a completed walk |
| `/qa-session --surface admin` | Scope the session (and the printed walk checklist) to one surface; aliases `admin\|pwa\|ios\|android\|website\|docs\|all` |
| `/qa-session --cases ADM-012,ADM-013` | Scope to specific catalog Test IDs or an `Area` name |
| Prose: "starting a QA session", "I'll walk the app and dictate", "fix these live while I test" | Same as `/qa-session` |

**Boundaries** — route away when:

- The input is **meeting notes** or a past sync's bug list → `qa-triage`.
- A single party **reported one bug** and the job is diagnosis → `debug` (passive).
- The ask is to **review a change or PR** → `review`.
- The ask is design direction or polish guidance without a walkthrough → `design`.

## Mode selection

- **Live copilot** (default): the user is walking now and dictating into the session. Per-item
  micro-consent — the user is watching, so each fix-now proposal is a one-line ask.
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
   not the journey. Both are read-only (writes are no-ops), and both are **loopback-only**: use them
   solely on `localhost`/`127.0.0.1` sessions, never over `dev:tunnel` or any non-loopback URL
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
   identity modes, write boundary, and the in-scope catalog case IDs. The session **stays on the
   current branch** — per `AGENTS.md § Multi-Agent Repo Safety`, never create or switch branches
   without the user explicitly asking for that branch action; branching is decided at the first
   accepted fix (Phase 3), not at session start.
7. **Walk checklist (optional).** Read `scripts/data/qa-test-catalog.json`, print the in-scope
   case IDs + scenarios as the walk checklist (`--surface`/`--cases` filters). A generated
   run sheet (`bun run qa:workbook --local` for local sessions — pre-marks `requiresProduction`
   cases `Blocked`; omit `--local` for production-run sheets) is the durable results artifact;
   the checklist is the in-session view of the same rows.

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
3. **Results rows.** For every catalog case exercised, append to
   `tmp/qa-session/<slug>/results.csv`: `Test ID, Result (Pass|Fail|Blocked|N/A), Severity,
   Notes` — matching the run sheet's result columns (build/commit lives once in the receipt
   header). The user pastes these into the run sheet / Sheet. Results never enter git.
4. **Decision lock gate.** List all `decision` OBS verbatim and ask: *"Lock which of these as
   design decisions? (numbers / all / none)"*. Locked ones append to
   [`design/decision-log.md`](../design/decision-log.md) as `DL-NNN` rows (`Status: locked`),
   each with a proposed codification target per the ledger's graduation ladder. Small
   codifications may land in the same session; larger ones become deferred items in the handoff.
5. **Receipt — privacy-gated upload.** Write `tmp/qa-session/<slug>/receipt.md`: environment
   header (commit, branch, surfaces, gardens, identities, write boundary), catalog cases
   exercised with result counts, OBS totals by disposition, fix list (OBS → commit SHA →
   revalidated), deferred list, locked DL IDs, environment notes (watchdog trips,
   dep-optimization reloads, restarts), remaining risk. Before ANY upload, every artifact
   leaving the machine passes a **media-appropriate** privacy check — the text grep cannot see
   pixels, and Drive access restriction never replaces content inspection:
   - **Text artifacts** (`receipt.md`, `results.csv`, logs): qa-triage's privacy grep (replay
     URLs, session IDs, distinct IDs, `0x` addresses, reporter identifiers) — on a match,
     redact or stop.
   - **Media artifacts** (screenshots, recordings): explicit VISUAL inspection — the agent
     re-opens each captured image and checks its rendered content for wallet addresses,
     session/replay values, or reporter identity, listing anything found for redaction or
     exclusion; media it cannot inspect (e.g. video it cannot review) is named to the user for
     manual review before upload.
   Any artifact with an unresolved finding fails closed — no upload. Then verify the
   destination **Drive QA folder next to the Green Goods v1.1 QA Sheet** is access-restricted
   (not link-public — same check as qa-triage Phase 0) and upload the receipt, results, and
   cleared evidence files there. These artifacts carry per-case results and identities:
   **never commit them to the public repo.**
6. **Ship.** Full `bun run validation:plan -- --intent review` on the accumulated branch, then
   the [`ship`](../ship/SKILL.md) skill for the push/PR decision. Delete
   `tmp/qa-session/<slug>/` only after the handoff completed AND every retained artifact
   (receipt, results, screenshots/recordings) is uploaded — deleting first destroys the visual
   proof behind filed defects. Keep the directory for resume on failure or interruption.

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
- **Writing results into git.** Definitions live in the catalog; results live in the workbook,
  Sheet, and Drive.

## Related Skills

- [`qa-triage`](../qa-triage/SKILL.md) — downstream owner of deferred items (Linear + Sheet).
- [`debug`](../debug/SKILL.md) — diagnosis protocols borrowed in batch mode and fix windows.
- [`design`](../design/SKILL.md) — decision ledger, defect grammar, interaction contract.
- [`review`](../review/SKILL.md) / [`ship`](../ship/SKILL.md) — close-out gates for the branch.
