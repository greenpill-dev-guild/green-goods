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
  id: string; n: number; title: string; persona: string;
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
// Split 2026-08-10 (echo rule): sb1 is now Maria's act alone — four quick
// wizard steps, sync truth, and the moment her offer is taken up. Proving is
// sb4a's story, the steward side is sb4b, and confirmation is sb42.
{ id: "sb1", n: 1, title: "Offer support and see it taken up", persona: "Gardener (Maria)", scen: "S1 · TAS workshop", reviewVisible: true, reviewGroup: "client", chapter: "make", roles: ["gardener"], steps: [
  { f: "W1", hot: { h: "w1.offer" }, who: "Maria", st: "Pool Open · cycle Open", ev: "routes to /home/:id/pool/new?direction=offer", cite: "WF:76 · UX:122", skipTargetReason: "the Offer-template picker opens first and Start blank enters this form — sb36 walks that choice; Maria's story continues at the blank form" },
  { f: "W3@step-what", hot: { h: "w3.continue-what", l: "Continue" }, who: "Maria", st: "Draft (local)", ev: "captures kind, title, and note — the open season is already chosen, and direction came from the button she tapped", cite: "UX:154" },
  { f: "W3@step-howmuch", hot: { h: "w3.continue-howmuch", l: "Continue" }, who: "Maria", st: "Draft (local)", ev: "unit and amount are chip picks with a custom escape; due defaults to the season end", cite: "UX:155" },
  { f: "W3@step-anchors", hot: { h: "w3.continue-anchors", l: "Continue" }, who: "Maria", st: "Draft (local)", ev: "anchors garden-work promises to the garden's actions — who confirms is already set: the recipient, with the pilot's Green Goods fallback behind them", cite: "UX:156 · UX §5.4" },
  { f: "W3@step-review", hot: { h: "w3.submit", l: "Make this offer" }, alts: [{ h: "w3.advanced", l: "adjust who confirms / team options", to: "screen:W3@step-advanced" }], who: "Maria", st: "Draft (local)", ev: "review repeats every default in one card — no fifth step, nothing re-asked · commitment job queued · optimistic card + queued badge", cite: "UX:212 · UX §5.4", br: [{ l: "Offline / retry lanes", to: "sb7:2" }] },
  { f: "W1@queued", hot: null, marks: ["w1.queued-card"], st: "Offered (on-chain)", ev: "sync → CommitmentCreated · SyncStatusBar clears", cite: "CS:132" },
  { f: "W2@accepted", hot: null, who: "João (recipient)", st: "Offered → Accepted", ev: "João takes it up — claim → CommitmentAccepted · provider = Maria (Offer creator) · confirmer default = João · the Offer's creation-time reservation is unchanged", cite: "CS:133 · AM:34", br: [{ l: "Ask-first / steward-reviewed variant", to: "sb3a:0" }, { l: "Next: prove the work", to: "sb4a:0" }, { l: "Next: confirm it kept", to: "sb42:0" }] },
]},
// Split 2026-08-10: Ana's ask-to-kept arc stays hers alone — João's providing
// side is sb43. His acts land here as read-only beats, never as her controls.
{ id: "sb2", n: 2, title: "Ask for help and confirm it arrived", persona: "Gardener (Ana)", scen: "S2 · evidence-only", reviewVisible: true, reviewGroup: "client", chapter: "ask", roles: ["gardener"], steps: [
  { f: "W1", hot: { h: "w1.request" }, who: "Ana", ev: "routes to /pool/new?direction=request", cite: "WF:76" },
  { f: "W3@request-what", hot: { h: "w3.request-continue-what", l: "Continue" }, who: "Ana", st: "Draft (local)", ev: "the ask starts like any promise — season chosen for her, direction from the button, a common-ask chip starts the title", cite: "UX:605,610 · WF:251" },
  { f: "W3@request-howmuch", hot: { h: "w3.request-continue-howmuch", l: "Continue" }, who: "Ana", st: "Draft (local)", ev: "unit and amount are chip picks; due defaults to the season end", cite: "UX:609" },
  { f: "W3@request-variant", hot: { h: "w3.submit-request", l: "Ask for this help" }, who: "Ana", st: "Draft → Requested", ev: "review repeats the ask — anchors skipped (SupportService), who-confirms already Ana since it was her ask · commitment job → CommitmentCreated", cite: "UX:157 · WF:251" },
  { f: "W1@request-queued", hot: null, marks: ["w1.queued-card"], who: "Ana", st: "Queued (local)", ev: "the same request stays visible while CommitmentCreated syncs", cite: "UX:212" },
  { f: "W1@request-open", hot: null, marks: ["w1.take-up-request"], st: "Requested → Accepted", ev: "João says “I can help” — claim → CommitmentAccepted · provider = João (claimant) · confirmer = Ana (Request creator)", cite: "UX:85 · AM:34", note: "open-claim Request path; steward-reviewed claims are reviewed separately", br: [{ l: "Walk João's side", to: "sb43:0" }] },
  { f: "W2@request-evidence-submitted", hot: null, st: "EvidenceSubmitted", ev: "João attaches the ride evidence and sends it for confirmation — evidence-only, no work gate; the promise stays Ana's request throughout", cite: "CS:741 · UX:214" },
  { f: "W2@request-ready-confirmer", hot: { h: "w2.confirm-request-detail", l: "Review confirmation" }, who: "Ana (creator)", st: "ReadyForConfirmation", ev: "the named request creator can open confirmation only after readiness syncs", cite: "CS:139" },
  { f: "W4@confirm-request", hot: { h: "w4.confirm-request", l: "Confirm — help arrived" }, alts: [{ h: "w4.not-yet-request", l: "Not yet → steward review", to: "screen:W4@not-yet-request" }], who: "Ana (creator)", st: "ReadyForConfirmation", ev: "ConfirmationRecorded → CommitmentFulfilled — the direction reverses here: the claimant provided, the asker confirms", cite: "CS:139 · WF:224", br: [{ l: "Not-yet send fails → keep request and reason for retry", to: "screen:W4@not-yet-failed-request" }] },
  { f: "W4@confirmed-pending-request", hot: null, who: "Ana", st: "Pending local sync", ev: "the request confirmation is saved without showing fulfillment early", cite: "UX:169,221" },
  { f: "W4@confirmed-request", hot: { h: "w4.done-request", l: "Back to the pool" }, who: "Ana", st: "Fulfilled", ev: "sync completion confirms that the help arrived", cite: "UX:197-204" },
  { f: "W2@request-fulfilled", hot: null, st: "Fulfilled", ev: "the request result returns to the member-facing promise — same title, same unit, from ask to kept", cite: "UX:197-199" },
]},
// João's providing side of sb2, split out 2026-08-10 so each flow is one
// person's action to completion.
{ id: "sb43", n: 43, title: "Help with what was asked", persona: "Helper (João)", scen: "S2 · evidence-only", reviewVisible: true, reviewGroup: "client", chapter: "ask", roles: ["gardener"], steps: [
  { f: "W1@request-open", hot: { h: "w1.take-up-request", l: "I can help" }, who: "João", st: "Requested", ev: "claim → CommitmentAccepted · provider = João (claimant) · confirmer = Ana (Request creator)", cite: "UX:85 · AM:34", note: "open-claim Request path; steward-reviewed claims are reviewed separately" },
  { f: "W2@request-active", hot: { h: "w2.add-evidence-request" }, who: "João", st: "Accepted → Active", ev: "evidence job → EvidenceAttached — the promise stays Ana's request throughout; João is the one providing it", cite: "UX:214", br: [{ l: "upload fails → per-row retry (nothing dropped)", to: "screen:W2a@failed" }] },
  { f: "W2a@compose-request", hot: { h: "w2a.attach-request", l: "Attach evidence" }, who: "João", st: "Evidence draft", ev: "compose the supporting photo, link, or note", cite: "UX:164" },
  { f: "W2@request-evidence-queued", hot: null, who: "João", st: "Evidence queued (local)", ev: "the request keeps its creator, provider, and evidence while the attachment waits to sync", cite: "UX:218" },
  { f: "W2@request-evidence-submitted", hot: { h: "w2.send-confirmation-request" }, who: "João", st: "EvidenceSubmitted", ev: "confirmation{submit} → ReadyForConfirmation (creator, counterparty, or steward may send)", cite: "CS:741", mf: true },
  { f: "W2@request-ready-pending", hot: null, st: "Readiness queued (local)", ev: "the request remains EvidenceSubmitted until the readiness update reaches the contract", cite: "UX:169,221" },
  { f: "W2@request-ready-confirmer", hot: null, st: "ReadyForConfirmation", ev: "done — now it waits on Ana, the one who asked", cite: "CS:139", br: [{ l: "Ana confirms it arrived", to: "sb2:7" }] },
]},
// A garden-work ask (register #97): kind and direction are orthogonal on-chain,
// so a Request can carry action requirements — proof travels the Work rails
// and the asker confirms. Closes the audit's highest-severity coverage gap.
{ id: "sb51", n: 51, title: "Ask for garden work and see it approved", persona: "Gardener (Ana) + helper (João)", scen: "S2 · DomainImpact request", reviewVisible: true, reviewGroup: "client", chapter: "ask", roles: ["gardener"], steps: [
  { f: "W1", hot: { h: "w1.request" }, who: "Ana", ev: "routes to /pool/new?direction=request", cite: "WF:76" },
  { f: "W3@request-what", hot: { h: "w3.request-choose-work", l: "Garden work" }, who: "Ana", st: "Draft (local)", ev: "Ana picks Garden work — the ask will carry action requirements and ride the Work-approval rails", cite: "CS:385,387 · UX:618" },
  { f: "W3@request-work-what", hot: { h: "w3.request-work-continue-what", l: "Continue" }, who: "Ana", st: "Draft (local)", ev: "the wizard re-renders as the garden-work cast — four dots from the first screen, the title suggested from the garden's actions", cite: "UX:618" },
  { f: "W3@request-work-howmuch", hot: { h: "w3.request-continue-work", l: "Continue" }, who: "Ana", st: "Draft (local)", ev: "unit and amount stay chip picks; the garden-work path adds one proof step", cite: "UX:618" },
  { f: "W3@request-anchors", hot: { h: "w3.request-continue-anchors", l: "Continue" }, who: "Ana", st: "Draft (local)", ev: "the ask names its required actions — Weed × 2 · Mulch × 4 — approved work is the proof", cite: "CS:1384" },
  { f: "W3@request-work-review", hot: { h: "w3.submit-work-request", l: "Ask for this work" }, who: "Ana", st: "Draft → Requested", ev: "review repeats the ask with its requirement rows; who-confirms is already Ana · commitment job → CommitmentCreated", cite: "UX:157 · CS:132" },
  { f: "W1@request-work-queued", hot: null, marks: ["w1.queued-card"], who: "Ana", st: "Queued (local)", ev: "the optimistic ask stays visible in its pool scope until CommitmentCreated syncs", cite: "UX:157" },
  { f: "W2@request-work-active", hot: null, marks: ["w2.submit-work-request-detail"], st: "Requested → Active", ev: "João takes it up and submits work on the ordinary rails — approvals count toward the ask's requirements", cite: "CS:737", br: [{ l: "Work approval, steward side", to: "sb4b:0" }] },
  { f: "W2@request-work-partially-approved", hot: null, st: "PartiallyApproved · 1 of 2", ev: "each approval lands on the ask as progress Ana can watch", cite: "CS:737 · CS:138a" },
  { f: "W2@request-work-ready-confirmer", hot: null, st: "ReadyForConfirmation", ev: "both approvals counted — Ana, who asked, can now confirm on the ordinary request path; every contributor stays excluded", cite: "CS:139 · CS §6.1", br: [{ l: "Confirm — same path, request cast", to: "screen:W4@confirm-request" }] },
]},
// sb3 was one 13-scene arc crossing PWA and admin. Split at the surface seam:
// the member's asking-and-hearing-back is its own story, and so is the
// steward's decision. Each keeps the other side as condensed echoes.
{ id: "sb3a", n: 3, title: "Ask to take up a promise and hear back", persona: "Gardeners (Maria + João)", scen: "S3 · scarce crew slots", reviewVisible: true, reviewGroup: "client", chapter: "take-up", roles: ["gardener"], steps: [
  { f: "W1", hot: { h: "w1.ask-take-up" }, who: "Maria", st: "request Pending", ev: "claim job → ClaimRequested — terms stored: claimant · requestedBy · kind · gardenContext · requestedAt", cite: "CS:133 · UX:99", br: [{ l: "network fails pre-event → ordinary retry, never Declined (UX:108)", to: "screen:W1" }] },
  { f: "W1@claim-pending", hot: null, who: "Maria", st: "Pending", ev: "'Waiting for steward' — no claimant-cancel exists; the commitment stays browseable to others", cite: "WF:112 · UX:103" },
  { f: "W1", hot: null, who: "João", st: "Pending ×2", ev: "João asks for the same slot — a second request row lands beside Maria's; she keeps her own waiting state", cite: "DG:684" },
  { f: "W1@claim-pending", hot: null, who: "João", st: "Pending ×2", ev: "João now sees the same waiting-for-steward state", cite: "UX:103" },
  { f: "W1@claim-declined", hot: null, who: "Maria", st: "Declined", ev: "the steward declined Maria's row — the required reason arrives with it; João's request stays pending and the promise stays claimable", cite: "CS:734 · UX:105", br: [{ l: "Walk the steward's decision", to: "sb3b:0" }] },
  { f: "W1@claim-declined", hot: { h: "w1.ask-again" }, who: "Maria", st: "Declined", ev: "a fresh request record — never a retry of the declined row", cite: "UX:105" },
  { f: "W1@claim-pending", hot: null, who: "Maria", st: "Fresh request pending", ev: "the new request is a separate waiting row", cite: "UX:105" },
  { f: "W1@claim-accepted", hot: null, who: "João", st: "Accepted", ev: "the steward accepts João — acceptance consumes his stored terms and supersedes every other pending row", cite: "CS:733 · DG:696 · UX:104", br: [{ l: "Walk João's providing side", to: "sb43:0" }] },
  { f: "W1@claim-superseded", hot: null, who: "Maria", st: "Superseded", ev: "'Taken up by another provider' — resolution code names the cause; never a sync failure", cite: "UX:106 · DG:706" },
]},
{ id: "sb3b", n: 3, title: "Decide who takes up a promise", persona: "Steward (David)", scen: "S3 · scarce crew slots", reviewVisible: true, reviewGroup: "admin", chapter: "promises", roles: ["steward"], steps: [
  { f: "W7@claims", hot: { h: "w7.decline-claim", l: "Decline Maria's row (reason)" }, alts: [{ h: "w7.accept-claim", l: "or accept João now", to: "sb3b:4" }], who: "David", ev: "declineClaim + reason → ClaimDeclined — only Maria's row changes; João stays Pending", cite: "CS:734 · UX:105" },
  { f: "W7@decline-claim-confirm", hot: { h: "w7.decline-claim-confirm", l: "Decline request" }, who: "David", ev: "the confirmation takes the required reason and names what it does not touch — João's request stays pending", cite: "CS:734" },
  { f: "W7@claim-declined", hot: null, who: "David", st: "Maria declined", ev: "the console shows Maria declined while João remains pending", cite: "CS:734" },
  { f: "W1@claim-declined", hot: null, surface: "pwa", echo: true, marks: ["w1.ask-again"], st: "Declined", ev: "Maria reads the recorded reason and may ask afresh — a new request record, never a retry", cite: "UX:105" },
  { f: "W7@claims", hot: { h: "w7.accept-claim", l: "Accept João's row" }, who: "David", ev: "acceptClaim consumes João's stored terms → CommitmentAccepted · every other pending row → Superseded", cite: "CS:733 · DG:696" },
  { f: "W7@claim-outcomes", hot: null, who: "David", st: "Claim outcomes", ev: "the accepted row and superseded alternatives are visible before returning to members", cite: "DG:696" },
  { f: "W1@claim-superseded", hot: null, surface: "pwa", echo: true, st: "Superseded", ev: "the other claimant sees 'taken up by another provider' — the resolution code names the cause", cite: "UX:106 · DG:706" },
]},
{ id: "sb4a", n: 4, title: "Prove the work behind a promise", persona: "Gardener", scen: "S4 · AGRO+EDU", reviewVisible: true, reviewGroup: "client", chapter: "keep", roles: ["gardener"], steps: [
  { f: "W2", hot: { h: "w2.submit-work" }, alts: [{ h: "w2.link-work", l: "or link existing work", to: "sb4a:2" }], who: "provider", st: "Accepted", ev: "deep-links into the existing Garden-tab work flow with commitment context", cite: "UX:174" },
  { f: "WFLOW", hot: { h: "wflow.submit" }, marks: ["wflow.fulfills"], ev: "work job (existing, + meta.commitmentId) → dependent workLink after sync", cite: "UX:174,220", mf: true },
  { f: "W2@active", hot: { h: "w2.link-work", l: "Link existing work (post-hoc alt)" }, st: "Active", ev: "workLink job → WorkLinked", cite: "CS:735", skipTargetReason: "the linked work's approval happens on the admin Work stage (sb4b); this flow stays with the provider and shows the counted progress next" },
  { f: "W2@partially-approved", hot: null, st: "PartiallyApproved · 1 of 2", ev: "the garden's stewards approve the works on the existing rails — each approval lands on the promise as progress the provider can watch", cite: "CS:737 · CS:138a", br: [{ l: "Walk the steward's approvals", to: "sb4b:0" }] },
  { f: "W2@ready-confirmer", hot: null, st: "ReadyForConfirmation", ev: "both approvals counted and the qualifying assessment attached — the named confirmation path is ready", cite: "CS:235 · UX:287", br: [{ l: "Open the confirmation flow", to: "sb42:0" }, { l: "The assessment side", to: "sb50:0" }] },
]},
// Split at the actor seam 2026-08-10 (register #96): the steward approves
// work; the evaluator's attestation is sb50's story.
{ id: "sb4b", n: 4, title: "Approve the work", persona: "Steward", scen: "S4 · AGRO+EDU", reviewVisible: true, reviewGroup: "admin", chapter: "work", roles: ["steward"], steps: [
  { f: "HUBWORK", hot: { h: "hub.approve", l: "Approve (existing rails)" }, who: "steward", st: "PartiallyApproved 1 of 2", ev: "WorkApproval decision → onWorkDecision → ApprovedWorkCounted; a newer pre-freeze rejection reverses the same credit", cite: "CS:737" },
  { f: "HUBWORK", hot: null, who: "steward", st: "Approved work counted · 2 of 2", ev: "the second approval reaches requiredApprovedWorkCount — the assessment gate remains, and the evaluator carries it from here", cite: "CS:737 · CS:138a", br: [{ l: "Attest and attach the assessment", to: "sb50:0" }] },
]},
// The evaluator's side of readiness, split from sb4b (register #96).
{ id: "sb50", n: 50, title: "Attest and attach the assessment", persona: "Evaluator (Dr. Chen) + steward", scen: "S4 · AGRO+EDU", reviewVisible: true, reviewGroup: "admin", chapter: "assess", roles: ["evaluator", "steward"], steps: [
  { f: "W14@delta", hot: null, who: "Dr. Chen", marks: ["w14.kind"], st: "Delta", ev: "delta assessment attested — extends Create Assessment; delta renders only for Evaluator-hat holders", cite: "WF:447-455" },
  { f: "W10@attach-assessment", hot: { h: "w10.attach", l: "Attach assessment" }, who: "steward or evaluator", ev: "attachAssessment → auto-Ready re-run → CommitmentReadyForConfirmation", cite: "CS:235 · UX:287", mf: true },
  { f: "W2@ready-confirmer", hot: null, surface: "pwa", echo: true, st: "ReadyForConfirmation", ev: "the member's promise is now ready for its named confirmers", cite: "UX:287", br: [{ l: "Open the confirmation flow", to: "sb42:0" }] },
]},
// The confirmation act itself, extracted from sb1 (2026-08-10) so the recipient
// has one short flow of their own — and so sb4a/sb4b can hand off cleanly
// instead of jumping into the middle of a 22-scene ribbon.
{ id: "sb42", n: 42, title: "Confirm a promise kept", persona: "Recipient (João)", scen: "S1 · TAS workshop", reviewVisible: true, reviewGroup: "client", chapter: "confirm", roles: ["gardener"], steps: [
  { f: "W2@ready-confirmer", hot: { h: "w2.confirm", l: "Open confirmation" }, who: "João", st: "ReadyForConfirmation", ev: "the eligible recipient opens the garden-work confirmation sheet — the provider sees progress here but never a self-confirmation control", cite: "UX:142 · UX:32" },
  { f: "W4", hot: { h: "w4.confirm", l: "Confirm — promise kept" }, alts: [{ h: "w4.not-yet", l: "Not yet → steward review", to: "sb5:0" }], who: "João", st: "ReadyForConfirmation", ev: "ConfirmationRecorded reaches the threshold; Maria remains excluded", cite: "CS:139" },
  { f: "W4@confirmed-pending", hot: null, who: "João", st: "Pending local sync", ev: "the confirmation is saved locally without showing fulfillment early", cite: "UX:169,221" },
  { f: "W4@confirmed", hot: { h: "w4.done", l: "Back to the pool" }, who: "João", st: "Fulfilled", ev: "sync completion shows the one-time quiet result before returning", cite: "UX:197-204" },
  { f: "W2@fulfilled", hot: null, marks: ["w2.reward-row"], st: "Fulfilled", ev: "the same DomainImpact promise is now kept", cite: "UX:197-199" },
  { f: "W15", hot: null, surface: "editorial", echo: true, marks: ["w15.counts"], st: "aggregate", ev: "the garden's public page ticks — counts-only below the small-community threshold", cite: "UX:350" },
]},
{ id: "sb5", n: 5, title: "Say “not yet” and let the stewards resolve it", persona: "Recipient (confirmer)", scen: "S5", reviewVisible: true, reviewGroup: "client", chapter: "confirm", roles: ["gardener"], steps: [
  { f: "W4", hot: { h: "w4.not-yet", l: "Not yet — tell the stewards why" }, who: "confirmer", st: "ReadyForConfirmation", ev: "required reason focuses → online raiseDispute → CommitmentDisputed (preDisputeState stored)", cite: "CS:143 · UX:426", br: [{ l: "tx fails → stays ReadyForConfirmation, inline retry (UX:217)", to: "screen:W4@not-yet-failed" }] },
  { f: "W4@not-yet", hot: { h: "w4.not-yet-send", l: "Send to the stewards" }, who: "confirmer", st: "Reason required", ev: "the member records what still needs doing before the promise enters review", cite: "UX:167" },
  { f: "W2@disputed", hot: null, st: "Disputed", ev: "banner 'under review by stewards' — CTAs frozen; never surfaced publicly. The stewards take it from here", cite: "UX:95", br: [{ l: "Walk the steward's resolution", to: "sb47:0" }] },
  { f: "W2@ready-confirmer", hot: null, st: "ReadyForConfirmation restored", ev: "the stewards resolved RestorePrevious — the promise returns to the exact stored pre-dispute state, no unit movement, and the resolution reason renders in the member timeline", cite: "LAP:186 · UX:300", note: "This fixture entered dispute from ReadyForConfirmation, so RestorePrevious must return there rather than Accepted." },
]},
// The steward's side of a “not yet”, split out 2026-08-10: the member flow
// ends at “under review”, and this short admin flow owns the resolution act.
{ id: "sb47", n: 47, title: "Resolve a “not yet”", persona: "Steward (David)", scen: "S5", reviewVisible: true, reviewGroup: "admin", chapter: "promises", roles: ["steward"], steps: [
  { f: "W10@resolve-dispute", hot: { h: "w10.resolve", l: "Resolve (eligible outcomes + reason)" }, who: "David", st: "Disputed", ev: "David is also a contributor, so Fulfilled is hidden by the SelfConfirmation guard; this fixture resolves RestorePrevious while Cancelled and Expired remain available", cite: "CS:144" },
  { f: "W2@ready-confirmer", hot: null, surface: "pwa", echo: true, st: "ReadyForConfirmation restored", ev: "RestorePrevious returns the exact stored pre-dispute state — no unit movement — and every resolution reason renders in the member timeline", cite: "LAP:186 · UX:300", note: "This fixture entered dispute from ReadyForConfirmation, so RestorePrevious must return there rather than Accepted." },
]},
{ id: "sb6a", n: 6, title: "Offer again after a promise expires", persona: "Promise owner", scen: "S1/S5 edge", reviewVisible: true, reviewGroup: "client", chapter: "change", roles: ["gardener"], steps: [
  { f: "W2@expired", hot: null, st: "Expired", ev: "a submitted permissionless expiry released units and live counts; the admin due-live action ships in August and a keeper remains only a later backstop (register #34d)", cite: "CS:746", br: [{ l: "Stewards expire and re-seed lapsed promises", to: "sb6b:0" }] },
  { f: "W2@expired", hot: { h: "w2.offer-again", l: "Offer again" }, who: "owner", st: "Expired", ev: "units released exactly once · pending claim requests → Superseded (COMMITMENT_EXPIRED)", cite: "CS:142", mf: true },
  { f: "W3@step-what", hot: { h: "w3.continue-what", l: "Continue" }, who: "owner", st: "Prefilled draft", ev: "a fresh promise begins with the expired promise's useful context", cite: "UX:94" },
  { f: "W3@step-howmuch", hot: { h: "w3.continue-howmuch", l: "Continue" }, who: "owner", st: "Prefilled draft", ev: "the owner checks the amount and due rule", cite: "UX:94" },
  { f: "W3@step-anchors", hot: { h: "w3.continue-anchors", l: "Continue" }, who: "owner", st: "Prefilled draft", ev: "the owner checks the action anchors; the confirmer rule carries over with the pilot-default Green Goods fallback behind it", cite: "UX:94 · UX §5.4" },
  { f: "W3@step-review", hot: { h: "w3.submit", l: "Make this offer (prefilled)" }, ev: "a fresh commitment — per-cycle renewal re-entry, not a state rewind", cite: "UX:94" },
  { f: "W1@queued", hot: null, marks: ["w1.queued-card"], st: "Queued (local)", ev: "the fresh commitment waits to sync as a new record", cite: "UX:212" },
]},
{ id: "sb6b", n: 6, title: "Re-seed a promise that lapsed", persona: "Steward (David)", scen: "S1/S5 edge", reviewVisible: true, reviewGroup: "admin", chapter: "promises", roles: ["steward"], steps: [
  { f: "W7@due-live", hot: { h: "w7.expire-commitment", l: "Expire now" }, who: "David", st: "Accepted · past due", ev: "permissionless expireCommitment → Expired; releases the reservation once, supersedes pending claims, and decrements pool/cycle live counts", cite: "CS:746 · UX:94", mf: true },
  { f: "W7@expiry-queue", hot: { h: "w7.reseed", l: "Re-seed" }, who: "David", ev: "lapsed seeded promise re-enters W8 prefilled", cite: "UX:94", mf: true },
  { f: "W8@step1", hot: { h: "w8.continue-scope", l: "Continue" }, who: "David", ev: "checks the seeded promise's type and cycle scope", cite: "UX:94" },
  { f: "W8@step2", hot: { h: "w8.continue-requirements", l: "Continue" }, who: "David", ev: "checks units, target, action requirements, and due rule", cite: "UX:94" },
  { f: "W8@step3", hot: { h: "w8.continue-rule", l: "Continue" }, who: "David", ev: "checks ordinary reachability, the pilot-default Green Goods team fallback, threshold, and claim mode", cite: "UX §6.3" },
  { f: "W8@step4", hot: { h: "w8.continue-reward", l: "Continue" }, who: "David", ev: "checks the declared reward rail and its reference", cite: "UX:94" },
  { f: "W8@step5", hot: { h: "w8.seed", l: "Seed this commitment" }, who: "David", ev: "creates a fresh seeded commitment", cite: "UX:94" },
  { f: "W7", hot: null, who: "David", st: "Open", ev: "the reseeded promise returns to the pool workspace", cite: "UX:94" },
]},
{ id: "sb7", n: 7, title: "Make a promise offline and watch it sync", persona: "Gardener", scen: "S6 · pt-BR proof", reviewVisible: true, reviewGroup: "client", chapter: "make", roles: ["gardener"], steps: [
  { f: "W3", hot: null, st: "offline mid-flow", ev: "draft persists locally (WorkDraftRecord semantics)", cite: "UX:160" },
  { f: "W3@draft-resume", hot: null, ev: "re-entry offers resume (DraftDialog pattern)", cite: "UX:160" },
  { f: "W1@queued", hot: null, marks: ["w1.queued-card"], st: "queued (optimistic)", ev: "submit offline → queued badge + SyncStatusBar + polite announcement", cite: "UX:237,427" },
  { f: "W1", hot: null, st: "Offered (on-chain)", ev: "connectivity returns → CommitmentCreated · 'N promises synced'", cite: "UX:427" },
  { f: "W1@sync-failed", hot: null, st: "Failed (local)", ev: "5 attempts exhausted → Failed chip · retry / discard · parseContractError", cite: "UX:240", br: [{ l: "Retry re-enters sync", to: "sb7:3" }, { l: "pool read fails → loading / not-found / retry", to: "screen:W1@read-error" }] },
  { f: "W1@waiting-membership", hot: null, st: "waiting_for_hat", ev: "pre-flight membership check — no retries consumed; resumes on membership (register #34c; join-request approval register #35 is the trigger)", cite: "LAP:191", mf: true },
]},
// Condensed from 12 scenes: the member's ordinary evidence-and-confirmation
// path is sb1/sb2's job, so this flow keeps only what capture changes — who
// records the promise, and how a steward confirms when the member cannot.
{ id: "sb8", n: 8, title: "Record a promise for a device-free member", persona: "Steward (David)", scen: "S7 · device-free member", reviewVisible: true, reviewGroup: "admin", chapter: "behalf", roles: ["steward", "member"], steps: [
  { f: "W9", hot: { h: "w9.choose", l: "Choose Kwame" }, who: "David", ev: "select the member whose promise is being recorded", cite: "WF:354-357" },
  { f: "W9@capture-kind", hot: { h: "w9.continue", l: "Continue to captured promise" }, who: "David", ev: "capturedFor and capture kind are reviewed; captured confirmations always carry a reason", cite: "WF:354-357" },
  { f: "W8@captured-for", hot: { h: "w8.record", l: "Record it" }, who: "David", ev: "commitment job (StewardCaptured, onBehalfOf) → CommitmentCreated(creator = member, recordedBy = steward)", cite: "CS:730 · DG:236" },
  { f: "W7", hot: null, who: "David", st: "Open", ev: "the captured promise appears in the admin pool workspace — recording done, four taps total", cite: "UX:437" },
  { f: "W2@captured", hot: null, surface: "pwa", echo: true, marks: ["w2.captured-chip"], st: "Accepted", ev: "the recorded promise appears as Kwame's own, ready for evidence and confirmation on the member side", cite: "WF:138 · UX:437", br: [{ l: "The member's side, through confirmation", to: "sb44:0" }] },
]},
// The member's side of a steward-recorded promise, split from sb8 (2026-08-10):
// evidence, readiness, and the counterparty's confirmation on the client PWA.
{ id: "sb44", n: 44, title: "A promise recorded for you", persona: "Member (Kwame)", scen: "S7 · device-free member", reviewVisible: true, reviewGroup: "client", chapter: "confirm", roles: ["member", "gardener"], steps: [
  { f: "W2@captured", hot: { h: "w2.add-evidence-captured", l: "Add evidence" }, who: "Kwame", marks: ["w2.captured-chip"], st: "Accepted", ev: "the recorded promise stays Kwame's and enters the evidence-only path without a garden-work approval gate", cite: "WF:138 · UX:437" },
  { f: "W2a@compose-captured", hot: { h: "w2a.attach-captured", l: "Attach evidence" }, who: "Kwame", st: "Evidence draft", ev: "the evidence composer preserves StewardCaptured and Kwame as the promise source", cite: "CS:739 · UX:437" },
  { f: "W2@captured-evidence-queued", hot: null, who: "Kwame", st: "Evidence queued (local)", ev: "the evidence is visible locally while the recorded-promise cast stays intact", cite: "UX:218" },
  { f: "W2@captured-evidence-submitted", hot: { h: "w2.send-confirmation-captured", l: "Send for confirmation" }, who: "Kwame", st: "EvidenceSubmitted", ev: "StewardCaptured uses the evidence-only readiness call; no linked work is invented", cite: "CS:741" },
  { f: "W2@captured-ready-pending", hot: null, who: "Kwame", st: "Readiness queued (local)", ev: "confirmation stays unavailable until the readiness update syncs", cite: "UX:169,221" },
  { f: "W2@captured-ready-confirmer", hot: null, st: "ReadyForConfirmation", ev: "done — now it waits on Ana, the named counterparty; every contributor remains blocked", cite: "CS §6.1", br: [{ l: "Confirm — same path, recorded-promise cast", to: "screen:W4@confirm-captured" }, { l: "Eligible local steward → garden fallback with reason", to: "screen:W10@fallback-confirm" }, { l: "No eligible local confirmer → Green Goods team fallback (pilot default)", to: "screen:W10@protocol-fallback-confirm" }] },
  { f: "W2@captured-fulfilled", hot: null, who: "Kwame", st: "Fulfilled · steward record", ev: "when Ana confirms, the member sees the fulfilled recorded promise with its source marker intact", cite: "UX:301" },
]},
// The campaign-request cast's full walk (register #97): evidence to confirmed
// without losing the Campaign binding — previously screen-library-only.
{ id: "sb52", n: 52, title: "Keep a campaign ask until it's ready to confirm", persona: "Helper (João)", scen: "S1 · campaign request", reviewVisible: true, reviewGroup: "client", chapter: "keep", roles: ["gardener"], steps: [
  { f: "W1@campaign-market", hot: { h: "w1.take-up-campaign-request", l: "I can help" }, who: "João", st: "Campaign Open", ev: "claim → CommitmentAccepted · the Market rides Campaign binding travels with the ask", cite: "UX:127 · CS:133" },
  { f: "W2@campaign-request-active", hot: { h: "w2.add-evidence-campaign-request", l: "Add evidence" }, who: "João", st: "Accepted → Active", ev: "evidence is the provider's next legal act; the Campaign remains the scope", cite: "CS:138b" },
  { f: "W2a@compose-campaign-request", hot: { h: "w2a.attach-campaign-request", l: "Attach evidence" }, who: "João", st: "Evidence draft", ev: "the shared composer queues the photo with its credited-contributor vector", cite: "CS:739" },
  { f: "W2@campaign-request-evidence-queued", hot: null, who: "João", st: "Evidence queued (local)", ev: "the evidence row is visible with queued chrome until EvidenceAttached syncs", cite: "UX:218" },
  { f: "W2@campaign-request-evidence-submitted", hot: { h: "w2.send-confirmation-campaign-request", l: "Send for confirmation" }, who: "João", st: "EvidenceSubmitted", ev: "the evidence-only call advances to ReadyForConfirmation without a work gate", cite: "CS:741", mf: true },
  { f: "W2@campaign-request-ready-pending", hot: null, st: "Readiness queued (local)", ev: "the ask remains EvidenceSubmitted until readiness reaches the contract", cite: "UX:169,221" },
  { f: "W2@campaign-request-ready-confirmer", hot: null, st: "ReadyForConfirmation", ev: "done — now it waits on Ana, who asked; the Campaign binding travels with her confirmation", cite: "CS:139", br: [{ l: "Confirm — same path, campaign cast", to: "screen:W4@confirm-campaign-request" }] },
  { f: "W2@campaign-request-fulfilled", hot: null, st: "Fulfilled", ev: "when Ana confirms, the same Campaign ask returns as kept — same title, same unit, same Campaign; the Campaign count updates", cite: "UX:127" },
]},
// The exchange wave graduates to the registry (register #97): acceptExchange is
// shipped and tested on-chain, so the planned SB-35/SB-36 become walkable.
// "Both start together" ends at acceptance — after that, two ordinary lanes.
{ id: "sb35", n: 35, title: "Create and accept a bilateral exchange pair", persona: "Maria (offers B) + Ana (accepts)", scen: "S16 · bilateral exchange", reviewVisible: true, reviewGroup: "client", chapter: "make", roles: ["gardener"], steps: [
  { f: "W31", hot: { h: "w31.exchange-circle", l: "Exchange circle" }, who: "Maria", st: "Template picker", ev: "the one template that adds an exchange reference — it routes through the picker before the ordinary review", cite: "WF:1302 · UX §E.2" },
  { f: "W28", hot: { h: "w28.pick-childcare", l: "Choose Ana's Offer" }, who: "Maria", st: "Choosing the counterpart", ev: "eligible same-pool Offers only: still Offered, Individual, capacity-backed, another creator — accepted, lapsed, self-owned rows never render", cite: "WF:1213 · UX §E.1" },
  { f: "W28@selected", hot: { h: "w28.submit", l: "Make this offer in exchange" }, who: "Maria", st: "You give · you receive", ev: "the mirrored review keeps every give-side field editable — title, unit, amount, and due — before anything is created; the executor re-reads Ana's Offer for early feedback; createCommitment repeats every predicate atomically before storing counterCommitmentId · CommitmentCreated(B, counterCommitmentId=A)", cite: "CS §5.3 · WF:1219", br: [{ l: "A changed before mining → no B created, clear or replace", to: "screen:W28@selection-invalid" }] },
  { f: "W1@exchange-queued", hot: null, marks: ["w1.queued-card"], who: "Maria", st: "Queued (local)", ev: "the optimistic paired offer stays visible until CommitmentCreated syncs — no pair exists for anyone until B is created", cite: "UX:157" },
  { f: "W29", hot: { h: "w29.accept-cta", l: "Start both promises…" }, who: "Ana", st: "Proposed pair", ev: "the pair renders as context on two ordinary promises; only Ana — A's creator — sees the accept action", cite: "WF:1249,1274" },
  { f: "W30", hot: { h: "w30.start", l: "Start both promises" }, who: "Ana", st: "Start both?", ev: "one acceptExchange(B) call runs every A/B predicate — no partial optimistic state; errors name who acts next", cite: "CS §5.3 · WF:1274", br: [{ l: "A no longer open → named error, nothing committed", to: "screen:W30@contract-error" }] },
  { f: "W30@submitting", hot: null, who: "Ana", st: "Submitting — nothing accepted yet", ev: "the one wallet call runs; both promises stay Offered until ExchangeAccepted lands, and Matched never renders optimistically", cite: "CS §5.3" },
  { f: "W29@matched", hot: null, st: "Matched — both Accepted", ev: "two CommitmentAccepted events, one creator-lead ContributorAdded per side, and ExchangeAccepted — the already-reserved classes verify with no recommit", cite: "CS §5.3" },
  { f: "W29@counterpart-lapsed", hot: null, st: "Counterpart lapsed", ev: "later, if one side ends, only that side changes — the other promise keeps its own state, with no automatic cancellation and no pressure copy", cite: "WF:1251", br: [{ l: "Each side proceeds on its ordinary rails", to: "screen:W2@support-accepted" }] },
]},
{ id: "sb36", n: 36, title: "Start from an Offer template", persona: "Gardener", scen: "S16 · template-first creation", reviewVisible: true, reviewGroup: "client", chapter: "make", roles: ["gardener"], steps: [
  { f: "W31", hot: { h: "w31.work-party", l: "Work party" }, who: "gardener", st: "Template picker", ev: "choosing a template loads documented defaults — content and config only, never a contract type or lifecycle", cite: "WF:1287,1310" },
  { f: "W3@step-what", hot: { h: "w3.continue-what", l: "Continue" }, st: "Prefilled · fully editable", ev: "the template lands in the ordinary editable creation flow with no hidden lock; every prefilled field can change", cite: "WF:1310 · UX §E.2" },
  { f: "W3@step-howmuch", hot: { h: "w3.continue-howmuch", l: "Continue" }, st: "Draft (local)", ev: "unit and amount stay chip picks with the template's defaults selected", cite: "UX:155" },
  { f: "W3@step-anchors", hot: { h: "w3.continue-anchors", l: "Continue" }, st: "Draft (local)", ev: "the work party's action requirements arrive prefilled and editable", cite: "UX:156" },
  { f: "W3@step-review", hot: { h: "w3.submit", l: "Make this offer" }, st: "Draft (local)", ev: "review mirrors the exact values to be submitted — the record is indistinguishable from the same fields entered by hand", cite: "WF:1338", br: [{ l: "Stewards seed from the same template library", to: "screen:W8@step1" }] },
  { f: "W1@queued", hot: null, marks: ["w1.queued-card"], st: "Queued (local)", ev: "the existing offline and membership-wait recovery paths apply unchanged", cite: "UX:212" },
]},
// Split from one 33-scene ribbon (register: audit 2026-07-24). Each of the three
// covers one stewardship task end to end; the original concatenated readiness,
// seeding, allocation, pause/resume, close, compost and cancel, so a reviewer
// parachuted mid-flow had no chapter to orient against.
{ id: "sb9a", n: 9, title: "Ready the pool and open the season", persona: "Steward (David)", scen: "S5/S13 admin side", reviewVisible: true, reviewGroup: "admin", chapter: "season", roles: ["steward"], steps: [
  { f: "W7@not-ready", hot: null, st: "NotReady", ev: "checklist: charter · provider open-commitment cap · qualifying Baseline", cite: "UX:57,269" },
  { f: "W7@not-ready", hot: { h: "w7.edit-charter", l: "Edit charter + set cap" }, ev: "setPoolCharter · setProviderOpenCommitmentCap (required before Ready)", cite: "CS:723,751" },
  { f: "W7@preflight-complete", hot: { h: "w7.mark-ready", l: "Mark pool ready" }, st: "Ready", ev: "markPoolReady records NotReady → Ready; Baseline is the app preflight, charter + non-zero cap are enforced onchain", cite: "CS:724 · UX:298" },
  { f: "W7@ready", hot: null, st: "Ready", ev: "the admin result separates readiness from opening or seeding a commitment", cite: "UX:58", br: [{ l: "The member's view of Ready", to: "screen:W1@ready" }] },
  { f: "W7@ready", hot: { h: "w7.seed-cycle", l: "Seed a cycle" }, alts: [{ h: "w7.open-pool", l: "or open the pool first — the card action (register #34a)", to: "screen:W7" }], st: "Ready", ev: "seeding a cycle is legal while the pool is Ready (CS:566); the flow's open step then carries the Ready-pool guard, which opens the pool with the cycle — the deadlock fix register #34a adopted onto the card", cite: "CS:566 · CS:100", mf: true },
  { f: "W7@seed-cycle", hot: { h: "w7.seed-cycle-confirm", l: "Seed this cycle" }, who: "David", ev: "seedCycle(poolId, cycleType, startTime, endTime, metadataCID) → CycleSeeded — the Season is recorded but not yet open, and no reason is stored", cite: "CS:566", skipTargetReason: "the member's opens-soon preview is linked as a branch rather than walked; the steward continues straight to the allocation step", br: [{ l: "The member's opens-soon preview", to: "screen:W1@seeded" }] },
  { f: "W11", hot: { h: "w11.continue", l: "Continue" }, st: "Allocation set", ev: "the standard split arrives already applied — adjusting a share is the exception; the snapshot must total 100%", cite: "CS:114 · UX:322" },
  { f: "W11@guard", hot: { h: "w11.open-cycle", l: "Open pool and cycle" }, st: "Cycle Open", ev: "the Ready-pool guard submits openPool first, then openCycle with the stored allocation", cite: "CS:100 · CS:114 · CS:727" },
  { f: "W7", hot: null, who: "David", st: "Cycle Open", ev: "the active cycle returns to the pool workspace", cite: "CS:114" },
  { f: "W1", hot: null, surface: "pwa", echo: true, marks: ["w1.season-card"], ev: "members see the Season card go live · derived InProgress/Reviewing overlays follow activity", cite: "CS:115-117" },
]},
{ id: "sb9b", n: 9, title: "Pause and resume the pool", persona: "Steward (David)", scen: "S5/S13 admin side", reviewVisible: true, reviewGroup: "admin", chapter: "season", roles: ["steward"], steps: [
  { f: "W7@manage", hot: { h: "w7.pause", l: "Pause (reason)" }, st: "Paused", ev: "pausePool(reason) — member banner; create/claim/Ready-submit/confirm disabled, recovery stays available", cite: "UX:60" },
  { f: "W7@pause-confirm", hot: { h: "w7.pause-confirm", l: "Pause pool" }, st: "Pause — confirm", ev: "the blast radius (23 members, 7 open promises) and the stored reason are both named before anything pauses", cite: "UX:60 · CS:725" },
  { f: "W7@paused", hot: null, who: "David", st: "Paused", ev: "the admin card holds the indexed pause reason and recovery action", cite: "UX:60" },
  { f: "W1@paused", hot: null, surface: "pwa", echo: true, st: "Paused", ev: "members get a quiet reason banner; creation and confirmation wait while recovery stays available", cite: "UX:60" },
  { f: "W7@paused", hot: { h: "w7.resume", l: "Resume" }, st: "Open", ev: "resumePool clears the indexed reason", cite: "CS:725" },
  { f: "W7", hot: null, who: "David", st: "Open", ev: "the cleared pause state returns to the open pool", cite: "CS:725" },
]},
{ id: "sb9c", n: 9, title: "End a season — close, compost, or cancel", persona: "Steward (David)", scen: "S5/S13 admin side", reviewVisible: true, reviewGroup: "admin", chapter: "season", roles: ["steward"], steps: [
  { f: "W7@manage", hot: { h: "w7.close-season", l: "Close Season" }, st: "Reviewing", ev: "opens the close wizard without reconciling early; the cycle stays Open on-chain while outstanding items are reviewed", cite: "UX:338 · CS:118", br: [{ l: "Variant: cancel the season instead", to: "sb9c:13" }] },
  { f: "W26@review", hot: { h: "w26.continue-shares", l: "Close cycle and continue" }, st: "Terminal set · live count zero", ev: "closeCycle runs before any share review or mint, locking the exact fulfilled commitment bundle as Reconciled", cite: "UX:75 · CS:118", mf: true },
  { f: "W26@shares", hot: { h: "w26.continue-certificate", l: "Continue to certificate" }, st: "Reconciled · allocation snapshot", ev: "reads back the six-role share snapshot against the now-closed commitment set", cite: "UX:75" },
  { f: "W26@certificate", hot: { h: "w26.mint", l: "Mint impact certificate" }, st: "Reconciled · certificate", ev: "bundles the closed cycle's fulfilled promises with their work, evidence, and lineage", cite: "CS §9" },
  { f: "W26@rest", hot: { h: "w26.compost", l: "Compost closed cycle" }, st: "Reconciled · certificate minted", ev: "compostCycle archives the already-closed cycle; it does not repeat closeCycle", cite: "UX:338 · CS:118", mf: true },
  { f: "W7@cycle-composted", hot: null, who: "David", st: "Composted", ev: "the cycle returns to the console only after both lifecycle writes succeed", cite: "CS:118-119", br: [{ l: "The member's season summary and hero", to: "screen:W1@cycle-summary" }] },
  { f: "W7@cycle-composted", hot: { h: "w7.close-pool", l: "Close pool" }, who: "David", st: "All cycles composted", ev: "every cycle — the Season and all three Campaigns — has composted, which is the condition that makes Close pool appear at all (uiux §6.2); seeding the next cycle stays available beside it", cite: "CS:102" },
  { f: "W7@close-pool-confirm", hot: { h: "w7.close-pool-confirm", l: "Close pool" }, who: "David", st: "Close — confirm", ev: "closing ends participation for the pool's 23 members; the confirmation names that blast radius — closePool stores no reason (CS:556)", cite: "CS:102 · CS:556" },
  { f: "W7@pool-closed", hot: null, who: "David", st: "Closed", ev: "the pool closes for members too — its history stays with the garden", cite: "CS:102", br: [{ l: "The member's closed view", to: "screen:W1@closed" }] },
  { f: "W7@pool-closed", hot: { h: "w7.compost-pool", l: "Compost pool" }, who: "David", st: "Closed", ev: "the archive action opens a confirmation before compostPool runs", cite: "CS:103" },
  { f: "W7@compost-pool-confirm", hot: { h: "w7.compost-confirm", l: "Compost pool" }, who: "David", st: "Closed · confirm archive", ev: "the confirmation names archival without inventing a stored reason or wider blast radius", cite: "CS:103" },
  { f: "W7@pool-composted", hot: { h: "w7.reopen-pool", l: "Reopen pool" }, who: "David", st: "Composted", ev: "the archived pool offers the explicit reopen path", cite: "UX:62 · CS:104" },
  { f: "W7@reopen-confirm", hot: { h: "w7.reopen-confirm", l: "Reopen to Ready" }, who: "David", st: "Reopen — confirm", ev: "reopenPool(poolId, false) preserves history and returns the pool to Ready", cite: "CS:104" },
  { f: "W7@ready", hot: null, who: "David", st: "Ready", ev: "the reopened pool is prepared but member participation stays closed until openPool", cite: "UX:58" },
  { f: "W7@manage", hot: { h: "w7.cancel-cycle", l: "variant: Cancel a cycle (reason)" }, ev: "cancelCycle → quiet member banner with reason · pool coda: close → compost → reopen (register #34a)", cite: "UX:77 · CS:104", note: "The variant rewinds to the open season — cancelCycle is legal only from Seeded or Open (CS:117), never after compost or close." },
  { f: "W7@cancel-cycle-confirm", hot: { h: "w7.cancel-cycle-confirm", l: "Cancel season" }, st: "Cancel — confirm", ev: `the season's own counts (${SEASON_LIVE.made} promises, ${SEASON_LIVE.kept} kept) are named before the cancel, alongside the reason members will read`, cite: "UX:77" },
  { f: "W1@cancelled-cycle", hot: null, surface: "pwa", echo: true, st: "Cycle cancelled", ev: "members read the reason without it implying the whole pool failed", cite: "UX:77" },
]},
{ id: "sb10", n: 10, title: "Declare a reward and record its payout", persona: "Steward (David) + gardener", scen: "S13 · July's only rail", reviewVisible: true, reviewGroup: "admin", chapter: "recognition", roles: ["steward"], steps: [
  { f: "W8@step4", hot: null, marks: ["w8.reward"], who: "David", ev: "the external payout record is selected; the declared reward is a reference only and the module never custodies funds", cite: "WF:339 · UX:280", br: [{ l: "The member's pending reward row", to: "screen:W2" }] },
  { f: "W13", hot: { h: "w13.row", l: "open the garden-fallback row" }, alts: [{ h: "w13.protocol-row", l: "or an opted-in Green Goods team row", to: "screen:W10@protocol-fallback-confirm" }], who: "David", st: "ReadyForConfirmation", ev: "Hub Confirm stage labels ordinary, garden fallback, and Green Goods team fallback eligibility distinctly", cite: "UX §6.9" },
  { f: "W10@detail-fallback-eligible", hot: null, st: "ReadyForConfirmation · ordinary path unreachable", ev: "the indexed eligibility result exposes garden fallback only after the ordinary named/default path can no longer reach threshold", cite: "CS §6.1" },
  { f: "W10@external-fulfilled", hot: null, st: "Fulfilled", ev: "confirmFulfillmentAsFallback records the non-contributor garden steward and required reason; the reward is now recordable", cite: "CS §6.1" },
  { f: "W10@external-fulfilled", hot: { h: "w10.record-payout", l: "Record payout" }, ev: "ArbitrumExternal permits AdminConfirmDialog to capture the rail reference → recordConsiderationPaid → ConsiderationPaid", cite: "CS:749", note: "register #34h — the dry run runs this with a real minimal Cookie Jar withdrawal" },
  { f: "W10@record-payout", hot: { h: "w10.payout-confirm", l: "Record payout" }, st: "Payout confirmation", ev: "the steward reviews the declared reward and records the executed rail reference", cite: "UX:302" },
  { f: "W2@reward-released", hot: null, surface: "pwa", echo: true, marks: ["w2.reward-row"], ev: "the member row flips to 'reward released' — quiet admin confirmation only, celebration already fired client-side", cite: "UX:143,202" },
]},
{ id: "sb11", n: 11, title: "Watch G$ support arrive, then send it on", persona: "Gardener", scen: "S8/S9 · TAS", reviewVisible: true, reviewGroup: "client", chapter: "money", roles: ["gardener"], steps: [
  { f: "W2@support-queued", hot: null, marks: ["w2.reward-row"], st: "Queued", ev: "reward row: 'support on its way'", cite: "SS §3" },
  { f: "W2@support-en-route", hot: null, marks: ["w2.reward-row"], st: "Dispatched", ev: "reward row: 'support on its way'", cite: "SS §3" },
  { f: "W2@support-delayed", hot: null, marks: ["w2.reward-row"], st: "Dispatched + derived delay", ev: "'support on its way — delivery delayed' without becoming Failed", cite: "SS §3" },
  { f: "W2@support-executed", hot: null, st: "Celo executed", ev: "'support on its way' — source remains Dispatched until acknowledgment", cite: "SS §3" },
  { f: "W2@support-confirming", hot: null, st: "Acknowledgment pending", ev: "'support on its way' remains visible while the stored Celo outcome may retry its acknowledgment without moving G$", cite: "SS §4" },
  { f: "W2@support-arrived", hot: null, st: "Confirmed", ev: "'support arrived ↗' + Celo ref — only an authenticated success acknowledgment for the current execution key and attempt can produce it", cite: "SS §3 · AM §1" },
  { f: "W23", hot: { h: "w23.send" }, marks: ["w23.arrived-row"], ev: "online transfer — sponsored gas, never enters the offline queue", cite: "UX:219 · SS:433" },
  { f: "W23@send", hot: { h: "w23.send-submit", l: "Send" }, ev: "wallet-pending → confirmed; failure surfaces inline with retry", cite: "UX:219" },
  { f: "W23@send-pending", hot: null, st: "Wallet pending", ev: "the wallet confirmation remains visible before the balance changes", cite: "UX:219" },
  { f: "W23@balance", hot: null, marks: ["w23.arrived-row"], st: "Confirmed", ev: "the completed send returns to the balance and result surface", cite: "UX:219" },
  { f: "W2@support-failed", hot: null, st: "Failed (disbursement)", ev: "'support is being rearranged — your promise is recorded' — the commitment stays Fulfilled", cite: "SS:532 · DG:666", br: [{ l: "Steward recovery", to: "sb12:6" }] },
  { f: "W2@support-cancelled-queued", hot: null, st: "Cancelled from Queued", ev: "'support was withdrawn before it was sent' — the promise and its record stay intact", cite: "SS §3.1" },
  { f: "W2@support-cancelled-failed", hot: null, st: "Cancelled from Failed", ev: "'support was closed after delivery could not complete' — failed attempt history remains legible", cite: "SS §3.1" },
  { f: "W23@delivery-blocked", hot: null, st: "delivery blocked", ev: "AA gate failed → no balance or send; Safe-to-Safe garden funding continues · register #34f makes the gate legible admin-side", cite: "SS:425" },
]},
{ id: "sb12", n: 12, title: "Dispatch queued support and close the loop", persona: "Steward + protocol executor", scen: "S8/S9 · pre-broadcast proof", reviewVisible: true, reviewGroup: "admin", chapter: "ggops", roles: ["green-goods-team"], steps: [
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
{ id: "sb13", n: 13, title: "Claim a protocol promise for your garden", persona: "Garden steward (Leila)", scen: "S14", reviewVisible: true, reviewGroup: "client", chapter: "money", roles: ["steward"], steps: [
  { f: "W25", hot: { h: "w25.ask", l: "Ask to take this up" }, who: "Leila", ev: "protocol commitment offers eligible stewards a personal or garden provider context", cite: "UX:129" },
  { f: "W25@context-chooser", hot: { h: "w25.continue", l: "choose “For Awka Hub”, then Continue" }, ev: "Garden claim: claimant = GardenAccount · requestedBy = Leila — the sheet opens on the safer “As myself” default; Leila flips it", cite: "CS:577-589", mf: true },
  { f: "W25@pending", hot: null, st: "Pending", ev: "canonical claimant + requested-by + provider context shown — now it waits on the Green Goods stewards", cite: "UX:99", br: [{ l: "Walk the acceptance", to: "sb46:0" }] },
  { f: "W25@accepted", hot: { h: "w25.open-promise", l: "Open the promise" }, who: "Leila", st: "Accepted", ev: "accepted — the garden is the provider now: Awka Hub made the promise, Leila remains the requester", cite: "CS:733 · CS:577-589" },
  { f: "W2@garden-provider", hot: null, marks: ["w2.reward-row"], st: "Accepted", ev: "the garden works and proves — EAS recipient = providerGarden; the declared support is bound to the garden, not to Leila", cite: "CS:772 · AM:43", br: [{ l: "Evidence and work run on the ordinary rails", to: "sb4a:0" }, { l: "Verification and payout, Green Goods side", to: "sb46:2" }] },
]},
// The Green Goods stewards' side of a garden claim, split from sb13
// (2026-08-10): acceptance and verification live where that team acts.
{ id: "sb46", n: 46, title: "Accept a garden's claim", persona: "Protocol steward", scen: "S14", reviewVisible: true, reviewGroup: "admin", chapter: "ggops", roles: ["green-goods-team"], steps: [
  { f: "W12", hot: { h: "w12.accept", l: "Accept" }, who: "protocol steward", ev: "accept consumes the stored terms → providerGarden derived · other pending rows Superseded", cite: "CS:733" },
  { f: "W25@accepted", hot: null, surface: "pwa", echo: true, st: "Accepted", ev: "Leila sees Awka Hub accepted as the provider — her garden made the promise", cite: "CS:577-589" },
  { f: "W12", hot: { h: "w12.confirm-row", l: "confirmations queue" }, ev: "the protocol confirmations queue mirrors the Hub Confirm grammar", cite: "WF:417" },
  { f: "W10@garden-ready", hot: null, st: "ReadyForConfirmation", ev: "the protocol stewards verify it — the providing garden is excluded from confirming its own promise", cite: "UX:318 · CS:743", br: [{ l: "Where the G$ goes next", to: "sb19:0" }] },
]},
// The other end of the same rail (register #96): the protocol pool making its
// own asks and offers to gardens. Full coverage: seed here → claim in sb13 →
// accept in sb46 → pay in sb19.
{ id: "sb49", n: 49, title: "Seed a protocol promise for gardens", persona: "Protocol steward", scen: "S14 · protocol seeding", reviewVisible: true, reviewGroup: "admin", chapter: "ggops", roles: ["green-goods-team"], steps: [
  { f: "W12", hot: { h: "w12.seed", l: "Seed a protocol promise" }, who: "protocol steward", st: "Protocol pool Open", ev: "the protocol pool makes its own asks and offers to gardens — seeding starts in the Community workspace", cite: "UX §6.8" },
  { f: "W12@seed-protocol", hot: { h: "w12.seed-confirm", l: "Seed this protocol promise" }, who: "protocol steward", st: "Prefilled review", ev: "a protocol request for garden-provided service — kind, unit, target, and steward-reviewed claim mode arrive prefilled (register #19); protocol stewards are the ordinary confirmers", cite: "CS:577 · UX:311" },
  { f: "W12", hot: null, st: "Published", ev: "the seeded promise joins the protocol rows, claimable by eligible garden stewards for their gardens", cite: "CS:577-589", br: [{ l: "A garden claims it", to: "sb13:0" }] },
]},
// The money leg: a provider garden turns declared support into one conserved
// plan, then pays the credited contributors from its own Safe.
{ id: "sb19", n: 19, title: "Pay a garden team from its Safe", persona: "Garden steward", scen: "S14 · settlement", reviewVisible: true, reviewGroup: "admin", chapter: "settlement", roles: ["steward"], steps: [
  { f: "W21@gate-status", hot: null, st: "gate enabled", ev: "member delivery is enabled and the route is registered — the precondition for queueing anything at all", cite: "SS §3.1" },
  { f: "W10@garden-ready", hot: { h: "w10.garden-confirm", l: "Confirm — promise kept" }, st: "ReadyForConfirmation", ev: "confirmFulfillment by a named protocol steward; no reason is stored on the ordinary path", cite: "CS:743" },
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
  { f: "W21@protocol-funding-queued", hot: null, st: "Funding · ProtocolToGarden · Queued", ev: "the emitted row has no commitment ID and cannot be mistaken for an earned contributor reward", cite: "SS §3.1.3" },
  { f: "W2@garden-support-arrived", hot: null, surface: "pwa", echo: true, marks: ["w2.reward-row"], st: "Partial / Complete", ev: "each member sees their own recognition and payout child while the garden-retained amount stays explicit", cite: "SS §5" },
]},
// The public surface has its own reader: a neighbour or funder who never signs
// in. This flow walks what they can see as a pool matures — and the moment the
// small-community threshold flips counts into a rate.
{ id: "sb15", n: 15, title: "Follow a garden's promises from the public site", persona: "Neighbour or funder (signed out)", scen: "S11 · editorial", reviewVisible: true, reviewGroup: "editorial", chapter: "public-story", roles: ["public"], steps: [
  { f: "W15@pre-launch", hot: null, st: "pool NotReady", ev: "readiness copy only — a garden preparing its pool publishes no numbers", cite: "UX:352 · UX:57" },
  { f: "W15", hot: null, marks: ["w15.counts"], st: "below threshold", ev: "counts-only sentences: promises made and kept, with the cycle's calm end date — no rate yet", cite: "UX:350 · UX:364" },
  { f: "W15@above-threshold", hot: null, marks: ["w15.rate"], st: "above threshold", ev: "at 5+ due promises across 3+ promisers the kept-rate becomes publishable — the one sanctioned percentage; cancelled and under-review records never appear individually", cite: "UX:364-371", br: [{ l: "The protocol-wide story", to: "sb48:0" }] },
  { f: "W1", hot: null, surface: "pwa", echo: true, ev: "the same pool, now joinable — the public story and the member surface are one system", cite: "UX:120" },
]},
// The /impact page's own short walk, split from sb15 (2026-08-10) so the
// editorial tab reads as two honest stories: one garden, then the protocol.
{ id: "sb48", n: 48, title: "See protocol-wide impact", persona: "Neighbour or funder (signed out)", scen: "S11 · editorial", reviewVisible: true, reviewGroup: "editorial", chapter: "public-story", roles: ["public"], steps: [
  { f: "W16@band", hot: null, marks: ["w16.see-gardens"], st: "protocol aggregate", ev: "the impact page carries the same story protocol-wide, and links back to the gardens rather than ranking them", cite: "UX:373-375" },
  { f: "W16@pipeline-delta", hot: { h: "w16.install", l: "Install the app" }, marks: ["w16.pipeline"], ev: "the evidence pipeline gains Promise and Confirmation stages; the install CTA is the reader's way in", cite: "UX:375" },
  { f: "W1", hot: null, surface: "pwa", echo: true, ev: "the same pool, now joinable — the public story and the member surface are one system", cite: "UX:120" },
]},
{ id: "sb16", n: 16, title: "Withdraw your offer before anyone takes it up", persona: "Gardener (Maria)", scen: "S1 edge · MF-2a", reviewVisible: true, reviewGroup: "client", chapter: "change", roles: ["gardener"], steps: [
  { f: "W2@offered", hot: { h: "w2.withdraw", l: "Withdraw this offer" }, who: "Maria", st: "Offered", ev: "the creator may withdraw right up until someone takes it up (MF-2a, register #34b)", cite: "UX:144" },
  { f: "W2@withdraw-confirm", hot: { h: "w2.withdraw-send", l: "Withdraw this offer" }, who: "Maria", st: "Reason required", ev: "cancelCommitment(commitmentId, reasonCID) — no units were committed pre-acceptance, so nothing is released", cite: "CS:145" },
  { f: "W2@withdrawn", hot: null, who: "Maria", st: "Cancelled (creator)", ev: "the timeline names the member as the actor and carries the reason — distinct from a steward cancellation, which has its own record", cite: "CS:145 · UX:93", br: [{ l: "The steward's cancellation instead", to: "sb17:3" }] },
]},
{ id: "sb17", n: 17, title: "Recover a promise that stalled", persona: "Steward (David)", scen: "S5 · steward recovery", reviewVisible: true, reviewGroup: "admin", chapter: "promises", roles: ["steward"], steps: [
  { f: "W10@accepted", hot: { h: "w10.mark-override", l: "Mark ready…" }, who: "David", st: "Accepted · evidence in", ev: "evidence is in but the recipient cannot confirm — override, cancel, and send-for-confirmation are the three exits, each with its own consequence", cite: "UX:294" },
  { f: "W10@mark-ready-override", hot: { h: "w10.override-confirm", l: "Mark ready" }, who: "David", st: "Reason required", ev: "markReadyForConfirmation(commitmentId, reason) — steward-only, separate from Send for confirmation, and the reason is stored", cite: "UX:294" },
  { f: "W2@support-ready-confirmer", hot: null, surface: "pwa", echo: true, st: "ReadyForConfirmation", ev: "the member sees the same service promise move to Ready with the steward's record visible in the timeline", cite: "UX:301" },
  { f: "W10@cancel", hot: { h: "w10.cancel-confirm", l: "Cancel promise" }, who: "David", st: "Cancel — confirm", ev: "variant: cancelCommitment on an Accepted promise — steward-only, reason required, and the committed units release", cite: "CS:745" },
  { f: "W2@support-cancelled", hot: null, surface: "pwa", echo: true, st: "Cancelled", ev: "the member reads the recorded reason on the same service promise — never “cancelled” alone", cite: "UX:93" },
  { f: "W10", hot: { h: "w10.raise", l: "Raise dispute…" }, who: "David", st: "Ready", ev: "variant: on a Ready promise the steward's remaining acts are fallback confirmation and raising a review", cite: "UX:300" },
  { f: "W10@raise-dispute", hot: { h: "w10.dispute-confirm", l: "Raise dispute" }, who: "David", st: "Reason required", ev: "raiseDispute stores preDisputeState so any resolution can restore it exactly", cite: "CS:143" },
  { f: "W2@disputed", hot: null, surface: "pwa", echo: true, st: "Disputed", ev: "the member ceiling is “under review by stewards” — the word dispute never reaches them", cite: "UX:95", br: [{ l: "How it resolves", to: "sb5:3" }] },
]},
{ id: "sb18", n: 18, title: "Find every promise waiting on you", persona: "Gardener across gardens", scen: "S6 · wallet drawer", reviewVisible: true, reviewGroup: "client", chapter: "money", roles: ["gardener"], steps: [
  { f: "W5", hot: { h: "w5.inbox-row", l: "Open the promise waiting on you" }, marks: ["w5.summary"], st: "Commitments tab", ev: "the wallet drawer is the one cross-garden home: a summary line, the promises waiting on YOUR confirmation, then your own promises folded behind their count", cite: "UX:179-190" },
  { f: "W4", hot: { h: "w4.confirm", l: "Confirm — promise kept" }, alts: [{ h: "w4.not-yet", l: "Not yet → steward review", to: "sb5:0" }], st: "ReadyForConfirmation", ev: "the inbox row opens the same confirmation sheet the promise itself opens — the provider stays excluded", cite: "UX:185 · CS:139" },
  { f: "W4@confirmed-pending", hot: null, st: "Pending local sync", ev: "the drawer flow also keeps the fulfillment result behind sync completion", cite: "UX:169,221" },
  { f: "W4@confirmed", hot: { h: "w4.done", l: "Back to the pool" }, st: "Fulfilled", ev: "the quiet result appears once after sync", cite: "UX:197-204" },
  { f: "W2@fulfilled", hot: null, marks: ["w2.reward-row"], st: "Fulfilled", ev: "the promise is kept and the drawer's waiting count drops by one", cite: "UX:197-199" },
  { f: "W5@queued", hot: null, st: "Queued (local)", ev: "queued promises ride the same drawer with the offline chrome", cite: "UX:190" },
  { f: "W5@waiting-membership", hot: null, st: "waiting_for_hat", ev: "rows waiting on garden membership consume no send attempts and resume when the membership lands", cite: "LAP:191", br: [{ l: "Before your first promise", to: "screen:W5@empty" }] },
]},
{ id: "sb20", n: 20, title: "Open a campaign beside the season", persona: "Steward (David)", scen: "S5 · concurrent campaign", reviewVisible: true, reviewGroup: "admin", chapter: "season", roles: ["steward"], steps: [
  { f: "W7@manage", hot: { h: "w7.open-cycle-flow", l: "Open cycle" }, st: "Pool Open · campaign Seeded", ev: "the lifecycle view opens the campaign-specific allocation path", cite: "UX:66 · CS:114" },
  { f: "W11@campaign-allocation", hot: { h: "w11.campaign-continue", l: "Continue" }, st: "Allocation set", ev: "the six-class campaign allocation totals exactly 100%", cite: "UX:322-330" },
  { f: "W11@campaign-open", hot: { h: "w11.campaign-open-cycle", l: "Open campaign" }, st: "Pool already Open", ev: "openCycle starts only Seedling swap; it does not reopen or otherwise mutate the pool", cite: "CS:114" },
  { f: "W7", hot: null, st: "Campaign Open", ev: "the campaign returns alongside the still-open Season", cite: "UX:66" },
]},
{ id: "sb21", n: 21, title: "Move from Community to this garden's pool", persona: "Protocol steward", scen: "S14 · workspace handoff", reviewVisible: true, reviewGroup: "admin", chapter: "ggops", roles: ["green-goods-team"], steps: [
  { f: "W12", hot: { h: "w12.tab-garden", l: "This garden" }, st: "Protocol pool", ev: "the Community workspace narrows from protocol scope to the selected garden", cite: "UX:314" },
  { f: "W12@current-garden", hot: { h: "w12.open-garden-pool", l: "Open garden pool" }, st: "Rocinha summary", ev: "the summary offers one direct handoff to the full Garden Pool workspace", cite: "UX:314" },
  { f: "W7", hot: null, st: "Pool Open", ev: "Rocinha's triage-first Pool view opens", cite: "UX:261" },
]},
// Regrown 2026-08-10 (register #96): the baseline is the pool's starting
// record — its own assessment story, ending at the readiness checklist it
// satisfies, not folded into work approval.
{ id: "sb22", n: 22, title: "Record the pool's baseline", persona: "Evaluator + steward", scen: "S4 · assessment entry", reviewVisible: true, reviewGroup: "admin", chapter: "assess", roles: ["evaluator", "steward"], steps: [
  { f: "W13@assess", hot: { h: "w13.new-assessment", l: "Create assessment" }, st: "Assess stage", ev: "the existing Hub stage opens the extended assessment flow", cite: "UX:257" },
  { f: "W14@baseline", hot: null, marks: ["w14.kind"], st: "Baseline", ev: "cycle and assessment kind are explicit — the Baseline is the pool's starting record, made before any promise, and the evidence and scoring steps continue on the existing rails", cite: "CS:760-761" },
  { f: "W7@preflight-complete", hot: null, st: "Readiness · baseline satisfied", ev: "the qualifying baseline completes the pool's readiness checklist beside the charter and provider cap", cite: "UX:298", br: [{ l: "Mark the pool ready and open the season", to: "sb9a:2" }] },
]},
{ id: "sb23", n: 23, title: "Register an existing garden settlement account", persona: "Settlement steward", scen: "S8 · account setup", reviewVisible: true, reviewGroup: "admin", chapter: "settlement", roles: ["steward"], steps: [
  { f: "W21@unregistered", hot: { h: "w21.setup", l: "Register existing account" }, st: "Unregistered", ev: "the empty settlement section leads with the one available next action", cite: "SS:169" },
  { f: "W21@register-account", hot: { h: "w21.register-confirm", l: "Register account" }, st: "Verified route", ev: "registerSettlementAccount stores the already-deployed Celo Safe after governance verification", cite: "SS:169" },
  { f: "W21@registered", hot: { h: "w21.open-queue", l: "Open disbursement queue" }, st: "Registered", ev: "the result names the Safe, recovery policy, and scoped executor role", cite: "SS:169" },
  { f: "W21", hot: null, st: "Queue available", ev: "the ordinary settlement queue is now reachable", cite: "SS §3.1" },
]},
{ id: "sb24", n: 24, title: "Check command transport and its route gate", persona: "Protocol deployer", scen: "S8/S9 · execution readiness", reviewVisible: true, reviewGroup: "admin", chapter: "ggops", roles: ["green-goods-team"], steps: [
  { f: "W24", hot: { h: "w24.tab-ccip", l: "CCIP" }, st: "Cross-garden queue", ev: "Operations opens on actionable queued deliveries", cite: "SS §3" },
  { f: "W24@ccip", hot: { h: "w24.tab-queue", l: "Queue" }, st: "Transport health", ev: "native reserves, peers, and acknowledgment deferrals stay distinct from payment state", cite: "SS §4" },
  { f: "W24", hot: { h: "w24.execute", l: "Dispatch" }, st: "Queued", ev: "the selected row opens its command console", cite: "SS §3" },
  { f: "W22", hot: { h: "w22.route-gate", l: "Open route gate" }, st: "Queued batch", ev: "the settlement steward inspects production authority before dispatch", cite: "SS §6" },
  { f: "W22@role-guard", hot: null, st: "Route gate", ev: "scoped executor role, no Safe ownership, canonical selectors, and caps remain explicit release evidence", cite: "SS §6" },
]},
{ id: "sb25", n: 25, title: "Recover or cancel one settlement delivery", persona: "Settlement steward", scen: "S8 · member recovery", reviewVisible: true, reviewGroup: "admin", chapter: "settlement", roles: ["steward"], steps: [
  { f: "W22@outcome", hot: { h: "w22.requeue-member", l: "Source follow-up" }, st: "Authenticated failure", ev: "only a bounded failure acknowledgment unlocks a new logical attempt", cite: "SS:182" },
  { f: "W21@requeue-confirm", hot: { h: "w21.requeue-confirm", l: "Requeue attempt" }, st: "Failed", ev: "the confirmation names the preserved attempt, cleared batch, incremented attempt, and that the new key waits for dispatch", cite: "SS:182" },
  { f: "W21@requeued", hot: { h: "w21.open-queue", l: "Back to queue" }, st: "Queued · attempt 2", ev: "the new attempt is visible beside its immutable failed predecessor; dispatch, not requeue, creates its execution key", cite: "SS:182" },
  { f: "W21", hot: { h: "w21.cancel-disb", l: "Cancel queued delivery" }, st: "Queued · unbatched", ev: "individual cancellation is offered only before dispatch while batchId is zero", cite: "SS §3.1.3" },
  { f: "W21@cancel-queued-confirm", hot: { h: "w21.cancel-queued-confirm", l: "Cancel delivery" }, st: "Reason required", ev: "cancelDisbursement stores the reason and changes only settlement 104", cite: "SS §3.1.3" },
  { f: "W21@cancelled-queued", hot: null, st: "Cancelled from Queued", ev: "the outcome confirms that no command or batch was created", cite: "SS §3.1.3" },
]},
{ id: "sb26", n: 26, title: "Wait for readiness, then start the pool's first promise", persona: "Gardener", scen: "S1 · participation gates", reviewVisible: true, reviewGroup: "client", chapter: "make", roles: ["gardener"], steps: [
  { f: "W1@not-ready", hot: null, st: "Pool NotReady", ev: "members see what the stewards still need to prepare and no participation controls", cite: "UX:57" },
  { f: "W1@ready", hot: null, st: "Pool Ready", ev: "readiness is visible, but offers and requests remain unavailable until the pool opens", cite: "UX:58" },
  { f: "W1@empty-open", hot: { h: "w1.offer", l: "Offer support" }, skipTargetReason: "the template picker opens first (sb36 walks it); this flow continues at the blank form", st: "Pool Open · no promises", ev: "the empty state leads with the first legal participation act instead of a dead end", cite: "UX:127" },
  { f: "W3", hot: null, st: "Offer draft", ev: "the ordinary offer flow opens with the pool and season scope intact", cite: "UX:154" },
]},
{ id: "sb27", n: 27, title: "Open a campaign while no Season is running", persona: "Gardener", scen: "S1 · campaign-only window", reviewVisible: true, reviewGroup: "client", chapter: "make", roles: ["gardener"], steps: [
  { f: "W1@no-season", hot: { h: "w1.campaign-market", l: "Open Market rides" }, st: "No Season", ev: "Season participation pauses without hiding independently open Campaigns", cite: "UX:127" },
  { f: "W1@campaign-market", hot: { h: "w1.take-up-campaign-request", l: "I can help" }, st: "Campaign Open", ev: "the campaign exposes its own legal request action and keeps Market rides as the scope", cite: "UX:127 · CS:133" },
  { f: "W2@campaign-request-active", hot: null, marks: ["w2.details"], st: "Accepted", ev: "the claimed request still names Market rides in Details and continues on its campaign-scoped evidence-only path", cite: "UX:154" },
]},
{ id: "sb28", n: 28, title: "Confirm a promise while its Season is under review", persona: "Gardener (João)", scen: "S1 · review window", reviewVisible: true, reviewGroup: "client", chapter: "keep", roles: ["gardener"], steps: [
  { f: "W1@reviewing", hot: { h: "w1.open-reviewing-promise", l: "Review confirmation" }, st: "Season Reviewing", ev: "new participation is closed, but a Ready promise keeps its legal confirmation path", cite: "UX:74" },
  { f: "W2@ready-confirmer", hot: { h: "w2.confirm", l: "Confirm: promise kept" }, st: "ReadyForConfirmation", ev: "the selected promise still names the eligible confirmer and excludes its provider", cite: "CS:139" },
  { f: "W4", hot: { h: "w4.confirm", l: "Confirm — promise kept" }, st: "ReadyForConfirmation", ev: "confirmation remains legal during review and queues through the normal sync boundary", cite: "UX:74 · CS:139" },
  { f: "W4@confirmed-pending", hot: null, st: "Pending local sync", ev: "the review window does not permit fulfillment copy before the confirmation syncs", cite: "UX:169" },
  { f: "W4@confirmed", hot: { h: "w4.done", l: "Back to the pool" }, st: "Fulfilled", ev: "the result appears only after the confirmation reaches the contract", cite: "UX:197" },
  { f: "W2@fulfilled", hot: null, st: "Fulfilled", ev: "the same promise returns with its kept state and reward rail", cite: "UX:197" },
]},
// Split 2026-08-10: Maria's service offer runs start-to-finish as her own acts;
// João's take-up and confirmation land as read-only beats. The acted service
// confirmation stays walkable in sb30 and in the W4 service cast states.
{ id: "sb29", n: 29, title: "Offer a service and prove it with evidence", persona: "Gardener (Maria)", scen: "S1 · SupportService offer", reviewVisible: true, reviewGroup: "client", chapter: "make", roles: ["gardener"], steps: [
  { f: "W1", hot: { h: "w1.offer", l: "Offer support" }, who: "Maria", st: "Pool Open", ev: "the member starts an offer in the ordinary pool creation flow", cite: "UX:150", skipTargetReason: "the template picker opens first (sb36 walks it); this service-offer story continues at the blank form" },
  { f: "W3", hot: { h: "w3.choose-support", l: "Support / service" }, who: "Maria", st: "Kind selection", ev: "the evidence-only kind is selected directly; no garden-action anchors are introduced", cite: "UX:154" },
  { f: "W3@support-howmuch", hot: { h: "w3.continue-support-howmuch", l: "Continue to review" }, who: "Maria", st: "Amount and Campaign", ev: "Maria sets one repair session in Tool library and goes straight to review — three steps for a service offer; who-confirms is already the recipient with the pilot fallback behind them", cite: "UX:155 · UX §5.4" },
  { f: "W3@support-review", hot: { h: "w3.submit-support", l: "Make this offer" }, who: "Maria", st: "SupportService review", ev: "the commitment job is saved locally with the service offer and campaign scope", cite: "UX:157" },
  { f: "W1@support-queued", hot: null, marks: ["w1.queued-card"], who: "Maria", st: "Queued (local)", ev: "the optimistic service card stays visible in its pool scope until CommitmentCreated syncs", cite: "UX:157" },
  { f: "W2@support-accepted", hot: { h: "w2.add-evidence-support", l: "Add evidence" }, who: "Maria", st: "Offered → Accepted", ev: "João takes it up — Maria cannot claim her own offer, and claiming alone does not derive Active; evidence is the provider's next legal act", cite: "CS:143 · CS:855 · CS:138b" },
  { f: "W2a@compose-support", hot: { h: "w2a.attach-support", l: "Attach evidence" }, who: "Maria", st: "Evidence draft", ev: "the photo, link, or note queues on the ordinary offline evidence rail", cite: "CS:739" },
  { f: "W2@support-evidence-queued", hot: null, who: "Maria", st: "Evidence queued (local)", ev: "the evidence row is visible with queued chrome; confirmation stays unavailable before EvidenceAttached syncs", cite: "UX:218" },
  { f: "W2@support-evidence-submitted", hot: { h: "w2.send-confirmation", l: "Send for confirmation" }, who: "Maria", st: "EvidenceSubmitted", ev: "the evidence-only call advances to ReadyForConfirmation without a work gate", cite: "CS:741" },
  { f: "W2@support-ready-pending", hot: null, who: "Maria", st: "Readiness queued (local)", ev: "the service remains EvidenceSubmitted until readiness reaches the contract", cite: "UX:169,221" },
  { f: "W2@support-ready-confirmer", hot: null, st: "ReadyForConfirmation", ev: "done — now it waits on João, the named recipient", cite: "CS:139", br: [{ l: "João's confirmation — same path, service cast", to: "screen:W4@confirm-support" }] },
  { f: "W2@support-fulfilled", hot: null, st: "Fulfilled", ev: "João confirmed — the same service offer returns as kept", cite: "UX:197" },
]},
{ id: "sb30", n: 30, title: "Finish a campaign promise while that Campaign is reviewing", persona: "Gardener (João)", scen: "S1 · campaign review", reviewVisible: true, reviewGroup: "client", chapter: "keep", roles: ["gardener"], steps: [
  { f: "W1@no-season", hot: { h: "w1.campaign-tools", l: "Open Tool library" }, st: "No Season · Campaign Reviewing", ev: "the member can still open a reviewing Campaign even when no Season is running", cite: "UX:127" },
  { f: "W1@campaign-tools", hot: { h: "w1.open-tools-promise", l: "Review confirmation" }, st: "Campaign Reviewing", ev: "new participation is closed, while evidence and confirmation remain available", cite: "UX:74" },
  { f: "W4@confirm-support", hot: { h: "w4.confirm-support", l: "Confirm — promise kept" }, st: "ReadyForConfirmation", ev: "the legal confirmation acts on the campaign-scoped service promise", cite: "CS:139" },
  { f: "W4@confirmed-pending-support", hot: null, st: "Pending local sync", ev: "the Campaign count does not change before sync", cite: "UX:169" },
  { f: "W4@confirmed-support", hot: { h: "w4.done-support", l: "Back to the pool" }, st: "Fulfilled", ev: "the kept result updates the Campaign, not a nonexistent Season", cite: "UX:197" },
  { f: "W2@support-fulfilled", hot: null, st: "Fulfilled", ev: "the service promise keeps its Tool library campaign context", cite: "UX:127" },
]},
{ id: "sb31", n: 31, title: "Cancel an immutable queued batch", persona: "Settlement steward", scen: "S8 · batch recovery", reviewVisible: true, reviewGroup: "admin", chapter: "settlement", roles: ["steward"], steps: [
  { f: "W22", hot: { h: "w22.cancel-batch", l: "Cancel whole batch" }, st: "Queued batch", ev: "the only destructive option applies to the entire immutable member set", cite: "SS §3.1.3" },
  { f: "W22@cancel-batch-confirm", hot: { h: "w22.cancel-batch-confirm", l: "Cancel batch" }, st: "Reason required", ev: "the confirmation names both members and the atomic blast radius before cancelBatch", cite: "SS §3.1.3" },
  { f: "W21@batch-cancelled", hot: null, st: "Cancelled from Queued", ev: "the result preserves the two-member snapshot and recorded reason", cite: "SS §3.1.3" },
]},
{ id: "sb32", n: 32, title: "Wind down a season while its pool stays paused", persona: "Steward (David)", scen: "S5 · paused wind-down", reviewVisible: true, reviewGroup: "admin", chapter: "season", roles: ["steward"], steps: [
  { f: "W7@paused", hot: { h: "w7.close-season-paused", l: "Close season" }, alts: [{ h: "w7.cancel-cycle-paused", l: "or cancel with a reason", to: "sb32:6" }], st: "Pool Paused · cycle Reviewing", ev: "opens the close wizard without resuming participation or reconciling before review", cite: "CS:111,128" },
  { f: "W26@paused-review", hot: { h: "w26.paused-continue-shares", l: "Close cycle and continue" }, st: "Pool Paused · terminal set", ev: "closeCycle locks the exact bundle as Reconciled while the pool remains Paused", cite: "UX:60,75" },
  { f: "W26@paused-shares", hot: { h: "w26.paused-continue-certificate", l: "Continue to certificate" }, st: "Pool Paused · cycle Reconciled", ev: "the locked six-role allocation is read without reopening participation", cite: "UX:75" },
  { f: "W26@paused-certificate", hot: { h: "w26.paused-mint", l: "Mint impact certificate" }, st: "Pool Paused · cycle Reconciled", ev: "certificate minting uses the closed commitment set and changes no lifecycle state", cite: "CS §9" },
  { f: "W26@paused-rest", hot: { h: "w26.paused-compost", l: "Compost closed cycle" }, st: "Pool Paused · cycle Reconciled", ev: "compostCycle advances only the already-closed cycle to Composted", cite: "CS:128-129" },
  { f: "W7@paused-cycle-composted", hot: null, st: "Pool Paused · cycle Composted", ev: "the result offers only legal pool-level next acts: resume or close", cite: "CS:111-112" },
  { f: "W7@paused", hot: { h: "w7.cancel-cycle-paused", l: "Cancel season…" }, st: "Variant rewind · Pool Paused · cycle Open", ev: "the cancel variant starts from the same paused open season and does not imply a resume", cite: "CS:130", note: "This variant rewinds to the paused open season shown at the start of the chapter." },
  { f: "W7@paused-cancel-cycle-confirm", hot: { h: "w7.cancel-cycle-paused-confirm", l: "Cancel season" }, st: "Pool Paused · reason required", ev: "cancelCycle changes only the cycle and stores the member-visible reason", cite: "CS:130 · UX:77" },
  { f: "W1@paused-cancelled-cycle", hot: null, surface: "pwa", echo: true, st: "Pool Paused · cycle Cancelled", ev: "members see both truths together: the season was cancelled and the pool remains paused", cite: "UX:60,77" },
]},
{ id: "sb33", n: 33, title: "Recognize and pay a commitment team", persona: "Steward (David)", scen: "S1 · group commitment", reviewVisible: true, reviewGroup: "admin", chapter: "recognition", roles: ["steward"], steps: [
  { f: "W10@fulfilled", hot: { h: "w10.allocate-contributors", l: "Set recognition and payment" }, st: "Fulfilled · payment unplanned", ev: "the group promise is kept — roster frozen, recognition previewed on the member side; the steward opens payment planning without changing the recognition record", cite: "SS group-settlement amendment", br: [{ l: "How the team formed", to: "sb45:0" }] },
  { f: "W10@contributor-allocation", hot: { h: "w10.save-contributor-allocation", l: "Create draft" }, st: "Draft payout plan", ev: "createCommitmentPayoutPlan persists the stable canonical default, then opens the separate recoverable amount edit", cite: "SS §3" },
  { f: "W21@payout-plan-edit", hot: { h: "w21.edit-save", l: "Save complete draft" }, st: "Draft parent plan · edited", ev: "setContributorPayouts publishes a replacement Draft snapshot against the stable parent pointer", cite: "SS §3" },
  { f: "W21@payout-plan", hot: { h: "w21.finalize-plan", l: "Finalize payout plan" }, st: "Draft parent plan", ev: "the steward verifies recognition/payment hashes and retained-plus-payout conservation before freezing the plan", cite: "SS §3" },
  { f: "W21@payout-finalized", hot: { h: "w21.prepare-payout", l: "Prepare one child payout" }, st: "Finalized parent plan · no children", ev: "the steward materializes one immutable queued child from a frozen non-zero row; finalization itself created none", cite: "SS §3" },
  { f: "W21@payout-prepared", hot: { h: "w21.dispatch-plan", l: "Dispatch one child payout" }, st: "Prepared child · Queued", ev: "the garden Safe can now dispatch this contributor's separate child delivery while the parent pointer remains stable", cite: "SS §3" },
  { f: "W22@individual-dispatched", hot: null, st: "Individual · dispatched", ev: "the contributor command carries only the finalized child facts and retries through retryCommand; the parent pointer remains stable", cite: "SS §3" },
  { f: "W21@payout-partial", hot: null, st: "Partial · 2 of 3 arrived", ev: "one failed child never reverses fulfillment, recognition, or successful contributor receipts", cite: "SS §3" },
  { f: "W23@contributor-receipt", hot: null, surface: "pwa", echo: true, st: "Contributor payout arrived", ev: "the member receipt distinguishes Hypercert recognition from the garden-funded payment", cite: "UX Appendix C" },
]},
// The team's own story, split from sb33 (2026-08-10): joining an open team,
// the freeze, and the recognition preview — all on the member surface.
{ id: "sb45", n: 45, title: "Form the team behind a promise", persona: "Contributor (João) + lead (Maria)", scen: "S1 · group commitment", reviewVisible: true, reviewGroup: "client", chapter: "keep", roles: ["gardener"], steps: [
  { f: "W2b@open-eligible", hot: { h: "w2b.join", l: "Join this promise" }, who: "João", st: "Accepted · open team", ev: "the team is open to eligible garden members — joining is one tap, an online contract action that never awards credit by itself", cite: "UX Appendix C.1" },
  { f: "W2b@join-submitted", hot: null, who: "João", st: "Waiting for roster", ev: "the wallet confirmed; membership renders only after the fresh indexed roster contains the account", cite: "UX Appendix C.1" },
  { f: "W2b@open-member", hot: null, who: "João", st: "Contributor", alts: [{ h: "w2b.leave", l: "or leave before credit", to: "screen:W2b@open-eligible" }], ev: "roster confirmed — João is on the team; approved work and evidence will decide who is credited", cite: "UX Appendix C.1" },
  { f: "W2b@frozen", hot: { h: "w2b.preview", l: "Preview recognition" }, st: "Roster frozen", ev: "the roster froze atomically when the promise entered Ready — one accountable lead, every credited contributor visible", cite: "CS §8" },
  { f: "W2b@recognition", hot: null, st: "Recognition preview", ev: "the Hypercert gardener class gives the commitment an equal budget, then applies the selected cycle's immutable 35% equal / 65% verified fixture policy", cite: "CS §8", br: [{ l: "No eligible contributor → W26 blocks; no lead fallback", to: "screen:W26@recognition-blocked" }, { l: "Recognition and payment, steward side", to: "sb33:0" }] },
]},
// The other money leg: treasury support that is deliberately NOT a reward. It
// shares the transport queue with contributor payouts and nothing else.
{ id: "sb34", n: 34, title: "Seed or top up a garden outside a commitment", persona: "Protocol steward / module owner", scen: "S9 · discretionary treasury support", reviewVisible: true, reviewGroup: "admin", chapter: "ggops", roles: ["green-goods-team"], steps: [
  { f: "W24@flows", hot: { h: "w24.queue-funding", l: "Seed / top up" }, ev: "the funds board separates commitment-earned contributor payout plans from an explicitly authorized non-commitment treasury action", cite: "register #69 · SS §3.1.3" },
  { f: "W24@funding", hot: { h: "w24.queue-funding-confirm", l: "Queue seed / top up" }, st: "Explicit treasury review", ev: "queueFunding derives the GG protocol Safe, selected registered garden Safe, and canonical G$; it carries no commitmentId and grants no agent or keeper value authority", cite: "SS §3.1.3 · AM §2" },
  { f: "W21@protocol-funding-queued", hot: null, st: "Queued funding", ev: "the resulting row has no commitment ID, shares the transport queue, and remains typed as Funding rather than a commitment reward", cite: "SS §3.1.2" },
]},
{ id: "sb14", n: 14, title: "Turn a neighbor's need into a seeded promise", persona: "Neighbour (Kwame) + steward", scen: "S10 · September", reviewVisible: false, reviewGroup: "admin", chapter: "promises", roles: ["steward"], steps: [
  { f: "C3", hot: { m: "What is your community trying to solve?", l: "Describe the problem by voice or text" }, who: "Kwame", surface: "community", ev: "kind-free Need · words captured by voice or typing · Request/Offer belongs to commitment seeding", cite: "CI-WF:96" },
  { f: "C4", hot: { m: "[Share with my garden]", l: "Share with my garden" }, surface: "community", marks: ["Waiting for garden membership. No send"], ev: "offline-queueable Need — may wait for membership without consuming sends", cite: "CI-WF:150" },
  { f: "C1", hot: { m: "[Support]", l: "neighbors Support" }, surface: "community", ev: "latest directional signal wins; support and non-support remain separate; board orders by recency + status, never funding", cite: "CI-SPEC §6/§8" },
  { f: "C5", hot: null, surface: "community", ev: "the neighbor opens the need thread before steward moderation", cite: "CI-WF:165" },
  { f: "C9", hot: { m: "[Acknowledge]", l: "Acknowledge" }, who: "David", ev: "typed moderation — moderation and progress are separate axes", cite: "CI-SPEC:267" },
  { f: "C9", hot: { m: "[Seed a commitment]", l: "Seed a commitment" }, ev: "opens the seed-from-Need form", cite: "CI-WF:307" },
  { f: "C10", hot: { m: "[Review commitment]", l: "Review commitment" }, ev: "needUID linked read-only · every suggested field steward-confirmed · unreachable-threshold error before acceptance", cite: "CI-WF:340" },
  { f: "C5", hot: null, surface: "community", marks: ["✓ Promise: 16 market rides this season"], ev: "the thread: neighbor's words → promise → work → proof · funding supports the garden, never escrow", cite: "CI-WF:165" },
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
{ id: "sb37", n: 37, title: "Save offer details, then offer it over time", persona: "Gardener (Maria)", scen: "S15 · ongoing Offer creation", reviewVisible: true, reviewGroup: "client", chapter: "series", roles: ["gardener"], steps: [
  { f: "W32@empty", hot: { h: "w32.add-first" }, who: "Maria", st: "Nothing saved yet", ev: "the personal surface starts empty and asks for nothing; saved details carry no obligation and no pool state" },
  { f: "W32@compose", hot: { h: "w32.save", l: "Save privately" }, who: "Maria", st: "Details draft", ev: "captures what she is offering, one line about it, and the unit; saving is signed offchain, never a contract call" },
  { f: "W32@saving", hot: null, who: "Maria", st: "Saving remotely", ev: "the local draft remains visible while the owner-authenticated service request is in flight; the UI does not claim cross-device durability yet" },
  { f: "W32@saved", hot: { h: "w32.use-saved", l: "Use these details" }, who: "Maria", st: "Details saved (private)", ev: "the newly saved list contains only private reusable metadata: no garden, pool state, ongoing Offer, or availability has been fabricated", br: [{ l: "Saving and drafts", to: "sb38:0" }] },
  { f: "W32@choose-path", hot: { h: "w32.offer-over-time", l: "Offer it over time" }, who: "Maria", st: "Details saved (private)", ev: "the two paths are named once, in one place: offer it once as an ordinary promise, or offer it over time in one garden", br: [{ l: "Offer once — prefilled ordinary Offer", to: "screen:W3@saved-offer-edit" }] },
  { f: "W33@garden", hot: { h: "w33.continue-garden", l: "Continue" }, who: "Maria", st: "Pool Ready or Open", ev: "the ongoing Offer binds to exactly one garden; offering the same thing elsewhere becomes a separate series with its own history" },
  { f: "W33@terms", hot: { h: "w33.continue-terms", l: "Continue" }, who: "Maria", st: "Series draft (local)", ev: "series metadata only — what people receive and the unit label; places, counts, and cycle scope belong to the instances created later" },
  { f: "W33@review", hot: { h: "w33.create", l: "Start offering over time" }, who: "Maria", st: "Series draft (local)", ev: "queues createCommitmentSeries; the caller becomes immutable creator and initial current holder" },
  { f: "W33@queued", hot: null, who: "Maria", st: "Queued", ev: "no availability exists yet — a series that has not synced is not Active, and nothing is claimable" },
  { f: "W34@active-none", hot: { h: "w34.add-places", l: "Add places" }, who: "Maria", st: "Series Active · 0 places", ev: "sync → CommitmentSeriesCreated · the ongoing Offer exists with nothing open, which is a real and honest state" },
  { f: "W35@compose", hot: { h: "w35.submit", l: "Add 2 places" }, who: "Maria", st: "Series Active", ev: "a finite batch: each place becomes one ordinary Offer instance repeating the current terms" },
  { f: "W35@queued", hot: null, who: "Maria", st: "Queued", ev: "places are not shown as available until each creation has synced and reserved its provider slot" },
  { f: "W34@active-two", hot: null, who: "Maria", st: "Series Active · 2 places", ev: "each place registers its class and commits the full quota at creation, so two displayed places are two genuinely reserved promises" },
]},

{ id: "sb38", n: 38, title: "Keep a local draft, then offer over time offline", persona: "Gardener (Maria) with no signal", scen: "S15 · persistence and dependent drafts", reviewVisible: true, reviewGroup: "client", chapter: "series", roles: ["gardener"], steps: [
  { f: "W32@draft-unsaved", hot: { h: "w32.persistence", l: "How saving works" }, who: "Maria", st: "Draft on this device", ev: "an unsaved draft is honest about its limit: it lives in this browser only" },
  { f: "W32@persistence", hot: { h: "w32.persistence-done", l: "Got it" }, who: "Maria", ev: "distinguishes saved privately, saving, failed, offline local, version conflict, and offered in a garden without calling any of them onchain" },
  { f: "W32@draft-unsaved", hot: { h: "w32.save-draft", l: "Save privately" }, who: "Maria", st: "Draft on this device", ev: "starts an authenticated remote save but does not label the draft Saved" },
  { f: "W32@saving", hot: null, who: "Maria", st: "Saving remotely", ev: "the request cannot complete with no signal; the device copy remains authoritative for this moment" },
  { f: "W32@offline-local", hot: { h: "w32.use-local-offline", l: "Use this draft" }, who: "Maria", st: "Offline · local only", ev: "the failed network path stays visibly unsaved and makes no cross-device claim; Maria may still use the local details" },
  { f: "W32@choose-path", hot: { h: "w32.offer-over-time", l: "Offer it over time" }, who: "Maria", st: "Local details", ev: "using a local draft for an Offer does not retroactively make the metadata remotely saved" },
  { f: "W33@garden", hot: { h: "w33.continue-garden", l: "Continue" }, who: "Maria", st: "Pool selected from cache", ev: "the series still binds to one selected garden" },
  { f: "W33@terms", hot: { h: "w33.continue-terms", l: "Continue" }, who: "Maria", st: "Series draft (local)", ev: "the series payload is prepared locally" },
  { f: "W33@review", hot: { h: "w33.create", l: "Start offering over time" }, who: "Maria", st: "Series draft (local)", ev: "queues the series call with its persisted sender-safe request key" },
  { f: "W33@queued", hot: null, who: "Maria", st: "Series queued", ev: "the ongoing Offer is queued while offline; it is not Active and shows no availability" },
  { f: "W33@place-waiting", hot: null, who: "Maria", st: "Place draft waiting", ev: "a place drafted before its series exists waits on explicit queue state — it consumes no retry budget and never guesses transaction order" },
  { f: "W34@active-two", hot: null, who: "Maria", st: "Series Active · 2 places", ev: "after the series receipt is indexed the dependent places submit as ordinary commitments; discarding the series instead would keep the place drafts recoverable" },
]},

{ id: "sb39", n: 39, title: "Take up one place that is already open", persona: "Recipient (João)", scen: "S15 · claim accepts a pre-created place", reviewVisible: true, reviewGroup: "client", chapter: "take-up", roles: ["gardener"], steps: [
  { f: "W34@claimant-view", hot: { h: "w34.claim", l: "Take up one place" }, who: "João", st: "2 places Offered", ev: "another member sees the ongoing Offer, its approved pool context, and two available places; Maria's personal Story and kept count remain private to her and current stewards" },
  { f: "W2@support-accepted", hot: null, who: "João", st: "Accepted", ev: "the claim ACCEPTS one existing Offered service instance: no new place is created, the provider slot reserved at creation is not consumed a second time, and Active waits for WorkLinked or EvidenceAttached" },
  { f: "W34@active-one", hot: null, who: "Maria", st: "Series Active · 1 place", ev: "availability drops from two to one because one real instance left the Offered set; the series itself did not transition" },
]},

{ id: "sb40", n: 40, title: "See what an ongoing Offer has become", persona: "Gardener (Maria)", scen: "S15 · Story and pool participation history", reviewVisible: true, reviewGroup: "client", chapter: "series", roles: ["gardener"], steps: [
  { f: "W34@active-two", hot: { h: "w34.open-story", l: "See the whole story" }, who: "Maria", st: "Series Active", ev: "the detail groups records without rewriting them" },
  { f: "W34@story", hot: { h: "w34.story-row", l: "Open one kept promise" }, who: "Maria", ev: "kept 12 times across 5 cycles is exact and event-derived; withdrawn, ran-out, and reviewed-then-kept records stay visible as records rather than penalties" },
  { f: "W2@fulfilled", hot: null, who: "Maria", st: "Fulfilled", ev: "every story row is an ordinary immutable commitment with its own evidence and confirmation" },
  { f: "W34@participation", hot: null, who: "Maria", ev: "the series Story and the member's pool participation history are drawn as two clearly separate views; a reported participant count is labelled as coming from evidence, never presented as protocol data" },
  { f: "W34@ask-again", hot: { h: "w34.ask-again-not-now", l: "Not this season" }, who: "Maria", st: "New cycle open", ev: "the default posture is ask me again next cycle — the protocol creates no obligation on a schedule" },
  { f: "W34@active-none", hot: null, who: "Maria", st: "Series Active · 0 places", ev: "declining creates nothing and changes neither this offer nor its story" },
]},

{ id: "sb41", n: 41, title: "Rest it, resume it, retire it", persona: "Gardener (Maria)", scen: "S15 · lifecycle without erasure", reviewVisible: true, reviewGroup: "client", chapter: "series", roles: ["gardener"], steps: [
  { f: "W34@active-two", hot: { h: "w34.succession", l: "Sharing and handing on — later" }, who: "Maria", st: "Series Active", ev: "the labelled horizon opens a read-only later preview; none of the future actions is presented as an available control" },
  { f: "W34@succession", hot: null, who: "Maria", ev: "co-holding, teaching alongside, handing on, starting a linked offer, and garden-held stewardship are drawn as clearly labelled later work; the initial contract exposes rest, resume, and retire only" },
  { f: "W34@active-two", hot: { h: "w34.rest", l: "Rest it for now" }, who: "Maria", st: "Series Active", ev: "restCommitmentSeries blocks new places" },
  { f: "W34@resting", hot: { h: "w34.resume", l: "Start offering again" }, who: "Maria", st: "Series Resting · 2 places still Offered", ev: "resting blocks new places only; both already-reserved places remain claimable and the story stays whole" },
  { f: "W34@active-two", hot: null, who: "Maria", st: "Series Active · 2 places", ev: "resuming returns the series to Active without changing or recreating either existing place" },
  { f: "W34@retire-confirm", hot: { h: "w34.retire-confirm", l: "Retire it" }, who: "Maria", st: "Series Active", ev: "the confirmation names the terminal effect and takes no reason, because retireCommitmentSeries has no reason parameter" },
  { f: "W34@retired", hot: null, who: "Maria", st: "Series Retired", ev: "terminal: promises already made keep their state and history, the story remains readable, and Maria's saved details stay privately stored" },
]},
];
