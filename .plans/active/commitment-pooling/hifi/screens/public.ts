// Editorial hi-fi screens — W15 garden commitments section (/gardens/:id), W16
// /impact commitments band. Public-website dialect (.s-editorial): Fraunces-stack
// serif headlines, mono uppercase kickers, sharp editorial panels. Boundaries per
// uiux-spec §7.4: read-only, aggregate-only — no rankings, no participant data,
// no addresses tied to commitment outcomes; percentage rates only at ≥5 due
// commitments and ≥3 distinct providers, counts-only sentences below that (§7.2).
//
// `/gardens/:id` is a page, not a dialog (2026-08-19, Decision Log #161). The
// surrounding stubs draw the real section ladder so the § 02 slot is legible in
// context: § 01 field notes above, § 03 certificates below.
// Every section on that page always renders, which is why W15 has an `empty` and
// a `pre-launch` state rather than simply disappearing.

import {
  CYCLE,
  FINISHED_CYCLES,
  POOL_LIFETIME,
  POOL_LIFETIME_KEPT_RATE,
  POOL_RECORD_LIVE,
  POOL_RECORD_LIVE_KEPT_RATE,
  PRIOR_CYCLES,
  SEASON_LIVE,
} from "../fixtures";
import { hot } from "../html";
import { icon } from "../icons";
import type { HifiDef } from "./index";

// SiteHeader (client/src/components/Navigation/SiteHeader.tsx): logo + nav
// (Gardens · Impact · Fund · Actions) + Install CTA. Transparent over the hero
// in the real app; these editorial sections sit below it.
const NAV: [string, string][] = [["gardens", "Gardens"], ["impact", "Impact"], ["fund", "Fund"], ["actions", "Actions"]];
const siteHeader = (active: string, installHot: string) =>
  `<div class="sitehdr"><span class="brand">${icon("seedling-line", "s")}Green Goods</span><nav>${NAV.map(
    ([id, l]) => `<a class="${id === active ? "on" : ""}">${l}</a>`,
  ).join("")}</nav>${hot(installHot, `<button type="button" class="install">Install App</button>`)}</div>`;

const webWin = (url: string, body: string, installHot: string) => {
  const active = url.includes("/impact") ? "impact" : url.includes("/gardens") ? "gardens" : "";
  return `<div class="webwin"><div class="winbar"><span class="dots"><i></i><i></i><i></i></span><span class="url">${url}</span></div>${siteHeader(active, installHot)}<div class="webbody">${body}</div></div>`;
};

/** A neighbouring page section, drawn flat so the § 02 slot reads in context. */
const stub = (label: string, note: string) =>
  `<div class="t-meta" style="color:var(--stone);font-size:13px"><span class="kicker">${label}</span> <span>${note}</span></div>`;

// ---------------------------------------------------------------------------
// W15 — garden commitments section (uiux-spec §7.1)
// ---------------------------------------------------------------------------

const W15_STATES = [
  ["record", "The record"], ["counts-only", "Counts only"], ["between-seasons", "Between seasons"],
  ["paused", "Paused"], ["pre-launch", "Pre-launch"], ["empty", "No commitments yet"],
  ["loading", "Loading"], ["read-error", "Read error"],
] as const;
type W15State = (typeof W15_STATES)[number][0];

const TIE_IN = `Fulfilled commitments from these seasons are anchored in the certificates below.`;
const KICKER = `<span class="kicker">§ 02: Commitments</span>`;

/** Lifetime made / kept, with the one sanctioned percentage when it is publishable. */
const recordRow = (
  record: { made: number; kept: number },
  keptRate: number | null,
) =>
  `<div class="estatrow"><div class="estat"><div class="serif-n">${record.made}</div><div class="l">commitments made</div></div><div class="estat"><div class="serif-n">${record.kept}</div><div class="l">kept</div></div>${
    keptRate !== null
      ? hot("w15.rate", `<div class="estat"><div class="serif-n">${keptRate}%</div><div class="l">kept rate</div></div>`)
      : ""
  }</div>`;

/** The current chapter. Counts and exact-label unit rows, never a percentage. */
const liveCycle = () =>
  `<div class="ecycle"><div class="t-meta"><b>${CYCLE}</b> · season · runs through Aug 30</div>
<div class="t-meta num">${SEASON_LIVE.made} made · ${SEASON_LIVE.kept} kept so far</div>
${hot("w15.units", `<div class="eunits"><div class="erow"><span>Hours</span><span class="num">${SEASON_LIVE.units.hours.done} of ${SEASON_LIVE.units.hours.of}</span></div><div class="erow"><span>Rides</span><span class="num">${SEASON_LIVE.units.rides.done} of ${SEASON_LIVE.units.rides.of}</span></div></div>`)}</div>`;

/** Finished cycles, newest first. Campaigns sit beside seasons (§4.2). */
const seasonRows = (
  cycles: readonly {
    name: string;
    type: string;
    window: string;
    made: number;
    kept: number;
  }[] = PRIOR_CYCLES,
) =>
  hot(
    "w15.rows",
    `<div class="ecycle"><div class="kicker">Earlier seasons and campaigns</div><div class="eunits">${cycles.map(
      (c) =>
        `<div class="erow"><span>${c.name} · ${c.type} · ${c.window}</span><span class="num">${c.kept} of ${c.made} kept</span></div>`,
    ).join("")}</div></div>`,
  );

function w15(state: W15State): string {
  const context = `${stub("§ 01: Field notes", "photo grid, 12 of 128 shown")}<hr class="erule">`;
  // § 04 (the people who tend the garden) is deliberately not stubbed: the
  // shipped page still heads it "Operators", which this dialect retired
  // (Decision Log #28c), and renaming it belongs to PRD-746-751, not here.
  const after = `<hr class="erule">${stub("§ 03: Certificates", "existing list")}`;
  let panel: string;
  switch (state) {
    case "record":
      panel = `${KICKER}
<h3 class="serif-h">${POOL_RECORD_LIVE.seasons} seasons of commitments</h3>
${recordRow(POOL_RECORD_LIVE, POOL_RECORD_LIVE_KEPT_RATE)}
${liveCycle()}
${seasonRows()}
<p style="margin:0;max-width:52ch;color:var(--stone)">${TIE_IN}</p>`;
      break;
    // The threshold's provider half is what a young pool fails: plenty of
    // commitments, too few distinct people for a percentage to be fair.
    case "counts-only":
      panel = `${KICKER}
<h3 class="serif-h">${POOL_RECORD_LIVE.seasons} seasons of commitments</h3>
${hot("w15.counts", recordRow(POOL_RECORD_LIVE, null))}
${liveCycle()}
${seasonRows()}
<p style="margin:0;max-width:52ch;color:var(--stone)">${TIE_IN}</p>`;
      break;
    // The state the record framing exists for: no live cycle, and the section
    // still has something true to say.
    case "between-seasons":
      panel = `${KICKER}
<h3 class="serif-h">${POOL_LIFETIME.seasons} seasons of commitments</h3>
${hot("w15.between", `<p style="margin:0;max-width:52ch">The next season has not opened yet. What the garden has kept so far stays here.</p>`)}
${recordRow(POOL_LIFETIME, POOL_LIFETIME_KEPT_RATE)}
${seasonRows(FINISHED_CYCLES)}`;
      break;
    // §4.1 Paused: neutral quiet-period line, aggregates stay. The indexed
    // pause reason is not published here.
    case "paused":
      panel = `${KICKER}
<h3 class="serif-h">${POOL_RECORD_LIVE.seasons} seasons of commitments</h3>
${hot("w15.paused", `<p style="margin:0;max-width:52ch">This garden has paused new commitments for now. Its record stays readable.</p>`)}
${recordRow(POOL_RECORD_LIVE, POOL_RECORD_LIVE_KEPT_RATE)}
${seasonRows()}`;
      break;
    case "pre-launch":
      panel = `${KICKER}
<h3 class="serif-h">This garden is preparing its pool</h3>
<p style="margin:0;max-width:52ch">Offers and requests between neighbours open with the coming season. The charter and baseline are in place.</p>`;
      break;
    // The section never disappears (Decision Log #161): a garden with an open
    // pool and nothing in it says so, rather than leaving a gap where § 02 is.
    case "empty":
      panel = `${KICKER}
<h3 class="serif-h">The ${CYCLE} is open</h3>
${hot("w15.empty", `<p style="margin:0;max-width:52ch">No commitments have been made yet this season. They appear here as neighbours offer and take them up.</p>`)}`;
      break;
    case "loading":
      panel = `${KICKER}
<div style="height:26px;width:58%;background:var(--stone-bg);border-radius:2px"></div>
<div class="estatrow"><div class="estat"><div style="height:34px;width:52px;background:var(--stone-bg);border-radius:2px"></div><div class="l">commitments made</div></div><div class="estat"><div style="height:34px;width:52px;background:var(--stone-bg);border-radius:2px"></div><div class="l">kept</div></div></div>`;
      break;
    // Distinguishing a failed read from an empty one is a page-level contract
    // the conversion established: an unknown count renders an em dash, never 0.
    default:
      panel = `${KICKER}
<h3 class="serif-h">Garden commitments</h3>
${hot("w15.read-error", `<div class="estatrow"><div class="estat"><div class="serif-n">—</div><div class="l">commitments made</div></div><div class="estat"><div class="serif-n">—</div><div class="l">kept</div></div></div>
<p style="margin:0;max-width:52ch">This garden's commitments could not be loaded just now.</p>`)}
${hot("w15.retry", `<button type="button" class="elink">Try again</button>`)}`;
  }
  return webWin("greengoods.app/gardens/rocinha", `${context}<div class="epanel">${panel}</div>${after}`, "w15.install");
}

const W15_HOTS: HifiDef["hots"] = {
  "w15.install": { l: "Install App", info: "Opens the installed-PWA prompt from the public garden page." },
  "w15.counts": { l: "Counts-only sentence", info: "Percentages render publicly only at ≥5 due commitments and ≥3 distinct providers (UX:350). A young pool clears the first half and fails the second — nine commitments between two people is not a sample a percentage can describe fairly." },
  "w15.units": { l: "Exact-label unit rows", info: "Each unit keeps its own label and total (§7.1). Hours and rides are never summed or averaged into a single figure — that is the mixed-unit percentage the spec forbids." },
  "w15.rate": { l: "Kept rate", info: "The one sanctioned percentage, and it describes the garden's whole record rather than the cycle it happens to be in. Cancelled and under-review commitments never appear individually in public (UX:350). Because the published scope is the pool's lifetime, the threshold's distinct-provider half needs only a pool-scoped counter — the cheap one (§7.2)." },
  "w15.rows": { l: "Seasons and campaigns", info: "Finished cycles, newest first, each naming its own scope. A campaign never masquerades as the season (§4.2), and cancelled cycles never appear — aggregates count completed cycles only." },
  "w15.between": { l: "No live cycle", info: "The state the record framing exists for. A garden between seasons has nothing in progress and still has a record, so the section says that instead of falling back to readiness copy that would be false for a mature garden. Closed and composted pools render the same record beneath their own §4.1 state line." },
  "w15.paused": { l: "Quiet period, record intact", info: "§4.1 Paused on the editorial column: a neutral quiet-period line, aggregates stay. The indexed pause reason belongs to the client banner and the admin console — a public page is not where a garden is made to explain a difficult season." },
  "w15.empty": { l: "Scope-named empty", info: "Every section on the garden page always renders, so an open pool with nothing in it says so instead of leaving a gap where § 02 is (Decision Log #161)." },
  "w15.retry": { l: "Try again", info: "Re-reads the section's sources. Nothing else on the page is affected — the other sections rendered from reads that succeeded." },
  "w15.read-error": { l: "Unknown is not zero", info: "A failed read returns an empty list, which is indistinguishable from a garden with no record. The page renders an em dash rather than 0 and says the section could not load — it never publishes what it does not know." },
};

// ---------------------------------------------------------------------------
// W16 — /impact commitments band + evidence pipeline delta (uiux-spec §7.3)
// ---------------------------------------------------------------------------

const W16_STATES = [
  ["band", "Commitments band"], ["support-in-flight", "Support in flight"], ["pipeline-delta", "Proof pipeline"],
] as const;
type W16State = (typeof W16_STATES)[number][0];

function w16(state: W16State): string {
  if (state === "pipeline-delta") {
    const stages = ["Assessment", "Commitment", "Work", "Confirmation", "Certificate"]
      .map((s2) => `<span class="pstage${s2 === "Commitment" || s2 === "Confirmation" ? " new" : ""}">${s2}</span>`)
      .join(`<span class="parr">→</span>`);
    return webWin(
      "greengoods.app/impact",
      `<span class="kicker">How proof becomes impact</span>
<h3 class="serif-h">From baseline to certificate</h3>
${hot("w16.pipeline", `<div class="pipe">${stages}</div>`)}
<p style="margin:0;max-width:56ch;color:var(--stone)">Commitment and Confirmation are the two new stages: work begins as a commitment to someone, and the person it was made to confirms it was kept.</p>`,
      "w16.install",
    );
  }

  // Dispatched is not arrived (settlement-spec §3.0). The public figure is the
  // confirmed total and nothing else; an in-flight delivery leaves it exactly
  // where it was until an authenticated acknowledgment lands.
  const inFlight = state === "support-in-flight";
  const supportTile = hot(
    inFlight ? "w16.in-flight" : "w16.gsupport",
    `<div class="estat"><div class="serif-n">312 G$</div><div class="l">support arrived</div></div>`,
  );

  return webWin(
    "greengoods.app/impact",
    `<div class="epanel">
<span class="kicker">Commitments</span>
<h3 class="serif-h">Work that starts as a commitment kept</h3>
<div class="estatrow"><div class="estat"><div class="serif-n">11</div><div class="l">gardens with live pools</div></div><div class="estat"><div class="serif-n">43</div><div class="l">commitments fulfilled this season</div></div>${supportTile}</div>
<p style="margin:0;max-width:56ch">A commitment is offered, taken up, worked, witnessed, and confirmed by the person it was made to.</p>
${hot("w16.see-gardens", `<button type="button" class="elink">See the gardens →</button>`)}
</div>`,
    "w16.install",
  );
}

const W16_HOTS: HifiDef["hots"] = {
  "w16.install": { l: "Install App", to: "screen:W1", info: "Opens the installed-PWA prompt from the public impact page." },
  "w16.gsupport": { l: "Support arrived", info: "Counts only deliveries whose authenticated acknowledgment landed (§7.3) — queued and dispatched support is never published as arrived." },
  "w16.in-flight": { l: "A dispatch that changes nothing here", info: "40 G$ is dispatched and awaiting acknowledgment, and the public figure stays at 312. Only an authenticated CCIP acknowledgment may move it; dispatched, executed and ack-pending all read as not-yet-arrived, and none of them appear on this page at all." },
  "w16.see-gardens": { l: "See the gardens", to: "screen:W15", info: "Links to /gardens; no per-garden table on /impact — comparison drifts toward ranking (UX:354)." },
  "w16.pipeline": { l: "Evidence pipeline delta", info: "PublicEvidencePipeline gains the Commitment and Confirmation stages (UX:345). The component is three-node, `md:grid-cols-3`, with literal English node copy — internationalising it and laying it out for five is a prerequisite, not part of the band." },
};

// ---------------------------------------------------------------------------

export const PUBLIC_DEFS: HifiDef[] = [
  { screen: { id: "W15", title: "W15 · Garden commitments section (public)", surface: "editorial", frame: "browser", group: "Editorial website",
    states: W15_STATES.map(([id, label]) => ({ id, label, html: w15(id) })) }, hots: W15_HOTS },
  { screen: { id: "W16", title: "W16 · /impact commitments (public)", surface: "editorial", frame: "browser", group: "Editorial website",
    states: W16_STATES.map(([id, label]) => ({ id, label, html: w16(id) })) }, hots: W16_HOTS },
];
