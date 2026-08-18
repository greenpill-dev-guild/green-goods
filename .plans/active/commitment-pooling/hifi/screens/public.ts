// Editorial hi-fi screens — W15 garden pool story (/gardens/:id), W16 /impact
// commitments band. Public-website dialect (.s-public): Fraunces-stack serif
// headlines, mono uppercase kickers, sharp editorial panels. Boundaries per
// uiux-spec §7.4: read-only, aggregate-only — no rankings, no participant
// data, no addresses; percentage rates only at ≥5 due commitments and ≥3
// distinct commitmentrs, counts-only sentences below that (§7.2).

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

// ---------------------------------------------------------------------------
// W15 — garden pool story section (uiux-spec §7.1)
// ---------------------------------------------------------------------------

const W15_STATES = [
  ["counts-only", "Counts only"], ["above-threshold", "Above threshold"], ["pre-launch", "Pre-launch"],
] as const;
type W15State = (typeof W15_STATES)[number][0];

function w15(state: W15State): string {
  const context = `<div class="t-meta" style="color:var(--stone);font-size:13px">… field notes (existing section, untouched) …</div><hr class="erule">`;
  const after = `<hr class="erule"><div class="t-meta" style="color:var(--stone);font-size:13px">… impact certificates (existing section) …</div>`;
  let panel: string;
  switch (state) {
    case "above-threshold":
      panel = `<span class="kicker">Commitments</span>
<h3 class="serif-h">Midway through the ${CYCLE}</h3>
<div class="estatrow"><div class="estat"><div class="serif-n">${SEASON_LIVE.made}</div><div class="l">commitments made</div></div><div class="estat"><div class="serif-n">${SEASON_LIVE.kept}</div><div class="l">kept so far</div></div><div class="estat">${hot("w15.units", `<div class="eunits"><div class="erow"><span>Hours</span><span class="num">${SEASON_LIVE.units.hours.done} of ${SEASON_LIVE.units.hours.of}</span></div><div class="erow"><span>Rides</span><span class="num">${SEASON_LIVE.units.rides.done} of ${SEASON_LIVE.units.rides.of}</span></div></div>`)}
${hot("w15.rate", `<div><div class="serif-n">${SEASON_LIVE_KEPT_RATE}%</div><div class="l">kept rate</div></div>`)}</div></div>
<p style="margin:0;max-width:52ch">Fulfilled commitments from this cycle are anchored in the certificates below.</p>`;
      break;
    case "pre-launch":
      panel = `<span class="kicker">Commitments</span>
<h3 class="serif-h">This garden is preparing its pool</h3>
<p style="margin:0;max-width:52ch">Offers and requests between neighbours open with the coming season. The charter and baseline are in place.</p>`;
      break;
    default:
      panel = `<span class="kicker">Commitments</span>
<h3 class="serif-h">Midway through the ${CYCLE}</h3>
${hot("w15.counts", `<p style="margin:0;max-width:52ch;font-size:16.5px">${SEASON_LIVE.made} commitments made, ${SEASON_LIVE.kept} kept so far, running through Aug 30.</p>`)}
<p style="margin:0;max-width:52ch;color:var(--stone)">Fulfilled commitments from this cycle are anchored in the certificates below.</p>`;
  }
  return webWin("greengoods.app/gardens/rocinha", `${context}<div class="epanel">${panel}</div>${after}`, "w15.install");
}

const W15_HOTS: HifiDef["hots"] = {
  "w15.install": { l: "Install App", info: "Opens the installed-PWA prompt from the public garden page." },
  "w15.counts": { l: "Counts-only sentence", info: "Percentages render publicly only at ≥5 due commitments and ≥3 commitmentrs; below that, counts-only sentences (UX:350)." },
  "w15.units": { l: "Exact-label unit rows", info: "Each unit keeps its own label and total (§7.1). Hours and rides are never summed or averaged into a single figure — that is the mixed-unit percentage the spec forbids." },
  "w15.rate": { l: "Kept rate", info: "Rendered only above the small-community threshold; cancelled and under-review commitments never appear individually in public (UX:350)." },
};

// ---------------------------------------------------------------------------
// W16 — /impact commitments band + evidence pipeline delta (uiux-spec §7.3)
// ---------------------------------------------------------------------------

const W16_STATES = [["band", "Commitments band"], ["pipeline-delta", "Evidence pipeline"]] as const;
type W16State = (typeof W16_STATES)[number][0];

function w16(state: W16State): string {
  if (state === "pipeline-delta") {
    const stages = ["Assessment", "Commitment", "Work", "Confirmation", "Certificate"]
      .map((s2) => `<span class="pstage${s2 === "Commitment" || s2 === "Confirmation" ? " new" : ""}">${s2}</span>`)
      .join(`<span class="parr">→</span>`);
    return webWin(
      "greengoods.app/impact",
      `<span class="kicker">How evidence becomes impact</span>
<h3 class="serif-h">From baseline to certificate</h3>
${hot("w16.pipeline", `<div class="pipe">${stages}</div>`)}
<p style="margin:0;max-width:56ch;color:var(--stone)">Commitment and Confirmation are the two new stages: work begins as a commitment to someone, and the person it was made to confirms it was kept.</p>`,
      "w16.install",
    );
  }
  return webWin(
    "greengoods.app/impact",
    `<div class="epanel">
<span class="kicker">Commitments</span>
<h3 class="serif-h">Work that starts as a commitment kept</h3>
<div class="estatrow"><div class="estat"><div class="serif-n">11</div><div class="l">gardens with live pools</div></div><div class="estat"><div class="serif-n">43</div><div class="l">commitments fulfilled this season</div></div>${hot("w16.gsupport", `<div class="estat"><div class="serif-n">312 G$</div><div class="l">support arrived</div></div>`)}</div>
<p style="margin:0;max-width:56ch">A commitment is offered, taken up, worked, witnessed, and confirmed by the person it was made to.</p>
${hot("w16.see-gardens", `<button type="button" class="elink">See the gardens →</button>`)}
</div>`,
    "w16.install",
  );
}

const W16_HOTS: HifiDef["hots"] = {
  "w16.install": { l: "Install App", to: "screen:W1", info: "Opens the installed-PWA prompt from the public impact page." },
  "w16.gsupport": { l: "Support arrived", info: "Counts only deliveries whose authenticated acknowledgment landed (§7.3) — queued and dispatched support is never published as arrived." },
  "w16.see-gardens": { l: "See the gardens", to: "screen:W15", info: "Links to /gardens; no per-garden table on /impact — comparison drifts toward ranking (UX:354)." },
  "w16.pipeline": { l: "Evidence pipeline delta", info: "PublicEvidencePipeline gains the Commitment and Confirmation stages (UX:345)." },
};

// ---------------------------------------------------------------------------

export const PUBLIC_DEFS: HifiDef[] = [
  { screen: { id: "W15", title: "W15 · Garden pool story (public)", surface: "editorial", frame: "browser", group: "Editorial website",
    states: W15_STATES.map(([id, label]) => ({ id, label, html: w15(id) })) }, hots: W15_HOTS },
  { screen: { id: "W16", title: "W16 · /impact commitments (public)", surface: "editorial", frame: "browser", group: "Editorial website",
    states: W16_STATES.map(([id, label]) => ({ id, label, html: w16(id) })) }, hots: W16_HOTS },
];
