// Admin hi-fi screens — W7 garden pool tab, W8 seeding console, W9 analog
// capture, W10 commitment dialog, W11 allocation, W13 hub confirm, W14
// assessment additions, HUBWORK. Restrained M3 operator cockpit (.s-admin):
// solid dense surfaces, Plus Jakarta Sans stack, quiet checkmarks, no hero
// language. Copy: "steward" everywhere (#28c); on-chain `operator` allocation
// class RENDERS as "steward" (W11 rule). Dissolved lo-fi variants: MF1 →
// W7@ready, MF4 → W7@expiry-queue, W7X → W7@claim-outcomes, MF13 →
// W10@attach-assessment.

import { hot } from "../html";
import { icon } from "../icons";
import { banner, btn, chip, field, input, kv, meter, radio, stepDots } from "../kit";
import type { HifiDef } from "./index";

// ---- admin chrome helpers ---------------------------------------------------

export function deskWin(url: string, body: string): string {
  return `<div class="deskwin"><div class="winbar"><span class="dots"><i></i><i></i><i></i></span><span class="url">${url}</span></div>${body}</div>`;
}

export function adminBar(active: "garden" | "community" | "hub" | "operations"): string {
  const tabs: [string, string][] = [["garden", "Garden"], ["community", "Community"], ["hub", "Hub"], ["operations", "Operations"]];
  return `<div class="adminbar"><span class="brand">${icon("seedling-line", "s")}Green Goods</span><span class="wstabs">${tabs
    .map(([id, l]) => `<button type="button" class="wstab${id === active ? " on" : ""}">${l}</button>`)
    .join("")}</span><span class="acct">DA</span></div>`;
}

export const vhead = (title: string, meta: string, trailing = "") =>
  `<div class="vhead"><h2>${title}</h2><span class="vm">${meta}</span>${trailing ? `<span class="vx">${trailing}</span>` : ""}</div>`;

export const acard = (head: string, body: string, trailing = "") =>
  `<div class="acard"><div class="ahead"><span class="at">${head}</span>${trailing ? `<span class="ax">${trailing}</span>` : ""}</div>${body}</div>`;

export const atable = (heads: string[], rows: string[][]) =>
  `<table class="atab"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;

export const stages = (list: string[], activeIx: number) =>
  `<div class="stages">${list
    .map((s, i) => `<span class="st1${i < activeIx ? " done" : i === activeIx ? " on" : ""}"><i></i>${s}</span>`)
    .join(`<span class="sep"></span>`)}</div>`;

export const adminDialog = (behind: string, title: string, body: string, actions: string) =>
  `<div class="dlgstage"><div class="behind">${behind}</div><div class="scrimm"></div><div class="adlg"><div class="dt">${title}</div>${body}<div class="dact">${actions}</div></div></div>`;

// ---------------------------------------------------------------------------
// W7 — Garden workspace Pool tab (uiux-spec §6.2)
// ---------------------------------------------------------------------------

const W7_STATES = [
  ["open", "Open"], ["not-ready", "Not ready — checklist"], ["ready", "Ready — open it"],
  ["paused", "Paused"], ["reconciled", "Reconciled"], ["claim-outcomes", "Claim outcomes"], ["expiry-queue", "Lapsed this cycle"],
] as const;
type W7State = (typeof W7_STATES)[number][0];

const w7PoolCard = (state: W7State) => {
  const chipFor: Record<string, string> = {
    open: chip("Open", "ok", { dot: true }), "not-ready": chip("Not ready", "plain", { dot: true }),
    ready: chip("Ready", "warn", { dot: true }), paused: chip("Paused", "warn", { dot: true }),
    reconciled: chip("Open", "ok", { dot: true }), "claim-outcomes": chip("Open", "ok", { dot: true }),
    "expiry-queue": chip("Open", "ok", { dot: true }),
  };
  const acts =
    state === "ready"
      ? `${hot("w7.open-pool", btn("Open pool", { kind: "pri" }))}${hot("w7.edit-charter", btn("Edit charter", { kind: "sec", sm: true }))}`
      : state === "paused"
        ? `${hot("w7.resume", btn("Resume pool", { kind: "pri" }))}${hot("w7.edit-charter", btn("Edit charter", { kind: "sec", sm: true }))}`
        : `${hot("w7.pause", btn("Pause…", { kind: "sec", sm: true }))}${hot("w7.edit-charter", btn("Edit charter", { kind: "sec", sm: true }))}${hot("w7.close-pool", btn("Close pool…", { kind: "ghost", sm: true }))}`;
  const meta =
    state === "not-ready"
      ? `${kv("Charter", "not set")}${kv("Provider exposure cap", "not set")}${kv("Qualifying baseline", "missing")}`
      : `${kv("Charter", "agreed ✓")}${kv("Baseline", "recorded ✓")}${kv("Provider exposure cap", "24 units")}`;
  const note =
    state === "not-ready"
      ? banner("Readiness needs all three: charter, exposure cap, and a qualifying baseline assessment.", "stone")
      : state === "ready"
        ? banner("Everything is in place. Opening the pool lets members see and make promises.", "stone")
        : state === "paused"
          ? banner("Paused with reason: “seasonal flooding, back after the rains”. Members keep evidence and recovery; create/claim/confirm wait.", "amber", "error-warning-line")
          : "";
  return acard("Pool", `${meta}${note}`, `${chipFor[state]}${acts}`);
};

const w7Cycles = (state: W7State) =>
  acard(
    "Cycles",
    `<div class="arow"><div class="grow"><b>Season of First Rains</b> <span class="ch">Season</span></div>${
      state === "reconciled" ? chip("Reconciled", "plain", { dot: true }) : chip("Open", "ok", { dot: true })
    }${state === "reconciled" ? hot("w7.report-row", btn("Scoped report", { kind: "sec", sm: true })) : `${hot("w7.close-season", btn("Close season…", { kind: "sec", sm: true }))}${hot("w7.cancel-cycle", btn("Cancel…", { kind: "ghost", sm: true }))}`}</div>
${stages(["Seeded", "Open", "In progress", "Reviewing", "Reconciled", "Composted"], state === "reconciled" ? 4 : 1)}
<div class="arow"><div class="grow">Market rides <span class="ch">Campaign</span> <span class="t-meta num">6/16</span></div>${chip("Open", "ok", { dot: true })}</div>
<div class="arow"><div class="grow">Tool library <span class="ch">Campaign</span> <span class="t-meta num">8/8</span></div>${chip("Reviewing", "warn", { dot: true })}</div>`,
    hot("w7.new-campaign", btn("New campaign", { kind: "sec", sm: true })),
  );

const w7Commitments = () =>
  acard(
    "Commitments",
    atable(
      ["Title", "Type", "State", "Units", "Member", ""],
      [
        [`${hot("w7.commitment-row", `<b>Prune the north beds</b>`)}`, chip("Offer", "offer"), chip("Accepted", "request", { dot: true }), `<span class="num">6 h</span>`, "Maria", icon("arrow-right-s-line", "s")],
        ["Market ride", chip("Request", "request"), chip("Ready", "warn", { dot: true }), `<span class="num">1</span>`, "João", icon("arrow-right-s-line", "s")],
      ],
    ),
    `${input("Search…", { placeholder: true, icon: "search-line" })}`,
  );

const w7Claims = (state: W7State) => {
  if (state === "claim-outcomes")
    return acard(
      "Claims — steward-reviewed",
      `<div class="arow"><div class="grow">Ana · individual · Jul 9</div>${chip("Declined — reason recorded", "plain", { dot: true })}</div>
<div class="arow"><div class="grow">João · individual · Jul 10</div>${chip("Accepted — terms stored", "ok", { dot: true })}</div>
<div class="arow"><div class="grow">Awka Hub · garden · Jul 10</div>${chip("Superseded", "plain", { dot: true })}</div>
${banner("Accepting one request supersedes the other pending rows — an indexer side-effect, never a member action.", "stone")}`,
    );
  if (state === "expiry-queue")
    return acard(
      "Lapsed this cycle",
      `<div class="arow"><div class="grow"><b>Field survey</b> ${chip("Request", "request")} ${chip("Expired", "plain", { dot: true })} <span class="t-meta num">due Jul 2 · 0 of 1 taken up</span></div>${hot("w7.reseed", btn("Re-seed…", { kind: "sec", sm: true }))}${btn("View history", { kind: "ghost", sm: true })}</div>
${banner("Expiry runs both paths: this queue for stewards, “offer again” for members (#34d).", "stone")}`,
    );
  return acard(
    "Claims waiting — steward-reviewed",
    `<div class="arow"><div class="grow"><b>Field survey</b> · Ana · individual · Jul 9</div>${hot("w7.accept-claim", btn("Accept", { kind: "pri", sm: true }))}${hot("w7.decline-claim", btn("Decline…", { kind: "sec", sm: true }))}</div>
<div class="arow"><div class="grow"><b>Field survey</b> · Awka Hub (garden) · asked by Leila · Jul 10</div>${btn("Accept", { kind: "pri", sm: true })}${btn("Decline…", { kind: "sec", sm: true })}</div>`,
  );
};

function w7(state: W7State): string {
  const body = `${adminBar("garden")}${vhead("Rocinha", "Garden workspace · overview · activity · pool · settings", chip("Pool", "ink"))}
<div class="canvasbody">${w7PoolCard(state)}${w7Cycles(state)}${state === "claim-outcomes" || state === "expiry-queue" ? w7Claims(state) : `${w7Commitments()}${w7Claims(state)}`}${hot("w7.seed-fab", `<button type="button" class="afab">${icon("add-line")}Seed</button>`)}</div>`;
  return deskWin("admin.greengoods.app/dashboard/garden", body);
}

const W7_HOTS: HifiDef["hots"] = {
  "w7.pause": { l: "Pause pool (reason)", info: "pausePool with mandatory reason CID; members keep evidence/linkage + recovery (UX:60)." },
  "w7.resume": { l: "Resume pool", info: "resumePool clears the indexed reason (CS:725)." },
  "w7.edit-charter": { l: "Edit charter", info: "setPoolCharter — one of the three readiness inputs (UX:269)." },
  "w7.open-pool": { l: "Open pool", info: "openPool → PoolOpened. Adopted onto the status card per #34a — closes the Ready→Open deadlock (CS:100, CS:727)." },
  "w7.close-pool": { l: "Close pool", info: "After the last cycle composts (CS:102); then compost/reopen per §4.1." },
  "w7.close-season": { l: "Close season", to: "screen:W26", info: "closeCycle — the reconcile act; commitments derive Reconciled (CS:118). Walked in SB-9." },
  "w7.cancel-cycle": { l: "Cancel a cycle (reason)", info: "cancelCycle → quiet member banner with reason (UX:77 · CS:104)." },
  "w7.new-campaign": { l: "New campaign", info: "seedCycle — any number of concurrent campaigns; a second Season is blocked (UX:66)." },
  "w7.accept-claim": { l: "Accept claim", to: "screen:W7@claim-outcomes", info: "Consumes the stored request terms; other pending rows become Superseded (CS:733)." },
  "w7.decline-claim": { l: "Decline claim (reason)", to: "screen:W7@claim-outcomes", info: "Clears exactly one request; the claimant may ask again (CS:734)." },
  "w7.reseed": { l: "Re-seed", to: "screen:W8", info: "Lapsed seeded promises re-enter the seeding console prefilled (UX:94). Adopted MF-4." },
  "w7.commitment-row": { l: "Commitment row", to: "screen:W10", info: "Opens the commitment dialog." },
  "w7.report-row": { l: "Cycle report", to: "screen:W26@review", info: "Reconciliation report (UX:75)." },
  "w7.seed-fab": { l: "Seed a commitment", to: "screen:W8", info: "Console seeding — SeasonCampaign and steward-captured kinds exist only here (UX:150)." },
};

// ---------------------------------------------------------------------------
// W8 — seeding console (uiux-spec §6.3)
// ---------------------------------------------------------------------------

const W8_STATES = [
  ["step1", "1 · Type & scope"], ["step2", "2 · Requirements"], ["step3", "3 · Rule & reward"],
  ["step4", "4 · Review"], ["captured-for", "Captured for a member"],
] as const;
type W8State = (typeof W8_STATES)[number][0];

function w8(state: W8State): string {
  const stepIx = state === "step1" ? 0 : state === "step2" ? 1 : state === "step3" ? 2 : 3;
  let inner: string;
  switch (state) {
    case "step2":
      inner = `${field("Unit", input("hours", { select: true }))}${field("Target", input("12"))}${field("Approved works required", input("2"))}${field("Assessment required", radio([{ label: "No", on: true }, { label: "Yes — attach before confirmation" }]))}${field("Due", input("cycle deadline", { select: true }))}`;
      break;
    case "step3":
      inner = `${field("Confirmers", `<div class="arow"><div class="grow">Maria</div>${icon("close-line", "s")}</div><div class="arow"><div class="grow">João</div>${icon("close-line", "s")}</div>${btn("Add address", { kind: "ghost", sm: true, icon: "add-line" })}`)}
${field("Threshold", input("2 of 2", { select: true }))}
${hot("w8.claim-mode", field("Claim mode", radio([{ label: "Open", meta: "anyone in the garden may take it up", on: true }, { label: "Steward-reviewed", meta: "requests wait for review" }])))}
${hot("w8.reward", field("Declared reward", `<div class="arow"><div class="grow">${input("Garden jar", { select: true })}</div><div class="grow">${input("20 DAI")}</div></div>`))}`;
      break;
    case "step4":
      inner = `${kv("Kind", "Season promise · the pool offers")}${kv("Title", "Market rides")}${kv("Unit · target", "rides · 16")}${kv("Confirmers", "named group · 2 of 2")}${kv("Claim mode", "open")}${kv("Reward", "20 DAI · garden jar · reference only")}
${hot("w8.seed", btn("Seed this commitment", { kind: "pri", full: true }))}`;
      break;
    case "captured-for":
      inner = `${banner("Recording for Kwame — recorded by the steward, the promise stays the member's.", "stone", "hand-heart-line")}${kv("Kind", "Member offer · captured")}${kv("Title", "Compost workshop")}${kv("Reason", "recorded at the field gathering")}
${hot("w8.seed", btn("Record it", { kind: "pri", full: true }))}`;
      break;
    default:
      inner = `${field("Type", radio([{ label: "Season / campaign promise", meta: "the pool offers or requests", on: true }, { label: "Support / service" }, { label: "Garden work (impact)" }, { label: "Capture for a member" }]))}
${field("Direction", radio([{ label: "The pool offers", on: true }, { label: "The pool requests" }]))}
${field("Cycle", input("Season: First Rains", { select: true }))}${field("Title", input("Market rides"))}`;
  }
  const body = `${adminBar("garden")}${vhead("Seed a commitment", "Rocinha · console seeding", stepDots(4, stepIx))}
<div class="canvasbody"><div class="acard" style="max-width:640px">${inner}</div></div>`;
  return deskWin("admin.greengoods.app/dashboard/garden/pool/seed", body);
}

const W8_HOTS: HifiDef["hots"] = {
  "w8.claim-mode": { l: "Claim mode", info: "Set at seeding; prefilled by context — protocol pool gated, garden campaigns open (decision #19)." },
  "w8.reward": { l: "Declared reward", info: "Reference only — the module never custodies funds (WF:339 · UX:280)." },
  "w8.seed": { l: "Seed this commitment", to: "screen:W7", info: "Console seeding — SeasonCampaign and steward-captured kinds exist only here (UX:150)." },
};

// ---------------------------------------------------------------------------
// W9 — analog capture (uiux-spec §6.5)
// ---------------------------------------------------------------------------

const W9_STATES = [["pick-member", "Who"], ["capture-kind", "What kind"]] as const;
type W9State = (typeof W9_STATES)[number][0];

function w9(state: W9State): string {
  const inner =
    state === "pick-member"
      ? `${hot("w9.member", field("Member", input("Search members…", { placeholder: true, icon: "search-line" })))}
<div class="arow"><div class="grow"><b>Kwame</b> <span class="t-meta">joined May · 4 promises kept</span></div>${btn("Choose", { kind: "sec", sm: true })}</div>`
      : `${hot("w9.kind", field("Capture", radio([{ label: "Their offer", on: true }, { label: "Their request" }, { label: "A confirmation", meta: "always carries a reason" }])))}
${btn("Continue", { kind: "pri" })}`;
  const body = `${adminBar("garden")}${vhead("Record on a member's behalf", "Rocinha")}
<div class="canvasbody">${banner("“Recorded by your steward on your behalf. The promise stays yours.” — the member sees exactly this.", "stone", "hand-heart-line")}<div class="acard" style="max-width:640px">${inner}</div></div>`;
  return deskWin("admin.greengoods.app/dashboard/garden/pool/capture", body);
}

const W9_HOTS: HifiDef["hots"] = {
  "w9.member": { l: "Pick the member", info: "The member is the social source; the steward is only the recorder (UX:437)." },
  "w9.kind": { l: "Capture kind", info: "Captured confirmations always carry a reason (UX:291)." },
};

// ---------------------------------------------------------------------------
// W10 — commitment dialog (uiux-spec §6.2/§6.7; MF13 dissolved)
// ---------------------------------------------------------------------------

const W10_STATES = [
  ["detail", "Detail"], ["record-payout", "Record payout"], ["fallback-confirm", "Fallback confirm"],
  ["raise-dispute", "Raise dispute"], ["resolve-dispute", "Resolve dispute"], ["attach-assessment", "Attach assessment"],
] as const;
type W10State = (typeof W10_STATES)[number][0];

const w10Behind = () => `${adminBar("garden")}${vhead("Rocinha", "Garden workspace · pool")}<div class="canvasbody">${acard("Commitments", "")}</div>`;

function w10(state: W10State): string {
  const head = `Prune the north beds <span class="ax">${chip("Offer", "offer")}${chip("Ready", "warn", { dot: true })}</span>`;
  let body: string;
  let actions: string;
  switch (state) {
    case "record-payout":
      body = `${kv("Declared reward", "20 DAI · garden jar")}${field("Rail reference", input("cookie-jar withdrawal #128"))}${banner("Records that the reward moved outside the app — no value moves here (UX:302). August G$ rewards relabel this Queue disbursement (SS:535).", "stone")}`;
      actions = `${btn("Cancel", { kind: "ghost" })}${hot("w10.payout-confirm", btn("Record payout", { kind: "pri" }))}`;
      break;
    case "fallback-confirm":
      body = `${field("Reason (required)", input("confirmed on site visit"))}${banner("Steward fallback confirmation — the provider's own address is blocked on-chain, always (CS:744). The member timeline shows this as a steward record.", "stone", "shield-check-line")}`;
      actions = `${btn("Cancel", { kind: "ghost" })}${hot("w10.fallback-confirm", btn("Confirm as fallback", { kind: "pri" }))}`;
      break;
    case "raise-dispute":
      body = `${field("Reason (required)", input("delivery contested at the gathering"))}${banner("Freezes the promise for review. Members see “under review by stewards” — never dispute language.", "stone")}`;
      actions = `${btn("Cancel", { kind: "ghost" })}${hot("w10.dispute-confirm", btn("Raise dispute", { kind: "pri" }))}`;
      break;
    case "resolve-dispute":
      body = `${hot("w10.resolve-options", radio([{ label: "Restore previous state", meta: "returns the exact stored state — no unit movement", on: true }, { label: "Fulfilled" }, { label: "Cancelled" }, { label: "Expired" }]))}${field("Reason (required)", input("resolved at the weekly gathering"))}${banner("An Expired prior state can never resolve to Fulfilled (CS:144). Every outcome renders its reason in the member timeline.", "stone")}`;
      actions = `${btn("Cancel", { kind: "ghost" })}${hot("w10.resolve", btn("Resolve", { kind: "pri" }))}`;
      break;
    case "attach-assessment":
      body = `${hot("w10.assessment-pick", radio([{ label: "Baseline — AGRO — Jul 2", meta: "v3 · provider garden", on: true }, { label: "Delta — AGRO+EDU — Jul 9", meta: "v3" }]))}${banner("Only non-revoked v2/v3 assessments with recipient = provider garden appear (UX:287).", "stone")}`;
      actions = `${btn("Cancel", { kind: "ghost" })}${hot("w10.attach", btn("Attach", { kind: "pri" }))}`;
      break;
    default:
      body = `${kv("Maria → João", "6 hours · due Aug 12 · open claim")}
${stages(["Offered", "Accepted", "Work linked", "Ready", "Fulfilled"], 3)}
${kv("Evidence", "2 items · photo, note")}${kv("Linked work", "Pruning session (approved)")}${kv("Provider", "Maria — cannot confirm")}${kv("Eligible", "João ✓ · Ana ○ · you ○ (1 of 2 required)")}
<div class="arow"><div class="grow">${kv("Reward", "20 DAI · garden jar · unpaid")}</div>${hot("w10.record-payout", btn("Record payout", { kind: "sec", sm: true }))}</div>`;
      actions = `${hot("w10.fallback", btn("Confirm as fallback…", { kind: "sec" }))}${hot("w10.raise", btn("Raise dispute…", { kind: "sec" }))}`;
  }
  const dlgTitle = state === "record-payout" ? "Record payout" : state === "fallback-confirm" ? "Confirm as fallback" : state === "raise-dispute" ? "Raise dispute" : state === "resolve-dispute" ? "Resolve dispute" : state === "attach-assessment" ? "Attach assessment" : head;
  return deskWin("admin.greengoods.app/dashboard/garden/pool", adminDialog(w10Behind(), dlgTitle, body, actions));
}

const W10_HOTS: HifiDef["hots"] = {
  "w10.record-payout": { l: "Record payout", to: "screen:W10@record-payout", info: "AdminConfirmDialog captures the executed rail reference → RewardPaid; no value moves here (UX:302)." },
  "w10.payout-confirm": { l: "Record payout (confirm)", info: "recordRewardPaid → RewardPaid; the dry run rehearses this with a real minimal Cookie Jar withdrawal (#34h)." },
  "w10.fallback": { l: "Confirm as fallback", to: "screen:W10@fallback-confirm", info: "Steward fallback with mandatory reason — provider-steward blocked on-chain (CS:744)." },
  "w10.fallback-confirm": { l: "Fallback (confirm)", info: "Overrides render visible markers in the member timeline (UX:287,301)." },
  "w10.raise": { l: "Raise dispute", to: "screen:W10@raise-dispute", info: "Steward dispute entry, Accepted through Expired (UX:300)." },
  "w10.dispute-confirm": { l: "Raise dispute (confirm)", info: "raiseDispute stores preDisputeState; member copy stays “under review by stewards” (CS:143)." },
  "w10.resolve-options": { l: "Resolution outcomes", info: "RestorePrevious / Fulfilled / Cancelled / Expired, each with a required reason (CS:144)." },
  "w10.resolve": { l: "Resolve", to: "screen:W2@accepted", info: "RestorePrevious returns the exact stored state — no unit movement (LAP:186)." },
  "w10.assessment-pick": { l: "Assessment picker", info: "Attach re-runs the auto-Ready check → CommitmentReadyForConfirmation (CS:740)." },
  "w10.attach": { l: "Attach assessment", to: "screen:W2@ready-confirmer", info: "attachAssessment → auto-Ready re-run (UX:287). Adopted MF-13 placement." },
};

// ---------------------------------------------------------------------------
// W11 — open-cycle allocation policy (uiux-spec §6.10)
// ---------------------------------------------------------------------------

const W11_STATES = [["presets", "Presets"], ["invalid-sum", "Invalid sum"]] as const;
type W11State = (typeof W11_STATES)[number][0];

function w11(state: W11State): string {
  const bad = state === "invalid-sum";
  const rows = [
    ["Gardeners", bad ? "6400" : "6000"], ["Treasury", "1500"], ["Steward", "1000"],
    ["Evaluator", "500"], ["Community", "500"], ["Funder", "500"],
  ]
    .map(([l, v]) => `<div class="arow"><div class="grow">${l}</div>${input(v)}<span class="t-meta">bps</span></div>`)
    .join("");
  const sum = bad
    ? banner("Shares must sum to exactly 10000 bps — currently 10400.", "error", "error-warning-line")
    : `<div class="quietok">${icon("check-line")}sum: 10000 · valid</div>`;
  const body = `${adminBar("garden")}${vhead("Open cycle — allocation policy", "Season of First Rains")}
<div class="canvasbody"><div class="acard" style="max-width:560px">
${hot("w11.presets", field("Preset", radio([{ label: "Garden-led (default)", on: true }, { label: "Balanced" }, { label: "Custom" }])))}
${rows}${sum}
${banner("A soft warning shows under 1500 treasury bps (guidance floor). The snapshot locks at open; W26's close wizard reads it back.", "stone")}
${hot("w11.open-cycle", btn("Open cycle", { kind: "pri", disabled: bad }))}
</div></div>`;
  return deskWin("admin.greengoods.app/dashboard/garden/pool/open-cycle", body);
}

const W11_HOTS: HifiDef["hots"] = {
  "w11.presets": { l: "Allocation presets", info: "Presets prefill an editable bps editor; the on-chain `operator` class renders as “steward” (#28c)." },
  "w11.open-cycle": { l: "Open cycle", to: "screen:W7", info: "Emits the six-class bps snapshot; sum must equal 10000 (UX:322-330)." },
};

// ---------------------------------------------------------------------------
// W13 — Hub Confirm stage (+ W13b context chip) (uiux-spec §6.9)
// ---------------------------------------------------------------------------

const W13_STATES = [["queue", "Confirm queue"], ["context-chip", "Work card chip (W13b)"]] as const;
type W13State = (typeof W13_STATES)[number][0];

function w13(state: W13State): string {
  const railTabs = `<span class="wstabs">${["Work (3)", "Assess (1)", "Certify (2)", "Confirm (2)", "History"]
    .map((l, i) => `<button type="button" class="wstab${(state === "context-chip" ? 0 : 3) === i ? " on" : ""}">${l}</button>`)
    .join("")}</span>`;
  const inner =
    state === "context-chip"
      ? acard(
          "Pruning session",
          `<div class="arow"><div class="grow">2 photos · submitted by João</div>${hot("w13.chip", chip("Fulfills: Prune the north beds", "offer"))}</div>
<div class="arow">${btn("Approve", { kind: "pri", sm: true })}${btn("Reject", { kind: "sec", sm: true })}</div>
${banner("The commitment-context chip is the only Hub work-card delta (W13b).", "stone")}`,
        )
      : acard(
          "Ready for confirmation — where you are named or fallback-eligible",
          `<div class="arow"><div class="grow">${hot("w13.row", `<b>Maria — Prune the north beds</b>`)} <span class="t-meta">Rocinha</span></div>${meter(66, { right: "2 of 3" })}</div>
<div class="arow"><div class="grow"><b>TAS — Field survey ride</b> <span class="t-meta">Awka</span></div>${meter(0, { right: "0 of 1" })}</div>`,
        );
  const body = `${adminBar("hub")}${vhead("Hub", "", railTabs)}<div class="canvasbody">${inner}</div>`;
  return deskWin("admin.greengoods.app/dashboard/hub", body);
}

const W13_HOTS: HifiDef["hots"] = {
  "w13.row": { l: "Confirm queue row", to: "screen:W10", info: "Queue of promises where you are named or fallback-eligible (UX:318)." },
  "w13.chip": { l: "Commitment-context chip (W13b)", info: "Work cards show which promise they fulfill; approval rails untouched (UX:285)." },
};

// ---------------------------------------------------------------------------
// W14 — assessment v3 additions (uiux-spec §6.6)
// ---------------------------------------------------------------------------

const W14_STATES = [["baseline", "Baseline"], ["delta", "Re-assessment (delta)"]] as const;
type W14State = (typeof W14_STATES)[number][0];

function w14(state: W14State): string {
  const kindRadio = hot(
    "w14.kind",
    radio([
      { label: "Baseline", meta: "evaluator or steward may record", on: state === "baseline" },
      { label: "Re-assessment (delta)", meta: "Evaluator Hat only", on: state === "delta" },
    ]),
  );
  const extra =
    state === "delta"
      ? field("Baseline to compare", input("Baseline — AGRO — Jul 2", { select: true }))
      : banner("One baseline per garden/cycle/domain — a duplicate attempt points at the existing record.", "stone");
  const body = `${adminBar("hub")}${vhead("Create assessment", "step 1 — cycle + kind (v3 additions)")}
<div class="canvasbody"><div class="acard" style="max-width:640px">
${field("Cycle", input("Season of First Rains", { select: true }))}${kindRadio}${extra}${btn("Continue", { kind: "pri" })}
</div></div>`;
  return deskWin("admin.greengoods.app/dashboard/hub/assess", body);
}

const W14_HOTS: HifiDef["hots"] = {
  "w14.kind": { l: "Assessment kind", info: "Baseline: evaluator or steward. Delta: Evaluator Hat only (CS:760-761)." },
};

// ---------------------------------------------------------------------------
// HUBWORK — existing Work stage (approval rails untouched)
// ---------------------------------------------------------------------------

function hubwork(): string {
  const body = `${adminBar("hub")}${vhead("Hub", "", `<span class="wstabs"><button type="button" class="wstab on">Work (3)</button><button type="button" class="wstab">Assess</button><button type="button" class="wstab">Certify</button><button type="button" class="wstab">Confirm</button><button type="button" class="wstab">History</button></span>`)}
<div class="canvasbody">${acard(
    "Pruning session — Prune the north beds",
    `<div class="arow"><div class="grow">2 photos · submitted by João · Jul 8</div></div>
<div class="arow">${hot("hub.approve", btn("Approve", { kind: "pri", sm: true }))}${btn("Reject", { kind: "sec", sm: true })}</div>
${banner("Existing Work stage — approval rails untouched (UX:285).", "stone")}`,
  )}</div>`;
  return deskWin("admin.greengoods.app/dashboard/hub", body);
}

const HUBWORK_HOTS: HifiDef["hots"] = {
  "hub.approve": { l: "Approve", info: "Existing WorkApproval rails → onWorkApproved → ApprovedWorkCounted (CS:737)." },
};

// ---------------------------------------------------------------------------

export const ADMIN_DEFS: HifiDef[] = [
  { screen: { id: "W7", title: "W7 · Garden Pool tab (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: W7_STATES.map(([id, label]) => ({ id, label, proposed: id === "ready" || id === "expiry-queue", html: w7(id) })) }, hots: W7_HOTS },
  { screen: { id: "W8", title: "W8 · Seeding console", surface: "admin", frame: "desktop", group: "Admin console",
    states: W8_STATES.map(([id, label]) => ({ id, label, html: w8(id) })) }, hots: W8_HOTS },
  { screen: { id: "W9", title: "W9 · Analog capture", surface: "admin", frame: "desktop", group: "Admin console",
    states: W9_STATES.map(([id, label]) => ({ id, label, html: w9(id) })) }, hots: W9_HOTS },
  { screen: { id: "W10", title: "W10 · Commitment dialog (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: W10_STATES.map(([id, label]) => ({ id, label, proposed: id === "attach-assessment", html: w10(id) })) }, hots: W10_HOTS },
  { screen: { id: "W11", title: "W11 · Open-cycle allocation", surface: "admin", frame: "desktop", group: "Admin console",
    states: W11_STATES.map(([id, label]) => ({ id, label, html: w11(id) })) }, hots: W11_HOTS },
  { screen: { id: "W13", title: "W13 · Hub Confirm stage", surface: "admin", frame: "desktop", group: "Admin console",
    states: W13_STATES.map(([id, label]) => ({ id, label, html: w13(id) })) }, hots: W13_HOTS },
  { screen: { id: "W14", title: "W14 · Assessment v3 additions", surface: "admin", frame: "desktop", group: "Admin console",
    states: W14_STATES.map(([id, label]) => ({ id, label, html: w14(id) })) }, hots: W14_HOTS },
  { screen: { id: "HUBWORK", title: "Existing Hub Work stage", surface: "admin", frame: "desktop", group: "Admin console",
    states: [{ id: "approve", label: "Approve", html: hubwork() }] }, hots: HUBWORK_HOTS },
];
