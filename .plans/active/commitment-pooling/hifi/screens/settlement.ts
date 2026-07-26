// Admin hi-fi screens, settlement + operations set — W12 community pools,
// W21 settlement section, W22 command/ack console, W24 operations
// workspace, W26 cycle-close wizard (absorbs MF-9's reconciliation report).
// Settlement label discipline (settlement-spec §7): dispatched and Celo-executed
// states are never member-visible arrival proof; only an authenticated CCIP
// success acknowledgment produces “Confirmed”. G$ stays on Celo — no bridge language, ever.

import { hot } from "../html";
import { icon } from "../icons";
import { banner, btn, chip, disclosure, field, input, kv, radio, stepDots } from "../kit";
import { acard, adminCanvas, adminChromeHots, adminDialogM3, deskWin, dtable, pageHeader, stages, tabRail } from "./admin";
import type { HifiDef } from "./index";

// ---------------------------------------------------------------------------
// W12 — Community workspace, Pools mode (uiux-spec §6.8, rescoped 2026-07-18)
// ---------------------------------------------------------------------------

const W12_STATES = [["protocol", "Protocol pool"], ["current-garden", "This garden"]] as const;
type W12State = (typeof W12_STATES)[number][0];

function w12(state: W12State): string {
  // The toggle tabs ARE this screen's states — wire each inactive tab to navigate.
  const ix = state === "protocol" ? 0 : 1;
  const rail = tabRail(
    [
      { label: "Protocol pool", hot: "w12.tab-protocol" },
      { label: "This garden", hot: "w12.tab-garden" },
    ],
    ix,
  );
  const inner =
    state === "current-garden"
      ? acard(
          "Rocinha pool",
          `<div class="arow"><div class="grow"><b>Season of First Rains</b> <span class="t-meta">Open · 2 campaigns</span></div><span class="t-meta num">kept 7/9 · 18 units promised</span></div>
${hot("w12.no-ranking", banner("This workspace shows the Protocol pool and Rocinha only. All-garden oversight lives in deployer-gated Operations.", "stone"))}`,
        )
      : `${acard(
          "Funding view",
          `<div class="arow"><div class="grow">20 DAI · protocol treasury → Field survey <span class="t-meta">co-funded with Awka Hub</span></div>${chip("Reference", "plain")}</div>`,
          chip("read only here", "plain"),
        )}
${acard(
          "Claims across gardens — steward-reviewed",
          `<div class="arow"><div class="grow"><b>Methodology survey</b> · Awka Hub (garden claim) · asked by Leila</div>${hot("w12.accept", btn("Accept", { kind: "pri", sm: true }))}${hot("w12.decline", btn("Decline…", { kind: "sec", sm: true }))}</div>`,
        )}
${acard(
          "Confirmations queue",
          `<div class="arow">${hot("w12.confirm-row", `<div class="grow"><b>Field survey</b> — 1 of 2 confirmed</div>`)}${icon("arrow-right-s-line", "s")}</div>`,
        )}`;
  const header = pageHeader({
    title: "Community",
    eyebrow: "Pools",
    description: "The protocol pool and this garden — all-garden oversight lives in Operations.",
  });
  return deskWin(
    "admin.greengoods.app/dashboard/community/pools",
    adminCanvas("community", "community", { screenId: "W12", garden: "Rocinha", header, tabRail: rail, body: inner }),
  );
}

const W12_HOTS: HifiDef["hots"] = {
  "w12.tab-protocol": { l: "Protocol pool tab", to: "screen:W12@protocol", info: "The root protocol pool view." },
  "w12.tab-garden": { l: "This garden tab", to: "screen:W12@current-garden", info: "This garden's pool scope only." },
  "w12.accept": { l: "Accept a garden claim", to: "screen:W25@accepted", info: "Protocol steward accepts stored terms; providerGarden derives and the claimant garden sees it accepted (CS:733)." },
  "w12.decline": { l: "Decline a garden claim", info: "Declines this garden claim with a required reason while leaving other pending requests intact (CS:734)." },
  "w12.confirm-row": { l: "Confirmations queue", to: "screen:W10@garden-ready", info: "Protocol confirmations queue mirrors the Hub Confirm grammar (WF:417)." },
  "w12.no-ranking": { l: "Garden scope boundary", info: "No other-garden rows or command/ack controls render here; all-garden operations live in W24 (UX:314)." },
};

// ---------------------------------------------------------------------------
// W21 — garden settlement section (settlement-spec §7)
// ---------------------------------------------------------------------------

const W21_STATES = [
  ["queue", "Disbursement queue"], ["unregistered", "No account yet"],
  ["failed-recovery", "Failed — recovery"], ["gate-status", "Delivery gate"],
  ["close-delivery-confirm", "Close delivery — confirm"], ["protocol-queue", "Protocol queue — garden beneficiary"],
] as const;
type W21State = (typeof W21_STATES)[number][0];

// Columns name what the cells actually hold: the first is a settlement id and
// attempt, not a member. "source facts" placeholders read as content in a
// review, so the amounts are plausible values instead.
const w21Rows = () =>
  dtable(
    ["Settlement · attempt", "Recipient", "Kind", "Amount", "State", ""],
    [
      ["104 · attempt 0", "Maria", "Reward — member", `<span class="num">20 G$</span>`, chip("Queued", "plain", { dot: true }), `${hot("w21.dispatch", btn("Dispatch", { kind: "sec", sm: true }))}${hot("w21.cancel-disb", btn("Cancel", { kind: "ghost", sm: true }))}`],
      ["103 · attempt 1", "João", "Reward — member", `<span class="num">15 G$</span>`, chip("Failed — route rejected", "err"), `${hot("w21.requeue", btn("Source follow-up", { kind: "sec", sm: true }))}${hot("w21.cancel-failed", btn("Close delivery", { kind: "ghost", sm: true }))}`],
      ["102 · attempt 0", "Ana", "Reward — member", `<span class="num">12 G$</span>`, chip("Confirming arrival", "warn", { dot: true }), hot("w21.request-details", btn("Ack details", { kind: "ghost", sm: true }))],
      ["101 · attempt 0", "Kwame", "Reward — member", `<span class="num">18 G$</span>`, chip("Confirmed ↗", "ok", { dot: true }), ""],
    ],
    "Rocinha settlement disbursement queue",
  );

// Dimmed settlement route behind a confirmation, hotspot-free so foreign ids
// cannot break bidirectional integrity on the confirm state.
const w21Behind = () =>
  adminCanvas("garden", "garden", {
    screenId: "W21",
    garden: "Rocinha",
    interactiveChrome: false,
    header: pageHeader({ title: "Settlement", eyebrow: "Garden · Celo", description: "The garden's Celo settlement account — disbursement queue, batches, and delivery gate." }),
    body: acard("Settlement (Celo)", `${kv("Settlement 103 / attempt 1", "Failed — route rejected")}`),
  });

function w21(state: W21State): string {
  if (state === "close-delivery-confirm")
    return deskWin(
      "admin.greengoods.app/dashboard/garden/settlement",
      adminDialogM3(w21Behind(), "garden", {
        title: "Close this delivery",
        body:
          banner(
            "Settlement 103 failed with an authenticated route rejection. Closing ends this delivery for good — the failed attempt and its bounded failure code stay visible, and no new execution key is created.",
            "amber",
            "error-warning-line",
          ) + field("Reason (required)", input("recipient account cannot receive; handled off-platform")),
        actions: `${hot("w21.close-dismiss", btn("Keep for retry", { kind: "ghost" }))}${hot("w21.close-delivery-confirm", btn("Close delivery", { kind: "danger" }))}`,
        closeHot: "w21.close-dismiss",
      }),
    );

  if (state === "protocol-queue") {
    // The protocol pool's own queue. Every other row in this artifact pays an
    // individual; here the beneficiary is a garden's Celo Safe, which is what
    // a garden-claimed protocol commitment settles to (AM:43).
    const rows = dtable(
      ["Settlement · attempt", "Recipient", "Kind", "Amount", "State", ""],
      [
        ["105 · attempt 0", "Awka Hub — garden Safe", "Reward — garden", `<span class="num">25 G$</span>`, chip("Queued", "plain", { dot: true }), hot("w21.dispatch-garden", btn("Dispatch", { kind: "sec", sm: true }))],
        ["98 · attempt 0", "Leila", "Reward — member", `<span class="num">10 G$</span>`, chip("Confirmed ↗", "ok", { dot: true }), ""],
      ],
      "Protocol pool settlement queue",
    );
    const header = pageHeader({
      title: "Settlement",
      eyebrow: "Protocol · Celo",
      description: "The protocol pool's Celo settlement account — garden-beneficiary rewards sit beside member ones.",
    });
    return deskWin(
      "admin.greengoods.app/dashboard/community/pools/settlement",
      adminCanvas("community", "community", {
        screenId: "W21",
        garden: "Rocinha",
        header,
        body: acard("Settlement (Celo) — protocol pool", `${rows}${banner("Source is the GG protocol Safe; a garden beneficiary is the providing garden's registered Celo Safe, never its Arbitrum account.", "stone")}`),
      }),
    );
  }

  let inner: string;
  switch (state) {
    case "unregistered":
      inner = acard(
        "Settlement (Celo)",
        `<div class="t-meta">No registered settlement account yet. Safe creation and the 2-of-3 recovery/Roles policy are Release-gated. After governance deploys and verifies that route, a steward can register the existing account here.</div>${hot("w21.setup", btn("Review registration requirements", { kind: "sec" }))}`,
      );
      break;
    case "gate-status":
      inner = acard(
        "Member delivery gate — read-only status",
        `${kv("Member delivery", "enabled")}${kv("Changed by", "0x9a…4f (owner)")}${kv("Date", "Jul 30")}${kv("Evidence", "round-trip check ↗")}
${banner("The flip itself is owner-only ops — this row keeps the gate legible to every steward.", "stone")}`,
      );
      break;
    case "failed-recovery":
      inner = `${acard(
        "Settlement (Celo)",
        `${kv("Safe route", "external production gate")}${kv("Celo result", "route rejected")}
${banner("An authenticated route failure permits an explicit next attempt. Delivery delay alone never does.", "amber", "error-warning-line")}
${w21Rows()}`,
      )}`;
      break;
    default:
      // The queue is why a steward opens this section; account and reserve
      // status is standing context and folds away.
      inner = `${acard(
        "Settlement (Celo)",
        `${w21Rows()}
${disclosure(
          "Account status",
          "source · reserves · gate",
          `${kv("Source", "canonical pooling interface pending")}${kv("Fee reserve", "native ETH / CELO monitored")}
<div class="arow">${hot("w21.gate-row", `<div class="grow">Member delivery: <b>enabled</b> <span class="t-meta">· changed by 0x9a…4f · Jul 30 · evidence ↗</span></div>`)}</div>
<div class="arow"><div class="grow">CCIP: peers configured · command/ack fee reserves monitored</div></div>`,
        )}`,
        hot("w21.create-batch", btn("Open command", { kind: "pri", sm: true })),
      )}`;
  }
  const header = pageHeader({
    title: "Settlement",
    eyebrow: "Garden · Celo",
    description: "The garden's Celo settlement account — disbursement queue, batches, and delivery gate.",
  });
  return deskWin(
    "admin.greengoods.app/dashboard/garden/settlement",
    adminCanvas("garden", "garden", { screenId: "W21", garden: "Rocinha", header, body: inner }),
  );
}

const W21_HOTS: HifiDef["hots"] = {
  "w21.dispatch-garden": { l: "Dispatch to the garden Safe", to: "screen:W22@garden-command", info: "Sends the data-only command for the garden-beneficiary reward; the Celo executor delivers G$ from the GG protocol Safe to the providing garden's Safe." },
  "w21.setup": { l: "Review registration requirements", to: "screen:W21", info: "Read-only prerequisite summary. Production governance deploys and verifies the Safe/Zodiac route separately; this surface later registers the already-deployed account." },
  "w21.gate-row": { l: "Delivery-gate status row", info: "Read-only (register #34f): enabled/disabled · changed by · date · evidence. The flip is owner-only ops (SS:172)." },
  "w21.dispatch": { l: "Dispatch", to: "screen:W22", info: "The stored steward, module owner, or configured dispatcher sends the immutable queued command from the monitored unreserved native ETH balance." },
  "w21.requeue": { l: "Source follow-up", to: "screen:W21", info: "A next attempt requires an authenticated failure and the future source integration." },
  "w21.cancel-disb": { l: "Cancel unbatched queued command", info: "The planned `cancelDisbursement` path is available before dispatch only when `batchId == 0`; an immutable Queued batch is cancelled only in full." },
  "w21.cancel-failed": { l: "Close failed delivery", to: "screen:W21@close-delivery-confirm", info: "An authenticated Failed member may be terminally cancelled instead of requeued. The failed attempt and bounded failure code remain visible." },
  "w21.close-dismiss": { l: "Keep for retry", to: "screen:W21@failed-recovery", info: "Closes the confirmation, leaving the failed member available for a source follow-up." },
  "w21.close-delivery-confirm": { l: "Close delivery (confirm)", to: "screen:W21", info: "Failed → Cancelled preserves the failed attempt and creates no new execution key (SS §3.1)." },
  "w21.request-details": { l: "Acknowledgment details", info: "Celo execution is stored before its acknowledgement and can remain confirming while the source state is Dispatched." },
  "w21.create-batch": { l: "Open command", to: "screen:W22", info: "The planned UI is transport-level; commitment batches depend on the canonical pooling source integration." },
};

// ---------------------------------------------------------------------------
// W22 — command/ack console (settlement-spec §7)
// ---------------------------------------------------------------------------

const W22_STATES = [
  ["ready", "Queued"], ["dispatched", "Dispatched"], ["delivery-delayed", "Delivery delayed"], ["executed", "Celo executed"],
  ["acknowledgment-pending", "Acknowledgment pending"], ["outcome", "Confirmed / failed"], ["role-guard", "Route gate"],
  ["cancel-batch-confirm", "Cancel batch — confirm"], ["garden-command", "Garden-beneficiary command"],
] as const;
type W22State = (typeof W22_STATES)[number][0];

const w22Members = dtable(
  ["Member", "Amount", "To"],
  [["Maria", `<span class="num">20 G$</span>`, `<span class="num">0x12…9a</span>`], ["João", `<span class="num">15 G$</span>`, `<span class="num">0x77…3c</span>`]],
  "Batch #12 members",
);

// Dimmed batch route behind the cancel confirmation, hotspot-free.
const w22Behind = () =>
  adminCanvas("garden", "garden", {
    screenId: "W22",
    garden: "Rocinha",
    interactiveChrome: false,
    header: pageHeader({ title: "Settlement 104", eyebrow: "Command/ack console", description: "The source sends a data-only command and waits for the bounded Celo executor acknowledgment." }),
    body: acard("Batch", `${kv("Batch #12", "2 immutable members · Maria 20 G$ · João 15 G$")}${stages(["Queued", "Dispatched", "Celo executed", "Confirmed"], 0)}`),
  });

function w22(state: W22State): string {
  if (state === "cancel-batch-confirm")
    return deskWin(
      "admin.greengoods.app/dashboard/garden/settlement/batch",
      adminDialogM3(w22Behind(), "garden", {
        title: "Cancel this batch",
        body:
          banner(
            "Cancelling closes all 2 members of batch #12 at once — Maria (20 G$) and João (15 G$). Queued batch membership is immutable, so there is no partial cancellation and no member can be kept.",
            "amber",
            "error-warning-line",
          ) + field("Reason (required)", input("garden withdrew the request before dispatch")),
        actions: `${hot("w22.cancel-dismiss", btn("Keep batch queued", { kind: "ghost" }))}${hot("w22.cancel-batch-confirm", btn("Cancel batch", { kind: "danger" }))}`,
        closeHot: "w22.cancel-dismiss",
      }),
    );

  if (state === "garden-command") {
    const header = pageHeader({
      title: "Settlement 105",
      eyebrow: "Command/ack console",
      description: "The source sends a data-only command and waits for the bounded Celo executor acknowledgment.",
    });
    return deskWin(
      "admin.greengoods.app/dashboard/community/pools/settlement/command",
      adminCanvas("community", "community", {
        screenId: "W22",
        garden: "Rocinha",
        header,
        body: acard(
          "Command",
          `${stages(["Queued", "Dispatched", "Celo executed", "Confirmed"], 1)}
${banner("Dispatched with its immutable execution key. The Celo executor moves 25 G$ from the GG protocol Safe to Awka Hub's Safe, stores the outcome, then acknowledges — arrival is not proven until that acknowledgment lands.", "stone")}
${kv("Command message", "0xbd…07 · CCIP Explorer ↗")}${kv("Payer", "GG protocol Safe · Celo")}${kv("Recipient", "Awka Hub · garden Safe on Celo")}${kv("Amount", "25 G$ · canonical")}
<div class="actrow" style="justify-content:flex-end">${hot("w22.garden-open-ops", btn("Open Operations", { kind: "sec", icon: "external-link-line" }))}</div>`,
        ),
      }),
    );
  }

  // Status first. On every one of these states the operator's question is "what
  // changed, and what can I do?" — and every state used to open with the same
  // four rows of route datasheet above the answer.
  const routeDetails = disclosure(
    "Route details",
    "payer · route · batch",
    `${kv("Settlement 104 — attempt 0", "message-only command · no token amounts")}${kv("Payer", "Rocinha owning-pool Safe · Celo")}${kv("Route snapshot", "Celo selector · executor 0x5e…91 · v1 · 240,000 gas")}${kv("Batch #12", "2 immutable members · limit 8 · ceiling 24")}`,
  );
  let inner: string;
  const stage = (n: number) => stages(["Queued", "Dispatched", "Celo executed", "Confirmed"], n);
  const endRow = (...b: string[]) => `<div class="actrow" style="justify-content:flex-end">${b.join("")}</div>`;
  switch (state) {
    case "dispatched":
      inner = `${stage(1)}
${banner("The command has been dispatched with the immutable execution key. A same-key retry changes only the CCIP message ID.", "stone")}
${endRow(hot("w22.open-command-explorer", btn("Open CCIP Explorer", { kind: "sec", icon: "external-link-line" })))}
${kv("Command message", "0xab…11 · CCIP Explorer ↗")}${kv("Destination execution", "Pending · manual execution not yet eligible")}
${w22Members}${routeDetails}`;
      break;
    case "delivery-delayed":
      inner = `${stage(1)}
${banner("Delivery is past the configured service window. This is a derived operational condition, not a contract mutation or payment failure.", "amber")}
${endRow(hot("w22.manual-execution-guide", btn("Manual-execution guidance", { kind: "ghost", icon: "external-link-line" })), hot("w22.retry-command", btn("Retry same command", { kind: "pri" })))}
${kv("Command message", "0xab…11 · CCIP Explorer ↗")}${kv("Manual execution", "Follow CCIP guidance only when Explorer marks this message eligible")}
${w22Members}${routeDetails}`;
      break;
    case "executed":
      inner = `${stage(2)}
${banner("Celo has stored its idempotent outcome. The source stays Dispatched until an authenticated acknowledgment arrives.", "stone")}
${endRow(hot("w22.open-destination-explorer", btn("Open destination transaction", { kind: "ghost", icon: "external-link-line" })), hot("w22.retry-acknowledgment", btn("Retry acknowledgment", { kind: "pri" })))}
${kv("Command message", "0xab…11 · CCIP Explorer ↗")}${kv("Destination transaction", "0xce…42 · Celoscan ↗")}${kv("Acknowledgment", "Not submitted · reserve recovery available")}
${w22Members}${routeDetails}`;
      break;
    case "acknowledgment-pending":
      inner = `${stage(2)}
${kv("Status", "Celo executed · acknowledgment pending")}
<div class="arow"><div class="grow">A delayed acknowledgment never invokes the Safe route again.</div>${hot("w22.retry-acknowledgment-again", btn("Retry acknowledgment", { kind: "sec", sm: true }))}</div>
${kv("Command message", "0xab…11 · CCIP Explorer ↗")}${kv("Destination transaction", "0xce…42 · Celoscan ↗")}${kv("Acknowledgment message", "0xac…09 · CCIP Explorer ↗")}
${routeDetails}`;
      break;
    case "outcome":
      inner = `<div class="arow"><div class="grow"><b>Settlement 101</b></div>${chip("Confirmed ↗", "ok", { dot: true })}</div>
<div class="arow"><div class="grow"><b>Settlement 103</b> <span class="t-meta">route rejected</span></div>${chip("Failed", "err")}${hot("w22.requeue-member", btn("Source follow-up", { kind: "sec", sm: true }))}</div>
${banner("Duplicate or stale terminal acknowledgments are emitted, ignored, and remain observable; they never mutate the settled source state.", "stone")}
<div class="quietok">${icon("check-line")}Only a confirmed outcome tells the member their support arrived.</div>
${routeDetails}`;
      break;
    case "role-guard":
      inner = `${banner("The production Safe/Zodiac route is outside this plan-only pass. Before enabling value, the release checklist must prove a scoped executor role, no Safe ownership, canonical-G$ selectors, and caps.", "amber", "shield-check-line")}
${btn("Production route required", { kind: "sec", disabled: true })}
${routeDetails}`;
      break;
    default:
      // M3 action row: the destructive act sits at the far left, the
      // constructive pair right-aligned, so an atomic batch cancel is never one
      // slip away from dispatch. Full-width stacked capsules were client
      // grammar on a desktop console.
      inner = `${stage(0)}
${banner("Queued batch membership is immutable. Cancellation applies atomically to both members; no member-level action is available.", "amber")}
<div class="actrow" style="justify-content:space-between">${hot("w22.cancel-batch", btn("Cancel whole batch", { kind: "danger", sm: true }))}<span style="display:flex;gap:8px">${hot("w22.route-gate", btn("Open route gate", { kind: "ghost", icon: "external-link-line" }))}${hot("w22.dispatch-command", btn("Dispatch command", { kind: "pri" }))}</span></div>
${w22Members}${routeDetails}`;
  }
  const header = pageHeader({
    title: "Settlement 104",
    eyebrow: "Command/ack console",
    description: "The source sends a data-only command and waits for the bounded Celo executor acknowledgment.",
  });
  return deskWin(
    "admin.greengoods.app/dashboard/garden/settlement/batch",
    adminCanvas("garden", "garden", { screenId: "W22", garden: "Rocinha", header, body: acard("Batch", inner) }),
  );
}

const W22_HOTS: HifiDef["hots"] = {
  "w22.garden-open-ops": { l: "Open Operations", to: "screen:W24@flows", info: "The cross-garden funds board is where a garden-beneficiary delivery is watched to arrival; it is deployer-gated." },
  "w22.route-gate": { l: "Open route gate", info: "The production typed Safe/Zodiac route is a release gate, not an implemented adapter." },
  "w22.cancel-batch": { l: "Cancel whole queued batch", to: "screen:W22@cancel-batch-confirm", info: "Requires a reason and blast-radius confirmation. `cancelBatch` atomically marks the Queued batch and every immutable member Cancelled-from-Queued; partial cancellation is impossible." },
  "w22.cancel-dismiss": { l: "Keep batch queued", to: "screen:W22", info: "Closes the confirmation with the batch untouched." },
  "w22.cancel-batch-confirm": { l: "Cancel batch (confirm)", to: "screen:W21", info: "cancelBatch atomically marks the Queued batch and every immutable member Cancelled-from-Queued (SS §3.1.3)." },
  "w22.dispatch-command": { l: "Dispatch command", to: "screen:W22@dispatched", info: "The stored steward, module owner, or configured dispatcher sends the immutable queued command from the monitored unreserved native ETH balance." },
  "w22.open-command-explorer": { l: "Open command in CCIP Explorer", to: "screen:W22@delivery-delayed", info: "The command message ID opens transport status. This prototype advances to the derived delayed example." },
  "w22.manual-execution-guide": { l: "Manual-execution guidance", info: "Manual execution is an external CCIP recovery procedure and appears only when CCIP Explorer reports the message eligible; it never marks payment complete." },
  "w22.retry-command": { l: "Retry command", to: "screen:W22@executed", info: "A transport retry preserves the execution key and payload, and cannot create a second Celo execution." },
  "w22.open-destination-explorer": { l: "Open destination transaction", info: "The destination transaction is evidence of Celo execution, but arrival remains unconfirmed until the authenticated acknowledgment reaches Arbitrum." },
  "w22.retry-acknowledgment": { l: "Retry acknowledgment", to: "screen:W22@acknowledgment-pending", info: "Permissionless destination retry sends the stored outcome without moving G$ again." },
  "w22.retry-acknowledgment-again": { l: "Retry acknowledgment", info: "CELO reserve or delivery recovery may retry the stored acknowledgment independently." },
  "w22.requeue-member": { l: "Source follow-up", info: "A new source attempt requires an authenticated failure acknowledgment and integration-owned source facts." },
};

// ---------------------------------------------------------------------------
// W24 — Operations workspace (wireframes.md:643, deployer-gated)
// ---------------------------------------------------------------------------

const W24_STATES = [["queue", "Queue"], ["ccip", "CCIP"], ["flows", "Flows"]] as const;
type W24State = (typeof W24_STATES)[number][0];

function w24(state: W24State): string {
  // The rail tabs ARE this screen's states — wire each inactive tab to navigate.
  const stateIx = state === "queue" ? 0 : state === "ccip" ? 1 : 2;
  const rail = tabRail(
    [
      { label: "Queue", count: 4, hot: "w24.tab-queue" },
      { label: "CCIP", hot: "w24.tab-ccip" },
      { label: "Flows", hot: "w24.tab-flows" },
    ],
    stateIx,
  );
  let inner: string;
  switch (state) {
    case "ccip":
      inner = acard(
        "CCIP command/ack health",
        `${kv("Arbitrum native reserve", "funded ✓")}${kv("Celo native reserve", "funded ✓")}${kv("Peer configuration", "configured ✓")}${kv("Acknowledgment deferrals", "0")}
<div class="arow"><div class="grow"><b>Settlement 104</b> · command 0xab…11 · destination pending</div><span class="t-meta">CCIP Explorer ↗</span></div>
<div class="arow"><div class="grow"><b>Settlement 102</b> · destination 0xce…42 · acknowledgment 0xac…09 pending</div><span class="t-meta">Explorer ↗</span></div>
${banner("Manual execution is guidance, not a Green Goods state change. Show it only when CCIP Explorer marks a command eligible; a destination transaction alone never means support arrived.", "stone")}`,
      );
      break;
    case "flows":
      inner = acard(
        "Cross-chain funds board",
        `<div class="arow">${hot("w24.inflow-row", `<div class="grow">GoodDollar pool → GG protocol Safe</div>`)}<span class="num">balance 4,120 G$</span>${chip("Celo read", "plain")}</div>
${hot("w24.queue-funding", `<div class="arow"><div class="grow">GG protocol Safe → garden Safes</div><span class="t-meta num">source integration gate</span>${btn("View route gate", { kind: "sec", sm: true })}</div>`)}
<div class="arow"><div class="grow">Garden Safes → members</div><span class="t-meta num">source integration gate</span></div>
${hot("w24.gardens", `<div class="arow"><div class="grow">Gardens: Awka kept 8/9 · Muizenberg kept 5/6</div>${chip("alphabetical", "plain")}</div>`)}
${banner("Queued, dispatched, executed, confirming, confirmed, failed, and delayed stay distinct here. Inflow is a Celo balance read — no upstream hop is recorded.", "stone")}`,
      );
      break;
    default:
      inner = acard(
        "Queue — all gardens",
        dtable(
          ["Garden", "Item", "State", ""],
          [
            ["Rocinha", `settlement 104 · attempt 0`, chip("Queued", "plain", { dot: true }), hot("w24.execute", btn("Dispatch ▸", { kind: "pri", sm: true }))],
            ["Awka", `settlement 103 · attempt 1`, chip("Failed ▸", "err"), hot("w24.requeue", btn("Source follow-up", { kind: "sec", sm: true }))],
            // Viewing a gate is a read, not a peer of dispatch — one primary per view.
            ["protocol", `future funding → Muizenberg`, chip("Integration gate", "plain", { dot: true }), hot("w24.execute-protocol", btn("View gate ▸", { kind: "sec", sm: true }))],
          ],
          "All gardens settlement queue",
        ) + banner("Deployer-gated workspace — source integration and production Safe/Zodiac route evidence gate all future value controls.", "stone"),
      );
  }
  const header = pageHeader({
    title: "Operations",
    eyebrow: "Protocol execution · deployer-gated",
    description: "Every garden's command queue, CCIP health, and cross-chain funds — one execution home.",
  });
  return deskWin(
    "admin.greengoods.app/dashboard/operations",
    adminCanvas("actions", "operations", { screenId: "W24", garden: "Rocinha", header, tabRail: rail, body: inner }),
  );
}

const W24_HOTS: HifiDef["hots"] = {
  "w24.tab-queue": { l: "Queue tab", to: "screen:W24@queue", info: "Cross-garden execution queue." },
  "w24.tab-ccip": { l: "CCIP tab", to: "screen:W24@ccip", info: "Command/ack peer, native fee reserve, and acknowledgment-delay health." },
  "w24.tab-flows": { l: "Flows tab", to: "screen:W24@flows", info: "Cross-chain funds board with transport state, not raw G$ indexing." },
  "w24.execute": { l: "Dispatch command", to: "screen:W22", info: "Cross-garden source-command home; production value authority remains externally gated." },
  "w24.execute-protocol": { l: "View protocol funding gate", info: "ProtocolToGarden requires the future source integration and approved production route." },
  "w24.queue-funding": { l: "View funding route gate", to: "screen:W24@flows", info: "No upstream HoA hop is written onchain; future ProtocolToGarden facts are source-integrated." },
  "w24.requeue": { l: "Source follow-up", info: "A new logical attempt requires an authenticated failure and source integration ownership." },
  "w24.inflow-row": { l: "Inflow row (Celo read)", info: "Protocol-Safe inflow is a Celo balance read — the module records no upstream hop (corrections-log §9)." },
  "w24.gardens": { l: "No-ranking invariant", info: "Cross-garden oversight rows sort alphabetically; never ranked (UX:314)." },
};

// ---------------------------------------------------------------------------
// W26 — cycle close → allocation → certificate wizard (wireframes.md:691;
// absorbs MF-9's reconciliation report as its Review step)
// ---------------------------------------------------------------------------

const W26_STATES = [
  ["review", "1 · Review"], ["shares", "2 · Shares"], ["certificate", "3 · Certificate"], ["rest", "4 · Rest the cycle"],
] as const;
type W26State = (typeof W26_STATES)[number][0];

function w26(state: W26State): string {
  const stepIx = state === "review" ? 0 : state === "shares" ? 1 : state === "certificate" ? 2 : 3;
  let inner: string;
  switch (state) {
    case "shares":
      inner = `${kv("Gardeners", "60%")}${kv("Treasury", "15%")}${kv("Steward", "10%")}${kv("Evaluator", "5%")}${kv("Community", "5%")}${kv("Funder", "5%")}
${banner("Read-only — the six-role snapshot locked when this cycle opened.", "stone")}
${hot("w26.continue-certificate", btn("Continue", { kind: "pri" }))}`;
      break;
    case "certificate":
      inner = `${kv("Bundle", "7 fulfilled promises + their work, evidence, and need lineage")}${kv("Allowlist", "from the shares above")}${kv("Holder", "the garden account")}
${hot("w26.mint", btn("Mint impact certificate", { kind: "pri" }))}
${banner("Uses the garden's existing impact-certificate pipeline.", "stone")}`;
      break;
    case "rest":
      inner = `${kv("Aggregates", "roll into pool history")}${kv("Next season", "seeds fresh on this pool")}
${hot("w26.compost", btn("Reconcile + compost", { kind: "pri" }))}
<div class="quietok">${icon("check-line")}Certificate minted · 7 promises bundled.</div>`;
      break;
    default:
      inner = `${kv("Season of First Rains", "9 promises · 7 kept")}
<div class="arow"><div class="grow">Unresolved first: <b>1 expired</b></div>${hot("w26.reseed", btn("Re-seed…", { kind: "sec", sm: true }))}</div>
<div class="arow"><div class="grow"><b>1 under steward review</b></div>${hot("w26.resolve", btn("Resolve…", { kind: "sec", sm: true }))}</div>
${banner("Closing runs as one sequence: settle what's unresolved, read back the shares, certify, then rest the cycle.", "stone")}
${hot("w26.continue-shares", btn("Continue", { kind: "pri" }))}`;
  }
  const header = pageHeader({
    title: "Close cycle",
    eyebrow: `Step ${stepIx + 1} of 4`,
    description: "Season of First Rains — reconcile, share, certify, then rest the cycle.",
    actions: stepDots(4, stepIx),
  });
  return deskWin(
    "admin.greengoods.app/dashboard/garden/pool/close",
    adminCanvas("garden", "garden", { screenId: "W26", garden: "Rocinha", header, body: `<div class="flowform">${inner}</div>` }),
  );
}

const W26_HOTS: HifiDef["hots"] = {
  "w26.continue-shares": { l: "Continue to shares", to: "screen:W26@shares", info: "Moves from unresolved-item review to the locked six-role allocation snapshot." },
  "w26.continue-certificate": { l: "Continue to certificate", to: "screen:W26@certificate", info: "Moves from the allocation snapshot to the existing impact-certificate pipeline." },
  // Unresolved items are handled in a dialog over the wizard. Sending the
  // steward off to another workspace mid-close abandoned a four-step sequence
  // with no described way back.
  "w26.reseed": { l: "Re-seed expired", info: "Opens the seeding console prefilled from the lapsed promise, in a dialog over this step — the close sequence stays where it is (UX:94)." },
  "w26.resolve": { l: "Resolve under-review", info: "Opens the dispute resolution dialog over this step; cycle close sequences unresolved commitments before reconcile without leaving the flow (WF:691)." },
  "w26.mint": { l: "Mint impact certificate", to: "screen:W26@rest", info: "Existing Hypercert pipeline; bundle = fulfilled promises + work, evidence, need lineage; allowlist from the six-role shares (CS §9)." },
  "w26.compost": { l: "Reconcile + compost", to: "screen:W7@cycle-composted", info: "closeCycle → certificate mint → compostCycle; aggregates roll into pool history (WF:714). Lands on the composted-season console, where §6.2 first offers Close pool." },
};

// ---------------------------------------------------------------------------

export const SETTLEMENT_DEFS: HifiDef[] = [
  { screen: { id: "W12", title: "W12 · Community → Pools", surface: "admin", frame: "desktop", group: "Admin console",
    states: W12_STATES.map(([id, label]) => ({ id, label, html: w12(id) })) }, hots: { ...adminChromeHots("w12", "community"), ...W12_HOTS } },
  { screen: { id: "W21", title: "W21 · Settlement section (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: W21_STATES.map(([id, label]) => ({ id, label, html: w21(id) })) }, hots: { ...adminChromeHots("w21", "garden"), ...W21_HOTS } },
  { screen: { id: "W22", title: "W22 · Command/ack console", surface: "admin", frame: "desktop", group: "Admin console",
    states: W22_STATES.map(([id, label]) => ({ id, label, html: w22(id) })) }, hots: { ...adminChromeHots("w22", "garden"), ...W22_HOTS } },
  { screen: { id: "W24", title: "W24 · Operations workspace (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: W24_STATES.map(([id, label]) => ({ id, label, html: w24(id) })) }, hots: { ...adminChromeHots("w24", "operations"), ...W24_HOTS } },
  { screen: { id: "W26", title: "W26 · Cycle-close wizard (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: W26_STATES.map(([id, label]) => ({ id, label, html: w26(id) })) }, hots: { ...adminChromeHots("w26", "garden"), ...W26_HOTS } },
];
