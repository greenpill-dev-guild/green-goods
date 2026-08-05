// Admin hi-fi screens, settlement + operations set — W12 community pools,
// W21 settlement section, W22 command/ack console, W24 operations
// workspace, W26 cycle-close wizard (absorbs MF-9's reconciliation report).
// Settlement label discipline (settlement-spec §7): dispatched and Celo-executed
// states are never member-visible arrival proof; only an authenticated CCIP
// success acknowledgment produces “Confirmed”. G$ stays on Celo — no bridge language, ever.

import { CYCLE, SEASON_LIVE } from "../fixtures";
import { hot } from "../html";
import { icon } from "../icons";
import { banner, btn, chip, disclosure, field, input, kv, radio, stepDots } from "../kit";
import { acard, adminCanvas, adminChromeHots, adminDialogM3, deskWin, dtable, pageHeader, stages, tabRail } from "./admin";
import type { HifiDef } from "./index";
import type { StateFacts } from "../types";

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
<div class="actrow" style="justify-content:flex-end">${hot("w12.open-garden-pool", btn("Open garden pool", { kind: "pri", sm: true }))}</div>
${hot("w12.no-ranking", banner("This workspace shows the Protocol pool and Rocinha only. All-garden oversight lives in capability-gated Operations.", "stone"))}`,
        )
      : `${acard(
          "Funding view",
          `<div class="arow"><div class="grow">20 DAI · protocol treasury → Methodology survey <span class="t-meta">co-funded with Awka Hub</span></div>${chip("Reference", "plain")}</div>`,
          chip("read only here", "plain"),
        )}
${acard(
          "Claims across gardens — steward-reviewed",
          `<div class="arow"><div class="grow"><b>Methodology survey</b> · Awka Hub (garden claim) · asked by Leila</div>${hot("w12.accept", btn("Accept", { kind: "pri", sm: true }))}${hot("w12.decline", btn("Decline…", { kind: "sec", sm: true }))}</div>`,
        )}
${acard(
          "Confirmations queue",
          `<div class="arow">${hot("w12.confirm-row", `<div class="grow"><b>Methodology survey</b> — 1 of 2 confirmed</div>`)}${icon("arrow-right-s-line", "s")}</div>`,
        )}`;
  const header = pageHeader({
    title: "Community",
    eyebrow: "Pools",
    description: "The protocol pool and this garden — all-garden oversight lives in Operations.",
  });
  return deskWin(
    "admin.greengoods.app/community/pools",
    adminCanvas("community", "community", { screenId: "W12", garden: "Rocinha", header, tabRail: rail, body: inner }),
  );
}

const W12_HOTS: HifiDef["hots"] = {
  "w12.tab-protocol": { l: "Protocol pool tab", to: "screen:W12@protocol", info: "The root protocol pool view." },
  "w12.tab-garden": { l: "This garden tab", to: "screen:W12@current-garden", info: "This garden's pool scope only." },
  "w12.open-garden-pool": { l: "Open garden pool", to: "screen:W7", info: "One-tap handoff from the Community summary to the selected garden's full Pool workspace." },
  "w12.accept": { l: "Accept a garden claim", to: "screen:W25@accepted", info: "Protocol steward accepts stored terms; providerGarden derives and the claimant garden sees it accepted (CS:733).", calls: ["acceptClaim"] },
  "w12.decline": { l: "Decline a garden claim", info: "Declines this garden claim with a required reason while leaving other pending requests intact (CS:734).", calls: ["declineClaim"] },
  "w12.confirm-row": { l: "Confirmations queue", to: "screen:W10@garden-ready", info: "Protocol confirmations queue mirrors the Hub Confirm grammar (WF:417)." },
  "w12.no-ranking": { l: "Garden scope boundary", info: "No other-garden rows or command/ack controls render here; all-garden operations live in W24 (UX:314)." },
};

// ---------------------------------------------------------------------------
// W21 — garden settlement section (settlement-spec §7)
// ---------------------------------------------------------------------------

const W21_STATES = [
  ["queue", "Disbursement queue"], ["unregistered", "No account yet"],
  ["payout-plan", "Contributor payout plan · draft"], ["payout-plan-edit", "Contributor payout plan · edit draft"],
  ["payout-finalized", "Contributor payout plan · finalized"],
  ["payout-prepared", "Contributor payout prepared · 1 of 3"],
  ["payout-prepared-2", "Contributor payout prepared · 2 of 3"],
  ["payout-prepared-all", "Contributor payout prepared · 3 of 3"],
  ["payout-retained-draft", "All support retained · draft"],
  ["payout-retained", "All support retained · complete"], ["payout-partial", "Contributor payouts · partial"],
  ["payout-complete", "Contributor payouts · complete"],
  ["register-account", "Register account"], ["registered", "Account registered"],
  ["failed-recovery", "Failed — recovery"], ["gate-status", "Delivery gate"],
  ["requeue-confirm", "Requeue — confirm"], ["requeued", "Requeued"],
  ["batch-create", "Create batch"], ["batch-created", "Batch created"],
  ["cancel-queued-confirm", "Cancel queued — confirm"], ["cancelled-queued", "Queued item cancelled"],
  ["batch-cancelled", "Batch cancelled"],
  ["close-delivery-confirm", "Close delivery — confirm"], ["cancelled-failed", "Failed item cancelled"],
  ["protocol-queue", "Protocol queue — garden funding"],
  ["protocol-funding-queued", "Garden funding — queued"],
] as const;
type W21State = (typeof W21_STATES)[number][0];

// Columns name what the cells actually hold: the first is a settlement id and
// attempt, not a member. "source facts" placeholders read as content in a
// review, so the amounts are plausible values instead.
const w21Rows = () =>
  dtable(
    ["Settlement · attempt", "Recipient", "Kind", "Amount", "State", ""],
    [
      ["104 · attempt 0", "Maria", "Contributor payout", `<span class="num">160 G$</span>`, chip("Queued", "plain", { dot: true }), `${hot("w21.dispatch", btn("Dispatch", { kind: "sec", sm: true }))}${hot("w21.cancel-disb", btn("Cancel", { kind: "ghost", sm: true }))}`],
      ["103 · attempt 1", "Kwame", "Contributor payout", `<span class="num">100 G$</span>`, chip("Failed — route rejected", "err"), `${hot("w21.requeue", btn("Source follow-up", { kind: "sec", sm: true }))}${hot("w21.cancel-failed", btn("Close delivery", { kind: "ghost", sm: true }))}`],
      ["102 · attempt 0", "Ana", "Contributor payout", `<span class="num">140 G$</span>`, chip("Confirming arrival", "warn", { dot: true }), hot("w21.request-details", btn("Ack details", { kind: "ghost", sm: true }))],
      ["101 · attempt 0", "Kwame", "Contributor payout", `<span class="num">18 G$</span>`, chip("Confirmed ↗", "ok", { dot: true }), ""],
    ],
    "Rocinha settlement disbursement queue",
  );

// Dimmed settlement route behind a confirmation, hotspot-free so foreign ids
// cannot break bidirectional integrity on the confirm state.
const w21Behind = (state: "failed" | "queued" | "unregistered" = "failed") =>
  adminCanvas("garden", "garden", {
    screenId: "W21",
    garden: "Rocinha",
    interactiveChrome: false,
    header: pageHeader({ title: "Settlement", eyebrow: "Garden · Celo", description: "The garden's Celo settlement account — disbursement queue, batches, and delivery gate." }),
    body: acard(
      "Settlement (Celo)",
      state === "unregistered"
        ? `<div class="t-meta">No registered settlement account.</div>`
        : state === "queued"
          ? `${kv("Settlement 104 / attempt 0", "Queued · unbatched")}`
          : `${kv("Settlement 103 / attempt 1", "Failed — route rejected")}`,
    ),
  });

function w21(state: W21State): string {
  if (state === "register-account")
    return deskWin(
      "admin.greengoods.app/garden/settlement",
      adminDialogM3(w21Behind("unregistered"), "garden", {
        title: "Register settlement account",
        body: `${banner("Register an existing, governance-deployed Celo Safe only after its route and recovery policy have been verified.", "stone")}${field("Celo Safe address", input("0x8a…2d"))}${kv("Policy", "2-of-3 recovery · scoped executor role")}`,
        actions: `${hot("w21.register-dismiss", btn("Cancel", { kind: "ghost" }))}${hot("w21.register-confirm", btn("Register account", { kind: "pri" }))}`,
        closeHot: "w21.register-dismiss",
      }),
    );
  if (state === "requeue-confirm")
    return deskWin(
      "admin.greengoods.app/garden/settlement",
      adminDialogM3(w21Behind("failed"), "garden", {
        title: "Requeue failed delivery",
        body: `${banner("Settlement 103 has an authenticated route rejection. Requeueing preserves attempt 1, clears its old batch, and creates queued attempt 2. Its execution key is created only when attempt 2 dispatches.", "stone")}${kv("Recipient", "Kwame")}${kv("Amount", "100 G$")}${kv("Next state", "Queued · attempt 2")}`,
        actions: `${hot("w21.requeue-dismiss", btn("Keep failed", { kind: "ghost" }))}${hot("w21.requeue-confirm", btn("Requeue attempt", { kind: "pri" }))}`,
        closeHot: "w21.requeue-dismiss",
      }),
    );
  if (state === "batch-create")
    return deskWin(
      "admin.greengoods.app/garden/settlement",
      adminDialogM3(w21Behind("queued"), "garden", {
        title: "Create a delivery batch",
        body: `${banner("Only queued deliveries with the same source, route, version, and gas limit can be grouped. Membership becomes immutable when you create the batch.", "stone")}
${kv("Settlement 104 · Maria", "160 G$ · eligible")}${kv("Settlement 99 · Leila", "10 G$ · eligible")}${kv("Batch total", "2 deliveries · 170 G$")}`,
        actions: `${hot("w21.create-batch-dismiss", btn("Keep unbatched", { kind: "ghost" }))}${hot("w21.create-batch-confirm", btn("Create batch", { kind: "pri" }))}`,
        closeHot: "w21.create-batch-dismiss",
      }),
    );
  if (state === "cancel-queued-confirm")
    return deskWin(
      "admin.greengoods.app/garden/settlement",
      adminDialogM3(w21Behind("queued"), "garden", {
        title: "Cancel queued delivery",
        body: `${banner("This cancels only unbatched settlement 104 before dispatch. No batch members or other queued deliveries change.", "amber", "error-warning-line")}${field("Reason (required)", input("recipient asked to use another route"))}`,
        actions: `${hot("w21.cancel-queued-dismiss", btn("Keep queued", { kind: "ghost" }))}${hot("w21.cancel-queued-confirm", btn("Cancel delivery", { kind: "danger" }))}`,
        closeHot: "w21.cancel-queued-dismiss",
      }),
    );
  if (state === "close-delivery-confirm")
    return deskWin(
      "admin.greengoods.app/garden/settlement",
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
    // The protocol pool's own queue. Protocol-to-garden value is a discretionary
    // Funding disbursement created through queueFunding, never a commitment reward.
    const rows = dtable(
      ["Settlement · attempt", "Recipient", "Kind", "Amount", "State", ""],
      [
        ["105 · attempt 0", "Awka Hub — garden Safe", "Funding · ProtocolToGarden", `<span class="num">25 G$</span>`, chip("Queued", "plain", { dot: true }), hot("w21.dispatch-garden", btn("Dispatch", { kind: "sec", sm: true }))],
        ["98 · attempt 0", "Leila", "Contributor payout", `<span class="num">10 G$</span>`, chip("Confirmed ↗", "ok", { dot: true }), ""],
      ],
      "Protocol pool settlement queue",
    );
    const header = pageHeader({
      title: "Settlement",
      eyebrow: "Protocol · Celo",
      description: "The protocol pool's Celo settlement account — garden funding and contributor payouts remain distinct rails.",
    });
    return deskWin(
      "admin.greengoods.app/community/pools/settlement",
      adminCanvas("community", "community", {
        screenId: "W21",
        garden: "Rocinha",
        header,
        body: acard("Settlement (Celo) — protocol pool", `${rows}${banner("Settlement 105 was created by queueFunding. Its kind is Funding and its immutable route is ProtocolToGarden; it is not tied to commitment fulfillment or a payout plan.", "stone")}`),
      }),
    );
  }
  if (state === "protocol-funding-queued") {
    const rows = dtable(
      ["Settlement · attempt", "Recipient", "Kind", "Route", "Amount", "State", ""],
      [
        [
          "106 · attempt 0",
          "Awka Hub — registered garden Safe",
          "Funding",
          "ProtocolToGarden",
          `<span class="num">500 G$</span>`,
          chip("Queued", "plain", { dot: true }),
          hot("w21.dispatch-funding", btn("Dispatch", { kind: "sec", sm: true })),
        ],
      ],
      "Queued protocol funding",
    );
    const header = pageHeader({
      title: "Garden funding queued",
      eyebrow: "Protocol · Celo",
      description: "A discretionary treasury transfer, separate from commitment fulfillment and contributor payout plans.",
    });
    return deskWin(
      "admin.greengoods.app/community/pools/settlement",
      adminCanvas("community", "community", {
        screenId: "W21",
        garden: "Rocinha",
        header,
        body: acard(
          "Funding queued",
          `${rows}${banner("This Funding row has no commitment ID. queueFunding derived the GG protocol Safe, canonical G$, and the selected garden's registered Safe from onchain configuration.", "stone")}`,
        ),
      }),
    );
  }

  let inner: string;
  switch (state) {
    case "payout-plan":
      inner = acard(
        "Prune the north beds · payout plan",
        `${banner("The provider garden accounts for the fulfilled commitment's support. The recognition vector matches its snapshot hash, and payment weights are derived from this complete amount vector.", "stone", "information-line")}
${kv("Declared support", "500 G$")}${kv("Garden retains", "100 G$")}${kv("Contributor total", "400 G$")}
${dtable(
  ["Contributor", "Recognition", "Payment", "State", ""],
  [
    ["Maria · lead", "40%", "160 G$", chip("Draft", "plain", { dot: true }), ""],
    ["Ana", "35%", "140 G$", chip("Draft", "plain", { dot: true }), ""],
    ["Kwame", "25%", "100 G$", chip("Draft", "plain", { dot: true }), ""],
  ],
  "Contributor payout plan",
)}
${banner("Payment uses the recognition weights without correction. The full vector, retained amount, and reason remain editable until explicit finalization.", "amber")}
<div class="actrow" style="justify-content:flex-end">${hot("w21.edit-plan", btn("Edit draft", { kind: "sec", sm: true }))}${hot("w21.finalize-plan", btn("Finalize payout plan", { kind: "pri", sm: true }))}</div>`,
      );
      break;
    case "payout-plan-edit":
      inner = acard(
        "Edit payout draft",
        `${banner("Resubmit the complete ordered vector. Saving replaces the Draft snapshot atomically; it does not create a second plan or finalize this one.", "stone", "information-line")}
${field("Garden retains", input("100 G$"))}${field("Maria · lead", input("160 G$"))}${field("Ana", input("140 G$"))}${field("Kwame", input("100 G$"))}${field("Reason (required while retaining support)", input("Garden operations and follow-up costs"))}
${kv("Conservation", "100 + 160 + 140 + 100 = 500 G$ · valid")}
<div class="actrow" style="justify-content:flex-end">${hot("w21.edit-cancel", btn("Cancel", { kind: "ghost", sm: true }))}${hot("w21.edit-save", btn("Save complete draft", { kind: "pri", sm: true }))}</div>`,
      );
      break;
    case "payout-finalized":
      inner = acard(
        "Prune the north beds · payout plan",
        `${banner("Finalized. Recognition and payment snapshot hashes match the visible rows, and retained plus contributor amounts equals 500 G$.", "stone", "checkbox-circle-fill")}
${kv("Parent status", "Pending · 0 of 3 prepared")}${kv("Finalized", "Jul 28 · immutable")}${kv("Garden retains", "100 G$")}
${dtable(
  ["Contributor", "Payment", "State", ""],
  [
    ["Maria · lead", "160 G$", chip("Not prepared", "plain"), hot("w21.prepare-payout", btn("Prepare payout", { kind: "sec", sm: true }))],
    ["Ana", "140 G$", chip("Not prepared", "plain"), ""],
    ["Kwame", "100 G$", chip("Not prepared", "plain"), ""],
  ],
  "Finalized contributor payout plan",
)}`,
      );
      break;
    case "payout-prepared":
      inner = acard(
        "Prune the north beds · payout plan",
        `${banner("Maria's frozen row has one immutable queued child. Repeating Prepare payout returns the same settlement ID; it cannot create a duplicate.", "stone", "checkbox-circle-fill")}
${kv("Parent status", "Pending · 1 of 3 prepared")}${kv("Finalized", "Jul 28 · immutable")}${kv("Garden retains", "100 G$")}
${dtable(
  ["Contributor", "Payment", "State", ""],
  [
    ["Maria · lead", "160 G$", chip("Queued · settlement 104", "plain", { dot: true }), hot("w21.dispatch-plan", btn("Dispatch", { kind: "sec", sm: true }))],
    ["Ana", "140 G$", chip("Not prepared", "plain"), hot("w21.prepare-ana", btn("Prepare payout", { kind: "sec", sm: true }))],
    ["Kwame", "100 G$", chip("Not prepared", "plain"), ""],
  ],
  "Prepared contributor payout",
)}`,
      );
      break;
    case "payout-prepared-2":
      inner = acard(
        "Prune the north beds · payout plan",
        `${banner("Maria and Ana now have immutable queued children. Kwame's payable row remains explicitly actionable.", "stone", "checkbox-circle-fill")}
${kv("Parent status", "Pending · 2 of 3 prepared")}${kv("Finalized", "Jul 28 · immutable")}${kv("Garden retains", "100 G$")}
${dtable(
  ["Contributor", "Payment", "State", ""],
  [
    ["Maria · lead", "160 G$", chip("Queued · settlement 104", "plain", { dot: true }), hot("w21.dispatch-plan", btn("Dispatch", { kind: "sec", sm: true }))],
    ["Ana", "140 G$", chip("Queued · settlement 106", "plain", { dot: true }), hot("w21.dispatch-plan", btn("Dispatch", { kind: "sec", sm: true }))],
    ["Kwame", "100 G$", chip("Not prepared", "plain"), hot("w21.prepare-kwame", btn("Prepare payout", { kind: "sec", sm: true }))],
  ],
  "Two prepared contributor payouts",
)}`,
      );
      break;
    case "payout-prepared-all":
      inner = acard(
        "Prune the north beds · payout plan",
        `${banner("Every non-zero frozen payout row has one immutable queued child. The plan can now dispatch individually or enter an optional homogeneous batch.", "stone", "checkbox-circle-fill")}
${kv("Parent status", "Pending · 3 of 3 prepared")}${kv("Finalized", "Jul 28 · immutable")}${kv("Garden retains", "100 G$")}
${dtable(
  ["Contributor", "Payment", "State", ""],
  [
    ["Maria · lead", "160 G$", chip("Queued · settlement 104", "plain", { dot: true }), hot("w21.dispatch-plan", btn("Dispatch", { kind: "sec", sm: true }))],
    ["Ana", "140 G$", chip("Queued · settlement 106", "plain", { dot: true }), hot("w21.dispatch-plan", btn("Dispatch", { kind: "sec", sm: true }))],
    ["Kwame", "100 G$", chip("Queued · settlement 107", "plain", { dot: true }), hot("w21.dispatch-plan", btn("Dispatch", { kind: "sec", sm: true }))],
  ],
  "All contributor payouts prepared",
)}
<div class="actrow" style="justify-content:flex-end">${hot("w21.create-batch", btn("Create batch", { kind: "ghost", sm: true }))}</div>`,
      );
      break;
    case "payout-retained-draft":
      inner = acard(
        "All support retained · payout plan",
`${banner("Draft. The garden retains the full declared support and every contributor payment weight is the canonical zero vector.", "stone", "information-line")}
${kv("Declared support", "500 G$")}${kv("Garden retains", "500 G$")}${kv("Contributor total", "0 G$")}${kv("Divergence reason", "Shared materials and follow-up costs · recorded")}
${banner("Finalization rechecks the recognition and payment snapshots, then completes locally because there is no payable child.", "amber")}
<div class="actrow" style="justify-content:flex-end">${hot("w21.finalize-retained-plan", btn("Finalize retained plan", { kind: "pri", sm: true }))}</div>`,
      );
      break;
    case "payout-retained":
      inner = acard(
        "All support retained · payout plan",
`${banner("Complete without dispatch. The garden retained the full declared support, so finalization created no contributor child and sent no CCIP message. This local completion remains available while member delivery is disabled.", "stone", "checkbox-circle-fill")}
${kv("Declared support", "500 G$")}${kv("Garden retains", "500 G$")}${kv("Contributor total", "0 G$")}${kv("Payment weights", "Maria 0% · Ana 0% · João 0% · canonical zero vector")}${kv("Divergence reason", "Shared materials and follow-up costs · recorded")}${kv("Parent pointer", "Stable · one plan for this commitment")}`,
      );
      break;
    case "payout-partial":
      inner = acard(
        "Prune the north beds · payout plan",
        `${kv("Parent status", "Partial · 2 of 3 arrived")}${kv("Garden retains", "100 G$")}
${dtable(
  ["Contributor", "Payment", "State"],
  [
    ["Maria · lead", "160 G$", chip("Confirmed ↗", "ok", { dot: true })],
    ["Ana", "140 G$", chip("Confirmed ↗", "ok", { dot: true })],
    ["Kwame", "100 G$", chip("Failed — recoverable", "err")],
  ],
  "Contributor payout progress",
)}
${banner("The commitment stays Fulfilled. One failed child delivery never rewrites recognition or the two successful receipts.", "stone")}`,
      );
      break;
    case "payout-complete":
      inner = acard(
        "Prune the north beds · payout plan",
        `${banner("All contributor payouts arrived.", "stone", "checkbox-circle-fill")}${kv("Parent status", "Complete · 3 of 3")}${kv("Garden retained", "100 G$")}${kv("Contributor receipts", "Maria 160 · Ana 140 · Kwame 100 G$")}`,
      );
      break;
    case "unregistered":
      inner = acard(
        "Settlement (Celo)",
        `<div class="t-meta">No registered settlement account yet. Safe creation and the 2-of-3 recovery/Roles policy are Release-gated. After governance deploys and verifies that route, a steward can register the existing account here.</div>${hot("w21.setup", btn("Register existing account", { kind: "pri" }))}`,
      );
      break;
    case "registered":
      inner = acard(
        "Settlement (Celo)",
        `<div class="quietok">${icon("check-line")}Account registered.</div>${kv("Celo Safe", "0x8a…2d")}${kv("Recovery policy", "2 of 3")}${kv("Executor role", "scoped · verified")}<div class="actrow">${hot("w21.open-queue", btn("Open disbursement queue", { kind: "pri", sm: true }))}</div>`,
      );
      break;
    case "requeued":
      inner = acard(
        "Settlement (Celo)",
        `${banner("A new logical attempt is queued. The failed attempt remains in history and cannot be overwritten.", "stone")}${kv("Settlement 103 · attempt 2", "Queued · awaiting dispatch")}${kv("Execution key", "created when this attempt dispatches")}${kv("Previous", "Settlement 103 · attempt 1 · Failed")}<div class="actrow">${hot("w21.open-queue", btn("Back to queue", { kind: "pri", sm: true }))}</div>`,
      );
      break;
    case "batch-created":
      inner = acard(
        "Settlement (Celo)",
        `${banner("Batch #12 is queued. Its two-member snapshot is now immutable; dispatch creates the execution key.", "stone")}${kv("Members", "Maria · 160 G$ · Leila · 10 G$")}${kv("Route", "Rocinha provider garden Safe → contributor accounts")}${kv("State", "Queued · batch #12")}<div class="actrow">${hot("w21.open-batch-command", btn("Open batch command", { kind: "pri", sm: true }))}</div>`,
      );
      break;
    case "cancelled-queued":
      inner = acard(
        "Settlement (Celo)",
        `${banner("Settlement 104 was cancelled before dispatch. No command or batch was created.", "stone")}${kv("State", "Cancelled from Queued")}${kv("Reason", "recipient asked to use another route")}${hot("w21.open-queue", btn("Back to queue", { kind: "sec", sm: true }))}`,
      );
      break;
    case "batch-cancelled":
      inner = acard(
        "Settlement (Celo)",
        `${banner("Batch #12 and both immutable members were cancelled before dispatch.", "stone")}${kv("State", "Cancelled from Queued")}${kv("Members", "Maria · 160 G$ · Leila · 10 G$")}${kv("Reason", "garden withdrew the request before dispatch")}${hot("w21.open-queue", btn("Back to queue", { kind: "sec", sm: true }))}`,
      );
      break;
    case "cancelled-failed":
      inner = acard(
        "Settlement (Celo)",
        `${banner("Settlement 103 is closed. Its failed attempt and bounded route-rejection code remain in history.", "stone")}${kv("State", "Cancelled from Failed")}${kv("Previous", "Attempt 1 · route rejected")}${kv("Reason", "recipient account cannot receive; handled off-platform")}${hot("w21.open-queue", btn("Back to queue", { kind: "sec", sm: true }))}`,
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
        hot("w21.create-batch", btn("Create batch", { kind: "pri", sm: true })),
      )}`;
  }
  const header = pageHeader({
    title: "Settlement",
    eyebrow: "Garden · Celo",
    description: "The garden's Celo settlement account — disbursement queue, batches, and delivery gate.",
  });
  return deskWin(
    "admin.greengoods.app/garden/settlement",
    adminCanvas("garden", "garden", { screenId: "W21", garden: "Rocinha", header, body: inner }),
  );
}

const W21_HOTS: HifiDef["hots"] = {
  "w21.edit-plan": { l: "Edit payout draft", to: "screen:W21@payout-plan-edit", info: "Opens the complete Draft vector, retained amount, and reason before finalization." },
  "w21.edit-cancel": { l: "Cancel payout draft edit", to: "screen:W21@payout-plan", info: "Returns to the unchanged Draft plan." },
  "w21.edit-save": { l: "Save complete payout draft", to: "screen:W21@payout-plan", info: "Calls setContributorPayouts with the complete ordered contributor vector, retention, totals, and required reason; the stable parent pointer and Draft status remain unchanged.", calls: ["setContributorPayouts"] },
  "w21.finalize-plan": { l: "Finalize payout plan", to: "screen:W21@payout-finalized", info: "Verifies recognition/payment snapshot integrity, canonical recipients, and exact retained-plus-payout conservation, then freezes this payable plan as Pending without creating child disbursements.", calls: ["finalizeCommitmentPayoutPlan"], resultFacts: { payoutPlan: "Pending" } },
  "w21.finalize-retained-plan": { l: "Finalize retained-only payout plan", to: "screen:W21@payout-retained", info: "Verifies the all-zero contributor vector and exact full retention, then completes immediately with no child or CCIP command.", calls: ["finalizeCommitmentPayoutPlan"], resultFacts: { payoutPlan: "Complete" } },
  "w21.prepare-payout": { l: "Prepare contributor payout", to: "screen:W21@payout-prepared", info: "Materializes one immutable queued child from Maria's finalized payout row. An exact repeat returns the same ID without emitting again.", calls: ["prepareContributorPayout"] },
  "w21.prepare-ana": { l: "Prepare Ana payout", to: "screen:W21@payout-prepared-2", info: "Materializes Ana's one immutable queued child from her frozen non-zero row; Maria's existing child is unchanged.", calls: ["prepareContributorPayout"] },
  "w21.prepare-kwame": { l: "Prepare Kwame payout", to: "screen:W21@payout-prepared-all", info: "Materializes Kwame's one immutable queued child; every payable row is now prepared exactly once.", calls: ["prepareContributorPayout"] },
  "w21.dispatch-plan": { l: "Dispatch contributor payout", to: "screen:W22@individual-dispatched", info: "Dispatches one unbatched child contributor payout from the garden Safe after explicit parent finalization.", calls: ["dispatchDisbursement"] },
  "w21.dispatch-garden": {
    l: "Dispatch protocol-to-garden funding",
    to: "screen:W22@garden-command",
    info: "Settlement 105 was created by queueFunding as Funding/ProtocolToGarden. dispatchDisbursement rechecks both settlement accounts, creates its immutable execution key, and sends the data-only command; no commitment reward or payout plan is involved.",
    calls: ["dispatchDisbursement"],
    facts: { disbursement: "Queued", disbursementKind: "Funding", disbursementRoute: "ProtocolToGarden", settlementAccount: "Active", beneficiarySettlementAccount: "Active" },
  },
  "w21.dispatch-funding": {
    l: "Dispatch queued garden funding",
    to: "screen:W22@garden-command",
    info: "Dispatches the typed Funding/ProtocolToGarden row created by queueFunding after rechecking both settlement accounts; no commitment or payout-plan identity is attached.",
    calls: ["dispatchDisbursement"],
    facts: { disbursement: "Queued", disbursementKind: "Funding", disbursementRoute: "ProtocolToGarden", settlementAccount: "Active", beneficiarySettlementAccount: "Active" },
  },
  "w21.setup": { l: "Register existing account", to: "screen:W21@register-account", info: "Opens registration only for an already-deployed and verified Celo Safe." },
  "w21.register-dismiss": { l: "Cancel registration", to: "screen:W21@unregistered", info: "Leaves the garden without a registered settlement account." },
  "w21.register-confirm": { l: "Register settlement account", to: "screen:W21@registered", info: "registerSettlementAccount stores the verified Celo Safe route for this pool.", calls: ["registerSettlementAccount"] },
  "w21.open-queue": { l: "Open disbursement queue", to: "screen:W21", info: "Returns to the garden's settlement queue." },
  "w21.gate-row": { l: "Delivery-gate status row", info: "Read-only (register #34f): enabled/disabled · changed by · date · evidence. The flip is owner-only ops (SS:172)." },
  "w21.dispatch": { l: "Dispatch", to: "screen:W22", info: "The resolved settlement steward or configured dispatcher sends the immutable queued command from the monitored unreserved native ETH balance. The module owner has no independent dispatch authority." },
  "w21.requeue": { l: "Source follow-up", to: "screen:W21@requeue-confirm", info: "A next attempt requires an authenticated failure and the future source integration." },
  "w21.requeue-dismiss": { l: "Keep failed", to: "screen:W21@failed-recovery", info: "Leaves the authenticated failure available for a later source follow-up." },
  "w21.requeue-confirm": { l: "Requeue attempt", to: "screen:W21@requeued", info: "requeue clears the old batch id and increments attempts; the new execution key is created only on the next unbatched dispatch.", calls: ["requeue"] },
  "w21.cancel-disb": { l: "Cancel unbatched queued command", to: "screen:W21@cancel-queued-confirm", info: "The planned cancelDisbursement path is available before dispatch only when batchId == 0; an immutable Queued batch is cancelled only in full." },
  "w21.cancel-queued-dismiss": { l: "Keep queued", to: "screen:W21", info: "Closes the confirmation without changing settlement 104." },
  "w21.cancel-queued-confirm": { l: "Cancel queued delivery", to: "screen:W21@cancelled-queued", info: "cancelDisbursement changes only this unbatched Queued settlement and stores the reason.", calls: ["cancelDisbursement"] },
  "w21.cancel-failed": { l: "Close failed delivery", to: "screen:W21@close-delivery-confirm", info: "An authenticated Failed member may be terminally cancelled instead of requeued. The failed attempt and bounded failure code remain visible." },
  "w21.close-dismiss": { l: "Keep for retry", to: "screen:W21@failed-recovery", info: "Closes the confirmation, leaving the failed member available for a source follow-up." },
  "w21.close-delivery-confirm": { l: "Close delivery (confirm)", to: "screen:W21@cancelled-failed", info: "Failed → Cancelled preserves the failed attempt and creates no new execution key (SS §3.1).", calls: ["cancelDisbursement"] },
  "w21.request-details": { l: "Acknowledgment details", info: "Celo execution is stored before its acknowledgement and can remain confirming while the source state is Dispatched." },
  "w21.create-batch": { l: "Create batch", to: "screen:W21@batch-create", info: "Opens the homogeneous queued-member review before createBatch makes the membership immutable." },
  "w21.create-batch-dismiss": { l: "Keep unbatched", to: "screen:W21", info: "Closes the review without assigning a batch id." },
  "w21.create-batch-confirm": { l: "Create batch", to: "screen:W21@batch-created", info: "createBatch stores the immutable homogeneous member snapshot while the batch remains Queued.", calls: ["createBatch"] },
  "w21.open-batch-command": { l: "Open batch command", to: "screen:W22", info: "Opens queued batch #12 in the command/ack console." },
};

// ---------------------------------------------------------------------------
// W22 — command/ack console (settlement-spec §7)
// ---------------------------------------------------------------------------

const W22_STATES = [
  ["ready", "Queued"], ["dispatched", "Dispatched"], ["delivery-delayed", "Delivery delayed"], ["executed", "Celo executed"],
  ["acknowledgment-pending", "Acknowledgment pending"], ["outcome", "Confirmed / failed"], ["role-guard", "Route gate"],
  ["cancel-batch-confirm", "Cancel batch — confirm"], ["garden-command", "Protocol-to-garden funding command"],
  ["individual-dispatched", "Contributor payout — dispatched"],
] as const;
type W22State = (typeof W22_STATES)[number][0];

const w22Members = dtable(
  ["Member", "Amount", "To"],
  [["Maria", `<span class="num">160 G$</span>`, `<span class="num">0x12…9a</span>`], ["Leila", `<span class="num">10 G$</span>`, `<span class="num">0x77…3c</span>`]],
  "Batch #12 members",
);

// Dimmed batch route behind the cancel confirmation, hotspot-free.
const w22Behind = () =>
  adminCanvas("garden", "garden", {
    screenId: "W22",
    garden: "Rocinha",
    interactiveChrome: false,
    header: pageHeader({ title: "Settlement 104", eyebrow: "Command/ack console", description: "The source sends a data-only command and waits for the bounded Celo executor acknowledgment." }),
    body: acard("Batch", `${kv("Batch #12", "2 immutable members · Maria 160 G$ · Leila 10 G$")}${stages(["Queued", "Dispatched", "Celo executed", "Confirmed"], 0)}`),
  });

function w22(state: W22State): string {
  if (state === "cancel-batch-confirm")
    return deskWin(
      "admin.greengoods.app/garden/settlement/batch",
      adminDialogM3(w22Behind(), "garden", {
        title: "Cancel this batch",
        body:
          banner(
            "Cancelling closes all 2 members of batch #12 at once — Maria (160 G$) and Leila (10 G$). Queued batch membership is immutable, so there is no partial cancellation and no member can be kept.",
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
      "admin.greengoods.app/community/pools/settlement/command",
      adminCanvas("community", "community", {
        screenId: "W22",
        garden: "Rocinha",
        header,
        body: acard(
          "Command",
          `${stages(["Queued", "Dispatched", "Celo executed", "Confirmed"], 1)}
${banner("Funding/ProtocolToGarden was queued independently through queueFunding, then dispatched with its immutable execution key. The Celo executor moves 25 G$ from the GG protocol Safe to Awka Hub's Safe, stores the outcome, then acknowledges — arrival is not proven until that acknowledgment lands.", "stone")}
${kv("Disbursement kind", "Funding")}${kv("Funding route", "ProtocolToGarden")}${kv("Command message", "0xbd…07 · CCIP Explorer ↗")}${kv("Payer", "GG protocol Safe · Celo")}${kv("Recipient", "Awka Hub · garden Safe on Celo")}${kv("Amount", "25 G$ · canonical")}
<div class="actrow" style="justify-content:flex-end">${hot("w22.garden-open-ops", btn("Open Operations", { kind: "sec", icon: "external-link-line" }))}</div>`,
        ),
      }),
    );
  }

  if (state === "individual-dispatched") {
    const header = pageHeader({
      title: "Settlement 104",
      eyebrow: "Individual command/ack console",
      description: "One finalized contributor child is dispatched independently from every batch.",
    });
    return deskWin(
      "admin.greengoods.app/garden/settlement/104",
      adminCanvas("garden", "garden", {
        screenId: "W22",
        garden: "Rocinha",
        header,
        body: acard(
          "Contributor payout",
          `${stages(["Queued", "Dispatched", "Celo executed", "Confirmed"], 1)}
${banner("Maria's unbatched command keeps its own execution key. A same-key retry changes only the CCIP message ID and cannot target batch #12.", "stone")}
${kv("Recipient", "Maria · 0x12…9a")}${kv("Amount", "160 G$")}${kv("Command message", "0xab…14 · CCIP Explorer ↗")}${kv("Batch", "None · individual child")}
<div class="actrow" style="justify-content:flex-end">${hot("w22.retry-individual-command", btn("Retry same command", { kind: "pri" }))}</div>`,
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
    `${kv("Settlement 104 — attempt 0", "message-only command · no token amounts")}${kv("Payer", "Rocinha garden Safe · Celo")}${kv("Plan", "Prune the north beds · contributor payout")}${kv("Route snapshot", "Celo selector · executor 0x5e…91 · v1 · 240,000 gas")}${kv("Batch #12", "2 immutable child payouts · limit 8 · ceiling 24")}`,
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
    "admin.greengoods.app/garden/settlement/batch",
    adminCanvas("garden", "garden", { screenId: "W22", garden: "Rocinha", header, body: acard("Batch", inner) }),
  );
}

const W22_HOTS: HifiDef["hots"] = {
  "w22.garden-open-ops": { l: "Open Operations", to: "screen:W24@flows", info: "The capability-gated cross-garden funds board separates contributor payout-plan delivery from discretionary ProtocolToGarden funding." },
  "w22.route-gate": { l: "Open route gate", to: "screen:W22@role-guard", info: "The production typed Safe/Zodiac route is a release gate, not an implemented adapter." },
  "w22.cancel-batch": { l: "Cancel whole queued batch", to: "screen:W22@cancel-batch-confirm", info: "Requires a reason and blast-radius confirmation. `cancelBatch` atomically marks the Queued batch and every immutable member Cancelled-from-Queued; partial cancellation is impossible." },
  "w22.cancel-dismiss": { l: "Keep batch queued", to: "screen:W22", info: "Closes the confirmation with the batch untouched." },
  "w22.cancel-batch-confirm": { l: "Cancel batch (confirm)", to: "screen:W21@batch-cancelled", info: "cancelBatch atomically marks the Queued batch and every immutable member Cancelled-from-Queued (SS §3.1.3).", calls: ["cancelBatch"] },
  "w22.dispatch-command": { l: "Dispatch command", to: "screen:W22@dispatched", info: "The resolved settlement steward or configured dispatcher sends the immutable queued command from the monitored unreserved native ETH balance. The module owner has no independent dispatch authority.", calls: ["dispatchBatch"] },
  "w22.open-command-explorer": { l: "Open command in CCIP Explorer", to: "screen:W22@delivery-delayed", info: "The command message ID opens transport status. This prototype advances to the derived delayed example." },
  "w22.manual-execution-guide": { l: "Manual-execution guidance", info: "Manual execution is an external CCIP recovery procedure and appears only when CCIP Explorer reports the message eligible; it never marks payment complete." },
  "w22.retry-command": { l: "Retry command", to: "screen:W22@executed", info: "A transport retry preserves the execution key and payload, and cannot create a second Celo execution.", calls: ["retryBatchCommand"] },
  "w22.retry-individual-command": { l: "Retry individual command", to: "screen:W22@individual-dispatched", info: "Retries only settlement 104 with retryCommand; batch #12 and every other contributor child remain untouched.", calls: ["retryCommand"] },
  "w22.open-destination-explorer": { l: "Open destination transaction", info: "The destination transaction is evidence of Celo execution, but arrival remains unconfirmed until the authenticated acknowledgment reaches Arbitrum." },
  "w22.retry-acknowledgment": { l: "Retry acknowledgment", to: "screen:W22@acknowledgment-pending", info: "Permissionless destination retry sends the stored outcome without moving G$ again.", calls: ["retryAcknowledgment"] },
  "w22.retry-acknowledgment-again": { l: "Retry acknowledgment", info: "CELO reserve or delivery recovery may retry the stored acknowledgment independently.", calls: ["retryAcknowledgment"] },
  "w22.requeue-member": { l: "Source follow-up", to: "screen:W21@requeue-confirm", info: "A new source attempt requires an authenticated failure acknowledgment and integration-owned source facts." },
};

// ---------------------------------------------------------------------------
// W24 — Operations workspace (wireframes.md:881, capability-gated)
// ---------------------------------------------------------------------------

const W24_STATES = [
  ["queue", "Queue"],
  ["ccip", "CCIP"],
  ["flows", "Flows"],
  ["flows-funding-unavailable", "Flows · funding unavailable"],
  ["funding", "Seed / top up"],
  ["funding-unauthorized", "Funding unavailable"],
] as const;
type W24State = (typeof W24_STATES)[number][0];

function w24(state: W24State): string {
  // The rail tabs ARE this screen's states — wire each inactive tab to navigate.
  const stateIx = state === "queue" ? 0 : state === "ccip" ? 1 : 2;
  const rail = tabRail(
    [
      { label: "Queue", count: 3, hot: "w24.tab-queue" },
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
    case "flows-funding-unavailable":
    case "flows": {
      const canQueueFunding = state === "flows";
      inner = acard(
        "Cross-chain funds board",
        `<div class="arow">${hot("w24.inflow-row", `<div class="grow">GoodDollar pool → GG protocol Safe</div>`)}<span class="num">balance 4,120 G$</span>${chip("Celo read", "plain")}</div>
${hot(canQueueFunding ? "w24.queue-funding" : "w24.queue-funding-unavailable", `<div class="arow"><div class="grow">GG protocol Safe → garden Safes</div><span class="t-meta num">discretionary treasury funding</span>${btn(canQueueFunding ? "Seed / top up" : "Funding unavailable", { kind: "sec", sm: true })}</div>`)}
<div class="arow"><div class="grow">Garden Safes → members</div><span class="t-meta num">source integration gate</span></div>
${hot("w24.gardens", `<div class="arow"><div class="grow">Gardens: Awka kept 8/9 · Muizenberg kept 5/6</div>${chip("alphabetical", "plain")}</div>`)}
${banner(canQueueFunding ? "Commitment-earned support follows the provider garden's payout-plan actions. Seed / top up is a separate protocol-steward/module-owner treasury action. Inflow is a Celo balance read — no upstream hop is recorded." : "This account can inspect Operations through another capability, but it cannot queue garden funding. Inflow remains a Celo balance read — no upstream hop is recorded.", "stone")}`,
      );
      break;
    }
    case "funding":
      inner = acard(
        "Seed or top up a garden",
        `${banner("Available only to a current protocol steward or the SettlementModule owner. Onchain queueFunding authority, not deployer status, controls submission.", "stone")}
${field("Garden", radio([{ label: "Awka Hub", meta: "registered Celo Safe", on: true }, { label: "Muizenberg", meta: "registered Celo Safe" }], { interactive: true, name: "funding-garden" }))}
${field("Amount", input("500 G$"))}
${kv("Source", "GG protocol Safe · Celo")}${kv("Recipient", "Selected garden's registered Celo Safe")}
${banner("Treasury support outside a commitment. This does not fulfill, reward, or alter a promise; fulfilled commitments use the provider garden's contributor payout plan.", "stone")}
<div class="actrow" style="justify-content:flex-end">${hot("w24.cancel-funding", btn("Cancel", { kind: "ghost" }))}${hot("w24.queue-funding-confirm", btn("Queue seed / top up", { kind: "pri" }))}</div>`,
      );
      break;
    case "funding-unauthorized":
      inner = acard(
        "Garden funding unavailable",
        `${banner("Your connected account is neither a current protocol steward nor the SettlementModule owner.", "amber", "error-warning-line")}
${kv("Required capability", "Protocol steward or SettlementModule owner")}${kv("Deployer role", "Does not grant queueFunding authority")}
<div class="t-meta">Another Operations capability may still grant read or settlement access, but this account cannot submit garden funding.</div>`,
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
            ["Muizenberg", `Funding · ProtocolToGarden · no commitment`, chip("Queued", "plain", { dot: true }), hot("w24.execute-funding", btn("Dispatch ▸", { kind: "sec", sm: true }))],
          ],
          "All gardens settlement queue",
        ) + banner("Only emitted Queued or Failed rows appear here. Route access is capability-gated, and each write still checks its own onchain authority.", "stone"),
      );
  }
  const header = pageHeader({
    title: "Operations",
    eyebrow: "Protocol execution · capability-gated",
    description: "Every garden's command queue, CCIP health, and cross-chain funds — one execution home.",
  });
  return deskWin(
    "admin.greengoods.app/operations",
    adminCanvas("actions", "operations", { screenId: "W24", garden: "Rocinha", header, tabRail: rail, body: inner }),
  );
}

const W24_HOTS: HifiDef["hots"] = {
  "w24.tab-queue": { l: "Queue tab", to: "screen:W24@queue", info: "Cross-garden execution queue." },
  "w24.tab-ccip": { l: "CCIP tab", to: "screen:W24@ccip", info: "Command/ack peer, native fee reserve, and acknowledgment-delay health." },
  "w24.tab-flows": { l: "Flows tab", to: "screen:W24@flows", info: "Cross-chain funds board with transport state, not raw G$ indexing." },
  "w24.execute": { l: "Dispatch command", to: "screen:W22", info: "Cross-garden source-command home; production value authority remains externally gated." },
  "w24.execute-funding": { l: "Dispatch queued funding", to: "screen:W22@garden-command", info: "Dispatches an already-emitted Funding/ProtocolToGarden row with no commitment identity after rechecking both settlement accounts.", calls: ["dispatchDisbursement"] },
  "w24.queue-funding": { l: "Seed or top up a garden", to: "screen:W24@funding", info: "Rendered only when canQueueFunding is true; deployer status alone is insufficient." },
  "w24.queue-funding-unavailable": { l: "Garden funding unavailable", to: "screen:W24@funding-unauthorized", info: "Capability-specific fixture: the account may inspect Operations but lacks current queueFunding authority." },
  "w24.cancel-funding": { l: "Cancel garden funding", to: "screen:W24@flows", info: "Returns to the funds board without creating a disbursement." },
  "w24.queue-funding-confirm": {
    l: "Queue seed or top up",
    to: "screen:W21@protocol-funding-queued",
    info: "queueFunding derives the GG protocol Safe, selected garden Safe, and canonical G$ token. It creates Funding/ProtocolToGarden with no commitment ID.",
    calls: ["queueFunding"],
  },
  "w24.requeue": { l: "Source follow-up", to: "screen:W21@requeue-confirm", info: "A new logical attempt requires an authenticated failure and source integration ownership." },
  "w24.inflow-row": { l: "Inflow row (Celo read)", info: "Protocol-Safe inflow is a Celo balance read — the module records no upstream hop (corrections-log §9)." },
  "w24.gardens": { l: "No-ranking invariant", info: "Cross-garden oversight rows sort alphabetically; never ranked (UX:314)." },
};

// ---------------------------------------------------------------------------
// W26 — cycle close → allocation → certificate wizard (wireframes.md:691;
// absorbs MF-9's reconciliation report as its Review step)
// ---------------------------------------------------------------------------

const W26_STATES = [
  ["review", "1 · Review"], ["recognition-blocked", "Recognition blocked"], ["shares", "2 · Shares"], ["certificate", "3 · Certificate"], ["rest", "4 · Rest the cycle"],
  ["paused-review", "Paused · 1 · Review"], ["paused-shares", "Paused · 2 · Shares"],
  ["paused-certificate", "Paused · 3 · Certificate"], ["paused-rest", "Paused · 4 · Rest the cycle"],
] as const;
type W26State = (typeof W26_STATES)[number][0];
type W26Phase = "review" | "shares" | "certificate" | "rest";

function w26(state: W26State): string {
  if (state === "recognition-blocked") {
    const header = pageHeader({
      title: "Recognition data conflict",
      eyebrow: "Close cycle · blocking review",
      description: "A legacy or indexed record conflicts with the protocol's fulfillment invariants.",
    });
    const body = `<div class="flowform">
${banner("Certificate expansion is blocked. Green Goods never awards this commitment to the lead automatically.", "amber", "error-warning-line")}
${kv("Commitment", "Repair the shared tool handles")}${kv("Before", "Eligible contributors · 0")}${kv("Roster", "Maria · lead · Ana · Kwame")}
${banner("New commitments cannot reach Ready or resolve as Fulfilled without an available recognition policy and at least one verified contributor. This inconsistent record needs a governed migration or source-data correction; mint metadata cannot change on-chain credit.", "stone", "shield-check-line")}
<div class="actrow">${hot("w26.recognition-blocked-back", btn("Back to review", { kind: "pri" }))}</div>
</div>`;
    return deskWin(
      "admin.greengoods.app/garden/pool/close",
      adminCanvas("garden", "garden", { screenId: "W26", garden: "Rocinha", header, body }),
    );
  }
  const paused = state.startsWith("paused-");
  const phase = (paused ? state.slice("paused-".length) : state) as W26Phase;
  const stepIx = phase === "review" ? 0 : phase === "shares" ? 1 : phase === "certificate" ? 2 : 3;
  const h = (name: "continue-shares" | "continue-certificate" | "mint" | "compost") =>
    `w26.${paused ? "paused-" : ""}${name}`;
  let inner: string;
  switch (phase) {
    case "shares":
      inner = `${kv("Gardeners", "60%")}${kv("Treasury", "15%")}${kv("Steward", "10%")}${kv("Evaluator", "5%")}${kv("Community", "5%")}${kv("Funder", "5%")}
${banner("Read-only — the six-role snapshot locked when this cycle opened.", "stone")}
${hot(h("continue-certificate"), btn("Continue", { kind: "pri" }))}`;
      break;
    case "certificate":
      inner = `${kv("Bundle", "7 fulfilled promises + their work, evidence, and need lineage")}${kv("Allowlist", "from the shares above")}${kv("Holder", "the garden account")}
${hot(h("mint"), btn("Mint impact certificate", { kind: "pri" }))}
${banner("Uses the garden's existing impact-certificate pipeline.", "stone")}`;
      break;
    case "rest":
      inner = `${kv("Aggregates", "roll into pool history")}${kv("Next season", "seeds fresh on this pool")}
${hot(h("compost"), btn("Compost closed cycle", { kind: "pri" }))}
<div class="quietok">${icon("check-line")}Certificate minted · 7 promises bundled.</div>`;
      break;
    default:
      inner = `${kv(CYCLE, `${SEASON_LIVE.made} promises · ${SEASON_LIVE.kept} kept`)}
${kv("Terminal set", "7 fulfilled · 1 expired · 1 cancelled after steward review")}
${banner("Every commitment is terminal and liveCommitmentCount is zero. Close the cycle now to lock this exact bundle before shares are reviewed or the certificate is minted.", "stone")}
${hot(h("continue-shares"), btn("Close cycle and continue", { kind: "pri" }))}`;
  }
  if (paused)
    inner = `${banner("The pool remains paused throughout this cycle close. Step 1 closes the cycle to Reconciled; the final step composts it.", "amber", "error-warning-line")}${inner}`;
  const header = pageHeader({
    title: "Close cycle",
    eyebrow: `${paused ? "Pool paused · " : ""}Step ${stepIx + 1} of 4`,
    description: "Season of First Rains — close, share, certify, then rest.",
    actions: stepDots(4, stepIx),
  });
  return deskWin(
    "admin.greengoods.app/garden/pool/close",
    adminCanvas("garden", "garden", { screenId: "W26", garden: "Rocinha", header, body: `<div class="flowform">${inner}</div>` }),
  );
}

const W26_HOTS: HifiDef["hots"] = {
  "w26.recognition-blocked-back": { l: "Back to review", to: "screen:W26", info: "Leaves certificate expansion blocked and returns to the terminal-set review; no metadata-only action can mutate canonical recognition credit." },
  "w26.continue-certificate": { l: "Continue to certificate", to: "screen:W26@certificate", info: "Moves from the allocation snapshot to the existing impact-certificate pipeline." },
  "w26.continue-shares": { l: "Close cycle and continue to shares", to: "screen:W26@shares", info: "With every commitment terminal and liveCommitmentCount zero, closeCycle locks the exact fulfilled bundle before any share review or certificate mint.", calls: ["closeCycle"] },
  "w26.mint": { l: "Mint impact certificate", to: "screen:W26@rest", info: "Existing Hypercert pipeline; bundle = fulfilled promises + work, evidence, need lineage; allowlist from the six-role shares (CS §9)." },
  "w26.compost": { l: "Compost closed cycle", to: "screen:W7@cycle-composted", info: "The certificate already uses the Reconciled cycle's locked bundle; compostCycle now archives it without another close call.", calls: ["compostCycle"] },
  "w26.paused-continue-shares": { l: "Close cycle and continue while pool paused", to: "screen:W26@paused-shares", info: "With every commitment terminal and liveCommitmentCount zero, closeCycle locks the exact bundle while leaving the pool Paused.", calls: ["closeCycle"] },
  "w26.paused-continue-certificate": { l: "Continue to certificate while pool paused", to: "screen:W26@paused-certificate", info: "Keeps the pool Paused while reading the cycle's locked allocation snapshot." },
  "w26.paused-mint": { l: "Mint impact certificate while pool paused", to: "screen:W26@paused-rest", info: "Uses the existing certificate pipeline without changing pool or cycle lifecycle state." },
  "w26.paused-compost": { l: "Compost closed cycle while pool paused", to: "screen:W7@paused-cycle-composted", info: "The cycle was closed before minting; compostCycle archives it while the pool remains Paused.", calls: ["compostCycle"] },
};

// ---------------------------------------------------------------------------

const w21Facts = (state: W21State): StateFacts | undefined => {
  if (state === "unregistered" || state === "register-account") return { settlementAccount: "Unregistered" };
  if (state === "registered") return { settlementAccount: "Registered" };
  if (state === "payout-plan" || state === "payout-plan-edit" || state === "payout-retained-draft")
    return { payoutPlan: "Draft", settlementAccount: "Active" };
  if (state === "payout-finalized") return { payoutPlan: "Pending", settlementAccount: "Active" };
  if (state === "payout-prepared" || state === "payout-prepared-2" || state === "payout-prepared-all")
    return { payoutPlan: "Pending", disbursement: "Queued", settlementAccount: "Active" };
  if (state === "payout-retained") return { payoutPlan: "Complete" };
  if (state === "payout-partial") return { payoutPlan: "Partial" };
  if (state === "payout-complete") return { payoutPlan: "Complete" };
  if (state === "failed-recovery" || state === "requeue-confirm" || state === "close-delivery-confirm")
    return { disbursement: "Failed", settlementAccount: "Active" };
  if (["queue", "requeued", "batch-create", "batch-created", "cancel-queued-confirm", "protocol-queue"].includes(state))
    return { disbursement: "Queued", settlementAccount: "Active" };
  if (state === "protocol-funding-queued")
    return {
      disbursement: "Queued",
      disbursementKind: "Funding",
      disbursementRoute: "ProtocolToGarden",
      settlementAccount: "Active",
      beneficiarySettlementAccount: "Active",
    };
  if (state === "cancelled-queued" || state === "batch-cancelled" || state === "cancelled-failed")
    return { disbursement: "Cancelled" };
  return undefined;
};

const w22Facts = (state: W22State): StateFacts | undefined => {
  if (state === "ready" || state === "role-guard" || state === "cancel-batch-confirm")
    return { disbursement: "Queued", settlementAccount: "Active" };
  if (["dispatched", "delivery-delayed", "executed", "acknowledgment-pending", "garden-command", "individual-dispatched"].includes(state))
    return { disbursement: "Dispatched" };
  return undefined;
};

const w24Facts = (state: W24State): StateFacts | undefined => {
  if (state === "queue")
    return {
      disbursement: "Queued",
      disbursementKind: "Funding",
      disbursementRoute: "ProtocolToGarden",
      settlementAccount: "Active",
      beneficiarySettlementAccount: "Active",
    };
  // Authority, not deployer status, is what the funding form validates against.
  if (state === "funding")
    return {
      settlementAccount: "Active",
      beneficiarySettlementAccount: "Active",
      queueFundingAuthority: "ProtocolSteward",
    };
  if (state === "funding-unauthorized")
    return {
      settlementAccount: "Active",
      beneficiarySettlementAccount: "Active",
      queueFundingAuthority: "None",
    };
  return undefined;
};

export const SETTLEMENT_DEFS: HifiDef[] = [
  { screen: { id: "W12", title: "W12 · Community → Pools", surface: "admin", frame: "desktop", group: "Admin console",
    states: W12_STATES.map(([id, label]) => ({
      id,
      label,
      facts: id === "protocol" ? { commitment: "Requested", kind: "SupportService" } satisfies StateFacts : undefined,
      html: w12(id),
    })) }, hots: { ...adminChromeHots("w12", "community"), ...W12_HOTS } },
  { screen: { id: "W21", title: "W21 · Settlement section (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: W21_STATES.map(([id, label]) => ({ id, label, facts: w21Facts(id), html: w21(id) })) }, hots: { ...adminChromeHots("w21", "garden"), ...W21_HOTS } },
  { screen: { id: "W22", title: "W22 · Command/ack console", surface: "admin", frame: "desktop", group: "Admin console",
    states: W22_STATES.map(([id, label]) => ({ id, label, facts: w22Facts(id), html: w22(id) })) }, hots: { ...adminChromeHots("w22", "garden"), ...W22_HOTS } },
  { screen: { id: "W24", title: "W24 · Operations workspace (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: W24_STATES.map(([id, label]) => ({ id, label, facts: w24Facts(id), html: w24(id) })) }, hots: { ...adminChromeHots("w24", "operations"), ...W24_HOTS } },
  { screen: { id: "W26", title: "W26 · Cycle-close wizard (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: W26_STATES.map(([id, label]) => ({
      id,
      label,
      facts: {
        pool: id.startsWith("paused-") ? "Paused" : "Open",
        cycle: id === "review" || id === "paused-review" || id === "recognition-blocked" ? "Open" : "Reconciled",
        cycleLiveCommitments: "Zero",
        poolLiveCommitments: "Zero",
        poolNonTerminalCycles: "One",
      } satisfies StateFacts,
      html: w26(id),
    })) }, hots: { ...adminChromeHots("w26", "garden"), ...W26_HOTS } },
];
