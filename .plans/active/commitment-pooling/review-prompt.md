# Review prompt — PR #732, commitment pooling prototypes

Paste this whole file as the opening message of a fresh session. It is self-contained.

---

Run `/review 732 --scope design-system` — but read the scoping notes below first, because this
PR's shape breaks two of the skill's defaults.

**Intent: production readiness.** I want a merge verdict, not an evidence pass. Run the full
non-mutating readiness gate, and treat "the author says it is green" as a claim to disprove.

---

## Scoping — two things the skill's defaults get wrong here

**1. `.plans/` is not in the package map.** The skill maps scopes to `packages/<name>/**`, `docs/**`
and `.claude/**`. This PR is 12,913 insertions across 39 files, of which **15,763 changed lines are
under `.plans/active/commitment-pooling/`** and 317 are under `.claude/`. Auto-inference will find no
package. Do not narrow to `.claude/` because that is the only recognised scope — review the
`.plans/` tree as the primary surface and say so in the Summary.

**2. This exceeds 800 LOC by an order of magnitude, so batch it and keep the coverage ledger.**
Suggested batches, in dependency order:

| Batch | Files | Why first |
|---|---|---|
| A | `hifi/screens/client.ts` (**+870 / −333**) | The whole risk surface. Everything else is downstream. |
| B | `hifi/screens/client-wallet.ts`, `hifi/kit.ts`, `hifi/screens/index.ts`, `hifi/types.ts` | Shared machinery the batch-A change leans on |
| C | `hifi/journeys.ts`, `hifi/validate.ts`, `hifi/state-reference.gen.ts` | Flow wiring and the gate itself |
| D | `hifi/screens/admin.ts`, `settlement.ts`, `funding.ts`, `prototypes-artifact.build.ts` | Copy sweep + a moved build assertion |
| E | `handoffs/**`, `uiux-spec.md`, `plan.todo.md`, `prototypes-coverage.md`, `architecture-closure*` | Docs, counts, and gate pins |

**Range.** The PR is 41 commits. **Only four are mine** — `c030ef2fa`, `90103b954`, `00e0d4b73`,
`a6082a860`. The rest arrived via a `develop` merge (`39e8519eb`) or predate this session on the
branch. Review the full `origin/develop...HEAD` union for the verdict, but when you find something in
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

In the skill's order: the PR body on #732; `.plans/active/commitment-pooling/flow-audit.md` (the
findings this is answering, pinned to `c1f754190`); `plan.todo.md` Decision Log #68 and register
#157/#158; `uiux-spec.md` C.54 and C.55. The PR says `Refs PRD-563`.

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

---

## Claims to disprove

I asserted these. Each is checkable and none should be taken on trust.

- "Every machine word left the client surface" — `on-chain`, `fulfillment`, `indexed`, `transaction`,
  `threshold`, `syncs`, `roster`, `cycle` at zero on client screens. Re-run the scan yourself.
- "25 states carry an act; every one belongs to the seat reading that screen."
- "13 hero moments, 7 on the provider's side" — and that none renders a double badge.
- "No terminal state offers to join a team or to withdraw an already-withdrawn commitment."
- "All 67 shipped-component citations in the gallery resolve to a real file and line."
- The counts in `prototypes-coverage.md`, `architecture-closure.validate.ts` pins, C.54, C.55 and
  register #157/#158 all agree with the build.

---

## Known and deliberate — judge, don't just flag

- **`--no-verify` on every push.** The pre-push hook fails on `solhint: command not found`, a missing
  binary in this worktree. Zero `.sol` files changed. Afo authorised the bypass. Judge whether that
  was right.
- **Four CodeRabbit findings skipped**, with reasons in the PR reply: a design-contract contradiction
  in `interaction-patterns.md`, cosmetic em-dashes in a legacy compatibility shim, and two
  `settlement.ts` contract-modelling findings against commits that predate this branch.
- **The plan hub's file-count line still drifts** on subtree numbers I did not touch (`hifi` states
  19, holds 21). I corrected only the two numbers the merge conflicted on and said so in the merge
  commit. Decide if that was the right call.
- **`selectCommitmentSeat()` is specified, not implemented.** `packages/shared` is Codex's
  `state_api` lane, so `codex-state-api.md` carries a binding amendment instead. The UI cannot be
  built correctly until it lands; that is stated, not hidden.

---

## Design-system scope

`--scope design-system` fires here on its own terms: this touches the client and admin dialects and
the editorial surface, and it added a token-mapping section. Delegate to
`design/system-alignment-review.md` and return its sections separately.

The specific question: **the prototype's client palette matches `DESIGN.md`'s canonical front matter
byte-for-byte on ten tokens and diverges on two** — `--amb` `#B45309` against `amber` `#D97706`, and
`--sky` `#2563EB` against `sky` `#3B82F6`. I flagged that as a decision rather than resolving it.
Confirm the ten matches, confirm the two divergences, and say which way they should go.

Also check the surface-identity rule held: hero moments are client-only (13, all client), and the
admin cockpit gained no celebration language.

---

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
