# Protocol Feature Project — Linear project template

Shape for a Linear **project** description — the internal front door for a bounded
body of work. Companion to `linear-routing-rules.md` (which governs *issues*).
Derived from the Commitment Pooling rewrite, 2026-07-19.

Workspace shape (teams, states, label families) is in `CLAUDE.md § Linear Workspace`.

## The one rule

**A project description does exactly one job: orientation.** Someone opens it cold and
learns what is being built, what ships, and where to go deeper. Everything else has
another home:

| Content | Home | Not the description |
|---|---|---|
| Dates, phases, exit criteria | **Native milestones** | Never a `## Schedule` table |
| Interfaces, storage, permissions, decision gates | **The spec + its architecture issue** | Link, don't restate |
| Operational status ("no fourth garden yet") | **Project status update** | Not overview material |
| Deliverables owned by another project | **That project** | Reference it, don't claim it |

A claim has **one home**; the others link to it. Duplication is not redundancy — it is
guaranteed future drift. Every duplicated block we have audited had already diverged.

## Customer requests (Customer Needs)

**A customer request names the outcome the customer wants — in their language, about their
problem. Not our constraint, deadline, process rule, or open question.**

The test: *if we delivered exactly this, would the customer say "yes, that's what I wanted"?*
If the answer is "well, that's a rule we agreed to follow," it is not a request.

| ✅ A request | ❌ Not a request | What it actually is |
|---|---|---|
| "G$ that reaches people for real work and circulates locally" | "First evaluation is 2026-09-30" | A deadline |
| | "Starting communities are picked jointly" | A process constraint |
| | "Keep settlement capability separate from distribution scaling" | An operating rule |
| | "We need a shared answer on protocol-service compensation" | An open question — ours |
| | "They must confirm the canonical token address before broadcast" | A dependency *we* have on *them* |

Those five are all worth recording. They are just not *wants*, and filing them as requests
buries the one thing the customer is actually buying.

**Shape:**

1. **The want** — one line, their problem in their vocabulary. Name what breaks for them
   without it, not which feature of ours they get.
2. **What "delivered" looks like** — the observable outcome, measurable where possible. If
   there is a spec section defining success, cite it.
3. **Provenance** — a `source` URL where one exists. Where it doesn't, *say so in the body*:
   a second-hand record of a conversation is still useful, but it must not read as a quote.
   Treat "no source and no provenance note" as not ready to file.

**One parent per customer per project, constraints subordinate to it.** Linear needs do not
nest, so say the relationship in the body — otherwise five peer records imply five separate
asks and the reader can't tell which one is the point.

**Never invent attribution.** Our architecture decisions are not the partner's requirements
just because they involve the partner. If nothing records them asking, it is our constraint —
file it on the issue, not on the customer.

## Naming and summary

**Project name** — a short noun phrase naming the thing itself. No version numbers, no phase
suffixes, no verbs. The milestones carry the phase, so the name must not.

| ✅ | ❌ | Why |
|---|---|---|
| `Commitment Pooling` | `Commitment Pooling v1` | Versions belong to releases, not projects |
| `Community Needs & Signals` | `CP Phase 2 — Build` | Phase lives in the milestone |
| `Account Recovery Hardening` | `Ship Account Recovery` | A project is a thing, not a task |

**Summary** (≤255 chars, shown in every project list) — *who* can *do what*, plus the one
distinctive mechanic, in the vocabulary the person using it would recognise. No chain names, no
vendors, no other project's deliverable. If it reads like an architecture caption, rewrite it.

> **Commitment Pooling** — "Per-garden pools where communities name needs, members promise help,
> and the person helped confirms it — with optional G$ rewards settled on Celo."

> **Community Needs & Signals** — "Where community members name what they need and signal what
> matters, with a legible thread from need to promise to proof."

The test: read it to someone who has never seen the project. If their next question is "what
does it *do*?", it has failed.

## Project skeleton — phases and issue taxonomy

For a **protocol feature that ships onchain plus across app surfaces and is validated with
real communities**. Commitment Pooling is the reference implementation of this shape.

### Four phases, four milestones

| Phase | Exit criterion | Dated? |
|---|---|---|
| **1. Scope and Design** | The shape is settled and validated: synthesis, specs, wireframes, prototype, acceptance matrix — someone could build it from these documents alone. Includes any dry run that tests the model on *existing rails* before code exists. | Yes |
| **2. Build** | Implementation GREEN across every lane, in every supported language, with QA complete. No broadcast by default; a dated feature-local non-value exception may authorize one under the gate below. | Yes |
| **3. Release** | Authorized deployment plus one bounded end-to-end proof in production. | **Usually not** |
| **4. Follow On / Hardening** | Evidence-backed promote or defer decisions only. **Authorizes no implementation.** | Yes, far out |

**Why Build and Release are separate.** They fail differently and are gated differently. Build
ends when the code is proven; Release ends when someone with authority accepts the risk of
putting it in front of real users and real funds. Collapsing them produces a date that looks
like a ship date but is really a code-complete date.

**Narrow non-value-tier Build exception.** A dated, feature-local human decision may authorize a
non-custodial, non-transferable tier to broadcast during Build under a lighter evidence gate than
a value-bearing tier. Its handoff still requires the full test suite, deploy dry-run, post-deploy
verification, proven upgrade/rollback path, and separate explicit human authorization. The
exception applies only to the named artifacts and window; agents never inherit broadcast authority
from it. It lapses immediately if custody or transferability is introduced. Commitment Pooling uses
this exception for its pooling module, non-transferable register, and two schemas by July 31; its
value-bearing settlement tier remains gated to Release on or after August 12.

**Why value-tier Release usually has no date.** Its gates are externally owned — an audit you commission,
a timelock that runs, a testnet record that accrues, a partner who confirms. In Commitment
Pooling those govern the August 12 settlement tier: an external audit, a 48-hour mainnet timelock
and a two-week testnet record.
No amount of internal planning shortens them. **Date Release when its gates start, not when you
hope they finish** — an undated Release milestone is more honest than a guessed one, and it
stops the schedule implying a live date the gates cannot support.

**Where a dry run goes.** Its result feeds Scope and Design because it validates rather than
builds, but a dated field rehearsal may remain a separately named **operational checkpoint**
instead of being disguised as a fifth phase or native milestone. Its exit evidence — confirmed
mandates, consent, a named list of implementation gaps — is what Build consumes.

### Issue taxonomy

Two records that are *not* dispatchable work, and must not be treated as such:

* **Architecture contract** — the frozen interface: structs, events, storage, permission
  matrix, test commands. One per project. It is a *reference*, not a task. (CP: PRD-649.)
* **Plan container** — the Linear-visible mirror of the plan hub. (CP: PRD-650.)

Then the actual work, routed by team per `CLAUDE.md § Linear Workspace`:

* **Research** (`RESR`) — synthesis, external brief, use cases, scenario packs.
* **Community** (`COM`) — operator onboarding, surveys, gathering logistics.
* **Product** (`PRD`) — build work, *if* you mirror it (see below).
* **Evidence-gated follow-ons** — designed, parked, explicitly not authorized. Keep them in
  Backlog with no cycle and no due date, and say so in the body.

### The tracking-model decision — make it once, explicitly

**This is the choice that most shapes how the project reads.** Three options, not two:

* **Thin lane mirror** *(default)* — one Linear issue per execution lane, each ~3 lines plus a
  link to its handoff. **Linear owns status, dates, assignee and dependencies; the plan hub owns
  content.** Progress is visible without creating a second content home.
* **Full mirror** — one issue per lane with scope detail in the body. Most visible, and the most
  reliable way to produce drift: two copies of the same scope, diverging quietly.
* **Parent-only** — lanes live only as `handoffs/*.md`; Linear carries the container and
  cross-cutting issues. One home, but a reader of Linear alone cannot see build progress.

Commitment Pooling ran parent-only from 2026-07-05 (an issue-cap constraint) and moved to a thin
lane mirror on 2026-07-20 once the cap lifted. The lesson from that swing: **the failure mode
worth designing against is duplicated content, not issue count.** A thin mirror avoids it; a full
mirror invites it.

Whichever you pick, **state it in the container issue** so the next reader isn't guessing —
parent-only reads like neglect unless it's declared. Commitment Pooling's PRD-650 did this well:

> Keep execution detail, lane truth, and handoffs in `.plans`; this mirror intentionally
> does not create or update lane issues.

And when the choice changes, **record the reversal in the plan hub's decision log**, naming the
entry it supersedes. An un-recorded reversal leaves the next agent reading a rule the workspace
no longer follows.

### Coverage checklist

Whichever model you pick, every area below needs a home — a live issue **or** a named,
dispatchable lane. An area covered by *neither* is the real gap:

`contracts` · `EAS schemas + resolvers` · `indexer` · `shared` (types, hooks, offline jobs) ·
`client` · `admin` · `editorial / public` · `docs` · `QA` · **`release ops`** ·
`settlement / external rails`

The last two are the ones that habitually have no owner. Release ops (broadcast, schema
registration, indexer config, post-broadcast checks) is *human* work that no agent lane
picks up by default.

## Section skeleton

```markdown
## What this is
2–4 paragraphs. What gap this closes and why it matters — in the vocabulary a
gardener or partner would use, not the contract's. Include the lineage or origin
if the work has one; it is usually the most memorable part. End on why it matters
beyond its own surface.

## What ships
Grouped by surface, as bullets. One group per surface, each bullet one deliverable.
Name the onchain layer AND every UI surface — describing only the contracts is the
single most common failure.

**Onchain — <chain>**
* ...

**<App> — <persona> · N actions**
* ...

Close with a one-line aggregate: N screens, N routes, languages.

## Where it stands
2–3 sentences. What is designed vs built vs blocked. Use the evidence vocabulary
(Built / Planned / Reported / Oracle-verified / Evidence-gated). This is what keeps
an aspirational "What ships" honest.

## Dive in
3–6 links, each with a clause on why you'd click it. Prototypes and visual
artifacts first — they orient faster than any spec.

## What this is not
3–5 bullets, each **bolded lead** + one sentence. Only the boundaries that shape
the design. The full register stays in the spec, linked below the list.

## Related
Upstream/downstream projects. State the seam explicitly: what this project owns
versus what the neighbour owns.
```

## Field rules

**`summary`** (≤255 chars, shown in every project list) — what it does for people.
No chain names, no vendor names, no other project's deliverable. If it reads like an
architecture diagram caption, rewrite it.

**`targetDate`** — must equal the last milestone's date. Check after any milestone change.

**Milestone `description`** — 1–3 short paragraphs at *outcome* level: what has to be
true, not the term list of how. Push interface detail to the architecture issue. A
15-term run-on is the same "in the weeds" failure as a bloated description, just
relocated.

**Milestones for completed work** — worth creating. A scoping/design milestone makes a
large body of finished thinking visible; without one, months of work look like nothing
happened. Note it will show 0% unless issues are assigned to it.

## Linear MCP limits (plan around these)

See [[reference-linear-mcp-write-limits]] for detail. In short:

* **No `delete_milestone`** — retiring one needs the web UI. Interim: rewrite its body
  to `RETIRED — pending deletion` so the project stays coherent.
* **No project-level attachments** — every attachment tool requires an `issue`. Put
  links inline in the description instead (usually better anyway).
* **No `sortOrder`** on `save_milestone` — a new milestone lands last regardless of its
  date and may need dragging.
* **Long bold spans get mangled** on save (`**...milestone.**` → `mileston****e.`).
  Keep bold to short spans; verify by read-back.
* **Never hand-copy `<issue id=…>` mention tags** — the UUID wins over the href, so a
  copied tag can silently point at the wrong issue. Plain markdown links only.

## Before you save

1. No `## Schedule` — dates live in milestones only.
2. A cold reader can name three concrete screens and which app each lives in.
3. Every link resolves. For repo links use a `/tree/` URL when files are mid-move;
   check the path exists on `main` first.
4. No sentence claims a deliverable another project owns.
5. No constraint stated that is not canonically in the spec or architecture issue.
6. Vocabulary: evidence labels exact ("Oracle-verified", never bare "verified" for
   settlement); no banned i18n terms (`streak`, `countdown`, `leaderboard`, `FOMO`,
   urgency language) — see `docs/docs/reference/glossary-community.md`.
7. Read the description back via `get_project` after saving — the markdown parser
   mangles some input.
