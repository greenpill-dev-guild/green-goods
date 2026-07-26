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
import type { ReviewGroup } from "./types";

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
  reviewVisible: boolean; reviewGroup: ReviewGroup; steps: Scene[];
};

export const SBS: SB[] = [
{ id: "sb1", n: 1, title: "Offer support and see it kept", persona: "Gardener (Maria) + recipient (João)", scen: "S1 · TAS workshop", reviewVisible: true, reviewGroup: "client", steps: [
  { f: "W1", hot: { h: "w1.offer" }, who: "Maria", st: "Pool Open · cycle Open", ev: "routes to /home/:id/pool/new?direction=offer", cite: "WF:79 · UX:120" },
  { f: "W3@step-what", hot: { h: "w3.continue-what", l: "Continue" }, who: "Maria", st: "Draft (local)", ev: "captures direction, kind, cycle scope, title, and note", cite: "UX:150" },
  { f: "W3@step-howmuch", hot: { h: "w3.continue-howmuch", l: "Continue" }, who: "Maria", st: "Draft (local)", ev: "captures unit, amount, and due rule", cite: "UX:151" },
  { f: "W3@step-anchors", hot: { h: "w3.continue-anchors", l: "Continue" }, who: "Maria", st: "Draft (local)", ev: "anchors garden-work promises to the garden's actions", cite: "UX:152" },
  { f: "W3@step-review", hot: { h: "w3.submit", l: "Make this offer" }, who: "Maria", st: "Draft (local)", ev: "commitment job queued · optimistic card + queued badge", cite: "UX:212", br: [{ l: "Offline / retry lanes", to: "sb7:2" }] },
  { f: "W1@queued", hot: null, marks: ["w1.queued-card"], st: "Offered (on-chain)", ev: "sync → CommitmentCreated · SyncStatusBar clears", cite: "CS:132" },
  { f: "W1", hot: { h: "w1.take-up" }, alts: [{ h: "w1.ask-take-up", l: "steward-reviewed variant", to: "sb3a:0" }], who: "João (recipient)", st: "Offered", ev: "claim job → CommitmentAccepted + UnitsCommitted · provider = Maria (Offer creator) · confirmer default = João", cite: "CS:133 · AM:34" },
  { f: "W2", hot: { h: "w2.add-evidence" }, who: "either party", st: "Accepted → Active", ev: "evidence job (W2a photo/note) → EvidenceAttached", cite: "CS:739" },
  { f: "W2a@compose", hot: { h: "w2a.attach", l: "Attach evidence" }, who: "either party", st: "Evidence draft", ev: "compose a photo, link, or note before the upload job is queued", cite: "UX:159" },
  { f: "W2@evidence-submitted", hot: { h: "w2.send-confirmation" }, st: "EvidenceSubmitted", ev: "confirmation{submit} → CommitmentReadyForConfirmation (evidence-only SupportService, count 0)", cite: "UX:141 · CS:138b", mf: true },
  { f: "W4@confirm-support", hot: { h: "w4.confirm", l: "Confirm — promise kept" }, alts: [{ h: "w4.not-yet", l: "Not yet → steward review", to: "sb5:0" }], who: "João", st: "ReadyForConfirmation", ev: "ConfirmationRecorded 1 of 1 → CommitmentFulfilled + UnitsFulfilled", cite: "CS:139", note: "the sheet names the flip: Offer · provider Maria · recipient confirms — provider excluded", br: [{ l: "confirm → Fulfilled, pending sync → hero on sync", to: "screen:W4@confirmed-pending" }] },
  { f: "W2@fulfilled", hot: null, marks: ["w2.reward-row"], st: "Fulfilled", ev: "hero fires once, on sync completion (client only)", cite: "UX:197-199" },
  { f: "W15", hot: null, surface: "editorial", echo: true, marks: ["w15.counts"], st: "aggregate", ev: "the garden's public page ticks — counts-only below the small-community threshold", cite: "UX:350" },
]},
{ id: "sb2", n: 2, title: "Ask for help and confirm it arrived", persona: "Gardener (Ana) + helper (João)", scen: "S2 · evidence-only", reviewVisible: true, reviewGroup: "client", steps: [
  { f: "W1", hot: { h: "w1.request" }, who: "Ana", ev: "routes to /pool/new?direction=request", cite: "WF:79" },
  { f: "W3@request-variant", hot: { h: "w3.submit", l: "Ask for this help" }, who: "Ana", st: "Draft → Requested", ev: "commitment job → CommitmentCreated · anchors step skipped (SupportService)", cite: "UX:153 · WF:199" },
  { f: "W1@queued", hot: null, marks: ["w1.queued-card"], who: "Ana", st: "Queued (local)", ev: "the request stays visible while CommitmentCreated syncs", cite: "UX:212" },
  { f: "W1", hot: { h: "w1.take-up", l: "I can help" }, who: "João", st: "Requested", ev: "claim → CommitmentAccepted · provider = João (claimant) · confirmer = Ana (Request creator)", cite: "UX:85 · AM:34", note: "open-claim Request path; steward-reviewed claims are reviewed separately", skipTargetReason: "the shared control's canonical destination is the offer cast (walked by sb1); this flow continues in the request cast, where the same act belongs to a different promise" },
  { f: "W2@request-active", hot: { h: "w2.add-evidence" }, who: "João", st: "Accepted → Active", ev: "evidence job → EvidenceAttached — the promise stays Ana's request throughout; João is the one providing it", cite: "UX:214", skipTargetReason: "the shared control's canonical destination is the offer cast (walked by sb1); this flow continues in the request cast, where the same act belongs to a different promise", br: [{ l: "upload fails → per-row retry (nothing dropped)", to: "screen:W2a@failed" }] },
  { f: "W2a@compose-request", hot: { h: "w2a.attach", l: "Attach evidence" }, who: "João", st: "Evidence draft", ev: "compose the supporting photo, link, or note", cite: "UX:159", skipTargetReason: "the shared control's canonical destination is the offer cast (walked by sb1); this flow continues in the request cast, where the same act belongs to a different promise" },
  { f: "W2@request-evidence-submitted", hot: { h: "w2.send-confirmation" }, st: "EvidenceSubmitted", ev: "confirmation{submit} → ReadyForConfirmation (creator, counterparty, or steward may send)", cite: "CS:741", mf: true, skipTargetReason: "the shared control's canonical destination is the offer cast (walked by sb1); this flow continues in the request cast, where the same act belongs to a different promise" },
  { f: "W4@confirm-request", hot: { h: "w4.confirm", l: "Confirm — help arrived" }, alts: [{ h: "w4.not-yet", l: "Not yet → steward review", to: "sb5:0" }], who: "Ana (creator)", st: "ReadyForConfirmation", ev: "ConfirmationRecorded → CommitmentFulfilled — the direction reverses here: the claimant provided, the asker confirms", cite: "CS:139 · WF:224", skipTargetReason: "the shared control's canonical destination is the offer cast (walked by sb1); this flow continues in the request cast, where the same act belongs to a different promise" },
  { f: "W2@request-fulfilled", hot: null, st: "Fulfilled", ev: "the request result returns to the member-facing promise — same title, same unit, from ask to kept", cite: "UX:197-199" },
]},
// sb3 was one 13-scene arc crossing PWA and admin. Split at the surface seam:
// the member's asking-and-hearing-back is its own story, and so is the
// steward's decision. Each keeps the other side as condensed echoes.
{ id: "sb3a", n: 3, title: "Ask to take up a promise and hear back", persona: "Gardeners (Ana + João)", scen: "S3 · scarce crew slots", reviewVisible: true, reviewGroup: "client", steps: [
  { f: "W1", hot: { h: "w1.ask-take-up" }, who: "Ana", st: "request Pending", ev: "claim job → ClaimRequested — terms stored: claimant · requestedBy · kind · gardenContext · requestedAt", cite: "CS:133 · UX:99", br: [{ l: "network fails pre-event → ordinary retry, never Declined (UX:108)", to: "screen:W1" }] },
  { f: "W1@claim-pending", hot: null, who: "Ana", st: "Pending", ev: "'Waiting for steward' — no claimant-cancel exists; the commitment stays browseable to others", cite: "WF:112 · UX:103" },
  { f: "W1", hot: { h: "w1.ask-take-up", l: "João asks too" }, who: "João", st: "Pending ×2", ev: "second request row indexed", cite: "DG:684" },
  { f: "W1@claim-pending", hot: null, who: "João", st: "Pending ×2", ev: "João now sees the same waiting-for-steward state", cite: "UX:103" },
  { f: "W7@claim-declined", hot: null, who: "David", surface: "admin", echo: true, st: "Ana declined", ev: "the steward declines Ana's row with a required reason; João's request stays pending and the promise stays claimable", cite: "CS:734 · UX:105", br: [{ l: "Walk the steward's decision", to: "sb3b:0" }] },
  { f: "W1@claim-declined", hot: { h: "w1.ask-again" }, who: "Ana", st: "Declined", ev: "a fresh request record — never a retry of the declined row", cite: "UX:105" },
  { f: "W1@claim-pending", hot: null, who: "Ana", st: "Fresh request pending", ev: "the new request is a separate waiting row", cite: "UX:105" },
  { f: "W7@claim-outcomes", hot: null, who: "David", surface: "admin", echo: true, st: "João accepted", ev: "the steward accepts João; acceptance consumes his stored terms and supersedes every other pending row", cite: "CS:733 · DG:696" },
  { f: "W1@claim-superseded", hot: null, who: "Ana", st: "Superseded", ev: "'Taken up by another provider' — resolution code names the cause; never a sync failure", cite: "UX:106 · DG:706" },
  { f: "W2", hot: null, who: "João", st: "Accepted", ev: "continues to work and evidence", br: [{ l: "Continue with evidence and assessment", to: "sb4a:0" }] },
]},
{ id: "sb3b", n: 3, title: "Decide who takes up a promise", persona: "Steward (David)", scen: "S3 · scarce crew slots", reviewVisible: true, reviewGroup: "admin", steps: [
  { f: "W7@claims", hot: { h: "w7.decline-claim", l: "Decline Ana's row (reason)" }, alts: [{ h: "w7.accept-claim", l: "or accept João now", to: "sb3b:4" }], who: "David", ev: "declineClaim + reason → ClaimDeclined — only Ana's row changes; João stays Pending", cite: "CS:734 · UX:105" },
  { f: "W7@decline-claim-confirm", hot: { h: "w7.decline-claim-confirm", l: "Decline request" }, who: "David", ev: "the confirmation takes the required reason and names what it does not touch — João's request stays pending", cite: "CS:734" },
  { f: "W7@claim-declined", hot: null, who: "David", st: "Ana declined", ev: "the console shows Ana declined while João remains pending", cite: "CS:734" },
  { f: "W1@claim-declined", hot: null, surface: "pwa", echo: true, marks: ["w1.ask-again"], st: "Declined", ev: "Ana reads the recorded reason and may ask afresh — a new request record, never a retry", cite: "UX:105" },
  { f: "W7@claims", hot: { h: "w7.accept-claim", l: "Accept João's row" }, who: "David", ev: "acceptClaim consumes João's stored terms → CommitmentAccepted · every other pending row → Superseded", cite: "CS:733 · DG:696" },
  { f: "W7@claim-outcomes", hot: null, who: "David", st: "Claim outcomes", ev: "the accepted row and superseded alternatives are visible before returning to members", cite: "DG:696" },
  { f: "W1@claim-superseded", hot: null, surface: "pwa", echo: true, st: "Superseded", ev: "the other claimant sees 'taken up by another provider' — the resolution code names the cause", cite: "UX:106 · DG:706" },
]},
{ id: "sb4a", n: 4, title: "Prove the work behind a promise", persona: "Gardener", scen: "S4 · AGRO+EDU", reviewVisible: true, reviewGroup: "client", steps: [
  { f: "W2", hot: { h: "w2.submit-work" }, alts: [{ h: "w2.link-work", l: "or link existing work", to: "sb4a:2" }], who: "provider", st: "Accepted", ev: "deep-links into the existing Garden-tab work flow with commitment context", cite: "UX:174" },
  { f: "WFLOW", hot: { h: "wflow.submit" }, marks: ["wflow.fulfills"], ev: "work job (existing, + meta.commitmentId) → dependent workLink after sync", cite: "UX:174,220", mf: true },
  { f: "W2@active", hot: { h: "w2.link-work", l: "Link existing work (post-hoc alt)" }, st: "Active", ev: "workLink job → WorkLinked", cite: "CS:735" },
  { f: "HUBWORK", hot: null, who: "steward", surface: "admin", echo: true, st: "Approved work counted · 2 of 2", ev: "the garden's stewards approve both works on the existing rails; the assessment is still separately declared", cite: "CS:737 · CS:138a", br: [{ l: "Walk the steward's approvals", to: "sb4b:0" }] },
  { f: "W10@attach-assessment", hot: null, who: "steward or evaluator", surface: "admin", echo: true, ev: "the delta assessment is attested and attached, re-running the auto-Ready check", cite: "CS:740 · UX:287", mf: true },
  { f: "W2@ready-confirmer", hot: null, st: "ReadyForConfirmation", ev: "the named confirmation path is ready", br: [{ l: "Open the confirmation flow", to: "sb1:10" }] },
]},
{ id: "sb4b", n: 4, title: "Approve the work and attach the assessment", persona: "Steward + evaluator (Dr. Chen)", scen: "S4 · AGRO+EDU", reviewVisible: true, reviewGroup: "admin", steps: [
  { f: "HUBWORK", hot: { h: "hub.approve", l: "Approve (existing rails)" }, who: "steward", st: "PartiallyApproved 1 of 2", ev: "WorkApproval attest → onWorkApproved → ApprovedWorkCounted", cite: "CS:737" },
  { f: "HUBWORK", hot: null, who: "steward", st: "Approved work counted · 2 of 2", ev: "the second approval reaches requiredApprovedWorkCount on the same surface — the assessment is still separately declared", cite: "CS:737 · CS:138a" },
  { f: "W14@delta", hot: null, who: "Dr. Chen", marks: ["w14.kind"], ev: "delta assessment attested — extends Create Assessment; delta renders only for Evaluator-hat holders", cite: "WF:447-455" },
  { f: "W10@attach-assessment", hot: { h: "w10.attach", l: "Attach assessment" }, who: "steward or evaluator", ev: "attachAssessment → auto-Ready re-run → CommitmentReadyForConfirmation", cite: "CS:740 · UX:287", mf: true },
  { f: "W2@ready-confirmer", hot: null, surface: "pwa", echo: true, st: "ReadyForConfirmation", ev: "the member's promise is now ready for its named confirmers", cite: "UX:287", br: [{ l: "Open the confirmation flow", to: "sb1:10" }] },
]},
{ id: "sb5", n: 5, title: "Say “not yet” and let the stewards resolve it", persona: "Recipient + steward", scen: "S5", reviewVisible: true, reviewGroup: "client", steps: [
  { f: "W4", hot: { h: "w4.not-yet", l: "Not yet — tell the stewards why" }, who: "confirmer", st: "ReadyForConfirmation", ev: "required reason focuses → online raiseDispute → CommitmentDisputed (preDisputeState stored)", cite: "CS:143 · UX:426", br: [{ l: "tx fails → stays ReadyForConfirmation, inline retry (UX:217)", to: "screen:W4@not-yet-failed" }] },
  { f: "W4@not-yet", hot: { h: "w4.not-yet-send", l: "Send to the stewards" }, who: "confirmer", st: "Reason required", ev: "the member records what still needs doing before the promise enters review", cite: "UX:167" },
  { f: "W2@disputed", hot: null, st: "Disputed", ev: "banner 'under review by stewards' — CTAs frozen; never surfaced publicly", cite: "UX:95" },
  { f: "W10@resolve-dispute", hot: { h: "w10.resolve", l: "Resolve (4 outcomes + reason)" }, who: "David", surface: "admin", echo: true, ev: "resolveDispute — RestorePrevious / Fulfilled / Cancelled / Expired; an Expired prior can never resolve Fulfilled", cite: "CS:144" },
  { f: "W2", hot: null, st: "restored", ev: "RestorePrevious returns the exact stored state — no unit movement — and every resolution reason renders in the member timeline", cite: "LAP:186 · UX:300", note: "register #34b adopted member pre-acceptance withdraw (MF-2a); register #51 locks steward cancel in W10 (MF-2b)" },
]},
{ id: "sb6a", n: 6, title: "Offer again after a promise expires", persona: "Promise owner", scen: "S1/S5 edge", reviewVisible: true, reviewGroup: "client", steps: [
  { f: "W2@expired", hot: null, st: "past due", ev: "expireCommitment is permissionless — admin sweep in August, keeper cron later (register #34d)", cite: "CS:746", br: [{ l: "Stewards re-seed lapsed seeded promises", to: "sb6b:0" }] },
  { f: "W2@expired", hot: { h: "w2.offer-again", l: "Offer again" }, who: "owner", st: "Expired", ev: "units released exactly once · pending claim requests → Superseded (COMMITMENT_EXPIRED)", cite: "CS:142", mf: true },
  { f: "W3@step-what", hot: { h: "w3.continue-what", l: "Continue" }, who: "owner", st: "Prefilled draft", ev: "a fresh promise begins with the expired promise's useful context", cite: "UX:94" },
  { f: "W3@step-howmuch", hot: { h: "w3.continue-howmuch", l: "Continue" }, who: "owner", st: "Prefilled draft", ev: "the owner checks the amount and due rule", cite: "UX:94" },
  { f: "W3@step-anchors", hot: { h: "w3.continue-anchors", l: "Continue" }, who: "owner", st: "Prefilled draft", ev: "the owner checks the action anchors", cite: "UX:94" },
  { f: "W3@step-review", hot: { h: "w3.submit", l: "Make this offer (prefilled)" }, ev: "a fresh commitment — per-cycle renewal re-entry, not a state rewind", cite: "UX:94" },
  { f: "W1@queued", hot: null, marks: ["w1.queued-card"], st: "Queued (local)", ev: "the fresh commitment waits to sync as a new record", cite: "UX:212" },
]},
{ id: "sb6b", n: 6, title: "Re-seed a promise that lapsed", persona: "Steward (David)", scen: "S1/S5 edge", reviewVisible: true, reviewGroup: "admin", steps: [
  { f: "W7@expiry-queue", hot: { h: "w7.reseed", l: "Re-seed" }, who: "David", ev: "lapsed seeded promise re-enters W8 prefilled", cite: "UX:94", mf: true },
  { f: "W8@step1", hot: { h: "w8.continue-scope", l: "Continue" }, who: "David", ev: "checks the seeded promise's type and cycle scope", cite: "UX:94" },
  { f: "W8@step2", hot: { h: "w8.continue-requirements", l: "Continue" }, who: "David", ev: "checks units, target, action requirements, and due rule", cite: "UX:94" },
  { f: "W8@step3", hot: { h: "w8.continue-rule", l: "Continue" }, who: "David", ev: "checks confirmers, threshold, and claim mode", cite: "UX:94" },
  { f: "W8@step4", hot: { h: "w8.continue-reward", l: "Continue" }, who: "David", ev: "checks the declared reward rail and its reference", cite: "UX:94" },
  { f: "W8@step5", hot: { h: "w8.seed", l: "Seed this commitment" }, who: "David", ev: "creates a fresh seeded commitment", cite: "UX:94" },
  { f: "W7", hot: null, who: "David", st: "Open", ev: "the reseeded promise returns to the pool workspace", cite: "UX:94" },
]},
{ id: "sb7", n: 7, title: "Make a promise offline and watch it sync", persona: "Gardener", scen: "S6 · pt-BR proof", reviewVisible: true, reviewGroup: "client", steps: [
  { f: "W3", hot: null, st: "offline mid-flow", ev: "draft persists locally (WorkDraftRecord semantics)", cite: "UX:155" },
  { f: "W3@draft-resume", hot: null, ev: "re-entry offers resume (DraftDialog pattern)", cite: "UX:155" },
  { f: "W1@queued", hot: null, marks: ["w1.queued-card"], st: "queued (optimistic)", ev: "submit offline → queued badge + SyncStatusBar + polite announcement", cite: "UX:237,427" },
  { f: "W1", hot: null, st: "Offered (on-chain)", ev: "connectivity returns → CommitmentCreated · 'N promises synced'", cite: "UX:427" },
  { f: "W1@sync-failed", hot: null, st: "Failed (local)", ev: "5 attempts exhausted → Failed chip · retry / discard · parseContractError", cite: "UX:240", br: [{ l: "Retry re-enters sync", to: "sb7:3" }, { l: "pool read fails → loading / not-found / retry", to: "screen:W1@read-error" }] },
  { f: "W1@waiting-membership", hot: null, st: "waiting_for_hat", ev: "pre-flight membership check — no retries consumed; resumes on membership (register #34c; join-request approval register #35 is the trigger)", cite: "LAP:191", mf: true },
]},
// Condensed from 12 scenes: the member's ordinary evidence-and-confirmation
// path is sb1/sb2's job, so this flow keeps only what capture changes — who
// records the promise, and how a steward confirms when the member cannot.
{ id: "sb8", n: 8, title: "Record a promise for a device-free member", persona: "Steward (David) + member (Kwame)", scen: "S7 · device-free member", reviewVisible: true, reviewGroup: "admin", steps: [
  { f: "W9", hot: { h: "w9.choose", l: "Choose Kwame" }, who: "David", ev: "select the member whose promise is being recorded", cite: "WF:354-357" },
  { f: "W9@capture-kind", hot: { h: "w9.continue", l: "Continue to captured promise" }, who: "David", ev: "capturedFor and capture kind are reviewed; captured confirmations always carry a reason", cite: "WF:354-357" },
  { f: "W8@captured-for", hot: { h: "w8.record", l: "Record it" }, who: "David", ev: "commitment job (OperatorCaptured, onBehalfOf) → CommitmentCreated(creator = member, recordedBy = steward)", cite: "CS:730 · DG:236" },
  { f: "W7", hot: null, who: "David", st: "Open", ev: "the captured promise appears in the admin pool workspace", cite: "UX:437" },
  { f: "W2@captured", hot: null, who: "Kwame", surface: "pwa", echo: true, marks: ["w2.captured-chip"], st: "Offered", ev: "chip: 'recorded by your steward on your behalf' — the promise stays the member's, and follows the ordinary evidence path from here", cite: "WF:138 · UX:437", br: [{ l: "The ordinary evidence path", to: "sb2:4" }] },
  { f: "W10@fallback-confirm", hot: { h: "w10.fallback-confirm", l: "Confirm as fallback (reason)" }, who: "David", ev: "evidence is in but the counterparty cannot confirm: steward fallback with mandatory reason — provider-steward blocked (SelfConfirmation)", cite: "CS:744 · UX:287,301" },
  { f: "W2@fulfilled", hot: null, who: "Kwame", surface: "pwa", echo: true, st: "Fulfilled · steward record", ev: "the member sees the same result with its visible steward marker", cite: "UX:301" },
]},
// Split from one 33-scene ribbon (register: audit 2026-07-24). Each of the three
// covers one stewardship task end to end; the original concatenated readiness,
// seeding, allocation, pause/resume, close, compost and cancel, so a reviewer
// parachuted mid-flow had no chapter to orient against.
{ id: "sb9a", n: 9, title: "Ready the pool and open the season", persona: "Steward (David)", scen: "S5/S13 admin side", reviewVisible: true, reviewGroup: "admin", steps: [
  { f: "W7@not-ready", hot: null, st: "NotReady", ev: "checklist: charter · provider open-commitment cap · qualifying Baseline", cite: "UX:57,269" },
  { f: "W7@not-ready", hot: { h: "w7.edit-charter", l: "Edit charter + set cap" }, ev: "setPoolCharter · setProviderOpenCommitmentCap (required before Ready)", cite: "CS:723,751" },
  { f: "W7@preflight-complete", hot: { h: "w7.mark-ready", l: "Mark pool ready" }, st: "Ready", ev: "markPoolReady records NotReady → Ready; Baseline is the app preflight, charter + non-zero cap are enforced onchain", cite: "CS:724 · UX:269" },
  { f: "W7@ready", hot: { h: "w7.seed-cycle", l: "Seed a cycle" }, alts: [{ h: "w7.open-pool", l: "or open the pool first — the card action (register #34a)", to: "screen:W7" }], st: "Ready", ev: "seeding a cycle is legal while the pool is Ready (CS:566); the flow's open step then carries the Ready-pool guard, which opens the pool with the cycle — the deadlock fix register #34a adopted onto the card", cite: "CS:566 · CS:100", mf: true },
  { f: "W7@seed-cycle", hot: { h: "w7.seed-cycle-confirm", l: "Seed this cycle" }, who: "David", ev: "seedCycle(poolId, cycleType, startTime, endTime, metadataCID) → CycleSeeded — the Season is recorded but not yet open, and no reason is stored", cite: "CS:566" },
  { f: "W1@seeded", hot: null, surface: "pwa", echo: true, st: "Seeded", ev: "members get the read-only “opens soon” preview: the season's promises are visible, offering waits for the open", cite: "UX:63" },
  { f: "W11", hot: { h: "w11.continue", l: "Continue" }, st: "Allocation set", ev: "the six-class share snapshot is set; the shares must total 100%", cite: "CS:114 · UX:322" },
  { f: "W11@guard", hot: { h: "w11.open-cycle", l: "Open pool and cycle" }, st: "Cycle Open", ev: "the Ready-pool guard offers to open the pool with the cycle → openCycle → CycleOpened", cite: "CS:114 · CS:727" },
  { f: "W7", hot: null, who: "David", st: "Cycle Open", ev: "the active cycle returns to the pool workspace", cite: "CS:114" },
  { f: "W1", hot: null, surface: "pwa", echo: true, marks: ["w1.season-card"], ev: "members see the Season card go live · derived InProgress/Reviewing overlays follow activity", cite: "CS:115-117" },
]},
{ id: "sb9b", n: 9, title: "Pause and resume the pool", persona: "Steward (David)", scen: "S5/S13 admin side", reviewVisible: true, reviewGroup: "admin", steps: [
  { f: "W7", hot: { h: "w7.pause", l: "Pause (reason)" }, st: "Paused", ev: "pausePool(reason) — member banner; create/claim/Ready-submit/confirm disabled, recovery stays available", cite: "UX:60" },
  { f: "W7@pause-confirm", hot: { h: "w7.pause-confirm", l: "Pause pool" }, st: "Pause — confirm", ev: "the blast radius (23 members, 7 open promises) and the stored reason are both named before anything pauses", cite: "UX:60 · CS:725" },
  { f: "W7@paused", hot: null, who: "David", st: "Paused", ev: "the admin card holds the indexed pause reason and recovery action", cite: "UX:60" },
  { f: "W1@paused", hot: null, surface: "pwa", echo: true, st: "Paused", ev: "members get a quiet reason banner; creation and confirmation wait while recovery stays available", cite: "UX:60" },
  { f: "W7@paused", hot: { h: "w7.resume", l: "Resume" }, st: "Open", ev: "resumePool clears the indexed reason", cite: "CS:725" },
  { f: "W7", hot: null, who: "David", st: "Open", ev: "the cleared pause state returns to the open pool", cite: "CS:725" },
]},
{ id: "sb9c", n: 9, title: "End a season — close, compost, or cancel", persona: "Steward (David)", scen: "S5/S13 admin side", reviewVisible: true, reviewGroup: "admin", steps: [
  { f: "W7", hot: { h: "w7.close-season", l: "Close Season (reconcile)" }, st: "Reconciled", ev: "closeCycle → CycleClosed — commitments derive Reconciled", cite: "CS:118,140", br: [{ l: "Variant: cancel the season instead", to: "sb9c:10" }] },
  { f: "W26@review", hot: { h: "w26.continue-shares", l: "Continue to shares" }, st: "Review unresolved", ev: "closeout begins by sequencing expired and under-review promises", cite: "UX:75", mf: true },
  { f: "W26@shares", hot: { h: "w26.continue-certificate", l: "Continue to certificate" }, st: "Allocation snapshot", ev: "reads back the six-role share snapshot locked when the cycle opened", cite: "UX:75" },
  { f: "W26@certificate", hot: { h: "w26.mint", l: "Mint impact certificate" }, st: "Certificate", ev: "bundles fulfilled promises with their work, evidence, and lineage", cite: "CS §9" },
  { f: "W26@rest", hot: { h: "w26.compost", l: "Reconcile + compost" }, st: "Composted", ev: "reconciliation report → compostCycle → CycleComposted", cite: "UX:75", mf: true },
  { f: "W7@cycle-composted", hot: { h: "w7.close-pool", l: "Close pool" }, who: "David", st: "All cycles composted", ev: "every cycle — the Season and all three Campaigns — has composted, which is the condition that makes Close pool appear at all (uiux §6.2); seeding the next cycle stays available beside it", cite: "CS:102" },
  { f: "W7@close-pool-confirm", hot: { h: "w7.close-pool-confirm", l: "Close pool" }, who: "David", st: "Close — confirm", ev: "closing ends participation for the pool's 23 members; the confirmation names that blast radius — closePool stores no reason (CS:556)", cite: "CS:102 · CS:556" },
  { f: "W7@pool-closed", hot: null, who: "David", st: "Closed", ev: "the steward console records the closed pool; compost archives it and reopen starts the next era", cite: "CS:102" },
  { f: "W1@closed", hot: null, surface: "pwa", echo: true, st: "Pool closed", ev: "members see the pool closed after its completed cycle; its history stays with the garden", cite: "CS:102" },
  { f: "W1@cycle-summary", hot: null, surface: "pwa", echo: true, ev: "the client cycle summary card and the medium hero fire once", cite: "UX:200", mf: true },
  { f: "W7", hot: { h: "w7.cancel-cycle", l: "variant: Cancel a cycle (reason)" }, ev: "cancelCycle → quiet member banner with reason · pool coda: close → compost → reopen (register #34a)", cite: "UX:77 · CS:104", note: "The variant rewinds to the open season — cancelCycle is legal only from Seeded or Open (CS:117), never after compost or close." },
  { f: "W7@cancel-cycle-confirm", hot: { h: "w7.cancel-cycle-confirm", l: "Cancel season" }, st: "Cancel — confirm", ev: "the season's own counts (8 promises, 5 kept) are named before the cancel, alongside the reason members will read", cite: "UX:77" },
  { f: "W1@cancelled-cycle", hot: null, surface: "pwa", echo: true, st: "Cycle cancelled", ev: "members read the reason without it implying the whole pool failed", cite: "UX:77" },
]},
{ id: "sb10", n: 10, title: "Declare a reward and record its payout", persona: "Steward (David) + gardener", scen: "S13 · July's only rail", reviewVisible: true, reviewGroup: "admin", steps: [
  { f: "W8@step4", hot: null, marks: ["w8.reward"], who: "David", ev: "the external payout record is selected; the declared reward is a reference only and the module never custodies funds", cite: "WF:339 · UX:280" },
  { f: "W2", hot: null, surface: "pwa", echo: true, marks: ["w2.reward-row"], ev: "the member's promise shows the external-reward row: '20 DAI from the garden jar · pending'", cite: "WF:159" },
  { f: "W13", hot: { h: "w13.row", l: "open the confirm row" }, who: "David", st: "ReadyForConfirmation", ev: "Hub Confirm stage — where you are named or fallback-eligible", cite: "WF:433" },
  { f: "W10", hot: null, st: "ReadyForConfirmation", ev: "the promise opens still awaiting its named confirmations — the reward is declared but not yet recordable", cite: "UX:318" },
  { f: "W10@fulfilled", hot: null, st: "Fulfilled", ev: "confirmFulfillment (ordinary named path — provider excluded)", cite: "CS:743" },
  { f: "W10@fulfilled", hot: { h: "w10.record-payout", l: "Record payout" }, ev: "ArbitrumExternal permits AdminConfirmDialog to capture the rail reference → recordRewardPaid → RewardPaid", cite: "CS:749", note: "register #34h — the dry run runs this with a real minimal Cookie Jar withdrawal" },
  { f: "W10@record-payout", hot: { h: "w10.payout-confirm", l: "Record payout" }, st: "Payout confirmation", ev: "the steward reviews the declared reward and records the executed rail reference", cite: "UX:302" },
  { f: "W2@reward-released", hot: null, surface: "pwa", echo: true, marks: ["w2.reward-row"], ev: "the member row flips to 'reward released' — quiet admin confirmation only, celebration already fired client-side", cite: "UX:143,202" },
]},
{ id: "sb11", n: 11, title: "Watch G$ support arrive, then send it on", persona: "Gardener", scen: "S8/S9 · TAS", reviewVisible: true, reviewGroup: "client", steps: [
  { f: "W2@support-queued", hot: null, marks: ["w2.reward-row"], st: "Queued", ev: "reward row: 'support is queued'", cite: "SS §3" },
  { f: "W2@support-en-route", hot: null, marks: ["w2.reward-row"], st: "Dispatched", ev: "reward row: 'support on its way'", cite: "SS §3" },
  { f: "W2@support-delayed", hot: null, marks: ["w2.reward-row"], st: "Dispatched + derived delay", ev: "'support on its way — delivery delayed' without becoming Failed", cite: "SS §3" },
  { f: "W2@support-executed", hot: null, st: "Celo executed", ev: "'confirming arrival' — source remains Dispatched until acknowledgment", cite: "SS §3" },
  { f: "W2@support-confirming", hot: null, st: "Acknowledgment pending", ev: "stored Celo outcome may retry its acknowledgment without moving G$", cite: "SS §4" },
  { f: "W2@support-arrived", hot: null, st: "Confirmed", ev: "'support arrived ↗' + Celo ref — only an authenticated success acknowledgment for the current execution key and attempt can produce it", cite: "SS §3 · AM §1" },
  { f: "W23", hot: { h: "w23.send" }, marks: ["w23.arrived-row"], ev: "online transfer — sponsored gas, never enters the offline queue", cite: "UX:219 · SS:433" },
  { f: "W23@send", hot: { h: "w23.send-submit", l: "Send" }, ev: "wallet-pending → confirmed; failure surfaces inline with retry", cite: "UX:219" },
  { f: "W23@send-pending", hot: null, st: "Wallet pending", ev: "the wallet confirmation remains visible before the balance changes", cite: "UX:219" },
  { f: "W23@balance", hot: null, marks: ["w23.arrived-row"], st: "Confirmed", ev: "the completed send returns to the balance and result surface", cite: "UX:219" },
  { f: "W2@support-failed", hot: null, st: "Failed (disbursement)", ev: "'still arranging support — your promise is recorded' — the commitment stays Fulfilled", cite: "SS:532 · DG:666", br: [{ l: "Steward recovery", to: "sb12:6" }] },
  { f: "W2@support-cancelled-queued", hot: null, st: "Cancelled from Queued", ev: "'support was withdrawn before it was sent' — the promise and its record stay intact", cite: "SS §3.1" },
  { f: "W2@support-cancelled-failed", hot: null, st: "Cancelled from Failed", ev: "'support was closed after delivery could not complete' — failed attempt history remains legible", cite: "SS §3.1" },
  { f: "W23@delivery-blocked", hot: null, st: "delivery blocked", ev: "AA gate failed → no balance or send; Safe-to-Safe garden funding continues · register #34f makes the gate legible admin-side", cite: "SS:425" },
]},
{ id: "sb12", n: 12, title: "Dispatch queued support and close the loop", persona: "Steward + protocol executor", scen: "S8/S9 · pre-broadcast proof", reviewVisible: true, reviewGroup: "admin", steps: [
  { f: "W21", hot: null, st: "Implementation gate", ev: "commitment and funding queue controls stay unavailable until canonical contracts, indexer, and Safe route checks are GREEN", cite: "SS §3" },
  { f: "W10@queue-settlement", hot: { h: "w10.queue-settlement-confirm", l: "Queue disbursement" }, ev: "CeloSettlement snapshots the owning-pool Safe payer, canonical G$ recipient and amount, route, version, and gas limit", cite: "SS §3" },
  { f: "W21", hot: { h: "w21.create-batch", l: "Open command" }, ev: "the queued settlement is eligible for an optional homogeneous batch and immutable execution key", cite: "SS §3" },
  { f: "W22", hot: { h: "w22.dispatch-command", l: "Dispatch command" }, alts: [{ h: "w22.cancel-batch", l: "or cancel the whole batch", to: "screen:W22@cancel-batch-confirm" }], st: "Queued", ev: "dispatch sends versioned data only with zero token amounts; cancelling instead closes the immutable member set atomically — there is no partial member path", cite: "SS §3 · SS §3.1.3" },
  { f: "W22@dispatched", hot: { h: "w22.open-command-explorer", l: "Open command in CCIP Explorer" }, ev: "command ID and destination status stay inspectable", cite: "SS §3" },
  { f: "W22@delivery-delayed", hot: { h: "w22.retry-command", l: "Retry command" }, ev: "derived delay exposes same-key retry and manual-execution guidance without a state mutation", cite: "SS §3" },
  { f: "W22@executed", hot: { h: "w22.retry-acknowledgment", l: "Retry acknowledgment" }, st: "Celo executed / acknowledgment pending", ev: "Celo stores its idempotent outcome before acknowledgment; retry cannot call the route again", cite: "SS §4" },
  { f: "W22@acknowledgment-pending", hot: { h: "w22.retry-acknowledgment-again", l: "Retry acknowledgment" }, st: "Acknowledgment pending", ev: "fee or delivery recovery may resend only the stored acknowledgment", cite: "SS §4" },
  { f: "W22@outcome", hot: null, marks: ["w22.requeue-member"], ev: "authenticated success → Confirmed; authenticated bounded failure → Failed; the steward explicitly requeues or terminally closes that member", cite: "SS §3" },
  { f: "W21@failed-recovery", hot: { h: "w21.cancel-failed", l: "Close failed delivery" }, ev: "Failed → Cancelled preserves the failed attempt and creates no new execution key", cite: "SS §3.1" },
  { f: "W21@close-delivery-confirm", hot: { h: "w21.close-delivery-confirm", l: "Close delivery" }, ev: "the terminal close names what survives it: the failed attempt, its bounded failure code, and no new execution key", cite: "SS §3.1", skipTargetReason: "terminal act of the flow — the resulting Cancelled-from-Failed row is exhaustive queue state, owned by W21@queue rather than replayed as a closing scene" },
]},
{ id: "sb13", n: 13, title: "Claim a protocol promise for your garden", persona: "Garden steward (Leila)", scen: "S14", reviewVisible: true, reviewGroup: "client", steps: [
  { f: "W25", hot: { h: "w25.ask", l: "Ask to take this up" }, who: "Leila", ev: "protocol commitment offers eligible stewards a personal or garden provider context", cite: "UX:129" },
  { f: "W25@context-chooser", hot: { h: "w25.continue", l: "choose “For Awka Hub”, then Continue" }, ev: "Garden claim: claimant = GardenAccount · requestedBy = Leila — the sheet opens on the safer “As myself” default; Leila flips it", cite: "CS:577-589", mf: true },
  { f: "W25@pending", hot: null, st: "Pending", ev: "canonical claimant + requested-by + provider context shown — the garden is the claimant, Leila the requester", cite: "UX:99" },
  { f: "W12", hot: { h: "w12.accept", l: "protocol steward: Accept" }, who: "protocol steward", surface: "admin", echo: true, ev: "accept consumes the stored terms → providerGarden derived · other pending rows Superseded", cite: "CS:733" },
  { f: "W25@accepted", hot: { h: "w25.open-promise", l: "Open the promise" }, who: "Leila", st: "Accepted", ev: "the garden is the provider now: Awka Hub made the promise, Leila remains the requester", cite: "CS:577-589" },
  { f: "W2@garden-provider", hot: null, marks: ["w2.reward-row"], st: "Accepted", ev: "the garden works and proves — EAS recipient = providerGarden; the declared support is bound to the garden, not to Leila", cite: "CS:772 · AM:43", br: [{ l: "Evidence and work run on the ordinary rails", to: "sb4a:0" }] },
  { f: "W12", hot: { h: "w12.confirm-row", l: "confirmations queue" }, surface: "admin", echo: true, ev: "protocol confirmations queue mirrors the Hub Confirm grammar", cite: "WF:417" },
  { f: "W10@garden-ready", hot: null, st: "ReadyForConfirmation", surface: "admin", echo: true, ev: "the protocol stewards verify it — the providing garden is excluded from confirming its own promise", cite: "UX:318 · CS:743", br: [{ l: "Where the G$ goes next", to: "sb19:0" }] },
]},
// The money leg: what a garden-claimed protocol promise actually pays, and to
// whom. Everything else in the artifact pays an individual.
{ id: "sb19", n: 19, title: "Send a garden's G$ to its own Safe", persona: "Protocol steward", scen: "S14 · settlement", reviewVisible: true, reviewGroup: "admin", steps: [
  { f: "W21@gate-status", hot: null, st: "gate enabled", ev: "member delivery is enabled and the route is registered — the precondition for queueing anything at all", cite: "SS §3.1" },
  { f: "W10@garden-ready", hot: { h: "w10.garden-confirm", l: "Confirm — promise kept" }, st: "ReadyForConfirmation", ev: "confirmFulfillment by a named protocol steward; no reason is stored on the ordinary path", cite: "CS:743" },
  { f: "W10@garden-fulfilled", hot: { h: "w10.queue-settlement-garden", l: "Queue disbursement…" }, st: "Fulfilled", ev: "the CeloSettlement rail replaces Record payout — the two rails are exclusive", cite: "AM §2" },
  { f: "W10@queue-settlement-garden", hot: { h: "w10.queue-settlement-garden-confirm", l: "Queue disbursement" }, ev: "payer = the GG protocol Safe (the owning pool); beneficiary = Awka Hub's registered Celo Safe, never its Arbitrum account", cite: "AM:43 · SS:516" },
  { f: "W21@protocol-queue", hot: { h: "w21.dispatch-garden", l: "Dispatch" }, st: "Queued", ev: "the queue shows the garden reward beside a member one — the Kind column is what tells them apart", cite: "SS §3.1" },
  { f: "W22@garden-command", hot: { h: "w22.garden-open-ops", l: "Open Operations" }, st: "Dispatched", ev: "data-only command, zero token amounts; Celo moves the G$ and acknowledges back", cite: "SS §3" },
  { f: "W24@flows", hot: null, marks: ["w24.queue-funding"], st: "Confirmed", ev: "the cross-garden board shows the corridor: GG protocol Safe → garden Safes, with this delivery confirmed; the funding top-up route stays behind its integration gate", cite: "SS:291" },
  { f: "W2@garden-support-arrived", hot: null, surface: "pwa", echo: true, marks: ["w2.reward-row"], st: "Confirmed", ev: "the garden's members see it: the support reached Awka Hub's own account, not a personal wallet", cite: "SS §5" },
]},
// The public surface has its own reader: a neighbour or funder who never signs
// in. This flow walks what they can see as a pool matures — and the moment the
// small-community threshold flips counts into a rate.
{ id: "sb15", n: 15, title: "Follow a garden's promises from the public site", persona: "Neighbour or funder (signed out)", scen: "S11 · editorial", reviewVisible: true, reviewGroup: "editorial", steps: [
  { f: "W15@pre-launch", hot: null, st: "pool NotReady", ev: "readiness copy only — a garden preparing its pool publishes no numbers", cite: "UX:352 · UX:57" },
  { f: "W15", hot: null, marks: ["w15.counts"], st: "below threshold", ev: "counts-only sentences: promises made and kept, with the cycle's calm end date — no rate yet", cite: "UX:350 · UX:364" },
  { f: "W15@above-threshold", hot: null, marks: ["w15.rate"], st: "above threshold", ev: "at 5+ due promises across 3+ promisers the kept-rate becomes publishable — the one sanctioned percentage; cancelled and under-review records never appear individually", cite: "UX:364-371" },
  { f: "W16@band", hot: null, marks: ["w16.see-gardens"], st: "protocol aggregate", ev: "the impact page carries the same story protocol-wide, and links back to the gardens rather than ranking them", cite: "UX:373-375" },
  { f: "W16@pipeline-delta", hot: { h: "w16.install", l: "Install the app" }, marks: ["w16.pipeline"], ev: "the evidence pipeline gains Promise and Confirmation stages; the install CTA is the reader's way in", cite: "UX:375" },
  { f: "W1", hot: null, surface: "pwa", echo: true, ev: "the same pool, now joinable — the public story and the member surface are one system", cite: "UX:120" },
]},
{ id: "sb16", n: 16, title: "Withdraw your offer before anyone takes it up", persona: "Gardener (Maria)", scen: "S1 edge · MF-2a", reviewVisible: true, reviewGroup: "client", steps: [
  { f: "W2@offered", hot: { h: "w2.withdraw", l: "Withdraw this offer" }, who: "Maria", st: "Offered", ev: "the creator may withdraw right up until someone takes it up (MF-2a, register #34b)", cite: "UX:144" },
  { f: "W2@withdraw-confirm", hot: { h: "w2.withdraw-send", l: "Withdraw this offer" }, who: "Maria", st: "Reason required", ev: "cancelCommitment(commitmentId, reasonCID) — no units were committed pre-acceptance, so nothing is released", cite: "CS:145" },
  { f: "W2@withdrawn", hot: null, who: "Maria", st: "Cancelled (creator)", ev: "the timeline names the member as the actor and carries the reason — distinct from a steward cancellation, which has its own record", cite: "CS:145 · UX:93", br: [{ l: "The steward's cancellation instead", to: "sb17:3" }] },
]},
{ id: "sb17", n: 17, title: "Recover a promise that stalled", persona: "Steward (David)", scen: "S5 · steward recovery", reviewVisible: true, reviewGroup: "admin", steps: [
  { f: "W10@accepted", hot: { h: "w10.mark-override", l: "Mark ready…" }, who: "David", st: "Accepted · evidence in", ev: "evidence is in but the recipient cannot confirm — override, cancel, and send-for-confirmation are the three exits, each with its own consequence", cite: "UX:294" },
  { f: "W10@mark-ready-override", hot: { h: "w10.override-confirm", l: "Mark ready" }, who: "David", st: "Reason required", ev: "markReadyForConfirmation(commitmentId, reason) — steward-only, separate from Send for confirmation, and the reason is stored", cite: "UX:294" },
  { f: "W2@ready-confirmer", hot: null, surface: "pwa", echo: true, st: "ReadyForConfirmation", ev: "the member sees it move to Ready with the steward's record visible in the timeline", cite: "UX:301" },
  { f: "W10@cancel", hot: { h: "w10.cancel-confirm", l: "Cancel promise" }, who: "David", st: "Cancel — confirm", ev: "variant: cancelCommitment on an Accepted promise — steward-only, reason required, and the committed units release", cite: "CS:745" },
  { f: "W2@cancelled", hot: null, surface: "pwa", echo: true, st: "Cancelled", ev: "the member reads the recorded reason — never “cancelled” alone", cite: "UX:93" },
  { f: "W10", hot: { h: "w10.raise", l: "Raise dispute…" }, who: "David", st: "Ready", ev: "variant: on a Ready promise the steward's remaining acts are fallback confirmation and raising a review", cite: "UX:300" },
  { f: "W10@raise-dispute", hot: { h: "w10.dispute-confirm", l: "Raise dispute" }, who: "David", st: "Reason required", ev: "raiseDispute stores preDisputeState so any resolution can restore it exactly", cite: "CS:143" },
  { f: "W2@disputed", hot: null, surface: "pwa", echo: true, st: "Disputed", ev: "the member ceiling is “under review by stewards” — the word dispute never reaches them", cite: "UX:95", br: [{ l: "How it resolves", to: "sb5:3" }] },
]},
{ id: "sb18", n: 18, title: "Find every promise waiting on you", persona: "Gardener across gardens", scen: "S6 · wallet drawer", reviewVisible: true, reviewGroup: "client", steps: [
  { f: "W5", hot: { h: "w5.inbox-row", l: "Open the promise waiting on you" }, marks: ["w5.summary"], st: "Commitments tab", ev: "the wallet drawer is the one cross-garden home: a summary line, the promises waiting on YOUR confirmation, then your own promises folded behind their count", cite: "UX:179-190" },
  { f: "W4", hot: { h: "w4.confirm", l: "Confirm — promise kept" }, alts: [{ h: "w4.not-yet", l: "Not yet → steward review", to: "sb5:0" }], st: "ReadyForConfirmation", ev: "the inbox row opens the same confirmation sheet the promise itself opens — the provider stays excluded", cite: "UX:185 · CS:139" },
  { f: "W2@fulfilled", hot: null, marks: ["w2.reward-row"], st: "Fulfilled", ev: "the promise is kept and the drawer's waiting count drops by one", cite: "UX:197-199" },
  { f: "W5@queued", hot: null, st: "Queued (local)", ev: "queued promises ride the same drawer with the offline chrome", cite: "UX:190" },
  { f: "W5@waiting-membership", hot: null, st: "waiting_for_hat", ev: "rows waiting on garden membership consume no send attempts and resume when the membership lands", cite: "LAP:191", br: [{ l: "Before your first promise", to: "screen:W5@empty" }] },
]},
{ id: "sb14", n: 14, title: "Turn a neighbor's need into a seeded promise", persona: "Neighbour (Kwame) + steward", scen: "S10 · September", reviewVisible: false, reviewGroup: "admin", steps: [
  { f: "C3", hot: { m: "What is your community trying to solve?", l: "Describe the problem by voice or text" }, who: "Kwame", surface: "community", ev: "kind-free Need · words captured by voice or typing · Request/Offer belongs to commitment seeding", cite: "CI-WF:96" },
  { f: "C4", hot: { m: "[Share with my garden]", l: "Share with my garden" }, surface: "community", marks: ["Waiting for garden membership. No send"], ev: "offline-queueable Need — may wait for membership without consuming sends", cite: "CI-WF:150" },
  { f: "C1", hot: { m: "[View] [Agree]", l: "neighbors View + Agree" }, surface: "community", ev: "board orders by recency + status, never funding", cite: "CI-SPEC:257" },
  { f: "C5", hot: null, surface: "community", ev: "the neighbor opens the need thread before steward moderation", cite: "CI-WF:165" },
  { f: "C9", hot: { m: "[Acknowledge]", l: "Acknowledge" }, who: "David", ev: "typed moderation — moderation and progress are separate axes", cite: "CI-SPEC:267" },
  { f: "C9", hot: { m: "[Seed a commitment]", l: "Seed a commitment" }, ev: "opens the seed-from-Need form", cite: "CI-WF:307" },
  { f: "C10", hot: { m: "[Review commitment]", l: "Review commitment" }, ev: "needUID linked read-only · every suggested field steward-confirmed · unreachable-threshold error before acceptance", cite: "CI-WF:340" },
  { f: "C5", hot: null, surface: "community", marks: ["✓ Promise: 16 market rides this season"], ev: "the thread: neighbor's words → promise → work → proof · funding supports the garden, never escrow", cite: "CI-WF:165" },
  { f: "C5", hot: { m: "[Add testimony]", l: "author confirm + testimony" }, who: "Kwame", surface: "community", ev: "consumes the shared confirmation/testimony primitives — September-realized (register #34g)", cite: "CI-SPEC:259", note: "membership queue slice stays gated on RESR-64" },
]},
];
