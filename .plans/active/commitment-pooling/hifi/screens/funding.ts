// Member-funded priced-Offer prototype surfaces. W36 is the member read path;
// W37 is the steward checkpoint. Refund dispatch deliberately hands off to the
// ordinary W21/W22 settlement machine instead of drawing a second value rail.

import { hot } from "../html";
import { icon } from "../icons";
import {
  acard, actionBar, adminCanvas, banner, btn, card, chip, deskWin, detailRow, emptyState, hdr, kv, pagepad, pageHeader, phoneFrame, sectionCard, skeleton, stateChip, teamstrip,
} from "../kit";
import type { StateFacts } from "../types";
import { adminChromeHots } from "./admin";
import type { HifiDef } from "./index";

const W36_STATES = [
  ["waiting-pledge", "Claim sent"],
  ["deposit-instructions", "Deposit instructions"],
  ["deposit-sent", "Deposit sent"],
  ["pending-acceptance", "Deposit recorded"],
  ["funded", "Funded claim accepted"],
  ["refund-queued", "Refund queued"],
  ["refunded", "Refund returned"],
  // Recovery states (2026-08-16 round 12). This is a read surface reached from
  // a link and from the wallet, and it was the only client read surface with
  // none — W1, W2, W5, W28, W32 and W34 all carry the three. A member opening a
  // funding claim on a bad connection previously got a blank page.
  ["loading", "Loading"], ["not-found", "Not found"], ["read-error", "Read error"],
] as const;
type W36State = (typeof W36_STATES)[number][0];

type W36Loaded = Exclude<W36State, "loading" | "not-found" | "read-error">;

const W36_LABEL: Record<W36Loaded, string> = {
  "waiting-pledge": "Claim sent",
  "deposit-instructions": "Ready to deposit",
  "deposit-sent": "Deposit sent",
  "pending-acceptance": "Waiting for acceptance",
  funded: "Funded",
  "refund-queued": "Returning",
  refunded: "Returned",
};

// Status (icon · what happened · what it means) and the facts that matter in
// that state. Rebuilt 2026-08-16 round 10 on the commitment view's anatomy: this
// screen previously hid the garden Safe, the refund account, the funding record
// and the commitment reference behind a "Funding details" drawer — on EVERY one of
// its seven states. Money identifiers are the last thing that should need a tap,
// and this was the highest disclosure-per-state screen in the prototype.
const W36_VIEW: Record<W36Loaded, { ic: string; title: string; info: string; rows: [string, string][] }> = {
  "waiting-pledge": {
    ic: "time-line",
    title: "Your claim is with the Garden Steward",
    info: "Nothing has moved yet. When the funding record is ready, this page shows the garden Safe and the exact amount to send.",
    rows: [["Amount", "40 G$ · not sent yet"]],
  },
  "deposit-instructions": {
    ic: "shield-check-line",
    title: "Ready to deposit",
    info: "Send 40 G$ to the garden's recoverable Safe. The garden holds it for this commitment until Ben delivers or the refund path opens.",
    rows: [["Send", "40 G$"], ["To", "Rocinha garden Safe · 0x8a…2d"], ["Reference", "F-204 · keep with the transfer"]],
  },
  "deposit-sent": {
    ic: "send-plane-line",
    title: "Transfer sent",
    info: "The Garden Steward is checking the Safe transfer and its funding reference. Ben's Offer is not accepted yet.",
    rows: [["Amount", "40 G$"], ["Destination", "Rocinha garden Safe"]],
  },
  "pending-acceptance": {
    ic: "checkbox-circle-fill",
    title: "Deposit recorded",
    info: "The full deposit is recorded and held by the garden. The claim now waits for the Garden Steward's decision.",
    rows: [["Deposit", "40 G$ · recorded"], ["Offer", "Still waiting for acceptance"]],
  },
  funded: {
    ic: "checkbox-circle-fill",
    title: "Funded claim accepted",
    info: "Ben can now deliver the poster; the funding record stays attached to this commitment.",
    rows: [["Held by", "Rocinha garden Safe"], ["Funded by", "Maria · 40 G$"], ["Next", "Ben delivers · Maria confirms"]],
  },
  "refund-queued": {
    ic: "refresh-line",
    title: "Returning to you",
    info: "This commitment ended without delivery. The garden has queued the recorded 40 G$ back to your refund account.",
    rows: [["Amount", "40 G$"], ["Status", "Returning · arrival not confirmed yet"]],
  },
  refunded: {
    ic: "checkbox-circle-fill",
    title: "Returned",
    info: "The recorded 40 G$ returned to your refund account.",
    rows: [["Amount", "40 G$"], ["Status", "Returned · authenticated receipt"]],
  },
};

function w36(state: W36State): string {
  const head = hdr("Design a market poster", { back: true });
  // Read-surface recovery short-circuits before any funding fact is touched —
  // same shape as the commitment view's (client.ts): a pushed read surface, so no
  // bottom nav and no action bar.
  const readWrap = (inner: string) => phoneFrame(`${head}${inner}<div style="flex:1"></div>`, { appBar: false });
  if (state === "loading")
    return readWrap(pagepad(skeleton({ title: true, lines: 1 }), skeleton({ avatar: true, lines: 3 }), skeleton({ lines: 2 })));
  if (state === "not-found")
    return readWrap(
      pagepad(emptyState("search-line", "Funding claim not found", "We couldn't find this claim. It may have been withdrawn, or it hasn't reached this phone yet.", hot("w36.retry", btn("Try again", { kind: "sec", icon: "refresh-line" })))),
    );
  if (state === "read-error")
    return readWrap(
      pagepad(emptyState("wifi-off-line", "Couldn't load this claim", "Something went wrong reaching the network. Nothing has moved. Your deposit and refund account are unaffected.", hot("w36.retry", btn("Try again", { kind: "pri", icon: "refresh-line" })))),
    );
  const v = W36_VIEW[state];
  // People above the fold, the way the commitment view does it — the chips row and
  // the separate identity card collapsed into one line plus the tag row below.
  const people = `<div class="cardrow" style="padding:2px 2px 0">${teamstrip(["M", "B"])}<span class="t-meta">Maria funds · Ben offers</span>${chip("40 G$", "plain")}${stateChip(W36_LABEL[state])}</div>`;
  const status = `<div class="finfo"><span class="fic">${icon(v.ic)}</span><div class="grow"><div class="ft">${v.title}</div><div class="fi">${v.info}</div></div></div>`;
  const body = pagepad(
    people,
    status,
    sectionCard("Details", v.rows.map(([k, val]) => detailRow(k, val)).join("")),
    // The identifiers that were behind the drawer. They belong on the page:
    // a funder checking a Safe address should never have to hunt for it.
    sectionCard(
      "Funding record",
      `${detailRow("Garden Safe", "0x8a…2d")}${detailRow("Refund account", "0x12…9a")}${detailRow("Record", "F-204")}${detailRow("Commitment", "0x8c…41f2")}`,
    ),
  );
  const bar = state === "deposit-instructions"
    ? actionBar(hot("w36.send-deposit", btn("Open wallet and send 40 G$", { kind: "pri", full: true })))
    : false;
  return phoneFrame(`${head}${body}<div style="flex:1"></div>`, { appBar: bar });
}

const W36_HOTS: HifiDef["hots"] = {
  "w36.retry": { l: "Try again", info: "Read recovery on a funding claim: nothing has moved, so retrying only re-reads. The deposit and the recorded refund account are untouched." },
  "w36.send-deposit": {
    l: "Open wallet and send the deposit",
    to: "screen:W36@deposit-sent",
    info: "This is an ordinary Celo wallet transfer to the registered garden Safe. It is not a pooling-module call and does not prove that the deposit was recorded.",
  },
};

const w36Facts = (state: W36State): StateFacts | undefined =>
  state === "loading" || state === "not-found" || state === "read-error" ? undefined : ({
  pool: "Open",
  commitment:
    state === "funded" ? "Accepted"
    : state === "refund-queued" || state === "refunded" ? "Cancelled"
    : "Offered",
  kind: "SupportService",
  funding:
    state === "waiting-pledge" ? "None"
    : state === "deposit-instructions" || state === "deposit-sent" ? "Pledged"
    : state === "pending-acceptance" ? "DepositRecorded"
    : state === "funded" ? "Consumed"
    : state === "refund-queued" ? "RefundQueued"
    : "Refunded",
  disbursement: state === "refund-queued" ? "Queued" : state === "refunded" ? "Confirmed" : undefined,
  disbursementKind: state === "refund-queued" || state === "refunded" ? "Refund" : undefined,
});

const W37_STATES = [
  ["claim", "Funded claim"],
  ["pledged", "Funding pledged"],
  ["deposit-recorded", "Deposit recorded"],
  ["consumed", "Claim accepted"],
  ["refund-eligible", "Refund eligible"],
  ["loading", "Loading"], ["not-found", "Not found"], ["read-error", "Read error"],
] as const;
type W37State = (typeof W37_STATES)[number][0];

function w37(state: W37State): string {
  let body: string;
  switch (state) {
    // The steward's side of a member-funded claim had no read casts at all,
    // while W36 — the gardener's view of the SAME object — carried all three
    // (2026-08-18 round 51, Afo). Money is on the other side of this screen, so
    // an unreadable checkpoint must never look like a claim with nothing on it.
    case "loading":
      body = acard("Funded claim", `${skeleton({ title: true, lines: 2 })}${skeleton({ lines: 3 })}`);
      break;
    case "not-found":
      body = emptyState(
        "search-line",
        "This funded claim could not be found",
        "It may have been withdrawn, or the link may be stale. Nothing was recorded against it and no deposit was touched.",
        hot("w37.retry", btn("Try Again", { kind: "sec", icon: "refresh-line" })),
      );
      break;
    case "read-error":
      body = emptyState(
        "wifi-off-line",
        "Couldn't load this funded claim",
        "Something went wrong reaching the indexer. Any pledge, deposit, or refund already recorded is safe and unchanged, and nothing can be accepted or refunded until this reads.",
        hot("w37.retry", btn("Try Again", { kind: "pri", icon: "refresh-line" })),
      );
      break;
    case "claim":
      body = acard(
        "Maria's claim · funding not yet pledged",
        `${banner("Confirm the claim, price, garden Safe, and Maria's refund account before giving deposit instructions.", "stone")}
${kv("Offer", "Ben · Design a market poster")}${kv("Price", "40 G$ · Celo settlement")}${kv("Claimant / funder", "Maria")}${kv("Refund account", "0x12…9a")}
<div class="actrow" style="justify-content:flex-end">${hot("w37.record-funding", btn("Create Funding Record", { kind: "pri", sm: true }))}</div>`,
      );
      break;
    case "pledged":
      body = acard(
        "Funding pledged · F-204",
        `${banner("Maria now sees the registered garden Safe and exact amount. Record a deposit only after checking the Safe transfer and its reference.", "stone")}
${kv("Expected", "40 G$")}${kv("Garden Safe", "0x8a…2d")}${kv("Refund account", "Maria · 0x12…9a")}${kv("Safe transfer", "0x7b…21 · 40 G$")}
<div class="actrow" style="justify-content:flex-end">${hot("w37.record-deposit", btn("Record Checked Deposit", { kind: "pri", sm: true }))}</div>`,
      );
      break;
    case "deposit-recorded":
      body = acard(
        "Deposit recorded · claim waiting",
        `${banner("The full 40 G$ is recorded in the garden Safe. Acceptance and funding consumption are submitted together from this checkpoint.", "stone", "checkbox-circle-fill")}
${kv("Deposit", "40 G$ · reference 0x7b…21")}${kv("Expected", "40 G$")}${kv("Excess", "0 G$")}${kv("Spendable display", "Safe balance minus open earmarks")}
<div class="actrow" style="justify-content:flex-end">${hot("w37.accept-funded", btn("Accept Funded Claim", { kind: "pri", sm: true }))}</div>`,
      );
      break;
    case "consumed":
      body = acard(
        "Funded claim accepted",
        `${banner("Ben's Offer is Accepted and F-204 is Consumed. The funding fact stays attached while the commitment follows its ordinary proof and confirmation path.", "stone", "checkbox-circle-fill")}
${kv("Provider", "Ben")}${kv("Funder", "Maria · 40 G$")}${kv("Custody", "Rocinha garden Safe")}${kv("If delivered", "Provider payout plan")}`,
      );
      break;
    case "refund-eligible":
      body = acard(
        "Commitment ended without delivery",
        `${banner("The Cancelled commitment makes this recorded deposit mechanically eligible. Queueing creates one Refund child to Maria's recorded account; an exact repeat returns the same child.", "amber", "error-warning-line")}
${kv("Funding", "F-204 · Consumed")}${kv("Terminal state", "Cancelled")}${kv("Refund", "40 G$ → Maria · 0x12…9a")}${kv("Garden Safe", "Accounting earmark · not a token lock")}
<div class="actrow" style="justify-content:flex-end">${hot("w37.queue-refund", btn("Queue Refund", { kind: "pri", sm: true }))}</div>`,
      );
      break;
  }
  const header = pageHeader({
    title: "Funded claim",
    eyebrow: "Garden · priced Offer",
    description: "Record the funding checkpoint, accept the claim, and use the ordinary settlement route if a refund becomes eligible.",
  });
  return deskWin(
    "admin.greengoods.app/garden/pool/funded-claim",
    adminCanvas("garden", "garden", { screenId: "W37", garden: "Rocinha", header, body }),
  );
}

const W37_HOTS: HifiDef["hots"] = {
  "w37.record-funding": {
    l: "Create funding record",
    to: "screen:W37@pledged",
    info: "recordFunding freezes the active claimant, priced Offer amount, garden Safe, and immutable refund account. An exact retry returns the same funding record.",
    calls: ["recordFunding"],
  },
  "w37.record-deposit": {
    l: "Record checked deposit",
    to: "screen:W37@deposit-recorded",
    info: "recordFundingDeposit records the full checked amount and unique Celo transfer reference. At least the frozen expected amount is required; any excess remains part of the refundable recorded deposit.",
    calls: ["recordFundingDeposit"],
  },
  "w37.accept-funded": {
    l: "Accept funded claim",
    to: "screen:W37@consumed",
    info: "The steward accepts the pending priced-Offer claim, then consumeFunding binds the already-recorded deposit to that accepted commitment.",
    calls: ["acceptClaim", "consumeFunding"],
  },
  "w37.retry": { l: "Try again", info: "Read recovery for the steward's funded-claim checkpoint, added round 51. Its client twin W36 has carried loading, not-found and read-error for the same object; this side had none, so an unreadable checkpoint looked like a claim with nothing on it." },
  "w37.queue-refund": {
    l: "Queue refund",
    to: "screen:W21@refund-queued",
    info: "queueFundingRefund proves terminal non-fulfillment through the existing pooling read, stores the one funding-to-disbursement relationship, and emits the ordinary Refund child exactly once.",
    calls: ["queueFundingRefund"],
    resultFacts: { funding: "RefundQueued" },
  },
};

const w37Facts = (state: W37State): StateFacts | undefined =>
  // A read cast draws no record, so it asserts no funding or commitment fact.
  state === "loading" || state === "not-found" || state === "read-error"
    ? undefined
    : ({
  pool: "Open",
  commitment:
    state === "consumed" ? "Accepted"
    : state === "refund-eligible" ? "Cancelled"
    : "Offered",
  kind: "SupportService",
  funding:
    state === "claim" ? "None"
    : state === "pledged" ? "Pledged"
    : state === "deposit-recorded" ? "DepositRecorded"
    : "Consumed",
  settlementAccount: "Active",
    });

export const FUNDING_DEFS: HifiDef[] = [
  {
    screen: {
      id: "W36",
      title: "W36 · Member-funded claim",
      surface: "client",
      frame: "phone",
      group: "Client PWA",
      states: W36_STATES.map(([id, label]) => ({ id, label, facts: w36Facts(id), html: w36(id) })),
    },
    hots: W36_HOTS,
  },
  {
    screen: {
      id: "W37",
      title: "W37 · Funded claim checkpoint",
      surface: "admin",
      frame: "desktop",
      group: "Admin console",
      states: W37_STATES.map(([id, label]) => ({ id, label, facts: w37Facts(id), html: w37(id) })),
    },
    hots: { ...adminChromeHots("w37", "garden"), ...W37_HOTS },
  },
];
