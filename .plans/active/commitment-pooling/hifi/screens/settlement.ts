// Admin hi-fi screens, settlement + operations set — W12 community pools,
// W21 settlement section, W22 command/ack console, W24 operations
// workspace, W26 cycle-close wizard (absorbs MF-9's reconciliation report).
// Settlement label discipline (settlement-spec §7): dispatched and Celo-executed
// states are never member-visible arrival proof; only an authenticated CCIP
// success acknowledgment produces “Confirmed”. G$ stays on Celo — no bridge language, ever.

import { hot } from "../html";
import { icon } from "../icons";
import { banner, btn, chip, kv, radio, stepDots } from "../kit";
import { acard, adminCanvas, adminChromeHots, deskWin, dtable, pageHeader, stages, tabRail } from "./admin";
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
          `<div class="arow"><div class="grow"><b>Season of First Rains</b> <span class="t-meta">Open · 2 campaigns</span></div><span class="t-meta num">kept 7/9 · exposure 18</span></div>
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
  "w12.accept": { l: "Accept a garden claim", to: "screen:W2", info: "Protocol steward accepts stored terms; providerGarden derives, then the accepted promise opens (CS:733)." },
  "w12.decline": { l: "Decline a garden claim", info: "Declines this garden claim with a required reason while leaving other pending requests intact (CS:734)." },
  "w12.confirm-row": { l: "Confirmations queue", to: "screen:W10", info: "Protocol confirmations queue mirrors the Hub Confirm grammar (WF:417)." },
  "w12.no-ranking": { l: "Garden scope boundary", info: "No other-garden rows or command/ack controls render here; all-garden operations live in W24 (UX:314)." },
};

// ---------------------------------------------------------------------------
// W21 — garden settlement section (settlement-spec §7)
// ---------------------------------------------------------------------------

const W21_STATES = [
  ["queue", "Disbursement queue"], ["unregistered", "No account yet"],
  ["failed-recovery", "Failed — recovery"], ["gate-status", "Delivery gate"],
] as const;
type W21State = (typeof W21_STATES)[number][0];

const w21Rows = () =>
  dtable(
    ["Member", "Amount", "State", ""],
    [
      ["104 / attempt 0", `source facts`, chip("Queued", "plain", { dot: true }), `${hot("w21.dispatch", btn("Dispatch", { kind: "sec", sm: true }))}${hot("w21.cancel-disb", btn("Cancel", { kind: "ghost", sm: true }))}`],
      ["103 / attempt 1", `source facts`, chip("Failed — route rejected", "err"), `${hot("w21.requeue", btn("Source follow-up", { kind: "sec", sm: true }))}${hot("w21.cancel-failed", btn("Close delivery", { kind: "ghost", sm: true }))}`],
      ["102 / attempt 0", `source facts`, chip("Confirming arrival", "warn", { dot: true }), hot("w21.request-details", btn("Ack details", { kind: "ghost", sm: true }))],
      ["101 / attempt 0", `source facts`, chip("Confirmed ↗", "ok", { dot: true }), ""],
    ],
    "Rocinha settlement disbursement queue",
  );

function w21(state: W21State): string {
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
        "Member delivery gate — read-only status (register #34f)",
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
      inner = `${acard(
        "Settlement (Celo)",
        `${kv("Source", "canonical pooling interface pending")}${kv("Fee reserve", "native ETH / CELO monitored")}
<div class="arow">${hot("w21.gate-row", `<div class="grow">Member delivery: <b>enabled</b> <span class="t-meta">· changed by 0x9a…4f · Jul 30 · evidence ↗</span></div>`)}</div>
<div class="arow"><div class="grow">CCIP: peers configured · command/ack fee reserves monitored</div></div>
${w21Rows()}`,
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
  "w21.setup": { l: "Review registration requirements", to: "screen:W21", info: "Read-only prerequisite summary. Production governance deploys and verifies the Safe/Zodiac route separately; this surface later registers the already-deployed account." },
  "w21.gate-row": { l: "Delivery-gate status row", info: "Read-only (register #34f): enabled/disabled · changed by · date · evidence. The flip is owner-only ops (SS:172)." },
  "w21.dispatch": { l: "Dispatch", to: "screen:W22", info: "The stored steward, module owner, or configured dispatcher sends the immutable queued command from the monitored unreserved native ETH balance." },
  "w21.requeue": { l: "Source follow-up", to: "screen:W21", info: "A next attempt requires an authenticated failure and the future source integration." },
  "w21.cancel-disb": { l: "Cancel unbatched queued command", info: "The planned `cancelDisbursement` path is available before dispatch only when `batchId == 0`; an immutable Queued batch is cancelled only in full." },
  "w21.cancel-failed": { l: "Close failed delivery", info: "An authenticated Failed member may be terminally cancelled instead of requeued. The failed attempt and bounded failure code remain visible." },
  "w21.request-details": { l: "Acknowledgment details", info: "Celo execution is stored before its acknowledgement and can remain confirming while the source state is Dispatched." },
  "w21.create-batch": { l: "Open command", to: "screen:W22", info: "The planned UI is transport-level; commitment batches depend on the canonical pooling source integration." },
};

// ---------------------------------------------------------------------------
// W22 — command/ack console (settlement-spec §7)
// ---------------------------------------------------------------------------

const W22_STATES = [
  ["ready", "Queued"], ["dispatched", "Dispatched"], ["delivery-delayed", "Delivery delayed"], ["executed", "Celo executed"],
  ["acknowledgment-pending", "Acknowledgment pending"], ["outcome", "Confirmed / failed"], ["role-guard", "Route gate"],
] as const;
type W22State = (typeof W22_STATES)[number][0];

const w22Members = dtable(
  ["Member", "Amount", "To"],
  [["Maria", `<span class="num">20 G$</span>`, `<span class="num">0x12…9a</span>`], ["João", `<span class="num">15 G$</span>`, `<span class="num">0x77…3c</span>`]],
  "Batch #12 members",
);

function w22(state: W22State): string {
  const head = `${kv("Settlement 104 — attempt 0", "canonical pooling facts · message-only CCIP · no token amounts")}${kv("Payer", "Rocinha owning-pool Safe · Celo")}${kv("Route snapshot", "Celo selector · executor 0x5e…91 · v1 · measured gas")}${kv("Batch #12", "2 immutable members · configured limit 8 · hard ceiling 24")}`;
  let inner: string;
  switch (state) {
    case "dispatched":
      inner = `${head}${w22Members}
${stages(["Queued", "Dispatched", "Celo executed", "Confirmed"], 1)}
${banner("The command has been dispatched with the immutable execution key. A same-key retry changes only the CCIP message ID.", "stone")}
${kv("Command message", "0xab…11 · CCIP Explorer ↗")}${kv("Destination execution", "Pending · manual execution not yet eligible")}
${hot("w22.open-command-explorer", btn("Open CCIP Explorer", { kind: "sec", icon: "external-link-line" }))}`;
      break;
    case "delivery-delayed":
      inner = `${head}${w22Members}
${stages(["Queued", "Dispatched", "Celo executed", "Confirmed"], 1)}
${banner("Delivery is past the configured service window. This is a derived operational condition, not a contract mutation or payment failure.", "amber")}
${kv("Command message", "0xab…11 · CCIP Explorer ↗")}${kv("Manual execution", "Follow CCIP guidance only when Explorer marks this message eligible")}
${hot("w22.manual-execution-guide", btn("Manual-execution guidance", { kind: "sec", icon: "external-link-line" }))}${hot("w22.retry-command", btn("Retry same command", { kind: "pri" }))}`;
      break;
    case "executed":
      inner = `${head}${w22Members}
${stages(["Queued", "Dispatched", "Celo executed", "Confirmed"], 2)}
${banner("Celo has stored its idempotent outcome. The source stays Dispatched until an authenticated acknowledgment arrives.", "stone")}
${kv("Command message", "0xab…11 · CCIP Explorer ↗")}${kv("Destination transaction", "0xce…42 · Celoscan ↗")}${kv("Acknowledgment", "Not submitted · reserve recovery available")}
${hot("w22.open-destination-explorer", btn("Open destination transaction", { kind: "sec", icon: "external-link-line" }))}${hot("w22.retry-acknowledgment", btn("Retry acknowledgment", { kind: "pri" }))}`;
      break;
    case "acknowledgment-pending":
      inner = `${head}
${stages(["Queued", "Dispatched", "Celo executed", "Confirmed"], 2)}
${kv("Status", "Celo executed · acknowledgment pending")}${kv("Command message", "0xab…11 · CCIP Explorer ↗")}${kv("Destination transaction", "0xce…42 · Celoscan ↗")}${kv("Acknowledgment message", "0xac…09 · CCIP Explorer ↗")}
<div class="arow"><div class="grow">A delayed acknowledgment never invokes the Safe route again.</div>${hot("w22.retry-acknowledgment-again", btn("Retry acknowledgment", { kind: "sec", sm: true }))}</div>`;
      break;
    case "outcome":
      inner = `${head}
<div class="arow"><div class="grow"><b>Settlement 101</b></div>${chip("Confirmed ↗", "ok", { dot: true })}</div>
<div class="arow"><div class="grow"><b>Settlement 103</b> <span class="t-meta">route rejected</span></div>${chip("Failed", "err")}${hot("w22.requeue-member", btn("Source follow-up", { kind: "sec", sm: true }))}</div>
	${banner("Duplicate or stale terminal acknowledgments are emitted, ignored, and remain observable; they never mutate the settled source state.", "stone")}
<div class="quietok">${icon("check-line")}Confirmed outcomes are safe to render as “support arrived ↗”.</div>`;
      break;
    case "role-guard":
      inner = `${head}
${banner("The production Safe/Zodiac route is outside this plan-only pass. Before enabling value, the release checklist must prove a scoped executor role, no Safe ownership, canonical-G$ selectors, and caps.", "amber", "shield-check-line")}
${btn("Production route required", { kind: "sec", disabled: true })}`;
      break;
    default:
      inner = `${head}${w22Members}
${stages(["Queued", "Dispatched", "Celo executed", "Confirmed"], 0)}
${hot("w22.route-gate", btn("Open route gate", { kind: "sec", icon: "external-link-line" }))}${hot("w22.cancel-batch", btn("Cancel whole batch", { kind: "sec" }))}${hot("w22.dispatch-command", btn("Dispatch command", { kind: "pri" }))}
${banner("Queued batch membership is immutable. Cancellation applies atomically to both members; no member-level action is available.", "amber")}
${banner("The planned contract sends a data-only command. The production typed Safe route is a separate release-gated configuration.", "stone")}`;
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
  "w22.route-gate": { l: "Open route gate", info: "The production typed Safe/Zodiac route is a release gate, not an implemented adapter." },
  "w22.cancel-batch": { l: "Cancel whole queued batch", info: "Requires a reason and blast-radius confirmation. `cancelBatch` atomically marks the Queued batch and every immutable member Cancelled-from-Queued; partial cancellation is impossible." },
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
${banner("The planned read model distinguishes queued, dispatched, Celo-executed/ack-pending, confirmed, failed, and delayed. Inflow is a Celo balance read — the module records no upstream hop.", "stone")}`,
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
            ["protocol", `future funding → Muizenberg`, chip("Integration gate", "plain", { dot: true }), hot("w24.execute-protocol", btn("View gate ▸", { kind: "pri", sm: true }))],
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
${banner("Read-only — the six-role snapshot locked when the cycle opened (W11).", "stone")}
${hot("w26.continue-certificate", btn("Continue", { kind: "pri" }))}`;
      break;
    case "certificate":
      inner = `${kv("Bundle", "7 fulfilled promises + their work, evidence, and need lineage")}${kv("Allowlist", "from the shares above")}${kv("Holder", "the garden account")}
${hot("w26.mint", btn("Mint impact certificate", { kind: "pri" }))}
${banner("Existing Hypercert pipeline — the wizard invents no contract surface.", "stone")}`;
      break;
    case "rest":
      inner = `${kv("Aggregates", "roll into pool history")}${kv("Next season", "seeds fresh on this pool")}
${hot("w26.compost", btn("Reconcile + compost", { kind: "pri" }))}
<div class="quietok">${icon("check-line")}Certificate minted · 7 promises bundled.</div>`;
      break;
    default:
      inner = `${kv("Season of First Rains", "9 promises · 7 kept · 62% of promised units")}
<div class="arow"><div class="grow">Unresolved first: <b>1 expired</b></div>${hot("w26.reseed", btn("Re-seed…", { kind: "sec", sm: true }))}</div>
<div class="arow"><div class="grow"><b>1 under steward review</b></div>${hot("w26.resolve", btn("Resolve…", { kind: "sec", sm: true }))}</div>
${banner("Close sequences the specs' own acts: closeCycle → certificate → compostCycle — one coherent ritual instead of three consoles.", "stone")}
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
  "w26.reseed": { l: "Re-seed expired", to: "screen:W7@expiry-queue", info: "Unresolved-first: lapsed seeded promises re-enter the seeding console prefilled (UX:94)." },
  "w26.resolve": { l: "Resolve under-review", to: "screen:W10@resolve-dispute", info: "Cycle close sequences unresolved commitments before reconcile (WF:691)." },
  "w26.mint": { l: "Mint impact certificate", to: "screen:W26@rest", info: "Existing Hypercert pipeline; bundle = fulfilled promises + work, evidence, need lineage; allowlist from the six-role shares (CS §9)." },
  "w26.compost": { l: "Reconcile + compost", to: "screen:W7@reconciled", info: "closeCycle → certificate mint → compostCycle; aggregates roll into pool history (WF:714)." },
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
