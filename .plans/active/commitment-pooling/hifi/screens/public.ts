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

import { CYCLE, SEASON_LIVE, SEASON_LIVE_KEPT_RATE } from "../fixtures";
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
  ["counts-only", "Counts only"], ["above-threshold", "Above threshold"], ["pre-launch", "Pre-launch"],
  ["empty", "No commitments yet"], ["loading", "Loading"], ["read-error", "Read error"],
] as const;
type W15State = (typeof W15_STATES)[number][0];

const TIE_IN = `Fulfilled commitments shown here are anchored in the certificates below.`;

function w15(state: W15State): string {
  const context = `${stub("§ 01: Field notes", "photo grid, 12 of 128 shown")}<hr class="erule">`;
  // § 04 (the people who tend the garden) is deliberately not stubbed: the
  // shipped page still heads it "Operators", which this dialect retired
  // (Decision Log #28c), and renaming it belongs to PRD-746-751, not here.
  const after = `<hr class="erule">${stub("§ 03: Certificates", "existing list")}`;
  let panel: string;
  switch (state) {
    case "above-threshold":
      panel = `<span class="kicker">§ 02: Commitments</span>
<h3 class="serif-h">Midway through the ${CYCLE}</h3>
<div class="estatrow"><div class="estat"><div class="serif-n">${SEASON_LIVE.made}</div><div class="l">commitments made</div></div><div class="estat"><div class="serif-n">${SEASON_LIVE.kept}</div><div class="l">kept so far</div></div><div class="estat">${hot("w15.units", `<div class="eunits"><div class="erow"><span>Hours</span><span class="num">${SEASON_LIVE.units.hours.done} of ${SEASON_LIVE.units.hours.of}</span></div><div class="erow"><span>Rides</span><span class="num">${SEASON_LIVE.units.rides.done} of ${SEASON_LIVE.units.rides.of}</span></div></div>`)}
${hot("w15.rate", `<div><div class="serif-n">${SEASON_LIVE_KEPT_RATE}%</div><div class="l">kept rate</div></div>`)}</div></div>
<p style="margin:0;max-width:52ch">${TIE_IN}</p>`;
      break;
    case "pre-launch":
      panel = `<span class="kicker">§ 02: Commitments</span>
<h3 class="serif-h">This garden is preparing its pool</h3>
<p style="margin:0;max-width:52ch">Offers and requests between neighbours open with the coming season. The charter and baseline are in place.</p>`;
      break;
    // The section never disappears (Decision Log #161): a garden with an open
    // pool and nothing in it says so, rather than leaving a gap where § 02 is.
    case "empty":
      panel = `<span class="kicker">§ 02: Commitments</span>
<h3 class="serif-h">The ${CYCLE} is open</h3>
${hot("w15.empty", `<p style="margin:0;max-width:52ch">No commitments have been made yet this season. They appear here as neighbours offer and take them up.</p>`)}`;
      break;
    case "loading":
      panel = `<span class="kicker">§ 02: Commitments</span>
<div style="height:26px;width:58%;background:var(--stone-bg);border-radius:2px"></div>
<div class="estatrow"><div class="estat"><div style="height:34px;width:52px;background:var(--stone-bg);border-radius:2px"></div><div class="l">commitments made</div></div><div class="estat"><div style="height:34px;width:52px;background:var(--stone-bg);border-radius:2px"></div><div class="l">kept so far</div></div></div>`;
      break;
    // Distinguishing a failed read from an empty one is a page-level contract
    // the conversion established: an unknown count renders an em dash, never 0.
    case "read-error":
      panel = `<span class="kicker">§ 02: Commitments</span>
<h3 class="serif-h">Midway through the ${CYCLE}</h3>
${hot("w15.read-error", `<div class="estatrow"><div class="estat"><div class="serif-n">—</div><div class="l">commitments made</div></div><div class="estat"><div class="serif-n">—</div><div class="l">kept so far</div></div></div>
<p style="margin:0;max-width:52ch">This season's commitments could not be loaded just now.</p>`)}
${hot("w15.retry", `<button type="button" class="elink">Try again</button>`)}`;
      break;
    default:
      panel = `<span class="kicker">§ 02: Commitments</span>
<h3 class="serif-h">Midway through the ${CYCLE}</h3>
${hot("w15.counts", `<p style="margin:0;max-width:52ch;font-size:16.5px">${SEASON_LIVE.made} commitments made, ${SEASON_LIVE.kept} kept so far, running through Aug 30.</p>`)}
<p style="margin:0;max-width:52ch;color:var(--stone)">${TIE_IN}</p>`;
  }
  return webWin("greengoods.app/gardens/rocinha", `${context}<div class="epanel">${panel}</div>${after}`, "w15.install");
}

const W15_HOTS: HifiDef["hots"] = {
  "w15.install": { l: "Install App", info: "Opens the installed-PWA prompt from the public garden page." },
  "w15.counts": { l: "Counts-only sentence", info: "Percentages render publicly only at ≥5 due commitments and ≥3 distinct providers; below that, counts-only sentences (UX:350)." },
  "w15.units": { l: "Exact-label unit rows", info: "Each unit keeps its own label and total (§7.1). Hours and rides are never summed or averaged into a single figure — that is the mixed-unit percentage the spec forbids." },
  "w15.rate": { l: "Kept rate", info: "Rendered only above the small-community threshold; cancelled and under-review commitments never appear individually in public (UX:350). The threshold's distinct-provider half is not derivable from the indexer yet — §7.2 records the cycle-scoped counter it needs." },
  "w15.empty": { l: "Scope-named empty", info: "Every section on the garden page always renders, so an open pool with nothing in it says so instead of leaving a gap where § 02 is (Decision Log #161)." },
  "w15.retry": { l: "Try again", info: "Re-reads the section's sources. Nothing else on the page is affected — the other sections rendered from reads that succeeded." },
  "w15.read-error": { l: "Unknown is not zero", info: "A failed EAS read returns an empty list, which is indistinguishable from an empty garden. The page renders an em dash rather than 0 and says the section could not load — it never publishes what it does not know." },
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
