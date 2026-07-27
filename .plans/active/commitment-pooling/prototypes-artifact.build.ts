// Builds the "Commitment Pooling — Flow Prototypes" claude.ai artifact from the
// sibling prototypes.md + the hifi/ module set. Three tabs:
//   1) Guided flows — click-through prototypes: the canonical control
//      advances, real decision points are on-frame choices, every other drawn
//      control answers via the inspector or jumps elsewhere.
//   2) Screen library — free-roam: browse every review-visible screen, switch its states
//      (Storybook-style), tap any control, navigate the screen graph.
//   3) Reference — the full rendered prototypes.md document.
//
// Screens are pre-rendered at build time. Hi-fi screens live in hifi/screens/*
// (Warm Earth kit); not-yet-migrated frames render through the ascii shim from
// hifi/legacy.ts so the artifact stays coherent mid-upgrade (September
// C-frames stay lo-fi by decision).
//
// Rebuild:  bun .plans/active/commitment-pooling/prototypes-artifact.build.ts
//           (or OUT=/path/out.html bun … )
// Local QA: mkdir -p /tmp/gg-proto && cp /tmp/commitment-pooling-prototypes.html /tmp/gg-proto/index.html
//           then preview_start name "proto" (.claude/launch.json) → http://localhost:4601
// Republish via the Claude Code Artifact tool with
//   url: https://claude.ai/code/artifact/19c3dcad-ac1d-4398-bcd4-57d0c892be2c
// Build FAILS (no output) if any journey ref, hotspot id, state, or nav target
// is invalid, any state render is empty/broken, or hi-fi copy violates the
// banned-vocabulary / steward / quiet-admin / chain-placement scans.
// One-shot op per CLAUDE.md scripts policy — lives in .plans, not scripts/.
import { readFileSync, writeFileSync } from "node:fs";
import { iconSprite } from "./hifi/icons";
import { SBS } from "./hifi/journeys";
import { PLAYER_JS } from "./hifi/player";
import {
  HIFI_CSS,
  PHONE_SHELL_HEIGHT,
  PHONE_SHELL_WIDTH,
  PHONE_VIEWPORT_HEIGHT,
  PHONE_VIEWPORT_WIDTH,
} from "./hifi/tokens";
import {
  ALIASES,
  BUILD_ERRORS,
  HOTS,
  SCREEN_HOTS,
  SCREEN_MARKS,
  REVIEW_GROUPS,
  SCREENS,
  screenCardsHtml,
  TABLES,
} from "./hifi/screens/index";
import { FLOW_GROUPS } from "./hifi/types";
import { normalizeAndValidate } from "./hifi/validate";

const SRC = `${import.meta.dir}/prototypes.md`;
const OUT = process.env.OUT ?? "/tmp/commitment-pooling-prototypes.html";

const md = readFileSync(SRC, "utf8");
const lines = md.split("\n");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- Reference-tab document pipeline (unchanged) ----------
function inline(raw: string): string {
  let s = esc(raw);
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return "\x00" + (codes.length - 1) + "\x00"; });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\b(CI-W\d+|MF-\d+[ab]?|W\d+a?|SB-\d+(?:\.\d+[ab]?(?:–\d+)?)?)\b/g, (m) => {
    if (m.startsWith("SB-")) {
      const sec = m.match(/^SB-(\d+)/)![1];
      return `<a class="chip sb" href="#sb-${sec}">${m}</a>`;
    }
    if (m.startsWith("MF-")) return `<a class="chip mf" href="#sec-15">${m}</a>`;
    return `<span class="chip w">${m}</span>`;
  });
  s = s.replace(/\x00(\d+)\x00/g, (_, i) => `<code>${codes[+i]}</code>`);
  return s;
}

type Sec = { id: string; title: string; html: string[] };
const secs: Sec[] = [];
let cur: Sec | null = null;
let front: string[] = [];
let i = 0;
let h1 = "Commitment Pooling — Flow Prototypes";

function push(html: string) { (cur ? cur.html : front).push(html); }

function slug(t: string): string {
  const sb = t.match(/^SB-(\d+)/);
  if (sb) return `sb-${sb[1]}`;
  const num = t.match(/^(\d+)\./);
  if (num) return `sec-${num[1]}`;
  return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function flowHtml(code: string[]): string {
  const labels: Record<string, string> = {};
  const edges: { f: string; t: string; l: string }[] = [];
  for (const ln of code) {
    const m = ln.match(/^\s*(\w+)(?:\["([^"]*)"\])?\s*-->\|"([^"]*)"\|\s*(\w+)(?:\["([^"]*)"\])?/);
    if (!m) continue;
    if (m[2]) labels[m[1]] = m[2];
    if (m[5]) labels[m[4]] = m[5];
    edges.push({ f: m[1], t: m[4], l: m[3] });
  }
  const rows = edges.map(e =>
    `<div class="fr"><span class="fn">${esc(labels[e.f] ?? e.f)}</span><span class="fe"><span class="fl">${esc(e.l)}</span><span class="fa" aria-hidden="true"></span></span><span class="fn">${esc(labels[e.t] ?? e.t)}</span></div>`
  ).join("");
  const srcCode = esc(code.join("\n"));
  return `<div class="flow">${rows}</div><details class="msrc"><summary>mermaid source</summary><pre>${srcCode}</pre></details>`;
}

while (i < lines.length) {
  const ln = lines[i];
  if (ln.startsWith("# ") && !cur && front.length === 0) { h1 = ln.slice(2).replace(/ \(.*\)$/, ""); i++; continue; }
  if (ln.startsWith("## ")) {
    const title = ln.slice(3);
    cur = { id: slug(title), title, html: [] };
    secs.push(cur);
    i++; continue;
  }
  if (ln.startsWith("```mermaid")) {
    const buf: string[] = []; i++;
    while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i++; }
    i++; push(flowHtml(buf)); continue;
  }
  if (ln.startsWith("```text") || ln === "```") {
    const buf: string[] = []; i++;
    while (i < lines.length && !lines[i].startsWith("```")) { buf.push(lines[i]); i++; }
    i++;
    const proposed = buf.some(b => b.includes("NEW — proposed"));
    push(`<div class="framewrap${proposed ? " proposed" : ""}">${proposed ? '<div class="ptag">NEW — proposed lo-fi, not locked</div>' : ""}<pre class="frame">${esc(buf.join("\n"))}</pre></div>`);
    continue;
  }
  if (ln.startsWith("|")) {
    const rows: string[] = [];
    while (i < lines.length && lines[i].startsWith("|")) { rows.push(lines[i]); i++; }
    const cells = (r: string) => r.replace(/^\|/, "").replace(/\|\s*$/, "").split("|").map(c => c.trim());
    let bodyStart = 1;
    if (rows.length > 1 && /^[\s|:-]+$/.test(rows[1])) bodyStart = 2;
    const head = cells(rows[0]).map(c => `<th>${inline(c)}</th>`).join("");
    const body = rows.slice(bodyStart).map(r => {
      const warn = r.includes("⚠");
      return `<tr${warn ? ' class="warn"' : ""}>${cells(r).map(c => `<td>${inline(c)}</td>`).join("")}</tr>`;
    }).join("");
    push(`<div class="tw"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
    continue;
  }
  if (ln.startsWith("- ")) {
    const items: string[] = [];
    while (i < lines.length && lines[i].startsWith("- ")) { items.push(lines[i].slice(2)); i++; }
    push(`<ul>${items.map(it => `<li>${inline(it)}</li>`).join("")}</ul>`);
    continue;
  }
  if (ln === "---" || ln.trim() === "") { i++; continue; }
  const buf: string[] = [ln];
  i++;
  while (i < lines.length && lines[i].trim() !== "" && !/^(#|```|\||- |---)/.test(lines[i])) { buf.push(lines[i]); i++; }
  push(`<p>${inline(buf.join(" "))}</p>`);
}

const sbSecs = secs.filter(s => s.id.startsWith("sb-"));
const refSecs = secs.filter(s => !s.id.startsWith("sb-"));
const groupsDoc: [string, Sec[]][] = [
  ["Member journeys", sbSecs.slice(0, 7)],
  ["Operator journeys", sbSecs.slice(7, 10)],
  ["Settlement", sbSecs.slice(10, 12)],
  ["Protocol + September", sbSecs.slice(12, 14)],
];
const navSb = groupsDoc.map(([g, ss]) =>
  `<div class="ng">${g}</div>` + ss.map(s => {
    const m = s.title.match(/^(SB-\d+) — (.*)$/);
    const label = m ? `<b>${m[1]}</b> ${esc(m[2].replace(/\*\*/g, ""))}` : esc(s.title);
    return `<a href="#${s.id}">${label}</a>`;
  }).join("")
).join("");
const navRef = `<div class="ng">Reference</div>` + refSecs.map(s =>
  `<a href="#${s.id}">${esc(s.title.replace(/ \(.*\)$/, "").replace(/ —.*$/, ""))}</a>`
).join("");

const refToc = `<nav class="ref-toc" aria-label="Reference overview">${groupsDoc.map(([g, ss]) =>
  `<a href="#${ss[0].id}"><b>${esc(g)}</b><span>${ss.length} journeys</span></a>`
).join("")}${refSecs.map(s =>
  `<a href="#${s.id}"><b>${esc(s.title.replace(/ \(.*\)$/, "").replace(/ —.*$/, ""))}</b></a>`
).join("")}</nav>`;

const statusNote = `<aside class="status"><h2>Status — audit closure 2026-07-25 · hi-fi register #36</h2>
<p><strong>Presentation review</strong>: ${SBS.filter((b) => b.reviewVisible).length} guided flows and ${SCREENS.filter((s) => s.frame !== "ascii").length} high-fidelity screens are grouped by Client PWA, Admin console, and Editorial website. September Community wireframes remain validated source material with stable direct hashes, but are intentionally hidden from the presentation catalogs until their high-fidelity pass. Adopted micro-frames remain dissolved into their locked parent states. Rendered copy and lifecycle-sensitive call/state pairings are build-linted.</p>
<p><strong>Adopted</strong>: pool open/close on the pool status card + open-cycle guard prompt (MF-1) · member pre-acceptance withdraw (MF-2a) · <code>waiting_for_hat</code> covers the five pool job kinds in August (MF-5) · admin expiry queue + member "offer again" ship in August, keeper cron is a post-launch backstop (MF-3/MF-4) · pilot stewards hold the executor role with a visible missing-role guard state · read-only delivery-gate status row on W21/W12 · testimony is September-realized (MF-12) · the dry run rehearses payout with a real minimal Cookie Jar withdrawal.</p>
<p><strong>Placement closure (register #51)</strong>: W10 steward cancel, the Work Review commitment row, the pre-claim personal/garden chooser, and the W10 attach-assessment picker are locked where drawn. The W10 accepted/override states, W23 delivery-blocked state, W26 reconciliation report, queue-funding control, and both origin-specific settlement-cancellation messages are also realized rather than review proposals. <strong>Join-request queue</strong> design is canonical in <code>../community-interface/join-queue-spec.md</code>; implementation remains gated on RESR-64's operating record.</p></aside>`;

const sections = secs.map(s => {
  const m = s.title.match(/^(SB-\d+) — (.*)$/);
  const heading = m
    ? `<h2><span class="sbnum">${m[1]}</span> ${inline(m[2])}</h2>`
    : `<h2>${inline(s.title.replace(/^\d+\. /, ""))}</h2>`;
  const glance = s.html.findIndex(block => block.includes("<strong>At a glance</strong>"));
  const fold = glance >= 0 && s.html.length - glance > 4;
  const body = fold
    ? `${s.html.slice(0, glance + 1).join("\n")}<details class="refmore"><summary>Open the full section</summary>${s.html.slice(glance + 1).join("\n")}</details>`
    : s.html.join("\n");
  return `<section id="${s.id}">${heading}${body}</section>`;
}).join("\n");

// ---------- Normalize journeys against the screen registry + validate ----------
const { sbs, errors, warnings } = normalizeAndValidate(SBS, {
  screens: SCREENS,
  hots: HOTS,
  tables: TABLES,
  screenHots: SCREEN_HOTS,
  screenMarks: SCREEN_MARKS,
  aliases: ALIASES,
});
const frameContractErrors: string[] = [];
if (!HIFI_CSS.includes(`width:${PHONE_SHELL_WIDTH}px;height:${PHONE_SHELL_HEIGHT}px`))
  frameContractErrors.push(`FRAME CSS: phone shell must stay ${PHONE_SHELL_WIDTH}×${PHONE_SHELL_HEIGHT}`);
if (!HIFI_CSS.includes(`width:${PHONE_VIEWPORT_WIDTH}px;height:${PHONE_VIEWPORT_HEIGHT}px`))
  frameContractErrors.push(`FRAME CSS: phone viewport must stay ${PHONE_VIEWPORT_WIDTH}×${PHONE_VIEWPORT_HEIGHT}`);
if (!HIFI_CSS.includes("transform:scale(var(--phone-scale))"))
  frameContractErrors.push("FRAME CSS: phone shell must fit the review canvas with uniform scaling");
if (!HIFI_CSS.includes(".device .phonefit,") || HIFI_CSS.includes(".device .phone,"))
  frameContractErrors.push("FRAME CSS: entry motion must animate the fit wrapper without overriding phone scaling");
const allErrors = [...BUILD_ERRORS, ...errors, ...frameContractErrors];
for (const w of warnings) console.warn("WARN", w);
if (allErrors.length > 0) {
  for (const e of allErrors) console.error(e);
  console.error(`${allErrors.length} validation errors — not writing output`);
  process.exit(1);
}

const PLAYER_DATA = JSON.stringify({
  screens: Object.fromEntries(SCREENS.map(s => [s.id, { title: s.title, surface: s.surface, frame: s.frame, group: s.group, reviewVisible: s.reviewVisible, states: s.states }])),
  hots: HOTS,
  sbs,
  aliases: ALIASES,
});

const visibleSbs = sbs.filter((sb) => sb.reviewVisible);
const visibleScreens = SCREENS.filter((screen) => screen.reviewVisible);

const flowCatalog = FLOW_GROUPS.map(({ id, label }, groupIx) => {
  const cards = visibleSbs
    .filter((sb) => sb.reviewGroup === id)
    .map((sb) => `<button class="sbcard" data-sb="${sb.id}"><span class="sbt">${esc(sb.title)}</span><span class="sbm">${esc(sb.persona)}</span><span class="surface-badge">${esc(label)}</span></button>`)
    .join("");
  return `<section class="catalog-panel flow-catalog" id="flow-panel-${id}" role="tabpanel" aria-labelledby="flow-tab-${id}" data-flow-group="${id}"${groupIx ? " hidden" : ""}><h2>${esc(label)} flows</h2><div class="grid">${cards}</div></section>`;
}).join("");

const screenCards = screenCardsHtml();

// Both tablists are generated from the same arrays that generate their panels,
// so a new group cannot appear as a tab without a panel (or vice versa) and the
// ARIA pairing is correct by construction.
const surfaceTabsHtml = (
  kind: "flow" | "screen",
  attr: string,
  groups: readonly { id: string; label: string }[],
  ariaLabel: string,
) =>
  `<div class="surface-tabs" role="tablist" aria-label="${esc(ariaLabel)}">${groups
    .map(({ id, label }, ix) =>
      `<button class="surface-tab${ix ? "" : " on"}" id="${kind}-tab-${id}" role="tab" aria-selected="${ix ? "false" : "true"}" aria-controls="${kind}-panel-${id}"${ix ? ' tabindex="-1"' : ""} data-${kind === "flow" ? "flow-group" : "screen-surface"}="${id}">${esc(label)}</button>`)
    .join("")}</div>`;
const flowTabs = surfaceTabsHtml("flow", "data-flow-group", FLOW_GROUPS, "Guided-flow surface");
const screenTabs = surfaceTabsHtml(
  "screen",
  "data-screen-surface",
  REVIEW_GROUPS.map((g) => ({ id: g.surface, label: g.name })),
  "Screen-library surface",
);

const countBy = <T,>(items: T[], key: (item: T) => string) => items.reduce<Record<string, number>>((counts, item) => {
  const value = key(item);
  counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}, {});
const assertBuild = (condition: unknown, message: string) => {
  if (!condition) throw new Error(`PRESENTATION ${message}`);
};
const flowCounts = countBy(visibleSbs, (sb) => sb.reviewGroup);
const screenCounts = countBy(visibleScreens, (screen) => screen.surface);
// Derived, not transcribed: a regroup used to require editing a hard-coded
// tally here, so the tally was the thing that broke first.
for (const { id, label } of FLOW_GROUPS)
  assertBuild((flowCounts[id] ?? 0) > 0, `flow group "${label}" has no visible flows`);
for (const sb of sbs)
  assertBuild(FLOW_GROUPS.some((g) => g.id === sb.reviewGroup), `flow ${sb.id} claims unknown group "${sb.reviewGroup}"`);
assertBuild(
  visibleSbs.some((sb) => sb.steps.some((step) => step.echo)),
  "no echo scenes — the cross-surface mechanic vanished",
);
assertBuild(visibleScreens.length === 24, `expected 24 visible screens, found ${visibleScreens.length}`);
assertBuild(screenCounts.client === 9 && screenCounts.admin === 13 && screenCounts.editorial === 2, `screen grouping must be 9 client / 13 admin / 2 editorial`);
const presentationCatalogs = flowCatalog + screenCards;
const presentationRuntimeCopy = [
  presentationCatalogs,
  ...visibleSbs.flatMap((sb) => [
    sb.title,
    sb.persona,
    ...sb.steps.flatMap((step) => [
      step.hot?.l,
      ...(step.alts ?? []).map((alt) => alt.l),
      step.who,
      step.surface,
      step.st,
      step.ev,
      step.note,
      ...(step.br ?? []).map((branch) => branch.l),
    ]),
  ]),
  ...Object.values(HOTS).flatMap((hotspot) => [hotspot.l, hotspot.info]),
  ...visibleScreens.flatMap((screen) => [screen.title, ...screen.states.flatMap((state) => [state.label, state.html])]),
].filter(Boolean).join(" ");
assertBuild(!presentationCatalogs.includes('data-sb="sb14"'), "Journey 14 leaked into Guided flows");
assertBuild(!/data-frame="C\d+"/.test(presentationCatalogs), "Community cards leaked into Screen library");
for (const [label, pattern] of [
  ["SB code", /\bSB-\d+\b/],
  ["scenario code", /\bS\d+(?:\/S\d+)?\b/],
  ["walked status", /\bwalked\b/i],
  ["not-walked status", /\bnot[- ]walked\b/i],
  ["journey backlink", /\bwalk\s+SB-/i],
] as const) assertBuild(!pattern.test(presentationRuntimeCopy), `${label} leaked into presentation UI copy`);

// ---------- Page ----------
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Commitment Pooling — Flow Prototypes</title>
<script>(function(){try{var q=new URLSearchParams(location.search);var t=q.get("theme"),m=q.get("motion");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;if(m==="reduce")document.documentElement.dataset.motion=m}catch(e){}})();</script>
<style>
:root{
  --canvas:#FAF8F4; --panel:#F2EFE7; --ink:#2B2924; --stone:#6B675E; --line:#E4E0D6;
  --accent:#3E7A4E; --accent-ink:#2E5C3B; --amber:#8A6D1F; --amber-bg:#F7F0DC;
  --chipw:#EDE9DD; --code:#54504A;
  --spring-spatial-duration:300ms;--spring-spatial-easing:cubic-bezier(0.16,1,0.3,1);
  --spring-spatial-fast-duration:200ms;--spring-spatial-fast-easing:cubic-bezier(0.34,1.56,0.64,1);
  --spring-spatial-slow-duration:400ms;--spring-spatial-slow-easing:cubic-bezier(0.16,1,0.3,1);
  --spring-effects-duration:250ms;--spring-effects-easing:cubic-bezier(0.2,0,0,1);
  --spring-effects-fast-duration:150ms;--spring-effects-fast-easing:cubic-bezier(0.2,0,0,1);
  --spring-effects-slow-duration:500ms;--spring-effects-slow-easing:cubic-bezier(0.2,0,0,1);
  --spring-spatial:var(--spring-spatial-duration) var(--spring-spatial-easing);
  --spring-spatial-fast:var(--spring-spatial-fast-duration) var(--spring-spatial-fast-easing);
  --spring-effects:var(--spring-effects-duration) var(--spring-effects-easing);
  --spring-effects-fast:var(--spring-effects-fast-duration) var(--spring-effects-fast-easing);
  /* Review height budget: phone shells fit it uniformly; desktop/ascii frames
     cap their height directly. Screen content scrolls inside the frame instead
     of the page. Theme-independent; inherited by the .hf frames. */
  --dev-cap:min(720px,calc(100vh - 200px));
  --dev-cap:min(720px,calc(100dvh - 200px));
}
@media (prefers-color-scheme: dark){:root{
  --canvas:#1C1B18; --panel:#24221E; --ink:#ECE8DF; --stone:#A39E92; --line:#35332C;
  --accent:#7FBF8E; --accent-ink:#9BD1A8; --amber:#D4B45A; --amber-bg:#2E2A1D;
  --chipw:#2C2A24; --code:#C9C4B8;
}}
:root[data-theme="dark"]{
  --canvas:#1C1B18; --panel:#24221E; --ink:#ECE8DF; --stone:#A39E92; --line:#35332C;
  --accent:#7FBF8E; --accent-ink:#9BD1A8; --amber:#D4B45A; --amber-bg:#2E2A1D;
  --chipw:#2C2A24; --code:#C9C4B8;
}
:root[data-theme="light"]{
  --canvas:#FAF8F4; --panel:#F2EFE7; --ink:#2B2924; --stone:#6B675E; --line:#E4E0D6;
  --accent:#3E7A4E; --accent-ink:#2E5C3B; --amber:#8A6D1F; --amber-bg:#F7F0DC;
  --chipw:#EDE9DD; --code:#54504A;
}
*{box-sizing:border-box}
body{margin:0;background:var(--canvas);color:var(--ink);
  font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
.tabs{display:flex;gap:4px;padding:10px 16px;border-bottom:1px solid var(--line);
  position:sticky;top:0;background:var(--canvas);z-index:5;align-items:center;flex-wrap:wrap}
.tabs .tt{font-weight:700;font-size:13px;margin-right:12px}
.tab{border:1px solid var(--line);background:var(--panel);color:var(--stone);border-radius:8px;
  padding:5px 14px;font:600 13px inherit;cursor:pointer;min-height:44px}
.tab.on{background:var(--accent);border-color:var(--accent);color:var(--canvas)}
/* Chrome-level toggle. The dialect tokens already ship both theme signals
   ([data-theme="dark"] and the prefers-color-scheme twin), so pinning the
   attribute is all that is needed to review dark on a light machine. */
.chromebtn{margin-left:auto;border:1px solid var(--line);background:var(--panel);color:var(--stone);
  border-radius:8px;padding:5px 12px;font:600 12.5px inherit;cursor:pointer;min-height:44px}
.chromebtn:hover{color:var(--ink)}
.chromebtn[aria-pressed="true"]{border-color:var(--accent-ink);color:var(--ink)}
#tab-doc,#tab-play,#tab-screens{display:none}
#tab-doc.on,#tab-play.on,#tab-screens.on{display:block}

#play,#screens{max-width:1080px;margin:0 auto;padding:26px 20px 44px}
#play h1,#screens h1{font-size:21px;margin:0 0 4px;text-wrap:balance}
#play .sub,#screens .sub{color:var(--stone);font-size:13px;margin:0 0 18px;max-width:78ch}
.surface-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 18px;padding:4px;width:max-content;max-width:100%;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.surface-tab{border:0;background:transparent;color:var(--stone);border-radius:8px;padding:7px 13px;font:650 12.5px inherit;cursor:pointer;min-height:44px}
.surface-tab.on{background:var(--canvas);color:var(--ink);box-shadow:0 1px 3px color-mix(in srgb,var(--ink) 12%,transparent)}
.catalog-panel[hidden]{display:none}
.catalog-panel h2{margin:0 0 9px;font-size:15px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px;margin-bottom:8px}
.ng2{margin:18px 0 8px;font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--stone)}
.sbcard{text-align:left;border:1px solid var(--line);background:var(--panel);border-radius:10px;
  padding:12px 14px;cursor:pointer;display:flex;flex-direction:column;gap:3px;color:var(--ink)}
.sbcard:hover{border-color:var(--accent)}
.sbn{font:700 11.5px ui-monospace,Menlo,monospace;color:var(--accent-ink)}
.tick{color:var(--accent-ink);font-weight:700}
.sbt{font-weight:650;font-size:14px}
.sbm{font-size:11.5px;color:var(--stone)}
.surface-badge{width:max-content;margin-top:4px;border:1px solid var(--line);border-radius:99px;padding:1px 8px;font-size:10.5px;font-weight:650;color:var(--accent-ink)}
.screenkey{font:700 10.5px ui-monospace,Menlo,monospace;color:var(--accent-ink);letter-spacing:.04em}
#stage,#expstage{display:none}
#stage.on,#expstage.on{display:block}
.stagebar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px}
.stagebar .back{border:1px solid var(--line);background:var(--panel);color:var(--ink);
  border-radius:8px;padding:4px 12px;cursor:pointer;font:600 12.5px inherit;min-height:44px}
.stagebar .ti{font-weight:700;font-size:15px}
.pill{font-size:11px;border:1px solid var(--line);border-radius:99px;padding:1px 9px;color:var(--stone)}
.pill.sur{border-color:var(--accent-ink);color:var(--accent-ink)}
.pill.link{cursor:pointer;background:var(--panel);min-height:44px}
.device{border:1px solid var(--line);border-radius:14px;background:var(--panel);
  padding:14px 16px;overflow-x:auto;position:relative}
.device.mf{border-color:var(--amber)}
/* Echo = the same moment on another surface. Stone and dashed, never amber —
   amber already means "proposed", and a frame can be both (sb9c). The tag sits
   top-LEFT so it never collides with the proposed tag's top-right corner. */
.device.echo{outline:2px dashed color-mix(in srgb,var(--stone) 45%,transparent);outline-offset:3px}
.device .echotag{position:absolute;top:0;left:0;z-index:2;background:var(--panel);color:var(--stone);
  font:700 10px inherit;letter-spacing:.08em;text-transform:uppercase;padding:3px 10px;
  border-radius:13px 0 8px 0;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
.pill.echo{border-style:dashed;color:var(--stone)}
/* lo-fi ascii frames have no inner scroll surface — cap + scroll the panel itself */
.device.f-ascii{max-height:var(--dev-cap);overflow:auto}
.device .mftag{position:absolute;top:0;right:0;background:var(--amber-bg);color:var(--amber);
  font:700 10px inherit;letter-spacing:.08em;text-transform:uppercase;padding:3px 10px;border-radius:0 13px 0 8px}
.device pre.ascii{margin:0;padding:0;border:0;background:transparent;overflow:visible;
  font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ink)}
.hspot{display:inline-flex;align-items:center;justify-content:center;min-width:44px;min-height:44px;
  font:inherit;padding:0 6px;margin:-13px -6px;border:0;background:transparent;color:inherit;
  cursor:pointer;white-space:pre;border-radius:3px;vertical-align:middle}
.hspot.primary{background:color-mix(in srgb, var(--accent) 18%, transparent);
  outline:1px dashed var(--accent);outline-offset:1px}
@media (prefers-reduced-motion: no-preference){
  .hspot.primary{animation:hotpulse calc(var(--spring-effects-slow-duration) * 3.2) var(--spring-effects-slow-easing) infinite}
  @keyframes hotpulse{0%,100%{outline-color:var(--accent)}50%{outline-color:transparent}}
}
.hspot.choice{background:color-mix(in srgb, var(--accent) 10%, transparent);
  outline:1px solid var(--accent-ink);outline-offset:1px}
.hspot.quiet{border-bottom:1px dotted color-mix(in srgb,var(--accent) 55%,transparent)}
.device:hover .hspot.quiet,.hspot.quiet:focus-visible{border-bottom-color:var(--accent-ink)}
.hspot.nav2{background:color-mix(in srgb, var(--accent) 10%, transparent);
  outline:1px solid var(--accent-ink);outline-offset:1px}
.hspot.info2{border-bottom:1px dotted color-mix(in srgb,var(--accent) 55%,transparent)}
/* reveal-on-mis-click: flash every live hotspot so the real controls are obvious */
.hspot.flash{outline:1px solid var(--accent);outline-offset:1px;border-radius:3px;
  background:color-mix(in srgb,var(--accent) 16%,transparent)}
@media (prefers-reduced-motion: no-preference){
  .hspot.flash{animation:hspotflash calc(var(--spring-effects-slow-duration) * 1.25) var(--spring-effects-easing) both}
  @keyframes hspotflash{0%,100%{outline-color:transparent;background-color:transparent}
    45%{outline-color:var(--accent);background-color:color-mix(in srgb,var(--accent) 16%,transparent)}}
}
.marked{background:color-mix(in srgb, var(--amber) 22%, transparent);border-radius:3px}
.stchips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}
.vchip{border:1px solid var(--line);background:var(--panel);color:var(--stone);border-radius:99px;
  padding:3px 12px;font:600 12px inherit;cursor:pointer;min-height:44px}
.vchip.on{background:var(--accent);border-color:var(--accent);color:var(--canvas)}
.vchip.prop{border-style:dashed;border-color:var(--amber);color:var(--amber)}
.vchip.prop.on{background:var(--amber);border-color:var(--amber);color:var(--canvas)}
.hint{margin:10px 0 0;font-size:12.5px;color:var(--accent-ink);font-weight:600}
.hint .kbd{color:var(--stone);font-weight:400}
#insp{margin:10px 0 0;border:1px solid var(--line);border-left:3px solid var(--accent-ink);
  background:var(--panel);border-radius:8px;padding:8px 12px;font-size:12.5px;display:none}
#insp.on{display:block}
#insp b{display:block;margin-bottom:2px}
#insp .ia{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap}
#insp .ia button{border:1px solid var(--accent-ink);background:transparent;color:var(--accent-ink);
  border-radius:7px;padding:2px 10px;font:600 12px inherit;cursor:pointer;min-height:44px}
.insp{margin:10px 0 0}
.insp.on{border:1px solid var(--line);border-left:3px solid var(--accent-ink);background:var(--panel);
  border-radius:8px;padding:8px 12px;font-size:12.5px}
.insp .walkbtn{margin-left:8px;border:1px solid var(--accent-ink);background:transparent;color:var(--accent-ink);
  border-radius:7px;padding:2px 10px;font:600 12px inherit;cursor:pointer;min-height:44px}
.meta{margin:12px 0 0;display:flex;flex-direction:column;gap:6px;font-size:13px}
.impl-notes{margin:10px 0 0;border-top:1px solid var(--line);font-size:13px}
.impl-notes>summary{display:flex;align-items:center;min-height:44px;cursor:pointer;color:var(--stone);font-weight:650}
.impl-notes .meta{margin:0 0 6px;padding:0 2px}
.meta .row{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.stchip{font:600 11px ui-monospace,Menlo,monospace;background:var(--chipw);border:1px solid var(--line);
  border-radius:5px;padding:1px 7px;white-space:nowrap}
.ev{color:var(--ink)}
.cite{font:11px ui-monospace,Menlo,monospace;color:var(--stone)}
.note{font-size:12.5px;color:var(--stone);border-left:3px solid var(--line);padding-left:10px}
.brs{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.br{border:1px solid var(--amber);background:var(--amber-bg);color:var(--amber);border-radius:8px;
  padding:3px 10px;font:600 12px inherit;cursor:pointer;min-height:44px}
.br.info{cursor:default}
/* Journey stage: the device is flanked by large prev/next arrows that stay in
   view. Phones scale uniformly; every frame scrolls its own content. */
.stagerow{display:flex;align-items:center;justify-content:center;gap:8px;margin:2px 0 0}
.devicewrap{flex:1 1 auto;min-width:0;min-height:0;display:flex;justify-content:center}
.devicewrap .device{width:100%}
.navarrow{flex:none;width:52px;height:52px;border-radius:99px;border:1px solid var(--line);
  background:var(--panel);color:var(--accent-ink);font-size:28px;line-height:1;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:transform var(--spring-spatial-fast),background var(--spring-effects-fast),color var(--spring-effects-fast),opacity var(--spring-effects-fast)}
.navarrow:hover{background:var(--accent);border-color:var(--accent);color:var(--canvas)}
.navarrow:active{transform:scale(.92)}
.navarrow:disabled{opacity:.32;cursor:default}
.navarrow:disabled:hover{background:var(--panel);border-color:var(--line);color:var(--accent-ink)}
.navarrow.done{background:var(--accent);border-color:var(--accent);color:var(--canvas)}
.dotsrow{display:flex;justify-content:center;margin-top:14px}
.dots{display:flex;gap:0;justify-content:center;flex-wrap:wrap}
.dot{width:44px;height:44px;border-radius:99px;background:transparent;border:0;padding:0;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.dot::after{content:"";width:8px;height:8px;border-radius:99px;background:var(--line)}
.dot.on::after{background:var(--accent)}
@media (max-width:560px){
  .navarrow{width:44px;height:44px;font-size:22px}
  .stagerow{gap:3px}
}
.who{font-size:12px;color:var(--stone)}
.legend{display:flex;gap:14px;flex-wrap:wrap;margin:8px 0 0;font-size:11.5px;color:var(--stone)}
.legend .k{display:inline-block;width:14px;height:10px;border-radius:3px;vertical-align:-1px;margin-right:4px}

.wrap{display:flex;min-height:100vh}
nav.doc{width:248px;flex:none;border-right:1px solid var(--line);padding:20px 14px 40px;
  position:sticky;top:46px;height:calc(100vh - 46px);overflow-y:auto;font-size:12.5px}
nav.doc .brand{font-weight:700;font-size:13px;letter-spacing:.02em;margin:0 8px 14px;color:var(--ink)}
nav.doc .brand small{display:block;font-weight:400;color:var(--stone);margin-top:2px}
.ng{margin:14px 8px 4px;font-size:10.5px;font-weight:600;letter-spacing:.09em;
  text-transform:uppercase;color:var(--stone)}
nav.doc a{display:flex;align-items:center;padding:4px 8px;border-radius:6px;color:var(--stone);text-decoration:none;min-height:44px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
nav.doc a b{color:var(--ink);font-weight:600;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px}
nav.doc a:hover{background:var(--panel);color:var(--ink)}
nav.doc a.on{background:var(--panel);color:var(--accent-ink)}
#tab-doc main{flex:1;min-width:0;padding:36px 44px 120px;max-width:960px}
#tab-doc main h1{font-size:23px;line-height:1.25;margin:0 0 6px;text-wrap:balance}
#tab-doc main .sub{color:var(--stone);margin:0 0 22px;font-size:13.5px}
#tab-doc section{margin:0 0 44px;scroll-margin-top:64px}
#tab-doc h2{font-size:17.5px;margin:34px 0 12px;padding-top:18px;border-top:1px solid var(--line);text-wrap:balance}
#tab-doc section:first-of-type h2{border-top:0;padding-top:0}
.sbnum{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:700;
  color:var(--accent-ink);background:var(--panel);border:1px solid var(--line);
  border-radius:6px;padding:2px 7px;margin-right:6px;vertical-align:2px}
#tab-doc main p{margin:10px 0;max-width:74ch}
#tab-doc main ul{margin:8px 0;padding-left:22px;max-width:74ch}
#tab-doc main li{margin:4px 0}
#tab-doc main code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.88em;color:var(--code);
  background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:0 4px}
strong{font-weight:650}
.chip{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85em;border-radius:5px;
  padding:0 5px;text-decoration:none;border:1px solid var(--line)}
.chip.w{background:var(--chipw);color:var(--ink)}
.chip.sb{background:var(--panel);color:var(--accent-ink);border-color:var(--accent-ink)}
.chip.mf{background:var(--amber-bg);color:var(--amber);border-color:var(--amber)}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:8px;margin:14px 0}
.tw table{border-collapse:collapse;width:100%;font-size:13px;min-width:640px}
.tw th{background:var(--panel);text-align:left;font-size:11px;letter-spacing:.06em;
  text-transform:uppercase;color:var(--stone);padding:7px 10px;border-bottom:1px solid var(--line)}
.tw td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;
  font-variant-numeric:tabular-nums}
.tw tbody tr:last-child td{border-bottom:0}
.tw tr.warn td{background:var(--amber-bg)}
.framewrap{margin:14px 0;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.framewrap.proposed{border-color:var(--amber)}
.ptag{background:var(--amber-bg);color:var(--amber);font-size:10.5px;font-weight:700;
  letter-spacing:.08em;text-transform:uppercase;padding:4px 12px}
pre.frame{margin:0;padding:12px 14px;overflow-x:auto;
  font:12px/1.42 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ink)}
.flow{margin:14px 0;border:1px solid var(--line);border-left:3px solid var(--accent);
  border-radius:8px;padding:10px 14px;background:var(--panel)}
.fr{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:3px 0;font-size:12.5px}
.fn{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;background:var(--canvas);
  border:1px solid var(--line);border-radius:6px;padding:2px 8px;white-space:nowrap}
.fe{display:flex;align-items:center;gap:4px;color:var(--stone);font-style:italic;min-width:0}
.fl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:34ch}
.fa{flex:none;width:18px;height:1px;background:var(--stone);position:relative}
.fa::after{content:"";position:absolute;right:-1px;top:-3px;border:3.5px solid transparent;
  border-left-color:var(--stone)}
details.msrc{margin:-6px 0 14px}
details.msrc summary{font-size:11.5px;color:var(--stone);cursor:pointer;min-height:44px;display:flex;align-items:center}
details.msrc pre{font:11.5px/1.4 ui-monospace,Menlo,monospace;background:var(--panel);
  border:1px solid var(--line);border-radius:8px;padding:10px 12px;overflow-x:auto}
.status{border:1px solid var(--accent);border-left-width:3px;background:var(--panel);
  border-radius:8px;padding:4px 16px 10px;margin:0 0 26px}
.status h2{border:0;padding:0;margin:10px 0 4px;font-size:13px;letter-spacing:.05em;
  text-transform:uppercase;color:var(--accent-ink)}
.status p{font-size:13px;margin:6px 0}
.ref-toc{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:0 0 22px}
.ref-toc a{display:flex;flex-direction:column;justify-content:center;min-height:52px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--panel);text-decoration:none;color:var(--ink)}
.ref-toc a span{font-size:11px;color:var(--stone)}
.refmore{margin:10px 0 0}
.refmore>summary{min-height:44px;display:flex;align-items:center;cursor:pointer;color:var(--accent-ink);font-weight:650}
a{color:var(--accent-ink)}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
@media (max-width:900px){
  .wrap{display:block}
  nav.doc{position:static;width:auto;height:auto;border-right:0;border-bottom:1px solid var(--line);
    display:flex;flex-wrap:wrap;gap:2px;padding:12px}
  nav.doc .brand{width:100%}
  .ng{width:100%;margin:8px 4px 2px}
  #tab-doc main{padding:20px 18px 80px}
  .tw table{min-width:560px}
}
@media (prefers-reduced-motion: no-preference){html{scroll-behavior:smooth}}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
:root[data-motion="reduce"] *,
:root[data-motion="reduce"] *::before,
:root[data-motion="reduce"] *::after{scroll-behavior:auto!important;animation:none!important;transition:none!important}
${HIFI_CSS}
</style>
</head><body>
${iconSprite()}
<div class="tabs" role="tablist">
  <span class="tt">Commitment Pooling</span>
  <button class="tab on" id="tabbtn-play" role="tab" aria-selected="true" aria-controls="tab-play">Guided flows</button>
  <button class="tab" id="tabbtn-screens" role="tab" aria-selected="false" aria-controls="tab-screens" tabindex="-1">Screen library</button>
  <button class="tab" id="tabbtn-doc" role="tab" aria-selected="false" aria-controls="tab-doc" tabindex="-1">Implementation reference</button>
  <button class="chromebtn" id="themebtn" type="button" aria-pressed="false">Dark mode</button>
</div>

<div id="tab-play" class="on" role="tabpanel" aria-labelledby="tabbtn-play">
<div id="play">
  <div id="home">
    <h1>Guided flows</h1>
    <p class="sub">Choose a surface, then open a flow. Frames marked “Meanwhile” show the same moment landing on another surface.</p>
    ${flowTabs}
    ${flowCatalog}
  </div>
  <div id="stage" role="region" aria-live="polite">
    <div class="stagebar">
      <button class="back" id="backbtn">← All flows</button>
      <span class="ti" id="st-title"></span>
      <span class="pill" id="st-persona"></span>
      <span class="pill sur" id="st-surface"></span>
      <span class="pill" id="st-progress"></span>
    </div>
    <div class="stagerow">
      <button class="navarrow" id="prevbtn" aria-label="Previous step">‹</button>
      <div class="devicewrap"><div class="device" id="device"></div></div>
      <button class="navarrow" id="nextbtn" aria-label="Next step">›</button>
    </div>
    <p class="hint" id="hint"></p>
    <div id="insp" role="status" aria-live="polite"></div>
    <details class="impl-notes" id="st-details">
      <summary>Implementation notes</summary>
      <div class="meta">
        <div class="row"><span class="stchip" id="st-state"></span><span class="who" id="st-who"></span></div>
        <div class="row"><span class="ev" id="st-ev"></span></div>
        <div class="row"><span class="cite" id="st-cite"></span></div>
        <div class="note" id="st-note" hidden></div>
        <div class="brs" id="st-brs"></div>
      </div>
    </details>
    <div class="dotsrow"><div class="dots" id="dots"></div></div>
  </div>
</div>
</div>

<div id="tab-screens" role="tabpanel" aria-labelledby="tabbtn-screens" hidden>
<div id="screens">
  <div id="exphome">
    <h1>Screen library</h1>
    <p class="sub">Choose a surface and open a screen. The state switcher covers loading, recovery, validation, and alternate states.</p>
    ${screenTabs}
    ${screenCards}
  </div>
  <div id="expstage">
    <div class="stagebar">
      <button class="back" id="expall">▦ Screen library</button>
      <button class="back" id="expback">← Back</button>
      <span class="screenkey" id="exp-key"></span>
      <span class="ti" id="exp-title"></span>
    </div>
    <div class="stchips" id="expstates" aria-label="Screen states"></div>
    <div class="device" id="expdevice"></div>
    <div id="expinsp" role="status" aria-live="polite"></div>
  </div>
</div>
</div>

<div id="tab-doc" role="tabpanel" aria-labelledby="tabbtn-doc" hidden>
<div class="wrap">
<nav class="doc" aria-label="Sections">
  <div class="brand">Implementation reference<small>prototypes.md · 2026-07-25</small></div>
  ${navSb}
  ${navRef}
</nav>
<main>
<h1>${esc(h1)}</h1>
<p class="sub">${new Set(SBS.map((b) => b.n)).size} storyboards composing the locked wireframes (W1–W26 + community CI-W frames), the missing-frame index, the action inventory, and the state-coverage matrix. Every claim cites file:line in the repo specs. Source of truth: <code>.plans/active/commitment-pooling/prototypes.md</code>.</p>
${refToc}
${statusNote}
${front.join("\n")}
${sections}
</main>
</div>
</div>

<script>
var DATA = ${PLAYER_DATA};
${PLAYER_JS}
</script></body></html>`;

writeFileSync(OUT, html);
const byteSize = new TextEncoder().encode(html).byteLength;

// prototypes-coverage.md transcribes this snapshot by hand and has drifted from
// it before (W2 carried 24 states after two were added). Compare on every build
// so the transcription cannot silently rot again.
const totalStates = SCREENS.reduce((a, s) => a + s.states.length, 0);
const totalScenes = sbs.reduce((a, b) => a + b.steps.length, 0);
try {
  const coverage = readFileSync(new URL("./prototypes-coverage.md", import.meta.url), "utf8");
  const claimed: [string, number, number][] = [
    ["screens", SCREENS.length, Number(coverage.match(/- (\d+) registered screens/)?.[1])],
    ["states", totalStates, Number(coverage.match(/registered screens \/ (\d+) rendered states/)?.[1])],
    ["hotspots", Object.keys(HOTS).length, Number(coverage.match(/- (\d+) registered hotspots/)?.[1])],
    ["scenes", totalScenes, Number(coverage.match(/source flows \/ (\d+) scenes/)?.[1])],
  ];
  for (const [label, actual, stated] of claimed) {
    if (Number.isFinite(stated) && stated !== actual)
      console.warn(`coverage-doc drift: prototypes-coverage.md says ${stated} ${label}, build has ${actual}`);
  }
} catch {
  console.warn("coverage-doc drift: prototypes-coverage.md not readable — snapshot unchecked");
}

console.log(
  "screens:", SCREENS.length,
  "| states:", totalStates,
  "| hotspots:", Object.keys(HOTS).length,
  "| journeys:", sbs.length,
  "| scenes:", sbs.reduce((a, b) => a + b.steps.length, 0),
  "| warnings:", warnings.length,
  "| chars:", html.length,
  "| bytes:", byteSize,
  "\n→", OUT,
);
