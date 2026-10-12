# PWA Interface Simplification

**Stage:** backlog · **Posture:** design and scope review; implementation not authorized

Make Home feel like the member's garden, with a short view of what happened, what needs their
attention, and how they can participate. Keep the familiar Home / Garden / Profile navigation,
one-tap app sheets, and Warm Earth design language.

## Why this work

Today, Home starts with a garden directory. Members enter a garden card to reach its activity and
other sections. Personal sheets live in the header, while garden actions also appear on the banner.
These are useful capabilities, but their placement asks returning members to navigate the app's
structure before getting back to their community or work.

This hub captures the product direction from the PWA design discussion. It does not approve a
finished layout or replace the domain and integration decisions in other hubs.

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

## Recommended starting point — awaiting design acceptance

Use a compact garden journal: a small identity header, bounded activity preview, a clear resume
area, then participation cards. Put permission-specific responsibilities in a small management
entry after unfinished work. Keep full records and financial operations in their existing owners.

Compare this with a featured-activity composition before choosing a layout. A prototype's selected
variant is not an acceptance decision. Personal-sheet filtering and the exact management placement
remain open in [spec.md](spec.md#decisions-to-resolve).

## Scope and boundaries

This hub owns PWA Home composition, garden context, sheet entry points, and submission entry/resume
continuity. It does not authorize application edits, deployment, transactions, Linear updates,
role-policy changes, new financial instruments, or a merge of the client and Community PWAs.
No dependency, contract, indexer, or admin redesign is proposed.

CLC is useful context for keeping evidence, confirmation, rewards, and future obligations distinct.
The homepage improvement can stand on its own before any CLC integration ships.

## Success signal

A returning member can identify their garden, understand a recent update, resume unfinished work,
and find a way to participate without losing context. A steward or evaluator can find their
permitted next action without making everyone's home a management dashboard. Validate this with
observed tasks; no reduction in effort or completion time has been measured yet.

## Read next

- [Specification and design decisions](spec.md): current sources, proposed flows, open choices.
- [Plan](plan.todo.md): design gate and conditional delivery sequence.
- [Evaluation](eval.md): usability, recovery, permission, and regression checks.
- [Machine status](status.json): authoritative lane state; no execution lane is ready.
