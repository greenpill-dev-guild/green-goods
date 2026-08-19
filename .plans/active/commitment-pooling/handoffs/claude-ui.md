# Commitment Pooling - Claude UI Handoff

## Status

- Machine lane: ui
- Owner: Claude
- Branch signal: claude/ui/commitment-pooling
- Current state: prototype/spec review may continue; runtime implementation is blocked
- Linear context: this machine lane aggregates PRD-724 (client UI), PRD-725 (admin UI), and PRD-726 (editorial). PRD-727 is post-QA documentation polish, PRD-728 is post-certification walkthrough video, and PRD-682 is September Community context.

Concurrent agents share this repository. Each UI sub-lane stays inside its named package/spec
paths, preserves unrelated working-tree changes, and does not switch the primary tree's branch.

## Inputs

- GREEN shared state/API handoff and exported types/hooks/selectors
- GREEN indexer query contract
- Verified non-value mainnet artifacts and live indexer deployment/read-back
- Completed scoped existing-admin fixes and polish, including PRD-737
- Corrected uiux-spec.md, wireframes.md, diagrams.md, and settlement status vocabulary — including
  Appendix D and the bilateral-wave Appendix E. Appendix E.1 owns exchange-pair UX, E.2 owns the
  Offer-template library, and E.3 owns the noun-reduction/plain-language rules. The executable
  source is now the hi-fi registry: `hifi/screens/exchange.ts` draws W28–W31 with their recovery
  states, and `sb35`/`sb36` are validated journeys, not planned ones (register #97f).
- acceptance-matrix.md for the final state/copy/public-claim/role proof
- Admin/client package guides and authenticated Brave access

## Outputs

- Coordinated runtime client, admin, and editorial sub-lane evidence. Post-QA docs, final videos,
  and September Community record their own later evidence.
- Cross-surface state/copy consistency for claims, confirmation, disputes, settlement, and recovery,
  including explicit `Ordinary`, local `PoolFallback`, and Green Goods `ProtocolFallback`
  provenance.
- Cross-surface exchange proposal, atomic match, counterpart-lapsed, template-first creation, and
  first-exposure copy remain consistent with Appendix E and never imply coupled lifecycles.
- Register #51 placement consistency: `W10@cancel`, `W10@mark-ready-override`, and `W10@attach-assessment` own their admin actions; `WFLOW@review` owns the read-only fulfills row; `W25@context-chooser` owns the pre-claim personal/garden provider chooser. These are locked August states, not optional follow-ups.
- en/es/pt coverage, accessible names/order/status announcements, responsive/reduced-motion behavior, and real-browser proof.
- Aggregate proof record; detailed proof remains in each sub-lane handoff.

## Acceptance

- Every product write flows through shared mutation hooks.
- Offer receiver, Request creator, named group, local fallback, and opted-in Green Goods protocol
  fallback eligibility agree across surfaces. Every frozen contributor is excluded; actor, path
  and reason remain visible after fulfillment.
- Acceptance requires the four register #51 placements to be implemented and proved at their named parent states with their role, reason, identity, and provider-garden constraints; no substitute placement or visually silent action satisfies this gate.
- Dispatched and Celo-executed/acknowledgment-pending are never presented as arrived; Confirmed
  requires an authenticated success acknowledgment for the subject's current execution key and
  attempt.
- Admin pool operations live under /community and remain a restrained CanvasLayout command surface.
- Client hero moments remain client-only.
- Member-delivery-disabled and all loading/empty/offline/pending/failed/retry states have clear exits.
- Every new user-facing string exists in en, es, and pt.
- Core pooling UI can turn GREEN independently of the separately gated settlement slices; neither phase can be represented as the other.

## Proof limit

This aggregate handoff introduces no independent product behavior. It turns GREEN only by collecting the sub-lanes' RED/GREEN and authenticated-browser evidence; it cannot substitute a broad build for missing flow proof.

## Exact Bun commands

- bun run --filter @green-goods/shared typecheck
- bun run --filter @green-goods/client test
- bun run --filter @green-goods/admin test
- bun run --filter @green-goods/client build
- bun run --filter @green-goods/admin build
- bun run lint:vocab
- bun run agentic:check
- bun run check:design-md
- bun run check:design-generated
- bun run check:design-tokens
- bun run --filter @green-goods/shared check:stories
- bun run --filter @green-goods/shared check:story-quality

Run the shared story commands only when a Storybook-covered shared component changes; all other commands above are required for the August aggregate.

## Out of scope

- Contract, indexer, or shared behavior changes; a new top-level admin Pools root; direct app contract calls; manual settlement confirmation; garden-held member claims; rankings; credit; or broadcasts.

## Unblock evidence

- state_api is GREEN with indexer codegen/build and shared targeted proof.
- The authorized non-value broadcast, artifact persistence, indexer deployment/reindex, and live
  entity/query read-back are complete.
- The scoped existing-admin fixes and polish are complete and re-proven.
- Every runtime UI sub-lane handoff (`ui_client`, `ui_admin`, `editorial`) has recorded acceptance and proof. Post-QA docs, walkthrough videos, and `community` are intentionally excluded.
- Authenticated Brave covers admin/client visible flows; member PWA also has a real-device pass.
- Any unavailable external settlement or AA path is reported as a proof limit, never a pass.

## Token bridge — the prototype's CSS variables to `theme.css` (2026-08-18)

The Flow Prototypes artifact is a standalone HTML file with its own stylesheet
(`hifi/tokens.ts`), and its variable namespace is **entirely disjoint** from the shipped one.
`--act`, `--ink`, `--card`, `--cv` exist nowhere in `packages/shared/src/styles/theme.css`, and
`--bg-weak-50`, `--text-strong-950`, `--primary-base` exist nowhere in the prototype. Nothing maps
one to the other, so an implementer reading a prototype screen has had no mechanical way to tell
which shipped token a colour corresponds to, and has had to eyeball it. That is where design-system
divergence enters.

Two structural differences to know before using the table:

- The prototype stores **flat hex** (`--ink:#292524`). The shipped theme is **semantic over
  palette**: `--text-strong-950: var(--neutral-950)`, consumed as `rgb(var(--token))`. Map to the
  semantic name, never to a palette entry and never to a hex.
- The prototype's `.hf.s-client` and `.hf.s-admin` blocks hold different values for the same
  variable name. The shipped equivalent is the surface's own theme scope, not a renamed token.

### Client PWA (`.hf.s-client`)

| Prototype | Role | Shipped |
|---|---|---|
| `--cv` | page canvas | `--bg-weak-50` |
| `--card` | card surface | `--bg-white-0` |
| `--ink` | primary text | `--text-strong-950` |
| `--stone` | secondary text | `--text-sub-600` |
| `--stone-bg` | quiet fill | `--bg-soft-200` |
| `--ln` | hairline | `--stroke-soft-200` |
| `--ln2` | visible border | `--stroke-sub-300` |
| `--act` / `--acth` | accent action, hover | `--primary-base` / `--primary-darker` |
| `--gr` / `--gr-ink` / `--gr-bg` | success | `--success-base` / darker / `--success-lighter` |
| `--amb` / `--amb-bg` | warning | `--warning-base` / `--warning-lighter` |
| `--err` | error | `--error-base` |
| `--sky` / `--sky-bg` | information | the blue ramp; no dedicated semantic token yet |
| `--scrim` | modal scrim | `--overlay` |

### No shipped equivalent

- **`--cyc` / `--cyc-bg`** (#6B4A7A purple) — the cycle identity colour, carrying season and
  campaign chips. This is **net-new vocabulary with no counterpart in `theme.css`**, and it is the
  one token on this list that needs a real decision rather than a lookup: either it earns a semantic
  token in the shipped theme, or cycle chips adopt an existing role. Do not improvise a hex.
- **`--phone-scale`, `--bezel`, `--chrome-border`** — artifact chrome for drawing a phone inside a
  web page. Nothing to map; they do not exist in the app.

### The rule

`--color-*`, `--radius-*` and `--spring-*` in the shipped theme remain the only source for colour,
radius and motion in implementation. This table exists to read the prototype, not to import from it.
A prototype screen is a picture of the intent; `theme.css` is the intent.

## Net-new component audit — 2026-08-18

The Components tab carries 101 entries. **67 cite a shipped component by `file:line`** and all 67
resolve against the current tree. **34 are net-new** — the things implementation has to build.
Each was checked against `packages/shared/src/components/`, `packages/admin/src/components/`, and
both canonical palettes.

### Finding: no duplication

No net-new builder duplicates a shipped primitive. The near-misses were checked individually and are
genuine gaps:

- `listRow` — `ListPrimitives.tsx` exports `EmptyState`, `ListToolbar` and `SortSelect`, not a row.
  Admin's row *does* ship (`AdminListItem`) and the gallery already cites it; the client has none.
- `radio(options)` — `Form/ControlPrimitives` ships `TextInput`, `Textarea`, `NativeSelect` and
  `Switch`, no radio group. Admin's `AdminChoiceGroup` ships and is cited separately. Correct split.
- `disclosure` — no shipped accordion on either surface.
- `dtable` — no shipped table; admin queues use list rows today, which the entry says.

### Two that should build on a shipped base, not from scratch

- **`stages(list, activeIx)`** overlaps `Form/FormWizard`'s step model. Extend it rather than adding
  a parallel stepper, or the two will diverge on the first spec change.
- **client `listRow`** should take its anatomy from `AdminListItem` even though it cannot import it.
  A row is the densest repeated element on both surfaces; two independently-invented ones is how the
  surfaces stop feeling like one product.

### The real gap: the palettes have no way to receive these

`client-prompt-contract.md` and `prompt-contract.md` § Canonical Component Palette both say *"Do not
invent component names — flag missing primitives instead."* The prototypes comply: every net-new
builder carries a `netNew:` note saying what it is for, which is the flag.

But **nothing adds them to the palettes when they ship.** The moment `identityCard` lands as a React
component, the client palette is stale, and the next AI design round — which is told to map output
onto the palette — will re-invent a name for a component that now exists. That is a process gap, not
a code one, and it needs a step in the UI lane's definition of done:

> When a net-new prototype builder ships as a component, add it to the matching palette in the same
> change, and update the gallery entry from `netNew:` to `ship:` with its `file:line`.

The gallery's `netNew` → `ship` transition is the natural signal, and it is already machine-visible:
`bun .plans/active/commitment-pooling/prototypes-artifact.build.ts` fails when a kit builder has no
gallery entry, so the entry is guaranteed to exist and be found.

### Naming

Kit builders are lowercase functions (`identityCard`, `progressBlock`, `cycleRail`); shipped
components are PascalCase React (`StatCard`, `StatusBadge`). The prototype name is the concept, not
the export — `identityCard` ships as `CommitmentIdentityCard` or similar. Record the mapping in the
gallery entry when it ships so the two stay traceable.

## Implementation brief — where the prototypes land, and in what order (2026-08-18)

37 review-visible screens carrying 512 states: 19 client (311), 16 admin (196), 2 editorial (5).
This maps them onto shipped views and orders them by dependency, not by size.

### Blocking, before any client work

**The seat gap** — `handoffs/codex-state-api.md` § Binding seat amendment. `W2` cannot be built
correctly without `selectCommitmentSeat()`, and building it wrong is not a cosmetic error: it is the
class of defect the 2026-08-18 audit found six of. Everything else in this brief can proceed in
parallel with that landing; `W2` cannot.

The per-state contract is `handoffs/commitment-view-state-reference.md`, generated from the
prototype's own tables.

### Client — order

| # | Screens | Lands in | Why here |
|---|---|---|---|
| 1 | **W5** commitments sheet (19) | `views/Home/WalletDrawer/` — the Commitments tab renders `ComingSoonStub` today (`index.tsx:71`) | A live stub with a real home. It is the member's "what is happening to me" surface, so every later screen has somewhere to be reached from. Smallest real landing. |
| 2 | **W1** pool tab (33) | `views/Home/Garden/` | The browse surface. Needs the cycle rail and commitment cards, which nothing else depends on. |
| 3 | **W2** commitment detail (85) | new | **The big one, and the one with the state-layer dependency.** A third of all client states. Do not start it before seat lands. |
| 4 | **W2a** proof · **WFLOW** work link (19) | `views/Garden/` — `Intro` · `Media` · `Details` · `Review` already ship | Reuses the shipped Submit Work rhythm; the prototype mirrors it deliberately. Mostly composition, not new anatomy. |
| 5 | **W3** composer (34) | new, but the same four-beat flow as `views/Garden/` | Second-largest. Every path shares one body; build the shared beats once. |
| 6 | **W4** confirmation sheet (29) | `DialogShell` | Dense in states, thin in anatomy — one sheet, many casts. |
| 7 | **W2b** team (13) · **W1C** cycle view (10) · **W23** wallet (6) · **W25** protocol claim (4) | mixed | Independent of each other. |
| 8 | **W34/W35/W32** ongoing offers (36) · **W36** funded claim (10) | new | Later waves. `W36` depends on the member-funded settlement lane. |
| 9 | **W28–W31** exchange (13) | new | **Parked** — no journey walks it pending a design session. Do not build. |

### Admin — order

| # | Screens | Lands in | Why here |
|---|---|---|---|
| 1 | **W7 / W7C / W7M** pool workspace (43) | `views/Garden/` beside `SignalPool`, `Vault`, `Strategies` | The steward's home. `W7M` is the same view below 1024px, not a second build. |
| 2 | **W13** confirm stage (6) · **HUBWORK** (8) | `views/Hub/` | `HUBWORK` is the existing Work queue; `W13` adds one stage beside it. Small, and it is where the steward's weekly job lives. |
| 3 | **W10** commitment dialog (19) | `AdminDialog` | The steward's counterpart to `W2`. Same seat question, simpler: the console viewer is always a steward. |
| 4 | **W8 / W9** seeding and capture (12) | new flow dialog | The on-behalf-of path. Accountability copy matters more here than anywhere else in the product. |
| 5 | **W11 / W26** allocation and close (30) | new flow dialogs | Once-a-season ceremonies. |
| 6 | **W14** assessment (10) | `views/Hub/CreateAssessment.tsx` — extends, does not fork | |
| 7 | **W12 / W24** community and operations (16) | `views/Community/` | Protocol-team only. |
| 8 | **W21 / W22 / W37** settlement (52) | new | Depends on the settlement lane shipping. A quarter of admin states; last. |

### Editorial

**W15 / W16** (5 states) are the smallest surface in the product and depend on nothing. They can
land any time, by anyone, and they are the only pooling surface a signed-out reader ever sees.

### Two rules that decide whether this stays coherent

1. **Surface identities never mix.** Client is a warm garden journal; admin is a restrained operator
   cockpit. Hero moments live in the client only — there are 13 in the prototypes and all 13 are
   client. The build rejects celebration language on admin screens, and the same rule applies in the
   app.
2. **Read the prototype for intent, `theme.css` for values.** See the token bridge above. The
   artifact's `--act`, `--ink`, `--cyc` are its own vocabulary and must not be copied into the app.
