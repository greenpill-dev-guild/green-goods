// Storyboards — the journey data. Each flow lives on the surface where its
// actor acts (reviewGroup), and names the action happening rather than the
// nouns involved. When a flow's act lands on another surface, that frame stays
// inline as an `echo` scene in "Meanwhile" chrome instead of being split away:
// a reviewer should see the consequence without leaving the flow, and should
// never mistake it for a screen they are driving.
//
// Step shape supports BOTH generations:
//   legacy (ascii screens):  f: "W1", hot: { m: "[ Offer support ]", l } — match-strings
//   hi-fi  (migrated):       f: "W2@disputed", hot: { h: "w2.confirm", l? } — ids + state pin
// normalize() in validate.ts resolves both to ids and fails the build when a
// screen has gone hi-fi but its steps still carry match-strings.
import { SEASON_LIVE } from "./fixtures";
import type { ReviewGroup, RoleId } from "./types";

export type Scene = {
  f: string; // "W1" (default state) or "W2@disputed" (state-pinned, hi-fi)
  hot?: { m: string; l: string } | { h: string; l?: string } | null;
  alts?: ({ m: string; l: string; to: string } | { h: string; l?: string; to: string })[];
  marks?: string[]; // legacy match-strings or registered mark/hotspot ids
  who?: string;
  surface?: string;
  /** The same moment on another surface. Must be off-home; validate.ts checks both ways. */
  echo?: boolean;
  st?: string; ev: string; cite?: string; note?: string;
  skipTargetReason?: string;
  br?: { l: string; to: string }[]; mf?: boolean;
};
export type SB = {
  id: string; n: number; title: string;
  /**
   * The card's description line: one plain sentence naming the actor and what
   * the walk covers, so a reviewer can choose a flow without opening it. It
   * replaced the persona line on the card (Afo, D3) — persona still shows on
   * the stage pill and in the Reference tab, so nothing is lost.
   */
  desc: string;
  persona: string;
  /** Internal scenario provenance (S1, S5/S13…). Never shipped, never rendered. */
  scen: string;
  reviewVisible: boolean; reviewGroup: ReviewGroup;
  /** Catalog cluster within the group. Renameable data (types.ts CHAPTERS). */
  chapter: string;
  /** Acting role tags for the card chips, primary actor first (types.ts ROLES). */
  roles: RoleId[];
  steps: Scene[];
};

export const SBS: SB[] = [
// ═══ Client catalog rebuilt 2026-08-11 (correction pass D1, uiux Appendix B
// addenda): ~17 canonical journeys, each starting at the surface its actor
// actually enters (W1 pool tab · W5 wallet drawer · WFLOW Garden tab), one
// person, one sitting. Offline/failure/cycle-state variants live in the Screen
// library and are reachable through branch links, never walked as separate
// flows. The old cycle-variant and fused flows (sb3a/7/16/26/28/30/36/38-41/
// 44/52) retired with their hashes, per the #sb9 precedent. ═══
// Split at the actor seam 2026-08-11 (D3, Afo): "Make an offer and see it taken
// up" was two people's acts under one title, and "Offer a service and prove it
// with proof" was the same fusion one chapter over. Making is the creator's
// sitting and ends when the commitment is queued; the taking-up (sb55) and the
// proving (sb56) are their own walks. Old mid-ribbon hashes (#sb1/6, #sb29/5+)
// retire exactly as #sb9 did.
{ id: "sb61", n: 29, title: "Arrive for the first time", desc: "A new member opens Commitments, finds it empty, browses the garden's pool, and reads one whole commitment before deciding anything.", persona: "New member", scen: "S6 · first run", reviewVisible: true, reviewGroup: "client", chapter: "arrive", roles: ["gardener"], steps: [
  { f: "W5@empty", hot: { h: "w5.browse-gardens", l: "Browse gardens" }, st: "Nothing yet", ev: "the commitments control sits in the Home header from the first launch, so this empty state is also the first thing a member of a garden with no commitments sees. It carries the one sentence that says what a commitment IS, and it reads as an invitation rather than a failure" },
  { f: "W1", hot: { h: "w1.open-offer", l: "Prune the north beds" }, st: "Pool open", ev: "the pool tab now says in one line what this pool is for, in the garden's own words. That sentence lived on the empty-pool state alone, which is the one screen almost nobody sees twice, while the steward's console carried it every day", br: [{ l: "A pool with nothing in it yet", to: "screen:W1@empty-open" }] },
  { f: "W2@browse-offered", hot: null, st: "Offered", ev: "reading one whole commitment is the fastest way to learn the shape of all of them: what is being given, by whom, what proves it, and who says it was kept. Nothing here is an act, because the card carried none either", br: [{ l: "Take it up", to: "sb55:1" }, { l: "Offer something yourself", to: "sb1:0" }, { l: "Ask for what you need", to: "sb2:0" }] },
]},
{ id: "sb1", n: 1, title: "Make an offer", desc: "Maria offers to prune the north beds — four composer steps, then the commitment sits queued on her phone until it syncs.", persona: "Gardener (Maria)", scen: "S1 · TAS workshop", reviewVisible: true, reviewGroup: "client", chapter: "make", roles: ["gardener"], steps: [
  { f: "W1", hot: { h: "w1.create", l: "Offer or request" }, st: "Pool open", ev: "the one floating create entry stays reachable however far the list scrolls — it opens the doors, it is not a form", cite: "uiux §5.2 addendum 2026-08-14" },
  { f: "W1@create-open", hot: { h: "w1.offer", l: "Offer" }, st: "Doors open", ev: "the two entry verbs are the only creation doors — direction is fixed by the door and never re-asked inside", cite: "uiux Appendix B §5.4 addendum 2026-08-11" },
  { f: "W3@step-what", hot: { h: "w3.continue-what" }, alts: [{ h: "w3.choose-ongoing", to: "screen:W3@support-howmuch-ongoing" }, { h: "w3.template", to: "screen:W31" }], st: "1 · What", ev: "three blocks, not seven: the kind, how often, where it runs, and a title the garden's own actions suggest", cite: "contract-spec metadata schema v1 addendum" },
  { f: "W3@step-howmuch", hot: { h: "w3.continue-howmuch" }, st: "2 · How much", ev: "chip-picked unit and amount, one due row — and the actions this commitment includes, folded in from what used to be its own proof step" },
  { f: "W3@step-details", hot: { h: "w3.continue-details" }, st: "3 · Details", ev: "a real numbered step now, drawn from the shipped Submit Work media step: the dashed capture surface, the item list, and the camera / gallery / mic bar" },
  { f: "W3@step-review", hot: { h: "w3.read-to-end", l: "Read to the end" }, st: "4 · Review", ev: "the act is disabled on arrival: a review you can send from the top is not a review" },
  { f: "W3@step-review-read", hot: { h: "w3.submit", l: "Make this offer" }, alts: [{ h: "w3.advanced", to: "screen:W3@step-advanced" }], st: "4 · Review", ev: "the shipped Review Work anatomy exactly — FormInfo over one flat card of rows, the back arrow as the edit path, and a single hot row for the Advanced detour · commitment job queued", cite: "UX:212" },
  { f: "W1@queued", hot: null, marks: ["w1.queued-card"], st: "Queued", ev: "offline truth on the pool tab: the optimistic card names its queue state and the sync bar counts it — Maria's sitting ends here, with the offer live for a neighbour to take up", br: [{ l: "Take up an offer", to: "sb55:0" }, { l: "Offline lanes — send failed & membership wait", to: "screen:W1@sync-failed" }] },
]},
// The other half of the old sb1: the neighbour's act, and the mirror the
// "Take up a commitment" chapter was missing — it held the request side only.
{ id: "sb55", n: 7, title: "Take up an offer", desc: "João takes up Maria's open offer from the pool tab; one tap turns a by-lined card into a commitment with a face on both sides.", persona: "Neighbour (João)", scen: "S1 · receiving side", reviewVisible: true, reviewGroup: "client", chapter: "take-up", roles: ["gardener"], steps: [
  { f: "W1", hot: { h: "w1.open-offer", l: "Prune the north beds" }, st: "Pool open", ev: "the card carries no act of its own (2026-08-16): tapping it opens the commitment, so a neighbour reads the whole thing before deciding", cite: "UX:129" },
  { f: "W2@browse-offered", hot: { h: "w2.take-up-browse", l: "Take this up" }, st: "Offered", ev: "the one act sits in the fixed bottom bar, after the terms, the people and the proof rules are on screen" },
  { f: "W2@accepted", hot: null, st: "Accepted", ev: "the commitment now has both people on it — and the next acts belong to them in turn: Maria proves it, João confirms it", br: [{ l: "Prove it with work", to: "sb4a:0" }, { l: "Confirm a commitment kept", to: "sb42:0" }, { l: "Steward-reviewed offers wait for a decision", to: "screen:W1@claim-pending" }] },
]},
{ id: "sb29", n: 2, title: "Offer a service", desc: "Maria offers to host climate workshops — the same composer with a service kind, which names proof rather than garden work as its proof.", persona: "Gardener (Maria)", scen: "S1 · SupportService offer", reviewVisible: true, reviewGroup: "client", chapter: "make", roles: ["gardener"], steps: [
  { f: "W1", hot: { h: "w1.create", l: "Offer or request" }, st: "Pool open", ev: "the same floating door for every kind of commitment" },
  { f: "W1@create-open", hot: { h: "w1.offer", l: "Offer" }, st: "Doors open", ev: "a service is a kind inside the same composer — not another flow with its own screens" },
  { f: "W3@step-what", hot: { h: "w3.choose-support", l: "Kind: a service or support" }, st: "1 · What", ev: "the kind choice drops the garden-action rows from step 2 and leaves proof as the proof — the dots commitment four steps on every path and keep it" },
  { f: "W3@support-howmuch", hot: { h: "w3.continue-support-howmuch" }, st: "2 · How much", ev: "chip-picked unit and amount over one due row; a service names no garden actions, so step 2 stays short" },
  { f: "W3@support-details", hot: { h: "w3.continue-support-details" }, st: "3 · Details", ev: "the same details step every path runs — one shared body, this path's fixture" },
  { f: "W3@support-review", hot: { h: "w3.submit-support", l: "Make this offer" }, st: "4 · Review", ev: "the shipped Review Work anatomy; service offers name proof and the person helped as their proof" },
  { f: "W1@support-queued", hot: null, marks: ["w1.queued-card"], st: "Queued", ev: "the service offer queues like everything else — offline first; showing what she did is a later sitting, once someone has taken it up", br: [{ l: "Prove a service with proof", to: "sb56:0" }, { l: "Make an ongoing offer instead", to: "sb37:2" }] },
]},
// Exchange is PARKED (iteration 2, Afo decision): no client journey walks it
// pending a dedicated design session. W28–W30 remain in the Screen library.
{ id: "sb2", n: 4, title: "Make a request", desc: "David asks the garden for a hand and declares G$ support right on the phone — the one extra step stewards get and gardeners never see.", persona: "Steward (David) — gardeners' requests skip the Support step", scen: "S2 · proof-only request", reviewVisible: true, reviewGroup: "client", chapter: "ask", roles: ["steward", "gardener"], steps: [
  { f: "W1", hot: { h: "w1.create", l: "Offer or request" }, st: "Pool open", ev: "requests start at the same floating door as offers" },
  { f: "W1@create-open", hot: { h: "w1.request", l: "Request" }, st: "Doors open", ev: "the request door mirrors the offer door — direction fixed, never re-asked" },
  { f: "W3@request-what", hot: { h: "w3.request-continue-what" }, alts: [{ h: "w3.request-choose-work", to: "screen:W3@request-work-what" }], st: "1 · What", ev: "help-or-a-service vs garden work as equal cards, then where it runs and a title the garden suggests" },
  { f: "W3@request-howmuch-steward", hot: { h: "w3.request-continue-support" }, st: "2 · How much", ev: "the amount, who can take it up, and — because David is a steward — the G$ support he declares: three terms the ask is kept on, on one step, so a steward's ask runs the same four beats as everyone else's", cite: "UX:99" },
  { f: "W3@request-details-steward", hot: { h: "w3.continue-request-details-steward" }, st: "3 · Details", ev: "an ask has nothing done yet, so what attaches here is context for whoever takes it up — the proof arrives with the work" },
  { f: "W3@request-review-steward", hot: { h: "w3.submit-request", l: "Make this request" }, st: "4 · Review", ev: "one flat card of rows carrying the declared G$ support, in the shipped Review Work anatomy" },
  { f: "W1@request-queued", hot: null, marks: ["w1.queued-card"], st: "Queued", ev: "saved on this device; sends when connected" },
  { f: "W1@request-open", hot: null, st: "Open", ev: "the request is live — João can say “I can help”, and the declared support travels with it", br: [{ l: "João's side: help with what was requested", to: "sb43:0" }, { l: "When help arrives: confirm it", to: "sb42:0" }] },
]},
{ id: "sb51", n: 5, title: "Request garden work", desc: "Ana asks for garden work: the request names the garden's own actions as its proof and rides the ordinary Work rails.", persona: "Gardener (Ana)", scen: "S2 · DomainImpact request", reviewVisible: true, reviewGroup: "client", chapter: "ask", roles: ["gardener"], steps: [
  { f: "W1", hot: { h: "w1.create", l: "Offer or request" }, st: "Pool open", ev: "a garden-work request starts at the same floating door as any commitment" },
  { f: "W1@create-open", hot: { h: "w1.request", l: "Request" }, st: "Doors open", ev: "a garden-work request starts at the same door as any request" },
  { f: "W3@request-what", hot: { h: "w3.request-choose-work", l: "Kind: garden work" }, st: "1 · What", ev: "garden work is an equal kind card — choosing it names the garden's actions on step 2 and the request rides the Work rails" },
  { f: "W3@request-work-what", hot: { h: "w3.request-work-continue-what" }, st: "1 · What (garden work)", ev: "titles are suggested from the garden's own actions" },
  { f: "W3@request-work-howmuch", hot: { h: "w3.request-continue-work" }, st: "2 · How much", ev: "chip-picked unit and amount over one due row, then the actions this ask needs — tappable cards with counts, the same picker offers use" },
  { f: "W3@request-work-details", hot: { h: "w3.continue-request-work-details" }, st: "3 · Details", ev: "a photo of the blocked channel is context for whoever takes it up; the proof arrives later as approved work" },
  { f: "W3@request-work-review", hot: { h: "w3.submit-work-request", l: "Request this work" }, st: "4 · Review", ev: "the shipped Review Work anatomy; whoever takes it up submits work, stewards approve, you confirm" },
  { f: "W1@request-work-queued", hot: null, marks: ["w1.queued-card"], st: "Queued", ev: "the request queues with its requirement rows intact" },
  { f: "W1@request-work-open", hot: null, st: "Open", ev: "live on the pool tab among everything else, with the needed work named on its card. Taking it up happens in the commitment, where that act lives", br: [{ l: "A helper takes it up and submits work", to: "sb43:0" }, { l: "Approvals land, then you confirm", to: "sb42:0" }] },
]},
{ id: "sb43", n: 6, title: "Help with what was requested", desc: "João takes up Ana's open request, does it, attaches proof, and sends it back for her confirmation.", persona: "Helper (João)", scen: "S2 · providing side", reviewVisible: true, reviewGroup: "client", chapter: "take-up", roles: ["gardener"], steps: [
  { f: "W1@request-open", hot: { h: "w1.open-request", l: "Ride to the market on Saturday" }, st: "Requested", ev: "the card opens the request rather than accepting it — what taking it up means is read on the commitment, not guessed from a button" },
  { f: "W2@browse-requested", hot: { h: "w2.help-browse", l: "I can help" }, st: "Requested → Accepted", ev: "open requests accept the first neighbour, from the detail's fixed bar", br: [{ l: "Steward-reviewed requests wait for a decision", to: "screen:W1@claim-pending" }, { l: "Ongoing offers: take one up", to: "screen:W34@claimant-view" }, { l: "Campaign requests work the same way", to: "screen:W1@campaign-market" }] },
  { f: "W2@request-active", hot: { h: "w2.add-evidence-request", l: "Add proof" }, st: "Accepted", ev: "the one next act sits in the commitment's fixed bottom bar" },
  { f: "W2a@media", hot: { h: "w2a.media-continue" }, st: "1 · Media", ev: "the Submit-Work capture: tap the area to add, voice notes from the bar" },
  { f: "W2a@details", hot: { h: "w2a.details-continue" }, skipTargetReason: "cast walks land on their identity-preserving review variant of the canonical review destination", st: "2 · Details", ev: "contributor chips and an optional note — the details step" },
  { f: "W2a@review-request", hot: { h: "w2a.attach-request", l: "Submit proof" }, st: "3 · Review", ev: "review, then attach — the request keeps its identity throughout" },
  { f: "W2@request-evidence-queued", hot: null, st: "Proof queued", ev: "held on this device until it sends" },
  { f: "W2@request-evidence-submitted", hot: { h: "w2.send-confirmation-request", l: "Send for confirmation" }, st: "Proof in", ev: "one explicit send once the proof is attached — from the bar" },
  { f: "W2@request-ready-pending", hot: null, st: "Ready — queued", ev: "done — now it waits on Ana, who requested it", br: [{ l: "Ana confirms it arrived", to: "sb42:0" }] },
]},
// Campaign take-up dropped as its own journey (iteration 2): it repeated
// "Help with what was requested" — the campaign cast lives on as W1/W2/W2a
// states and the branch link on sb43's first scene.
{ id: "sb4a", n: 8, title: "Prove it with work", desc: "A gardener submits work from the Garden tab and points it at the commitment it fulfills; each approval counts toward one named requirement.", persona: "Gardener (provider)", scen: "S4 · AGRO+EDU", reviewVisible: true, reviewGroup: "client", chapter: "keep", roles: ["gardener"], steps: [
  { f: "WFLOW@intro-promises", hot: { h: "wflow.intro-continue" }, alts: [{ h: "wflow.promise-row", to: "screen:WFLOW@intro-promise" }], st: "1 · Intro", ev: "the AppBar Garden tab is the shipping work flow — and a commitment-holder's intro opens with their commitments, standing from first paint, never popping up mid-flow; tap one to scope the flow, or continue with plain garden work", cite: "uiux §5.7 addendum 2026-08-14" },
  { f: "WFLOW@media", hot: { h: "wflow.media-continue" }, st: "2 · Media", ev: "camera, gallery, voice note from the bar — the interaction every pooling capture now mirrors" },
  { f: "WFLOW@details", hot: { h: "wflow.details-continue" }, st: "3 · Details", ev: "time spent, then the inputs THIS action asks for, then feedback — the shipped step. The commitment was chosen at the intro, so nothing here asks again" },
  { f: "WFLOW@review", hot: { h: "wflow.submit", l: "Submit work" }, marks: ["wflow.fulfills"], st: "4 · Review", ev: "the locked fulfills row repeats the choice; work job + meta.commitmentId, workLink follows after sync", cite: "UX:220" },
  { f: "W2@active", hot: null, st: "Active", ev: "approvals land on the commitment as visible progress per requirement", br: [{ l: "Link work you already submitted", to: "screen:WFLOW@link-picker" }, { l: "The steward's approvals", to: "sb4b:0" }] },
  { f: "W2@partially-approved", hot: null, st: "Partly approved · 1 of 2", ev: "each approval counts toward the exact requirement row it was linked to" },
  { f: "W2@ready-provider", hot: null, st: "Ready to confirm", ev: "requirements met, and the provider's part is done. This walk used to end on the confirmer's screen, so the person who did the work was told they had been named to confirm it, above a button they are forbidden from pressing", br: [{ l: "Confirm a commitment kept", to: "sb42:0" }, { l: "The assessment side", to: "sb50:0" }] },
]},
// The proving half of the old sb29 (D3): a service is shown with proof
// rather than approved work, so it is the sibling of "Prove it with work" —
// same chapter, same rhythm, different proof.
{ id: "sb56", n: 26, title: "Prove a service with proof", desc: "Maria picks her accepted service commitment up from the wallet, attaches photos, credits who helped, and sends it for confirmation.", persona: "Gardener (Maria)", scen: "S1 · SupportService proof", reviewVisible: true, reviewGroup: "client", chapter: "keep", roles: ["gardener"], steps: [
  { f: "W5", hot: { h: "w5.mine-row", l: "Open your service commitment" }, skipTargetReason: "the wallet's My commitments row opens the member's own commitment; a service offer opens on its own accepted state of that screen", st: "Wallet", ev: "showing what you did is its own sitting, days after the offer — and your own commitments are picked back up from the wallet, grouped by garden", cite: "UX:186" },
  { f: "W2@support-accepted", hot: { h: "w2.add-evidence-support", l: "Add proof" }, st: "Accepted", ev: "João took it up; the one next act sits in the commitment's fixed bottom bar" },
  { f: "W2a@media", hot: { h: "w2a.media-continue" }, st: "1 · Media", ev: "proof IS the work-submission rhythm: tap the area to add photos or video, voice notes from the bar", cite: "uiux §5.5 addendum · iteration 2" },
  { f: "W2a@details", hot: { h: "w2a.details-continue" }, skipTargetReason: "cast walks land on their identity-preserving review variant of the canonical review destination", st: "2 · Details", ev: "contributor credit as roster chips, an optional note and link — the details step, exactly like Submit Work" },
  { f: "W2a@review-support", hot: { h: "w2a.attach-support", l: "Submit proof" }, st: "3 · Review", ev: "one look at everything, then attach — media, credited teammates, note" },
  { f: "W2@support-evidence-queued", hot: null, st: "Proof queued", ev: "held on this device — nothing is dropped offline" },
  { f: "W2@support-evidence-submitted", hot: { h: "w2.send-confirmation", l: "Send for confirmation" }, st: "Proof in", ev: "the bar carries the one next act: send for confirmation" },
  { f: "W2@send-confirm", hot: { h: "w2.send-confirm-go", l: "Send it" }, st: "Naming what it does", ev: "sending freezes the team and stops further proof counting, so it says so before it happens — submitForConfirmation is the act a service needs because it has no approver to reach readiness for it" },
  { f: "W2@support-ready-pending", hot: null, st: "Ready — queued", ev: "now it waits on the person Maria helped", br: [{ l: "The recipient confirms", to: "sb42:0" }] },
]},
{ id: "sb42", n: 9, title: "Confirm a commitment kept", desc: "João finds what is waiting on him in the wallet and confirms the commitment was kept — a positive-only act that queues offline.", persona: "Recipient (João)", scen: "S1 · confirmation", reviewVisible: true, reviewGroup: "client", chapter: "confirm", roles: ["gardener"], steps: [
  { f: "W5", hot: { h: "w5.inbox-row", l: "Review" }, st: "Wallet", ev: "everything waiting on you, across gardens — the drawer's inbox opens the same sheet the commitment does" },
  { f: "W4", hot: { h: "w4.confirm", l: "Confirm — commitment kept" }, alts: [{ h: "w4.not-yet", l: "Not yet", to: "sb5:2" }], st: "ReadyForConfirmation", ev: "the sheet names the eligibility path before the act; cycle-state banners never block confirmation" },
  { f: "W4@confirmed-pending", hot: null, skipTargetReason: "w4.done returns to the pool tab, which is what its button says; the next scene is the commitment as João can reopen it from the wallet, not a screen this flow navigates to", st: "Queued", ev: "the positive-only confirmation queues offline like everything else" },
  { f: "W2@fulfilled-confirmer", hot: null, st: "Fulfilled", ev: "kept, once — and read from the seat that confirmed it. This ended on W2@fulfilled until 2026-08-19: the PROVIDER's screen, which greets its reader with “You did the work” — Maria's sentence, shown to João. The confirmer's own view was drawn in the same round and nothing pointed at it", br: [{ l: "Request, campaign, service, and recorded-commitment casts", to: "screen:W4@confirm-request" }, { l: "The provider's side of the same moment", to: "screen:W2@fulfilled" }] },
]},
// Split at the actor seam 2026-08-11 (D3 round 2, Afo): the old title promised
// the stewards' resolution, which is sb47's act on another surface — and the
// flow's closing "Ready again" scene duplicated sb47's own echo of it. The
// member's flow now ends where the member's part ends: under review.
{ id: "sb5", n: 10, title: "Say “not yet”", desc: "Saying not yet is its own act with its own reason — never a negative confirmation; the commitment then goes quiet under steward review.", persona: "Recipient (confirmer)", scen: "S5", reviewVisible: true, reviewGroup: "client", chapter: "confirm", roles: ["gardener"], steps: [
  { f: "W5", hot: { h: "w5.inbox-row", l: "Review" }, st: "Wallet", ev: "the same inbox row — confirming honestly includes saying not yet" },
  { f: "W4", hot: { h: "w4.not-yet", l: "Not yet" }, st: "ReadyForConfirmation", ev: "not-yet is a separate act with its own reason — never a negative confirmation" },
  { f: "W4@not-yet", hot: { h: "w4.not-yet-send", l: "Send to the stewards" }, st: "Reason", ev: "common reasons fill the still-required field; your words stay yours" },
  { f: "W2@disputed", hot: null, st: "Under review", ev: "the member ceiling is “under review by stewards” — CTAs pause, nothing is public, and what happens next is the stewards' act, not theirs" },
  { f: "W5", hot: null, st: "Waiting", ev: "and this is where you watch it: a quiet row in Live, no act and no badge, because nothing is waiting on you. Saying not yet used to hand the commitment to somebody else and leave you with nowhere to follow it", br: [{ l: "The steward's resolution", to: "sb47:0" }] },
]},
{ id: "sb45", n: 11, title: "The team behind a commitment", desc: "João opens a commitment whose team is still forming and joins it himself — membership shows only once the indexed roster confirms it.", persona: "Contributor (João)", scen: "S1 · group commitment", reviewVisible: true, reviewGroup: "client", chapter: "team", roles: ["gardener"], steps: [
  { f: "W1", hot: { h: "w1.open-team-offer", l: "Open the team commitment" }, st: "Pool open", ev: "a forming team is visible right on the card — and opening it lands on the COMMITMENT, not a bare team screen", cite: "iteration 2 E8" },
  { f: "W2@accepted-joinable", hot: { h: "w2.team-strip", l: "Open team — join in" }, st: "Accepted", ev: "the people are above the fold: creator, counterparty, and the team strip in the commitment's own context. The seat is a neighbour eligible to join, not the provider, so the screen says Maria is working on this rather than handing them her acts" },
  { f: "W2b@open-eligible", hot: { h: "w2b.join", l: "Join this commitment" }, st: "Open team", ev: "eligible open-team members join on their own" },
  { f: "W2b@join-submitted", hot: null, st: "Pending", ev: "membership renders only after the indexed roster confirms it" },
  { f: "W2b@open-member", hot: null, st: "On the team", ev: "planned responsibilities are planning, never recognition credit", br: [{ l: "Readiness freezes roster and credit", to: "screen:W2b@frozen" }, { l: "Recognition preview", to: "screen:W2b@recognition" }] },
]},
{ id: "sb54", n: 18, title: "Add people to your team", desc: "Maria leads a group commitment and adds a contributor from the commitment detail — planning responsibility, never recognition credit.", persona: "Lead (Maria)", scen: "S1 · group commitment · lead side", reviewVisible: true, reviewGroup: "client", chapter: "team", roles: ["gardener"], steps: [
  { f: "W1", hot: null, st: "Pool open", ev: "your own commitment, its team forming — adding people is the lead's act" },
  { f: "W2", hot: { h: "w2.open-team-forming", l: "Manage the team" }, st: "Accepted", ev: "the lead manages the roster from the commitment detail" },
  { f: "W2b@forming", hot: { h: "w2b.add", l: "Add people" }, st: "The team", ev: "one team surface: how people join, who is on it, and how credit is shared — no longer split between a creation detour and a roster screen", cite: "iteration 2 E8 — the flow your review found missing" },
  { f: "W2b@add-sheet", hot: { h: "w2b.add-confirm", l: "Add to the team" }, st: "Add people", ev: "the shipped garden Gardeners list as a sheet — scroll, tap to select, avatars and joined dates; addContributor is an online roster action and wallet rejection keeps the selection for retry" },
  { f: "W2b@forming", hot: null, st: "The team grew", ev: "the indexed roster confirms the new person; planning assignments stay separate from credit", br: [{ l: "Assign work to someone", to: "screen:W2b@assign-requirement" }, { l: "Set the team before anyone accepts", to: "screen:W2b@setup" }, { l: "A service has a team too", to: "screen:W2b@forming-service" }] },
]},
{ id: "sb37", n: 3, title: "Make an ongoing offer", desc: "Maria offers the same service over time: How often becomes Ongoing, and one submission creates the series and its first open commitments.", persona: "Gardener (Maria)", scen: "S15 · ongoing Offer", reviewVisible: true, reviewGroup: "client", chapter: "make", roles: ["gardener"], steps: [
  { f: "W1", hot: { h: "w1.create", l: "Offer or request" }, st: "Pool open", ev: "ongoing starts at the same floating door as everything else" },
  { f: "W1@create-open", hot: { h: "w1.offer", l: "Offer" }, st: "Doors open", ev: "it is a way of making an offer, not a separate section" },
  { f: "W3@step-what", hot: { h: "w3.choose-ongoing", l: "How often: Ongoing" }, st: "1 · What", ev: "How often sits beside the kind cards on step 1 — at the bottom of step 2 the fork was found only after everything had been filled in for a one-off", cite: "iteration 2 E1" },
  { f: "W3@support-howmuch-ongoing", hot: { h: "w3.continue-support-howmuch-ongoing" }, st: "2 · How much", ev: "no detour wizard: how many each one, and places-to-start, on the ordinary amount step" },
  { f: "W3@support-details-ongoing", hot: { h: "w3.continue-support-details-ongoing" }, st: "3 · Details", ev: "the same details step every path runs" },
  { f: "W3@support-review-ongoing", hot: { h: "w3.submit-ongoing", l: "Start this ongoing offer" }, st: "4 · Review", ev: "one flat card carrying each one and what opens; one submission runs the series creation and its first places as an ordered queue sequence" },
  { f: "W1@ongoing-queued", hot: null, marks: ["w1.queued-card"], st: "Queued", ev: "an ongoing offer lands where every other commitment lands: the pool tab, with what you just made at the top. It used to end in Things I can offer, your wallet's private section, which was the one creation flow that finished somewhere else", br: [{ l: "Where ongoing offers live — the commitments sheet", to: "screen:W5@overtime" }, { l: "Offline: draft kept, dependent places wait", to: "screen:W32@offline-local" }] },
  { f: "W34@active-two", hot: { h: "w34.open-story", l: "See the whole story" }, st: "Active · 2 open", ev: "the public card on the pool tab shows Ongoing + left to take up; this is its home" },
  { f: "W34@story", hot: null, st: "Story", ev: "what the ongoing offer has become — kept commitments, people, no scores", br: [{ l: "Stop offering it, the record stays", to: "screen:W34@stopped" }, { l: "Take up one open commitment (recipient side)", to: "screen:W34@claimant-view" }] },
]},
{ id: "sb11", n: 13, title: "Watch G$ support arrive", desc: "A gardener follows declared support from queued to on its way to arrived — and only an authenticated success ever says arrived.", persona: "Gardener", scen: "S8/S9 · TAS", reviewVisible: true, reviewGroup: "client", chapter: "money", roles: ["gardener"], steps: [
  { f: "W5", hot: { h: "w5.support-row", l: "Support on its way" }, st: "Commitments", ev: "money in flight has a row of its own in Live now, so noticing it is a tap rather than a jump. This walk used to open here and move on with no control between, because no state of this sheet mentioned money at all" },
  { f: "W2@support-queued", hot: null, st: "Queued", ev: "the fulfilled commitment's declared support enters the settlement queue" },
  { f: "W2@support-en-route", hot: null, st: "On its way", ev: "“support on its way” — the only phrase before an authenticated outcome", cite: "settlement copy contract" },
  { f: "W2@support-delayed", hot: null, st: "Taking longer", ev: "delay is named calmly; no ticking, no alarm" },
  { f: "W2@support-arrived", hot: null, st: "Arrived", ev: "“support arrived” renders only after the authenticated success acknowledgment", br: [{ l: "Send it on", to: "sb53:0" }, { l: "If it fails: “support is being rearranged”", to: "screen:W2@support-failed" }] },
]},
{ id: "sb53", n: 14, title: "Send support on", desc: "Arrived G$ sits in the wallet; sending it on to a neighbour is recent recipients, an amount preset, and one send.", persona: "Gardener", scen: "S8/S9 · onward send", reviewVisible: true, reviewGroup: "client", chapter: "money", roles: ["gardener"], steps: [
  { f: "W5", hot: { h: "w5.open-wallet", l: "Open the wallet" }, st: "Commitments", ev: "sending on starts from the wallet, a separate sitting from watching it arrive, and the Home header's wallet control is how you reach it. Nothing in the artifact targeted W23 before this" },
  { f: "W23", hot: { h: "w23.send", l: "Send G$" }, st: "Balance", ev: "the arrived support sits in the wallet's G$ section" },
  { f: "W23@send", hot: { h: "w23.send-submit", l: "Send" }, st: "Send", ev: "recent recipients and amount presets — tap-first" },
  { f: "W23@send-pending", hot: null, st: "Sending", ev: "the send keeps its state visibly until it lands" },
  { f: "W23@balance", hot: null, st: "Balance", ev: "done — the record stays in the wallet history", br: [{ l: "If a send fails", to: "screen:W23@send-failed" }, { l: "Contributor receipts", to: "screen:W23@contributor-receipt" }] },
]},
{ id: "sb18", n: 15, title: "Find everything waiting on you", desc: "One cross-garden home: what waits on you first, then your own commitments by garden, then what you keep ready to offer.", persona: "Gardener across gardens", scen: "S6 · wallet drawer", reviewVisible: true, reviewGroup: "client", chapter: "arrive", roles: ["gardener"], steps: [
  { f: "W5", hot: { h: "w5.inbox-row", l: "Review" }, st: "Wallet", ev: "one cross-garden home: waiting-on-you first, then your commitments by garden, then Things I can offer" },
  { f: "W4", hot: null, st: "ReadyForConfirmation", ev: "the inbox row opens the same confirmation sheet the commitment itself opens", br: [{ l: "Confirm a commitment kept", to: "sb42:1" }] },
  { f: "W5@queued", hot: null, st: "Queued", ev: "queued commitments ride at the top of their garden group with the offline banner" },
  { f: "W5@waiting-membership", hot: null, st: "Waiting", ev: "membership-gated sends wait without spending attempts" },
]},
{ id: "sb13", n: 16, title: "Claim a protocol commitment for your garden", desc: "Leila claims a Green Goods commitment for her garden and follows the whole arc — acceptance, the work, the support arriving.", persona: "Garden steward (Leila)", scen: "S14", reviewVisible: true, reviewGroup: "client", chapter: "money", roles: ["steward"], steps: [
  { f: "W1", hot: null, st: "Pool open", ev: "the protocol pool seeds commitments gardens can claim; they surface in your garden's pool tab" },
  { f: "W25", hot: { h: "w25.ask", l: "Ask to take this up" }, st: "Protocol commitment", ev: "the claim card names what the garden would provide and what support is declared" },
  { f: "W25@context-chooser", hot: { h: "w25.continue" }, st: "Context", ev: "as myself vs for this garden — the locked pre-claim choice; no custody moves either way" },
  { f: "W25@pending", hot: null, st: "Pending", ev: "now it waits on the Green Goods stewards", br: [{ l: "Walk the acceptance", to: "sb46:0" }] },
  { f: "W25@accepted", hot: { h: "w25.open-promise", l: "Open the commitment" }, st: "Accepted", ev: "the garden is the provider; the commitment opens like any other" },
  { f: "W2@garden-provider", hot: null, st: "Accepted", ev: "the garden works and proves on the ordinary rails; the Green Goods stewards confirm — the providing garden never self-confirms", br: [{ l: "Proof and work run as usual", to: "sb4a:0" }, { l: "Verification and payout, Green Goods side", to: "sb46:2" }] },
  { f: "W2@garden-support-arrived", hot: null, st: "Support arrived", ev: "confirmed kept, and the declared support arrived for the garden — the full arc, claim to G$, in one walk", br: [{ l: "How the G$ was dispatched", to: "sb19:0" }] },
]},
{ id: "sb16", n: 16, title: "Withdraw an offer", desc: "Plans change: Maria withdraws her own offer before anyone takes it up, with the reason kept on the record.", persona: "Gardener (Maria)", scen: "S1 edge · MF-2a", reviewVisible: true, reviewGroup: "client", chapter: "change", roles: ["gardener"], steps: [
  { f: "W1", hot: null, st: "Pool open", ev: "your open offer, before anyone takes it up — plans change and the record respects that" },
  { f: "W2@offered", hot: { h: "w2.withdraw", l: "Withdraw this offer…" }, st: "Offered", ev: "withdrawing is the creator's act, with a required reason — pre-acceptance only, from the fixed bar" },
  { f: "W2@withdraw-confirm", hot: { h: "w2.withdraw-send", l: "Withdraw" }, st: "Confirm", ev: "no units were committed, so none release; the reason is stored" },
  { f: "W2@withdrawn", hot: null, st: "Withdrawn", ev: "the timeline names you as the actor — distinct from a steward cancellation", br: [{ l: "The steward's cancellation instead", to: "sb17:3" }] },
]},
{ id: "sb62", n: 30, title: "Withdraw a request", desc: "Ana no longer needs the ride. She withdraws her own request before anyone takes it up, with the reason she gives kept on the record.", persona: "Gardener (Ana)", scen: "S2 edge · MF-2a, requester side", reviewVisible: true, reviewGroup: "client", chapter: "change", roles: ["gardener"], steps: [
  { f: "W1", hot: null, st: "Pool open", ev: "your open request, before anyone has said they can help. The mirror of withdrawing an offer, which had a flow of its own while this had a drawn button and no sheet behind it" },
  { f: "W2@requested", hot: { h: "w2.withdraw-request", l: "Withdraw this request…" }, st: "Requested", ev: "withdrawing is the requester's act, pre-acceptance only, from the fixed bar" },
  { f: "W2@request-withdraw-confirm", hot: { h: "w2.withdraw-request-send", l: "Withdraw" }, st: "Confirm", ev: "the sheet speaks the request's own language. It used to open the offer's: “Withdraw this offer?” over an ask. Nobody committed units to this, so none release, and the reason cancelCommitment stores is required rather than offered" },
  { f: "W2@request-withdrawn", hot: null, st: "Withdrawn", ev: "the timeline names you as the actor and quotes what you said, which is what distinguishes this from a steward cancellation. Asking again is a fresh request, never a retry of this one", br: [{ l: "Withdrawing an offer instead", to: "sb16:1" }, { l: "The steward's cancellation", to: "sb17:3" }] },
]},
{ id: "sb6a", n: 17, title: "Offer it again", desc: "A commitment lapsed with the season; offering it again is one tap into a prefilled composer, and the old record stays honest.", persona: "Gardener (Maria)", scen: "S1/S5 edge", reviewVisible: true, reviewGroup: "client", chapter: "change", roles: ["gardener"], steps: [
  { f: "W1", hot: null, st: "Pool open", ev: "the season moved on and a commitment lapsed — offering again is one tap" },
  { f: "W2@expired", hot: { h: "w2.offer-again", l: "Offer it again" }, st: "Expired", ev: "a lapsed commitment can be offered again — a fresh record, the old one stays honest" },
  { f: "W3", hot: null, st: "1 · What", ev: "the composer opens prefilled from the lapsed commitment", br: [{ l: "Make an offer — the full walk", to: "sb1:1" }] },
]},
{ id: "sb58", n: 28, title: "Fund a priced Offer", desc: "Maria asks to fund Ben's 40 G$ Offer, deposits only after the garden records the pledge, then sees the funded claim.", persona: "Gardener (Maria)", scen: "Member-funded priced Offer", reviewVisible: true, reviewGroup: "client", chapter: "money", roles: ["gardener"], steps: [
  { f: "W1@funded-offer", hot: { h: "w1.ask-funded", l: "Ask to fund this" }, st: "Priced Offer", ev: "Maria files the approval-gated claim herself; the request moves no G$ and does not accept Ben's Offer" },
  { f: "W36@waiting-pledge", hot: null, st: "Claim sent", ev: "the claim waits for a Garden Steward to freeze the funder, price, garden Safe, and refund account" },
  { f: "W36@deposit-instructions", hot: { h: "w36.send-deposit", l: "Open wallet and send 40 G$" }, st: "Funding pledged", ev: "the exact garden Safe and amount appear only after the funding record exists; Maria chooses the ordinary Celo transfer" },
  { f: "W36@deposit-sent", hot: null, st: "Deposit sent", ev: "the wallet transfer alone is not a recorded deposit and does not accept the claim" },
  { f: "W36@pending-acceptance", hot: null, st: "Deposit recorded", ev: "the Garden Steward checked the full transfer; it is held by the garden while the priced Offer still waits for acceptance" },
  { f: "W36@funded", hot: null, st: "Funded", ev: "the accepted commitment carries Maria's 40 G$ funding fact; Ben now follows the ordinary proof and confirmation path", br: [{ l: "If the commitment ends without delivery", to: "screen:W36@refund-queued" }, { l: "The steward checkpoint and refund", to: "sb59:0" }] },
]},
{ id: "sb63", n: 31, title: "See how the season went", desc: "The season ended. A gardener opens it from the pool tab and reads what it grew, who took part, and what the two assessments found.", persona: "Gardener", scen: "S5 · the garden's memory", reviewVisible: true, reviewGroup: "client", chapter: "season-end", roles: ["gardener"], steps: [
  { f: "W1", hot: { h: "w1.open-ended-cycle", l: "Season of Long Dry" }, alts: [{ h: "w1.open-season", l: "The season running now", to: "screen:W1C@season" }, { h: "w1.all-seasons", l: "All seasons", to: "screen:W1C@all-seasons" }], st: "Pool open", ev: "ended cycles trail the live ones in the same rail, so the garden's memory is one swipe away rather than a separate screen. A cycle card is a door, and all three of these open one" },
  { f: "W1C@season-ended", hot: { h: "w1c.tab-people-ended", l: "People" }, st: "Ended", ev: "what the season grew, in its own units and never summed across them: 48 hours, 12 rides, 6 sessions, and the reserve that went to 7 gardeners. Counts stay in their own units because that is what they mean" },
  { f: "W1C@people-ended", hot: { h: "w1c.tab-insights-ended", l: "Insights" }, st: "People", ev: "who took part and what they did, as shared memory rather than a score. Each person's own record stays between them and their stewards" },
  { f: "W1C@insights-ended", hot: null, st: "Insights", ev: "and what the season changed, read from the assessment that opened it against the one that closed it, including the marker that did not move", br: [{ l: "Every season this garden has run", to: "screen:W1C@all-seasons" }, { l: "A kept commitment from it", to: "screen:W2@fulfilled" }, { l: "The steward's side of ending it", to: "sb9c:0" }] },
]},
// sb3 was one 13-scene arc crossing PWA and admin. Split at the surface seam:
// the member's asking-and-hearing-back is its own story, and so is the
// steward's decision. Each keeps the other side as condensed echoes.
{ id: "sb3b", n: 3, title: "Decide who takes up a commitment", desc: "Two neighbours asked for the same scarce opening: David declines one with a reason, accepts the other, and the rest are superseded.", persona: "Steward (David)", scen: "S3 · scarce crew slots", reviewVisible: true, reviewGroup: "admin", chapter: "commitments", roles: ["steward"], steps: [
  { f: "W7@claims", hot: { h: "w7.decline-claim", l: "Decline Maria's row (reason)" }, alts: [{ h: "w7.accept-claim", l: "or accept João now", to: "sb3b:4" }], who: "David", ev: "declineClaim + reason → ClaimDeclined — only Maria's row changes; João stays Pending", cite: "CS:734 · UX:105" },
  { f: "W7@decline-claim-confirm", hot: { h: "w7.decline-claim-confirm", l: "Decline request" }, who: "David", ev: "the confirmation takes the required reason and names what it does not touch — João's request stays pending", cite: "CS:734" },
  { f: "W7@claim-declined", hot: null, who: "David", st: "Maria declined", ev: "the console shows Maria declined while João remains pending", cite: "CS:734" },
  { f: "W1@claim-declined", hot: null, surface: "pwa", echo: true, marks: ["w1.ask-again"], st: "Declined", ev: "Maria reads the recorded reason and may ask afresh — a new request record, never a retry", cite: "UX:105" },
  { f: "W7@claims", hot: { h: "w7.accept-claim", l: "Accept João's row" }, who: "David", ev: "acceptClaim consumes João's stored terms → CommitmentAccepted · every other pending row → Superseded", cite: "CS:733 · DG:696" },
  { f: "W7@claim-outcomes", hot: null, who: "David", st: "Claim outcomes", ev: "the accepted row and superseded alternatives are visible before returning to members", cite: "DG:696" },
  { f: "W1@claim-superseded", hot: null, surface: "pwa", echo: true, st: "Superseded", ev: "the other claimant sees 'taken up by another provider' — the resolution code names the cause", cite: "UX:106 · DG:706" },
]},
// Split at the actor seam 2026-08-10 (register #96): the steward approves
// work; the evaluator's attestation is sb50's story.
{ id: "sb4b", n: 4, title: "Approve the work", desc: "The steward decides both queue rows on the existing rails: one approval counted toward the commitment, one rejection with its recorded reason.", persona: "Steward", scen: "S4 · AGRO+EDU", reviewVisible: true, reviewGroup: "admin", chapter: "work", roles: ["steward"], steps: [
  { f: "HUBWORK", hot: { h: "hub.approve", l: "Approve João's session" }, who: "steward", st: "Queue — 2 waiting", ev: "the existing WorkApproval rails decide; the row carries who, what, and its one primary act", cite: "CS:737" },
  { f: "HUBWORK@approve-confirm", hot: { h: "hub.approve-confirm", l: "Approve work" }, who: "steward", st: "Approve — confirm", ev: "the confirmation names the commitment the work fulfils; approval stores no reason and counts once while the commitment stays unfrozen", cite: "CS:737" },
  { f: "HUBWORK@approved", hot: { h: "hub.reject", l: "Reject Ana's work (reason)" }, who: "steward", st: "Approved · 1 of 2 counted", ev: "onWorkDecision → ApprovedWorkCounted ticks the commitment's requirement on the queue row; the second submission still waits", cite: "CS:737 · CS:138a", br: [{ l: "Attest a re-assessment", to: "sb50:0" }] },
  { f: "HUBWORK@reject-reason", hot: { h: "hub.reject-confirm", l: "Reject work" }, who: "steward", st: "Reject — reason required", ev: "rejection takes the reason the record stores; a newer rejection replacing active pre-freeze credit emits ApprovedWorkReversed", cite: "CS:737" },
  { f: "HUBWORK@rejected", hot: null, who: "steward", st: "Both decided", ev: "the outcome set stays on the queue — approved counted, rejected with its reason — and the assessment gate remains the evaluator's from here", cite: "CS:737 · CS:138a" },
]},
// The evaluator's side of readiness, split from sb4b (register #96), then split
// again at its own actor seam 2026-08-11 (D3 round 2, Afo): attesting is the
// Evaluator-hat holder's act inside the Create Assessment flow, and attaching
// the result to a commitment is a steward's act on a different screen. The fused
// title was the tell — one card, two people, two workspaces.
{ id: "sb50", n: 50, title: "Attest a closing assessment", desc: "Dr. Chen records the season's closing assessment end to end — attributed to the cycle, compared with its starting record, and attested.", persona: "Evaluator (Dr. Chen)", scen: "S4 · AGRO+EDU", reviewVisible: true, reviewGroup: "admin", chapter: "assess", roles: ["evaluator"], steps: [
  { f: "W13@assess", hot: { h: "w13.new-assessment", l: "Create assessment" }, skipTargetReason: "the closing cast opens the Evaluator-hat variant of the same Create Assessment flow the starting-record walk enters", who: "Dr. Chen", st: "Assess stage", ev: "the existing Hub stage opens the assessment flow — §6.6 extends it rather than forking it", cite: "UX:257" },
  { f: "W14@delta", hot: { h: "w14.continue", l: "Continue" }, who: "Dr. Chen", marks: ["w14.kind"], st: "For the season · at the close", ev: "the form speaks timing and attribution — for the Season, at the close — and derives the wire kind underneath: a delta compared with the starting record, Evaluator Hat only", cite: "WF:447-455" },
  { f: "W14@kernel", hot: { h: "w14.continue-kernel", l: "Continue" }, who: "Dr. Chen", st: "Strategy Kernel", ev: "the existing step continues unchanged — diagnosis, outcomes, complexity", cite: "UX:257" },
  { f: "W14@harvest", hot: { h: "w14.attest", l: "Attest assessment" }, who: "Dr. Chen", st: "Actions & Harvest", ev: "actions and the reporting period close the form; attesting records the assessment with its cycle reference and derived comparison pointer", cite: "UX:257" },
  { f: "W13@assess", hot: null, who: "Dr. Chen", st: "Attested", ev: "the closing assessment lands back on the Assess stage; the per-commitment assessment gate stays Hub-side for v1 (decision 4), its state drawn in the library", cite: "UX:257", br: [{ l: "The library's attach-assessment state", to: "screen:W10@attach-assessment" }, { l: "The pool's starting record instead", to: "sb22:0" }] },
]},
// sb57 ("Attach an assessment to a commitment") retired 2026-08-16, decision 4:
// the per-commitment assessment gate stays Hub/evaluator-side for v1, so no
// steward journey walks it. The on-chain call and its W10@attach-assessment
// state remain in the Screen library for state coverage (ICommitmentPoolingModule:930).
// The confirmation act itself, extracted from sb1 (2026-08-10) so the recipient
// has one short flow of their own — and so sb4a/sb4b can hand off cleanly
// instead of jumping into the middle of a 22-scene ribbon.
// The steward's side of a “not yet”, split out 2026-08-10: the member flow
// ends at “under review”, and this short admin flow owns the resolution act.
{ id: "sb47", n: 47, title: "Resolve a “not yet”", desc: "From the Hub's queue, David resolves a commitment under review by restoring the exact state it held before, with his reason on the timeline.", persona: "Steward (David)", scen: "S5", reviewVisible: true, reviewGroup: "admin", chapter: "commitments", roles: ["steward"], steps: [
  { f: "W13", hot: { h: "w13.disputed-row", l: "Open the under-review row" }, who: "David", st: "Confirm queue", ev: "a commitment frozen for review waits in the Hub's queue beside the fallback rows — the flow starts where the steward actually finds it", cite: "UX §6.9" },
  { f: "W10@resolve-dispute", hot: { h: "w10.resolve", l: "Resolve (eligible outcomes + reason)" }, who: "David", st: "Under review", ev: "David is also a contributor, so Fulfilled is hidden by the SelfConfirmation guard; this fixture resolves RestorePrevious while Cancelled and Expired remain available", cite: "CS:144" },
  { f: "W2@ready-confirmer", hot: null, surface: "pwa", echo: true, st: "ReadyForConfirmation restored", ev: "RestorePrevious returns the exact stored pre-dispute state — no unit movement — and every resolution reason renders in the member timeline", cite: "LAP:186 · UX:300", note: "This fixture entered dispute from ReadyForConfirmation, so RestorePrevious must return there rather than Accepted." },
]},
{ id: "sb6b", n: 6, title: "Re-seed a commitment that lapsed", desc: "David expires a past-due seeded commitment and re-seeds it through the prefilled wizard.", persona: "Steward (David)", scen: "S1/S5 edge", reviewVisible: true, reviewGroup: "admin", chapter: "commitments", roles: ["steward"], steps: [
  { f: "W7@due-live", hot: { h: "w7.expire-commitment", l: "Expire now" }, who: "David", st: "Accepted · past due", ev: "permissionless expireCommitment → Expired; releases the reservation once, supersedes pending claims, and decrements pool/cycle live counts", cite: "CS:746 · UX:94", mf: true },
  { f: "W7@expiry-queue", hot: { h: "w7.reseed", l: "Re-seed" }, who: "David", ev: "lapsed seeded commitment re-enters W8 prefilled", cite: "UX:94", mf: true },
  { f: "W8@step1", hot: { h: "w8.continue-scope", l: "Continue" }, who: "David", ev: "checks the seeded commitment's kind, direction, cycle, and words — the composer's What step", cite: "UX:94" },
  { f: "W8@step2", hot: { h: "w8.continue-requirements", l: "Continue" }, who: "David", ev: "checks units, target, due, and the contributor policy — How much", cite: "UX:94" },
  { f: "W8@step3", hot: { h: "w8.continue-rule", l: "Continue" }, who: "David", ev: "the protection step: ordinary reachability, the pilot-default Green Goods team fallback, threshold, claim mode — with the declared reward as its Advanced detour", cite: "UX §6.3" },
  { f: "W8@step4", hot: { h: "w8.seed", l: "Seed this commitment" }, who: "David", ev: "the sectioned review repeats every choice by the step that captured it, then creates the fresh seeded commitment", cite: "UX:94" },
  { f: "W7", hot: null, who: "David", st: "Open", ev: "the reseeded commitment returns to the pool workspace", cite: "UX:94" },
]},
// Condensed from 12 scenes: the member's ordinary evidence-and-confirmation
// path is sb1/sb2's job, so this flow keeps only what capture changes — who
// records the commitment, and how a steward confirms when the member cannot.
{ id: "sb8", n: 8, title: "Record a commitment for a device-free member", desc: "Kwame has no phone, so David records his commitment for him from the console's Seed door — it stays Kwame's commitment.", persona: "Steward (David)", scen: "S7 · device-free member", reviewVisible: true, reviewGroup: "admin", chapter: "behalf", roles: ["steward", "member"], steps: [
  { f: "W7", hot: { h: "w7.seed", l: "Seed" }, who: "David", st: "Open", ev: "capture starts where every steward creation starts — the view's Seed action", cite: "UX:154" },
  { f: "W8@step1", hot: { h: "w8.kind-capture", l: "Capture for a member" }, who: "David", ev: "the What step's fourth kind routes into the capture flow — same entry, different scribe", cite: "UX:323" },
  { f: "W9", hot: { h: "w9.choose", l: "Choose Kwame" }, who: "David", ev: "select the member whose commitment is being recorded", cite: "WF:354-357" },
  { f: "W9@capture-kind", hot: { h: "w9.continue", l: "Continue to captured commitment" }, who: "David", ev: "capturedFor and capture kind are reviewed; captured confirmations always carry a reason", cite: "WF:354-357" },
  { f: "W8@captured-for", hot: { h: "w8.record", l: "Record it" }, who: "David", ev: "commitment job (StewardCaptured, onBehalfOf) → CommitmentCreated(creator = member, recordedBy = steward)", cite: "CS:730 · DG:236" },
  { f: "W7", hot: null, who: "David", st: "Open", ev: "the captured commitment appears in the admin pool workspace — recording done, four taps total", cite: "UX:437" },
  { f: "W2@captured", hot: null, surface: "pwa", echo: true, marks: ["w2.captured-chip"], st: "Accepted", ev: "the recorded commitment appears as Kwame's own, ready for proof and confirmation on the member side", cite: "WF:138 · UX:437", br: [{ l: "The member's side — proof to confirmation (recorded-commitment cast)", to: "screen:W2@captured" }] },
]},
// The confirmation half of the device-free story (2026-08-16 review): the
// capture door's third kind is the steward's OWN fallback confirmation — never
// signed as the member — and it was drawn nowhere. This walk shows who is
// named on-chain at each moment.
{ id: "sb8b", n: 8, title: "Confirm a device-free member's commitment", desc: "Kwame kept his commitment but has no phone to confirm from, so David records a fallback confirmation in his own name.", persona: "Steward (David)", scen: "S7 · device-free member", reviewVisible: true, reviewGroup: "admin", chapter: "behalf", roles: ["steward", "member"], steps: [
  { f: "W7", hot: { h: "w7.seed", l: "Seed" }, who: "David", st: "Open", ev: "the same console entry as every capture — the view's Seed action", cite: "UX:154" },
  { f: "W8@step1", hot: { h: "w8.kind-capture", l: "Capture for a member" }, who: "David", ev: "the What step's fourth kind routes into the capture flow", cite: "UX:323" },
  { f: "W9", hot: { h: "w9.choose", l: "Choose Kwame" }, who: "David", ev: "select the member whose commitment the confirmation concerns", cite: "WF:354-357" },
  { f: "W9@capture-kind", hot: { h: "w9.kind-confirmation", l: "A confirmation of their commitment" }, who: "David", ev: "the third capture kind is the steward's own act, not the member's — the label says whose it is", cite: "UX:323" },
  { f: "W9@capture-fallback", hot: { h: "w9.record-confirmation", l: "Confirm as garden fallback" }, who: "David", st: "Record — reason required", ev: "the fallback confirmation completes inside the capture flow's own shell: confirmFulfillmentAsFallback names the caller, the PoolFallback path, and the reason — “Recipient has no device” is a canned chip", cite: "CS §6.1 · UX:323" },
  { f: "W2@captured-fulfilled", hot: null, surface: "pwa", echo: true, st: "Fulfilled — steward fallback", ev: "the member timeline reads “confirmed by garden steward — fallback” with the reason; the commitment stays Kwame's, the confirmation stays David's", cite: "UX:519" },
]},
// The member's side of a steward-recorded commitment, split from sb8 (2026-08-10):
// evidence, readiness, and the counterparty's confirmation on the client PWA.
// The campaign-request cast's full walk (register #97): evidence to confirmed
// without losing the Campaign binding — previously screen-library-only.
// The exchange wave graduates to the registry (register #97): acceptExchange is
// shipped and tested on-chain, so the planned SB-35/SB-36 become walkable.
// "Both start together" ends at acceptance — after that, two ordinary lanes.
// Split from one 33-scene ribbon (register: audit 2026-07-24). Each of the three
// covers one stewardship task end to end; the original concatenated readiness,
// seeding, allocation, pause/resume, close, compost and cancel, so a reviewer
// parachuted mid-flow had no chapter to orient against.
{ id: "sb9a", n: 9, title: "Set up commitments and open the first season", desc: "One setup pass: what the pool is for, the season, the split — then a single step opens the pool and its first season together.", persona: "Steward (David)", scen: "S5/S13 admin side", reviewVisible: true, reviewGroup: "admin", chapter: "season", roles: ["steward"], steps: [
  { f: "W7@preflight-complete", hot: { h: "w7.setup", l: "Set up commitments" }, who: "David", st: "Not taking commitments yet", ev: "the garden's starting assessment is recorded, so the tab offers exactly one way forward — the pool's on-chain readiness states are never a steward's job", cite: "UX:298", br: [{ l: "Before the assessment exists", to: "screen:W7@not-ready" }] },
  { f: "W11@setup-how", hot: { h: "w11.setup-continue-how", l: "Continue" }, who: "David", st: "Nothing recorded yet", ev: "plain language for what the contract calls the charter, with the provider open-commitment cap defaulted behind Advanced; the blocked cast names a missing starting assessment instead of failing at submit", cite: "CS:723,751", br: [{ l: "When the starting assessment is missing", to: "screen:W11@setup-how-blocked" }] },
  { f: "W11@setup-season", hot: { h: "w11.setup-continue-season", l: "Continue" }, who: "David", st: "Season named", ev: "one season runs at a time; campaigns come later and run beside it", cite: "UX:66" },
  { f: "W11@setup-split", hot: { h: "w11.setup-continue-split", l: "Continue" }, who: "David", st: "Standard split applied", ev: "the six-role split arrives already applied and must total 100%; gardener sharing takes its standard 35/65 for the first season", cite: "CS:114 · UX:322" },
  { f: "W11@setup-open", hot: { h: "w11.setup-open-all", l: "Open the season" }, who: "David", st: "One write moment", ev: "the final step submits the whole ordered sequence — setPoolCharter, setProviderOpenCommitmentCap, markPoolReady, seedCycle, openPool, openCycle — and names in plain words what opens", cite: "CS:724 · CS:100 · CS:114 · CS:727", mf: true },
  { f: "W7", hot: null, who: "David", st: "Taking commitments · season live", ev: "the pool workspace returns with the season live beside its (still empty) campaign row — six scenes, one flow, no state-machine vocabulary", cite: "CS:114", br: [{ l: "Members see the Season card go live", to: "screen:W1" }, { l: "The member's opens-soon preview", to: "screen:W1@seeded" }] },
]},
{ id: "sb9b", n: 9, title: "Pause and resume the pool", desc: "David pauses the pool with a reason members read, then resumes it — recovery paths stay open the whole time.", persona: "Steward (David)", scen: "S5/S13 admin side", reviewVisible: true, reviewGroup: "admin", chapter: "season", roles: ["steward"], steps: [
  { f: "W7", hot: { h: "w7.pause", l: "Pause… (Pool card)" }, who: "David", st: "Open", ev: "the container's lifecycle lives on the Pool card in the rail — pausePool takes a reason members read; create/claim/Ready-submit/confirm wait while recovery stays available", cite: "UX:60 · UX:299" },
  { f: "W7@pause-confirm", hot: { h: "w7.pause-confirm", l: "Pause pool" }, st: "Pause — confirm", ev: "the blast radius (23 members, 7 open commitments) and the stored reason are both named before anything pauses", cite: "UX:60 · CS:725" },
  { f: "W7@paused", hot: { h: "w7.resume", l: "Resume" }, who: "David", st: "Paused", ev: "the Pool card holds the indexed pause reason and the recovery action; members read the same reason in a quiet banner", cite: "UX:60", br: [{ l: "The member's paused banner", to: "screen:W1@paused" }] },
  { f: "W7", hot: null, who: "David", st: "Open", ev: "resumePool clears the indexed reason and the pool returns open", cite: "CS:725" },
]},
// Split at the act seams 2026-08-16 (admin prototype review, Afo): the old
// sb9c concatenated five acts — end the season, close the pool, compost it,
// reopen it, and the cancel variant — into one 17-scene ribbon. Ending a
// season (sb9c), retiring the pool (sb9d), and cancelling a season (sb9e) are
// three sittings with three outcomes.
{ id: "sb9c", n: 9, title: "End the season", desc: "The close wizard end to end — close the exact bundle, read the shares, mint the certificate, and compost the season.", persona: "Steward (David)", scen: "S5/S13 admin side", reviewVisible: true, reviewGroup: "admin", chapter: "season", roles: ["steward"], steps: [
  { f: "W7", hot: { h: "w7.close-season", l: "Close season… (Season row)" }, who: "David", st: "Reviewing", ev: "the season's own acts live on its row in the Cycles card; opening the close wizard reconciles nothing early — the cycle stays Open on-chain while outstanding items are reviewed", cite: "UX:338 · CS:118", br: [{ l: "Variant: cancel the season instead", to: "sb9e:0" }] },
  { f: "W26@review", hot: { h: "w26.continue-shares", l: "Close cycle and continue" }, st: "Terminal set · live count zero", ev: "closeCycle runs before any share review or mint, locking the exact fulfilled commitment bundle as Reconciled", cite: "UX:75 · CS:118", mf: true },
  { f: "W26@shares", hot: { h: "w26.continue-certificate", l: "Continue to certificate" }, st: "Reconciled · allocation snapshot", ev: "reads back the six-role share snapshot against the now-closed commitment set", cite: "UX:75" },
  { f: "W26@certificate", hot: { h: "w26.mint", l: "Mint impact certificate" }, st: "Reconciled · certificate", ev: "bundles the closed cycle's fulfilled commitments with their work, proof, and lineage", cite: "CS §9" },
  { f: "W26@rest", hot: { h: "w26.compost", l: "Compost closed cycle" }, st: "Reconciled · certificate minted", ev: "compostCycle archives the already-closed cycle; it does not repeat closeCycle", cite: "UX:338 · CS:118", mf: true },
  { f: "W7@cycle-composted", hot: null, who: "David", st: "Composted", ev: "the season returns to the console only after both lifecycle writes succeed; the next season's door and the pool coda are their own sittings", cite: "CS:118-119", br: [{ l: "The member's view of the finished season", to: "screen:W1C@season-ended" }, { l: "Close and compost the pool", to: "sb9d:0" }] },
]},
{ id: "sb9d", n: 9, title: "Close and compost the pool", desc: "After the last cycle composts: participation ends, the pool archives, and the explicit reopen path brings the next era back to Ready.", persona: "Steward (David)", scen: "S5/S13 admin side", reviewVisible: true, reviewGroup: "admin", chapter: "season", roles: ["steward"], steps: [
  { f: "W7@cycle-composted", hot: { h: "w7.close-pool", l: "Close pool" }, who: "David", st: "All cycles composted", ev: "every cycle — the Season and all three Campaigns — has composted, which is the condition that makes Close pool appear at all (uiux §6.2); the next season's door stays available beside it", cite: "CS:102" },
  { f: "W7@close-pool-confirm", hot: { h: "w7.close-pool-confirm", l: "Close pool" }, who: "David", st: "Close — confirm", ev: "closing ends participation for the pool's 23 members; the confirmation names that blast radius — closePool stores no reason (CS:556)", cite: "CS:102 · CS:556" },
  { f: "W7@pool-closed", hot: { h: "w7.compost-pool", l: "Compost pool" }, who: "David", st: "Closed", ev: "the pool closes for members too — its history stays with the garden; the archive action opens a confirmation before compostPool runs", cite: "CS:102-103", br: [{ l: "The member's closed view", to: "screen:W1@closed" }] },
  { f: "W7@compost-pool-confirm", hot: { h: "w7.compost-confirm", l: "Compost pool" }, who: "David", st: "Closed · confirm archive", ev: "the confirmation names archival without inventing a stored reason or wider blast radius", cite: "CS:103" },
  { f: "W7@pool-composted", hot: { h: "w7.reopen-pool", l: "Reopen pool" }, who: "David", st: "Composted", ev: "the archived pool offers the explicit reopen path", cite: "UX:62 · CS:104" },
  { f: "W7@reopen-confirm", hot: { h: "w7.reopen-confirm", l: "Reopen to Ready" }, who: "David", st: "Reopen — confirm", ev: "reopenPool(poolId, false) preserves history and returns the pool to Ready", cite: "CS:104" },
  { f: "W7@ready", hot: null, who: "David", st: "Ready", ev: "the reopened pool is prepared but member participation stays closed until openPool", cite: "UX:58" },
]},
{ id: "sb9e", n: 9, title: "Cancel a season with a reason", desc: "cancelCycle ends the season for everyone in it; members read the recorded reason, and the pool stays open for the next one.", persona: "Steward (David)", scen: "S5/S13 admin side", reviewVisible: true, reviewGroup: "admin", chapter: "season", roles: ["steward"], steps: [
  { f: "W7", hot: { h: "w7.close-season", l: "Close Season…" }, who: "David", st: "Open", ev: "both endings start here: closing and cancelling are legal at the same moment — each needs zero live commitments — so the season carries ONE act and the flow presents the choice", cite: "UX:77 · CS:117" },
  { f: "W26@review", hot: { h: "w7.cancel-cycle", l: "Cancel Season Instead…" }, who: "David", st: "Terminal set · nothing live", ev: "the close flow's first step offers the alternative ending in place, with the season's own counts already on screen", cite: "UX:77 · CS:104", note: "cancelCycle is legal only from Seeded or Open (CS:117), never after compost or close." },
  { f: "W7@cancel-cycle-confirm", hot: { h: "w7.cancel-cycle-confirm", l: "Cancel season" }, st: "Cancel — confirm", ev: `the season's own counts (${SEASON_LIVE.made} commitments, ${SEASON_LIVE.kept} kept) are named before the cancel, alongside the reason members will read`, cite: "UX:77" },
  { f: "W7@open-no-cycle", hot: null, who: "David", st: "Cycle cancelled · pool open", ev: "only the season ended — the pool stays open without an active cycle, and the next season starts from Quick actions", cite: "CS:104", br: [{ l: "The member's quiet reason banner", to: "screen:W1@cancelled-cycle" }] },
]},
{ id: "sb10", n: 10, title: "Confirm on the fallback path and record the payout", desc: "A reward declared as a reference only: David confirms on the garden fallback path, then records the payout executed elsewhere.", persona: "Steward (David) + gardener", scen: "S13 · July's only rail", reviewVisible: true, reviewGroup: "admin", chapter: "recognition", roles: ["steward"], steps: [
  { f: "W13", hot: { h: "w13.row", l: "open the garden-fallback row" }, alts: [{ h: "w13.protocol-row", l: "or an opted-in Green Goods team row", to: "screen:W10@protocol-fallback-confirm" }], who: "David", st: "ReadyForConfirmation", ev: "Hub Confirm stage labels ordinary, garden fallback, and Green Goods team fallback eligibility distinctly; the reward was declared at seeding as the composer's Advanced detour", cite: "UX §6.9", br: [{ l: "Where the reward rail was declared", to: "screen:W8@step3" }] },
  { f: "W10@detail-fallback-eligible", hot: null, st: "ReadyForConfirmation · ordinary path unreachable", ev: "the indexed eligibility result exposes garden fallback only after the ordinary named/default path can no longer reach threshold", cite: "CS §6.1" },
  { f: "W10@external-fulfilled", hot: null, st: "Fulfilled", ev: "confirmFulfillmentAsFallback records the non-contributor garden steward and required reason; the reward is now recordable", cite: "CS §6.1" },
  { f: "W10@external-fulfilled", hot: { h: "w10.record-payout", l: "Record payout" }, ev: "ArbitrumExternal permits AdminConfirmDialog to capture the rail reference → recordConsiderationPaid → ConsiderationPaid", cite: "CS:749", note: "register #34h — the dry run runs this with a real minimal Cookie Jar withdrawal" },
  { f: "W10@record-payout", hot: { h: "w10.payout-confirm", l: "Record payout" }, st: "Payout confirmation", ev: "the steward reviews the declared reward and records the executed rail reference", cite: "UX:302" },
  { f: "W7", hot: null, who: "David", st: "Payment recorded", ev: "recordConsiderationPaid closes the loop in the workspace; the member's row reads reward released on their side", cite: "UX:143,202", br: [{ l: "The member's reward row", to: "screen:W2@reward-released" }] },
]},
{ id: "sb12", n: 12, title: "Dispatch queued support and close the loop", desc: "Three payouts prepared, batched, and dispatched to Celo — including what happens to the one that comes back failed.", persona: "Steward + protocol executor", scen: "S8/S9 · pre-broadcast proof", reviewVisible: true, reviewGroup: "admin", chapter: "ggops", roles: ["green-goods-team"], steps: [
  { f: "W21@payout-finalized", hot: { h: "w21.prepare-payout", l: "Prepare Maria payout" }, st: "Finalized · 0 of 3 prepared", ev: "the steward materializes exactly one immutable queued child from Maria's frozen row", cite: "SS §3" },
  { f: "W21@payout-prepared", hot: { h: "w21.prepare-ana", l: "Prepare Ana payout" }, st: "Pending · 1 of 3 prepared", ev: "Ana's still-unprepared non-zero row remains explicitly actionable", cite: "SS §3" },
  { f: "W21@payout-prepared-2", hot: { h: "w21.prepare-kwame", l: "Prepare Kwame payout" }, st: "Pending · 2 of 3 prepared", ev: "Kwame's final payable row materializes its immutable child", cite: "SS §3" },
  { f: "W21@payout-prepared-all", hot: { h: "w21.create-batch", l: "Create batch" }, st: "Pending · 3 of 3 prepared", ev: "all prepared children can enter the optional homogeneous batch review before membership becomes immutable", cite: "SS §3" },
  { f: "W21@batch-create", hot: { h: "w21.create-batch-confirm", l: "Create batch" }, st: "Homogeneous selection", ev: "createBatch checks the shared source, route, version, and gas limit, then stores one immutable member snapshot", cite: "SS §3.1.2" },
  { f: "W21@batch-created", hot: { h: "w21.open-batch-command", l: "Open batch command" }, st: "Queued batch", ev: "batch #12 exists with two immutable members; its execution key is still created only when dispatch begins", cite: "SS §3.1.2" },
  { f: "W22", hot: { h: "w22.dispatch-command", l: "Dispatch command" }, alts: [{ h: "w22.cancel-batch", l: "or cancel the whole batch", to: "screen:W22@cancel-batch-confirm" }], st: "Queued", ev: "dispatch sends versioned data only with zero token amounts; cancelling instead closes the immutable member set atomically — there is no partial member path", cite: "SS §3 · SS §3.1.3" },
  { f: "W22@dispatched", hot: { h: "w22.open-command-explorer", l: "Open command in CCIP Explorer" }, ev: "command ID and destination status stay inspectable", cite: "SS §3" },
  { f: "W22@delivery-delayed", hot: { h: "w22.retry-command", l: "Retry command" }, ev: "derived delay exposes same-key retry and manual-execution guidance without a state mutation", cite: "SS §3" },
  { f: "W22@executed", hot: { h: "w22.retry-acknowledgment", l: "Retry acknowledgment" }, st: "Celo executed / acknowledgment pending", ev: "Celo stores its idempotent outcome before acknowledgment; retry cannot call the route again", cite: "SS §4" },
  { f: "W22@acknowledgment-pending", hot: { h: "w22.retry-acknowledgment-again", l: "Retry acknowledgment" }, st: "Acknowledgment pending", ev: "fee or delivery recovery may resend only the stored acknowledgment", cite: "SS §4" },
  { f: "W22@outcome", hot: null, marks: ["w22.requeue-member"], ev: "authenticated success → Confirmed; authenticated bounded failure → Failed; the steward explicitly requeues or terminally closes that member", cite: "SS §3" },
  { f: "W21@failed-recovery", hot: { h: "w21.cancel-failed", l: "Close failed delivery" }, ev: "Failed → Cancelled preserves the failed attempt and creates no new execution key", cite: "SS §3.1" },
  { f: "W21@close-delivery-confirm", hot: { h: "w21.close-delivery-confirm", l: "Close delivery" }, ev: "the terminal close names what survives it: the failed attempt, its bounded failure code, and no new execution key", cite: "SS §3.1" },
  { f: "W21@cancelled-failed", hot: null, st: "Cancelled from Failed", ev: "the result keeps the prior failed attempt and recorded reason visible without implying another delivery", cite: "SS §3.1" },
]},
// The Green Goods stewards' side of a garden claim, split from sb13
// (2026-08-10): acceptance and verification live where that team acts.
{ id: "sb46", n: 46, title: "Accept a garden's claim", desc: "The Green Goods stewards accept Awka Hub as the provider, then verify the commitment the providing garden may never confirm itself.", persona: "Protocol steward", scen: "S14", reviewVisible: true, reviewGroup: "admin", chapter: "ggops", roles: ["green-goods-team"], steps: [
  { f: "W12", hot: { h: "w12.accept", l: "Accept" }, who: "protocol steward", ev: "accept consumes the stored terms → providerGarden derived · other pending rows Superseded", cite: "CS:733", skipTargetReason: "the claimant garden's accepted view is linked as a branch; the protocol steward continues in the confirmations queue", br: [{ l: "Leila's garden sees the claim accepted", to: "screen:W25@accepted" }] },
  { f: "W12", hot: { h: "w12.confirm-row", l: "confirmations queue" }, ev: "the protocol confirmations queue mirrors the Hub Confirm grammar", cite: "WF:417" },
  { f: "W10@garden-ready", hot: null, st: "ReadyForConfirmation", ev: "the protocol stewards verify it — the providing garden is excluded from confirming its own commitment", cite: "UX:318 · CS:743", br: [{ l: "Where the G$ goes next", to: "sb19:0" }] },
]},
// The other end of the same rail (register #96): the protocol pool making its
// own asks and offers to gardens. Full coverage: seed here → claim in sb13 →
// accept in sb46 → pay in sb19.
{ id: "sb49", n: 49, title: "Seed a protocol commitment for gardens", desc: "The protocol pool makes its own ask: a prefilled seed that eligible garden stewards can claim on behalf of their gardens.", persona: "Protocol steward", scen: "S14 · protocol seeding", reviewVisible: true, reviewGroup: "admin", chapter: "ggops", roles: ["green-goods-team"], steps: [
  { f: "W12", hot: { h: "w12.seed", l: "Seed a protocol commitment" }, who: "protocol steward", st: "Protocol pool Open", ev: "the protocol pool makes its own asks and offers to gardens — seeding starts in the Community workspace", cite: "UX §6.8" },
  { f: "W12@seed-protocol", hot: { h: "w12.seed-confirm", l: "Seed this protocol commitment" }, who: "protocol steward", st: "Prefilled review", ev: "a protocol request for garden-provided service — kind, unit, target, and steward-reviewed claim mode arrive prefilled (register #19); protocol stewards are the ordinary confirmers", cite: "CS:577 · UX:311" },
  { f: "W12", hot: null, st: "Published", ev: "the seeded commitment joins the protocol rows, claimable by eligible garden stewards for their gardens", cite: "CS:577-589", br: [{ l: "A garden claims it", to: "sb13:0" }] },
]},
// The money leg: a provider garden turns declared support into one conserved
// plan, then pays the credited contributors from its own Safe.
{ id: "sb19", n: 19, title: "Pay a garden team from its Safe", desc: "Declared support becomes one conserved payout plan — drafted, finalized, prepared, and dispatched from the garden's own Safe.", persona: "Garden steward", scen: "S14 · settlement", reviewVisible: true, reviewGroup: "admin", chapter: "settlement", roles: ["steward"], steps: [
  { f: "W21@gate-status", hot: null, st: "gate enabled", ev: "member delivery is enabled and the route is registered — the precondition for queueing anything at all", cite: "SS §3.1" },
  { f: "W10@garden-ready", hot: { h: "w10.garden-confirm", l: "Confirm — commitment kept" }, st: "ReadyForConfirmation", ev: "confirmFulfillment by a named protocol steward; no reason is stored on the ordinary path", cite: "CS:743" },
  { f: "W10@garden-fulfilled", hot: { h: "w10.queue-settlement-garden", l: "Set contributor payout" }, st: "Fulfilled", ev: "the CeloSettlement rail replaces Record payout and starts from recognition weights — the two rails are exclusive", cite: "AM §2 · SS §3" },
  { f: "W10@queue-settlement-garden", hot: { h: "w10.queue-settlement-garden-confirm", l: "Create draft" }, ev: "createCommitmentPayoutPlan persists the one stable parent with its canonical recognition-bound default, then opens the separate recoverable edit", cite: "SS §3" },
  { f: "W21@payout-plan-edit", hot: { h: "w21.edit-save", l: "Save complete draft" }, st: "Draft edit", ev: "setContributorPayouts atomically commits a new complete Draft snapshot and returns to review", cite: "SS §3.1" },
  { f: "W21@payout-plan", hot: { h: "w21.finalize-plan", l: "Finalize payout plan" }, st: "Draft", ev: "finalization verifies recognition/payment snapshots, canonical recipients, and explicit retention plus contributor payout amounts equals declared support", cite: "SS §3.1" },
  { f: "W21@payout-finalized", hot: { h: "w21.prepare-payout", l: "Prepare payout" }, st: "Pending · finalized · unprepared", ev: "finalization created no child; the steward now materializes Maria's frozen row as one idempotent queued settlement", cite: "SS §3.1" },
  { f: "W21@payout-prepared", hot: { h: "w21.dispatch-plan", l: "Dispatch" }, st: "Pending · 1 of 3 prepared", ev: "the queued child is immutable before dispatch; an all-retained zero-payable plan would already be Complete without CCIP", cite: "SS §3.1" },
  { f: "W22@individual-dispatched", hot: null, st: "Individual · dispatched", ev: "the unbatched child uses its own execution key and retryCommand; batch #12 remains a separate subject", cite: "SS §3" },
  { f: "W21@payout-partial", hot: null, st: "Partial", ev: "one contributor arrived, one remains pending, and one failed; the stable parent pointer, successful child, and recognition record remain final", cite: "SS §3.1" },
  { f: "W24@flows", hot: { h: "w24.queue-funding", l: "Seed / top up" }, st: "Independent funding route", ev: "the cross-garden board keeps discretionary GG protocol Safe → garden Safe funding separate from contributor payout plans", cite: "SS §3" },
  { f: "W24@funding", hot: { h: "w24.queue-funding-confirm", l: "Queue seed / top up" }, st: "Authorized treasury action", ev: "only a protocol steward or SettlementModule owner may submit; deployer status alone is insufficient", cite: "SS §3.1.3" },
  { f: "W21@protocol-funding-queued", hot: null, st: "Funding · ProtocolToGarden · Queued", ev: "the emitted row has no commitment ID and cannot be mistaken for an earned contributor reward", cite: "SS §3.1.3", br: [{ l: "What each member sees arrive", to: "screen:W2@garden-support-arrived" }] },
]},
{ id: "sb59", n: 29, title: "Accept a funded claim and return it if needed", desc: "A Garden Steward records Maria's deposit, accepts the funded claim, then queues the same amount back when the commitment ends without delivery.", persona: "Garden Steward", scen: "Member-funded priced Offer · settlement", reviewVisible: true, reviewGroup: "admin", chapter: "settlement", roles: ["steward"], steps: [
  { f: "W7@claims", hot: { h: "w7.open-funded-claim", l: "Review Funding" }, st: "Claim waiting", ev: "the priced Offer claim is a separate checkpoint; no deposit or acceptance is inferred from Maria's request" },
  { f: "W37@claim", hot: { h: "w37.record-funding", l: "Create funding record" }, st: "Funding not pledged", ev: "recordFunding freezes Maria, the 40 G$ price, the Rocinha Safe, and her refund account; an exact retry returns the same record" },
  { f: "W37@pledged", hot: { h: "w37.record-deposit", l: "Record checked deposit" }, st: "Pledged", ev: "the steward checks the Safe transfer and its unique reference before recording the full deposit" },
  { f: "W37@deposit-recorded", hot: { h: "w37.accept-funded", l: "Accept funded claim" }, st: "Deposit recorded", ev: "acceptClaim and consumeFunding bind the recorded deposit to Ben's Accepted Offer; the spendable display subtracts open earmarks" },
  { f: "W37@consumed", hot: null, st: "Consumed", ev: "the funding fact remains attached while Ben's commitment follows the ordinary proof and confirmation path" },
  { f: "W37@refund-eligible", hot: { h: "w37.queue-refund", l: "Queue refund" }, st: "Cancelled · refund eligible", ev: "terminal non-delivery is read from pooling; one Refund child is created for Maria's complete recorded deposit" },
  { f: "W21@refund-queued", hot: { h: "w21.dispatch-refund", l: "Dispatch refund" }, st: "Refund queued", ev: "the child uses the ordinary settlement machine and the frozen garden Safe, account, token, and amount; dispatch is not arrival" },
  { f: "W22@refund-dispatched", hot: null, st: "Dispatched", ev: "the command has one execution key and may be retried without moving G$ twice" },
  { f: "W22@refund-confirmed", hot: null, st: "Confirmed", ev: "only the authenticated acknowledgment closes F-204 as Refunded", br: [{ l: "Maria sees the full 40 G$ returned", to: "screen:W36@refunded" }] },
]},
// The public surface has its own reader: a neighbour or funder who never signs
// in. This flow walks what they can see as a pool matures — the moment the
// small-community threshold flips counts into a rate, and the states a garden
// spends most of its life in once it has a record behind it.
{ id: "sb15", n: 15, title: "Follow a garden's commitments from the public site", desc: "A signed-out reader watches one garden's public page mature — readiness copy, then counts, then a record spanning seasons that survives the quiet stretches.", persona: "Neighbour or funder (signed out)", scen: "S11 · editorial", reviewVisible: true, reviewGroup: "editorial", chapter: "public-story", roles: ["public"], steps: [
  { f: "W15@pre-launch", hot: null, st: "pool NotReady", ev: "readiness copy only — a garden preparing its pool publishes no numbers", cite: "UX:352 · UX:57" },
  { f: "W15@empty", hot: null, marks: ["w15.empty"], st: "open, nothing yet", ev: "the section never disappears — an open pool with no commitments says so where § 02 sits", cite: "UX:352" },
  { f: "W15@counts-only", hot: null, marks: ["w15.counts"], st: "below threshold", ev: "a first season publishes counts and no percentage: nine commitments between two people is not a sample a rate can describe fairly", cite: "UX:350 · UX:364" },
  { f: "W15", hot: null, marks: ["w15.rate", "w15.rows"], st: "seasons behind it", ev: "the section is the garden's record across seasons and campaigns, not one live cycle — the kept rate describes the whole record, and the live season is the current chapter beneath it", cite: "UX:352 · UX:364-371" },
  { f: "W15@between-seasons", hot: null, marks: ["w15.between"], st: "no live cycle", ev: "between seasons the record still stands — the state that scoping this section to one cycle could never say anything true about", cite: "UX:352" },
  { f: "W15@paused", hot: null, marks: ["w15.paused"], st: "pool Paused", ev: "a quiet-period line, aggregates intact, and the indexed pause reason stays off the public page", cite: "UX:57" },
  { f: "W15@read-error", hot: null, marks: ["w15.read-error"], st: "cannot read", ev: "an unread count is an em dash, never a zero; the page does not publish what it could not load", cite: "UX:352", br: [{ l: "The protocol-wide story", to: "sb48:0" }] },
  { f: "W1", hot: null, surface: "pwa", echo: true, ev: "the same pool, now joinable — the public story and the member surface are one system", cite: "UX:120" },
]},
// The /impact page's own short walk, split from sb15 (2026-08-10) so the
// editorial tab reads as two honest stories: one garden, then the protocol.
{ id: "sb48", n: 48, title: "See protocol-wide impact", desc: "The same story protocol-wide: the impact page links back to the gardens instead of ranking them, and offers a way in.", persona: "Neighbour or funder (signed out)", scen: "S11 · editorial", reviewVisible: true, reviewGroup: "editorial", chapter: "public-story", roles: ["public"], steps: [
  { f: "W16@band", hot: null, marks: ["w16.see-gardens"], st: "protocol aggregate", ev: "the impact page carries the same story protocol-wide, and links back to the gardens rather than ranking them", cite: "UX:373-375" },
  { f: "W16@support-in-flight", hot: null, marks: ["w16.in-flight"], st: "dispatched, not arrived", ev: "40 G$ is in flight and the published figure does not move — only an authenticated acknowledgment may claim arrival", cite: "SS:62" },
  { f: "W16@pipeline-delta", hot: { h: "w16.install", l: "Install the app" }, marks: ["w16.pipeline"], ev: "the proof pipeline gains Commitment and Confirmation stages; the install CTA is the reader's way in", cite: "UX:375" },
  { f: "W1", hot: null, surface: "pwa", echo: true, ev: "the same pool, now joinable — the public story and the member surface are one system", cite: "UX:120" },
]},
{ id: "sb17", n: 17, title: "Recover a commitment that stalled", desc: "Proof is in but the recipient cannot confirm — David's three exits are mark ready, cancel, and send it for steward review.", persona: "Steward (David)", scen: "S5 · steward recovery", reviewVisible: true, reviewGroup: "admin", chapter: "commitments", roles: ["steward"], steps: [
  { f: "W7", hot: { h: "w7.stalled-row", l: "Open the stalled commitment" }, who: "David", st: "Open", ev: "the stalled commitment sits in the pool's own list — proof in, recipient can't confirm — and its row opens the detail", cite: "UX:294" },
  { f: "W10@accepted", hot: { h: "w10.mark-override", l: "Mark ready…" }, who: "David", st: "Accepted · proof in", ev: "override, cancel, and send-for-confirmation are the three exits, each with its own consequence", cite: "UX:294" },
  { f: "W10@mark-ready-override", hot: { h: "w10.override-confirm", l: "Mark ready" }, who: "David", st: "Reason required", ev: "markReadyForConfirmation(commitmentId, reason) — steward-only, separate from Send for confirmation, and the reason is stored", cite: "UX:294" },
  { f: "W2@support-ready-confirmer", hot: null, surface: "pwa", echo: true, st: "ReadyForConfirmation", ev: "the member sees the same service commitment move to Ready with the steward's record visible in the timeline", cite: "UX:301" },
  { f: "W10@cancel", hot: { h: "w10.cancel-confirm", l: "Cancel commitment" }, who: "David", st: "Cancel — confirm", ev: "variant: cancelCommitment on an Accepted commitment — steward-only, reason required, and the committed units release", cite: "CS:745" },
  { f: "W2@support-cancelled", hot: null, surface: "pwa", echo: true, st: "Cancelled", ev: "the member reads the recorded reason on the same service commitment — never “cancelled” alone", cite: "UX:93" },
  { f: "W10", hot: { h: "w10.raise", l: "Raise dispute…" }, who: "David", st: "Ready", ev: "variant: on a Ready commitment the steward's remaining acts are fallback confirmation and raising a review", cite: "UX:300" },
  { f: "W10@raise-dispute", hot: { h: "w10.dispute-confirm", l: "Raise dispute" }, who: "David", st: "Reason required", ev: "raiseDispute stores preDisputeState so any resolution can restore it exactly", cite: "CS:143" },
    { f: "W2@disputed", hot: null, surface: "pwa", echo: true, st: "Disputed", ev: "the member ceiling is “under review by stewards” — the word dispute never reaches them", cite: "UX:95", br: [{ l: "How it resolves", to: "sb5:3" }] },
]},
{ id: "sb20", n: 20, title: "Start a campaign beside the season", desc: "David starts a Campaign alongside the running Season — one flow in one shell, its own allocation, nothing touching the pool or the Season.", persona: "Steward (David)", scen: "S5 · concurrent campaign", reviewVisible: true, reviewGroup: "admin", chapter: "season", roles: ["steward"], steps: [
  { f: "W7", hot: { h: "w7.start-campaign", l: "Start a campaign (Quick actions)" }, st: "Season live", ev: "the campaign door sits in the rail's Quick actions while the Season runs — one open Season, any number of campaigns", cite: "UX:66" },
  { f: "W11@campaign-details", hot: { h: "w11.campaign-details-continue", l: "Continue" }, st: "Campaign details", ev: "seedCycle with Campaign preselected records the campaign on the already-open pool; the flow continues in the same shell", cite: "CS:566 · CS:114" },
  { f: "W11@campaign-allocation", hot: { h: "w11.campaign-continue", l: "Continue" }, st: "Allocation set", ev: "the six-class campaign allocation totals exactly 100%", cite: "UX:322-330" },
  { f: "W11@campaign-open", hot: { h: "w11.campaign-open-cycle", l: "Open the campaign" }, st: "Pool already Open", ev: "openCycle starts only Seedling swap; it does not reopen or otherwise mutate the pool", cite: "CS:114" },
  { f: "W7", hot: null, st: "Campaign Open", ev: "the campaign returns as a peer row beside the still-open Season", cite: "UX:66" },
]},
// The phone presentation of the same console (2026-08-16 review): below
// 1024px the header action row hides and the ViewAction set rides the
// FabButton speed dial; AdminDialog presents as a bottom sheet below 620px.
{ id: "sb60", n: 60, title: "Run the pool from a phone", desc: "The same console on a phone: the speed dial carries the view's actions, and the seed dialog presents as a bottom sheet.", persona: "Steward (David)", scen: "Admin mobile presentation", reviewVisible: true, reviewGroup: "admin", chapter: "season", roles: ["steward"], steps: [
  { f: "W7M", hot: { h: "w7m.fab", l: "Workspace actions (FAB)" }, who: "David", st: "Pool tab — phone", ev: "below 1024px the header's action row hides; the FabButton floats above the workspace dock, right-aligned", cite: "UX:299" },
  { f: "W7M@fab-open", hot: { h: "w7m.dial-seed", l: "Seed a commitment" }, who: "David", st: "Speed dial", ev: "more than one view action opens the speed dial — the primary sits nearest the trigger, mirroring the desktop row's primary-rightmost emphasis", cite: "UX:299" },
  { f: "W7M@seed-sheet", hot: null, who: "David", st: "Seed — bottom sheet", ev: "the same seed dialog, presented as a bottom sheet on the phone — one action set, one dialog, two presentations", cite: "UX:299" },
]},
{ id: "sb21", n: 21, title: "Move from Community to this garden's pool", desc: "The Community workspace narrows from protocol scope to one garden, then hands off to that garden's full Pool workspace.", persona: "Protocol steward", scen: "S14 · workspace handoff", reviewVisible: true, reviewGroup: "admin", chapter: "ggops", roles: ["green-goods-team"], steps: [
  { f: "W12", hot: { h: "w12.tab-garden", l: "This garden" }, st: "Protocol pool", ev: "the Community workspace narrows from protocol scope to the selected garden", cite: "UX:314" },
  { f: "W12@current-garden", hot: { h: "w12.open-garden-pool", l: "Open garden pool" }, st: "Rocinha summary", ev: "the summary offers one direct handoff to the full Garden Pool workspace", cite: "UX:314" },
  { f: "W7", hot: null, st: "Pool Open", ev: "Rocinha's triage-first Pool view opens", cite: "UX:261" },
]},
// Regrown 2026-08-10 (register #96): the baseline is the pool's starting
// record — its own assessment story, ending at the readiness checklist it
// satisfies, not folded into work approval.
{ id: "sb22", n: 22, title: "Record the garden's starting assessment", desc: "The pool's starting record end to end: attributed to the garden, made before any commitment, attested, and completing the checklist.", persona: "Evaluator + steward", scen: "S4 · assessment entry", reviewVisible: true, reviewGroup: "admin", chapter: "assess", roles: ["evaluator", "steward"], steps: [
  { f: "W13@assess", hot: { h: "w13.new-assessment", l: "Create assessment" }, st: "Assess stage", ev: "the existing Hub stage opens the extended assessment flow", cite: "UX:257" },
  { f: "W14@baseline", hot: { h: "w14.continue", l: "Continue" }, marks: ["w14.kind"], st: "For the garden · at the start", ev: "attributed to the garden overall, at the start — the first measurement for this garden and domain derives the wire Baseline, which an evaluator or steward may attest", cite: "CS:760-761" },
  { f: "W14@kernel", hot: { h: "w14.continue-kernel", l: "Continue" }, st: "Strategy Kernel", ev: "the existing step continues unchanged — diagnosis, outcomes, complexity", cite: "UX:257" },
  { f: "W14@harvest", hot: { h: "w14.attest", l: "Attest assessment" }, st: "Actions & Harvest", ev: "actions and the reporting period close the form; attesting records the starting assessment", cite: "UX:257", skipTargetReason: "the starting-record walk lands on the readiness checklist its attestation satisfies; the Assess stage remains the flow's canonical exit" },
  { f: "W7@preflight-complete", hot: null, st: "Readiness · starting record satisfied", ev: "the qualifying starting assessment completes the pool's readiness checklist beside the charter and provider cap", cite: "UX:298", br: [{ l: "Mark the pool ready and open the season", to: "sb9a:2" }] },
]},
{ id: "sb23", n: 23, title: "Register an existing garden settlement account", desc: "The settlement steward registers an already-deployed Celo Safe, which is what opens the garden's disbursement queue.", persona: "Settlement steward", scen: "S8 · account setup", reviewVisible: true, reviewGroup: "admin", chapter: "settlement", roles: ["steward"], steps: [
  { f: "W21@unregistered", hot: { h: "w21.setup", l: "Register existing account" }, st: "Unregistered", ev: "the empty settlement section leads with the one available next action", cite: "SS:169" },
  { f: "W21@register-account", hot: { h: "w21.register-confirm", l: "Register account" }, st: "Verified route", ev: "registerSettlementAccount stores the already-deployed Celo Safe after governance verification", cite: "SS:169" },
  { f: "W21@registered", hot: { h: "w21.open-queue", l: "Open disbursement queue" }, st: "Registered", ev: "the result names the Safe, recovery policy, and scoped executor role", cite: "SS:169" },
  { f: "W21", hot: null, st: "Queue available", ev: "the ordinary settlement queue is now reachable", cite: "SS §3.1" },
]},
{ id: "sb24", n: 24, title: "Check command transport and its route gate", desc: "Before anything is dispatched, transport health and the scoped executor authority behind the route are inspected as release proof.", persona: "Protocol deployer", scen: "S8/S9 · execution readiness", reviewVisible: true, reviewGroup: "admin", chapter: "ggops", roles: ["green-goods-team"], steps: [
  { f: "W24", hot: { h: "w24.tab-ccip", l: "CCIP" }, st: "Cross-garden queue", ev: "Operations opens on actionable queued deliveries", cite: "SS §3" },
  { f: "W24@ccip", hot: { h: "w24.tab-queue", l: "Queue" }, st: "Transport health", ev: "native reserves, peers, and acknowledgment deferrals stay distinct from payment state", cite: "SS §4" },
  { f: "W24", hot: { h: "w24.execute", l: "Dispatch" }, st: "Queued", ev: "the selected row opens its command console", cite: "SS §3" },
  { f: "W22", hot: { h: "w22.route-gate", l: "Open route gate" }, st: "Queued batch", ev: "the settlement steward inspects production authority before dispatch", cite: "SS §6" },
  { f: "W22@role-guard", hot: null, st: "Route gate", ev: "scoped executor role, no Safe ownership, canonical selectors, and caps remain explicit release proof", cite: "SS §6" },
]},
{ id: "sb25", n: 25, title: "Recover or cancel one settlement delivery", desc: "An authenticated failure unlocks exactly one new attempt; a queued unbatched delivery can instead be cancelled with a reason.", persona: "Settlement steward", scen: "S8 · member recovery", reviewVisible: true, reviewGroup: "admin", chapter: "settlement", roles: ["steward"], steps: [
  { f: "W22@outcome", hot: { h: "w22.requeue-member", l: "Source follow-up" }, st: "Authenticated failure", ev: "only a bounded failure acknowledgment unlocks a new logical attempt", cite: "SS:182" },
  { f: "W21@requeue-confirm", hot: { h: "w21.requeue-confirm", l: "Requeue attempt" }, st: "Failed", ev: "the confirmation names the preserved attempt, cleared batch, incremented attempt, and that the new key waits for dispatch", cite: "SS:182" },
  { f: "W21@requeued", hot: { h: "w21.open-queue", l: "Back to queue" }, st: "Queued · attempt 2", ev: "the new attempt is visible beside its immutable failed predecessor; dispatch, not requeue, creates its execution key", cite: "SS:182" },
  { f: "W21", hot: { h: "w21.cancel-disb", l: "Cancel queued delivery" }, st: "Queued · unbatched", ev: "individual cancellation is offered only before dispatch while batchId is zero", cite: "SS §3.1.3" },
  { f: "W21@cancel-queued-confirm", hot: { h: "w21.cancel-queued-confirm", l: "Cancel delivery" }, st: "Reason required", ev: "cancelDisbursement stores the reason and changes only settlement 104", cite: "SS §3.1.3" },
  { f: "W21@cancelled-queued", hot: null, st: "Cancelled from Queued", ev: "the outcome confirms that no command or batch was created", cite: "SS §3.1.3" },
]},
// Split 2026-08-10: Maria's service offer runs start-to-finish as her own acts;
// João's take-up and confirmation land as read-only beats. The acted service
// confirmation stays walkable in sb30 and in the W4 service cast states.
{ id: "sb31", n: 31, title: "Cancel an immutable queued batch", desc: "The only destructive option on a batch takes every member with it, and the confirmation names them before it runs.", persona: "Settlement steward", scen: "S8 · batch recovery", reviewVisible: true, reviewGroup: "admin", chapter: "settlement", roles: ["steward"], steps: [
  { f: "W22", hot: { h: "w22.cancel-batch", l: "Cancel whole batch" }, st: "Queued batch", ev: "the only destructive option applies to the entire immutable member set", cite: "SS §3.1.3" },
  { f: "W22@cancel-batch-confirm", hot: { h: "w22.cancel-batch-confirm", l: "Cancel batch" }, st: "Reason required", ev: "the confirmation names both members and the atomic blast radius before cancelBatch", cite: "SS §3.1.3" },
  { f: "W21@batch-cancelled", hot: null, st: "Cancelled from Queued", ev: "the result preserves the two-member snapshot and recorded reason", cite: "SS §3.1.3" },
]},
{ id: "sb32", n: 32, title: "Wind down a season while its pool stays paused", desc: "The close wizard runs through to composted without resuming participation — plus the cancel variant from the same paused season.", persona: "Steward (David)", scen: "S5 · paused wind-down", reviewVisible: true, reviewGroup: "admin", chapter: "season", roles: ["steward"], steps: [
  { f: "W7@paused", hot: { h: "w7.close-season-paused", l: "Close Season…" }, st: "Pool Paused · cycle Reviewing", ev: "opens the close wizard without resuming participation or reconciling before review; the cancel ending waits inside it", cite: "CS:111,128" },
  { f: "W26@paused-review", hot: { h: "w26.paused-continue-shares", l: "Close cycle and continue" }, st: "Pool Paused · terminal set", ev: "closeCycle locks the exact bundle as Reconciled while the pool remains Paused", cite: "UX:60,75" },
  { f: "W26@paused-shares", hot: { h: "w26.paused-continue-certificate", l: "Continue to certificate" }, st: "Pool Paused · cycle Reconciled", ev: "the locked six-role allocation is read without reopening participation", cite: "UX:75" },
  { f: "W26@paused-certificate", hot: { h: "w26.paused-mint", l: "Mint impact certificate" }, st: "Pool Paused · cycle Reconciled", ev: "certificate minting uses the closed commitment set and changes no lifecycle state", cite: "CS §9" },
  { f: "W26@paused-rest", hot: { h: "w26.paused-compost", l: "Compost closed cycle" }, st: "Pool Paused · cycle Reconciled", ev: "compostCycle advances only the already-closed cycle to Composted", cite: "CS:128-129" },
  { f: "W7@paused-cycle-composted", hot: null, st: "Pool Paused · cycle Composted", ev: "the result offers only legal pool-level next acts: resume or close", cite: "CS:111-112" },
  { f: "W26@paused-review", hot: { h: "w7.cancel-cycle-paused", l: "Cancel Season Instead…" }, st: "Variant · Pool Paused · cycle Open", ev: "the same close flow offers cancelling as the alternative ending; neither implies a resume", cite: "CS:130" },
  { f: "W7@paused-cancel-cycle-confirm", hot: { h: "w7.cancel-cycle-paused-confirm", l: "Cancel season" }, st: "Pool Paused · reason required", ev: "cancelCycle changes only the cycle and stores the member-visible reason", cite: "CS:130 · UX:77" },
  { f: "W7@paused-cycle-cancelled", hot: null, st: "Pool Paused · cycle Cancelled", ev: "both truths hold together: the season was cancelled and the pool remains paused; members read the reason on their side", cite: "UX:60,77", br: [{ l: "The member's paused-and-cancelled banner", to: "screen:W1@paused-cancelled-cycle" }] },
]},
{ id: "sb33", n: 33, title: "Recognize and pay a commitment team", desc: "A group commitment is kept: recognition stays as recorded while payment is planned, finalized, and dispatched per contributor.", persona: "Steward (David)", scen: "S1 · group commitment", reviewVisible: true, reviewGroup: "admin", chapter: "recognition", roles: ["steward"], steps: [
  { f: "W7", hot: { h: "w7.fulfilled-row", l: "Open the kept team commitment" }, who: "David", st: "Open", ev: "the kept group commitment sits in the pool's list with payment still unplanned — its row opens the detail", cite: "SS group-settlement amendment" },
  { f: "W10@fulfilled", hot: { h: "w10.allocate-contributors", l: "Set recognition and payment" }, st: "Fulfilled · payment unplanned", ev: "roster frozen, recognition previewed on the member side; the steward opens payment planning without changing the recognition record", cite: "SS group-settlement amendment", br: [{ l: "How the team formed", to: "sb45:0" }] },
  { f: "W10@contributor-allocation", hot: { h: "w10.save-contributor-allocation", l: "Create draft" }, st: "Draft payout plan", ev: "createCommitmentPayoutPlan persists the stable canonical default, then opens the separate recoverable amount edit", cite: "SS §3" },
  { f: "W21@payout-plan-edit", hot: { h: "w21.edit-save", l: "Save complete draft" }, st: "Draft parent plan · edited", ev: "setContributorPayouts publishes a replacement Draft snapshot against the stable parent pointer", cite: "SS §3" },
  { f: "W21@payout-plan", hot: { h: "w21.finalize-plan", l: "Finalize payout plan" }, st: "Draft parent plan", ev: "the steward verifies recognition/payment hashes and retained-plus-payout conservation before freezing the plan", cite: "SS §3" },
  { f: "W21@payout-finalized", hot: { h: "w21.prepare-payout", l: "Prepare one child payout" }, st: "Finalized parent plan · no children", ev: "the steward materializes one immutable queued child from a frozen non-zero row; finalization itself created none", cite: "SS §3" },
  { f: "W21@payout-prepared", hot: { h: "w21.dispatch-plan", l: "Dispatch one child payout" }, st: "Prepared child · Queued", ev: "the garden Safe can now dispatch this contributor's separate child delivery while the parent pointer remains stable", cite: "SS §3" },
  { f: "W22@individual-dispatched", hot: null, st: "Individual · dispatched", ev: "the contributor command carries only the finalized child facts and retries through retryCommand; the parent pointer remains stable", cite: "SS §3" },
  { f: "W21@payout-partial", hot: null, st: "Partial · 2 of 3 arrived", ev: "one failed child never reverses fulfillment, recognition, or successful contributor receipts", cite: "SS §3", br: [{ l: "The contributor's receipt on their side", to: "screen:W23@contributor-receipt" }] },
]},
// The team's own story, split from sb33 (2026-08-10): joining an open team,
// the freeze, and the recognition preview — all on the member surface.
// The other money leg: treasury support that is deliberately NOT a reward. It
// shares the transport queue with contributor payouts and nothing else.
{ id: "sb34", n: 34, title: "Seed or top up a garden outside a commitment", desc: "Treasury support that is deliberately not a reward — the same transport queue, no commitment, nothing that reads as earned.", persona: "Protocol steward / module owner", scen: "S9 · discretionary treasury support", reviewVisible: true, reviewGroup: "admin", chapter: "ggops", roles: ["green-goods-team"], steps: [
  { f: "W24@flows", hot: { h: "w24.queue-funding", l: "Seed / top up" }, ev: "the funds board separates commitment-earned contributor payout plans from an explicitly authorized non-commitment treasury action", cite: "register #69 · SS §3.1.3" },
  { f: "W24@funding", hot: { h: "w24.queue-funding-confirm", l: "Queue seed / top up" }, st: "Explicit treasury review", ev: "queueFunding derives the GG protocol Safe, selected registered garden Safe, and canonical G$; it carries no commitmentId and grants no agent or keeper value authority", cite: "SS §3.1.3 · AM §2" },
  { f: "W21@protocol-funding-queued", hot: null, st: "Queued funding", ev: "the resulting row has no commitment ID, shares the transport queue, and remains typed as Funding rather than a commitment reward", cite: "SS §3.1.2" },
]},
{ id: "sb14", n: 14, title: "Turn a neighbour's need into a seeded commitment", desc: "Kwame describes a need in his own words, neighbours support it, and a steward turns the thread into a seeded commitment.", persona: "Neighbour (Kwame) + steward", scen: "S10 · September", reviewVisible: false, reviewGroup: "admin", chapter: "commitments", roles: ["steward"], steps: [
  { f: "C3", hot: { m: "What is your community trying to solve?", l: "Describe the problem by voice or text" }, who: "Kwame", surface: "community", ev: "kind-free Need · words captured by voice or typing · Request/Offer belongs to seeding a commitment", cite: "CI-WF:96" },
  { f: "C4", hot: { m: "[Share with my garden]", l: "Share with my garden" }, surface: "community", marks: ["Waiting for garden membership. No send"], ev: "offline-queueable Need — may wait for membership without consuming sends", cite: "CI-WF:150" },
  { f: "C1", hot: { m: "[Support]", l: "neighbours Support" }, surface: "community", ev: "latest directional signal wins; support and non-support remain separate; board orders by recency + status, never funding", cite: "CI-SPEC §6/§8" },
  { f: "C5", hot: null, surface: "community", ev: "the neighbour opens the need thread before steward moderation", cite: "CI-WF:165" },
  { f: "C9", hot: { m: "[Acknowledge]", l: "Acknowledge" }, who: "David", ev: "typed moderation — moderation and progress are separate axes", cite: "CI-SPEC:267" },
  { f: "C9", hot: { m: "[Seed a commitment]", l: "Seed a commitment" }, ev: "opens the seed-from-Need form", cite: "CI-WF:307" },
  { f: "C10", hot: { m: "[Review commitment]", l: "Review commitment" }, ev: "needUID linked read-only · every suggested field steward-confirmed · unreachable-threshold error before acceptance", cite: "CI-WF:340" },
  { f: "C5", hot: null, surface: "community", marks: ["✓ Commitment: 16 market rides this season"], ev: "the thread: neighbour's words → commitment → work → proof · funding supports the garden, never escrow", cite: "CI-WF:165" },
  { f: "C5", hot: { m: "[Add testimony]", l: "author confirm + testimony" }, who: "Kwame", surface: "community", ev: "consumes the shared confirmation/testimony primitives — September-realized (register #34g)", cite: "CI-SPEC:259", note: "membership queue slice stays gated on RESR-64" },
]},

// ---------------------------------------------------------------------------
// Offering over time (SB-37…SB-41) — standing-commitments-spec + uiux App. F.
// One product noun, used two ways: Offer once produces an ordinary Offer with
// commitmentSeriesId == 0, and Offer over time produces one pool-scoped
// CommitmentSeries that gardener copy calls an ongoing Offer. Saved details are
// reusable signed offchain metadata and input to either path, never a second
// product object. An available place is an already-created Offered instance
// whose provider slot was reserved at creation, and the Story is exact
// linked-instance history. SB-35/SB-36 stay reserved for the exchange and
// template source journeys documented in prototypes.md, so this set starts at 37.
// ---------------------------------------------------------------------------




];

// ---------------------------------------------------------------------------
// Retired journey routes → where that scene lives now.
//
// A split MOVES scenes to another flow, and `start()` clamps an out-of-range
// index — so without this map an old `#sbX/i` link silently opens the shortened
// flow's LAST frame and reads as the wrong answer, which is worse than a dead
// link. The player redirects through this map before it starts a flow, then
// rewrites the address bar to the canonical hash, so a shared link heals itself.
//
// Two rules the validator enforces (see validate.ts ROUTE checks):
//   1. A source may not shadow a LIVE route — a real scene always wins.
//   2. Every target must resolve to a real flow and a real scene index.
//
// Only cross-flow moves are listed. A scene that merely shifted index inside
// its own flow still lands in the right story and needs no redirect: `#sb50/1`
// now opens the attest walk's own delta frame, one screen after the entry
// scene that shifted it. Flow ids retired outright (`#sb3`, `#sb9`, `#sb52`…)
// carry no reliable per-scene mapping, so the player lands them on the flow
// catalog rather than guessing a scene.
// ---------------------------------------------------------------------------
export const SB_ROUTE_ALIASES: Record<string, string> = {
  // D3 (2026-08-11) "sb1/6" → "sb55/1" and "sb29/5" → "sb56/1" retired
  // 2026-08-14: the floating-door beat regrew those scene indexes, and a real
  // route wins over a redirect. Old links land one branch-click from the same
  // destination (the end-beats link to sb55/sb56).
  // D3 — "Offer a service and prove it with proof": the proving half moved whole.
  // "sb29/6" retired 2026-08-16: the service walk gained its details step, so
  // scene 6 is live and a real route must win over a redirect.
  "sb29/7": "sb56/3",
  "sb29/8": "sb56/4",
  "sb29/9": "sb56/5",
  "sb29/10": "sb56/6",
  "sb29/11": "sb56/7",
  // "sb5/4" retired 2026-08-18: the member's flow gained a real fifth scene —
  // the quiet row in Live where they watch it — and a live scene always wins
  // over a redirect.
  // D3 round 2's "sb50/2" → "sb57/1" retired 2026-08-16: the full assessment
  // walk regrew that scene index, and a real route wins over a redirect (the
  // end-beat links to sb57).
  // 2026-08-16 act-seam split: the old 17-scene sb9c's pool coda moved whole
  // into sb9d, and its cancel variant into sb9e (old step 9 merged into 8).
  "sb9c/7": "sb9d/0",
  "sb9c/8": "sb9d/1",
  "sb9c/9": "sb9d/2",
  "sb9c/10": "sb9d/2",
  "sb9c/11": "sb9d/3",
  "sb9c/12": "sb9d/4",
  "sb9c/13": "sb9d/5",
  "sb9c/14": "sb9e/1",
  "sb9c/15": "sb9e/2",
  "sb9c/16": "sb9e/2",
};
