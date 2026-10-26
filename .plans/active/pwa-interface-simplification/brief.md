# PWA Interface Simplification

**Stage:** active · **Posture:** scope locked on 18 October 2026, completed by the 19 October review and extended on 20 October, with the lab's picks taken late that day and the design rounds closed on 21 October; execution authorized on 24 October 2026

**Linear:** [RESR-93](https://linear.app/greenpill-dev-guild/issue/RESR-93) in
[Green Goods 2.1.0](https://linear.app/greenpill-dev-guild/project/green-goods-v210-qa-and-release-9bcaf982d5e5).
PRD-1260 owns the PWA delivery, PRD-1261 the bounded paired PWA/admin cohesion slice, PRD-1262
release acceptance, and PRD-1278 the shared garden chip's look in the app. The 15 October four-goal
alignment connects this scope to Cosmo-Local, the pitch and the public Q4 strategy; that record
stays with the Cosmo-Local hub and its Linear project.

Make Home feel like the member's garden, with a short view of what happened, what needs their
attention, and how they can participate. Keep the familiar Home / Garden / Profile navigation,
one-tap app sheets, and Warm Earth design language.

## Why this work

Today, Home starts with a garden directory. Members enter a garden card to reach its activity and
other sections. Personal sheets live in the header, while garden actions also appear on the banner.
These are useful capabilities, but their placement asks returning members to navigate the app's
structure before getting back to their community or work.

This hub captures the product direction from the PWA design discussion and, since 18 October, the
locked scope. It does not replace the domain and integration decisions in other hubs.

## Confirmed direction

1. **Start in a garden.** With no joined gardens, retain discovery and request-to-join. With one,
   open that garden; with several, offer a top switcher and retain the selected context.
2. **Order Home by relevance:** recent activity, unfinished work, then opportunities to participate.
   Use selective previews so the page stays light.
3. **Keep one-tap sheets.** Wallet, Promises, and Your Work remain familiar shortcuts; sheets hold
   deeper details and actions. Preserve the three bottom navigation destinations.
4. **Carry the garden into submission.** Opening Garden from a selected garden should not ask the
   member to choose that garden again. Resuming a draft must preserve its own context.
5. **Evolve the existing interface.** Explore a revised homepage rather than making the current
   garden detail page the final home unchanged. Resolve the competing header and banner controls.

## Locked scope (18 October 2026)

The maintainer locked these after the findings and the lab recorded in
[spec.md](spec.md#decisions-locked-on-18-october-2026).

1. **Selection is implicit.** One garden opens itself. Several open the last garden used on this
   device. Several with nothing remembered open the switcher once; dismissing it leaves a quiet
   prompt on Home.
2. **A garden is "mine"** when the account is a gardener, steward, owner or evaluator in it. A
   pending request shows as awaiting review in the switcher and in Explore. A depositor reaches
   Endowment from the garden page and has no place in the switcher.
3. **Home is the compact journal:** recent activity, then Continue, then Take part, then one About
   row. Featured activity and the promoted garden page stay as lab variants.
4. **Promises and Your Work open scoped to the active garden** and show nothing from other
   gardens; their badges count the active garden too (revised on 19 October, when the widening row
   was removed).
5. **About and management** sit in one About row at the end of Home for now, reviewed after the
   first slice. Steward duties surface in a Needs Your Attention section above Recent Activity,
   only when something waits (decisions 22 to 24 and 27 replaced the earlier placement in
   Continue); evaluators have no Home duties, since the phone has no assessment flow.
6. **Visiting never switches.** A garden opened by link, from Explore or from a row is a visit.
   Only the chip changes the active garden, among the member's gardens or through Explore gardens,
   where any garden can be viewed and requested.
7. **Two delivery slices:** context, chip, discovery and Submit Work preselection first; the
   journal sections and the scoped sheets second.
8. **The active garden is a device preference** per chain and account in a Shared store. It is
   never account state and never written on-chain or to the agent.

## Review round (19 October 2026)

The maintainer reviewed the lab against the lock and the unification picks. Nine corrections are
settled and recorded in [spec.md](spec.md#review-round-on-19-october-2026): the garden's banner on
cards, chip, switcher rows and the pinned Work-for card; one tag on a card's photo and cards of one
height; the family test gardens shown only to members; the half switcher sheet; sheets that never
mix gardens; no change-garden control in Submit Work; the offline strip over the header; the chip
at the icon buttons' height; and garden sections opening over Home rather than on the old garden
page. Later that day the maintainer settled the five explorations and the badge rule: garden
sections open as sheets over Home; a notifications bell takes the header's free slot; the Home
header is sticky; Submit Work's first step leads with the garden's open asks; no Highlights strip;
and the Your Work and Home badges count the active garden only. Each is recorded as decisions 10
to 15 in [spec.md](spec.md#review-round-on-19-october-2026).

On 20 October the Start step was reopened against the two design books and settled as decisions
16 to 20 in [spec.md](spec.md#review-round-on-20-october-2026): one question with the actions a
promise needs first, known answers skipping the step, Open asks taken up from the step with two
queued writes, new asks defaulting to Open, and the bell at the far right. Later that day the
maintainer settled the step itself (decision 16: no Start button, promises first as rows when
there are any, a promise's own screen with Add evidence first, two-up action tiles under dynamic
domain tabs otherwise) and asked for one submission flow for evidence and work (decision 21). A
steward's Home gained a Garden duties section above Recent activity, shown only when something
waits, with pending rows opening the work as today and deeper management staying in the cockpit
(decisions 22 to 24). Late on 20 October the maintainer picked from the lab (decision 27: among
them the Highlights carousel back, the compact promise card, Log Work on Its Own, Needs Your
Attention and no Work-for pin), asked for three tweaks (decisions 29 to 31) and called the design
good enough to implement, with polish to follow. The placement of seasons and campaigns, which
the garden-scoped Home would otherwise lose with the old Pool tab, was decided on 21 October as the
Pool tab's rail moved into the Promises sheet (decision 32), and the maintainer locked the plan and
scope.

## Scope and boundaries

This hub owns PWA Home composition, garden context, sheet entry points, and submission entry/resume
continuity. The 24 October go authorizes the application edits in the plan's steps. It does not
authorize deployment, transactions, role-policy changes, new financial instruments, contract,
indexer or admin feature work beyond the shared chip's look (decision 33), or a merge of the client
and Community PWAs. No dependency, contract, indexer, or admin redesign is
proposed. PRD-1261 separately covers consistent shared patterns on the selected member/steward
journeys while preserving each surface's design dialect and permissions.

CLC is useful context for keeping evidence, confirmation, rewards, and future obligations distinct.
The homepage improvement can stand on its own before any CLC integration ships.

## Success signal

A returning member can identify their garden, understand a recent update, resume unfinished work,
and find a way to participate without losing context. A steward or evaluator can find their
permitted next action without making everyone's home a management dashboard. Validate this with
observed tasks; no reduction in effort or completion time has been measured yet.

## Read next

- [Specification and locked decisions](spec.md): current sources, the state architecture, the
  implementation areas, and what stays open.
- [Plan](plan.todo.md): the design gate and the two delivery slices.
- [Evaluation](eval.md): usability, recovery, permission, and regression checks.
- [Design lab](artifacts/README.md): the interactive lab with every scenario, composition and
  variation at 390 and 360px in three languages.
- [Machine status](status.json): authoritative lane state; no execution lane is ready.
