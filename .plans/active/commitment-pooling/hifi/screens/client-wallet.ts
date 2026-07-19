// Client PWA hi-fi screens, wallet + protocol set — W5 WalletDrawer pools
// panel, W23 wallet G$ section, W25 protocol-pool claim, WFLOW (existing work
// flow + the MF-7 fulfills row). Same dialect and copy rules as client.ts.
// Dissolved lo-fi variants: W23G → W23@delivery-blocked, MF8 → W25@context-chooser.
// W6's retired home summary card lives on as the W5 header line (decision #28f).

import { hot } from "../html";
import { icon } from "../icons";
import {
  banner, btn, card, chip, field, hdr, input, kv, listRow, meter, pagepad,
  phoneFrame, radio, sectionTitle, seg, sheetOver, stepDots,
} from "../kit";
import type { HifiDef } from "./index";

// ---------------------------------------------------------------------------
// W5 — WalletDrawer pools panel (uiux-spec §5.8; absorbs W6's summary line)
// ---------------------------------------------------------------------------

const W5_STATES = [
  ["default", "Pools"], ["queued", "Queued rows"], ["waiting-membership", "Waiting rows"], ["empty", "Empty"],
] as const;
type W5State = (typeof W5_STATES)[number][0];

const walletShell = (inner: string, active = 2) =>
  sheetOver(
    `${hdr("Home")}`,
    "Wallet",
    `${hot("w5.seg", seg(["Jar", "Vault", "Pools"], active))}${inner}`,
  );

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
    default:
      inner = `${hot("w5.summary", `<div class="t-meta num">7 of 9 promises kept this cycle across your gardens</div>`)}
${sectionTitle("Waiting on you")}
${card(
        hot("w5.inbox-row", listRow({ icon: "hand-heart-line", primary: "Maria — Prune the north beds", meta: "Rocinha · confirm when kept", chevron: true })) +
          listRow({ icon: "hand-heart-line", primary: "TAS Hub — Field survey ride", meta: "Awka · confirm when kept", chevron: true }),
        { cls: "flat" },
      )}
${sectionTitle("My commitments")}
${card(
        `<div class="t-meta">Rocinha Community Garden</div>` +
          hot("w5.mine-row", listRow({ icon: "seedling-line", primary: "Ride to market", meta: "Accepted", chevron: true })) +
          `<div class="t-meta" style="margin-top:6px">Muizenberg</div>` +
          listRow({ icon: "seedling-line", primary: "Beach cleanup Saturday", meta: "Fulfilled", chipHtml: chip("Kept", "ok") }),
        { cls: "flat" },
      )}`;
  }
  return phoneFrame(walletShell(inner), { offline: state === "queued" });
}

const W5_HOTS: HifiDef["hots"] = {
  "w5.seg": { l: "Wallet panels", info: "Jar · vault · pools — the pools panel is the cross-garden commitments home (UX:186)." },
  "w5.summary": { l: "Cycle summary line", info: "W6's retired home card lives on as this header line (#28f); absolute numbers below the small-community threshold (UX:191)." },
  "w5.inbox-row": { l: "Pending confirmation", to: "screen:W4", info: "Inbox of promises waiting on YOUR confirmation, across gardens (UX:185)." },
  "w5.mine-row": { l: "My commitment", to: "screen:W2", info: "Your own promises grouped by garden." },
};

// ---------------------------------------------------------------------------
// W23 — wallet G$ section + send (settlement-spec §7; W23G dissolved)
// ---------------------------------------------------------------------------

const W23_STATES = [
  ["balance", "Support received"], ["send", "Send"], ["send-pending", "Sending"], ["delivery-blocked", "Delivery blocked"],
] as const;
type W23State = (typeof W23_STATES)[number][0];

function w23(state: W23State): string {
  let inner: string;
  switch (state) {
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
    case "delivery-blocked":
      inner = `${card(
        `<div class="cardrow">${chip("Planned", "queued")}<div class="t-title">Member delivery isn't on yet</div></div><div class="t-meta">The Celo account and sponsored-send path hasn't passed its round-trip check. Garden-to-garden funding continues; personal balances and Send wait.</div>${hot("w23.tech-status", btn("View technical status", { kind: "ghost" }))}`,
      )}`;
      break;
    default:
      inner = `${card(
        `<div class="cardrow"><div class="grow"><div class="t-title">Support received</div><div class="t-meta">G$ · Celo</div></div><div class="t-title num">128 G$</div></div>` +
          hot("w23.arrived-row", listRow({ icon: "checkbox-circle-fill", primary: "+20 G$ — Prune the north beds", meta: "Arrived · oracle-verified ↗", chipHtml: chip("Arrived", "ok") })) +
          listRow({ icon: "time-line", primary: "+15 G$ — Market rides", meta: "On its way" }),
        { cls: "flat" },
      )}
${hot("w23.send", btn("Send G$", { kind: "pri", full: true, icon: "send-plane-line" }))}`;
  }
  return phoneFrame(walletShellG(inner));
}

const walletShellG = (inner: string) => sheetOver(`${hdr("Home")}`, "Wallet", `${seg(["Jar", "Vault", "Pools"], 2)}${inner}`);

const W23_HOTS: HifiDef["hots"] = {
  "w23.send": { l: "Send G$", to: "screen:W23@send", info: "Online-only wallet action, sponsored gas — never enters the offline queue (UX:219)." },
  "w23.send-submit": { l: "Send", info: "Wallet-pending → confirmed; failure surfaces inline with retry (UX:219)." },
  "w23.arrived-row": { l: "Arrived row", info: "“Arrived” always means oracle-verified — a reported transfer alone never renders as arrived (SS:398)." },
  "w23.tech-status": { l: "Technical status", info: "AA/paymaster gate failed: member delivery + sends stay off; Safe-to-Safe garden funding continues (SS:425)." },
};

// ---------------------------------------------------------------------------
// W25 — protocol-pool claim (wireframes.md:671; MF8 dissolved into chooser)
// ---------------------------------------------------------------------------

const W25_STATES = [
  ["card", "Protocol card"], ["context-chooser", "Provider context"], ["pending", "Waiting for review"],
] as const;
type W25State = (typeof W25_STATES)[number][0];

function w25(state: W25State): string {
  const protocolCard = card(
    `<div class="cardrow">${chip("Protocol", "ink")}${chip("Request", "request")}</div><div class="t-title">Methodology survey</div><div class="t-meta num">1 survey · stewards review who takes this up</div>${hot(
      "w25.context",
      radio([{ label: "As myself", on: true }, { label: "For Awka Hub", meta: "eligible stewards only" }]),
    )}${hot("w25.ask", btn("Ask to take this up", { kind: "pri", full: true }))}`,
  );
  const head = hdr("Rocinha Community Garden", { back: true });

  if (state === "context-chooser") {
    const behind = `${head}${pagepad(protocolCard)}`;
    return phoneFrame(
      sheetOver(
        behind,
        "Take this up…",
        `${hot("w25.chooser", radio([{ label: "As myself", meta: "the promise is yours" }, { label: "For Awka Hub", meta: "you steward this garden", on: true }]))}
${banner("Working for the garden: its account makes the promise; you remain the requester.", "stone", "group-line")}
${hot("w25.continue", btn("Continue", { kind: "pri", full: true }))}${btn("Cancel", { kind: "ghost", full: true })}`,
      ),
    );
  }
  if (state === "pending") {
    return phoneFrame(
      `${head}${pagepad(
        card(
          `<div class="cardrow">${chip("Waiting for review", "warn", { dot: true })}${chip("Protocol", "ink")}</div><div class="t-title">Methodology survey</div>${kv("Claimant", "Awka Hub (garden)")}${kv("Asked by", "you")}<div class="t-meta">Work and evidence will anchor to your garden; the promise stays with the protocol pool.</div>`,
        ),
      )}<div style="flex:1"></div>`,
    );
  }
  return phoneFrame(`${head}${pagepad(banner("From the protocol pool — surveys and activations any garden can take up.", "stone", "information-line"), protocolCard)}<div style="flex:1"></div>`);
}

const W25_HOTS: HifiDef["hots"] = {
  "w25.context": { l: "Provider context", to: "screen:W25@context-chooser", info: "Garden option renders for eligible stewards only (CS:581). The (Protocol) chip is the only new mark on the card grammar (WF:671)." },
  "w25.chooser": { l: "Context chooser", info: "Garden claim: claimant = GardenAccount, requestedBy = you. No custody, no member-delivery via garden claims (AM:38-39)." },
  "w25.continue": { l: "Continue", to: "screen:W1@claim-pending", info: "Protocol pool defaults steward-reviewed (#19); W1's pending/declined/superseded grammar applies unchanged." },
  "w25.ask": { l: "Ask to take this up", to: "screen:W25@pending", info: "Creates the claim request with stored terms — claimant, requestedBy, kind, gardenContext (CS:133)." },
};

// ---------------------------------------------------------------------------
// WFLOW — existing work flow, Review step + MF-7 fulfills row
// ---------------------------------------------------------------------------

function wflow(): string {
  const head = `<div class="hdr"><button type="button" class="hback" aria-label="Close">${icon("close-line", "l")}</button><h1>Submit work</h1><span class="hx">${stepDots(3, 2)}</span></div>`;
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
      states: W23_STATES.map(([id, label]) => ({ id, label, proposed: id === "delivery-blocked", html: w23(id) })) },
    hots: W23_HOTS,
  },
  {
    screen: { id: "W25", title: "W25 · Protocol-pool claim", surface: "client", frame: "phone", group: "Client PWA",
      states: W25_STATES.map(([id, label]) => ({ id, label, proposed: id === "context-chooser", html: w25(id) })) },
    hots: W25_HOTS,
  },
  {
    screen: { id: "WFLOW", title: "Existing work flow (+ fulfills row)", surface: "client", frame: "phone", group: "Client PWA",
      states: [{ id: "review", label: "Review (+ fulfills)", proposed: true, html: wflow() }] },
    hots: WFLOW_HOTS,
  },
];
