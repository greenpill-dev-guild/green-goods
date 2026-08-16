// Member-funded priced-Offer prototype surfaces. W36 is the member read path;
// W37 is the steward checkpoint. Refund dispatch deliberately hands off to the
// ordinary W21/W22 settlement machine instead of drawing a second value rail.

import { hot } from "../html";
import {
  acard, actionBar, adminCanvas, banner, btn, card, chip, deskWin, disclosure, hdr, kv, pagepad, pageHeader, phoneFrame, stateChip, teamstrip,
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
] as const;
type W36State = (typeof W36_STATES)[number][0];

const W36_LABEL: Record<W36State, string> = {
  "waiting-pledge": "Claim sent",
  "deposit-instructions": "Ready to deposit",
  "deposit-sent": "Deposit sent",
  "pending-acceptance": "Waiting for acceptance",
  funded: "Funded",
  "refund-queued": "Returning",
  refunded: "Returned",
};

function w36(state: W36State): string {
  const head = hdr("Design a market poster", { back: true });
  const intro = `<div class="cardrow" style="padding:0 2px">${chip("Offer", "offer")}${chip("40 G$", "plain")}${stateChip(W36_LABEL[state])}</div>
${card(`<div class="cardrow">${teamstrip(["M", "B"])}<span class="t-meta">Maria funds · Ben offers</span></div><div class="t-meta num">1 poster design · Season of First Rains</div>`, { cls: "flat" })}`;

  let status: string;
  switch (state) {
    case "waiting-pledge":
      status = card(`<div class="t-title">Your claim is with the Garden Steward</div><div class="t-meta">Nothing has moved yet. When the funding record is ready, this page will show the garden Safe and the exact amount to send.</div>`);
      break;
    case "deposit-instructions":
      status = `${banner("Send 40 G$ to the garden's recoverable Safe. The garden holds it for this promise until Ben delivers or the refund path opens.", "stone", "shield-check-line")}
${card(`${kv("Send", "40 G$")}${kv("To", "Rocinha garden Safe · 0x8a…2d")}${kv("Refund account", "Maria · 0x12…9a")}${kv("Funding reference", "F-204 · keep with the transfer")}`)}`;
      break;
    case "deposit-sent":
      status = card(`<div class="t-title">Transfer sent</div><div class="t-meta">The Garden Steward is checking the Safe transfer and its funding reference. Ben's Offer is not accepted yet.</div>${kv("Amount", "40 G$")}${kv("Destination", "Rocinha garden Safe")}`);
      break;
    case "pending-acceptance":
      status = `${banner("The full deposit is recorded and held by the garden. The claim now waits for the Garden Steward's decision.", "stone", "checkbox-circle-fill")}
${card(`${kv("Deposit", "40 G$ · recorded")}${kv("Refund account", "Maria · 0x12…9a")}${kv("Offer", "Still waiting for acceptance")}`)}`;
      break;
    case "funded":
      status = `${banner("Your funded claim was accepted. Ben can now deliver the poster; the funding record stays attached to this promise.", "stone", "checkbox-circle-fill")}
${card(`${kv("Held by", "Rocinha garden Safe")}${kv("Funded by", "Maria · 40 G$")}${kv("Next", "Ben delivers · Maria confirms")}`)}`;
      break;
    case "refund-queued":
      status = `${banner("This promise ended without delivery. The garden has queued the recorded 40 G$ back to your refund account.", "stone")}
${card(`${kv("Amount", "40 G$")}${kv("To", "Maria · 0x12…9a")}${kv("Status", "Returning · arrival not confirmed yet")}`)}`;
      break;
    case "refunded":
      status = `${banner("The recorded 40 G$ returned to your refund account.", "stone", "checkbox-circle-fill")}
${card(`${kv("Amount", "40 G$")}${kv("To", "Maria · 0x12…9a")}${kv("Status", "Returned · authenticated receipt")}`)}`;
      break;
  }

  const details = hot(
    "w36.details",
    disclosure(
      "Funding details",
      "garden Safe · recorded account",
      `${kv("Garden Safe", "0x8a…2d")}${kv("Refund account", "0x12…9a · recorded before deposit")}${kv("Funding record", "F-204")}${kv("Promise", "0x8c…41f2")}`,
    ),
  );
  const body = pagepad(intro, status, details);
  const bar = state === "deposit-instructions"
    ? actionBar(hot("w36.send-deposit", btn("Open wallet and send 40 G$", { kind: "pri", full: true })))
    : false;
  return phoneFrame(`${head}${body}<div style="flex:1"></div>`, { appBar: bar });
}

const W36_HOTS: HifiDef["hots"] = {
  "w36.send-deposit": {
    l: "Open wallet and send the deposit",
    to: "screen:W36@deposit-sent",
    info: "This is an ordinary Celo wallet transfer to the registered garden Safe. It is not a pooling-module call and does not prove that the deposit was recorded.",
  },
  "w36.details": {
    l: "Funding details",
    info: "The exact garden Safe, immutable refund account, funding record, and promise reference stay available without exposing them on the browse card.",
  },
};

const w36Facts = (state: W36State): StateFacts => ({
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
] as const;
type W37State = (typeof W37_STATES)[number][0];

function w37(state: W37State): string {
  let body: string;
  switch (state) {
    case "claim":
      body = acard(
        "Maria's claim · funding not yet pledged",
        `${banner("Confirm the claim, price, garden Safe, and Maria's refund account before giving deposit instructions.", "stone")}
${kv("Offer", "Ben · Design a market poster")}${kv("Price", "40 G$ · Celo settlement")}${kv("Claimant / funder", "Maria")}${kv("Refund account", "0x12…9a")}
<div class="actrow" style="justify-content:flex-end">${hot("w37.record-funding", btn("Create funding record", { kind: "pri", sm: true }))}</div>`,
      );
      break;
    case "pledged":
      body = acard(
        "Funding pledged · F-204",
        `${banner("Maria now sees the registered garden Safe and exact amount. Record a deposit only after checking the Safe transfer and its reference.", "stone")}
${kv("Expected", "40 G$")}${kv("Garden Safe", "0x8a…2d")}${kv("Refund account", "Maria · 0x12…9a")}${kv("Safe transfer", "0x7b…21 · 40 G$")}
<div class="actrow" style="justify-content:flex-end">${hot("w37.record-deposit", btn("Record checked deposit", { kind: "pri", sm: true }))}</div>`,
      );
      break;
    case "deposit-recorded":
      body = acard(
        "Deposit recorded · claim waiting",
        `${banner("The full 40 G$ is recorded in the garden Safe. Acceptance and funding consumption are submitted together from this checkpoint.", "stone", "checkbox-circle-fill")}
${kv("Deposit", "40 G$ · reference 0x7b…21")}${kv("Expected", "40 G$")}${kv("Excess", "0 G$")}${kv("Spendable display", "Safe balance minus open earmarks")}
<div class="actrow" style="justify-content:flex-end">${hot("w37.accept-funded", btn("Accept funded claim", { kind: "pri", sm: true }))}</div>`,
      );
      break;
    case "consumed":
      body = acard(
        "Funded claim accepted",
        `${banner("Ben's Offer is Accepted and F-204 is Consumed. The funding fact stays attached while the promise follows its ordinary evidence and confirmation path.", "stone", "checkbox-circle-fill")}
${kv("Provider", "Ben")}${kv("Funder", "Maria · 40 G$")}${kv("Custody", "Rocinha garden Safe")}${kv("If delivered", "Provider payout plan")}`,
      );
      break;
    case "refund-eligible":
      body = acard(
        "Promise ended without delivery",
        `${banner("The Cancelled promise makes this recorded deposit mechanically eligible. Queueing creates one Refund child to Maria's recorded account; an exact repeat returns the same child.", "amber", "error-warning-line")}
${kv("Funding", "F-204 · Consumed")}${kv("Terminal state", "Cancelled")}${kv("Refund", "40 G$ → Maria · 0x12…9a")}${kv("Garden Safe", "Accounting earmark · not a token lock")}
<div class="actrow" style="justify-content:flex-end">${hot("w37.queue-refund", btn("Queue refund", { kind: "pri", sm: true }))}</div>`,
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
  "w37.queue-refund": {
    l: "Queue refund",
    to: "screen:W21@refund-queued",
    info: "queueFundingRefund proves terminal non-fulfillment through the existing pooling read, stores the one funding-to-disbursement relationship, and emits the ordinary Refund child exactly once.",
    calls: ["queueFundingRefund"],
    resultFacts: { funding: "RefundQueued" },
  },
};

const w37Facts = (state: W37State): StateFacts => ({
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
