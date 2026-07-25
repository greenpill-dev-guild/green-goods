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
import { banner, btn, chip, disclosure, emptyState, field, input, kv, meter, radio, skeleton } from "../kit";
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
  return `<div class="wsgrid" data-tone="${tone}" data-component="CanvasLayout">${appBar(parts.garden, hotPrefix, interactiveChrome)}<main class="mainscroll"><section class="routecard">${parts.header}${
    parts.tabRail ?? ""
  }${parts.body}</section></main>${navDock(nav, hotPrefix, interactiveChrome)}</div>`;
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

// Admin action flows are hosted in a centered flow AdminDialog wrapping
// ActionFlowShell: pinned header, desktop step rail, centred reading column,
// pinned footer. The footer mirrors the shipping callers (SubmitWork /
// CreateAssessment / CreateAction): ONE leading button that morphs — Cancel on
// the first step, Back after — beside the primary, right-aligned. Back and
// Cancel never render together; the AdminDialog X (cancelHot) is the constant
// exit on every step. The real footer's left slot is a progress/status slot
// (AdminLinearProgress + message), drawn empty here because no in-flight state
// is prototyped.
export type FlowStep = { title: string; desc: string };
export function flowDialog(
  behind: string,
  tone: Tone,
  opts: { context: string; title: string; steps: FlowStep[]; current: number; body: string; back?: string; cancelHot: string; next: string },
): string {
  const rail = `<nav class="steprail" aria-label="Steps">${opts.steps
    .map((s, i) => {
      const cls = i === opts.current ? " on" : i < opts.current ? " done" : "";
      return `<div class="srow${cls}"${i === opts.current ? ' aria-current="step"' : ""}><span class="sdot">${i < opts.current ? "✓" : i + 1}</span><span><span class="st">${esc(s.title)}</span><span class="sd">${esc(s.desc)}</span></span></div>`;
    })
    .join("")}</nav>`;
  const leading = opts.back
    ? hot(opts.back, btn("Back", { kind: "ghost", icon: "arrow-left-line" }))
    : hot(opts.cancelHot, btn("Cancel", { kind: "ghost" }));
  const close = hot(opts.cancelHot, `<button type="button" class="dclose" aria-label="Close">${icon("close-line", "s")}</button>`);
  return `<div class="dlgstage"><div class="dlg-behind" inert aria-hidden="true">${behind}</div><div class="scrimm"></div><div class="adlg flow" data-tone="${tone}" data-component="AdminDialog" role="dialog" aria-modal="true" aria-labelledby="flow-dialog-title"><div class="dlg-head"><span class="eyebrow">${esc(
    opts.context,
  )}</span><span class="dt" id="flow-dialog-title">${esc(opts.title)}</span>${close}</div><div class="flowrow">${rail}<div class="dlg-body"><div class="flowform">${
    opts.body
  }</div></div></div><div class="dlg-foot"><span class="fprog"></span><span class="fend">${leading}${opts.next}</span></div></div></div>`;
}

// Dense data table — hairline row dividers, no cell borders, no zebra
// (uiux-spec §12: tabular data stays a table; queues render as list-rows).
export const dtable = (heads: string[], rows: string[][], caption: string) =>
  `<table class="dtab"><caption class="visually-hidden">${esc(caption)}</caption><thead><tr>${heads.map((h) => `<th scope="col">${h ? esc(h) : '<span class="visually-hidden">Actions</span>'}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;

// Dirty-flow discard guard — one per flow, so "Keep editing" returns to the
// flow that was actually open. A single shared W8 dialog swallowed capture,
// open-cycle, and assessment cancels into the seed flow's first step.
const discardDialog = (behind: string, tone: Tone, keepHot: string, discardHot: string, what?: string) =>
  adminDialogM3(behind, tone, {
    title: "Discard changes?",
    body: banner(
      `${what ?? "Nothing here has been saved yet"}. Leaving now discards what you've entered.`,
      "amber",
      "error-warning-line",
    ),
    actions: `${hot(keepHot, btn("Keep editing", { kind: "ghost" }))}${hot(discardHot, btn("Discard", { kind: "danger" }))}`,
    closeHot: keepHot,
  });

// ---------------------------------------------------------------------------
// W7 — Garden workspace Pool tab (uiux-spec §6.2)
// ---------------------------------------------------------------------------

const W7_STATES = [
  ["open", "Open"], ["not-ready", "Not ready — checklist"], ["preflight-complete", "Checks complete — mark ready"], ["ready", "Ready — open it"],
  ["paused", "Paused"], ["reconciled", "Reconciled"], ["cycle-composted", "Season composted — close?"], ["pool-closed", "Pool closed"],
  ["claims", "Claims waiting"], ["claim-declined", "Declined — others pending"], ["claim-outcomes", "Claim outcomes"], ["expiry-queue", "Lapsed this cycle"],
  ["pause-confirm", "Pause — confirm"], ["close-pool-confirm", "Close pool — confirm"],
  ["cancel-cycle-confirm", "Cancel season — confirm"], ["decline-claim-confirm", "Decline claim — confirm"],
  ["loading", "Loading"], ["empty", "No commitments yet"],
] as const;
type W7State = (typeof W7_STATES)[number][0];

const w7PoolCard = (state: W7State) => {
  const chipFor: Record<string, string> = {
    open: chip("Open", "ok", { dot: true }), "not-ready": chip("Not ready", "plain", { dot: true }),
    "preflight-complete": chip("Checks complete", "warn", { dot: true }),
    ready: chip("Ready", "warn", { dot: true }), paused: chip("Paused", "warn", { dot: true }),
    reconciled: chip("Open", "ok", { dot: true }), "cycle-composted": chip("Open", "ok", { dot: true }),
    "claim-outcomes": chip("Open", "ok", { dot: true }),
    "expiry-queue": chip("Open", "ok", { dot: true }),
  };
  const acts =
    // A pool that has never opened cannot be paused or closed; the only move is
    // finishing the readiness checklist.
    state === "not-ready"
      ? hot("w7.edit-charter", btn("Edit readiness", { kind: "pri" }))
      : state === "preflight-complete"
      ? `${hot("w7.mark-ready", btn("Mark pool ready", { kind: "pri" }))}${hot("w7.edit-charter", btn("Edit readiness", { kind: "sec", sm: true }))}`
      : state === "ready"
      ? `${hot("w7.open-pool", btn("Open pool", { kind: "pri" }))}${hot("w7.edit-charter", btn("Edit charter", { kind: "sec", sm: true }))}`
      : state === "cycle-composted"
      ? `${hot("w7.close-pool", btn("Close pool…", { kind: "danger" }))}${hot("w7.edit-charter", btn("Edit charter", { kind: "sec", sm: true }))}`
      : state === "paused"
        ? `${hot("w7.resume", btn("Resume pool", { kind: "pri" }))}${hot("w7.edit-charter", btn("Edit charter", { kind: "sec", sm: true }))}`
          : hot("w7.edit-charter", btn("Edit charter", { kind: "sec", sm: true }));
  const meta =
    state === "not-ready"
      ? `${kv("Charter", "not set")}${kv("Provider open-commitment cap", "not set")}${kv("Qualifying baseline", "missing")}`
      : `${kv("Charter", "agreed ✓")}${kv("Baseline", "recorded ✓")}${kv("Provider open-commitment cap", "24 commitments")}`;
  const note =
    state === "not-ready"
      ? banner("Readiness needs all three: charter, provider open-commitment cap, and a qualifying baseline assessment.", "stone")
      : state === "preflight-complete"
        ? banner("All three checks pass. Marking Ready records the onchain pool transition; it does not open member participation yet.", "stone")
      : state === "ready"
        ? banner("Everything is in place. Opening the pool lets members see and make promises.", "stone")
        : state === "cycle-composted"
          ? banner("Every cycle in this pool has composted. Seed the next one — or close the pool; closing ends participation and keeps the history with the garden.", "stone")
        : state === "paused"
          ? banner("Paused with reason: “seasonal flooding, back after the rains”. Members keep evidence and recovery; create/claim/confirm wait.", "amber", "error-warning-line")
          : "";
  // Pause is rare and consequential, and was sitting at content hierarchy on
  // every open pool — it lives one disclosure away, behind its confirmation.
  // Close pool is NOT offered here: §6.2 locks it to appear only after the
  // last cycle composts, so it renders as the cycle-composted card's action.
  const lifecycle =
    state === "open" || state === "reconciled" || state === "cycle-composted" || state === "claim-outcomes" || state === "expiry-queue"
      ? disclosure(
          "More pool actions",
          "pause",
          `<div class="actrow">${hot("w7.pause", btn("Pause…", { kind: "sec", sm: true }))}</div>`,
        )
      : "";
  // Status chip stays in the card header; lifecycle actions get their own row
  // beneath the meta so a busy state never crowds the head.
  return acard("Pool", `${meta}${note}<div class="actrow">${acts}</div>${lifecycle}`, chipFor[state]);
};

const w7Cycles = (state: W7State) => {
  // While Paused, opening or seeding a cycle would revert (openCycle needs the
  // pool Open, seedCycle Ready or Open — CS:726/727). The controls stay visible
  // and honestly disabled; closing a cycle is wind-down and remains live.
  const canOpenCycles = state !== "paused";
  // The Season row tracks the drawn moment: live → close/cancel; reconciled or
  // composted → scoped report only (Close pool is the pool card's act, §6.2).
  const seasonChip =
    state === "cycle-composted" ? chip("Composted", "plain", { dot: true })
    : state === "reconciled" ? chip("Reconciled", "plain", { dot: true })
    : chip("Open", "ok", { dot: true });
  const seasonActs =
    state === "reconciled" || state === "cycle-composted"
      ? hot("w7.report-row", btn("Scoped report", { kind: "sec", sm: true }))
      : `${hot("w7.close-season", btn("Close season…", { kind: "sec", sm: true }))}${hot("w7.cancel-cycle", btn("Cancel…", { kind: "ghost", sm: true }))}`;
  const stageIx = state === "cycle-composted" ? 5 : state === "reconciled" ? 4 : 1;
  // The Campaigns list must agree with the Season about whether anything is
  // still running. §6.2 offers Close pool only after the LAST cycle composts,
  // so the composted state cannot also show open campaigns — that combination
  // made the close confirmation's "its last cycle has composted" false on the
  // one screen that offers the act.
  const campaigns =
    state === "cycle-composted"
      ? disclosure(
          "Campaigns",
          "3 composted",
          `<div class="arow"><div class="grow">Market rides <span class="ch">Campaign</span> <span class="t-meta num">14/16 kept</span></div>${chip("Composted", "plain", { dot: true })}</div>
<div class="arow"><div class="grow">Tool library <span class="ch">Campaign</span> <span class="t-meta num">8/8 kept</span></div>${chip("Composted", "plain", { dot: true })}</div>
<div class="arow"><div class="grow">Seedling swap <span class="ch">Campaign</span> <span class="t-meta num">5/6 kept</span></div>${chip("Composted", "plain", { dot: true })}</div>`,
        )
      : disclosure(
          "Campaigns",
          "2 open · 1 seeded",
          `<div class="arow"><div class="grow">Market rides <span class="ch">Campaign</span> <span class="t-meta num">6/16</span></div>${chip("Open", "ok", { dot: true })}</div>
<div class="arow"><div class="grow">Tool library <span class="ch">Campaign</span> <span class="t-meta num">8/8</span></div>${chip("Reviewing", "warn", { dot: true })}</div>
<div class="arow"><div class="grow">Seedling swap <span class="ch">Campaign</span></div>${chip("Seeded", "plain", { dot: true })}${
            canOpenCycles
              ? hot("w7.open-cycle-flow", btn("Open cycle", { kind: "sec", sm: true }))
              : btn("Open cycle", { kind: "sec", sm: true, disabled: true })
          }</div>`,
        );
  return acard(
    "Cycles",
    `<div class="arow"><div class="grow"><b>Season of First Rains</b> <span class="ch">Season</span></div>${seasonChip}${seasonActs}</div>
${stages(["Seeded", "Open", "In progress", "Reviewing", "Reconciled", "Composted"], stageIx)}
${campaigns}`,
    // Kept on the composted state too: the pool is still Open, so seeding the
    // next cycle is legal (CS:726) and is the alternative the card's banner
    // offers beside Close. Disabled while Paused for the same reason as above.
    canOpenCycles
      ? hot("w7.new-campaign", btn("New campaign", { kind: "sec", sm: true }))
      : btn("New campaign", { kind: "sec", sm: true, disabled: true }),
  );
};

// Workspace queue → hairline list-rows inside the route card (not a bordered grid).
// The Open · Confirmed · Past scoping is locked by the §6.2 layout addendum and
// retires the separate cycle-console "History:" row.
const w7ScopeChips = () =>
  hot(
    "w7.scope",
    `<div class="scopechips" role="group" aria-label="Commitment scope">${["Open", "Confirmed", "Past"]
      .map((l, i) => `<button type="button" class="sc-chip${i === 0 ? " on" : ""}"${i === 0 ? ' aria-current="true"' : ""}>${l}</button>`)
      .join("")}</div>`,
  );

const w7Commitments = () =>
  acard(
    "Commitments",
    `${w7ScopeChips()}
<div class="arow">${hot("w7.commitment-row", `<div class="grow"><b>Prune the north beds</b> ${chip("Offer", "offer")} <span class="t-meta num">Maria · 6 h</span></div>`)}${chip("Accepted", "request", { dot: true })}${icon("arrow-right-s-line", "s")}</div>
<div class="arow"><div class="grow"><b>Market ride</b> ${chip("Request", "request")} <span class="t-meta num">João · 1</span></div>${chip("Ready", "warn", { dot: true })}${icon("arrow-right-s-line", "s")}</div>`,
    input("Search…", { placeholder: true, icon: "search-line", ariaLabel: "Search commitments" }),
  );

// The operator's first question on this tab is triage, not lifecycle. The §6.2
// layout addendum locks this row; without it the route opened on pool plumbing
// with the claims queue three cards down.
const w7Summary = () =>
  `<div class="sumrow">${(
    [
      ["2", "awaiting confirmation", "w7.jump-confirm"],
      ["2", "claims waiting", "w7.jump-claims"],
      ["0", "failed payouts", "w7.jump-payouts"],
    ] as const
  )
    .map(([n, l, h]) => hot(h, `<button type="button" class="sumcell"><span class="n num">${n}</span><span class="l">${l}</span></button>`))
    .join("")}</div>`;

const w7Claims = (state: W7State) => {
  // One cast across the whole decline arc (sb3): Ana and João ask; Ana is
  // declined, asks again, and her fresh row is superseded when João is
  // accepted. Garden claims are the protocol console's story (W12 / sb13) —
  // a garden claim in a garden pool would name the pool garden itself
  // (CS:596-600), so no cross-garden row belongs in this queue.
  if (state === "claim-declined")
    return acard(
      "Claims — after the decline",
      `<div class="arow"><div class="grow"><b>Field survey</b> · Ana · individual · Jul 9</div>${chip("Declined — reason recorded", "plain", { dot: true })}</div>
<div class="arow"><div class="grow"><b>Field survey</b> · João · individual · Jul 10</div>${chip("Pending", "warn", { dot: true })}</div>
${banner("Only the selected request changed. João's request stays pending, the promise stays claimable, and Ana may ask again.", "stone")}`,
    );
  if (state === "claim-outcomes")
    return acard(
      "Claims — steward-reviewed",
      `<div class="arow"><div class="grow">Ana · individual · Jul 9</div>${chip("Declined — reason recorded", "plain", { dot: true })}</div>
<div class="arow"><div class="grow">João · individual · Jul 10</div>${chip("Accepted — terms stored", "ok", { dot: true })}</div>
<div class="arow"><div class="grow">Ana · individual · second ask · Jul 10</div>${chip("Superseded", "plain", { dot: true })}</div>
${banner("Accepting one request supersedes the other pending rows — an indexer side-effect, never a member action.", "stone")}`,
    );
  if (state === "expiry-queue")
    return acard(
      "Lapsed this cycle",
      `<div class="arow"><div class="grow"><b>Field survey</b> ${chip("Request", "request")} ${chip("Expired", "plain", { dot: true })} <span class="t-meta num">due Jul 2 · 0 of 1 taken up</span></div>${hot("w7.reseed", btn("Re-seed…", { kind: "sec", sm: true }))}${hot("w7.history", btn("View history", { kind: "ghost", sm: true }))}</div>
${banner("Expiry runs both paths: this queue for stewards, “offer again” for members.", "stone")}`,
    );
  // Tonal, not filled: in a multi-row queue no single row's accept is the
  // route's primary act — that is Seed, in the page header.
  const rowActions = (acceptHot: string, declineHot: string) =>
    `${hot(acceptHot, btn("Accept", { kind: "sec", sm: true }))}${hot(declineHot, btn("Decline…", { kind: "ghost", sm: true }))}`;
  return acard(
    "Claims waiting — steward-reviewed",
    `<div class="arow"><div class="grow"><b>Field survey</b> · Ana · individual · Jul 9</div>${rowActions("w7.accept-ana", "w7.decline-claim")}</div>
<div class="arow"><div class="grow"><b>Field survey</b> · João · individual · Jul 10</div>${rowActions("w7.accept-claim", "w7.decline-joao")}</div>`,
  );
};

const W7_DESC: Record<W7State, string> = {
  open: "Season of First Rains is live — offers and requests between neighbors.",
  "not-ready": "Finish the readiness checklist before members can promise.",
  "preflight-complete": "All readiness checks pass — mark the pool Ready onchain.",
  ready: "Everything is in place — open the pool when you're ready.",
  paused: "Paused for the season — evidence and recovery stay open.",
  reconciled: "The season is reconciled — promises settled; compost comes next.",
  "cycle-composted": "Every cycle has composted — seed the next one, or close the pool.",
  "pool-closed": "The pool is closed — its history stays with the garden.",
  "claim-declined": "Ana's request is declined; João's stays pending.",
  "claim-outcomes": "How this cycle's steward-reviewed claims resolved.",
  "expiry-queue": "Promises that lapsed this cycle — offer them again.",
  loading: "Loading the pool…",
  empty: "The pool is open and waiting for its first promise.",
  "pause-confirm": "Season of First Rains is live — offers and requests between neighbors.",
  "close-pool-confirm": "Season of First Rains is live — offers and requests between neighbors.",
  "cancel-cycle-confirm": "Season of First Rains is live — offers and requests between neighbors.",
  "decline-claim-confirm": "Season of First Rains is live — offers and requests between neighbors.",
};

// Dimmed pool route behind a W7 confirmation. Hotspot-free for the same reason
// W10's is: foreign ids here would break bidirectional hotspot integrity.
const w7Behind = () =>
  adminCanvas("garden", "garden", {
    screenId: "W7",
    garden: "Rocinha",
    interactiveChrome: false,
    header: pageHeader({ title: "Garden", description: W7_DESC.open }),
    tabRail: tabRail([{ label: "Health" }, { label: "Impact" }, { label: "Activity" }, { label: "Pool" }], 3),
    body: acard(
      "Pool",
      `${kv("Charter", "agreed ✓")}${kv("Baseline", "recorded ✓")}${kv("Provider open-commitment cap", "24 commitments")}`,
      chip("Open", "ok", { dot: true }),
    ),
  });

// Every consequential pool or cycle act names its blast radius and takes the
// reason the contract stores — and ONLY when the contract stores one: closePool
// takes no reason (CS:556), so its confirmation is banner-only. validate.ts
// enforces both directions via REASON_CONFIRMS. Each of these was previously
// one click straight to the outcome state — which teaches an implementer that
// no confirmation exists.
const w7Confirm = (radius: string, reason: string) =>
  `${banner(radius, "amber", "error-warning-line")}${field("Reason (required)", input(reason))}`;

const W7_CONFIRMS: Partial<Record<W7State, { title: string; body: string; actions: string; closeHot: string }>> = {
  "pause-confirm": {
    title: "Pause this pool",
    body: w7Confirm(
      "Pausing stops new promises, claims, and confirmations for 23 members across 7 open promises. Evidence, work linkage, and recovery stay open; resuming clears this reason.",
      "seasonal flooding, back after the rains",
    ),
    actions: `${hot("w7.confirm-dismiss", btn("Keep running", { kind: "ghost" }))}${hot("w7.pause-confirm", btn("Pause pool", { kind: "pri" }))}`,
    closeHot: "w7.confirm-dismiss",
  },
  "close-pool-confirm": {
    title: "Close this pool",
    // Banner-only on purpose: closePool(poolId) stores no reason (CS:556), and
    // this confirm is reachable only from the cycle-composted card, where the
    // "last cycle has composted" sentence is true.
    body: banner(
      "Closing ends participation for 23 members. Its last cycle has composted and its history stays with the garden — members can make no further promises here. Compost and reopen stay available.",
      "amber",
      "error-warning-line",
    ),
    actions: `${hot("w7.close-dismiss", btn("Keep open", { kind: "ghost" }))}${hot("w7.close-pool-confirm", btn("Close pool", { kind: "danger" }))}`,
    closeHot: "w7.close-dismiss",
  },
  "cancel-cycle-confirm": {
    title: "Cancel this season",
    body: w7Confirm(
      "Season of First Rains has 8 promises, 5 of them kept. Cancelling ends the season for everyone in it; each promise keeps its own record, and members see the reason you give here.",
      "funding fell through for the rains",
    ),
    actions: `${hot("w7.confirm-dismiss", btn("Keep the season", { kind: "ghost" }))}${hot("w7.cancel-cycle-confirm", btn("Cancel season", { kind: "danger" }))}`,
    closeHot: "w7.confirm-dismiss",
  },
  "decline-claim-confirm": {
    title: "Decline Ana's request",
    body: w7Confirm(
      "Only Ana's request is declined — João's stays pending and the promise stays claimable. Ana sees your reason and may ask again.",
      "provider context — see charter",
    ),
    actions: `${hot("w7.decline-dismiss", btn("Keep pending", { kind: "ghost" }))}${hot("w7.decline-claim-confirm", btn("Decline request", { kind: "pri" }))}`,
    closeHot: "w7.decline-dismiss",
  },
};

function w7(state: W7State): string {
  const confirm = W7_CONFIRMS[state];
  if (confirm)
    return deskWin("admin.greengoods.app/dashboard/garden/pool", adminDialogM3(w7Behind(), "garden", confirm));

  // Garden workspace, net-new Pool tab (real rail: Health · Impact · Activity).
  const rail = tabRail([{ label: "Health" }, { label: "Impact" }, { label: "Activity" }, { label: "Pool" }], 3);
  // Seed lives in the header (desktop puts creation in header actions, not a FAB).
  // seedCycle requires the pool to be Ready or Open (CS:726), so the readiness
  // states show the control disabled rather than offering an act that fails.
  // Creation is gated by pool state, not just drawn: createCommitment/seedCycle
  // need the pool Ready or Open (CS:726), and §4.1 disables create/claim while
  // Paused — only safe wind-down stays. Offering an act that would revert is
  // what the disabled Seed control exists to prevent.
  const seedable =
    state !== "not-ready" && state !== "preflight-complete" && state !== "pool-closed" && state !== "paused";
  const seed = seedable
    ? hot("w7.seed-fab", btn("Seed", { kind: "pri", sm: true, icon: "add-line" }))
    : btn("Seed", { kind: "pri", sm: true, icon: "add-line", disabled: true });
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
  } else if (state === "not-ready" || state === "preflight-complete" || state === "ready") {
    // A pool that has not opened has no cycles, no accepted commitments, and no
    // claims. Rendering those consoles here showed an open Season with Close and
    // Cancel actions on a pool members cannot yet participate in.
    body = w7PoolCard(state);
  } else if (state === "pool-closed") {
    // §4.1 Closed: view-only history; compost is the remaining act and reopen
    // follows compost. No cycles/commitments consoles on a closed pool.
    body = acard(
      "Pool",
      `${kv("History", "1 season · 23 promises · 19 kept")}${banner(
        "The pool is closed — its history stays with the garden. Composting archives it; reopening starts the next era.",
        "stone",
      )}<div class="actrow">${hot("w7.compost-pool", btn("Compost pool…", { kind: "sec", sm: true }))}</div>`,
      chip("Closed", "plain", { dot: true }),
    );
  } else {
    // The default view answers "what needs me?" — summary, pool state, the
    // scoped commitment list, and (per §6.2 section 4) the claims queue while
    // approval-gated requests exist. The focused claim/expiry states keep
    // their single-task views, reached from the counts that name them.
    body =
      state === "claims" || state === "claim-declined" || state === "claim-outcomes" || state === "expiry-queue"
        ? `${w7Summary()}${w7Claims(state)}`
        : state === "open"
          ? `${w7Summary()}${w7PoolCard(state)}${w7Cycles(state)}${w7Commitments()}${w7Claims(state)}`
          : `${w7Summary()}${w7PoolCard(state)}${w7Cycles(state)}${w7Commitments()}`;
  }
  const header = pageHeader({ title: "Garden", description: W7_DESC[state], actions: seed });
  return deskWin(
    "admin.greengoods.app/dashboard/garden/pool",
    adminCanvas("garden", "garden", { screenId: "W7", garden: "Rocinha", header, tabRail: rail, body }),
  );
}

const W7_HOTS: HifiDef["hots"] = {
  "w7.pause": { l: "Pause pool (reason)", to: "screen:W7@pause-confirm", info: "pausePool with mandatory reason CID; members keep evidence/linkage + recovery (UX:60)." },
  "w7.confirm-dismiss": { l: "Keep as it is", to: "screen:W7", info: "Closes the confirmation without applying the act." },
  "w7.pause-confirm": { l: "Pause pool (confirm)", to: "screen:W7@paused", info: "pausePool(reason) — the stored reason renders in the member banner (UX:60 · CS:725)." },
  "w7.close-pool-confirm": { l: "Close pool (confirm)", to: "screen:W7@pool-closed", info: "closePool(poolId) — no stored reason (CS:556). Lands on the steward's closed-pool console; the member echo is W1@closed; compost/reopen follow per §4.1." },
  "w7.close-dismiss": { l: "Keep the pool open", to: "screen:W7@cycle-composted", info: "Closes the confirmation; the pool stays open with its composted season's history." },
  "w7.decline-dismiss": { l: "Keep pending", to: "screen:W7@claims", info: "Closes the confirmation and returns to the claims queue with both requests still pending." },
  "w7.cancel-cycle-confirm": { l: "Cancel season (confirm)", to: "screen:W1@cancelled-cycle", info: "cancelCycle(reason) → quiet member banner naming the reason (UX:77 · CS:104)." },
  "w7.decline-claim-confirm": { l: "Decline request (confirm)", to: "screen:W7@claim-declined", info: "declineClaim(reason) clears exactly one request — the other row stays pending; the claimant may ask again (CS:734)." },
  "w7.resume": { l: "Resume pool", to: "screen:W7", info: "resumePool clears the indexed reason (CS:725)." },
  "w7.edit-charter": { l: "Edit readiness", to: "screen:W7@preflight-complete", info: "Completes the charter, non-zero provider open-commitment cap, and qualifying Baseline preflight; the pool remains NotReady until markPoolReady succeeds (UX:269)." },
  "w7.mark-ready": { l: "Mark pool ready", to: "screen:W7@ready", info: "markPoolReady records NotReady → Ready after charter + non-zero cap pass onchain and the qualifying Baseline passes the app preflight (CS:724 · UX:269)." },
  "w7.open-pool": { l: "Open pool", to: "screen:W7", info: "openPool → PoolOpened. Adopted onto the status card per register #34a — closes the Ready→Open deadlock (CS:100, CS:727)." },
  "w7.close-pool": { l: "Close pool", to: "screen:W7@close-pool-confirm", info: "Offered only once the last cycle composts (uiux §6.2 · CS:102); closePool(poolId) takes no reason (CS:556). Compost/reopen follow per §4.1." },
  "w7.close-season": { l: "Close season", to: "screen:W26", info: "closeCycle — the reconcile act; commitments derive Reconciled (CS:118)." },
  "w7.cancel-cycle": { l: "Cancel a cycle (reason)", to: "screen:W7@cancel-cycle-confirm", info: "cancelCycle → quiet member banner with reason (UX:77 · CS:104)." },
  "w7.new-campaign": { l: "New campaign", to: "screen:W8", info: "seedCycle — any number of concurrent campaigns; a second Season is blocked (UX:66)." },
  "w7.accept-claim": { l: "Accept claim", to: "screen:W7@claim-outcomes", info: "Consumes the stored request terms; other pending rows become Superseded (CS:733)." },
  "w7.decline-claim": { l: "Decline claim (reason)", to: "screen:W7@decline-claim-confirm", info: "Clears exactly one request; the claimant may ask again (CS:734)." },
  "w7.reseed": { l: "Re-seed", to: "screen:W8", info: "Lapsed seeded promises re-enter the seeding console prefilled (UX:94). Adopted MF-4." },
  "w7.history": { l: "View history", info: "Opens this expired promise's state history and recorded reason." },
  // Info-only mirrors of the two acts this storyboard walks: accepting Ana or
  // declining João is equally legal, but the resulting outcome set is not drawn
  // (the outcomes state depicts João accepted / Ana superseded). Named so the
  // control is honest about being a preview rather than silently inert.
  "w7.accept-ana": { l: "Accept Ana's request", info: "Legal and symmetric to accepting João — consumes Ana's stored terms and supersedes every other pending row (CS:733). The mirrored outcome set is not drawn; the storyboard walks the accept-João path. Garden-context claims live on the protocol console (W12/sb13)." },
  "w7.decline-joao": { l: "Decline João's request (reason)", info: "Legal and symmetric to declining Ana — clears only João's row with a required reason (CS:734). The mirrored outcome set is not drawn; the storyboard walks the decline-Ana path." },
  "w7.open-cycle-flow": { l: "Open cycle", to: "screen:W11@campaign-allocation", info: "Runs the §6.10 open-cycle flow (allocation → open) for this Seeded Campaign. The pool is already Open here, so the flow uses its campaign path — no Ready-pool guard (CS:114)." },
  "w7.compost-pool": { l: "Compost pool", info: "compostPool archives the closed pool; reopenPool starts the next era (§4.1). Not drawn past this point." },
  "w7.commitment-row": { l: "Commitment row", to: "screen:W10", info: "Opens the commitment dialog." },
  "w7.scope": { l: "Commitment scope", info: "Open · Confirmed · Past (uiux-spec §6.2 addendum). Composted cycles and settled records surface under Past; the old cycle-console “History:” row is retired. Maps to AdminFilterChip." },
  "w7.jump-confirm": { l: "Awaiting confirmation", info: "Scrolls to the commitments list scoped to promises waiting on a confirmation you can give." },
  "w7.jump-claims": { l: "Claims waiting", to: "screen:W7@claims", info: "Opens the steward-reviewed claims queue — a distinct triage task with its own view." },
  "w7.jump-payouts": { l: "Failed payouts", info: "Scrolls to declared rewards whose recorded payout failed; zero here means nothing is stuck." },
  "w7.report-row": { l: "Cycle report", to: "screen:W26@review", info: "Reconciliation report (UX:75)." },
  "w7.seed-fab": { l: "Seed a commitment", to: "screen:W8", info: "Console seeding — SeasonCampaign and steward-captured kinds exist only here (UX:150)." },
};

// ---------------------------------------------------------------------------
// W8 — seeding console (uiux-spec §6.3)
// ---------------------------------------------------------------------------

const W8_STATES = [
  ["step1", "1 · Type & scope"], ["step2", "2 · Requirements"], ["step3", "3 · Who confirms"],
  ["step4", "4 · Reward"], ["step5", "5 · Review"], ["captured-for", "Captured for a member"],
  ["discard", "Discard changes?"],
] as const;
type W8State = (typeof W8_STATES)[number][0];

// Rule and reward were one step carrying four decisions — confirmers, threshold,
// claim mode, and the reward rail with its amount. They are two concerns and
// they split cleanly.
const SEED_STEPS: FlowStep[] = [
  { title: "Type & scope", desc: "what the pool promises" },
  { title: "Requirements", desc: "units, target, and due" },
  { title: "Who confirms", desc: "confirmers and claim mode" },
  { title: "Reward", desc: "declared rail and amount" },
  { title: "Review", desc: "check it, then seed" },
];
// W9's two steps and W8@captured-for are one capture flow, so they share a rail.
export const CAPTURE_STEPS: FlowStep[] = [
  { title: "Who", desc: "the member you're recording for" },
  { title: "What kind", desc: "offer, request, or confirmation" },
  { title: "Record", desc: "check it, then record" },
];

const SEED_URL = "admin.greengoods.app/dashboard/garden/pool/seed";

function w8(state: W8State): string {
  if (state === "discard")
    return deskWin(
      SEED_URL,
      discardDialog(w7Behind(), "garden", "w8.keep-editing", "w8.discard-confirm", "This promise hasn't been seeded yet"),
    );

  if (state === "captured-for")
    return deskWin(
      "admin.greengoods.app/dashboard/garden/pool/capture",
      flowDialog(w7Behind(), "garden", {
        context: "Rocinha · recording for Kwame",
        title: "Record on a member's behalf",
        steps: CAPTURE_STEPS,
        current: 2,
        body: `${banner("Recording for Kwame — recorded by the steward, the promise stays the member's.", "stone", "hand-heart-line")}${kv("Kind", "Member offer · captured")}${kv("Title", "Compost workshop")}${kv("Reason", "recorded at the field gathering")}`,
        back: "w8.back-capture",
        cancelHot: "w8.cancel-capture",
        next: hot("w8.record", btn("Record it", { kind: "pri" })),
      }),
    );

  const order: W8State[] = ["step1", "step2", "step3", "step4", "step5"];
  const stepIx = order.indexOf(state);
  let inner: string;
  let next: string;
  switch (state) {
    case "step2":
      inner = `${field("Unit", input("hours", { select: true }))}${field("Target", input("12"))}${field("Action requirements", `<div class="arow"><div class="grow"><b>Prune</b> <span class="t-meta">Land stewardship</span></div>${input("2")}<span class="t-meta">approved works</span></div><div class="arow"><div class="grow"><b>Plant</b> <span class="t-meta">Land stewardship</span></div>${input("1")}<span class="t-meta">approved work</span></div>${hot("w8.add-action", btn("Add action", { kind: "ghost", sm: true, icon: "add-line" }))}`)}${field("Assessment required", radio([{ label: "No", on: true }, { label: "Yes — attach before confirmation" }]))}${field("Due", input("cycle deadline", { select: true }))}`;
      next = hot("w8.continue-requirements", btn("Continue", { kind: "pri" }));
      break;
    case "step3":
      inner = `${field("Confirmers", `<div class="arow"><div class="grow">Maria</div>${icon("close-line", "s")}</div><div class="arow"><div class="grow">João</div>${icon("close-line", "s")}</div>${hot("w8.add-address", btn("Add address", { kind: "ghost", sm: true, icon: "add-line" }))}`)}
${field("Threshold", input("2 of 2", { select: true }))}
${hot("w8.claim-mode", field("Claim mode", radio([{ label: "Open", meta: "anyone in the garden may take it up", on: true }, { label: "Steward-reviewed", meta: "requests wait for review" }], { interactive: true, name: "claim-mode" })))}`;
      next = hot("w8.continue-rule", btn("Continue", { kind: "pri" }));
      break;
    case "step4":
      inner = `${hot("w8.reward", field("Reward rail", radio([
  { label: "None", meta: "no declared reward" },
  { label: "External payout record", meta: "record a completed jar or treasury payout", on: true },
  { label: "Celo G$ settlement", meta: "queue delivery after fulfilment" },
], { interactive: true, name: "reward-rail" })))}
${field("External reward", `<div class="arow"><div class="grow">${input("Garden jar", { select: true })}</div><div class="grow">${input("20 DAI")}</div></div>`)}
${banner("One rail only. External payout records are recorded here after the fact; Celo G$ rewards are queued for delivery from the owning-pool account.", "stone")}`;
      next = hot("w8.continue-reward", btn("Continue", { kind: "pri" }));
      break;
    case "step5":
      inner = `${kv("Kind", "Garden work · the pool requests")}${kv("Title", "Restore the north beds")}${kv("Unit · target", "hours · 12")}${kv("Action requirements", "Prune × 2 · Plant × 1")}${kv("Confirmers", "named group · 2 of 2")}${kv("Claim mode", "steward-reviewed")}${kv("Reward rail", "External payout record")}${kv("Reward", "20 DAI · garden jar · reference only")}`;
      next = hot("w8.seed", btn("Seed this commitment", { kind: "pri" }));
      break;
    default:
      inner = `${field("Type", radio([{ label: "Season / campaign promise", meta: "the pool offers or requests", on: true }, { label: "Support / service" }, { label: "Garden work (impact)" }, { label: "Capture for a member" }]))}
${field("Direction", radio([{ label: "The pool offers", on: true }, { label: "The pool requests" }]))}
${field("Cycle", input("Season: First Rains", { select: true }))}${field("Title", input("Market rides"))}`;
      next = hot("w8.continue-scope", btn("Continue", { kind: "pri" }));
  }
  return deskWin(
    SEED_URL,
    flowDialog(w7Behind(), "garden", {
      context: "Rocinha · Season of First Rains",
      title: "Seed a commitment",
      steps: SEED_STEPS,
      current: stepIx,
      body: inner,
      back: stepIx > 0 ? `w8.back-step${stepIx}` : undefined,
      cancelHot: "w8.cancel",
      next,
    }),
  );
}

const W8_HOTS: HifiDef["hots"] = {
  "w8.add-action": { l: "Add action requirement", info: "Adds another approved-work requirement to the seeded promise." },
  "w8.add-address": { l: "Add confirmer address", info: "Adds another named confirmer before the threshold is locked." },
  "w8.claim-mode": { l: "Claim mode", info: "Set at seeding; prefilled by context — protocol pool gated, garden campaigns open." },
  "w8.reward": { l: "Reward rail", info: "Exactly one rail is declared: none, an external payout record, or a Celo G$ settlement. External rewards are references only; G$ uses the settlement module." },
  "w8.continue-scope": { l: "Continue to requirements", to: "screen:W8@step2", info: "Type and scope → requirements." },
  "w8.continue-requirements": { l: "Continue to the confirmation rule", to: "screen:W8@step3", info: "Requirements → who confirms and how it is claimed." },
  "w8.continue-rule": { l: "Continue to reward", to: "screen:W8@step4", info: "Confirmation rule → the declared reward rail." },
  "w8.continue-reward": { l: "Continue to review", to: "screen:W8@step5", info: "Reward → final review." },
  "w8.back-step1": { l: "Back to type and scope", to: "screen:W8", info: "Steps back with everything entered so far retained." },
  "w8.back-step2": { l: "Back to requirements", to: "screen:W8@step2", info: "Steps back with everything entered so far retained." },
  "w8.back-step3": { l: "Back to the confirmation rule", to: "screen:W8@step3", info: "Steps back with everything entered so far retained." },
  "w8.back-step4": { l: "Back to reward", to: "screen:W8@step4", info: "Steps back with everything entered so far retained." },
  "w8.back-capture": { l: "Back to capture kind", to: "screen:W9@capture-kind", info: "Steps back to the capture kind without discarding the chosen member." },
  "w8.cancel": { l: "Cancel seeding", to: "screen:W8@discard", info: "A dirty flow confirms before discarding — the shared useDirtyClose / DiscardChangesDialog guard." },
  "w8.cancel-capture": { l: "Cancel capture", to: "screen:W9@discard", info: "The capture flow's own discard guard — Keep editing returns to the capture flow, not the seed console." },
  "w8.record": { l: "Record the captured promise", to: "screen:W7", info: "OperatorCaptured create — the member stays the social source; the steward is recorded as recordedBy (CS:730)." },
  "w8.keep-editing": { l: "Keep editing", to: "screen:W8", info: "Returns to the flow with entered values intact." },
  "w8.discard-confirm": { l: "Discard", to: "screen:W7", info: "Leaves the flow and drops the unsaved seeded promise." },
  "w8.seed": { l: "Seed this commitment", to: "screen:W7", info: "Console seeding — season/campaign and steward-captured kinds are created only here (UX:150)." },
};

// ---------------------------------------------------------------------------
// W9 — analog capture (uiux-spec §6.5)
// ---------------------------------------------------------------------------

const W9_STATES = [["pick-member", "Who"], ["capture-kind", "What kind"], ["discard", "Discard changes?"]] as const;
type W9State = (typeof W9_STATES)[number][0];

function w9(state: W9State): string {
  if (state === "discard")
    return deskWin(
      "admin.greengoods.app/dashboard/garden/pool/capture",
      discardDialog(w7Behind(), "garden", "w9.keep-editing", "w9.discard-confirm", "This record hasn't been saved yet"),
    );
  const pick = state === "pick-member";
  const inner = pick
    ? `${hot("w9.member", field("Member", input("Search members…", { placeholder: true, icon: "search-line" })))}
<div class="arow"><div class="grow"><b>Kwame</b> <span class="t-meta">joined May · 4 promises kept</span></div>${hot("w9.choose", btn("Choose", { kind: "sec", sm: true }))}</div>`
    : hot("w9.kind", field("Capture", radio([{ label: "Their offer", on: true }, { label: "Their request" }, { label: "A confirmation", meta: "always carries a reason" }], { interactive: true, name: "capture-kind" })));
  return deskWin(
    "admin.greengoods.app/dashboard/garden/pool/capture",
    flowDialog(w7Behind(), "garden", {
      context: "Rocinha · on a member's behalf",
      title: "Record on a member's behalf",
      steps: CAPTURE_STEPS,
      current: pick ? 0 : 1,
      body: `${banner(
        "“Recorded by your steward on your behalf. The promise stays yours.” — the member sees exactly this.",
        "stone",
        "hand-heart-line",
      )}${inner}`,
      back: pick ? undefined : "w9.back",
      cancelHot: "w9.cancel",
      // Choosing the member is the advance on step one, so the footer's forward
      // action stays disabled until one is picked.
      next: pick ? btn("Continue", { kind: "pri", disabled: true }) : hot("w9.continue", btn("Continue", { kind: "pri" })),
    }),
  );
}

const W9_HOTS: HifiDef["hots"] = {
  "w9.member": { l: "Pick the member", info: "The member is the social source; the steward is only the recorder (UX:437)." },
  "w9.choose": { l: "Choose Kwame", to: "screen:W9@capture-kind", info: "Selects Kwame as the member whose offer, request, or confirmation is being recorded." },
  "w9.kind": { l: "Capture kind", info: "Captured confirmations always carry a reason (UX:291)." },
  "w9.continue": { l: "Continue to captured promise", to: "screen:W8@captured-for", info: "Carries the selected member and capture kind into the seeding review." },
  "w9.back": { l: "Back to member", to: "screen:W9", info: "Steps back to the member picker with the chosen member retained." },
  "w9.cancel": { l: "Cancel capture", to: "screen:W9@discard", info: "A dirty flow confirms before discarding — the shared useDirtyClose / DiscardChangesDialog guard, scoped to this flow." },
  "w9.keep-editing": { l: "Keep editing", to: "screen:W9", info: "Returns to the capture flow with the entered values intact." },
  "w9.discard-confirm": { l: "Discard", to: "screen:W7", info: "Leaves the capture flow and drops the unsaved record." },
};

// ---------------------------------------------------------------------------
// W10 — commitment dialog (uiux-spec §6.2/§6.7; MF13 dissolved)
// ---------------------------------------------------------------------------

const W10_STATES = [
  ["detail", "Detail"], ["fulfilled", "Fulfilled — reward unpaid"],
  ["record-payout", "Record payout"], ["queue-settlement", "Queue Celo settlement"],
  ["fallback-confirm", "Fallback confirm"],
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
  detail: "Prune the north beds", fulfilled: "Prune the north beds",
  accepted: "Prune the north beds", "record-payout": "Record payout",
  "queue-settlement": "Queue Celo settlement",
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
      body = `${kv("Reward rail", "External payout record")}${kv("Declared reward", "20 DAI · garden jar")}${field("Rail reference", input("cookie-jar withdrawal #128"))}${banner("Records that the external reward moved outside the app — no value moves here. Celo G$ rewards are delivered by the settlement queue instead.", "stone")}`;
      actions = `${dismiss()}${hot("w10.payout-confirm", btn("Record payout", { kind: "pri" }))}`;
      break;
    case "queue-settlement":
      body = `${kv("Reward rail", "Celo G$ settlement")}${kv("Declared reward", "500 G$")}${kv("Payer", "Rocinha owning-pool Safe · Celo")}${kv("Recipient", "Maria · same-address AA")}${banner("Queueing snapshots the canonical G$ amount, owning-pool source, recipient, route, version, and gas limit. Record payout is unavailable for this rail.", "stone")}`;
      actions = `${dismiss()}${hot("w10.queue-settlement-confirm", btn("Queue disbursement", { kind: "pri" }))}`;
      break;
    case "fallback-confirm":
      body = `${field("Reason (required)", input("confirmed on site visit"))}${banner("Steward fallback confirmation — the provider's own address is blocked, always. The member timeline shows this as a steward record.", "stone", "shield-check-line")}`;
      actions = `${dismiss()}${hot("w10.fallback-confirm", btn("Confirm as fallback", { kind: "pri" }))}`;
      break;
    case "raise-dispute":
      body = `${field("Reason (required)", input("delivery contested at the gathering"))}${banner("Freezes the promise for review. Members see “under review by stewards” — never dispute language.", "stone")}`;
      actions = `${dismiss()}${hot("w10.dispute-confirm", btn("Raise dispute", { kind: "pri" }))}`;
      break;
    case "resolve-dispute":
      body = `${field("Outcome", hot("w10.resolve-options", radio([{ label: "Restore previous state", meta: "returns the exact stored state — no unit movement", on: true }, { label: "Fulfilled" }, { label: "Cancelled" }, { label: "Expired" }], { interactive: true, name: "resolution" })))}${field("Reason (required)", input("resolved at the weekly gathering"))}${banner("An Expired prior state can never resolve to Fulfilled. Every outcome renders its reason in the member timeline.", "stone")}`;
      actions = `${dismiss()}${hot("w10.resolve", btn("Resolve", { kind: "pri" }))}`;
      break;
    case "attach-assessment":
      body = `${field("Assessment", hot("w10.assessment-pick", radio([{ label: "Baseline — AGRO — Jul 2", meta: "v3 · provider garden", on: true }, { label: "Delta — AGRO+EDU — Jul 9", meta: "v3" }], { interactive: true, name: "assessment" })))}${banner("Only current assessments recorded for the provider garden appear here.", "stone")}`;
      actions = `${dismiss()}${hot("w10.attach", btn("Attach", { kind: "pri" }))}`;
      break;
    case "accepted":
      // Evidence-only, pre-ready: the Send-for-confirmation / Mark-ready-override
      // twin (UX:294) plus the steward cancel (MF-2b).
      // Footer is dismissive + confirming only (M3 basic dialog). The two
      // alternatives sit in the body beside the consequence that distinguishes
      // them: an irreversible cancel must never occupy the left footer slot,
      // which means "close this dialog" in every other W10 state — and the
      // sentence that separates the three used to sit below the fold.
      body = `${cmChips(chip("Offer", "offer"), chip("Accepted", "request", { dot: true }), chip("Evidence in", "warn", { dot: true }))}
${banner("Evidence is in. Send it to the recipient, who confirms the promise was kept.", "stone")}
${kv("Maria → João", "6 hours · due Aug 12")}
${stages(["Offered", "Accepted", "Evidence in", "Ready", "Fulfilled"], 2)}
${kv("Kind", "Support · evidence-only")}${kv("Evidence", "2 items · photo, note")}${kv("Provider", "Maria — cannot confirm")}
<div class="arow"><div class="grow"><b>Recipient can't confirm?</b> <span class="t-meta">A steward can mark it ready with a recorded reason.</span></div>${hot("w10.mark-override", btn("Mark ready…", { kind: "sec", sm: true }))}</div>
<div class="arow"><div class="grow"><b>Called off?</b> <span class="t-meta">Cancelling releases the committed units and records why.</span></div>${hot("w10.cancel", btn("Cancel promise…", { kind: "danger", sm: true }))}</div>`;
      actions = `${dismiss()}${hot("w10.send-confirmation", btn("Send for confirmation", { kind: "pri" }))}`;
      break;
    case "mark-ready-override":
      body = `${field("Reason (required)", input("field-verified at the weekly gathering"))}${banner("Steward override — separate from Send for confirmation. Moves the promise to Ready without the recipient's send; the reason is stored and shows in the member timeline.", "stone", "shield-check-line")}`;
      actions = `${dismiss()}${hot("w10.override-confirm", btn("Mark ready", { kind: "pri" }))}`;
      break;
    case "cancel":
      body = `${field("Reason (required)", input("withdrawn by agreement at the gathering"))}${banner("Steward cancel — Accepted becomes Cancelled with a recorded reason. Committed units release; the member sees the reason, never “cancelled” alone.", "stone", "error-warning-line")}`;
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
    case "fulfilled":
      // Recording a payout is a Fulfilled-only act (uiux-spec §6.7). Giving it
      // its own state keeps it off the Ready detail and makes sb10's declared
      // "Fulfilled" step show a screen that agrees with the caption.
      body = `${cmChips(chip("Offer", "offer"), chip("Fulfilled", "ok", { dot: true }))}
${kv("Maria → João", "6 hours · due Aug 12")}
${stages(["Offered", "Accepted", "Work linked", "Ready", "Fulfilled"], 4)}
${kv("Confirmed", "João · Jul 12 · 2 of 2")}${kv("Provider", "Maria — cannot confirm")}
${kv("Reward rail", "External payout record")}${kv("Reward", "20 DAI · garden jar · unpaid")}
${banner("The reward moved, or will move, outside the app. Recording it here stores the rail reference only.", "stone")}`;
      actions = `${dismiss("Close")}${hot("w10.record-payout", btn("Record payout", { kind: "pri" }))}`;
      break;
    default:
      body = `${cmChips(chip("Offer", "offer"), chip("Ready", "warn", { dot: true }))}
${kv("Maria → João", "6 hours · due Aug 12 · open claim")}
${stages(["Offered", "Accepted", "Work linked", "Ready", "Fulfilled"], 3)}
${kv("Evidence", "2 items · photo, note")}${kv("Linked work", "Pruning session (approved)")}${kv("Provider", "Maria — cannot confirm")}${kv("Eligible", "João ✓ · Ana ○ · you ○ (1 of 2 required)")}
${kv("Reward rail", "External payout record")}${kv("Reward", "20 DAI · garden jar · unpaid — recordable once confirmed")}`;
      // An inspection state legitimately has no dominant act, but it still needs
      // a way out that is not the X: both remaining controls open further
      // dialogs, so neither can double as the dismiss.
      actions = `${dismiss("Close")}${hot("w10.fallback", btn("Confirm as fallback…", { kind: "sec" }))}${hot("w10.raise", btn("Raise dispute…", { kind: "sec" }))}`;
  }
  return deskWin(
    "admin.greengoods.app/dashboard/garden/pool",
    adminDialogM3(w10Behind(), "garden", { title: W10_TITLE[state], body, actions, closeHot: "w10.dismiss" }),
  );
}

const W10_HOTS: HifiDef["hots"] = {
  "w10.record-payout": { l: "Record payout", to: "screen:W10@record-payout", info: "ArbitrumExternal only: AdminConfirmDialog captures the executed rail reference → RewardPaid; no value moves here." },
  "w10.payout-confirm": { l: "Record payout (confirm)", to: "screen:W2@reward-released", info: "ArbitrumExternal only: recordRewardPaid → RewardPaid; the dry run rehearses this with a real minimal Cookie Jar withdrawal (register #34h)." },
  "w10.queue-settlement-confirm": { l: "Queue disbursement", to: "screen:W21", info: "CeloSettlement only: queueDisbursement snapshots the owning-pool Safe source and canonical G$ delivery facts." },
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
  "w10.cancel-confirm": { l: "Cancel promise (confirm)", to: "screen:W2@cancelled", info: "Accepted → Cancelled with a recorded reason; units release; lands on the member view whose timeline carries the reason (CS:745) — the same member-echo convention as every other W10 act." },
  "w10.dismiss": { l: "Close dialog", to: "screen:W10", info: "Closes without applying the pending steward action." },
  "w10.retry": { l: "Retry promise read", to: "screen:W10", info: "Retries the promise read; the sentinel state never renders as a lifecycle chip." },
  "w10.back-pool": { l: "Back to pool", to: "screen:W7", info: "Returns to the scoped garden pool after a missing record." },
};

// ---------------------------------------------------------------------------
// W11 — open-cycle allocation policy (uiux-spec §6.10)
// ---------------------------------------------------------------------------

const W11_STATES = [
  ["presets", "Presets"], ["invalid-sum", "Invalid sum"], ["guard", "Pool is Ready — open it?"],
  ["campaign-allocation", "Campaign · allocation"], ["campaign-open", "Campaign · open"],
  ["discard", "Discard changes?"], ["campaign-discard", "Campaign · discard changes?"],
] as const;
type W11State = (typeof W11_STATES)[number][0];

// Allocation is a step inside the open-cycle flow (uiux-spec §6.10), and the
// flow adds the locked "pool is Ready — open it now?" guard before it opens
// (register #34a).
const CYCLE_STEPS: FlowStep[] = [
  { title: "Allocation", desc: "how each promise's units split" },
  { title: "Open", desc: "check the pool, then open" },
];

// Two entry contexts, because the guard prompt is only TRUE from one of them.
// The season path runs from a Ready pool (sb9a), where opening the cycle opens
// the pool with it. The campaign path runs from the Cycles console of a pool
// that is ALREADY Open, so it must not claim the pool is merely Ready — and it
// names the campaign, not the Season, in its context line.
const w11IsCampaign = (state: W11State) => state.startsWith("campaign");
const W11_CONTEXT = (state: W11State) =>
  w11IsCampaign(state) ? "Rocinha · Seedling swap (Campaign)" : "Rocinha · Season of First Rains";

function w11(state: W11State): string {
  if (state === "discard" || state === "campaign-discard")
    return deskWin(
      "admin.greengoods.app/dashboard/garden/pool/open-cycle",
      discardDialog(
        w7Behind(),
        "garden",
        state === "campaign-discard" ? "w11.campaign-keep-editing" : "w11.keep-editing",
        state === "campaign-discard" ? "w11.campaign-discard-confirm" : "w11.discard-confirm",
        "This cycle hasn't been opened yet",
      ),
    );
  if (state === "guard" || state === "campaign-open") {
    const campaign = state === "campaign-open";
    const body = campaign
      ? `${banner("The pool is already open, so opening this campaign only starts the campaign — it runs alongside the open Season.", "stone", "information-line")}${kv("Pool", "Open")}${kv("Cycle", "Seedling swap · Campaign")}${kv("Runs alongside", "Season of First Rains")}${kv("Allocation", "Gardeners 60 · Treasury 15 · Steward 10 · Evaluator 5 · Community 5 · Funder 5")}`
      : `${banner("This pool is Ready but not yet Open. Opening the cycle opens the pool with it, so members can see and make promises straight away.", "amber", "information-line")}${kv("Pool", "Ready — not yet open")}${kv("Cycle", "Season of First Rains")}${kv("Allocation", "Gardeners 60 · Treasury 15 · Steward 10 · Evaluator 5 · Community 5 · Funder 5")}`;
    return deskWin(
      "admin.greengoods.app/dashboard/garden/pool/open-cycle",
      flowDialog(w7Behind(), "garden", {
        context: W11_CONTEXT(state),
        title: "Open cycle",
        steps: CYCLE_STEPS,
        current: 1,
        body,
        back: campaign ? "w11.campaign-back" : "w11.back",
        cancelHot: campaign ? "w11.campaign-cancel" : "w11.cancel",
        next: campaign
          ? hot("w11.campaign-open-cycle", btn("Open campaign", { kind: "pri" }))
          : hot("w11.open-cycle", btn("Open pool and cycle", { kind: "pri" })),
      }),
    );
  }

  const bad = state === "invalid-sum";
  const rows = [
    ["Gardeners", bad ? "64" : "60"], ["Treasury", "15"], ["Steward", "10"],
    ["Evaluator", "5"], ["Community", "5"], ["Funder", "5"],
  ]
    .map(([l, v], i) => `<div class="arow"><div class="grow" id="a${i}">${l}</div>${input(v, { labelledBy: `a${i}` })}<span class="t-meta">%</span></div>`)
    .join("");
  const sum = bad
    ? banner("Shares must total exactly 100% — currently 104%.", "error", "error-warning-line")
    : `<div class="quietok">${icon("check-line")}total: 100%</div>`;
  const inner = `<div class="t-meta">Set how each fulfilled promise's units split across the six roles.</div>
${hot("w11.presets", field("Preset", radio([{ label: "Garden-led (default)", on: true }, { label: "Balanced" }, { label: "Custom" }], { interactive: true, name: "allocation-preset" })))}
${rows}${sum}
${banner("Treasury is at the 15% guidance floor. This split is locked when the cycle opens and reads back unchanged at close.", "stone")}`;
  const campaign = w11IsCampaign(state);
  return deskWin(
    "admin.greengoods.app/dashboard/garden/pool/open-cycle",
    flowDialog(w7Behind(), "garden", {
      context: W11_CONTEXT(state),
      title: "Open cycle",
      steps: CYCLE_STEPS,
      current: 0,
      body: inner,
      cancelHot: campaign ? "w11.campaign-cancel" : "w11.cancel",
      next: bad
        ? btn("Continue", { kind: "pri", disabled: true })
        : campaign
          ? hot("w11.campaign-continue", btn("Continue", { kind: "pri" }))
          : hot("w11.continue", btn("Continue", { kind: "pri" })),
    }),
  );
}

const W11_HOTS: HifiDef["hots"] = {
  "w11.presets": { l: "Allocation presets", info: "Presets prefill an editable percent editor; the protocol allocation class renders as “steward” (Decision Log #28c)." },
  "w11.continue": { l: "Continue to open", to: "screen:W11@guard", info: "Allocation → the open step, which carries the Ready-pool guard prompt." },
  "w11.back": { l: "Back to allocation", to: "screen:W11", info: "Steps back to the six-role split with the entered values retained." },
  "w11.cancel": { l: "Cancel open-cycle", to: "screen:W11@discard", info: "A dirty flow confirms before discarding — the shared useDirtyClose / DiscardChangesDialog guard, scoped to this flow." },
  "w11.keep-editing": { l: "Keep editing", to: "screen:W11", info: "Returns to the allocation editor with the entered shares intact." },
  "w11.discard-confirm": { l: "Discard", to: "screen:W7", info: "Leaves the open-cycle flow; the cycle stays Seeded." },
  "w11.open-cycle": { l: "Open pool and cycle", to: "screen:W7", info: "openCycle(cycleId, allocation) validates, stores, and emits the complete six-class snapshot; the shares must total 100% (UX:322-330). The Ready-pool guard opens the pool with the cycle (register #34a)." },
  // Campaign path — same flow from an already-Open pool, so no guard prompt.
  "w11.campaign-continue": { l: "Continue to open", to: "screen:W11@campaign-open", info: "Allocation → the open step. The pool is already Open, so this step opens only the campaign." },
  "w11.campaign-back": { l: "Back to allocation", to: "screen:W11@campaign-allocation", info: "Steps back to this campaign's six-role split with the entered values retained." },
  "w11.campaign-cancel": { l: "Cancel open-cycle", to: "screen:W11@campaign-discard", info: "A dirty flow confirms before discarding; Keep editing returns to the campaign flow, not the Season one." },
  "w11.campaign-keep-editing": { l: "Keep editing", to: "screen:W11@campaign-allocation", info: "Returns to the campaign allocation editor with the entered shares intact." },
  "w11.campaign-discard-confirm": { l: "Discard", to: "screen:W7", info: "Leaves the flow; the campaign stays Seeded." },
  "w11.campaign-open-cycle": { l: "Open campaign", to: "screen:W7", info: "openCycle(cycleId, allocation) on a pool that is already Open — any number of Campaigns may run concurrently beside the one Season (UX:66 · CS:114)." },
};

// ---------------------------------------------------------------------------
// W13 — Hub Confirm stage (+ W13b context chip) (uiux-spec §6.9)
// ---------------------------------------------------------------------------

const W13_STATES = [
  ["queue", "Confirm queue"], ["context-chip", "Work card chip (W13b)"], ["assess", "Assess stage"], ["empty", "Nothing to confirm"],
] as const;
type W13State = (typeof W13_STATES)[number][0];

// Hub workspace real rail: Work · Assess · Certify · History; Confirm is net-new.
const hubRail = (activeIx: number) =>
  tabRail(
    [{ label: "Work", count: 3 }, { label: "Assess", count: 1 }, { label: "Certify", count: 2 }, { label: "Confirm", count: 2 }, { label: "History" }],
    activeIx,
  );

function w13(state: W13State): string {
  const rail = hubRail(state === "context-chip" ? 0 : state === "assess" ? 1 : 3);
  let inner: string;
  if (state === "assess") {
    // The Hub's Assess stage — the route the assessment flow opens over, so
    // leaving that flow has a real place to land instead of the Confirm tab.
    inner = acard(
      "Assess",
      `<div class="arow"><div class="grow"><b>Season of First Rains</b> <span class="t-meta">1 assessment waiting</span></div>${chip("Baseline recorded", "ok", { dot: true })}</div>
<div class="arow"><div class="grow">Awka Hub · delta <span class="t-meta">evaluator-hat only</span></div>${chip("Waiting", "warn", { dot: true })}</div>
<div class="actrow">${hot("w13.new-assessment", btn("Create assessment", { kind: "pri", sm: true, icon: "add-line" }))}</div>`,
    );
  } else if (state === "empty") {
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
${banner("Work cards show which promise they fulfil; the approval rails are unchanged.", "stone")}`,
    );
  } else {
    inner = acard(
      "Confirm queue",
      `<div class="t-meta">Promises where you are named, or fallback-eligible.</div>
<div class="arow"><div class="grow">${hot("w13.row", `<b>Maria — Prune the north beds</b>`)} <span class="t-meta">Rocinha</span></div>${meter(66, { right: "2 of 3" })}</div>
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
  "w13.new-assessment": { l: "Create assessment", to: "screen:W14", info: "Opens the existing Create Assessment flow, which §6.6 extends rather than forks." },
  "w13.approve": { l: "Approve work", info: "Uses the existing WorkApproval rail; the context chip only links this work back to its promise." },
  "w13.reject": { l: "Reject work", info: "Uses the existing work-rejection rail with its normal reason capture." },
};

// ---------------------------------------------------------------------------
// W14 — assessment v3 additions (uiux-spec §6.6)
// ---------------------------------------------------------------------------

const W14_STATES = [["baseline", "Baseline"], ["delta", "Re-assessment (delta)"], ["discard", "Discard changes?"]] as const;
type W14State = (typeof W14_STATES)[number][0];

// The REAL Create Assessment rail (useCreateAssessmentController stepConfigs) —
// §6.6 is "extend, not fork": the v3 additions are two fields on the existing
// first step, so the rail must draw the shipping steps, not invented ones.
const ASSESS_STEPS: FlowStep[] = [
  { title: "Domain & Context", desc: "domain selection, title, and location" },
  { title: "Strategy Kernel", desc: "diagnosis, outcomes, and complexity" },
  { title: "Actions & Harvest", desc: "select actions and reporting period" },
];

// Dimmed Hub route behind the assessment flow, hotspot-free.
const hubBehind = () =>
  adminCanvas("hub", "hub", {
    screenId: "W14",
    garden: "Rocinha",
    interactiveChrome: false,
    header: pageHeader({ title: "Hub", description: "Review and confirm work flowing through your gardens." }),
    tabRail: hubRail(1),
    body: acard("Assess", kv("Season of First Rains", "1 assessment waiting")),
  });

function w14(state: W14State): string {
  if (state === "discard")
    return deskWin(
      "admin.greengoods.app/dashboard/hub/assess",
      discardDialog(hubBehind(), "hub", "w14.keep-editing", "w14.discard-confirm", "This assessment hasn't been recorded yet"),
    );
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
  // The existing Create Assessment flow already runs in a flow AdminDialog
  // (uiux-spec §6.6); the v3 additions are two extra fields on its first step,
  // not a new surface.
  const inner = `${field("Cycle", input("Season of First Rains", { select: true }))}${field("Assessment kind", kindRadio)}${extra}`;
  return deskWin(
    "admin.greengoods.app/dashboard/hub/assess",
    flowDialog(hubBehind(), "hub", {
      context: "Rocinha · assessment",
      title: "Create assessment",
      steps: ASSESS_STEPS,
      current: 0,
      body: inner,
      cancelHot: "w14.cancel",
      next: hot("w14.continue", btn("Continue", { kind: "pri" })),
    }),
  );
}

const W14_HOTS: HifiDef["hots"] = {
  "w14.kind": { l: "Assessment kind", info: "Baseline: evaluator or steward. Delta: Evaluator Hat only (CS:760-761)." },
  "w14.continue": { l: "Continue assessment", info: "Continues into the existing assessment evidence and scoring steps." },
  "w14.cancel": { l: "Cancel assessment", to: "screen:W14@discard", info: "A dirty flow confirms before discarding — the shared useDirtyClose / DiscardChangesDialog guard, scoped to this flow." },
  "w14.keep-editing": { l: "Keep editing", to: "screen:W14", info: "Returns to the assessment flow with the entered values intact." },
  "w14.discard-confirm": { l: "Discard", to: "screen:W13@assess", info: "Leaves the assessment flow and returns to the Hub Assess stage the flow opened over — not the Confirm stage." },
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
${banner("Existing Work stage — approval rails untouched.", "stone")}`,
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
    states: W7_STATES.map(([id, label]) => ({ id, label, html: w7(id) })) }, hots: { ...adminChromeHots("w7", "garden"), ...W7_HOTS } },
  { screen: { id: "W8", title: "W8 · Seeding console", surface: "admin", frame: "desktop", group: "Admin console",
    states: W8_STATES.map(([id, label]) => ({ id, label, html: w8(id) })) }, hots: W8_HOTS },
  { screen: { id: "W9", title: "W9 · Analog capture", surface: "admin", frame: "desktop", group: "Admin console",
    states: W9_STATES.map(([id, label]) => ({ id, label, html: w9(id) })) }, hots: W9_HOTS },
  { screen: { id: "W10", title: "W10 · Commitment dialog (admin)", surface: "admin", frame: "desktop", group: "Admin console",
    states: W10_STATES.map(([id, label]) => ({ id, label, html: w10(id) })) }, hots: W10_HOTS },
  { screen: { id: "W11", title: "W11 · Open-cycle allocation", surface: "admin", frame: "desktop", group: "Admin console",
    states: W11_STATES.map(([id, label]) => ({ id, label, html: w11(id) })) }, hots: W11_HOTS },
  { screen: { id: "W13", title: "W13 · Hub Confirm stage", surface: "admin", frame: "desktop", group: "Admin console",
    states: W13_STATES.map(([id, label]) => ({ id, label, html: w13(id) })) }, hots: { ...adminChromeHots("w13", "hub"), ...W13_HOTS } },
  { screen: { id: "W14", title: "W14 · Assessment v3 additions", surface: "admin", frame: "desktop", group: "Admin console",
    states: W14_STATES.map(([id, label]) => ({ id, label, html: w14(id) })) }, hots: W14_HOTS },
  { screen: { id: "HUBWORK", title: "Existing Hub Work stage", surface: "admin", frame: "desktop", group: "Admin console",
    states: [{ id: "approve", label: "Approve", html: hubwork() }] }, hots: { ...adminChromeHots("hubwork", "hub"), ...HUBWORK_HOTS } },
];
