# Review prompt — PR #732, commitment pooling prototypes

Paste this whole file as the opening message of a fresh session. It is self-contained.

> **Freshness.** Every number and claim below was re-verified on 2026-08-19 against the tree at
> `6009bc61c`; the only commit since touches this file alone. The verification came after
> the round-54 CodeRabbit response landed. Two things were stale and are corrected: the diff
> statistics and the commit range. **Three claims were wrong and now say so**: the machine-word
> sweep missed a plural, the gallery's file citations are not build-checked at all, and a third
> design token diverges that I had not found. **The Linear statuses in
> the readiness section are the exception** — they were read on 2026-08-18/19 and I could not
> re-query Linear, so re-read the four issues before trusting that table. If you find any other
> number here disagreeing with the build, that is a finding about this prompt and worth reporting.

---

Run **two skills, in this order**:

1. `/review 732` — read the scoping notes below first, because this PR's shape breaks two of its
   defaults.
2. Then load the `design` skill and apply **`design/review-checklist.md`** — the four-lens per-change
   pass — to the visual surfaces this touches.

**Do not pass `--scope design-system`.** That flag narrows the review to cross-boundary design
findings and delegates to `design/system-alignment-review.md`, which is a repo-wide coherence check
over the design skill stack, `theme.css`, `DESIGN.md` and its surface dialects. This PR changes none
of those, and that protocol's own text says not to invoke it for change review. Using it here would
route away from the regression surface below and audit files this PR does not touch.

**Intent: production readiness — of the prototype artifact, not of a runtime release.** This PR
changes no runtime package, contract, ABI or indexer, so runtime release criteria do not apply and a
green CI Gate proves almost nothing here (only `ontology.yml` and `supply-chain-guardrails.yml`
trigger on `.plans/`, and between them they check four spec files this PR does not touch plus
Markdown and JSON formatting). "Ready" means: the two hub gates pass, the drawn screens are honest
about who is reading them and what an act does, and the handoffs are safe to implement against. I
want a merge verdict on that, not an evidence pass, and "the author says it is green" is a claim to
disprove.

---

## Scoping — two things the skill's defaults get wrong here

**1. `.plans/` is not in the package map.** The skill maps scopes to `packages/<name>/**`, `docs/**`
and `.claude/**`. This PR is 13,336 insertions and 3,206 deletions across 40 files, of which
**16,212 changed lines are under `.plans/active/commitment-pooling/`** and 318 are under `.claude/`
(one design-skill file). Auto-inference will find no package. Do not narrow to `.claude/` because that is the only recognised scope — review the
`.plans/` tree as the primary surface and say so in the Summary.

**2. This exceeds 800 LOC by an order of magnitude, so batch it and keep the coverage ledger.**
Suggested batches, in dependency order:

Sizes below are the **full PR diff** (`origin/develop...HEAD`), which is what GitHub shows you.
Where my own two work rounds are a smaller slice, that is given second — `client.ts` is +2986/−1469
across the PR but +870/−333 from `c1f754190`, and the difference is a prior session's prototype
commits, not this work.

| Batch | Files | Why first |
|---|---|---|
| A | `hifi/screens/client.ts` (**+2986 / −1469**; mine: +870 / −333) | The whole risk surface. Everything else is downstream. |
| B | `hifi/screens/client-wallet.ts` (+454/−169), `hifi/kit.ts` (+947/−113), `hifi/components.ts` (+470/−159), `hifi/tokens.ts` (+542/−55), `hifi/screens/index.ts`, `hifi/types.ts` | Shared machinery the batch-A change leans on. `components.ts` and `tokens.ts` are large and were missing from this table until 2026-08-19. |
| C | `hifi/journeys.ts` (+274/−211), `hifi/validate.ts` (+124/−9), `hifi/state-reference.gen.ts` (new), `hifi/frames.ts` (+34) | Flow wiring and the gates. `frames.ts` is a round-54 ordering fix. |
| D | `hifi/screens/admin.ts` (**+1745 / −569**), `settlement.ts` (+421/−128), `funding.ts`, `legacy.ts` (+100/−100), `prototypes-artifact.build.ts` (+111/−44) | Copy sweep, the round-54 contract-modelling fixes, and two build assertions. `admin.ts` is the second-largest file in the PR and mostly predates this session. |
| E | `handoffs/**`, `uiux-spec.md`, `plan.todo.md`, `prototypes-coverage.md`, `architecture-closure*` | Docs, counts, and gate pins |

**Range.** The PR is 46 commits. **Nine are mine**, in order: `c030ef2fa` and `90103b954` (the two
work rounds), `00e0d4b73` (alignment docs), `a6082a860` (first CodeRabbit pass), `1c9bf8c9f`,
`a568a8bd5`, `f1d4fcb34` and `9646e3ad1` (this prompt), and `4aa826684` (the second CodeRabbit pass,
round 54). Only the first four and the last change anything a reviewer needs to judge; the four
prompt commits edit this file. The rest arrived via a `develop` merge (`39e8519eb`) or predate this
session on the branch. Review the full `origin/develop...HEAD` union for the verdict, but when you find something in
the other 37, say so rather than attributing it to this work — three of them are prototype commits by
a prior session and two `settlement.ts` findings from CodeRabbit already sit there unresolved.

---

## What changed, and why

Acting on `.plans/active/commitment-pooling/flow-audit.md` — an experience audit of the hi-fi
prototypes. Two rounds:

**Round A (`c030ef2fa`) — the seat axis.** `W2`, the commitment detail screen, knew what *kind* of
commitment it was rendering and never *who* was reading it, so viewer-dependent presentation was
derived from state-id string prefixes and drifted. The fix declares three axes per state — cast, seat
(provider / confirmer / contributor / bystander), phase — replacing five parallel derivations
(`w2Cast`, `w2Group`, `w2StateChip`, `w2Facts`, and the presentation layer) that disagreed with each
other. Four new states where the audit found seat gaps. Three build-time guards through a new
`HifiDef.errors` channel.

**Round B (`90103b954`) — ceremony, the commitments sheet, three journeys.** Hero moments moved to
the provider, two new rows on `W5`, the wallet made reachable, three new client flows, and a copy
sweep that took every machine word off the client surface.

Then `00e0d4b73` (implementation-alignment docs) and `a6082a860` (CodeRabbit fixes).

## Authoritative requirements

In the skill's order: the PR body on #732; the four Linear issues this is meant to unblock —
**PRD-724** (client), **PRD-725** (admin), **PRD-726** (editorial), **PRD-787** (credit companion),
all under project Commitment Pooling, parent PRD-650; `.plans/active/commitment-pooling/flow-audit.md`
(the findings this answers, pinned to `c1f754190`); `plan.todo.md` Decision Log #68 and register
#157/#158; `uiux-spec.md` C.54 and C.55.

The PR body says `Refs PRD-563`, which is the June maturation issue and **not** the work this
actually serves. Treat the four UI issues above as the requirement baseline and note the mislabelled
reference as a finding.

**Check the audit's findings actually closed** — that is the requirement baseline. Do not take C.54
and C.55 as evidence of themselves; they are my own account of the work.

---

## The gates

Both are local and manual. **Nothing in CI reaches `.plans/`**, so `bun run validation:plan` will not
select them and CI passing on this PR proves almost nothing about the changed surface.

```bash
bun .plans/active/commitment-pooling/prototypes-artifact.build.ts
```
Must print `warnings: 0`, emit no `coverage-doc drift:` lines, and write output. It exits 1 and
**writes nothing** on failure, so read the printed snapshot, never the file's mtime.

```bash
bun .plans/active/commitment-pooling/architecture-closure.validate.ts
```
Must pass. It was red with six failures before this branch; those are fixed here, which is itself
worth verifying rather than trusting.

Expected at HEAD: **44 screens / 517 states / 736 hotspots / 56 flows / 329 scenes**.

---

## Where I would look for regressions

Ordered by where I think risk actually is, not by diff size.

**1. The phase map may be validator-shaped rather than correct.** `W2_PHASE` in `client.ts` declares
each state's contract lifecycle, and `w2Facts` now derives from it. While building it I moved
`support-evidence-queued` from `Active` to `Accepted` **because a CALL rule failed**, and reasoned
afterwards that a queued service proof leaves the commitment Accepted. That reasoning may be right
and the change may still be me satisfying a gate. Check every phase assignment against
`contract-spec.md`, especially the queued/pending states, and treat my comment there as a hypothesis.

**2. Two seat assignments are judgement calls I flagged and made anyway.** `disputed` (and its four
cast siblings) is seated `provider`; it is reached from the confirmer's "not yet", and `sb17` echoes
it to the provider. `support-offered` is seated `bystander` while `offered` on the same direction and
phase is `provider`. Both are argued in the code comments. Decide whether you agree.

**3. Copy rewrites — did any drop a consequence?** Roughly 40 strings changed across bands, banners
and hotspot notes. The rule the prototypes hold themselves to is that simplifying may hide the
machine but never what an act does to other people, what cannot be undone, or what did not happen
during a failure. I rewrote six idempotency bands, nine wrong-person bands, the `W2b@join-submitted`
screen, the `W4` sync banner, and the settled-band family. **Read the before/after of each and check
no consequence left with the jargon.** `git diff c1f754190..HEAD -- hifi/screens/client.ts` is the
place.

**4. Deleting the early return gave three states full bodies.** `active-waiting`, `contributor` and
`send-confirm` previously returned before `w2Disclosures` ran. They now render Garden, Media,
Details, Support, People and Timeline for the first time. I checked two by eye. Check all three
across their casts, and check nothing else regressed from the sections they now pull in.

**5. Two WFLOW states were deleted in `a6082a860`.** `details-linked` and `fulfills-pick` were never
in `WflowState` and rendered the step-1 picker. I concluded they were superseded because the
commitment is chosen at the intro now. Verify that supersession claim against `sb4a` and
`uiux-spec.md` rather than accepting it — if the 2026-08-14 intent still stands, the fix was to
implement them, not remove them.

**6. Journey repoints.** `sb4a`, `sb45`, `sb55`, `sb11`, `sb53` and `sb5` all changed a scene. Walk
each end to end in the built artifact and confirm the flow still tells one person's story.

**7. The guards themselves.** Three checks live in `client.ts` and report through
`HifiDef.errors`. I proved two by deliberately breaking them. **Prove the third** (the band-default
seat guard) and confirm none can be satisfied vacuously — an assertion that never fires is worse
than none.

**8. The round-54 settlement changes are the newest and least walked.** Answering CodeRabbit meant
touching contract modelling in `settlement.ts`, which no journey covers:

- `W26@close-failed` now declares `cycle: "Open"` instead of `"Reconciled"`. Its banner always said
  the close did not land and nothing was locked, so the fact was the thing that was wrong. Confirm
  that against `contract-spec.md` and check `mint-failed` and `compost-failed` are still right at
  `Reconciled` — I decided they were and did not test them the same way.
- Three hotspots gained a `calls` declaration they had always needed: `w26.close-retry`
  (`closeCycle`), `w26.compost-retry` (`compostCycle`), `w24.strand-requeue` (`requeue`). Each
  repeats what its non-retry twin declares. They were exempt from `validateCalls()` before, which is
  how the `close-failed` fact stayed wrong.
- `w24.strand-cancel-subject` now targets `W21@close-delivery-confirm` instead of
  `W21@cancel-queued-confirm`. A stranded subject is `Failed`; the old target declares `Queued`.
  **This changes a drawn destination.** No journey walks it, which is why I was willing to move it —
  check that reasoning.
- The per-screen registry rows in `prototypes-coverage.md` were regenerated wholesale from the
  build. That is 22 rewritten rows plus 3 added; the ids are machine-copied, but confirm the table
  still reads as an inventory a person can use.

The `close-failed` fix is the one to attack. I proved it load-bearing by reverting it and watching
the build fail with `closeCycle forbidden from cycle Reconciled`. Prove the new registry check the
same way — it fires on a wrong count, a wrong id list, and a missing row.

---

## Claims to disprove

I asserted these. Each is checkable and none should be taken on trust.

- "Every machine word left the client surface." **Half true, and I found the gap re-checking this on
  2026-08-19.** Whole-word `on-chain`, `fulfillment`, `indexed`, `transaction`, `threshold`, `syncs`,
  `roster` and `cycle` are all at zero on client screens. The **plural `cycles` is not** — it survives
  in three member-facing strings on `W34`, the ongoing-offer detail: "Kept 12 times across 5 cycles"
  (`client.ts:4441`, `:4498`) and "12 kept · 5 cycles" (`:4343`). I did not fix it, because `W34` is
  an ongoing offer and a cycle there may be a season *or* a campaign, so "5 seasons" could be wrong.
  **Decide what a member should read.** Scan for `cycles`, not `cycle`.
- "25 states carry an act; every one belongs to the seat reading that screen." Re-verified at HEAD:
  82 W2 states, 25 with an act, 0 seat mismatches.
- "13 hero moments, 7 on the provider's side, none a double badge." Re-verified at HEAD: 13 heroes,
  all on client surfaces, no state renders two. Count from the screen registry, not the built HTML —
  the artifact escapes its payload and a naive grep finds one.
- "No terminal state offers to join a team or to withdraw an already-withdrawn commitment."
- "All shipped-component citations in the gallery resolve to a real file and line." **The build does
  not check this.** `GALLERY_ERRORS` validates duplicate ids, missing specimens, missing ship notes,
  where-used resolution and unknown screen ids, and it is empty at HEAD — but `components.ts` never
  touches the filesystem, so no citation is confirmed to point at a real line. 84 `packages/**:NNN`
  citations render, 68 distinct. The prompt said 67 and was never build-backed. Resolve a sample.- The counts in `prototypes-coverage.md`, `architecture-closure.validate.ts` pins, C.54, C.55 and
  register #157/#158 all agree with the build. **This one was false when I first wrote it** and is
  worth re-checking rather than re-reading: the aggregate totals agreed while 19 of 39 per-screen
  registry rows were wrong in both directions and three screens had no row at all. Rows are now
  regenerated from the build and checked per row on every build. Register #158's receipt of 519
  states is superseded by 517 and deliberately left as written.

---

## Known and deliberate — judge, don't just flag

- **`--no-verify` on every push.** The pre-push hook fails on `solhint: command not found`, a missing
  binary in this worktree. Zero `.sol` files changed. Afo authorised the bypass. Judge whether that
  was right.
- **CodeRabbit returned CHANGES_REQUESTED on 2026-08-19 and all ten findings are now answered**
  (round 54, register #159). Five it marked addressed itself in `a6082a8`. Of the rest, four were
  real and are fixed; the four I had skipped in the previous round were re-raised and three of them
  turned out to deserve it. **Do not take my triage on trust — the settlement fixes changed contract
  modelling.** What changed is listed under *Where I would look for regressions* item 8.
- **The plan hub's file-count line is now correct and was worse than I reported.** It claimed 164
  files across five subtrees; there are 170 across six, and `evidence/` (added by PR #727) had never
  been named at all. Root, `handoffs/` and `hifi/` were all short. Fixed rather than left, because an
  index that is half wrong is worse than one that admits it is partial.
- **`selectCommitmentSeat()` is specified, not implemented.** `packages/shared` is Codex's
  `state_api` lane, so `codex-state-api.md` carries a binding amendment instead. The UI cannot be
  built correctly until it lands; that is stated, not hidden.

---

## The design pass — `design/review-checklist.md`, four lenses

Run this **after** the review skill's three passes, as its own section. Full pass, not the quick
one: this adds states to a shipping-bound prototype and moves where a celebration fires.

- **Lens 1, Regenerative.** The sharpest question for this PR. Rounds 52/53 moved the fulfilment
  hero from the confirmer to the provider and rewrote its copy from a counter (*"the season's count
  just grew"*) to a named outcome (*"The north beds are pruned"*). Judge whether that is recognition
  or engagement-shaped. Also: I removed the disclaimer from `W7`'s steward roster while keeping its
  per-person kept/lapsed counts, on Afo's explicit call and against the design agent's
  recommendation. That is a scoring surface with its own guardrail deleted — say whether it holds.
- **Lens 2, Spatial.** Four new `W2` states and two new `W5` rows. Check hit targets, that nothing
  is spatial-only, and that the new seat states degrade honestly — a seat with no act renders **no**
  bar rather than a disabled one, which is a deliberate choice worth confirming.
- **Lens 3, Ecosystem.** The seat axis *is* an ecosystem change: it decides whose screen a person is
  looking at. Check cascade visibility — when one seat's act lands on another, is the blast radius
  named before it commits? The withdraw, cancel, pause and send-for-confirmation confirmations are
  the places to look.
- **Lens 4, Compliance.** ~40 copy strings changed. Check accessible names survived — in particular
  composer step 3, where an unlabelled icon button carrying `ariaLabel: "Continue to review"` became
  a labelled full-width `Continue`; confirm nothing lost its name in that swap.

### The one token question

`DESIGN.md`'s canonical front matter carries 13 colour tokens. **Ten appear verbatim in
`hifi/tokens.ts`. Three do not**, and I had only found two of them when I first wrote this:

- `amber` `#D97706` against the prototype's `--amb` `#B45309`
- `sky` `#3B82F6` against `--sky` `#2563EB`
- `on-tertiary` `#0B4627` **appears nowhere in the prototype at all.** The nearest thing is
  `--on-act` `#04290F` in the dark palette, which is a different value for a role that reads like
  the same one. I did not catch this until re-verifying on 2026-08-19, so it has had no thought put
  into it: decide whether the prototype is missing a token or `DESIGN.md` is naming one the
  prototype expresses differently.

I flagged the first two as a decision rather than resolving them, and the third is new. Confirm the
ten, judge the three, and say which way each should go.

Note this is a *token-value* question, not a projection question — I changed no `theme.css` and no
`DESIGN.md`. If you think it warrants the full cross-surface alignment protocol, say so and run it
as a separate follow-up rather than folding it into this review.

### Surface identity

Check the rule held: hero moments are client-only (13, all client) and the admin cockpit gained no
celebration language. The build enforces the copy half of that; it does not enforce the component
half, so check `hero()` did not reach an admin screen.

---

## Implementation readiness — the four UI issues this unblocks

The point of this PR is that the UI lane can start. Judge that claim against the four issues, all
under project **Commitment Pooling**, parent PRD-650, all assigned to Afo, all past their due date:

| Issue | Status | Points | Blocked by |
|---|---|---|---|
| [PRD-724 UI Client](https://linear.app/greenpill-dev-guild/issue/PRD-724) | **In Progress** since 2026-08-18 | 8 | PRD-789 ✅ · PRD-760 ✅ · **PRD-723** |
| [PRD-725 UI Admin](https://linear.app/greenpill-dev-guild/issue/PRD-725) | Todo | 8 | PRD-789 ✅ · PRD-760 ✅ · **PRD-723** |
| [PRD-726 Editorial](https://linear.app/greenpill-dev-guild/issue/PRD-726) | Todo | 4 | PRD-722 ✅ · PRD-789 ✅ · PRD-760 ✅ · **PRD-723** |
| [PRD-787 Credit companion](https://linear.app/greenpill-dev-guild/issue/PRD-787) | Todo | — | **PRD-786** (State/API credit) |

PRD-789 and PRD-760 are Done; PRD-723 is source-GREEN with runtime availability still fail-closed on
hosted Envio read-back. So the remaining hard blocker is deployment, not design — which is exactly
why the prototype-to-implementation alignment in this PR matters.

### Ask these

1. **Does this PR actually clear the design-side blocking?** `codex-state-api.md` now carries a
   binding seat amendment saying `selectCommitmentSeat()` does not exist and eleven queried fields do
   not reach `CommitmentReadModel`. If that is right, **PRD-724 cannot be built correctly today even
   with PRD-723 source-complete**, and PRD-724 is already In Progress. Verify the gap, and if it
   holds, say plainly that a new state-layer dependency has appeared under a started issue.

2. **PRD-724 says "Preserve **Ask me again next cycle**". This PR renamed it** to "Ask me whether to
   keep offering it", and moved the build assertion that pinned the old phrase
   (`prototypes-artifact.build.ts:831`). My reasoning was that *cycle* is the contract's word leaking
   into member copy, which the same sweep removed everywhere else. The requirement is explicit and I
   did not check it. **Afo's call (2026-08-19): the copy rule wins**, and PRD-724 carries a comment
   recording the amendment and inviting a reversal if the old phrase was deliberate. Verify the
   reasoning holds rather than accepting the resolution — if "cycle" was naming the renewal boundary
   on purpose, the comment says it goes back.

3. **PRD-760's closing checklist contains a vacuous check.** It names
   `bun .plans/active/commitment-pooling/hifi/validate.ts`. That file is a module with **no
   entrypoint**: it exits 0 and prints nothing, so anyone running it as written gets a pass that
   proves nothing. The real gate is `prototypes-artifact.build.ts`, which imports it. PRD-760 is
   closed and unblocking three issues on that checklist. **Recorded on PRD-760 as a comment
   (2026-08-19), not reopened** — its substantive checks were done by hand and the outcome looks
   sound. Confirm that judgement.

4. **PRD-760's other criteria are things this PR could regress.** It required that two screens
   describing the same moment show the same totals, and that detail loading/error/loaded states share
   navigation rules. This PR changed `W2` requirement rows to read `0 of 2` at Accepted where they
   previously read `2 of 2`, and changed which states render the Media section. Re-check those two
   criteria hold.

5. **Vocabulary bans across all four issues.** PRD-724/725/726 forbid `Practice` as a product noun;
   PRD-726 additionally forbids `CommitmentSeries` as a gardener-facing noun and forbids exposing
   rates, ranks, scores, reliability language, or inferred participant counts. PRD-787 forbids a
   personal score, rank, or public borrower directory. This PR **removed** the disclaimer from `W7`'s
   steward roster while keeping per-person kept/lapsed counts. PRD-725 says standing is "context for
   stewardship, never a score or comparison". Judge whether the roster still satisfies that with its
   guardrail removed.

6. **Scope honesty.** PRD-726 requires that later routing, exchange and pricing mechanics are never
   presented as shipped. The exchange screens (W28–W31) remain in the artifact and are marked parked
   with no journey. Confirm nothing in this PR's new copy implies they work.

## What I could not verify

- **No rendered browser proof.** Everything was verified by dumping each state's rendered HTML to
  text and asserting on it. That catches copy, structure and affordances; it catches nothing about
  layout, spacing, contrast, overflow or motion. If a visible-UI claim matters to the verdict, it
  needs the authenticated Brave path and I did not run it.
- **`bun run test` and `bun build` were never run.** The changed tree is `.plans/` only, and no
  package imports it. If the readiness gate says otherwise, run them and tell me I was wrong.

---

## Output

The skill's format: severity-ordered findings, the gap list against the audit's findings, validation
evidence with SHA and timestamp, and a verdict. `REQUEST_CHANGES` is a fine answer. So is telling me
a section of this prompt is itself wrong.
