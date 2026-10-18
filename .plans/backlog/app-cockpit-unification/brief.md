# One Look for the App and the Cockpit

**Stage:** backlog · **Posture:** design direction accepted in principle; no pick is locked and implementation is not authorized

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

Items 5 to 11 were stated while looking at a mock. The picks below supersede them where they differ.

## Direction accepted in principle

On 2026-10-10 the maintainer chose an option for every fork in the design lab and answered two
questions about how the choices stand. The full record is in
[spec.md](spec.md#direction-accepted-in-principle).

- **The picks are accepted in principle.** Each one locks when a before and after pair of the real
  components is approved. Until then it is direction, not a specification.
- **The cockpit's Material 3 rule is retired.** The cockpit becomes the app's language at a denser
  setting, and its guide and prompt contract are to be rewritten around that.
- **Eleven of the fourteen picks match the recommendation.** Three do not: the bottom bar keeps each
  surface's active state (F6), the filter control stays as it is on each surface (F9), and the list
  gap is 8px, not 12px (F11).
- **The F9 pick reverses item 6 and was confirmed.** Item 6 above preferred the app's filter button.
  The pick keeps the cockpit's inline chips, and the maintainer confirmed it when asked.
- **What the picks keep stays the cockpit's own.** Its pills, its 12px cards, its tone pill and its
  inline filters remain by choice, no longer on Material 3's authority.
- **Four changes without a fork are accepted on the same terms.** A green focus ring in the app,
  one empty, loading and error anatomy, one set of type role names, and the unused glass spec
  retired.
- **A pick locks on pairs of the lab's ten screens.** Real components at 390, 768 and 1280px, in
  light and dark, with Spanish and Portuguese where text must fit.
- **Timing.** As much of the sequence as fits should land before the Cosmo-Local demonstration.
  The plan is saved first; no implementation is authorized yet.
- **Cards and code, 17 October.** Every object's card is built from four shared shapes: an item
  row, a media card, a fact row and a state block. Each object's card code gets one home, moved
  as that object is consolidated. After the card work, the cockpit renders the shared controls,
  tuned by its own tokens, one control family at a time.
- **Tracking.** The Linear parent is PRD-1266, with one sub-issue per delivery step, in the active
  release project rather than the Cosmo-Local project: the 15 October four-goal plan gave PWA and
  admin delivery to the release project. PRD-1261, the member and steward pilot-journey pass, stays
  separate.

## The resulting shape

One language, with the cockpit as its denser setting. Both surfaces share Plus Jakarta Sans, the
linen ground with white cards, one warm dark ladder with the card a step lighter, capsule chips, the
app's equal-width tabs, one count badge, one card surface and work-item anatomy, an 8px list gap, a
control-grade outline with outlined fields, one focus role, one empty-state anatomy, one set of
type role names, and the phone sheet surface and header. Each surface
keeps its density, its button and card corners, the active state of its bottom bar, its filter
control, its motion and its navigation chrome. The cockpit keeps a tone per workspace and gains the
wide desktop work card.

## Scope and boundaries

This hub owns the look and feel shared by the installed app and the steward cockpit: surface
tokens, shared chrome recipes, and the guides and gates that pin them. It does not authorize
application edits, deployment, a layout or flow change, a merge of the two apps, or a change to the
public website beyond what a shared piece forces. Its Linear records exist for tracking only. The garden-scoped Home and its
switcher belong to [PWA Interface Simplification](../pwa-interface-simplification/brief.md).

## Success signal

A steward who uses both surfaces in one sitting recognises the same tabs, cards, badges, chips and
sheets on each, and can still tell at a glance which surface they are in. Validate it with rendered
pairs of the real components in English, Spanish and Portuguese; no measurement exists yet.

## Read next

- [Specification and decisions](spec.md): evidence, the divergence ledger, the picks and the thirteen forks.
- [Plan](plan.todo.md): design gate and conditional delivery sequence.
- [Evaluation](eval.md): acceptance matrix, the guards the work trips, the hub creation check.
- [Design lab and captures](artifacts/README.md): the interactive mock and the Storybook evidence.
- [Machine status](status.json): authoritative lane state; no execution lane is ready.
