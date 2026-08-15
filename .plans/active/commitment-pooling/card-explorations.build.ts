// One-shot exploration builder (2026-08-14, Afo's card review): renders the
// cycle-card layout options (Today / A kicker / B chips / C title-first) and
// the promise-card anatomy options (P1 chips-lead / P2 kicker-lead / P3
// person-lead) as real Warm Earth specimens, straight from the hifi kit CSS,
// so the winning option lands verbatim in hifi/screens/client.ts.
// Rebuild:  bun .plans/active/commitment-pooling/card-explorations.build.ts
// Publish:  Claude Code Artifact tool (its own artifact, separate from the
//           flow-prototypes URL). Delete this file when the decision lands.
import { writeFileSync } from "node:fs";
import { btn, card, chip } from "./hifi/kit";
import { HIFI_CSS } from "./hifi/tokens";

const OUT = process.env.OUT ?? "/tmp/commitment-pooling-card-explorations.html";

// ---- specimen helpers (private copies of client.ts internals) --------------
const byline = (n: string) =>
  `<div class="byline"><span class="avatar" aria-hidden="true">${n[0]}</span><span class="t-meta">by ${n}</span></div>`;
const dm = (ds: string[]) =>
  `<div class="dmrow">${ds.map((d) => `<span class="dm ${d.toLowerCase()}">${d}</span>`).join("")}</div>`;
const act = (label: string) => `<div class="brow">${btn(label, { kind: "sec" })}</div>`;
const kick = (text: string, tone?: "offer" | "request") => `<div class="kick${tone ? " " + tone : ""}">${text}</div>`;

const rail = (season: string, c1: string, c2: string) =>
  `<div class="crail"><div class="cslide lead">${season}</div><div class="cslide">${c1}</div><div class="cslide">${c2}</div></div>`;
const phone = (inner: string) => `<div class="hf s-client"><div class="specphone">${inner}</div></div>`;

// ---- section 1 · cycle cards ----------------------------------------------
const cycleToday = rail(
  card(
    `<div class="cardrow"><div class="grow"><div class="t-title">Season of First Rains</div><div class="t-meta">Open · runs through Aug 30</div></div>${chip("Season", "plain")}</div><div class="t-meta num">9 promises · 7 kept</div>`,
  ),
  card(
    `<div class="cardrow"><div class="grow"><div class="t-title">Market rides</div><div class="t-meta">Campaign · Open</div></div><span class="ch num">6/16</span></div>`,
  ),
  card(
    `<div class="cardrow"><div class="grow"><div class="t-title">Tool library</div><div class="t-meta">Campaign · Reviewing</div></div><span class="ch num">8/8</span></div>`,
  ),
);

const cycleA = rail(
  card(
    `${kick("Season · Open")}<div class="t-title">Season of First Rains</div><div class="t-meta">runs through Aug 30</div><div class="t-meta num">9 promises · 7 kept</div>`,
  ),
  card(
    `${kick("Campaign · Open")}<div class="t-title">Market rides</div><div class="t-meta">through Aug 18</div><div class="t-meta num">6 of 16 kept</div>`,
  ),
  card(
    `${kick("Campaign · Reviewing")}<div class="t-title">Tool library</div><div class="t-meta">through Aug 18</div><div class="t-meta num">8 of 8 kept</div>`,
  ),
);

const cycleB = rail(
  card(
    `<div class="cardrow">${chip("Season", "plain")}${chip("Open", "plain")}</div><div class="t-title">Season of First Rains</div><div class="t-meta">runs through Aug 30</div><div class="t-meta num">9 promises · 7 kept</div>`,
  ),
  card(
    `<div class="cardrow">${chip("Campaign", "plain")}${chip("Open", "plain")}</div><div class="t-title">Market rides</div><div class="t-meta">through Aug 18</div><div class="t-meta num">6 of 16 kept</div>`,
  ),
  card(
    `<div class="cardrow">${chip("Campaign", "plain")}${chip("Reviewing", "plain")}</div><div class="t-title">Tool library</div><div class="t-meta">through Aug 18</div><div class="t-meta num">8 of 8 kept</div>`,
  ),
);

const cycleC = rail(
  card(
    `<div class="t-title">Season of First Rains</div><div class="t-meta">Season · Open · runs through Aug 30</div><div class="t-meta num">9 promises · 7 kept</div>`,
  ),
  card(
    `<div class="t-title">Market rides</div><div class="t-meta">Campaign · Open · through Aug 18</div><div class="t-meta num">6 of 16 kept</div>`,
  ),
  card(
    `<div class="t-title">Tool library</div><div class="t-meta">Campaign · Reviewing · through Aug 18</div><div class="t-meta num">8 of 8 kept</div>`,
  ),
);

// ---- section 2 · promise-card anatomies ------------------------------------
// Master anatomy — every row present at once, numbered by the legend beside it.
const master = card(
  `<div class="cardrow">${chip("Offer", "offer")}${chip("Team of 3", "plain")}</div>` +
    `<div class="t-title">Restore the compost bays</div>` +
    byline("Maria") +
    `<div class="t-meta num">4 sessions · due Aug 24</div>` +
    dm(["AGRO", "WASTE"]) +
    `<div class="t-meta num">Needs approved work: Weed × 2 · Mulch × 4</div>` +
    `<div class="t-meta">Stewards review who takes this up.</div>` +
    act("Take this up"),
  { edge: "offer" },
);
const masterLegend = [
  ["①", "Type row — direction chip first, lifecycle after. Max 3 chips."],
  ["②", "Title — the only large text."],
  ["③", "By-line — avatar + name."],
  ["④", "Amount + due."],
  ["⑤", "Domain row — every involved domain, equal weight. Absent on service promises."],
  ["⑥", "Progress / requirement line."],
  ["⑦", "One helper or reason line."],
  ["⑧", "Act button — only when the viewer can claim from browse. Never navigation."],
]
  .map(([n, t]) => `<div class="legrow"><span class="legnum">${n}</span><span>${t}</span></div>`)
  .join("");

// P1 — chips lead: the seven variants under the universal anatomy.
const p1 = [
  card(
    `<div class="cardrow">${chip("Offer", "offer")}</div><div class="t-title">Prune the north beds</div>${byline("Maria")}<div class="t-meta num">6 hours · due Aug 12</div>${dm(["AGRO"])}${act("Take this up")}`,
    { edge: "offer" },
  ),
  card(
    `<div class="cardrow">${chip("Offer", "offer")}${chip("Ongoing", "plain")}${chip("Support / service", "plain")}</div><div class="t-title">Saturday veggie box</div>${byline("Maria")}<div class="t-meta num">1 box each week · runs with the season</div><div class="t-meta num">2 places open</div>`,
    { edge: "offer" },
  ),
  card(
    `<div class="cardrow">${chip("Offer", "offer")}${chip("Team of 3", "plain")}</div><div class="t-title">Restore the compost bays</div>${byline("Maria")}<div class="t-meta num">4 sessions · due Aug 24</div>${dm(["AGRO", "WASTE"])}`,
    { edge: "offer" },
  ),
  card(
    `<div class="cardrow">${chip("Request", "request")}${chip("Support / service", "plain")}</div><div class="t-title">Ride to the market on Saturday</div>${byline("Ana")}<div class="t-meta num">1 ride · runs with the season</div><div class="t-meta">Open to anyone here.</div>${act("I can help")}`,
    { edge: "request" },
  ),
  card(
    `<div class="cardrow">${chip("Request", "request")}</div><div class="t-title">Clear the drainage channel</div>${byline("Ana")}<div class="t-meta num">8 hours · due Aug 30</div>${dm(["AGRO"])}<div class="t-meta num">Needs approved work: Weed × 2 · Mulch × 4</div>${act("I can help")}`,
    { edge: "request" },
  ),
  card(
    `<div class="cardrow">${chip("Offer", "offer")}${chip("Support / service", "plain")}${chip("40 G$", "plain")}</div><div class="t-title">Design a market poster</div>${byline("Ben")}<div class="t-meta num">1 poster design · runs with the season</div><div class="t-meta">Stewards review funded claims.</div>${act("Ask to fund this")}`,
    { edge: "offer" },
  ),
  card(
    `<div class="cardrow">${chip("Offer", "offer")}${chip("Queued", "queued")}</div><div class="t-title">Prune the north beds</div><div class="t-meta num">6 hours · due Aug 12</div><div class="t-meta">Saved on this device — it will send when connected.</div>`,
    { edge: "offer" },
  ),
].join("");

// P2 — kicker lead: direction + kind as a tinted eyebrow; chips carry
// lifecycle only. Harmonizes with cycle option A.
const p2 = [
  card(
    `${kick("Offer · Garden work", "offer")}<div class="t-title">Prune the north beds</div>${byline("Maria")}<div class="t-meta num">6 hours · due Aug 12</div>${dm(["AGRO"])}${act("Take this up")}`,
    { edge: "offer" },
  ),
  card(
    `${kick("Request · Garden work", "request")}<div class="t-title">Clear the drainage channel</div>${byline("Ana")}<div class="t-meta num">8 hours · due Aug 30</div>${dm(["AGRO"])}<div class="t-meta num">Needs approved work: Weed × 2 · Mulch × 4</div>${act("I can help")}`,
    { edge: "request" },
  ),
  card(
    `${kick("Offer · Ongoing service", "offer")}<div class="t-title">Saturday veggie box</div>${byline("Maria")}<div class="t-meta num">1 box each week · runs with the season</div><div class="t-meta num">2 places open</div>`,
    { edge: "offer" },
  ),
].join("");

// P3 — person lead: the by-line opens the card, feed-style; type chips second.
const p3 = [
  card(
    `${byline("Maria")}<div class="cardrow">${chip("Offer", "offer")}</div><div class="t-title">Prune the north beds</div><div class="t-meta num">6 hours · due Aug 12</div>${dm(["AGRO"])}${act("Take this up")}`,
    { edge: "offer" },
  ),
  card(
    `${byline("Ana")}<div class="cardrow">${chip("Request", "request")}</div><div class="t-title">Clear the drainage channel</div><div class="t-meta num">8 hours · due Aug 30</div>${dm(["AGRO"])}<div class="t-meta num">Needs approved work: Weed × 2 · Mulch × 4</div>${act("I can help")}`,
    { edge: "request" },
  ),
  card(
    `${byline("Maria")}<div class="cardrow">${chip("Offer", "offer")}${chip("Ongoing", "plain")}</div><div class="t-title">Saturday veggie box</div><div class="t-meta num">1 box each week · runs with the season</div><div class="t-meta num">2 places open</div>`,
    { edge: "offer" },
  ),
].join("");

// ---- page shell -------------------------------------------------------------
const SHELL_CSS = `
:root{--canvas:#FAF8F4;--panel:#F2EFE7;--ink:#2B2924;--stone:#6B675E;--line:#E4E0D6;--accent:#3E7A4E;--accent-ink:#2E5C3B}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--canvas:#1C1B18;--panel:#24221E;--ink:#ECE8DF;--stone:#A39E92;--line:#35332C;--accent:#7FBF8E;--accent-ink:#9BD1A8}}
:root[data-theme="dark"]{--canvas:#1C1B18;--panel:#24221E;--ink:#ECE8DF;--stone:#A39E92;--line:#35332C;--accent:#7FBF8E;--accent-ink:#9BD1A8}
*{box-sizing:border-box}
body{margin:0;background:var(--canvas);color:var(--ink);font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:30px 20px 80px}
header.top{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:6px}
h1{font-size:22px;margin:0;text-wrap:balance}
.sub{color:var(--stone);font-size:13.5px;margin:0 0 26px;max-width:76ch}
.themebtn{margin-left:auto;border:1px solid var(--line);background:var(--panel);color:var(--stone);border-radius:8px;padding:6px 14px;font:600 12.5px inherit;cursor:pointer;min-height:40px}
.themebtn:hover{color:var(--ink)}
h2{font-size:17px;margin:40px 0 4px;padding-top:22px;border-top:1px solid var(--line);text-wrap:balance}
section:first-of-type h2{border-top:0;padding-top:0}
p.lead{color:var(--stone);font-size:13.5px;margin:0 0 16px;max-width:80ch}
.opt{margin:0 0 26px}
.optname{display:flex;align-items:baseline;gap:10px;margin:0 0 10px}
.optname .tagchip{font:700 11px inherit;letter-spacing:.07em;text-transform:uppercase;color:var(--accent-ink);border:1px solid var(--accent-ink);border-radius:99px;padding:2px 10px}
.optname .t{font-weight:650;font-size:14.5px}
.optnote{color:var(--stone);font-size:12.5px;margin:8px 0 0;max-width:76ch}
.specrow{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start}
.hf .specphone{width:390px;max-width:100%;background:var(--cv);border:1px solid var(--ln);border-radius:22px;padding:14px 16px;overflow:hidden}
.cardgrid{display:grid;grid-template-columns:repeat(auto-fill,390px);gap:16px;justify-content:start}
.cardgrid .hf{display:contents}
.cardgrid .hf .card{width:390px;max-width:100%}
.masterrow{display:flex;gap:26px;flex-wrap:wrap;align-items:flex-start}
.legend{flex:1;min-width:260px;display:flex;flex-direction:column;gap:9px;padding-top:4px}
.legrow{display:flex;gap:10px;font-size:13px;color:var(--ink)}
.legrow .legnum{color:var(--accent-ink);font-weight:700;flex:none}
/* kicker — the eyebrow explored in cycle option A and anatomy P2 */
.hf .kick{font:700 10.5px inherit;letter-spacing:.09em;text-transform:uppercase;color:var(--stone)}
.hf .kick.offer{color:var(--gr-ink)}
.hf .kick.request{color:var(--sky)}
@media (max-width:440px){.cardgrid{grid-template-columns:1fr}.cardgrid .hf .card{width:100%}}
`;

const optBand = (tag: string, name: string, spec: string, note: string) =>
  `<div class="opt"><div class="optname"><span class="tagchip">${tag}</span><span class="t">${name}</span></div>${spec}<p class="optnote">${note}</p></div>`;

const html = `<meta charset="utf-8">
<title>Pool Card Studies</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${SHELL_CSS}${HIFI_CSS}</style>
<div class="wrap">
<header class="top"><h1>Pool Card Studies</h1><button type="button" class="themebtn" id="tt" aria-pressed="false">Dark mode</button></header>
<p class="sub">Side-by-side layout options for the pool tab's cards, rendered from the live prototype kit — the option you pick lands verbatim in the flow prototypes. Cycle cards first, then the promise-card anatomies. Swipe the rails; everything left-aligns on one axis in every option.</p>

<section>
<h2>1 · Season &amp; campaign cards</h2>
<p class="lead">The problem being solved: today's floating right-aligned tag. Each option shown in its real context — the snap rail with the Season slide leading and a campaign peeking.</p>
${optBand("Today", "Right-aligned tag (baseline)", phone(cycleToday), "The Season chip and campaign counts float right of the title block — two reading directions on one small card.")}
${optBand("A", "Kicker line", phone(cycleA), "SEASON · OPEN as a small-caps eyebrow. The card type reads before the title — fastest to tell slides apart mid-swipe; counts join the left stack.")}
${optBand("B", "Chip row leads", phone(cycleB), "[Season] [Open] chips above the title — the same grammar as promise cards, one anatomy across the whole tab. Slightly heavier top row.")}
${optBand("C", "Title first", phone(cycleC), "Title on top, type folded into one meta line. Quietest and most journal-like; cycle cards read as a clearly different species from chip-bearing promise cards.")}
</section>

<section>
<h2>2 · Promise cards — the universal anatomy</h2>
<p class="lead">One fixed stack; every card is a subset of its rows, never reordered. The direction edge stays (offer green · request sky), the whole card opens the promise, and the button appears only when there is an act to take.</p>
<div class="masterrow"><div class="hf s-client">${master}</div><div class="legend">${masterLegend}</div></div>
</section>

<section>
<h2>3 · Anatomy P1 — chips lead</h2>
<p class="lead">The anatomy above applied to all seven card variants.</p>
<div class="cardgrid"><div class="hf s-client">${p1}</div></div>
<p class="optnote">Direction is a colored chip in the first slot; lifecycle chips follow it. Familiar from every existing list in the app.</p>
</section>

<section>
<h2>4 · Anatomy P2 — kicker lead</h2>
<p class="lead">Direction + kind as a tinted eyebrow; chips would carry lifecycle only. Three representative specimens.</p>
<div class="cardgrid"><div class="hf s-client">${p2}</div></div>
<p class="optnote">Harmonizes with cycle option A — the whole tab reads on kickers. Direction keeps its color in the eyebrow text and the edge. Lifecycle states (Queued, Couldn't send) would still be chips beside the title.</p>
</section>

<section>
<h2>5 · Anatomy P3 — person leads</h2>
<p class="lead">The by-line opens the card, feed-style; type chips move to the second row. Three representative specimens.</p>
<div class="cardgrid"><div class="hf s-client">${p3}</div></div>
<p class="optnote">Warmest and most social — the neighbour before the transaction. Costs scan speed when browsing by kind: "what is this" arrives one row later.</p>
</section>
</div>
<script>
(function(){var b=document.getElementById("tt"),r=document.documentElement,
d=r.dataset.theme==="dark"||(!r.dataset.theme&&matchMedia("(prefers-color-scheme: dark)").matches);
function render(){b.textContent=d?"Light mode":"Dark mode";b.setAttribute("aria-pressed",String(d))}
render();
b.addEventListener("click",function(){d=!d;r.dataset.theme=d?"dark":"light";render()});})();
</script>`;

writeFileSync(OUT, html);
console.log("card studies →", OUT, "|", html.length, "chars");
