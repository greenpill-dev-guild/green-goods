// Client PWA hi-fi screens — W1 pool home, W2 commitment detail, W2a evidence
// sheet, W3 creation flow, W4 confirmation sheet. Warm Earth dialect (.sc),
// phone frame. Copy sources: uiux-spec §5 + wireframes.md §2 annotations;
// sample content continues the lo-fi set (Rocinha, Season of First Rains,
// "Prune the north beds", Maria/João/Ana). Progressive-disclosure rules per
// wireframes.md:166: state + next action in the viewport; Timeline / Evidence
// / Work behind disclosures; identifiers behind a single Details disclosure.
// Dissolved lo-fi variants: W1P/W1S → W1@claim-*, MF3 → W2@expired, MF5 →
// W1@waiting-membership, MF6 → W2@request-evidence-submitted, MF10 → W1@cycle-summary.

import { CYCLE, POOL_LIFETIME, SEASON_CLOSED, SEASON_LIVE } from "../fixtures";
import { esc, hot } from "../html";
import { icon } from "../icons";
import {
  actionBar, appBar, banner, btn, card, chip, cycleRail, disclosure, emptyState, fabButton, field, flowHeader, gardenHeader, gardenTabs, hdr, hero,
  input, kindCards, kv, listRow, meter, pagepad, phoneFrame, radio, reasonChips, sectionTitle, seg,
  sheetOver, skeleton, stateChip, syncBar, timeline,
} from "../kit";
import type { HifiDef } from "./index";
import type { StateFacts } from "../types";

// ---------------------------------------------------------------------------
// W1 — Pool tab on the garden detail (uiux-spec §5.2)
// ---------------------------------------------------------------------------

const W1_STATES = [
  ["open", "Open"], ["create-open", "Create — doors open"], ["not-ready", "Not ready"], ["ready", "Ready"], ["seeded", "Seeded"],
  ["funded-offer", "Priced Offer"],
  ["request-open", "Open request"], ["request-queued", "Request queued"],
  ["request-work-queued", "Work request queued"],
  ["exchange-queued", "Exchange offer queued"],
  ["request-work-open", "Work request open for claim"],
  ["reviewing", "Reviewing"], ["paused", "Paused"], ["closed", "Closed"], ["composted", "Composted"],
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
//
// The card counts promises made and kept, the same pair W5, W12, W15 and W26
// print for this moment — not open offers, which are a subset of what the
// season has promised and so can never exceed `made` (PRD-760).
// Cycle cards follow layout option B (2026-08-14 third pass, Afo's pick):
// the [Season]/[Campaign] + stage chips LEAD the card, everything stacks on
// one left axis, and counts join the stack — nothing floats right.
const seasonCard = (opts: { made?: number; kept?: number; stage?: string } = {}) => {
  const made = opts.made ?? SEASON_LIVE.made;
  const kept = opts.kept ?? SEASON_LIVE.kept;
  const counts = made === 0 && kept === 0 ? "" : `<div class="t-meta num">${made} promises · ${kept} kept</div>`;
  return card(
    hot(
      "w1.season-card",
      `<div class="grow"><div class="cardrow">${chip("Season", "plain")}${chip(opts.stage ?? "Open", "plain")}</div><div class="t-title">${CYCLE}</div><div class="t-meta">runs through Aug 30</div>${counts}</div>`,
    ),
  );
};

// Season + campaigns share one snap rail (2026-08-14): the Season slide leads
// and stays wider — campaigns are peers you can reach in one swipe, not what a
// member came for. Presentation only: slides open their cycle, and the browse
// scope select keeps owning list scope, so swiping never silently refilters.
const seasonSlide = (opts: { made?: number; kept?: number; stage?: string } = {}) => `<div class="cslide lead">${seasonCard(opts)}</div>`;
const emptySeasonSlide = () =>
  `<div class="cslide lead">${card(
    `<div class="cardrow">${chip("Season", "plain")}</div><div class="t-title">No season right now</div><div class="t-meta">Stewards open the next one</div>`,
  )}</div>`;
const campaignSlide = (hotId: string, title: string, stage: string, counts: string) =>
  `<div class="cslide">${card(
    hot(hotId, `<div class="grow"><div class="cardrow">${chip("Campaign", "plain")}${chip(stage, "plain")}</div><div class="t-title">${title}</div><div class="t-meta">through Aug 18</div><div class="t-meta num">${counts}</div></div>`),
  )}</div>`;
const campaignSlides = () => [
  campaignSlide("w1.campaign-market", "Market rides", "Open", "6 of 16 kept"),
  campaignSlide("w1.campaign-tools", "Tool library", "Reviewing", "8 of 8 kept"),
];
const cycleCarousel = (opts: { season?: { made?: number; kept?: number; stage?: string }; emptySeason?: boolean } = {}) =>
  cycleRail([opts.emptySeason ? emptySeasonSlide() : seasonSlide(opts.season), ...campaignSlides()]);

// Browse filter row (2026-08-14): direction chips plus the personal Mine
// toggle — personal scope is orthogonal to direction, so it is not a fourth
// direction pill. The exchange-pair filter (formerly "Matched") returns with
// the exchange wave; paired cards keep their "In exchange" chip meanwhile.
const poolFilters = (activeIx: number, opts: { mine?: boolean } = {}) =>
  hot(
    "w1.filters",
    `<div class="filters">${seg(["All", "Offers", "Requests"], activeIx)}<span class="mine${opts.mine ? " on" : ""}" role="switch" aria-checked="${opts.mine ? "true" : "false"}">Mine</span></div>`,
  );

// Creator by-line — the D5 card contract (uiux Appendix B addendum 2026-08-11)
// puts a face on every browse card: avatar + name, "for {garden}" when a
// garden claims. Cards carry chips → title → by-line → quantity+due → real
// progress → ONE context action or one plain reason line; notes and declared
// value live in detail.
const byline = (name: string, opts: { forGarden?: string } = {}) =>
  `<div class="byline"><span class="avatar" aria-hidden="true">${esc(name[0] ?? "")}</span><span class="t-meta">by ${esc(name)}${opts.forGarden ? ` · for ${esc(opts.forGarden)}` : ""}</span></div>`;

// Domains get their own equal-weight row (2026-08-14 second pass, Afo): every
// involved domain listed, none privileged as "primary" — a promise pairing
// AGRO with EDU is both, not AGRO-with-a-footnote. No row = an evidence-only
// service promise, and the "Support / service" kind chip up top says so in
// words. The real build renders DomainBadge (icon + label) from DOMAIN_CONFIG.
const DOMAIN_CLS: Record<string, string> = { AGRO: "agro", EDU: "edu", SOLAR: "solar", WASTE: "waste" };
const domainRow = (domains: string[]) =>
  domains.length
    ? `<div class="dmrow">${domains.map((d) => `<span class="dm ${DOMAIN_CLS[d] ?? "agro"}">${esc(d)}</span>`).join("")}</div>`
    : "";

// Card grammar (2026-08-14 second pass, Afo — the shipping WorkCard grammar):
// the WHOLE card opens the promise detail; the footer button exists only when
// a claim act is available from browse. Navigation-only buttons are retired.
const offerCard = (opts: {
  queued?: boolean;
  waiting?: boolean;
  failed?: boolean;
  readOnly?: boolean;
  readOnlyNote?: string;
  detailHot?: string;
  team?: number;
} = {}) => {
  const chips = `${chip("Offer", "offer")}${opts.team ? chip(`Team of ${opts.team}`, "plain") : ""}${opts.queued ? chip("Queued", "queued") : ""}${opts.waiting ? chip("Waiting", "queued") : ""}${opts.failed ? chip("Couldn't send", "err") : ""}`;
  const cta = opts.queued || opts.waiting || opts.failed || opts.readOnly
    ? ""
    : `<div class="brow">${hot("w1.take-up", btn("Take this up", { kind: "sec" }))}</div>`;
  const note = opts.waiting
    ? `<div class="t-meta">Waiting for your garden membership — it will send once you're welcomed in.</div>`
    : opts.failed
      ? `<div class="t-meta">Five send attempts used. You can retry or discard.</div><div class="brow">${hot("w1.retry-send", btn("Retry", { kind: "sec", sm: true }))}${hot("w1.discard-send", btn("Discard", { kind: "ghost", sm: true }))}</div>`
      : opts.readOnly
        ? `<div class="t-meta">${opts.readOnlyNote ?? "This promise remains visible, but taking it up is not available right now."}</div>`
        : "";
  const title = opts.waiting ? "Compost workshop" : "Prune the north beds";
  const meta = opts.waiting ? "3 sessions · runs with the season" : "6 hours · due Aug 12";
  // Queued/waiting/failed casts are YOUR OWN sends — no by-line on yourself
  // (P1 row-subset rule: variants omit rows, never reorder them).
  const own = opts.queued || opts.waiting || opts.failed;
  const inner = `<div class="cardrow">${chips}</div><div class="t-title">${title}</div>${own ? "" : byline("Maria")}<div class="t-meta num">${meta}</div>${domainRow(["AGRO"])}${note}${cta}`;
  if (opts.queued || opts.waiting || opts.failed) return card(inner, { edge: "offer" });
  const openHot = opts.readOnly ? opts.detailHot : "w1.open-offer";
  const c = card(inner, { edge: "offer", cls: openHot ? "cardlink" : undefined });
  return openHot ? hot(openHot, c) : c;
};

const requestCard = (opts: { openClaim?: boolean; queued?: boolean; context?: string; claimHot?: string } = {}) => {
  // Mode-helper trim (2026-08-14 night): the act's own label carries the
  // claim mode — "I can help" is open, "Ask to take this up" is reviewed —
  // so the separate mode line is gone from browse cards (uiux §5.2 trim note).
  const inner = `<div class="cardrow">${chip("Request", "request")}${chip("Support / service", "plain")}${opts.queued ? chip("Queued", "queued") : ""}</div><div class="t-title">Ride to the market on Saturday</div>${byline("Ana")}<div class="t-meta num">1 ride · ${opts.context ?? "runs with the season"}</div>${
    opts.queued
      ? `<div class="t-meta">Saved on this device — it will send when connected.</div>`
      : opts.openClaim
        ? `<div class="brow">${hot(opts.claimHot ?? "w1.take-up-request", btn("I can help", { kind: "sec" }))}</div>`
        : `<div class="brow">${hot("w1.ask-take-up", btn("Ask to take this up", { kind: "sec" }))}</div>`
  }`;
  if (opts.queued) return card(inner, { edge: "request" });
  return hot("w1.open-request", card(inner, { edge: "request", cls: "cardlink" }));
};

// Ongoing-Offer place card — the public life of a CommitmentSeries on the pool
// tab (D8a): "Ongoing" chip + places-left is the card's real progress; the
// whole card opens the series detail where places are taken up (no nav button).
const ongoingOfferCard = () =>
  hot("w1.open-ongoing", card(
    `<div class="cardrow">${chip("Offer", "offer")}${chip("Ongoing", "plain")}${chip("Support / service", "plain")}</div><div class="t-title">Saturday veggie box</div>${byline("Maria")}<div class="t-meta num">1 box each week · runs with the season</div><div class="t-meta num">2 places open</div>`,
    { edge: "offer", cls: "cardlink" },
  ));

// Team-offer card — the D5 roster indicator: a forming team is visible right
// on the browse card; the whole card opens the promise (team view lives inside).
// Two-domain fixture: compost restoration pairs AGRO with WASTE, both equal.
const teamOfferCard = () =>
  hot("w1.open-team-offer", card(
    `<div class="cardrow">${chip("Offer", "offer")}${chip("Team of 3", "plain")}</div><div class="t-title">Restore the compost bays</div>${byline("Maria")}<div class="t-meta num">4 sessions · due Aug 24</div>${domainRow(["AGRO", "WASTE"])}`,
    { edge: "offer", cls: "cardlink" },
  ));

const fundedOfferCard = () =>
  card(
    `<div class="cardrow">${chip("Offer", "offer")}${chip("Support / service", "plain")}${chip("40 G$", "plain")}</div><div class="t-title">Design a market poster</div>${byline("Ben")}<div class="t-meta num">1 poster design · runs with the season</div><div class="t-meta">Your deposit instructions appear only after the funding record is ready.</div><div class="brow">${hot("w1.ask-funded", btn("Ask to fund this", { kind: "sec" }))}</div>`,
    { edge: "offer" },
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
        card(`<div class="t-title">What this pool grew</div><div class="t-meta num">${POOL_LIFETIME.made} promises made · ${POOL_LIFETIME.kept} kept</div>`),
      );
      break;
    case "composted":
      content = pagepad(
        banner("This pool is composted for now. Its history stays readable, and the garden's stewards may reopen it for another season.", "stone", "leaf-line"),
        card(`<div class="t-title">What this pool grew</div><div class="t-meta num">${POOL_LIFETIME.made} promises made · ${POOL_LIFETIME.kept} kept</div>`),
        card(`<div class="t-title">Participation is unavailable right now</div><div class="t-meta">Members cannot add or take up places while the pool is composted. Reopening is a steward action and preserves this history.</div>`),
      );
      break;
    case "no-season":
      content = pagepad(
        cycleCarousel({ emptySeason: true }),
        card(`<div class="t-title">New season offers are paused</div><div class="t-meta">Seasons and campaigns are opened by stewards. Open a campaign to see its promises, or wait for your steward to seed the next season.</div>`, { cls: "inset" }),
      );
      break;
    case "campaign-market":
      content = pagepad(
        banner("No Season is open. This campaign remains available on its own.", "stone"),
        card(`<div class="cardrow">${chip("Campaign", "plain")}${chip("Open", "plain")}</div><div class="t-title">Market rides</div><div class="t-meta">through Aug 18</div><div class="t-meta num">6 of 16 kept</div>`),
        sectionTitle("Campaign promises"),
        requestCard({ openClaim: true, context: "Market rides campaign", claimHot: "w1.take-up-campaign-request" }),
        hot("w1.campaigns-back", btn("Back to campaigns", { kind: "ghost", full: true })),
      );
      break;
    case "campaign-tools":
      content = pagepad(
        banner("Tool library is under review. Evidence and confirmations stay available.", "stone", "eye-line"),
        card(`<div class="cardrow">${chip("Campaign", "plain")}${chip("Reviewing", "plain")}</div><div class="t-title">Tool library</div><div class="t-meta">through Aug 18</div><div class="t-meta num">8 of 8 kept</div>`),
        hot("w1.open-tools-promise", card(`<div class="cardrow">${chip("Offer", "offer")}${chip("Support / service", "plain")}</div><div class="t-title">Repair tool handles</div>${byline("Maria")}<div class="t-meta">1 repair session · Tool library campaign</div><div class="t-meta">This promise is ready for confirmation.</div>`, { edge: "offer", cls: "cardlink" })),
        hot("w1.campaigns-back", btn("Back to campaigns", { kind: "ghost", full: true })),
      );
      break;
    case "empty-open":
      content = pagepad(
        seasonCard({ made: 0, kept: 0 }),
        card(`<div class="t-title">No promises yet</div><div class="t-meta">Start the first one — offer something you can give, or ask for help you need.</div>`),
        `<div class="brow">${hot("w1.offer", btn("Offer", { kind: "pri" }))}${hot("w1.request", btn("Request", { kind: "sec" }))}</div>`,
      );
      break;
    case "funded-offer":
      content = pagepad(
        cycleCarousel(),
        sectionTitle("Priced Offer"),
        fundedOfferCard(),
        banner("Claiming sends a request first. Nothing moves until you choose to deposit to the garden's recoverable Safe.", "stone"),
      );
      break;
    case "cycle-summary":
      content = pagepad(
        card(
          `${hero(`${CYCLE} — closed`, `${SEASON_CLOSED.kept} of ${SEASON_CLOSED.made} promises kept`, "seedling-line")}${kv("Promises kept", `${SEASON_CLOSED.kept} of ${SEASON_CLOSED.made}`)}${kv("Hours", `${SEASON_CLOSED.hours.done} of ${SEASON_CLOSED.hours.of}`)}${kv("Rides", `${SEASON_CLOSED.rides.done} of ${SEASON_CLOSED.rides.of}`)}<div class="t-meta" style="text-align:center">Ready for the next season.</div>`,
        ),
        cycleRail(campaignSlides()),
      );
      break;
    case "request-open":
      content = pagepad(
        cycleCarousel(),
        poolFilters(2),
        requestCard({ openClaim: true }),
      );
      break;
    case "request-queued":
      content = pagepad(
        cycleCarousel(),
        banner("Your request is saved on this device and will send when connected.", "stone", "wifi-off-line"),
        hot("w1.queued-card", requestCard({ queued: true })),
      );
      break;
    case "request-work-open":
      content = pagepad(
        cycleCarousel(),
        hot("w1.open-work-request", card(
          `<div class="cardrow">${chip("Request", "request")}</div><div class="t-title">Clear the drainage channel</div>${byline("Ana")}<div class="t-meta num">8 hours · due Aug 30</div>${domainRow(["AGRO"])}<div class="t-meta num">Needs approved work: Weed × 2 · Mulch × 4</div><div class="brow">${hot("w1.take-up-work-request", btn("I can help", { kind: "sec" }))}</div>`,
          { edge: "request", cls: "cardlink" },
        )),
      );
      break;
    case "exchange-queued":
      content = pagepad(
        cycleCarousel(),
        banner("Your offer in exchange is saved on this device and will send when connected.", "stone", "wifi-off-line"),
        hot("w1.queued-card", card(
          `<div class="cardrow">${chip("Offer", "offer")}${chip("In exchange", "plain")}${chip("Queued", "queued")}</div><div class="t-title">Repair the shared water pump</div><div class="t-meta num">1 repair · runs with the season</div><div class="t-meta">Paired with Ana's childcare offer. Nothing starts for either of you until she chooses to start both.</div>`,
          { edge: "offer" },
        )),
      );
      break;
    case "request-work-queued":
      content = pagepad(
        cycleCarousel(),
        banner("Your ask is saved on this device and will send when connected.", "stone", "wifi-off-line"),
        hot("w1.queued-card", card(
          `<div class="cardrow">${chip("Request", "request")}${chip("Queued", "queued")}</div><div class="t-title">Clear the drainage channel</div><div class="t-meta num">8 hours · runs with the season</div>${domainRow(["AGRO"])}<div class="t-meta">Saved on this device — it will send when connected.</div>`,
          { edge: "request" },
        )),
      );
      break;
    case "queued":
      content = pagepad(
        cycleCarousel(),
        poolFilters(0, { mine: true }),
        hot("w1.queued-card", offerCard({ queued: true })),
        disclosure("Browse other promises", "pool stays open", requestCard()),
      );
      break;
    case "waiting-membership":
      content = pagepad(
        cycleCarousel(),
        poolFilters(0),
        hot("w1.queued-card", offerCard({ waiting: true })),
        offerCard(),
      );
      break;
    case "sync-failed":
      content = pagepad(
        cycleCarousel(),
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
        seasonCard({ made: 0, kept: 0, stage: "Opens soon" }),
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
        }),
      );
      break;
    case "cancelled-cycle":
      content = pagepad(
        banner("This season was cancelled — “funding fell through for the rains”. Its history stays with the garden.", "stone", "information-line"),
        card(`<div class="cardrow">${chip("Season", "plain")}${chip("Cancelled", "plain", { dot: true })}</div><div class="t-title">${CYCLE}</div><div class="t-meta num">${SEASON_LIVE.made} promises made · ${SEASON_LIVE.kept} kept</div>`),
      );
      break;
    case "paused-cancelled-cycle":
      content = pagepad(
        banner("The pool remains paused — “seasonal flooding, back after the rains”. This season was cancelled, and its history stays with the garden.", "amber", "error-warning-line"),
        card(`<div class="cardrow">${chip("Season", "plain")}${chip("Cancelled", "plain", { dot: true })}</div><div class="t-title">${CYCLE}</div><div class="t-meta num">${SEASON_LIVE.made} promises made · ${SEASON_LIVE.kept} kept</div>`),
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
    default: // open — create-open shares this cast behind the doors overlay
      content = pagepad(
        cycleCarousel(),
        // The browse section owns its own header, and the scope control rides
        // in it as a labelled select. Creation left this header for the
        // floating entry (2026-08-14), so one chip row sits before the cards.
        sectionTitle("Open promises", hot("w1.scope", input("All current", { select: true, ariaLabel: "Scope" }))),
        poolFilters(0),
        offerCard(),
        ongoingOfferCard(),
        teamOfferCard(),
        requestCard(),
      );
  }

  // Every queued cast carries the same offline chrome — a new queued state that
  // forgets to join these two predicates draws a queued card with no sync bar.
  const queuedState =
    state === "queued" || state === "support-queued" || state === "request-queued" ||
    state === "request-work-queued" || state === "exchange-queued";
  const sync = queuedState
    ? syncBar("1 promise waiting to send")
    : state === "sync-failed"
      ? syncBar("1 item needs attention")
      : "";
  const offline = queuedState || state === "sync-failed";

  // Floating creation entry (2026-08-14): every live browse cast carries the
  // closed FAB; create-open swaps it for the scrim + the two one-word doors
  // (D3). An empty pool keeps its big inline CTAs instead, and lifecycle /
  // read-recovery casts draw no creation entry at all.
  const fabStates = new Set<W1State>([
    "open", "queued", "support-queued", "request-queued", "request-work-queued", "exchange-queued",
    "sync-failed", "waiting-membership", "request-open", "request-work-open", "funded-offer",
  ]);
  const doors = `${hot("w1.offer", `<button type="button" class="fabdoor">Offer</button>`)}${hot("w1.request", `<button type="button" class="fabdoor">Request</button>`)}`;
  const overlay =
    state === "create-open"
      ? `<div class="fabscrim"></div><div class="fabwrap open">${doors}${hot("w1.create-cancel", fabButton(true))}</div>`
      : fabStates.has(state)
        ? `<div class="fabwrap">${hot("w1.create", fabButton(false))}</div>`
        : "";
  return phoneFrame(`${head}${tabs}${content}<div style="flex:1"></div>${sync}`, { offline, overlay });
}

const W1_HOTS: HifiDef["hots"] = {
  "w1.ask-funded": {
    l: "Ask to fund this Offer",
    to: "screen:W36@waiting-pledge",
    info: "A member may file an ApprovalGated request on the priced Offer. Steward-only acceptance remains later; this act moves no G$.",
    calls: ["claimCommitment"],
    facts: { pool: "Open", commitment: "Offered", kind: "SupportService", funding: "None" },
  },
  "w1.create": { l: "Offer or request", to: "screen:W1@create-open", info: "The floating creation entry (2026-08-14, mirroring the shared FabButton admin mobile already uses) — reachable however far the list scrolls. It only opens the two one-word doors (D3); it is not a form, and an empty pool keeps its big inline CTAs instead." },
  "w1.create-cancel": { l: "Close the doors", to: "screen:W1", info: "Closes the creation doors without starting anything." },
  "w1.offer": { l: "Offer", to: "screen:W3@step-what", info: "Enters the composer with direction fixed = offer (2026-08-11 Appendix B addendum: no in-form Direction control). The door is one word (Afo, D3): the wizard it opens is titled Make an offer, so the button need not repeat the verb. Since 2026-08-14 the door stacks above the floating create entry (inline only on an empty pool). Templates are a prefill layer reached from step 1, no longer a gate before the form." },
  "w1.request": { l: "Request", to: "screen:W3@request-what", info: "Enters the composer with direction fixed = request; the paired one-word door (Afo, D3), opening the Make a request wizard. Since 2026-08-14 it stacks above the floating create entry (inline only on an empty pool). Step 1 chooses the kind (help or a service vs garden work) as plain words (2026-08-11 Appendix B addendum)." },
  "w1.open-offer": { l: "Open the offer", to: "screen:W2@browse-offered", info: "Whole-card tap opens the pre-claim browse detail (2026-08-14 workflows round — the shipping WorkCard grammar): only the creator is on the promise, and the one act in the fixed bar is the same open-mode claim as the card button." },
  "w1.open-request": { l: "Open the request", to: "screen:W2@browse-requested", info: "Whole-card tap opens the pre-claim request detail; I-can-help is the one act, in the card footer and the detail's fixed bar alike." },
  "w1.open-work-request": { l: "Open the work request", to: "screen:W2@request-work-active", info: "Whole-card tap opens the garden-work request detail; taking it up stays on the button. A dedicated work-request browse cast can follow the two drawn ones (browse-offered / browse-requested)." },
  "w1.open-ongoing": { l: "Open the ongoing Offer", to: "screen:W34@claimant-view", info: "The whole card opens the series detail (2026-08-14 second pass — the See-open-places nav button retired), where each open place is an ordinary Offered commitment that can be taken up (Appendix F.2). Places-left stays on the card as its real progress." },
  "w1.open-team-offer": { l: "Open the team promise", to: "screen:W2", info: "The whole card opens the promise DETAIL first (iteration 2 — jumping straight into the team view skipped the promise itself): the team strip sits above the fold and opens the team view from there. Nav button retired 2026-08-14; the card is the tap target." },
  "w1.take-up": { l: "Take this up (open claim)", to: "screen:W2", info: "Open mode: claim job → optimistic Accepted (UX:129).", calls: ["claimCommitment"], facts: { commitment: "Offered", kind: "DomainImpact" } },
  "w1.take-up-work-request": { l: "I can help", to: "screen:W2@request-work-active", info: "Open-claim on a DomainImpact Request: claimCommitment → CommitmentAccepted with provider = claimant and confirmer = Ana, the asker. The ask then rides the ordinary Work-approval rails (CS:133 · register #97a).", calls: ["claimCommitment"], facts: { commitment: "Requested", kind: "DomainImpact" } },
  "w1.take-up-request": { l: "I can help (open request)", to: "screen:W2@request-active", info: "Open mode: the claimant becomes the provider and the request creator remains the confirmer.", calls: ["claimCommitment"], facts: { commitment: "Requested", kind: "SupportService" } },
  "w1.take-up-campaign-request": { l: "I can help (campaign request)", to: "screen:W2@campaign-request-active", info: "Open mode preserves the Market rides Campaign binding while the claimant becomes provider.", calls: ["claimCommitment"], facts: { commitment: "Requested", kind: "SupportService" } },
  "w1.open-paused-promise": { l: "Open promise while paused", to: "screen:W2@active", info: "Whole-card tap. Pause blocks new participation and confirmation, not browsing, evidence, linkage, cancellation, expiry, or dispute recovery (UX:60)." },
  "w1.open-reviewing-promise": { l: "Open the ready promise", to: "screen:W2@ready-confirmer", info: "Whole-card tap; the confirm act lives in the detail. Reviewing keeps evidence and confirmation available; this selected promise is already ReadyForConfirmation (UX:74)." },
  "w1.campaign-market": { l: "Open Market rides campaign", to: "screen:W1@campaign-market", info: "Campaigns remain independently usable when no Season is open (UX:127)." },
  "w1.campaign-tools": { l: "Open Tool library campaign", to: "screen:W1@campaign-tools", info: "A Reviewing campaign stays independently browseable and keeps evidence and confirmation available (UX:74,127)." },
  "w1.campaigns-back": { l: "Back to campaigns", to: "screen:W1@no-season", info: "Returns to the no-Season pool home with both Campaigns available." },
  "w1.open-tools-promise": { l: "Open the Tool library promise", to: "screen:W4@confirm-support", info: "Whole-card tap (nav button retired 2026-08-14). Opens a SupportService promise that remains confirmable while its Campaign is Reviewing — this cast shortcuts straight to the confirmation sheet." },
  "w1.ask-take-up": { l: "Ask to take this up (steward-reviewed)", to: "screen:W1@claim-pending", info: "Approval-gated: creates a claim request with stored terms; the commitment stays available to others (UX:99).", calls: ["claimCommitment"], facts: { commitment: "Requested", kind: "SupportService" } },
  "w1.ask-again": { l: "Ask again", to: "screen:W1@claim-pending", info: "Creates a FRESH request while the commitment is claimable — never retries the declined row (UX:105).", calls: ["claimCommitment"], facts: { commitment: "Requested", kind: "SupportService" } },
  "w1.back-browse": { l: "Back to browsing", to: "screen:W1", info: "Declined/superseded exits return to browse." },
  "w1.open-commitment": { l: "Open the promise", to: "screen:W2@request-active", info: "Acceptance opens the same request record with the accepted claimant as provider (UX:104)." },
  "w1.scope": { l: "Scope control", info: "Filters the list; every aggregate names its scope — Season and Campaigns never blur (UX:127)." },
  "w1.filters": { l: "Filter row", info: "Direction chips All · Offers · Requests plus the personal Mine toggle (2026-08-14) — personal scope is orthogonal to direction, so it is a toggle, not a fourth pill. Client-local (admin AdminFilterChip is admin-only). The exchange-pair filter (formerly “Matched”) returns with the exchange wave; paired cards keep their In-exchange chip meanwhile." },
  "w1.season-card": { l: "Cycle card", info: "Season vs Campaign is always named; derived InProgress/Reviewing overlays follow activity (CS:115-117). Calm dates, never timers. Leads the season+campaigns rail (2026-08-14) — swiping the rail never changes list scope; the browse select owns that." },
  "w1.queued-card": { l: "Queued promise card", info: "Offline-queued job chrome; syncs when connected (UX:237). waiting_for_hat variant consumes no send attempts (register #34c)." },
  "w1.retry-send": { l: "Retry queued send", to: "screen:W1@queued", info: "Resets the failed job to pending and retries without dropping the local promise (UX:218)." },
  "w1.discard-send": { l: "Discard failed send", to: "screen:W1", info: "Removes only the exhausted local job after an explicit member choice; no remote promise exists yet (UX:218)." },
  "w1.retry": { l: "Try again", info: "Read-surface recovery — retries the read. None/UNKNOWN sentinels render loading / not-found / recovery chrome, never a “None” state chip (UX:51-52 · AM:12)." },
  "w1.tab-work": { l: "Work tab", info: "The existing garden Work tab — submissions, approvals, assessments (UX:116). Pool leads the row since 2026-08-14; Work is the landing only while a garden has no pool." },
  "w1.tab-insights": { l: "Insights tab", info: "The existing garden Insights tab — unchanged by pooling." },
  "w1.tab-gardeners": { l: "Gardeners tab", info: "The existing garden Gardeners/membership tab — unchanged by pooling." },
  "w1.tab-pool": { l: "Pool tab", info: "The active Garden detail section for offers, requests, cycles, and pool-scoped history. First tab and the default landing since 2026-08-14; absent until the garden's pool exists." },
};

// ---------------------------------------------------------------------------
// W2 — Commitment detail (uiux-spec §5.3; hi-fi guidance wireframes.md:166)
// ---------------------------------------------------------------------------

const W2_STATES = [
  ["accepted", "Accepted"], ["offered", "Offered (yours)"], ["requested", "Requested (yours)"],
  ["browse-offered", "Offered — browse view"], ["browse-requested", "Requested — browse view"],
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
  ["request-work-active", "Work request — helper working"], ["request-work-partially-approved", "Work request — partly approved"],
  ["request-work-ready-confirmer", "Work request — ready to confirm"],
  ["request-work-confirmation-pending", "Work request — confirmation queued"],
  ["request-work-fulfilled", "Work request — done"],
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
  ["support-offered", "Service offer — open"], ["support-accepted", "Service offer — accepted"],
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
  "browse-offered": "Offered", "browse-requested": "Requested",
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
  "request-work-active": "Active", "request-work-partially-approved": "Partly approved",
  "request-work-ready-confirmer": "Ready to confirm",
  "request-work-confirmation-pending": "Ready to confirm",
  "request-work-fulfilled": "Fulfilled",
  "campaign-request-evidence-queued": "Active", "campaign-request-evidence-submitted": "Evidence in",
  "campaign-request-ready-pending": "Evidence in", "campaign-request-ready-confirmer": "Ready to confirm",
  "campaign-request-confirmation-pending": "Ready to confirm",
  "campaign-request-fulfilled": "Fulfilled", "campaign-request-disputed": "Under review",
  "request-evidence-queued": "Active",
  "request-evidence-submitted": "Evidence in", "request-ready-pending": "Evidence in",
  "request-ready-confirmer": "Ready to confirm", "request-confirmation-pending": "Ready to confirm",
  "request-fulfilled": "Fulfilled", "request-disputed": "Under review",
  "support-offered": "Offered", "support-accepted": "Accepted", "support-evidence-queued": "Accepted",
  "support-evidence-submitted": "Evidence in", "support-ready-pending": "Evidence in",
  "support-ready-confirmer": "Ready to confirm", "support-confirmation-pending": "Ready to confirm",
  "support-fulfilled": "Fulfilled", "support-cancelled": "Cancelled",
  "support-disputed": "Under review",
};

const W2_REQUEST = new Set<string>([
  "browse-requested",
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
  "support-offered", "support-accepted", "support-evidence-queued",
  "support-evidence-submitted", "support-ready-pending", "support-ready-confirmer", "support-fulfilled",
  "support-confirmation-pending",
  "support-cancelled", "support-disputed",
]);
const W2_CAPTURED = new Set<string>([
  "captured", "captured-evidence-queued", "captured-evidence-submitted",
  "captured-ready-pending", "captured-ready-confirmer", "captured-confirmation-pending",
  "captured-fulfilled", "captured-disputed",
]);
const W2_WORK = new Set<W2State>([
  "accepted", "active", "evidence-queued", "evidence-submitted", "partially-approved",
  // The garden-work ask counts approvals, so its work list renders too (its
  // rows carry no submit controls — the asker watches, the helper submits).
  "request-work-active", "request-work-partially-approved",
]);
// DomainImpact Requests (2026-08-10, register #97): the ask is for garden work,
// so proof travels through Work approvals — the asker still confirms.
const W2_REQUEST_WORK = new Set<string>([
  "request-work-active", "request-work-partially-approved", "request-work-ready-confirmer",
  "request-work-confirmation-pending", "request-work-fulfilled",
]);
const W2_GARDEN = new Set<string>(["garden-provider", "garden-support-arrived"]);
type PromiseCast = "offer" | "request" | "request-work" | "campaign-request" | "support" | "captured" | "garden";
const w2Cast = (state: W2State): PromiseCast =>
  W2_GARDEN.has(state) ? "garden"
  : W2_REQUEST_WORK.has(state) ? "request-work"
  : W2_CAMPAIGN_REQUEST.has(state) ? "campaign-request"
  : W2_REQUEST.has(state) ? "request"
  : W2_SUPPORT.has(state) ? "support"
  : W2_CAPTURED.has(state) ? "captured"
  : "offer";
// Domain propagation (2026-08-14 workflows round): domains left the chip row
// for the equal-weight domain row on cards — the detail header follows, so
// the amber .ch.domain chip retires from W2 and `domains` renders as a dmrow.
const W2_IDENTITY: Record<PromiseCast, { title: string; meta: string; chips: string; domains?: string[] }> = {
  offer: {
    title: "Prune the north beds",
    meta: "6 hours · due Aug 12 · Season of First Rains",
    chips: chip("Offer", "offer"),
    domains: ["AGRO"],
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
  "request-work": {
    title: "Clear the drainage channel",
    meta: "8 hours · due Aug 20 · Season of First Rains",
    chips: chip("Request", "request"),
    domains: ["AGRO"],
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
  if (W2_REQUEST_WORK.has(state)) {
    const askedWork: Moment[] = [
      { label: "Requested", meta: "Ana · Jul 8 — garden work: Weed × 2 · Mulch × 4" },
      { label: "João can help", meta: "took this up · Jul 9" },
    ];
    if (state === "request-work-active")
      return [...askedWork, { label: "Working", meta: "submitted work counts toward the ask's actions", open: true }];
    if (state === "request-work-partially-approved")
      return [...askedWork, { label: "Work approved", meta: "1 of 2 required approvals counted", open: true }];
    if (state === "request-work-fulfilled")
      return [...askedWork, { label: "Work approved", meta: "2 of 2 · Jul 14" }, { label: "Done", meta: "confirmed by Ana · Jul 15" }];
    return [...askedWork, { label: "Work approved", meta: "2 of 2 · Jul 14" }, { label: "Ready to confirm", meta: "waiting on Ana — she asked for this", open: true }];
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
    if (state === "support-accepted") return offered;
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
      : cast === "request-work"
        ? listRow({
            icon: "image-line",
            primary: "The channel after clearing",
            meta: "Photo · Jul 12 · attached with the work",
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
      cast === "garden" ? "garden team · 3 credited" : cast === "request-work" ? "1 provider · requester confirms" : "1 lead · 2 contributors",
      cast === "garden"
        ? `${listRow({ icon: "group-line", primary: "Awka Hub", meta: "Accountable provider garden" })}${listRow({ icon: "user-line", primary: "Leila", meta: "Lead · credited contributor" })}${listRow({ icon: "group-line", primary: "Amara · Chidi", meta: "Contributors · credited from approved work" })}${hot(teamHot, btn("See team and contributions", { kind: "ghost", sm: true }))}`
        : cast === "request-work"
          ? `${listRow({ icon: "user-line", primary: "João", meta: "Provider — took up the ask" })}${listRow({ icon: "user-line", primary: "Ana", meta: "Asked for this · confirms when it's ready" })}${hot(teamHot, btn("See team and contributions", { kind: "ghost", sm: true }))}`
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
          cast === "request-work" ? "counting toward the ask" : state === "accepted" ? "1 approved · not linked" : "1 approved",
          cast === "request-work"
            ? listRow({ icon: "check-line", primary: "Channel weeding · João", meta: "Approved · Jul 12", chipHtml: chip("Approved", "ok") }) +
              listRow({ icon: "leaf-line", primary: "Mulching the banks · João", meta: "Submitted · with the stewards" }) +
              `<div class="t-meta">João submits on the ordinary Work rails and the stewards approve — each approval counts toward Weed × 2 · Mulch × 4.</div>`
            : state === "accepted"
              // Recovery layer (2026-08-14 standing-attribution round): approved
              // work that matches a requirement but is not yet linked surfaces
              // as a standing row — missed attribution is recoverable, not lost.
              ? listRow({ icon: "check-line", primary: "Pruning session", meta: "Approved · Jul 8 — not yet linked", chipHtml: chip("Not linked", "warn") }) +
                `<div class="t-meta">You already have approved Prune work that could count toward this promise.</div>` +
                `<div class="brow">${hot("w2.unlinked-work", btn("Link it", { kind: "sec", sm: true }))}${hot("w2.link-work", btn("Link other work", { kind: "ghost", sm: true }))}</div>`
              : listRow({ icon: "check-line", primary: "Pruning session", meta: "Approved · Jul 8", chipHtml: chip("Approved", "ok") }) +
                `<div class="brow">${hot("w2.link-work", btn("Link existing work", { kind: "ghost" }))}</div>`,
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
  // appBar:false matches the loaded return below (and withdraw-confirm): promise
  // detail is a pushed read surface, so loading/not-found/read-error must not
  // grow a bottom nav the loaded screen doesn't have (PRD-760).
  const readWrap = (inner: string) =>
    phoneFrame(`${head}${inner}<div style="flex:1"></div>`, { appBar: false });
  if (state === "loading")
    return readWrap(pagepad(skeleton({ title: true, lines: 1 }), skeleton({ avatar: true, lines: 3 }), skeleton({ lines: 2 })));
  if (state === "not-found")
    return readWrap(pagepad(emptyState("search-line", "Promise not found", "We couldn't find this promise. It may have been withdrawn, or it hasn't synced to this device yet.", hot("w2.retry", btn("Try again", { kind: "sec", icon: "refresh-line" })))));
  if (state === "read-error")
    return readWrap(pagepad(emptyState("wifi-off-line", "Couldn't load this promise", "Something went wrong reaching the network. Check your connection and try again.", hot("w2.retry", btn("Try again", { kind: "pri", icon: "refresh-line" })))));
  const chips = `<div class="cardrow">${ident.chips}${stateChip(w2StateChip[state])}</div>${ident.domains ? `<div style="padding:0 0 2px">${domainRow(ident.domains)}</div>` : ""}`;
  // E5 anatomy (iteration 2): the people are above the fold — avatars for
  // creator → counterparty, plus the team strip when a roster exists.
  const cast = w2Cast(state);
  const W2_PEOPLE: Record<PromiseCast, { initials: string[]; line: string; team?: boolean }> = {
    offer: { initials: ["M", "J"], line: "Maria offers · João takes it up", team: true },
    request: { initials: ["A", "J"], line: "Ana requested · João provides" },
    "request-work": { initials: ["A", "J"], line: "Ana requested · João provides · Ana confirms" },
    "campaign-request": { initials: ["A", "J"], line: "Ana requested · Market rides campaign" },
    support: { initials: ["M", "J"], line: "Maria provides · João confirms" },
    captured: { initials: ["K", "D"], line: "Kwame's promise · recorded by David" },
    garden: { initials: ["A", "S"], line: "Awka Hub provides · protocol stewards confirm" },
  };
  // Browse casts are pre-claim: only the creator is on the promise yet.
  const pp =
    state === "browse-offered"
      ? { initials: ["M"], line: "Maria offers — no one has taken it up yet" }
      : state === "browse-requested"
        ? { initials: ["A"], line: "Ana asked — no one has taken it up yet" }
        : W2_PEOPLE[cast];
  const people = `<div class="cardrow" style="padding:2px 16px 0"><span class="teamstrip">${pp.initials.map((n) => `<span class="avatar" aria-hidden="true">${n}</span>`).join("")}</span><span class="t-meta">${pp.line}</span>${"team" in pp && pp.team ? hot("w2.team-strip", chip("Open team — join in", "ok")) : ""}</div>`;
  const meta = `${people}<div class="hsub num">${ident.meta}</div>`;
  // E5: the walked states put their ONE contextual primary in a fixed bottom
  // bar — the same rule the wizards follow. Content keeps the story; the bar
  // owns the act. Unlisted states stay bar-less read surfaces.
  const W2_BARS: Partial<Record<W2State, string>> = {
    accepted: hot("w2.submit-work", btn("Submit work", { kind: "pri", full: true })),
    active: hot("w2.submit-work", btn("Submit work", { kind: "pri", full: true })),
    "request-active": hot("w2.add-evidence-request", btn("Add evidence", { kind: "pri", full: true, icon: "camera-line" })),
    "request-evidence-submitted": hot("w2.send-confirmation-request", btn("Send for confirmation", { kind: "pri", full: true })),
    "request-ready-confirmer": hot("w2.confirm-request-detail", btn("Review confirmation", { kind: "pri", full: true })),
    "request-work-ready-confirmer": hot("w2.confirm-request-work-detail", btn("Review confirmation", { kind: "pri", full: true })),
    "campaign-request-active": hot("w2.add-evidence-campaign-request", btn("Add evidence", { kind: "pri", full: true, icon: "camera-line" })),
    "campaign-request-evidence-submitted": hot("w2.send-confirmation-campaign-request", btn("Send for confirmation", { kind: "pri", full: true })),
    "campaign-request-ready-confirmer": hot("w2.confirm-campaign-request-detail", btn("Review confirmation", { kind: "pri", full: true })),
    "support-accepted": hot("w2.add-evidence-support", btn("Add evidence", { kind: "pri", full: true, icon: "camera-line" })),
    "support-evidence-submitted": hot("w2.send-confirmation", btn("Send for confirmation", { kind: "pri", full: true })),
    "support-ready-confirmer": hot("w2.confirm-support-detail", btn("Review confirmation", { kind: "pri", full: true })),
    captured: hot("w2.add-evidence-captured", btn("Add evidence", { kind: "pri", full: true, icon: "camera-line" })),
    "captured-evidence-submitted": hot("w2.send-confirmation-captured", btn("Send for confirmation", { kind: "pri", full: true })),
    "captured-ready-confirmer": hot("w2.confirm-captured-detail", btn("Review confirmation", { kind: "pri", full: true })),
    "garden-provider": hot("w2.add-evidence", btn("Add evidence", { kind: "pri", full: true, icon: "camera-line" })),
    offered: hot("w2.withdraw", btn("Withdraw this offer…", { kind: "danger", full: true })),
    requested: hot("w2.withdraw", btn("Withdraw this request…", { kind: "danger", full: true })),
    "browse-offered": hot("w2.take-up-browse", btn("Take this up", { kind: "pri", full: true })),
    "browse-requested": hot("w2.help-browse", btn("I can help", { kind: "pri", full: true })),
    "ready-confirmer": hot("w2.confirm", btn("Confirm: promise kept", { kind: "pri", full: true })),
    expired: hot("w2.offer-again", btn("Offer it again", { kind: "pri", full: true })),
  };

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
        `<div class="t-title">João is helping</div><div class="t-meta">Add evidence as it happens — Ana asked for this, so Ana confirms it was done.</div>`,
      );
      break;
    case "request-work-active":
      band = card(
        `<div class="t-title">João is on the garden work</div><div class="t-meta">This ask needs approved work — Weed × 2 · Mulch × 4 — so submitted work travels the ordinary approval rails before Ana confirms.</div><div class="brow">${hot("w2.submit-work-request-detail", btn("Submit work", { kind: "pri", icon: "camera-line" }))}</div>`,
      );
      break;
    case "request-work-partially-approved":
      band = card(`<div class="t-title">Work approvals</div>${meter(50, { left: "approved works", right: "1 of 2" })}<div class="t-meta">One more approval and Ana can confirm the ask was met.</div>`);
      break;
    case "request-work-ready-confirmer":
      band = card(
        `<div class="t-title">Ready to confirm</div><div class="t-meta">Ana asked for this work, so Ana confirms it — every contributor stays excluded.</div>`,
      );
      break;
    case "request-work-confirmation-pending":
      band = card(
        `<div class="t-title">Confirmation waiting to send</div><div class="t-meta">Ana's saved confirmation is queued. The ask stays ready and cannot be confirmed twice while it syncs.</div>`,
      );
      break;
    case "request-work-fulfilled":
      band = card(
        `<div class="t-title">The work was done</div><div class="t-meta">Ana confirmed on Jul 15 — the ask was met by approved work. The season's count just grew.</div>`,
      );
      break;
    case "campaign-request-active":
      band = card(
        `<div class="t-title">João is helping with this Campaign request</div><div class="t-meta">The Market rides Campaign remains the scope. Add evidence as the ride happens.</div>`,
      );
      break;
    case "campaign-request-evidence-queued":
      band = card(
        `<div class="t-title">Campaign evidence saved on this device</div><div class="t-meta">It will send when connected. The Market rides Campaign remains the scope.</div>`,
      );
      break;
    case "campaign-request-evidence-submitted":
      band = card(
        `<div class="t-title">Evidence attached: 1 · no work required</div><div class="t-meta">Ana confirms this Market rides Campaign request.</div>`,
      );
      break;
    case "campaign-request-ready-pending":
      band = card(
        `<div class="t-title">Campaign readiness saved on this device</div><div class="t-meta">The promise stays Evidence in until this sends. Its Campaign binding does not change.</div>`,
      );
      break;
    case "campaign-request-ready-confirmer":
      band = card(
        `<div class="t-title">Ready to confirm</div><div class="t-meta">Ana confirms the Market rides Campaign request. João, who provided it, cannot.</div>`,
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
        `<div class="t-title">Evidence attached: 1 · no work required</div><div class="t-meta">Ana asked for this help, so Ana confirms it arrived.</div>`,
      );
      break;
    case "request-ready-pending":
      band = card(
        `<div class="t-title">Readiness saved on this device</div><div class="t-meta">The request remains Evidence in until this sends. Ana cannot confirm it twice or before the readiness transition lands.</div>`,
      );
      break;
    case "request-ready-confirmer":
      band = card(
        `<div class="t-title">Ready to confirm</div><div class="t-meta">Ana asked for this help and is the named confirmer. João, who provided it, cannot.</div>`,
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
    case "support-accepted":
      band = card(
        `<div class="t-title">Repair accepted</div><div class="t-meta">João took up this place. It remains Accepted until Maria links Work or evidence reaches the promise.</div>`,
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
        `<div class="t-title">Evidence attached: 1 · no work required</div><div class="t-meta">João is named to confirm the repair.</div>`,
      );
      break;
    case "support-ready-pending":
      band = card(
        `<div class="t-title">Readiness saved on this device</div><div class="t-meta">The service remains Evidence in until this sends. João's confirmation opens after the readiness transition lands.</div>`,
      );
      break;
    case "support-ready-confirmer":
      band = card(
        `<div class="t-title">Ready to confirm</div><div class="t-meta">João was named to confirm this service. Maria, who offered it, cannot.</div>`,
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
        `<div class="t-title">Workshop underway</div><div class="t-meta">This recorded-for-Kwame promise is evidence-only. Add evidence without introducing a garden-work approval requirement.</div>`,
      );
      break;
    case "captured-evidence-queued":
      band = card(
        `<div class="t-title">Evidence saved on this device</div><div class="t-meta">It will send when connected. The recorded promise keeps its StewardCaptured path.</div>`,
      );
      break;
    case "captured-evidence-submitted":
      band = card(
        `<div class="t-title">Evidence attached: 1 · no work required</div><div class="t-meta">The named counterparty confirms this recorded promise.</div>`,
      );
      break;
    case "captured-ready-pending":
      band = card(
        `<div class="t-title">Readiness saved on this device</div><div class="t-meta">The record remains Evidence in until this sends; confirmation stays unavailable meanwhile.</div>`,
      );
      break;
    case "captured-ready-confirmer":
      band = card(
        `<div class="t-title">Ready to confirm</div><div class="t-meta">The lead provider remains excluded. The named counterparty reviews the captured promise.</div>`,
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
        `<div class="t-title">Your garden is providing this</div><div class="t-meta">Add evidence as Awka gardeners run the survey. The named confirmer, Sofia, confirms it when it is done.</div>`,
      );
      break;
    case "garden-support-arrived":
      band = card(
        `<div class="t-title">Promise kept — your garden provided it</div><div class="t-meta">Confirmed by Sofia through ordinary named confirmation on Jul 12. The support went to the garden's own account.</div>`,
      );
      break;
    case "withdrawn":
      band = card(
        `<div class="t-title">You withdrew this offer</div><div class="t-meta">It has left the pool. The record and the reason you gave stay in the timeline below.</div>`,
      );
      break;
    case "offered":
      band =
        card(`<div class="t-title">Your offer is live</div><div class="t-meta">Anyone in this garden may take this up. You can withdraw it until someone does.</div>`);
      break;
    case "browse-offered":
      band =
        card(`<div class="t-title">Open to take up</div><div class="t-meta">Take it up and this becomes your promise to keep — approved Prune and Plant work is its proof.</div>`);
      break;
    case "browse-requested":
      band =
        card(`<div class="t-title">Open to help</div><div class="t-meta">Anyone here can help. You provide, attach evidence, and Ana — who asked — confirms it was kept.</div>`);
      break;
    case "requested":
      band =
        card(`<div class="t-title">Your request is live</div><div class="t-meta">Stewards review who takes this up. You can withdraw it until it's accepted.</div>`);
      break;
    case "evidence-submitted":
      band = card(
        `<div class="t-title">Evidence attached: 1</div><div class="t-meta">This is garden work, so approved linked work and its assessment move the promise toward confirmation.</div>`,
      );
      break;
    case "partially-approved":
      band = card(`<div class="t-title">Work approvals</div>${meter(50, { left: "approved works", right: "1 of 2" })}<div class="t-meta">One more approval — then the qualifying assessment — and this promise is ready to confirm.</div>`);
      break;
    case "ready-confirmer":
      band = card(
        `<div class="t-title">Ready to confirm</div><div class="t-meta">You were named to confirm this promise. Maria, who made it, cannot.</div>`,
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
        `<div class="t-title">This promise ran through Aug 12</div><div class="t-meta">The season moved on — you can offer it again.</div>`,
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
        `<div class="t-title">Keep the promise moving</div><div class="t-meta">Add evidence as you go. Work that fulfills this promise links from the work section below.</div>`,
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
    "request-work-active", "request-work-partially-approved", "request-work-ready-confirmer",
    "support-offered", "support-accepted", "support-evidence-queued", "support-evidence-submitted",
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
${reasonChips(["Plans changed", "Already handled", "Made by mistake"])}
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
  const bar = W2_BARS[state];
  return phoneFrame(`${head}${meta}${content}<div style="flex:1"></div>${sync}`, {
    appBar: bar ? actionBar(bar) : false,
    offline: evidenceQueued || readinessQueued || confirmationQueued,
  });
}

const W2_HOTS: HifiDef["hots"] = {
  "w2.take-up-support": { l: "Take up this service offer", to: "screen:W2@support-accepted", info: "Open claim mode accepts João as the recipient/counterparty; Maria remains the provider. The commitment stays Accepted until WorkLinked or EvidenceAttached lands.", calls: ["claimCommitment"], facts: { commitment: "Offered", kind: "SupportService" } },
  "w2.team-strip": { l: "Open team — join in", to: "screen:W2b@open-eligible", info: "The team strip above the fold (iteration 2, E5/E8): the promise's people are visible on open, and the strip opens the team view where eligible open-team members join." },
  "w2.open-team-forming": { l: "See editable team and contributions", to: "screen:W2b@forming", info: "Before readiness, the accountable lead can add, remove, and assign contributors through online contract actions." },
  "w2.open-team-frozen": { l: "See frozen team and contributions", to: "screen:W2b@frozen", info: "After readiness, opens the frozen contributor roster and contribution record without implying that every participant receives an equal share." },
  "w2.add-evidence": { l: "Add evidence", to: "screen:W2a@media", info: "W2a attach sheet: photo / link / note → one evidence job per submit; fully offline (UX:164)." },
  "w2.add-evidence-request": { l: "Add request evidence", to: "screen:W2a@media", info: "Keeps Ana's request and João's provider role intact while opening the shared evidence composer." },
  "w2.add-evidence-campaign-request": { l: "Add campaign-request evidence", to: "screen:W2a@media", info: "Keeps the Market rides Campaign binding while opening the shared evidence composer." },
  "w2.add-evidence-support": { l: "Add service evidence", to: "screen:W2a@media", info: "Evidence-only SupportService offer: photo / link / note → one offline evidence job (UX:164)." },
  "w2.add-evidence-captured": { l: "Add captured-promise evidence", to: "screen:W2a@media", info: "Keeps the StewardCaptured kind and the member as promise source while opening the evidence composer." },
  "w2.take-up-browse": { l: "Take this up", to: "screen:W2", info: "The browse detail's one act (2026-08-14 workflows round — card-taps land here pre-claim): the same open-mode claim as the card button. Claim job → optimistic Accepted (UX:129).", calls: ["claimCommitment"], facts: { commitment: "Offered", kind: "DomainImpact" } },
  "w2.help-browse": { l: "I can help", to: "screen:W2@request-active", info: "The request browse detail's one act: open-mode claim — the claimant becomes the provider and Ana, the asker, remains the confirmer (UX:104).", calls: ["claimCommitment"], facts: { commitment: "Requested", kind: "SupportService" } },
  "w2.submit-work": { l: "Submit work for this promise", to: "screen:WFLOW@intro-promise", info: "Deep-links the existing Garden-tab work flow with commitment context (UX:174). Promise-first entry scopes the intro (2026-08-14 workflows round): a fulfilling strip on top, the action grid filtered to the promise's requirement rows, the garden locked. DomainImpact only." },
  "w2.submit-work-request-detail": { l: "Submit work for this ask", to: "screen:WFLOW@intro-promise", info: "A DomainImpact Request rides the same Work rails as an offer: submitted work carries meta.commitmentId, approvals count toward the ask's requirements, and the asker confirms (register #97). Lands on the scoped promise-first intro (the drawn cast uses the offer fixture)." },
  "w2.link-work": { l: "Link existing work", to: "screen:WFLOW@link-picker", info: "Client work-picker (2026-08-11 D6 — this control previously mis-targeted the admin work console): selects one of the gardener's approved/pending Works plus one exact requirement row → workLink job carries requirementIndex (UX:140). Repeated action UIDs never use first-match behavior.", calls: ["linkWork"] },
  "w2.unlinked-work": { l: "Link it", to: "screen:WFLOW@link-picker", info: "The recovery layer of standing attribution (2026-08-14): whenever the member has approved work matching a requirement row that is not yet linked, this row stands in the work section — missed attribution is recoverable, never silently lost. Same linkWork path and exact-row rule as the picker.", calls: ["linkWork"] },
  "w2.confirm": { l: "Confirm: promise kept", to: "screen:W4", info: "Visible only to eligible confirmers while ReadyForConfirmation — the provider never sees it (UX:142)." },
  "w2.send-confirmation": { l: "Send for confirmation", to: "screen:W2@support-ready-pending", info: "Queues the evidence-only readiness transition; DomainImpact is rejected on-chain (CS:138b).", calls: ["submitForConfirmation"], pendingSync: true },
  "w2.confirm-support-detail": { l: "Review service confirmation", to: "screen:W4@confirm-support", info: "Opens the named recipient's confirmation view for this SupportService promise." },
  "w2.send-confirmation-request": { l: "Send request for confirmation", to: "screen:W2@request-ready-pending", info: "Queues submitForConfirmation while keeping Ana as default confirmer and João as provider.", calls: ["submitForConfirmation"], pendingSync: true },
  "w2.confirm-request-work-detail": { l: "Review confirmation", to: "screen:W4@confirm-request-work", info: "Opens the garden-work ask's confirmation sheet — approved Work is the proof shown there, not evidence (register #97a)." },
  "w2.confirm-request-detail": { l: "Review request confirmation", to: "screen:W4@confirm-request", info: "Opens only after the request readiness update has synced." },
  "w2.send-confirmation-campaign-request": { l: "Send campaign request for confirmation", to: "screen:W2@campaign-request-ready-pending", info: "Queues readiness without losing the Market rides Campaign binding.", calls: ["submitForConfirmation"], pendingSync: true },
  "w2.confirm-campaign-request-detail": { l: "Review campaign-request confirmation", to: "screen:W4@confirm-campaign-request", info: "Opens the named request creator's confirmation while preserving Campaign scope." },
  "w2.send-confirmation-captured": { l: "Send captured promise for confirmation", to: "screen:W2@captured-ready-pending", info: "StewardCaptured is evidence-only and may call submitForConfirmation without linked work.", calls: ["submitForConfirmation"], pendingSync: true },
  "w2.confirm-captured-detail": { l: "Review captured-promise confirmation", to: "screen:W4@confirm-captured", info: "Opens the named counterparty's confirmation without changing the captured member source." },
  "w2.offer-again": { l: "Offer it again", to: "screen:W3", info: "Per-cycle renewal — a fresh commitment, prefilled (UX:94). Adopted MF-3." },
  "w2.withdraw": { l: "Withdraw (pre-acceptance)", to: "screen:W2@withdraw-confirm", info: "Member pre-acceptance withdraw, adopted MF-2a (register #34b). Steward cancellation remains a separate recorded action with its own outcome state." },
  "w2.withdraw-send": { l: "Withdraw (confirm)", to: "screen:W2@withdrawn", info: "cancelCommitment(commitmentId, reasonCID) on this Offered-Offer creator path releases its already-committed units and provider slot exactly once. An unaccepted Request has no registry release (CS §5.3).", calls: ["cancelCommitment"] },
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
  | "media" | "details" | "review" | "review-request" | "review-campaign-request"
  | "review-support" | "review-captured" | "queued" | "failed";

// Evidence is an MDR VARIANT (iteration 2, Afo direction): the same Submit
// Work rhythm — Media → Details → Review — reusing the flow chrome, the
// tap-to-add capture area, and the fixed one-row bar, so adding evidence feels
// exactly like the work submission every gardener already knows.
function w2a(state: W2aState): string {
  let head = flowHeader("Add evidence", 0, 3);
  let content: string;
  let actions: string;
  let secondary = "";
  switch (state) {
    case "details":
      head = flowHeader("Add evidence", 1, 3);
      content = pagepad(
        sectionTitle("Credit contributors"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("Maria", "ok")}${chip("Ana", "ok")}${chip("Kwame")}</div><div class="t-meta">Tap the teammates who share this evidence — no typing, just the roster.</div>`,
        field("Note", input("optional — a few words from the field", { placeholder: true })),
        field("Link", input("optional — a page that shows the work", { placeholder: true })),
        banner("The selected active contributors are saved with each item and reused exactly on retry.", "stone", "user-line"),
      );
      actions = hot("w2a.details-continue", btn("Continue", { kind: "pri", full: true }));
      break;
    case "review":
    case "review-request":
    case "review-campaign-request":
    case "review-support":
    case "review-captured": {
      head = flowHeader("Add evidence", 2, 3);
      const attachHot =
        state === "review-support" ? "w2a.attach-support"
        : state === "review-campaign-request" ? "w2a.attach-campaign-request"
        : state === "review-request" ? "w2a.attach-request"
        : state === "review-captured" ? "w2a.attach-captured"
        : "w2a.attach";
      content = pagepad(
        card(`<div class="t-sec" style="margin:0 0 4px">Media</div>` + listRow({ icon: "image-line", primary: "North beds after", meta: "Photo" }) + listRow({ icon: "mic-line", primary: "Voice note", meta: "0:38" })),
        card(`<div class="t-sec" style="margin:0 0 4px">Credited</div><div style="display:flex;flex-wrap:wrap;gap:6px">${chip("Maria", "ok")}${chip("Ana", "ok")}</div>`),
        card(`<div class="t-sec" style="margin:0 0 4px">Note</div><div class="t-body">“Two beds left for next week.”</div>`),
        banner("Saved on this device until it sends — evidence works fully offline.", "stone", "wifi-off-line"),
      );
      actions = hot(attachHot, btn("Attach evidence", { kind: "pri", full: true }));
      break;
    }
    case "queued":
      head = flowHeader("Add evidence", 2, 3);
      content = pagepad(
        card(
          listRow({ icon: "image-line", primary: "North beds after", meta: "Photo · credits Maria, Ana · just now", chipHtml: chip("Queued", "queued") }) +
            listRow({ icon: "mic-line", primary: "Voice note", meta: "0:38 · credits Maria, Ana", chipHtml: chip("Queued", "queued") }),
          { cls: "flat" },
        ),
        banner("It will send when you're back online. Nothing else to do.", "stone", "wifi-off-line"),
      );
      actions = hot("w2a.done", btn("Done", { kind: "sec", full: true }));
      break;
    case "failed":
      head = flowHeader("Add evidence", 2, 3);
      content = pagepad(
        card(
          listRow({ icon: "image-line", primary: "North beds after", meta: "Photo · credits Maria, Ana · couldn't send", chipHtml: chip("Couldn't send", "err"), trailing: hot("w2a.retry-row", btn("Retry", { kind: "sec", sm: true, icon: "refresh-line" })) }) +
            listRow({ icon: "sticky-note-line", primary: "“Two beds left for next week”", meta: "Note · sent", chipHtml: chip("Sent", "ok") }),
          { cls: "flat" },
        ),
        banner("Your evidence is held on this device — nothing is dropped. Retry the one that didn't send whenever you're ready.", "stone", "wifi-off-line"),
      );
      actions = hot("w2a.done", btn("Done", { kind: "ghost", full: true }));
      break;
    default: // media
      content = pagepad(
        hot("w2a.tap-add", `<div class="card flat" style="border-style:dashed;align-items:center;text-align:center;padding:22px 14px">${icon("camera-line", "l")}<div class="t-title">Tap to add photos or video</div><div class="t-meta">or use the buttons below — voice notes record from the mic</div></div>`),
        card(
          listRow({ icon: "image-line", primary: "North beds after", meta: "Photo · just now", trailing: hot("w2a.remove-item", btn("Remove", { kind: "ghost", sm: true, icon: "close-line", ariaLabel: "Remove this photo" })) }) +
            listRow({ icon: "mic-line", primary: "Voice note", meta: "0:38 · tap to play" }),
          { cls: "flat" },
        ),
      );
      secondary = `${hot("w2a.capture-camera", btn("", { kind: "sec", sm: true, icon: "camera-line", ariaLabel: "Take a photo" }))}${hot("w2a.capture-gallery", btn("", { kind: "sec", sm: true, icon: "image-line", ariaLabel: "Choose from your library" }))}${hot("w2a.capture-audio", btn("", { kind: "sec", sm: true, icon: "mic-line", ariaLabel: "Record a voice note" }))}`;
      actions = hot("w2a.media-continue", btn("Continue", { kind: "pri", full: true }));
  }
  return phoneFrame(content, { header: head, appBar: actionBar(actions, secondary || undefined), offline: state === "queued" || state === "failed" });
}

const W2A_HOTS: HifiDef["hots"] = {
  "w2a.tap-add": { l: "Tap to add photos or video", info: "The Submit Work capture area — tapping the surface opens the picker, exactly like the shipping media step (iteration 2)." },
  "w2a.capture-camera": { l: "Take a photo", info: "One-tap capture from the fixed bar — the Submit Work media interaction (uiux §5.5 addendum 2026-08-11)." },
  "w2a.capture-gallery": { l: "Choose from your library", info: "Gallery pick, multiple allowed; HEIC conversion and compression follow the work flow's media pipeline." },
  "w2a.capture-audio": { l: "Record a voice note", info: "Audio evidence serializes like work-flow voice notes (SerializedFileData) and rides the same offline queue." },
  "w2a.media-continue": { l: "Continue to details", to: "screen:W2a@details", info: "Media → details, the Submit Work rhythm: contributors and an optional note live on the details step." },
  "w2a.details-continue": { l: "Continue to review", to: "screen:W2a@review", info: "Details → review. The canonical destination is the garden-work review; cast walks land on their identity-preserving review variant of the same screen (request / campaign / service / recorded-promise)." },
  "w2a.remove-item": { l: "Remove this item", info: "Items can be removed until they are attached; nothing uploads before then." },
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
  // Default path is four quick steps (decision 2026-08-10): who-confirms moved
  // to an Advanced detour with the Green Goods fallback ON as the pilot default.
  // 2026-08-11 correction pass (uiux Appendix B §5.4 addendum): direction is
  // entry-fixed — no in-form Direction control anywhere in this wizard. Step 1
  // carries the kind words, the template prefill entry, and the optional
  // Add-details capture; step 2 carries How often (Just once / Ongoing — folds
  // the former W33 wizard) and the exchange detour; every review renders
  // sectioned Submit Work anatomy with per-section edit links; requests gained
  // a real review step (what → how much → who-can-take-it → review).
  ["step-what", "1 · What"], ["step-details", "Add details (optional)"],
  ["step-howmuch", "2 · How much"], ["step-anchors", "3 · Proof"],
  ["step-review", "4 · Review & promise"],
  ["support-howmuch", "Service · amount"],
  ["support-howmuch-ongoing", "Service · amount — Ongoing chosen"],
  ["support-review", "Service · review"],
  ["support-review-ongoing", "Service · review — Ongoing"],
  ["step-advanced", "Advanced · confirmers & team"],
  ["advanced-work-ask", "Advanced · garden-work ask"],
  ["step-advanced-no-protocol", "Advanced · no protocol pool"],
  ["step-confirmers", "Advanced · named confirmer group"],
  ["step-invite", "Advanced · invite contributors"],
  ["request-what", "Request · 1 · What"], ["request-howmuch", "Request · 2 · How much"],
  ["request-howmuch-steward", "Request · 2 · How much (steward)"],
  ["request-support", "Request · 3 · Support (steward)"],
  ["request-variant", "Request · 3 · Who can take it"],
  ["request-variant-steward", "Request · 4 · Who can take it (steward)"],
  ["request-review", "Request · 4 · Review & ask"],
  ["request-review-steward", "Request · 5 · Review (steward)"],
  ["request-work-what", "Request · 1 · What (garden work)"],
  ["request-work-howmuch", "Request · 2 · How much (garden work)"],
  ["request-anchors", "Request · 3 · Proof (garden work)"],
  ["request-work-review", "Request · 4 · Review (garden work)"],
  ["saved-offer-edit", "Saved offer · edit"], ["saved-offer-review", "Saved offer · review"],
  ["saved-offer-queued", "Saved offer · queued"],
  ["draft-resume", "Draft resume"],
  ["validation", "Validation error"],
] as const;
type W3State = (typeof W3_STATES)[number][0];

// `total` is a parameter because the request path skips action anchors: a
// support/service ask is three steps, and showing four dots promises a step
// that never arrives (UX:605 · WF:251). Iteration 2: the header is the real
// Submit Work TopNav — close on step 1, BACK on later steps, FormProgress
// numbered circles instead of dots (kit.flowHeader).
const w3Head = (title: string, step: number, total = 4) => flowHeader(title, step, total);

function w3(state: W3State): string {
  // The draft-resume sheet keeps its own composition: the sheet is the subject.
  if (state === "draft-resume")
    return phoneFrame(
      sheetOver(
        w3Head("Make an offer", 0) + pagepad(field("Kind", radio([{ label: "Garden work", on: true }, { label: "A service or support" }]))),
        "Resume your draft?",
        `${listRow({ icon: "sticky-note-line", primary: "Prune the north beds", meta: "Saved on this device · 2 hours ago" })}${hot("w3.resume", btn("Resume draft", { kind: "pri", full: true }))}${hot("w3.start-fresh", btn("Start fresh", { kind: "ghost", full: true }))}`,
      ),
      { offline: true, appBar: false },
    );

  let head: string;
  let content: string;
  let actions: string;
  let secondary = "";
  switch (state) {
    case "step-howmuch":
      head = w3Head("Make an offer", 1);
      content = pagepad(
        sectionTitle("Unit"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("hours", "ok")}${chip("tasks")}${chip("meals")}${chip("rides")}${chip("plants")}${chip("other…")}</div>`,
        sectionTitle("How many"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("1")}${chip("2")}${chip("6", "ok")}${chip("12")}${chip("custom…")}</div>`,
        `<div class="t-meta">Tap what fits — a custom unit or amount opens the keyboard only when you ask for it.</div>`,
        field("Due", ""),
        radio([{ label: "Runs with the season", meta: "through Aug 30", on: true }, { label: "Pick a date", meta: "choose a day that suits you" }]),
        field("How often", radio([
          { label: "Just once", meta: "one promise, kept once", on: true },
          { label: "Ongoing", meta: "keep offering this over time — places open as you add them", hot: "w3.choose-ongoing" },
        ], { interactive: true, name: "offer-howoften" })),
      );
      actions = hot("w3.continue-howmuch", btn("Continue", { kind: "pri", full: true }));
      break;
    case "step-anchors":
      head = w3Head("Make an offer", 2);
      // Tap-first action cards (2026-08-11 correction pass): the garden's own
      // registered actions render as tappable cards — chosen ones carry their
      // count — instead of an abstract requirement-row editor.
      content = pagepad(
        sectionTitle("What work does this include?", chip("2 chosen")),
        `<div class="t-meta">Tap the garden actions this promise includes. Each carries its own count.</div>`,
        `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
${card(`${icon("leaf-line")}<div class="t-title">Prune</div><div class="t-meta">AGRO · trees and beds</div><span class="ch ok num">× 2</span>`, { cls: "flat" })}
${card(`${icon("plant-line")}<div class="t-title">Plant</div><div class="t-meta">AGRO · seedlings and starts</div><span class="ch ok num">× 12</span>`, { cls: "flat" })}
${hot("w3.pick-action", card(`${icon("drop-line")}<div class="t-title">Water</div><div class="t-meta">AGRO · beds and rows</div><span class="ch">tap to add</span>`, { cls: "flat" }))}
${card(`${icon("seedling-line")}<div class="t-title">Weed</div><div class="t-meta">AGRO · beds and paths</div><span class="ch">tap to add</span>`, { cls: "flat" })}
</div>`,
        `<div class="t-meta">Tap a chosen action to change its count — 1 · 2 · 4 · custom. Add as many actions as the promise genuinely needs.</div>`,
      );
      actions = hot("w3.continue-anchors", btn("Continue", { kind: "pri", full: true }));
      break;
    case "step-review":
      head = w3Head("Make an offer", 3);
      // Sectioned Submit-Work review anatomy (2026-08-11 correction pass):
      // each section owns an edit link back to its step; the Advanced detour
      // is a content affordance, never a second bar button.
      content = pagepad(
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">What you're offering</div>${hot("w3.edit-what", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Title", "Prune the north beds")}${kv("Kind", "Garden work")}${kv("Season", "First Rains")}<div class="t-meta">2 photos · 1 voice note attached</div>`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">How much</div>${hot("w3.edit-howmuch", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Amount", "6 hours")}${kv("Due", "Aug 30 — runs with the season")}${kv("How often", "Just once")}`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">Proof</div>${hot("w3.edit-anchors", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("This promise needs", "Prune × 2 · Plant × 12")}${domainRow(["AGRO"])}<div class="t-meta">Approved work is the proof.</div>`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">Who confirms & team</div>${hot("w3.advanced", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Who confirms", "The person you help")}${kv("If no one local can confirm", "The Green Goods team can step in")}${kv("Team", "Open — garden members may join in")}`),
        `<div class="t-meta">Submitting queues the promise on this device and returns you to the pool — it sends when connected.</div>`,
      );
      actions = hot("w3.submit", btn("Make this offer", { kind: "pri", full: true }));
      break;
    case "step-advanced":
      head = w3Head("Make an offer", 3);
      content = pagepad(
        sectionTitle("Who confirms"),
        card(`${kv("Ordinary confirmation", "Offer recipient confirms")}${kv("Limit", "Choose up to the current confirmer limit — read from MAX_CONFIRMERS on the deployed module, never a number drawn here")}`),
        hot("w3.confirmer-group", field("Named group", input("None — add people to require more than one confirmation", { select: true }))),
        hot("w3.protocol-fallback", `<label class="arow" style="align-items:flex-start"><input type="checkbox" aria-label="Let the Green Goods team confirm if nobody local is eligible" checked style="margin-top:4px"><span class="grow"><b>Let the Green Goods team confirm if nobody local is eligible</b><span class="t-meta" style="display:block">On for this pilot. Usable only while nobody local can confirm, always with a recorded reason — and never by a contributor.</span></span></label>`),
        sectionTitle("Team options"),
        hot("w3.contributor-policy", field("Contributor policy", radio([{ label: "Open team", meta: "eligible garden members may join", on: true }, { label: "Lead-managed team", meta: "the lead or steward manages the roster" }], { interactive: true, name: "contributor-policy" }))),
        hot("w3.invite", listRow({ icon: "group-line", primary: "Invite contributors", meta: "lead-managed teams can add people from creation", chevron: true })),
        field("Needs an assessment", radio([{ label: "No", meta: "evidence and confirmation carry the proof", on: true }, { label: "Yes", meta: "an evaluator attaches a qualifying assessment" }], { interactive: true, name: "requires-assessment" })),
      );
      actions = hot("w3.advanced-done", btn("Back to review", { kind: "pri", full: true }));
      break;
    // Garden-work asks get their claim mode HERE, not as a fifth step
    // (2026-08-14 workflows round): step 3 stays the protection step — proof
    // rows for work asks, who-can-take-it for service asks — and the rare
    // "vet who starts" need lives in the same detour as who-confirms.
    case "advanced-work-ask":
      head = w3Head("Make a request", 3);
      content = pagepad(
        sectionTitle("Who confirms"),
        card(`${kv("Ordinary confirmation", "You — it was your request")}${kv("Limit", "Choose up to the current confirmer limit — read from MAX_CONFIRMERS on the deployed module, never a number drawn here")}`),
        hot("w3.confirmer-group", field("Named group", input("None — add people to require more than one confirmation", { select: true }))),
        hot("w3.protocol-fallback", `<label class="arow" style="align-items:flex-start"><input type="checkbox" aria-label="Let the Green Goods team confirm if nobody local is eligible" checked style="margin-top:4px"><span class="grow"><b>Let the Green Goods team confirm if nobody local is eligible</b><span class="t-meta" style="display:block">On for this pilot. Usable only while nobody local can confirm, always with a recorded reason — and never by a contributor.</span></span></label>`),
        sectionTitle("Who can take it"),
        hot("w3.claim-mode", field("Who can take this up", radio([
          { label: "Open to anyone here", meta: "approved work is the gate — unapproved help never reaches Ready", on: true },
          { label: "Stewards review who takes it", meta: "for asks that need vetting before someone starts" },
        ], { interactive: true, name: "work-ask-claim-mode" }))),
        sectionTitle("Team options"),
        hot("w3.contributor-policy", field("Contributor policy", radio([{ label: "Open team", meta: "eligible garden members may join", on: true }, { label: "Lead-managed team", meta: "the lead or steward manages the roster" }], { interactive: true, name: "contributor-policy-work-ask" }))),
        field("Needs an assessment", radio([{ label: "No", meta: "approved work carries the proof", on: true }, { label: "Yes", meta: "an evaluator attaches a qualifying assessment" }], { interactive: true, name: "requires-assessment-work-ask" })),
      );
      actions = hot("w3.advanced-work-done", btn("Back to review", { kind: "pri", full: true }));
      break;
    case "step-advanced-no-protocol":
      head = w3Head("Make an offer", 3);
      content = pagepad(
        sectionTitle("Who confirms"),
        card(`${kv("Ordinary confirmation", "Offer recipient confirms")}${kv("Limit", "Choose up to the current confirmer limit — read from MAX_CONFIRMERS on the deployed module")}`),
        hot("w3.confirmer-group", field("Named group", input("None — add people to require more than one confirmation", { select: true }))),
        `<label class="arow" style="align-items:flex-start;opacity:.55"><input type="checkbox" aria-label="Let the Green Goods team confirm if nobody local is eligible" disabled style="margin-top:4px"><span class="grow"><b>Let the Green Goods team confirm if nobody local is eligible</b><span class="t-meta" style="display:block">Unavailable on this deployment: no Green Goods protocol pool is registered yet. Name a local confirmer group instead.</span></span></label>`,
        banner("Because the team fallback is unavailable here, this promise stores it off and the review will block until the ordinary confirmer rule can be met locally.", "amber", "error-warning-line"),
        sectionTitle("Team options"),
        hot("w3.contributor-policy", field("Contributor policy", radio([{ label: "Open team", meta: "eligible garden members may join", on: true }, { label: "Lead-managed team", meta: "the lead or steward manages the roster" }], { interactive: true, name: "contributor-policy-noproto" }))),
      );
      actions = hot("w3.advanced-done", btn("Back to review", { kind: "pri", full: true }));
      break;
    case "step-confirmers":
      head = w3Head("Make an offer", 3);
      content = pagepad(
        sectionTitle("Named confirmer group"),
        `<div class="t-meta">Any one of the people you name may confirm. Contributors and the accountable lead never appear here — they cannot confirm their own promise.</div>`,
        card(
          `<label class="arow"><input type="checkbox" checked aria-label="João"><span class="grow"><b>João</b><span class="t-meta" style="display:block">Neighbour · not a contributor</span></span></label>` +
            `<label class="arow"><input type="checkbox" checked aria-label="Luz"><span class="grow"><b>Luz</b><span class="t-meta" style="display:block">Garden member · not a contributor</span></span></label>` +
            `<label class="arow"><input type="checkbox" aria-label="Kwame"><span class="grow"><b>Kwame</b><span class="t-meta" style="display:block">Garden member · not a contributor</span></span></label>`,
          { cls: "flat" },
        ),
        field("How many must confirm", radio([{ label: "Any one of them", meta: "threshold 1 of 2 named", on: true }, { label: "Both of them", meta: "threshold 2 of 2 named" }], { interactive: true, name: "confirmer-threshold" })),
        banner("Maria and Ana are on the contributor roster, so they are not listed — a contributor can never confirm.", "stone", "shield-check-line"),
      );
      actions = hot("w3.confirmers-done", btn("Use this group", { kind: "pri", full: true }));
      break;
    case "support-review":
      head = w3Head("Make an offer", 2, 3);
      content = pagepad(
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">What you're offering</div>${hot("w3.edit-what", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Title", "Repair tool handles")}${kv("Kind", "A service")}${kv("Campaign", "Tool library")}`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">How much</div>${hot("w3.edit-support-howmuch", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Amount", "1 repair session")}${kv("Due", "Aug 30 — runs with the campaign")}${kv("How often", "Just once")}`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">Who confirms & team</div>${hot("w3.advanced", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Who confirms", "The person you help")}${kv("If no one local can confirm", "The Green Goods team can step in")}${kv("Team", "Open — garden members may join in")}`),
        `<div class="t-meta">Service offers skip action anchors. Evidence and the named recipient carry the proof.</div>`,
      );
      actions = hot("w3.submit-support", btn("Make this offer", { kind: "pri", full: true }));
      break;
    case "support-howmuch":
      head = w3Head("Make an offer", 1, 3);
      content = pagepad(
        sectionTitle("Unit"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("repair sessions", "ok")}${chip("rides")}${chip("meals")}${chip("workshops")}${chip("other…")}</div>`,
        sectionTitle("How many"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("1", "ok")}${chip("2")}${chip("4")}${chip("custom…")}</div>`,
        field("Campaign", input("Tool library", { select: true })),
        field("Due", ""),
        radio([{ label: "Runs with the campaign", meta: "through Aug 30", on: true }, { label: "Pick a date", meta: "choose a day that suits you" }]),
        field("How often", radio([
          { label: "Just once", meta: "one promise, kept once", on: true },
          { label: "Ongoing", meta: "keep offering this over time — places open as you add them", hot: "w3.choose-ongoing" },
        ], { interactive: true, name: "support-howoften" })),
      );
      actions = hot("w3.continue-support-howmuch", btn("Continue", { kind: "pri", full: true }));
      break;
    case "support-howmuch-ongoing":
      // Ongoing chosen — the SAME step expands inline (iteration 2): no detour
      // wizard, just the places block appearing under the How-often choice.
      head = w3Head("Make an offer", 1, 3);
      content = pagepad(
        sectionTitle("Unit"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("workshop sessions", "ok")}${chip("rides")}${chip("meals")}${chip("other…")}</div>`,
        sectionTitle("How many each place"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("1", "ok")}${chip("2")}${chip("custom…")}</div>`,
        field("How often", radio([
          { label: "Just once", meta: "one promise, kept once", hot: "w3.choose-once" },
          { label: "Ongoing", meta: "keep offering this over time", on: true },
        ], { interactive: true, name: "support-howoften-ongoing" })),
        sectionTitle("Open places to start"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("1")}${chip("2", "ok")}${chip("4")}${chip("custom…")}</div>`,
        field("Scope", input("Season of First Rains", { select: true })),
        `<div class="t-meta">Each place is one ordinary promise, taken up on its own. Rest, resume, or retire it later from Things I can offer.</div>`,
      );
      actions = hot("w3.continue-support-howmuch-ongoing", btn("Continue", { kind: "pri", full: true }));
      break;
    case "request-what":
      head = w3Head("Make a request", 0);
      content = pagepad(
        sectionTitle("What kind?"),
        kindCards([
          { icon: "hand-heart-line", label: "Help or a service", meta: "rides, meals, repairs — evidence-confirmed", on: true },
          { icon: "leaf-line", label: "Garden work", meta: "counts toward the garden's actions", hot: "w3.request-choose-work" },
        ]),
        field("Season", hot("w3.cycle", input("First Rains · chosen for you", { select: true }))),
        `<div class="t-meta">The only open season is picked for you. When a Campaign also runs, you choose here.</div>`,
        field("Title", input("Ride to the market on Saturday")),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("Ride to the market", "ok")}${chip("Fix the tool shed")}${chip("Meal for the workday")}</div>`,
        `<div class="t-meta">Common asks in this garden — tap one to start, then make it yours.</div>`,
        field("Note", input("optional", { placeholder: true })),
        hot("w3.add-details", listRow({ icon: "camera-line", primary: "Add details", meta: "photos, a voice note, links — optional", chevron: true })),
      );
      actions = hot("w3.request-continue-what", btn("Continue", { kind: "pri", full: true }));
      break;
    case "request-howmuch":
      head = w3Head("Make a request",1, 3);
      content = pagepad(
        sectionTitle("Unit"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("rides", "ok")}${chip("hours")}${chip("meals")}${chip("other…")}</div>`,
        sectionTitle("How many"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("1", "ok")}${chip("2")}${chip("4")}${chip("custom…")}</div>`,
        `<div class="t-meta">Tap what fits — the keyboard opens only for a custom unit or amount.</div>`,
        field("Due", ""),
        radio([{ label: "Runs with the season", meta: "through Aug 30", on: true }, { label: "Pick a date", meta: "choose a day that suits you" }]),
      );
      actions = hot("w3.request-continue-howmuch", btn("Continue", { kind: "pri", full: true }));
      break;
    case "request-work-what":
      head = w3Head("Make a request", 0);
      content = pagepad(
        sectionTitle("What kind?"),
        kindCards([
          { icon: "hand-heart-line", label: "Help or a service", meta: "rides, meals, repairs — evidence-confirmed", hot: "w3.request-choose-service" },
          { icon: "leaf-line", label: "Garden work", meta: "counts toward the garden's actions", on: true },
        ]),
        `<div class="t-meta">Garden work adds a proof step — the progress above already counts all four.</div>`,
        field("Season", hot("w3.cycle", input("First Rains · chosen for you", { select: true }))),
        field("Title", input("Clear the drainage channel")),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("Clear the drainage channel", "ok")}${chip("Weed the north beds")}${chip("Mulch the paths")}</div>`,
        `<div class="t-meta">Suggestions from this garden's actions — tap one to start, then make it yours.</div>`,
        field("Note", input("optional", { placeholder: true })),
      );
      actions = hot("w3.request-work-continue-what", btn("Continue", { kind: "pri", full: true }));
      break;
    case "request-work-howmuch":
      head = w3Head("Make a request",1);
      content = pagepad(
        sectionTitle("Unit"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("hours", "ok")}${chip("sessions")}${chip("beds")}${chip("other…")}</div>`,
        sectionTitle("How many"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("4")}${chip("8", "ok")}${chip("12")}${chip("custom…")}</div>`,
        `<div class="t-meta">Tap what fits — the keyboard opens only for a custom unit or amount.</div>`,
        field("Due", ""),
        radio([{ label: "Runs with the season", meta: "through Aug 30", on: true }, { label: "Pick a date", meta: "choose a day that suits you" }]),
      );
      actions = hot("w3.request-continue-work", btn("Continue", { kind: "pri", full: true }));
      break;
    case "request-anchors":
      head = w3Head("Make a request",2);
      content = pagepad(
        sectionTitle("What work does this ask need?", chip("2 chosen")),
        `<div class="t-meta">Tap the garden actions this ask includes. Approved work is the proof — the person you asked never self-confirms.</div>`,
        `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
${card(`${icon("seedling-line")}<div class="t-title">Weed</div><div class="t-meta">AGRO · beds and paths</div><span class="ch ok num">× 2</span>`, { cls: "flat" })}
${card(`${icon("plant-line")}<div class="t-title">Mulch</div><div class="t-meta">AGRO · barrows spread</div><span class="ch ok num">× 4</span>`, { cls: "flat" })}
${hot("w3.pick-action", card(`${icon("leaf-line")}<div class="t-title">Prune</div><div class="t-meta">AGRO · trees and beds</div><span class="ch">tap to add</span>`, { cls: "flat" }))}
${card(`${icon("drop-line")}<div class="t-title">Water</div><div class="t-meta">AGRO · beds and rows</div><span class="ch">tap to add</span>`, { cls: "flat" })}
</div>`,
        `<div class="t-meta">Tap a chosen action to change its count — 1 · 2 · 4 · custom.</div>`,
      );
      actions = hot("w3.request-continue-anchors", btn("Continue", { kind: "pri", full: true }));
      break;
    case "request-work-review":
      head = w3Head("Make a request",3);
      content = pagepad(
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">What you're asking</div>${hot("w3.edit-request-work-what", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Title", "Clear the drainage channel")}${kv("Kind", "Garden work")}${kv("Season", "First Rains")}`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">How much</div>${hot("w3.edit-request-work-howmuch", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Amount", "8 hours")}${kv("Due", "Aug 30 — runs with the season")}`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">Proof</div>${hot("w3.edit-request-anchors", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("This ask needs", "Weed × 2 · Mulch × 4")}${domainRow(["AGRO"])}<div class="t-meta">Approved work is the proof — the person you asked never self-confirms.</div>`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">Who confirms & team</div>${hot("w3.advanced-work", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Who confirms", "You — it was your request")}${kv("Who can take it", "Open to anyone here")}${kv("If no one local can confirm", "The Green Goods team can step in")}${kv("Team", "Open — anyone in this pool can help")}`),
        `<div class="t-meta">A garden-work request travels the Work rails: whoever takes it up submits work, the stewards approve it, and you confirm it was met.</div>`,
      );
      actions = hot("w3.submit-work-request", btn("Request this work", { kind: "pri", full: true }));
      break;
    case "request-variant":
      head = w3Head("Make a request",2);
      content = pagepad(
        field("Who can take this up", radio([
          { label: "Open to anyone here", meta: "the first neighbor to say “I can help” becomes the provider", on: true },
          { label: "Stewards review who takes it", meta: "people ask first; your stewards choose" },
        ], { interactive: true, name: "request-claim-mode" })),
        `<div class="t-meta">Either way, you confirm when the help arrives.</div>`,
      );
      actions = hot("w3.request-continue-variant", btn("Continue", { kind: "pri", full: true }));
      break;
    case "request-review":
      head = w3Head("Make a request",3);
      content = pagepad(
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">What you're requesting</div>${hot("w3.edit-request-what", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Title", "Ride to the market on Saturday")}${kv("Kind", "Help or a service")}${kv("Season", "First Rains")}`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">How much</div>${hot("w3.edit-request-howmuch", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Amount", "1 ride")}${kv("Due", "Aug 30 — runs with the season")}`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">Who can take it</div>${hot("w3.edit-request-variant", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Take-up", "Open to anyone here")}`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">Who confirms & team</div>${hot("w3.advanced", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Who confirms", "You — it was your request")}${kv("If no one local can confirm", "The Green Goods team can step in")}${kv("Team", "Open — anyone in this pool can help")}`),
        `<div class="t-meta">Service requests skip action anchors — evidence and you, the requester, carry the proof.</div>`,
      );
      actions = hot("w3.submit-request", btn("Make this request", { kind: "pri", full: true }));
      break;
    case "saved-offer-edit":
      head = w3Head("Offer it once", 0, 2);
      content = pagepad(
        banner("Prefilled from your saved details. You can change every field before you make this offer.", "stone", "information-line"),
        field("Kind", radio([{ label: "A service or support", meta: "workshops, rides, meals, repairs", on: true }], { interactive: true, name: "saved-offer-kind" })),
        field("Garden", input("Rocinha Community Garden", { select: true })),
        field("Cycle", input("Season of First Rains", { select: true })),
        field("Title", input("Hosting climate workshops")),
        field("What people receive", input("A two-hour session on local climate work")),
        field("Unit", input("workshop sessions", { select: true })),
        field("How many", input("1")),
        field("Who confirms", input("Recipient", { select: true })),
      );
      actions = hot("w3.review-saved-offer", btn("Review this offer", { kind: "pri", full: true }));
      break;
    case "saved-offer-review":
      head = w3Head("Offer it once", 1, 2);
      content = pagepad(
        card(`${kv("Direction", "Offer")}${kv("Kind", "Support / service")}${kv("Garden", "Rocinha Community Garden")}${kv("Cycle", "Season of First Rains")}${kv("Title", "Hosting climate workshops")}${kv("What people receive", "A two-hour session on local climate work")}${kv("How much", "1 workshop session")}${kv("Who confirms", "Recipient")}`),
        banner("This makes one ordinary Offer. It will not repeat, create an ongoing Offer, or make another place later.", "stone", "information-line"),
      );
      actions = `<div class="brow">${hot("w3.edit-saved-offer", btn("Edit", { kind: "ghost" }))}${hot("w3.submit-saved-offer", btn("Make this offer", { kind: "pri" }))}</div>`;
      break;
    case "saved-offer-queued":
      head = w3Head("Offer it once", 2, 2);
      content = pagepad(
        card(
          listRow({ icon: "hand-heart-line", primary: "Hosting climate workshops", meta: "Rocinha Community Garden · 1 workshop session", chipHtml: chip("Queued", "queued") }),
        ),
        banner("Saved on this phone. It sends when you are connected.", "amber", "time-line"),
        `<div class="t-meta">This is one ordinary Offer. Your saved details remain reusable, but this offer will not repeat or become ongoing.</div>`,
      ) + syncBar("1 waiting to send");
      actions = hot("w3.saved-offer-done", btn("Back to my offers", { kind: "ghost", full: true }));
      break;
    case "step-details":
      head = w3Head("Make an offer", 0);
      // MDR-parity capture (2026-08-11 D4): camera / gallery / voice note are
      // one-tap from the fixed bar; link and written note are content adders;
      // items compose into a visible list. Payload → commitment-metadata JSON
      // v1 → metadataCID; everything works offline with the draft.
      content = pagepad(
        sectionTitle("What you've added", chip("2 items")),
        card(
          listRow({ icon: "image-line", primary: "North beds — before", meta: "Photo · just now", trailing: hot("w3.remove-detail", btn("Remove", { kind: "ghost", sm: true, icon: "close-line", ariaLabel: "Remove this photo" })) }) +
            listRow({ icon: "mic-line", primary: "Voice note", meta: "0:38 · tap to play" }),
          { cls: "flat" },
        ),
        `<div class="brow">${hot("w3.add-link", btn("Add a link", { kind: "sec", sm: true, icon: "link-m" }))}${hot("w3.add-note", btn("Write a note", { kind: "sec", sm: true, icon: "sticky-note-line" }))}</div>`,
        banner("Saved on this device with your draft — details upload when the promise sends.", "stone", "wifi-off-line"),
      );
      secondary = `${hot("w3.capture-camera", btn("", { kind: "sec", sm: true, icon: "camera-line", ariaLabel: "Take a photo" }))}${hot("w3.capture-gallery", btn("", { kind: "sec", sm: true, icon: "image-line", ariaLabel: "Choose from your library" }))}${hot("w3.capture-audio", btn("", { kind: "sec", sm: true, icon: "mic-line", ariaLabel: "Record a voice note" }))}`;
      actions = hot("w3.details-done", btn("Done", { kind: "pri", full: true }));
      break;
    case "support-review-ongoing":
      head = w3Head("Make an offer", 2, 3);
      content = pagepad(
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">What you're offering</div>${hot("w3.edit-what", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Title", "Hosting climate workshops")}${kv("Kind", "A service")}${kv("How often", "Ongoing")}`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">How much</div>${hot("w3.edit-support-howmuch-ongoing", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Each place", "1 workshop session")}${kv("Scope", "Season of First Rains")}`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">Places</div>${hot("w3.edit-places", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("To start", "2 places")}${kv("Next cycle", "Ask me again next cycle")}<div class="t-meta">Places appear as available once they sync and reserve your capacity. Nothing repeats without you.</div>`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">Who confirms & team</div>${hot("w3.advanced", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Who confirms", "The person you help")}${kv("Team", "Open — garden members may join in")}`),
        banner("One submission starts the ongoing Offer and its first places together.", "stone", "information-line"),
      );
      actions = hot("w3.submit-ongoing", btn("Start this ongoing offer", { kind: "pri", full: true }));
      break;
    case "request-howmuch-steward":
      head = w3Head("Make a request", 1, 5);
      content = pagepad(
        sectionTitle("Unit"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("rides", "ok")}${chip("hours")}${chip("meals")}${chip("other…")}</div>`,
        sectionTitle("How many"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("1", "ok")}${chip("2")}${chip("4")}${chip("custom…")}</div>`,
        field("Due", ""),
        radio([{ label: "Runs with the season", meta: "through Aug 30", on: true }, { label: "Pick a date", meta: "choose a day that suits you" }]),
        banner("You're a steward here, so a Support step follows — gardeners' requests skip it and keep four steps.", "stone", "information-line"),
      );
      actions = hot("w3.request-continue-support", btn("Continue", { kind: "pri", full: true }));
      break;
    case "request-support":
      head = w3Head("Make a request", 2, 5);
      content = pagepad(
        sectionTitle("Add G$ support"),
        `<div class="t-meta">Declare G$ that arrives when this request is kept and confirmed. Only stewards see this step.</div>`,
        sectionTitle("How much"),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("20 G$", "ok")}${chip("50 G$")}${chip("100 G$")}${chip("custom…")}${chip("none")}</div>`,
        card(`${kv("Where it goes", "The person who helps")}${kv("Paid from", "The garden's account")}${kv("When", "After the promise is confirmed kept")}`),
        banner("Declaring support records it with the request — nothing moves until the promise is kept and confirmed.", "stone", "hand-heart-line"),
      );
      actions = hot("w3.request-support-continue", btn("Continue", { kind: "pri", full: true }));
      break;
    case "request-variant-steward":
      head = w3Head("Make a request", 3, 5);
      content = pagepad(
        field("Who can take this up", radio([
          { label: "Open to anyone here", meta: "the first neighbor to say “I can help” becomes the provider", on: true },
          { label: "Stewards review who takes it", meta: "people ask first; your stewards choose" },
        ], { interactive: true, name: "request-claim-mode-steward" })),
        `<div class="t-meta">Either way, you confirm when the help arrives.</div>`,
      );
      actions = hot("w3.request-continue-variant-steward", btn("Continue", { kind: "pri", full: true }));
      break;
    case "request-review-steward":
      head = w3Head("Make a request", 4, 5);
      content = pagepad(
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">What you're requesting</div>${hot("w3.edit-request-what", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Title", "Ride to the market on Saturday")}${kv("Kind", "Help or a service")}${kv("Season", "First Rains")}`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">How much</div>${hot("w3.edit-request-howmuch", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Amount", "1 ride")}${kv("Due", "Aug 30 — runs with the season")}`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">G$ support</div>${hot("w3.edit-request-support", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Declared", "20 G$ · to the person who helps")}<div class="t-meta">Arrives after the promise is confirmed kept.</div>`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">Who can take it</div>${hot("w3.edit-request-variant", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Take-up", "Open to anyone here")}`),
        card(`<div class="cardrow"><div class="t-sec" style="margin:0">Who confirms & team</div>${hot("w3.advanced", btn("Edit", { kind: "ghost", sm: true }))}</div>${kv("Who confirms", "You — it was your request")}${kv("If no one local can confirm", "The Green Goods team can step in")}`),
      );
      actions = hot("w3.submit-request", btn("Make this request", { kind: "pri", full: true }));
      break;
    case "step-invite":
      head = w3Head("Make an offer", 3);
      content = pagepad(
        sectionTitle("Invite contributors"),
        `<div class="t-meta">Lead-managed teams add people from creation; open teams let eligible members join on their own. Invites become roster actions once the promise is accepted.</div>`,
        card(
          `<label class="arow"><input type="checkbox" checked aria-label="João"><span class="grow"><b>João</b><span class="t-meta" style="display:block">Garden member</span></span></label>` +
            `<label class="arow"><input type="checkbox" aria-label="Luz"><span class="grow"><b>Luz</b><span class="t-meta" style="display:block">Garden member</span></span></label>` +
            `<label class="arow"><input type="checkbox" aria-label="Kwame"><span class="grow"><b>Kwame</b><span class="t-meta" style="display:block">Garden member</span></span></label>`,
          { cls: "flat" },
        ),
        banner("Contributors help keep the promise and share recognition — they never confirm it.", "stone", "user-line"),
      );
      actions = hot("w3.invite-done", btn("Add to the team", { kind: "pri", full: true }));
      break;
    case "validation":
      head = w3Head("Make an offer", 2);
      content = pagepad(
        banner("Add at least one action, and give each a count of 1 or more, before you continue. Your entries are kept.", "amber", "error-warning-line"),
        sectionTitle("This promise needs", chip("2 actions")),
        card(
          listRow({ icon: "leaf-line", primary: "Prune × 1", meta: "AGRO · trees and beds", chipHtml: chip("OK", "ok") }) +
            listRow({ icon: "error-warning-line", primary: "Plant × 0", meta: "needs a count of at least 1", chipHtml: chip("Fix", "err") }) +
            hot("w3.add-action", btn("Add an action", { kind: "ghost", sm: true, icon: "add-line" })),
          { cls: "flat" },
        ),
        `<div class="t-meta">Each requirement needs a count of 1 or more. Add as many as the commitment genuinely needs; the measured implementation cap is not presented as a planning rule.</div>`,
      );
      actions = btn("Continue", { kind: "pri", full: true, disabled: true });
      break;
    default:
      head = w3Head("Make an offer", 0);
      content = pagepad(
        sectionTitle("What kind?"),
        kindCards([
          { icon: "leaf-line", label: "Garden work", meta: "counts toward the garden's actions", on: true },
          { icon: "hand-heart-line", label: "A service", meta: "rides, meals, repairs — evidence-confirmed", hot: "w3.choose-support" },
        ]),
        field("Season", hot("w3.cycle", input("First Rains · chosen for you", { select: true }))),
        `<div class="t-meta">The only open season is picked for you. When a Campaign also runs, you choose here.</div>`,
        field("Title", input("Prune the north beds")),
        `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("Prune the north beds", "ok")}${chip("Water the seedlings")}${chip("Plant out the starts")}</div>`,
        `<div class="t-meta">Suggestions come from the garden's own actions — tap one to start, then make it yours.</div>`,
        field("Note", input("optional", { placeholder: true })),
        hot("w3.add-details", listRow({ icon: "camera-line", primary: "Add details", meta: "photos, a voice note, links — optional", chevron: true })),
        hot("w3.template", listRow({ icon: "sticky-note-line", primary: "Start from a template", meta: "familiar ways this pool works together", chevron: true })),
      );
      actions = hot("w3.continue-what", btn("Continue", { kind: "pri", full: true }));
  }
  // `/pool/new` is a full-screen flow — the shipping AppBar hides here exactly
  // as it does for the Garden work flow (uiux-spec:120 · AppBar.tsx:33). The
  // header and action bar are fixed chrome; only the form content scrolls.
  return phoneFrame(content, { header: head, appBar: actionBar(actions, secondary || undefined), offline: state === "saved-offer-queued" });
}

const W3_HOTS: HifiDef["hots"] = {
  // Direction is entry-fixed (2026-08-11 correction pass): the old w3.direction
  // in-form control is deleted — season/campaign seeding and on-behalf capture
  // remain console-seeded only (UX:154).
  "w3.contributor-policy": { l: "Contributor policy", info: "Chooses the immutable Open or LeadManaged roster policy before creation; the final review repeats the selected join rule." },
  "w3.choose-support": { l: "Choose Support / service", to: "screen:W3@support-howmuch", info: "Chooses the evidence-only SupportService offer path. It keeps the amount step and skips only DomainImpact action anchors (UX:156)." },
  "w3.continue-support-howmuch": { l: "Continue with service amount", to: "screen:W3@support-review", info: "Carries the chip-picked service unit and quantity straight into review; due defaults to the campaign end, and the confirmer default and pilot fallback are already set (UX §5.4, amended 2026-08-10; tap-first register #95)." },
  "w3.cycle": { l: "Season scope", info: "Every promise names its cycle. The form binds the only open target and shows it editable; the chooser appears when a Campaign also runs or cycle-less is allowed (UX:127, amended 2026-08-10)." },
  "w3.continue-what": { l: "Continue to amount", to: "screen:W3@step-howmuch", info: "What + cycle scope → amount (UX:154-155)." },
  "w3.continue-howmuch": { l: "Continue to proof", to: "screen:W3@step-anchors", info: "Amount → action anchors for garden work (UX:150-153). Unit and amount are chip picks with a custom escape; due defaults to the season end (tap-first register #95)." },
  "w3.continue-anchors": { l: "Continue to review", to: "screen:W3@step-review", info: "Action anchors → review. Who-confirms is defaulted (recipient + pilot Green Goods fallback) and adjustable from review's Advanced detour (UX §5.4, amended 2026-08-10)." },
  "w3.protocol-fallback": { l: "Green Goods team fallback", info: "Writes protocolFallbackEnabled — ON by default for the pilot (decision 2026-08-10, supersedes the 2026-08-02 off-by-default closure). The runtime guard is unchanged: usable only while the ordinary path is unreachable, always with a recorded reason, never by a contributor. Turn it off here per promise." },
  "w3.advanced": { l: "Edit who confirms & team", to: "screen:W3@step-advanced", info: "The Advanced detour is a content affordance on every review's Who-confirms section — never a second bar button (one-row rule, 2026-08-11): named confirmer groups, the pilot-default Green Goods fallback with its per-promise opt-out, contributor policy, contributor invites, and assessment requirement live here so the default path stays four quick steps. Drawn once in the offer cast." },
  "w3.advanced-work": { l: "Edit who confirms, team & who can take it", to: "screen:W3@advanced-work-ask", info: "The garden-work ask's Advanced detour (2026-08-14 workflows round) additionally carries the claim mode — step 3 stays the protection step (proof rows), and the rare vet-who-starts need lives here rather than as a fifth step." },
  "w3.claim-mode": { l: "Who can take this up", info: "Gardener-set claim mode for garden-work asks (2026-08-14, amending §5.4's context-default rule): defaults open because the Work-approval rails are the ordinary gate; steward-reviewed remains available for asks that need vetting before someone starts. Service asks keep their step-3 choice; steward seeding (W8) retains fuller control (register #19)." },
  "w3.advanced-work-done": { l: "Back to review", to: "screen:W3@request-work-review", info: "Returns to the garden-work ask's review with the detour's choices summarized in its Who-confirms section." },
  "w3.confirmer-group": { l: "Named confirmer group", to: "screen:W3@step-confirmers", info: "Opens the any-N named-group picker (UX §5.4 step 5). The list excludes the accountable lead and every contributor before threshold validation." },
  "w3.confirmers-done": { l: "Use this group", to: "screen:W3@step-advanced", info: "Returns the chosen addresses and threshold to Advanced, which carries them back to review." },
  "w3.advanced-done": { l: "Back to review", to: "screen:W3@step-review", info: "Returns to review carrying any adjusted confirmer, team, or assessment choices. The detour is drawn once in the offer cast, so the drawn return lands on the offer review — service and request reviews reach it as a screen branch and return to their own review in the app (same reuse convention as W4@confirm-request)." },
  "w3.submit": { l: "Make this offer", to: "screen:W1@queued", info: "Enqueues the commitment job; returns to the pool tab with an optimistic queued card (UX:212).", calls: ["createCommitment"], pendingSync: true },
  "w3.submit-support": { l: "Make this service offer", to: "screen:W1@support-queued", info: "Enqueues the SupportService offer and returns to the pool with its optimistic queued card; a recipient may take it up only after sync.", calls: ["createCommitment"], pendingSync: true },
  "w3.request-continue-what": { l: "Continue to amount", to: "screen:W3@request-howmuch-steward", info: "Season bound, title suggested — continues to chip-picked unit and amount. The drawn walk is the steward cast (5 steps, Support included); gardeners land on the 4-step variant in the library (iteration 2)." },
  "w3.request-continue-support": { l: "Continue to support", to: "screen:W3@request-support", info: "Steward-only: the Support step follows How much; gardeners' requests skip straight to who-can-take-it." },
  "w3.request-support-continue": { l: "Continue", to: "screen:W3@request-variant-steward", info: "Declared G$ support travels with the request record; nothing moves until the promise is confirmed kept (existing declared-consideration semantics, no chain change)." },
  "w3.request-continue-variant-steward": { l: "Continue to review", to: "screen:W3@request-review-steward", info: "Who-can-take-it → the steward review, which repeats the declared G$ support in its own section." },
  "w3.edit-request-support": { l: "Edit G$ support", to: "screen:W3@request-support", info: "Returns to the Support step with the declared amount kept." },
  "w3.request-choose-work": { l: "Choose Garden work", to: "screen:W3@request-work-what", info: "A DomainImpact Request — kind and direction are orthogonal on-chain (register #97). Choosing it re-renders the wizard as the four-step garden-work cast (register #97a): the ask gains action requirements and rides the Work-approval rails; the asker remains the confirmer." },
  "w3.request-work-continue-what": { l: "Continue to amount", to: "screen:W3@request-work-howmuch", info: "The garden-work ask's what — title suggested from the garden's actions — continues to chip-picked unit and amount; the dot row reads four steps from the first screen (register #97a)." },
  "w3.request-continue-work": { l: "Continue on the garden work path", to: "screen:W3@request-anchors", info: "The garden-work ask continues to its action requirements before review (register #97)." },
  "w3.request-continue-anchors": { l: "Continue to review", to: "screen:W3@request-work-review", info: "Requirements → review; who-confirms is already the asker with the pilot fallback behind them." },
  "w3.submit-work-request": { l: "Ask for this work", to: "screen:W1@request-work-queued", info: "Enqueues the DomainImpact Request with its requirement rows — same commitment job, request direction (register #97) — and returns to the pool tab with the optimistic queued card until CommitmentCreated syncs.", calls: ["createCommitment"], pendingSync: true },
  "w3.request-continue-howmuch": { l: "Continue", to: "screen:W3@request-variant", info: "Chip-picked unit and amount continue to the who-can-take-it choice — the ask's step 3 of 4 (2026-08-11: requests gained a real review step after it)." },
  "w3.submit-request": { l: "Make this request", to: "screen:W1@request-queued", info: "Enqueues the request job and returns to the same request cast while it syncs.", calls: ["createCommitment"], pendingSync: true },
  "w3.review-saved-offer": { l: "Review this offer", to: "screen:W3@saved-offer-review", info: "Carries the saved workshop details into the ordinary one-time Offer review without replacing them with the generic Garden work example." },
  "w3.edit-saved-offer": { l: "Edit this offer", to: "screen:W3@saved-offer-edit", info: "Returns to the fully editable prefilled fields. The private saved details remain unchanged unless the member separately saves them again." },
  "w3.submit-saved-offer": { l: "Make this offer", to: "screen:W3@saved-offer-queued", info: "Queues exactly one ordinary SupportService Offer with commitmentSeriesId == 0. No durable series or future place is created.", calls: ["createCommitment"], pendingSync: true },
  "w3.saved-offer-done": { l: "Back to my offers", to: "screen:W32@saved", info: "Returns to the private saved-details list without changing the separate queued one-time Offer job." },
  "w3.resume": { l: "Resume draft", to: "screen:W3@step-what", info: "Drafts persist locally (WorkDraftRecord semantics); re-entry offers resume (UX:160)." },
  "w3.start-fresh": { l: "Start fresh", to: "screen:W3@step-what", info: "Explicitly discards the saved local draft and starts from the first creation step." },
  "w3.add-action": { l: "Add an action", info: "Repeatable DomainImpact requirements: each row binds a registered action to a count ≥ 1, and domains are derived tags that may repeat. Four rows are visible initially; Add action continues to the measured MAX_REQUIREMENTS. Failed submits keep entered data and focus a concise error summary (UX:156 · WF:251 · UX:439)." },
  // ---- 2026-08-11 correction pass: composer additions ----
  "w3.add-details": { l: "Add details", to: "screen:W3@step-details", info: "Optional photos, a voice note, a written note, and links — pinned as the commitment-metadata JSON v1 document whose CID rides metadataCID (contract-spec addendum 2026-08-11). Creation metadata is write-once; anything added later rides evidence." },
  "w3.details-done": { l: "Done adding details", to: "screen:W3@step-what", info: "Returns to step 1 with the item count visible; the payload stays with the local draft until the promise sends." },
  "w3.capture-camera": { l: "Take a photo", info: "One-tap capture from the fixed bar — the Submit Work media interaction (uiux §5.4 addendum 2026-08-11)." },
  "w3.capture-gallery": { l: "Choose from your library", info: "Gallery pick, multiple allowed; HEIC conversion and compression follow the work flow's media pipeline." },
  "w3.capture-audio": { l: "Record a voice note", info: "Audio notes serialize like work-flow voice notes (SerializedFileData) and ride the same offline queue." },
  "w3.add-link": { l: "Add a link", info: "A page that shows the work or its context; stored in the metadata document's links array." },
  "w3.add-note": { l: "Write a note", info: "A few words from the field; stored in the metadata document's note field." },
  "w3.remove-detail": { l: "Remove this item", info: "Items can be removed until the promise sends; nothing uploads before then." },
  "w3.template": { l: "Start from a template", to: "screen:W31", info: "Prefill layer (Appendix E.2 as amended 2026-08-11): choosing a template only prefills these fields and returns here — the picker is no longer a gate before the form and never says “create a promise”." },
  "w3.pick-action": { l: "Add this action", info: "Tap-first action cards from the garden's own registry: tapping adds the action with count 1; tapping a chosen card changes its count — 1 · 2 · 4 · custom (2026-08-11 correction pass)." },
  "w3.edit-what": { l: "Edit what you're offering", to: "screen:W3@step-what", info: "Sectioned-review edit link — returns to step 1 with entries kept (Submit Work review anatomy, 2026-08-11)." },
  "w3.edit-howmuch": { l: "Edit how much", to: "screen:W3@step-howmuch", info: "Returns to step 2 with entries kept." },
  "w3.edit-anchors": { l: "Edit proof", to: "screen:W3@step-anchors", info: "Returns to the action picker with the chosen actions kept." },
  "w3.edit-support-howmuch": { l: "Edit service amount", to: "screen:W3@support-howmuch", info: "Returns to the service amount step with entries kept." },
  "w3.edit-request-what": { l: "Edit what you're asking", to: "screen:W3@request-what", info: "Returns to the ask's step 1 with entries kept." },
  "w3.edit-request-howmuch": { l: "Edit how much", to: "screen:W3@request-howmuch", info: "Returns to the ask's amount step with entries kept." },
  "w3.edit-request-variant": { l: "Edit who can take it", to: "screen:W3@request-variant", info: "Returns to the take-up choice with the selection kept." },
  "w3.edit-request-work-what": { l: "Edit what you're asking", to: "screen:W3@request-work-what", info: "Returns to the garden-work ask's step 1 with entries kept." },
  "w3.edit-request-work-howmuch": { l: "Edit how much", to: "screen:W3@request-work-howmuch", info: "Returns to the garden-work amount step with entries kept." },
  "w3.edit-request-anchors": { l: "Edit proof", to: "screen:W3@request-anchors", info: "Returns to the ask's requirements with the rows kept." },
  "w3.request-continue-variant": { l: "Continue to review", to: "screen:W3@request-review", info: "Who-can-take-it → the ask's sectioned review (requests gained a real review step, 2026-08-11)." },
  "w3.request-choose-service": { l: "Choose help or a service", to: "screen:W3@request-what", info: "Switches the ask back to the evidence-confirmed service cast; entered values are kept." },
  "w3.choose-ongoing": { l: "Choose Ongoing", to: "screen:W3@support-howmuch-ongoing", info: "Iteration 2: choosing Ongoing expands the SAME step inline — places to start and scope appear under How often; no detour wizard. One submission later runs the series creation plus its first place creations as an ordered queue sequence." },
  "w3.choose-once": { l: "Back to Just once", to: "screen:W3@support-howmuch", info: "Collapses the places block; the promise becomes one ordinary offer again." },
  "w3.continue-support-howmuch-ongoing": { l: "Continue", to: "screen:W3@support-review-ongoing", info: "Amount + places → the ongoing review, whose Places section repeats what will open." },
  "w3.edit-support-howmuch-ongoing": { l: "Edit amount & places", to: "screen:W3@support-howmuch-ongoing", info: "Returns to the expanded step with entries kept." },
  "w3.edit-places": { l: "Edit places", to: "screen:W3@support-howmuch-ongoing", info: "Places live on the same expanded step — no separate wizard." },
  "w3.submit-ongoing": { l: "Start this ongoing offer", to: "screen:W32@series-queued", info: "One ordered queue sequence: createCommitmentSeries, then the first place creations. The ongoing Offer appears pending in Things I can offer; places count as available only after their own creations sync and reserve capacity (Appendix F.2 as amended 2026-08-11).", calls: ["createCommitmentSeries", "createCommitment"], facts: { pool: "Open" }, pendingSync: true },
  "w3.invite": { l: "Invite contributors", to: "screen:W3@step-invite", info: "LeadManaged rosters can add people from creation; the picker mirrors addContributor semantics and becomes roster actions once the promise is accepted (D9, 2026-08-11). Open teams skip this — members join on their own." },
  "w3.invite-done": { l: "Add to the team", to: "screen:W3@step-advanced", info: "Returns to Advanced with the invited contributors carried; review repeats them under Who confirms & team." },
};

// ---------------------------------------------------------------------------
// W4 — confirmation sheet (uiux-spec §5.6)
// ---------------------------------------------------------------------------

const W4_STATES = [
  ["confirm-domain", "Garden work"], ["confirm-support", "Support / service"],
  ["confirm-request", "A request you asked for"], ["confirm-request-work", "A garden-work ask you made"],
  ["confirmed-pending-request-work", "Work ask · confirmation queued"],
  ["confirmed-request-work", "Work ask · confirmed"],
  ["confirm-campaign-request", "A Campaign request"],
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
  // The garden-work ask is a Request whose proof is approved Work, not evidence —
  // it keeps its own cast so confirmation never switches models at the last step.
  const requestWork = state.includes("request-work");
  const request = state.includes("request") && !campaignRequest && !requestWork;
  const support = state.includes("support");
  const captured = state.includes("captured");
  const cast: PromiseCast = campaignRequest ? "campaign-request" : requestWork ? "request-work" : request ? "request" : support ? "support" : captured ? "captured" : "offer";
  const evidenceOnly = request || campaignRequest || support || captured;
  const summary =
    cast === "request"
      ? `<div class="t-meta">Request · João provides · Ana asked for this and confirms it.</div>`
      : cast === "request-work"
        ? `<div class="t-meta">Garden-work ask · João did the work · Ana asked for this and confirms it.</div>`
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
    requestWork
      ? banner("João did the work, so João cannot confirm it — Ana, who asked, does. Not even a steward can confirm their own.", "stone", "shield-check-line")
      : request || campaignRequest
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
    case "confirm-request-work":
      title = "Was the work you asked for done?";
      inner = `${summary}${listRow({ icon: "check-line", primary: "Approved work", meta: "Weed × 2 · Mulch × 4 — all approved by the stewards" })}${meter(0, { left: "confirmations", right: "0 of 1" })}${exclusion}${hot("w4.confirm-request-work", btn("Confirm — the work was done", { kind: "pri", full: true }))}${hot("w4.not-yet-request-work", btn("Not yet", { kind: "sec", full: true }))}`;
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
      inner = `${reasonChips(
        request || campaignRequest ? ["It didn't arrive", "Only part of it arrived", "Something looks off"]
        : support ? ["Not finished yet", "Needs another pass", "Something looks off"]
        : captured ? ["It hasn't happened yet", "Can't check it yet", "Something looks off"]
        : ["Not finished yet", "Can't check it yet", "Something looks off"],
      )}${field("What still needs doing?", input(
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
    case "confirmed-pending-request-work":
    case "confirmed-pending-campaign-request":
    case "confirmed-pending-captured":
      title = "Confirmation saved";
      inner = `${meter(100, { left: "including this device", right: evidenceOnly ? "1 of 1 saved" : "3 of 3 saved" })}${listRow({ icon: "time-line", primary: "Your confirmation", chipHtml: chip("Waiting to send", "queued") })}${banner("Your confirmation is counted on this device. Fulfillment appears only after it syncs on-chain.", "stone", "wifi-off-line")}${hot(
        campaignRequest ? "w4.pending-campaign-request-done"
        : requestWork ? "w4.pending-request-work-done"
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
    case "confirmed-request-work":
    case "confirmed-campaign-request":
    case "confirmed-captured":
      title = "Promise kept";
      inner = `${hero(request || campaignRequest ? "Help arrived" : "Promise kept", support || campaignRequest ? "Confirmed · the Campaign's count just grew" : captured ? "Confirmed · the recorded promise is fulfilled" : "Confirmed · the season's count just grew", "checkbox-circle-fill")}${hot(
        campaignRequest ? "w4.done-campaign-request"
        : requestWork ? "w4.done-request-work"
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
  "w4.confirm-request-work": { l: "Confirm — the work was done", to: "screen:W4@confirmed-pending-request-work", info: "The asker confirms a DomainImpact Request whose proof was approved Work, not evidence; fulfillment appears only after sync (register #97a).", calls: ["confirmFulfillment"], pendingSync: true },
  "w4.not-yet-request-work": { l: "Not yet", to: "screen:W4@not-yet-request", info: "The same reason-required steward review as every other Not yet. The drawn landing reuses the evidence-only request fixture per the declared dispute-variant convention (prototypes-coverage §Presentation coverage) — the raiseDispute call and the ask's DomainImpact kind are unchanged in the app; only the drawn fixture is shared." },
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
  "w4.done-request-work": { l: "Back to the pool", to: "screen:W2@request-work-fulfilled", info: "Returns to the same garden-work ask after its fulfillment syncs — drainage cast to the end (register #97a)." },
  "w4.pending-request-work-done": { l: "Done", to: "screen:W2@request-work-confirmation-pending", info: "Returns to the garden-work ask with its queued confirmation visible and no duplicate submission action." },
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
  if (state === "composted") return { pool: "Composted", cycle: "Composted" };
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
  if (state === "funded-offer")
    return { pool: "Open", cycle: "Open", commitment: "Offered", kind: "SupportService", funding: "None" };
  if (["open", "create-open", "request-open", "request-queued", "request-work-open", "request-work-queued", "exchange-queued", "empty-open", "campaign-market", "campaign-tools", "queued", "support-queued", "sync-failed", "waiting-membership", "reviewing"].includes(state))
    return { pool: "Open", cycle: "Open" };
  return undefined;
};

const w2Facts = (state: W2State): StateFacts | undefined => {
  const kind: StateFacts["kind"] =
    W2_CAPTURED.has(state) ? "StewardCaptured"
    : W2_REQUEST.has(state) || W2_CAMPAIGN_REQUEST.has(state) || W2_SUPPORT.has(state) ? "SupportService"
    : "DomainImpact";
  const commitment: StateFacts["commitment"] =
    state === "offered" || state === "support-offered" || state === "withdraw-confirm" || state === "browse-offered" ? "Offered"
    : state === "requested" || state === "browse-requested" ? "Requested"
    : state === "active" || state === "evidence-queued" || state === "request-active" || state === "request-work-active" || state === "campaign-request-active" ||
      state === "request-evidence-queued" || state === "campaign-request-evidence-queued" ||
      state === "captured" || state === "captured-evidence-queued" ? "Active"
    : state === "evidence-submitted" || state === "request-evidence-submitted" ||
      state === "campaign-request-evidence-submitted" || state === "support-evidence-submitted" ||
      state === "captured-evidence-submitted" || state === "request-ready-pending" ||
      state === "campaign-request-ready-pending" || state === "support-ready-pending" ||
      state === "captured-ready-pending" ? "EvidenceSubmitted"
    : state === "partially-approved" || state === "request-work-partially-approved" ? "PartiallyApproved"
    : state === "ready-confirmer" || state === "confirmation-pending" ||
      state === "request-work-ready-confirmer" ||
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
    : state.includes("request-work") ? "DomainImpact"
    : state.includes("support") || state.includes("request") ? "SupportService"
    : "DomainImpact",
});

const w3Facts = (_state: W3State): StateFacts => ({ pool: "Open", cycle: "Open" });

const w2aFacts = (state: W2aState): StateFacts | undefined => {
  if (!state.startsWith("review")) return undefined; // attach calls live on the review step only
  return {
    pool: "Open",
    cycle: "Open",
    commitment: state === "review-support" ? "Accepted" : "Active",
    kind: state === "review" ? "DomainImpact" : state === "review-captured" ? "StewardCaptured" : "SupportService",
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
  ["saved-with-ongoing-ready", "Ongoing Offer · pool Ready"],
  ["series-queued", "Ongoing Offer queued"], ["series-queued-place-waiting", "Ongoing Offer and place queued"],
  ["empty", "Nothing yet"], ["compose", "Save offer details"],
  ["choose-path", "Once or over time"], ["draft-unsaved", "Unsaved draft"],
  ["saving", "Saving privately"], ["save-failed", "Save failed"],
  ["offline-local", "No signal — local only"], ["version-conflict", "Newer saved version"],
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
  // Drawn home (2026-08-11 D8a, uiux §5.8 addendum): this surface is a section
  // of the WalletDrawer's Commitments tab — the pool tab shows only the public
  // life of ongoing Offers.
  const intro = `<div class="t-meta">A section of your wallet's Commitments tab — private to you. Details you can reuse; nothing here is a promise until you offer it in a garden.</div>`;
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
          `<div class="t-meta">This stays a draft on this device until the private save is confirmed.</div>` +
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
    case "saving":
      body = `${head}${pagepad(
        intro,
        banner("Saving privately… Keep this app open while your account confirms the remote copy.", "stone", "loader4-line"),
        card(
          `${kv("Hosting climate workshops", "Draft retained on this device")}${kv("Remote status", "Waiting for confirmation")}`,
          { cls: "flat" },
        ),
        `<div class="t-meta">This is not called Saved until the owner-authenticated service confirms it.</div>`,
      )}`;
      break;
    case "save-failed":
      body = `${head}${pagepad(
        intro,
        banner("Save failed. This is still a draft on this device.", "error", "error-warning-line"),
        card(
          listRow({ icon: "sticky-note-line", primary: "Hosting climate workshops", meta: "Draft retained · nothing lost", chipHtml: chip("Not saved", "err") }),
          { cls: "flat" },
        ),
        `<div class="brow">${hot("w32.retry-save", btn("Try saving again", { kind: "pri", icon: "refresh-line" }))}${hot("w32.keep-editing", btn("Keep editing", { kind: "ghost" }))}</div>`,
      )}`;
      break;
    case "offline-local":
      body = `${head}${pagepad(
        intro,
        banner("No signal; this stays on this device. Nothing is queued as a private remote save.", "amber", "wifi-off-line"),
        card(
          listRow({ icon: "sticky-note-line", primary: "Hosting climate workshops", meta: "Draft on this device", chipHtml: chip("Offline · not saved", "warn") }),
          { cls: "flat" },
        ),
        hot("w32.use-local-offline", btn("Use this draft", { kind: "pri", full: true })),
        `<div class="brow">${hot("w32.retry-save-online", btn("Try when connected", { kind: "sec", icon: "refresh-line" }))}${hot("w32.keep-editing", btn("Keep editing", { kind: "ghost" }))}</div>`,
      )}`;
      break;
    case "version-conflict":
      body = `${head}${pagepad(
        intro,
        banner("A newer saved version exists. Your local edits are still on this device.", "amber", "refresh-line"),
        card(`${kv("Saved account copy", "newer")}${kv("This device", "local edits retained")}`, { cls: "flat" }),
        `<div class="brow">${hot("w32.reload-remote", btn("Use saved version", { kind: "pri" }))}${hot("w32.keep-local-copy", btn("Keep a local copy", { kind: "ghost" }))}</div>`,
        hot("w32.overwrite-current", btn("Replace the saved version…", { kind: "danger", full: true })),
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
    case "saved-with-ongoing-ready":
      body = `${head}${pagepad(
        intro,
        sectionTitle("Offered over time", chip("1", "plain")),
        card(offerRow({
          title: "Hosting climate workshops",
          meta: "Muizenberg Deep South · pool ready · no places available",
          tag: "Ongoing",
          tone: "offer",
          hotId: "w32.open-series-ready",
        }), { cls: "flat" }),
        banner("The ongoing Offer is active, but this pool has not opened. You can revise, rest, or retire it; places stay unavailable until stewards open the pool.", "stone", "information-line"),
        sectionTitle("Saved details", chip("1", "plain")),
        card(offerRow({ title: "Hosting climate workshops", meta: "A two-hour session on local climate work", tag: "Saved privately", tone: "plain", hotId: "w32.use-saved" }), { cls: "flat" }),
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
    offline: state === "draft-unsaved" || state === "offline-local" || state === "series-queued" || state === "series-queued-place-waiting",
    appBar: appBar("profile"),
  });
}

const W32_HOTS: HifiDef["hots"] = {
  "w32.add": { l: "Save offer details", to: "screen:W32@compose", info: "Saved Offer details are signed offchain profile data and reusable input to either path. Saving writes no pool, series, or commitment state." },
  "w32.add-first": { l: "Save offer details", to: "screen:W32@compose", info: "Empty-state entry into the same compose sheet." },
  "w32.save": { l: "Save privately", to: "screen:W32@saving", info: "Begins the authenticated remote write while retaining the local draft. Only the confirmed service response may enter Saved." },
  "w32.save-draft": { l: "Save privately", to: "screen:W32@saving", info: "Begins remote persistence. Until a confirmed response arrives, the draft cannot survive a device change." },
  "w32.retry-save": { l: "Try saving again", to: "screen:W32@saving", info: "Retries the owner-authenticated write from the retained local draft; it does not claim success optimistically." },
  "w32.retry-save-online": { l: "Try when connected", to: "screen:W32@saving", info: "Connectivity is rechecked before entering the remote-saving state." },
  "w32.use-local-offline": { l: "Use this draft", to: "screen:W32@choose-path", info: "Uses the local metadata without relabeling it Saved. A later series/commitment queue is separate from remote saved-Offer persistence." },
  "w32.keep-editing": { l: "Keep editing", to: "screen:W32@draft-unsaved", info: "Returns to the retained local draft without claiming it is saved." },
  "w32.reload-remote": { l: "Use saved version", to: "screen:W32@saved", info: "Loads the newer confirmed remote version and preserves no false merge claim." },
  "w32.keep-local-copy": { l: "Keep a local copy", to: "screen:W32@draft-unsaved", info: "Keeps these edits as a visibly unsaved device draft." },
  "w32.overwrite-current": { l: "Replace saved version", to: "screen:W32@saving", info: "Starts an explicit compare-and-swap write against the current remote version; success is still not assumed." },
  "w32.persistence": { l: "How saving works", to: "screen:W32@persistence", info: "Explains the honest difference between signed saved details and an unsaved local draft." },
  "w32.persistence-done": { l: "Got it", to: "screen:W32@draft-unsaved", info: "Dismisses the explanation and returns to the unsaved draft." },
  "w32.use-saved": { l: "Use these details", to: "screen:W32@choose-path", info: "Opens the once-or-over-time choice. Saved details are input to either path, never a separate product object." },
  "w32.offer-once": { l: "Offer it once", to: "screen:W3@saved-offer-edit", info: "Enters a prefilled ordinary creation flow that preserves the saved workshop details and produces one Offer with commitmentSeriesId == 0. Nothing durable is created." },
  "w32.offer-over-time": { l: "Offer it over time", to: "screen:W3@support-howmuch-ongoing", info: "Enters the composer with Ongoing already chosen, prefilled from these saved details (iteration 2 — the separate ongoing wizard is retired): places and scope sit inline on the amount step, and one submission runs the series creation plus its first place creations." },
  "w32.open-series": { l: "Open the ongoing offer", to: "screen:W34@active-two", info: "Opens the ongoing Offer — internally the pool-scoped CommitmentSeries — for an offer already made over time." },
  "w32.open-series-ready": { l: "Open the ongoing offer in a Ready pool", to: "screen:W34@pool-ready", info: "Preserves the selected Ready pool state after series sync. The detail exposes holder metadata/lifecycle controls but no Add-places path until the pool opens." },
  "w32.retry": { l: "Try again", to: "screen:W32@saved", info: "Re-reads signed offchain storage; nothing was lost by the failed read." },
};


const W34_STATES = [
  ["active-two", "Active · 2 places"], ["active-none", "Active · no places"], ["active-one", "Active · 1 place"],
  ["places-queued", "Active · 2 places queued"], ["places-partial", "Active · 1 available + 1 queued"],
  ["places-partial-failed", "Active · 1 available + 1 failed"],
  ["story", "Story"], ["participation", "Story vs pool history"], ["ask-again", "Next cycle"],
  ["claimant-view", "Seen by another member"],
  ["pool-ready", "Active · pool ready"], ["pool-paused", "Active · pool paused"], ["pool-closed", "Active · pool closed"],
  ["pool-composted", "Active · pool composted"],
  ["edit-active", "Edit · Active"], ["edit-active-none", "Edit · Active with no places"],
  ["edit-active-ready", "Edit · Active in Ready pool"],
  ["edit-resting", "Edit · Resting"], ["edit-resting-none", "Edit · Resting with no places"],
  ["edit-resting-ready", "Edit · Resting in Ready pool"],
  ["resting", "Resting"], ["resting-none", "Resting · no places"], ["resting-ready", "Resting · pool ready"],
  ["retire-confirm", "Retire — confirm"], ["retire-confirm-none", "Retire no-place Offer — confirm"],
  ["retire-confirm-resting", "Retire Resting — confirm"], ["retire-confirm-resting-none", "Retire Resting no-place Offer — confirm"],
  ["retire-confirm-ready", "Retire — confirm · pool ready"], ["retire-confirm-resting-ready", "Retire Resting — confirm · pool ready"],
  ["retired", "Retired"], ["retired-none", "Retired · no places"], ["retired-ready", "Retired · pool ready"],
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

const w34ActiveManagement = (pool: "Open" | "Ready", availability: "existing" | "none" = "existing") => {
  const ready = pool === "Ready";
  const noPlaces = availability === "none";
  return `${sectionTitle("Looking after this offer")}
${hot(ready ? "w34.edit-active-ready" : noPlaces ? "w34.edit-active-none" : "w34.edit-active", btn("Edit offer details", { kind: "ghost", full: true, icon: "sticky-note-line" }))}
<div class="brow">${hot(ready ? "w34.rest-ready" : noPlaces ? "w34.rest-none" : "w34.rest", btn("Rest it for now", { kind: "ghost", icon: "pause-line" }))}${hot(ready ? "w34.retire-ready" : noPlaces ? "w34.retire-none" : "w34.retire", btn("Retire it", { kind: "ghost" }))}</div>
${hot("w34.succession", btn("Sharing and handing on — later", { kind: "ghost", full: true, icon: "eye-line" }))}`;
};

const w34MetadataEditor = (state: "Active" | "Resting", pool: "Open" | "Ready", availability: "existing" | "none" = "existing") =>
  sheetOver(
    w34Head({ state: `${state}${pool === "Ready" ? " · pool ready" : ""}`, tone: state === "Active" ? "offer" : "plain" }) +
      pagepad(card(`${kv("Current description", "A two-hour session on local climate work")}${kv("Existing places", pool === "Ready" || availability === "none" ? "None" : "Keep their original snapshots")}`)),
    "Edit offer details",
    `${field("What people receive", input("A two-hour climate learning workshop"))}` +
      `${field("Unit", input("workshop sessions", { select: true }))}` +
      banner("This updates the ongoing Offer from now on. Every existing place keeps the exact title, terms, and metadata snapshot it was created with.", "stone", "information-line") +
      hot(
        state === "Active"
          ? pool === "Ready" ? "w34.save-edit-active-ready" : availability === "none" ? "w34.save-edit-active-none" : "w34.save-edit-active"
          : pool === "Ready" ? "w34.save-edit-resting-ready" : availability === "none" ? "w34.save-edit-resting-none" : "w34.save-edit-resting",
        btn("Save changes", { kind: "pri", full: true }),
      ),
  );

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
        w34ActiveManagement("Open", "none"),
      )}`;
      break;
    case "active-one":
      body = `${w34Head({ state: "Active", tone: "offer" })}${pagepad(
        banner("One place is available now. It is already an ordinary Offer with reserved capacity.", "green", "hand-heart-line"),
        w34Places(1),
        card(`${kv("Kept", "12 times across 5 cycles")}${kv("Available now", "1 place")}`),
        w34ActiveManagement("Open"),
      )}`;
      break;
    case "pool-ready":
      body = `${w34Head({ state: "Active · pool ready", tone: "plain" })}${pagepad(
        banner("This pool is ready but not open. Your ongoing Offer is active, while adding or taking up places stays unavailable until stewards open participation.", "stone", "information-line"),
        card(`<div class="t-title">No places available right now</div><div class="t-meta">No createCommitment job can be queued from this state. Opening the pool is a steward action.</div>`),
        card(`${kv("Kept", "12 times across 5 cycles")}${kv("Unit", "workshop sessions")}${kv("Pool", "Ready")}`),
        hot("w34.open-story", btn("See the whole story", { kind: "ghost", full: true })),
        w34ActiveManagement("Ready"),
      )}`;
      break;
    case "edit-active":
      body = w34MetadataEditor("Active", "Open");
      break;
    case "edit-active-none":
      body = w34MetadataEditor("Active", "Open", "none");
      break;
    case "edit-active-ready":
      body = w34MetadataEditor("Active", "Ready");
      break;
    case "edit-resting":
      body = w34MetadataEditor("Resting", "Open");
      break;
    case "edit-resting-none":
      body = w34MetadataEditor("Resting", "Open", "none");
      break;
    case "edit-resting-ready":
      body = w34MetadataEditor("Resting", "Ready");
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
            listRow({ icon: "calendar-line", primary: "Workshop session 2", meta: "Season of First Rains · waiting to send", chipHtml: chip("Queued", "queued") }),
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
            listRow({ icon: "calendar-line", primary: "Workshop session 2", meta: "Season of First Rains · send failed", chipHtml: chip("Send failed", "err") }),
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
        banner("This pool is composted for now. Its history remains readable, and its stewards may reopen it for another season.", "stone", "leaf-line"),
        card(`<div class="t-title num">Kept 12 times across 5 cycles</div><div class="t-meta">Past promises and evidence remain exactly as recorded. No place can be added or taken up.</div>`),
        hot("w34.open-story", btn("See the whole story", { kind: "ghost", full: true })),
        hot("w34.open-composted-pool", btn("View the composted pool", { kind: "ghost", full: true })),
      )}`;
      break;
    case "resting":
      body = `${w34Head({ state: "Resting", tone: "plain" })}${pagepad(
        banner("Resting since Aug 2. No new places can be added while it rests.", "stone", "pause-line"),
        card(
          `<div class="t-title">2 existing places remain available</div><div class="t-meta">Resting blocks only new places. These already-reserved Offers can still be taken up.</div>` +
            listRow({ icon: "calendar-line", primary: "Workshop session 1", meta: "Season of First Rains · 2 hours", chipHtml: stateChip("Offered") }) +
            listRow({ icon: "calendar-line", primary: "Workshop session 2", meta: "Season of First Rains · 2 hours", chipHtml: stateChip("Offered") }),
        ),
        card(`${kv("Kept", "12 times across 5 cycles")}${kv("Available now", "2 places")}${kv("Add places", "Paused while resting")}`),
        `<div class="brow">${hot("w34.resume", btn("Start offering again", { kind: "pri" }))}${hot("w34.open-story-resting", btn("See the story", { kind: "ghost" }))}</div>`,
        hot("w34.edit-resting", btn("Edit offer details", { kind: "ghost", full: true, icon: "sticky-note-line" })),
        hot("w34.retire-resting", btn("Retire it", { kind: "ghost", full: true })),
      )}`;
      break;
    case "resting-none":
      body = `${w34Head({ state: "Resting · no places", tone: "plain" })}${pagepad(
        banner("This ongoing Offer is resting. No place existed before it rested, and none was created to make this lifecycle change.", "stone", "pause-line"),
        card(`${kv("Kept", "12 times across 5 cycles")}${kv("Available now", "None")}${kv("Add places", "Paused while resting")}`),
        `<div class="brow">${hot("w34.resume-none", btn("Start offering again", { kind: "pri" }))}${hot("w34.open-story-resting", btn("See the story", { kind: "ghost" }))}</div>`,
        hot("w34.edit-resting-none", btn("Edit offer details", { kind: "ghost", full: true, icon: "sticky-note-line" })),
        hot("w34.retire-resting-none", btn("Retire it", { kind: "ghost", full: true })),
      )}`;
      break;
    case "resting-ready":
      body = `${w34Head({ state: "Resting · pool ready", tone: "plain" })}${pagepad(
        banner("This ongoing Offer is resting in a pool that is Ready but not Open. No places exist, and none can be added until both the series resumes and the pool opens.", "stone", "pause-line"),
        card(`${kv("Kept", "12 times across 5 cycles")}${kv("Available now", "None")}${kv("Pool", "Ready")}`),
        `<div class="brow">${hot("w34.resume-ready", btn("Start offering again", { kind: "pri" }))}${hot("w34.open-story-resting", btn("See the story", { kind: "ghost" }))}</div>`,
        hot("w34.edit-resting-ready", btn("Edit offer details", { kind: "ghost", full: true, icon: "sticky-note-line" })),
        hot("w34.retire-resting-ready", btn("Retire it", { kind: "ghost", full: true })),
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
    case "retire-confirm-none":
      body = sheetOver(
        w34Head({ state: "Active · no places", tone: "offer" }) + pagepad(card(`${kv("Kept", "12 times across 5 cycles")}${kv("Places", "None")}`)),
        "Retire this ongoing Offer?",
        `<div class="t-meta">Retiring is final. You do not need to create a place first.</div>` +
          card(
            `${kv("Places", "None were created")}${kv("This offer's story", "Stays exactly as it is")}${kv("Your saved details", "Stay saved privately to you")}`,
          ) +
          `<div class="brow">${hot("w34.retire-confirm-none", btn("Retire it", { kind: "danger" }))}${hot("w34.retire-cancel-none", btn("Keep it", { kind: "ghost" }))}</div>`,
      );
      break;
    case "retire-confirm-resting":
      body = sheetOver(
        w34Head({ state: "Resting", tone: "plain" }) + pagepad(card(`${kv("Kept", "12 times across 5 cycles")}${kv("Series", "Resting")}`)),
        "Retire this ongoing Offer?",
        `<div class="t-meta">Retiring is final. You do not need to resume or add a place first.</div>` +
          card(
            `${kv("Promises already made", "Keep their state and their history")}${kv("This offer's story", "Stays exactly as it is")}${kv("Your saved details", "Stay saved privately to you")}`,
          ) +
          `<div class="brow">${hot("w34.retire-confirm-resting", btn("Retire it", { kind: "danger" }))}${hot("w34.retire-cancel-resting", btn("Keep it resting", { kind: "ghost" }))}</div>`,
      );
      break;
    case "retire-confirm-resting-none":
      body = sheetOver(
        w34Head({ state: "Resting · no places", tone: "plain" }) + pagepad(card(`${kv("Kept", "12 times across 5 cycles")}${kv("Places", "None")}${kv("Series", "Resting")}`)),
        "Retire this ongoing Offer?",
        `<div class="t-meta">Retiring is final. You do not need to resume or create a place first.</div>` +
          card(
            `${kv("Places", "None were created")}${kv("This offer's story", "Stays exactly as it is")}${kv("Your saved details", "Stay saved privately to you")}`,
          ) +
          `<div class="brow">${hot("w34.retire-confirm-resting-none", btn("Retire it", { kind: "danger" }))}${hot("w34.retire-cancel-resting-none", btn("Keep it resting", { kind: "ghost" }))}</div>`,
      );
      break;
    case "retire-confirm-ready":
      body = sheetOver(
        w34Head({ state: "Active · pool ready", tone: "plain" }) + pagepad(card(`${kv("Kept", "12 times across 5 cycles")}${kv("Pool", "Ready")}`)),
        "Retire this ongoing Offer?",
        `<div class="t-meta">Retiring is final. Opening the pool later will not restart this ongoing Offer.</div>` +
          card(
            `${kv("Places", "None were created")}${kv("This offer's story", "Stays exactly as it is")}${kv("Your saved details", "Stay saved privately to you")}`,
          ) +
          `<div class="brow">${hot("w34.retire-confirm-ready", btn("Retire it", { kind: "danger" }))}${hot("w34.retire-cancel-ready", btn("Keep it", { kind: "ghost" }))}</div>`,
      );
      break;
    case "retire-confirm-resting-ready":
      body = sheetOver(
        w34Head({ state: "Resting · pool ready", tone: "plain" }) + pagepad(card(`${kv("Kept", "12 times across 5 cycles")}${kv("Pool", "Ready")}${kv("Series", "Resting")}`)),
        "Retire this ongoing Offer?",
        `<div class="t-meta">Retiring is final. You do not need to resume it or wait for the pool to open.</div>` +
          card(
            `${kv("Places", "None were created")}${kv("This offer's story", "Stays exactly as it is")}${kv("Your saved details", "Stay saved privately to you")}`,
          ) +
          `<div class="brow">${hot("w34.retire-confirm-resting-ready", btn("Retire it", { kind: "danger" }))}${hot("w34.retire-cancel-resting-ready", btn("Keep it resting", { kind: "ghost" }))}</div>`,
      );
      break;
    case "retired":
      body = `${w34Head({ state: "Retired", tone: "ink" })}${pagepad(
        banner("Retired on Aug 2. You cannot add places or start this ongoing Offer again.", "stone", "information-line"),
        card(
          `<div class="t-title">2 existing places remain available</div><div class="t-meta">Retirement changes only the ongoing Offer. These already-reserved Offers stay discoverable and claimable until each one is accepted, cancelled, or expires.</div>` +
            listRow({ icon: "calendar-line", primary: "Workshop session 1", meta: "Season of First Rains · 2 hours", chipHtml: stateChip("Offered") }) +
            listRow({ icon: "calendar-line", primary: "Workshop session 2", meta: "Season of First Rains · 2 hours", chipHtml: stateChip("Offered") }) +
            hot("w34.open-retired-place", btn("View an open place", { kind: "ghost", full: true })),
          { cls: "flat" },
        ),
        card(`<div class="t-title num">Kept 12 times across 5 cycles</div><div class="t-meta">The story stays here. Nothing that was already promised or kept has changed.</div>`),
        card(w34StoryTimeline(), { cls: "flat" }),
        `<div class="t-meta">Your saved details are still there. You can offer it in a garden again whenever you want to.</div>`,
      )}`;
      break;
    case "retired-none":
      body = `${w34Head({ state: "Retired · no places", tone: "ink" })}${pagepad(
        banner("Retired without opening a place. No capacity-reserving promise was required to end this ongoing Offer.", "stone", "information-line"),
        card(`<div class="t-title num">Kept 12 times across 5 cycles</div><div class="t-meta">The story and privately saved details remain available. No new place can be added to this retired ongoing Offer.</div>`),
      )}`;
      break;
    case "retired-ready":
      body = `${w34Head({ state: "Retired · pool ready", tone: "ink" })}${pagepad(
        banner("This ongoing Offer is retired. It will not add places if the pool opens later.", "stone", "information-line"),
        card(`<div class="t-title num">Kept 12 times across 5 cycles</div><div class="t-meta">Its story remains readable, and your privately saved details can still seed a separate Offer in the future.</div>`),
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
        w34ActiveManagement("Open"),
      )}`;
  }
  return phoneFrame(`${body}<div style="flex:1"></div>`, { offline: state === "places-queued", appBar: appBar("home") });
}

const W34_HOTS: HifiDef["hots"] = {
  "w34.add-places": { l: "Add places", to: "screen:W35@compose", info: "Opens the finite-batch place flow. Each place becomes one ordinary Offer instance that reserves provider capacity at creation." },
  "w34.open-story": { l: "See the whole story", to: "screen:W34@story", info: "Exact linked-instance history and absolute counts. Never a rate, rank, or comparison." },
  "w34.open-story-resting": { l: "See the story", to: "screen:W34@story", info: "Resting hides nothing: the story stays fully readable." },
  "w34.story-row": { l: "Open one kept promise", to: "screen:W2@fulfilled", info: "Every story row is an ordinary immutable Commitment with its own evidence and confirmation." },
  "w34.claim": { l: "Take up one place", to: "screen:W2@support-accepted", info: "Accepts one already-created Offered service instance. No new place is created, no second provider slot is consumed, and the instance stays Accepted until Work or evidence lands.", calls: ["claimCommitment"] },
  "w34.open-paused-pool": { l: "View the paused pool", to: "screen:W1@paused", info: "Shows the pool-level pause reason and steward-owned resume path. The series and existing instances remain intact, but Add and claim stay disabled." },
  "w34.open-closed-pool": { l: "View the closed pool", to: "screen:W1@closed", info: "Shows the closed pool state. Reopening is a steward action; the ongoing Offer detail does not fabricate a gardener write." },
  "w34.open-composted-pool": { l: "View the composted pool", to: "screen:W1@composted", info: "Shows the distinct Composted pool state. Participation is unavailable now, but current stewards may reopen the pool to Ready or Open without erasing history." },
  "w34.view-partial": { l: "View send details", to: "screen:W35@mixed-queued", info: "Shows the independently synced and queued place rows rather than treating the two jobs as an atomic batch." },
  "w34.retry-failed-place": { l: "Try failed place again", to: "screen:W34@places-partial", info: "Retries the same failed createCommitment job. The already-synced sibling stays available and is never re-submitted.", calls: ["createCommitment"], pendingSync: true },
  "w34.discard-failed-place": { l: "Discard failed place", to: "screen:W34@active-one", info: "Discards only the failed local job. The synced Offered sibling remains available with its reserved capacity." },
  "w34.edit-active": { l: "Edit active offer details", to: "screen:W34@edit-active", info: "Holder-only prospective metadata revision. Existing Offered and Accepted instance snapshots remain unchanged." },
  "w34.edit-active-none": { l: "Edit active offer details with no places", to: "screen:W34@edit-active-none", info: "Holder-only prospective metadata revision stays available even when the series has zero instances." },
  "w34.edit-active-ready": { l: "Edit active offer details in a Ready pool", to: "screen:W34@edit-active-ready", info: "Preserves the Ready pool state while allowing the holder to revise prospective series metadata." },
  "w34.save-edit-active": { l: "Save active offer details", to: "screen:W34@active-two", info: "Calls updateCommitmentSeriesMetadata. Only the current series description changes; every existing place retains its creation snapshot.", calls: ["updateCommitmentSeriesMetadata"] },
  "w34.save-edit-active-none": { l: "Save active offer details with no places", to: "screen:W34@active-none", info: "Calls updateCommitmentSeriesMetadata without creating a place or changing availability.", calls: ["updateCommitmentSeriesMetadata"] },
  "w34.save-edit-active-ready": { l: "Save active offer details in a Ready pool", to: "screen:W34@pool-ready", info: "Calls updateCommitmentSeriesMetadata without opening the pool or creating a place. The Ready state and historical snapshots remain unchanged.", calls: ["updateCommitmentSeriesMetadata"] },
  "w34.edit-resting": { l: "Edit resting offer details", to: "screen:W34@edit-resting", info: "A current holder may revise prospective metadata while Resting; existing instances keep their snapshots." },
  "w34.edit-resting-none": { l: "Edit resting offer details with no places", to: "screen:W34@edit-resting-none", info: "Prospective metadata remains editable while Resting even when the series has no instances." },
  "w34.edit-resting-ready": { l: "Edit resting offer details in a Ready pool", to: "screen:W34@edit-resting-ready", info: "Preserves both Resting series state and Ready pool state during the holder-only edit." },
  "w34.save-edit-resting": { l: "Save resting offer details", to: "screen:W34@resting", info: "Calls updateCommitmentSeriesMetadata while Resting. It does not resume the series or rewrite an instance.", calls: ["updateCommitmentSeriesMetadata"] },
  "w34.save-edit-resting-none": { l: "Save resting offer details with no places", to: "screen:W34@resting-none", info: "Calls updateCommitmentSeriesMetadata while preserving Resting and zero availability.", calls: ["updateCommitmentSeriesMetadata"] },
  "w34.save-edit-resting-ready": { l: "Save resting offer details in a Ready pool", to: "screen:W34@resting-ready", info: "Calls updateCommitmentSeriesMetadata while preserving Resting + Ready and every existing snapshot.", calls: ["updateCommitmentSeriesMetadata"] },
  "w34.rest": { l: "Rest it for now", to: "screen:W34@resting", info: "Blocks new places. Existing Offered and Accepted promises and the whole story are untouched.", calls: ["restCommitmentSeries"] },
  "w34.rest-none": { l: "Rest the no-place offer", to: "screen:W34@resting-none", info: "Active may become Resting independently of instance count; no createCommitment or capacity reservation occurs.", calls: ["restCommitmentSeries"] },
  "w34.rest-ready": { l: "Rest it for now in a Ready pool", to: "screen:W34@resting-ready", info: "Resting is independent of place count and pool opening. No capacity-reserving commitment is required first.", calls: ["restCommitmentSeries"] },
  "w34.resume": { l: "Start offering again", to: "screen:W34@active-two", info: "Returns the ongoing Offer to Active without changing its two existing Offered places or creating another one.", calls: ["resumeCommitmentSeries"] },
  "w34.resume-none": { l: "Resume the no-place offer", to: "screen:W34@active-none", info: "Returns the series to Active with zero places; resume creates no availability.", calls: ["resumeCommitmentSeries"] },
  "w34.resume-ready": { l: "Start offering again in a Ready pool", to: "screen:W34@pool-ready", info: "Returns the series to Active while the pool remains Ready. Add places stays unavailable until the pool opens.", calls: ["resumeCommitmentSeries"] },
  "w34.retire": { l: "Retire it", to: "screen:W34@retire-confirm", info: "Opens the terminal confirmation. Retiring takes no reason in the initial contract, so no reason field is drawn." },
  "w34.retire-none": { l: "Retire the no-place offer", to: "screen:W34@retire-confirm-none", info: "Opens the terminal confirmation without requiring a capacity-reserving place first." },
  "w34.retire-resting": { l: "Retire the resting offer", to: "screen:W34@retire-confirm-resting", info: "Resting may transition directly to Retired; no resume or new place is required." },
  "w34.retire-resting-none": { l: "Retire the resting no-place offer", to: "screen:W34@retire-confirm-resting-none", info: "Resting with zero instances may transition directly to Retired; no place is required." },
  "w34.retire-ready": { l: "Retire it in a Ready pool", to: "screen:W34@retire-confirm-ready", info: "Opens the Ready-preserving terminal confirmation without creating capacity." },
  "w34.retire-resting-ready": { l: "Retire the resting offer in a Ready pool", to: "screen:W34@retire-confirm-resting-ready", info: "Resting may transition directly to Retired while the pool remains Ready." },
  "w34.retire-confirm": { l: "Retire it", to: "screen:W34@retired", info: "Terminal. Existing instances keep their state and history; the saved details stay privately stored.", calls: ["retireCommitmentSeries"] },
  "w34.retire-confirm-none": { l: "Retire the no-place offer", to: "screen:W34@retired-none", info: "Terminal series transition with zero instances and no capacity reservation.", calls: ["retireCommitmentSeries"] },
  "w34.retire-confirm-resting": { l: "Retire the resting offer", to: "screen:W34@retired", info: "Calls retireCommitmentSeries from Resting. No resume or capacity-reserving commitment occurs.", calls: ["retireCommitmentSeries"] },
  "w34.retire-confirm-resting-none": { l: "Retire the resting no-place offer", to: "screen:W34@retired-none", info: "Calls retireCommitmentSeries from Resting with zero instances and no capacity reservation.", calls: ["retireCommitmentSeries"] },
  "w34.retire-confirm-ready": { l: "Retire it in a Ready pool", to: "screen:W34@retired-ready", info: "Terminal series transition with no place creation and no pool-state change.", calls: ["retireCommitmentSeries"] },
  "w34.retire-confirm-resting-ready": { l: "Retire the resting offer in a Ready pool", to: "screen:W34@retired-ready", info: "Calls retireCommitmentSeries from Resting while preserving the Ready pool state.", calls: ["retireCommitmentSeries"] },
  "w34.retire-cancel": { l: "Keep it", to: "screen:W34@active-two", info: "Dismisses the confirmation with no state change." },
  "w34.retire-cancel-none": { l: "Keep the no-place offer", to: "screen:W34@active-none", info: "Dismisses the confirmation and preserves Active with zero places." },
  "w34.retire-cancel-resting": { l: "Keep it resting", to: "screen:W34@resting", info: "Dismisses the confirmation and preserves Resting." },
  "w34.retire-cancel-resting-none": { l: "Keep the no-place offer resting", to: "screen:W34@resting-none", info: "Dismisses the confirmation and preserves Resting with zero places." },
  "w34.retire-cancel-ready": { l: "Keep it in the Ready pool", to: "screen:W34@pool-ready", info: "Dismisses the confirmation while preserving Active + Ready." },
  "w34.retire-cancel-resting-ready": { l: "Keep it resting in the Ready pool", to: "screen:W34@resting-ready", info: "Dismisses the confirmation and preserves Resting + Ready." },
  "w34.open-retired-place": { l: "View an open place", to: "screen:W2@support-offered", info: "Opens one surviving Offered instance. Retirement blocks only new series instances; ordinary claimant discovery and claim remain available while the pool is Open." },
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
        banner("One place sent. The other could not be sent. Retrying uses the same creationRequestKey, so it cannot reserve a second place.", "error", "error-warning-line"),
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
  "w35.submit": { l: "Add places", to: "screen:W35@queued", info: "Queues one ordinary createCommitment per place against the Active series. Each gets its own persisted clientCommitmentId and creationRequestKey before send; exact replay cannot create or reserve it twice.", calls: ["createCommitment"], pendingSync: true },
  "w35.queued-done": { l: "Back to this offer", to: "screen:W34@places-queued", info: "The two queued places remain visible but unavailable. Availability appears only after the place creations sync and their capacity is reserved." },
  "w35.mixed-queued-done": { l: "Back to this offer", to: "screen:W34@places-partial", info: "The ongoing Offer shows one real available place and one queued sibling." },
  "w35.retry-failed": { l: "Try failed place again", to: "screen:W35@mixed-queued", info: "Reads creator + creationRequestKey first, then retries only with the same creationRequestKey. A matching commitment completes; zero permits the same-key call; any payload mismatch stops. The synced Offered sibling is untouched.", calls: ["createCommitment"], pendingSync: true },
  "w35.discard-failed": { l: "Discard failed place", to: "screen:W34@active-one", info: "Discards only the failed local job. The synced place remains available." },
  "w35.mixed-failed-done": { l: "Back to this offer", to: "screen:W34@places-partial-failed", info: "The ongoing Offer preserves the synced place's availability and the failed sibling's recovery controls." },
};

const w32Facts = (state: W32State): StateFacts | undefined =>
  state === "saved-with-ongoing-ready" ? { pool: "Ready", series: "Active" } : undefined;

const w34Facts = (state: W34State): StateFacts | undefined => {
  if (state === "loading" || state === "read-error") return undefined;
  if (state === "resting-none" || state === "edit-resting-none" || state === "retire-confirm-resting-none")
    return { pool: "Open", series: "Resting" };
  if (state === "resting" || state === "edit-resting" || state === "retire-confirm-resting")
    return { pool: "Open", cycle: "Open", series: "Resting", commitment: "Offered", kind: "SupportService" };
  if (state === "resting-ready" || state === "edit-resting-ready" || state === "retire-confirm-resting-ready")
    return { pool: "Ready", series: "Resting" };
  if (state === "retired") return { pool: "Open", cycle: "Open", series: "Retired", commitment: "Offered", kind: "SupportService" };
  if (state === "retired-none") return { pool: "Open", series: "Retired" };
  if (state === "retired-ready") return { pool: "Ready", series: "Retired" };
  if (state === "retire-confirm") return { pool: "Open", cycle: "Open", series: "Active", commitment: "Offered", kind: "SupportService" };
  if (state === "edit-active-none" || state === "retire-confirm-none")
    return { pool: "Open", series: "Active" };
  if (state === "pool-ready" || state === "edit-active-ready" || state === "retire-confirm-ready")
    return { pool: "Ready", series: "Active" };
  if (state === "edit-active")
    return { pool: "Open", cycle: "Open", series: "Active", commitment: "Offered", kind: "SupportService" };
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
  { ...mk("W2a", "W2a · Evidence (Media → Details → Review)", [
    ["media", "1 · Media"], ["details", "2 · Details"],
    ["review", "3 · Review — garden work"], ["review-request", "3 · Review — a request"],
    ["review-campaign-request", "3 · Review — Campaign request"],
    ["review-support", "3 · Review — service offer"], ["review-captured", "3 · Review — recorded promise"],
    ["queued", "Queued"], ["failed", "Upload failed"],
  ] as const, w2a, w2aFacts), hots: W2A_HOTS },
  { ...mk("W3", "W3 · Offer/request creation", W3_STATES, w3, w3Facts), hots: W3_HOTS },
  { ...mk("W4", "W4 · Confirmation sheet", W4_STATES, w4, w4Facts), hots: W4_HOTS },
  { ...mk("W32", "W32 · Things I can offer", W32_STATES, w32, w32Facts), hots: W32_HOTS },
  { ...mk("W34", "W34 · Ongoing Offer detail", W34_STATES, w34, w34Facts), hots: W34_HOTS },
  { ...mk("W35", "W35 · Add places", W35_STATES, w35, w35Facts), hots: W35_HOTS },
];
