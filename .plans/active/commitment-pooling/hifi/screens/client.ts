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
  banner, btn, card, chip, disclosure, emptyState, field, gardenHeader, gardenTabs, hdr, hero,
  input, kv, listRow, meter, pagepad, phoneFrame, radio, sectionTitle, seg,
  sheetOver, skeleton, stateChip, stepDots, syncBar, timeline,
} from "../kit";
import type { HifiDef } from "./index";

// ---------------------------------------------------------------------------
// W1 — Pool tab on the garden detail (uiux-spec §5.2)
// ---------------------------------------------------------------------------

const W1_STATES = [
  ["open", "Open"], ["not-ready", "Not ready"], ["ready", "Ready"], ["seeded", "Seeded"],
  ["reviewing", "Reviewing"], ["paused", "Paused"], ["closed", "Closed"], ["cancelled-cycle", "Cycle cancelled"],
  ["empty-open", "Empty pool"], ["no-season", "No season"],
  ["queued", "Queued send"], ["sync-failed", "Send failed"], ["waiting-membership", "Waiting for membership"],
  ["cycle-summary", "Season closed"], ["claim-pending", "Claim pending"], ["claim-declined", "Claim declined"],
  ["claim-superseded", "Claim superseded"], ["claim-accepted", "Claim accepted"],
  ["loading", "Loading"], ["not-found", "Not found"], ["read-error", "Read error"],
] as const;
type W1State = (typeof W1_STATES)[number][0];

// Scoped state counts, never a cross-commitment percentage: this pool's units
// are hours, rides, sessions and surveys, so a single "62%" would average
// incommensurable things (uiux-spec §5.2 "There is no synthetic
// cross-commitment progress percentage", §12). A seeded or empty season shows
// no counts line at all rather than a row of zeroes.
const seasonCard = (opts: { offered?: number; kept?: number; stage?: string } = {}) => {
  const offered = opts.offered ?? 12;
  const kept = opts.kept ?? 7;
  const counts = offered === 0 && kept === 0 ? "" : `<div class="t-meta num">${offered} offered · ${kept} kept</div>`;
  return card(
    `<div class="cardrow">${hot("w1.season-card", `<div class="grow"><div class="t-title">Season of First Rains</div><div class="t-meta">${opts.stage ?? "Open"} · runs through Aug 30</div></div>`)}${chip("Season", "plain")}</div>` +
      counts,
  );
};

// Campaigns run alongside the Season but are not what a member came for; the
// count stays visible while the rows fold away (uiux-spec §5.2 keeps them fully
// usable, not prominent).
const campaignsBlock = () =>
  disclosure(
    "Campaigns",
    "2 open",
    card(
      listRow({ icon: "seedling-line", primary: "Market rides", meta: "Campaign · Open", chipHtml: `<span class="ch num">6/16</span>`, chevron: true }) +
        listRow({ icon: "seedling-line", primary: "Tool library", meta: "Campaign · Reviewing", chipHtml: `<span class="ch num">8/8</span>`, chevron: true }),
      { cls: "flat" },
    ),
  );

const offerCard = (opts: { queued?: boolean; waiting?: boolean; failed?: boolean } = {}) => {
  const chips = `${chip("Offer", "offer")}${chip("AGRO", "domain")}${opts.queued ? chip("Queued", "queued") : ""}${opts.waiting ? chip("Waiting", "queued") : ""}${opts.failed ? chip("Couldn't send", "err") : ""}`;
  const cta = opts.queued || opts.waiting || opts.failed ? "" : `<div class="brow">${hot("w1.take-up", btn("Take this up", { kind: "sec" }))}</div>`;
  const note = opts.waiting
    ? `<div class="t-meta">Waiting for your garden membership — it will send once you're welcomed in.</div>`
    : opts.failed
      ? `<div class="t-meta">Five send attempts used. You can retry or discard.</div><div class="brow">${hot("w1.retry-send", btn("Retry", { kind: "sec", sm: true }))}${hot("w1.discard-send", btn("Discard", { kind: "ghost", sm: true }))}</div>`
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
  // Garden detail is an immersive garden route. The shipping AppBar hides for
  // every /home/garden/** path, so this screen owns its scroll surface without
  // reserving or drawing bottom navigation.
  const head = gardenHeader("Rocinha Community Garden", { location: "Rocinha, Rio de Janeiro", founded: "Founded 2021" });

  if (state === "not-ready") {
    const body = `${head}<div class="gtabs" role="tablist" aria-label="Garden sections"><button type="button" class="gtab on" role="tab" aria-selected="true" disabled>Work</button><button type="button" class="gtab" role="tab" aria-selected="false" disabled>Insights</button><button type="button" class="gtab" role="tab" aria-selected="false" disabled>Gardeners</button></div>${pagepad(
      banner("This garden hasn't opened a pool yet. When its stewards set one up, a Pool tab appears here.", "stone"),
      card(`<div class="t-title">Work continues as usual</div><div class="t-meta">Submissions, approvals, and assessments are unaffected.</div>`),
    )}<div style="flex:1"></div>`;
    return phoneFrame(body);
  }

  const tabs = gardenTabs("pool", { hotPrefix: "w1.tab" });
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
        card(`<div class="t-title">What this pool grew</div><div class="t-meta num">23 promises made · 19 kept</div>`),
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
        seasonCard({ offered: 0, kept: 0 }),
        card(`<div class="t-title">No promises yet</div><div class="t-meta">Start the first one — offer something you can give, or ask for help you need.</div>`),
        `<div class="brow">${hot("w1.offer", btn("Offer support", { kind: "pri" }))}${hot("w1.request", btn("Request help", { kind: "sec" }))}</div>`,
      );
      break;
    case "cycle-summary":
      content = pagepad(
        card(
          `${hero("Season of First Rains — closed", "11 of 14 promises kept", "seedling-line")}${kv("Promises kept", "11 of 14")}${kv("Hours", "40 of 52")}${kv("Rides", "14 of 16")}<div class="t-meta" style="text-align:center">Ready for the next season.</div>`,
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
    case "seeded":
      content = pagepad(
        banner("Opens soon — your steward is preparing this season's promises. You can browse what's coming; offering opens when the season does.", "amber", "time-line"),
        seasonCard({ offered: 0, kept: 0, stage: "Opens soon" }),
        card(`<div class="t-title">A preview of this season</div><div class="t-meta">These promises stay read-only until the season opens.</div>`, { cls: "inset" }),
      );
      break;
    case "reviewing":
      content = pagepad(
        banner("Your stewards are reviewing this season. You can still add evidence and confirm promises.", "stone", "eye-line"),
        seasonCard({ stage: "Reviewing" }),
        offerCard(),
      );
      break;
    case "cancelled-cycle":
      content = pagepad(
        banner("This season was cancelled — “funding fell through for the rains”. Its history stays with the garden.", "stone", "information-line"),
        card(`<div class="t-title">Season of First Rains</div><div class="t-meta num">8 promises made · 5 kept</div>`),
      );
      break;
    case "loading":
      content = pagepad(skeleton({ title: true, lines: 2 }), skeleton({ avatar: true, lines: 2 }), skeleton({ lines: 3 }));
      break;
    case "not-found":
      content = pagepad(
        emptyState("search-line", "No pool here yet", "We couldn't find a pool for this garden. It may still be getting set up — check back soon.", hot("w1.retry", btn("Try again", { kind: "sec", icon: "refresh-line" }))),
      );
      break;
    case "read-error":
      content = pagepad(
        emptyState("wifi-off-line", "Couldn't load the pool", "Something went wrong reaching the network. Your last view is saved on this device.", hot("w1.retry", btn("Try again", { kind: "pri", icon: "refresh-line" }))),
      );
      break;
    default: // open
      content = pagepad(
        seasonCard(),
        campaignsBlock(),
        `<div class="brow">${hot("w1.offer", btn("Offer support", { kind: "pri" }))}${hot("w1.request", btn("Request help", { kind: "sec" }))}</div>`,
        // Both controls narrow the same list, so they sit together directly
        // above it rather than five rows apart with the CTAs wedged between.
        hot("w1.scope", seg(["All current", "Season", "Market rides", "Tool library"], 0)),
        hot("w1.filters", seg(["All", "Offers", "Requests", "Matched", "Mine"], 0)),
        offerCard(),
        requestCard(),
      );
  }

  const sync = state === "queued" ? syncBar("1 promise waiting to send") : state === "sync-failed" ? syncBar("1 item needs attention") : "";
  const offline = state === "queued" || state === "sync-failed";
  return phoneFrame(`${head}${tabs}${content}<div style="flex:1"></div>${sync}`, { offline });
}

const W1_HOTS: HifiDef["hots"] = {
  "w1.offer": { l: "Offer support", to: "screen:W3", info: "Starts the creation flow with direction = offer (UX:120)." },
  "w1.request": { l: "Request help", to: "screen:W3@request-variant", info: "Creation flow with direction = request (UX:153)." },
  "w1.take-up": { l: "Take this up (open claim)", to: "screen:W2", info: "Open mode: claim job → optimistic Accepted (UX:129)." },
  "w1.ask-take-up": { l: "Ask to take this up (steward-reviewed)", to: "screen:W1@claim-pending", info: "Approval-gated: creates a claim request with stored terms; the commitment stays available to others (UX:99)." },
  "w1.ask-again": { l: "Ask again", to: "screen:W1@claim-pending", info: "Creates a FRESH request while the commitment is claimable — never retries the declined row (UX:105)." },
  "w1.back-browse": { l: "Back to browsing", to: "screen:W1", info: "Declined/superseded exits return to browse." },
  "w1.open-commitment": { l: "Open the promise", to: "screen:W2", info: "Acceptance names the counterparty / provider garden (UX:104)." },
  "w1.scope": { l: "Scope control", info: "Filters the list; every aggregate names its scope — Season and Campaigns never blur (UX:127)." },
  "w1.filters": { l: "Filter chips", info: "Client-local filter chips (admin AdminFilterChip is admin-only)." },
  "w1.season-card": { l: "Cycle card", info: "Season vs Campaign is always named; derived InProgress/Reviewing overlays follow activity (CS:115-117). Calm dates, never timers." },
  "w1.queued-card": { l: "Queued promise card", info: "Offline-queued job chrome; syncs when connected (UX:237). waiting_for_hat variant consumes no send attempts (register #34c)." },
  "w1.retry-send": { l: "Retry queued send", to: "screen:W1@queued", info: "Resets the failed job to pending and retries without dropping the local promise (UX:218)." },
  "w1.discard-send": { l: "Discard failed send", to: "screen:W1", info: "Removes only the exhausted local job after an explicit member choice; no remote promise exists yet (UX:218)." },
  "w1.retry": { l: "Try again", info: "Read-surface recovery — retries the read. None/UNKNOWN sentinels render loading / not-found / recovery chrome, never a “None” state chip (UX:51-52 · AM:12)." },
  "w1.tab-work": { l: "Work tab", info: "The existing garden Work tab — submissions, approvals, assessments (UX:116). The Pool tab is the net-new 4th GardenTab." },
  "w1.tab-insights": { l: "Insights tab", info: "The existing garden Insights tab — unchanged by pooling." },
  "w1.tab-gardeners": { l: "Gardeners tab", info: "The existing garden Gardeners/membership tab — unchanged by pooling." },
  "w1.tab-pool": { l: "Pool tab", info: "The active Garden detail section for offers, requests, cycles, and pool-scoped history." },
};

// ---------------------------------------------------------------------------
// W2 — Commitment detail (uiux-spec §5.3; hi-fi guidance wireframes.md:166)
// ---------------------------------------------------------------------------

const W2_STATES = [
  ["accepted", "Accepted"], ["offered", "Offered (yours)"], ["requested", "Requested (yours)"],
  ["active", "Active"], ["evidence-submitted", "Evidence in"], ["partially-approved", "Partly approved"],
  ["ready-confirmer", "Ready — confirmer view"], ["fulfilled", "Fulfilled"], ["reward-released", "Reward released"],
  ["support-queued", "Support queued"], ["support-en-route", "Support on its way"], ["support-delayed", "Delivery delayed"],
  ["support-executed", "Celo executed"], ["support-confirming", "Confirming arrival"],
  ["support-arrived", "Support arrived"], ["support-failed", "Support failed"],
  ["support-cancelled-queued", "Support withdrawn"], ["support-cancelled-failed", "Support closed after failed delivery"],
  ["reconciled", "Reconciled"], ["cancelled", "Cancelled"], ["expired", "Expired"],
  ["disputed", "Under review"], ["captured", "Recorded for you"],
  ["loading", "Loading"], ["not-found", "Not found"], ["read-error", "Read error"],
] as const;
type W2State = (typeof W2_STATES)[number][0];
type W2ChipState = Exclude<W2State, "loading" | "not-found" | "read-error">;

const w2StateChip: Record<W2ChipState, string> = {
  accepted: "Accepted", offered: "Offered", requested: "Requested", active: "Active",
  "evidence-submitted": "Evidence in", "partially-approved": "Partly approved",
  "ready-confirmer": "Ready to confirm", fulfilled: "Fulfilled", "reward-released": "Fulfilled",
  "support-queued": "Fulfilled", "support-en-route": "Fulfilled", "support-delayed": "Fulfilled",
  "support-executed": "Fulfilled", "support-confirming": "Fulfilled", "support-arrived": "Fulfilled",
  "support-failed": "Fulfilled", "support-cancelled-queued": "Fulfilled", "support-cancelled-failed": "Fulfilled",
  reconciled: "Reconciled",
  cancelled: "Cancelled", expired: "Expired", disputed: "Under review", captured: "Accepted",
};

function w2RewardRow(state: W2State): string {
  const settlementReward = state.startsWith("support-");
  const rewardMeta = settlementReward ? "20 G$ from the garden's Celo account" : "20 DAI from the garden jar";
  const line = (label: string, v: string, tone?: "ok" | "warn") =>
    hot(
      "w2.reward-row",
      card(
        `<div class="cardrow"><div class="grow"><div class="t-title" style="font-size:14.5px">Reward</div><div class="t-meta num">${rewardMeta}</div></div>${chip(v, tone ?? "plain", { dot: true })}</div><div class="t-meta">${label}</div>`,
        { cls: "flat" },
      ),
    );
  switch (state) {
    case "reward-released":
      return line("Recorded by your steward — reference only, value moves outside the app.", "Reward released", "ok");
    case "support-queued":
      return line("Support is queued (G$).", "Queued");
    case "support-en-route":
      return line("Support on its way (G$).", "On its way");
    case "support-delayed":
      return line("Support on its way — delivery delayed. Your promise remains recorded.", "Delayed", "warn");
    case "support-executed":
      return line("Celo execution recorded — confirming arrival.", "Executed");
    case "support-confirming":
      return line("Execution stored — authenticated acknowledgment pending.", "Confirming");
    case "support-arrived":
      return line("Support arrived ↗ — reference in Details.", "Arrived", "ok");
    case "support-failed":
      return line("Still arranging support — your promise is recorded and stays kept.", "Arranging", "warn");
    case "support-cancelled-queued":
      return line("This support was withdrawn before it was sent — your promise and its record stay intact.", "Withdrawn", "warn");
    case "support-cancelled-failed":
      return line("This support was closed after delivery could not complete — your promise and its record stay intact.", "Closed", "warn");
    default:
      return line("Reference only — no value is held by the app.", "Pending");
  }
}

// Settlement-bearing outcomes: the commitment is Fulfilled and the only news
// left is where the support is. Kept as one set so the state chip, the lead
// band, and the timeline can never disagree about whether the promise is done.
const W2_SETTLED = new Set<W2State>([
  "reward-released", "support-queued", "support-en-route", "support-delayed",
  "support-executed", "support-confirming", "support-arrived", "support-failed",
  "support-cancelled-queued", "support-cancelled-failed",
]);

type Moment = { label: string; meta?: string; open?: boolean; warn?: boolean; note?: string };

// The timeline is a function of where the promise actually is. A single shared
// body made pre-acceptance states show an "Accepted" moment before anyone had
// claimed, and made @cancelled promise a reason the timeline never carried.
function w2Moments(state: W2State, overrideNote: boolean): Moment[] {
  if (state === "offered") return [{ label: "Offered", meta: "Maria · Jul 2 — waiting for someone to take it up", open: true }];
  if (state === "requested") return [{ label: "Requested", meta: "Ana · Jul 2 — stewards review who takes this up", open: true }];

  const opened: Moment[] = [
    { label: "Offered", meta: "Maria · Jul 2" },
    { label: "Accepted", meta: "João took this up · Jul 3" },
  ];
  if (state === "cancelled")
    return [...opened, { label: "Cancelled", meta: "steward · Jul 9", note: "“withdrawn by agreement at the gathering”", warn: true, open: true }];
  if (state === "expired")
    return [...opened, { label: "Expired", meta: "ran through Aug 12", warn: true, open: true }];

  const worked: Moment[] = [...opened, { label: "Work linked", meta: "pruning session · Jul 8" }];
  if (state === "disputed")
    return [...worked, { label: "Under review by stewards", meta: "Jul 10", note: "“the far bed is still overgrown”", warn: true, open: true }];

  const ready: Moment = overrideNote
    ? { label: "Ready", meta: "steward note", note: "“confirmed on site visit” (steward record)", warn: true }
    : { label: "Ready to confirm", meta: "waiting on João", open: true };
  if (state === "fulfilled" || state === "reconciled" || W2_SETTLED.has(state))
    return [...worked, { ...ready, open: false }, { label: "Promise kept", meta: "confirmed by João · Jul 12", open: true }];
  return [...worked, ready];
}

const w2Disclosures = (state: W2State, opts: { work?: boolean; overrideNote?: boolean } = {}) => {
  const moments = w2Moments(state, !!opts.overrideNote);
  // Nothing has been done yet on an unclaimed promise — no evidence, no work.
  const preAcceptance = state === "offered" || state === "requested";
  return (
    disclosure(
      "Timeline",
      `${moments.length} ${moments.length === 1 ? "moment" : "moments"}`,
      timeline(moments) + `<div class="t-meta">Recorded on Arbitrum · every steward record shows its reason here.</div>`,
    ) +
    (preAcceptance
      ? ""
      : disclosure(
          "Evidence",
          "2 items",
          listRow({ icon: "image-line", primary: "North beds after", meta: "Photo · Jul 8" }) +
            listRow({ icon: "sticky-note-line", primary: "“Two beds left for next week”", meta: "Note · Jul 8" }),
        )) +
    (preAcceptance || opts.work === false
      ? ""
      : disclosure(
          "Work for this promise",
          "1 approved",
          listRow({ icon: "check-line", primary: "Pruning session", meta: "Approved · Jul 8", chipHtml: chip("Approved", "ok") }),
        )) +
    hot(
      "w2.details",
      disclosure("Details", "ids & records", `${kv("Commitment", "0x8c…41f2")}${kv("Recorded on", "Arbitrum")}${kv("Cycle", "Season of First Rains")}`),
    )
  );
};

function w2(state: W2State): string {
  const head = hdr("Prune the north beds", { back: true });
  // Read-surface recovery states short-circuit before the state chip is computed.
  const readWrap = (inner: string) => phoneFrame(`${head}${inner}<div style="flex:1"></div>`);
  if (state === "loading")
    return readWrap(pagepad(skeleton({ title: true, lines: 1 }), skeleton({ avatar: true, lines: 3 }), skeleton({ lines: 2 })));
  if (state === "not-found")
    return readWrap(pagepad(emptyState("search-line", "Promise not found", "We couldn't find this promise. It may have been withdrawn, or it hasn't synced to this device yet.", hot("w2.retry", btn("Try again", { kind: "sec", icon: "refresh-line" })))));
  if (state === "read-error")
    return readWrap(pagepad(emptyState("wifi-off-line", "Couldn't load this promise", "Something went wrong reaching the network. Check your connection and try again.", hot("w2.retry", btn("Try again", { kind: "pri", icon: "refresh-line" })))));
  const chips = `<div class="cardrow">${chip("Offer", "offer")}${chip("AGRO", "domain")}${stateChip(w2StateChip[state])}</div>`;
  const meta = `<div class="hsub num">6 hours · due Aug 12 · Season of First Rains</div>`;

  const capturedChip =
    state === "captured"
      ? hot("w2.captured-chip", banner("Recorded by your steward on your behalf. The promise stays yours.", "stone", "hand-heart-line"))
      : "";

  let band: string;
  // Every settlement-bearing state is already Fulfilled — the live question is
  // where the support is. Offering "Add evidence" here contradicted both the
  // state chip and the reward row, and §5.3 gates evidence attach to
  // Active / EvidenceSubmitted / PartiallyApproved anyway.
  if (W2_SETTLED.has(state))
    band = card(`<div class="t-title">Promise kept</div><div class="t-meta">Confirmed by João · Jul 12 — the season's count already grew.</div>`);
  else switch (state) {
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

  const showReward = !["offered", "requested", "cancelled", "expired", "disputed"].includes(state);
  // Reward/settlement status sits with the band — it is scan-layer status, not
  // deep dive. Disclosures stay last and stay present even under review: the
  // dispute banner tells the member the reason is in the timeline, so hiding
  // the timeline there pointed at nothing.
  const content = pagepad(
    chips.replace('<div class="cardrow">', '<div class="cardrow" style="padding:0 2px">'),
    capturedChip,
    band,
    showReward ? w2RewardRow(state) : "",
    w2Disclosures(state, { overrideNote: state === "captured" || state === "fulfilled", work: state !== "evidence-submitted" }),
  );

  // Work/commitment detail hides the bottom AppBar — the back-header is the chrome.
  return phoneFrame(`${head}${meta}${content}<div style="flex:1"></div>`);
}

const W2_HOTS: HifiDef["hots"] = {
  "w2.add-evidence": { l: "Add evidence", to: "screen:W2a", info: "W2a attach sheet: photo / link / note → one evidence job per submit; fully offline (UX:159)." },
  "w2.submit-work": { l: "Submit work for this promise", to: "screen:WFLOW", info: "Deep-links the existing Garden-tab work flow with commitment context (UX:174). DomainImpact only." },
  "w2.link-work": { l: "Link existing work", to: "screen:HUBWORK", info: "Picker of your approved/pending works → workLink job (UX:140). The prototype resumes at the linked work's existing approval surface." },
  "w2.confirm": { l: "Confirm: promise kept", to: "screen:W4", info: "Visible only to eligible confirmers while ReadyForConfirmation — the provider never sees it (UX:142)." },
  "w2.send-confirmation": { l: "Send for confirmation", to: "screen:W4@confirm-support", info: "Evidence-only kinds; DomainImpact is rejected on-chain (CS:138b). Adopted MF-6." },
  "w2.offer-again": { l: "Offer it again", to: "screen:W3", info: "Per-cycle renewal — a fresh commitment, prefilled (UX:94). Adopted MF-3." },
  "w2.withdraw": { l: "Withdraw (pre-acceptance)", to: "screen:W2@cancelled", info: "Member pre-acceptance withdraw, adopted MF-2a (register #34b). Steward cancellation remains a separate recorded action." },
  "w2.reward-row": { l: "Reward / settlement row", info: "Reference only — no custody. When an integrated G$ settlement exists, it replaces the pending line; “Arrived” requires an authenticated CCIP success acknowledgment, never dispatch or Celo execution alone." },
  "w2.captured-chip": { l: "Recorded-for-you chip", info: "Analog capture: the steward is only the recorder; the promise stays the member's (UX:437)." },
  "w2.details": { l: "Details disclosure", info: "Identifiers live behind one Details disclosure; chain vocabulary stays on this engage layer, never on browse cards (UX:436)." },
  "w2.retry": { l: "Try again", info: "Read-surface recovery — retries the commitment read (loading/not-found/read-error; never a “None” chip) (UX:51-52 · AM:12)." },
};

// ---------------------------------------------------------------------------
// W2a — evidence attach sheet (uiux-spec §5.5)
// ---------------------------------------------------------------------------

const w2aBehind = () => `${hdr("Prune the north beds", { back: true })}<div class="hsub num">6 hours · due Aug 12</div>`;

function w2a(state: "compose" | "queued" | "failed"): string {
  const kinds = hot(
    "w2a.kind",
    `<div class="radio">
${[["camera-line", "Photo", "From your camera or library"], ["link-m", "Link", "A page that shows the work"], ["sticky-note-line", "Note", "A few words from the field"]]
      .map(([ic, l, m], i) => `<div class="ro${i === 0 ? " on" : ""}"><span class="rdot"></span>${icon(ic as string)}<div><div class="rl">${l}</div><div class="rm">${m}</div></div></div>`)
      .join("")}</div>`,
  );
  const title = state === "compose" ? "Add evidence" : state === "failed" ? "One item needs another try" : "Evidence queued";
  let inner: string;
  if (state === "failed") {
    inner =
      listRow({ icon: "image-line", primary: "North beds after", meta: "Photo · couldn't send", chipHtml: chip("Couldn't send", "err"), trailing: hot("w2a.retry-row", btn("Retry", { kind: "sec", sm: true, icon: "refresh-line" })) }) +
      listRow({ icon: "sticky-note-line", primary: "“Two beds left for next week”", meta: "Note · sent", chipHtml: chip("Sent", "ok") }) +
      banner("Your evidence is held on this device — nothing is dropped. Retry the one that didn't send whenever you're ready.", "stone", "wifi-off-line") +
      hot("w2a.done", btn("Done", { kind: "ghost", full: true }));
  } else if (state === "queued") {
    inner =
      listRow({ icon: "image-line", primary: "North beds after", meta: "Photo · just now", chipHtml: chip("Queued", "queued") }) +
      banner("It will send when you're back online. Nothing else to do.", "stone", "wifi-off-line") +
      hot("w2a.done", btn("Done", { kind: "sec", full: true }));
  } else {
    inner = `${kinds}${banner("Saved on this device until it sends — evidence works fully offline.", "stone", "wifi-off-line")}${hot("w2a.attach", btn("Attach evidence", { kind: "pri", full: true }))}`;
  }
  const body = sheetOver(w2aBehind(), title, inner);
  return phoneFrame(`${body}`, { offline: state === "queued" || state === "failed" });
}

const W2A_HOTS: HifiDef["hots"] = {
  "w2a.kind": { l: "Evidence kind", info: "Photo / link / note → one evidence job per submit (UX:159)." },
  "w2a.attach": { l: "Attach evidence", to: "screen:W2@evidence-submitted", info: "Enqueues the evidence job → EvidenceAttached after sync (CS:739)." },
  "w2a.retry-row": { l: "Retry this upload", to: "screen:W2a@queued", info: "Per-row retry — a failed evidence job stays visible with a retry (up to MAX_RETRIES=5); media is never silently dropped (UX:218)." },
  "w2a.done": { l: "Done", to: "screen:W2@evidence-submitted", info: "Returns to the promise with the queued or sent evidence row still visible." },
};

// ---------------------------------------------------------------------------
// W3 — offer/request creation flow (uiux-spec §5.4)
// ---------------------------------------------------------------------------

const W3_STATES = [
  ["step-what", "1 · What"], ["step-howmuch", "2 · How much"], ["step-anchors", "3 · Anchors"],
  ["step-review", "4 · Review"], ["request-variant", "Request · review"], ["draft-resume", "Draft resume"],
  ["validation", "Validation error"],
] as const;
type W3State = (typeof W3_STATES)[number][0];

// `total` is a parameter because the request path skips action anchors: a
// support/service ask is three steps, and showing four dots promises a step
// that never arrives (UX:153 · WF:199).
const w3Head = (title: string, step: number, total = 4) =>
  `<div class="hdr"><button type="button" class="hback" aria-label="Close — preview only" disabled>${icon("close-line", "l")}</button><h1>${title}</h1><span class="hx">${stepDots(total, step)}</span></div>`;

function w3(state: W3State): string {
  let body: string;
  switch (state) {
    case "step-howmuch":
      body = `${w3Head("Make an offer", 1)}${pagepad(
        field("Unit", input("hours", { select: true })),
        `<div class="t-meta">Common here: hours, tasks, meals, rides, plants.</div>`,
        field("How many", input("6")),
        field("Due", ""),
        radio([{ label: "Runs with the season", meta: "through Aug 30", on: true }, { label: "Pick a date", meta: "choose a day that suits you" }]),
        hot("w3.continue-howmuch", btn("Continue", { kind: "pri", full: true })),
      )}`;
      break;
    case "step-anchors":
      body = `${w3Head("Make an offer", 2)}${pagepad(
        sectionTitle("What kind of garden work?"),
        `<div class="t-meta">Garden-work offers anchor to the garden's actions so approvals know what to look for.</div>`,
        radio([{ label: "Prune", meta: "AGRO · trees and beds", on: true }, { label: "Plant", meta: "AGRO · seedlings and starts" }]),
        hot("w3.continue-anchors", btn("Continue", { kind: "pri", full: true })),
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
      body = `${w3Head("Ask for help", 2, 3)}${pagepad(
        card(`${kv("Direction", "Request help")}${kv("Kind", "Support / service")}${kv("Title", "Ride to the market on Saturday")}${kv("How much", "1 ride")}${kv("Season", "First Rains")}`),
        `<div class="t-meta">Support requests skip action anchors — evidence and the person you asked carry the proof.</div>`,
        hot("w3.submit", btn("Ask for this help", { kind: "pri", full: true })),
      )}`;
      break;
    case "draft-resume":
      body = sheetOver(
        w3Head("Make an offer", 0) + pagepad(field("Direction", radio([{ label: "Offer support", on: true }, { label: "Request help" }]))),
        "Resume your draft?",
        `${listRow({ icon: "sticky-note-line", primary: "Prune the north beds", meta: "Saved on this device · 2 hours ago" })}${hot("w3.resume", btn("Resume draft", { kind: "pri", full: true }))}${hot("w3.start-fresh", btn("Start fresh", { kind: "ghost", full: true }))}`,
      );
      break;
    case "validation":
      body = `${w3Head("Make an offer", 2)}${pagepad(
        banner("Add at least one action, and give each a count of 1 or more, before you continue. Your entries are kept.", "amber", "error-warning-line"),
        sectionTitle("This promise needs", chip("2 actions")),
        card(
          listRow({ icon: "leaf-line", primary: "Prune × 1", meta: "AGRO · trees and beds", chipHtml: chip("OK", "ok") }) +
            listRow({ icon: "error-warning-line", primary: "Plant × 0", meta: "needs a count of at least 1", chipHtml: chip("Fix", "err") }) +
            hot("w3.add-action", btn("Add an action", { kind: "ghost", sm: true, icon: "add-line" })),
          { cls: "flat" },
        ),
        `<div class="t-meta">Anchor this promise to the garden's actions — up to four, each with a count of 1 or more.</div>`,
        btn("Continue", { kind: "pri", full: true, disabled: true }),
      )}`;
      break;
    default:
      body = `${w3Head("Make an offer", 0)}${pagepad(
        field("Direction", hot("w3.direction", radio([{ label: "Offer support", meta: "something you can give", on: true }, { label: "Request help", meta: "something you need" }], { interactive: true, name: "commitment-direction" }))),
        field("Kind", radio([{ label: "Garden work", meta: "counts toward the garden's actions", on: true }, { label: "Support / service", meta: "rides, meals, repairs — evidence-confirmed" }])),
        field("Cycle", hot("w3.cycle", input("Season: First Rains", { select: true }))),
        field("Title", input("Prune the north beds")),
        field("Note", input("optional", { placeholder: true })),
        hot("w3.continue-what", btn("Continue", { kind: "pri", full: true })),
      )}`;
  }
  // `/pool/new` is a full-screen flow — the shipping AppBar hides here exactly
  // as it does for the Garden work flow (uiux-spec:120 · AppBar.tsx:33).
  return phoneFrame(`${body}<div style="flex:1"></div>`, { offline: state === "draft-resume", appBar: false });
}

const W3_HOTS: HifiDef["hots"] = {
  "w3.direction": { l: "Direction", info: "Offer vs request — season/campaign seeding and on-behalf capture are console-seeded only, never here (UX:150)." },
  "w3.cycle": { l: "Cycle scope", info: "Every promise names its cycle; Season and Campaigns never blur (UX:127)." },
  "w3.continue-what": { l: "Continue to amount", to: "screen:W3@step-howmuch", info: "What + cycle scope → amount (UX:150-153)." },
  "w3.continue-howmuch": { l: "Continue to anchors", to: "screen:W3@step-anchors", info: "Amount → action anchors for garden work (UX:150-153)." },
  "w3.continue-anchors": { l: "Continue to review", to: "screen:W3@step-review", info: "Action anchors → review (UX:150-153)." },
  "w3.submit": { l: "Make this offer", to: "screen:W1@queued", info: "Enqueues the commitment job; returns to the pool tab with an optimistic queued card (UX:212)." },
  "w3.resume": { l: "Resume draft", to: "screen:W3@step-what", info: "Drafts persist locally (WorkDraftRecord semantics); re-entry offers resume (UX:155)." },
  "w3.start-fresh": { l: "Start fresh", to: "screen:W3@step-what", info: "Explicitly discards the saved local draft and starts from the first creation step." },
  "w3.add-action": { l: "Add an action", info: "DomainImpact requirements builder: 1–4 rows, each count ≥ 1, equal lengths, positional domain match, registry existence; a running summary chip sits in the header. Failed submits keep entered data and focus a concise error summary (UX:153 · WF:200 · UX:439)." },
};

// ---------------------------------------------------------------------------
// W4 — confirmation sheet (uiux-spec §5.6)
// ---------------------------------------------------------------------------

const W4_STATES = [
  ["confirm-domain", "Garden work"], ["confirm-support", "Support / service"],
  ["not-yet", "Not yet — reason"], ["provider-view", "Provider view"],
  ["confirmed-pending", "Fulfilled — pending sync"], ["confirmed", "Fulfilled — synced"], ["not-yet-failed", "Not yet — send failed"],
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
    case "confirmed-pending":
      title = "Promise kept";
      inner = `${meter(100, { left: "confirmations", right: "3 of 3" })}${listRow({ icon: "checkbox-circle-fill", primary: "You", chipHtml: chip("Confirmed", "ok") })}${banner("Saved on this device — this confirms once it syncs.", "stone", "wifi-off-line")}${hot("w4.pending-done", btn("Done", { kind: "sec", full: true }))}`;
      break;
    case "confirmed":
      title = "Promise kept";
      inner = `${hero("Promise kept", "Confirmed · the season's count just grew", "checkbox-circle-fill")}${hot("w4.done", btn("Back to the pool", { kind: "pri", full: true }))}`;
      break;
    case "not-yet-failed":
      title = "Tell the stewards";
      inner = `${field("What still needs doing?", input("The far bed is still overgrown…", { placeholder: false }))}${banner("Couldn't reach the stewards just now. Your note is kept and this promise stays ready to confirm — try again when you're back online.", "amber", "error-warning-line")}${hot("w4.not-yet-retry", btn("Try again", { kind: "pri", full: true, icon: "refresh-line" }))}`;
      break;
    case "provider-view":
      // The provider's question is "where has this got to?", not "may I
      // confirm?" — a disabled full-width CTA answers the wrong one.
      title = "Waiting on confirmation";
      inner = `${summary}${confirmMeter}${exclusion}<div class="t-meta">Waiting on João and Ana. You'll see it here the moment they confirm.</div>`;
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
  "w4.done": { l: "Back to the pool", to: "screen:W2@fulfilled", info: "The Commitment Fulfilled hero (High) fires on sync completion, not enqueue; reduced-motion shows a static celebratory frame (UX:169,201,204)." },
  "w4.pending-done": { l: "Done", to: "screen:W2@ready-confirmer", info: "Returns to the promise while the confirmation is still pending local sync; fulfillment is not shown early." },
  "w4.not-yet-retry": { l: "Try again", to: "screen:W2@disputed", info: "“Not yet” is online-only — dispute creation is not an offline queue kind. Failure leaves ReadyForConfirmation and exposes inline retry; success invalidates to under review by stewards (UX:169,221)." },
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
  { ...mk("W2a", "W2a · Evidence sheet", [["compose", "Compose"], ["queued", "Queued"], ["failed", "Upload failed"]] as const, w2a), hots: W2A_HOTS },
  { ...mk("W3", "W3 · Offer/request creation", W3_STATES, w3), hots: W3_HOTS },
  { ...mk("W4", "W4 · Confirmation sheet", W4_STATES, w4), hots: W4_HOTS },
];
