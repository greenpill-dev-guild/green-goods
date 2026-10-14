# Flow audit — commitment pooling, from the user's side

Paste this whole file as the opening message of a fresh session. It is self-contained.

---

You are auditing the **experience** of commitment pooling in the Green Goods hi-fi prototypes. Not
the screens. The actions people take, the flows that carry them, and whether moving through those
flows feels clear, focused and worth finishing.

**Audit only. You are not editing anything in this pass.** The deliverable is a written audit and a
ranked set of findings. Building comes later, after the user has chosen what to act on.

## The one rule

**A finding is a sentence about what a person experiences. Never a count.**

Counts may inform your judgement. They are never the finding. "This screen has 79 states" tells the
reader nothing. "A person who has just made a request lands on a screen showing someone else's
offer" tells them everything. If you cannot state a finding as something a person notices, feels, or
gets stuck on, you have not finished thinking about it.

Every finding names: **who** is acting, **where** in the flow, **what they experience**, **why it
breaks**, and **a direction** for fixing it.

## What you are auditing for

Six qualities. Apply them to every step of every flow.

**Orientation.** Do I know where I am, what this is, and why I am here? Did the previous step tell me
what to expect from this one?

**Focus.** Is this step about one thing? If it holds two, do they belong together, or has a second
job been parked here because there was room?

**Decision load.** What am I being asked to decide? Do I have what I need to decide it, right here?
Is the decision mine to make, or is the screen making me choose something the system already knows?

**Density and placement.** Is what is on screen what I need *now* — or is it detail I need later,
detail from earlier, or detail that belongs to someone else entirely? Wrong-place information is
worse than too much information.

**Language.** Does the screen use my words? Would I say this sentence out loud to a neighbour? Does
one thing have two names anywhere in this flow?

**Momentum.** Do I feel I moved forward? Can I see how far I have come and what is left? When I
finish, do I know I have finished, and does it feel like anything?

## What you are auditing

Everything lives in `.plans/active/commitment-pooling/`:

- `hifi/journeys.ts` — the guided flows, exported as `SBS`. **This is your primary source.** Each has
  `id`, `title`, and `steps[]`, where every step is `{ f: screenId, hot: {h,l}, st: stateLabel, ev,
  cite }` — `f` is the frame the person is looking at, `hot.l` is the control they press to move on.
  A flow is a real click path, so you can walk it exactly as a person would.
- `hifi/screens/{client,client-wallet,admin,settlement,funding}.ts` — the screens the steps land on
- `hifi/kit.ts` — the component builders · `hifi/tokens.ts` — the CSS
- `uiux-spec.md` — append-only dated addenda · `plan.todo.md` — the decision log
- Build to view: `bun prototypes-artifact.build.ts` → `/tmp/commitment-pooling-prototypes.html`
- Published: https://claude.ai/code/artifact/19c3dcad-ac1d-4398-bcd4-57d0c892be2c

Read the screen source for what a step actually renders. Do not describe a screen you have not read.

## Part 1 — Map the actions before you audit anything

Do not start from the screen list. Start from what people are trying to do.

Build the map: for each **role** — a gardener offering, a gardener asking, someone taking work up, a
team member helping, a confirmer, a garden steward, a funder — list every **action** they can take,
and the flow that serves it. Group actions by intent, not by surface.

Then mark, for each action:

- Is it a **first-time** action or a **repeat** one? First-time actions carry the teaching burden.
- Is it **initiating** (I start something), **responding** (someone else started it), or **watching**?
- How **often** would a real person do this in a season? A once-a-season action can afford ceremony;
  a weekly one cannot.

This map is the audit's spine. It will immediately show you actions with no flow, flows serving no
action, and two flows doing the same job differently.

## Part 2 — Walk every flow as the person

For each flow in the map, walk it start to finish **in order**, holding only what the person would
know at that point. No jumping to the screen library. No reading ahead.

At each step, write what the person sees and what they must work out. Then apply the six qualities.

Then judge the flow **as a whole**:

- Does it have a beginning, a middle, and an end — or does it just stop?
- Is there a **payoff**? What is the moment this flow exists to deliver, and does the flow build to it?
- Does the ending tell me what happens next, and to whom?
- Where does it leave me, and is that where I would want to be?
- Which step is the one people will abandon at, and why?

Call out the **longest gap between meaningful progress** in each flow — the stretch where the person
is doing setup, not making the thing they came to make.

## Part 3 — Audit the relay, not just the runner

This is the part most easily missed and it matters most here. **A commitment is never one person's.**
One person offers it, another takes it up, a team helps, a confirmer says yes, a steward settles it.
The experience is a relay, and the confusion lives in the handoffs.

Trace **one commitment end to end across every person who touches it**. At each handoff ask:

- Does the person handing off know what happens next, who has it now, and when to expect movement?
- Does the person receiving it understand what they have been given and why it is theirs?
- Does each side see the same object described the same way?
- What does the waiting person see while nothing is happening? Is silence legible, or does it read as
  something broken?
- When the relay stalls, does anyone find out, and can anyone act?

Do the same for the flows where a person acts **on behalf of** someone else — recording for a member
without a device, a garden as provider, a steward confirming as counterparty. Whose name is on it,
and is that legible to both of them?

## Part 4 — Continuity across flows

Audit the flows against each other, not just individually.

- **Parallel actions should feel parallel.** Making an offer and making a request are the same shape
  of act. Do they feel like the same product? Where they diverge, is the divergence earned?
- **The same concept, the same name, everywhere.** List every place one thing has two names, or two
  things share one.
- **Repeated shapes teach.** Does the same kind of step look the same each time it recurs, so that
  learning transfers from the second flow to the third?
- **Entry and exit.** How does a person get into each flow, and where does each flow put them? Do the
  exits of one connect to the entrances of the next thing they would naturally want?
- **The composite journey.** Walk a whole season as one gardener: joining, first offer, doing the
  work, being confirmed, seeing it settle. Is that a coherent story, or a set of unrelated errands?

## Part 5 — Where the arc is, and where it is missing

This is "fun", done as design rather than decoration.

Map the emotional arc of participating in a season. Where should a person feel **anticipation**
(something is about to be mine), **ownership** (this is mine to do), **pride** (I did it and it shows),
**recognition** (someone saw it), and **closure** (it is finished, and it counted)?

Then find where those beats are missing, muted, or in the wrong place — a celebration on a routine
step, or a milestone that passes as a grey row. Name the **single highest moment** in the whole
product and say whether the design currently treats it as one.

Fun here is warmth, momentum and recognition — the pleasure of a garden journal. **It is never**
streaks, leaderboards, points, badges for activity, or confetti on ordinary rows: those are
lint-enforced bans and they violate the regenerative lens. If you reach for a game mechanic you have
mistaken decoration for delight; go back to the milestone and make the milestone land.

## Part 6 — The findings

Rank by **how much felt friction removing it buys**, not by how easy it is to fix. For each:

- Who it hits and where in which flow
- What they experience
- Why it breaks — which of the six qualities fails
- A direction, not a patch. If three findings share a root cause, say so and name the root.

Separate **structural** findings (the flow is shaped wrong) from **local** ones (this step is
cluttered). Structural findings are worth ten local ones and should lead.

Close with the **three changes that would most change how this feels**, and what each costs.

## Grounding

Load the `design` skill before you begin, and use it as the lens rather than as decoration:

- **Paradigm per surface** — Command, Ambient, Data, Conversational, Ritual. Ask what each step *is*.
  A confirmation is a Ritual and should not look like a form. A status view is Ambient and should not
  demand attention. A composer is a Command surface. Mismatches are structural findings.
- **Progressive disclosure** — glance, scan, engage, deep dive. Every dense step should resolve to a
  layer question: what belongs at glance here, and what is being shown too early?
- **The ecosystem lens** (`ecosystem.md`) — cascades, governing versus dependent users, autonomic
  actors. This is the right tool for Part 3. When one person's act lands on another, is the blast
  radius visible before they commit?
- **Inclusive design** — cognitive load, the persona spectrum. Assume a cheap Android phone, patchy
  signal, and someone who has never been taught this. Anything requiring prior instruction is a finding.
- **The regenerative lens** — capability as the deliverable, succession, no growth-hacking.
- **The 4-lens review checklist** on anything you propose rebuilding.

**Surface identities never mix.** Client PWA is a warm garden journal — Inter, full expression, hero
moments live here. Admin is a restrained operator cockpit — quiet, utility copy, legibility under
pressure. Simplifying admin means clearer language and lower decision density, never warming it up.

## Hard limits on what you may propose

- **Simplifying never means hiding a consequence.** Hide the machine — pools, cycles, dispatch,
  acknowledgements, hats, stranding. Never hide what an act does to other people, what cannot be
  undone, or what did not happen during a failure. Removing that to look calmer is a betrayal
  dressed as simplification.
- **The contract wins over UI convenience.** You cannot propose away a reason field the contract
  stores, or invent one it does not. Read `validate.ts`'s CONFIRM and CALL rules before proposing
  anything about a confirmation.
- **Never invent a component.** Proposals map to shipped client and admin primitives; if one is
  missing, say so rather than improvising.
- **Recovery and failure states get quieter, never deleted.**

## What not to do

- Do not open with a table of state counts. Do not organise the audit by screen ID.
- Do not report that something is "complex" without saying what the person is trying to work out.
- Do not propose merging states because there are many. Ask what moment each belongs to.
- Do not describe code or rendered output you have not read.
- Do not edit anything this pass.

## Known leads

Carried from an earlier look. Verify each before relying on it; they are starting points, not findings.

- A person who has just made a **request** lands on a screen wearing the **offer's** identity — the
  chip, the title, and the people row all belong to a different commitment — while the body text and
  the button correctly say request. Both a bug and a symptom worth tracing.
- The commitment view's action bar carries **"See Team and Contributions" on nearly every state**,
  including cancelled, withdrawn, expired and fulfilled. Because it is always there, the bar never
  signals whether the person has anything to do.
- The composer shows **"Cycle: Season of First Rains"** — the machine's word and the product's word
  for the same thing, on screen at once.
- The confirmation flow tells a gardener **"Fulfillment appears only after it syncs on-chain"**, at
  what is plausibly the emotional high point of the product.
- The coverage doc's per-screen registry has drifted from the code on at least five screens. The
  aggregate is gated; the per-screen table is not. Do not trust it as a map.

## Deliverable

One written audit covering Parts 1 to 6, in that order. Prose, not tables of counts. Then stop and
wait — the user chooses what to act on before anything is built.
