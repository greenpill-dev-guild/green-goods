// Builds the "Commitment Pooling — Visual Asset Gallery" claude.ai artifact from
// the sibling diagrams.md + wireframes.md + hand-drawn SVGs. Three audience tabs
// (decision 2026-07-18):
//   1) The story    — the 7-step loop + roles + journeys + money maps (shareable narrative)
//   2) Architecture — D1–D17 with their "How to read this" panels (Mermaid renders
//                     locally through the locked embedded runtime and natively on
//                     the Claude Artifact host)
//   3) Screens      — cross-surface flow map + the low-fi ASCII wireframes W1–W26,
//                     reconciled to the hi-fi registry (2026-07-27). The hi-fi screen
//                     set is a different artifact entirely — see
//                     prototypes-artifact.build.ts.
//   4) Reference    — added 2026-07-27: the diagrams.md preamble, the 30-asset
//                     coverage matrix, the D13b permission table (routed 2026-07-31),
//                     the ship-time appendix, and the audited Open-questions
//                     findings panel, so the diagrams lead their own tab.
//
// Rebuild:  bun .plans/active/commitment-pooling/visual-assets-artifact.build.ts
//           Always writes two explicit outputs:
//           - LOCAL_OUT (or legacy OUT): self-contained file:// preview with Mermaid
//           - ARTIFACT_OUT: body-content for the Claude Artifact host
//           Never publish the local document wrapper.
// Republish via the Claude Code Artifact tool with
//   url: https://claude.ai/code/artifact/007ef090-9e26-4b1d-898c-615155304d9d
// One-shot op per CLAUDE.md scripts policy — lives in .plans, not scripts/.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = import.meta.dir;
const ROOT = join(DIR, "../../..");
const LOCAL_OUT = process.env.LOCAL_OUT ?? process.env.OUT ?? "/tmp/commitment-pooling-visual-assets.html";
const ARTIFACT_OUT = process.env.ARTIFACT_OUT ?? "/tmp/commitment-pooling-visual-assets.artifact-body.html";
if (LOCAL_OUT === ARTIFACT_OUT) {
  throw new Error("LOCAL_OUT and ARTIFACT_OUT must be different files.");
}
const MERMAID_DIR = join(ROOT, "node_modules/.bun/node_modules/mermaid");
const MERMAID_RUNTIME_PATH = join(MERMAID_DIR, "dist/mermaid.min.js");
const MERMAID_PACKAGE_PATH = join(MERMAID_DIR, "package.json");

if (!existsSync(MERMAID_RUNTIME_PATH) || !existsSync(MERMAID_PACKAGE_PATH)) {
  throw new Error("Mermaid runtime is unavailable. Run the locked Bun install before building the visual-asset artifact.");
}

const mermaidRuntime = readFileSync(MERMAID_RUNTIME_PATH, "utf8");
const mermaidVersion = JSON.parse(readFileSync(MERMAID_PACKAGE_PATH, "utf8")).version as string;
if (mermaidRuntime.includes("</script")) {
  throw new Error("The embedded Mermaid runtime contains a closing script tag and cannot be safely inlined.");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attrEsc = (s: string) =>
  esc(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// ---------- minimal markdown renderer (headings, lists, tables, fences, quotes) ----------
function inline(raw: string): string {
  let s = esc(raw);
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_m, c) => {
    codes.push(c);
    return `\uE000${codes.length - 1}\uE000`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, `<a href="$2" rel="noopener">$1</a>`);
  s = s.replace(/\uE000(\d+)\uE000/g, (_m, i) => `<code>${codes[+i]}</code>`);
  return s;
}

function slug(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

type Sec = { id: string; title: string; level: number; html: string[]; subs: { id: string; title: string }[] };

function renderMd(md: string): { secs: Sec[] } {
  const lines = md.split("\n");
  const secs: Sec[] = [];
  let cur: Sec | null = null;
  let i = 0;
  const push = (h: string) => { if (cur) cur.html.push(h); };

  while (i < lines.length) {
    const line = lines[i];

    // fences
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1];
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // closing fence
      const body = buf.join("\n");
      if (lang === "mermaid") push(`<div class="dia"><pre class="mermaid">${esc(body)}</pre></div>`);
      else if (lang === "text") push(`<div class="framewrap"><pre class="frame">${esc(body)}</pre></div>`);
      else push(`<div class="framewrap"><pre class="code">${esc(body)}</pre></div>`);
      continue;
    }

    // headings
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const title = h[2].trim();
      if (level <= 3) {
        cur = { id: slug(title), title, level, html: [], subs: [] };
        secs.push(cur);
      } else {
        // h4 sub-blocks (D2.1, D6a, D7.0, D9.2 …) are real destinations: they get
        // an anchor and a nav entry. Without this the split diagrams are
        // unreachable by link and invisible in the table of contents.
        const subId = slug(title);
        cur?.subs.push({ id: subId, title });
        push(`<h4 id="${subId}">${inline(title)}</h4>`);
      }
      i++;
      continue;
    }

    // tables
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const rows: string[] = [line];
      i++; i++; // skip separator
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = (r: string) =>
        r.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]).map((c) => `<th scope="col">${inline(c)}</th>`).join("");
      const body = rows.slice(1).map(
        (r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`,
      ).join("");
      push(`<div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
      continue;
    }

    // blockquote block
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      push(`<blockquote>${buf.map((b) => (b.trim() ? `<p>${inline(b)}</p>` : "")).join("")}</blockquote>`);
      continue;
    }

    // list block
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]) || /^\s{2,}\S/.test(lines[i]))) {
        if (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, "").replace(/^\s*\d+\.\s+/, ""));
        } else {
          items[items.length - 1] += " " + lines[i].trim();
        }
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      push(`<${tag}>${items.map((it) => `<li>${inline(it)}</li>`).join("")}</${tag}>`);
      continue;
    }

    if (/^---\s*$/.test(line)) { push("<hr>"); i++; continue; }

    if (line.trim() === "") { i++; continue; }

    // paragraph (merge soft-wrapped lines)
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length && lines[i].trim() !== "" &&
      !/^(#{1,4})\s|^```|^\||^>\s?|^\s*[-*]\s+|^\s*\d+\.\s+|^---\s*$/.test(lines[i])
    ) { buf.push(lines[i]); i++; }
    // "**How to read this**" paragraphs become intro panels
    const joined = buf.join(" ");
    if (/^\*\*How to read this\*\*/.test(joined) || /^\*\*When this happens/.test(joined) || /^\*\*Role vocabulary/.test(joined)) {
      push(`<div class="howto">${inline(joined)}</div>`);
    } else {
      push(`<p>${inline(joined)}</p>`);
    }
  }
  return { secs };
}

// ---------- load sources ----------
const diagramsMd = readFileSync(`${DIR}/diagrams.md`, "utf8");
const wireframesMd = readFileSync(`${DIR}/wireframes.md`, "utf8");
const loopSvg = readFileSync(`${DIR}/artifacts/visuals/external-brief-loop.svg`, "utf8");
const moneySvg = readFileSync(`${DIR}/artifacts/visuals/external-brief-money-map.svg`, "utf8");
const circSvg = readFileSync(`${DIR}/artifacts/visuals/synthesis-circular-gd.svg`, "utf8");
const rolesSvg = readFileSync(`${DIR}/artifacts/visuals/external-brief-roles.svg`, "utf8");
const railsSvg = readFileSync(`${DIR}/artifacts/visuals/external-brief-funding-rails.svg`, "utf8");
const statesSvg = readFileSync(`${DIR}/artifacts/visuals/rollout-settlement-states.svg`, "utf8");
const flywheelSvg = readFileSync(`${DIR}/artifacts/visuals/synthesis-flywheel.svg`, "utf8");
const tiersSvg = readFileSync(`${DIR}/artifacts/visuals/synthesis-three-tiers.svg`, "utf8");
const geSvg = readFileSync(`${DIR}/artifacts/visuals/synthesis-ge-protocol.svg`, "utf8");
const timelineSvg = readFileSync(`${DIR}/artifacts/visuals/rollout-timeline-band.svg`, "utf8");
const ownershipSvg = readFileSync(`${DIR}/artifacts/visuals/rollout-ownership-map.svg`, "utf8");
const useCasesSvg = readFileSync(`${DIR}/artifacts/visuals/use-cases-journey-strip.svg`, "utf8");

const respSvg = (s: string, label: string) =>
  `<div class="svgcard" role="group" data-label="${attrEsc(label)}" aria-label="${attrEsc(label)}">${s.replace(/<svg /, '<svg class="asset" ')}</div>`;

// ---------- assemble tabs ----------
const dia = renderMd(diagramsMd);
const wf = renderMd(wireframesMd);

type SectionOpts = {
  /** Reference routes a level-1 section into its own pane, so it needs a nav entry. */
  navMinLevel?: number;
  /** Display-only heading rewrites. Anchor ids stay derived from the source title. */
  rename?: Record<string, string>;
};

function sectionsHtml(secs: Sec[], opts: SectionOpts = {}): { nav: string; body: string } {
  const { navMinLevel = 2, rename = {} } = opts;
  const kept = secs.filter((s) => s.html.length > 0);
  const shown = (t: string) => rename[t] ?? t;
  const navLabel = (t: string) => esc(shown(t).replace(/\s*\(.*?\)\s*$/, ""));
  const nav = kept
    .filter((s) => s.level >= navMinLevel)
    .map((s) =>
      `<a href="#${s.id}">${navLabel(s.title)}</a>` +
      s.subs.map((sub) => `<a class="sub" href="#${sub.id}">${navLabel(sub.title)}</a>`).join(""),
    )
    .join("");
  const body = kept
    .map((s) => {
      const tag = s.level === 1 ? "h2" : s.level === 2 ? "h3" : "h4";
      return `<section id="${s.id}"><${tag}>${inline(shown(s.title))}</${tag}>${s.html.join("\n")}</section>`;
    })
    .join("\n");
  return { nav, body };
}

// Tab routing (2026-07-27; D13b added 2026-07-31): the diagrams must lead the
// Architecture pane, so the preamble, the 30-asset coverage matrix, the D13b
// permission table (pure reference matrix, zero diagrams), and the ship-time
// appendix move to a Reference pane. Nothing is dropped — the deep material
// renders there in full, and a purpose-written intro carries only what you need
// to read a diagram.
const REFERENCE_TITLES = [
  "Commitment Pooling: Diagrams",
  "Visual coverage matrix",
  "D13b. Exact sensitive-action permission table",
  "Appendix: Edits to EXISTING docs diagrams at ship (PRD-727 scope; historical PRD-680)",
];
const REFERENCE_RENAMES: Record<string, string> = {
  "Commitment Pooling: Diagrams": "Sources, vocabulary, and drawing conventions",
  "Appendix: Edits to EXISTING docs diagrams at ship (PRD-727 scope; historical PRD-680)":
    "Appendix — edits to existing docs diagrams at ship",
};

const architectureSecs = dia.secs.filter((s) => !REFERENCE_TITLES.includes(s.title));
const referenceSecs = dia.secs.filter((s) => REFERENCE_TITLES.includes(s.title));

const diaOut = sectionsHtml(architectureSecs);
const refOut = sectionsHtml(referenceSecs, { navMinLevel: 1, rename: REFERENCE_RENAMES });
const wfOutRaw = sectionsHtml(wf.secs);

// Reconciled 2026-07-27: the blanket "pending sync with UI prototypes" badge is
// retired — every frame was audited against the hi-fi registry and corrected to
// mirror it (wireframes.md § Hi-fi reconciliation). What remains is a scope tag on
// exactly the frames that deliberately keep a block the hi-fi does not draw; each
// such block also carries an inline "Wireframe-only" sentence in the frame's prose.
// The allowlist is explicit so a tag can never reappear as a regex side effect.
const WF_ONLY_FRAMES = [
  "w4-counterparty-confirmation-sheet-uiux-spec-5-6", // evidence-band comparison
  "w7-garden-workspace-pool-tab-uiux-spec-6-2", // waiting-to-join queue (community-interface build)
  "w10-commitment-detail-dialog-uiux-spec-6-2-6-7", // inline claims queue + per-action rows (review intent)
  "w12-pools-mode-inside-admin-community-uiux-spec-6-8", // claimable-by-your-gardeners browse list
  "w15-gardendialog-pool-story-section-uiux-spec-7-1", // "Recently kept" montage
  "w21-garden-pool-tab-settlement-section-delta-to-w7", // Safe/allowance/executor detail rows
];
const WF_ONLY_TAG =
  '<span class="wf-badge wf-only" title="This frame keeps at least one block the hi-fi registry does not draw; the block is marked in the frame notes.">includes wireframe-only detail</span>';
// Count-only scan (same shape the badge injection used): the non-greedy body match
// exists because W12's heading carries an inline <code> span.
const wfScreenCount = (wfOutRaw.body.match(/<h4>(?:W\d|WFLOW|HUBWORK)[\s\S]*?<\/h4>/g) || []).length;
let wfOnlyApplied = 0;
let wfBody = wfOutRaw.body;
for (const id of WF_ONLY_FRAMES) {
  const before = wfBody;
  wfBody = wfBody.replace(new RegExp(`(<section id="${id}"><h4>[\\s\\S]*?)</h4>`), `$1 ${WF_ONLY_TAG}</h4>`);
  if (wfBody !== before) wfOnlyApplied += 1;
}
const wfOut = { nav: wfOutRaw.nav, body: wfBody };
const requiredArchitectureSections = [
  ["D1.", "d1-unified-system-context"],
  ["D1b.", "d1b-contract-module-topology-and-trust-boundaries"],
  ["D2.", "d2-offer-request-work-approval-confirmation-fulfillment"],
  ["D3.", "d3-analog-capture-lightweight-evidence-review-is-confirmation"],
  ["D4.", "d4-pool-state-machine"],
  ["D5.", "d5-cycle-state-machine-types-season-campaign"],
  ["D6.", "d6-commitment-state-machine-overview-three-acts"],
  ["D7.", "d7-indexer-entity-delta-erd"],
  ["D7b.", "d7b-settlement-erd"],
  ["D7c.", "d7c-fulfilled-commitment-hypercert-cut-over-and-indexer-delta"],
  ["D7d.", "d7d-indexer-pipeline-and-the-garden-id-cut-over"],
  ["D8.", "d8-g-funding-topology-safe-recovery-and-ccip-boundary"],
  ["D9.", "d9-settlement-sequence-with-failure-retry"],
  ["D10.", "d10-disbursement-state-machine-all-module-native-on-chain"],
  ["D10b.", "d10b-settlement-status-the-gardener-sees-5-stored-9-rendered"],
  ["D11.", "d11-approval-gated-claim-request-decline-acceptance-and-superses"],
  ["D11b.", "d11b-claim-request-state-machine"],
  ["D12.", "d12-protocol-to-garden-funding-route"],
  ["D13.", "d13-capability-responsibility-summary"],
  ["D13b.", "d13b-exact-sensitive-action-permission-table"],
  ["D14.", "d14-commitment-offline-job-lifecycle"],
  ["D15.", "d15-deployment-and-upgrade-topology"],
  ["D16.", "d16-error-taxonomy-surface-and-recovery-map"],
  ["D17.", "d17-accountability-recognition-and-payment-separation"],
];
// Every diagram-bearing section carries a reading guide. The list used to skip
// exactly the dense ones (D7 had none at 138 source lines) — that inversion is
// the thing this list now prevents from coming back.
const diagramHowToPrefixes = [
  "D1.", "D1b.", "D2.", "D3.", "D4.", "D5.", "D6.", "D7.", "D7b.", "D7c.", "D7d.",
  "D8.", "D9.", "D10.", "D10b.", "D11.", "D11b.", "D12.", "D13.", "D13b.", "D14.",
  "D15.", "D16.", "D17.",
];

const storyBody = `
<section id="story-loop">
  <h2>The commitment loop</h2>
  <p class="lede">Seven steps from a Need to a funded outcome. Solid green = built and live today; dashed = planned and not live. Community testimony is September-only; optional rewards remain separately gated. The loop is a clean-room implementation of Grassroots Economics' commitment-pooling pattern — pooling <em>promises</em>, not money.</p>
  ${respSvg(loopSvg, "The commitment loop")}
</section>
<section id="story-roles">
  <h2>Who does what</h2>
  <p class="lede">Five roles, and what each one does in the loop: Gardener, Garden Steward, Evaluator, Funder and Community. Scoped settlement permissions move G$ under separate operational controls. Nobody confirms their own promise.</p>
  ${respSvg(rolesSvg, "Five roles and their Built or Planned actions")}
</section>
<section id="story-use-cases">
  <h2>Three grounded journeys</h2>
  <p class="lede">A Need records the problem and desired outcome. A commitment then makes a Request or Offer to address it. The three journeys distinguish mutual aid, shared projects on today's evidence rails, and separately gated G$ settlement.</p>
  ${respSvg(useCasesSvg, "Three ways a Need becomes action")}
</section>
<section id="story-money">
  <h2>Where value lives, and how we know it moved</h2>
  <p class="lede">Proof and coordination stay on Arbitrum; G$ lives and moves only on Celo. The designated Green Goods topology receives Foundation-funded House of Alignment pilot funds directly in the protocol Safe once partner mechanism and address evidence clear; from there, one derived funding route reaches garden accounts. A settlement counts as received only after the authenticated Celo executor acknowledgment returns through CCIP.</p>
  ${respSvg(moneySvg, "Arbitrum proof and Celo value map")}
</section>
<section id="story-settlement">
  <h2>How a payout becomes provable</h2>
  <p class="lede">Queued through Dispatched and Celo execution to Confirmed — or authenticated Failed. Cancellation is allowed only before dispatch or after that authenticated failure; delay never unlocks it. There is no human verification path: only the Celo executor acknowledgment through CCIP finalizes the source state.</p>
  ${respSvg(statesSvg, "Settlement evidence states")}
</section>
<section id="story-funding">
  <h2>How delivered outcomes attract funding</h2>
  <p class="lede">Three funding rails, converging on one place: delivered outcomes. Protocol funding, garden funding and direct support all terminate at work that was promised, done, and confirmed by the person who received it.</p>
  ${respSvg(railsSvg, "Funding rails to delivered outcomes")}
</section>
<section id="story-flywheel">
  <h2>The full flywheel</h2>
  <p class="lede">The whole system in one frame — the commitment loop at the centre, four funding rails feeding it, and the borrow-and-repay ring drawn as gated: designed, parked, and not authorized by any current work.</p>
  ${respSvg(flywheelSvg, "The Commitment Pooling flywheel")}
</section>
<section id="story-tiers">
  <h2>Three tiers of mutual support</h2>
  <p class="lede">Ordered by how much trust each one needs: mutual aid first, then G$-paid work, then borrow-and-repay. Only the first two are in scope — the third is design-only, records-only, interest-free, and never a per-person credit score.</p>
  ${respSvg(tiersSvg, "Three tiers of commitment pooling")}
</section>
<section id="story-circular">
  <h2>A circular G$ economy</h2>
  <p class="lede">The aim is circulation, not extraction: support streams in, flows to gardens and gardeners, and a local spend sink carries value back into the pool.</p>
  ${respSvg(circSvg, "Circular G dollar economy")}
</section>
<section id="story-ge-functions">
  <h2>Six protocol functions</h2>
  <p class="lede">Curation, valuation, limitation, exchange, route and repair remain equally visible. The framing is adapted clean-room from the current cited protocol source and introduces no four-function shortcut.</p>
  ${respSvg(geSvg, "Six protocol functions adapted by Green Goods")}
</section>
<section id="story-timeline">
  <h2>The rollout sequence</h2>
  <p class="lede">Four native phases and two operational checkpoints. Follow On / Hardening and Community + evidence remain distinct parallel closures on September 30.</p>
  ${respSvg(timelineSvg, "Four phases and two operational checkpoints")}
</section>
<section id="story-ownership">
  <h2>Where each document lives</h2>
  <p class="lede">Three truth surfaces feed one six-tab external document. The repo plan hub owns execution and specification truth, Linear owns current build status and the canonical synthesis, and the Google Doc owns the external narrative. Corrections flow repo → Linear → Doc.</p>
  ${respSvg(ownershipSvg, "Six-tab documentation source map")}
</section>`;

const storyNav = [
  ["story-loop", "The commitment loop"],
  ["story-roles", "Who does what"],
  ["story-use-cases", "Three grounded journeys"],
  ["story-money", "Where value lives"],
  ["story-settlement", "How a payout becomes provable"],
  ["story-funding", "How outcomes attract funding"],
  ["story-flywheel", "The full flywheel"],
  ["story-tiers", "Three tiers of support"],
  ["story-circular", "A circular G$ economy"],
  ["story-ge-functions", "Six protocol functions"],
  ["story-timeline", "The rollout sequence"],
  ["story-ownership", "Where each document lives"],
].map(([id, t]) => `<a href="#${id}">${t}</a>`).join("");

// Hand-written Architecture opener. It carries only what you need in hand to read a
// diagram — where things live, and the two colour contracts. Everything deeper is
// one tab away, rendered in full rather than summarised.
const archIntro = `
<section id="arch-intro">
  <h2>How to read this set</h2>
  <p class="lede">${architectureSecs.length} named diagrams, D1 through D17, drawn from the frozen contract, settlement and UI specs. They are execution reference: they introduce nothing the specs do not already define.</p>
  <p><strong>Start anywhere.</strong> Every section carries a “How to read this” panel, so no section depends on the one before it. Where a section splits into sub-blocks, that panel sits at the top of the section and covers all of them — D7 is the exception that guides each sub-block separately.</p>
  <ul class="wayfind">
    <li><b>D1 · D1b</b> <span>the widest frame — who participates, and which boundary may authorize what</span></li>
    <li><b>D2 · D3 · D6</b> <span>one promise end to end, plus the analog capture path</span></li>
    <li><b>D4 · D5</b> <span>pool and cycle state machines</span></li>
    <li><b>D7 · D7b · D7c · D7d</b> <span>the Envio read model, its ERDs and its cut-overs</span></li>
    <li><b>D8 – D12</b> <span>G$ topology, settlement sequence, disbursement states, funding route</span></li>
    <li><b>D13</b> <span>capability summary — the exact per-function permission table (D13b) lives on the Reference tab</span></li>
    <li><b>D14 – D16</b> <span>offline jobs, deployment topology, error taxonomy</span></li>
    <li><b>D17</b> <span>accountability, recognition, and payment separation</span></li>
  </ul>
  <p><strong>Five sections open with an overview and then zoom in.</strong> D2 and D6 split into three acts, D7 into an entity map plus two field blocks, D9 into healthy path, idempotency and retries, and D16 into the error, where it manifests, and how the person responds. Sub-blocks are indented in the section list on the left.</p>
  <p><strong>Three status treatments, and only three.</strong> A fill never means two different things in two diagrams, and the meaning of a relationship is always written on the arrow.</p>
  <ul class="legend">
    <li><span class="sw" aria-hidden="true"></span><span><b>Built / live</b> — ships today, in production</span></li>
    <li><span class="sw sw-planned" aria-hidden="true"></span><span><b>Planned / gated</b> — does not exist yet, or is gated</span></li>
    <li><span class="sw sw-delta" aria-hidden="true"></span><span><b>Existing surface, planned delta</b> — live today, and this work adds a planned capability to it</span></li>
  </ul>
  <p><strong>State provenance is not decoration.</strong> The state machines render where a state is stored, so a value the indexer computes never reads as a chain write.</p>
  <ul class="legend">
    <li><span class="sw" aria-hidden="true"></span><span><b>On-chain</b> — the module stores it; a transaction moved it here</span></li>
    <li><span class="sw sw-derived" aria-hidden="true"></span><span><b>Derived</b> — the indexer computes it from events; no transaction writes it</span></li>
    <li><span class="sw sw-app" aria-hidden="true"></span><span><b>App-only</b> — client-side; <code>Draft</code> lives in IndexedDB and has no chain presence</span></li>
  </ul>
  <p><strong>The Reference tab holds the rest</strong> — the 30-asset coverage matrix, the label glossary, the two <code>PoolType</code> vocabularies, the entity definitions these flows depend on, the exact per-function permission table (D13b), and the open questions this set does not answer.</p>
</section>`;

// Audited 2026-07-27 against the frozen specs, the Linear decision record, and the
// shipped code (no CP Solidity exists on any branch — every build lane is unstarted,
// so the frozen specs ARE the implementation). Questions are kept byte-identical;
// each entry adds a verdict, a grounded finding, citations, and — where the call is
// genuinely open — a rider the team still owns. Postures were aligned with the
// founder interactively on 2026-07-27; nothing here bends a diagram to imply an
// answer the specs don't carry.
type OpenQuestionVerdict = "answered" | "answered-gap" | "decision";
const VERDICT_LABEL: Record<OpenQuestionVerdict, string> = {
  answered: "Answered",
  "answered-gap": "Answered · one open gap",
  decision: "Decision needed",
};
const OPEN_QUESTIONS: ReadonlyArray<{
  question: string; // original wording, byte-identical — asserted below
  verdict: OpenQuestionVerdict;
  finding: string;
  cites: string;
  rider?: string; // recommendation, or for no-lean entries the postures themselves
  riderLabel?: string; // defaults to "Recommendation"
}> = [
  {
    question: "Do we enable commitment fulfillment just from actions being completed?",
    verdict: "answered",
    finding:
      "No. Approved work only advances a commitment to `ReadyForConfirmation` — three paths: automatic once every action/count requirement is met and any declared assessment is attached; `submitForConfirmation` for evidence-only kinds; steward `markReadyForConfirmation` with a visible reason. Fulfillment is a separate human act: `confirmFulfillment` by the direction-aware counterparty — an Offer’s recipient, a Request’s creator — reaching threshold N, with every frozen contributor excluded from every path including the reasoned steward fallback. For evidence-only kinds (D3), the counterparty’s confirmation doubles as the review — it removes the approval step, never the confirmation step. D2 and D6 already draw this rule.",
    cites:
      "contract-spec.md §5.3 transition tables + locked fulfillment posture · Linear PRD-649 and the Lifecycle & Aggregator Semantics doc",
  },
  {
    question: "Can a commitment have multiple requirements attached?",
    verdict: "answered",
    finding:
      "Yes. DomainImpact commitments store repeatable `CommitmentRequirement { actionUID, requiredCount }` rows. Actions may share a domain; domain tags are derived from ActionRegistry rather than stored as a positional uniqueness constraint. Every required count is non-zero, each work approval credits one requirement, and approved units are the weighted sum across requirements. Evidence-only kinds carry none. `PartiallyApproved` is derived, and the per-requirement progress rows (D7.1) are what gardeners see between Accepted and Ready. The UI starts with four rows but may add more; implementation benchmarks 8/16/24/32 before freezing `MAX_REQUIREMENTS` (provisional 16).",
    cites: "contract-spec.md §5.3 + §8.2 · Decision Log #21 and #63",
  },
  {
    question: "How are hypercerts shares determined?",
    verdict: "answered",
    finding:
      "The six-role class snapshot is still frozen at `openCycle` and must sum to 10,000. Within the gardeners class, each fulfilled commitment receives an equal budget so unrelated work units never mix. That budget then shares 20% equally among eligible contributors and allocates 80% by verified contribution, with deterministic remainder handling. There is no lead or metadata-only fallback: Ready and direct Fulfilled dispute resolution require at least one verified contributor, and W26 blocks inconsistent legacy/indexed zero-eligible state. The cycle-open snapshot makes certificate policy predictable; cycle-less commitments use the immutable protocol 20/80 default for recognition and payment only and are not certificate eligible because they have no six-role allocation. Payment corrections remain separate from recognition. D7c and D17 draw the full expansion.",
    cites: "contract-spec.md §9.4–9.6 · settlement-spec.md §3 · Decision Log #64–#67",
  },
  {
    question: "How is gas covered for CCIP actions; can the user pay instead of the protocol?",
    verdict: "answered",
    finding:
      "The protocol pays, by design, on both legs: the Arbitrum module holds monitored native ETH for commands, the Celo executor holds monitored native CELO for acknowledgments, neither route uses LINK, and reserve floors are timelock-gated. Caller overpayment on dispatch was deliberately removed (Decision Log #52). The user-pays paths that do exist: permissionless exact-fee `retryAcknowledgment` (atomic refund on failure; the Safe is never re-invoked) and permissionless reserve top-ups (`fundFees` / `fundAcknowledgmentFees`). Transport note: Chainlink Functions was retired in the 2026-07-23 re-freeze (Decision Log #46) — the CCIP command/acknowledgment model drawn in D8–D10 is current, and the Linear mirrors (PRD-686, the Lifecycle doc) still carrying Functions wording are stale.",
    rider:
      "Follow-up worth scoping: exact-quote steward-funded dispatch, mirroring the acknowledgment-retry pattern, as a future spec change that reduces protocol subsidy. Trade-off: it reopens the caller-payment surface Decision Log #52 closed.",
    cites: "settlement-spec.md §2 decision basis, §3.1.3 fee surface, §4 independent acknowledgment · Decision Log #46/#50/#52",
  },
  {
    question: "Funds flow from the protocol safe to a garden appears manual; should it be automated?",
    verdict: "answered",
    finding:
      "The protocol pool is the root garden's ordinary commitment pool, so its commitments use the same claim → work/evidence → confirmation → Fulfilled lifecycle and the same provider-garden contributor payout plan as every other pool. The app exposes the existing plan actions from indexed state: create or edit the Draft, finalize it, then prepare frozen non-zero contributor rows. There is no sixth offline settlement job or per-device permissionless queue. The separate `queueFunding(garden, amount)` path stays in the initial version only for discretionary, non-commitment garden seeds or top-ups. It is an explicit Operations form for a current protocol steward or SettlementModule owner; deployer alone cannot submit. Success emits Funding/ProtocolToGarden with no commitment ID. HoA → protocol Safe stays an upstream treasury fact, and PRD-734 remains an external dependency.",
    riderLabel: "Scope boundary",
    rider:
      "Do not automate `queueFunding` or grant an agent/keeper value authority in this version. Earned support follows the ordinary payout-plan primitives; discretionary seeding remains an explicit treasury decision.",
    cites: "plan.todo.md Decision Log #37 / register #69 · contract-spec.md 2026-07-30 amendment · settlement-spec.md 2026-07-30 amendment · PRD-759",
  },
  {
    question: "Can the needs architecture be simplified (fewer schemas/resolvers)?",
    verdict: "answered",
    finding:
      "Answered 2026-07-27. Keep four immutable EAS schema records because Need, NeedSignal, NeedStatus, and FundingAttribution each retain a distinct payload, attester gate, volume, and schema-visible revocability policy. Deploy two UUPS resolver proxies: `NeedsResolver` (contract name shortened from `CommunityNeedsResolver`, 2026-07-31) serves Need/NeedSignal/NeedStatus through exact schema-UID dispatch, and `FundingAttributionResolver` stays separate as the only ungated branch with chain policy. EAS `recipient` is the canonical garden; child `refUID` is the Need UID; custom data no longer duplicates those relationships. NeedSignal carries only `bool support`, with latest-winner support/non-support state derived reader-side.",
    riderLabel: "Implementation lock",
    rider:
      "Root Need uses zero `refUID`; every child resolver validates an exact, same-recipient, live Need reference. All v1 attestations are non-expiring. Signal switching writes a newer attestation, clear revokes the winner, pending directions coalesce, and support/non-support counts never become a net score.",
    cites: "community-interface/spec.md decisions #13–14 + §§3.1–3.3/6 · PRD-758",
  },
  {
    question: "Do the wireframes mirror our UI prototypes?",
    verdict: "answered",
    finding:
      "Audited 2026-07-27: they did not — only 4 of 25 frames matched the hi-fi registry (five locked uiux-spec Appendix B addenda had never been absorbed, and W7’s drawn tab rail contradicted the shipped admin code). Reconciled in the same pass: all 21 divergent frames were corrected to mirror the canonical states, every frame now cites its `#screens/SCREEN@state` registry entry, and the blanket “pending sync” badge is retired — the six frames that keep a block the hi-fi does not draw carry an explicit wireframe-only tag instead.",
    cites: "wireframes.md § Hi-fi reconciliation (2026-07-27) · hifi/screens/index.ts registry · the Flow Prototypes artifact",
  },
];

const openQuestionCounts = OPEN_QUESTIONS.reduce<Record<OpenQuestionVerdict, number>>(
  (counts, entry) => {
    counts[entry.verdict] += 1;
    return counts;
  },
  { answered: 0, "answered-gap": 0, decision: 0 },
);

const openQuestionsSection = `
<section id="ref-open-questions">
  <h2>Open questions</h2>
  <p class="lede">Audited 2026-07-27 against the frozen specs, the recorded decisions, and the shipped hi-fi registry — ${openQuestionCounts.answered} answered, ${openQuestionCounts["answered-gap"]} answered with an open gap, and ${openQuestionCounts.decision} parked as a decision with the evidence laid out. The questions are kept verbatim; the verdict and finding sit under each.</p>
  <div class="qpanel">
    <span class="eyebrow">Audited 2026-07-27</span>
    <ol class="qfindings">
      ${OPEN_QUESTIONS.map((entry) => {
        const rider = entry.rider
          ? `<p class="qrec"><strong>${esc(entry.riderLabel ?? "Recommendation")}.</strong> ${inline(entry.rider)}</p>`
          : "";
        return `<li>
        <p class="qq">${esc(entry.question)} <span class="qtag qtag-${entry.verdict}">${VERDICT_LABEL[entry.verdict]}</span></p>
        <p class="qfind">${inline(entry.finding)}</p>${rider}
        <p class="qcite">${inline(entry.cites)}</p>
      </li>`;
      }).join("\n      ")}
    </ol>
  </div>
</section>`;

const archNav = `<a href="#arch-intro">How to read this set</a>${diaOut.nav}`;
const archBody = `${archIntro}\n${diaOut.body}`;
const refNav = `<a href="#ref-open-questions">Open questions</a>${refOut.nav}`;
const refBody = `${openQuestionsSection}\n${refOut.body}`;

// Counted, never typed by hand — the masthead line is clamped to two lines and a
// stale number there is the kind of drift nobody notices.
const storyAssetCount = storyBody.split("<section").length - 1;
const archDiagramCount = (diaOut.body.match(/class="mermaid"/g) || []).length;

// ---------- Artifact body-content (the publisher owns doctype/html/head/body) ----------
const artifactContent = `
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Commitment Pooling — Visual Asset Gallery</title>
<style>
:root{
  color-scheme:light;
  /* Measured from the sticky masthead at runtime; every sticky offset and anchor
     scroll-margin derives from it, so tightening the header cannot desync them. */
  --header-h:96px;
  --paper:#FBF8F2; --panel:#FFFFFF; --ink:#2A2722; --stone:#6E6857; --line:#E4DDD0;
  --moss:#4C7A57; --moss-tint:#DFEBDE; --moss-ink:#24422E; --sand:#988D77;
  --diagram-paper:#FBF8F2; --diagram-ink:#2A2722; --diagram-stone:#6E6857;
  --diagram-fill:#EEF5E7; --diagram-border:#3E7C59; --diagram-line:#6E6857;
  --diagram-note:#F7EBDD; --diagram-note-border:#B66A3C;
  --diagram-planned-fill:#F4EFE6; --diagram-planned-border:#6E6857;
  --diagram-app-fill:#F1ECE3; --diagram-app-border:#8A7F6A;
  --frame-bg:#FFFFFF;
}
@media (prefers-color-scheme: dark){
  :root{ color-scheme:dark; --paper:#201E1A; --panel:#2A2722; --ink:#EDE7DB; --stone:#B0A794; --line:#3D382F;
         --moss:#7FA88B; --moss-tint:#2F3A31; --moss-ink:#CBDDCF; --sand:#8A7F6A;
         --diagram-paper:#2A2722; --diagram-ink:#EDE7DB; --diagram-stone:#B0A794;
         --diagram-fill:#2F3A31; --diagram-border:#7FA88B; --diagram-line:#B0A794;
         --diagram-note:#3A2D25; --diagram-note-border:#C78660;
         --diagram-planned-fill:#332F29; --diagram-planned-border:#B0A794;
         --diagram-app-fill:#302D28; --diagram-app-border:#8A7F6A; }
}
:root[data-theme="dark"]{ color-scheme:dark; --paper:#201E1A; --panel:#2A2722; --ink:#EDE7DB; --stone:#B0A794; --line:#3D382F;
         --moss:#7FA88B; --moss-tint:#2F3A31; --moss-ink:#CBDDCF; --sand:#8A7F6A;
         --diagram-paper:#2A2722; --diagram-ink:#EDE7DB; --diagram-stone:#B0A794;
         --diagram-fill:#2F3A31; --diagram-border:#7FA88B; --diagram-line:#B0A794;
         --diagram-note:#3A2D25; --diagram-note-border:#C78660;
         --diagram-planned-fill:#332F29; --diagram-planned-border:#B0A794;
         --diagram-app-fill:#302D28; --diagram-app-border:#8A7F6A; }
:root[data-theme="light"]{ color-scheme:light; --paper:#FBF8F2; --panel:#FFFFFF; --ink:#2A2722; --stone:#6E6857; --line:#E4DDD0;
         --moss:#4C7A57; --moss-tint:#DFEBDE; --moss-ink:#24422E; --sand:#988D77;
         --diagram-paper:#FBF8F2; --diagram-ink:#2A2722; --diagram-stone:#6E6857;
         --diagram-fill:#EEF5E7; --diagram-border:#3E7C59; --diagram-line:#6E6857;
         --diagram-note:#F7EBDD; --diagram-note-border:#B66A3C;
         --diagram-planned-fill:#F4EFE6; --diagram-planned-border:#6E6857;
         --diagram-app-fill:#F1ECE3; --diagram-app-border:#8A7F6A; }
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
  font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;}
.skip-link{position:fixed;top:.5rem;left:.5rem;z-index:50;transform:translateY(-180%);
  background:var(--panel);color:var(--ink);border:2px solid var(--moss);border-radius:8px;
  padding:.55rem .8rem;font-weight:600;}
.skip-link:focus{transform:translateY(0);}
header.top{position:sticky;top:0;z-index:30;background:var(--paper);border-bottom:1px solid var(--line);
  padding:0.55rem 1.25rem 0;}
.mast{max-width:1440px;margin:0 auto;}
.mast h1{font-family:"Iowan Old Style",Palatino,Georgia,serif;font-size:1.24rem;margin:0;line-height:1.2;
  letter-spacing:.01em;text-wrap:balance;}
/* Two lines is the contract, not an aspiration: the clamp holds even if the
   source counts in the subtitle grow. */
.mast .sub{color:var(--stone);font-size:.78rem;line-height:1.45;margin:.15rem 0 .45rem;max-width:104ch;
  display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;overflow:hidden;}
.mast .sub code{white-space:nowrap;}
/* Wrapping, never clipping: a fourth tab must not become unreachable on a phone. */
nav.tabs{display:flex;flex-wrap:wrap;gap:.25rem;max-width:1440px;margin:0 auto;}
nav.tabs button{appearance:none;border:0;background:none;color:var(--stone);font:inherit;font-size:.95rem;
  padding:.5rem .9rem;border-radius:10px 10px 0 0;cursor:pointer;border-bottom:2.5px solid transparent;}
nav.tabs button[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--moss);font-weight:600;}
nav.tabs button:focus-visible{outline:2px solid var(--moss);outline-offset:2px;}
main{max-width:1440px;margin:0 auto;padding:1.25rem;display:grid;grid-template-columns:220px minmax(0,1fr);gap:1.75rem;}
@media (max-width:860px){ main{grid-template-columns:minmax(0,1fr);} aside.toc{display:none;} }
aside.toc{position:sticky;top:calc(var(--header-h) + .6rem);align-self:start;
  max-height:calc(100dvh - var(--header-h) - 1.6rem);overflow-y:auto;overscroll-behavior:contain;
  font-size:.8rem;padding-right:.5rem;}
aside.toc a{display:block;color:var(--stone);text-decoration:none;padding:.18rem .5rem;border-left:2px solid var(--line);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
aside.toc a:hover{color:var(--ink);border-left-color:var(--sand);}
aside.toc a:focus-visible{outline:2px solid var(--moss);outline-offset:-2px;border-radius:0 6px 6px 0;}
aside.toc a.sub{padding-left:1.1rem;font-size:.94em;opacity:.85;}
/* Scrollspy: the section currently under the masthead. */
aside.toc a.is-current{color:var(--moss-ink);background:var(--moss-tint);border-left-color:var(--moss);
  border-radius:0 7px 7px 0;font-weight:600;opacity:1;}
/* overflow:hidden here made the host a scroll container, which silently pinned every
   sticky table header to a box that never scrolls. clip still contains a sideways
   blowout but establishes no scrollport, so thead can stick to the masthead. */
.paneshost{position:relative;min-width:0;overflow-x:clip;overflow-y:visible;}
.pane{min-width:0;}
.pane[aria-hidden="true"]{position:absolute;inset:0;width:100%;height:1px;overflow:hidden;visibility:hidden;pointer-events:none;}
section{margin:0 0 2.6rem;}
h1,h2,h3{font-family:"Iowan Old Style",Palatino,Georgia,serif;line-height:1.25;text-wrap:balance;}
h1{font-size:1.7rem;margin:.2rem 0 .8rem;}
h2{font-size:1.35rem;margin:2.2rem 0 .6rem;padding-top:.4rem;}
h3{font-size:1.1rem;margin:1.6rem 0 .5rem;}
h4{font-size:.95rem;margin:1.2rem 0 .4rem;}
/* Enum runs and file paths are single unbreakable words far wider than a phone
   column, so body copy has to be allowed to break them rather than clip them. */
p{max-width:72ch;margin:.55rem 0;overflow-wrap:break-word;}
p.lede{color:var(--stone);}
ul,ol{max-width:72ch;padding-left:1.35rem;}
li{margin:.3rem 0;overflow-wrap:break-word;}
blockquote p{overflow-wrap:break-word;}
a{color:var(--moss);overflow-wrap:anywhere;}
code{background:var(--moss-tint);color:var(--moss-ink);border-radius:5px;padding:.08em .35em;
  font:.86em ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere;}
blockquote{border-left:3px solid var(--sand);margin:.8rem 0;padding:.15rem 1rem;color:var(--stone);}
hr{border:0;border-top:1px solid var(--line);margin:2rem 0;}
.howto{background:var(--moss-tint);color:var(--moss-ink);border-radius:12px;padding: .8rem 1rem;
  margin:.7rem 0 1rem;max-width:calc(72ch + 2rem);font-size:.95rem;}
.howto code{background:rgba(255,255,255,.5);}
:root[data-theme="dark"] .howto code{background:rgba(0,0,0,.25);}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]) .howto code{background:rgba(0,0,0,.25);}
}
/* overscroll-behavior must stay per-axis. Blink treats a scroll container with
   "contain" on the block axis as blocking scroll chaining even when it has nothing
   to scroll, which trapped the page under every diagram the pointer crossed.
   Inline stays contained so sideways panning never drags the page with it. */
.dia{container-type:inline-size;background:var(--diagram-paper);border:1px solid var(--line);border-radius:14px;
  padding:1rem;overflow-x:auto;overflow-y:auto;
  overscroll-behavior-inline:contain;overscroll-behavior-block:auto;margin:.9rem 0;}
.dia .mermaid{margin:0;display:flex;justify-content:center;color:var(--diagram-ink);}
.dia .mermaid.is-rendering{min-height:18rem;align-items:center;color:transparent;font-size:0;}
.dia .mermaid.is-rendering::before{content:"Drawing diagram…";color:var(--diagram-stone);font:600 .82rem/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;}
.dia .mermaid-host{width:100%;}
.dia .mermaid-rendered{display:grid;place-items:center;width:100%;min-width:0;overflow:hidden;}
.dia .mermaid-rendered svg{display:block;flex:none;min-width:0!important;max-width:none!important;height:auto;}
.dia svg{background:var(--diagram-paper)!important;color:var(--diagram-ink)!important;}
.dia svg .diagram-background{fill:var(--diagram-paper)!important;}
.dia svg text,.dia svg text>tspan,.dia svg .nodeLabel,.dia svg .nodeLabel p,.dia svg .edgeLabel,.dia svg .edgeLabel p{
  color:var(--diagram-ink)!important;fill:var(--diagram-ink)!important;}
.dia svg .node rect,.dia svg .node circle,.dia svg .node ellipse,.dia svg .node polygon,.dia svg .node path,
.dia svg .statediagram-state rect,.dia svg .stateGroup rect,.dia svg .entityBox,
.dia svg .attributeBoxOdd,.dia svg .attributeBoxEven,.dia svg .row-rect-odd,.dia svg .row-rect-even{
  fill:var(--diagram-fill)!important;stroke:var(--diagram-border)!important;}
.dia svg .cluster rect,.dia svg .cluster polygon,.dia svg .stateGroup .composit,.dia svg .statediagram .outer-path{
  fill:var(--diagram-paper)!important;stroke:var(--diagram-stone)!important;}
.dia svg .edgeLabel rect,.dia svg .edgeLabel .labelBkg,.dia svg .relationshipLabelBox{
  fill:var(--diagram-paper)!important;background:var(--diagram-paper)!important;}
.dia svg .edgePath path,.dia svg path.flowchart-link,.dia svg .transition,.dia svg .relationshipLine,
.dia svg .divider{
  stroke:var(--diagram-line)!important;}
.dia svg marker path,.dia svg .marker,.dia svg .arrowheadPath,.dia svg .arrowMarkerPath,
.dia svg .state-start,.dia svg .state-end{
  fill:var(--diagram-line)!important;stroke:var(--diagram-line)!important;}
.dia svg .actor{fill:var(--diagram-paper)!important;stroke:var(--diagram-border)!important;}
.dia svg .actor-line{stroke:var(--diagram-line)!important;}
.dia svg .messageLine0,.dia svg .messageLine1,.dia svg .loopLine{stroke:var(--diagram-ink)!important;}
.dia svg .messageText,.dia svg .labelText,.dia svg .labelText>tspan,
.dia svg .loopText,.dia svg .loopText>tspan,.dia svg .noteText,.dia svg .noteText>tspan,
.dia svg .sequenceNumber{fill:var(--diagram-ink)!important;}
.dia svg .labelBox{fill:var(--diagram-fill)!important;stroke:var(--diagram-border)!important;}
.dia svg .note{fill:var(--diagram-note)!important;stroke:var(--diagram-note-border)!important;}
.dia svg .activation0,.dia svg .activation1,.dia svg .activation2{
  fill:var(--diagram-fill)!important;stroke:var(--diagram-border)!important;}
.diagram-render-error{margin:.25rem 0 .75rem;padding:.65rem .8rem;border:1px solid #B66A3C;border-radius:10px;background:#FFF7ED;color:#713D24;font-size:.86rem;}
.dia pre.mermaid-error{display:block;white-space:pre;width:max-content;min-width:100%;font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;}
.framewrap{overflow-x:auto;overscroll-behavior-inline:contain;overscroll-behavior-block:auto;margin:.9rem 0;}
/* Tables carry no scroll container on desktop, which is what lets the header row
   stick to the masthead instead of to a wrapper that never scrolls. Below the TOC
   breakpoint the wrapper becomes the sideways escape hatch so the page itself
   still never scrolls horizontally. */
.tablewrap{margin:.9rem 0;}
@media (max-width:860px){
  .tablewrap{overflow-x:auto;overscroll-behavior-inline:contain;overscroll-behavior-block:auto;}
}
pre.frame{background:#FFFFFF;color:#2A2722;border:1px solid var(--line);border-radius:14px;padding:1rem 1.2rem;
  font:12.5px/1.42 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;width:max-content;min-width:100%;}
pre.code{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:1rem 1.2rem;
  font:12.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;}
table{border-collapse:collapse;width:100%;font-size:.79rem;line-height:1.45;
  font-variant-numeric:tabular-nums;}
/* break-word, not anywhere: "anywhere" zeroes a column's min-content width, which let
   the auto layout squeeze short headings into "Audienc / e". break-word keeps each
   column at least as wide as its longest word and still breaks the long code tokens. */
th,td{border:1px solid var(--line);padding:.34rem .5rem;text-align:left;vertical-align:top;
  overflow-wrap:break-word;}
td code,th code{overflow-wrap:anywhere;font-size:.9em;padding:.05em .25em;}
/* A collapsed border does not paint on a stuck cell, so the header's edges are
   drawn with a shadow instead. */
thead th{position:sticky;top:var(--header-h);z-index:2;background:var(--moss-tint);color:var(--moss-ink);
  box-shadow:0 1px 0 var(--line),0 -1px 0 var(--line);}
@media (max-width:860px){
  table{font-size:.74rem;}
  th,td{padding:.3rem .4rem;}
}
.svgcard{background:#FBF8F2;border:1px solid var(--line);border-radius:16px;padding:.6rem;margin:1rem 0;
  overflow-x:auto;overscroll-behavior-inline:contain;overscroll-behavior-block:auto;}
.svgcard,.dia,.framewrap{position:relative;}
.previewable{cursor:zoom-in;}
.previewable:focus-visible{outline:3px solid var(--moss);outline-offset:3px;}
.expand-control{position:sticky;top:.4rem;left:calc(100% - 6rem);z-index:5;display:flex;align-items:center;justify-content:center;gap:.35rem;
  width:5.8rem;min-height:44px;margin:.15rem .15rem -3rem auto;padding:.45rem .6rem;border:1px solid var(--line);
  border-radius:999px;background:var(--panel);color:var(--ink);box-shadow:0 3px 12px rgba(42,39,34,.14);
  font:600 .78rem/1 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;cursor:zoom-in;}
.expand-control:hover{border-color:var(--moss);color:var(--moss-ink);background:var(--moss-tint);}
.expand-control:focus-visible,.preview-controls button:focus-visible{outline:3px solid var(--moss);outline-offset:2px;}
svg.asset{width:100%;min-width:0;height:min(78dvh,820px);display:block;}
/* A 720px floor inside a ~350px card showed the left quarter of each asset — usually
   empty canvas — so a phone landed on a blank box and had to pan to find the drawing.
   Fit the whole composition instead and let Expand carry detailed reading, which is
   already how the architecture diagrams behave at every width. */
@media (max-width:860px){svg.asset{width:100%;min-width:0;height:auto;}}
.preview-dialog{width:100vw;max-width:none;height:100dvh;max-height:none;margin:0;padding:0;border:0;
  background:var(--paper);color:var(--ink);overflow:hidden;}
.preview-dialog::backdrop{background:rgba(42,39,34,.76);}
.preview-shell{height:100dvh;display:grid;grid-template-rows:auto minmax(0,1fr);}
.preview-bar{display:flex;align-items:center;justify-content:space-between;gap:.75rem;padding:.35rem .65rem;
  border-bottom:1px solid var(--line);background:var(--panel);}
.preview-caption{min-width:0;margin:0;font:600 1rem/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.preview-controls{display:flex;align-items:center;gap:.35rem;flex:0 0 auto;}
.preview-controls button{appearance:none;min-width:44px;min-height:44px;padding:.4rem .65rem;border:1px solid var(--line);
  border-radius:9px;background:var(--paper);color:var(--ink);font:600 .86rem/1 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;cursor:pointer;}
.preview-controls button:hover{border-color:var(--moss);background:var(--moss-tint);color:var(--moss-ink);}
.preview-zoom{min-width:3.7rem;color:var(--stone);font:600 .78rem/1 ui-monospace,SFMono-Regular,Menlo,monospace;text-align:center;}
.preview-viewport{min-width:0;min-height:0;overflow:auto;overscroll-behavior:contain;padding:.25rem .5rem .5rem;touch-action:pan-x pan-y;}
.preview-viewport.is-pannable{cursor:grab;touch-action:none;}
.preview-viewport.is-dragging{cursor:grabbing;user-select:none;}
.preview-stage{display:grid;place-items:center;width:max-content;height:max-content;min-width:100%;min-height:100%;}
.preview-canvas{position:relative;flex:none;}
.preview-item{position:absolute;top:0;left:0;display:block;max-width:none!important;min-width:0!important;
  transform-origin:top left;user-select:none;}
pre.preview-item{margin:0;padding:1rem 1.2rem;border:1px solid var(--line);border-radius:14px;background:#FFFFFF;
  color:#2A2722;white-space:pre;font:12.5px/1.42 ui-monospace,SFMono-Regular,Menlo,monospace;}
@media (max-width:700px){
  .preview-bar{align-items:flex-start;flex-direction:column;gap:.5rem;padding:.55rem .7rem;}
  .preview-caption{width:100%;}
  .preview-controls{width:100%;overflow-x:auto;}
  .preview-controls button{flex:0 0 auto;}
  .preview-viewport{padding:.25rem .4rem .4rem;}
}
/* ---- gallery chrome ---- */
/* Status legend. The swatches are painted from the same tokens the diagrams use,
   so the key cannot drift away from what it describes. */
ul.legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(15rem,1fr));gap:.45rem 1.1rem;
  margin:.85rem 0 1.2rem;padding:0;list-style:none;max-width:none;}
ul.legend li{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:.6rem;margin:0;
  font-size:.83rem;line-height:1.45;}
.legend .sw{width:1.6rem;height:1.05rem;border-radius:5px;margin-top:.18rem;
  border:2px solid var(--diagram-border);background:var(--diagram-fill);}
.legend .sw-planned{background:var(--diagram-planned-fill);border-color:var(--diagram-planned-border);border-style:dashed;}
.legend .sw-delta{background:var(--diagram-paper);border-color:var(--diagram-border);}
.legend .sw-derived{background:var(--diagram-note);border-color:var(--diagram-note-border);}
.legend .sw-app{background:var(--diagram-app-fill);border-color:var(--diagram-app-border);}
.legend b{color:var(--ink);}
.legend span{color:var(--stone);}
/* Where-to-look map for the 23 diagrams. */
ul.wayfind{display:grid;grid-template-columns:repeat(auto-fit,minmax(21rem,1fr));gap:.4rem 1.5rem;
  margin:.8rem 0 1.2rem;padding:0;list-style:none;max-width:none;}
ul.wayfind li{display:grid;grid-template-columns:minmax(7rem,auto) minmax(0,1fr);gap:.75rem;margin:0;
  align-items:baseline;font-size:.83rem;line-height:1.5;}
.wayfind b{color:var(--ink);white-space:nowrap;}
.wayfind span{color:var(--stone);}
/* Open questions — decisions parked for their owners, not answered here. */
.qpanel{border:1px solid var(--line);background:var(--panel);border-radius:14px;padding:1rem 1.15rem;
  margin:.9rem 0 1.5rem;}
.qpanel .eyebrow{display:block;margin:0 0 .35rem;color:var(--stone);text-transform:uppercase;letter-spacing:.09em;
  font:600 .68rem/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;}
.qpanel p{margin:0;max-width:70ch;}
.qpanel ol{margin:.7rem 0 0;padding-left:1.35rem;max-width:76ch;}
.qpanel li{margin:.42rem 0;}
.qpanel li::marker{color:var(--stone);font-variant-numeric:tabular-nums;}
/* Findings layout: question (verbatim) + verdict pill, finding, optional rider,
   compact citation line. All tokens; dark theme comes free. */
ol.qfindings{max-width:none;}
.qfindings li{margin:1rem 0;}
.qfindings .qq{font-weight:600;color:var(--ink);max-width:76ch;margin:0;}
.qtag{display:inline-block;margin-left:.45rem;padding:.06rem .5rem;border:1px solid var(--sand);
  border-radius:999px;background:var(--paper);color:var(--stone);vertical-align:middle;white-space:nowrap;
  font:600 .66rem/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;letter-spacing:.02em;}
.qtag-answered{background:var(--moss-tint);border-color:var(--moss);color:var(--moss-ink);}
.qtag-answered-gap{background:var(--diagram-note);border-color:var(--diagram-note-border);color:var(--ink);}
.qtag-decision{background:var(--paper);border-color:var(--sand);color:var(--stone);}
.qfind{margin:.3rem 0 0;max-width:76ch;}
.qrec{margin:.45rem 0 0;padding:.1rem 0 .1rem .75rem;border-left:3px solid var(--moss);max-width:76ch;}
.qcite{margin:.35rem 0 0;color:var(--stone);font-size:.78rem;max-width:none;}
/* Wireframe accuracy caveat, carried on every screen heading. */
.wf-badge{display:inline-block;margin-left:.5rem;padding:.08rem .5rem;border:1px solid var(--sand);
  border-radius:999px;background:var(--paper);color:var(--stone);vertical-align:middle;white-space:nowrap;
  font:600 .66rem/1.75 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;letter-spacing:.02em;}
footer{color:var(--stone);font-size:.78rem;text-align:center;padding:2rem 1rem 3rem;}
@media (prefers-reduced-motion: no-preference){
  .expand-control,.preview-controls button{transition:background-color .14s ease,border-color .14s ease,color .14s ease;}
  aside.toc a{transition:background-color .12s ease,color .12s ease,border-color .12s ease;}
}
/* Sub-block h4s are nav destinations too, so they need the same anchor offset. */
section,h4[id]{scroll-margin-top:calc(var(--header-h) + 1rem);}
/* On a phone the masthead is sticky overhead the reader carries for the whole
   document, so it earns its height back: smaller type, tighter padding, and four
   tabs sized to sit on one row. */
@media (max-width:560px){
  header.top{padding:.45rem .9rem 0;}
  .mast h1{font-size:1.06rem;}
  .mast .sub{font-size:.72rem;margin:.1rem 0 .3rem;}
  nav.tabs button{padding:.4rem .5rem;font-size:.8rem;}
  main{padding:.9rem;}
  /* The control overlays the corner of the artwork, which is free space on a wide
     card and directly on top of the drawing on a phone. Give it its own row there. */
  .expand-control{position:static;width:max-content;margin:.1rem .1rem .4rem auto;
    left:auto;padding:.4rem .75rem;}
}
</style>
<a class="skip-link" href="#content">Skip to gallery content</a>
<header class="top">
  <div class="mast">
    <h1>Commitment Pooling — Visual Asset Gallery</h1>
    <p class="sub">Green Goods · ${storyAssetCount} hand-drawn story assets · ${archDiagramCount} architecture diagrams · ${wfScreenCount} wireframe screens · source: <code>.plans/active/commitment-pooling/</code></p>
  </div>
  <nav class="tabs" role="tablist" aria-label="Gallery sections">
    <button id="tab-story" role="tab" aria-selected="true" aria-controls="pane-story" tabindex="0" data-tab="story">The story</button>
    <button id="tab-arch" role="tab" aria-selected="false" aria-controls="pane-arch" tabindex="-1" data-tab="arch">Architecture</button>
    <button id="tab-screens" role="tab" aria-selected="false" aria-controls="pane-screens" tabindex="-1" data-tab="screens">Screens</button>
    <button id="tab-reference" role="tab" aria-selected="false" aria-controls="pane-reference" tabindex="-1" data-tab="reference">Reference</button>
  </nav>
</header>
<main id="content" tabindex="-1">
  <aside class="toc" id="toc" aria-label="Section navigation"></aside>
  <div class="paneshost">
    <div class="pane" id="pane-story" role="tabpanel" aria-labelledby="tab-story" aria-hidden="false" data-nav='${storyNav.replace(/'/g, "&#39;")}'>
      ${storyBody}
    </div>
    <div class="pane" id="pane-arch" role="tabpanel" aria-labelledby="tab-arch" aria-hidden="true" inert data-nav='${archNav.replace(/'/g, "&#39;")}'>
      ${archBody}
    </div>
    <div class="pane" id="pane-screens" role="tabpanel" aria-labelledby="tab-screens" aria-hidden="true" inert data-nav='${wfOut.nav.replace(/'/g, "&#39;")}'>
      ${wfOut.body}
    </div>
    <div class="pane" id="pane-reference" role="tabpanel" aria-labelledby="tab-reference" aria-hidden="true" inert data-nav='${refNav.replace(/'/g, "&#39;")}'>
      ${refBody}
    </div>
  </div>
</main>
<dialog id="asset-preview" class="preview-dialog" role="dialog" aria-modal="true" aria-labelledby="preview-caption">
  <div class="preview-shell">
    <header class="preview-bar">
      <h2 id="preview-caption" class="preview-caption">Diagram preview</h2>
      <div class="preview-controls" aria-label="Preview controls">
        <button type="button" data-preview-action="minus" aria-label="Zoom out">−</button>
        <output id="preview-zoom" class="preview-zoom" aria-live="polite">100%</output>
        <button type="button" data-preview-action="plus" aria-label="Zoom in">＋</button>
        <button type="button" data-preview-action="fit">Fit</button>
        <button type="button" data-preview-action="actual">1:1</button>
        <button type="button" data-preview-action="close" aria-label="Close preview">Close</button>
      </div>
    </header>
    <div id="preview-viewport" class="preview-viewport" tabindex="0" aria-label="Scrollable diagram preview">
      <div class="preview-stage"><div id="preview-canvas" class="preview-canvas"></div></div>
    </div>
  </div>
</dialog>
<footer>Green Goods · Commitment Pooling visual assets · execution reference — diagrams introduce nothing the specs don't define.<br>Vocabulary source: the ontology sidecar <code>packages/shared/src/ontology/green-goods-ontology.json</code> — every state and enum label maps 1:1 onto a canonical member. Paper = on-chain · amber = derived by the indexer · grey = app-only.</footer>
<script>
(function(){
  var requestedTheme = new URLSearchParams(window.location.search).get('theme');
  if (requestedTheme === 'light' || requestedTheme === 'dark') document.documentElement.dataset.theme = requestedTheme;
  var tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  var panes = Array.from(document.querySelectorAll('[role="tabpanel"]'));
  var toc = document.getElementById('toc');
  var preview = document.getElementById('asset-preview');
  var previewViewport = document.getElementById('preview-viewport');
  var previewCanvas = document.getElementById('preview-canvas');
  var previewCaption = document.getElementById('preview-caption');
  var previewZoom = document.getElementById('preview-zoom');
  var previewState = { scale: 1, fitScale: 1, width: 1, height: 1, item: null, lastTrigger: null, drag: null, mode: 'fit' };
  var overviewFrame = 0;
  var galleryThemeMedia = window.matchMedia('(prefers-color-scheme: dark)');

  function clamp(value, min, max){ return Math.min(max, Math.max(min, value)); }

  function previewSource(container){
    return container.querySelector('svg.asset') || (container.matches('.dia') ? container.querySelector('svg') : null) || container.querySelector('pre.frame');
  }

  function previewLabel(container){
    var explicit = container.getAttribute('data-label');
    if (explicit) return explicit;
    var previous = container.previousElementSibling;
    while (previous) {
      if (previous.matches('h4')) return previous.textContent.trim();
      previous = previous.previousElementSibling;
    }
    var section = container.closest('section');
    var heading = section && section.querySelector('h2,h3,h4');
    return heading ? heading.textContent.trim() : 'Diagram preview';
  }

  function resolvedGalleryTheme(){
    var explicit = document.documentElement.dataset.theme;
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return galleryThemeMedia.matches ? 'dark' : 'light';
  }

  function uniqueDocumentId(base, element){
    var candidate = base;
    var suffix = 1;
    while (document.getElementById(candidate) && document.getElementById(candidate) !== element) {
      candidate = base + '-' + suffix;
      suffix += 1;
    }
    return candidate;
  }

  function normalizeMermaidClass(root, fill, stroke, dash){
    var shapes = (root.matches('rect,circle,ellipse,polygon,path') ? [root] : [])
      .concat(Array.from(root.querySelectorAll('rect,circle,ellipse,polygon,path')));
    shapes.forEach(function(shape){
      shape.style.setProperty('fill', fill, 'important');
      shape.style.setProperty('stroke', stroke, 'important');
      shape.style.setProperty('stroke-width', '2px', 'important');
      if (dash) shape.style.setProperty('stroke-dasharray', dash, 'important');
      else shape.style.removeProperty('stroke-dasharray');
    });
    var labels = (root.matches('text,tspan,.nodeLabel,.nodeLabel p,foreignObject div,foreignObject span,foreignObject p') ? [root] : [])
      .concat(Array.from(root.querySelectorAll('text,tspan,.nodeLabel,.nodeLabel p,foreignObject div,foreignObject span,foreignObject p')));
    labels.forEach(function(label){
      label.style.setProperty('color', 'var(--diagram-ink)', 'important');
      label.style.setProperty('fill', 'var(--diagram-ink)', 'important');
    });
  }

  function normalizeGalleryMermaidClasses(svg){
    Array.from(svg.querySelectorAll('.built')).forEach(function(root){
      normalizeMermaidClass(root, 'var(--diagram-fill)', 'var(--diagram-border)', '');
    });
    Array.from(svg.querySelectorAll('.planned')).forEach(function(root){
      normalizeMermaidClass(root, 'var(--diagram-planned-fill)', 'var(--diagram-planned-border)', '6 4');
    });
    Array.from(svg.querySelectorAll('.derived')).forEach(function(root){
      normalizeMermaidClass(root, 'var(--diagram-note)', 'var(--diagram-note-border)', '');
    });
    Array.from(svg.querySelectorAll('.appOnly,.apponly')).forEach(function(root){
      normalizeMermaidClass(root, 'var(--diagram-app-fill)', 'var(--diagram-app-border)', '');
    });
    Array.from(svg.querySelectorAll('.onchain')).forEach(function(root){
      normalizeMermaidClass(root, 'var(--diagram-fill)', 'var(--diagram-border)', '');
    });
  }

  function prepareGalleryMermaidSvg(svg, container, index){
    var theme = resolvedGalleryTheme();
    if (svg.dataset.galleryPrepared === 'true') {
      svg.dataset.diagramTheme = theme;
      normalizeGalleryMermaidClasses(svg);
      return;
    }

    uniquifyCloneIds(svg, 'cp-gallery-mermaid-' + (index + 1));
    var label = previewLabel(container);
    var children = Array.from(svg.children);
    var title = children.find(function(child){ return child.tagName.toLowerCase() === 'title'; });
    var desc = children.find(function(child){ return child.tagName.toLowerCase() === 'desc'; });
    if (!title) {
      title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = label;
      svg.prepend(title);
    } else if (!title.textContent.trim()) {
      title.textContent = label;
    }
    if (!desc) {
      desc = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
      desc.textContent = 'Rendered architecture diagram. The surrounding section explains how to read it.';
      title.after(desc);
    }
    title.id = title.id || uniqueDocumentId('cp-gallery-mermaid-' + (index + 1) + '-title', title);
    desc.id = desc.id || uniqueDocumentId('cp-gallery-mermaid-' + (index + 1) + '-desc', desc);

    var viewBox = svg.viewBox && svg.viewBox.baseVal;
    if (viewBox && viewBox.width && viewBox.height && !svg.querySelector('.diagram-background')) {
      var background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('class', 'diagram-background');
      background.setAttribute('x', String(viewBox.x));
      background.setAttribute('y', String(viewBox.y));
      background.setAttribute('width', String(viewBox.width));
      background.setAttribute('height', String(viewBox.height));
      background.setAttribute('fill', 'var(--diagram-paper)');
      background.setAttribute('aria-hidden', 'true');
      background.setAttribute('pointer-events', 'none');
      var firstGraphic = Array.from(svg.children).find(function(child){
        return !['title', 'desc', 'defs', 'style'].includes(child.tagName.toLowerCase());
      });
      svg.insertBefore(background, firstGraphic || null);
    }

    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-labelledby', title.id + ' ' + desc.id);
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.removeAttribute('aria-label');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.removeProperty('max-width');
    svg.style.backgroundColor = 'var(--diagram-paper)';
    svg.dataset.diagramTheme = theme;
    svg.dataset.galleryPrepared = 'true';
    normalizeGalleryMermaidClasses(svg);
    container.setAttribute('data-label', label);
  }

  function prepareGalleryMermaidSvgs(){
    Array.from(document.querySelectorAll('.dia svg')).forEach(function(svg, index){
      var container = svg.closest('.dia');
      if (container) prepareGalleryMermaidSvg(svg, container, index);
    });
  }

  function syncGalleryMermaidTheme(){
    var theme = resolvedGalleryTheme();
    Array.from(document.querySelectorAll('.dia svg[data-gallery-prepared="true"]')).forEach(function(svg){
      svg.dataset.diagramTheme = theme;
      normalizeGalleryMermaidClasses(svg);
    });
  }

  function uniquifyCloneIds(root, namespace){
    var map = {};
    var prefix = namespace || ('preview-' + Date.now());
    var nodesWithIds = (root.id ? [root] : []).concat(Array.from(root.querySelectorAll('[id]')));
    nodesWithIds.forEach(function(node, index){
      var oldId = node.id;
      var newId = prefix + '-' + index + '-' + oldId;
      map[oldId] = newId;
      node.id = newId;
    });
    Array.from(root.querySelectorAll('*')).concat([root]).forEach(function(node){
      Array.from(node.attributes || []).forEach(function(attribute){
        var value = attribute.value;
        Object.keys(map).forEach(function(oldId){
          value = value.split('url(#' + oldId + ')').join('url(#' + map[oldId] + ')');
          if ((attribute.name === 'href' || attribute.name === 'xlink:href') && value === '#' + oldId) value = '#' + map[oldId];
          if (attribute.name === 'aria-labelledby' || attribute.name === 'aria-describedby') {
            value = value.split(/\\s+/).map(function(token){ return token === oldId ? map[oldId] : token; }).join(' ');
          }
        });
        if (value !== attribute.value) node.setAttribute(attribute.name, value);
      });
    });
    Array.from(root.querySelectorAll('style')).forEach(function(style){
      var css = style.textContent || '';
      Object.keys(map).sort(function(a, b){ return b.length - a.length; }).forEach(function(oldId){
        css = css.split('#' + oldId).join('#' + map[oldId]);
      });
      style.textContent = css;
    });
  }

  function sizeMermaidOverview(svg){
    var rendered = svg.closest('.mermaid-rendered,.mermaid,.mermaid-host') || svg.parentElement;
    var viewBox = svg && svg.viewBox && svg.viewBox.baseVal;
    var diagram = svg.closest('.dia');
    var availableWidth = rendered ? rendered.clientWidth : (diagram ? diagram.clientWidth : 0);
    if (!availableWidth && diagram) availableWidth = diagram.clientWidth;
    if (!svg || !viewBox || !viewBox.width || !viewBox.height || !availableWidth) return;
    // Fit to width, not to the viewport's height. Binding the inline view to a
    // laptop-height reading plane drove the big ERDs down to ~0.15 scale — roughly
    // two-pixel type, which reads as texture rather than as a diagram. Width-fitting
    // against an absolute height ceiling roughly doubles the worst cases and lets a
    // tall diagram simply be tall; the page scrolls past it, and Expand is still the
    // path for detailed reading.
    var MAX_INLINE_HEIGHT = 1500;
    var scale = Math.min(availableWidth / viewBox.width, MAX_INLINE_HEIGHT / viewBox.height, 1.2);
    var width = Math.max(1, viewBox.width * scale);
    var height = Math.max(1, viewBox.height * scale);
    svg.style.width = width + 'px';
    svg.style.height = height + 'px';
    if (rendered) {
      rendered.dataset.overviewScale = String(scale);
      rendered.dataset.overviewWidth = String(width);
      rendered.dataset.overviewHeight = String(height);
    }
  }

  function sizeDiagramOverviews(){
    overviewFrame = 0;
    prepareGalleryMermaidSvgs();
    Array.from(document.querySelectorAll('.dia svg')).forEach(sizeMermaidOverview);
    updateScrollableContainers();
  }

  function scheduleOverviewSizing(){
    if (overviewFrame) return;
    overviewFrame = requestAnimationFrame(sizeDiagramOverviews);
  }

  function updatePreviewScale(nextScale, pointer, mode){
    if (!previewState.item) return;
    var oldScale = previewState.scale;
    var minimumScale = previewState.fitScale > 0 ? Math.min(previewState.fitScale, 1) : Number.EPSILON;
    var next = mode === 'fit'
      ? clamp(nextScale, Number.EPSILON, 4)
      : clamp(nextScale, minimumScale, 4);
    var anchor;
    if (pointer) {
      var rect = previewViewport.getBoundingClientRect();
      anchor = {
        x: pointer.clientX - rect.left,
        y: pointer.clientY - rect.top,
        contentX: (previewViewport.scrollLeft + pointer.clientX - rect.left) / oldScale,
        contentY: (previewViewport.scrollTop + pointer.clientY - rect.top) / oldScale,
      };
    }
    previewState.scale = next;
    previewState.mode = mode || 'custom';
    previewCanvas.style.width = (previewState.width * next) + 'px';
    previewCanvas.style.height = (previewState.height * next) + 'px';
    previewState.item.style.transform = 'scale(' + next + ')';
    var percentage = next * 100;
    previewZoom.value = (percentage < 0.1 ? percentage.toFixed(2) : (percentage < 1 ? percentage.toFixed(1) : String(Math.round(percentage)))) + '%';
    previewZoom.textContent = previewZoom.value;
    requestAnimationFrame(function(){
      var pannable = previewViewport.scrollWidth > previewViewport.clientWidth + 1 || previewViewport.scrollHeight > previewViewport.clientHeight + 1;
      previewViewport.classList.toggle('is-pannable', pannable);
      if (anchor) {
        previewViewport.scrollLeft = anchor.contentX * next - anchor.x;
        previewViewport.scrollTop = anchor.contentY * next - anchor.y;
      }
    });
  }

  function fitPreview(){
    if (!previewState.item) return;
    var styles = getComputedStyle(previewViewport);
    var horizontalInset = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    var verticalInset = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    var availableWidth = Math.max(1, previewViewport.clientWidth - horizontalInset);
    var availableHeight = Math.max(1, previewViewport.clientHeight - verticalInset);
    previewState.fitScale = Math.min(4, availableWidth / previewState.width, availableHeight / previewState.height);
    updatePreviewScale(previewState.fitScale, null, 'fit');
    previewViewport.scrollLeft = 0;
    previewViewport.scrollTop = 0;
  }

  function actualSizePreview(){
    updatePreviewScale(1, null, 'actual');
    requestAnimationFrame(function(){
      previewViewport.scrollLeft = Math.max(0, (previewViewport.scrollWidth - previewViewport.clientWidth) / 2);
      previewViewport.scrollTop = 0;
    });
  }

  function openPreview(container, trigger){
    var source = previewSource(container);
    if (!source) return;
    var previewKind = source.matches('svg.asset') ? 'asset' : (source.closest('.mermaid') ? 'mermaid' : 'frame');
    var clone = source.cloneNode(true);
    uniquifyCloneIds(clone);
    clone.removeAttribute('class');
    clone.classList.add('preview-item');
    clone.setAttribute('aria-hidden', 'true');
    clone.removeAttribute('tabindex');

    var width;
    var height;
    if (source.tagName.toLowerCase() === 'svg') {
      var viewBox = source.viewBox && source.viewBox.baseVal;
      width = viewBox && viewBox.width ? viewBox.width : (parseFloat(source.getAttribute('width')) || source.getBoundingClientRect().width);
      height = viewBox && viewBox.height ? viewBox.height : (parseFloat(source.getAttribute('height')) || source.getBoundingClientRect().height);
    } else {
      width = source.scrollWidth;
      height = source.scrollHeight;
    }
    previewState.width = Math.max(1, width);
    previewState.height = Math.max(1, height);
    previewState.fitScale = 1;
    previewState.item = clone;
    previewState.lastTrigger = trigger || container;
    clone.style.width = previewState.width + 'px';
    clone.style.height = previewState.height + 'px';
    previewCanvas.replaceChildren(clone);
    preview.dataset.previewKind = previewKind;
    previewCaption.textContent = previewLabel(container);
    if (!preview.open) preview.showModal();
    requestAnimationFrame(function(){
      // Large diagrams (the architecture Mermaid set) would otherwise fit entirely,
      // leaving the viewport without overflow — which disables drag-to-pan, since
      // pointerdown gates on is-pannable. Open oversize diagrams at actual size so
      // they are legible and pannable immediately.
      var oversize = previewState.width > previewViewport.clientWidth + 2 || previewState.height > previewViewport.clientHeight + 2;
      if (oversize) actualSizePreview(); else fitPreview();
    });
  }

  function decoratePreviewables(){
    prepareGalleryMermaidSvgs();
    Array.from(document.querySelectorAll('.svgcard,.dia,.framewrap')).forEach(function(container){
      if (container.dataset.previewReady === 'true' || !previewSource(container)) return;
      container.dataset.previewReady = 'true';
      container.classList.add('previewable');
      var label = previewLabel(container);
      container.setAttribute('data-label', label);
      if (!container.hasAttribute('role')) container.setAttribute('role', 'group');
      container.setAttribute('aria-label', label);
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'expand-control';
      button.setAttribute('aria-label', 'Expand ' + label);
      button.textContent = '⤢ Expand';
      button.addEventListener('click', function(event){
        event.stopPropagation();
        openPreview(container, button);
      });
      container.prepend(button);
      container.addEventListener('click', function(event){
        if (event.target.closest('a,button')) return;
        openPreview(container, button);
      });
    });
    updateScrollableContainers();
  }

  function updateScrollableContainers(){
    Array.from(document.querySelectorAll('.previewable')).forEach(function(container){
      var label = container.getAttribute('data-label') || 'Diagram';
      var scrollable = container.scrollWidth > container.clientWidth + 1;
      if (scrollable) {
        container.tabIndex = 0;
        container.setAttribute('aria-label', label + '. Scroll horizontally for the inline view.');
      } else {
        container.removeAttribute('tabindex');
        container.setAttribute('aria-label', container.matches('.dia') ? label + '. Overview. Use Expand for a zoomable detail view.' : label);
      }
    });
  }

  // Measure the masthead instead of hard-coding its height: every sticky offset,
  // anchor scroll-margin and sticky table header reads --header-h, so they stay in
  // step when the header wraps to another row or the subtitle clamps differently.
  var headerEl = document.querySelector('header.top');
  function syncHeaderHeight(){
    if (!headerEl) return;
    var height = Math.ceil(headerEl.getBoundingClientRect().height);
    if (height > 0) document.documentElement.style.setProperty('--header-h', height + 'px');
  }

  // Scrollspy — marks the section currently sitting under the masthead.
  var spyTargets = [];
  var spyCurrent = null;
  var spyFrame = 0;

  function updateScrollspy(){
    spyFrame = 0;
    if (!spyTargets.length) return;
    var edge = (headerEl ? headerEl.getBoundingClientRect().height : 96) + 28;
    var found = spyTargets[0];
    for (var i = 0; i < spyTargets.length; i += 1) {
      if (spyTargets[i].el.getBoundingClientRect().top <= edge) found = spyTargets[i];
      else break;
    }
    // The final section can be too short to ever cross the line; at the bottom of
    // the document it is unambiguously the one being read.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      found = spyTargets[spyTargets.length - 1];
    }
    if (found === spyCurrent) return;
    if (spyCurrent) {
      spyCurrent.link.classList.remove('is-current');
      spyCurrent.link.removeAttribute('aria-current');
    }
    spyCurrent = found;
    found.link.classList.add('is-current');
    found.link.setAttribute('aria-current', 'true');
    // Keep the marker visible by scrolling the TOC's own box — never the page.
    if (!toc.clientHeight) return;
    var top = found.link.offsetTop;
    if (top < toc.scrollTop || top + found.link.offsetHeight > toc.scrollTop + toc.clientHeight) {
      toc.scrollTop = Math.max(0, top - toc.clientHeight / 2);
    }
  }

  function scheduleScrollspy(){ if (!spyFrame) spyFrame = requestAnimationFrame(updateScrollspy); }

  function buildScrollspy(){
    spyCurrent = null;
    spyTargets = Array.from(toc.querySelectorAll('a')).map(function(link){
      var id = (link.getAttribute('href') || '').slice(1);
      return { link: link, el: id ? document.getElementById(id) : null };
    }).filter(function(target){ return target.el; });
    updateScrollspy();
  }

  function activate(name, focusTab, resetScroll){
    var selectedTab;
    tabs.forEach(function(tab){
      var selected = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) selectedTab = tab;
    });
    panes.forEach(function(pane){
      var selected = pane.id === 'pane-' + name;
      pane.setAttribute('aria-hidden', String(!selected));
      pane.inert = !selected;
    });
    var pane = document.getElementById('pane-' + name);
    toc.innerHTML = pane ? (pane.getAttribute('data-nav') || '') : '';
    if (focusTab && selectedTab) selectedTab.focus();
    if (resetScroll) window.scrollTo({ top: 0 });
    requestAnimationFrame(function(){
      syncHeaderHeight();
      decoratePreviewables();
      scheduleOverviewSizing();
      buildScrollspy();
    });
  }

  tabs.forEach(function(tab, index){
    tab.addEventListener('click', function(){ activate(tab.dataset.tab, false, true); });
    tab.addEventListener('keydown', function(event){
      var next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(tabs[next].dataset.tab, true, true);
    });
  });

  Array.from(preview.querySelectorAll('[data-preview-action]')).forEach(function(button){
    button.addEventListener('click', function(){
      var action = button.dataset.previewAction;
      if (action === 'minus') updatePreviewScale(previewState.scale / 1.2);
      else if (action === 'plus') updatePreviewScale(previewState.scale * 1.2);
      else if (action === 'fit') fitPreview();
      else if (action === 'actual') actualSizePreview();
      else if (action === 'close') preview.close();
    });
  });

  preview.addEventListener('close', function(){
    previewCanvas.replaceChildren();
    previewState.item = null;
    delete preview.dataset.previewKind;
    previewViewport.classList.remove('is-pannable', 'is-dragging');
    if (previewState.lastTrigger && document.contains(previewState.lastTrigger)) previewState.lastTrigger.focus();
  });

  previewViewport.addEventListener('wheel', function(event){
    if (!preview.open) return;
    // Scroll — mouse wheel or trackpad two-finger — pans the viewport; only a pinch
    // gesture (ctrl+wheel) zooms. Keeps trackpad panning predictable.
    if (!event.ctrlKey) return;
    event.preventDefault();
    updatePreviewScale(previewState.scale * Math.exp(-event.deltaY * 0.0015), event);
  }, { passive: false });

  previewViewport.addEventListener('pointerdown', function(event){
    if (event.button !== 0 || !previewViewport.classList.contains('is-pannable')) return;
    previewState.drag = { x: event.clientX, y: event.clientY, left: previewViewport.scrollLeft, top: previewViewport.scrollTop };
    previewViewport.classList.add('is-dragging');
    previewViewport.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  previewViewport.addEventListener('pointermove', function(event){
    if (!previewState.drag) return;
    previewViewport.scrollLeft = previewState.drag.left - (event.clientX - previewState.drag.x);
    previewViewport.scrollTop = previewState.drag.top - (event.clientY - previewState.drag.y);
  });
  function endDrag(){ previewState.drag = null; previewViewport.classList.remove('is-dragging'); }
  previewViewport.addEventListener('pointerup', endDrag);
  previewViewport.addEventListener('pointercancel', endDrag);

  document.addEventListener('keydown', function(event){
    if (!preview.open || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.key === '+' || event.key === '=') { event.preventDefault(); updatePreviewScale(previewState.scale * 1.2); }
    else if (event.key === '-' || event.key === '_') { event.preventDefault(); updatePreviewScale(previewState.scale / 1.2); }
  });

  new MutationObserver(function(){ prepareGalleryMermaidSvgs(); decoratePreviewables(); scheduleOverviewSizing(); })
    .observe(document.querySelector('.paneshost'), { childList: true, subtree: true });
  new MutationObserver(function(){ syncGalleryMermaidTheme(); scheduleOverviewSizing(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (typeof galleryThemeMedia.addEventListener === 'function') galleryThemeMedia.addEventListener('change', syncGalleryMermaidTheme);
  else if (typeof galleryThemeMedia.addListener === 'function') galleryThemeMedia.addListener(syncGalleryMermaidTheme);
  document.addEventListener('mermaid:rendered', scheduleOverviewSizing);
  document.addEventListener('mermaid:themechanged', function(){
    scheduleOverviewSizing();
    if (!preview.open || preview.dataset.previewKind !== 'mermaid') return;
    var trigger = previewState.lastTrigger;
    var container = trigger && trigger.closest ? trigger.closest('.dia') : null;
    if (container) openPreview(container, trigger);
  });
  window.addEventListener('resize', scheduleOverviewSizing);
  window.addEventListener('resize', function(){
    syncHeaderHeight();
    scheduleScrollspy();
    if (preview.open && previewState.mode === 'fit') fitPreview();
  });
  window.addEventListener('scroll', scheduleScrollspy, { passive: true });
  if ('ResizeObserver' in window) {
    new ResizeObserver(scheduleOverviewSizing).observe(document.querySelector('.paneshost'));
    if (headerEl) new ResizeObserver(function(){ syncHeaderHeight(); scheduleScrollspy(); }).observe(headerEl);
  }
  syncHeaderHeight();
  decoratePreviewables();
  activate('story', false, false);
})();
</script>
`;

const styleEnd = artifactContent.indexOf("</style>") + "</style>".length;
const embeddedMermaid = `<script data-embedded-runtime="mermaid@${mermaidVersion}">
${mermaidRuntime}
</script>
<script>
(async function(){
  var blocks = Array.from(document.querySelectorAll('pre.mermaid'));
  var failures = 0;
  var renderQueue = Promise.resolve();
  var activeTheme = '';
  var themeRequest = 0;
  var themeMedia = window.matchMedia('(prefers-color-scheme: dark)');

  function diagramLabel(block, index){
    // Must agree with previewLabel(): walk back to the nearest preceding h4 so
    // sibling sub-blocks (D6.0/D6a/D6b/D6c, D7.0/D7.1/D7.2 …) get distinct
    // accessible names instead of all inheriting the section heading.
    var container = block.closest('.dia') || block;
    var previous = container.previousElementSibling;
    while (previous) {
      if (previous.matches && previous.matches('h4')) return previous.textContent.trim();
      previous = previous.previousElementSibling;
    }
    var section = block.closest('section');
    var heading = section && section.querySelector('h2,h3,h4');
    return heading ? heading.textContent.trim() : 'Architecture diagram ' + (index + 1);
  }

  function namespaceSvgIds(svg, prefix){
    var map = {};
    var nodes = (svg.id ? [svg] : []).concat(Array.from(svg.querySelectorAll('[id]')));
    nodes.forEach(function(node, index){
      var oldId = node.id;
      var newId = prefix + '-' + index + '-' + oldId;
      map[oldId] = newId;
      node.id = newId;
    });
    var ids = Object.keys(map).sort(function(a, b){ return b.length - a.length; });
    Array.from(svg.querySelectorAll('*')).concat([svg]).forEach(function(node){
      Array.from(node.attributes || []).forEach(function(attribute){
        var value = attribute.value;
        ids.forEach(function(oldId){
          value = value.split('#' + oldId).join('#' + map[oldId]);
          if (attribute.name === 'aria-labelledby' || attribute.name === 'aria-describedby') {
            value = value.split(/\\s+/).map(function(token){ return token === oldId ? map[oldId] : token; }).join(' ');
          }
        });
        if (value !== attribute.value) node.setAttribute(attribute.name, value);
      });
    });
    Array.from(svg.querySelectorAll('style')).forEach(function(style){
      var css = style.textContent || '';
      ids.forEach(function(oldId){ css = css.split('#' + oldId).join('#' + map[oldId]); });
      style.textContent = css;
    });
  }

  function markFailure(record, error){
    if (record.failed) return;
    record.failed = true;
    failures += 1;
    var block = record.block;
    block.classList.remove('is-rendering');
    block.classList.add('mermaid-error');
    block.removeAttribute('aria-busy');
    block.dataset.parseError = String(error && error.message ? error.message : error);
    var notice = document.createElement('p');
    notice.className = 'diagram-render-error';
    notice.setAttribute('role', 'alert');
    notice.textContent = 'This diagram could not be drawn. Its Mermaid source is preserved below for review.';
    record.host.before(notice);
  }

  function resolvedTheme(){
    var explicit = document.documentElement.dataset.theme;
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return themeMedia.matches ? 'dark' : 'light';
  }

  function themePalette(theme){
    if (theme === 'dark') {
      return {
        background: '#2A2722',
        primary: '#2F3A31', primaryText: '#EDE7DB', primaryBorder: '#7FA88B',
        secondary: '#3A2D25', secondaryText: '#EDE7DB', secondaryBorder: '#C78660',
        tertiary: '#332F29', tertiaryText: '#EDE7DB', tertiaryBorder: '#8A7F6A',
        line: '#B0A794', labelBackground: '#201E1A', note: '#3A2D25', noteBorder: '#C78660', sequenceNumber: '#EDE7DB'
      };
    }
    return {
      background: '#FBF8F2',
      primary: '#EEF5E7', primaryText: '#2A2722', primaryBorder: '#3E7C59',
      secondary: '#F7EBDD', secondaryText: '#2A2722', secondaryBorder: '#B66A3C',
      tertiary: '#F1ECE3', tertiaryText: '#2A2722', tertiaryBorder: '#B7B09C',
      line: '#6E6857', labelBackground: '#FBF8F2', note: '#F7EBDD', noteBorder: '#B66A3C', sequenceNumber: '#FBF8F2'
    };
  }

  function mermaidConfig(theme){
    var palette = themePalette(theme);
    return {
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: 'base',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
      themeVariables: {
        background: palette.background,
        primaryColor: palette.primary,
        primaryTextColor: palette.primaryText,
        primaryBorderColor: palette.primaryBorder,
        secondaryColor: palette.secondary,
        secondaryTextColor: palette.secondaryText,
        secondaryBorderColor: palette.secondaryBorder,
        tertiaryColor: palette.tertiary,
        tertiaryTextColor: palette.tertiaryText,
        tertiaryBorderColor: palette.tertiaryBorder,
        lineColor: palette.line,
        textColor: palette.primaryText,
        mainBkg: palette.primary,
        nodeBorder: palette.primaryBorder,
        clusterBkg: palette.background,
        clusterBorder: palette.tertiaryBorder,
        edgeLabelBackground: palette.labelBackground,
        actorBkg: palette.background,
        actorBorder: palette.primaryBorder,
        actorTextColor: palette.primaryText,
        actorLineColor: palette.line,
        signalColor: palette.primaryText,
        signalTextColor: palette.primaryText,
        labelBoxBkgColor: palette.primary,
        labelBoxBorderColor: palette.primaryBorder,
        labelTextColor: palette.primaryText,
        loopTextColor: palette.primaryText,
        noteBkgColor: palette.note,
        noteBorderColor: palette.noteBorder,
        noteTextColor: palette.primaryText,
        activationBkgColor: palette.primary,
        activationBorderColor: palette.primaryBorder,
        sequenceNumberColor: palette.sequenceNumber
      },
      themeCSS: '.edgeLabel,.labelBkg{background-color:' + palette.labelBackground + '!important;color:' + palette.primaryText + '!important}.edgeLabel p,.nodeLabel,.nodeLabel p{color:' + palette.primaryText + '!important}.cluster rect{rx:12px;ry:12px}',
      flowchart: { htmlLabels: true, useMaxWidth: true, nodeSpacing: 36, rankSpacing: 48 },
      sequence: { useMaxWidth: true, wrap: true },
      state: { useMaxWidth: true },
      er: { useMaxWidth: true }
    };
  }

  function prepareSvg(svg, record, theme){
    var palette = themePalette(theme);
    namespaceSvgIds(svg, 'cp-render-' + (record.index + 1) + '-' + theme);

    var titleId = 'cp-mermaid-' + (record.index + 1) + '-' + theme + '-title';
    var descId = 'cp-mermaid-' + (record.index + 1) + '-' + theme + '-desc';
    var title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    var desc = document.createElementNS('http://www.w3.org/2000/svg', 'desc');
    title.id = titleId;
    title.textContent = record.label;
    desc.id = descId;
    desc.textContent = 'Rendered architecture diagram. The surrounding section explains how to read it.';
    svg.prepend(desc);
    svg.prepend(title);

    var viewBox = svg.viewBox && svg.viewBox.baseVal;
    if (viewBox && viewBox.width && viewBox.height) {
      var background = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      background.setAttribute('class', 'diagram-background');
      background.setAttribute('x', String(viewBox.x));
      background.setAttribute('y', String(viewBox.y));
      background.setAttribute('width', String(viewBox.width));
      background.setAttribute('height', String(viewBox.height));
      background.setAttribute('fill', palette.background);
      background.setAttribute('aria-hidden', 'true');
      background.setAttribute('pointer-events', 'none');
      svg.insertBefore(background, desc.nextSibling);
    }

    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-labelledby', titleId + ' ' + descId);
    svg.setAttribute('focusable', 'false');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('data-diagram-theme', theme);
    svg.removeAttribute('aria-label');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.removeProperty('max-width');
    svg.style.backgroundColor = palette.background;
  }

  function buildRendered(record, result, theme){
    var rendered = document.createElement('div');
    rendered.className = 'mermaid mermaid-rendered';
    rendered.dataset.processed = 'true';
    rendered.dataset.diagramTheme = theme;
    rendered.setAttribute('data-label', record.label);
    rendered.innerHTML = result.svg;
    var svg = rendered.querySelector('svg');
    if (!svg) throw new Error('Mermaid returned no SVG.');
    prepareSvg(svg, record, theme);
    return rendered;
  }

  async function renderTheme(theme, markVisibleFailures){
    window.mermaid.initialize(mermaidConfig(theme));
    for (var index = 0; index < records.length; index += 1) {
      var record = records[index];
      if (record.cache[theme] || record.failed) continue;
      try {
        var result = await window.mermaid.render('cp-mermaid-' + (index + 1) + '-' + theme, record.source);
        var rendered = buildRendered(record, result, theme);
        record.cache[theme] = rendered.outerHTML;
      } catch (error) {
        record.errors[theme] = String(error && error.message ? error.message : error);
        if (markVisibleFailures) markFailure(record, error);
      }
    }
  }

  function ensureTheme(theme, markVisibleFailures){
    renderQueue = renderQueue.then(function(){ return renderTheme(theme, markVisibleFailures); });
    return renderQueue;
  }

  async function applyTheme(theme, initial){
    var request = ++themeRequest;
    await ensureTheme(theme, initial);
    if (request !== themeRequest) return;
    records.forEach(function(record){
      if (!record.cache[theme] || record.failed) return;
      record.host.innerHTML = record.cache[theme];
      record.host.dataset.diagramTheme = theme;
    });
    activeTheme = theme;
    var renderedCount = records.filter(function(record){ return Boolean(record.cache[theme]) && !record.failed; }).length;
    document.documentElement.dataset.mermaidState = failures === 0 && renderedCount === records.length ? 'ready' : (renderedCount > 0 ? 'partial' : 'failed');
    document.documentElement.dataset.mermaidRendered = String(renderedCount);
    document.documentElement.dataset.mermaidFailed = String(failures);
    document.documentElement.dataset.mermaidTheme = theme;
    document.dispatchEvent(new CustomEvent(initial ? 'mermaid:rendered' : 'mermaid:themechanged', { detail: { rendered: renderedCount, failed: failures, theme: theme } }));
  }

  function requestResolvedTheme(){
    var theme = resolvedTheme();
    if (theme === activeTheme) return;
    applyTheme(theme, false);
  }

  if (!window.mermaid) {
    blocks.forEach(function(block, index){
      var host = document.createElement('div');
      host.className = 'mermaid-host';
      block.replaceWith(host);
      host.append(block);
      markFailure({ block: block, host: host, index: index, failed: false }, new Error('Embedded Mermaid runtime did not initialize.'));
    });
    document.documentElement.dataset.mermaidState = 'failed';
    document.documentElement.dataset.mermaidRendered = '0';
    document.documentElement.dataset.mermaidFailed = String(failures);
    return;
  }

  var records = blocks.map(function(block, index){
    var record = {
      index: index,
      block: block,
      source: block.textContent || '',
      label: diagramLabel(block, index),
      host: document.createElement('div'),
      cache: {},
      errors: {},
      failed: false
    };
    record.host.className = 'mermaid-host';
    block.replaceWith(record.host);
    record.host.append(block);
    block.classList.add('is-rendering');
    block.setAttribute('aria-busy', 'true');
    return record;
  });

  var initialTheme = resolvedTheme();
  await applyTheme(initialTheme, true);

  new MutationObserver(requestResolvedTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  if (typeof themeMedia.addEventListener === 'function') themeMedia.addEventListener('change', requestResolvedTheme);
  else if (typeof themeMedia.addListener === 'function') themeMedia.addListener(requestResolvedTheme);

  var alternateTheme = initialTheme === 'dark' ? 'light' : 'dark';
  var preloadAlternate = function(){ ensureTheme(alternateTheme, false); };
  if ('requestIdleCallback' in window) window.requestIdleCallback(preloadAlternate, { timeout: 1500 });
  else window.setTimeout(preloadAlternate, 0);
})();
</script>`;
const mermaidCount = (artifactContent.match(/class="mermaid"/g) || []).length;
const architectureMermaidCount = archDiagramCount;
const architectureSectionCount = archBody.split("<section").length - 1;
const referenceSectionCount = refBody.split("<section").length - 1;
const frameCount = (artifactContent.match(/class="frame"/g) || []).length;
const artifactBody = artifactContent;
const localDocument = `<!doctype html><html lang="en"><head>${artifactContent.slice(0, styleEnd)}</head><body>${artifactContent.slice(styleEnd)}${embeddedMermaid}</body></html>`;

function assertBuild(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Gallery build invariant failed: ${message}`);
}

assertBuild(new Set(dia.secs.map((section) => section.id)).size === dia.secs.length, "Architecture section IDs must be unique");
for (const [prefix, requiredId] of requiredArchitectureSections) {
  const matches = dia.secs.filter((section) => section.title.startsWith(prefix));
  assertBuild(matches.length === 1, `Architecture must contain exactly one ${prefix} section`);
  assertBuild(matches[0].id === requiredId, `${prefix} section ID must remain ${requiredId}`);
}
for (const prefix of diagramHowToPrefixes) {
  const section = dia.secs.find((candidate) => candidate.title.startsWith(prefix));
  assertBuild(Boolean(section), `${prefix} How-to owner is missing`);
  const html = section!.html.join("\n");
  assertBuild(html.includes('class="howto"'), `${prefix} lost its How to read this panel`);
  // D13b is the one reading-guide owner with no diagram — it is a permission table.
  if (prefix !== "D13b.") {
    assertBuild(html.includes('class="mermaid"'), `${prefix} section lost its diagram`);
  }
  // Reading-guide coverage is per diagram-bearing block, not per section. After the
  // D2/D7/D9 splits a section holds several sub-blocks, and a section-level check
  // passes as long as ANY one of them still has a panel — so D7.0 could lose its
  // guide silently while D7.1/D7.2 kept theirs. Two placements are both valid:
  // one section-level guide covering every sub-block (D2, D6, D9), or one guide
  // per sub-block (D7). What is never valid is a diagram with neither.
  const preambleHasGuide = html.split("<h4 id=")[0].includes('class="howto"');
  if (!preambleHasGuide) {
    for (const chunk of html.split(/(?=<h4 id=)/).slice(1)) {
      if (!chunk.includes('class="dia"')) continue;
      const subId = chunk.match(/<h4 id="([^"]*)"/)?.[1] ?? prefix;
      assertBuild(
        chunk.includes('class="howto"'),
        `sub-block #${subId} has a diagram but no reading guide, and ${prefix} has no section-level guide covering it`,
      );
    }
  }
}
// Every anchor the nav can target must be unique across the whole document — both
// panes are in the DOM at once, so a section id colliding with a sub-block id (or a
// sub-block id repeated across tabs) would silently break the anchors added here.
// All four panes are in the DOM at once — hidden panes are collapsed, not removed —
// so scrollspy's getElementById and native #hash jumps resolve to whichever element
// comes first. A Story id colliding with a diagrams/wireframes id would silently
// track a hidden pane, so the Story anchors belong in this check too.
const storySectionIds = [...storyBody.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]);
const allAnchorIds = [
  "arch-intro",
  "ref-open-questions",
  ...storySectionIds,
  ...[...dia.secs, ...wf.secs].flatMap((s) => [s.id, ...s.subs.map((sub) => sub.id)]),
];
const duplicateAnchor = allAnchorIds.find((id, i) => allAnchorIds.indexOf(id) !== i);
assertBuild(!duplicateAnchor, `anchor id "${duplicateAnchor}" is used more than once across the gallery`);
// Nav/body parity, both directions. A nav entry pointing at a section that does
// not exist (story-baseline) and a section with no nav entry (story-use-cases)
// both shipped undetected because nothing checked this.
for (const [navHtml, bodyHtml, label] of [
  [storyNav, storyBody, "Story"],
  [archNav, archBody, "Architecture"],
  [wfOut.nav, wfOut.body, "Screens"],
  [refNav, refBody, "Reference"],
] as const) {
  const navIds = [...navHtml.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  const sectionIds = [...bodyHtml.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]);
  // Sub-block anchors live on <h4>, not on <section>; both are valid nav targets.
  const bodyIds = new Set([...sectionIds, ...[...bodyHtml.matchAll(/<h4 id="([^"]+)"/g)].map((m) => m[1])]);
  for (const id of navIds) {
    assertBuild(bodyIds.has(id), `${label} nav links to #${id}, which is not a section in the body`);
  }
  assertBuild(new Set(navIds).size === navIds.length, `${label} nav has a duplicate link`);
  // The Story pane is hand-authored, so every one of its sections must also be
  // reachable from the nav. Architecture/Screens nav is filtered to level >= 2,
  // so their level-1 intro sections legitimately have no entry.
  if (label === "Story") {
    const navSet = new Set(navIds);
    for (const id of sectionIds) {
      assertBuild(navSet.has(id), `Story section #${id} has no nav entry`);
    }
  }
}
assertBuild(architectureSectionCount === 24, "Architecture output must contain 24 sections (23 D-sections + the hand-written intro; D13b renders on Reference)");
// The opener states the diagram count in prose; tie it to the routed section list so
// adding or removing a D-section cannot leave the sentence quietly stale.
assertBuild(
  architectureSectionCount === architectureSecs.length + 1
    && archIntro.includes(`${architectureSecs.length} named diagrams`),
  "the Architecture opener's diagram count must track the routed D-section count",
);
assertBuild(architectureMermaidCount === 33, "Architecture output must contain 33 Mermaid blocks (D10b keeps a stored-state strip; D16.1/D16.2 are tables)");
assertBuild(mermaidCount === 34, "Gallery output must contain 34 Mermaid blocks including the Screens flow");
// The Reference pane is the only home of the deep material now, so losing a routed
// section there would silently delete it from the gallery rather than move it.
assertBuild(referenceSecs.length === REFERENCE_TITLES.length, "every Reference-routed section must resolve to a diagrams.md section");
assertBuild(referenceSectionCount === REFERENCE_TITLES.length + 1, "Reference output must contain the routed sections plus Open questions");
assertBuild(refBody.includes("Visual coverage matrix") && refBody.includes("<table"), "Reference must still carry the coverage matrix in full");
assertBuild(!archBody.includes("Visual coverage matrix"), "the coverage matrix must not remain in the Architecture pane");
for (const entry of OPEN_QUESTIONS) {
  assertBuild(refBody.includes(esc(entry.question)), `Open questions panel lost the verbatim item: ${entry.question}`);
  assertBuild(
    entry.finding.trim().length > 0 && entry.cites.trim().length > 0,
    `Open-questions entry needs a finding and citations: ${entry.question.slice(0, 48)}`,
  );
  if (entry.verdict === "decision") {
    assertBuild(Boolean(entry.rider?.trim()), `decision entry must carry a rider: ${entry.question.slice(0, 48)}`);
  }
}
assertBuild(OPEN_QUESTIONS.length === 7, "the Open questions panel carries exactly the seven audited items");
assertBuild(
  (refBody.match(/class="qq"/g) || []).length === 7 && (refBody.match(/class="qtag /g) || []).length === 7,
  "every question must render with exactly one verdict tag",
);
assertBuild(
  (refBody.match(/class="qrec"/g) || []).length === OPEN_QUESTIONS.filter((entry) => entry.rider).length,
  "rendered rider count must match the entries that declare one",
);
assertBuild(
  !refBody.includes("Parked for decision") && !refBody.includes("deliberately does not answer"),
  "the pre-audit framing cannot survive alongside findings",
);
assertBuild(wfScreenCount === 26, `the Screens pane must present all 26 wireframe frames (found ${wfScreenCount})`);
for (const id of WF_ONLY_FRAMES) {
  assertBuild(wf.secs.some((s) => s.id === id), `WF_ONLY_FRAMES names #${id}, which is not a Screens section`);
}
assertBuild(wfOnlyApplied === WF_ONLY_FRAMES.length, `wf-only tag applied to ${wfOnlyApplied} of ${WF_ONLY_FRAMES.length} allowlisted frames`);
assertBuild(
  (artifactBody.match(/class="wf-badge wf-only"/g) || []).length === WF_ONLY_FRAMES.length,
  "rendered wf-only tag count must equal the allowlist",
);
assertBuild(!artifactBody.includes("pending sync with UI prototypes"), "the blanket pending-sync badge is retired");
// Matched against the markup, not a bare role= substring: the same strings appear
// inside the pane-switching script's querySelectorAll calls.
assertBuild(
  (artifactBody.match(/<button id="tab-[a-z]+" role="tab"/g) || []).length === 4
    && (artifactBody.match(/<div class="pane" id="pane-[a-z]+" role="tabpanel"/g) || []).length === 4,
  "the gallery must expose exactly four tabs and four panes",
);
assertBuild(localDocument.startsWith("<!doctype html>"), "local output must be a complete document");
assertBuild(localDocument.includes(`data-embedded-runtime="mermaid@${mermaidVersion}"`), "local output must embed the locked Mermaid runtime");
assertBuild((localDocument.match(/class="mermaid"/g) || []).length === mermaidCount, "local output lost Mermaid source blocks");
assertBuild(artifactBody.trimStart().startsWith('<meta charset="utf-8">'), "Artifact output must be body-content without an outer document");
assertBuild(!artifactBody.includes('data-embedded-runtime="mermaid@'), "Artifact output must not embed the Mermaid runtime");
assertBuild(
  artifactBody.includes(".dia svg .messageLine0")
    && artifactBody.includes("prepareGalleryMermaidSvgs")
    && artifactBody.includes("normalizeGalleryMermaidClasses")
    && artifactBody.includes("--diagram-planned-fill"),
  "Artifact output must carry host-rendered Mermaid theme, status, and accessibility support",
);
assertBuild((artifactBody.match(/class="mermaid"/g) || []).length === mermaidCount, "Artifact output lost Mermaid source blocks");

writeFileSync(LOCAL_OUT, localDocument);
writeFileSync(ARTIFACT_OUT, artifactBody);
console.log(`local preview: ${LOCAL_OUT} (${Buffer.byteLength(localDocument).toLocaleString()} bytes, embedded Mermaid ${mermaidVersion})`);
console.log(`Artifact body: ${ARTIFACT_OUT} (${Buffer.byteLength(artifactBody).toLocaleString()} bytes, host-rendered Mermaid)`);
console.log(`sections: story ${storyAssetCount} · architecture ${architectureSectionCount} · screens ${wfOut.body.split("<section").length - 1} · reference ${referenceSectionCount}`);
console.log(`mermaid blocks: ${mermaidCount} · ascii frames: ${frameCount} · wireframe screens: ${wfScreenCount} · wf-only tags: ${WF_ONLY_FRAMES.length}`);
console.log(
  "NOT directly publishable: <pre class=\"mermaid\"> blocks refuse public sharing (prerender header, confirmed 2026-07-22).",
);
console.log(
  "Deploy via visual-assets-prerender.ts and publish its SHAREABLE_OUT; open the local preview directly with file://",
);
