// Admin hi-fi screens, settlement + operations set — W12 community pools,
// W21 settlement section, W22 batch + oracle console, W24 operations
// workspace, W26 cycle-close wizard (absorbs MF-9's reconciliation report).
// Settlement label discipline (settlement-spec §7): “Reported” is an executor
// record, never member-visible proof; only the Chainlink Functions callback
// produces “oracle-verified”. G$ stays on Celo — no bridge language, ever.

import { hot } from "../html";
import { icon } from "../icons";
import { banner, btn, chip, field, input, kv, radio, stepDots } from "../kit";
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
  "w12.no-ranking": { l: "Garden scope boundary", info: "No other-garden rows or batch/oracle controls render here; all-garden operations live in W24 (UX:314)." },
};

// ---------------------------------------------------------------------------
// W21 — garden settlement section (settlement-spec §7)
// ---------------------------------------------------------------------------

const W21_STATES = [
  ["queue", "Disbursement queue"], ["unregistered", "No account yet"],
  ["failed-recovery", "Failed — recovery"], ["gate-status", "Delivery gate"],
] as const;
type W21State = (typeof W21_STATES)[number][0];

const w21Rows = (failedFocus: boolean) =>
  dtable(
    ["Member", "Amount", "State", ""],
    [
      ["Maria", `<span class="num">20 G$</span>`, chip("Queued", "plain", { dot: true }), hot("w21.add-batch", btn("Add to batch", { kind: "sec", sm: true }))],
      ["João", `<span class="num">15 G$</span>`, chip("Failed — reason ▸", "err"), failedFocus ? `${hot("w21.requeue", btn("Requeue", { kind: "sec", sm: true }))}${hot("w21.cancel-disb", btn("Cancel…", { kind: "ghost", sm: true }))}` : hot("w21.requeue", btn("Requeue", { kind: "sec", sm: true }))],
      ["Ana", `<span class="num">20 G$</span>`, chip("Reported · checking receipt", "warn", { dot: true }), hot("w21.request-details", btn("Request details", { kind: "ghost", sm: true }))],
      ["Kofi", `<span class="num">20 G$</span>`, chip("Oracle-verified ↗", "ok", { dot: true }), ""],
    ],
    "Rocinha settlement disbursement queue",
  );

function w21(state: W21State): string {
  let inner: string;
  switch (state) {
    case "unregistered":
      inner = acard(
        "Settlement (Celo)",
        `<div class="t-meta">No settlement account yet. Registering creates the garden's Celo Safe with 2-of-3 recovery — owners never overlap the executor role.</div>${hot("w21.setup", btn("Set up settlement account", { kind: "pri" }))}`,
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
        `${kv("Safe", "celo:0x9a…4f · active")}${kv("Balance · allowance", "1,240 G$ · 500 G$/wk")}
${banner("João's disbursement failed its receipt check. Requeue clears the old batch id (attempts +1) or cancel with a reason — the promise itself stays kept.", "amber", "error-warning-line")}
${w21Rows(true)}`,
      )}`;
      break;
    default:
      inner = `${acard(
        "Settlement (Celo)",
        `${kv("Safe", "celo:0x9a…4f · active")}${kv("Balance · allowance", "1,240 G$ · 500 G$/wk")}
<div class="arow">${hot("w21.gate-row", `<div class="grow">Member delivery: <b>enabled</b> <span class="t-meta">· changed by 0x9a…4f · Jul 30 · evidence ↗</span></div>`)}</div>
<div class="arow"><div class="grow">Functions: subscription funded · DON healthy · last callback 4m ago</div></div>
${w21Rows(false)}`,
        hot("w21.create-batch", btn("Create batch (2)", { kind: "pri", sm: true })),
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
  "w21.setup": { l: "Set up settlement account", to: "screen:W21", info: "registerSettlementAccount — Celo 42220, 2-of-3 recovery, no owner/executor overlap (SS:169)." },
  "w21.gate-row": { l: "Delivery-gate status row", info: "Read-only (register #34f): enabled/disabled · changed by · date · evidence. The flip is owner-only ops (SS:172)." },
  "w21.add-batch": { l: "Add to batch", info: "Batches hold 1–24 immutable members (SS:116)." },
  "w21.requeue": { l: "Requeue", to: "screen:W21", info: "Failed → Queued; clears the old batchId, attempts++ (SS:182)." },
  "w21.cancel-disb": { l: "Cancel disbursement", info: "Queued/Failed → Cancelled; frees the commitment for a fresh queue (SS:183)." },
  "w21.request-details": { l: "Verification request", info: "Reported + active request = the derived “checking receipt” (DG:666)." },
  "w21.create-batch": { l: "Create batch", to: "screen:W22", info: "createBatch — 1..24 immutable members, one executorGarden/source/token (SS:175)." },
};

// ---------------------------------------------------------------------------
// W22 — batch execution + oracle console (settlement-spec §7)
// ---------------------------------------------------------------------------

const W22_STATES = [
  ["ready", "Batch ready"], ["executing", "Executing"], ["reported", "Reported"],
  ["checking", "Checking receipt"], ["outcome", "Verified / failed"], ["role-guard", "Missing role"],
] as const;
type W22State = (typeof W22_STATES)[number][0];

const w22Members = dtable(
  ["Member", "Amount", "To"],
  [["Maria", `<span class="num">20 G$</span>`, `<span class="num">0x12…9a</span>`], ["João", `<span class="num">15 G$</span>`, `<span class="num">0x77…3c</span>`]],
  "Batch #12 members",
);

function w22(state: W22State): string {
  const head = `${kv("Batch #12 — Rocinha", "2 of max 24 immutable members · 35 G$ · Safe 0x9a…4f")}`;
  let inner: string;
  switch (state) {
    case "executing":
      inner = `${head}${w22Members}
${stages(["Queued", "Executing", "Reported", "Oracle-verified"], 1)}
${banner("The value leg ran in the Safe app. Report the Celo transaction hash — the reference must be globally unused.", "stone")}
${field("Celo transaction hash", input("0x8f2a…c41e"))}
${hot("w22.report-hash", btn("Report transaction", { kind: "pri" }))}${hot("w22.record-failed", btn("Record failed — reason…", { kind: "ghost" }))}`;
      break;
    case "reported":
      inner = `${head}${w22Members}
${stages(["Queued", "Executing", "Reported", "Oracle-verified"], 2)}
${banner("Reported records what the executor did — it is never member-visible proof. Only the receipt check can produce “arrived”.", "stone")}
${hot("w22.request-verification", btn("Request receipt verification", { kind: "pri" }))}`;
      break;
    case "checking":
      inner = `${head}
${stages(["Queued", "Executing", "Reported", "Oracle-verified"], 2)}
${kv("Status", "Reported · checking finalized Celo receipt")}${kv("Request", "0x71…c2 · Chainlink Functions")}
<div class="arow"><div class="grow">Infrastructure timeout? Expire the stale request and send a fresh one — no state loss.</div>${hot("w22.request-again", btn("Request again", { kind: "sec", sm: true }))}</div>`;
      break;
    case "outcome":
      inner = `${head}
<div class="arow"><div class="grow"><b>Maria — 20 G$</b></div>${chip("Oracle-verified ↗ Celo tx", "ok", { dot: true })}</div>
<div class="arow"><div class="grow"><b>João — 15 G$</b> <span class="t-meta">receipt invalid</span></div>${chip("Failed", "err")}${hot("w22.requeue-member", btn("Requeue", { kind: "sec", sm: true }))}${hot("w22.cancel-member", btn("Cancel with reason…", { kind: "ghost", sm: true }))}</div>
${banner("The batch stays immutable; recovery is per-member. A stale callback is ignored, never re-applied.", "stone")}
<div class="quietok">${icon("check-line")}Verified outcomes recorded — members see “support arrived ↗”.</div>`;
      break;
    case "role-guard":
      inner = `${head}
${banner("You don't hold the settlement executor role for this garden. Pilot stewards hold it (register #34e) — never a Safe owner, never a recovery owner. Ask the protocol team to grant it.", "amber", "shield-check-line")}
${btn("Open in Safe app ↗", { kind: "sec", disabled: true })}${btn("Mark executing", { kind: "sec", disabled: true })}`;
      break;
    default:
      inner = `${head}${w22Members}
${stages(["Queued", "Executing", "Reported", "Oracle-verified"], 0)}
${hot("w22.open-safe", btn("Open in Safe app ↗", { kind: "sec", icon: "external-link-line" }))}${hot("w22.mark-executing", btn("Mark executing", { kind: "pri" }))}
${banner("The G$ transfer itself happens in the Safe app under a Roles-scoped allowance — outside Green Goods.", "stone")}`;
  }
  const header = pageHeader({
    title: "Execute batch #12",
    eyebrow: "Executor console",
    description: "The value leg runs in the Safe app; this console records it and pins the receipt check.",
  });
  return deskWin(
    "admin.greengoods.app/dashboard/garden/settlement/batch",
    adminCanvas("garden", "garden", { screenId: "W22", garden: "Rocinha", header, body: acard("Batch", inner) }),
  );
}

const W22_HOTS: HifiDef["hots"] = {
  "w22.open-safe": { l: "Open in Safe app", info: "The value leg happens in the Safe app — Roles-scoped G$ transfer, outside Green Goods (WF settlement notes)." },
  "w22.mark-executing": { l: "Mark executing", to: "screen:W22@executing", info: "Executor-only (SS:176). Pilot stewards hold the role (register #34e); a missing role shows a visible guard state." },
  "w22.report-hash": { l: "Report tx hash", to: "screen:W22@reported", info: "Executor-only; ref mandatory and globally unused. Reported is never member-visible proof (SS:177)." },
  "w22.record-failed": { l: "Record failed", info: "Failed with reason → per-member recovery on W21 (SS:182)." },
  "w22.request-verification": { l: "Request receipt verification", to: "screen:W22@checking", info: "Pinned Chainlink Functions request; only its callback can produce Verified — no human override (SS:178-179)." },
  "w22.request-again": { l: "Request again", info: "Infrastructure timeout: expire the stale request, then a fresh one — no state loss (SS:180)." },
  "w22.requeue-member": { l: "Requeue member", info: "Failed → Queued; clears the old batchId (SS:182)." },
  "w22.cancel-member": { l: "Cancel member", info: "Receipt-invalid recovery is per-member; the batch itself stays immutable (SS:394)." },
};

// ---------------------------------------------------------------------------
// W24 — Operations workspace (wireframes.md:643, deployer-gated)
// ---------------------------------------------------------------------------

const W24_STATES = [["queue", "Queue"], ["oracle", "Oracle"], ["flows", "Flows"]] as const;
type W24State = (typeof W24_STATES)[number][0];

function w24(state: W24State): string {
  // The rail tabs ARE this screen's states — wire each inactive tab to navigate.
  const stateIx = state === "queue" ? 0 : state === "oracle" ? 1 : 2;
  const rail = tabRail(
    [
      { label: "Queue", count: 4, hot: "w24.tab-queue" },
      { label: "Oracle", hot: "w24.tab-oracle" },
      { label: "Flows", hot: "w24.tab-flows" },
    ],
    stateIx,
  );
  let inner: string;
  switch (state) {
    case "oracle":
      inner = acard(
        "Verification health",
        `${kv("Subscription", "funded ✓")}${kv("DON", "healthy ✓")}${kv("Last callback", "4 minutes ago")}${kv("Stale callbacks ignored", "0")}
<div class="arow"><div class="grow"><b>Batch #11</b> · Reported · checking receipt · request <span class="num">0x71…c2</span></div>${icon("arrow-right-s-line", "s")}</div>`,
      );
      break;
    case "flows":
      inner = acard(
        "Cross-chain funds board",
        `<div class="arow">${hot("w24.inflow-row", `<div class="grow">GoodDollar pool → GG protocol Safe</div>`)}<span class="num">balance 4,120 G$</span>${chip("Celo read", "plain")}</div>
${hot("w24.queue-funding", `<div class="arow"><div class="grow">GG protocol Safe → garden Safes</div><span class="t-meta num">3 hops oracle-verified · 1 reported</span>${btn("Queue garden funding", { kind: "sec", sm: true })}</div>`)}
<div class="arow"><div class="grow">Garden Safes → members</div><span class="t-meta num">42 oracle-verified · 2 failed</span></div>
${hot("w24.gardens", `<div class="arow"><div class="grow">Gardens: Awka kept 8/9 · Muizenberg kept 5/6</div>${chip("alphabetical", "plain")}</div>`)}
${banner("Every downstream figure distinguishes Reported from oracle-verified. Inflow is a Celo balance read — the module records no upstream hop.", "stone")}`,
      );
      break;
    default:
      inner = acard(
        "Queue — all gardens",
        dtable(
          ["Garden", "Item", "State", ""],
          [
            ["Rocinha", `batch #12 · 2 members · <span class="num">35 G$</span>`, chip("Queued", "plain", { dot: true }), hot("w24.execute", btn("Execute ▸", { kind: "pri", sm: true }))],
            ["Awka", `Maria — <span class="num">20 G$</span>`, chip("Failed ▸", "err"), hot("w24.requeue", btn("Requeue", { kind: "sec", sm: true }))],
            ["protocol", `funding → Muizenberg · <span class="num">200 G$</span>`, chip("Queued", "plain", { dot: true }), hot("w24.execute-protocol", btn("Execute ▸", { kind: "pri", sm: true }))],
          ],
          "All gardens settlement queue",
        ) + banner("Deployer-gated workspace — the executor-role guard applies to every execute/report control here, same as W22.", "stone"),
      );
  }
  const header = pageHeader({
    title: "Operations",
    eyebrow: "Protocol execution · deployer-gated",
    description: "Every garden's queue, oracle health, and cross-chain funds — one execution home.",
  });
  return deskWin(
    "admin.greengoods.app/dashboard/operations",
    adminCanvas("actions", "operations", { screenId: "W24", garden: "Rocinha", header, tabRail: rail, body: inner }),
  );
}

const W24_HOTS: HifiDef["hots"] = {
  "w24.tab-queue": { l: "Queue tab", to: "screen:W24@queue", info: "Cross-garden execution queue." },
  "w24.tab-oracle": { l: "Oracle tab", to: "screen:W24@oracle", info: "Verification health — subscription, DON, callbacks." },
  "w24.tab-flows": { l: "Flows tab", to: "screen:W24@flows", info: "Cross-chain funds board (Celo reads · Reported vs oracle-verified)." },
  "w24.execute": { l: "Execute batch", to: "screen:W22", info: "Cross-garden execution home (WF:643). Executor-role guard (register #34e) applies here, same as W22." },
  "w24.execute-protocol": { l: "Execute protocol funding", info: "Runs the deployer-gated protocol-to-garden funding item with the same executor-role guard." },
  "w24.queue-funding": { l: "Queue garden funding", to: "screen:W24@flows", info: "Deployer-gated queueFunding derives the sole ProtocolToGarden route and returns to the updated funds board; no upstream HoA hop is written onchain (SS:174,536)." },
  "w24.requeue": { l: "Requeue", info: "Failed → Queued; clears the old batchId, attempts++ (SS:182)." },
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
  { screen: { id: "W22", title: "W22 · Batch + oracle console", surface: "admin", frame: "desktop", group: "Admin console",
    states: W22_STATES.map(([id, label]) => ({ id, label, html: w22(id) })) }, hots: { ...adminChromeHots("w22", "garden"), ...W22_HOTS } },
  { screen: { id: "W24", title: "W24 · Operations workspace (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: W24_STATES.map(([id, label]) => ({ id, label, html: w24(id) })) }, hots: { ...adminChromeHots("w24", "operations"), ...W24_HOTS } },
  { screen: { id: "W26", title: "W26 · Cycle-close wizard (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: W26_STATES.map(([id, label]) => ({ id, label, proposed: id === "review", html: w26(id) })) }, hots: { ...adminChromeHots("w26", "garden"), ...W26_HOTS } },
];
