// Client PWA hi-fi screens — W1 pool home, W2 commitment detail, W2a evidence
// sheet, W3 creation flow, W4 confirmation sheet. Warm Earth dialect (.sc),
// phone frame. Copy sources: uiux-spec §5 + wireframes.md §2 annotations;
// sample content continues the lo-fi set (Rocinha, Season of First Rains,
// "Prune the north beds", Maria/João/Ana). Progressive-disclosure rules per
// wireframes.md:166: state + next action in the viewport; Timeline / Evidence
// / Work behind disclosures; identifiers behind a single Details disclosure.
// Dissolved lo-fi variants: W1P/W1S → W1@claim-*, MF3 → W2@expired, MF5 →
// W1@waiting-membership, MF6 → W2@request-evidence-submitted, MF10 → W1@cycle-summary.

import { hot } from "../html";
import { icon } from "../icons";
import {
  appBar, banner, btn, card, chip, disclosure, emptyState, field, gardenHeader, gardenTabs, hdr, hero,
  input, kv, listRow, meter, pagepad, phoneFrame, radio, sectionTitle, seg,
  sheetOver, skeleton, stateChip, stepDots, syncBar, timeline,
} from "../kit";
import type { HifiDef } from "./index";
import type { StateFacts } from "../types";

// ---------------------------------------------------------------------------
// W1 — Pool tab on the garden detail (uiux-spec §5.2)
// ---------------------------------------------------------------------------

const W1_STATES = [
  ["open", "Open"], ["not-ready", "Not ready"], ["ready", "Ready"], ["seeded", "Seeded"],
  ["request-open", "Open request"], ["request-queued", "Request queued"],
  ["reviewing", "Reviewing"], ["paused", "Paused"], ["closed", "Closed"],
  ["cancelled-cycle", "Cycle cancelled"], ["paused-cancelled-cycle", "Cycle cancelled · pool paused"],
  ["empty-open", "Empty pool"], ["no-season", "No season"],
  ["campaign-market", "Campaign · Market rides"], ["campaign-tools", "Campaign · Tool library"],
  ["queued", "Queued send"], ["support-queued", "Service offer queued"],
  ["sync-failed", "Send failed"], ["waiting-membership", "Waiting for membership"],
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
      hot("w1.campaign-market", listRow({ icon: "seedling-line", primary: "Market rides", meta: "Campaign · Open", chipHtml: `<span class="ch num">6/16</span>`, chevron: true })) +
        hot("w1.campaign-tools", listRow({ icon: "seedling-line", primary: "Tool library", meta: "Campaign · Reviewing", chipHtml: `<span class="ch num">8/8</span>`, chevron: true })),
      { cls: "flat" },
    ),
  );

const offerCard = (opts: {
  queued?: boolean;
  waiting?: boolean;
  failed?: boolean;
  readOnly?: boolean;
  readOnlyNote?: string;
  detailHot?: string;
  detailLabel?: string;
} = {}) => {
  const chips = `${chip("Offer", "offer")}${chip("AGRO", "domain")}${opts.queued ? chip("Queued", "queued") : ""}${opts.waiting ? chip("Waiting", "queued") : ""}${opts.failed ? chip("Couldn't send", "err") : ""}`;
  const cta = opts.queued || opts.waiting || opts.failed
    ? ""
    : opts.readOnly
      ? opts.detailHot
        ? `<div class="brow">${hot(opts.detailHot, btn(opts.detailLabel ?? "Open promise", { kind: "sec" }))}</div>`
        : ""
      : `<div class="brow">${hot("w1.take-up", btn("Take this up", { kind: "sec" }))}</div>`;
  const note = opts.waiting
    ? `<div class="t-meta">Waiting for your garden membership — it will send once you're welcomed in.</div>`
    : opts.failed
      ? `<div class="t-meta">Five send attempts used. You can retry or discard.</div><div class="brow">${hot("w1.retry-send", btn("Retry", { kind: "sec", sm: true }))}${hot("w1.discard-send", btn("Discard", { kind: "ghost", sm: true }))}</div>`
      : opts.readOnly
        ? `<div class="t-meta">${opts.readOnlyNote ?? "This promise remains visible, but taking it up is not available right now."}</div>`
        : `<div class="t-meta">Anyone in this garden may take this up.</div>`;
  const title = opts.waiting ? "Compost workshop" : "Prune the north beds";
  const meta = opts.waiting ? "3 sessions · runs with the season" : "6 hours · due Aug 12";
  return card(`<div class="cardrow">${chips}</div><div class="t-title">${title}</div><div class="t-meta num">${meta}</div>${note}${cta}`);
};

const requestCard = (opts: { openClaim?: boolean; queued?: boolean; context?: string; claimHot?: string } = {}) =>
  card(
    `<div class="cardrow">${chip("Request", "request")}${opts.queued ? chip("Queued", "queued") : ""}</div><div class="t-title">Ride to the market on Saturday</div><div class="t-meta num">1 ride · ${opts.context ?? "runs with the season"}</div>${
      opts.queued
        ? `<div class="t-meta">Saved on this device — it will send when connected.</div>`
        : opts.openClaim
          ? `<div class="t-meta">Anyone in this garden may offer to help.</div><div class="brow">${hot(opts.claimHot ?? "w1.take-up-request", btn("I can help", { kind: "sec" }))}</div>`
          : `<div class="t-meta">Stewards review who takes this up.</div><div class="brow">${hot("w1.ask-take-up", btn("Ask to take this up", { kind: "sec" }))}</div>`
    }`,
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
    `<div class="cardrow">${chip("Accepted", "ok", { dot: true })}</div><div class="t-title">Your request to help was accepted</div><div class="t-meta">Ride to the market on Saturday · Ana asked · provider: you.</div><div class="brow">${hot("w1.open-commitment", btn("Open the promise", { kind: "pri" }))}</div>`,
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
        offerCard({
          readOnly: true,
          readOnlyNote: "New participation is paused. Evidence, linked work, and recovery remain available inside the promise.",
          detailHot: "w1.open-paused-promise",
        }),
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
        card(`<div class="t-title">New season offers are paused</div><div class="t-meta">Open a campaign to see its promises, or wait for your steward to seed the next season.</div>`, { cls: "inset" }),
      );
      break;
    case "campaign-market":
      content = pagepad(
        banner("No Season is open. This campaign remains available on its own.", "stone"),
        card(`<div class="cardrow"><div class="grow"><div class="t-title">Market rides</div><div class="t-meta">Campaign · Open · through Aug 18</div></div>${chip("6 of 16", "plain")}</div>`),
        sectionTitle("Campaign promises"),
        requestCard({ openClaim: true, context: "Market rides campaign", claimHot: "w1.take-up-campaign-request" }),
        hot("w1.campaigns-back", btn("Back to campaigns", { kind: "ghost", full: true })),
      );
      break;
    case "campaign-tools":
      content = pagepad(
        banner("Tool library is under review. Evidence and confirmations stay available.", "stone", "eye-line"),
        card(`<div class="cardrow"><div class="grow"><div class="t-title">Tool library</div><div class="t-meta">Campaign · Reviewing · through Aug 18</div></div>${chip("8 of 8", "plain")}</div>`),
        card(`<div class="cardrow">${chip("Offer", "offer")}${chip("Support / service", "plain")}</div><div class="t-title">Repair tool handles</div><div class="t-meta">1 repair session · Tool library campaign</div><div class="t-meta">This promise is ready for confirmation.</div><div class="brow">${hot("w1.open-tools-promise", btn("Review confirmation", { kind: "pri" }))}</div>`),
        hot("w1.campaigns-back", btn("Back to campaigns", { kind: "ghost", full: true })),
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
    case "request-open":
      content = pagepad(
        seasonCard(),
        sectionTitle("Open request"),
        hot("w1.filters", seg(["All", "Offers", "Requests", "Matched", "Mine"], 2)),
        requestCard({ openClaim: true }),
      );
      break;
    case "request-queued":
      content = pagepad(
        seasonCard(),
        banner("Your request is saved on this device and will send when connected.", "stone", "wifi-off-line"),
        hot("w1.queued-card", requestCard({ queued: true })),
      );
      break;
    case "queued":
      content = pagepad(
        seasonCard(),
        `<div class="brow">${hot("w1.offer", btn("Offer support", { kind: "pri" }))}${hot("w1.request", btn("Request help", { kind: "sec" }))}</div>`,
        hot("w1.filters", seg(["All", "Offers", "Requests", "Matched", "Mine"], 4)),
        hot("w1.queued-card", offerCard({ queued: true })),
        disclosure("Browse other promises", "pool stays open", requestCard()),
      );
      break;
    case "waiting-membership":
      content = pagepad(
        seasonCard(),
        `<div class="brow">${hot("w1.offer", btn("Offer support", { kind: "pri" }))}${hot("w1.request", btn("Request help", { kind: "sec" }))}</div>`,
        hot("w1.filters", seg(["All", "Offers", "Requests", "Matched", "Mine"], 4)),
        hot("w1.queued-card", offerCard({ waiting: true })),
        offerCard(),
      );
      break;
    case "sync-failed":
      content = pagepad(
        seasonCard(),
        banner("This promise did not send after five attempts. Retry it, or discard the local copy.", "amber", "error-warning-line"),
        hot("w1.queued-card", offerCard({ failed: true })),
        disclosure("Browse other promises", "pool stays open", requestCard()),
      );
      break;
    case "claim-pending":
    case "claim-declined":
    case "claim-superseded":
    case "claim-accepted":
      content = pagepad(claimCard(state));
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
        offerCard({
          readOnly: true,
          readOnlyNote: "This promise is ready for your confirmation. Other promises still accept evidence while the season is reviewed.",
          detailHot: "w1.open-reviewing-promise",
          detailLabel: "Review confirmation",
        }),
      );
      break;
    case "cancelled-cycle":
      content = pagepad(
        banner("This season was cancelled — “funding fell through for the rains”. Its history stays with the garden.", "stone", "information-line"),
        card(`<div class="t-title">Season of First Rains</div><div class="t-meta num">8 promises made · 5 kept</div>`),
      );
      break;
    case "paused-cancelled-cycle":
      content = pagepad(
        banner("The pool remains paused — “seasonal flooding, back after the rains”. This season was cancelled, and its history stays with the garden.", "amber", "error-warning-line"),
        card(`<div class="cardrow"><div class="grow"><div class="t-title">Season of First Rains</div><div class="t-meta num">8 promises made · 5 kept</div></div>${chip("Cancelled", "plain", { dot: true })}</div>`),
      );
      break;
    case "support-queued":
      content = pagepad(
        seasonCard(),
        banner("Your service offer is saved on this device and will send when connected.", "stone", "wifi-off-line"),
        hot(
          "w1.queued-card",
          card(
            `<div class="cardrow">${chip("Offer", "offer")}${chip("Support / service", "plain")}${chip("Queued", "queued")}</div><div class="t-title">Repair tool handles</div><div class="t-meta">1 repair session · Tool library campaign</div><div class="t-meta">João can take it up after the offer reaches the pool.</div>`,
          ),
        ),
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
        // The browse section owns its own header, and the scope control rides
        // in it as a labelled select: two stacked segmented rows put nine pills
        // between the cycle cards and the first promise. The filter chips are
        // the locked chip set (§5.2) and stay a chip row.
        sectionTitle("Open promises", hot("w1.scope", input("All current", { select: true, ariaLabel: "Scope" }))),
        `<div class="brow">${hot("w1.offer", btn("Offer support", { kind: "pri" }))}${hot("w1.request", btn("Request help", { kind: "sec" }))}</div>`,
        hot("w1.filters", seg(["All", "Offers", "Requests", "Matched", "Mine"], 0)),
        offerCard(),
        requestCard(),
      );
  }

  const sync =
    state === "queued" || state === "support-queued" || state === "request-queued"
      ? syncBar("1 promise waiting to send")
      : state === "sync-failed"
        ? syncBar("1 item needs attention")
        : "";
  const offline = state === "queued" || state === "support-queued" || state === "request-queued" || state === "sync-failed";
  return phoneFrame(`${head}${tabs}${content}<div style="flex:1"></div>${sync}`, { offline });
}

const W1_HOTS: HifiDef["hots"] = {
  "w1.offer": { l: "Offer support", to: "screen:W3", info: "Starts the creation flow with direction = offer (UX:120)." },
  "w1.request": { l: "Request help", to: "screen:W3@request-variant", info: "Creation flow with direction = request (UX:153)." },
  "w1.take-up": { l: "Take this up (open claim)", to: "screen:W2", info: "Open mode: claim job → optimistic Accepted (UX:129).", calls: ["claimCommitment"], facts: { commitment: "Offered", kind: "DomainImpact" } },
  "w1.take-up-request": { l: "I can help (open request)", to: "screen:W2@request-active", info: "Open mode: the claimant becomes the provider and the request creator remains the confirmer.", calls: ["claimCommitment"], facts: { commitment: "Requested", kind: "SupportService" } },
  "w1.take-up-campaign-request": { l: "I can help (campaign request)", to: "screen:W2@campaign-request-active", info: "Open mode preserves the Market rides Campaign binding while the claimant becomes provider.", calls: ["claimCommitment"], facts: { commitment: "Requested", kind: "SupportService" } },
  "w1.open-paused-promise": { l: "Open promise while paused", to: "screen:W2@active", info: "Pause blocks new participation and confirmation, not browsing, evidence, linkage, cancellation, expiry, or dispute recovery (UX:60)." },
  "w1.open-reviewing-promise": { l: "Review confirmation", to: "screen:W2@ready-confirmer", info: "Reviewing keeps evidence and confirmation available; this selected promise is already ReadyForConfirmation (UX:74)." },
  "w1.campaign-market": { l: "Open Market rides campaign", to: "screen:W1@campaign-market", info: "Campaigns remain independently usable when no Season is open (UX:127)." },
  "w1.campaign-tools": { l: "Open Tool library campaign", to: "screen:W1@campaign-tools", info: "A Reviewing campaign stays independently browseable and keeps evidence and confirmation available (UX:74,127)." },
  "w1.campaigns-back": { l: "Back to campaigns", to: "screen:W1@no-season", info: "Returns to the no-Season pool home with both Campaigns available." },
  "w1.open-tools-promise": { l: "Review Tool library confirmation", to: "screen:W4@confirm-support", info: "Opens a SupportService promise that remains confirmable while its Campaign is Reviewing." },
  "w1.ask-take-up": { l: "Ask to take this up (steward-reviewed)", to: "screen:W1@claim-pending", info: "Approval-gated: creates a claim request with stored terms; the commitment stays available to others (UX:99).", calls: ["claimCommitment"], facts: { commitment: "Requested", kind: "SupportService" } },
  "w1.ask-again": { l: "Ask again", to: "screen:W1@claim-pending", info: "Creates a FRESH request while the commitment is claimable — never retries the declined row (UX:105).", calls: ["claimCommitment"], facts: { commitment: "Requested", kind: "SupportService" } },
  "w1.back-browse": { l: "Back to browsing", to: "screen:W1", info: "Declined/superseded exits return to browse." },
  "w1.open-commitment": { l: "Open the promise", to: "screen:W2@request-active", info: "Acceptance opens the same request record with the accepted claimant as provider (UX:104)." },
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
  ["active", "Active"], ["evidence-queued", "Evidence queued"],
  ["evidence-submitted", "Evidence in"], ["partially-approved", "Partly approved"],
  ["ready-confirmer", "Ready — confirmer view"], ["confirmation-pending", "Confirmation queued"],
  ["fulfilled", "Fulfilled"], ["fulfilled-pool-fallback", "Fulfilled — garden fallback"],
  ["fulfilled-protocol-fallback", "Fulfilled — Green Goods team fallback"],
  ["reward-released", "Reward released"],
  ["support-queued", "Support queued"], ["support-en-route", "Support on its way"], ["support-delayed", "Delivery delayed"],
  ["support-executed", "Celo executed"], ["support-confirming", "Confirming arrival"],
  ["support-arrived", "Support arrived"], ["support-failed", "Support failed"],
  ["support-cancelled-queued", "Support withdrawn"], ["support-cancelled-failed", "Support closed after failed delivery"],
  ["reconciled", "Reconciled"], ["cancelled", "Cancelled"], ["expired", "Expired"],
  ["disputed", "Under review"], ["captured", "Recorded for you"],
  ["captured-evidence-queued", "Recorded — evidence queued"],
  ["captured-evidence-submitted", "Recorded — evidence in"],
  ["captured-ready-pending", "Recorded — readiness queued"],
  ["captured-ready-confirmer", "Recorded — ready"], ["captured-confirmation-pending", "Recorded — confirmation queued"],
  ["captured-fulfilled", "Recorded — fulfilled"],
  ["captured-disputed", "Recorded — steward review"],
  ["withdraw-confirm", "Withdraw — confirm"], ["withdrawn", "Withdrawn (yours)"],
  ["garden-provider", "Your garden provides"], ["garden-support-arrived", "Support reached your garden"],
  ["request-active", "Request — helper working"], ["campaign-request-active", "Campaign request — helper working"],
  ["campaign-request-evidence-queued", "Campaign request — evidence queued"],
  ["campaign-request-evidence-submitted", "Campaign request — evidence in"],
  ["campaign-request-ready-pending", "Campaign request — readiness queued"],
  ["campaign-request-ready-confirmer", "Campaign request — ready"],
  ["campaign-request-confirmation-pending", "Campaign request — confirmation queued"],
  ["campaign-request-fulfilled", "Campaign request — fulfilled"], ["campaign-request-disputed", "Campaign request — review"],
  ["request-evidence-queued", "Request — evidence queued"], ["request-evidence-submitted", "Request — evidence in"],
  ["request-ready-pending", "Request — readiness queued"], ["request-ready-confirmer", "Request — ready"],
  ["request-confirmation-pending", "Request — confirmation queued"],
  ["request-fulfilled", "Request — help arrived"], ["request-disputed", "Request — steward review"],
  ["support-offered", "Service offer — open"], ["support-active", "Service offer — active"],
  ["support-evidence-queued", "Service offer — evidence queued"],
  ["support-evidence-submitted", "Service offer — evidence in"], ["support-ready-pending", "Service offer — readiness queued"],
  ["support-ready-confirmer", "Service offer — ready"],
  ["support-confirmation-pending", "Service offer — confirmation queued"],
  ["support-fulfilled", "Service offer — fulfilled"], ["support-cancelled", "Service offer — cancelled"],
  ["support-disputed", "Service offer — steward review"],
  ["loading", "Loading"], ["not-found", "Not found"], ["read-error", "Read error"],
] as const;
type W2State = (typeof W2_STATES)[number][0];
type W2ChipState = Exclude<W2State, "loading" | "not-found" | "read-error">;

const w2StateChip: Record<W2ChipState, string> = {
  accepted: "Accepted", offered: "Offered", requested: "Requested", active: "Active",
  "evidence-queued": "Active", "evidence-submitted": "Evidence in", "partially-approved": "Partly approved",
  "ready-confirmer": "Ready to confirm", "confirmation-pending": "Ready to confirm",
  fulfilled: "Fulfilled", "fulfilled-pool-fallback": "Fulfilled",
  "fulfilled-protocol-fallback": "Fulfilled", "reward-released": "Fulfilled",
  "support-queued": "Fulfilled", "support-en-route": "Fulfilled", "support-delayed": "Fulfilled",
  "support-executed": "Fulfilled", "support-confirming": "Fulfilled", "support-arrived": "Fulfilled",
  "support-failed": "Fulfilled", "support-cancelled-queued": "Fulfilled", "support-cancelled-failed": "Fulfilled",
  reconciled: "Reconciled",
  cancelled: "Cancelled", expired: "Expired", disputed: "Under review", captured: "Accepted",
  "captured-evidence-queued": "Active", "captured-evidence-submitted": "Evidence in",
  "captured-ready-pending": "Evidence in", "captured-ready-confirmer": "Ready to confirm",
  "captured-confirmation-pending": "Ready to confirm",
  "captured-fulfilled": "Fulfilled", "captured-disputed": "Under review",
  "withdraw-confirm": "Offered", withdrawn: "Withdrawn",
  "garden-provider": "Accepted", "garden-support-arrived": "Fulfilled",
  "request-active": "Active", "campaign-request-active": "Active",
  "campaign-request-evidence-queued": "Active", "campaign-request-evidence-submitted": "Evidence in",
  "campaign-request-ready-pending": "Evidence in", "campaign-request-ready-confirmer": "Ready to confirm",
  "campaign-request-confirmation-pending": "Ready to confirm",
  "campaign-request-fulfilled": "Fulfilled", "campaign-request-disputed": "Under review",
  "request-evidence-queued": "Active",
  "request-evidence-submitted": "Evidence in", "request-ready-pending": "Evidence in",
  "request-ready-confirmer": "Ready to confirm", "request-confirmation-pending": "Ready to confirm",
  "request-fulfilled": "Fulfilled", "request-disputed": "Under review",
  "support-offered": "Offered", "support-active": "Active", "support-evidence-queued": "Active",
  "support-evidence-submitted": "Evidence in", "support-ready-pending": "Evidence in",
  "support-ready-confirmer": "Ready to confirm", "support-confirmation-pending": "Ready to confirm",
  "support-fulfilled": "Fulfilled", "support-cancelled": "Cancelled",
  "support-disputed": "Under review",
};

const W2_REQUEST = new Set<string>([
  "request-active", "request-evidence-queued", "request-evidence-submitted",
  "request-ready-pending", "request-ready-confirmer", "request-confirmation-pending",
  "request-fulfilled", "request-disputed",
]);
const W2_CAMPAIGN_REQUEST = new Set<string>([
  "campaign-request-active", "campaign-request-evidence-queued", "campaign-request-evidence-submitted",
  "campaign-request-ready-pending", "campaign-request-ready-confirmer",
  "campaign-request-confirmation-pending",
  "campaign-request-fulfilled", "campaign-request-disputed",
]);
const W2_SUPPORT = new Set<string>([
  "support-offered", "support-active", "support-evidence-queued",
  "support-evidence-submitted", "support-ready-pending", "support-ready-confirmer", "support-fulfilled",
  "support-confirmation-pending",
  "support-cancelled", "support-disputed",
]);
const W2_CAPTURED = new Set<string>([
  "captured", "captured-evidence-queued", "captured-evidence-submitted",
  "captured-ready-pending", "captured-ready-confirmer", "captured-confirmation-pending",
  "captured-fulfilled", "captured-disputed",
]);
const W2_WORK = new Set<W2State>(["accepted", "active", "evidence-queued", "evidence-submitted", "partially-approved"]);
const W2_GARDEN = new Set<string>(["garden-provider", "garden-support-arrived"]);
type PromiseCast = "offer" | "request" | "campaign-request" | "support" | "captured" | "garden";
const w2Cast = (state: W2State): PromiseCast =>
  W2_GARDEN.has(state) ? "garden"
  : W2_CAMPAIGN_REQUEST.has(state) ? "campaign-request"
  : W2_REQUEST.has(state) ? "request"
  : W2_SUPPORT.has(state) ? "support"
  : W2_CAPTURED.has(state) ? "captured"
  : "offer";
const W2_IDENTITY: Record<PromiseCast, { title: string; meta: string; chips: string }> = {
  offer: {
    title: "Prune the north beds",
    meta: "6 hours · due Aug 12 · Season of First Rains",
    chips: chip("Offer", "offer") + chip("AGRO", "domain"),
  },
  request: {
    title: "Ride to the market on Saturday",
    meta: "1 ride · runs with the season · Season of First Rains",
    chips: chip("Request", "request"),
  },
  "campaign-request": {
    title: "Ride to the market on Saturday",
    meta: "1 ride · Market rides campaign",
    chips: chip("Request", "request") + chip("Campaign", "plain"),
  },
  support: {
    title: "Repair tool handles",
    meta: "1 repair session · Tool library campaign",
    chips: chip("Offer", "offer") + chip("Support / service", "plain"),
  },
  captured: {
    title: "Compost workshop",
    meta: "3 sessions · recorded for Kwame · Season of First Rains",
    chips: chip("Offer", "offer") + chip("Recorded for you", "plain"),
  },
  garden: {
    title: "Methodology survey",
    meta: "1 survey · due Aug 12 · Protocol pool",
    chips: chip("Protocol", "ink") + chip("Request", "request"),
  },
};

function w2RewardRow(state: W2State): string {
  const gardenBeneficiary = state === "garden-provider" || state === "garden-support-arrived";
  const settlementReward = state.startsWith("support-") || gardenBeneficiary;
  const rewardMeta = gardenBeneficiary
    ? "25 G$ to Awka Hub's Celo account"
    : settlementReward
      ? "20 G$ from the garden's Celo account"
      : "20 DAI from the garden jar";
  const line = (label: string, v: string, tone?: "ok" | "warn") =>
    hot(
      "w2.reward-row",
      card(
        `<div class="cardrow"><div class="grow"><div class="t-title" style="font-size:14.5px">Reward</div><div class="t-meta num">${rewardMeta}</div></div>${chip(v, tone ?? "plain", { dot: true })}</div><div class="t-meta">${label}</div>`,
        { cls: "flat" },
      ),
    );
  switch (state) {
    case "garden-provider":
      return line("Support goes to the providing garden, not to an individual — it is queued once the promise is confirmed.", "Pending", "warn");
    case "garden-support-arrived":
      return line("It reached the garden's own Celo account ↗ — the reference is in Details.", "Arrived", "ok");
    case "reward-released":
      return line("Recorded by your steward — reference only, value moves outside the app.", "Reward released", "ok");
    case "support-queued":
      return line("Support on its way (G$).", "On its way");
    case "support-en-route":
      return line("Support on its way (G$).", "On its way");
    case "support-delayed":
      return line("Support on its way — delivery delayed. Your promise remains recorded.", "Delayed", "warn");
    case "support-executed":
      return line("Support on its way (G$).", "On its way");
    case "support-confirming":
      return line("Support on its way (G$).", "On its way");
    case "support-arrived":
      return line("Support arrived ↗ — reference in Details.", "Arrived", "ok");
    case "support-failed":
      return line("Support is being rearranged — your promise is recorded and stays kept.", "Being rearranged", "warn");
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
  if (state === "offered" || state === "withdraw-confirm")
    return [{ label: "Offered", meta: "Maria · Jul 2 — waiting for someone to take it up", open: true }];
  if (state === "requested") return [{ label: "Requested", meta: "Ana · Jul 2 — stewards review who takes this up", open: true }];

  if (W2_CAMPAIGN_REQUEST.has(state)) {
    const campaignAsked: Moment[] = [
      { label: "Requested", meta: "Market rides Campaign · Ana · Jul 2" },
      { label: "João can help", meta: "took this up · Jul 5" },
    ];
    if (state === "campaign-request-active")
      return [...campaignAsked, { label: "Getting it done", meta: "waiting on the ride", open: true }];
    if (state === "campaign-request-evidence-queued")
      return [...campaignAsked, { label: "Evidence queued", meta: "saved on this device · waiting to send", open: true }];
    if (state === "campaign-request-evidence-submitted")
      return [...campaignAsked, { label: "Evidence in", meta: "photo from the market · Jul 6", open: true }];
    if (state === "campaign-request-ready-pending")
      return [...campaignAsked, { label: "Evidence in", meta: "photo from the market · Jul 6" }, { label: "Readiness queued", meta: "saved on this device · waiting to send", open: true }];
    if (state === "campaign-request-ready-confirmer")
      return [...campaignAsked, { label: "Evidence in", meta: "photo from the market · Jul 6" }, { label: "Ready to confirm", meta: "waiting on Ana", open: true }];
    if (state === "campaign-request-confirmation-pending")
      return [...campaignAsked, { label: "Evidence in", meta: "photo from the market · Jul 6" }, { label: "Confirmation queued", meta: "Ana · saved on this device", open: true }];
    if (state === "campaign-request-disputed")
      return [...campaignAsked, { label: "Under steward review", meta: "Ana recorded what still needs doing", open: true }];
    return [...campaignAsked, { label: "Evidence in", meta: "photo from the market · Jul 6" }, { label: "Promise kept", meta: "confirmed by Ana · Jul 6", open: true }];
  }
  if (W2_REQUEST.has(state)) {
    const asked: Moment[] = [
      { label: "Requested", meta: "Ana · Jul 2" },
      { label: "João can help", meta: "took this up · Jul 5" },
    ];
    if (state === "request-active") return [...asked, { label: "Getting it done", meta: "waiting on the ride", open: true }];
    if (state === "request-evidence-queued")
      return [...asked, { label: "Evidence queued", meta: "saved on this device · waiting to send", open: true }];
    if (state === "request-evidence-submitted")
      return [...asked, { label: "Evidence in", meta: "photo from the market · Jul 6", open: true }];
    if (state === "request-ready-pending")
      return [...asked, { label: "Evidence in", meta: "photo from the market · Jul 6" }, { label: "Readiness queued", meta: "saved on this device · waiting to send", open: true }];
    if (state === "request-ready-confirmer")
      return [...asked, { label: "Evidence in", meta: "photo from the market · Jul 6" }, { label: "Ready to confirm", meta: "waiting on Ana", open: true }];
    if (state === "request-confirmation-pending")
      return [...asked, { label: "Evidence in", meta: "photo from the market · Jul 6" }, { label: "Confirmation queued", meta: "Ana · saved on this device", open: true }];
    if (state === "request-disputed")
      return [...asked, { label: "Under steward review", meta: "Ana recorded what still needs doing", open: true }];
    return [...asked, { label: "Evidence in", meta: "photo from the market · Jul 6" }, { label: "Promise kept", meta: "confirmed by Ana · Jul 6", open: true }];
  }
  if (W2_SUPPORT.has(state)) {
    if (state === "support-offered")
      return [{ label: "Offered", meta: "Maria · Jul 2", open: true }];
    const offered: Moment[] = [
      { label: "Offered", meta: "Maria · Jul 2" },
      { label: "Accepted", meta: "João took this up · Jul 3" },
    ];
    if (state === "support-active") return [...offered, { label: "Getting it done", meta: "waiting on the repair", open: true }];
    if (state === "support-evidence-queued")
      return [...offered, { label: "Evidence queued", meta: "saved on this device · waiting to send", open: true }];
    if (state === "support-evidence-submitted")
      return [...offered, { label: "Evidence in", meta: "photo of repaired handles · Jul 6", open: true }];
    if (state === "support-ready-pending")
      return [...offered, { label: "Evidence in", meta: "photo of repaired handles · Jul 6" }, { label: "Readiness queued", meta: "saved on this device · waiting to send", open: true }];
    if (state === "support-ready-confirmer")
      return [...offered, { label: "Evidence in", meta: "photo of repaired handles · Jul 6" }, { label: "Ready to confirm", meta: "waiting on João", open: true }];
    if (state === "support-confirmation-pending")
      return [...offered, { label: "Evidence in", meta: "photo of repaired handles · Jul 6" }, { label: "Confirmation queued", meta: "João · saved on this device", open: true }];
    if (state === "support-cancelled")
      return [...offered, { label: "Cancelled", meta: "steward · Jul 9", note: "“withdrawn by agreement at the gathering”", warn: true, open: true }];
    if (state === "support-disputed")
      return [...offered, { label: "Under steward review", meta: "João recorded what still needs doing", open: true }];
    return [...offered, { label: "Evidence in", meta: "photo of repaired handles · Jul 6" }, { label: "Promise kept", meta: "confirmed by João · Jul 6", open: true }];
  }
  if (W2_CAPTURED.has(state)) {
    const recorded: Moment[] = [
      { label: "Recorded for Kwame", meta: "steward record · Jul 2" },
      { label: "Accepted", meta: "João took this up · Jul 3" },
    ];
    if (state === "captured")
      return [...recorded, { label: "Getting it done", meta: "waiting on the workshop", open: true }];
    if (state === "captured-evidence-queued")
      return [...recorded, { label: "Evidence queued", meta: "saved on this device · waiting to send", open: true }];
    if (state === "captured-evidence-submitted")
      return [...recorded, { label: "Evidence in", meta: "workshop photo · Jul 6", open: true }];
    if (state === "captured-ready-pending")
      return [...recorded, { label: "Evidence in", meta: "workshop photo · Jul 6" }, { label: "Readiness queued", meta: "saved on this device · waiting to send", open: true }];
    if (state === "captured-ready-confirmer")
      return [...recorded, { label: "Evidence in", meta: "workshop photo · Jul 6" }, { label: "Ready to confirm", meta: "waiting on João", open: true }];
    if (state === "captured-confirmation-pending")
      return [...recorded, { label: "Evidence in", meta: "workshop photo · Jul 6" }, { label: "Confirmation queued", meta: "Ana · saved on this device", open: true }];
    if (state === "captured-disputed")
      return [...recorded, { label: "Under steward review", meta: "Ana recorded what still needs doing", open: true }];
    return [...recorded, { label: "Evidence in", meta: "workshop photo · Jul 6" }, { label: "Promise kept", meta: "confirmed by João · Jul 6", open: true }];
  }
  if (state === "garden-provider")
    return [
      { label: "Requested", meta: "protocol pool · Jul 2" },
      { label: "Accepted", meta: "Awka Hub took this up · asked by you · Jul 5", open: true },
    ];
  if (state === "garden-support-arrived")
    return [
      { label: "Requested", meta: "protocol pool · Jul 2" },
      { label: "Accepted", meta: "Awka Hub took this up · Jul 5" },
      { label: "Evidence in", meta: "survey sheet · Jul 10" },
      { label: "Promise kept", meta: "confirmed by Sofia · ordinary named confirmation · Jul 12", open: true },
    ];
  const opened: Moment[] = [
    { label: "Offered", meta: "Maria · Jul 2" },
    { label: "Accepted", meta: "João took this up · Jul 3" },
  ];
  if (state === "evidence-queued")
    return [...opened, { label: "Evidence queued", meta: "saved on this device · waiting to send", open: true }];
  if (state === "withdrawn")
    return [
      { label: "Offered", meta: "you · Jul 2" },
      { label: "Withdrawn", meta: "you · Jul 9", note: "“plans changed — the beds got done at the gathering”", warn: true, open: true },
    ];
  if (state === "cancelled")
    return [...opened, { label: "Cancelled", meta: "steward · Jul 9", note: "“withdrawn by agreement at the gathering”", warn: true, open: true }];
  if (state === "expired")
    return [...opened, { label: "Expired", meta: "ran through Aug 12", warn: true, open: true }];

  const worked: Moment[] = [...opened, { label: "Work linked", meta: "pruning session · Jul 8" }];
  if (state === "confirmation-pending")
    return [...worked, { label: "Confirmation queued", meta: "João · saved on this device", open: true }];
  if (state === "disputed")
    return [...worked, { label: "Under review by stewards", meta: "Jul 10", note: "“the far bed is still overgrown”", warn: true, open: true }];

  const ready: Moment = overrideNote
    ? { label: "Ready", meta: "steward note", note: "“confirmed on site visit” (steward record)", warn: true }
    : { label: "Ready to confirm", meta: "waiting on João", open: true };
  if (state === "fulfilled-pool-fallback")
    return [...worked, { ...ready, open: false }, { label: "Promise kept", meta: "confirmed by garden steward — fallback · David · Jul 12", note: "“confirmed at the field gathering”", open: true }];
  if (state === "fulfilled-protocol-fallback")
    return [...worked, { ...ready, open: false }, { label: "Promise kept", meta: "confirmed by Green Goods team — fallback · Sofia · Jul 12", note: "“no eligible local confirmer”", open: true }];
  if (state === "fulfilled" || state === "reconciled" || W2_SETTLED.has(state))
    return [...worked, { ...ready, open: false }, { label: "Promise kept", meta: "confirmed by João · Jul 12", open: true }];
  return [...worked, ready];
}

const w2Disclosures = (state: W2State, opts: { work?: boolean; overrideNote?: boolean } = {}) => {
  const moments = w2Moments(state, !!opts.overrideNote);
  const cast = w2Cast(state);
  const rosterFrozen =
    state.includes("ready") ||
    state.includes("confirmation-pending") ||
    state.includes("fulfilled") ||
    state === "reconciled" ||
    W2_SETTLED.has(state);
  const teamHot = rosterFrozen ? "w2.open-team-frozen" : "w2.open-team-forming";
  // Nothing has been done yet on an unclaimed promise — no evidence, no work.
  const preAcceptance =
    state === "offered" || state === "requested" || state === "support-offered" ||
    state === "withdraw-confirm" || state === "withdrawn";
  const evidenceQueued =
    state === "evidence-queued" || state === "support-evidence-queued" || state === "request-evidence-queued" ||
    state === "campaign-request-evidence-queued" || state === "captured-evidence-queued";
  const evidence =
    cast === "support"
      ? listRow({
          icon: "image-line",
          primary: "Tool handles after repair",
          meta: evidenceQueued ? "Photo · saved on this device" : "Photo · Jul 6",
          chipHtml: evidenceQueued ? chip("Queued", "queued") : undefined,
        })
      : cast === "request" || cast === "campaign-request"
        ? listRow({
            icon: "image-line",
            primary: "Ride arrived at the market",
            meta: evidenceQueued ? "Photo · saved on this device" : "Photo · Jul 6",
            chipHtml: evidenceQueued ? chip("Queued", "queued") : undefined,
          })
        : cast === "captured"
          ? listRow({
              icon: "image-line",
              primary: "Compost workshop underway",
              meta: evidenceQueued ? "Photo · saved on this device" : "Photo · Jul 6",
              chipHtml: evidenceQueued ? chip("Queued", "queued") : undefined,
            })
          : cast === "garden"
            ? listRow({ icon: "file-copy-line", primary: "Methodology survey sheet", meta: "Document · Jul 10" })
            : listRow({ icon: "image-line", primary: "North beds after", meta: "Photo · Jul 8" }) +
              listRow({ icon: "sticky-note-line", primary: "“Two beds left for next week”", meta: "Note · Jul 8" });
  const evidenceCount = evidenceQueued ? "1 queued" : cast === "offer" ? "2 items" : "1 item";
  const scope =
    cast === "support" ? kv("Campaign", "Tool library")
    : cast === "campaign-request" ? kv("Campaign", "Market rides")
    : cast === "garden" ? kv("Pool", "Protocol")
    : kv("Season", "First Rains");
  return (
    disclosure(
      "Timeline",
      `${moments.length} ${moments.length === 1 ? "moment" : "moments"}`,
      timeline(moments) + `<div class="t-meta">Recorded on Arbitrum · every steward record shows its reason here.</div>`,
    ) +
    disclosure(
      "People",
      cast === "garden" ? "garden team · 3 credited" : "1 lead · 2 contributors",
      cast === "garden"
        ? `${listRow({ icon: "group-line", primary: "Awka Hub", meta: "Accountable provider garden" })}${listRow({ icon: "user-line", primary: "Leila", meta: "Lead · credited contributor" })}${listRow({ icon: "group-line", primary: "Amara · Chidi", meta: "Contributors · credited from approved work" })}${hot(teamHot, btn("See team and contributions", { kind: "ghost", sm: true }))}`
        : `${listRow({ icon: "user-line", primary: "Maria", meta: "Accountable lead" })}${listRow({ icon: "group-line", primary: "Ana · Kwame", meta: "Contributors · credited from approved work" })}${hot(teamHot, btn("See team and contributions", { kind: "ghost", sm: true }))}`,
    ) +
    (preAcceptance
      ? ""
      : disclosure(
          "Evidence",
          evidenceCount,
          evidence,
        )) +
    (preAcceptance || opts.work === false
      ? ""
      : disclosure(
          "Work for this promise",
          "1 approved",
          listRow({ icon: "check-line", primary: "Pruning session", meta: "Approved · Jul 8", chipHtml: chip("Approved", "ok") }) +
            `<div class="brow">${hot("w2.submit-work", btn("Submit work", { kind: "sec" }))}${hot("w2.link-work", btn("Link existing work", { kind: "ghost" }))}</div>`,
        )) +
    hot(
      "w2.details",
      disclosure("Details", "ids & records", `${kv("Commitment", "0x8c…41f2")}${kv("Recorded on", "Arbitrum")}${scope}`),
    )
  );
};

function w2(state: W2State): string {
  // Sample identity follows the promise, not the fixture. A request is a
  // different promise from the offer — different title, unit and cast — and the
  // header is the first thing that has to say so.
  const ident = W2_IDENTITY[w2Cast(state)];
  const head = hdr(ident.title, { back: true });
  // Read-surface recovery states short-circuit before the state chip is computed.
  const readWrap = (inner: string) => phoneFrame(`${head}${inner}<div style="flex:1"></div>`);
  if (state === "loading")
    return readWrap(pagepad(skeleton({ title: true, lines: 1 }), skeleton({ avatar: true, lines: 3 }), skeleton({ lines: 2 })));
  if (state === "not-found")
    return readWrap(pagepad(emptyState("search-line", "Promise not found", "We couldn't find this promise. It may have been withdrawn, or it hasn't synced to this device yet.", hot("w2.retry", btn("Try again", { kind: "sec", icon: "refresh-line" })))));
  if (state === "read-error")
    return readWrap(pagepad(emptyState("wifi-off-line", "Couldn't load this promise", "Something went wrong reaching the network. Check your connection and try again.", hot("w2.retry", btn("Try again", { kind: "pri", icon: "refresh-line" })))));
  const chips = `<div class="cardrow">${ident.chips}${stateChip(w2StateChip[state])}</div>`;
  const meta = `<div class="hsub num">${ident.meta}</div>`;

  const capturedChip =
    W2_CAPTURED.has(state)
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
    case "evidence-queued":
      band = card(
        `<div class="t-title">Evidence saved on this device</div><div class="t-meta">It will send when connected. The credited-contributor vector stays attached to this queued item, and Work progress does not change until sync.</div>`,
      );
      break;
    case "request-active":
      band = card(
        `<div class="t-title">João is helping</div><div class="t-meta">Add evidence as it happens — Ana asked for this, so Ana confirms it was done.</div><div class="brow">${hot("w2.add-evidence-request", btn("Add evidence", { kind: "pri", icon: "camera-line" }))}</div>`,
      );
      break;
    case "campaign-request-active":
      band = card(
        `<div class="t-title">João is helping with this Campaign request</div><div class="t-meta">The Market rides Campaign remains the scope. Add evidence as the ride happens.</div><div class="brow">${hot("w2.add-evidence-campaign-request", btn("Add evidence", { kind: "pri", icon: "camera-line" }))}</div>`,
      );
      break;
    case "campaign-request-evidence-queued":
      band = card(
        `<div class="t-title">Campaign evidence saved on this device</div><div class="t-meta">It will send when connected. The Market rides Campaign remains the scope.</div>`,
      );
      break;
    case "campaign-request-evidence-submitted":
      band = card(
        `<div class="t-title">Evidence attached: 1 · no work required</div><div class="t-meta">Ana confirms this Market rides Campaign request.</div>${hot("w2.send-confirmation-campaign-request", btn("Send for confirmation", { kind: "pri", full: true }))}`,
      );
      break;
    case "campaign-request-ready-pending":
      band = card(
        `<div class="t-title">Campaign readiness saved on this device</div><div class="t-meta">The promise stays Evidence in until this sends. Its Campaign binding does not change.</div>`,
      );
      break;
    case "campaign-request-ready-confirmer":
      band = card(
        `<div class="t-title">Ready to confirm</div><div class="t-meta">Ana confirms the Market rides Campaign request. João, who provided it, cannot.</div>${hot("w2.confirm-campaign-request-detail", btn("Review confirmation", { kind: "pri", full: true }))}`,
      );
      break;
    case "campaign-request-confirmation-pending":
      band = card(
        `<div class="t-title">Confirmation waiting to send</div><div class="t-meta">Ana's saved confirmation stays with this Market rides Campaign request. No second confirmation is available while it syncs.</div>`,
      );
      break;
    case "campaign-request-fulfilled":
      band = card(hero("Help arrived", "Confirmed by Ana · the Market rides Campaign count just grew", "checkbox-circle-fill"));
      break;
    case "request-evidence-queued":
      band = card(
        `<div class="t-title">Evidence saved on this device</div><div class="t-meta">It will send when connected. Readiness stays unavailable until the evidence reaches Ana's request.</div>`,
      );
      break;
    case "request-evidence-submitted":
      band = card(
        `<div class="t-title">Evidence attached: 1 · no work required</div><div class="t-meta">Ana asked for this help, so Ana confirms it arrived.</div>${hot("w2.send-confirmation-request", btn("Send for confirmation", { kind: "pri", full: true }))}`,
      );
      break;
    case "request-ready-pending":
      band = card(
        `<div class="t-title">Readiness saved on this device</div><div class="t-meta">The request remains Evidence in until this sends. Ana cannot confirm it twice or before the readiness transition lands.</div>`,
      );
      break;
    case "request-ready-confirmer":
      band = card(
        `<div class="t-title">Ready to confirm</div><div class="t-meta">Ana asked for this help and is the named confirmer. João, who provided it, cannot.</div>${hot("w2.confirm-request-detail", btn("Review confirmation", { kind: "pri", full: true }))}`,
      );
      break;
    case "request-confirmation-pending":
      band = card(
        `<div class="t-title">Confirmation waiting to send</div><div class="t-meta">Ana's saved confirmation is queued. The request stays ready and cannot be confirmed twice while it syncs.</div>`,
      );
      break;
    case "request-fulfilled":
      band = card(
        `<div class="t-title">Help arrived</div><div class="t-meta">Ana confirmed the ride on Jul 6. The season's count just grew.</div>`,
      );
      break;
    case "support-offered":
      band = card(
        `<div class="t-title">Maria's service offer is open</div><div class="t-meta">João can take up the repair before Maria starts attaching evidence.</div><div class="brow">${hot("w2.take-up-support", btn("Take this up", { kind: "pri" }))}</div>`,
      );
      break;
    case "support-active":
      band = card(
        `<div class="t-title">Repair underway</div><div class="t-meta">Add evidence as the tool handles are repaired. This service offer does not require linked garden work.</div><div class="brow">${hot("w2.add-evidence-support", btn("Add evidence", { kind: "pri", icon: "camera-line" }))}</div>`,
      );
      break;
    case "support-evidence-queued":
      band = card(
        `<div class="t-title">Evidence saved on this device</div><div class="t-meta">It will send when connected. Confirmation stays unavailable until the evidence reaches the promise.</div>${listRow({
          icon: "image-line",
          primary: "Tool handles after repair",
          meta: "Photo · waiting to send",
          chipHtml: chip("Queued", "queued"),
        })}`,
      );
      break;
    case "support-evidence-submitted":
      band = card(
        `<div class="t-title">Evidence attached: 1 · no work required</div><div class="t-meta">João is named to confirm the repair.</div>${hot("w2.send-confirmation", btn("Send for confirmation", { kind: "pri", full: true }))}`,
      );
      break;
    case "support-ready-pending":
      band = card(
        `<div class="t-title">Readiness saved on this device</div><div class="t-meta">The service remains Evidence in until this sends. João's confirmation opens after the readiness transition lands.</div>`,
      );
      break;
    case "support-ready-confirmer":
      band = card(
        `<div class="t-title">Ready to confirm</div><div class="t-meta">João was named to confirm this service. Maria, who offered it, cannot.</div>${hot("w2.confirm-support-detail", btn("Review confirmation", { kind: "pri", full: true }))}`,
      );
      break;
    case "support-confirmation-pending":
      band = card(
        `<div class="t-title">Confirmation waiting to send</div><div class="t-meta">João's saved confirmation is queued. The service stays ready and cannot be confirmed twice while it syncs.</div>`,
      );
      break;
    case "support-fulfilled":
      band = card(hero("Promise kept", "Confirmed by João · the campaign's count just grew", "checkbox-circle-fill"));
      break;
    case "captured":
      band = card(
        `<div class="t-title">Workshop underway</div><div class="t-meta">This recorded-for-Kwame promise is evidence-only. Add evidence without introducing a garden-work approval requirement.</div><div class="brow">${hot("w2.add-evidence-captured", btn("Add evidence", { kind: "pri", icon: "camera-line" }))}</div>`,
      );
      break;
    case "captured-evidence-queued":
      band = card(
        `<div class="t-title">Evidence saved on this device</div><div class="t-meta">It will send when connected. The recorded promise keeps its StewardCaptured path.</div>`,
      );
      break;
    case "captured-evidence-submitted":
      band = card(
        `<div class="t-title">Evidence attached: 1 · no work required</div><div class="t-meta">The named counterparty confirms this recorded promise.</div>${hot("w2.send-confirmation-captured", btn("Send for confirmation", { kind: "pri", full: true }))}`,
      );
      break;
    case "captured-ready-pending":
      band = card(
        `<div class="t-title">Readiness saved on this device</div><div class="t-meta">The record remains Evidence in until this sends; confirmation stays unavailable meanwhile.</div>`,
      );
      break;
    case "captured-ready-confirmer":
      band = card(
        `<div class="t-title">Ready to confirm</div><div class="t-meta">The lead provider remains excluded. The named counterparty reviews the captured promise.</div>${hot("w2.confirm-captured-detail", btn("Review confirmation", { kind: "pri", full: true }))}`,
      );
      break;
    case "captured-confirmation-pending":
      band = card(
        `<div class="t-title">Confirmation waiting to send</div><div class="t-meta">The saved confirmation stays with Kwame's recorded promise and cannot be submitted twice while it syncs.</div>`,
      );
      break;
    case "captured-fulfilled":
      band = card(hero("Promise kept", "The captured promise was confirmed after its evidence synced", "checkbox-circle-fill"));
      break;
    case "garden-provider":
      band = card(
        `<div class="t-title">Your garden is providing this</div><div class="t-meta">Add evidence as Awka gardeners run the survey. The protocol stewards confirm it when it is done.</div><div class="brow">${hot("w2.add-evidence", btn("Add evidence", { kind: "pri", icon: "camera-line" }))}</div>`,
      );
      break;
    case "garden-support-arrived":
      band = card(
        `<div class="t-title">Promise kept — your garden provided it</div><div class="t-meta">Confirmed by the protocol stewards on Jul 12. The support went to the garden's own account.</div>`,
      );
      break;
    case "withdrawn":
      band = card(
        `<div class="t-title">You withdrew this offer</div><div class="t-meta">It has left the pool. The record and the reason you gave stay in the timeline below.</div>`,
      );
      break;
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
        `<div class="t-title">Evidence attached: 1</div><div class="t-meta">This is garden work, so approved linked work and its assessment move the promise toward confirmation.</div>`,
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
    case "confirmation-pending":
      band = card(
        `<div class="t-title">Confirmation waiting to send</div><div class="t-meta">Your saved confirmation is queued. This promise stays ready and cannot be confirmed twice while it syncs.</div>`,
      );
      break;
    case "fulfilled":
      band = card(hero("Promise kept", "Confirmed by João · the season's count just grew", "checkbox-circle-fill"));
      break;
    case "fulfilled-pool-fallback":
      band = card(hero("Promise kept", "Confirmed by garden steward — fallback · the reason is in the timeline", "checkbox-circle-fill"));
      break;
    case "fulfilled-protocol-fallback":
      band = card(hero("Promise kept", "Confirmed by Green Goods team — fallback · the reason is in the timeline", "checkbox-circle-fill"));
      break;
    case "expired":
      band = card(
        `<div class="t-title">This promise ran through Aug 12</div><div class="t-meta">The season moved on — you can offer it again.</div>${hot("w2.offer-again", btn("Offer it again", { kind: "pri", full: true }))}`,
      );
      break;
    case "disputed":
    case "request-disputed":
    case "campaign-request-disputed":
    case "support-disputed":
    case "captured-disputed":
      band = banner("Under review by stewards — actions pause here until they resolve it. Every outcome shows its reason in the timeline.", "amber", "error-warning-line");
      break;
    case "cancelled":
      band = banner("Cancelled — the reason is recorded in the timeline.", "stone");
      break;
    case "support-cancelled":
      band = banner("This service promise was cancelled by a steward. The recorded reason stays in the timeline.", "stone");
      break;
    case "reconciled":
      band = banner("This season closed. The promise rolled into the season summary.", "stone", "seedling-line");
      break;
    default:
      band = card(
        `<div class="t-title">Keep the promise moving</div><div class="t-meta">Add evidence as you go. Work that fulfills this promise links from the work section below.</div><div class="brow">${hot("w2.add-evidence", btn("Add evidence", { kind: "pri", icon: "camera-line" }))}</div>`,
      );
  }

  const showReward = ![
    "offered", "requested", "cancelled", "expired", "disputed", "request-disputed",
    "support-disputed", "support-cancelled", "withdraw-confirm", "withdrawn",
    "request-active", "campaign-request-active", "campaign-request-evidence-queued",
    "campaign-request-evidence-submitted", "campaign-request-ready-pending",
    "campaign-request-ready-confirmer", "campaign-request-confirmation-pending",
    "campaign-request-fulfilled", "campaign-request-disputed",
    "request-evidence-queued",
    "request-evidence-submitted", "request-ready-pending", "request-ready-confirmer",
    "request-confirmation-pending", "request-fulfilled",
    "support-offered", "support-active", "support-evidence-queued", "support-evidence-submitted",
    "support-ready-pending", "support-ready-confirmer", "support-confirmation-pending",
    "captured", "captured-evidence-queued", "captured-evidence-submitted",
    "captured-ready-pending", "captured-ready-confirmer", "captured-confirmation-pending",
    "captured-fulfilled", "captured-disputed", "confirmation-pending",
  ].includes(state);
  // Reward/settlement status sits with the band — it is scan-layer status, not
  // deep dive. Disclosures stay last and stay present even under review: the
  // dispute banner tells the member the reason is in the timeline, so hiding
  // the timeline there pointed at nothing.
  const content = pagepad(
    chips.replace('<div class="cardrow">', '<div class="cardrow" style="padding:0 2px">'),
    capturedChip,
    band,
    showReward ? w2RewardRow(state) : "",
    w2Disclosures(state, { overrideNote: state === "captured" || state === "fulfilled", work: W2_WORK.has(state) }),
  );

  // Withdrawing is the member's own irreversible act, so it confirms over the
  // promise it affects and takes the reason the contract stores (CS:145).
  if (state === "withdraw-confirm")
    return phoneFrame(
      sheetOver(
        `${head}${meta}${content}`,
        "Withdraw this offer?",
        `${banner("No one has taken this up yet. Withdrawing removes it from the pool; the record and your reason stay in the timeline.", "stone")}
${field("Reason (required)", input("plans changed — the beds got done at the gathering"))}
${hot("w2.withdraw-send", btn("Withdraw this offer", { kind: "danger", full: true }))}${hot("w2.withdraw-keep", btn("Keep it open", { kind: "ghost", full: true }))}`,
      ),
      { appBar: false },
    );

  // Work/commitment detail hides the bottom AppBar — the back-header is the chrome.
  const evidenceQueued =
    state === "evidence-queued" || state === "support-evidence-queued" || state === "request-evidence-queued" ||
    state === "campaign-request-evidence-queued" || state === "captured-evidence-queued";
  const readinessQueued =
    state === "support-ready-pending" || state === "request-ready-pending" ||
    state === "campaign-request-ready-pending" || state === "captured-ready-pending";
  const confirmationQueued =
    state === "confirmation-pending" || state === "support-confirmation-pending" ||
    state === "request-confirmation-pending" ||
    state === "campaign-request-confirmation-pending" ||
    state === "captured-confirmation-pending";
  const sync = evidenceQueued
    ? syncBar("1 evidence item waiting to send")
    : readinessQueued
      ? syncBar("1 readiness update waiting to send")
      : confirmationQueued
        ? syncBar("1 confirmation waiting to send")
      : "";
  return phoneFrame(`${head}${meta}${content}<div style="flex:1"></div>${sync}`, {
    appBar: false,
    offline: evidenceQueued || readinessQueued || confirmationQueued,
  });
}

const W2_HOTS: HifiDef["hots"] = {
  "w2.take-up-support": { l: "Take up this service offer", to: "screen:W2@support-active", info: "Open claim mode accepts João as the recipient/counterparty; Maria remains the provider.", calls: ["claimCommitment"], facts: { commitment: "Offered", kind: "SupportService" } },
  "w2.open-team-forming": { l: "See editable team and contributions", to: "screen:W2b@forming", info: "Before readiness, the accountable lead can add, remove, and assign contributors through online contract actions." },
  "w2.open-team-frozen": { l: "See frozen team and contributions", to: "screen:W2b@frozen", info: "After readiness, opens the frozen contributor roster and contribution record without implying that every participant receives an equal share." },
  "w2.add-evidence": { l: "Add evidence", to: "screen:W2a", info: "W2a attach sheet: photo / link / note → one evidence job per submit; fully offline (UX:159)." },
  "w2.add-evidence-request": { l: "Add request evidence", to: "screen:W2a@compose-request", info: "Keeps Ana's request and João's provider role intact while opening the shared evidence composer." },
  "w2.add-evidence-campaign-request": { l: "Add campaign-request evidence", to: "screen:W2a@compose-campaign-request", info: "Keeps the Market rides Campaign binding while opening the shared evidence composer." },
  "w2.add-evidence-support": { l: "Add service evidence", to: "screen:W2a@compose-support", info: "Evidence-only SupportService offer: photo / link / note → one offline evidence job (UX:159)." },
  "w2.add-evidence-captured": { l: "Add captured-promise evidence", to: "screen:W2a@compose-captured", info: "Keeps the StewardCaptured kind and the member as promise source while opening the evidence composer." },
  "w2.submit-work": { l: "Submit work for this promise", to: "screen:WFLOW", info: "Deep-links the existing Garden-tab work flow with commitment context (UX:174). DomainImpact only." },
  "w2.link-work": { l: "Link existing work", to: "screen:HUBWORK", info: "Picker selects an approved/pending Work plus one exact requirement row → workLink job carries requirementIndex (UX:140). Repeated action UIDs never use first-match behavior.", calls: ["linkWork"] },
  "w2.confirm": { l: "Confirm: promise kept", to: "screen:W4", info: "Visible only to eligible confirmers while ReadyForConfirmation — the provider never sees it (UX:142)." },
  "w2.send-confirmation": { l: "Send for confirmation", to: "screen:W2@support-ready-pending", info: "Queues the evidence-only readiness transition; DomainImpact is rejected on-chain (CS:138b).", calls: ["submitForConfirmation"], pendingSync: true },
  "w2.confirm-support-detail": { l: "Review service confirmation", to: "screen:W4@confirm-support", info: "Opens the named recipient's confirmation view for this SupportService promise." },
  "w2.send-confirmation-request": { l: "Send request for confirmation", to: "screen:W2@request-ready-pending", info: "Queues submitForConfirmation while keeping Ana as default confirmer and João as provider.", calls: ["submitForConfirmation"], pendingSync: true },
  "w2.confirm-request-detail": { l: "Review request confirmation", to: "screen:W4@confirm-request", info: "Opens only after the request readiness update has synced." },
  "w2.send-confirmation-campaign-request": { l: "Send campaign request for confirmation", to: "screen:W2@campaign-request-ready-pending", info: "Queues readiness without losing the Market rides Campaign binding.", calls: ["submitForConfirmation"], pendingSync: true },
  "w2.confirm-campaign-request-detail": { l: "Review campaign-request confirmation", to: "screen:W4@confirm-campaign-request", info: "Opens the named request creator's confirmation while preserving Campaign scope." },
  "w2.send-confirmation-captured": { l: "Send captured promise for confirmation", to: "screen:W2@captured-ready-pending", info: "StewardCaptured is evidence-only and may call submitForConfirmation without linked work.", calls: ["submitForConfirmation"], pendingSync: true },
  "w2.confirm-captured-detail": { l: "Review captured-promise confirmation", to: "screen:W4@confirm-captured", info: "Opens the named counterparty's confirmation without changing the captured member source." },
  "w2.offer-again": { l: "Offer it again", to: "screen:W3", info: "Per-cycle renewal — a fresh commitment, prefilled (UX:94). Adopted MF-3." },
  "w2.withdraw": { l: "Withdraw (pre-acceptance)", to: "screen:W2@withdraw-confirm", info: "Member pre-acceptance withdraw, adopted MF-2a (register #34b). Steward cancellation remains a separate recorded action with its own outcome state." },
  "w2.withdraw-send": { l: "Withdraw (confirm)", to: "screen:W2@withdrawn", info: "cancelCommitment(commitmentId, reasonCID) on the creator path — Offered/Requested only; no units were committed, so nothing is released (CS:145).", calls: ["cancelCommitment"] },
  "w2.withdraw-keep": { l: "Keep the offer open", to: "screen:W2@offered", info: "Closes the confirmation with the offer still live." },
  "w2.reward-row": { l: "Reward / settlement row", info: "Reference only — no custody. When an integrated G$ settlement exists, it replaces the pending line; “Arrived” requires an authenticated CCIP success acknowledgment, never dispatch or Celo execution alone." },
  "w2.captured-chip": { l: "Recorded-for-you chip", info: "Analog capture: the steward is only the recorder; the promise stays the member's (UX:437)." },
  "w2.details": { l: "Details disclosure", info: "Identifiers live behind one Details disclosure; chain vocabulary stays on this engage layer, never on browse cards (UX:436)." },
  "w2.retry": { l: "Try again", info: "Read-surface recovery — retries the commitment read (loading/not-found/read-error; never a “None” chip) (UX:51-52 · AM:12)." },
};

// ---------------------------------------------------------------------------
// W2b — commitment team and contribution record (uiux-spec Appendix C)
// ---------------------------------------------------------------------------

const W2B_STATES = [
  ["forming", "Team forming"], ["add-contributor", "Add contributor"],
  ["remove-contributor", "Remove contributor"], ["assign-requirement", "Assign responsibility"],
  ["open-eligible", "Open team · eligible"], ["join-submitted", "Open team · join submitted"],
  ["open-member", "Open team · joined"],
  ["frozen", "Roster frozen"], ["recognition", "Recognition preview"],
] as const;
type W2bState = (typeof W2B_STATES)[number][0];

function w2b(state: W2bState): string {
  const frozen = state === "frozen" || state === "recognition";
  const body = state === "add-contributor"
    ? `${banner("This is a Lead-managed team. Its lead or steward may add eligible garden members; Open teams use self-join instead. Team updates are online-only contract actions and are never queued offline.", "stone", "wifi-off-line")}
${field("Garden member", input("Sofia · 0x74…c2"))}
${banner("Adding a contributor never changes the accountable lead or grants recognition credit by itself.", "stone")}
<div class="actrow">${hot("w2b.add-cancel", btn("Cancel", { kind: "ghost" }))}${hot("w2b.add-confirm", btn("Add contributor", { kind: "pri" }))}</div>`
    : state === "remove-contributor"
    ? `${banner("Remove Kwame from this Lead-managed promise?", "amber", "user-line")}
${card(`${kv("Contributor", "Kwame · 0x5b…19")}${kv("Verified credit", "None")}`)}
${banner("Lead or steward removal exists only for Lead-managed rosters. Open-team members self-leave before credit and freeze. Only a non-lead contributor with no approved Work, pending linked Work, or evidence credit can be removed.", "stone")}
<div class="actrow">${hot("w2b.remove-cancel", btn("Keep contributor", { kind: "ghost" }))}${hot("w2b.remove-confirm", btn("Remove Kwame", { kind: "danger" }))}</div>`
    : state === "assign-requirement"
    ? `${banner("Planned responsibility coordinates the team. It does not award recognition credit.", "stone", "information-line")}
${field("Contributor", input("Kwame · 0x5b…19", { select: true }))}
${field("Planned responsibility", input("Beds survey · requirement row 3", { select: true }))}
<div class="actrow">${hot("w2b.assign-cancel", btn("Cancel", { kind: "ghost" }))}${hot("w2b.assign-confirm", btn("Save responsibility", { kind: "pri" }))}</div>`
    : state === "open-eligible"
    ? `${banner("This team is open to eligible garden members. Joining is an online contract action and does not award credit by itself.", "stone")}
${card(`${kv("Accountable lead", "Maria")}${kv("Your status", "Not on this team")}`)}
${hot("w2b.join", btn("Join this promise", { kind: "pri", full: true }))}`
    : state === "join-submitted"
    ? `${banner("Join submitted. Your wallet transaction is confirmed, and this screen is waiting for the indexed contributor roster before showing you as a member. A missing or stale roster result stays here.", "stone", "loader4-line")}
${card(`${kv("Your status", "Waiting for roster confirmation")}${kv("Indexed predicate", "Pending · connected account not present in the fresh roster")}${kv("Recognition credit", "None · joining alone does not award credit")}`)}
${hot("w2b.join-indexed", btn("Check roster", { kind: "sec", full: true }))}`
    : state === "open-member"
    ? `${banner("Roster confirmed. You joined this open team.", "stone", "checkbox-circle-fill")}
${card(`${kv("Your status", "Contributor · no verified credit")}${kv("Indexed predicate", "Pass · fresh roster contains the connected account")}${kv("Leave rule", "Before credit and before roster freeze")}`)}
${hot("w2b.leave", btn("Leave this promise", { kind: "sec", full: true }))}`
    : state === "recognition"
    ? `${banner("Each fulfilled commitment receives an equal budget. This cycle's immutable policy shares 35% equally among eligible contributors and 65% by verified contribution.", "stone", "information-line")}
${card(`${kv("Cycle policy", "35% equal participation · 65% verified contribution")}${kv("Maria · lead", "40% · approved work + coordination")}${kv("Ana", "35% · approved pruning work")}${kv("Kwame", "25% · evidence + follow-through")}`)}
${banner("This is the gardener-share recognition preview. New protocol state cannot reach fulfillment with zero eligible contributors; W26 blocks inconsistent legacy/indexed data rather than awarding the lead automatically. Payment starts from this hash-bound vector, but the garden may retain an explicit amount and correct contributor amounts with a reason. Certificate eligibility additionally requires a non-zero cycle with its six-role allocation; a cycle-less promise is recognition/payment-only.", "amber")}`
    : `${card(
        `${listRow({ icon: "user-line", primary: "Maria", meta: "Accountable lead · accepted the commitment", chipHtml: chip("Lead", "offer") })}
${listRow({ icon: "user-line", primary: "Ana", meta: "Contributor · approved pruning work", chipHtml: chip("Credited", "ok") })}
${listRow({ icon: "user-line", primary: "Kwame", meta: frozen ? "Contributor · evidence and delivery follow-through" : "Contributor · no verified credit yet", chipHtml: frozen ? chip("Credited", "ok") : chip("Planned", "plain") })}`,
        { cls: "flat" },
      )}
${frozen
  ? banner("Roster frozen atomically when the commitment entered Ready for confirmation. Roster edits are unavailable after freeze.", "stone", "shield-check-line")
  : `${banner("Lead-managed team · one person stays accountable. The lead or steward may add or remove eligible uncredited collaborators; Open teams use self-join and self-leave instead.", "stone")}
<div class="actrow">${hot("w2b.add", btn("Add contributor", { kind: "sec", icon: "add-line" }))}${hot("w2b.assign", btn("Assign Kwame", { kind: "ghost" }))}</div>
${hot("w2b.remove", btn("Remove Kwame from this promise", { kind: "ghost", full: true }))}`}
${hot("w2b.preview", btn("Preview recognition", { kind: "pri", full: true }))}`;
  return phoneFrame(`${hdr("Team and contributions", { back: true })}${pagepad(body)}<div style="flex:1"></div>`, { appBar: false });
}

const W2B_HOTS: HifiDef["hots"] = {
  "w2b.add": { l: "Add contributor", to: "screen:W2b@add-contributor", info: "LeadManaged only: opens the online-only eligible garden-member picker. Open teams use joinCommitment; roster updates never enter the offline field queue." },
  "w2b.add-cancel": { l: "Cancel add contributor", to: "screen:W2b@forming", info: "Closes the picker without changing the roster." },
  "w2b.add-confirm": { l: "Confirm add contributor", to: "screen:W2b@forming", info: "Calls addContributor for the selected garden member; wallet rejection or a roster-cap/freeze error leaves the selection visible for retry.", calls: ["addContributor"], facts: { commitment: "Accepted", kind: "DomainImpact" } },
  "w2b.remove": { l: "Remove Kwame from this promise", to: "screen:W2b@remove-contributor", info: "LeadManaged only: opens a named confirmation for an uncredited non-lead contributor with no pending linked Work. Open-team members self-leave; managed expulsion is unavailable." },
  "w2b.remove-cancel": { l: "Keep contributor", to: "screen:W2b@forming", info: "Returns without changing the roster." },
  "w2b.remove-confirm": { l: "Remove Kwame", to: "screen:W2b@forming", info: "Calls removeContributor online for this LeadManaged roster. The indexed roster changes only after confirmation; an Open policy, freeze, lead, pending-Work, or credit error keeps this confirmation available.", calls: ["removeContributor"], facts: { commitment: "Accepted", kind: "DomainImpact" } },
  "w2b.assign": { l: "Assign planned responsibility to Kwame", to: "screen:W2b@assign-requirement", info: "Opens the requirement-row assignment editor without treating planning as recognition credit." },
  "w2b.assign-cancel": { l: "Cancel responsibility assignment", to: "screen:W2b@forming", info: "Returns without changing the assignment." },
  "w2b.assign-confirm": { l: "Save planned responsibility", to: "screen:W2b@forming", info: "Calls setContributorRequirement for the selected contributor and exact requirement row. Wallet failure keeps both selections available for retry.", calls: ["setContributorRequirement"], facts: { commitment: "Accepted", kind: "DomainImpact" } },
  "w2b.join": { l: "Join this promise", to: "screen:W2b@join-submitted", info: "Calls joinCommitment for an eligible Open-team garden member. A successful wallet submission lands in a pending state; membership renders only after indexed roster confirmation and never creates recognition credit.", calls: ["joinCommitment"], facts: { commitment: "Accepted", kind: "DomainImpact" } },
  "w2b.join-indexed": { l: "Check indexed roster", to: "screen:W2b@join-submitted", info: "Refreshes the read model. A missing or stale result, or a fresh roster without the connected account, remains pending. The reactive screen enters open-member only after a fresh indexed contributor roster contains that exact account; this control has no unconditional success route." },
  "w2b.leave": { l: "Leave this promise", to: "screen:W2b@open-eligible", info: "Calls leaveCommitment only for an active non-lead Open-team member with zero Work/evidence credit before freeze.", calls: ["leaveCommitment"], facts: { commitment: "Accepted", kind: "DomainImpact" } },
  "w2b.preview": { l: "Preview recognition", to: "screen:W2b@recognition", info: "Reads the selected cycle's immutable equal/verified policy and previews its resulting contributor weights, impossible-state blocker, and relationship to the later payment default." },
};

// ---------------------------------------------------------------------------
// W2a — evidence attach sheet (uiux-spec §5.5)
// ---------------------------------------------------------------------------

const w2aBehind = (promise: PromiseCast = "offer") =>
  `${hdr(W2_IDENTITY[promise].title, { back: true })}<div class="hsub num">${W2_IDENTITY[promise].meta}</div>`;

type W2aState =
  | "compose" | "queued" | "failed" | "compose-request"
  | "compose-campaign-request" | "compose-support" | "compose-captured";

function w2a(state: W2aState): string {
  const kinds = hot(
    "w2a.kind",
    `<div class="radio">
${[["camera-line", "Photo", "From your camera or library"], ["link-m", "Link", "A page that shows the work"], ["sticky-note-line", "Note", "A few words from the field"]]
      .map(([ic, l, m], i) => `<div class="ro${i === 0 ? " on" : ""}"><span class="rdot"></span>${icon(ic as string)}<div><div class="rl">${l}</div><div class="rm">${m}</div></div></div>`)
      .join("")}</div>`,
  );
  const request = state === "compose-request";
  const campaignRequest = state === "compose-campaign-request";
  const support = state === "compose-support";
  const captured = state === "compose-captured";
  const composing = state === "compose" || request || campaignRequest || support || captured;
  const title = composing ? "Add evidence" : state === "failed" ? "One item needs another try" : "Evidence queued";
  let inner: string;
  if (state === "failed") {
    inner =
      listRow({ icon: "image-line", primary: "North beds after", meta: "Photo · credits Maria, Ana · couldn't send", chipHtml: chip("Couldn't send", "err"), trailing: hot("w2a.retry-row", btn("Retry", { kind: "sec", sm: true, icon: "refresh-line" })) }) +
      listRow({ icon: "sticky-note-line", primary: "“Two beds left for next week”", meta: "Note · sent", chipHtml: chip("Sent", "ok") }) +
      banner("Your evidence is held on this device — nothing is dropped. Retry the one that didn't send whenever you're ready.", "stone", "wifi-off-line") +
      hot("w2a.done", btn("Done", { kind: "ghost", full: true }));
  } else if (state === "queued") {
    inner =
      listRow({ icon: "image-line", primary: "North beds after", meta: "Photo · credits Maria, Ana · just now", chipHtml: chip("Queued", "queued") }) +
      banner("It will send when you're back online. Nothing else to do.", "stone", "wifi-off-line") +
      hot("w2a.done", btn("Done", { kind: "sec", full: true }));
  } else {
    const attachHot =
      support ? "w2a.attach-support"
      : campaignRequest ? "w2a.attach-campaign-request"
      : request ? "w2a.attach-request"
      : captured ? "w2a.attach-captured"
      : "w2a.attach";
    inner = `${kinds}${field("Credit contributors", input(captured ? "Maria" : "Maria · Ana"))}${banner("The selected active contributors are saved with this evidence and reused exactly on retry.", "stone", "user-line")}${banner("Saved on this device until it sends — evidence works fully offline.", "stone", "wifi-off-line")}${hot(attachHot, btn("Attach evidence", { kind: "pri", full: true }))}`;
  }
  const cast: PromiseCast =
    campaignRequest ? "campaign-request" : request ? "request" : support ? "support" : captured ? "captured" : "offer";
  const body = sheetOver(w2aBehind(cast), title, inner);
  return phoneFrame(`${body}`, { offline: state === "queued" || state === "failed", appBar: false });
}

const W2A_HOTS: HifiDef["hots"] = {
  "w2a.kind": { l: "Evidence kind", info: "Photo / link / note → one evidence job per submit (UX:159)." },
  "w2a.attach": { l: "Attach evidence", to: "screen:W2@evidence-queued", info: "Enqueues media plus the explicit creditedContributors vector; after upload the executor calls attachEvidence with those same addresses (CS §6.1).", calls: ["attachEvidence"], pendingSync: true },
  "w2a.attach-request": { l: "Attach request evidence", to: "screen:W2@request-evidence-queued", info: "Queues evidence and its explicit credited-contributor vector for Ana's request without changing its direction, provider, or confirmer.", calls: ["attachEvidence"], pendingSync: true },
  "w2a.attach-campaign-request": { l: "Attach campaign-request evidence", to: "screen:W2@campaign-request-evidence-queued", info: "Queues evidence and its explicit credited-contributor vector without losing the Market rides Campaign binding.", calls: ["attachEvidence"], pendingSync: true },
  "w2a.attach-support": { l: "Attach service evidence", to: "screen:W2@support-evidence-queued", info: "Enqueues evidence plus explicit attribution for a SupportService offer; the queued row appears before EvidenceAttached syncs, and no linked-work requirement is introduced (UX:218 · CS §6.1).", calls: ["attachEvidence"], pendingSync: true },
  "w2a.attach-captured": { l: "Attach captured-promise evidence", to: "screen:W2@captured-evidence-queued", info: "Queues evidence and its explicit credited-contributor vector while preserving StewardCaptured and the member's source identity.", calls: ["attachEvidence"], pendingSync: true },
  "w2a.retry-row": { l: "Retry this upload", to: "screen:W2a@queued", info: "Per-row retry — a failed evidence job stays visible with a retry (up to MAX_RETRIES=5); media is never silently dropped (UX:218)." },
  "w2a.done": { l: "Done", to: "screen:W2@evidence-submitted", info: "Returns to the promise with the queued or sent evidence row still visible." },
};

// ---------------------------------------------------------------------------
// W3 — offer/request creation flow (uiux-spec §5.4)
// ---------------------------------------------------------------------------

const W3_STATES = [
  ["step-what", "1 · What"], ["step-howmuch", "2 · How much"], ["step-anchors", "3 · Anchors"],
  ["step-confirmers", "4 · Who confirms"], ["step-confirmers-opted-in", "4 · Who confirms · fallback selected"],
  ["step-review", "5 · Review"],
  ["support-howmuch", "Support · amount"], ["support-confirmers", "Support · who confirms"],
  ["support-review", "Support · review"],
  ["saved-offer-edit", "Saved offer · edit"], ["saved-offer-review", "Saved offer · review"],
  ["saved-offer-queued", "Saved offer · queued"],
  ["request-variant", "Request · review"], ["draft-resume", "Draft resume"],
  ["validation", "Validation error"],
] as const;
type W3State = (typeof W3_STATES)[number][0];

// `total` is a parameter because the request path skips action anchors: a
// support/service ask is four steps, and showing five dots promises a step
// that never arrives (UX:153 · WF:199).
const w3Head = (title: string, step: number, total = 5) =>
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
        sectionTitle("What does this promise require?", chip("2 requirements")),
        `<div class="t-meta">Add every action the group expects to complete. Each row carries its own count and contribution evidence.</div>`,
        card(
          listRow({ icon: "leaf-line", primary: "Prune × 2", meta: "AGRO · trees and beds", chipHtml: chip("Required", "ok") }) +
            listRow({ icon: "plant-line", primary: "Plant × 12", meta: "AGRO · seedlings and starts", chipHtml: chip("Required", "ok") }) +
            hot("w3.add-action", btn("Add another requirement", { kind: "ghost", sm: true, icon: "add-line" })),
          { cls: "flat" },
        ),
        `<div class="t-meta">There is no four-item product rule. The implementation cap is set only after contract gas and indexer benchmarks.</div>`,
        hot("w3.continue-anchors", btn("Continue", { kind: "pri", full: true })),
      )}`;
      break;
    case "step-confirmers":
      body = `${w3Head("Make an offer", 3)}${pagepad(
        card(`${kv("Ordinary confirmation", "Offer recipient confirms")}${kv("Reachability", "No eligible local confirmer after contributor exclusion")}`),
        hot("w3.protocol-fallback", `<label class="arow" style="align-items:flex-start"><input type="checkbox" aria-label="Let the Green Goods team confirm if nobody local is eligible" style="margin-top:4px"><span class="grow"><b>Let the Green Goods team confirm if nobody local is eligible</b><span class="t-meta" style="display:block">Off by default. Contributors can never confirm their own work.</span></span></label>`),
        banner("Choose this option or change the team or confirmer rule before continuing.", "amber", "information-line"),
        btn("Continue", { kind: "pri", full: true, disabled: true }),
      )}`;
      break;
    case "step-confirmers-opted-in":
      body = `${w3Head("Make an offer", 3)}${pagepad(
        card(`${kv("Ordinary confirmation", "Offer recipient confirms")}${kv("Reachability", "No eligible local confirmer after contributor exclusion")}`),
        `<label class="arow" style="align-items:flex-start"><input type="checkbox" aria-label="Let the Green Goods team confirm if nobody local is eligible" checked style="margin-top:4px"><span class="grow"><b>Let the Green Goods team confirm if nobody local is eligible</b><span class="t-meta" style="display:block">Selected for this Offer only. Contributors remain excluded.</span></span></label>`,
        banner("Fallback can be used only while the ordinary recipient path remains unreachable.", "stone", "information-line"),
        hot("w3.continue-confirmers", btn("Continue", { kind: "pri", full: true })),
      )}`;
      break;
    case "step-review":
      body = `${w3Head("Make an offer", 4)}${pagepad(
        card(`${kv("Direction", "Offer support")}${kv("Kind", "Garden work")}${kv("Contributor policy", "Open team · eligible garden members may join")}${kv("Title", "Prune the north beds")}${kv("How much", "6 hours")}${kv("Due", "Aug 12")}${kv("Season", "First Rains")}${kv("Requirements", "Prune × 2 · Plant × 12")}${kv("Who confirms", "Offer recipient · Green Goods team fallback selected")}`),
        `<div class="t-meta">Submitting queues the promise on this device and returns you to the pool — it sends when connected.</div>`,
        hot("w3.submit", btn("Make this offer", { kind: "pri", full: true })),
      )}`;
      break;
    case "support-review":
      body = `${w3Head("Make an offer", 3, 4)}${pagepad(
        card(`${kv("Direction", "Offer support")}${kv("Kind", "Support / service")}${kv("Contributor policy", "Open team · eligible garden members may join")}${kv("Title", "Repair tool handles")}${kv("How much", "1 repair session")}${kv("Campaign", "Tool library")}${kv("Who confirms", "Recipient · Green Goods team fallback off")}`),
        `<div class="t-meta">Service offers skip action anchors. Evidence and the named recipient carry the proof.</div>`,
        hot("w3.submit-support", btn("Make this offer", { kind: "pri", full: true })),
      )}`;
      break;
    case "support-confirmers":
      body = `${w3Head("Make an offer", 2, 4)}${pagepad(
        card(`${kv("Ordinary confirmation", "Offer recipient confirms")}${kv("Reachability", "Recipient remains eligible")}`),
        hot("w3.protocol-fallback-support", `<label class="arow" style="align-items:flex-start"><input type="checkbox" aria-label="Let the Green Goods team confirm if nobody local is eligible" style="margin-top:4px"><span class="grow"><b>Let the Green Goods team confirm if nobody local is eligible</b><span class="t-meta" style="display:block">Off by default · every contributor stays excluded.</span></span></label>`),
        hot("w3.continue-confirmers-support", btn("Continue", { kind: "pri", full: true })),
      )}`;
      break;
    case "support-howmuch":
      body = `${w3Head("Make an offer", 1, 4)}${pagepad(
        field("Unit", input("repair sessions", { select: true })),
        field("How many", input("1")),
        field("Campaign", input("Tool library", { select: true })),
        field("Due", input("Aug 12")),
        hot("w3.continue-support-howmuch", btn("Continue", { kind: "pri", full: true })),
      )}`;
      break;
    case "request-variant":
      body = `${w3Head("Ask for help", 3, 4)}${pagepad(
        card(`${kv("Direction", "Request help")}${kv("Kind", "Support / service")}${kv("Contributor policy", "Open team · eligible garden members may join")}${kv("Title", "Ride to the market on Saturday")}${kv("How much", "1 ride")}${kv("Season", "First Rains")}${kv("Who confirms", "Request creator · Green Goods team fallback off")}`),
        `<div class="t-meta">Support requests skip action anchors — evidence and the person you asked carry the proof.</div>`,
        hot("w3.submit-request", btn("Ask for this help", { kind: "pri", full: true })),
      )}`;
      break;
    case "saved-offer-edit":
      body = `${w3Head("Offer it once", 0, 2)}${pagepad(
        banner("Prefilled from your saved details. You can change every field before you make this offer.", "stone", "information-line"),
        field("Direction", radio([{ label: "Offer support", meta: "something you can give", on: true }], { interactive: true, name: "saved-offer-direction" })),
        field("Kind", radio([{ label: "Support / service", meta: "workshops, rides, meals, repairs", on: true }], { interactive: true, name: "saved-offer-kind" })),
        field("Garden", input("Rocinha Community Garden", { select: true })),
        field("Cycle", input("Season of First Rains", { select: true })),
        field("Title", input("Hosting climate workshops")),
        field("What people receive", input("A two-hour session on local climate work")),
        field("Unit", input("workshop sessions", { select: true })),
        field("How many", input("1")),
        field("Who confirms", input("Recipient", { select: true })),
        hot("w3.review-saved-offer", btn("Review this offer", { kind: "pri", full: true })),
      )}`;
      break;
    case "saved-offer-review":
      body = `${w3Head("Offer it once", 1, 2)}${pagepad(
        card(`${kv("Direction", "Offer support")}${kv("Kind", "Support / service")}${kv("Garden", "Rocinha Community Garden")}${kv("Cycle", "Season of First Rains")}${kv("Title", "Hosting climate workshops")}${kv("What people receive", "A two-hour session on local climate work")}${kv("How much", "1 workshop session")}${kv("Who confirms", "Recipient")}`),
        banner("This makes one ordinary Offer. It will not repeat, create an ongoing Offer, or make another place later.", "stone", "information-line"),
        `<div class="brow">${hot("w3.edit-saved-offer", btn("Edit", { kind: "ghost" }))}${hot("w3.submit-saved-offer", btn("Make this offer", { kind: "pri" }))}</div>`,
      )}`;
      break;
    case "saved-offer-queued":
      body = `${w3Head("Offer it once", 2, 2)}${pagepad(
        card(
          listRow({ icon: "hand-heart-line", primary: "Hosting climate workshops", meta: "Rocinha Community Garden · 1 workshop session", chipHtml: chip("Queued", "queued") }),
        ),
        banner("Saved on this phone. It sends when you are connected.", "amber", "time-line"),
        `<div class="t-meta">This is one ordinary Offer. Your saved details remain reusable, but this offer will not repeat or become ongoing.</div>`,
        hot("w3.saved-offer-done", btn("Back to my offers", { kind: "ghost", full: true })),
      )}${syncBar("1 waiting to send")}`;
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
        `<div class="t-meta">Each requirement needs a count of 1 or more. Add as many as the commitment genuinely needs; the measured implementation cap is not presented as a planning rule.</div>`,
        btn("Continue", { kind: "pri", full: true, disabled: true }),
      )}`;
      break;
    default:
      body = `${w3Head("Make an offer", 0)}${pagepad(
        field("Direction", hot("w3.direction", radio([{ label: "Offer support", meta: "something you can give", on: true }, { label: "Request help", meta: "something you need" }], { interactive: true, name: "commitment-direction" }))),
        field("Kind", radio([{ label: "Garden work", meta: "counts toward the garden's actions", on: true }, { label: "Support / service", meta: "rides, meals, repairs — evidence-confirmed", hot: "w3.choose-support" }], { interactive: true, name: "commitment-kind" })),
        hot("w3.contributor-policy", field("Contributor policy", radio([{ label: "Open team", meta: "eligible garden members may join", on: true }, { label: "Lead-managed team", meta: "the lead or steward manages the roster" }], { interactive: true, name: "contributor-policy" }))),
        field("Cycle", hot("w3.cycle", input("Season: First Rains", { select: true }))),
        field("Title", input("Prune the north beds")),
        field("Note", input("optional", { placeholder: true })),
        hot("w3.continue-what", btn("Continue", { kind: "pri", full: true })),
      )}`;
  }
  // `/pool/new` is a full-screen flow — the shipping AppBar hides here exactly
  // as it does for the Garden work flow (uiux-spec:120 · AppBar.tsx:33).
  return phoneFrame(`${body}<div style="flex:1"></div>`, { offline: state === "draft-resume" || state === "saved-offer-queued", appBar: false });
}

const W3_HOTS: HifiDef["hots"] = {
  "w3.direction": { l: "Direction", info: "Offer vs request — season/campaign seeding and on-behalf capture are console-seeded only, never here (UX:150)." },
  "w3.contributor-policy": { l: "Contributor policy", info: "Chooses the immutable Open or LeadManaged roster policy before creation; the final review repeats the selected join rule." },
  "w3.choose-support": { l: "Choose Support / service", to: "screen:W3@support-howmuch", info: "Chooses the evidence-only SupportService offer path. It keeps the amount step and skips only DomainImpact action anchors (UX:153)." },
  "w3.continue-support-howmuch": { l: "Continue with service amount", to: "screen:W3@support-confirmers", info: "Carries the entered service unit and quantity into Who confirms without introducing action anchors." },
  "w3.cycle": { l: "Cycle scope", info: "Every promise names its cycle; Season and Campaigns never blur (UX:127)." },
  "w3.continue-what": { l: "Continue to amount", to: "screen:W3@step-howmuch", info: "What + cycle scope → amount (UX:150-153)." },
  "w3.continue-howmuch": { l: "Continue to anchors", to: "screen:W3@step-anchors", info: "Amount → action anchors for garden work (UX:150-153)." },
  "w3.continue-anchors": { l: "Continue to who confirms", to: "screen:W3@step-confirmers", info: "Action anchors → ordinary reachability and explicit protocol fallback selection (UX §5.4)." },
  "w3.protocol-fallback": { l: "Green Goods team fallback", to: "screen:W3@step-confirmers-opted-in", info: "An explicit user action selects protocolFallbackEnabled for this Offer. It is off by default, remains usable only while the ordinary path is unreachable, and never permits a contributor to confirm." },
  "w3.continue-confirmers": { l: "Continue to review", to: "screen:W3@step-review", info: "Carries the ordinary rule and explicit fallback selection into review." },
  "w3.protocol-fallback-support": { l: "Green Goods team fallback", info: "Explicit optional protocol fallback for this SupportService commitment; the ordinary recipient remains the default." },
  "w3.continue-confirmers-support": { l: "Continue to service review", to: "screen:W3@support-review", info: "Carries the service's receiver default and explicit fallback selection into review." },
  "w3.submit": { l: "Make this offer", to: "screen:W1@queued", info: "Enqueues the commitment job; returns to the pool tab with an optimistic queued card (UX:212).", calls: ["createCommitment"], pendingSync: true },
  "w3.submit-support": { l: "Make this service offer", to: "screen:W1@support-queued", info: "Enqueues the SupportService offer and returns to the pool with its optimistic queued card; a recipient may take it up only after sync.", calls: ["createCommitment"], pendingSync: true },
  "w3.submit-request": { l: "Ask for this help", to: "screen:W1@request-queued", info: "Enqueues the request job and returns to the same request cast while it syncs.", calls: ["createCommitment"], pendingSync: true },
  "w3.review-saved-offer": { l: "Review this offer", to: "screen:W3@saved-offer-review", info: "Carries the saved workshop details into the ordinary one-time Offer review without replacing them with the generic Garden work example." },
  "w3.edit-saved-offer": { l: "Edit this offer", to: "screen:W3@saved-offer-edit", info: "Returns to the fully editable prefilled fields. The private saved details remain unchanged unless the member separately saves them again." },
  "w3.submit-saved-offer": { l: "Make this offer", to: "screen:W3@saved-offer-queued", info: "Queues exactly one ordinary SupportService Offer with commitmentSeriesId == 0. No durable series or future place is created.", calls: ["createCommitment"], pendingSync: true },
  "w3.saved-offer-done": { l: "Back to my offers", to: "screen:W32@saved", info: "Returns to the private saved-details list without changing the separate queued one-time Offer job." },
  "w3.resume": { l: "Resume draft", to: "screen:W3@step-what", info: "Drafts persist locally (WorkDraftRecord semantics); re-entry offers resume (UX:155)." },
  "w3.start-fresh": { l: "Start fresh", to: "screen:W3@step-what", info: "Explicitly discards the saved local draft and starts from the first creation step." },
  "w3.add-action": { l: "Add an action", info: "Repeatable DomainImpact requirements: each row binds a registered action to a count ≥ 1, and domains are derived tags that may repeat. Four rows are visible initially; Add action continues to the measured MAX_REQUIREMENTS. Failed submits keep entered data and focus a concise error summary (UX:153 · WF:200 · UX:439)." },
};

// ---------------------------------------------------------------------------
// W4 — confirmation sheet (uiux-spec §5.6)
// ---------------------------------------------------------------------------

const W4_STATES = [
  ["confirm-domain", "Garden work"], ["confirm-support", "Support / service"],
  ["confirm-request", "A request you asked for"], ["confirm-campaign-request", "A Campaign request"],
  ["confirm-captured", "A recorded promise"],
  ["not-yet", "Not yet — garden work"], ["not-yet-support", "Not yet — service"],
  ["not-yet-request", "Not yet — request"], ["not-yet-campaign-request", "Not yet — Campaign request"],
  ["not-yet-captured", "Not yet — recorded promise"],
  ["provider-view", "Provider view"],
  ["confirmed-pending", "Ready — confirmation pending"], ["confirmed", "Fulfilled — synced"],
  ["confirmed-pending-support", "Support — confirmation pending"], ["confirmed-support", "Support — fulfilled"],
  ["confirmed-pending-request", "Request — pending sync"], ["confirmed-request", "Request — synced"],
  ["confirmed-pending-campaign-request", "Campaign request — pending sync"],
  ["confirmed-campaign-request", "Campaign request — synced"],
  ["confirmed-pending-captured", "Recorded promise — pending sync"],
  ["confirmed-captured", "Recorded promise — synced"],
  ["not-yet-failed", "Not yet — garden work send failed"],
  ["not-yet-failed-support", "Not yet — service send failed"],
  ["not-yet-failed-request", "Not yet — request send failed"],
  ["not-yet-failed-campaign-request", "Not yet — Campaign request send failed"],
  ["not-yet-failed-captured", "Not yet — recorded promise send failed"],
] as const;
type W4State = (typeof W4_STATES)[number][0];

const w4Behind = (cast: PromiseCast = "offer") =>
  `${hdr(W2_IDENTITY[cast].title, { back: true })}<div class="hsub num">${W2_IDENTITY[cast].meta}</div>`;

function w4(state: W4State): string {
  const campaignRequest = state.includes("campaign-request");
  const request = state.includes("request") && !campaignRequest;
  const support = state.includes("support");
  const captured = state.includes("captured");
  const cast: PromiseCast = campaignRequest ? "campaign-request" : request ? "request" : support ? "support" : captured ? "captured" : "offer";
  const evidenceOnly = request || campaignRequest || support || captured;
  const summary =
    cast === "request"
      ? `<div class="t-meta">Request · João provides · Ana asked for this and confirms it.</div>`
      : cast === "campaign-request"
        ? `<div class="t-meta">Campaign request · João provides · Ana confirms for Market rides.</div>`
        : cast === "support"
          ? `<div class="t-meta">Offer · Maria provides the service · João confirms it.</div>`
          : cast === "captured"
            ? `<div class="t-meta">Recorded for Kwame · Kwame remains the source · Ana confirms it.</div>`
            : `<div class="t-meta">Offer · Maria provides · the people it was made to confirm.</div>`;
  // Who has already confirmed is context; whose turn it is is the point. The
  // confirmed members condense to one row so the sheet leads with the reader's
  // own act (§5.6 keeps the self row distinct).
  const confirmMeter = hot("w4.meter", `<div>${meter(66, { left: "confirmations", right: "2 of 3" })}</div>`) +
    listRow({ icon: "checkbox-circle-fill", primary: "João and Sofia confirmed", meta: "Jul 11 · Jul 12" }) +
    listRow({ icon: "user-line", primary: "You", chipHtml: chip("Your turn", "warn") });
  const exclusion = hot(
    "w4.provider-note",
    request || campaignRequest
      ? banner("João gave the ride, so João cannot confirm it — the person who asked does. Not even a steward can confirm their own.", "stone", "shield-check-line")
      : captured
        ? banner("Kwame's named provider cannot confirm their own work — the named counterparty does.", "stone", "shield-check-line")
      : banner("Maria, Ana, and Kwame are on the frozen contributor roster, so none can confirm — not even through the steward fallback.", "stone", "shield-check-line"),
  );

  let inner: string;
  let title = "Promise kept?";
  switch (state) {
    case "confirm-request":
      title = "Did the help arrive?";
      inner = `${summary}${listRow({ icon: "image-line", primary: "Evidence", meta: "1 item · photo from the market" })}${meter(0, { left: "confirmations", right: "0 of 1" })}${exclusion}${hot("w4.confirm-request", btn("Confirm — help arrived", { kind: "pri", full: true }))}${hot("w4.not-yet-request", btn("Not yet — tell the stewards why", { kind: "sec", full: true }))}`;
      break;
    case "confirm-campaign-request":
      title = "Did the Campaign help arrive?";
      inner = `${summary}${listRow({ icon: "image-line", primary: "Evidence", meta: "1 item · photo from the market" })}${meter(0, { left: "confirmations", right: "0 of 1" })}${exclusion}${hot("w4.confirm-campaign-request", btn("Confirm — help arrived", { kind: "pri", full: true }))}${hot("w4.not-yet-campaign-request", btn("Not yet — tell the stewards why", { kind: "sec", full: true }))}`;
      break;
    case "confirm-support":
      inner = `${summary}${listRow({ icon: "image-line", primary: "Evidence", meta: "1 item · repaired handles" })}${meter(0, { left: "confirmations", right: "0 of 1" })}${exclusion}${hot("w4.confirm-support", btn("Confirm — promise kept", { kind: "pri", full: true }))}${hot("w4.not-yet-support", btn("Not yet — tell the stewards why", { kind: "sec", full: true }))}`;
      break;
    case "confirm-captured":
      inner = `${summary}${listRow({ icon: "image-line", primary: "Evidence", meta: "1 item · workshop photo" })}${meter(0, { left: "confirmations", right: "0 of 1" })}${exclusion}${hot("w4.confirm-captured", btn("Confirm — promise kept", { kind: "pri", full: true }))}${hot("w4.not-yet-captured", btn("Not yet — tell the stewards why", { kind: "sec", full: true }))}`;
      break;
    case "not-yet":
    case "not-yet-support":
    case "not-yet-request":
    case "not-yet-campaign-request":
    case "not-yet-captured":
      title = "Tell the stewards";
      inner = `${field("What still needs doing?", input(
        request || campaignRequest ? "The ride did not arrive…"
        : support ? "Two handles still need repair…"
        : captured ? "The workshop has not happened yet…"
        : "The far bed is still overgrown…",
        { placeholder: false },
      ))}${banner("This never cancels the promise — stewards review and every outcome shows its reason.", "stone")}${hot(
        campaignRequest ? "w4.not-yet-send-campaign-request"
        : request ? "w4.not-yet-send-request"
        : support ? "w4.not-yet-send-support"
        : captured ? "w4.not-yet-send-captured"
        : "w4.not-yet-send",
        btn("Send to the stewards", { kind: "pri", full: true }),
      )}`;
      break;
    case "confirmed-pending":
    case "confirmed-pending-support":
    case "confirmed-pending-request":
    case "confirmed-pending-campaign-request":
    case "confirmed-pending-captured":
      title = "Confirmation saved";
      inner = `${meter(100, { left: "including this device", right: evidenceOnly ? "1 of 1 saved" : "3 of 3 saved" })}${listRow({ icon: "time-line", primary: "Your confirmation", chipHtml: chip("Waiting to send", "queued") })}${banner("Your confirmation is counted on this device. Fulfillment appears only after it syncs on-chain.", "stone", "wifi-off-line")}${hot(
        campaignRequest ? "w4.pending-campaign-request-done"
        : request ? "w4.pending-request-done"
        : support ? "w4.pending-support-done"
        : captured ? "w4.pending-captured-done"
        : "w4.pending-done",
        btn("Done", { kind: "sec", full: true }),
      )}`;
      break;
    case "confirmed":
    case "confirmed-support":
    case "confirmed-request":
    case "confirmed-campaign-request":
    case "confirmed-captured":
      title = "Promise kept";
      inner = `${hero(request || campaignRequest ? "Help arrived" : "Promise kept", support || campaignRequest ? "Confirmed · the Campaign's count just grew" : captured ? "Confirmed · the recorded promise is fulfilled" : "Confirmed · the season's count just grew", "checkbox-circle-fill")}${hot(
        campaignRequest ? "w4.done-campaign-request"
        : request ? "w4.done-request"
        : support ? "w4.done-support"
        : captured ? "w4.done-captured"
        : "w4.done",
        btn("Back to the pool", { kind: "pri", full: true }),
      )}`;
      break;
    case "not-yet-failed":
    case "not-yet-failed-support":
    case "not-yet-failed-request":
    case "not-yet-failed-campaign-request":
    case "not-yet-failed-captured":
      title = "Tell the stewards";
      inner = `${field("What still needs doing?", input(
        request || campaignRequest ? "The ride did not arrive…"
        : support ? "Two handles still need repair…"
        : captured ? "The workshop has not happened yet…"
        : "The far bed is still overgrown…",
        { placeholder: false },
      ))}${banner("Couldn't reach the stewards just now. Your note is kept and this promise stays ready to confirm — try again when you're back online.", "amber", "error-warning-line")}${hot(
        campaignRequest ? "w4.not-yet-retry-campaign-request"
        : request ? "w4.not-yet-retry-request"
        : support ? "w4.not-yet-retry-support"
        : captured ? "w4.not-yet-retry-captured"
        : "w4.not-yet-retry",
        btn("Try again", { kind: "pri", full: true, icon: "refresh-line" }),
      )}`;
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
  return phoneFrame(sheetOver(w4Behind(cast), title, inner), { appBar: false });
}

const W4_HOTS: HifiDef["hots"] = {
  "w4.confirm": { l: "Confirm — promise kept", to: "screen:W4@confirmed-pending", info: "Positive-only confirmation job; the Nth confirmation flips Fulfilled after the queued confirmation syncs (CS:139).", calls: ["confirmFulfillment"], pendingSync: true },
  "w4.confirm-support": { l: "Confirm — promise kept", to: "screen:W4@confirmed-pending-support", info: "The recipient confirms the evidence-only service promise; fulfillment appears only after sync.", calls: ["confirmFulfillment"], pendingSync: true },
  "w4.confirm-request": { l: "Confirm — help arrived", to: "screen:W4@confirmed-pending-request", info: "The request creator confirms the claimant's help; fulfillment appears only after sync.", calls: ["confirmFulfillment"], pendingSync: true },
  "w4.confirm-campaign-request": { l: "Confirm — Campaign help arrived", to: "screen:W4@confirmed-pending-campaign-request", info: "The request creator confirms the Campaign-scoped request without losing that Campaign binding.", calls: ["confirmFulfillment"], pendingSync: true },
  "w4.confirm-captured": { l: "Confirm — recorded promise kept", to: "screen:W4@confirmed-pending-captured", info: "The named counterparty confirms the evidence-only StewardCaptured promise.", calls: ["confirmFulfillment"], pendingSync: true },
  "w4.not-yet": { l: "Not yet", to: "screen:W4@not-yet", info: "Requires a reason → online steward review. It never cancels the promise (UX:167)." },
  "w4.not-yet-support": { l: "Not yet — service", to: "screen:W4@not-yet-support", info: "Keeps the service-offer cast while collecting the required dispute reason." },
  "w4.not-yet-request": { l: "Not yet — request", to: "screen:W4@not-yet-request", info: "Keeps the request cast while collecting the required dispute reason." },
  "w4.not-yet-campaign-request": { l: "Not yet — Campaign request", to: "screen:W4@not-yet-campaign-request", info: "Keeps the Campaign request binding while collecting the required dispute reason." },
  "w4.not-yet-captured": { l: "Not yet — recorded promise", to: "screen:W4@not-yet-captured", info: "Keeps the StewardCaptured cast while collecting the required dispute reason." },
  "w4.not-yet-send": { l: "Send to the stewards", to: "screen:W2@disputed", info: "Online-only raiseDispute with the reason; the promise freezes at “under review by stewards” (CS:143 · UX:426).", calls: ["raiseDispute"] },
  "w4.not-yet-send-support": { l: "Send service dispute to stewards", to: "screen:W2@support-disputed", info: "raiseDispute preserves the service offer's exact pre-dispute state and cast.", calls: ["raiseDispute"] },
  "w4.not-yet-send-request": { l: "Send request dispute to stewards", to: "screen:W2@request-disputed", info: "raiseDispute preserves the request's exact pre-dispute state and cast.", calls: ["raiseDispute"] },
  "w4.not-yet-send-campaign-request": { l: "Send Campaign request dispute to stewards", to: "screen:W2@campaign-request-disputed", info: "raiseDispute preserves the Campaign request's exact pre-dispute state and scope.", calls: ["raiseDispute"] },
  "w4.not-yet-send-captured": { l: "Send recorded-promise dispute to stewards", to: "screen:W2@captured-disputed", info: "raiseDispute preserves the StewardCaptured kind and member source.", calls: ["raiseDispute"] },
  "w4.meter": { l: "N-of-group meter", info: "Named any-N confirmation group; every frozen team member is excluded before threshold validation (UX:280 · Appendix C)." },
  "w4.provider-note": { l: "Provider exclusion", info: "Provider self-confirmation is blocked everywhere, including steward fallback (UX:32)." },
  "w4.done": { l: "Back to the pool", to: "screen:W2@fulfilled", info: "The Commitment Fulfilled hero (High) fires on sync completion, not enqueue; reduced-motion shows a static celebratory frame (UX:169,201,204)." },
  "w4.done-support": { l: "Back to the pool", to: "screen:W2@support-fulfilled", info: "Returns to the same SupportService offer after its fulfillment syncs." },
  "w4.done-request": { l: "Back to the pool", to: "screen:W2@request-fulfilled", info: "Returns to the same request record after its fulfillment syncs." },
  "w4.done-campaign-request": { l: "Back to the pool", to: "screen:W2@campaign-request-fulfilled", info: "Returns to the same Campaign request record after its fulfillment syncs." },
  "w4.done-captured": { l: "Back to the pool", to: "screen:W2@captured-fulfilled", info: "Returns to the same StewardCaptured record after its fulfillment syncs." },
  "w4.pending-done": { l: "Done", to: "screen:W2@confirmation-pending", info: "Returns to the same promise with its queued confirmation visible and no duplicate confirmation act." },
  "w4.pending-support-done": { l: "Done", to: "screen:W2@support-confirmation-pending", info: "Returns to the service promise with its queued confirmation visible and no duplicate submission act." },
  "w4.pending-request-done": { l: "Done", to: "screen:W2@request-confirmation-pending", info: "Returns to the request with its queued confirmation visible and no duplicate submission act." },
  "w4.pending-campaign-request-done": { l: "Done", to: "screen:W2@campaign-request-confirmation-pending", info: "Returns to the Campaign request with its scope and queued confirmation intact." },
  "w4.pending-captured-done": { l: "Done", to: "screen:W2@captured-confirmation-pending", info: "Returns to the StewardCaptured promise with its queued confirmation visible." },
  "w4.not-yet-retry": { l: "Try again", to: "screen:W2@disputed", info: "“Not yet” is online-only — dispute creation is not an offline queue kind. Failure leaves ReadyForConfirmation and exposes inline retry; success invalidates to under review by stewards (UX:169,221).", calls: ["raiseDispute"] },
  "w4.not-yet-retry-support": { l: "Try service dispute again", to: "screen:W2@support-disputed", info: "Retries the kept reason against the same service promise.", calls: ["raiseDispute"] },
  "w4.not-yet-retry-request": { l: "Try request dispute again", to: "screen:W2@request-disputed", info: "Retries the kept reason against the same request.", calls: ["raiseDispute"] },
  "w4.not-yet-retry-campaign-request": { l: "Try Campaign request dispute again", to: "screen:W2@campaign-request-disputed", info: "Retries the kept reason without dropping Campaign scope.", calls: ["raiseDispute"] },
  "w4.not-yet-retry-captured": { l: "Try recorded-promise dispute again", to: "screen:W2@captured-disputed", info: "Retries the kept reason against the same StewardCaptured promise.", calls: ["raiseDispute"] },
};

// ---------------------------------------------------------------------------

const w1Facts = (state: W1State): StateFacts | undefined => {
  if (state === "not-ready") return { pool: "NotReady" };
  if (state === "ready" || state === "seeded") return { pool: "Ready", cycle: state === "seeded" ? "Seeded" : undefined };
  if (state === "paused") return { pool: "Paused", cycle: "Open" };
  if (state === "closed") return { pool: "Closed", cycle: "Composted" };
  if (state === "cycle-summary") return { pool: "Open", cycle: "Composted" };
  if (state === "cancelled-cycle") return { pool: "Open", cycle: "Cancelled" };
  if (state === "paused-cancelled-cycle") return { pool: "Paused", cycle: "Cancelled" };
  if (state === "no-season") return { pool: "Open" };
  if (state.startsWith("claim-"))
    return {
      pool: "Open",
      cycle: "Open",
      commitment: state === "claim-accepted" ? "Accepted" : "Requested",
      kind: "SupportService",
    };
  if (["open", "request-open", "request-queued", "empty-open", "campaign-market", "campaign-tools", "queued", "support-queued", "sync-failed", "waiting-membership", "reviewing"].includes(state))
    return { pool: "Open", cycle: "Open" };
  return undefined;
};

const w2Facts = (state: W2State): StateFacts | undefined => {
  const kind: StateFacts["kind"] =
    W2_CAPTURED.has(state) ? "StewardCaptured"
    : W2_REQUEST.has(state) || W2_CAMPAIGN_REQUEST.has(state) || W2_SUPPORT.has(state) ? "SupportService"
    : "DomainImpact";
  const commitment: StateFacts["commitment"] =
    state === "offered" || state === "support-offered" || state === "withdraw-confirm" ? "Offered"
    : state === "requested" ? "Requested"
    : state === "active" || state === "evidence-queued" || state === "request-active" || state === "campaign-request-active" ||
      state === "support-active" || state === "support-evidence-queued" ||
      state === "request-evidence-queued" || state === "campaign-request-evidence-queued" ||
      state === "captured" || state === "captured-evidence-queued" ? "Active"
    : state === "evidence-submitted" || state === "request-evidence-submitted" ||
      state === "campaign-request-evidence-submitted" || state === "support-evidence-submitted" ||
      state === "captured-evidence-submitted" || state === "request-ready-pending" ||
      state === "campaign-request-ready-pending" || state === "support-ready-pending" ||
      state === "captured-ready-pending" ? "EvidenceSubmitted"
    : state === "partially-approved" ? "PartiallyApproved"
    : state === "ready-confirmer" || state === "confirmation-pending" ||
      state === "request-ready-confirmer" || state === "request-confirmation-pending" ||
      state === "campaign-request-ready-confirmer" || state === "support-ready-confirmer" ||
      state === "campaign-request-confirmation-pending" ||
      state === "support-confirmation-pending" ||
      state === "captured-ready-confirmer" || state === "captured-confirmation-pending"
      ? "ReadyForConfirmation"
    : state === "fulfilled" || state === "fulfilled-pool-fallback" ||
      state === "fulfilled-protocol-fallback" || state === "request-fulfilled" || state === "campaign-request-fulfilled" ||
      state === "support-fulfilled" || state === "captured-fulfilled" ||
      state === "garden-support-arrived" || W2_SETTLED.has(state) ? "Fulfilled"
    : state === "cancelled" || state === "withdrawn" || state === "support-cancelled" ? "Cancelled"
    : state === "expired" ? "Expired"
    : state === "disputed" || state === "request-disputed" ||
      state === "campaign-request-disputed" || state === "support-disputed" ||
      state === "captured-disputed" ? "Disputed"
    : state === "reconciled" ? "Reconciled"
    : ["loading", "not-found", "read-error"].includes(state) ? undefined
    : "Accepted";
  return commitment
    ? { pool: "Open", cycle: state === "reconciled" ? "Reconciled" : "Open", commitment, kind }
    : undefined;
};

const w4Facts = (state: W4State): StateFacts => ({
  pool: "Open",
  cycle: "Open",
  commitment: state === "confirmed" || state === "confirmed-support" ||
    state === "confirmed-request" || state === "confirmed-campaign-request" ||
    state === "confirmed-captured" ? "Fulfilled" : "ReadyForConfirmation",
  kind: state.includes("captured") ? "StewardCaptured"
    : state.includes("support") || state.includes("request") ? "SupportService"
    : "DomainImpact",
});

const w3Facts = (_state: W3State): StateFacts => ({ pool: "Open", cycle: "Open" });

const w2aFacts = (state: W2aState): StateFacts | undefined => {
  if (state === "queued" || state === "failed") return undefined;
  return {
    pool: "Open",
    cycle: "Open",
    commitment: "Active",
    kind: state === "compose" ? "DomainImpact" : state === "compose-captured" ? "StewardCaptured" : "SupportService",
  };
};

// ---------------------------------------------------------------------------
// W32–W35 — offering over time (standing-commitments-spec · uiux Appendix F)
//
// ONE product noun: the Offer. It is used two ways, and the product copy never
// introduces a second noun beside it:
//   Offer once      one ordinary Offer, commitmentSeriesId == 0 (W32 → W3)
//   Offer over time one pool-scoped CommitmentSeries in one garden (W33/W34).
//                   Gardener copy says "ongoing Offer"; CommitmentSeries is a
//                   technical/diagnostic name only, never rendered as product copy.
// Supporting facts, none of which is a product object:
//   Saved details   reusable signed offchain Offer metadata, private by default,
//                   input to EITHER path; only an unsaved draft is device-local (W32)
//   Available place an already-created Offered instance whose provider capacity
//                   is reserved at creation, not at claim (W34/W35)
//   Story           exact linked-instance history and absolute counts (W34)
// A claim ACCEPTS a pre-created place; it never spawns one. Availability is
// therefore always a count of real, already-reserved instances.
// ---------------------------------------------------------------------------

const W32_STATES = [
  ["saved", "Saved details"], ["saved-with-ongoing", "Saved details and ongoing Offer"],
  ["series-queued", "Ongoing Offer queued"], ["series-queued-place-waiting", "Ongoing Offer and place queued"],
  ["empty", "Nothing yet"], ["compose", "Save offer details"],
  ["choose-path", "Once or over time"], ["draft-unsaved", "Unsaved draft"],
  ["persistence", "How saving works"], ["loading", "Loading"], ["read-error", "Read error"],
] as const;
type W32State = (typeof W32_STATES)[number][0];

// Rows here are saved Offer details — reusable input to either path, never a
// second product object beside the Offer. "Offered over time" is the only tag
// that implies a pool-scoped series exists.
const offerRow = (opts: { title: string; meta: string; tag: string; tone: ChipToneLocal; hotId?: string }) => {
  const row = listRow({
    icon: "seedling-line",
    primary: opts.title,
    meta: opts.meta,
    chipHtml: chip(opts.tag, opts.tone),
    chevron: true,
  });
  return opts.hotId ? hot(opts.hotId, row) : row;
};
type ChipToneLocal = "plain" | "offer" | "ok" | "ink";

function w32(state: W32State): string {
  const head = hdr("Things I can offer", { back: true });
  const intro = `<div class="t-meta">Details you can reuse. Nothing here is a promise until you offer it in a garden.</div>`;
  let body: string;
  switch (state) {
    case "empty":
      body = `${head}${pagepad(
        emptyState(
          "seedling-line",
          "Nothing here yet",
          "Save the details of something you can offer, so you do not have to write them again. Only you can see this until you offer it in a garden.",
          hot("w32.add-first", btn("Save offer details", { kind: "pri", icon: "add-line" })),
        ),
      )}`;
      break;
    case "compose":
      body = sheetOver(
        head + pagepad(intro),
        "Save offer details",
        `${field("What are you offering?", input("Hosting climate workshops"))}` +
          `${field("One line about it", input("A two-hour session on local climate work"))}` +
          `<div class="t-meta">Saved privately. It follows you to a new phone.</div>` +
          hot("w32.save", btn("Save privately", { kind: "pri", full: true })),
      );
      break;
    case "choose-path":
      body = sheetOver(
        head + pagepad(intro),
        "Hosting climate workshops",
        `<div class="t-meta">How would you like to offer this?</div>` +
          hot("w32.offer-once", card(
            `<div class="t-title">Offer it once</div><div class="t-meta">One promise, this time only — the ordinary offer, prefilled.</div>`,
            { cls: "flat" },
          )) +
          hot("w32.offer-over-time", card(
            `<div class="t-title">Offer it over time</div><div class="t-meta">Keep offering it in one garden, cycle after cycle. Its history stays together.</div>`,
            { cls: "flat" },
          )) +
          `<div class="t-meta">Neither choice commits you to anything yet.</div>`,
      );
      break;
    case "draft-unsaved":
      body = `${head}${pagepad(
        intro,
        banner("This draft is on this phone only. Save it to keep it if you change devices.", "amber", "sticky-note-line"),
        card(
          listRow({ icon: "sticky-note-line", primary: "Hosting climate workshops", meta: "Draft on this device · edited 5 minutes ago", chipHtml: chip("Not saved yet", "warn") }) +
            hot("w32.save-draft", btn("Save privately", { kind: "pri", sm: true })),
          { cls: "flat" },
        ),
        hot("w32.persistence", btn("How saving works", { kind: "ghost", sm: true, icon: "information-line" })),
      )}`;
      break;
    case "persistence":
      body = sheetOver(
        head + pagepad(intro),
        "How saving works",
        card(
          `${kv("Saved privately", "Kept with your account. It follows you to a new phone.")}` +
            `${kv("Draft on this device", "Stays in this browser only. Clearing the app loses it.")}` +
            `${kv("Offered in a garden", "The garden's pool holds the promise. Your saved details stay private.")}`,
        ) +
          `<div class="t-meta">Saved details are private until you choose a garden. Offering one never publishes the rest of your list.</div>` +
          hot("w32.persistence-done", btn("Got it", { kind: "pri", full: true })),
      );
      break;
    case "loading":
      body = `${head}${pagepad(skeleton({ title: true, lines: 2 }), skeleton({ lines: 2 }), skeleton({ lines: 2 }))}`;
      break;
    case "read-error":
      body = `${head}${pagepad(
        emptyState(
          "wifi-off-line",
          "Cannot load your saved offers",
          "Everything you saved is safe. This device could not reach it just now.",
          hot("w32.retry", btn("Try again", { kind: "pri", icon: "refresh-line" })),
        ),
      )}`;
      break;
    case "saved-with-ongoing":
      body = `${head}${pagepad(
        intro,
        sectionTitle("Offered over time", chip("1", "plain")),
        card(offerRow({
          title: "Hosting climate workshops",
          meta: "Rocinha Community Garden · 2 places available",
          tag: "Ongoing",
          tone: "offer",
          hotId: "w32.open-series",
        }), { cls: "flat" }),
        sectionTitle("Saved details", chip("2", "plain")),
        card(
          offerRow({ title: "Visual and communication design", meta: "Posters, guides, and story materials", tag: "Ready to offer", tone: "plain", hotId: "w32.use-saved" }) +
            offerRow({ title: "Environmental action days", meta: "Clean-ups, planting days, shared repairs", tag: "Ready to offer", tone: "plain" }),
          { cls: "flat" },
        ),
        hot("w32.add", btn("Save offer details", { kind: "ghost", full: true, icon: "add-line" })),
        `<div class="t-meta">Saved privately to your account. Offering one in a garden is a separate, explicit step.</div>`,
      )}`;
      break;
    case "series-queued":
      body = `${head}${pagepad(
        intro,
        sectionTitle("Waiting to send", chip("1", "plain")),
        card(
          offerRow({ title: "Hosting climate workshops", meta: "Rocinha Community Garden · no places available", tag: "Queued", tone: "plain" }),
          { cls: "flat" },
        ),
        banner("This ongoing Offer is queued. It is not Active and nobody can take up a place yet.", "amber", "time-line"),
        sectionTitle("Saved details", chip("1", "plain")),
        card(offerRow({ title: "Hosting climate workshops", meta: "A two-hour session on local climate work", tag: "Saved privately", tone: "plain", hotId: "w32.use-saved" }), { cls: "flat" }),
      )}${syncBar("1 waiting to send")}`;
      break;
    case "series-queued-place-waiting":
      body = `${head}${pagepad(
        intro,
        sectionTitle("Waiting to send", chip("2", "plain")),
        card(
          offerRow({ title: "Hosting climate workshops", meta: "Rocinha Community Garden · ongoing Offer", tag: "Queued", tone: "plain" }) +
            offerRow({ title: "1 workshop session", meta: "Waiting for the ongoing Offer to send first", tag: "Waiting", tone: "plain" }),
          { cls: "flat" },
        ),
        banner("No availability is shown until the ongoing Offer and its dependent place have both sent in order.", "amber", "time-line"),
        sectionTitle("Saved details", chip("1", "plain")),
        card(offerRow({ title: "Hosting climate workshops", meta: "A two-hour session on local climate work", tag: "Saved privately", tone: "plain", hotId: "w32.use-saved" }), { cls: "flat" }),
      )}${syncBar("2 waiting to send")}`;
      break;
    default:
      body = `${head}${pagepad(
        intro,
        sectionTitle("Saved details", chip("1", "plain")),
        card(
          offerRow({ title: "Hosting climate workshops", meta: "A two-hour session on local climate work", tag: "Ready to offer", tone: "plain", hotId: "w32.use-saved" }),
          { cls: "flat" },
        ),
        hot("w32.add", btn("Save offer details", { kind: "ghost", full: true, icon: "add-line" })),
        `<div class="t-meta">Saved privately to your account. No garden, pool, ongoing Offer, or available place exists yet.</div>`,
      )}`;
  }
  return phoneFrame(`${body}<div style="flex:1"></div>`, {
    offline: state === "draft-unsaved" || state === "series-queued" || state === "series-queued-place-waiting",
    appBar: appBar("profile"),
  });
}

const W32_HOTS: HifiDef["hots"] = {
  "w32.add": { l: "Save offer details", to: "screen:W32@compose", info: "Saved Offer details are signed offchain profile data and reusable input to either path. Saving writes no pool, series, or commitment state." },
  "w32.add-first": { l: "Save offer details", to: "screen:W32@compose", info: "Empty-state entry into the same compose sheet." },
  "w32.save": { l: "Save privately", to: "screen:W32@saved", info: "Signed offchain persistence: the saved details follow the account to another device. Private until they are used to make an offer." },
  "w32.save-draft": { l: "Save privately", to: "screen:W32@saved", info: "Promotes a device-only draft to signed offchain storage. Until this runs, the draft cannot survive a device change." },
  "w32.persistence": { l: "How saving works", to: "screen:W32@persistence", info: "Explains the honest difference between signed saved details and an unsaved local draft." },
  "w32.persistence-done": { l: "Got it", to: "screen:W32@draft-unsaved", info: "Dismisses the explanation and returns to the unsaved draft." },
  "w32.use-saved": { l: "Use these details", to: "screen:W32@choose-path", info: "Opens the once-or-over-time choice. Saved details are input to either path, never a separate product object." },
  "w32.offer-once": { l: "Offer it once", to: "screen:W3@saved-offer-edit", info: "Enters a prefilled ordinary creation flow that preserves the saved workshop details and produces one Offer with commitmentSeriesId == 0. Nothing durable is created." },
  "w32.offer-over-time": { l: "Offer it over time", to: "screen:W33@garden", info: "Opens the garden picker, then creates the pool-scoped CommitmentSeries before any available place exists." },
  "w32.open-series": { l: "Open the ongoing offer", to: "screen:W34@active-two", info: "Opens the ongoing Offer — internally the pool-scoped CommitmentSeries — for an offer already made over time." },
  "w32.retry": { l: "Try again", to: "screen:W32@saved", info: "Re-reads signed offchain storage; nothing was lost by the failed read." },
};

const W33_STATES = [
  ["garden", "Choose a garden"], ["terms", "Describe the offer"], ["review", "Review"],
  ["queued", "Creating — queued"], ["place-waiting", "Place waiting for the offer"],
  ["waiting-membership", "Waiting for membership"], ["failed", "Send failed"],
] as const;
type W33State = (typeof W33_STATES)[number][0];

const w33Head = (title: string, step: number) =>
  `<div class="hdr"><button type="button" class="hback" aria-label="Close — preview only" disabled>${icon("close-line", "l")}</button><h1>${title}</h1><span class="hx">${stepDots(3, step)}</span></div>`;

function w33(state: W33State): string {
  let body: string;
  switch (state) {
    case "terms":
      body = `${w33Head("Offer over time", 1)}${pagepad(
        card(`${kv("Offer", "Hosting climate workshops")}${kv("Garden", "Rocinha Community Garden")}`),
        field("What people receive", input("A two-hour session on local climate work")),
        field("Unit", input("workshop sessions", { select: true })),
        `<div class="t-meta">You choose how many places to open after the ongoing Offer exists. Creating it opens nothing on its own.</div>`,
        hot("w33.continue-terms", btn("Continue", { kind: "pri", full: true })),
      )}`;
      break;
    case "review":
      body = `${w33Head("Offer over time", 2)}${pagepad(
        card(`${kv("Offer", "Hosting climate workshops")}${kv("Garden", "Rocinha Community Garden")}${kv("Unit", "workshop sessions")}${kv("Places open now", "None — you add them next")}${kv("Next cycle", "Ask me again next cycle")}`),
        banner("An ongoing Offer keeps this offer's history together in one garden. It never renews itself and never asks anything of you on its own.", "stone", "information-line"),
        hot("w33.create", btn("Start offering over time", { kind: "pri", full: true })),
      )}`;
      break;
    case "queued":
      body = `${w33Head("Offer over time", 3)}${pagepad(
        card(
          listRow({ icon: "seedling-line", primary: "Hosting climate workshops", meta: "Rocinha Community Garden", chipHtml: chip("Queued", "queued") }),
        ),
        banner("Saved on this phone. It sends when you are connected.", "amber", "time-line"),
        `<div class="t-meta">No places are available yet. It becomes active once this sends, and you choose places after that.</div>`,
        hot("w33.queued-done", btn("Back to my offers", { kind: "ghost", full: true })),
      )}${syncBar("1 waiting to send")}`;
      break;
    case "place-waiting":
      body = `${w33Head("Offer over time", 3)}${pagepad(
        card(
          listRow({ icon: "seedling-line", primary: "Hosting climate workshops", meta: "Ongoing Offer · sending", chipHtml: chip("Queued", "queued") }) +
            listRow({ icon: "calendar-line", primary: "1 place · Season of First Rains", meta: "Waiting for the ongoing Offer to send first", chipHtml: chip("Waiting", "plain") }),
          { cls: "flat" },
        ),
        banner("The place waits for the offer it belongs to. No retries are used while it waits.", "stone", "time-line"),
        `<div class="t-meta">If you discard it, this place stays as a draft and explains what it is waiting for.</div>`,
        hot("w33.waiting-done", btn("Back to my offers", { kind: "ghost", full: true })),
      )}${syncBar("2 waiting to send")}`;
      break;
    case "waiting-membership":
      body = `${w33Head("Offer over time", 3)}${pagepad(
        card(
          listRow({ icon: "seedling-line", primary: "Hosting climate workshops", meta: "Rocinha Community Garden", chipHtml: chip("Waiting for membership", "plain") }),
        ),
        banner("This send is waiting for your garden membership. No retry is used while it waits.", "stone", "time-line"),
        `<div class="t-meta">It resumes automatically when membership is visible. You can check again now or cancel this send and keep the offer details saved privately.</div>`,
        `<div class="brow">${hot("w33.membership-resume", btn("Check again", { kind: "pri", icon: "refresh-line" }))}${hot("w33.membership-cancel", btn("Cancel this send", { kind: "ghost" }))}</div>`,
      )}${syncBar("1 waiting for membership")}`;
      break;
    case "failed":
      body = `${w33Head("Offer over time", 3)}${pagepad(
        banner("The ongoing Offer could not be sent.", "error", "error-warning-line"),
        card(
          listRow({ icon: "seedling-line", primary: "Hosting climate workshops", meta: "Rocinha Community Garden", chipHtml: chip("Send failed", "err") }),
        ),
        `<div class="t-meta">Your description is kept. Retry when you have signal, or discard the send and keep the details saved privately.</div>`,
        `<div class="brow">${hot("w33.retry", btn("Try again", { kind: "pri", icon: "refresh-line" }))}${hot("w33.discard", btn("Discard the send", { kind: "ghost" }))}</div>`,
      )}`;
      break;
    default:
      body = `${w33Head("Offer over time", 0)}${pagepad(
        `<div class="t-meta">Choose where you will keep offering this. Each garden keeps its own ongoing Offer and its own history.</div>`,
        field("Garden", radio([
          { label: "Rocinha Community Garden", meta: "you are a gardener here · pool open", on: true },
          { label: "Muizenberg Deep South", meta: "you are a gardener here · pool open" },
        ], { interactive: true, name: "series-garden" })),
        banner("An ongoing Offer lives in one garden. Offering the same thing elsewhere is a separate ongoing Offer there.", "stone", "information-line"),
        hot("w33.continue-garden", btn("Continue", { kind: "pri", full: true })),
      )}`;
  }
  return phoneFrame(`${body}<div style="flex:1"></div>`, { offline: state === "queued" || state === "place-waiting" || state === "waiting-membership" || state === "failed", appBar: false });
}

const W33_HOTS: HifiDef["hots"] = {
  "w33.continue-garden": { l: "Continue to the offer", to: "screen:W33@terms", info: "Binds the series to one pool. Cross-garden merge does not exist; a second garden means a second series." },
  "w33.continue-terms": { l: "Continue to review", to: "screen:W33@review", info: "Series metadata only. Places, counts, and cycle scope belong to the ordinary commitments created later." },
  "w33.create": { l: "Start offering over time", to: "screen:W33@queued", info: "Queues createCommitmentSeries. The caller becomes immutable creator and initial current holder; no place and no availability exist yet.", calls: ["createCommitmentSeries"], pendingSync: true },
  "w33.queued-done": { l: "Back to my offers", to: "screen:W32@series-queued", info: "The ongoing Offer remains visibly queued and unavailable; it appears as Active only after its creation syncs." },
  "w33.waiting-done": { l: "Back to my offers", to: "screen:W32@series-queued-place-waiting", info: "Both the queued ongoing Offer and its dependent waiting place remain visible without fabricating availability or transaction order." },
  "w33.membership-resume": { l: "Check membership again", to: "screen:W33@queued", info: "Rechecks the required pool-garden Hat. The same series job resumes without spending a retry only after membership is observed." },
  "w33.membership-cancel": { l: "Cancel this send", to: "screen:W32@saved", info: "Cancels the waiting series job without deleting the signed private Offer details. No onchain series or place exists." },
  "w33.retry": { l: "Try again", to: "screen:W33@queued", info: "Re-queues the same series creation; the entered description is preserved." },
  "w33.discard": { l: "Discard the send", to: "screen:W32@saved", info: "Discards the queued series job. The saved details stay privately stored and any dependent place draft explains what it was waiting for." },
};

const W34_STATES = [
  ["active-two", "Active · 2 places"], ["active-none", "Active · no places"], ["active-one", "Active · 1 place"],
  ["places-queued", "Active · 2 places queued"], ["places-partial", "Active · 1 available + 1 queued"],
  ["places-partial-failed", "Active · 1 available + 1 failed"],
  ["story", "Story"], ["participation", "Story vs pool history"], ["ask-again", "Next cycle"],
  ["claimant-view", "Seen by another member"],
  ["pool-paused", "Active · pool paused"], ["pool-closed", "Active · pool closed"],
  ["pool-composted", "Active · pool composted"],
  ["resting", "Resting"], ["retire-confirm", "Retire — confirm"], ["retired", "Retired"],
  ["succession", "Later: sharing and handing on"],
  ["loading", "Loading"], ["read-error", "Read error"],
] as const;
type W34State = (typeof W34_STATES)[number][0];

const W34_CLAIMANT_ALLOWED_FIELDS = [
  "provider",
  "terms",
  "garden",
  "availablePlaces",
  "placeTerms",
  "claimExplanation",
] as const;
type W34ClaimantField = (typeof W34_CLAIMANT_ALLOWED_FIELDS)[number];
const W34_CLAIMANT_PUBLIC_DATA: Record<W34ClaimantField, string> = {
  provider: "Maria",
  terms: "A two-hour session on local climate work",
  garden: "Rocinha Community Garden",
  availablePlaces: "2",
  placeTerms: "Season of First Rains · 2 hours",
  claimExplanation:
    "Taking up a place opens that promise. The other place stays available for someone else.",
};
const claimantField = (fieldName: W34ClaimantField, html: string) =>
  `<div data-claimant-field="${fieldName}">${html}</div>`;

const w34Head = (opts: { state: string; tone: "offer" | "plain" | "ink" }) =>
  `${hdr("Hosting climate workshops", { back: true })}<div class="hsub">Rocinha Community Garden · ${opts.state}</div>`;

// Availability is never decorative: every place is an existing Offered
// instance whose provider slot was reserved when it was created.
const w34Places = (n: number) => {
  if (n === 0) {
    return card(
      `<div class="t-title">No places available right now</div><div class="t-meta">Nothing is open for anyone to take up. Adding a place creates a real promise that reserves your capacity straight away.</div>` +
        hot("w34.add-places", btn("Add places", { kind: "pri", full: true, icon: "add-line" })),
    );
  }
  const rows = Array.from({ length: n }, (_, i) =>
    listRow({
      icon: "calendar-line",
      primary: `Workshop session ${i + 1}`,
      meta: "Season of First Rains · 2 hours",
      chipHtml: stateChip("Offered"),
      chevron: true,
    }),
  ).join("");
  return card(
    `<div class="cardrow"><div class="grow"><div class="t-title num">${n} ${n === 1 ? "place" : "places"} available now</div><div class="t-meta">Each one is a real promise waiting to be taken up.</div></div></div>${rows}` +
      hot("w34.add-places", btn("Add places", { kind: "ghost", full: true, icon: "add-line" })),
  );
};

const w34StoryTimeline = () =>
  timeline([
    { label: "Kept — market-day session", meta: "Jul 12 · Season of First Rains" },
    { label: "Kept — school visit", meta: "Jun 28 · Season of First Rains" },
    { label: "Under review by stewards, then kept", meta: "Jun 02 · Season of First Rains", warn: true, note: "Rescheduled after rain, reviewed, and confirmed. The record stays exactly as it happened." },
    { label: "Withdrawn before anyone took it up", meta: "May 20 · Season of Seedlings" },
    { label: "Ran out of time — nobody took it up", meta: "Apr 30 · Season of Seedlings" },
    { label: "Kept — solar co-op introduction", meta: "Apr 06 · Season of Seedlings" },
  ]);

function w34(state: W34State): string {
  let body: string;
  switch (state) {
    case "active-none":
      body = `${w34Head({ state: "Active", tone: "offer" })}${pagepad(
        w34Places(0),
        card(`${kv("Kept", "12 times across 5 cycles")}${kv("Unit", "workshop sessions")}`),
        hot("w34.open-story", btn("See the whole story", { kind: "ghost", full: true })),
      )}`;
      break;
    case "active-one":
      body = `${w34Head({ state: "Active", tone: "offer" })}${pagepad(
        banner("One place is available now. It is already an ordinary Offer with reserved capacity.", "green", "hand-heart-line"),
        w34Places(1),
        card(`${kv("Kept", "12 times across 5 cycles")}${kv("Available now", "1 place")}`),
      )}`;
      break;
    case "places-queued":
      body = `${w34Head({ state: "Active", tone: "offer" })}${pagepad(
        banner("Two places are waiting to send. They are not available yet.", "amber", "time-line"),
        card(
          `<div class="t-title">No places available right now</div><div class="t-meta">Nobody can take up either place until each creation has sent and reserved your capacity.</div>` +
            listRow({ icon: "calendar-line", primary: "Workshop session 1", meta: "Season of First Rains · waiting to send", chipHtml: chip("Queued", "queued") }) +
            listRow({ icon: "calendar-line", primary: "Workshop session 2", meta: "Season of First Rains · waiting to send", chipHtml: chip("Queued", "queued") }),
        ),
        card(`${kv("Available now", "0 places")}${kv("Waiting to send", "2 places")}${kv("Unit", "workshop sessions")}`),
      )}${syncBar("2 waiting to send")}`;
      break;
    case "places-partial":
      body = `${w34Head({ state: "Active", tone: "offer" })}${pagepad(
        banner("One place is available. The other is still waiting to send.", "amber", "time-line"),
        card(
          listRow({ icon: "calendar-line", primary: "Workshop session 1", meta: "Season of First Rains · 2 hours", chipHtml: stateChip("Offered") }) +
            listRow({ icon: "calendar-line", primary: "Workshop session 2", meta: "Season of First Rains · waiting to send", chipHtml: chip("Queued", "queued") }) +
            hot("w34.claim-partial", btn("Take up the available place", { kind: "pri", full: true })),
          { cls: "flat" },
        ),
        card(`${kv("Available now", "1 place")}${kv("Waiting to send", "1 place")}`),
        hot("w34.view-partial", btn("View send details", { kind: "ghost", full: true })),
      )}${syncBar("1 waiting to send")}`;
      break;
    case "places-partial-failed":
      body = `${w34Head({ state: "Active", tone: "offer" })}${pagepad(
        banner("One place is available. The other could not be sent.", "error", "error-warning-line"),
        card(
          listRow({ icon: "calendar-line", primary: "Workshop session 1", meta: "Season of First Rains · 2 hours", chipHtml: stateChip("Offered") }) +
            listRow({ icon: "calendar-line", primary: "Workshop session 2", meta: "Season of First Rains · send failed", chipHtml: chip("Send failed", "err") }) +
            hot("w34.claim-partial", btn("Take up the available place", { kind: "pri", full: true })),
          { cls: "flat" },
        ),
        card(`${kv("Available now", "1 place")}${kv("Needs attention", "1 place")}`),
        `<div class="brow">${hot("w34.retry-failed-place", btn("Try failed place again", { kind: "pri", icon: "refresh-line" }))}${hot("w34.discard-failed-place", btn("Discard failed place", { kind: "ghost" }))}</div>`,
      )}`;
      break;
    case "story":
      body = `${w34Head({ state: "Active", tone: "offer" })}${pagepad(
        card(`<div class="t-title num">Kept 12 times across 5 cycles</div><div class="t-meta">Every entry below is its own promise, with its own evidence and confirmation. Nothing here is a rating.</div>`),
        sectionTitle("This offer's story"),
        card(w34StoryTimeline(), { cls: "flat" }),
        hot("w34.story-row", btn("Open the July session", { kind: "ghost", full: true })),
        `<div class="t-meta">Reported participants come from what people wrote in their evidence, not from the record itself.</div>`,
      )}`;
      break;
    case "participation":
      body = `${w34Head({ state: "Active", tone: "offer" })}${pagepad(
        sectionTitle("This offer's story"),
        card(`${kv("Kept", "12 times across 5 cycles")}${kv("Withdrawn or ran out", "2")}${kv("Reported participants", "31 · from evidence notes")}`),
        `<div class="t-meta">One offer, in this garden, over time.</div>`,
        sectionTitle("Your part in this pool"),
        card(`${kv("Kept", "18 promises")}${kv("Taken up from others", "7")}${kv("Confirmations you gave", "23")}`),
        `<div class="t-meta">Everything you have offered or received here, across every promise — not only this one offer. Visible to you and this garden's stewards.</div>`,
        banner("These are two different views. Neither is a score, and neither is compared with anyone else.", "stone", "information-line"),
      )}`;
      break;
    case "ask-again":
      body = `${w34Head({ state: "Active", tone: "offer" })}${pagepad(
        card(
          `<div class="t-title">A new season is open</div><div class="t-meta">Season of Long Rains started on Sep 1. Would you like to offer workshop sessions again?</div>` +
            `<div class="brow">${hot("w34.ask-again-yes", btn("Add places", { kind: "pri", icon: "add-line" }))}${hot("w34.ask-again-not-now", btn("Not this season", { kind: "ghost" }))}</div>`,
        ),
        `<div class="t-meta">Nothing is created until you choose. Saying no changes nothing about this offer or its story.</div>`,
        card(`${kv("Kept", "12 times across 5 cycles")}${kv("Places available", "None")}`),
      )}`;
      break;
    case "claimant-view":
      body = `${w34Head({ state: "Active", tone: "offer" })}${pagepad(
        `<div data-privacy-contract="ongoing-offer-claimant-v1">` +
          card(
            claimantField("provider", kv("Offered by", W34_CLAIMANT_PUBLIC_DATA.provider)) +
              claimantField("terms", kv("What you receive", W34_CLAIMANT_PUBLIC_DATA.terms)) +
              claimantField("garden", kv("Garden", W34_CLAIMANT_PUBLIC_DATA.garden)),
          ) +
          card(
            claimantField(
              "availablePlaces",
              `<div class="t-title num">${W34_CLAIMANT_PUBLIC_DATA.availablePlaces} places available now</div><div class="t-meta">Each place is already held open for whoever takes it up.</div>`,
            ) +
              claimantField(
                "placeTerms",
                listRow({ icon: "calendar-line", primary: "Workshop session 1", meta: W34_CLAIMANT_PUBLIC_DATA.placeTerms, chipHtml: stateChip("Offered") }) +
                  listRow({ icon: "calendar-line", primary: "Workshop session 2", meta: W34_CLAIMANT_PUBLIC_DATA.placeTerms, chipHtml: stateChip("Offered") }) +
                  hot("w34.claim", btn("Take up one place", { kind: "pri", full: true })),
              ),
          ) +
          claimantField(
            "claimExplanation",
            `<div class="t-meta">${W34_CLAIMANT_PUBLIC_DATA.claimExplanation}</div>`,
          ) +
          `</div>`,
      )}`;
      break;
    case "pool-paused":
      body = `${w34Head({ state: "Active · pool paused", tone: "plain" })}${pagepad(
        banner("This pool is paused. Existing promises and the offer's story are unchanged.", "amber", "pause-line"),
        card(
          `<div class="t-title">2 existing places are held, but cannot be taken up while paused</div>` +
            listRow({ icon: "calendar-line", primary: "Workshop session 1", meta: "Season of First Rains · unavailable while pool paused", chipHtml: chip("Paused", "queued") }) +
            listRow({ icon: "calendar-line", primary: "Workshop session 2", meta: "Season of First Rains · unavailable while pool paused", chipHtml: chip("Paused", "queued") }),
        ),
        card(`${kv("Add places", "Unavailable while paused")}${kv("Existing history", "Preserved")}`),
        hot("w34.open-paused-pool", btn("View the paused pool", { kind: "ghost", full: true })),
      )}`;
      break;
    case "pool-closed":
      body = `${w34Head({ state: "Active · pool closed", tone: "plain" })}${pagepad(
        banner("This pool is closed. No place can be added or taken up.", "stone", "information-line"),
        card(
          `<div class="t-title">Places preserved as history</div>` +
            listRow({ icon: "calendar-line", primary: "Workshop session 1", meta: "Held when the pool closed · unavailable", chipHtml: chip("Closed", "plain") }) +
            listRow({ icon: "calendar-line", primary: "Workshop session 2", meta: "Held when the pool closed · unavailable", chipHtml: chip("Closed", "plain") }),
        ),
        card(`${kv("This offer's Story", "Still available")}${kv("New or claimed places", "Unavailable until stewards reopen the pool")}`),
        hot("w34.open-closed-pool", btn("View the closed pool", { kind: "ghost", full: true })),
      )}`;
      break;
    case "pool-composted":
      body = `${w34Head({ state: "Active · pool composted", tone: "ink" })}${pagepad(
        banner("This pool has been composted. Its history remains readable, but it cannot reopen.", "stone", "leaf-line"),
        card(`<div class="t-title num">Kept 12 times across 5 cycles</div><div class="t-meta">Past promises and evidence remain exactly as recorded. No place can be added or taken up.</div>`),
        hot("w34.open-story", btn("See the whole story", { kind: "ghost", full: true })),
        hot("w34.open-composted-pool", btn("View the archived pool", { kind: "ghost", full: true })),
      )}`;
      break;
    case "resting":
      body = `${w34Head({ state: "Resting", tone: "plain" })}${pagepad(
        banner("Resting since Aug 2. No new places can be added while it rests.", "stone", "pause-line"),
        card(
          `<div class="t-title">2 existing places remain available</div><div class="t-meta">Resting blocks only new places. These already-reserved Offers can still be taken up.</div>` +
            listRow({ icon: "calendar-line", primary: "Workshop session 1", meta: "Season of First Rains · 2 hours", chipHtml: stateChip("Offered") }) +
            listRow({ icon: "calendar-line", primary: "Workshop session 2", meta: "Season of First Rains · 2 hours", chipHtml: stateChip("Offered") }) +
            hot("w34.claim-resting", btn("Take up one place", { kind: "pri", full: true })),
        ),
        card(`${kv("Kept", "12 times across 5 cycles")}${kv("Available now", "2 places")}${kv("Add places", "Paused while resting")}`),
        `<div class="brow">${hot("w34.resume", btn("Start offering again", { kind: "pri" }))}${hot("w34.open-story-resting", btn("See the story", { kind: "ghost" }))}</div>`,
      )}`;
      break;
    case "retire-confirm":
      body = sheetOver(
        w34Head({ state: "Active", tone: "offer" }) + pagepad(card(`${kv("Kept", "12 times across 5 cycles")}`)),
        "Retire this ongoing Offer?",
        `<div class="t-meta">Retiring is final. You will not be able to add places or start it again.</div>` +
          card(
            `${kv("Promises already made", "Keep their state and their history")}${kv("This offer's story", "Stays exactly as it is")}${kv("Your saved details", "Stay saved privately to you")}`,
          ) +
          `<div class="brow">${hot("w34.retire-confirm", btn("Retire it", { kind: "danger" }))}${hot("w34.retire-cancel", btn("Keep it", { kind: "ghost" }))}</div>`,
      );
      break;
    case "retired":
      body = `${w34Head({ state: "Retired", tone: "ink" })}${pagepad(
        banner("Retired on Aug 2. This ongoing Offer is closed for good.", "stone", "information-line"),
        card(`<div class="t-title num">Kept 12 times across 5 cycles</div><div class="t-meta">The story stays here. Nothing that was already promised or kept has changed.</div>`),
        card(w34StoryTimeline(), { cls: "flat" }),
        `<div class="t-meta">Your saved details are still there. You can offer it in a garden again whenever you want to.</div>`,
      )}`;
      break;
    case "succession":
      body = `${w34Head({ state: "Active", tone: "offer" })}${pagepad(
        banner("Not built yet — this is what we are working towards.", "amber", "eye-line"),
        sectionTitle("Later: sharing and handing on"),
        card(
          `${kv("Share it with someone", "Two people hold the same ongoing Offer, with both saying yes")}` +
            `${kv("Teach someone alongside you", "They are credited for the sessions they help with")}` +
            `${kv("Hand it on", "You offer, they accept, and the story keeps its history")}` +
            `${kv("Let someone start their own", "A new ongoing Offer that says where it grew from")}` +
            `${kv("Let the garden hold it", "The garden stewards it and each session names its own lead")}`,
        ),
        `<div class="t-meta">None of these can be done yet. Every one of them will need both people to agree, and none of them moves a promise you have already made.</div>`,
        `<div class="t-meta">What you can do today: add places, rest, or retire.</div>`,
      )}`;
      break;
    case "loading":
      body = `${w34Head({ state: "Loading", tone: "plain" })}${pagepad(skeleton({ title: true, lines: 2 }), skeleton({ lines: 3 }), skeleton({ lines: 2 }))}`;
      break;
    case "read-error":
      body = `${w34Head({ state: "Cannot load", tone: "plain" })}${pagepad(
        emptyState(
          "wifi-off-line",
          "Cannot load this ongoing Offer",
          "Its places and story are safe. This device could not reach them just now.",
          hot("w34.retry", btn("Try again", { kind: "pri", icon: "refresh-line" })),
        ),
      )}`;
      break;
    default:
      body = `${w34Head({ state: "Active", tone: "offer" })}${pagepad(
        w34Places(2),
        card(`${kv("Kept", "12 times across 5 cycles")}${kv("Unit", "workshop sessions")}${kv("Next cycle", "Ask me again next cycle")}`),
        hot("w34.open-story", btn("See the whole story", { kind: "ghost", full: true })),
        sectionTitle("Looking after this offer"),
        `<div class="brow">${hot("w34.rest", btn("Rest it for now", { kind: "ghost", icon: "pause-line" }))}${hot("w34.retire", btn("Retire it", { kind: "ghost" }))}</div>`,
        hot("w34.succession", btn("Sharing and handing on — later", { kind: "ghost", full: true, icon: "eye-line" })),
      )}`;
  }
  return phoneFrame(`${body}<div style="flex:1"></div>`, { offline: state === "places-queued", appBar: appBar("home") });
}

const W34_HOTS: HifiDef["hots"] = {
  "w34.add-places": { l: "Add places", to: "screen:W35@compose", info: "Opens the finite-batch place flow. Each place becomes one ordinary Offer instance that reserves provider capacity at creation." },
  "w34.open-story": { l: "See the whole story", to: "screen:W34@story", info: "Exact linked-instance history and absolute counts. Never a rate, rank, or comparison." },
  "w34.open-story-resting": { l: "See the story", to: "screen:W34@story", info: "Resting hides nothing: the story stays fully readable." },
  "w34.story-row": { l: "Open one kept promise", to: "screen:W2@fulfilled", info: "Every story row is an ordinary immutable Commitment with its own evidence and confirmation." },
  "w34.claim": { l: "Take up one place", to: "screen:W2@support-active", info: "Accepts one already-created Offered service instance. No new place is created and no second provider slot is consumed.", calls: ["claimCommitment"] },
  "w34.claim-partial": { l: "Take up the available place", to: "screen:W2@support-active", info: "Accepts only the already-synced Offered service instance. The queued or failed sibling remains independent.", calls: ["claimCommitment"] },
  "w34.claim-resting": { l: "Take up one resting-series place", to: "screen:W2@support-active", info: "Resting blocks new instance creation only. This accepts an existing capacity-backed Offered service instance without resuming the series.", calls: ["claimCommitment"] },
  "w34.open-paused-pool": { l: "View the paused pool", to: "screen:W1@paused", info: "Shows the pool-level pause reason and steward-owned resume path. The series and existing instances remain intact, but Add and claim stay disabled." },
  "w34.open-closed-pool": { l: "View the closed pool", to: "screen:W1@closed", info: "Shows the closed pool state. Reopening is a steward action; the ongoing Offer detail does not fabricate a gardener write." },
  "w34.open-composted-pool": { l: "View the archived pool", to: "screen:W1@closed", info: "Returns to the terminal pool archive. Composted pools cannot reopen, while existing series history remains readable." },
  "w34.view-partial": { l: "View send details", to: "screen:W35@mixed-queued", info: "Shows the independently synced and queued place rows rather than treating the two jobs as an atomic batch." },
  "w34.retry-failed-place": { l: "Try failed place again", to: "screen:W34@places-partial", info: "Retries the same failed createCommitment job. The already-synced sibling stays available and is never re-submitted.", calls: ["createCommitment"], pendingSync: true },
  "w34.discard-failed-place": { l: "Discard failed place", to: "screen:W34@active-one", info: "Discards only the failed local job. The synced Offered sibling remains available with its reserved capacity." },
  "w34.rest": { l: "Rest it for now", to: "screen:W34@resting", info: "Blocks new places. Existing Offered and Accepted promises and the whole story are untouched.", calls: ["restCommitmentSeries"] },
  "w34.resume": { l: "Start offering again", to: "screen:W34@active-two", info: "Returns the ongoing Offer to Active without changing its two existing Offered places or creating another one.", calls: ["resumeCommitmentSeries"] },
  "w34.retire": { l: "Retire it", to: "screen:W34@retire-confirm", info: "Opens the terminal confirmation. Retiring takes no reason in the initial contract, so no reason field is drawn." },
  "w34.retire-confirm": { l: "Retire it", to: "screen:W34@retired", info: "Terminal. Existing instances keep their state and history; the saved details stay privately stored.", calls: ["retireCommitmentSeries"] },
  "w34.retire-cancel": { l: "Keep it", to: "screen:W34@active-two", info: "Dismisses the confirmation with no state change." },
  "w34.ask-again-yes": { l: "Add places", to: "screen:W35@compose", info: "Current consent before any new promise. The protocol never creates a place on a schedule." },
  "w34.ask-again-not-now": { l: "Not this season", to: "screen:W34@active-none", info: "Declining creates nothing and changes neither this offer nor its story." },
  "w34.succession": { l: "Sharing and handing on — later", to: "screen:W34@succession", info: "Labelled horizon only. The initial contract exposes rest, resume, and retire and nothing else." },
  "w34.retry": { l: "Try again", to: "screen:W34@active-two", info: "Re-reads the indexed ongoing Offer after a failed read." },
};

const W35_STATES = [
  ["compose", "How many places"], ["queued", "Places queued"],
  ["mixed-queued", "1 synced + 1 queued"], ["mixed-failed", "1 synced + 1 failed"],
] as const;
type W35State = (typeof W35_STATES)[number][0];

function w35(state: W35State): string {
  const head = `<div class="hdr"><button type="button" class="hback" aria-label="Close — preview only" disabled>${icon("close-line", "l")}</button><h1>Add places</h1></div>`;
  let body: string;
  switch (state) {
    case "queued":
      body = `${head}${pagepad(
        card(
          listRow({ icon: "calendar-line", primary: "Workshop session 1", meta: "Season of First Rains", chipHtml: chip("Queued", "queued") }) +
            listRow({ icon: "calendar-line", primary: "Workshop session 2", meta: "Season of First Rains", chipHtml: chip("Queued", "queued") }),
          { cls: "flat" },
        ),
        banner("Saved on this phone. They send when you are connected.", "amber", "time-line"),
        `<div class="t-meta">They show as available only once they have sent and your capacity is held for them. Until then nobody can take them up.</div>`,
        hot("w35.queued-done", btn("Back to this offer", { kind: "ghost", full: true })),
      )}${syncBar("2 waiting to send")}`;
      break;
    case "mixed-queued":
      body = `${head}${pagepad(
        banner("One place sent. The other is still waiting.", "amber", "time-line"),
        card(
          listRow({ icon: "calendar-line", primary: "Workshop session 1", meta: "Season of First Rains · capacity reserved", chipHtml: stateChip("Offered") }) +
            listRow({ icon: "calendar-line", primary: "Workshop session 2", meta: "Season of First Rains · waiting to send", chipHtml: chip("Queued", "queued") }),
          { cls: "flat" },
        ),
        card(`${kv("Available now", "1 place")}${kv("Waiting to send", "1 place")}`),
        hot("w35.mixed-queued-done", btn("Back to this offer", { kind: "ghost", full: true })),
      )}${syncBar("1 waiting to send")}`;
      break;
    case "mixed-failed":
      body = `${head}${pagepad(
        banner("One place sent. The other could not be sent.", "error", "error-warning-line"),
        card(
          listRow({ icon: "calendar-line", primary: "Workshop session 1", meta: "Season of First Rains · capacity reserved", chipHtml: stateChip("Offered") }) +
            listRow({ icon: "calendar-line", primary: "Workshop session 2", meta: "Season of First Rains · send failed", chipHtml: chip("Send failed", "err") }),
          { cls: "flat" },
        ),
        card(`${kv("Available now", "1 place")}${kv("Needs attention", "1 place")}`),
        `<div class="brow">${hot("w35.retry-failed", btn("Try failed place again", { kind: "pri", icon: "refresh-line" }))}${hot("w35.discard-failed", btn("Discard failed place", { kind: "ghost" }))}</div>`,
        hot("w35.mixed-failed-done", btn("Back to this offer", { kind: "ghost", full: true })),
      )}`;
      break;
    default:
      body = `${head}${pagepad(
        card(`${kv("Offer", "Hosting climate workshops")}${kv("Garden", "Rocinha Community Garden")}`),
        field("How many places", input("2")),
        `<div class="t-meta">Each place becomes its own promise with these terms. Someone takes up one place at a time.</div>`,
        field("When", radio([
          { label: "Season of First Rains", meta: "runs through Aug 30", on: true },
          { label: "No season", meta: "stands on its own" },
        ], { interactive: true, name: "places-cycle" })),
        field("How long each session runs", input("2 hours")),
        banner("Adding places holds your capacity for them straight away, so nobody sees a place that is not really open.", "stone", "information-line"),
        hot("w35.submit", btn("Add 2 places", { kind: "pri", full: true })),
      )}`;
  }
  return phoneFrame(`${body}<div style="flex:1"></div>`, { offline: state !== "compose", appBar: false });
}

const W35_HOTS: HifiDef["hots"] = {
  "w35.submit": { l: "Add places", to: "screen:W35@queued", info: "Queues one ordinary createCommitment per place against the Active series. Each creation registers its class and reserves one provider slot immediately.", calls: ["createCommitment"], pendingSync: true },
  "w35.queued-done": { l: "Back to this offer", to: "screen:W34@places-queued", info: "The two queued places remain visible but unavailable. Availability appears only after the place creations sync and their capacity is reserved." },
  "w35.mixed-queued-done": { l: "Back to this offer", to: "screen:W34@places-partial", info: "The ongoing Offer shows one real available place and one queued sibling." },
  "w35.retry-failed": { l: "Try failed place again", to: "screen:W35@mixed-queued", info: "Retries only the failed createCommitment job and leaves the synced Offered row untouched.", calls: ["createCommitment"], pendingSync: true },
  "w35.discard-failed": { l: "Discard failed place", to: "screen:W34@active-one", info: "Discards only the failed local job. The synced place remains available." },
  "w35.mixed-failed-done": { l: "Back to this offer", to: "screen:W34@places-partial-failed", info: "The ongoing Offer preserves the synced place's availability and the failed sibling's recovery controls." },
};

const w32Facts = (_state: W32State): StateFacts | undefined => undefined;

const w33Facts = (state: W33State): StateFacts | undefined =>
  state === "garden" ? { pool: "Open" } : { pool: "Open" };

const w34Facts = (state: W34State): StateFacts | undefined => {
  if (state === "loading" || state === "read-error") return undefined;
  if (state === "resting")
    return { pool: "Open", cycle: "Open", series: "Resting", commitment: "Offered", kind: "SupportService" };
  if (state === "retired") return { pool: "Open", series: "Retired" };
  if (state === "pool-paused") return { pool: "Paused", series: "Active", commitment: "Offered", kind: "SupportService" };
  if (state === "pool-closed") return { pool: "Closed", series: "Active", commitment: "Offered", kind: "SupportService" };
  if (state === "pool-composted") return { pool: "Composted", series: "Active" };
  if (["active-two", "active-one", "places-partial", "places-partial-failed", "claimant-view"].includes(state))
    return { pool: "Open", cycle: "Open", series: "Active", commitment: "Offered", kind: "SupportService" };
  return { pool: "Open", series: "Active" };
};

const w35Facts = (state: W35State): StateFacts =>
  state === "mixed-queued" || state === "mixed-failed"
    ? { pool: "Open", cycle: "Open", series: "Active", commitment: "Offered", kind: "SupportService" }
    : { pool: "Open", series: "Active" };

const mk = <T extends readonly (readonly [string, string])[]>(
  id: string,
  title: string,
  states: T,
  render: (s: T[number][0]) => string,
  facts: (s: T[number][0]) => StateFacts | undefined = () => undefined,
  proposed: Set<string> = new Set(),
) => ({
  screen: {
    id, title, surface: "client" as const, frame: "phone" as const, group: "Client PWA",
    states: states.map(([sid, label]) => ({ id: sid, label, proposed: proposed.has(sid), facts: facts(sid), html: render(sid) })),
  },
});

export const CLIENT_DEFS: HifiDef[] = [
  { ...mk("W1", "W1 · Pool tab (garden detail)", W1_STATES, w1, w1Facts), hots: W1_HOTS },
  { ...mk("W2", "W2 · Commitment detail", W2_STATES, w2, w2Facts), hots: W2_HOTS },
  { ...mk("W2b", "W2b · Team and contributions", W2B_STATES, w2b), hots: W2B_HOTS },
  { ...mk("W2a", "W2a · Evidence sheet", [
    ["compose", "Compose"], ["compose-request", "Compose — a request"],
    ["compose-campaign-request", "Compose — Campaign request"],
    ["compose-support", "Compose — service offer"], ["compose-captured", "Compose — recorded promise"],
    ["queued", "Queued"], ["failed", "Upload failed"],
  ] as const, w2a, w2aFacts), hots: W2A_HOTS },
  { ...mk("W3", "W3 · Offer/request creation", W3_STATES, w3, w3Facts), hots: W3_HOTS },
  { ...mk("W4", "W4 · Confirmation sheet", W4_STATES, w4, w4Facts), hots: W4_HOTS },
  { ...mk("W32", "W32 · Things I can offer", W32_STATES, w32, w32Facts), hots: W32_HOTS },
  { ...mk("W33", "W33 · Offer over time", W33_STATES, w33, w33Facts), hots: W33_HOTS },
  { ...mk("W34", "W34 · Ongoing Offer detail", W34_STATES, w34, w34Facts), hots: W34_HOTS },
  { ...mk("W35", "W35 · Add places", W35_STATES, w35, w35Facts), hots: W35_HOTS },
];
