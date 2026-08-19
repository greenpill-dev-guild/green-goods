# Flow audit — commitment pooling, from the user's side

2026-08-18. Read from `hifi/journeys.ts` (53 flows, 317 scenes) and the screen modules
behind them, with every claim checked against rendered output from a fresh
`bun prototypes-artifact.build.ts` (44 screens, 513 states, 728 hotspots).

The prototypes are further along than this document will make them sound. The
composer is genuinely good. The Hub's confirm queue is one of the clearest triage
surfaces in the repo. `W1C@season-ended` is the warmest screen anyone has drawn
here. What follows is about the seams between those pieces, because that is where
a person actually lives.

---

## Part 1 — The action map

Grouped by what someone is trying to do, not by where it happens.

### A gardener with something to give

**Offer something once** (`sb1`) · **offer a service** (`sb29`) · **offer the same
thing over time** (`sb37`). First-time, initiating, a few times a season. All three
enter at the pool tab's floating create door and run the same four composer beats.
This is the best-served intent in the product.

**Prove you kept it** — with approved garden work (`sb4a`) or with photos and a
voice note (`sb56`). Repeat, initiating, weekly. Two entrances: the Garden tab's
work flow, and the commitments sheet. That split is correct — proving with work is
a work submission that happens to name a commitment; proving a service is a
commitment action that happens to carry media.

**Change your mind** — withdraw before anyone takes it up (`sb16`), offer it again
after it lapsed (`sb6a`). Rare, initiating.

**Add people to your team** (`sb54`). Occasional, initiating, lead only.

### A gardener who needs something

**Ask for help or a service** (`sb2`, walked as a steward) · **ask for garden
work** (`sb51`). First-time, initiating, a few times a season.

**Confirm what arrived** (`sb42`) or **say not yet** (`sb5`). Repeat, responding,
weekly. Both enter from the commitments sheet.

There is no flow for withdrawing a request. `W2_BARS` draws the button —
"Withdraw This Request…" — and `withdraw-confirm` is in the validator's
reason-taking set, so the act exists. Nobody walks it.

### A neighbour picking something up

**Take up an offer** (`sb55`) · **help with what was requested** (`sb43`) · **join
a forming team** (`sb45`). First-time, responding, weekly. All three start by
opening the card, which is right: the card carries no act, so you read the terms
before you decide.

### Money

**Watch G$ support arrive** (`sb11`) · **send it on** (`sb53`) · **fund somebody
else's priced offer** (`sb58`). Mostly watching. `sb18` ("find everything waiting
on you") sits in this chapter too and is not about money at all — it is the inbox.

### A steward running the garden

Setting up and opening the first season (`sb9a`), pausing and resuming (`sb9b`),
ending a season (`sb9c`), retiring the pool (`sb9d`), cancelling a season
(`sb9e`), starting a campaign (`sb20`), and the phone presentation of all of it
(`sb60`). Once-a-season acts that can afford ceremony, and mostly get the right
amount.

Deciding who takes up a scarce opening (`sb3b`), approving work (`sb4b`),
re-seeding what lapsed (`sb6b`), recovering something stalled (`sb17`), resolving
a "not yet" (`sb47`). Weekly, responding. This is the steward's real job and it is
spread across three surfaces — the Hub's confirm queue, the pool workspace list,
and the commitment dialog.

Recording for a member without a device (`sb8`) and confirming on their behalf
(`sb8b`). Occasional, and the highest-stakes act in the product for accountability.

### An evaluator

The garden's starting assessment (`sb22`) and the season's closing one (`sb50`).
Twice a season. Both enter from the Hub's Assess stage. Clean.

### Green Goods operations and settlement

Nine flows (`sb12`, `sb19`, `sb21`, `sb23`, `sb24`, `sb25`, `sb31`, `sb33`,
`sb34`, `sb46`, `sb49`, `sb59`). Protocol-team-only, correctly collapsed in the
catalog.

### What the map shows immediately

**Nobody arrives.** The client catalog begins at "Make an offer", which assumes you
are already a member, the pool is already open, and you already know what a
commitment is. The one screen that explains the idea — "Start the first one, offer
something you can give, or ask for help you need" — is `W1@empty-open`, one of
thirty-three pool states, and the only one where it appears. Every other member
sees a carousel of counts.

**Nobody leaves.** No client flow ends at a finished season. `W1C@season-ended` —
"What this season grew · 48 hours kept · 9 gardeners · 12 rides · 22 of 26
commitments kept · the reserve: 90 G$ went to 7 gardeners" — is reachable only as
a branch link from the *steward's* close-season flow.

**Withdrawing a request has an act and no flow**, while withdrawing an offer has
both.

---

## Part 2 — Walking the flows

### Make an offer (`sb1`) — eight steps

The floating door, then two verbs, then four composer steps, then the queued card.

Step 1 is well-shaped: what kind, how often, where it runs, and a title the garden
suggests. "Seasons and campaigns both hold commitments" is the right sentence in
the right place.

**Step 2 is two jobs and the screen knows it.** You pick an amount ("6 hours") and
then a set of garden actions with counts ("Prune × 2, Plant × 12"). The numbers do
not relate, and the interface has to say so twice — once on the step ("These are a
different measure from the amount above: the amount is what you are putting in,
these are what stewards must approve before it counts as kept") and again on the
review ("This is a different measure from the amount"). When a screen explains that
two things on it are different, they are competing for the same slot. **This is the
longest gap between meaningful progress in the flow** and the step people will
abandon at.

**Step 3's only way forward is an unlabelled arrow.** Every other step in the
composer says "Continue". Step 3 — the entirely optional one, where a person with
nothing to add most needs a clear exit — renders
`btn("", { icon: "arrow-right-s-line" })` at the end of a bar carrying five capture
adders. The design note explains the squeeze honestly; the outcome is that the
optional step is the one with no word on its next action.

Step 4 is excellent. The act is disabled until you reach the end, and the disabled
arrival is drawn as its own state. This is the single best piece of interaction
design in the client set.

The ending is right: the queued card on the pool tab, the sync bar counting it,
two branches naming who acts next. Maria's sitting ends where her part ends.

### Make a request (`sb2`, `sb51`) — the mirror that isn't

Same door, same four beats, and then five divergences that were not decided, they
accumulated:

The read-to-the-end gate exists on the offer review only. The code comment says
"the rule is the same on all six"; the artifact draws it on one. In the prototype,
an offer requires reading and a request does not.

The offer flow ends at Queued. Both request flows run one step further, to Open.
Two matched doors, two different endings.

The offer review names the fallback ("If nobody local is eligible, the Green Goods
team can step in"). The request review does not name what happens if the requester
goes silent — which is the request's equivalent risk, and it lands on the helper,
not the requester.

Requests carry no team step.

And `sb2` ends on `W1@request-open`, where the request David just made is by-lined
**"Ana · 1 ride"**. He is looking at his own ask under someone else's name.

### Take up an offer (`sb55`) — three steps

The shortest flow and one of the best. Card opens the commitment, terms and people
and proof rules are on screen, one act in the fixed bar, and the ending names both
next acts. Nothing to fix.

### Prove it with work (`sb4a`) — seven steps, wrong ending

The Garden tab intro opening with your commitments is right. Media, details,
review, submit — the shipped rhythm. Approvals land as visible progress per
requirement.

Then the flow ends on `W2@ready-confirmer`, which reads: *"Ready to confirm. You
were named to confirm this commitment. Maria, who made it, cannot."* — with
"Confirm: Commitment Kept" in the bar. **The provider's flow ends by showing the
provider a button they are forbidden from pressing, above a sentence explaining
that they are forbidden.**

`W4` already solved this — it has a `provider-view` state whose note says the
provider's question is "where has this got to?", not "may I confirm?". `W2` has no
provider-side ready state at all; the offer cast has `ready-confirmer` and nothing
else, while the request, service and captured casts each have a `-ready-pending`.

### Confirm a commitment kept (`sb42`) — four steps, and the payoff lands wrong

Inbox row, confirmation sheet, queued, fulfilled.

The sheet is good. It names the eligibility path before the act ("Only the person
it was made to can confirm it. Everyone who contributed is excluded"), and cycle
banners never block confirming.

Then you tap Confirm and land on **"Your confirmation is counted on this device.
Fulfillment appears only after it syncs on-chain."** Two machine words in one
sentence, at what is plausibly the emotional high point of the product. It renders
on all six `confirmed-pending` casts. The sheet header underneath adds "It cannot
be confirmed twice while it syncs" — idempotency offered as reassurance to
somebody who never worried about it.

### Say "not yet" (`sb5`) — four steps, then silence

Well-built. The reason chips fill a still-required field; "This never cancels the
commitment" is exactly the right sentence; the ceiling is "under review by
stewards" and the word dispute never reaches the member.

It ends at `W2@disputed` and **the member never hears anything again.** There is no
row in the commitments sheet for a commitment under review, so the only way to
check is to remember the commitment and open it. The state is also filed in the
switcher under "How it ended" — it has not ended, it is frozen mid-flight.

### Fund a priced offer (`sb58`) — six steps, three of them waiting

Maria acts twice: she files the claim, and she sends 40 G$. The other four screens
are waits, two of them on a Garden Steward, with no time expectation, no way to
nudge, and no way to take it back. The contract has no member-side withdraw, so
that is not a UI gap to be fixed by inventing an exit — but the wait is currently
unnamed, and `W36@deposit-sent` says nothing about what happens if the steward
never records it.

Every one of the five states carries the same four-row block: Garden Safe
`0x8a…2d`, Refund account `0x12…9a`, Record `F-204`, Commitment `0x8c…41f2`.
Always open, never changing, on a warm-earth surface, for a neighbour funding a
poster. The client's own rule (`client.ts` header, from `wireframes.md:166`) is
identifiers behind a single Details disclosure. `W2` follows it. `W36` does not.

### Watch G$ support arrive (`sb11`) / send support on (`sb53`)

`sb11` is five scenes and the person does nothing in four of them. `sb53` opens on
a screen with no drawn route to the wallet. Both start at `W5` — and **no state of
`W5` mentions money at all.** `sb11`'s own premise ("the wallet is where you notice
them") is not drawn anywhere.

### The steward's flows

`sb9a` (set up and open) is a model: five steps of plain language, then one write
moment that submits six contract calls and says in words what opens. `sb9b`
(pause/resume) names the blast radius — 23 members, 7 open commitments — before
anything pauses. `sb9c`/`sb9d`/`sb9e` split three endings into three sittings,
correctly.

`sb3b` (decide who takes up) is the sharpest ecosystem work in the set: the
decline confirmation names what it does *not* touch, and both members' echoes are
shown inline.

`sb17` (recover a stalled commitment) is nine scenes carrying three unrelated
exits — mark ready, cancel, raise review — with the member echo after each. It
reads as a reference sheet, not a sitting. A steward arrives at it with one
situation, not three.

`sb12` is fifteen scenes; `sb19` thirteen. Both are protocol-team release proof and
are correctly collapsed. They are not journeys and should not pretend to be.

---

## Part 3 — The relay

One commitment, end to end: Maria offers → João takes it up → Maria proves it →
the steward approves the work → João confirms → the garden pays the team.

**Maria → João** is the strongest handoff. Her flow ends naming him; his flow
begins with her card and ends naming both next acts.

**João → Maria (accepted).** The moment Maria's offer finds a person — the whole
point of making it — reaches her as a row inside a folded disclosure:
`Timeline · 4 moments · Accepted · João took this up · Jul 3`. Meanwhile the state
she lands on, `W2@accepted`, contradicts itself: the band says "Keep the commitment
moving. Add proof as you go", the progress block already shows "Prune 2 of 2 ·
Plant 8 of 12", the work section shows an approval dated five days after
acceptance, and the timeline's last row says "Ready to confirm · waiting on João".
Four different points in time on one screen.

**Maria → steward → Maria.** Clean. `sb4b` counts one approval against the exact
requirement row and records the reason for the rejection.

**Provider → confirmer.** Broken at the seam described above: the provider's flow
ends inside the confirmer's screen.

**Confirmer → everyone.** Also the point where the ceremony goes to the wrong seat
(Part 5).

**Member → steward, on a "not yet".** The steward's side is well drawn — the Hub
queue carries the under-review row labelled "Needs You", and `sb47` restores the
exact pre-dispute state with the reason on the timeline. The member's side has
nowhere to watch. Silence here reads as broken because there is no surface where
waiting is legible.

**Helper → requester.** The helper takes on the risk that the requester never
confirms. `W2@browse-requested` names Ana as the confirmer, which is right, and
never mentions that a recovery path exists. `sb17` is that path. The person who
carries the risk is not told the safety net exists.

### Acting on behalf of someone

`sb8` is careful and correct: `CommitmentCreated(creator = member, recordedBy =
steward)`, and the member's screen carries "Recorded by your steward on your
behalf. The commitment stays yours."

`sb8b` — the steward confirming for a member who has no phone — is the highest
-stakes accountability moment in the product, and **the drawn screen contradicts
the flow.** The step is labelled "Fulfilled — steward fallback" and its note claims
"the member timeline reads *confirmed by garden steward — fallback* with the
reason". `W2@captured-fulfilled`'s timeline actually reads **"Commitment kept ·
confirmed by João · Jul 6"**. David's name is nowhere. The same screen tells Kwame
"The captured commitment was confirmed after its proof synced" — the machine's word
for what the client calls *recorded*, and a sync detail, on the one screen where
whose-name-is-on-it is the entire question.

`W2` has no fallback-confirmed captured state. It needs one.

### The waiting person

`W2b@join-submitted` is what somebody sees after tapping "Join this commitment":
*"Joining… Your transaction went through. Waiting for the roster to catch up…
This screen shows you as a member only once the indexed roster contains your
account. A missing or stale result stays here."* with a "Check Again" button. The
person asked "am I on the team?" and got a paragraph about indexer freshness.

---

## Part 4 — Continuity across flows

**Parallel acts do not feel parallel.** Offer and request are the same shape of act
and diverge in five unearned ways (Part 2). None of the divergences is wrong on its
own; together they mean the two doors lead into two different products.

**One thing with two names.** *Cycle* and *season*: the composer's saved-offer path
labels the field "Cycle" and the review row "Cycle: Season of First Rains"; the
ongoing review carries a control called "Ask me again next cycle"; the admin close
wizard is titled "Close the season" over a rail whose steps read "close the cycle's
exact bundle" and "roll the cycle up into pool history". *Recorded* and *captured*:
the client says "Recorded by your steward" on one screen and "The captured
commitment" on another. *Fulfilled* and *kept*: the state chip says Fulfilled, the
band says Commitment kept, the timeline says Commitment kept.

**One name for two things.** *Support* means both the G$ money ("support arrived",
"support on its way") and the kind of commitment ("Support / service"). They appear
on the same screen: `W2@support-fulfilled` carries the chip "Support / service" and
the state family that follows it is `support-queued → support-en-route →
support-arrived`, which is money. The state namespace has the same collision.

**Repeated shapes mostly teach well.** The four-beat composer, the media/details/
review capture rhythm, the fixed bottom bar carrying one act — these recur
faithfully and learning does transfer. The exception is the review step: five of
six review states let you submit from the top.

**Entry and exit.** Three entrances (pool tab, Garden tab, commitments sheet) and
they are the right three. The exits are where it thins: six client flows open on a
screen where nothing is clickable, and the two money flows open on a screen that
never mentions money.

**The composite season.** Walk it as one gardener: you arrive with no explanation,
make an offer, watch it get taken up in a folded timeline row, prove it, get a grey
band when it is confirmed, and the season ends without you being told. The parts
are good. The story has no beginning and no end.

---

## Part 5 — The arc

The beats participation should have:

**Anticipation** — my offer is live and someone might take it. Currently: a queued
card, then nothing. The pool tab does not tell you your offer is being looked at.

**Ownership** — somebody took it up; this is mine to do now. Currently: a timeline
row inside a folded disclosure, on a screen that simultaneously says four different
things about where the commitment stands. **This is the missing beat that costs the
most.**

**Pride** — I did it and it shows. Currently: the proof-submitted state, which
reads "Not sent yet. This is waiting on you". Correct, and joyless.

**Recognition** — someone saw it. This is the beat the product exists for, and it
is misplaced. There are exactly **nine hero moments in 513 states**. Six are on
`W4`, the *confirmer's* sheet. Three are on `W2` fulfilled states — and the three
are the edge casts: service, campaign request, and steward-recorded. The two main
paths, an ordinary offer kept and an ordinary request met, get a plain FormInfo
band above a details list.

So: the person who tapped Confirm gets a full-screen halo, every time. The person
who spent six hours pruning gets a grey band — unless their commitment happened to
be a service, in which case they get the halo too. **The ceremony is awarded for
the two-tap act, not the six-hour one, and inconsistently even then.**

The hero copy is also thin. "Confirmed · the season's count just grew" is a counter
going up. It is the payoff line for the entire product.

**Closure** — it is finished and it counted. `W1C@season-ended` does this
beautifully: "What this season grew · 48 hours kept · 9 gardeners · 12 rides ·
4 gardeners · 22 of 26 commitments kept · The reserve: 90 G$ went to 7 gardeners."
Units in their own terms, people named as counts not ranks, no score. **No client
flow ends there.** It is reachable only from the steward's close-season branch.

**The single highest moment in the product** is a commitment being kept and
confirmed. The design currently treats it as two different moments for two people,
gives the ceremony to the lighter act, and skips it entirely on the most common
path.

One thing to keep: none of this needs a game mechanic. The season-end screen
already proves the register works. The fix is moving the existing warmth to where
the effort was, not adding more of it.

---

## Part 6 — Findings, ranked by felt friction removed

### Structural

**1. The commitment view does not know who is looking at it.**
Who: everyone, on `W2`, the most-visited screen in the product.
`w2Cast()` derives what kind of commitment this is from the state id, and there is
no equivalent notion of *seat* — creator, provider, confirmer, contributor,
bystander. Everything seat-dependent is therefore derived from the state id too,
and drifts. Verified consequences:

- `W2@requested` — a person's own request — renders the offer's title ("Prune the
  north beds"), the Offer chip, AGRO, "6 hours · due Aug 12", the people row "Maria
  offers / João takes it up", and a progress block reading "Prune 2 of 2 · Plant 8
  of 12" on a commitment nobody has taken up. The band, the timeline verb and the
  button correctly say request. The cause is a one-line seam: `w2Group()`
  special-cases `id === "requested"`, `w2Cast()` does not, so it falls through to
  the `offer` default.
- `W2@browse-requested-gated` shows "João provides" and "2 items · credits Maria"
  to a neighbour deciding whether to ask for it — the `browse` flag tests for
  `browse-requested-steward`, a state id that does not exist.
- The People card lists "Maria · Accountable lead" and "Ana · Kwame · Contributors"
  on every browse state, directly below "Nobody has taken it up yet".
- "If you change your mind — you can withdraw it while nobody has taken it up"
  renders on somebody else's commitment, and on an already-withdrawn one.
- "Open team, anyone eligible may join" renders on withdrawn, cancelled and expired
  commitments.
- The provider's flow (`sb4a`) ends on `W2@ready-confirmer`, which tells the
  provider "You were named to confirm this commitment" and offers the button.

Fails: orientation, and honesty. Direction: make seat a first-class input to the
view alongside cast, and derive the people row, the consequence copy, the progress
block and the bar from it. `W4@provider-view` is the pattern that already exists;
`W2` needs its equivalent.

**2. The ceremony is on the wrong person, and missing on the main path.**
Who: every provider, at fulfilment. Nine heroes in 513 states, six of them on the
confirmer's sheet, none on `W2@fulfilled` or `W2@request-fulfilled`. The provider's
kept commitment is a grey band above Details / Support / People / Timeline.
Fails: momentum, and the regenerative lens' own claim that capability is the
deliverable. Direction: give the fulfilled state its hero on the provider's seat —
this is where finding 1 pays off — and make the copy name the work rather than the
counter. Keep `W4`'s hero for the confirmer; both people did something.

**3. The commitments sheet is missing the two things people wait on.**
Who: anyone owed money, anyone under steward review. `W5` — the client's "what is
happening to me" home, correctly split out of the wallet — carries no money row and
no under-review row across all nineteen of its states. Three flows (`sb11`, `sb53`,
`sb5`) hand off into that gap; two of them open on `W5` and cannot move without the
player skipping.
Fails: orientation, momentum. Direction: Live gains two row kinds — "support on its
way / arrived", and "under review by stewards, nothing for you to do". Both are
already-drawn states looking for a home.

**4. The two creation doors lead into two different products.**
Who: anyone who does both, which is everyone, eventually. Read-to-the-end on offers
only; requests run one scene further to Open; no team step on requests; the offer
review names the fallback confirmer and the request review names no equivalent
risk; withdrawing a request has a button and no flow; `sb2`'s requester lands on a
card by-lined to somebody else.
Fails: language, decision load. Direction: decide the divergences deliberately —
some are earned (an ask has no team to bring) and some are drift (the review gate).
Write them down as a matched pair.

**5. The on-behalf-of relay's accountability line is not drawn.**
Who: Kwame and David, at the moment it matters most. `sb8b` claims the timeline
reads "confirmed by garden steward — fallback"; the drawn `W2@captured-fulfilled`
reads "confirmed by João", and tells Kwame "the captured commitment was confirmed
after its proof synced".
Fails: honesty, language. Direction: `W2` needs a fallback-confirmed captured
state naming the steward and carrying the required reason. This is not
simplification territory — it is the one case where whose-name is the whole
content.

**6. The funder waits on three people and can reach none of them.**
Who: Maria, holding 40 G$ in somebody else's Safe. Five states, two acts, three
unbounded waits, no time expectation, no nudge, no member-side exit — and the
contract has none to expose, so the honest fix is naming the wait, not inventing
one. Four identifier rows pinned open on all five states, against the client's own
disclosure rule.
Fails: orientation, density. Direction: say who has it, what they are checking, and
what happens if nothing happens. Fold the record identifiers into Details.

### Local

7. **"Fulfillment appears only after it syncs on-chain"** on all six
   `W4@confirmed-pending` states — the sentence a person reads at the highest
   moment in the flow.
8. **"It cannot be confirmed twice while it syncs"** and its four siblings across
   `W2` — idempotency reassurance for an anxiety nobody has.
9. **`W2b@join-submitted`** — "Your transaction went through. Waiting for the
   roster to catch up… only once the indexed roster contains your account. A
   missing or stale result stays here." Five machine words on a screen whose one
   question is "am I on the team?".
10. **Composer step 3's Continue is an unlabelled arrow** — the only step in the
    flow with no word on its next action, and the only optional one.
11. **Composer step 2 holds two numbers that do not relate**, and explains the
    difference twice — once on the step, once on the review. Longest stretch of
    setup in the creation flow.
12. **"Cycle" leaks into member copy** on the saved-offer path (field label and
    review row) and in "Ask me again next cycle"; the admin close wizard mixes
    *cycle* and *season* on one rail.
13. **The teaching sentence lives only on the empty pool.** "Offer something you
    can give, or ask for help you need" appears on 1 of 33 `W1` states. The admin
    workspace carries a plain-language description of the pool; the member's own
    pool tab does not.
14. **`W7`'s roster is a per-person kept/lapsed scorecard** ("Maria · 4 kept · 1
    lapsed · 2 received · carrying 1 open") under a caption saying "never a score
    or a ranking". If it needs the disclaimer, the presentation is arguing with the
    intent.
15. **`W10@resolve-dispute`'s gate explanation is 44 words** of "connected steward
    address", "contributor roster", "policy and verified-credit gates". Admin
    should be terse, not machine-shaped: "You can't mark this kept — you're on the
    team."
16. **`W2@disputed` is filed under "How it ended"** in the state switcher. It has
    not ended.
17. **"Support" names both the money and the kind of commitment**, on the same
    screens and in the same state namespace.
18. **"threshold 1 of 2 named"** as option meta in the client's confirmer picker.

Findings 1, 4 and part of 5 share a root: **the artifact encodes lifecycle, kind
and seat into a single flat state id, and then derives presentation from string
prefixes.** That is why a missing set membership silently renders another
commitment's identity, and why a typo in one flag name shows a neighbour a team
that does not exist. Findings 7–9 and 12 share a smaller root: pre-sync and
indexer latency are being explained rather than absorbed.

---

## The three changes that would most change how this feels

**Give the commitment view a seat.** One input, threaded through the people row,
the consequence copy, the progress block and the action bar. It closes finding 1
outright, most of 5, and it is the precondition for 2. Cost: a real refactor of
`w2()` — the state list stays, the derivation changes. Highest value in the audit
and not a small edit.

**Move the ceremony to the person who kept the commitment, and give the client a
season ending.** Hero on the provider's fulfilled state, copy that names the work
instead of the counter, and a client flow that ends at `W1C@season-ended`. Cost:
low — both surfaces exist, one is used on three of six casts and the other is
walked by nobody. This is the change that most alters how the product *feels* per
unit of work.

**Put money and steward review into the commitments sheet.** Two row kinds in Live.
It gives `sb11` and `sb53` a real first step, gives `sb5` somewhere to land, and
makes the sheet honestly what its subtitle already claims. Cost: low to moderate —
new rows, no new screens.

---

*Audit only. Nothing in the prototypes was edited.*
