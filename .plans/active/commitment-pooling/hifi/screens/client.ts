// Client PWA hi-fi screens — W1 pool home, W2 commitment detail, W2a evidence
// sheet, W3 creation flow, W4 confirmation sheet. Warm Earth dialect (.sc),
// phone frame. Copy sources: uiux-spec §5 + wireframes.md §2 annotations;
// sample content continues the lo-fi set (Rocinha, Season of First Rains,
// "Prune the north beds", Maria/João/Ana). Progressive-disclosure rules per
// wireframes.md:166: state + next action in the viewport; Timeline / Evidence
// / Work behind disclosures; identifiers behind a single Details disclosure.
// Dissolved lo-fi variants: W1P/W1S → W1@claim-*, MF3 → W2@expired, MF5 →
// W1@waiting-membership, MF6 → W2@evidence-submitted, MF10 → W1@cycle-summary.

import { hot } from "../html";
import { icon } from "../icons";
import {
  appBar, banner, btn, card, chip, disclosure, field, gardenTabs, hdr, hero,
  input, kv, listRow, meter, pagepad, phoneFrame, radio, sectionTitle, seg,
  sheetOver, stateChip, statTiles, stepDots, syncBar, timeline,
} from "../kit";
import type { HifiDef } from "./index";

// ---------------------------------------------------------------------------
// W1 — Pool tab on the garden detail (uiux-spec §5.2)
// ---------------------------------------------------------------------------

const W1_STATES = [
  ["open", "Open"], ["not-ready", "Not ready"], ["ready", "Ready"], ["paused", "Paused"],
  ["closed", "Closed"], ["empty-open", "Empty pool"], ["no-season", "No season"],
  ["queued", "Queued send"], ["sync-failed", "Send failed"], ["waiting-membership", "Waiting for membership"],
  ["cycle-summary", "Season closed"], ["claim-pending", "Claim pending"], ["claim-declined", "Claim declined"],
  ["claim-superseded", "Claim superseded"], ["claim-accepted", "Claim accepted"],
] as const;
type W1State = (typeof W1_STATES)[number][0];

const seasonCard = (opts: { pct?: number; stage?: string } = {}) =>
  card(
    `<div class="cardrow">${hot("w1.season-card", `<div class="grow"><div class="t-title">Season of First Rains</div><div class="t-meta">${opts.stage ?? "Open"} · runs through Aug 30</div></div>`)}${chip("Season", "plain")}</div>` +
      meter(opts.pct ?? 62, { left: "promised units", right: `${opts.pct ?? 62}%` }),
  );

const campaignsBlock = () =>
  sectionTitle("Campaigns", chip("2 open")) +
  card(
    listRow({ icon: "seedling-line", primary: "Market rides", meta: "Campaign · Open", chipHtml: `<span class="ch num">6/16</span>`, chevron: true }) +
      listRow({ icon: "seedling-line", primary: "Tool library", meta: "Campaign · Reviewing", chipHtml: `<span class="ch num">8/8</span>`, chevron: true }),
    { cls: "flat" },
  );

const offerCard = (opts: { queued?: boolean; waiting?: boolean; failed?: boolean } = {}) => {
  const chips = `${chip("Offer", "offer")}${chip("AGRO", "domain")}${opts.queued ? chip("Queued", "queued") : ""}${opts.waiting ? chip("Waiting", "queued") : ""}${opts.failed ? chip("Couldn't send", "err") : ""}`;
  const cta = opts.queued || opts.waiting || opts.failed ? "" : `<div class="brow">${hot("w1.take-up", btn("Take this up", { kind: "sec" }))}</div>`;
  const note = opts.waiting
    ? `<div class="t-meta">Waiting for your garden membership — it will send once you're welcomed in.</div>`
    : opts.failed
      ? `<div class="t-meta">Five send attempts used. You can retry or discard.</div><div class="brow">${btn("Retry", { kind: "sec", sm: true })}${btn("Discard", { kind: "ghost", sm: true })}</div>`
      : `<div class="t-meta">Anyone in this garden may take this up.</div>`;
  const title = opts.queued || opts.waiting || opts.failed ? "Compost workshop" : "Prune the north beds";
  const meta = opts.queued || opts.waiting || opts.failed ? "3 sessions · runs with the season" : "6 hours · due Aug 12";
  return card(`<div class="cardrow">${chips}</div><div class="t-title">${title}</div><div class="t-meta num">${meta}</div>${note}${cta}`);
};

const requestCard = () =>
  card(
    `<div class="cardrow">${chip("Request", "request")}</div><div class="t-title">Ride to the market on Saturday</div><div class="t-meta num">1 ride · runs with the season</div><div class="t-meta">Stewards review who takes this up.</div><div class="brow">${hot("w1.ask-take-up", btn("Ask to take this up", { kind: "sec" }))}</div>`,
  );

const claimCard = (state: W1State) => {
  if (state === "claim-pending")
    return card(
      `<div class="cardrow">${chip("Waiting for steward review", "warn", { dot: true })}</div><div class="t-title">Ride to the market on Saturday</div>${kv("Asked", "Jul 9")}${kv("Provider", "myself")}<div class="t-meta">The request stays open to others while stewards review.</div>`,
    );
  if (state === "claim-declined")
    return card(
      `<div class="cardrow">${chip("Not this time", "plain", { dot: true })}</div><div class="t-title">Ride to the market on Saturday</div><div class="t-meta">Your steward left a note: “provider context — see charter”.</div><div class="brow">${hot("w1.ask-again", btn("Ask again", { kind: "sec" }))}${hot("w1.back-browse", btn("Back to browsing", { kind: "ghost" }))}</div>`,
    );
  if (state === "claim-superseded")
    return card(
      `<div class="cardrow">${chip("Taken up by another provider", "plain", { dot: true })}</div><div class="t-title">Ride to the market on Saturday</div><div class="t-meta">No longer available — this is not a send failure.</div><div class="brow">${hot("w1.back-browse", btn("Back to browsing", { kind: "ghost" }))}</div>`,
    );
  return card(
    `<div class="cardrow">${chip("Accepted", "ok", { dot: true })}</div><div class="t-title">Your request was accepted</div><div class="t-meta">Provider garden: Rocinha.</div><div class="brow">${hot("w1.open-commitment", btn("Open the promise", { kind: "pri" }))}</div>`,
  );
};

function w1(state: W1State): string {
  const head = hdr("Rocinha Community Garden", { back: true });

  if (state === "not-ready") {
    const body = `${head}<div class="gtabs"><button type="button" class="gtab on">Work</button><button type="button" class="gtab">Insights</button><button type="button" class="gtab">Gardeners</button></div>${pagepad(
      banner("This garden hasn't opened a pool yet. When its stewards set one up, a Pool tab appears here.", "stone"),
      card(`<div class="t-title">Work continues as usual</div><div class="t-meta">Submissions, approvals, and assessments are unaffected.</div>`),
    )}<div style="flex:1"></div>${appBar("garden")}`;
    return phoneFrame(body);
  }

  const tabs = gardenTabs("pool");
  let content: string;

  switch (state) {
    case "ready":
      content = pagepad(
        banner("The pool is set up — promises open when your steward opens it.", "stone"),
        card(`<div class="t-title">What this pool holds</div><div class="t-meta">Offers and requests between neighbors, confirmed by the people they're made to.</div>${kv("Charter", "agreed")}${kv("Baseline assessment", "recorded")}`),
      );
      break;
    case "paused":
      content = pagepad(
        banner("Paused by your stewards — “seasonal flooding, back after the rains”. Nothing is lost; promises resume when the pool does.", "amber", "error-warning-line"),
        seasonCard({ stage: "Paused" }),
        offerCard(),
      );
      break;
    case "closed":
      content = pagepad(
        banner("This pool has closed. Its history stays with the garden.", "stone"),
        statTiles([{ n: "23", label: "promises made" }, { n: "19", label: "kept" }]),
      );
      break;
    case "no-season":
      content = pagepad(
        banner("No season is running right now. Campaigns may still open.", "stone"),
        campaignsBlock(),
        `<div class="brow">${hot("w1.offer", btn("Offer support", { kind: "pri", full: true }))}</div>`,
      );
      break;
    case "empty-open":
      content = pagepad(
        seasonCard({ pct: 0 }),
        card(`<div class="t-title">No promises yet</div><div class="t-meta">Start the first one — offer something you can give, or ask for help you need.</div>`),
        `<div class="brow">${hot("w1.offer", btn("Offer support", { kind: "pri" }))}${hot("w1.request", btn("Request help", { kind: "sec" }))}</div>`,
      );
      break;
    case "cycle-summary":
      content = pagepad(
        card(
          `${hero("Season of First Rains — closed", "11 of 14 promises kept · 61 units brought home", "seedling-line")}${kv("Promises kept", "11 of 14")}${kv("Units fulfilled", "61 of 74")}<div class="t-meta" style="text-align:center">Ready for the next season.</div>`,
        ),
        campaignsBlock(),
      );
      break;
    case "queued":
    case "sync-failed":
    case "waiting-membership": {
      const flavor = state === "queued" ? { queued: true } : state === "sync-failed" ? { failed: true } : { waiting: true };
      content = pagepad(
        seasonCard(),
        `<div class="brow">${hot("w1.offer", btn("Offer support", { kind: "pri" }))}${hot("w1.request", btn("Request help", { kind: "sec" }))}</div>`,
        hot("w1.filters", seg(["All", "Offers", "Requests", "Matched", "Mine"], 4)),
        hot("w1.queued-card", offerCard(flavor)),
        offerCard(),
      );
      break;
    }
    case "claim-pending":
    case "claim-declined":
    case "claim-superseded":
    case "claim-accepted":
      content = pagepad(claimCard(state), hot("w1.filters", seg(["All", "Offers", "Requests", "Matched", "Mine"], 0)), offerCard());
      break;
    default: // open
      content = pagepad(
        seasonCard(),
        campaignsBlock(),
        hot("w1.scope", seg(["All current", "Season", "Market rides"], 0)),
        statTiles([{ n: "12", label: "offered" }, { n: "7", label: "fulfilled" }]),
        `<div class="brow">${hot("w1.offer", btn("Offer support", { kind: "pri" }))}${hot("w1.request", btn("Request help", { kind: "sec" }))}</div>`,
        hot("w1.filters", seg(["All", "Offers", "Requests", "Matched", "Mine"], 0)),
        offerCard(),
        requestCard(),
      );
  }

  const sync = state === "queued" ? syncBar("1 promise waiting to send") : state === "sync-failed" ? syncBar("1 item needs attention") : "";
  const offline = state === "queued" || state === "sync-failed";
  return phoneFrame(`${head}${tabs}${content}<div style="flex:1"></div>${sync}${hot("w1.appbar", appBar("garden"))}`, { offline });
}

const W1_HOTS: HifiDef["hots"] = {
  "w1.offer": { l: "Offer support", to: "screen:W3", info: "Starts the creation flow with direction = offer (UX:120). Walked in SB-1." },
  "w1.request": { l: "Request help", to: "screen:W3@request-variant", info: "Creation flow with direction = request. Walked in SB-2." },
  "w1.take-up": { l: "Take this up (open claim)", to: "screen:W2", info: "Open mode: claim job → optimistic Accepted (UX:129). Walked in SB-1." },
  "w1.ask-take-up": { l: "Ask to take this up (steward-reviewed)", to: "screen:W1@claim-pending", info: "Approval-gated: creates a claim request with stored terms; the commitment stays available to others (UX:99). Walked in SB-3." },
  "w1.ask-again": { l: "Ask again", info: "Creates a FRESH request while the commitment is claimable — never retries the declined row (UX:105)." },
  "w1.back-browse": { l: "Back to browsing", to: "screen:W1", info: "Declined/superseded exits return to browse." },
  "w1.open-commitment": { l: "Open the promise", to: "screen:W2", info: "Acceptance names the counterparty / provider garden (UX:104)." },
  "w1.scope": { l: "Scope control", info: "Filters the list; every aggregate names its scope — Season and Campaigns never blur (UX:127)." },
  "w1.filters": { l: "Filter chips", info: "Client-local filter chips (admin AdminFilterChip is admin-only)." },
  "w1.season-card": { l: "Cycle card", info: "Season vs Campaign is always named; derived InProgress/Reviewing overlays follow activity (CS:115-117). Calm dates, never timers." },
  "w1.queued-card": { l: "Queued promise card", info: "Offline-queued job chrome; syncs when connected (UX:237). waiting_for_hat variant consumes no send attempts (#34c)." },
  "w1.appbar": { l: "AppBar", info: "Unchanged three-tab AppBar; the Garden tab is the existing work-submission flow (UX:116)." },
};

// ---------------------------------------------------------------------------
// W2 — Commitment detail (uiux-spec §5.3; hi-fi guidance wireframes.md:166)
// ---------------------------------------------------------------------------

const W2_STATES = [
  ["accepted", "Accepted"], ["offered", "Offered (yours)"], ["requested", "Requested (yours)"],
  ["active", "Active"], ["evidence-submitted", "Evidence in"], ["partially-approved", "Partly approved"],
  ["ready-confirmer", "Ready — confirmer view"], ["fulfilled", "Fulfilled"], ["reward-released", "Reward released"],
  ["support-en-route", "Support on its way"], ["support-reported", "Transfer reported"],
  ["support-checking", "Checking receipt"], ["support-arrived", "Support arrived"], ["support-failed", "Support delayed"],
  ["reconciled", "Reconciled"], ["cancelled", "Cancelled"], ["expired", "Expired"],
  ["disputed", "Under review"], ["captured", "Recorded for you"],
] as const;
type W2State = (typeof W2_STATES)[number][0];

const w2StateChip: Record<W2State, string> = {
  accepted: "Accepted", offered: "Offered", requested: "Requested", active: "Active",
  "evidence-submitted": "Evidence in", "partially-approved": "Partly approved",
  "ready-confirmer": "Ready to confirm", fulfilled: "Fulfilled", "reward-released": "Fulfilled",
  "support-en-route": "Fulfilled", "support-reported": "Fulfilled", "support-checking": "Fulfilled",
  "support-arrived": "Fulfilled", "support-failed": "Fulfilled", reconciled: "Reconciled",
  cancelled: "Cancelled", expired: "Expired", disputed: "Under review", captured: "Accepted",
};

function w2RewardRow(state: W2State): string {
  const line = (label: string, v: string, tone?: "ok" | "warn") =>
    hot(
      "w2.reward-row",
      card(
        `<div class="cardrow"><div class="grow"><div class="t-title" style="font-size:14.5px">Reward</div><div class="t-meta num">20 DAI from the garden jar</div></div>${chip(v, tone ?? "plain", { dot: true })}</div><div class="t-meta">${label}</div>`,
        { cls: "flat" },
      ),
    );
  switch (state) {
    case "reward-released":
      return line("Recorded by your steward — reference only, value moves outside the app.", "Reward released", "ok");
    case "support-en-route":
      return line("Support on its way (G$).", "On its way");
    case "support-reported":
      return line("Transfer reported — awaiting the receipt check.", "Reported");
    case "support-checking":
      return line("Transfer reported — checking the receipt now.", "Checking receipt");
    case "support-arrived":
      return line("Support arrived ↗ — reference in Details.", "Arrived", "ok");
    case "support-failed":
      return line("Still arranging support — your promise is recorded and stays kept.", "Arranging", "warn");
    default:
      return line("Reference only — no value is held by the app.", "Pending");
  }
}

const w2Disclosures = (opts: { evidence?: number; work?: boolean; overrideNote?: boolean } = {}) =>
  disclosure(
    "Timeline",
    "4 moments",
    timeline([
      { label: "Offered", meta: "Maria · Jul 2" },
      { label: "Accepted", meta: "João took this up · Jul 3" },
      { label: "Work linked", meta: "pruning session · Jul 8" },
      opts.overrideNote
        ? { label: "Ready", meta: "steward note", note: "“confirmed on site visit” (steward record)", warn: true }
        : { label: "Ready to confirm", meta: "waiting on João", open: true },
    ]) + `<div class="t-meta">Recorded on Arbitrum · every steward record shows its reason here.</div>`,
  ) +
  disclosure(
    "Evidence",
    `${opts.evidence ?? 2} items`,
    listRow({ icon: "image-line", primary: "North beds after", meta: "Photo · Jul 8" }) +
      listRow({ icon: "sticky-note-line", primary: "“Two beds left for next week”", meta: "Note · Jul 8" }),
  ) +
  (opts.work === false
    ? ""
    : disclosure(
        "Work for this promise",
        "1 approved",
        listRow({ icon: "check-line", primary: "Pruning session", meta: "Approved · Jul 8", chipHtml: chip("Approved", "ok") }),
      )) +
  hot(
    "w2.details",
    disclosure("Details", "ids & records", `${kv("Commitment", "0x8c…41f2")}${kv("Recorded on", "Arbitrum")}${kv("Cycle", "Season of First Rains")}`),
  );

function w2(state: W2State): string {
  const chips = `<div class="cardrow">${chip("Offer", "offer")}${chip("AGRO", "domain")}${stateChip(w2StateChip[state])}</div>`;
  const head = hdr("Prune the north beds", { back: true });
  const meta = `<div class="hsub num">6 hours · due Aug 12 · Season of First Rains</div>`;

  const capturedChip =
    state === "captured"
      ? hot("w2.captured-chip", banner("Recorded by your steward on your behalf. The promise stays yours.", "stone", "hand-heart-line"))
      : "";

  let band: string;
  switch (state) {
    case "offered":
      band =
        card(`<div class="t-title">Your offer is live</div><div class="t-meta">Anyone in this garden may take this up. You can withdraw it until someone does.</div><div class="brow">${hot("w2.withdraw", btn("Withdraw this offer", { kind: "danger" }))}</div>`);
      break;
    case "requested":
      band =
        card(`<div class="t-title">Your request is live</div><div class="t-meta">Stewards review who takes this up. You can withdraw it until it's accepted.</div><div class="brow">${hot("w2.withdraw", btn("Withdraw this request", { kind: "danger" }))}</div>`);
      break;
    case "evidence-submitted":
      band = card(
        `<div class="t-title">Evidence attached: 1 · no work required</div><div class="t-meta">The person this promise was made to confirms it was kept.</div>${hot("w2.send-confirmation", btn("Send for confirmation", { kind: "pri", full: true }))}`,
      );
      break;
    case "partially-approved":
      band = card(`<div class="t-title">Work approvals</div>${meter(50, { left: "approved works", right: "1 of 2" })}<div class="t-meta">One more approval and this promise is ready to confirm.</div>`);
      break;
    case "ready-confirmer":
      band = card(
        `<div class="t-title">Ready to confirm</div><div class="t-meta">You were named to confirm this promise. Maria, who made it, cannot.</div>${hot("w2.confirm", btn("Confirm: promise kept", { kind: "pri", full: true }))}`,
      );
      break;
    case "fulfilled":
      band = card(hero("Promise kept", "Confirmed by João · the season's count just grew", "checkbox-circle-fill"));
      break;
    case "expired":
      band = card(
        `<div class="t-title">This promise ran through Aug 12</div><div class="t-meta">The season moved on — you can offer it again.</div>${hot("w2.offer-again", btn("Offer it again", { kind: "pri", full: true }))}`,
      );
      break;
    case "disputed":
      band = banner("Under review by stewards — actions pause here until they resolve it. Every outcome shows its reason in the timeline.", "amber", "error-warning-line");
      break;
    case "cancelled":
      band = banner("Cancelled — the reason is recorded in the timeline.", "stone");
      break;
    case "reconciled":
      band = banner("This season closed. The promise rolled into the season summary.", "stone", "seedling-line");
      break;
    default:
      band = card(
        `<div class="t-title">Keep the promise moving</div><div class="t-meta">Add evidence as you go, or link the work that fulfills it.</div><div class="brow">${hot("w2.add-evidence", btn("Add evidence", { kind: "pri", icon: "camera-line" }))}${hot("w2.submit-work", btn("Submit work", { kind: "sec" }))}</div>${hot("w2.link-work", btn("Link existing work", { kind: "ghost" }))}`,
      );
  }

  const frozen = state === "disputed";
  const showReward = !["offered", "requested", "cancelled", "expired", "disputed"].includes(state);
  const content = pagepad(
    chips.replace('<div class="cardrow">', '<div class="cardrow" style="padding:0 2px">'),
    capturedChip,
    band,
    frozen ? "" : w2Disclosures({ overrideNote: state === "captured" || state === "fulfilled", work: state !== "evidence-submitted" }),
    showReward ? w2RewardRow(state) : "",
  );

  return phoneFrame(`${head}${meta}${content}<div style="flex:1"></div>${appBar("garden")}`);
}

const W2_HOTS: HifiDef["hots"] = {
  "w2.add-evidence": { l: "Add evidence", to: "screen:W2a", info: "W2a attach sheet: photo / link / note → one evidence job per submit; fully offline (UX:159)." },
  "w2.submit-work": { l: "Submit work for this promise", to: "screen:WFLOW", info: "Deep-links the existing Garden-tab work flow with commitment context (UX:174). DomainImpact only." },
  "w2.link-work": { l: "Link existing work", info: "Picker of your approved/pending works → workLink job (UX:140)." },
  "w2.confirm": { l: "Confirm: promise kept", to: "screen:W4", info: "Visible only to eligible confirmers while ReadyForConfirmation — the provider never sees it (UX:142)." },
  "w2.send-confirmation": { l: "Send for confirmation", to: "screen:W4@confirm-support", info: "Evidence-only kinds; DomainImpact is rejected on-chain (CS:138b). Adopted MF-6." },
  "w2.offer-again": { l: "Offer it again", to: "screen:W3", info: "Per-cycle renewal — a fresh commitment, prefilled (UX:94). Adopted MF-3." },
  "w2.withdraw": { l: "Withdraw (pre-acceptance)", info: "Member pre-acceptance withdraw, adopted MF-2a (#34b). Steward-cancel placement remains open (MF-2b)." },
  "w2.reward-row": { l: "Reward / settlement row", info: "Reference only — no custody (SS:532). When a G$ disbursement exists, settlement status replaces the pending line; “Arrived” always means oracle-verified, never just reported." },
  "w2.captured-chip": { l: "Recorded-for-you chip", info: "Analog capture: the steward is only the recorder; the promise stays the member's (UX:437)." },
  "w2.details": { l: "Details disclosure", info: "Identifiers live behind one Details disclosure; chain vocabulary stays on this engage layer, never on browse cards (UX:436)." },
};

// ---------------------------------------------------------------------------
// W2a — evidence attach sheet (uiux-spec §5.5)
// ---------------------------------------------------------------------------

const w2aBehind = () => `${hdr("Prune the north beds", { back: true })}<div class="hsub num">6 hours · due Aug 12</div>`;

function w2a(state: "compose" | "queued"): string {
  const kinds = hot(
    "w2a.kind",
    `<div class="radio">
${[["camera-line", "Photo", "From your camera or library"], ["link-m", "Link", "A page that shows the work"], ["sticky-note-line", "Note", "A few words from the field"]]
      .map(([ic, l, m], i) => `<div class="ro${i === 0 ? " on" : ""}"><span class="rdot"></span>${icon(ic as string)}<div><div class="rl">${l}</div><div class="rm">${m}</div></div></div>`)
      .join("")}</div>`,
  );
  const inner =
    state === "compose"
      ? `${kinds}${banner("Saved on this device until it sends — evidence works fully offline.", "stone", "wifi-off-line")}${hot("w2a.attach", btn("Attach evidence", { kind: "pri", full: true }))}`
      : `${listRow({ icon: "image-line", primary: "North beds after", meta: "Photo · just now", chipHtml: chip("Queued", "queued") })}${banner("It will send when you're back online. Nothing else to do.", "stone", "wifi-off-line")}${btn("Done", { kind: "sec", full: true })}`;
  const body = sheetOver(w2aBehind(), state === "compose" ? "Add evidence" : "Evidence queued", inner);
  return phoneFrame(`${body}`, { offline: state === "queued" });
}

const W2A_HOTS: HifiDef["hots"] = {
  "w2a.kind": { l: "Evidence kind", info: "Photo / link / note → one evidence job per submit (UX:159)." },
  "w2a.attach": { l: "Attach evidence", to: "screen:W2@evidence-submitted", info: "Enqueues the evidence job → EvidenceAttached after sync (CS:739)." },
};

// ---------------------------------------------------------------------------
// W3 — offer/request creation flow (uiux-spec §5.4)
// ---------------------------------------------------------------------------

const W3_STATES = [
  ["step-what", "1 · What"], ["step-howmuch", "2 · How much"], ["step-anchors", "3 · Anchors"],
  ["step-review", "4 · Review"], ["request-variant", "Request · review"], ["draft-resume", "Draft resume"],
] as const;
type W3State = (typeof W3_STATES)[number][0];

const w3Head = (title: string, step: number) =>
  `<div class="hdr"><button type="button" class="hback" aria-label="Close">${icon("close-line", "l")}</button><h1>${title}</h1><span class="hx">${stepDots(4, step)}</span></div>`;

function w3(state: W3State): string {
  let body: string;
  switch (state) {
    case "step-howmuch":
      body = `${w3Head("Make an offer", 1)}${pagepad(
        field("Unit", input("hours", { select: true })),
        `<div class="t-meta">Common here: hours, tasks, meals, rides, plants.</div>`,
        field("How many", input("6")),
        field("Due", ""),
        radio([{ label: "Runs with the season", meta: "through Aug 30", on: true }, { label: "Pick a date", meta: "calm dates — no timers" }]),
        hot("w3.continue", btn("Continue", { kind: "pri", full: true })),
      )}`;
      break;
    case "step-anchors":
      body = `${w3Head("Make an offer", 2)}${pagepad(
        sectionTitle("What kind of garden work?"),
        `<div class="t-meta">Garden-work offers anchor to the garden's actions so approvals know what to look for.</div>`,
        radio([{ label: "Prune", meta: "AGRO · trees and beds", on: true }, { label: "Plant", meta: "AGRO · seedlings and starts" }]),
        hot("w3.continue", btn("Continue", { kind: "pri", full: true })),
      )}`;
      break;
    case "step-review":
      body = `${w3Head("Make an offer", 3)}${pagepad(
        card(`${kv("Direction", "Offer support")}${kv("Kind", "Garden work")}${kv("Title", "Prune the north beds")}${kv("How much", "6 hours")}${kv("Due", "Aug 12")}${kv("Season", "First Rains")}${kv("Action", "Prune")}`),
        `<div class="t-meta">Submitting queues the promise on this device and returns you to the pool — it sends when connected.</div>`,
        hot("w3.submit", btn("Make this offer", { kind: "pri", full: true })),
      )}`;
      break;
    case "request-variant":
      body = `${w3Head("Ask for help", 3)}${pagepad(
        card(`${kv("Direction", "Request help")}${kv("Kind", "Support / service")}${kv("Title", "Ride to the market on Saturday")}${kv("How much", "1 ride")}${kv("Season", "First Rains")}`),
        `<div class="t-meta">Support requests skip action anchors — evidence and the person you asked carry the proof.</div>`,
        hot("w3.submit", btn("Ask for this help", { kind: "pri", full: true })),
      )}`;
      break;
    case "draft-resume":
      body = sheetOver(
        w3Head("Make an offer", 0) + pagepad(field("Direction", radio([{ label: "Offer support", on: true }, { label: "Request help" }]))),
        "Resume your draft?",
        `${listRow({ icon: "sticky-note-line", primary: "Prune the north beds", meta: "Saved on this device · 2 hours ago" })}${hot("w3.resume", btn("Resume draft", { kind: "pri", full: true }))}${btn("Start fresh", { kind: "ghost", full: true })}`,
      );
      break;
    default:
      body = `${w3Head("Make an offer", 0)}${pagepad(
        field("Direction", hot("w3.direction", radio([{ label: "Offer support", meta: "something you can give", on: true }, { label: "Request help", meta: "something you need" }]))),
        field("Kind", radio([{ label: "Garden work", meta: "counts toward the garden's actions", on: true }, { label: "Support / service", meta: "rides, meals, repairs — evidence-confirmed" }])),
        field("Cycle", hot("w3.cycle", input("Season: First Rains", { select: true }))),
        field("Title", input("Prune the north beds")),
        field("Note", input("optional", { placeholder: true })),
        hot("w3.continue", btn("Continue", { kind: "pri", full: true })),
      )}`;
  }
  return phoneFrame(`${body}<div style="flex:1"></div>`, { offline: state === "draft-resume" });
}

const W3_HOTS: HifiDef["hots"] = {
  "w3.direction": { l: "Direction", info: "Offer vs request — season/campaign seeding and on-behalf capture are console-seeded only, never here (UX:150)." },
  "w3.cycle": { l: "Cycle scope", info: "Every promise names its cycle; Season and Campaigns never blur (UX:127)." },
  "w3.continue": { l: "Continue", info: "Four steps: what + cycle scope → how much → anchors (garden work only) → review (UX:150-153)." },
  "w3.submit": { l: "Make this offer", to: "screen:W1@queued", info: "Enqueues the commitment job; returns to the pool tab with an optimistic queued card (UX:212)." },
  "w3.resume": { l: "Resume draft", info: "Drafts persist locally (WorkDraftRecord semantics); re-entry offers resume (UX:155)." },
};

// ---------------------------------------------------------------------------
// W4 — confirmation sheet (uiux-spec §5.6)
// ---------------------------------------------------------------------------

const W4_STATES = [
  ["confirm-domain", "Garden work"], ["confirm-support", "Support / service"],
  ["not-yet", "Not yet — reason"], ["provider-view", "Provider view"],
] as const;
type W4State = (typeof W4_STATES)[number][0];

const w4Behind = () => `${hdr("Prune the north beds", { back: true })}<div class="hsub num">Maria · 6 hours · due Aug 12</div>`;

function w4(state: W4State): string {
  const summary = `<div class="t-meta">Offer · Maria provides · the people it was made to confirm.</div>`;
  const confirmMeter = hot("w4.meter", `<div>${meter(66, { left: "confirmations", right: "2 of 3" })}</div>`) +
    listRow({ icon: "user-line", primary: "João", chipHtml: chip("Confirmed", "ok") }) +
    listRow({ icon: "user-line", primary: "Ana", chipHtml: chip("Confirmed", "ok") }) +
    listRow({ icon: "user-line", primary: "You", chipHtml: chip("Your turn", "warn") });
  const exclusion = hot("w4.provider-note", banner("Maria made this promise, so Maria cannot confirm it — not even a steward can confirm their own.", "stone", "shield-check-line"));

  let inner: string;
  let title = "Promise kept?";
  switch (state) {
    case "confirm-support":
      inner = `${summary}${listRow({ icon: "image-line", primary: "Evidence", meta: "2 items attached" })}${meter(0, { left: "confirmations", right: "0 of 1" })}${exclusion}${hot("w4.confirm", btn("Confirm — promise kept", { kind: "pri", full: true }))}${hot("w4.not-yet", btn("Not yet — tell the stewards why", { kind: "sec", full: true }))}`;
      break;
    case "not-yet":
      title = "Tell the stewards";
      inner = `${field("What still needs doing?", input("The far bed is still overgrown…", { placeholder: false }))}${banner("This never cancels the promise — stewards review and every outcome shows its reason.", "stone")}${hot("w4.not-yet-send", btn("Send to the stewards", { kind: "pri", full: true }))}`;
      break;
    case "provider-view":
      inner = `${summary}${confirmMeter}${exclusion}${btn("Confirm — promise kept", { kind: "pri", full: true, disabled: true })}`;
      break;
    default:
      inner = `${summary}${listRow({ icon: "check-line", primary: "Linked work", meta: "1 approved · evidence: 2 items" })}${confirmMeter}${exclusion}${hot("w4.confirm", btn("Confirm — promise kept", { kind: "pri", full: true }))}${hot("w4.not-yet", btn("Not yet — tell the stewards why", { kind: "sec", full: true }))}`;
  }
  return phoneFrame(sheetOver(w4Behind(), title, inner));
}

const W4_HOTS: HifiDef["hots"] = {
  "w4.confirm": { l: "Confirm — promise kept", to: "screen:W2@fulfilled", info: "Positive-only confirmation job; the Nth confirmation flips Fulfilled (CS:139)." },
  "w4.not-yet": { l: "Not yet", to: "screen:W4@not-yet", info: "Requires a reason → online steward review. It never cancels the promise (UX:167)." },
  "w4.not-yet-send": { l: "Send to the stewards", to: "screen:W2@disputed", info: "Online-only raiseDispute with the reason; the promise freezes at “under review by stewards” (CS:143 · UX:426)." },
  "w4.meter": { l: "N-of-group meter", info: "Named any-N confirmation group; the accepted provider is excluded before threshold validation (UX:280)." },
  "w4.provider-note": { l: "Provider exclusion", info: "Provider self-confirmation is blocked everywhere, including steward fallback (UX:32)." },
};

// ---------------------------------------------------------------------------

const mk = <T extends readonly (readonly [string, string])[]>(
  id: string, title: string, states: T, render: (s: T[number][0]) => string, proposed: Set<string> = new Set(),
) => ({
  screen: {
    id, title, surface: "client" as const, frame: "phone" as const, group: "Client PWA",
    states: states.map(([sid, label]) => ({ id: sid, label, proposed: proposed.has(sid), html: render(sid) })),
  },
});

export const CLIENT_DEFS: HifiDef[] = [
  { ...mk("W1", "W1 · Pool tab (garden detail)", W1_STATES, w1), hots: W1_HOTS },
  { ...mk("W2", "W2 · Commitment detail", W2_STATES, w2), hots: W2_HOTS },
  { ...mk("W2a", "W2a · Evidence sheet", [["compose", "Compose"], ["queued", "Queued"]] as const, w2a), hots: W2A_HOTS },
  { ...mk("W3", "W3 · Offer/request creation", W3_STATES, w3), hots: W3_HOTS },
  { ...mk("W4", "W4 · Confirmation sheet", W4_STATES, w4), hots: W4_HOTS },
];
