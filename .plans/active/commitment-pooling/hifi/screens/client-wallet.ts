// Client PWA hi-fi screens, wallet + protocol set — W5 WalletDrawer pools
// panel, W23 wallet G$ section, W25 protocol-pool claim, WFLOW (existing work
// flow + the MF-7 fulfills row). Same dialect and copy rules as client.ts.
// Dissolved lo-fi variants: W23G → W23@delivery-blocked, MF8 → W25@context-chooser.
// W6's retired home summary card lives on as the W5 header line (Decision Log #28f).

import { hot } from "../html";
import { icon } from "../icons";
import {
  banner, btn, card, chip, disclosure, emptyState, field, hdr, homeHeader, input, kv, listRow, meter, pagepad,
  phoneFrame, radio, sectionTitle, seg, sheetOver, skeleton, stepDots,
} from "../kit";
import type { HifiDef } from "./index";
import type { StateFacts } from "../types";

// ---------------------------------------------------------------------------
// W5 — WalletDrawer pools panel (uiux-spec §5.8; absorbs W6's summary line)
// ---------------------------------------------------------------------------

const W5_STATES = [
  ["default", "Pools"], ["queued", "Queued rows"], ["waiting-membership", "Waiting rows"], ["empty", "Empty"],
  ["loading", "Loading"], ["not-found", "Not found"], ["read-error", "Read error"],
] as const;
type W5State = (typeof W5_STATES)[number][0];

// The shipping WalletDrawer is a 3-tab ModalDrawer opened from the Home header
// — Cookies · Tokens · Commitments (views/Home/WalletDrawer/index.tsx:31-47) —
// not a four-segment surface under Profile, and there is no Vault tab. G$ lives
// in the existing Tokens tab. §5.8 lands the pools panel in this drawer and
// ships no Profile change.
const walletShell = (inner: string, active: 0 | 1 | 2, segHot?: string) => {
  const rail = seg(["Cookies", "Tokens", "Commitments"], active);
  return sheetOver(
    homeHeader(),
    "Wallet",
    `<div class="t-meta">Your jars, tokens, and promises across gardens.</div>${segHot ? hot(segHot, rail) : rail}${inner}`,
    { handle: false },
  );
};

function w5(state: W5State): string {
  let inner: string;
  switch (state) {
    case "queued":
      inner = `${hot("w5.summary", `<div class="t-meta num">7 of 9 promises kept this cycle across your gardens</div>`)}
${sectionTitle("My commitments")}
${card(
        listRow({ icon: "seedling-line", primary: "Compost workshop", meta: "Rocinha · Offered", chipHtml: chip("Queued", "queued") }) +
          listRow({ icon: "seedling-line", primary: "Ride to market", meta: "Rocinha · Accepted", chevron: true }),
        { cls: "flat" },
      )}
${banner("Queued promises send when you're back online.", "stone", "wifi-off-line")}`;
      break;
    case "waiting-membership":
      inner = `${sectionTitle("My commitments")}
${card(
        listRow({ icon: "seedling-line", primary: "Compost workshop", meta: "Rocinha · Offered", chipHtml: chip("Waiting", "queued") }),
        { cls: "flat" },
      )}
${banner("Waiting for your garden membership — it will send once you're welcomed in, without using any attempts.", "stone", "time-line")}`;
      break;
    case "empty":
      inner = `${card(`<div class="t-title">No promises yet</div><div class="t-meta">When you offer support or take something up in a garden pool, it shows here.</div>`)}`;
      break;
    case "loading":
      inner = `${skeleton({ title: true, lines: 1, cls: "flat" })}${skeleton({ avatar: true, lines: 2 })}${skeleton({ avatar: true, lines: 2 })}`;
      break;
    case "not-found":
      inner = emptyState("search-line", "No promises found", "We couldn't find your commitments across gardens. They may still be syncing to this device — try again in a moment.", hot("w5.retry", btn("Try again", { kind: "sec", icon: "refresh-line" })));
      break;
    case "read-error":
      inner = emptyState("wifi-off-line", "Couldn't load your promises", "Something went wrong reaching the network. Your last view is saved on this device.", hot("w5.retry", btn("Try again", { kind: "pri", icon: "refresh-line" })));
      break;
    default:
      inner = `${hot("w5.summary", `<div class="t-meta num">7 of 9 promises kept this cycle across your gardens</div>`)}
${sectionTitle("Waiting on you")}
${card(
        hot("w5.inbox-row", listRow({ icon: "hand-heart-line", primary: "Maria — Prune the north beds", meta: "Rocinha · confirm when kept", chevron: true })) +
          listRow({ icon: "hand-heart-line", primary: "TAS Hub — Field survey ride", meta: "Awka · confirm when kept", chevron: true }),
        { cls: "flat" },
      )}
${disclosure(
        "My commitments",
        "2 across 2 gardens",
        card(
          `<div class="t-meta">Rocinha Community Garden</div>` +
            hot("w5.mine-row", listRow({ icon: "seedling-line", primary: "Ride to market", meta: "Accepted", chevron: true })) +
            `<div class="t-meta" style="margin-top:6px">Muizenberg</div>` +
            listRow({ icon: "seedling-line", primary: "Beach cleanup Saturday", meta: "Fulfilled", chipHtml: chip("Kept", "ok") }),
          { cls: "flat" },
        ),
      )}`;
  }
  // The shipping AppBar hides while any drawer is open (AppBar.tsx:33).
  return phoneFrame(walletShell(inner, 2, "w5.seg"), { offline: state === "queued" || state === "read-error", appBar: false });
}

const W5_HOTS: HifiDef["hots"] = {
  "w5.seg": { l: "Wallet tabs", info: "The shipping WalletDrawer's three tabs — Cookies · Tokens · Commitments. Commitments is the cross-garden promises home (UX:186); G$ balances stay in Tokens." },
  "w5.summary": { l: "Cycle summary line", info: "W6's retired Home card lives on as this header line (Decision Log #28f); absolute numbers below the small-community threshold (UX:191)." },
  "w5.inbox-row": { l: "Pending confirmation", to: "screen:W4", info: "Inbox of promises waiting on YOUR confirmation, across gardens (UX:185)." },
  "w5.mine-row": { l: "My commitment", to: "screen:W2", info: "Your own promises grouped by garden." },
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
      inner = `${field("To", input("address or member…", { placeholder: true, icon: "user-line" }))}
${field("Amount", input("20 G$"))}
${banner("Sent from your account on Celo. No gas needed.", "stone", "send-plane-line")}
${hot("w23.send-submit", btn("Send", { kind: "pri", full: true }))}`;
      break;
    case "send-pending":
      inner = `${listRow({ icon: "send-plane-line", primary: "20 G$ → Ana", meta: "Sending…", chipHtml: chip("Wallet pending", "queued") })}
${banner("Waiting for the wallet to confirm. If it fails, it retries inline — nothing is lost.", "stone")}`;
      break;
    case "send-failed":
      inner = `${field("To", input("Ana · 0x71…4c2", { icon: "user-line" }))}
${field("Amount", input("20 G$"))}
${banner("The wallet didn't confirm this send. Your recipient and amount are still here — try again when you're ready.", "amber", "error-warning-line")}
${hot("w23.send-retry", btn("Try again", { kind: "pri", full: true, icon: "refresh-line" }))}`;
      break;
    case "delivery-blocked":
      inner = `${card(
        `<div class="cardrow">${chip("Planned", "queued")}<div class="t-title">Member delivery isn't on yet</div></div><div class="t-meta">The Celo account and sponsored-send path hasn't passed its round-trip check. Garden-to-garden funding continues; personal balances and Send wait.</div>${hot("w23.tech-status", btn("View technical status", { kind: "ghost" }))}`,
      )}`;
      break;
    default:
      inner = `${card(
        `<div class="cardrow"><div class="grow"><div class="t-title">Support received</div><div class="t-meta">G$ · Celo</div></div><div class="t-title num">128 G$</div></div>` +
          hot("w23.arrived-row", listRow({ icon: "checkbox-circle-fill", primary: "+140 G$ — Prune the north beds", meta: "Contributor payout arrived · receipt ↗", chipHtml: chip("Arrived", "ok") })) +
          listRow({ icon: "time-line", primary: "+15 G$ — Market rides", meta: "On its way" }),
        { cls: "flat" },
      )}
${hot("w23.send", btn("Send G$", { kind: "pri", full: true, icon: "send-plane-line" }))}`;
  }
  // G$ is a token balance, so it belongs to the drawer's existing Tokens tab —
  // not a second surface claiming the Commitments panel W5 already owns.
  return phoneFrame(walletShell(inner, 1), { appBar: false });
}

const W23_HOTS: HifiDef["hots"] = {
  "w23.send": { l: "Send G$", to: "screen:W23@send", info: "Online-only wallet action, sponsored gas — never enters the offline queue (UX:219)." },
  "w23.send-submit": { l: "Send", to: "screen:W23@send-pending", info: "Wallet-pending → confirmed; failure surfaces inline with retry (UX:219)." },
  "w23.send-retry": { l: "Try again", to: "screen:W23@send-pending", info: "Retries the online-only wallet action with the recipient and amount retained (UX:219)." },
  "w23.arrived-row": { l: "Arrived row", to: "screen:W23@contributor-receipt", info: "“Arrived” means an authenticated CCIP success acknowledgment — dispatched or Celo-executed/ack-pending never render as arrived. The receipt keeps Hypercert recognition and the child payout distinct." },
  "w23.tech-status": { l: "Technical status", info: "AA/paymaster gate failed: first contributor-child preparation and member sends stay off; steward-authorized non-commitment garden seeding continues Safe-to-Safe (SS §5)." },
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
    `<div class="cardrow">${chip("Protocol", "ink")}${chip("Request", "request")}</div><div class="t-title">Methodology survey</div><div class="t-meta num">1 survey · stewards review who takes this up</div>${hot("w25.ask", btn("Ask to take this up", { kind: "pri", full: true }))}`,
  );
  const head = hdr("Awka Hub", { back: true });

  if (state === "context-chooser") {
    const behind = `${head}${pagepad(protocolCard)}`;
    return phoneFrame(
      sheetOver(
        behind,
        "Take this up…",
        `${hot("w25.chooser", radio([{ label: "As myself", meta: "the promise is yours", on: true }, { label: "For Awka Hub", meta: "you steward this garden" }], { interactive: true, name: "commitment-context" }))}
${banner("Working for the garden: its account makes the promise; you remain the requester.", "stone", "group-line")}
${hot("w25.continue", btn("Continue", { kind: "pri", full: true }))}${hot("w25.cancel", btn("Cancel", { kind: "ghost", full: true }))}`,
      ),
      { appBar: false },
    );
  }
  if (state === "pending") {
    return phoneFrame(
      `${head}${pagepad(
        card(
          `<div class="cardrow">${chip("Waiting for review", "warn", { dot: true })}${chip("Protocol", "ink")}</div><div class="t-title">Methodology survey</div>${kv("Claimant", "Awka Hub (garden)")}${kv("Asked by", "you")}<div class="t-meta">Work and evidence will anchor to your garden; the promise stays with the protocol pool.</div>`,
        ),
      )}<div style="flex:1"></div>`,
      { appBar: false },
    );
  }
  if (state === "accepted")
    return phoneFrame(
      `${head}${pagepad(
        card(
          `<div class="cardrow">${chip("Accepted", "ok", { dot: true })}${chip("Protocol", "ink")}</div><div class="t-title">Methodology survey</div>${kv("Provider", "Awka Hub — your garden")}${kv("Asked by", "you")}<div class="t-meta">Your garden made this promise. Work and evidence from Awka gardeners anchor to it, and the support that follows goes to the garden.</div><div class="brow">${hot("w25.open-promise", btn("Open the promise", { kind: "pri", full: true }))}</div>`,
        ),
      )}<div style="flex:1"></div>`,
      { appBar: false },
    );
  return phoneFrame(`${head}${pagepad(banner("From the protocol pool — surveys and activations any garden can take up.", "stone", "information-line"), protocolCard)}<div style="flex:1"></div>`, { appBar: false });
}

const W25_HOTS: HifiDef["hots"] = {
  "w25.chooser": { l: "Context chooser", info: "Garden claim: claimant = GardenAccount, requestedBy = you. No custody, no member-delivery via garden claims (AM:38-39)." },
  "w25.continue": { l: "Continue", to: "screen:W25@pending", info: "Creates the claim request with the chosen context's stored terms — claimant, requestedBy, kind, gardenContext (CS:133). Protocol pool defaults steward-reviewed (register #19); W1's pending/declined/superseded grammar applies unchanged.", calls: ["claimCommitment"] },
  "w25.cancel": { l: "Cancel", to: "screen:W25", info: "Closes the provider-context sheet without creating a claim request." },
  "w25.open-promise": { l: "Open the promise", to: "screen:W2@garden-provider", info: "The garden-provided promise opens in the ordinary commitment detail; work and evidence rails are unchanged." },
  "w25.ask": { l: "Ask to take this up", to: "screen:W25@context-chooser", info: "Opens the provider-context sheet before any claim request exists; the garden option renders for eligible stewards only (CS:581). The (Protocol) chip is the only new mark on the card grammar (WF:671)." },
};

// ---------------------------------------------------------------------------
// WFLOW — existing work flow, Review step + MF-7 fulfills row
// ---------------------------------------------------------------------------

function wflow(): string {
  const head = `<div class="hdr"><button type="button" class="hback" aria-label="Close — preview only" disabled>${icon("close-line", "l")}</button><h1>Submit work</h1><span class="hx">${stepDots(3, 2)}</span></div>`;
  return phoneFrame(
    `${head}${pagepad(
      sectionTitle("Review"),
      card(
        listRow({ icon: "image-line", primary: "2 photos", meta: "pruning session" }) +
          hot("wflow.fulfills", listRow({ icon: "hand-heart-line", primary: "Fulfills: Prune the north beds", meta: "Offer · AGRO", chipHtml: chip("Promise", "offer") })),
        { cls: "flat" },
      ),
      `<div class="t-meta">Everything else in this flow is the existing work submission — only the fulfills row is new.</div>`,
      hot("wflow.submit", btn("Submit work", { kind: "pri", full: true })),
    )}<div style="flex:1"></div>`,
    { appBar: false },
  );
}

const WFLOW_HOTS: HifiDef["hots"] = {
  "wflow.fulfills": { l: "Fulfills row (NEW)", info: "The only delta to the existing flow — commitment context on Review (MF-7, UX:174)." },
  "wflow.submit": { l: "Submit work", to: "screen:W2@active", info: "Existing work job + meta.commitmentId; the queue auto-links after sync (UX:220)." },
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
    screen: { id: "WFLOW", title: "Existing work flow (+ fulfills row)", surface: "client", frame: "phone", group: "Client PWA",
      states: [{ id: "review", label: "Review (+ fulfills)", html: wflow() }] },
    hots: WFLOW_HOTS,
  },
];
