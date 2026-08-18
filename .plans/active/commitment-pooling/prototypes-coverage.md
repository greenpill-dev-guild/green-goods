# Commitment Pooling Prototype Coverage

Updated 2026-08-17, round 26 (value over time: a commitment is the unit of accountability and ends, while an ongoing offer is the unit of VALUE whose worth is the pattern no single commitment can express. The public record is numerator-only, which is a rule and not a style: D.3 forbids per-person rates and what enables them is a denominator, so "Running since March · 12 sessions given · 9 neighbours took one up" is publishable where "4 kept · 1 lapsed" is not. A per-person denominator with a progress bar, added to W34 one round earlier, was caught and removed. The record now leads W34 and rides the pool card where the decision happens, and W3@repeat-noticed lets a repeat become a practice from here on while saying plainly that past one-offs cannot be gathered up. Round 25 the same day: the carousel's left padding (scroll-snap was eating it), one shape for the step-3 people sections, the step-3 info card, "Commitments" not "Open commitments", ongoing offers landing on the pool tab, card media squares becoming photographs, and em-dashes leaving the offer-flow copy. Previous round 2026-08-17, round 24 (the three Offer flows, after Afo's eight-item review: cycles gained their own chip tone — one hue at two weights, season filled and campaign outlined — because admin had been drawing `chip("Campaign", "request")`, the Request tone exactly, so a campaign tag and a request tag were the same colour, while the client carried the cycle as prose in the meta line and had no tag to colour at all; Who confirms moved off the bottom of the review into step 3, which now asks who confirms · team · media, and the review follows under a rule worth keeping — it reads in the order you filled it in, with Team shown in a review for the first time; the five queued outcomes had five compositions and are one screen now, the pool tab with your new card at the top, with the offline banner removed everywhere rather than added everywhere; tap-first pickers became controls (`pickRow`) instead of chips, since `.ch`'s box reset deliberately defeats the 44px minimum; "places" retired as a noun — a second name for a thing that already had one, absent from the glossary and the contract, and introduced before it was defined; the ongoing offer is tied to a season with NO contract change, because CommitmentSeries has no cycleId but every Commitment it opens does; and W34 became a commitment view on W2's identity card. Previous round 2026-08-17, round 23 (photographs: two surfaces were drawing a description of a thing where the thing belongs. The team card was a CSS collision, not a taste call — `memberTile` and `mediaStrip` both emitted `class="mtile"`, and `.hf.s-client .mtile` outweighs `.hf .mtile`, so every member card on a client screen rendered at the media tile's 60×78 with its name and account boxes computing to 2px: a green square with one letter in it. Media's class is `.mthumb` now, and the carousel — right for space — holds `memberCard`, GardenMemberItem's own layout at 216px: photo, name, account, role, remove. Registered-date dropped (a team being assembled, not a membership record); role kept, because exactly one member is the accountable leadProvider. Avatars became photographs everywhere, since Gardeners.tsx resolves `member.avatar || ensAvatar || /images/avatar.png` and never an initial. Media stays ONE list, with the picture on the photo rows at 44px and tappable into `ImagePreviewDialog`; read-only strips carry real thumbnails on every review and on the commitment view, while a voice note, link or written note keeps a dashed tile carrying its kind as a glyph. The preview is a dialog, not a route: it renders the state underneath verbatim and adds an overlay, counts photos only (`photoOnlyData`), and draws an arrow only where there is a neighbour. Previous round 2026-08-17, round 22 (actions and roles on the commitment view: garden work now offers BOTH `Submit work` and `Add evidence` in one bar, weighted so the primary is the one that advances readiness; a contributor's seat exists for the first time (`W2@contributor`) and carries BOTH work and evidence — linkWork admits an active contributor and verifies the Work attester is one, so their approved work counts; what stays the lead's is sending, and confirmation excludes contributors absolutely; the active stage splits by viewer the way `ready` already did, so a confirmer is no longer offered the provider's button (`W2@active-waiting`); and `Send for confirmation` gains a confirmation step naming what it does — submitForConfirmation freezes the contributor roster and stops further evidence counting. Previous round 2026-08-17, round 21 (commitment-view top half: four bare canvas rows become ONE identity card — title, kind/state/domain chips, the people as named rows, and beneath a rule the completion picture. Terms deliberately stay in Details rather than repeating. The progress block is where the two readiness paths finally become legible: requirement counts carry bars because approved work advances a DomainImpact commitment, while evidence sits under a hairline with no bar because it credits contributors without moving readiness — attachEvidence has no kind gate, but submitForConfirmation rejects DomainImpact. Browse views omit the block entirely. Also fixed a regression this round introduced in round 15: memberRow had taken the `.mrow` class the meter already used, so every meter caption had been rendering inside a bordered card. Previous round 2026-08-17, round 20 (Submit Work fidelity: the prototype's drawing of the SHIPPED work flow was wrong in three places and is corrected against the files. Media mirrors Media.tsx — count badge, Needed and Optional pill groups, image tiles — instead of a dashed card over a row list. Details drops the "Fulfills a commitment" row and shows the inputs the CHOSEN ACTION declares, since the commitment is picked at the intro; the fulfills picker and the linked details twin retire with it. Review adopts the WorkView anatomy like every other review. The flow itself is unchanged — only its drawing. Previous round 2026-08-17, round 19 (details-step polish: the dashed tap-to-add surface retires — adding is what the bar is for; the details step becomes Team over Media, where an empty team is a full-width button and a populated one is a carousel with the add demoted to a plus in the section title; the primary loses its label to an icon, since five adders plus a word squeezed it to nothing; and ONE section-title style now runs the whole client — .t-sec took .h6s's metric, so what you're offering, how much, add details and review and commit all render at 11px uppercase, matching WorkView's h6. Previous round 2026-08-17, round 18 (admin cycle-view round: `W7C` gives a steward the same three questions `W1C` gives a gardener — the cycle's commitments, who took part, what its assessments recorded — in the console dialect: the two-column workspace split, quiet status chips, Title Case acts, no hero. The season card's header is now a door. The one deliberate divergence is D.3's steward placement: the console's People tab additionally shows each member's own pool history as counts, which the client's does not. Previous round 2026-08-17, round 17 (cycle-view round: a season or campaign becomes a place you can go — `W1C`, with its details on top and Commitments / People / Insights beneath. The pool tab stays scoped to LIVE cycles and now shows every commitment belonging to them whatever state it reached; ended cycles trail the live ones in the carousel with an All-seasons card after them. `W1@cycle-summary` retires into the new view — a finished season had been a MODE of the pool tab rather than somewhere you could navigate. The People tab names who took part and their role, which is what D.3 permits; each person's own kept/lapsed record stays between them and their stewards. The Insights tab leads with the assessments that bracket the cycle and the shift between them, then aggregate figures per unit basis — never a per-person score. Previous round 2026-08-17, round 16 (review-anatomy round, CORRECTING rounds 12 and 13: `views/Garden/Review.tsx` renders `<WorkView>`, not a flat card — FormInfo, an h6 per section, one `FormCard` per detail — so all eleven reviews were rebuilt on it and reviewing a commitment now looks like reading one. With it: team moved from the Advanced detour to the details step; the action picker became the `selCard` rail the Submit Work intro uses instead of a 2×2 grid; counts anchor at each card's foot so a wrapping description no longer misaligns them; every adder moved into the fixed bar. Also found: `W2`'s kind/state/domain chips were computed on every render and never rendered. Previous round 2026-08-17, round 15 (team round: team becomes ONE surface — policy and invites before anyone accepts, roster afterwards — retiring `W3@step-invite` and the Advanced detour's team block; adding people is a sheet built from the shipped garden Gardeners item (new kit builder `memberRow`), scrolled and tapped rather than one address typed into a field; names lead and a wallet address appears only when nothing better is on file; the contributor kind gate is fixed so a service commitment finally has a team surface, with only `setContributorRequirement` staying garden-work-only; and recognition states the policy instead of ranking teammates by percentage. Previous round 2026-08-17, round 14 (vocabulary round: the record is a **Commitment** everywhere, amending uiux-spec §3's "promise" choice to match the canonical glossary, whose `Commitment` entry lists the client among its audiences. 843 replacements plus five builder renames (`commitmentCard`, `commitmentRow`, `commitmentSlide`, `CommitmentCast`, `w7Commitments`); zero "promise" left in rendered artifact text. Untouched: `promiseKeptRate` (a contract/indexer field) and the hotspot ids and state keys carrying the old word, which are deep-link addresses. The verb is "commit" — three strings needed the verb form. Surfaced a latent validator bug: the Appendix D.1 tripwire guarded "promised units", which no surface had ever rendered, so it was blind from the day it was written; it now guards the invariant's two real shapes. Settled and NOT built: the shipped work-submission flow does not change, so the four prove-it alignment fixes are dropped.) Previous round 2026-08-17, round 13 (flow-alignment round: every creation path now runs Submit Work's four beats without exception — the steward ask's Support step folded into step 2 beside the amount and who-can-take-it, retiring `request-support` and taking that path from five steps to four. The evidence flow (W2a) stays at three steps, which is right: work submission's step 1 picks an action and a garden, and evidence arrives from a promise that already fixed both. What it gained is the shared grammar — its review became ONE flat card led by the promise being proved (it drew three carded sections and never named its subject); note and link stopped being form fields on step 2 and became items in the step-1 list beside photos and voice notes, so everything attached composes into one set; step 2 is now the single question only it can answer and is named for it, "Who helped"; the queued and failed outcomes stopped rendering the review step's progress bar; the capture step gained its offline banner; and the work flow's "2 of 1 needed" chip reads "2 added · 1 needed". Creation and evidence now share one `captureBody` and one `captureBar`.) Previous round 2026-08-16, round 12 (creation-flow round, after Afo's client review: the W3 composer
runs the shipped Submit Work rhythm on every path — What · How much · Details · Review. Scope
stopped wandering (it was `field("Season")` on step 1 for garden work, `field("Campaign")` on
step 2 for services, `field("Scope")` on step 2 for ongoing — one thing under three names in two
places); the protection step folded into step 2 (`step-anchors`, `request-anchors`,
`request-variant`, `request-variant-steward` retired — proof rows and who-can-take-it were the
same slot in different clothes, and both answer step 2's question); details became a real
numbered step on all five paths (`step-details` renumbered plus `support-details`,
`support-details-ongoing`, `request-details`, `request-details-steward`, `request-work-details`)
instead of an unnumbered detour that highlighted step 1's dot while you were on it; How often
moved to step 1 beside the kind cards; and every review adopted `views/Garden/Review.tsx`
literally — FormInfo over ONE flat card, the back arrow as the edit path, one hot row for the
Advanced detour, and the thirteen per-section `w3.edit-*` links retired. Step 1 went from seven
blocks to three. In the wallet, "Things I can offer" split by what its halves are: the private
saved draft became a tool row above the ledger, and the ongoing Offer's parent moved into its own
garden's section. The W1 filter row took one chip metric — the direction pills were rendering at
13px/44px next to a 12.5px Mine toggle.) Previous round 2026-08-16, round 2 (admin design-contract round, after Afo's second review + the
canonical admin UX brief: the design skill gained `admin-ux-brief.md` + `interaction-patterns.md`
and this round applies them — the Garden view header carries the SHIPPED stable action trio (View
public · Seed · Edit garden) on every state; the pool tab is a two-column split (left: triage +
Season/Campaign peers + promise rows; right rail: the Pool container card, Quick actions with the
two cycle doors, activity feed); action clusters are end-aligned by CSS everywhere; "Start a
season/campaign" is ONE three-step flow dialog (details → allocation → open) with seedCycle on
the details step — the small-dialog→wizard shell change is gone, as is the capture flow's jump to
W10 (the fallback confirmation completes in-shell); W8 is the client composer's cast (What → How
much → Proof & confirmation with the reward as its Advanced detour → sectioned Review); journey
entries tightened to true console homes (W8/W9/W10/W14 left ALLOWED_ENTRY; sb47 enters from the
Hub queue's new under-review row, sb17/sb33 from pool promise rows, sb8/sb8b through Seed → the
capture kind); sb57 retired per the assessments-stay-Hub-side decision; W12's protocol pool
adopted the same pool-tab anatomy with seeding as a dialog; the components tab reached shipped-
palette parity — 12 new entries (AdminViewActions, FabButton, AdminSideSheet, AdminSearchToolbar
+ AdminSortSelect, AdminListItem row anatomy, workspace split, MetaStrip, AdminCheckbox,
AdminSettingRow, AdminSelectableCard, AdminLinearProgress, AdminTooltip) and shipped names now
lead retitled entries.) Round 1 earlier the same day: W7 pool tab restructured — right-aligned header actions with the two cycle doors "Start a season"/"Start a campaign", peer Season/Campaign rows, pool lifecycle demoted to a Pool settings dialog; W11's recognition detour keeps the stable two-step rail (new RAIL validator rule); W26 converted from the lone full-page wizard to the flow-dialog shell and the 17-scene end-season ribbon split at its act seams into sb9c/sb9d/sb9e; HUBWORK grew the full approve/reject decision arc; W14 rebuilt timing-first with all three steps rendered; W9 gained the steward-fallback confirmation path, the not-a-member empty state, and the who's-who block (journey sb8b); W7M added as the phone presentation (FabButton speed dial → bottom sheet, journey sb60); PWA echoes trimmed to the consequence-only rule; stepDots retired with its W26 consumer.) Previous round 2026-08-14 (components-tab round on top of the pool-tab polish + card grammar + workflows rounds: the artifact gains its fourth tab — the full component gallery per the locked component-library contract — with kit consolidation (screen composites + steward-console builders promoted into `hifi/kit.ts`, statTiles dropped) and two pre-existing artifact fixes (the empty Screen-library key label; the editorial dialect's `.s-public` CSS never matching the `editorial` surface class). This is the human-readable screen-by-state audit for the self-contained hi-fi artifact. The executable registry in `hifi/screens/index.ts` remains authoritative; `hifi/validate.ts` fails the build for empty states, invalid journey references, orphaned hotspots, invalid navigation targets, echo scenes that carry an advancing control, missing chapter/role assignments, flow cards with a missing or over-long description, contract calls that are illegal for a state's declared pool/cycle/commitment/funding/settlement facts, action bars stacking two full-width buttons (one-row rule), review-visible flows whose first scene is not a drawn home surface, and — for the Components tab — gallery specimens that carry hotspots or enabled controls, gallery copy violating the same vocabulary/citation ceilings, and any kit builder missing its gallery entry (the coverage gate).

## Build snapshot

- 44 registered screens / 488 rendered states in the full source registry
- 37 presentation-visible hi-fi screens / 472 states: 19 Client PWA (301 states), 16 Admin console (166 states), 2 Editorial website (5 states)
- 709 registered hotspots
- 53 validated source flows / 316 scenes; 52 presentation-visible flows / 307 scenes: 20 Client PWA, 30 Admin console, 2 Editorial website
- 98 component entries / 182 static specimens on the Components tab (46 Client PWA · 38 Steward console · 4 Editorial), every entry anchored at `#components/<id>[@surface]` with shipping citation or net-new note; shipped-palette parity: shipping names lead admin entry titles
- States are grouped by **frame** in the switcher (2026-08-16 round 7): W2 75 states → 11 frames, W1 33 → 9, W7 31 → 8. Frames are a presentation grouping only — every state keeps its registry entry and §17 accounting, and each screen's default state is unchanged
- 0 build warnings

The build prints this snapshot on every run; when it disagrees with the numbers
above, the build is right. The per-screen table below drifted once already (W2
carried 24 states after two were added), so treat the build line as the source
and this file as its transcription.

**Restructure (2026-07-25).** Flows are grouped by the surface where their actor
acts — Client PWA, Admin console, Editorial website — and the End-to-end group is
retired: `sb3`, `sb4` and `sb6` split at their surface seam, `sb5` and `sb13`
re-homed to the client. A scene landing on another surface is marked `echo` and
drawn in "Meanwhile" chrome; validate.ts enforces that pairing in both
directions. Old `#sb3` / `#sb4` / `#sb6` hashes retire exactly as `#sb9` did.

**Self-contained flows + chapters (2026-08-10, register #93–#94).** Every flow
is now one person's action to completion. Echoes are read-only consequences —
validate.ts rejects an echo carrying a hotspot or alt — and cross-role
continuations hand off through end-of-flow branch links. Split-outs: `sb42`
Confirm a promise kept (from `sb1`), `sb43` request-provider side (from `sb2`),
`sb44` captured-member side (from `sb8`), `sb45` team formation (from `sb33`),
`sb46` garden-claim acceptance (from `sb13`), `sb47` not-yet resolution (from
`sb5`), `sb48` protocol-wide impact (from `sb15`); `sb29`'s recipient scenes
became read-only beats (the acted service confirmation stays walkable in `sb30`
and the W4 service cast). Flow cards cluster under lifecycle-ordered `chapter`
headings per surface tab with acting-`roles` chips replacing the old surface
badge; both vocabularies are renameable data in `hifi/types.ts`, checked for
referential integrity only. The Green Goods operations chapter renders
collapsed. The W3 wizard's default path compressed to four steps (three for
service/requests) with the pilot-default fallback ON and an Advanced detour;
`W3@step-confirmers`, `W3@step-confirmers-opted-in`, and
`W3@support-confirmers` retired in favor of `W3@step-advanced` (the `step-confirmers` name returned in the register #97a review rounds as the Advanced group picker, a different state from the retired numbered step). Old mid-ribbon
scene hashes (e.g. `#sb1/14`) retire exactly as `#sb9` did.

**Correction pass (2026-08-11, D1–D10 — uiux Appendix B addenda).** The client
catalog rebuilt to 17 canonical journeys, each starting at the surface its
actor actually enters (W1 pool tab / W5 wallet drawer / WFLOW Garden tab) —
enforced by a new validator entry-surface rule; cycle-state and offline
variants retired into the Screen library (old hashes retire per the `#sb9`
precedent: sb3a/7/16/26/28/30/36/38–41/44/52). The composer is entry-fixed
(Direction radio deleted; kind words + template prefill + optional Add-details
media/audio/note/links on step 1; How-often Just-once/Ongoing + exchange
detour on step 2; sectioned Submit-Work review anatomy with per-section edit
links; requests gained a real review step). **W33 retired** — the ongoing
wizard folded into composer states `ongoing-terms`/`ongoing-review`, with one
ordered `createCommitmentSeries` + place-creation queue sequence. W2a rebuilt
as MDR-parity capture (camera/gallery/voice note from the bar, link/note
kinds, multi-item, contributor chips kept). WFLOW expanded from one static
review state to the real four-step Submit Work flow plus the work-first
"Fulfills a promise" picker and the client link-existing-work picker
(`w2.link-work` no longer targets the admin console). Cards follow the D5
contract (creator by-line, real progress, one context action, roster
indicator; "Ongoing" chip + places-left); W32 gained its drawn entry from the
W5 wallet drawer; W31 retitled "Start from a template". Action bars are
kit-enforced one-row (validator-checked); the player restores catalog scroll
on flow exit.

**Iteration 2 (2026-08-11, register #102 — Afo's artifact review).** UI/UX
quality pass on the same structure: wizards wear the real Submit Work chrome
(`kit.flowHeader` — numbered FormProgress circles, close on step 1, back
after; dot rows retired); the kind choice is equal 2-up cards; choice rows are
equal-height. Ongoing folded INLINE — `W3@support-howmuch-ongoing` expands the
amount step and `support-review-ongoing` carries the Places section
(`ongoing-terms`/`ongoing-review` retired); the separate Ongoing chapter is
gone (its journeys live under Make an offer). **Exchange is parked**: no client
journey walks it, the composer detour and W31 "Exchange circle" row are
removed, W28–W30 stay as Screen-library reference. Requests are "Request"
everywhere ("Make a request" entry; steward cast adds a real Support step —
`request-howmuch-steward` → `request-support` → `request-variant-steward` →
`request-review-steward` — declaring G$ on the phone with existing
declared-consideration semantics). W2a is a true MDR variant (media → details
→ review states with cast-preserving review variants; tap-to-add capture
area). W2 detail gained the E5 anatomy: people row + team strip above the
fold and the ONE contextual primary in a fixed bottom bar across walked
states (inline duplicates stripped). The confirm walk ends once on
`W2@fulfilled` (duplicate kept-screen and editorial echo removed); the team
journey enters through the promise detail and `sb54` "Add people to your
team" walks the lead's roster add; `sb13` runs the full protocol arc through
`W2@garden-support-arrived`; change-of-plans split into `sb16` Withdraw an
offer / `sb6a` Offer it again; the campaign take-up journey folded into
`sb43`'s branches. The review catalog lays chapters out two-up on wide
screens.

**Catalog pass D3 (2026-08-11, Afo's second artifact review).** Two client
titles still fused two people's acts, so both split at the actor seam: `sb1`
"Make an offer and see it taken up" → `sb1` **Make an offer** (Maria's sitting,
ending at the queued card) + `sb55` **Take up an offer** (João's act from the
pool tab — the mirror the Take-up chapter was missing, which held the request
side only); `sb29` "Offer a service and prove it with evidence" → `sb29`
**Offer a service** + `sb56` **Prove a service with evidence**, which enters
from the W5 wallet like any promise picked back up days later and sits beside
`sb4a` in the Prove-it chapter. Old mid-ribbon hashes (`#sb1/6`, `#sb29/5`+)
retire per the `#sb9` precedent. Flow cards are now **title → description →
tags**: a written `desc` per flow replaces the persona line (persona still
shows on the stage pill and the Reference tab), and continues-in became a
muted tag beside the acting-role chips; validate.ts fails an empty or
over-long description. The `ask` chapter is **Make a request**, matching the
Make-an-offer label instead of the bare noun "Requests". The two-up catalog
gained a continuous rule down its gutter, drawn on the grid and rendered only
when a surface actually fills both columns.

**Catalog pass D3 round 2 (2026-08-11).** The same fused-title test applied to
the two remaining cards where the title covered two people: `sb5` "Say 'not
yet' and let the stewards resolve it" → **Say "not yet"**, ending where the
member's part ends (under review) instead of replaying the stewards' restore,
which `sb47` already echoes; and `sb50` "Attest and attach the assessment" →
**Attest a re-assessment** (the Evaluator-hat act, now entered from the Hub's
Assess stage) + `sb57` **Attach an assessment to a promise** (the steward's act
on the promise, which is what re-runs readiness). Three titles that join two
verbs stay as they are, because each is one person's single sitting: Ready the
pool and open the season, Dispatch queued support and close the loop, Recognize
and pay a commitment team.

**Member-funded claims (2026-08-11, register #103).** `sb58` walks Maria from a
priced Offer through claim, steward-created pledge, garden-Safe deposit
instructions, recorded deposit, and accepted funded claim. `sb59` walks the
Garden Steward's matching checkpoint through `recordFunding`, deposit
recording, ordered acceptance plus consumption, terminal refund eligibility,
the ordinary W21/W22 Refund child, and Maria's authenticated returned-state
echo. Net-new `W36` and `W37` keep member and steward decisions separate. The
validator now carries the exact funding-state vocabulary and the four new ABI
calls; `Refund` is appended to the disbursement-kind union. The transfer itself
remains an external wallet act, and only the steward's checked record advances
funding to `DepositRecorded`.

**Pool-tab doors are one word each (2026-08-11).** "Offer support" / "Make a
request" → **Offer** / **Request**: the wizard each door opens is already
titled Make an offer / Make a request, so the button no longer repeats the
verb. The saved-offer review row's Direction value follows.

**Retired journey routes now redirect (2026-08-11).** A split moves scenes
between flows, and the player clamps an out-of-range index — so an old
`#sbX/i` link used to open the shortened flow's last frame and read as the
wrong answer. `SB_ROUTE_ALIASES` in `hifi/journeys.ts` maps every route these
splits moved — with two 2026-08-14 exceptions: the floating-door beat regrew
scene indexes `#sb1/6` and `#sb29/5`, and a real route wins over a redirect,
so those two hashes now land on live scenes one branch-click from their old
destinations (the end-beats link to sb55/sb56). The remaining maps
(`#sb29/6–11` → `#sb56/2–7`, `#sb5/4` →
`#sb47/1`, `#sb50/2` → `#sb57/1`) and the player rewrites the address bar to
the canonical hash, so a shared link heals itself. validate.ts fails the build
if an alias shadows a live route or points at a scene that does not resolve. A
scene that only shifted index inside its own flow is deliberately not aliased
(`#sb50/1` opens the attest walk's own delta frame — same story, one screen
later), and a flow id retired outright (`#sb3`, `#sb9`, `#sb52`…) has no
honest per-scene answer, so it lands on the flow catalog instead of the silent
doc-tab fall-through it used to hit.

Community `C*` wireframes and the September Need→triage flow remain registered, validated, and directly addressable, but are hidden from the presentation catalogs until their high-fidelity pass.

**Lifecycle audit closure (2026-07-25).** State metadata now declares the
relevant pool, cycle, commitment kind/state, or settlement state.
Audited lifecycle-sensitive write hotspots declare ordered `calls`; the build
simulates claim, evidence, assessment, cancellation, dispute, reward, pool,
cycle, settlement, batch, dispatch, and retry calls and rejects illegal source
states, kind mismatches, compound-order violations, contradictory result-state
facts, and changes to overlapping facts a call does not touch. The same pass
adds guided walks for campaign opening and
member use, Community→Garden navigation, assessment entry, settlement
registration, route-gate inspection, batch creation/cancellation, and
individual requeue/cancellation.

Paused wind-down is an executable regression fixture: `closeCycle`,
`compostCycle`, and `cancelCycle` advance only the cycle, while every
confirmation, wizard step, result, and member echo keeps the pool Paused.

`sb9` was split into `sb9a` (pool readiness → season open), `sb9b` (pause and resume),
and `sb9c` (end a season — close, compost, or cancel). One 33-scene ribbon covering seven
stewardship tasks left a reviewer with no chapter to orient against mid-flow.

**Promise cast (2026-07-25).** The commitment detail, evidence sheet and
confirmation sheet carry six casts, and identity follows the promise rather
than the fixture: the neighbour-to-neighbour **offer** (Maria → João, 6 hours),
the **request** (Ana asks, João provides, Ana confirms — 1 ride), and the
evidence-only **service offer** (Maria provides, João confirms — 1 repair
session), the Campaign-scoped request, the steward-recorded
**StewardCaptured** promise, plus the
**garden-provided** protocol commitment (Awka Hub provides, protocol stewards
confirm — 1 survey). A request that renders offer copy mid-flow is a fiction
break, not a styling detail: direction, title, unit and cast all differ.

**Group architecture (2026-07-28).** `W2b` makes the accountable lead, contributor roster,
contribution record, roster freeze, and recognition preview directly reviewable. `W3` renders
repeatable action/count requirements without a four-item product rule. `W10`, `W11`, `W21`, and
`W23` keep recognition, garden retention, contributor child payouts, partial recovery, and the
member receipt linked but distinct. SB-33 walks the complete cross-surface path.

**Tap-first inputs (2026-08-10, register #95).** Reason-taking dialogs lead with
common-reason chips that fill the still-required reason field; wizard unit,
amount, and due are chip/radio picks with typed escapes on every path; evidence
credits contributors from roster chips; `W11` opens with the standard split
applied; `W23` send offers recent recipients and amount presets. Screen-library
cards now cluster under their registry group headings, flow cards pin role tags
to the card foot with continues-in as prose, the theme toggle is icon+text, and
opening any flow or screen scrolls the page to the top.

**Coverage closure round (2026-08-10 evening, register #96).** The request path is
a real three-step wizard (`W3@request-what` → `request-howmuch` → `request-variant`;
the garden-work ask later became its own four-step cast, `request-work-what` →
`request-work-review`, in the register #97a review round)
walked by `sb2`; every W3 state now uses the fixed Submit Work chrome — close +
progress header and bottom action bar as fixed frame, only the form scrolls.
The old "Decide & review" admin chapter split into Decide on promises / Work
review / Assessments: `sb4b` split at its actor seam into Approve the work
(steward) and `sb50` Attest and attach the assessment (evaluator), and `sb22`
regrew into Record the pool's baseline, ending at the readiness checklist it
satisfies. `sb49` covers the protocol pool seeding its own asks and offers to
gardens (`W12@seed-protocol`), completing the rail seed → claim (`sb13`) →
accept (`sb46`) → pay (`sb19`). Mid-flow member echoes in `sb9a`/`sb9c`/`sb10`
became branch links per the echo-trim assessment; single consequence echoes
stay. The artifact's Implementation reference tab is now generated from this
registry on every build — flow and screen indexes with calls, cites, and
walked-by — retiring the drifted hand-written `prototypes.md` rendering. The
same-day contracts audit (all calls implemented on-chain under exact names —
58 once register #97 graduated `acceptExchange`)
corrected `DisbursementRoute` to mirror Solidity `FundingRoute { None,
ProtocolToGarden }` — the two dropped members were `DisbursementKind` values
misfiled as routes, and no call site ever used them. Requests gained their own
"Asks & requests" client chapter (`sb2` + `sb43`).

**Full-coverage round (2026-08-10 night, register #97).** The audit's approved
follow-ups all landed: the DomainImpact Request is drawable end to end
(`W3@request-anchors`/`request-work-review`, the `W2` request-work cast, and
`sb51`), the campaign-request cast has its guided walk (`sb52`), Ongoing Offers
gained their read-only admin context (`W7@series-view`, screen-library by
design), `MAX_CONFIRMERS` renders on both creation surfaces, `W26` names the
cycle-less certificate-ineligible row, and `W12` carries the register #34f
delivery-gate status row under its amended protocol-steward framing (uiux
§6.8). The exchange wave graduated into the registry — `W28`–`W31` with six
recovery-complete picker states, `acceptExchange` joined the ContractCall union
and CALL_RULES, and `sb35`/`sb36` walk pair creation → atomic acceptance →
counterpart-lapsed and template-first creation. Requests live under the
client's "Asks & requests" chapter; exchange screens under "Exchange &
templates" in the Screen library.

**Confirmation-path closure (2026-08-02; default superseded 2026-08-10).** `W3` and `W8` draw
the `protocolFallbackEnabled` choice — now ON by default for the pilot (register #94), with the
client control living in `W3@step-advanced` rather than a numbered step. `W2`, `W10`, and `W13`
distinguish ordinary, local `PoolFallback`, and Green Goods `ProtocolFallback` history with
actor/path/reason provenance. The validator treats both fallback confirmations as reason-taking
contract calls and requires the protocol-fallback fixture to preserve its Ready/Open/DomainImpact
facts; the unreachable-path guard is unchanged by the default flip.

## Presentation coverage classification

- `SB-35` and `SB-36` graduated into the executable hi-fi registry at register #97(f) as `sb35`/`sb36`. `sb35` walks W28–W30 from exchange-reference creation through atomic acceptance and independent post-acceptance lifecycles, including counterpart-lapsed derivation. `sb36` walks W31 template-first creation into the editable existing-primitives form. Both are build-validated and presentation-visible.
- `W2a` is guided-flow-covered: evidence composition is shown before evidence-submitted outcomes.
- `W16`'s states are walked by the editorial flow and `W5`'s by the wallet-drawer flow; only their error/loading states stay Screen-library-only because they are exhaustive drawer/editorial state references rather than consequential flow transitions.
- SB-5 walks the complete “Not yet” dispute lifecycle once. Request, Campaign-request, service-offer, and StewardCaptured variants remain Screen-library cast fixtures of that same call path so reviewers can verify identity and retry continuity without duplicating the journey.
- Guided flows own the primary transitions and consequential intermediate states, including the actionable open-pool empty state. Screen library owns exhaustive loading, non-action empty, validation, recovery, and alternate states.

## Cross-cutting recovery coverage

| Requirement | Built states |
| --- | --- |
| Loading / skeleton preserves layout | `W1@loading`, `W2@loading`, `W5@loading`, `W7@loading` |
| Not-found / sentinel recovery | `W1@not-found`, `W2@not-found`, `W5@not-found`, `W10@not-found` |
| Read error with retry | `W1@read-error`, `W2@read-error`, `W5@read-error` |
| Scope-named empty | `W1@empty-open` and `W1@no-season` are guided because they offer legal next acts; `W5@empty`, `W7@empty`, and `W13@empty` remain exhaustive Screen-library references |
| Offline queue / exhausted retry | `W1@queued`, `W1@support-queued`, `W1@sync-failed`, `W1@waiting-membership`, `W2@evidence-queued`, `W2@support-evidence-queued`, `W2a@queued`, `W2a@failed` |
| Saved-Offer persistence truth | `W32@draft-unsaved`, `W32@saving`, `W32@saved`, `W32@save-failed`, `W32@offline-local`, `W32@version-conflict`; only Saved claims cross-device durability |
| Confirmation outcome / retry | `W4@confirmed-pending`, `W4@confirmed`, request- and service-specific pending/synced variants, `W4@not-yet`, `W4@not-yet-failed` |
| Wallet send retention / retry | `W23@send`, `W23@send-pending`, `W23@send-failed` |
| Cycle banners | `W1@reviewing`, `W1@paused`, `W1@closed`, `W1@cancelled-cycle`, `W1@paused-cancelled-cycle`, `W1@cycle-summary`; reviewing and paused wind-down both have guided legal paths |
| Steward send / override / cancel | `W10@accepted`, `W10@mark-ready-override`, `W10@cancel` |
| Member-funded claim / refund | `W36@waiting-pledge`, `W36@deposit-instructions`, `W36@pending-acceptance`, `W36@funded`, `W36@refund-queued`, `W36@refunded`; steward checkpoints in `W37`; ordinary Refund child in `W21@refund-queued` and `W22@refund-dispatched` / `refund-confirmed` |

## Confirmation before consequence

Every irreversible pool, cycle, and settlement act names its blast radius and —
when the contract stores one — takes its reason before it happens. `closePool`
takes no reason (CS:556), so its confirmation is banner-only; validate.ts's
`REASON_CONFIRMS` enforces both directions (a reason-taking act must show the
field, a reason-less act must not invent one). Each control whose label ends in
`…` resolves to one of these, never straight to the outcome state:

| Act | Confirmation state | Blast radius named |
| --- | --- | --- |
| Pause pool | `W7@pause-confirm` | 23 members · 7 open promises · what stays open |
| Close pool | `W7@close-pool-confirm` | ends participation for 23 members · reachable only with zero live pool commitments and zero non-terminal cycles (`W7@cycle-composted`) · `W7@close-blocked-live` routes to wind-down instead · no stored reason |
| Close paused pool | `W7@paused-close-pool-confirm` | pool remains Paused through cycle compost · `closePool` alone changes it to Closed · no stored reason |
| Compost pool | `W7@compost-pool-confirm` | archives the closed pool · history remains readable · no stored reason |
| Reopen pool | `W7@reopen-confirm` | Composted → Ready · history preserved · participation stays closed |
| Cancel season | `W7@cancel-cycle-confirm` | 8 promises, 5 kept · records survive |
| Cancel season while paused | `W7@paused-cancel-cycle-confirm` | pool remains Paused · cycle alone becomes Cancelled · records survive |
| Decline claim | `W7@decline-claim-confirm` | Maria's request only · João stays pending |
| Cancel batch | `W22@cancel-batch-confirm` | all 2 members atomically · no partial path |
| Close delivery | `W21@close-delivery-confirm` | attempt + failure code survive · no new key |
| Cancel queued delivery | `W21@cancel-queued-confirm` | one unbatched Queued item only · no batch or command created |
| Withdraw your offer | `W2@withdraw-confirm` | pre-acceptance only · no units committed, so none release |

## Screen registry

| Screen | Surface | States | State ids |
| --- | --- | ---: | --- |
| W1 | Client PWA | 33 | open, create-open, not-ready, ready, seeded, funded-offer, request-open, request-queued, request-work-queued, request-work-open, exchange-queued, reviewing, paused, closed, composted, cancelled-cycle, paused-cancelled-cycle, empty-open, no-season, campaign-market, campaign-tools, queued, support-queued, sync-failed, waiting-membership, cycle-summary, claim-pending, claim-declined, claim-superseded, claim-accepted, loading, not-found, read-error |
| W2 | Client PWA | 75 | accepted, offered, requested, browse-offered, browse-requested, browse-requested-gated, active, evidence-queued, evidence-submitted, partially-approved, ready-confirmer, confirmation-pending, fulfilled, fulfilled-pool-fallback, fulfilled-protocol-fallback, reward-released, support-queued, support-en-route, support-delayed, support-executed, support-confirming, support-arrived, support-failed, support-cancelled-queued, support-cancelled-failed, reconciled, cancelled, expired, disputed, captured, captured-evidence-queued, captured-evidence-submitted, captured-ready-pending, captured-ready-confirmer, captured-confirmation-pending, captured-fulfilled, captured-disputed, withdraw-confirm, withdrawn, garden-provider, garden-support-arrived, request-active, campaign-request-active, campaign-request-evidence-queued, campaign-request-evidence-submitted, campaign-request-ready-pending, campaign-request-ready-confirmer, campaign-request-confirmation-pending, campaign-request-fulfilled, campaign-request-disputed, request-evidence-queued, request-evidence-submitted, request-ready-pending, request-ready-confirmer, request-confirmation-pending, request-fulfilled, request-disputed, support-offered, support-accepted, support-evidence-queued, support-evidence-submitted, support-ready-pending, support-ready-confirmer, support-confirmation-pending, support-fulfilled, support-cancelled, support-disputed, loading, not-found, read-error, request-work-active, request-work-partially-approved, request-work-ready-confirmer, request-work-confirmation-pending, request-work-fulfilled |
| W2a | Client PWA | 9 | media, details, review, review-request, review-campaign-request, review-support, review-captured, queued, failed |
| W2b | Client PWA | 9 | forming, add-contributor, remove-contributor, assign-requirement, open-eligible, join-submitted, open-member, frozen, recognition |
| W3 | Client PWA | 32 | step-what, step-howmuch, step-details, step-review, support-howmuch, support-details, support-howmuch-ongoing, support-details-ongoing, support-review, support-review-ongoing, step-advanced, advanced-work-ask, step-advanced-no-protocol, step-confirmers, step-confirmers-work, step-invite, request-what, request-howmuch, request-details, request-howmuch-steward, request-details-steward, request-review, request-review-steward, request-work-what, request-work-howmuch, request-work-details, request-work-review, saved-offer-edit, saved-offer-review, saved-offer-queued, draft-resume, validation |
| W4 | Client PWA | 29 | confirm-domain, confirm-support, confirm-request, confirm-request-work, confirmed-pending-request-work, confirmed-request-work, confirm-campaign-request, confirm-captured, not-yet, not-yet-support, not-yet-request, not-yet-campaign-request, not-yet-captured, provider-view, confirmed-pending, confirmed, confirmed-pending-support, confirmed-support, confirmed-pending-request, confirmed-request, confirmed-pending-campaign-request, confirmed-campaign-request, confirmed-pending-captured, confirmed-captured, not-yet-failed, not-yet-failed-support, not-yet-failed-request, not-yet-failed-campaign-request, not-yet-failed-captured |
| W36 | Client PWA | 7 | waiting-pledge, deposit-instructions, deposit-sent, pending-acceptance, funded, refund-queued, refunded |
| W5 | Client PWA | 8 | default, queued, waiting-membership, send-failed, empty, loading, not-found, read-error |
| W23 | Client PWA | 6 | balance, contributor-receipt, send, send-pending, send-failed, delivery-blocked |
| W25 | Client PWA | 4 | card, context-chooser, pending, accepted |
| WFLOW | Client PWA | 9 | intro, intro-promise, intro-promises, media, details, details-linked, fulfills-pick, review, link-picker |
| W32 | Client PWA | 16 | saved, saved-with-ongoing, saved-with-ongoing-ready, series-queued, series-queued-place-waiting, empty, compose, choose-path, draft-unsaved, saving, save-failed, offline-local, version-conflict, persistence, loading, read-error |
| W34 | Client PWA | 35 | active-two, active-none, active-one, places-queued, places-partial, places-partial-failed, story, participation, ask-again, claimant-view, pool-ready, pool-paused, pool-closed, pool-composted, edit-active, edit-active-none, edit-active-ready, edit-resting, edit-resting-none, edit-resting-ready, resting, resting-none, resting-ready, retire-confirm, retire-confirm-none, retire-confirm-resting, retire-confirm-resting-none, retire-confirm-ready, retire-confirm-resting-ready, retired, retired-none, retired-ready, succession, loading, read-error |
| W35 | Client PWA | 4 | compose, queued, mixed-queued, mixed-failed |
| W28 | Client PWA | 6 | picker, selected, selection-invalid, empty, loading, read-error |
| W29 | Client PWA | 3 | proposed, matched, counterpart-lapsed |
| W30 | Client PWA | 3 | confirm, submitting, contract-error |
| W31 | Client PWA | 1 | templates |
| W7 | Admin console | 31 | open, open-no-cycle, not-ready, preflight-complete, ready, paused, paused-cycle-composted, reconciled, cycle-composted, close-blocked-live, pool-closed, compost-pool-confirm, pool-composted, reopen-confirm, manage, claims, claim-declined, claim-outcomes, expiry-queue, funded-claim, due-live, series-view, seed-cycle, pause-confirm, close-pool-confirm, paused-close-pool-confirm, cancel-cycle-confirm, paused-cancel-cycle-confirm, decline-claim-confirm, loading, empty |
| W8 | Admin console | 8 | step1, step2, step3, step3-no-protocol, step4, step5, captured-for, discard |
| W9 | Admin console | 3 | pick-member, capture-kind, discard |
| W10 | Admin console | 19 | detail, detail-fallback-eligible, external-fulfilled, fulfilled, contributor-allocation, edit-declared-value, record-payout, fallback-confirm, protocol-fallback-confirm, raise-dispute, resolve-dispute, attach-assessment, accepted, mark-ready-override, cancel, not-found, garden-ready, garden-fulfilled, queue-settlement-garden |
| W11 | Admin console | 8 | presets, invalid-sum, guard, recognition-policy, campaign-allocation, campaign-open, discard, campaign-discard |
| W12 | Admin console | 3 | protocol, current-garden, seed-protocol |
| W13 | Admin console | 4 | queue, context-chip, assess, empty |
| W14 | Admin console | 3 | baseline, delta, discard |
| W37 | Admin console | 5 | claim, pledged, deposit-recorded, consumed, refund-eligible |
| W21 | Admin console | 28 | queue, unregistered, payout-plan, payout-plan-edit, payout-finalized, payout-prepared, payout-prepared-2, payout-prepared-all, payout-retained-draft, payout-retained, payout-partial, payout-complete, register-account, registered, failed-recovery, gate-status, requeue-confirm, requeued, batch-create, batch-created, cancel-queued-confirm, cancelled-queued, batch-cancelled, close-delivery-confirm, cancelled-failed, protocol-queue, protocol-funding-queued, refund-queued |
| W22 | Admin console | 12 | ready, dispatched, delivery-delayed, executed, acknowledgment-pending, outcome, role-guard, cancel-batch-confirm, garden-command, individual-dispatched, refund-dispatched, refund-confirmed |
| W24 | Admin console | 6 | queue, ccip, flows, flows-funding-unavailable, funding, funding-unauthorized |
| W26 | Admin console | 9 | review, recognition-blocked, shares, certificate, rest, paused-review, paused-shares, paused-certificate, paused-rest |
| HUBWORK | Admin console | 1 | approve |
| W15 | Editorial website | 3 | counts-only, above-threshold, pre-launch |
| W16 | Editorial website | 2 | band, pipeline-delta |
| C1 | Community PWA — September preview (lo-fi) | 1 | default |
| C3 | Community PWA — September preview (lo-fi) | 1 | default |
| C4 | Community PWA — September preview (lo-fi) | 1 | default |
| C5 | Community PWA — September preview (lo-fi) | 1 | default |
| C6 | Community PWA — September preview (lo-fi) | 1 | default |
| C9 | Community PWA — September preview (lo-fi) | 1 | default |
| C10 | Community PWA — September preview (lo-fi) | 1 | default |

## Compatibility aliases

Legacy deep links remain registered in `hifi/screens/index.ts`, including `W6` → `W5`, `W23G` → `W23@delivery-blocked`, and `MF8` → `W25@context-chooser`. Guided-flow hashes use `#sbN/ix`; Screen-library hashes use `#screens/SCREEN@state`, including the hidden Community source material.

## Placement closure

Register #51 locks the final four August placement decisions exactly where the artifact renders them:

- MF-2b — steward cancellation lives in `W10@cancel`, launched from the Accepted/evidence-in action row.
- MF-7 — the read-only “fulfills this promise” row lives in `WFLOW@review`.
- MF-8 — the personal/garden provider-context choice lives in `W25@context-chooser` before claim submission.
- MF-13 — the assessment picker lives in `W10@attach-assessment`.

The W10 Accepted/override states, W23 delivery-blocked state, and W26 reconciliation report are likewise realized, non-proposed states. No August screen or action remains amber-tagged or placement-blocked.
