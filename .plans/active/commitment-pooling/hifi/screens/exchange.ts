// W28–W31 — the bilateral exchange and template-first set (uiux Appendix E,
// wireframes §W28–W31, contract-spec §5.3). Drawn 2026-08-10 (register #97):
// the contracts audit found acceptExchange shipped and tested on-chain, so the
// exchange wave graduates from planned source material to the hi-fi registry.
// "Both start together" ends at acceptance — after ExchangeAccepted the two
// promises are ordinary independent commitments and no drawing here may imply
// coupling beyond the pair context.
import { hot } from "../html";
import { icon } from "../icons";
import {
  actionBar, banner, btn, card, chip, field, hdr, input, kv, listRow, pagepad, phoneFrame,
  sectionTitle, sheetOver,
} from "../kit";
import type { HifiDef } from "./index";

// ---------------------------------------------------------------------------
// W28 — exchange picker inside creation (Appendix E.1)
// ---------------------------------------------------------------------------

const W28_STATES = [
  ["picker", "Choose an Offer"], ["selected", "Selected — you give · you receive"],
  ["selection-invalid", "Selection became invalid"],
  ["empty", "No eligible Offers"], ["loading", "Loading"], ["read-error", "Read error"],
] as const;
type W28State = (typeof W28_STATES)[number][0];

const w28Head = `<div class="hdr fixed"><button type="button" class="hback" aria-label="Close — preview only" disabled>${icon("close-line", "l")}</button><h1>Offer in exchange</h1></div>`;

const w28Rows = () => card(
  listRow({ icon: "seedling-line", primary: "Seedling delivery · 12 trays", meta: "Offer · by Ana · Apr 18" }) +
    hot("w28.pick-childcare", listRow({ icon: "group-line", primary: "Childcare during the work party · 6 hours", meta: "Offer · by Ana", chipHtml: chip("Offered", "offer") })) +
    listRow({ icon: "settings-line", primary: "Tool repair · 2 sessions", meta: "Offer · by João · Apr 22" }),
  { cls: "flat" },
);

function w28(state: W28State): string {
  let content: string;
  let actions: string;
  switch (state) {
    case "selected":
      content = pagepad(
        sectionTitle("What you give"),
        field("Title", input("Repair the shared water pump")),
        sectionTitle("How much"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("repairs", "ok")}${chip("hours")}${chip("sessions")}${chip("other…")}</div>`,
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("1", "ok")}${chip("2")}${chip("custom…")}</div>`,
        field("Due", input("Runs with the season · through Aug 30", { select: true })),
        `<div class="t-meta">Every field the template filled stays editable until you make the offer.</div>`,
        card(`${kv("You receive", "Childcare during the work party · 6 hours")}${kv("Pair rule", "Both promises start together; each is kept on its own")}`),
        `<div class="t-meta">The exchange reference travels with your Offer. Ana still chooses to start both — nothing is committed for her here.</div>`,
      );
      actions = `${hot("w28.submit", btn("Make this offer in exchange", { kind: "pri", full: true }))}${hot("w28.clear", btn("Clear the selection", { kind: "ghost", full: true, sm: true }))}`;
      break;
    case "selection-invalid":
      content = pagepad(
        banner("Ana's Offer changed before yours was recorded — no promise was created. Clear the selection or choose another Offer.", "amber", "error-warning-line"),
        w28Rows(),
      );
      actions = `${hot("w28.clear", btn("Clear and choose again", { kind: "pri", full: true }))}`;
      break;
    case "empty":
      content = pagepad(
        banner("No eligible Offers right now. An exchange can only reference a same-pool Offer that is still open, individually claimable, free of any price, and made by someone else.", "stone", "information-line"),
      );
      actions = hot("w28.clear", btn("Back to the ordinary offer", { kind: "ghost", full: true }));
      break;
    case "loading":
      content = pagepad(`<div class="sk flat"><div class="skbar t"></div><div class="skbar"></div><div class="skbar sm"></div></div>`);
      actions = btn("Use this offer", { kind: "pri", full: true, disabled: true });
      break;
    case "read-error":
      content = pagepad(banner("Could not load this pool's Offers. Your draft is kept — retry when connected.", "amber", "error-warning-line"));
      actions = hot("w28.retry", btn("Retry", { kind: "pri", full: true }));
      break;
    default:
      content = pagepad(
        `<div class="t-meta">Offer this in exchange for an existing Offer in this pool. Only eligible rows appear: still open, individually claimable, capacity-backed, made by someone else, and free — a priced Offer cannot start an exchange.</div>`,
        card(input("Search offers in this pool…", { placeholder: true, ariaLabel: "Search offers in this pool" }), { cls: "inset" }),
        w28Rows(),
        `<div class="t-meta">Tap an Offer to review the pair — the action below stays off until one is chosen.</div>`,
      );
      actions = `${btn("Use this offer", { kind: "pri", full: true, disabled: true })}${hot("w28.clear", btn("Clear", { kind: "ghost", full: true, sm: true }))}`;
  }
  return phoneFrame(content, { header: w28Head, appBar: actionBar(actions) });
}

const W28_HOTS: HifiDef["hots"] = {
  "w28.pick-childcare": { l: "Choose Ana's Offer", to: "screen:W28@selected", info: "Selecting an eligible same-pool Offer stores it as the draft's counterCommitmentId and enables the Use action. Accepted, lapsed, self-owned, non-Individual, capacity-inconsistent, and priced rows never render — exchange is barter, and a non-zero consideration on either side reverts with ExchangeConsiderationUnsupported. One eligible row is wired in this drawing; every eligible row is selectable in the app (WF:1213 · CS §5.3)." },
  "w28.clear": { l: "Clear the selection", to: "screen:W28", info: "Drops the exchange reference without losing the draft; focus returns to the row (WF:1217)." },
  "w28.submit": { l: "Make this offer in exchange", to: "screen:W1@exchange-queued", info: "createCommitment atomically re-checks every eligibility predicate on Ana's Offer before storing counterCommitmentId — if it changed before mining, no promise is created and the picker returns for a clear-or-replace (WF:1219 · CS §5.3).", calls: ["createCommitment"], facts: { pool: "Open" }, pendingSync: true },
  "w28.retry": { l: "Retry loading Offers", to: "screen:W28", info: "Read-only retry; the draft and any prior selection survive." },
};

// ---------------------------------------------------------------------------
// W29 — exchange pair detail and status (Appendix E.1)
// ---------------------------------------------------------------------------

const W29_STATES = [
  ["proposed", "Proposed"], ["matched", "Matched"], ["counterpart-lapsed", "Counterpart lapsed"],
] as const;
type W29State = (typeof W29_STATES)[number][0];

function w29(state: W29State): string {
  const pairChip = state === "matched" ? chip("Matched", "ok") : state === "counterpart-lapsed" ? chip("Counterpart lapsed", "warn") : chip("Proposed", "plain");
  const pairLine = state === "matched"
    ? "Both promises started together"
    : state === "counterpart-lapsed"
      ? "The other promise ended. This promise keeps its own state."
      : "Proposed in exchange for Childcare during the work party";
  const stateB = state === "proposed" ? "Offered" : "Accepted";
  const stateA = state === "counterpart-lapsed" ? "Expired" : stateB;
  const feed = card(
    `<div class="t-sec">Pool exchange feed</div>` +
      listRow({ icon: "checkbox-circle-fill", primary: state === "proposed" ? "Offered in exchange for" : "Both promises started", meta: state === "proposed" ? "Maria and Ana · Apr 2" : "Ana and Maria · Apr 4" }) +
      listRow({ icon: "hand-heart-line", primary: "Offered in exchange for", meta: "João and Luz · Apr 2" }),
    { cls: "flat" },
  );
  const body = pagepad(
    card(`<div class="cardrow"><div class="grow"><div class="t-title">Exchange pair</div><div class="t-meta">${pairLine}</div></div>${pairChip}</div>`),
    card(`${kv("Maria gives", `Repair the shared water pump · 1 repair · ${stateB}`)}${kv("Ana gives", `Childcare during the work party · 6 hours · ${stateA}`)}`),
    banner("Each promise is kept on its own — the pair context never replaces a promise's ordinary state.", "stone", "information-line"),
    state === "proposed"
      ? hot("w29.accept-cta", btn("Start both promises…", { kind: "pri", full: true }))
      : hot("w29.open-other", btn("Open the other promise", { kind: "sec", full: true })),
    feed,
  );
  return phoneFrame(`${hdr("Repair the shared water pump", { back: true })}${body}`, { appBar: false });
}

const W29_HOTS: HifiDef["hots"] = {
  "w29.accept-cta": { l: "Start both promises…", to: "screen:W30", info: "Visible only to the counterpart Offer's creator (Ana). Opens the accept-exchange confirmation sheet — nothing is committed until she confirms there (WF:1274)." },
  "w29.open-other": { l: "Open the other promise", to: "screen:W2@support-accepted", info: "After acceptance the pair is two ordinary commitments; the other side opens as its own detail with its own recovery paths." },
};

// ---------------------------------------------------------------------------
// W30 — accept-exchange confirmation sheet (Appendix E.1)
// ---------------------------------------------------------------------------

const W30_STATES = [
  ["confirm", "Start both promises?"], ["submitting", "Submitting"], ["contract-error", "Named error"],
] as const;
type W30State = (typeof W30_STATES)[number][0];

function w30(state: W30State): string {
  const base = `${hdr("Repair the shared water pump", { back: true })}${pagepad(card(`${kv("Pair", "Proposed in exchange")}`))}`;
  if (state === "submitting")
    return phoneFrame(
      sheetOver(base, "Starting both promises…", `${banner("One acceptExchange call runs every predicate on both promises. There is no partial optimistic state — the pair either starts together or not at all.", "stone", "loader4-line")}`),
      { appBar: false },
    );
  if (state === "contract-error")
    return phoneFrame(
      sheetOver(base, "That didn't go through", `${banner("Ana's Offer is no longer open, so the pair cannot start — nothing changed on either side. Maria can clear or replace the exchange reference; your Offer is untouched.", "amber", "error-warning-line")}${banner("Every failure here arrives as its own named message: it says which side changed and who acts next, and none offers a retry.", "stone", "information-line")}${hot("w30.back", btn("Back to the pair", { kind: "pri", full: true }))}`),
      { appBar: false },
    );
  return phoneFrame(
    sheetOver(
      base,
      "Start both promises?",
      `<div class="t-body">You'll receive <b>Repair the shared water pump</b>.</div>
<div class="t-body">Maria will receive <b>Childcare during the work party</b>.</div>
<div class="t-meta">Both promises start together; each is kept on its own.</div>
${hot("w30.start", btn("Start both promises", { kind: "pri", full: true }))}${hot("w30.not-now", btn("Not now", { kind: "ghost", full: true }))}`,
    ),
    { appBar: false },
  );
}

const W30_HOTS: HifiDef["hots"] = {
  "w30.start": { l: "Start both promises", to: "screen:W30@submitting", info: "acceptExchange(B) — one call, every A/B predicate re-checked atomically: two CommitmentAccepted events, one creator-lead ContributorAdded per side, and ExchangeAccepted. The sheet holds on Submitting until the transaction lands — Matched renders only from confirmed ExchangeAccepted, never optimistically (CS §5.3).", calls: ["acceptExchange"], facts: { commitment: "Offered", kind: "SupportService" }, pendingSync: true },
  "w30.not-now": { l: "Not now", to: "screen:W29", info: "Dismisses without committing anything; focus returns to the trigger." },
  "w30.back": { l: "Back to the pair", to: "screen:W29", info: "Drawn case: the referenced Offer left Offered before mining (state-invalid family). The full non-retry taxonomy per acceptance-matrix exchange rows: counterpart-mismatch, direction, claim-type, and self-exchange failures return the creator to the pair with the action removed; a StewardCaptured B requires a fresh direct Offer; closed-cycle and register/cap failures name the steward act needed. Each error names who acts next (D25); none offers a retry loop." },
};

// ---------------------------------------------------------------------------
// W31 — Offer-template picker (Appendix E.2)
// ---------------------------------------------------------------------------

const W31_STATES = [["templates", "Templates"]] as const;
type W31State = (typeof W31_STATES)[number][0];

function w31(_state: W31State): string {
  const row = (hid: string | null, icname: string, primary: string, meta: string) => {
    const inner = listRow({ icon: icname, primary, meta });
    return hid ? hot(hid, inner) : inner;
  };
  const body = pagepad(
    `<div class="t-meta">Start from an Offer template — a familiar way this pool works together. Choosing one only prefills the ordinary form; every field stays editable and no template adds a contract type.</div>`,
    card(
      row("w31.rotation", "refresh-line", "Rotation", "Each member takes a turn receiving the pool's help.") +
        row("w31.work-party", "group-line", "Work party", "A group gathers around one shared piece of work.") +
        row("w31.harvest-share", "seedling-line", "Harvest share", "People promise part of a harvest and how it arrives.") +
        row("w31.tool-lending", "settings-line", "Tool lending", "A tool is offered for a named period and purpose.") +
        row("w31.mentorship", "sticky-note-line", "Mentorship circle", "People offer time to learn and practice together.") +
        row("w31.exchange-circle", "send-plane-line", "Exchange circle", "Two people prepare linked offers that start together and are kept separately."),
      { cls: "flat" },
    ),
  );
  return phoneFrame(`${hdr("Create a promise", { back: true })}${body}`, {
    appBar: actionBar(hot("w31.start-blank", btn("Start blank", { kind: "sec", full: true }))),
  });
}

const W31_HOTS: HifiDef["hots"] = {
  "w31.rotation": { l: "Rotation template", to: "screen:W3@step-what", info: "Prefills existing fields only (recurring receiving turns as ordinary commitments) and lands in the editable creation flow — no template adds a contract type (Appendix E.2)." },
  "w31.work-party": { l: "Work party template", to: "screen:W3@step-what", info: "Prefills existing fields only and always lands in the editable creation flow — the submitted record is indistinguishable from hand-entered fields (WF:1310). Locales may rename templates; the primitives stay stable." },
  "w31.harvest-share": { l: "Harvest share template", to: "screen:W3@step-what", info: "Prefills existing fields only (a harvest-portion promise with its delivery note) and lands in the editable creation flow (Appendix E.2)." },
  "w31.tool-lending": { l: "Tool lending template", to: "screen:W3@step-what", info: "Prefills existing fields only (a named tool, period, and purpose) and lands in the editable creation flow (Appendix E.2)." },
  "w31.mentorship": { l: "Mentorship circle template", to: "screen:W3@step-what", info: "Prefills existing fields only (offered practice time) and lands in the editable creation flow (Appendix E.2)." },
  "w31.exchange-circle": { l: "Exchange circle template", to: "screen:W28", info: "The one template that adds an exchange reference: it routes through the W28 picker, whose selected state is the editable mirrored review — every template default stays editable until the offer is made (Appendix E.2)." },
  "w31.start-blank": { l: "Start blank", to: "screen:W3@step-what", info: "Enters the same flow with no hidden defaults (Appendix E.2)." },
};

export const EXCHANGE_DEFS: HifiDef[] = [
  { screen: { id: "W28", title: "W28 · Offer in exchange", surface: "client", frame: "phone", group: "Client PWA", states: W28_STATES.map(([id, label]) => ({ id, label, facts: id === "picker" || id === "selected" ? { pool: "Open", cycle: "Open" } : undefined, html: w28(id) })) }, hots: W28_HOTS },
  { screen: { id: "W29", title: "W29 · Exchange pair", surface: "client", frame: "phone", group: "Client PWA", states: W29_STATES.map(([id, label]) => ({ id, label, facts: { commitment: id === "proposed" ? "Offered" : "Accepted", kind: "SupportService" }, html: w29(id) })) }, hots: W29_HOTS },
  { screen: { id: "W30", title: "W30 · Start both promises", surface: "client", frame: "phone", group: "Client PWA", states: W30_STATES.map(([id, label]) => ({ id, label, facts: { commitment: "Offered", kind: "SupportService" }, html: w30(id) })) }, hots: W30_HOTS },
  { screen: { id: "W31", title: "W31 · Offer templates", surface: "client", frame: "phone", group: "Client PWA", states: W31_STATES.map(([id, label]) => ({ id, label, html: w31(id) })) }, hots: W31_HOTS },
];
