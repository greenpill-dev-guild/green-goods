// Client PWA hi-fi screens, wallet + protocol set — W5 WalletDrawer pools
// panel, W23 wallet G$ section, W25 protocol-pool claim, WFLOW (existing work
// flow + the MF-7 fulfills row). Same dialect and copy rules as client.ts.
// Dissolved lo-fi variants: W23G → W23@delivery-blocked, MF8 → W25@context-chooser.
// W6's retired home summary card lives on as the W5 header line (Decision Log #28f).

import { hot } from "../html";
import { icon } from "../icons";
import {
  actionBar, banner, btn, card, chip, disclosure, emptyState, field, flowHeader, formCard, formInfo, hdr, homeHeader, input, kv, listRow, mediaStrip, meter, pagepad,
  filterChips, phoneFrame, commitmentCard, commitmentSlide, radio, reasonChips, sectionCard, sectionTitle, seg, selCard, selRail, sheetOver, skeleton,
} from "../kit";
import type { HifiDef } from "./index";
import type { StateFacts } from "../types";

// ---------------------------------------------------------------------------
// W5 — WalletDrawer pools panel (uiux-spec §5.8; absorbs W6's summary line)
// ---------------------------------------------------------------------------

const W5_STATES = [
  ["default", "Pools"], ["queued", "Queued rows"], ["waiting-membership", "Waiting rows"], ["send-failed", "Send failed"],
  ["empty", "Empty"], ["loading", "Loading"], ["not-found", "Not found"], ["read-error", "Read error"],
] as const;
type W5State = (typeof W5_STATES)[number][0];

// The shipping WalletDrawer is a 3-tab ModalDrawer opened from the Home header
// — Cookies · Tokens · Commitments (views/Home/WalletDrawer/index.tsx:31-47) —
// not a four-segment surface under Profile, and there is no Vault tab. G$ lives
// in the existing Tokens tab. §5.8 lands the pools panel in this drawer and
// ships no Profile change. The Commitments pill carries its promised count
// badge (§5.8 item 2, the cookie-jar tab pattern) — drawn since 2026-08-14: it
// counts the attention inbox, so it shows from every tab, not just this one.
const walletShell = (inner: string, active: 0 | 1 | 2, opts: { segHot?: string; badge?: number } = {}) => {
  const rail = seg(["Cookies", "Tokens", "Commitments"], active, opts.badge ? { badges: { 2: opts.badge } } : {});
  return sheetOver(
    homeHeader(),
    "Wallet",
    `<div class="t-meta">Your jars, tokens, and commitments across gardens.</div>${opts.segHot ? hot(opts.segHot, rail) : rail}${inner}`,
    { handle: false },
  );
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
    case "empty":
      inner = `${card(`<div class="t-title">No commitments yet</div><div class="t-meta">When you offer support or take something up in a garden pool, it shows here.</div>`)}`;
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
      // "Things I can offer" is split by what its two halves actually are
      // (2026-08-16 round 12, Afo). It used to be a fourth section card below
      // three gardens, which read as a fourth garden, held a single nav row
      // rather than content, and sat outside the scope chips' jurisdiction
      // while merging two unlike things: a PRIVATE saved draft (nothing on
      // chain, invisible to anyone) and an ONGOING Offer (createCommitmentSeries,
      // live places in a real pool). The draft is not a commitment, so it becomes
      // a tool row above the ledger; the ongoing Offer has a garden, so its
      // parent card stands in that garden's section like everything else.
      inner = `${card(
        hot("w5.things", listRow({ icon: "sticky-note-line", primary: "Things I can offer", meta: "1 saved detail, private until you offer it", chevron: true })),
        { cls: "flat" },
      )}
${filterChips(
        [
          { label: "All", on: true, hotId: "w5.scope-all" },
          { label: "Waiting on you", hotId: "w5.scope-waiting" },
          { label: "Active", hotId: "w5.scope-active" },
          { label: "Kept", hotId: "w5.scope-kept" },
        ],
        "Commitment scope",
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
          commitmentCard({ title: "Repair tool handles", meta: "1 repair session · yours", tags: [{ label: "Accepted", tone: "request" }, { label: "Support / service" }] }),
        )}${hot(
          // The ongoing Offer's PARENT, standing in the garden it runs in. Its
          // places are public and live on the pool tab; the parent is the thing
          // only you rest, resume, or retire, so the wallet is its home. Counts
          // are places — one basis, so no cross-basis sum (Appendix D.1).
          "w5.ongoing-row",
          commitmentCard({ title: "Hosting climate workshops", meta: "2 open · 1 taken up", tags: [{ label: "Ongoing" }, { label: "Support / service" }] }),
        )}`,
        { flush: true },
      )}
${sectionCard(
        "Awka Hub",
        commitmentCard({ title: "Field survey ride", meta: "TAS Hub · confirm when kept", tags: [{ label: "Ready to confirm", tone: "warn" }] }),
        { flush: true },
      )}
${sectionCard(
        "Muizenberg",
        commitmentCard({ title: "Beach cleanup Saturday", meta: "2 hours · Jul 12", tags: [{ label: "Kept", tone: "ok" }], media: { label: "photo", tint: "waste" , photo: 3 } }),
        { flush: true },
      )}`;
  }
  // The shipping AppBar hides while any drawer is open (AppBar.tsx:33).
  // The Commitments badge counts the attention inbox (2 confirmations + 1
  // accepted ask + 1 commitment needing work); read-recovery and empty casts
  // draw no count.
  const badge = state === "empty" || state === "loading" || state === "not-found" || state === "read-error" ? undefined : 4;
  return phoneFrame(walletShell(inner, 2, { segHot: "w5.seg", badge }), { offline: state === "queued" || state === "send-failed" || state === "read-error", appBar: false });
}

const W5_HOTS: HifiDef["hots"] = {
  "w5.scope-all": { l: "All commitments", info: "Every commitment you hold, grouped by garden. Scopes filter this one list rather than drawing a second copy of part of it (2026-08-16)." },
  "w5.scope-waiting": { l: "Waiting on you", info: "The commitments needing an act from you — a confirmation, evidence, or work. This was a separate section above the ledger; the same rows appeared twice." },
  "w5.scope-active": { l: "Active", info: "Accepted and in progress, across every garden." },
  "w5.scope-kept": { l: "Kept", info: "Commitments confirmed kept. Counts stay per-garden; unlike cycles never aggregate." },
  "w5.seg": { l: "Wallet tabs", info: "The shipping WalletDrawer's three tabs — Cookies · Tokens · Commitments. Commitments is the cross-garden commitments home (UX:186); G$ balances stay in Tokens. Since 2026-08-14 the Commitments pill carries its §5.8 count badge (the cookie-jar tab pattern), counting the attention inbox so it reads from any tab." },
  "w5.inbox-row": { l: "Pending confirmation", to: "screen:W4", info: "Inbox of commitments waiting on YOUR confirmation, across gardens (UX:185)." },
  "w5.accepted-row": { l: "Accepted ask", to: "screen:W2@request-active", info: "The attention inbox widened past confirmations (2026-08-14): a newly accepted ask surfaces here so the asker opens it without hunting the ledger below. Queued and failed sends keep their §5.8 item-4 chrome at the top of their own group." },
  "w5.needs-work-row": { l: "Your commitment needs work", to: "screen:W2@active", info: "The ambient layer of standing attribution (2026-08-14): a commitment needing your work is a waiting-on-you item — arguably the biggest — so it stands in the inbox and counts in the Commitments badge. Opens the commitment, whose bar act is Submit work (the scoped intro)." },
  "w5.retry-send": { l: "Retry failed send", to: "screen:W5@queued", info: "Wallet-side recovery (2026-08-14 second pass): resets the exhausted job to pending and retries without dropping the local commitment — the same UX:218 contract as the pool tab, reachable from any garden." },
  "w5.discard-send": { l: "Discard failed send", to: "screen:W5", info: "Removes only the exhausted local job after an explicit member choice; no remote commitment exists yet (UX:218)." },
  "w5.mine-row": { l: "My commitment", to: "screen:W2", info: "Your own commitments grouped by garden." },
  "w5.things": { l: "Things I can offer", to: "screen:W32@saved-with-ongoing", info: "The drawn entry for W32 (2026-08-11 D8a, uiux §5.8 addendum), now scoped to what is genuinely private: saved details you can reuse, nothing on chain, invisible to anyone else. Since 2026-08-16 it sits ABOVE the ledger as a tool row rather than below it as a fourth section card — it is not a garden, and the scope chips do not reach it. Ongoing Offers moved into their own garden's section." },
  "w5.ongoing-row": { l: "Your ongoing Offer", to: "screen:W34@active-two", info: "The ongoing Offer's parent, standing in the garden it runs in (2026-08-16 round 12, Afo). Its places are public and live on the pool tab; the parent is what only you rest, resume, or retire, so the wallet holds it. The card counts places — one basis, never a unit sum (Appendix D.1)." },
  "w5.retry": { l: "Try again", info: "Read-surface recovery for the cross-garden pools panel — loading / not-found / read-error, never a “None” chip (UX:51-52 · AM:12)." },
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
  return phoneFrame(walletShell(inner, 1, { badge: 4 }), { appBar: false });
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
          `<div class="cardrow">${chip("Waiting for review", "warn", { dot: true })}${chip("Protocol", "ink")}</div><div class="t-title">Methodology survey</div>${kv("Claimant", "Awka Hub (garden)")}${kv("Asked by", "you")}<div class="t-meta">Work and evidence will anchor to your garden; the commitment stays with the protocol pool.</div>`,
        ),
      )}<div style="flex:1"></div>`,
      { appBar: false },
    );
  }
  if (state === "accepted")
    return phoneFrame(
      `${head}${pagepad(
        card(
          `<div class="cardrow">${chip("Accepted", "ok", { dot: true })}${chip("Protocol", "ink")}</div><div class="t-title">Methodology survey</div>${kv("Provider", "Awka Hub, your garden")}${kv("Asked by", "you")}<div class="t-meta">Your garden made this commitment. Work and evidence from Awka gardeners anchor to it, and the support that follows goes to the garden.</div><div class="brow">${hot("w25.open-promise", btn("Open the Commitment", { kind: "pri", full: true }))}</div>`,
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
      // pill groups the ACTION declares, then the uploaded images as a tile grid
      // with audio notes listed under them. The prototype had a dashed capture
      // card and a row list instead — neither exists in the shipped step.
      content = pagepad(
        formInfo("image-line", "Upload Media", "Photos, video or a voice note, as evidence of the work"),
        `<div class="cardrow">${chip("2/1 media (max 6) ✓", "ok")}</div>`,
        `<div class="h6s">Needed</div><div style="display:flex;flex-wrap:wrap;gap:6px">${chip("Before", "ok")}${chip("After", "ok")}</div>`,
        `<div class="h6s">Optional</div><div style="display:flex;flex-wrap:wrap;gap:6px">${chip("Wide shot")}${chip("Close up")}${chip("Voice note")}</div>`,
        mediaStrip([{ label: "North beds — before", photo: 0 }, { label: "North beds — after", photo: 2 }]),
        card(listRow({ icon: "mic-line", primary: "Voice note", meta: "0:41 · tap to play" }), { cls: "flat" }),
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
        sectionCard("Garden", listRow({ icon: "plant-line", primary: "Rocinha Community Garden", meta: "Rio de Janeiro · 23 gardeners" })),
        sectionCard("Media", mediaStrip([{ label: "North beds — before", photo: 0 }, { label: "North beds — after", photo: 2 }, { label: "Voice note", kind: "audio" }]), { flush: true }),
        `<div class="h6s">Details</div>`,
        formCard("leaf-line", "Action", "Prune"),
        formCard("time-line", "Time spent", "2 hours"),
        formCard("file-copy-line", "Trees pruned", "4"),
        formCard("file-copy-line", "Method", "Hand tools, loppers and a pruning saw"),
        formCard("sticky-note-line", "Description", "Cleared the north beds and took the deadwood out of the two older trees."),
        hot("wflow.fulfills", formCard("hand-heart-line", "Fulfills", "Prune the north beds, chosen at the start, tap to review it")),
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
  "wflow.fulfills": { l: "Fulfills row", info: "The locked read-only commitment-context row on review (MF-7, UX:174) — it repeats the details-step choice and never re-opens the picker here." },
  "wflow.submit": { l: "Submit work", to: "screen:W2@active", info: "Existing work job + meta.commitmentId; the queue auto-links after sync (UX:220)." },
  "wflow.link-work-row": { l: "Choose this work", info: "One of the gardener's approved or pending works; approval status is shown, never guessed." },
  "wflow.link-confirm": { l: "Link this work", to: "screen:W2@active", info: "Enqueues workLink with the exact workUID + requirementIndex (2026-08-11 D6 — this picker replaces the old admin-console mis-wire). Repeated action UIDs never use first-match behavior (UX:140).", calls: ["linkWork"], pendingSync: true },
};

// ---------------------------------------------------------------------------

export const WALLET_DEFS: HifiDef[] = [
  {
    screen: { id: "W5", title: "W5 · WalletDrawer pools panel", surface: "client", frame: "phone", group: "Client PWA",
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
        { id: "details-linked", label: "3 · Details, commitment chosen", html: wflow("details-linked") },
        { id: "fulfills-pick", label: "Fulfills a commitment, picker", html: wflow("fulfills-pick") },
        { id: "review", label: "4 · Review (+ fulfills row)", html: wflow("review") },
        { id: "link-picker", label: "Link existing work, picker", facts: { pool: "Open", cycle: "Open", commitment: "Active", kind: "DomainImpact" } satisfies StateFacts, html: wflow("link-picker") },
      ] },
    hots: WFLOW_HOTS,
  },
];
