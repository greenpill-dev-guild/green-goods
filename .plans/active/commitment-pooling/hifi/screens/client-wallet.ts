// Client PWA hi-fi screens, wallet + protocol set — W5 WalletDrawer pools
// panel, W23 wallet G$ section, W25 protocol-pool claim, WFLOW (existing work
// flow + the MF-7 fulfills row). Same dialect and copy rules as client.ts.
// Dissolved lo-fi variants: W23G → W23@delivery-blocked, MF8 → W25@context-chooser.
// W6's retired home summary card lives on as the W5 header line (Decision Log #28f).

import { hot } from "../html";
import { icon } from "../icons";
import {
  actionBar, banner, btn, card, chip, disclosure, emptyState, field, flowHeader, formCard, formInfo, hdr, homeHeader, input, kv, listRow, mediaStack, mediaStrip, meter, offerRow, pagepad,
  filterChips, phoneFrame, commitmentCard, commitmentSlide, radio, reasonChips, sectionCard, sectionTitle, seg, selCard, selRail, sheetOver, sheetTabs, skeleton,
} from "../kit";
import type { HifiDef } from "./index";
import type { StateFacts } from "../types";

// ---------------------------------------------------------------------------
// W5 — WalletDrawer pools panel (uiux-spec §5.8; absorbs W6's summary line)
// ---------------------------------------------------------------------------

const W5_STATES = [
  ["default", "Live"], ["queued", "Live · queued rows"], ["waiting-membership", "Live · waiting rows"], ["send-failed", "Live · send failed"],
  ["empty", "Live · empty"], ["loading", "Live · loading"], ["not-found", "Live · not found"], ["read-error", "Live · read error"],
  ["overtime", "Over time"], ["overtime-empty", "Over time · nothing yet"], ["overtime-ready", "Over time · pool ready"],
  ["overtime-queued", "Over time · series queued"], ["overtime-queued-waiting", "Over time · series and first commitment queued"],
  ["overtime-loading", "Over time · loading"], ["overtime-read-error", "Over time · read error"],
  ["toconfirm", "To confirm (steward)"], ["toconfirm-empty", "To confirm · nothing waiting"],
  ["toconfirm-loading", "To confirm · loading"], ["toconfirm-read-error", "To confirm · read error"],
] as const;
type W5State = (typeof W5_STATES)[number][0];

// How many things need an act from you right now: 2 confirmations + 1 accepted
// ask + 1 commitment needing work. It badges the Home header control and the
// Commitments tab pill, so the two always agree.
const WAITING_ON_YOU = 4;

// The shipping WalletDrawer was a 3-tab ModalDrawer opened from the Home header
// — Cookies · Tokens · Commitments (views/Home/WalletDrawer/index.tsx:31-47).
//
// Commitments is no longer one of them (2026-08-17 round 40, Afo). Its two
// siblings are BALANCES: one fungible number each, no lifecycle, nothing
// waiting on you. A commitment is a relationship with a lifecycle — it needs
// scopes, per-garden grouping, an attention count, retry and discard recovery,
// and somewhere to keep the ongoing Offers and saved details that produce it.
// That was a screen wearing a tab, so it left for its own sheet and the wallet
// kept the two things that really are balances. Nothing shipped had to move:
// the Commitments tab renders ComingSoonStub today
// (views/Home/WalletDrawer/index.tsx:69).
const walletShell = (inner: string, active: 0 | 1) =>
  sheetOver(homeHeader({ commitments: WAITING_ON_YOU }), "Wallet", inner, {
    handle: false,
    close: true,
    sub: "Your jars and tokens.",
    tabs: sheetTabs(["Cookies", "Tokens"], active),
  });

// The commitments sheet — same ModalDrawer anatomy as the wallet, opened from
// its own Home header control. Round 40's tabs were the three objects a
// member holds; round 42 (2026-08-17, Afo) re-split them by TENSE, because
// tab 1's only truthful name was "Commitments", which echoed the sheet title
// — the wallet's own rule is that the container word and the object words are
// never the same ("Wallet" holds Cookies · Tokens):
//
//   Live       — everything still moving: in motion, queued, disputed,
//                waiting on someone. Grouped by garden. The chips inside are
//                DIRECTION (All · Offers · Requests), the pool tab's own
//                filter words, so the two surfaces are one grammar at two
//                scopes; what needs you leads the sort and drives the badge.
//                "Live" was rejected in round 39 because the tab held Kept;
//                the tense split removes Kept, and the objection with it.
//   Over time  — what is settled and standing: your record across gardens,
//                the series you keep offering ("Offered over time", the
//                composer's own phrase), and kept history. Not a list — the
//                standing view purpose 3 never had.
//   To confirm — steward Hats only, AUTHORITY confirmations only: garden
//                claims where the garden is the counterparty, and reasoned
//                fallbacks. Those reach you through your Hat and were never
//                in your personal ledger, so this tab creates no second copy
//                of anything (round 10 intact). Your own counterparty
//                confirmations stay in Live. This is the phone twin of the
//                admin Hub's confirm stage (uiux §6.9) for a field-first
//                product. Saved details left the sheet entirely — they are
//                input material, not a record, and live in creation now.
//
// Badges follow ONE rule so the two places a count appears can never
// disagree: a tab pill counts what needs an act ON THAT TAB, and the Home
// header control carries their sum (2026-08-17 round 41, Afo). Never an
// inventory count — that is engagement counting, which the regenerative lens
// rules out (review-checklist Lens 1.5).
type TabBadges = Partial<Record<0 | 1 | 2, number>>;

const commitmentsShell = (
  inner: string,
  active: 0 | 1 | 2,
  opts: { segHot?: string; badges?: TabBadges; steward?: boolean } = {},
) => {
  const badges = opts.badges ?? {};
  const total = (badges[0] ?? 0) + (badges[1] ?? 0) + (badges[2] ?? 0);
  const rail = sheetTabs(opts.steward ? ["Live", "Over time", "To confirm"] : ["Live", "Over time"], active, { badges });
  // Title, subtitle and rail are FIXED chrome; only the list below them moves
  // (2026-08-17 round 43, Afo). The direction chips scroll with the list they
  // filter, which is where the pool tab already puts them.
  return sheetOver(homeHeader({ commitments: total || undefined, walletHot: "w5.open-wallet" }), "Commitments", inner, {
    handle: false,
    close: true,
    sub: "What you've offered, asked for, and taken up across gardens.",
    tabs: opts.segHot ? hot(opts.segHot, rail) : rail,
  });
};

function w5(state: W5State): string {
  let inner: string;
  switch (state) {
    case "queued":
      inner = `${sectionTitle("My commitments")}
${card(
        listRow({ icon: "seedling-line", primary: "Compost workshop", meta: "Rocinha · Offered", chipHtml: chip("Queued", "queued") }) +
          listRow({ icon: "seedling-line", primary: "Ride to market", meta: "Rocinha · Accepted", chevron: true }),
        { cls: "flat" },
      )}
${banner("Queued commitments send when you're back online.", "stone", "wifi-off-line")}`;
      break;
    case "waiting-membership":
      inner = `${sectionTitle("My commitments")}
${card(
        listRow({ icon: "seedling-line", primary: "Compost workshop", meta: "Rocinha · Offered", chipHtml: chip("Waiting", "queued") }),
        { cls: "flat" },
      )}
${banner("Waiting for your garden membership. It will send once you are welcomed in, without using any attempts.", "stone", "time-line")}`;
      break;
    case "send-failed":
      // Failed sends are actionable from the wallet too (2026-08-14 second
      // pass, Afo) — same retry/discard contract as the pool tab (UX:218),
      // one attention surface for every garden's stuck commitment.
      inner = `${sectionTitle("Waiting on you")}
${card(
        listRow({ icon: "seedling-line", primary: "Compost workshop", meta: "Rocinha · did not send after five attempts", chipHtml: chip("Couldn't send", "err") }) +
          `<div class="brow">${hot("w5.retry-send", btn("Retry", { kind: "sec", sm: true }))}${hot("w5.discard-send", btn("Discard", { kind: "ghost", sm: true }))}</div>`,
        { cls: "flat" },
      )}
${banner("This commitment did not send after five attempts. Retry it, or discard the local copy. Nothing else is affected.", "amber", "error-warning-line")}`;
      break;
    // ---- Over time tab --------------------------------------------------
    // Not a list — the standing view (round 42). It opens with your record,
    // then the series you keep offering, then kept history. The record is
    // numerator-only in C.26's sense, per garden and per unit basis, never a
    // cross-basis sum (Appendix D.1); your own lapsed count is visible here
    // because D.3 scopes per-person rows to steward and self, and this is
    // self.
    case "overtime":
      inner = `${card(
        `<div class="t-title">Your record</div><div class="t-meta">Since March, across 3 gardens.</div>` +
          kv("Rocinha Community Garden", "5 kept · 1 lapsed · 12 hours given") +
          kv("Awka Hub", "3 kept · 4 rides") +
          kv("Muizenberg", "1 kept · 2 hours"),
      )}
<div class="t-meta">Counts stay in their own units. Lapsed counts show only to you and your stewards.</div>
${sectionTitle("Offered over time", chip("2", "plain"))}
${card(
        offerRow({ title: "Hosting climate workshops", meta: "Rocinha Community Garden · 2 open · 1 taken up", tag: "Active", tone: "offer", hotId: "w5.open-series" }) +
          offerRow({ title: "Weekly tool repair", meta: "Awka Hub · stopped · nothing open", tag: "Stopped", tone: "plain", hotId: "w5.open-series-stopped" }),
        { cls: "flat" },
      )}
${hot("w5.offer-over-time", btn("Offer Something Over Time", { kind: "ghost", full: true, icon: "add-line" }))}
${sectionTitle("Kept", chip("Recent", "plain"))}
${sectionCard(
        "Muizenberg",
        hot("w5.kept-row", commitmentCard({ title: "Beach cleanup Saturday", meta: "2 hours · Jul 12", tags: [{ label: "Kept", tone: "ok" }], media: { label: "photo", tint: "waste", photo: 3 } })),
        { flush: true },
      )}
${sectionCard(
        "Rocinha Community Garden",
        commitmentCard({ title: "Compost workshop", meta: "3 hours · Jun 28", tags: [{ label: "Kept", tone: "ok" }] }),
        { flush: true },
      )}`;
      break;
    case "overtime-empty":
      inner = emptyState(
        "seedling-line",
        "Nothing here yet",
        "When your commitments are kept, your record grows here. Offer something over time and its whole story stays together too.",
        hot("w5.offer-over-time", btn("Offer Something Over Time", { kind: "sec", icon: "add-line" })),
      );
      break;
    case "overtime-ready":
      inner = `${sectionTitle("Offered over time", chip("1", "plain"))}
${card(
        offerRow({ title: "Hosting climate workshops", meta: "Muizenberg Deep South · pool ready · nothing open", tag: "Active", tone: "offer", hotId: "w5.open-series-ready" }),
        { cls: "flat" },
      )}
${banner("The ongoing Offer is active, but this pool has not opened. You can edit it or stop offering; nothing can open until stewards open the pool.", "stone", "information-line")}`;
      break;
    // A queued series is still the standing thing's home state, not a Live
    // row: its home is this tab whatever its sync state, and the tab's pill
    // carries the count per the round-41 badge rule.
    case "overtime-queued":
      inner = `${sectionTitle("Waiting to send", chip("1", "plain"))}
${card(
        offerRow({ title: "Hosting climate workshops", meta: "Rocinha Community Garden · nothing open", tag: "Queued", tone: "plain" }),
        { cls: "flat" },
      )}
${banner("This ongoing Offer is queued. It is not Active and nobody can take anything up yet.", "amber", "time-line")}`;
      break;
    case "overtime-queued-waiting":
      inner = `${sectionTitle("Waiting to send", chip("2", "plain"))}
${card(
        offerRow({ title: "Hosting climate workshops", meta: "Rocinha Community Garden · ongoing Offer", tag: "Queued", tone: "plain" }) +
          offerRow({ title: "1 workshop session", meta: "Waiting for the ongoing Offer to send first", tag: "Waiting", tone: "plain" }),
        { cls: "flat" },
      )}
${banner("Nothing is available to take up until the ongoing Offer and its first commitment have both sent, in that order.", "amber", "time-line")}`;
      break;
    // Each tab reads from its own source, so each carries its own recovery in
    // its own words (2026-08-17 round 41, Afo). Sharing tab 0's cast is what
    // the round-40 aliases accidentally did: a deep link to one tab's read
    // error rendered "Couldn't load your commitments" over the ledger.
    case "overtime-loading":
      inner = `${skeleton({ title: true, lines: 2 })}${skeleton({ title: true, lines: 1, cls: "flat" })}${skeleton({ avatar: true, lines: 2 })}`;
      break;
    case "overtime-read-error":
      inner = emptyState(
        "wifi-off-line",
        "Couldn't load your record",
        "Your record, your ongoing Offers, and everything kept are safe. This device could not reach them just now.",
        hot("w5.retry-overtime", btn("Try Again", { kind: "pri", icon: "refresh-line" })),
      );
      break;
    // ---- To confirm tab (steward Hats only) ------------------------------
    // Authority confirmations only: garden claims where the garden is the
    // counterparty (its steward/owner Hat wearers are the ordinary confirmers,
    // CS:1421) and reasoned fallbacks. These reach you through your Hat and
    // were never in your personal ledger, so nothing here duplicates a Live
    // row (round 10 intact). Counterparty confirmations stay in Live. This is
    // the admin Hub confirm stage's phone twin (uiux §6.9) — the field case,
    // where the steward is standing in the garden.
    case "toconfirm":
      inner = `<div class="t-meta">These reach you as a steward of your gardens, not as a counterparty. Confirmations on your own commitments stay in Live.</div>
${sectionCard(
        "Rocinha Community Garden",
        `${hot("w5.confirm-claim", commitmentCard({ title: "Compost delivery to the beds", meta: "Rosa took this up · the garden confirms", tags: [{ label: "Ready to confirm", tone: "warn" }, { label: "Garden claim" }], media: { label: "photo", tint: "agro", photo: 0 } }))}${hot(
          "w5.confirm-captured",
          commitmentCard({ title: "Field day recorded for Tunde", meta: "Recorded on Tunde's behalf", tags: [{ label: "Ready to confirm", tone: "warn" }, { label: "Recorded" }] }),
        )}`,
        { flush: true },
      )}
${sectionCard(
        "Awka Hub",
        hot("w5.confirm-fallback", commitmentCard({ title: "Path repair", meta: "Maria offered · nobody else can confirm", tags: [{ label: "Needs a reason", tone: "warn" }, { label: "Steward fallback" }] })),
        { flush: true },
      )}
${banner("A fallback confirmation always records a reason, and nobody can confirm their own work, stewards included.", "stone", "shield-check-line")}`;
      break;
    case "toconfirm-empty":
      inner = emptyState(
        "shield-check-line",
        "Nothing waiting for the garden",
        "When a member takes up something the garden offered, or a commitment needs a steward to step in, it shows here.",
      );
      break;
    case "toconfirm-loading":
      inner = `${skeleton({ title: true, lines: 1, cls: "flat" })}${skeleton({ avatar: true, lines: 2 })}`;
      break;
    case "toconfirm-read-error":
      inner = emptyState(
        "wifi-off-line",
        "Couldn't load the garden's queue",
        "Nothing waiting was lost. This device could not reach the network just now, and confirming needs a connection anyway.",
        hot("w5.retry-toconfirm", btn("Try Again", { kind: "pri", icon: "refresh-line" })),
      );
      break;
    // ---- Commitments tab, recovery casts --------------------------------
    // The icon is always in the Home header, so this empty state is also the
    // first thing a member of a garden with no pooling sees. It has to read
    // as an invitation rather than as a failure.
    case "empty":
      inner = emptyState(
        "hand-heart-line",
        "No commitments yet",
        "A commitment is something you offer a garden, or something you take up that another member offered. When you make your first one, it shows here.",
        hot("w5.browse-gardens", btn("Browse Gardens", { kind: "sec" })),
      );
      break;
    case "loading":
      inner = `${skeleton({ title: true, lines: 1, cls: "flat" })}${skeleton({ avatar: true, lines: 2 })}${skeleton({ avatar: true, lines: 2 })}`;
      break;
    case "not-found":
      inner = emptyState("search-line", "No commitments found", "We couldn't find your commitments across gardens. They may still be syncing to this device. Try again in a moment.", hot("w5.retry", btn("Try Again", { kind: "sec", icon: "refresh-line" })));
      break;
    case "read-error":
      inner = emptyState("wifi-off-line", "Couldn't load your commitments", "Something went wrong reaching the network. Your last view is saved on this device.", hot("w5.retry", btn("Try Again", { kind: "pri", icon: "refresh-line" })));
      break;
    default:
      // The wallet now draws the SAME commitment card as the pool tab (2026-08-16
      // round 9, Afo — "right now they're too different"). Two swaps carry the
      // change of scope: the garden name takes the slot the creator held, since
      // in your own ledger you already know it is yours and what you need is
      // where; and the lifecycle state leads the tag row.
      //
      // The "N of M commitments kept this cycle in <garden>" line above this list
      // is gone. It read as though a member belonged to one garden, and sat
      // directly above a disclosure that said "3 across 2 gardens".
      // ONE ledger with scopes, not an attention inbox above a "My commitments"
      // drawer (2026-08-16 round 10, Afo). The two overlapped — Ride to market
      // and Mulch the pathways appeared in both — which the drawer hid. Each
      // commitment now appears exactly once, in its garden, and "Waiting on you"
      // becomes a filter over the same list rather than a second copy of part
      // of it. Same grammar as the pool tab's commitment scopes.
      //
      // Live holds exactly one kind of thing: commitments still moving, each
      // appearing once, under the garden it belongs to. Kept and lapsed left
      // for Over time with the round-42 tense split, which collapsed the
      // lifecycle chips (All · Waiting on you · Active · Kept) down to
      // DIRECTION — the pool tab's own filter words (client.ts:644), so the
      // garden surface and the personal sheet are one grammar at two scopes.
      // What needs you is not a chip: it leads the sort inside each garden,
      // carries the warn chips, and drives the tab's badge.
      inner = `${filterChips(
        [
          { label: "All", on: true, hotId: "w5.dir-all" },
          { label: "Offers", hotId: "w5.dir-offers" },
          { label: "Requests", hotId: "w5.dir-requests" },
        ],
        "Direction",
      )}
${sectionCard(
        "Rocinha Community Garden",
        `${hot("w5.inbox-row", commitmentCard({ title: "Prune the north beds", meta: "Maria · 6 hours · confirm when kept", tags: [{ label: "Ready to confirm", tone: "warn" }], media: { label: "photo", tint: "agro" , photo: 1 } }))}${hot(
          "w5.accepted-row",
          commitmentCard({ title: "Ride to market", meta: "João is on it · 1 ride", tags: [{ label: "Accepted", tone: "request" }, { label: "Your ask" }] }),
        )}${hot(
          "w5.needs-work-row",
          commitmentCard({ title: "Mulch the pathways", meta: "0 of 3 Mulch approved", tags: [{ label: "Active" }, { label: "Needs your work", tone: "warn" }], media: { label: "photo", tint: "agro" , photo: 2 } }),
        )}${hot(
          // The member's own service commitment, picked back up days after offering
          // it (sb56) — the wallet is where you return to something you promised.
          "w5.mine-row",
          commitmentCard({ title: "Repair tool handles", meta: "1 repair session · yours", tags: [{ label: "Accepted", tone: "request" }, { label: "A service" }] }),
        )}${hot(
          // Money in flight belongs in Live, not Over time: the commitment is
          // Fulfilled but something is still moving, and the tense split
          // partitions by motion rather than by lifecycle. No W5 state mentioned
          // money at all before this, so two journeys opened on this sheet and
          // then jumped somewhere it does not lead. It needs no act from the
          // member, so it takes no warn chip and adds nothing to the badge.
          "w5.support-row",
          commitmentCard({
            title: "Fix the shed roof",
            meta: "8 hours · kept Jul 12",
            tags: [{ label: "Kept", tone: "ok" }, { label: "On its way", tone: "queued" }],
            note: "Support on its way. You will see it here when it arrives.",
          }),
        )}${hot(
          // A commitment frozen for steward review. Saying "not yet" used to send
          // it somewhere the member had no way to watch, which is where sb5
          // ended. Nothing to do here either, so no warn chip and no badge.
          "w5.review-row",
          commitmentCard({
            title: "Weed the terrace beds",
            meta: "You said not yet · Jul 10",
            tags: [{ label: "Under review", tone: "queued" }],
            note: "Stewards are looking at this. Nothing for you to do until they finish.",
          }),
        )}`,
        { flush: true },
      )}
${sectionCard(
        "Awka Hub",
        commitmentCard({ title: "Field survey ride", meta: "TAS Hub · confirm when kept", tags: [{ label: "Ready to confirm", tone: "warn" }] }),
        { flush: true },
      )}`;
  }
  // The shipping AppBar hides while any drawer is open (AppBar.tsx:33).
  // The badge counts the attention inbox (2 confirmations + 1 accepted ask +
  // 1 commitment needing work) and rides both the Home header control and the
  // Commitments pill, so the two never disagree. Read-recovery and empty casts
  // draw no count on either.
  const tab: 0 | 1 | 2 = state.startsWith("overtime") ? 1 : state.startsWith("toconfirm") ? 2 : 0;
  // Live's pill counts the attention inbox, and goes quiet in the casts where
  // the ledger itself could not be read or holds nothing.
  const quiet = state === "empty" || state === "loading" || state === "not-found" || state === "read-error";
  const badges: TabBadges = { 0: quiet ? undefined : WAITING_ON_YOU };
  if (state === "overtime-queued") badges[1] = 1;
  if (state === "overtime-queued-waiting") badges[1] = 2;
  if (state === "toconfirm") badges[2] = 3;
  // The To confirm tab exists only for steward Hat wearers; every other state
  // renders the member chrome, so the two shapes of the sheet are both drawn.
  const steward = tab === 2;
  return phoneFrame(commitmentsShell(inner, tab, { segHot: "w5.seg", badges, steward }), {
    offline:
      state === "queued" || state === "send-failed" || state === "read-error" ||
      state === "overtime-queued" || state === "overtime-queued-waiting" || state === "overtime-read-error" ||
      state === "toconfirm-read-error",
    appBar: false,
  });
}

const W5_HOTS: HifiDef["hots"] = {
  "w5.dir-all": { l: "All directions", info: "Every live commitment, grouped by garden. Filters filter this one list rather than drawing a second copy of part of it (round 10). What needs you is not a chip: it leads the sort and drives the badge." },
  "w5.dir-offers": { l: "Offers", info: "Live commitments where you are giving — the pool tab's own filter word (client.ts:644), so the garden surface and this sheet share one grammar at two scopes. The direction split was Afo's instinct in round 41; it belonged at chip level, not tab level, because a confirmation duty can sit on either direction." },
  "w5.dir-requests": { l: "Requests", info: "Live commitments where you asked. Same pool-tab grammar." },
  "w5.seg": { l: "Commitments tabs", info: "The round-42 tense split: Live holds everything still moving, Over time holds what is settled and standing. Both names are truthful and neither echoes the sheet title — the wallet's own rule, where the container word (Wallet) never repeats an object word (Cookies · Tokens). Steward Hat wearers see a third tab, To confirm, holding only the duties that reach them through the Hat. Commitments left the wallet in round 40: its siblings there were balances, and a commitment is a relationship with a lifecycle." },
  "w5.inbox-row": { l: "Pending confirmation", to: "screen:W4", info: "Inbox of commitments waiting on YOUR confirmation, across gardens (UX:185)." },
  "w5.accepted-row": { l: "Accepted ask", to: "screen:W2@request-active", info: "The attention inbox widened past confirmations (2026-08-14): a newly accepted ask surfaces here so the asker opens it without hunting the ledger below. Queued and failed sends keep their §5.8 item-4 chrome at the top of their own group." },
  "w5.needs-work-row": { l: "Your commitment needs work", to: "screen:W2@active", info: "The ambient layer of standing attribution (2026-08-14): a commitment needing your work is a waiting-on-you item — arguably the biggest — so it stands in the inbox and counts in the Commitments badge. Opens the commitment, whose bar act is Submit work (the scoped intro)." },
  "w5.retry-send": { l: "Retry failed send", to: "screen:W5@queued", info: "Wallet-side recovery (2026-08-14 second pass): resets the exhausted job to pending and retries without dropping the local commitment — the same UX:218 contract as the pool tab, reachable from any garden." },
  "w5.discard-send": { l: "Discard failed send", to: "screen:W5", info: "Removes only the exhausted local job after an explicit member choice; no remote commitment exists yet (UX:218)." },
  "w5.mine-row": { l: "My commitment", to: "screen:W2", info: "Your own commitments grouped by garden." },
  "w5.open-wallet": { l: "Open the wallet", to: "screen:W23", info: "The Home header's wallet control, which is the real door in the shipping app. Nothing else in the artifact reached W23: its five hotspots all originated inside it, so the G$ balance was drawn and unreachable, and sb53 opened on this sheet and then jumped there with no control between. The other three header controls stay inert preview chrome." },
  "w5.support-row": { l: "Support on its way", to: "screen:W2@support-queued", info: "Money in flight lives in Live because something is still moving, even though the commitment is already Fulfilled. The row carries no warn chip and no badge weight: nothing here needs an act, and the badge counts only what does (round 41). Support states live on the commitment itself; this sheet is where you notice them, which is what sb11's own premise claimed and nothing drew." },
  "w5.review-row": { l: "Under review by stewards", to: "screen:W2@disputed", info: "A commitment frozen for steward review. Actions pause, so it takes no warn chip and no badge weight: the member's part is over until the stewards act. Without this row, saying \u201cnot yet\u201d handed a commitment to somebody else and left the person who raised it nowhere to watch." },
  "w5.open-series": { l: "Open the ongoing Offer", to: "screen:W34@active-two", info: "The ongoing Offer's parent — internally the pool-scoped CommitmentSeries. What it opens is public and lives on the pool tab; the parent is what only you edit or stop. The row counts commitments — one basis, never a unit sum (Appendix D.1)." },
  "w5.open-series-stopped": { l: "Open a stopped ongoing Offer", to: "screen:W34@active-none", info: "Stopping a series means it opens nothing more. Whatever members already took up carries on untouched, which is why this is a control on the parent and never a change to its children (C.27: one control, not two)." },
  "w5.open-series-ready": { l: "Open the ongoing Offer in a Ready pool", to: "screen:W34@pool-ready", info: "A series can be Active while its pool has not opened. The parent's controls all work; nothing can be taken up until stewards open the pool." },
  "w5.kept-row": { l: "A kept commitment", to: "screen:W2@fulfilled", info: "Kept history lives on Over time with the round-42 tense split: a finished commitment is part of your record, not something still moving. Each item appears once — the split is a partition, never a second copy (round 10)." },
  "w5.browse-gardens": { l: "Browse gardens", to: "screen:W1", info: "The commitments control is always in the Home header, so this empty state is also what a member of a garden without pooling sees. It has to offer a way in rather than only explain the absence." },
  "w5.offer-over-time": { l: "Offer something over time", to: "screen:W3@step-what", info: "Over time's own act, present whether or not the tab already holds a series (2026-08-17 round 41, Afo) — it used to appear only in the empty cast, so the tab stopped helping the moment you had one. Enters the composer at step 1 with Ongoing chosen, since an ongoing Offer has to name the cycle it runs in. Saved details live in that same composer step now, so starting from one is the step's first choice rather than a separate surface." },
  "w5.retry-overtime": { l: "Try again", info: "Read recovery for Over time, in its own words. Round 40's aliases had pointed one tab's read error at another's cast, so the copy named the wrong thing; each tab carries its own since round 41." },
  "w5.confirm-claim": { l: "Confirm a garden claim", to: "screen:W4@confirm-support", info: "The garden is this commitment's counterparty, so its steward and owner Hat wearers are the ORDINARY confirmers (CS:1421) — no fallback language. This duty reaches you through your Hat and was never in your personal ledger, which is why the tab creates no second copy of a Live row." },
  "w5.confirm-captured": { l: "Confirm a recorded commitment", to: "screen:W4@confirm-captured", info: "A commitment a steward recorded on a member's behalf, reaching its confirmation. Same sheet the counterparty path uses; the record names the member as the source and the steward as metadata (uiux §5.9)." },
  "w5.confirm-fallback": { l: "Step in as steward", to: "screen:W2@ready-confirmer", info: "The reasoned fallback: available only while the ordinary path is unreachable after contributor exclusion, always with a required reason, and never for a commitment where the steward is a contributor (CS:1422). The timeline will say “confirmed by garden steward — fallback”, not an ordinary confirmation." },
  "w5.retry-toconfirm": { l: "Try again", info: "Read recovery for the steward queue. Confirming itself stays online-only (uiux §5.9), so this cast says so rather than implying an offline path exists." },
  "w5.retry": { l: "Try again", info: "Read-surface recovery for the Live ledger — loading / not-found / read-error, never a “None” chip (UX:51-52 · AM:12). Each tab carries its own since round 41." },
};

// ---------------------------------------------------------------------------
// W23 — wallet G$ section + send (settlement-spec §7; W23G dissolved)
// ---------------------------------------------------------------------------

const W23_STATES = [
  ["balance", "Support received"], ["contributor-receipt", "Contributor receipt"], ["send", "Send"], ["send-pending", "Sending"], ["send-failed", "Send failed"], ["delivery-blocked", "Delivery blocked"],
] as const;
type W23State = (typeof W23_STATES)[number][0];

function w23(state: W23State): string {
  let inner: string;
  switch (state) {
    case "contributor-receipt":
      inner = `${card(
        `<div class="cardrow">${chip("Arrived", "ok", { dot: true })}<div class="grow"></div><div class="t-title num">+140 G$</div></div>
<div class="t-title">Prune the north beds</div>
${kv("Paid by", "Rocinha garden Safe")}${kv("Your recognition", "35% · approved pruning work")}${kv("Payment basis", "Hypercert recognition weights")}${kv("Garden retained", "100 G$ of 500 G$")}
${banner("Recognition records your contribution to the impact certificate. This receipt records the separate child payout that reached your account.", "stone")}`,
      )}`;
      break;
    case "send":
      inner = `<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("Ana", "ok")}${chip("Maria")}${chip("Garden jar")}</div>
<div class="t-meta">Tap a recent recipient, or paste an address below.</div>
${field("To", input("address or member…", { placeholder: true, icon: "user-line" }))}
<div style="display:flex;flex-wrap:wrap;gap:6px">${chip("5 G$")}${chip("20 G$", "ok")}${chip("Half")}${chip("All")}</div>
${field("Amount", input("20 G$"))}
${banner("Sent from your account on Celo. No gas needed.", "stone", "send-plane-line")}
${hot("w23.send-submit", btn("Send", { kind: "pri", full: true }))}`;
      break;
    case "send-pending":
      inner = `${listRow({ icon: "send-plane-line", primary: "20 G$ → Ana", meta: "Sending…", chipHtml: chip("Wallet pending", "queued") })}
${banner("Waiting for the wallet to confirm. If it fails, it retries inline and nothing is lost.", "stone")}`;
      break;
    case "send-failed":
      inner = `${field("To", input("Ana · 0x71…4c2", { icon: "user-line" }))}
${field("Amount", input("20 G$"))}
${banner("The wallet didn't confirm this send. Your recipient and amount are still here. Try again when you are ready.", "amber", "error-warning-line")}
${hot("w23.send-retry", btn("Try Again", { kind: "pri", full: true, icon: "refresh-line" }))}`;
      break;
    case "delivery-blocked":
      inner = `${card(
        `<div class="cardrow">${chip("Planned", "queued")}<div class="t-title">Member delivery isn't on yet</div></div><div class="t-meta">The Celo account and sponsored-send path hasn't passed its round-trip check. Garden-to-garden funding continues; personal balances and Send wait.</div>${hot("w23.tech-status", btn("View Technical Status", { kind: "ghost" }))}`,
      )}`;
      break;
    default:
      inner = `${card(
        `<div class="cardrow"><div class="grow"><div class="t-title">Support received</div><div class="t-meta">G$ · Celo</div></div><div class="t-title num">128 G$</div></div>` +
          hot("w23.arrived-row", listRow({ icon: "checkbox-circle-fill", primary: "+140 G$ for Prune the north beds", meta: "Contributor payout arrived · receipt ↗", chipHtml: chip("Arrived", "ok") })) +
          listRow({ icon: "time-line", primary: "+15 G$ for Market rides", meta: "On its way" }),
        { cls: "flat" },
      )}
${hot("w23.send", btn("Send G$", { kind: "pri", full: true, icon: "send-plane-line" }))}`;
  }
  // G$ is a token balance, so it belongs to the drawer's existing Tokens tab —
  // not a second surface claiming the Commitments panel W5 already owns. The
  // Commitments count badge stays visible from here — that is its point.
  return phoneFrame(walletShell(inner, 1), { appBar: false });
}

const W23_HOTS: HifiDef["hots"] = {
  "w23.send": { l: "Send G$", to: "screen:W23@send", info: "Online-only wallet action, sponsored gas — never enters the offline queue (UX:219)." },
  "w23.send-submit": { l: "Send", to: "screen:W23@send-pending", info: "Wallet-pending → confirmed; failure surfaces inline with retry (UX:219)." },
  "w23.send-retry": { l: "Try again", to: "screen:W23@send-pending", info: "Retries the online-only wallet action with the recipient and amount retained (UX:219)." },
  "w23.arrived-row": { l: "Arrived row", to: "screen:W23@contributor-receipt", info: "“Arrived” means an authenticated CCIP success acknowledgment — dispatched or Celo-executed/ack-pending never render as arrived. The receipt keeps Hypercert recognition and the child payout distinct." },
  "w23.tech-status": { l: "Technical status", info: "AA/paymaster gate failed: first contributor-child preparation and member sends stay off; authorized ProtocolToGarden seeding by a current protocol steward or the SettlementModule owner continues Safe-to-Safe (SS §5)." },
};

// ---------------------------------------------------------------------------
// W25 — protocol-pool claim (wireframes.md:671; MF8 dissolved into chooser)
// ---------------------------------------------------------------------------

const W25_STATES = [
  ["card", "Protocol card"], ["context-chooser", "Provider context"], ["pending", "Waiting for review"], ["accepted", "Accepted — garden provides"],
] as const;
type W25State = (typeof W25_STATES)[number][0];

function w25(state: W25State): string {
  // The provider-context choice is locked to the pre-claim sheet (register #51,
  // MF-8). Asking it on the card too meant the same question twice — with
  // opposite defaults — so the card carries only the claim entry point.
  const protocolCard = card(
    `<div class="cardrow">${chip("Protocol", "ink")}${chip("Request", "request")}</div><div class="t-title">Methodology survey</div><div class="t-meta num">1 survey · stewards review who takes this up</div>${hot("w25.ask", btn("Ask to Take This Up", { kind: "pri", full: true }))}`,
  );
  const head = hdr("Awka Hub", { back: true });

  if (state === "context-chooser") {
    const behind = `${head}${pagepad(protocolCard)}`;
    return phoneFrame(
      sheetOver(
        behind,
        "Take this up…",
        `${hot("w25.chooser", radio([{ label: "As myself", meta: "the commitment is yours", on: true }, { label: "For Awka Hub", meta: "you steward this garden" }], { interactive: true, name: "commitment-context" }))}
${banner("Working for the garden: its account makes the commitment; you remain the requester.", "stone", "group-line")}
${hot("w25.continue", btn("Continue", { kind: "pri", full: true }))}${hot("w25.cancel", btn("Cancel", { kind: "ghost", full: true }))}`,
      ),
      { appBar: false },
    );
  }
  if (state === "pending") {
    return phoneFrame(
      `${head}${pagepad(
        card(
          `<div class="cardrow">${chip("Waiting for review", "warn", { dot: true })}${chip("Protocol", "ink")}</div><div class="t-title">Methodology survey</div>${kv("Claimant", "Awka Hub (garden)")}${kv("Asked by", "you")}<div class="t-meta">Work and proof will anchor to your garden; the commitment stays with the protocol pool.</div>`,
        ),
      )}<div style="flex:1"></div>`,
      { appBar: false },
    );
  }
  if (state === "accepted")
    return phoneFrame(
      `${head}${pagepad(
        card(
          `<div class="cardrow">${chip("Accepted", "ok", { dot: true })}${chip("Protocol", "ink")}</div><div class="t-title">Methodology survey</div>${kv("Provider", "Awka Hub, your garden")}${kv("Asked by", "you")}<div class="t-meta">Your garden made this commitment. Work and proof from Awka gardeners anchor to it, and the support that follows goes to the garden.</div><div class="brow">${hot("w25.open-promise", btn("Open the Commitment", { kind: "pri", full: true }))}</div>`,
        ),
      )}<div style="flex:1"></div>`,
      { appBar: false },
    );
  return phoneFrame(`${head}${pagepad(banner("From the protocol pool. Surveys and activations any garden can take up.", "stone", "information-line"), protocolCard)}<div style="flex:1"></div>`, { appBar: false });
}

const W25_HOTS: HifiDef["hots"] = {
  "w25.chooser": { l: "Context chooser", info: "Garden claim: claimant = GardenAccount, requestedBy = you. No custody, no member-delivery via garden claims (AM:38-39)." },
  "w25.continue": { l: "Continue", to: "screen:W25@pending", info: "Creates the claim request with the chosen context's stored terms — claimant, requestedBy, kind, gardenContext (CS:133). Protocol pool defaults steward-reviewed (register #19); W1's pending/declined/superseded grammar applies unchanged.", calls: ["claimCommitment"] },
  "w25.cancel": { l: "Cancel", to: "screen:W25", info: "Closes the provider-context sheet without creating a claim request." },
  "w25.open-promise": { l: "Open the commitment", to: "screen:W2@garden-provider", info: "The garden-provided commitment opens in the ordinary commitment detail; work and evidence rails are unchanged." },
  "w25.ask": { l: "Ask to take this up", to: "screen:W25@context-chooser", info: "Opens the provider-context sheet before any claim request exists; the garden option renders for eligible stewards only (CS:581). The (Protocol) chip is the only new mark on the card grammar (WF:671)." },
};

// ---------------------------------------------------------------------------
// WFLOW — the existing Submit Work flow, drawn as its real four steps
// (2026-08-11 D6, uiux §5.7 addendum): intro → media → details → review, plus
// the net-new "Fulfills a commitment" picker (pickable work-first, prefilled and
// locked commitment-first) and the client link-existing-work picker that replaces
// the old admin-console mis-wire.
//
// Grounding pass (2026-08-14, Afo: casts must follow the shipping UI):
// anatomy re-drawn from the real components — the intro is FormInfo("Select
// your action") + a horizontal Carousel of image-topped ActionCards, then
// FormInfo("Select your garden") + a GardenCard carousel (views/Garden/
// Intro.tsx; domain StandardTabs render only for multi-domain gardens); the
// details step is FormInfo + Time Spent + per-action inputs + the feedback
// textarea and has NO action field (Details.tsx — the action was chosen at
// intro); review is FormInfo("Review Work" / "Check if the information is
// correct") + summary rows (Review.tsx). The commitment additions ride that
// anatomy, never replace it.
// ---------------------------------------------------------------------------

// selCard/selRail/commitmentSlide promoted into ../kit (components-tab pass,
// 2026-08-14); the intro casts below keep composing them with local fixtures.

// The real intro's two sections, reused by every intro cast. Scoped casts
// swap the card sets; the anatomy never changes.
const introActionSection = (cards: string[], info = "What type of work are you submitting?") =>
  formInfo("leaf-line", "Select your action", info) + selRail(cards);
const introGardenSection = (cards: string[], info = "Which garden are you submitting for?") =>
  formInfo("plant-line", "Select your garden", info) + selRail(cards);
const CARD_PRUNE = (sel = true) => selCard({ tint: "agro", media: "AGRO", title: "Prune", line: "Trees and beds", selected: sel });
const CARD_WATER = selCard({ tint: "agro", media: "AGRO", title: "Water", line: "Beds and rows" });
const CARD_PLANT = selCard({ tint: "agro", media: "AGRO", title: "Plant", line: "Seedlings and beds" });
const CARD_ROCINHA = (line = "Rocinha, Rio de Janeiro") => selCard({ tint: "garden", media: "Rocinha", title: "Rocinha Community Garden", line, selected: true });
const CARD_MUIZ = selCard({ tint: "garden", media: "Muizenberg", title: "Muizenberg", line: "Cape Town" });

type WflowState = "intro" | "intro-promise" | "intro-promises" | "media" | "details" | "review" | "link-picker";

// Iteration 2: the real Submit Work TopNav — close on step 1, back after,
// FormProgress numbered circles (kit.flowHeader). The link-picker keeps a
// plain back header with no progress (it is a picker, not a step).
const wfHead = (step: number | null, title = "Submit work") =>
  step == null
    ? `<div class="hdr fixed"><button type="button" class="hback" aria-label="Back, preview only" disabled>${icon("arrow-left-line", "l")}</button><h1>${title}</h1></div>`
    : flowHeader(title, step, 4);

function wflow(state: WflowState): string {
  let head = wfHead(0);
  let content: string;
  let actions: string;
  let secondary = "";
  switch (state) {
    case "media":
      head = wfHead(1);
      // Mirrors views/Garden/Media.tsx:500-556 (2026-08-17, Afo: "upload media
      // could be a bare mirror of what our current work submission shows"). The
      // real step is FormInfo, a self-start count badge, the Needed and Optional
      // pill groups the ACTION declares, then the uploaded media. That last part
      // was drawn as a tile strip, and it is not one: Media.tsx:690 is
      // `flex flex-col gap-3` and only becomes a grid at md:, which a 390px
      // phone never reaches. A gardener sees full-width photos at aspect-4/3,
      // stacked (2026-08-17, Afo: "we are not using a grid").
      content = pagepad(
        formInfo("image-line", "Upload Media", "Photos, video or a voice note, as proof of the work"),
        `<div class="cardrow">${chip("2/1 media (max 6) ✓", "ok")}</div>`,
        `<div class="h6s">Needed</div><div style="display:flex;flex-wrap:wrap;gap:6px">${chip("Before", "ok")}${chip("After", "ok")}</div>`,
        `<div class="h6s">Optional</div><div style="display:flex;flex-wrap:wrap;gap:6px">${chip("Wide shot")}${chip("Close up")}${chip("Voice note")}</div>`,
        mediaStack([
          { label: "North beds — before", photo: 0, hotId: "wflow.preview", removeHotId: "wflow.remove-media" },
          { label: "North beds — after", photo: 2, hotId: "wflow.preview", removeHotId: "wflow.remove-media" },
          { label: "Voice note · 0:41", kind: "audio", removeHotId: "wflow.remove-media" },
        ]),
        banner("Photos and voice notes stay on this device until the work sends.", "stone", "wifi-off-line"),
      );
      secondary = `${hot("wflow.capture-camera", btn("", { kind: "sec", sm: true, icon: "camera-line", ariaLabel: "Take a photo" }))}${hot("wflow.capture-gallery", btn("", { kind: "sec", sm: true, icon: "image-line", ariaLabel: "Choose from your library" }))}${hot("wflow.capture-audio", btn("", { kind: "sec", sm: true, icon: "mic-line", ariaLabel: "Record a voice note" }))}`;
      actions = hot("wflow.media-continue", btn("Continue", { kind: "pri", full: true }));
      break;
    case "details":
      // views/Garden/Details.tsx:113-180 — FormInfo, Time Spent as a default
      // field, then the inputs the CHOSEN ACTION declares, then feedback. The
      // "Fulfills a commitment" row this step used to carry is gone (2026-08-17,
      // Afo): the commitment is chosen at the intro now, so asking again here
      // asked a settled question and pushed the action's own inputs out of the
      // step. Its picker and the linked twin retire with it.
      head = wfHead(2);
      content = pagepad(
        formInfo("file-copy-line", "Work details", "Provide detailed information and feedback"),
        field("Time spent", input("2 hours", { select: true })),
        `<div class="t-meta">The details below are the ones this action asks for. They change with the action you chose.</div>`,
        field("Trees pruned", input("4")),
        field("Method", input("Hand tools, loppers and a pruning saw", { select: true })),
        field("Feedback", input("Provide feedback or any observations", { placeholder: true, textarea: true })),
      );
      actions = hot("wflow.details-continue", btn("Continue", { kind: "pri", full: true }));
      break;
    case "review":
      head = wfHead(3);
      // views/Garden/Review.tsx:192 renders <WorkView>: FormInfo, then an h6 per
      // section — Garden, Media, Details — with one FormCard per detail. This
      // step had been drawing a single flat card of rows: a different component,
      // and the last review in the feature still doing it.
      content = pagepad(
        formInfo("check-line", "Review Work", "Check if the information is correct"),
        // One radius down the stack (2026-08-17, Afo): 24px section cards above
        // 14px FormCards made the review rounder at the top than the bottom.
        `<div class="revw">`,
        `<div class="h6s">Details</div>`,
        formCard("plant-line", "Garden", "Rocinha Community Garden · Rio de Janeiro"),
        formCard("leaf-line", "Action", "Prune"),
        formCard("time-line", "Time spent", "2 hours"),
        formCard("file-copy-line", "Trees pruned", "4"),
        formCard("file-copy-line", "Method", "Hand tools, loppers and a pruning saw"),
        formCard("sticky-note-line", "Description", "Cleared the north beds and took the deadwood out of the two older trees."),
        // The commitment row can be cleared here (2026-08-17, Afo). Work never
        // requires a commitment, and nothing on chain has happened yet, so the
        // reviewer can decide this is just a piece of work without walking back
        // to the intro to find out the choice was reversible.
        hot("wflow.fulfills", formCard("hand-heart-line", "Fulfills", "Prune the north beds, chosen at the start, tap to review it")),
        `<div class="brow" style="padding:0 2px">${hot("wflow.untie", btn("Not for a Commitment", { kind: "ghost", sm: true, icon: "close-line" }))}</div>`,
        sectionCard("Media", mediaStrip([{ label: "North beds — before", photo: 0 }, { label: "North beds — after", photo: 2 }, { label: "Voice note", kind: "audio" }]), { flush: true }),
        `</div>`,
      );
      actions = hot("wflow.submit", btn("Submit Work", { kind: "pri", full: true }));
      break;
    case "link-picker":
      head = wfHead(null, "Link existing work");
      content = pagepad(
        `<div class="t-meta">Choose one of your works and the requirement row it counts toward.</div>`,
        card(
          hot("wflow.link-work-row", listRow({ icon: "image-line", primary: "Pruning session", meta: "Approved · Jul 30", chipHtml: chip("Chosen", "ok") })) +
            listRow({ icon: "image-line", primary: "Mulching the paths", meta: "Waiting for review · Aug 2" }),
          { cls: "flat" },
        ),
        field("Counts toward", radio([
          { label: "Prune × 2", meta: "1 of 2 approved so far", on: true },
          { label: "Plant × 12", meta: "8 of 12 approved so far" },
        ], { interactive: true, name: "wflow-link-requirement" })),
        `<div class="t-meta">Repeated actions never guess. You name the exact requirement row.</div>`,
      );
      actions = hot("wflow.link-confirm", btn("Link This Work", { kind: "pri", full: true }));
      break;
    // Commitment-first entry (2026-08-14 workflows round): the commitment already
    // names its proof, so the REAL intro is scoped by it — fulfilling strip
    // on top, the ActionCard carousel filtered to the requirement rows, the
    // GardenCard rail locked to the commitment's garden. Same anatomy, narrower
    // card sets.
    case "intro-promise":
      content = pagepad(
        hot("wflow.fulfill-strip", banner("Fulfilling Prune the north beds, which needs Prune × 2 · Plant × 12", "stone", "hand-heart-line")),
        introActionSection([CARD_PRUNE(true), CARD_PLANT], "Only this commitment's actions are shown"),
        introGardenSection([CARD_ROCINHA("The commitment's garden")], "Set by the commitment"),
      );
      actions = hot("wflow.intro-continue", btn("Continue", { kind: "pri", full: true }));
      break;
    // Standing attribution (2026-08-14, supersedes the same-day reactive tie
    // suggestion): a commitment-holder's intro OPENS with their commitments —
    // present from first paint, keyed to who they are, never to what they
    // just tapped. Below it, the shipping intro continues untouched.
    case "intro-promises":
      content = pagepad(
        formInfo("hand-heart-line", "Work toward a commitment", "Swipe your open commitments, then tap one to work toward it"),
        selRail([
          commitmentSlide({ title: "Prune the north beds", needs: "needs Prune × 2", due: "due Aug 12", hotId: "wflow.promise-row" }),
          commitmentSlide({ title: "Clear the drainage channel", needs: "needs Mulch × 4", due: "due Aug 30", hotId: "wflow.promise-row" }),
          commitmentSlide({ title: "Mulch the pathways", needs: "needs Mulch × 3", due: "runs with the season", hotId: "wflow.promise-row" }),
        ]),
        `<div class="t-meta">Or choose plain garden work below, work never requires a commitment.</div>`,
        introActionSection([CARD_PRUNE(true), CARD_WATER]),
        introGardenSection([CARD_ROCINHA(), CARD_MUIZ]),
      );
      actions = hot("wflow.intro-continue", btn("Continue", { kind: "pri", full: true }));
      break;
    default: // intro. The shipping anatomy verbatim (Intro.tsx)
      content = pagepad(
        introActionSection([CARD_PRUNE(true), CARD_WATER]),
        introGardenSection([CARD_ROCINHA(), CARD_MUIZ]),
      );
      actions = hot("wflow.intro-continue", btn("Continue", { kind: "pri", full: true }));
  }
  return phoneFrame(content, { header: head, appBar: actionBar(actions, secondary || undefined) });
}

const WFLOW_HOTS: HifiDef["hots"] = {
  "wflow.intro-continue": { l: "Continue to media", to: "screen:WFLOW@media", info: "The shipping intro step — FormInfo sections, the ActionCard carousel, the GardenCard carousel (views/Garden/Intro.tsx; domain StandardTabs render only when a garden spans domains) — continues to media capture. Identical from the scoped and commitment-holder casts." },
  "wflow.fulfill-strip": { l: "Fulfilling strip", info: "Commitment-first scoping (2026-08-14 workflows round): the strip names the commitment and its still-needed rows; the action grid below shows only the commitment's requirement actions (pre-chosen when there is one) and the garden is the commitment's. Media → details → review are untouched — the tie is pure metadata." },
  "wflow.promise-row": { l: "Work toward this commitment", to: "screen:WFLOW@intro-promise", info: "Standing attribution (2026-08-14): the rail exists from first paint whenever the member holds work-needing commitments — keyed to who they are, never to what they just tapped, so nothing pops up mid-flow. A horizontal rail like the action and garden rails below it: holding many commitments costs swipes, never vertical space. Nearest due first; tapping a card enters the scoped flow. Work never requires a commitment (policy 2026-08-14: free + led + recoverable — linkWork attaches existing work later, ProofLib.sol), and the details-step picker stays the mid-flow catch-all." },
  "wflow.capture-camera": { l: "Take a photo", info: "The shipping media step's one-tap capture from the fixed bar; the pooling evidence flow mirrors this interaction (uiux §5.5 addendum 2026-08-11)." },
  "wflow.capture-gallery": { l: "Choose from your library", info: "Gallery pick, multiple allowed, with HEIC conversion and compression." },
  "wflow.capture-audio": { l: "Record a voice note", info: "Audio notes record from the bar and play back inline — the shipping interaction." },
  "wflow.media-continue": { l: "Continue to details", to: "screen:WFLOW@details", info: "Media → details, exactly as shipped." },
  "wflow.details-continue": { l: "Continue to review", to: "screen:WFLOW@review", info: "Details → review, exactly as shipped." },
  "wflow.preview": { l: "Open the photo", info: "Media.tsx opens ImagePreviewDialog from the photo itself; the composer's stack is what you tap." },
  "wflow.remove-media": { l: "Remove this", info: "Media.tsx pins a 44px remove control over each photo at top-2 right-2, so removing never means opening the item first." },
  "wflow.untie": { l: "Not for a commitment", to: "screen:WFLOW@review", info: "Clears the commitment this work was going to count toward, so it submits as ordinary garden work. Work never requires a commitment, and nothing on chain has happened yet, so this is a local edit to the draft (2026-08-17, Afo). Going back to the intro did the same thing, but nothing told the reviewer the choice was reversible." },
  "wflow.fulfills": { l: "Fulfills row", info: "The locked read-only commitment-context row on review (MF-7, UX:174) — it repeats the details-step choice and never re-opens the picker here." },
  "wflow.submit": { l: "Submit work", to: "screen:W2@active", info: "Existing work job + meta.commitmentId; the queue auto-links after sync (UX:220)." },
  "wflow.link-work-row": { l: "Choose this work", info: "One of the gardener's approved or pending works; approval status is shown, never guessed." },
  "wflow.link-confirm": { l: "Link this work", to: "screen:W2@active", info: "Enqueues workLink with the exact workUID + requirementIndex (2026-08-11 D6 — this picker replaces the old admin-console mis-wire). Repeated action UIDs never use first-match behavior (UX:140).", calls: ["linkWork"], pendingSync: true },
};

// ---------------------------------------------------------------------------

export const WALLET_DEFS: HifiDef[] = [
  {
    screen: { id: "W5", title: "W5 · Commitments sheet", surface: "client", frame: "phone", group: "Client PWA",
      states: W5_STATES.map(([id, label]) => ({ id, label, html: w5(id) })) },
    hots: W5_HOTS,
  },
  {
    screen: { id: "W23", title: "W23 · Wallet G$ + send", surface: "client", frame: "phone", group: "Client PWA",
      states: W23_STATES.map(([id, label]) => ({ id, label, html: w23(id) })) },
    hots: W23_HOTS,
  },
  {
    screen: { id: "W25", title: "W25 · Protocol-pool claim", surface: "client", frame: "phone", group: "Client PWA",
      states: W25_STATES.map(([id, label]) => ({
        id,
        label,
        facts: {
          commitment: id === "accepted" ? "Accepted" : "Requested",
          kind: "SupportService",
        } satisfies StateFacts,
        html: w25(id),
      })) },
    hots: W25_HOTS,
  },
  {
    screen: { id: "WFLOW", title: "Submit Work flow (+ commitment link)", surface: "client", frame: "phone", group: "Client PWA",
      states: [
        { id: "intro", label: "1 · Intro", html: wflow("intro") },
        { id: "intro-promise", label: "1 · Intro, from a commitment", html: wflow("intro-promise") },
        { id: "intro-promises", label: "1 · Intro. You hold commitments", html: wflow("intro-promises") },
        { id: "media", label: "2 · Media", html: wflow("media") },
        { id: "details", label: "3 · Details (+ fulfills field)", html: wflow("details") },
        // "details-linked" and "fulfills-pick" retired 2026-08-19 (PR #732 review).
        // Both were declared on 2026-08-14 and never added to WflowState or the
        // wflow() switch, so both fell through and rendered the step-1 action
        // picker — a state labelled "3 · Details, commitment chosen" showing the
        // intro. Nothing above `.plans/` runs tsc, so the ids typechecked
        // nowhere and the build counted two states that drew the wrong screen.
        // Superseded regardless: the commitment is chosen at the intro now, and
        // step 3 does not ask again (sb4a).
        { id: "review", label: "4 · Review (+ fulfills row)", html: wflow("review") },
        { id: "link-picker", label: "Link existing work, picker", facts: { pool: "Open", cycle: "Open", commitment: "Active", kind: "DomainImpact" } satisfies StateFacts, html: wflow("link-picker") },
      ] },
    hots: WFLOW_HOTS,
  },
];
