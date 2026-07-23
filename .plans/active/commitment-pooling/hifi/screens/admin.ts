// Admin hi-fi screens — W7 garden pool tab, W8 seeding console, W9 analog
// capture, W10 commitment dialog, W11 allocation, W13 hub confirm, W14
// assessment additions, HUBWORK. Restrained M3 operator cockpit (.s-admin):
// solid dense surfaces, Plus Jakarta Sans stack, quiet checkmarks, no hero
// language. Copy: "steward" everywhere (Decision Log #28c); on-chain `operator` allocation
// class RENDERS as "steward" (W11 rule). Dissolved lo-fi variants: MF1 →
// W7@ready, MF4 → W7@expiry-queue, W7X → W7@claim-outcomes, MF13 →
// W10@attach-assessment.

import { esc, hot } from "../html";
import { icon } from "../icons";
import { banner, btn, chip, emptyState, field, input, kv, meter, radio, skeleton, stepDots } from "../kit";
import type { HifiDef } from "./index";

// ---- admin chrome helpers ---------------------------------------------------

// The browser window is the outer viewer frame (S1 scales it); its body hosts
// the full canvas (adminCanvas). deskWin stays; the invented top tab-bar does not.
export function deskWin(url: string, body: string): string {
  return `<div class="deskwin"><div class="winbar"><span class="dots"><i></i><i></i><i></i></span><span class="url">${url}</span></div>${body}</div>`;
}

// AdminCard — M3 elevated solid surface (head + optional trailing + body).
export const acard = (head: string, body: string, trailing = "") =>
  `<div class="acard"><div class="ahead"><span class="at">${head}</span>${trailing ? `<span class="ax">${trailing}</span>` : ""}</div>${body}</div>`;

// Cycle/settlement stage stepper.
export const stages = (list: string[], activeIx: number) =>
  `<div class="stages">${list
    .map((s, i) => `<span class="st1${i < activeIx ? " done" : i === activeIx ? " on" : ""}"><i></i>${s}</span>`)
    .join(`<span class="sep"></span>`)}</div>`;

// ---- real Canvas cockpit chrome (CanvasLayout.tsx) --------------------------
// The invented top tab-bar (adminBar) is replaced by the app's actual model:
// a 2-row canvas grid — transparent AppBar (GardenChip + icon buttons) over a
// scrolling gradient canvas that floats an opaque route card, with a floating
// glass workspace dock at the window's foot.

export type Tone = "garden" | "hub" | "community" | "actions";
export type NavId = "hub" | "garden" | "community" | "actions" | "operations";

// GardenChip — the AppBar's left pill (garden selector), never a brand logo.
export const gardenChip = (name: string, hotId?: string) =>
  `<button type="button" class="gchip" data-component="GardenChip"${hotId ? ` data-hot="${hotId}"` : " disabled"} aria-label="Select garden"><span class="leaf">${icon("seedling-line", "s")}<span class="dot"></span></span><span class="nm">${esc(name)}</span><span class="caret"></span></button>`;

const iconBtn = (name: string, label: string) =>
  `<button type="button" class="iconbtn" aria-label="${esc(label)} — preview only" disabled>${icon(name)}</button>`;

// Transparent AppBar (h-14) — GardenChip left, search/bell/settings/profile right.
const appBar = (garden: string, hotPrefix: string, interactive: boolean) =>
  `<header class="appbar" data-component="AppBar">${gardenChip(garden, interactive ? `${hotPrefix}.garden-selector` : undefined)}<div class="appbar-actions">${iconBtn("search-line", "Search")}${iconBtn("notification-line", "Notifications")}${iconBtn("settings-line", "Settings")}${iconBtn("user-line", "Profile")}</div></header>`;

// Floating glass workspace dock (NavigationBar) — the app's only backdrop-blur.
// Visual chrome: the active workspace is highlighted in its tone; available
// destinations open a representative workspace screen while current/preview-only
// items open the inspector. Operations is appended only inside its deployer-
// gated workspace; it is not a global fifth destination for ordinary stewards.
const CORE_NAV_ITEMS: [NavId, string, string][] = [
  ["hub", "Hub", "home-line"], ["garden", "Garden", "seedling-line"],
  ["community", "Community", "group-line"], ["actions", "Actions", "leaf-line"],
];
const OPERATIONS_NAV_ITEM: [NavId, string, string] = ["operations", "Operations", "send-plane-line"];
const navItems = (active: NavId) => active === "operations" ? [...CORE_NAV_ITEMS, OPERATIONS_NAV_ITEM] : CORE_NAV_ITEMS;
const navDock = (active: NavId, hotPrefix: string, interactive: boolean) =>
  `<nav class="navdock" aria-label="Workspaces" data-component="NavigationBar">${navItems(active).map(
    ([id, l, ic]) => `<button type="button" class="nditem${id === active ? " on" : ""}"${interactive ? ` data-hot="${hotPrefix}.nav-${id}"` : " disabled"} aria-label="${l} workspace"${id === active ? ' aria-current="page"' : ""}><span class="ndic">${icon(ic)}</span><span>${l}</span></button>`,
  ).join("")}</nav>`;

const NAV_TARGETS: Partial<Record<NavId, string>> = {
  hub: "screen:W13",
  garden: "screen:W7",
  community: "screen:W12",
  operations: "screen:W24",
};

export function adminChromeHots(hotPrefix: string, active: NavId): HifiDef["hots"] {
  const hots: HifiDef["hots"] = {
    [`${hotPrefix}.garden-selector`]: {
      l: "Select garden",
      info: "Garden selection remains in the shipping AppBar; this prototype keeps Rocinha fixed while exposing the control contract.",
    },
  };
  for (const [id, label] of navItems(active)) {
    const target = NAV_TARGETS[id];
    hots[`${hotPrefix}.nav-${id}`] = id === active || !target
      ? { l: `${label} workspace`, info: `${label} is ${id === active ? "the current" : "a preview-only"} workspace in this storyboard.` }
      : { l: `${label} workspace`, to: target, info: `Opens the representative ${label} workspace screen.` };
  }
  return hots;
}

// PageHeader — big bold h1 (sticky under the AppBar) with slots. text/eyebrow/
// description are plain copy (escaped); meta/actions/toolbar carry markup.
export function pageHeader(opts: {
  title: string; eyebrow?: string; description?: string; meta?: string; actions?: string; toolbar?: string;
}): string {
  const main = `<div class="ph-main">${opts.eyebrow ? `<div class="eyebrow">${esc(opts.eyebrow)}</div>` : ""}<h1>${esc(opts.title)}</h1>${
    opts.description ? `<div class="ph-desc">${esc(opts.description)}</div>` : ""
  }${opts.meta ? `<div class="ph-meta">${opts.meta}</div>` : ""}</div>`;
  return `<div class="pghead" data-component="PageHeader"><div class="ph-row">${main}${
    opts.actions ? `<div class="ph-actions">${opts.actions}</div>` : ""
  }</div>${opts.toolbar ? `<div class="ph-toolbar">${opts.toolbar}</div>` : ""}</div>`;
}

// AdminTabRail — segmented-card sub-tabs (NOT underline). Each tab may carry a
// count and an optional hotspot id (wired only where it maps to a real screen).
export type RailTab = { label: string; count?: number; hot?: string };
export function tabRail(items: RailTab[], activeIx: number): string {
  const interactive = items.some((it) => it.hot);
  return `<div class="tabrail" role="${interactive ? "tablist" : "group"}" aria-label="${interactive ? "View" : "Current section"}" data-component="AdminTabRail" style="grid-template-columns:repeat(${items.length},minmax(0,1fr))">${items
    .map((it, i) => {
      const cnt = it.count != null ? `<span class="cnt">${it.count}</span>` : "";
      const content = `<span class="lbl">${esc(it.label)}</span>${cnt}`;
      return it.hot
        ? hot(it.hot, `<span class="trhit"><button type="button" role="tab" aria-selected="${i === activeIx}" class="trtab${i === activeIx ? " on" : ""}">${content}</button></span>`)
        : `<span class="trtab${i === activeIx ? " on" : ""}"${interactive ? ` role="tab" aria-selected="${i === activeIx}" aria-disabled="true"` : ""}>${content}</span>`;
    })
    .join("")}</div>`;
}

// Assemble the canvas body (AppBar + route card + dock). Screen fns wrap this in
// deskWin(url, …). tone drives the gradient + accents; nav highlights the dock.
export function adminCanvas(
  tone: Tone, nav: NavId,
  parts: { screenId: string; garden: string; header: string; tabRail?: string; body: string; interactiveChrome?: boolean },
): string {
  const hotPrefix = parts.screenId.toLowerCase();
  const interactiveChrome = parts.interactiveChrome !== false;
  return `<div class="wsgrid" data-tone="${tone}" data-component="CanvasLayout">${appBar(parts.garden, hotPrefix, interactiveChrome)}<div class="mainscroll"><section class="routecard">${parts.header}${
    parts.tabRail ?? ""
  }${parts.body}</section></div>${navDock(nav, hotPrefix, interactiveChrome)}</div>`;
}

// AdminDialog — own scrim + 28dp solid surface over the dimmed canvas. `behind`
// is the full adminCanvas(...) so the dialog reads as floating over the route.
export function adminDialogM3(
  behind: string, tone: Tone, opts: { title: string; body: string; actions: string; closeHot?: string },
): string {
  const close = `<button type="button" class="dclose" aria-label="Close">${icon("close-line", "s")}</button>`;
  return `<div class="dlgstage"><div class="dlg-behind" inert aria-hidden="true">${behind}</div><div class="scrimm"></div><div class="adlg" data-tone="${tone}" data-component="AdminDialog" role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title"><div class="dlg-head"><span class="dt" id="admin-dialog-title">${esc(
    opts.title,
  )}</span>${opts.closeHot ? hot(opts.closeHot, close) : close}</div><div class="dlg-body">${opts.body}</div><div class="dlg-foot">${opts.actions}</div></div></div>`;
}

// Dense data table — hairline row dividers, no cell borders, no zebra
// (uiux-spec §12: tabular data stays a table; queues render as list-rows).
export const dtable = (heads: string[], rows: string[][], caption: string) =>
  `<table class="dtab"><caption class="visually-hidden">${esc(caption)}</caption><thead><tr>${heads.map((h) => `<th scope="col">${h ? esc(h) : '<span class="visually-hidden">Actions</span>'}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;

// ---------------------------------------------------------------------------
// W7 — Garden workspace Pool tab (uiux-spec §6.2)
// ---------------------------------------------------------------------------

const W7_STATES = [
  ["open", "Open"], ["not-ready", "Not ready — checklist"], ["ready", "Ready — open it"],
  ["paused", "Paused"], ["reconciled", "Reconciled"], ["claim-outcomes", "Claim outcomes"], ["expiry-queue", "Lapsed this cycle"],
  ["loading", "Loading"], ["empty", "No commitments yet"],
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
      ? `${kv("Charter", "not set")}${kv("Provider open-commitment cap", "not set")}${kv("Qualifying baseline", "missing")}`
      : `${kv("Charter", "agreed ✓")}${kv("Baseline", "recorded ✓")}${kv("Provider open-commitment cap", "24 commitments")}`;
  const note =
    state === "not-ready"
      ? banner("Readiness needs all three: charter, provider open-commitment cap, and a qualifying baseline assessment.", "stone")
      : state === "ready"
        ? banner("Everything is in place. Opening the pool lets members see and make promises.", "stone")
        : state === "paused"
          ? banner("Paused with reason: “seasonal flooding, back after the rains”. Members keep evidence and recovery; create/claim/confirm wait.", "amber", "error-warning-line")
          : "";
  // Status chip stays in the card header; lifecycle actions get their own row
  // beneath the meta so a busy state (Pause · Edit · Close) never crowds the head.
  return acard("Pool", `${meta}${note}<div class="actrow">${acts}</div>`, chipFor[state]);
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

// Workspace queue → hairline list-rows inside the route card (not a bordered grid).
const w7Commitments = () =>
  acard(
    "Commitments",
    `<div class="arow">${hot("w7.commitment-row", `<div class="grow"><b>Prune the north beds</b> ${chip("Offer", "offer")} <span class="t-meta num">Maria · 6 h</span></div>`)}${chip("Accepted", "request", { dot: true })}${icon("arrow-right-s-line", "s")}</div>
<div class="arow"><div class="grow"><b>Market ride</b> ${chip("Request", "request")} <span class="t-meta num">João · 1</span></div>${chip("Ready", "warn", { dot: true })}${icon("arrow-right-s-line", "s")}</div>`,
    input("Search…", { placeholder: true, icon: "search-line", ariaLabel: "Search commitments" }),
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
      `<div class="arow"><div class="grow"><b>Field survey</b> ${chip("Request", "request")} ${chip("Expired", "plain", { dot: true })} <span class="t-meta num">due Jul 2 · 0 of 1 taken up</span></div>${hot("w7.reseed", btn("Re-seed…", { kind: "sec", sm: true }))}${hot("w7.history", btn("View history", { kind: "ghost", sm: true }))}</div>
${banner("Expiry runs both paths: this queue for stewards, “offer again” for members (register #34d).", "stone")}`,
    );
  return acard(
    "Claims waiting — steward-reviewed",
    `<div class="arow"><div class="grow"><b>Field survey</b> · Ana · individual · Jul 9</div>${hot("w7.accept-claim", btn("Accept", { kind: "pri", sm: true }))}${hot("w7.decline-claim", btn("Decline…", { kind: "sec", sm: true }))}</div>
<div class="arow"><div class="grow"><b>Field survey</b> · Awka Hub (garden) · asked by Leila · Jul 10</div>${hot("w7.accept-garden", btn("Accept", { kind: "pri", sm: true }))}${hot("w7.decline-garden", btn("Decline…", { kind: "sec", sm: true }))}</div>`,
  );
};

const W7_DESC: Record<W7State, string> = {
  open: "Season of First Rains is live — offers and requests between neighbors.",
  "not-ready": "Finish the readiness checklist before members can promise.",
  ready: "Everything is in place — open the pool when you're ready.",
  paused: "Paused for the season — evidence and recovery stay open.",
  reconciled: "The season is reconciled — its promises settled and composted.",
  "claim-outcomes": "How this cycle's steward-reviewed claims resolved.",
  "expiry-queue": "Promises that lapsed this cycle — offer them again.",
  loading: "Loading the pool…",
  empty: "The pool is open and waiting for its first promise.",
};

function w7(state: W7State): string {
  // Garden workspace, net-new Pool tab (real rail: Health · Impact · Activity).
  const rail = tabRail([{ label: "Health" }, { label: "Impact" }, { label: "Activity" }, { label: "Pool" }], 3);
  // Seed lives in the header (desktop puts creation in header actions, not a FAB).
  const seed = hot("w7.seed-fab", btn("Seed", { kind: "pri", sm: true, icon: "add-line" }));
  let body: string;
  if (state === "loading") {
    body = `${skeleton({ title: true, lines: 2 })}${skeleton({ lines: 3 })}${skeleton({ lines: 2 })}`;
  } else if (state === "empty") {
    body = emptyState(
      "seedling-line",
      "No commitments yet",
      "When the pool is open, offers and requests between neighbors show up here. Seed the first promise to begin.",
      seed,
    );
  } else {
    const queues =
      state === "claim-outcomes" || state === "expiry-queue" ? w7Claims(state) : `${w7Commitments()}${w7Claims(state)}`;
    body = `${w7PoolCard(state)}${w7Cycles(state)}${queues}`;
  }
  const header = pageHeader({ title: "Garden", description: W7_DESC[state], actions: seed });
  return deskWin(
    "admin.greengoods.app/dashboard/garden/pool",
    adminCanvas("garden", "garden", { screenId: "W7", garden: "Rocinha", header, tabRail: rail, body }),
  );
}

const W7_HOTS: HifiDef["hots"] = {
  "w7.pause": { l: "Pause pool (reason)", to: "screen:W7@paused", info: "pausePool with mandatory reason CID; members keep evidence/linkage + recovery (UX:60)." },
  "w7.resume": { l: "Resume pool", to: "screen:W7", info: "resumePool clears the indexed reason (CS:725)." },
  "w7.edit-charter": { l: "Edit charter", to: "screen:W7@ready", info: "setPoolCharter — one of the three readiness inputs; the prototype returns to the resulting Ready card (UX:269)." },
  "w7.open-pool": { l: "Open pool", to: "screen:W7", info: "openPool → PoolOpened. Adopted onto the status card per register #34a — closes the Ready→Open deadlock (CS:100, CS:727)." },
  "w7.close-pool": { l: "Close pool", to: "screen:W1@closed", info: "After the last cycle composts (CS:102); then compost/reopen per §4.1." },
  "w7.close-season": { l: "Close season", to: "screen:W26", info: "closeCycle — the reconcile act; commitments derive Reconciled (CS:118)." },
  "w7.cancel-cycle": { l: "Cancel a cycle (reason)", to: "screen:W1@cancelled-cycle", info: "cancelCycle → quiet member banner with reason (UX:77 · CS:104)." },
  "w7.new-campaign": { l: "New campaign", to: "screen:W8", info: "seedCycle — any number of concurrent campaigns; a second Season is blocked (UX:66)." },
  "w7.accept-claim": { l: "Accept claim", to: "screen:W7@claim-outcomes", info: "Consumes the stored request terms; other pending rows become Superseded (CS:733)." },
  "w7.decline-claim": { l: "Decline claim (reason)", to: "screen:W7@claim-outcomes", info: "Clears exactly one request; the claimant may ask again (CS:734)." },
  "w7.reseed": { l: "Re-seed", to: "screen:W8", info: "Lapsed seeded promises re-enter the seeding console prefilled (UX:94). Adopted MF-4." },
  "w7.history": { l: "View history", info: "Opens this expired promise's state history and recorded reason." },
  "w7.accept-garden": { l: "Accept garden claim", info: "Consumes Awka Hub's stored garden-claim terms; other pending rows become Superseded (CS:733)." },
  "w7.decline-garden": { l: "Decline garden claim", info: "Declines only Awka Hub's request with a required reason (CS:734)." },
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
      inner = `${field("Unit", input("hours", { select: true }))}${field("Target", input("12"))}${field("Action requirements", `<div class="arow"><div class="grow"><b>Prune</b> <span class="t-meta">Land stewardship</span></div>${input("2")}<span class="t-meta">approved works</span></div><div class="arow"><div class="grow"><b>Plant</b> <span class="t-meta">Land stewardship</span></div>${input("1")}<span class="t-meta">approved work</span></div>${hot("w8.add-action", btn("Add action", { kind: "ghost", sm: true, icon: "add-line" }))}`)}${field("Assessment required", radio([{ label: "No", on: true }, { label: "Yes — attach before confirmation" }]))}${field("Due", input("cycle deadline", { select: true }))}${hot("w8.continue-requirements", btn("Continue", { kind: "pri", full: true }))}`;
      break;
    case "step3":
      inner = `${field("Confirmers", `<div class="arow"><div class="grow">Maria</div>${icon("close-line", "s")}</div><div class="arow"><div class="grow">João</div>${icon("close-line", "s")}</div>${hot("w8.add-address", btn("Add address", { kind: "ghost", sm: true, icon: "add-line" }))}`)}
${field("Threshold", input("2 of 2", { select: true }))}
${hot("w8.claim-mode", field("Claim mode", radio([{ label: "Open", meta: "anyone in the garden may take it up", on: true }, { label: "Steward-reviewed", meta: "requests wait for review" }], { interactive: true, name: "claim-mode" })))}
${hot("w8.reward", field("Declared reward", `<div class="arow"><div class="grow">${input("Garden jar", { select: true })}</div><div class="grow">${input("20 DAI")}</div></div>`))}${hot("w8.continue-rule", btn("Continue", { kind: "pri", full: true }))}`;
      break;
    case "step4":
      inner = `${kv("Kind", "Garden work · the pool requests")}${kv("Title", "Restore the north beds")}${kv("Unit · target", "hours · 12")}${kv("Action requirements", "Prune × 2 · Plant × 1")}${kv("Confirmers", "named group · 2 of 2")}${kv("Claim mode", "steward-reviewed")}${kv("Reward", "20 DAI · garden jar · reference only")}
${hot("w8.seed", btn("Seed this commitment", { kind: "pri", full: true }))}`;
      break;
    case "captured-for":
      inner = `${banner("Recording for Kwame — recorded by the steward, the promise stays the member's.", "stone", "hand-heart-line")}${kv("Kind", "Member offer · captured")}${kv("Title", "Compost workshop")}${kv("Reason", "recorded at the field gathering")}
${hot("w8.seed", btn("Record it", { kind: "pri", full: true }))}`;
      break;
    default:
      inner = `${field("Type", radio([{ label: "Season / campaign promise", meta: "the pool offers or requests", on: true }, { label: "Support / service" }, { label: "Garden work (impact)" }, { label: "Capture for a member" }]))}
${field("Direction", radio([{ label: "The pool offers", on: true }, { label: "The pool requests" }]))}
${field("Cycle", input("Season: First Rains", { select: true }))}${field("Title", input("Market rides"))}${hot("w8.continue-scope", btn("Continue", { kind: "pri", full: true }))}`;
  }
  const header = pageHeader({
    title: "Seed a commitment",
    eyebrow: `Step ${stepIx + 1} of 4`,
    description:
      state === "captured-for"
        ? "Record a neighbor's promise on their behalf."
        : "The only place SeasonCampaign and captured kinds are created.",
    actions: stepDots(4, stepIx),
  });
  return deskWin(
    "admin.greengoods.app/dashboard/garden/pool/seed",
    adminCanvas("garden", "garden", { screenId: "W8", garden: "Rocinha", header, body: `<div class="flowform">${inner}</div>` }),
  );
}

const W8_HOTS: HifiDef["hots"] = {
  "w8.add-action": { l: "Add action requirement", info: "Adds another approved-work requirement to the seeded promise." },
  "w8.add-address": { l: "Add confirmer address", info: "Adds another named confirmer before the threshold is locked." },
  "w8.claim-mode": { l: "Claim mode", info: "Set at seeding; prefilled by context — protocol pool gated, garden campaigns open (register #19)." },
  "w8.reward": { l: "Declared reward", info: "Reference only — the module never custodies funds (WF:339 · UX:280)." },
  "w8.continue-scope": { l: "Continue to requirements", to: "screen:W8@step2", info: "Type and scope → requirements." },
  "w8.continue-requirements": { l: "Continue to rule and reward", to: "screen:W8@step3", info: "Requirements → confirmation rule and declared reward." },
  "w8.continue-rule": { l: "Continue to review", to: "screen:W8@step4", info: "Rule and reward → final review." },
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
<div class="arow"><div class="grow"><b>Kwame</b> <span class="t-meta">joined May · 4 promises kept</span></div>${hot("w9.choose", btn("Choose", { kind: "sec", sm: true }))}</div>`
      : `${hot("w9.kind", field("Capture", radio([{ label: "Their offer", on: true }, { label: "Their request" }, { label: "A confirmation", meta: "always carries a reason" }], { interactive: true, name: "capture-kind" })))}
${hot("w9.continue", btn("Continue", { kind: "pri" }))}`;
  const header = pageHeader({
    title: "Record on a member's behalf",
    description: "The member is the promise's source; you are only the recorder.",
  });
  const body = `<div class="flowform">${banner(
    "“Recorded by your steward on your behalf. The promise stays yours.” — the member sees exactly this.",
    "stone",
    "hand-heart-line",
  )}${inner}</div>`;
  return deskWin(
    "admin.greengoods.app/dashboard/garden/pool/capture",
    adminCanvas("garden", "garden", { screenId: "W9", garden: "Rocinha", header, body }),
  );
}

const W9_HOTS: HifiDef["hots"] = {
  "w9.member": { l: "Pick the member", info: "The member is the social source; the steward is only the recorder (UX:437)." },
  "w9.choose": { l: "Choose Kwame", to: "screen:W9@capture-kind", info: "Selects Kwame as the member whose offer, request, or confirmation is being recorded." },
  "w9.kind": { l: "Capture kind", info: "Captured confirmations always carry a reason (UX:291)." },
  "w9.continue": { l: "Continue to captured promise", to: "screen:W8@captured-for", info: "Carries the selected member and capture kind into the seeding review." },
};

// ---------------------------------------------------------------------------
// W10 — commitment dialog (uiux-spec §6.2/§6.7; MF13 dissolved)
// ---------------------------------------------------------------------------

const W10_STATES = [
  ["detail", "Detail"], ["record-payout", "Record payout"], ["fallback-confirm", "Fallback confirm"],
  ["raise-dispute", "Raise dispute"], ["resolve-dispute", "Resolve dispute"], ["attach-assessment", "Attach assessment"],
  ["accepted", "Accepted — evidence in"], ["mark-ready-override", "Mark ready (override)"],
  ["cancel", "Cancel promise"], ["not-found", "Not found"],
] as const;
type W10State = (typeof W10_STATES)[number][0];

// Dimmed garden Pool tab behind the dialog. Hotspot-free (foreign hotspot ids
// would fail the bidirectional-integrity check on W10's states).
const w10Behind = () =>
  adminCanvas("garden", "garden", {
    screenId: "W10",
    garden: "Rocinha",
    interactiveChrome: false,
    header: pageHeader({ title: "Garden", description: "Season of First Rains — the pool's promises." }),
    tabRail: tabRail([{ label: "Health" }, { label: "Impact" }, { label: "Activity" }, { label: "Pool" }], 3),
    body: acard(
      "Commitments",
      `<div class="arow"><div class="grow"><b>Prune the north beds</b> ${chip("Offer", "offer")} <span class="t-meta num">Maria · 6 h</span></div>${chip("Ready", "warn", { dot: true })}</div>
<div class="arow"><div class="grow"><b>Market ride</b> ${chip("Request", "request")} <span class="t-meta num">João · 1</span></div>${chip("Accepted", "request", { dot: true })}</div>`,
    ),
  });

const W10_TITLE: Record<W10State, string> = {
  detail: "Prune the north beds", accepted: "Prune the north beds", "record-payout": "Record payout",
  "fallback-confirm": "Confirm as fallback", "raise-dispute": "Raise dispute", "resolve-dispute": "Resolve dispute",
  "attach-assessment": "Attach assessment", "mark-ready-override": "Mark ready with override",
  cancel: "Cancel this promise", "not-found": "Promise unavailable",
};

function w10(state: W10State): string {
  const cmChips = (...c: string[]) => `<div class="actrow" style="margin:0 0 2px">${c.join("")}</div>`;
  const dismiss = (label = "Cancel") => hot("w10.dismiss", btn(label, { kind: "ghost" }));
  let body: string;
  let actions: string;
  switch (state) {
    case "record-payout":
      body = `${kv("Declared reward", "20 DAI · garden jar")}${field("Rail reference", input("cookie-jar withdrawal #128"))}${banner("Records that the reward moved outside the app — no value moves here (UX:302). Build-phase G$ rewards relabel this Queue disbursement (SS:535).", "stone")}`;
      actions = `${dismiss()}${hot("w10.payout-confirm", btn("Record payout", { kind: "pri" }))}`;
      break;
    case "fallback-confirm":
      body = `${field("Reason (required)", input("confirmed on site visit"))}${banner("Steward fallback confirmation — the provider's own address is blocked on-chain, always (CS:744). The member timeline shows this as a steward record.", "stone", "shield-check-line")}`;
      actions = `${dismiss()}${hot("w10.fallback-confirm", btn("Confirm as fallback", { kind: "pri" }))}`;
      break;
    case "raise-dispute":
      body = `${field("Reason (required)", input("delivery contested at the gathering"))}${banner("Freezes the promise for review. Members see “under review by stewards” — never dispute language.", "stone")}`;
      actions = `${dismiss()}${hot("w10.dispute-confirm", btn("Raise dispute", { kind: "pri" }))}`;
      break;
    case "resolve-dispute":
      body = `${field("Outcome", hot("w10.resolve-options", radio([{ label: "Restore previous state", meta: "returns the exact stored state — no unit movement", on: true }, { label: "Fulfilled" }, { label: "Cancelled" }, { label: "Expired" }], { interactive: true, name: "resolution" })))}${field("Reason (required)", input("resolved at the weekly gathering"))}${banner("An Expired prior state can never resolve to Fulfilled (CS:144). Every outcome renders its reason in the member timeline.", "stone")}`;
      actions = `${dismiss()}${hot("w10.resolve", btn("Resolve", { kind: "pri" }))}`;
      break;
    case "attach-assessment":
      body = `${field("Assessment", hot("w10.assessment-pick", radio([{ label: "Baseline — AGRO — Jul 2", meta: "v3 · provider garden", on: true }, { label: "Delta — AGRO+EDU — Jul 9", meta: "v3" }], { interactive: true, name: "assessment" })))}${banner("Only non-revoked v2/v3 assessments with recipient = provider garden appear (UX:287).", "stone")}`;
      actions = `${dismiss()}${hot("w10.attach", btn("Attach", { kind: "pri" }))}`;
      break;
    case "accepted":
      // Evidence-only, pre-ready: the Send-for-confirmation / Mark-ready-override
      // twin (UX:294) plus the steward cancel (MF-2b).
      body = `${cmChips(chip("Offer", "offer"), chip("Accepted", "request", { dot: true }), chip("Evidence in", "warn", { dot: true }))}
${kv("Maria → João", "6 hours · due Aug 12")}
${stages(["Offered", "Accepted", "Work linked", "Ready", "Fulfilled"], 2)}
${kv("Kind", "Support · evidence-only")}${kv("Evidence", "2 items · photo, note")}${kv("Provider", "Maria — cannot confirm")}
${banner("Evidence is in. Send it to the recipient for confirmation — or, as a steward, mark it ready with a recorded reason.", "stone")}`;
      actions = `${hot("w10.cancel", btn("Cancel promise…", { kind: "danger" }))}${hot("w10.mark-override", btn("Mark ready with override…", { kind: "sec" }))}${hot("w10.send-confirmation", btn("Send for confirmation", { kind: "pri" }))}`;
      break;
    case "mark-ready-override":
      body = `${field("Reason (required)", input("field-verified at the weekly gathering"))}${banner("Steward override — separate from Send for confirmation. Moves the promise to Ready without the recipient's send; the reason is stored and shows in the member timeline (UX:294).", "stone", "shield-check-line")}`;
      actions = `${dismiss()}${hot("w10.override-confirm", btn("Mark ready", { kind: "pri" }))}`;
      break;
    case "cancel":
      body = `${field("Reason (required)", input("withdrawn by agreement at the gathering"))}${banner("Steward cancel — Accepted → Cancelled with a recorded reason. Committed units release; the member sees the reason, never “cancelled” alone (MF-2b · CS:745).", "stone", "error-warning-line")}`;
      actions = `${dismiss("Keep promise")}${hot("w10.cancel-confirm", btn("Cancel promise", { kind: "danger" }))}`;
      break;
    case "not-found":
      body = emptyState(
        "error-warning-line",
        "This promise couldn't be loaded",
        "It may be mid-sync, or the link is stale. Retry, or return to the pool to pick it again.",
        hot("w10.retry", btn("Retry", { kind: "sec", sm: true })),
      );
      actions = hot("w10.back-pool", btn("Back to pool", { kind: "ghost" }));
      break;
    default:
      body = `${cmChips(chip("Offer", "offer"), chip("Ready", "warn", { dot: true }))}
${kv("Maria → João", "6 hours · due Aug 12 · open claim")}
${stages(["Offered", "Accepted", "Work linked", "Ready", "Fulfilled"], 3)}
${kv("Evidence", "2 items · photo, note")}${kv("Linked work", "Pruning session (approved)")}${kv("Provider", "Maria — cannot confirm")}${kv("Eligible", "João ✓ · Ana ○ · you ○ (1 of 2 required)")}
<div class="arow"><div class="grow">${kv("Reward", "20 DAI · garden jar · unpaid")}</div>${hot("w10.record-payout", btn("Record payout", { kind: "sec", sm: true }))}</div>`;
      actions = `${hot("w10.fallback", btn("Confirm as fallback…", { kind: "sec" }))}${hot("w10.raise", btn("Raise dispute…", { kind: "sec" }))}`;
  }
  return deskWin(
    "admin.greengoods.app/dashboard/garden/pool",
    adminDialogM3(w10Behind(), "garden", { title: W10_TITLE[state], body, actions, closeHot: "w10.dismiss" }),
  );
}

const W10_HOTS: HifiDef["hots"] = {
  "w10.record-payout": { l: "Record payout", to: "screen:W10@record-payout", info: "AdminConfirmDialog captures the executed rail reference → RewardPaid; no value moves here (UX:302)." },
  "w10.payout-confirm": { l: "Record payout (confirm)", to: "screen:W2@reward-released", info: "recordRewardPaid → RewardPaid; the dry run rehearses this with a real minimal Cookie Jar withdrawal (register #34h)." },
  "w10.fallback": { l: "Confirm as fallback", to: "screen:W10@fallback-confirm", info: "Steward fallback with mandatory reason — provider-steward blocked on-chain (CS:744)." },
  "w10.fallback-confirm": { l: "Fallback (confirm)", to: "screen:W2@fulfilled", info: "Overrides render visible markers in the member timeline (UX:287,301)." },
  "w10.raise": { l: "Raise dispute", to: "screen:W10@raise-dispute", info: "Steward dispute entry, Accepted through Expired (UX:300)." },
  "w10.dispute-confirm": { l: "Raise dispute (confirm)", to: "screen:W2@disputed", info: "raiseDispute stores preDisputeState; member copy stays “under review by stewards” (CS:143)." },
  "w10.resolve-options": { l: "Resolution outcomes", info: "RestorePrevious / Fulfilled / Cancelled / Expired, each with a required reason (CS:144)." },
  "w10.resolve": { l: "Resolve", to: "screen:W2@accepted", info: "RestorePrevious returns the exact stored state — no unit movement (LAP:186)." },
  "w10.assessment-pick": { l: "Assessment picker", info: "Attach re-runs the auto-Ready check → CommitmentReadyForConfirmation (CS:740)." },
  "w10.attach": { l: "Attach assessment", to: "screen:W2@ready-confirmer", info: "attachAssessment → auto-Ready re-run (UX:287). Adopted MF-13 placement." },
  "w10.send-confirmation": { l: "Send for confirmation", to: "screen:W2@ready-confirmer", info: "Evidence-only records expose Send for confirmation to eligible creator/counterparty/steward; DomainImpact never does (UX:294)." },
  "w10.mark-override": { l: "Mark ready with override", to: "screen:W10@mark-ready-override", info: "Steward-only, separate from Send for confirmation; requires a visible reason (UX:294)." },
  "w10.override-confirm": { l: "Mark ready (confirm)", to: "screen:W2@ready-confirmer", info: "Records the override reason; the member timeline shows the steward marked it ready (UX:294)." },
  "w10.cancel": { l: "Cancel promise (steward)", to: "screen:W10@cancel", info: "MF-2b: steward cancel of an Accepted (or §4.1 Paused) promise — cancelCommitment (CS:745; AM:36-37)." },
  "w10.cancel-confirm": { l: "Cancel promise (confirm)", to: "screen:W7", info: "Accepted → Cancelled with a recorded reason; units release; the member sees the reason (CS:745)." },
  "w10.dismiss": { l: "Close dialog", to: "screen:W10", info: "Closes without applying the pending steward action." },
  "w10.retry": { l: "Retry promise read", to: "screen:W10", info: "Retries the promise read; the sentinel state never renders as a lifecycle chip." },
  "w10.back-pool": { l: "Back to pool", to: "screen:W7", info: "Returns to the scoped garden pool after a missing record." },
};

// ---------------------------------------------------------------------------
// W11 — open-cycle allocation policy (uiux-spec §6.10)
// ---------------------------------------------------------------------------

const W11_STATES = [["presets", "Presets"], ["invalid-sum", "Invalid sum"]] as const;
type W11State = (typeof W11_STATES)[number][0];

function w11(state: W11State): string {
  const bad = state === "invalid-sum";
  const rows = [
    ["Gardeners", bad ? "64" : "60"], ["Treasury", "15"], ["Steward", "10"],
    ["Evaluator", "5"], ["Community", "5"], ["Funder", "5"],
  ]
    .map(([l, v], i) => `<div class="arow"><div class="grow" id="a${i}">${l}</div>${input(v, { labelledBy: `a${i}` })}<span class="t-meta">%</span></div>`)
    .join("");
  const sum = bad
    ? banner("Shares must total exactly 100% — currently 104%.", "error", "error-warning-line")
    : `<div class="quietok">${icon("check-line")}total: 100% · encoded as 10,000 bps</div>`;
  const header = pageHeader({
    title: "Open cycle",
    eyebrow: "Allocation policy",
    description: "Season of First Rains — set how each fulfilled promise's units split across the six roles.",
  });
  const inner = `${hot("w11.presets", field("Preset", radio([{ label: "Garden-led (default)", on: true }, { label: "Balanced" }, { label: "Custom" }], { interactive: true, name: "allocation-preset" })))}
${rows}${sum}
${banner("A soft warning shows below 15% treasury (guidance floor). The complete six-field snapshot is encoded atomically for openCycle, then W26 reads it back.", "stone")}
${hot("w11.open-cycle", btn("Open cycle", { kind: "pri", disabled: bad }))}`;
  return deskWin(
    "admin.greengoods.app/dashboard/garden/pool/open-cycle",
    adminCanvas("garden", "garden", { screenId: "W11", garden: "Rocinha", header, body: `<div class="flowform">${inner}</div>` }),
  );
}

const W11_HOTS: HifiDef["hots"] = {
  "w11.presets": { l: "Allocation presets", info: "Presets prefill an editable percent editor; the protocol allocation class renders as “steward” (Decision Log #28c)." },
  "w11.open-cycle": { l: "Open cycle", to: "screen:W7", info: "openCycle(cycleId, allocation) validates, stores, and emits the complete six-class bps snapshot; the encoded sum must equal 10,000 (UX:322-330)." },
};

// ---------------------------------------------------------------------------
// W13 — Hub Confirm stage (+ W13b context chip) (uiux-spec §6.9)
// ---------------------------------------------------------------------------

const W13_STATES = [
  ["queue", "Confirm queue"], ["context-chip", "Work card chip (W13b)"], ["empty", "Nothing to confirm"],
] as const;
type W13State = (typeof W13_STATES)[number][0];

// Hub workspace real rail: Work · Assess · Certify · History; Confirm is net-new.
const hubRail = (activeIx: number) =>
  tabRail(
    [{ label: "Work", count: 3 }, { label: "Assess", count: 1 }, { label: "Certify", count: 2 }, { label: "Confirm", count: 2 }, { label: "History" }],
    activeIx,
  );

function w13(state: W13State): string {
  const rail = hubRail(state === "context-chip" ? 0 : 3);
  let inner: string;
  if (state === "empty") {
    inner = emptyState(
      "checkbox-circle-fill",
      "Nothing waiting for confirmation",
      "When a promise you're named on — or fallback-eligible for — is ready, it lands here to confirm.",
    );
  } else if (state === "context-chip") {
    inner = acard(
      "Pruning session",
      `<div class="arow"><div class="grow">2 photos · submitted by João</div>${hot("w13.chip", chip("Fulfills: Prune the north beds", "offer"))}</div>
<div class="arow">${hot("w13.approve", btn("Approve", { kind: "pri", sm: true }))}${hot("w13.reject", btn("Reject", { kind: "sec", sm: true }))}</div>
${banner("The commitment-context chip is the only Hub work-card delta (W13b).", "stone")}`,
    );
  } else {
    inner = acard(
      "Ready for confirmation — where you are named or fallback-eligible",
      `<div class="arow"><div class="grow">${hot("w13.row", `<b>Maria — Prune the north beds</b>`)} <span class="t-meta">Rocinha</span></div>${meter(66, { right: "2 of 3" })}</div>
<div class="arow"><div class="grow"><b>TAS — Field survey ride</b> <span class="t-meta">Awka</span></div>${meter(0, { right: "0 of 1" })}</div>`,
    );
  }
  const header = pageHeader({ title: "Hub", description: "Review and confirm work flowing through your gardens." });
  return deskWin(
    "admin.greengoods.app/dashboard/hub",
    adminCanvas("hub", "hub", { screenId: "W13", garden: "Rocinha", header, tabRail: rail, body: inner }),
  );
}

const W13_HOTS: HifiDef["hots"] = {
  "w13.row": { l: "Confirm queue row", to: "screen:W10", info: "Queue of promises where you are named or fallback-eligible (UX:318)." },
  "w13.chip": { l: "Commitment-context chip (W13b)", info: "Work cards show which promise they fulfill; approval rails untouched (UX:285)." },
  "w13.approve": { l: "Approve work", info: "Uses the existing WorkApproval rail; the context chip only links this work back to its promise." },
  "w13.reject": { l: "Reject work", info: "Uses the existing work-rejection rail with its normal reason capture." },
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
    ], { interactive: true, name: "assessment-kind" }),
  );
  const extra =
    state === "delta"
      ? field("Baseline to compare", input("Baseline — AGRO — Jul 2", { select: true }))
      : banner("One baseline per garden/cycle/domain — a duplicate attempt points at the existing record.", "stone");
  const header = pageHeader({
    title: "Create assessment",
    eyebrow: "Step 1 of 3",
    description: "Cycle and kind — the v3 additions extend the existing assessment flow.",
  });
  const inner = `${field("Cycle", input("Season of First Rains", { select: true }))}${field("Assessment kind", kindRadio)}${extra}${hot("w14.continue", btn("Continue", { kind: "pri" }))}`;
  return deskWin(
    "admin.greengoods.app/dashboard/hub/assess",
    adminCanvas("hub", "hub", { screenId: "W14", garden: "Rocinha", header, body: `<div class="flowform">${inner}</div>` }),
  );
}

const W14_HOTS: HifiDef["hots"] = {
  "w14.kind": { l: "Assessment kind", info: "Baseline: evaluator or steward. Delta: Evaluator Hat only (CS:760-761)." },
  "w14.continue": { l: "Continue assessment", info: "Continues into the existing assessment evidence and scoring steps." },
};

// ---------------------------------------------------------------------------
// HUBWORK — existing Work stage (approval rails untouched)
// ---------------------------------------------------------------------------

function hubwork(): string {
  const header = pageHeader({ title: "Hub", description: "Review and triage work submitted across your gardens." });
  const inner = acard(
    "Pruning session — Prune the north beds",
    `<div class="arow"><div class="grow">2 photos · submitted by João · Jul 8</div></div>
<div class="actrow">${hot("hub.approve", btn("Approve", { kind: "pri", sm: true }))}${hot("hub.reject", btn("Reject", { kind: "sec", sm: true }))}</div>
${banner("Existing Work stage — approval rails untouched (UX:285).", "stone")}`,
  );
  return deskWin(
    "admin.greengoods.app/dashboard/hub",
    adminCanvas("hub", "hub", { screenId: "HUBWORK", garden: "Rocinha", header, tabRail: hubRail(0), body: inner }),
  );
}

const HUBWORK_HOTS: HifiDef["hots"] = {
  "hub.approve": { l: "Approve", to: "screen:HUBWORK", info: "Existing WorkApproval rails → onWorkApproved → ApprovedWorkCounted (CS:737)." },
  "hub.reject": { l: "Reject", info: "Existing work-rejection rail with a recorded reason; no pooling-specific behavior." },
};

// ---------------------------------------------------------------------------

export const ADMIN_DEFS: HifiDef[] = [
  { screen: { id: "W7", title: "W7 · Garden Pool tab (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: W7_STATES.map(([id, label]) => ({ id, label, proposed: id === "ready" || id === "expiry-queue", html: w7(id) })) }, hots: { ...adminChromeHots("w7", "garden"), ...W7_HOTS } },
  { screen: { id: "W8", title: "W8 · Seeding console", surface: "admin", frame: "desktop", group: "Admin console",
    states: W8_STATES.map(([id, label]) => ({ id, label, html: w8(id) })) }, hots: { ...adminChromeHots("w8", "garden"), ...W8_HOTS } },
  { screen: { id: "W9", title: "W9 · Analog capture", surface: "admin", frame: "desktop", group: "Admin console",
    states: W9_STATES.map(([id, label]) => ({ id, label, html: w9(id) })) }, hots: { ...adminChromeHots("w9", "garden"), ...W9_HOTS } },
  { screen: { id: "W10", title: "W10 · Commitment dialog (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: W10_STATES.map(([id, label]) => ({ id, label, proposed: ["attach-assessment", "accepted", "mark-ready-override", "cancel"].includes(id), html: w10(id) })) }, hots: W10_HOTS },
  { screen: { id: "W11", title: "W11 · Open-cycle allocation", surface: "admin", frame: "desktop", group: "Admin console",
    states: W11_STATES.map(([id, label]) => ({ id, label, html: w11(id) })) }, hots: { ...adminChromeHots("w11", "garden"), ...W11_HOTS } },
  { screen: { id: "W13", title: "W13 · Hub Confirm stage", surface: "admin", frame: "desktop", group: "Admin console",
    states: W13_STATES.map(([id, label]) => ({ id, label, html: w13(id) })) }, hots: { ...adminChromeHots("w13", "hub"), ...W13_HOTS } },
  { screen: { id: "W14", title: "W14 · Assessment v3 additions", surface: "admin", frame: "desktop", group: "Admin console",
    states: W14_STATES.map(([id, label]) => ({ id, label, html: w14(id) })) }, hots: { ...adminChromeHots("w14", "hub"), ...W14_HOTS } },
  { screen: { id: "HUBWORK", title: "Existing Hub Work stage", surface: "admin", frame: "desktop", group: "Admin console",
    states: [{ id: "approve", label: "Approve", html: hubwork() }] }, hots: { ...adminChromeHots("hubwork", "hub"), ...HUBWORK_HOTS } },
];
