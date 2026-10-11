# One Look for the App and the Cockpit

**Stage:** backlog · **Posture:** design research and decision review; implementation not authorized

Make the gardener app and the steward cockpit read as one product. Share the typeface, the ground
and the chrome recipes; keep each surface's density, corners and accent as its own dialect. Layouts,
routes, flows and permissions stay where they are.

## Why this work

Both surfaces run on the Warm Earth tokens and already share more than forty components, yet they
read as two products. Five decisions taken on different days explain almost all of the distance:
the typeface, the ground, the control shape, the chrome recipes (tabs, count badges, navigation
highlight, sheet surface, cards) and the accent model. The first two are token edits.

Stewards use both surfaces. When the tabs, the status language, the cards and the sheet header are
the same objects on each, switching surfaces keeps the mental model. That is the simplification
this hub serves: fewer vocabularies to learn, with no flow moved.

## Stated direction

Paraphrased from the maintainer's requests in the design sessions of 2026-10-09 and 2026-10-10, and
kept apart from the recommendations below.

1. Apply the app's design styles to the cockpit so the two feel unified, with enough variance that
   each keeps some of its own aesthetic.
2. Change look and feel and establish more shared elements. Do not change layout or structure.
3. Scope the work as part of the Cosmo-Local project, toward a simpler interface, flows and
   experience.
4. Cards are a key place to unify: decide where they match and where they vary.
5. Tabs: the app's tabs are preferred, especially their equal width.
6. Filter control: the app's filter button is preferred.
7. The cockpit's card list should have a gap between cards.
8. The cockpit's desktop work card keeps its image grid and becomes wide instead of tall.
9. The count badge needs to be settled; the app shows more than one style today.
10. The cockpit's dark mode is liked, but its cards sometimes blend into the ground. Explore it.
11. The cockpit's light mode is the look to bring to the app.

Items 5 to 11 answer part of the decision list in [spec.md](spec.md#decisions-to-resolve). They were
stated while looking at a mock, so each still needs confirming against a rendered pair of the real
components before it is recorded as accepted.

## Recommended starting point — awaiting decisions

One language, two dialects. The shared core is the typeface, the linen ground with white cards, one
warm dark ladder, capsule chips, the app's equal-width tabs, one count badge, one card surface and
work-item anatomy, the phone sheet surface and header, and the bottom bar's active recipe. Each
surface then sets a short list of dials: density, button corner, card corner, accent model, motion
and its own navigation chrome. Thirteen decisions carry this; none is accepted yet.

## Scope and boundaries

This hub owns the look and feel shared by the installed app and the steward cockpit: surface
tokens, shared chrome recipes, and the guides and gates that pin them. It does not authorize
application edits, Linear records, deployment, a layout or flow change, a merge of the two apps, or
a change to the public website beyond what a shared piece forces. The garden-scoped Home and its
switcher belong to [PWA Interface Simplification](../pwa-interface-simplification/brief.md).

## Success signal

A steward who uses both surfaces in one sitting recognises the same tabs, cards, badges, chips and
sheets on each, and can still tell at a glance which surface they are in. Validate it with rendered
pairs of the real components in English, Spanish and Portuguese; no measurement exists yet.

## Read next

- [Specification and decisions](spec.md): evidence, the divergence ledger, the thirteen forks.
- [Plan](plan.todo.md): design gate and conditional delivery sequence.
- [Evaluation](eval.md): acceptance matrix, the guards the work trips, the hub creation check.
- [Design lab and captures](artifacts/README.md): the interactive mock and the Storybook evidence.
- [Machine status](status.json): authoritative lane state; no execution lane is ready.
