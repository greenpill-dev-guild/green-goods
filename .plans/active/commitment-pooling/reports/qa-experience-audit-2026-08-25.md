# Commitment pooling — design conformance & experience audit — 2026-08-25

Read-only audit per `../prompt-qa-experience-audit.md`. Target: `origin/develop@fc27a5b000fd8ab8674ac5a6dea159a0a602234b`
(clean tree; includes the 2026-08-24 Wave 1 defect-fix commit `1e34e39e2`, which post-dates the
audit prompt and resolves several of its seeded leads). Auditor: Claude (Fable). No product code
was edited; no signatures, transactions, or Linear writes were made.

---

## 1. What ran

**Phase 0 — wired automation (all at target head):**

| Gate | Result |
|---|---|
| `bun run lint:vocab` | ✅ pass (3 i18n catalogs clean) |
| `bun run check:design-tokens` | ✅ pass (8 sub-guards incl. Controlled Chrome, focus-ring, token_version 2.6.0) |
| `bun run check:design-md` | ✅ pass (0 errors / 0 warnings, 5 files) |
| `bun run check:design-generated` | ✅ pass (the Wave 1-era stale token-audit red is gone) |
| `bun run check:ontology` | ✅ pass (7 baselined findings) |
| `check:stories` / `check:story-quality` (shared) | ✅ pass |
| `bun run agentic:check` | ❌ **red** — fail-fasts at `check:browser-verification-policy`: `packages/{admin,client,shared}/AGENTS.md` are missing required authenticated-browser QA phrases. Guidance drift, not a product defect; later gates in the chain pass when run individually (above). |

**Capture inventory** (named `<surface>-<screen>-<state>-<theme>-<width>.png`):

- **777 Storybook captures**, 0 failures — every variant of the ~38 pooling story files ×
  light/dark × widths (admin 1280/768/465; client 320/768; editorial 320/768/1280).
- **65 client fixture-world captures** (`?mockAuth=…&mockPooling=1`): pool tab, all 20 garden
  fixture commitments (2 viewers on seat-sensitive ones), composer both directions, proof
  composer + NotYours, es/pt/dark variants, tall full-content details.
- **25 live captures**: editorial `/gardens/:id` § 02 pre-launch + `/impact` (en/es/pt ×
  light/dark), availability-off client, live admin console light + dark.
- **Mechanical measurement pass** (`evidence/qa-experience-audit/mechanical-measurements.json`):
  touch targets, computed radii and shadows, shared-`Button` scan, `aria-invalid`×`aria-describedby`
  cross, tab-rail overflow at 465/375, dark-token probes, es/pt overflow/clipping, console errors.
- **Interactive experience walk** (Browser pane, mobile + desktop viewports): pool tab → browse →
  composer offer *and* request end-to-end through Review → place (demo-queued) → queued row →
  confirm flow → Not yet flow → CommitmentsDrawer Live/Over time → editorial § 02/§ 03 (en + es) →
  live admin Garden/Pool + inspector + Hub Confirm + Community Pools (light + dark).

**Channels, labeled per the prompt:** Storybook, fixture-world, and live captures were driven by
headless Playwright Chromium; the experience walk used the Claude Browser pane. Both are
**unauthenticated** channels — sanctioned here because Storybook/fixture capture needs no
authentication and this audit makes **no authenticated-proof claims** (those belong to the
functional wave). `mockAuth` is a dev identity, not authentication. The authenticated-Brave rule
was therefore not exercised, not violated.

**Environment:** another session's stack (client :3001, admin :3002, Storybook :3004, Anvil fork
:3009) was **reused, never restarted**. The indexer's Envio/Hasura containers had been SIGKILLed
4 h earlier with their owner stack dead and ports free; I restarted the two exited containers
(`docker start indexer-graphql-engine-1 indexer-indexer-1`) — additive, no live service touched.
Local indexer state: 18 registered pools, all `NOT_READY`, zero cycles/commitments; the public
Hasura role serves aggregates (the #748 grant is live locally).

**Unreachable in this pass (recorded, not judged):** drawer **To confirm** tab (unwrapped reader
— expected under fixtures); populated **live** admin states (no steward writes exist; Storybook
covered them); client settlement/"money on its way" states (not shipped in D1); real-device PWA,
motion *feel*, and locale *tone* (Wave 2 by design); hosted-indexer and staging surfaces
(standing external blockers). Live evidence renders real fork records and stays outside the repo
per the privacy rule, under the session scratchpad:
`…/scratchpad/sweep/live/` (referenced below as `live:<name>.png`).

---

## 2. What conforms well

Calibration first: **nothing found rises to `breaks-identity`.** The three surfaces keep their
identities cleanly — warm garden journal, restrained cockpit, linen public record — and the
shipped build is dramatically stronger than the prototype the last flow audit measured.

- **The seat/phase contract is real.** `modules/commitment-pooling/acts.ts` derives the single
  act from phase × seat exactly as `commitment-view-state-reference.md` demands; a seat with no
  act gets **no bar** (verified across fixtures 1001–1020, two viewers). The prototype audit's
  top structural finding ("the commitment view does not know who is looking") is closed in code,
  with its one deliberate deviation (PARTIALLY_APPROVED keeps an addProof bar) recorded in-source.
- **The band copy is the best writing in the product.** Seat- and phase-specific, plain, honest:
  "Your part is done. You provided this, so you cannot confirm it yourself." / "After this it
  lapses. Nothing is lost, and you can offer it again." No machine words anywhere member-facing —
  the prototype's "syncs on-chain," "Cycle:", and idempotency-reassurance sentences are all gone;
  offline copy is now "Saved on this phone. It sends when you are connected."
- **Both composer doors are gated and symmetric.** Read-to-the-end (with a "Read to the end"
  jump assist) on offer *and* request; specific act labels ("Make this offer/request"); the
  consequence paragraph names the blast radius before the act, direction-correctly ("…you will
  be the one who confirms it was kept"). The queued creation lands at the top of the pool as a
  distinct dashed "Waiting to send" card — the exit feeds the entrance.
- **The Not-yet flow** never says "dispute," states "This never cancels the commitment," fills
  the required reason via chips, and ends legibly; the under-review commitment then appears in
  **both** the pool list and the drawer's Live tab ("Under review by stewards") — the prototype's
  worst waiting-silence gap is fixed.
- **Admin composition follows the interaction contract.** Two-column + right rail collapsing to
  one column at 465 with nothing lost; scope chips (Open/Confirmed/Past/Past due) over **one**
  list; decision rows with affirmative rightmost; chips = kind · lifecycle · one attention chip;
  cards titled by subject with peers under quiet dividers; reasoned dialogs with blast radius
  (`AdminReasonDialog`); `SetupFailure` is exemplary failure honesty ("What landed stays landed;
  the rest was not written"). No shared `Button` in admin; radii all on the 4/8/12/16/9999 scale;
  shadows all within the elevation ladder; tone budget held (Garden green / Hub blue / Community
  amber, each in its sanctioned spots).
- **Editorial § 02 is rule-perfect.** Stable ordinal, static heading, `EditorialPanel` grammar,
  exact-label units, kept-rate published only with its definitional sentence, planned-vs-live
  wording discipline, absence copy, em-dash-not-zero — and the five-stage evidence pipeline is
  shipped and fully localized (verified live in es: Evaluación → Compromiso → Trabajo →
  Confirmación → Certificado de Impacto).
- **Field-level error association works** — every `aria-invalid` field measured carries
  `aria-describedby` to its supporting text, clearing seeded lead 3.
- **Client touch targets are clean** where the admin's are not: rows, cycle rail, and tab bar all
  ≥ 44px (`min-h-11`).

---

## 3. Conformance findings (Half 1)

Severity: `erodes-quality` (a user would feel it) / `polish`. No `breaks-identity` findings.
Admin identifiers per `defect-grammar.md`.

### Admin

**A1 · "Expire now" fires the contract call straight from a list row — no confirmation, no named
blast radius.** `AdminButton` (filled error) inside `data-component="PoolCommitmentsCard"` rows,
`/garden/pool` past-due scope; [PoolCommitmentsCard.tsx:290](../../../packages/admin/src/views/Garden/Pool/PoolCommitmentsCard.tsx)
runs `acts.expire(...)` on tap. Expiry supersedes pending claims and releases the reservation —
member-visible consequences — yet it is the only governing act in the console without a
confirm/reason step (pause, cancel, decline all get one). Anchors: interaction-patterns § 2
("confirmations name consequences before the act"), review-checklist 3.2. The contract stores no
expiry reason, so the fix is a plain `AdminConfirmDialog` naming what expiring does — not an
invented reason field. Severity **erodes-quality** · effort **S** · evidence
`evidence/qa-experience-audit/admin-GardenPoolTab-Open-light-1280.png`.

**A2 · Admin row/card acts sit at 32 px height across the pooling surfaces.** `AdminButton
size="sm"` ("Edit pool", "Pause…", "Accept", "Decline…", "Confirm", "Not yet…", "Seed
commitment", "Start campaign"…) measures 32 px; `AdminFilterChip` 32 px; `AdminSearchToolbar`
38 px; dialog footer buttons 40 px; `AdminTabRail` tabs 42 px. One story (`GardenPoolTab/Open`)
carries 15 sub-44 targets. Anchor 2.4 (≥ 44 px). Known from Wave 1; now quantified per component
in `mechanical-measurements.json`. Severity **erodes-quality** · effort **M** (primitive-level:
padding/hit-area change on `AdminButton sm` + chips, many consumers) · evidence
`admin-GardenPoolTab-Open-light-1280.png`, measurements JSON.

**A3 · Queue counts render as three sibling stat cards, not the contract's "one card of
hairline-separated columns."** The 0/16/15 row on `/garden/pool` (and its Community twin).
Anchor: interaction-patterns § 5 (counts grammar). The cards are correctly button-free and calm
at zero; only the container grammar diverges. Severity **polish** · effort **S** — or amend the
contract if three cards is now the intent (→ Wave 2 W7).

**A4 · `SeedStepProof` hand-rolls a native checkbox and spends tone on it.**
[SeedStepProof.tsx:78-88](../../../packages/admin/src/views/Garden/Pool/Seed/SeedStepProof.tsx)
uses `<input type="checkbox" className="… accent-[rgb(var(--tone-action))]">` for the
team-fallback toggle while the canonical `AdminCheckbox` (M3 anatomy, `--m3-primary` checked
fill) exists and is unused. Anchors: interaction-patterns § 6 (component parity — a missing
primitive is flagged, never improvised) and 4.13 (tone budget — this is a fifth tone use).
Severity **erodes-quality** · effort **S**.

**A5 · Casing contract conflict: shipped card titles are sentence case; the written contract
demands Title Case.** "Pool status" (shipped) vs interaction-patterns § 5's literal example
"Pool Status". Shipped admin is *internally consistent* (sentence case everywhere, per the
2026-08-21 session's decision 2), so the likely fix is the doc — but the contract's own preamble
forbids silent drift, so one side must move. Severity **polish** · effort **S** (probably a
`design` skill edit).

**A6 · People render as raw hex pairs with an unlabeled arrow in admin rows.**
`0x6166…5044 → 0x1234…858a · 4 rides` is the standard row meta; the inspector's Provider fact
is also bare hex. The shared `AddressDisplay` (ENS-resolving) is not used on these rows, and
"→" is the only statement of the relationship. The row contract's "who" leg is illegible for a
steward scanning. Anchor: interaction-patterns § 5 (meta = who · how much · when); pairs with
experience finding E4. Severity **erodes-quality** · effort **M** · evidence
`admin-GardenPoolTab-Open-light-1280.png`, `live:admin-garden-pool-live-deployer-light-1280.png`.

**A7 · `AllocationEditor`'s invalid-sum error is not programmatically associated.** The sum
error renders with 8 fields, none marked `aria-invalid`, none describedby-linked (it is a
group-level error). Field-level errors elsewhere are correctly linked (lead 3 cleared), so this
is the residue. Anchor 4.2. Severity **polish** · effort **S**.

**A8 · The Hub queue's affirmative act is bare "Confirm."** Interaction-patterns § 2 bans vague
"Confirm"; here it is arguably the domain verb, but the client's fuller "Confirm it was kept"
shows what specific looks like. "Confirm kept" would satisfy both. Severity **polish** · effort
**S** · evidence `admin-HubConfirmQueue-Queue-light-1280.png`.

### Client

**C1 · The garden tab rail has no tab semantics.** `StandardTabs` renders plain buttons — no
`role="tablist"/"tab"`, no `aria-selected`/`aria-current` — so AT users hear four unlabeled-state
buttons and never which section is active. Targets are fine (`min-h-11`); the state is the gap.
Anchor 4.5/4.1-adjacent;
[StandardTabs.tsx:86](../../../packages/client/src/components/Navigation/Tabs/StandardTabs.tsx).
Severity **erodes-quality** · effort **S**.

**C2 · es/pt copy breaks at 320 px in three places.** (a) The composer's Next button clips its
own label **without ellipsis** — "Siguiente"/"Próximo" lose ~8 px of glyphs; (b) the composer's
cycle `<select>` truncates its value mid-phrase ("Por su cuenta, fuera de cualquier temp…");
(c) the garden tab labels ellipsis-clip ("Compromisos" −32 px, "Compromissos" −38 px,
"Jardineros/…as" −13/16 px). No document-level horizontal overflow anywhere (good). Anchor 4.8 +
responsive. Severity **erodes-quality** (a control label losing glyphs) · effort **S** · evidence
`client-composer-offer-step1-user-es-light-320.png`, measurements JSON.

**C3 · The proof composer's back control is 32×32 and inconsistent with the detail shell's
40 px back.** Anchor 2.4. Severity **polish** · effort **S**.

### Editorial

No conformance defects beyond the six accepted #748 deviations (all verified holding, including
the dark panel-darker-than-canvas treatment across § 02 states) and the already-recorded § 01
Show-more focus follow-up. This is the cleanest surface of the three.

### Cross-cutting

**X1 · `agentic:check` is red at head** via `check:browser-verification-policy` (three package
`AGENTS.md` files missing required authenticated-browser QA phrases). Wired-gate hygiene: the
one red gate in the design battery. Owner: docs/guidance. Severity **polish** · effort **S**.

---

## 4. Experience findings (Half 2)

In the flow-audit grammar; structural before local, ranked by felt friction removed.

### Structural

**E1 · The product's highest moment arrives as silence.** *Who:* the provider (or requester)
whose commitment was just confirmed kept. *Where:* nowhere — that is the finding. No
notification, inbox row, or arrival surface exists for pooling events
(`views/Home/Garden/Notifications.tsx` carries no commitment source; the drawer badge counts
only what *waits on you*, never what *moved for you*). *What they experience:* the confirmation
happens off-stage; they learn their work counted only if they reopen the app and revisit the
commitment, where the payoff is a quiet green band — "Kept · This was confirmed. Nothing else is
needed from you." — closural, administrative, and (when the confirmer has no name) signed by a
hex string. The confirmer, meanwhile, gets the product's one small ceremony (the check-circle
"You have confirmed it" sheet). The prototype audit said the ceremony sat on the wrong person;
the shipped build lowered the amplitude but kept the asymmetry, and removed the *arrival* beat
entirely. *Quality that fails:* Momentum — the recognition beat of the arc is passive. *Direction:*
give pooling a small arrival surface (accepted / confirmed / not-yet-resolved rows in the
existing notification pattern), and let the *first* view of a freshly kept commitment land as a
moment in the register the ConfirmSheet already established — warmth that names the work, never
a game mechanic. The same surface closes the acceptance handoff below.
Evidence: `client-commitment-1011-offer-fulfilled-user-light-320-tall.png`,
`client-ConfirmSheet-Kept-light-320.png`.

**E2 · The relay's handoffs start silently.** *Who:* an offerer whose offer was just taken up —
the moment the product exists to create ("someone is relying on you" is the composer's own
sentence). *Where:* between "Your offer is live" and whenever they next visit. *What they
experience:* nothing announces the handoff; the band has changed when they look. The same
applies to the steward's not-yet resolution reaching the member. *Quality:* Orientation +
Momentum. *Direction:* same root and same fix as E1 — **pooling events have no arrival surface**;
E1 and E2 are one root cause, named as such.

**E3 · A request never names the person asking.** *Who:* a neighbour deciding whether to help.
*Where:* the request detail and pool rows pre-acceptance (fixtures 1003–1005). *What they
experience:* "Someone is asking for help" — while the record knows exactly who; the People card
renders empty pre-acceptance (no provider yet, counterparty unset in the read model), and even
when present the asker would be labeled by role ("Confirms it"), never as the asker. The
decision "do I want to help *this neighbour*" is made blind. *Quality:* Decision load +
Language. *Direction:* name the asker in the band or people card pre-acceptance ("Ana is asking
for this"), and let people-row labels tell the direction's story ("Asked by · Confirms it").
Evidence: `client-commitment-1003-request-requested-user-light-320.png`.

**E4 · People are hex strings at human moments.** *Who:* everyone, on both private surfaces.
*Where:* "Confirmed by `0xfb…ad6`" at the payoff; "Doing this `0x12…890`"; admin rows
"`0x6166…5044` → `0x1234…858a`". *What they experience:* the name layer stops at ENS
(`AddressDisplay` → `useEnsName`), and members without a name render as wallet infrastructure
precisely where the story is inter-personal — recognition, relay, accountability. The client
even ships a "Claim your Green Goods name" banner, so the concept exists; pooling surfaces just
can't benefit until resolution covers it and admin adopts `AddressDisplay` at all. *Quality:*
Language/warmth (garden journal identity). *Direction:* resolve Green Goods names/profiles
wherever `AddressDisplay` renders; use it in admin pooling rows with a worded relationship
("for") instead of "→". Product dependency → Wave 2 W2. Pairs with A6.

**E5 · The pool list interleaves the living and the dead in one flat scroll.** *Who:* any member
browsing the Pool tab — the product's daily surface. *What they experience:* withdrawn, expired,
and kept rows sit between open offers with equal visual weight (only chip text differs); at
season volume the actionable drowns. The drawer already models the split (Live / Over time), and
the admin card already scopes (Open/Confirmed/Past/Past due) — the client pool list is the one
surface without a liveness scope. *Quality:* Focus + Density. *Direction:* default the list to
live rows with the finished under a quiet scope ("How it ended" / "Settled"), reusing the
existing chip-row grammar. Evidence: pool-tab walk screenshots (Withdrawn between In-progress
rows), `client-pooltab-open-user-en-light-320.png`.

### Local

**E6 · The garden hero halves the pool's reading window.** The banner + name + Founded + Join
CTA + tab rail stay pinned (~310 of 812 px) while the list scrolls beneath; on a smaller phone
the window drops below half. *Who:* a member mid-browse; *quality:* Density. *Direction:*
condense/collapse the garden header on scroll within a tab. Effort M · Wave 2 feel call (W6).

**E7 · The confirm act promises the decision before showing the evidence.** *Who:* the
confirmer on a ready commitment. *Where:* detail bar "Confirm it was kept" → the proof lives
inside the sheet behind that button; the detail itself shows only counts ("2 pieces of proof
added"). A careful confirmer must tap a button worded as the outcome in order to *look*.
*Quality:* Decision load. *Direction:* render the submitted evidence on the detail (the data is
already fetched for the sheet) — which also heals E8 — or word the bar act as review.
Evidence: greenhouse-door walk screenshots; `client-ConfirmSheet-AskSupport-light-320.png`.

**E8 · A provider's proof vanishes from their own record.** After sending, the media/notes render
only inside the confirmer's sheet; the provider's detail shows a count with nothing to open (and
Wave 1's count-contradiction defect makes even the numbers disagree). The pride beat has no
artifact. *Quality:* Density/placement. *Direction:* one evidence strip on the detail for every
seat. Effort S/M.

**E9 · The composer's ending doesn't echo the thing made.** "It is on its way · Your commitment
is being placed in the pool." names neither the offer nor who acts next; the pool's dashed
queued row does that work one tap later. *Quality:* Momentum (anticipation). *Direction:* name
it — "'Saturday compost workshop' is on its way. Neighbours can take it up once it lands."
Effort S.

**E10 · One state, two emotional registers.** The queued creation is a *calm dashed card* on the
pool tab ("Saved on this phone. It sends when you are connected…") but an *amber warning banner*
in the drawer ("A commitment you made is still waiting to send from this phone."). Same fact,
one reassuring, one alarming — and DESIGN.pwa demands warm offline indicators. *Quality:*
Continuity (repeated shapes teach). *Direction:* the pool row's register, both places. Effort S.

**E11 · Row copy stutters.** Pre-acceptance rows say the same word twice ("Asked for · [Asked
for]", "Offered · [Offered]" — direction meta + state chip); every chip carries the same clock
icon regardless of meaning (in-progress, terminal, attention alike); and terminal records keep
in-progress framing ("No proof added yet. Proof is what moves this forward." on a *kept* or
*expired* commitment). *Quality:* Language + Density. *Direction:* drop the direction meta when
the chip already says it; phase-aware progress copy; either meaningful per-family chip icons or
none. Effort S.

**E12 · Single-day campaigns read "Apr 12 – Apr 12, 202…".** The CycleRail date range doesn't
collapse same-day spans and clips the year at 320. *Quality:* Language. *Direction:* collapse
same-day ranges. Effort S.

---

## 5. The three changes that would most change how this feels

1. **Give pooling an arrival surface, and let "kept" land as a moment.** One notification/inbox
   family (taken up · confirmed kept · not-yet resolved) plus a first-view treatment of the
   freshly kept commitment in the ConfirmSheet's existing warm register. Closes E1+E2 — the
   single root under the product's flattest stretch. Cost: **M** (a read-model join + one new
   list surface + one band treatment; no contract change).
2. **Name the people.** Pre-acceptance requests name the asker (E3); Green Goods name/profile
   resolution wherever `AddressDisplay` renders, and `AddressDisplay` adopted in admin pooling
   rows with a worded relationship (E4/A6). Cost: **S–M** for the UI; the name-coverage question
   is Afo's (W2).
3. **Scope the pool list to the living.** Default the Pool tab to live rows with settled ones
   folded behind the existing chip grammar (E5). The daily surface becomes calm and decidable at
   season volume. Cost: **S**.

---

## 6. Improvement backlog (both halves, ranked)

| # | Finding | Severity | Effort | Owner lane |
|---|---|---|---|---|
| 1 | E1+E2 — pooling events have no arrival surface; kept lands silent | erodes-quality | M | ui_client |
| 2 | E3 — requests never name the asker (band + empty People card pre-acceptance) | erodes-quality | S | ui_client |
| 3 | A1 — row-level "Expire now" fires with no confirmation naming blast radius | erodes-quality | S | ui_admin |
| 4 | E4+A6 — hex people at human moments; admin rows lack AddressDisplay; "→" glyph | erodes-quality | M | ui_client + ui_admin |
| 5 | E5 — pool list has no liveness scope; terminal rows interleave live ones | erodes-quality | S | ui_client |
| 6 | A2 — 32 px admin act targets (buttons/chips/search/rail quantified) | erodes-quality | M | ui_admin |
| 7 | C2 — es/pt at 320: Next label clips glyphs; cycle select truncates; tab labels clip | erodes-quality | S | ui_client |
| 8 | E7+E8 — evidence invisible outside the confirm sheet; act label precedes the look | erodes-quality | S/M | ui_client |
| 9 | C1 — garden tabs lack tablist/selected semantics | erodes-quality | S | ui_client |
| 10 | E10 — queued creation: calm card in pool vs warning banner in drawer | erodes-quality | S | ui_client |
| 11 | A4 — native checkbox + fifth tone use in SeedStepProof (AdminCheckbox exists) | erodes-quality | S | ui_admin |
| 12 | E6 — pinned garden hero halves the pool reading window | polish→W2 | M | ui_client |
| 13 | E9 — composer ending doesn't echo the thing made | polish | S | ui_client |
| 14 | E11 — row stutter: doubled direction/state word, uniform clock icon, terminal "moves this forward" copy | polish | S | ui_client |
| 15 | A3 — three stat cards vs one-card count grammar (or amend the rule) | polish | S | ui_admin / design skill |
| 16 | A5 — Title-Case contract vs sentence-case shipped titles (pick a side) | polish | S | design skill |
| 17 | A8 — Hub act "Confirm" → "Confirm kept" | polish | S | ui_admin |
| 18 | A7 — AllocationEditor group error unassociated | polish | S | ui_admin |
| 19 | E12 — same-day campaign date range "Apr 12 – Apr 12" | polish | S | ui_client |
| 20 | C3 — 32 px proof-composer back control (vs 40 px shell back) | polish | S | ui_client |
| 21 | X1 — `check:browser-verification-policy` red (3 AGENTS.md files) | polish | S | docs |

Directions only; no implementations proposed. Item 12's severity is a Wave 2 call.

---

## 7. Wave 2 shortlist — the calls only Afo can make

1. **What is "the pool" called in es/pt?** The tab says **Compromisos/Compromissos** while body
   copy says **"el pool"/"o pool"** 27/33 times — two names for the container inside one locale,
   and the tab name collides with the commitments themselves. Evidence: `es.json:1924` vs the
   `del pool` family. Pick the noun; the catalogs follow.
2. **How much ceremony does "Kept" deserve?** The confirmer gets a check-circle moment; the
   provider gets a quiet band; the hero-moments list in `language.md` doesn't include a kept
   commitment at all. Backlog #1 adds the arrival; whether the moment itself should be *hero*
   (garden-journal warmth) or stay quiet is taste. Evidence:
   `client-commitment-1011-…-tall.png` vs `client-ConfirmSheet-Kept-light-320.png`.
3. **Bless admin dark mode?** It renders coherently with correctly flipped tokens
   (`--m3-surface` → `17 12 8`; probes + full dark capture set) — seeded lead 4's fear did not
   reproduce. Supported surface (add to 4.6 proof matrix) or explicitly light-only?
4. **Casing: which side moves** — interaction-patterns' Title Case or the console's shipped
   sentence case? (A5.)
5. **Count-card grammar** — keep the three stat cards and amend interaction-patterns § 5, or
   unify to the one-card column row? (A3.)
6. **The pinned garden hero** (E6) — collapse-on-scroll changes the garden's presence; feel call.
7. **"NEEDS YOU"** — the amber all-caps marker is honest and effective; is the intensity right
   for the journal register?
8. **"Confirmed by 0x…" fallback** — until names have coverage (W2 of finding E4), should an
   unnamed confirmer render as "a neighbour" / "your steward" rather than hex at the payoff?

---

## 8. Functional defects observed in passing (routed, not chased)

| # | Observation | Route |
|---|---|---|
| F1 | `Admin/Pool/CommitmentDialogPanel` **Detail story crashes** — `useNavigate() may be used only in the context of a <Router>` at `CommitmentDialogStates.tsx:148` (reproduced twice; `check:story-quality` passes structurally). Evidence: `admin-CommitmentDialogPanel-Detail-light-1280.png` | ui_admin |
| F2 | Composer "Where it runs" **defaults to cycle-less** while the fixture Season is open — looks like the PR-749 thread class ("rewritten to first open cycle") not holding in the demo world; verify against real data | ui_client / functional wave |
| F3 | Demo world: garden-work cast says "This garden has no registered actions yet" for a garden with real actions — step-2 adders unreachable under fixtures | shared (demo-gate) |
| F4 | Demo world: pool charter document doesn't resolve — status card renders its (correct) read-failure branch under fixtures | shared (demo-gate) |
| F5 | ConfirmSheet proof-count contradiction (detail "2 proofs" vs sheet "No proof has been attached yet") — Wave 1's defect, still reproducing live | ui_client (already routed) |
| F6 | Console: 5–6 × `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin` resource errors per client/editorial route on the dev stack | functional wave |
| F7 | Viewer identity mismatch: detail People card marks `manada.eth` as **You** while the sheet's named group marks `0x12…890` as **Your turn** (mockAuth=user, fixture 1020 family) — fixture seat mapping or real seat bug | functional wave |
| F8 | `/impact` evidence titles carry raw ISO timestamps ("Workshop Delivered - 2026-08-22T16:09:03.607Z") — attestation **data** quality, publicly visible | ops/Afo |
| F9 | Editorial § 01 Show-more keyboard-focus drop on final page — already recorded in #748 as a follow-up; still open | ui_client (recorded) |
| F10 | Composer review still renders "**1 hours**" (singular-unit class; rows were fixed in `1e34e39e2`, the review line was not) | ui_client |

---

## 9. Seeded leads — dispositions

1. **AdminTabRail scroll/overflow** — **cleared (fixed at head)**: `1e34e39e2` added
   scroll-active-into-view (`AdminTabRail.tsx:70-72`); measured `activeInView=true` at 465 *and*
   375 on Garden(Pool) and Hub(Confirm); Garden@465 overflow is now 4 px (was ~31), Hub@465
   47 px — rails scroll by design. Residue: no visual scroll affordance (fade/chevron) — minor,
   fold into Wave 2 if felt.
2. **`size="sm"` under 44 px** — **confirmed, quantified** (A2 / backlog 6): 32 px buttons and
   chips, 38 px search, 40 px dialog footers, 42 px rail tabs.
3. **`aria-describedby` absence** — **cleared**: every measured `aria-invalid` field links its
   supporting text. Residue: AllocationEditor's group-level error (A7).
4. **Admin dark unproven** — **attempted and it works**: tokens flip correctly
   (`--m3-surface` `255 255 255` → `17 12 8`), full dark capture set renders coherently, live
   console verified in dark. Decision to *bless* it → Wave 2 W3.
5. **Editorial dark panel** — **holds**: panel-darker-than-canvas is consistent across the § 02
   states (accepted #748 deviation; no new divergence).
6. **Row title truncation at 320** — **held**: proper ellipsis truncation in fixtures and the
   `CommitmentRow/Named` story; the `4395dfd14` fix did not regress.
7. **PublicEvidencePipeline** — **verified**: five stages, localized copy confirmed in en and
   live es (pt via the 4-part locale gate), no hardcoded-tone/3-column residue at any width.
8. **§ 01 Show-more focus** — **still open as recorded** (F9): § 02's version has the focus
   pattern; § 01's does not.
9. **Prototype flow-audit leads** — all four re-verified against shipped code: request-wearing-
   offer-identity **fixed** (first-class seat, `acts.ts`); always-on "See Team and Contributions"
   bar **gone** (single-act bar); "Cycle:" **absent from member copy** (admin seed keeps an
   internal "Cycle" label — sanctioned steward dialect); the on-chain-sync sentence **replaced**
   ("Saved on this phone and waiting to send…"). Additionally: composer step 2's two-measures
   tension is **mitigated** (explained once, up front, and only on the garden-work cast); the
   unlabeled step-3 arrow is **fixed** (worded "Next" on every step).

---

*Audit only. Working-tree writes: this report, `evidence/qa-experience-audit/**` (59 files,
3.5 MB — fixture/Storybook captures + measurements JSON; live captures with real fork records
stay outside the repo in the session scratchpad), and the append-only block in
`handoffs/claude-qa-pass-1.md`. Nothing committed.*

---

## 10. Addendum — Wave 2 intake from Afo (2026-08-25), validated

Eleven observations from Afo's first read, each validated against code and captures the same
day. Where an item names a direction the audit had held back as a taste call, it is now recorded
as **decided**. Backlog numbering continues from § 6.

**AD-1 · "No clear way for a gardener to view commitment history; should be a tab in the
commitment sheet." — validated, with a naming twist.** The surface exists:
`CommitmentsDrawer` → **"Over time"** ([OverTimeTab.tsx](../../../packages/client/src/views/Home/CommitmentsDrawer/OverTimeTab.tsx))
holds exactly the settled record ("Your record · N kept · N lapsed" + settled rows by garden).
That the product's own designer did not recognize it as history is itself the finding: the label
says duration, not record. Two layers: (a) rename/reframe the tab so it announces history
("History" / "Record"), effort **S**; (b) the audit's deeper gap stands — there is still no
**per-commitment** timeline on the client detail (the admin inspector has one; the member gets
only the band + provenance), effort **M**. → backlog 22.

**AD-2 · "Admin app-bar title for each tab is too large." — validated as a spec decision, not
drift.** The route header h1 renders `text-title-lg` (22/28, weight 600) —
[PageHeader.tsx:108-115](../../../packages/admin/src/components/Layout/PageHeader.tsx) —
exactly what `packages/admin/DESIGN.md` prescribes ("route header title is title-large, never a
display size"). Shrinking it means moving the spec'd role (e.g., to title-md 16/24) in both the
component and the admin DESIGN typography table, in one change. → backlog 23.

**AD-3 · "Remove the History tab on the Hub." — validated.** `PIPELINE_STAGE_CONFIG`
([hub.utils.ts:123-155](../../../packages/shared/src/hooks/admin-ui/hub/hub.utils.ts)) carries
five stages ending in `history`. Removal also touches the fixed-action comment ("Submit work is
the fixed primary across Work, Assess, Certify, and History") and the Hub `--history` route
stories. Decided direction. → backlog 24.

**AD-4 · "Hub tab order should be Confirm, Work, Assess, Certify." — validated.** Current order
is Work → Assess → Certify → Confirm (→ History). Reorder is config-local in the same
`PIPELINE_STAGE_CONFIG`; stage ids and routes keep working. Decided direction. → backlog 24
(one change with AD-3).

**AD-5 · "No Pools tab in Community; use the Coordination tab for pooling elements." —
validated.** Community renders Members / Coordination / Endowment / Payouts / **Pools**
([Community/index.tsx:101-133](../../../packages/admin/src/views/Community/index.tsx)); Pools is
#752's W12 mode (Protocol pool / This garden). Folding it into Coordination is an IA revision of
W12 — keep its two invariants when it moves: exactly protocol + current garden (never another
garden's pool), and the one-sentence privacy banner ("Only these rows reach the team; no other
garden's pool is browsed here."). Decided direction, effort **M**. → backlog 25.

**AD-6 · "The admin search dialog should not shift size as you input." — reproduced and
measured.** Typing "commitment" letter-by-letter: dialog height 362 → 338 → 250 → 158 px, and
because the dialog is center-anchored its top edge — the input the user is typing into — drifts
down 219 → 321 px. Clearing restores 362 px. Root: content-sized, vertically-centered dialog.
Direction: top-anchored panel with fixed height (results scroll inside), the standard
command-palette shape. Evidence: `live:admin-command-palette-pool-light-1280.png` +
measurement log. Severity **erodes-quality** · effort **S**. → backlog 26.

**AD-7 · "Garden Pool tab says 'Commitment pooling is not on this chain yet' though all pools
are registered." — validated; two separate things.** (a) The *behavior* is the intended
build-time availability gate: `green-goods-projections.json` holds chain 42161 at
`deployed-not-available`, so `selectCommitmentPoolingAvailability` disables the surface and
`PoolStatusCasts` renders its unavailable cast. Turning the console on is the deliberate
ledger-flip release step — not a UI defect. (b) The *copy* is wrong about the world: the module
and 18 registered pools **are** on this chain; what is missing is the app-side switch. The cast
(`cockpit.garden.pool.unavailable.title`,
[PoolStatusCasts.tsx](../../../packages/admin/src/views/Garden/Pool/PoolStatusCasts.tsx))
should say the app hasn't switched pooling on here yet, not blame the chain — a steward reading
today's sentence will file a bug, as Afo just did. Copy fix **S**; the flip itself stays a
release decision. → backlog 27.

**AD-8 · "Editorial § 02 on /impact and the garden page puts content in a card instead of on
the background; design better." — validated, and it reverses a recorded decision.** The audit
observed the same structure fact: § 02 is the **only** card-wrapped section on both pages
(§ 01 field notes, proof markers, § 03, § 04 all sit on the linen). The `EditorialPanel` was
the #748 design pass's deliberate choice ("the panel the approved hi-fi specifies"); Afo, as
design authority, now supersedes it: § 02's record should compose directly on the canvas in the
page's own grammar (headers on linen, hairline dividers, stat rows like § 01's proof markers).
Redesign, effort **M**, editorial lane. → backlog 28.

**AD-9 · The evidence-cycle redesign ("From plan to public proof") — validated and drafted.**
At 1280 the five columns confirm every symptom: unequal body lengths leave ragged, unlevel
columns; "Impact Certificate" wraps and drops its title a line below its peers; the title
underline collides with two of the five headings; the closing loop-line hangs inside the fifth
column (`evidence/qa-experience-audit/editorial-PublicEvidencePipeline-Default-light-320.png` +
the 1280 capture in the sweep). Decided direction: **four steps — Needs → Commitment → Work →
Learnings** — fusing confirmation into Work and renaming the certificate step. A grounded
draft, honest to the protocol (baseline Assessments do gate pool readiness, so needs-first is
truthful; confirmation stays an *eligible confirmer*, per § 3 discipline):

> **§ 03: The cycle — "From need to learning, season after season."**
> *Each Garden moves through four stages and starts again. The cycle is what turns a place's
> needs into something the public can verify.*
>
> **1 · Needs** — Every season starts from what the place and its people need. A baseline
> Assessment records the starting conditions and what counts as good, so change can be seen
> against them.
>
> **2 · Commitment** — Work begins as a commitment to someone. A neighbour offers help or asks
> for it, another takes it up, and the Garden's pool records who will carry it out and by when.
>
> **3 · Work** — Gardeners do the work and document it as it happens — photos, measurements,
> notes. The person it was for, or another eligible confirmer, records that it was kept.
>
> **4 · Learnings** — Assessments return to measure what changed against the baseline. What was
> learned, and the approved Work behind it, anchors into a portable public record built to
> outlast any one platform.
>
> *→ and what was learned shapes the next season's needs.*

Layout directions with it: four equal columns, level at every width; descriptions held to the
same length band (~25–30 words, as drafted); number chips baseline-aligned with their titles;
the loop-line as a full-width footer under all four columns, never inside the last one; the
title-underline collision fixed. Copy note: "Learnings" and the loop-line are Afo's naming to
confirm on final read; "Impact Certificate" survives inside step 4's body on the linked deep
page rather than as a stage name. Effort **M**, editorial lane. → backlog 29.

**AD-10 · "Remove the image zoom on hover across the editorial site." — validated, four
sites.** `group-hover:scale-[1.03]` on
[PublicGardenCard.tsx:71](../../../packages/client/src/components/Public/PublicGardenCard.tsx),
[PublicActionCard.tsx:47](../../../packages/client/src/components/Public/PublicActionCard.tsx),
[PublicEvidenceCard.tsx:132](../../../packages/client/src/components/Public/PublicEvidenceCard.tsx),
and [PublicGardenRow.tsx:103](../../../packages/client/src/components/Public/PublicGardenRow.tsx)
(the last also missing the spring tokens the other three use — it would have been an
inconsistency finding even before the removal decision). Decided direction, effort **S**.
→ backlog 30.

**AD-11 · "Garden page sections need more height in empty/error states; too compact." —
validated.** Empty casts render as a single italic line directly under the section header
(§ 03 "No Impact Certificates yet…", § 04, and § 01's empty) — the section ordinals stay
stable but an empty section reads as a footnote rather than a held space. Direction: a minimum
body height / breathing room for empty and error casts so absence reads as a kept place in the
record (matches the dialect's "an absent thing says it is absent" intent). Effort **S**,
editorial lane. → backlog 31.

### Backlog additions (continuing § 6)

| # | Finding | Severity | Effort | Owner lane |
|---|---|---|---|---|
| 22 | AD-1 — drawer history: rename "Over time" so it reads as history; add per-commitment timeline on the detail | erodes-quality | S + M | ui_client |
| 23 | AD-2 — shrink the admin route-header title role (spec + component together) | decided-polish | S | ui_admin + design skill |
| 24 | AD-3/AD-4 — Hub stages: drop History, reorder to Confirm · Work · Assess · Certify | decided | S | ui_admin |
| 25 | AD-5 — retire Community ▸ Pools; pooling elements live in Coordination (keep the two-pool privacy invariants) | decided | M | ui_admin |
| 26 | AD-6 — command palette: fixed-height top-anchored panel; input must not drift (362→158 px, y 219→321 measured) | erodes-quality | S | ui_admin |
| 27 | AD-7 — availability cast copy misattributes the gate to the chain; say the app hasn't switched pooling on here yet | erodes-quality | S | ui_admin (copy); flip = release decision |
| 28 | AD-8 — § 02 editorial record moves out of the panel onto the canvas grammar (supersedes the #748 EditorialPanel choice) | decided | M | editorial |
| 29 | AD-9 — evidence cycle: four steps (Needs · Commitment · Work · Learnings), level columns, equal copy lengths, full-width loop-line (draft above) | decided | M | editorial |
| 30 | AD-10 — remove `group-hover:scale-[1.03]` image zoom (4 components) | decided | S | editorial |
| 31 | AD-11 — minimum body height for empty/error editorial sections | decided | S | editorial |

Three Wave 2 shortlist questions are effectively answered by this intake: W2's register question
leans further toward warmth-with-restraint (Afo's items are all calm-and-grounded moves), and
AD-8/AD-9 settle how § 02/§ 03 editorial pooling content should sit. The remaining shortlist
questions (es/pt "pool" noun, admin-dark blessing, casing side, count-card grammar, pinned
hero, NEEDS YOU intensity, unnamed-confirmer fallback) still await calls.
