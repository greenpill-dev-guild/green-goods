// Builds the "Commitment Pooling — Flow Prototypes" claude.ai artifact from the
// hifi/ module set alone (the retired hand-written prototypes.md stays in the
// repo as history and is no longer an input). Three tabs:
//   1) Guided flows — click-through prototypes: the canonical control
//      advances, real decision points are on-frame choices, every other drawn
//      control answers via the inspector or jumps elsewhere.
//   2) Screen library — free-roam: browse every review-visible screen, switch its states
//      (Storybook-style), tap any control, navigate the screen graph.
//   3) Reference — flow and screen indexes generated from the registry on
//      every build, so the reference cannot drift from the prototypes.
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
import {
  COMPONENT_COUNTS,
  COMPONENTS_TAB_HTML,
  COVERED_KIT_BUILDERS,
  GALLERY_ERRORS,
  GALLERY_SCAN_INPUT,
} from "./hifi/components";
import { iconSprite } from "./hifi/icons";
import { SB_ROUTE_ALIASES, SBS } from "./hifi/journeys";
import * as kitAll from "./hifi/kit";
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
import { CHAPTERS, FLOW_GROUPS, ROLES } from "./hifi/types";
import { normalizeAndValidate, scanGalleryHtml } from "./hifi/validate";

const OUT = process.env.OUT ?? "/tmp/commitment-pooling-prototypes.html";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
// Components-tab gallery: structural checks from the module itself, the same
// copy/control scans the screens get (new call sites, unchanged rules), and a
// completeness gate — every kit builder must have a gallery entry, so the tab
// can never silently fall behind the kit.
const galleryErrors: string[] = [...GALLERY_ERRORS];
for (const { surface, specimens, chromeText } of GALLERY_SCAN_INPUT)
  galleryErrors.push(...scanGalleryHtml(surface, specimens, chromeText));
for (const [name, value] of Object.entries(kitAll))
  if (typeof value === "function" && !COVERED_KIT_BUILDERS.has(name))
    galleryErrors.push(`COMPONENTS: kit builder ${name} has no gallery entry`);
const allErrors = [...BUILD_ERRORS, ...errors, ...frameContractErrors, ...galleryErrors];
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
  // Retired `#sbX/i` routes → where that scene lives now (journeys.ts).
  sbRoutes: SB_ROUTE_ALIASES,
});

const visibleSbs = sbs.filter((sb) => sb.reviewVisible);
const visibleScreens = SCREENS.filter((screen) => screen.reviewVisible);

// Flow cards: chapter clusters inside each surface tab, role chips instead of
// the old surface badge (which merely repeated the tab label), and a derived
// "continues in" hint taken from the final scene's cross-flow branch links —
// derived, not transcribed, so a re-split can never leave a stale hint.
const roleLabel = new Map<string, string>(ROLES.map((role) => [role.id, role.label]));
const sbTitle = new Map(sbs.map((sb) => [sb.id, sb.title]));
// Card anatomy is title → description → role tags (Afo, D3). The persona line
// the description replaced still shows on the stage pill and in the Reference
// tab.
//
// The continues-in tag is GONE (2026-08-16, Afo — the text below the role tags,
// not just its arrow). It repeated titles the reader meets in the catalog
// anyway, it was the only ragged thing left on an otherwise uniform grid, and
// putting a second kind of tag beside the roles muddied the one thing a reader
// scans this row for. Where a flow hands off is still shown at the end of the
// flow itself, as branch links — where it can actually be followed.
const flowCardHtml = (sb: (typeof visibleSbs)[number]) =>
  `<button class="sbcard" data-sb="${sb.id}"><span class="sbt">${esc(sb.title)}</span><span class="sbd">${esc(
    sb.desc,
  )}</span><span class="cardchips">${sb.roles
    .map((role) => `<span class="role-chip">${esc(roleLabel.get(role) ?? role)}</span>`)
    .join("")}</span></button>`;
const flowCatalog = FLOW_GROUPS.map(({ id, label }, groupIx) => {
  const groupSbs = visibleSbs.filter((sb) => sb.reviewGroup === id);
  const chapterBlocks = (CHAPTERS[id] ?? []).flatMap((chapter) => {
    const cards = groupSbs.filter((sb) => sb.chapter === chapter.id).map(flowCardHtml).join("");
    if (!cards) return []; // an empty chapter simply doesn't render (renameable data, no count asserts)
    // Each chapter is a block inside a two-column grid (iteration 2): less
    // scrolling, subcategories visible side by side on wide review screens.
    const inner = `<section class="chapter-block"><h3 class="chapter-h">${esc(chapter.label)}</h3><div class="grid">${cards}</div></section>`;
    return [chapter.collapsed
      ? `<details class="chapter-fold chapter-block"><summary><h3 class="chapter-h">${esc(chapter.label)}</h3><span class="fold-hint">protocol team only — open when needed</span></summary><div class="grid">${cards}</div></details>`
      : inner];
  });
  // The gutter rule only makes sense once a second column exists — derived from
  // the blocks actually rendered, never asserted per surface.
  const cols = `chapter-cols${chapterBlocks.length > 1 ? " ruled" : ""}`;
  return `<section class="catalog-panel flow-catalog" id="flow-panel-${id}" role="tabpanel" aria-labelledby="flow-tab-${id}" data-flow-group="${id}"${groupIx ? " hidden" : ""}><h2>${esc(label)} flows</h2><div class="${cols}">${chapterBlocks.join("")}</div></section>`;
}).join("");

const screenCards = screenCardsHtml();

// ---------- Reference tab: generated from the executable registry ----------
// prototypes.md was the hand-written July reference; it drifted within weeks
// of each restructure. This tab now derives from the same registry the
// validator checks, so it cannot disagree with the prototypes (register #96).
const statusNote = `<aside class="status"><h2>Status — audit closure 2026-07-25 · hi-fi register #36</h2>
<p><strong>Presentation review</strong>: ${SBS.filter((b) => b.reviewVisible).length} guided flows and ${SCREENS.filter((s) => s.frame !== "ascii").length} high-fidelity screens are grouped by Client PWA, Admin console, and Editorial website, with lifecycle-ordered chapters inside each tab and acting-role tags on every card. September Community wireframes remain validated source material with stable direct hashes, but are intentionally hidden from the presentation catalogs until their high-fidelity pass. Adopted micro-frames remain dissolved into their locked parent states. Rendered copy and lifecycle-sensitive call/state pairings are build-linted.</p>
<p><strong>Self-contained flows (2026-08-10)</strong>: every flow is one person's action to completion. "Meanwhile" echoes are read-only consequences — the build rejects an echo carrying a control — and cross-role continuations hand off through end-of-flow links (sb42–sb48 carry the split-out segments; old mid-ribbon hashes retire as <code>#sb9</code> did). The creation wizards default the confirmer rule with the Green Goods team fallback ON for the pilot (supersedes the 2026-08-02 off-by-default closure; the unreachable-path guard, required reason, and contributor exclusion are unchanged), keeping the default path to four steps and moving named groups, team policy, and assessment to an Advanced detour.</p>
<p><strong>Exchange wave drawn (2026-08-10, register #97)</strong>: W28–W31 and the two exchange journeys are now in the executable registry — the same-day contracts audit found <code>acceptExchange</code> shipped and tested on-chain, so the screens caught up with the chain. Bilateral pair creation, atomic acceptance, counterpart-lapsed context, and template-first creation are all walkable; multilateral and transferable exchange stay design-only in the exchange architecture brief.</p>
<p><strong>Adopted</strong>: pool open/close on the pool status card + open-cycle guard prompt (MF-1) · member pre-acceptance withdraw (MF-2a) · <code>waiting_for_hat</code> covers the six pool job kinds in August (MF-5) · the admin due-live expiry action, post-expiry queue, and member "offer again" ship in August, while a keeper cron remains only a post-launch backstop (MF-3/MF-4) · pilot stewards hold the executor role with a visible missing-role guard state · read-only delivery-gate status row on W21 · testimony is September-realized (MF-12) · the dry run rehearses payout with a real minimal Cookie Jar withdrawal.</p>
<p><strong>Placement closure (register #51)</strong>: W10 steward cancel, the Work Review commitment row, the pre-claim personal/garden chooser, and the W10 attach-assessment picker are locked where drawn. The W10 accepted/override states, W23 delivery-blocked state, W26 reconciliation report, queue-funding control, and both origin-specific settlement-cancellation messages are also realized rather than review proposals. <strong>Join-request queue</strong> design is canonical in <code>../community-interface/join-queue-spec.md</code>; implementation remains gated on RESR-64's operating record.</p></aside>`;

const chapterLabelOf = (group: keyof typeof CHAPTERS, id: string) =>
  (CHAPTERS[group] ?? []).find((chapter) => chapter.id === id)?.label ?? id;
const callsOfFlow = (sb: (typeof sbs)[number]) => {
  const set = new Set<string>();
  for (const step of sb.steps)
    for (const hid of [step.hot?.h, ...(step.alts ?? []).map((alt) => alt.h)])
      if (hid) for (const call of HOTS[hid]?.calls ?? []) set.add(call);
  return [...set];
};
const citesOfFlow = (sb: (typeof sbs)[number]) => {
  const set = new Set<string>();
  for (const step of sb.steps)
    for (const token of (step.cite ?? "").split("·")) if (token.trim()) set.add(token.trim());
  return [...set];
};
const capList = (items: string[], max: number) =>
  items.length > max ? `${items.slice(0, max).join(" · ")} · +${items.length - max} more` : items.join(" · ");
const walkedBy = new Map<string, Set<string>>();
for (const sb of visibleSbs)
  for (const step of sb.steps) {
    if (!walkedBy.has(step.f)) walkedBy.set(step.f, new Set());
    walkedBy.get(step.f)!.add(sb.title);
  }
const callsOfScreen = (id: string) => {
  const set = new Set<string>();
  for (const hid of SCREEN_HOTS[id] ?? []) for (const call of HOTS[hid]?.calls ?? []) set.add(call);
  return [...set];
};
// One section per surface, flows and screens together (Afo 2026-08-10: split
// flow/screen sections read as duplicates of the browsing tabs). The tables
// answer the implementation question the tabs don't: calls, cites, walked-by.
const refSurfaceSections = FLOW_GROUPS.map(({ id, label }) => {
  const flowRows = visibleSbs.filter((sb) => sb.reviewGroup === id).map((sb) => {
    const calls = callsOfFlow(sb);
    return `<tr><td><strong>${esc(sb.title)}</strong><br><span style="color:var(--stone);font-size:12px">${esc(sb.persona)} · <code>#${sb.id}</code></span></td><td>${esc(chapterLabelOf(sb.reviewGroup, sb.chapter))}</td><td>${sb.steps.length}</td><td>${calls.length ? `<code>${calls.join("</code> <code>")}</code>` : "read-only walk"}</td><td>${esc(capList(citesOfFlow(sb), 8))}</td></tr>`;
  }).join("");
  const screenGroup = REVIEW_GROUPS.find((group) => group.surface === id);
  const screenRows = (screenGroup?.ids ?? []).map((sid) => {
    const scr = SCREENS.find((candidate) => candidate.id === sid)!;
    const calls = callsOfScreen(sid);
    const walkers = [...(walkedBy.get(sid) ?? [])];
    return `<tr><td><strong><code>${esc(sid)}</code></strong> ${esc(scr.title.replace(/^W\S+ · /, ""))}</td><td>${scr.states.length}</td><td>${calls.length ? `<code>${calls.join("</code> <code>")}</code>` : "—"}</td><td>${walkers.length ? esc(capList(walkers, 3)) : "Screen library only"}</td></tr>`;
  }).join("");
  return `<section id="ref-${id}"><h2>${esc(label)}</h2>
<h3>Flows — what each walked path exercises</h3>
<div class="tw"><table><thead><tr><th>Flow</th><th>Chapter</th><th>Scenes</th><th>Contract calls on the walked path</th><th>Spec cites</th></tr></thead><tbody>${flowRows}</tbody></table></div>
<h3>Screens — what each screen declares</h3>
<div class="tw"><table><thead><tr><th>Screen</th><th>States</th><th>Calls declared</th><th>Walked by</th></tr></thead><tbody>${screenRows}</tbody></table></div></section>`;
}).join("\n");
const refHowTo = `<section id="ref-howto"><h2>How to read this reference</h2>
<p>Everything on this tab is <strong>generated from the executable registry on every build</strong> — the same source the validator checks — so it cannot drift from the Flows and Screens tabs. Those tabs are for browsing; this one answers the implementation questions they don't: which contract calls a walked path exercises, which spec lines it cites, and which flows exercise each screen. Deep links are stable: <code>#sbN/i</code> opens a guided flow at a scene, <code>#screens/ID@state</code> opens a screen state.</p>
<p>Spec cites resolve to the plan-hub documents: <code>UX</code> → uiux-spec.md (by line or section), <code>CS</code> → contract-spec.md, <code>WF</code> → wireframes.md, <code>AM</code> → acceptance-matrix.md, <code>SS</code> → settlement-spec.md, <code>DG</code> → diagrams.md. Other keys cite sibling documents in the same hub. The retired hand-written reference (prototypes.md) remains in the repo as historical source material.</p></section>`;
const refPlanned = `<section id="ref-planned"><h2>Planned additions</h2>
<p>The exchange wave (W28–W31, both journeys) graduated into the executable registry on 2026-08-10 (register #97), closing the one place the chain was ahead of the prototypes. What remains planned: the September Community wireframes (registered, validated, directly addressable, hidden from the catalogs until their high-fidelity pass), September-realized testimony (register #34g), and the multilateral/transferable exchange tier, which stays design-only in the exchange architecture brief.</p></section>`;
const refNav = `<div class="ng">Start here</div><a href="#ref-howto">How to read this</a>
<div class="ng">Surfaces</div>${FLOW_GROUPS.map(({ id, label }) => `<a href="#ref-${id}">${esc(label)}</a>`).join("")}
<div class="ng">Roadmap</div><a href="#ref-planned">Planned additions</a>`;
const refToc = `<nav class="ref-toc" aria-label="Reference overview"><a href="#ref-howto"><b>How to read this</b><span>generated, not written</span></a>${FLOW_GROUPS.map(({ id, label }) => {
  const flowCount = visibleSbs.filter((sb) => sb.reviewGroup === id).length;
  const screenCount = REVIEW_GROUPS.find((group) => group.surface === id)?.ids.length ?? 0;
  return `<a href="#ref-${id}"><b>${esc(label)}</b><span>${flowCount} flows · ${screenCount} screens</span></a>`;
}).join("")}<a href="#ref-planned"><b>Planned additions</b><span>exchange wave · September</span></a></nav>`;
const refSections = `${refHowTo}\n${refSurfaceSections}\n${refPlanned}`;
const distinctCalls = new Set(visibleSbs.flatMap((sb) => callsOfFlow(sb))).size;

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
// 35 = the 25-screen August set + three standing-commitment screens (W32/W34/
// W35 — W33 folded into the composer 2026-08-11, D2) + the four
// exchange/template screens (W28–W31, register #97) + the member and steward
// funded-claim checkpoints (W36/W37, register #103) + the phone-presentation
// pool tab (W7M, 2026-08-16 admin review).
assertBuild(visibleScreens.length === 37, `expected 37 visible screens, found ${visibleScreens.length}`);
assertBuild(screenCounts.client === 19 && screenCounts.admin === 16 && screenCounts.editorial === 2, `screen grouping must be 19 client / 16 admin / 2 editorial`);
const presentationCatalogs = flowCatalog + screenCards;
const presentationRuntimeCopy = [
  presentationCatalogs,
  ...visibleSbs.flatMap((sb) => [
    sb.title,
    sb.desc,
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
  padding:5px 14px;font-weight:600;font-size:13px;cursor:pointer;min-height:44px}
.tab.on{background:var(--accent);border-color:var(--accent);color:var(--canvas)}
/* Chrome-level toggle. The dialect tokens already ship both theme signals
   ([data-theme="dark"] and the prefers-color-scheme twin), so pinning the
   attribute is all that is needed to review dark on a light machine. */
.chromebtn{margin-left:auto;border:1px solid var(--line);background:var(--panel);color:var(--stone);
  border-radius:8px;padding:5px 12px;font-weight:600;font-size:12.5px;cursor:pointer;min-height:44px}
.chromebtn:hover{color:var(--ink)}
.chromebtn[aria-pressed="true"]{border-color:var(--accent-ink);color:var(--ink)}
.chromebtn .tb{display:none;align-items:center;gap:7px}
.chromebtn[aria-pressed="false"] .tb-dark{display:inline-flex}
.chromebtn[aria-pressed="true"] .tb-light{display:inline-flex}
.chromebtn svg{width:15px;height:15px;fill:currentColor;flex:none}
#tab-doc,#tab-play,#tab-screens,#tab-comps{display:none}
#tab-doc.on,#tab-play.on,#tab-screens.on,#tab-comps.on{display:block}

/* ---- Components tab (component-library contract, 2026-08-14) ---- */
#comps{max-width:1180px;margin:0 auto;padding:26px 20px 60px}
#comps h1{font-size:21px;margin:0 0 4px;text-wrap:balance}
#comps .sub{color:var(--stone);font-size:13px;margin:0 0 14px;max-width:88ch}
.cindex{display:flex;flex-direction:column;gap:4px;margin:0 0 18px;border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:10px 12px;font-size:12px}
.cindex .cig{display:flex;flex-wrap:wrap;gap:2px 4px;align-items:center}
.cindex b{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--stone);margin-right:6px;font-weight:700}
.cindex a{color:var(--accent-ink);text-decoration:none;padding:3px 7px;border-radius:6px}
.cindex a:hover{background:var(--canvas)}
.cfam h3{margin:26px 0 6px;font-size:12px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--stone)}
.centry{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:14px 16px 12px;margin:10px 0;scroll-margin-top:64px}
.centry.hl{outline:2px solid var(--accent);outline-offset:2px}
.chead{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.chead h4{margin:0;font-size:15px}
.ckit{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--stone);background:var(--canvas);border:1px solid var(--line);border-radius:5px;padding:1px 7px}
.complink{margin-left:auto;border:1px solid var(--line);background:var(--canvas);color:var(--stone);border-radius:7px;min-width:34px;min-height:34px;cursor:pointer;font-size:14px}
.complink:hover{color:var(--ink);border-color:var(--accent-ink)}
.complink.copied::after{content:" copied";font-size:10.5px;color:var(--accent-ink)}
.complink.copyfail::after{content:" copy failed";font-size:10.5px;color:var(--amber)}
.ctag{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;border-radius:99px;padding:2px 8px}
.ctag.new{background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent-ink)}
.ctag.drift{background:var(--amber-bg);color:var(--amber)}
.ctag.delib{background:var(--chipw);color:var(--stone)}
.cship,.cused{margin:6px 0 0;font-size:12.5px;color:var(--stone)}
.cship code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px}
.cship.netnew{color:var(--accent-ink)}
.crule{margin:6px 0 0;font-size:12.5px;color:var(--ink);max-width:88ch}
.cdrift{margin:6px 0 0;font-size:12.5px;color:var(--amber);border-left:3px solid var(--amber);background:var(--amber-bg);border-radius:0 6px 6px 0;padding:4px 9px;max-width:88ch}
.cdelib{margin:6px 0 0;font-size:12.5px;color:var(--stone);border-left:3px solid var(--line);padding-left:9px;max-width:88ch}
.cspecs{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0 2px;align-items:flex-start}
.spec{margin:0;display:flex;flex-direction:column;gap:5px;min-width:0;max-width:100%}
.spec figcaption{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--stone)}
.specbox{border:1px solid var(--line);border-radius:10px;padding:14px;background:var(--cv);overflow:auto}
.spec.w-p .specbox{width:358px;max-width:100%}
.spec.w-m .specbox{width:min(560px,100%)}
.spec.w-l{flex:1 1 100%}
.spec.w-l .specbox{width:100%}
.spec.w-frame .specbox{padding:10px}
.zoomwrap{width:calc(${PHONE_SHELL_WIDTH}px*.5);height:calc(${PHONE_SHELL_HEIGHT}px*.5);overflow:hidden}
.zoomwrap>.phonefit{transform:scale(.5);transform-origin:top left}
.specbox[style*="height"]{display:flex;flex-direction:column}
.specbox[style*="height"]>.sheetstage,.specbox[style*="height"]>.dlgstage,
.specbox[style*="height"]>.deskwin,.specbox[style*="height"]>.webwin{flex:1;min-height:0}
.uchip{font:600 11px ui-monospace,SFMono-Regular,Menlo,monospace;border:1px solid var(--line);background:var(--canvas);color:var(--accent-ink);border-radius:6px;padding:2px 7px;text-decoration:none;margin-right:4px;display:inline-block;margin-top:2px}
.uchip:hover{border-color:var(--accent-ink)}

#play,#screens{max-width:1080px;margin:0 auto;padding:26px 20px 44px}
/* Scoped away from the phone frames (2026-08-16 round 12). This is the artifact
   SHELL's page heading, but as a bare ID selector it also matched every <h1>
   inside a rendered screen — an ID beats .hf .hdr.fixed h1 on specificity, so
   the flow header's 17px nowrap treatment had never applied in the Screen
   library or Guided flows panes. Every wizard title rendered at 21px and was
   free to wrap: "Make a request" broke across two lines inside fixed chrome. */
#play h1:not(.hf h1),#screens h1:not(.hf h1){font-size:21px;margin:0 0 4px;text-wrap:balance}
#play .sub,#screens .sub{color:var(--stone);font-size:13px;margin:0 0 18px;max-width:78ch}
.surface-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 18px;padding:4px;width:max-content;max-width:100%;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.surface-tab{border:0;background:transparent;color:var(--stone);border-radius:8px;padding:7px 13px;font-weight:650;font-size:12.5px;cursor:pointer;min-height:44px}
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
.sbm{font-size:11.5px;color:var(--stone)} /* screen-library cards: one-line state count */
/* Flow cards are a grid of peers, so they are all ONE height (2026-08-16, Afo):
   ragged cards read as a ragged catalog. Title and description each get a fixed
   line box — two and four lines — so neither a long name nor a long description
   changes the card's size. The four-line box is deliberately roomier than the
   median description, which is the "space to be longer where needed"; anything
   past it ellipsises rather than pushing the card taller. */
.sbt{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
  min-height:calc(2 * 1.3em);line-height:1.3}
.sbd{font-size:11.5px;line-height:1.45;color:var(--stone);margin-top:1px;
  display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;
  min-height:calc(4 * 1.45em)} /* flow cards: fixed four-line description box */
.chapter-h{margin:20px 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--stone)}
.catalog-panel .chapter-h:first-of-type{margin-top:6px}
.chapter-cols{display:grid;grid-template-columns:1fr;gap:0 28px;align-items:start;position:relative}
@media (min-width:760px){
  .chapter-cols{grid-template-columns:1fr 1fr}
  /* One continuous rule down the gutter, drawn on the grid itself: chapter
     blocks are different heights, so a per-block border would break the seam
     into ragged segments. The ruled class is set only when a panel actually
     fills both columns, so the single-chapter editorial tab draws no line. */
  .chapter-cols.ruled::before{content:"";position:absolute;top:0;bottom:0;left:50%;width:1px;background:var(--line)}
}
.chapter-block{min-width:0}
.chapter-block .chapter-h{margin-top:14px}
.chapter-cols .grid{grid-template-columns:repeat(auto-fill,minmax(210px,1fr))}
/* The tag row is the last thing that could still make cards ragged: one to
   three wrapped rows depending on how many roles act in a flow and how long
   the flows it continues into are named. Fixed at two rows — roles come first
   and are short, so what ellipsises is the tail of a continues-in title, which
   the flow itself shows in full. */
/* One row of role tags is all that sits here now, and roles are short, so the
   box is a single row tall. */
.cardchips{display:flex;flex-wrap:wrap;gap:4px;margin-top:auto;padding-top:7px;
  min-height:calc(7px + 20px)}
/* Tags share ONE metric across the artifact (2026-08-16, Afo): same radius,
   padding, size and weight as the .ch tag on a promise card, so a tag reads as
   a tag whether it sits on a flow card or inside a rendered screen. Role tags
   keep only their accent colour. */
.role-chip{border-radius:8px;padding:2.5px 8px;font-weight:600;font-size:12px;
  background:var(--bg-accent-soft,color-mix(in srgb,var(--accent) 14%,transparent));
  color:var(--accent-ink);white-space:nowrap}
.chapter-fold{border:1px dashed var(--line);border-radius:10px;padding:2px 12px 8px;margin:20px 0 8px}
.chapter-fold summary{cursor:pointer;display:flex;align-items:center;gap:10px;min-height:44px;list-style:revert}
.chapter-fold summary .chapter-h{margin:0}
.chapter-fold .fold-hint{font-size:11px;color:var(--stone)}
.chapter-fold[open]{padding-bottom:12px}
.screenkey{font:700 10.5px ui-monospace,Menlo,monospace;color:var(--accent-ink);letter-spacing:.04em}
#stage,#expstage{display:none}
#stage.on,#expstage.on{display:block}
.stagebar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px}
.stagebar .back{border:1px solid var(--line);background:var(--panel);color:var(--ink);
  border-radius:8px;padding:4px 12px;cursor:pointer;font-weight:600;font-size:12.5px;min-height:44px}
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
  font-weight:700;font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:3px 10px;
  border-radius:13px 0 8px 0;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
.pill.echo{border-style:dashed;color:var(--stone)}
/* lo-fi ascii frames have no inner scroll surface — cap + scroll the panel itself */
.device.f-ascii{max-height:var(--dev-cap);overflow:auto}
.device .mftag{position:absolute;top:0;right:0;background:var(--amber-bg);color:var(--amber);
  font-weight:700;font-size:10px;letter-spacing:.08em;text-transform:uppercase;padding:3px 10px;border-radius:0 13px 0 8px}
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
  padding:3px 12px;font-weight:600;font-size:12px;cursor:pointer;min-height:44px}
.vchip.on{background:var(--accent);border-color:var(--accent);color:var(--canvas)}
.vchip.prop{border-style:dashed;border-color:var(--amber);color:var(--amber)}
.vchip.prop.on{background:var(--amber);border-color:var(--amber);color:var(--canvas)}
/* Frame heading in the state switcher. Forces a line break so each frame's
   states sit together — the collapse is only legible if the groups are. */
.vgroup{flex:0 0 100%;margin:8px 0 -2px;font-weight:600;font-size:11px;letter-spacing:.04em;
  text-transform:uppercase;color:var(--stone);opacity:.75}
.vgroup:first-child{margin-top:0}
.hint{margin:10px 0 0;font-size:12.5px;color:var(--accent-ink);font-weight:600}
.hint .kbd{color:var(--stone);font-weight:400}
#insp{margin:10px 0 0;border:1px solid var(--line);border-left:3px solid var(--accent-ink);
  background:var(--panel);border-radius:8px;padding:8px 12px;font-size:12.5px;display:none}
#insp.on{display:block}
#insp b{display:block;margin-bottom:2px}
#insp .ia{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap}
#insp .ia button{border:1px solid var(--accent-ink);background:transparent;color:var(--accent-ink);
  border-radius:7px;padding:2px 10px;font-weight:600;font-size:12px;cursor:pointer;min-height:44px}
.insp{margin:10px 0 0}
.insp.on{border:1px solid var(--line);border-left:3px solid var(--accent-ink);background:var(--panel);
  border-radius:8px;padding:8px 12px;font-size:12.5px}
.insp .walkbtn{margin-left:8px;border:1px solid var(--accent-ink);background:transparent;color:var(--accent-ink);
  border-radius:7px;padding:2px 10px;font-weight:600;font-size:12px;cursor:pointer;min-height:44px}
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
  padding:3px 10px;font-weight:600;font-size:12px;cursor:pointer;min-height:44px}
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
#tab-doc h3{font-size:14px;margin:20px 0 6px}
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
  <button class="tab" id="tabbtn-comps" role="tab" aria-selected="false" aria-controls="tab-comps" tabindex="-1">Components</button>
  <button class="tab" id="tabbtn-doc" role="tab" aria-selected="false" aria-controls="tab-doc" tabindex="-1">Implementation reference</button>
  <button class="chromebtn" id="themebtn" type="button" aria-pressed="false"><span class="tb tb-dark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5.5a8.5 8.5 0 0 0 8.5 8.5c.7 0 1.4-.09 2.06-.25A9.5 9.5 0 1 1 10.25 3.44 8.5 8.5 0 0 0 10 5.5z"/></svg>Dark mode</span><span class="tb tb-light"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>Light mode</span></button>
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

<div id="tab-comps" role="tabpanel" aria-labelledby="tabbtn-comps" hidden>
${COMPONENTS_TAB_HTML}
</div>

<div id="tab-doc" role="tabpanel" aria-labelledby="tabbtn-doc" hidden>
<div class="wrap">
<nav class="doc" aria-label="Sections">
  <div class="brand">Implementation reference<small>generated from the registry · 2026-08-10</small></div>
  ${refNav}
</nav>
<main>
<h1>Commitment Pooling: Implementation Reference</h1>
<p class="sub">${visibleSbs.length} guided flows · ${visibleScreens.length} screens · ${distinctCalls} distinct contract calls, generated from the executable registry on every build — the same source the validator checks, so this page cannot drift from the prototypes. The retired hand-written reference (<code>prototypes.md</code>) stays in the repo as historical source material.</p>
${refToc}
${statusNote}
${refSections}
</main>
</div>
</div>

<script>
var DATA = ${PLAYER_DATA};
${PLAYER_JS}
</script></body></html>`;

// Vocabulary and state-truth regressions here are product-model defects, not
// presentation warnings. Keep them as hard build failures so an old artifact
// cannot be republished after the one-noun Offer correction.
const staleOfferNounPatterns: [RegExp, string][] = [
  [/\bpractice-template\b/i, "practice-template"],
  [/\bpractice templates?\b/i, "practice template"],
  [/\bpractice-first\b/i, "practice-first"],
  [/\bpractice library\b/i, "practice library"],
  [/\bstanding-practice-remains\b/i, "standing-practice-remains"],
  [/\bstart from a practice\b/i, "start from a practice"],
];
for (const [pattern, label] of staleOfferNounPatterns) {
  if (pattern.test(html)) throw new Error(`Offer vocabulary regression: generated artifact still contains "${label}".`);
}

const stateHtml = (screenId: string, stateId: string) =>
  SCREENS.find((screen) => screen.id === screenId)?.states.find((state) => state.id === stateId)?.html ?? "";
const claimantView = stateHtml("W34", "claimant-view");
const claimantAllowedFields = [
  "provider",
  "terms",
  "garden",
  "openNow",
  "openTerms",
  "claimExplanation",
];
const claimantRenderedFields = [...claimantView.matchAll(/data-claimant-field="([^"]+)"/g)].map(
  (match) => match[1],
);
if (
  !claimantView ||
  !claimantView.includes('data-privacy-contract="ongoing-offer-claimant-v1"') ||
  JSON.stringify(claimantRenderedFields) !== JSON.stringify(claimantAllowedFields)
) {
  throw new Error(
    "Privacy regression: W34@claimant-view must render only the approved structural claimant fields; holder Story and kept-count fields are not permitted.",
  );
}
// W33 retired 2026-08-11 (D2), and iteration 2 folded ongoing INLINE into the
// composer: the renewal prompt lives on the ongoing review state + W34. What
// this assertion protects is that an ongoing offer never renews itself — the
// member is asked. The phrase was "Ask me again next cycle" until 2026-08-18,
// when "cycle" left member copy: it is the machine's word for what the composer
// calls where it runs, and it appeared in a control the member reads.
for (const [screenId, stateId] of [["W3", "support-review-ongoing"], ["W34", "active-two"]] as const) {
  if (!stateHtml(screenId, stateId).includes("Ask me whether to keep offering it")) {
    throw new Error(`Renewal-copy regression: ${screenId}@${stateId} lost the exact phrase "Ask me whether to keep offering it".`);
  }
}
const requiredTargets: [string, string][] = [
  ["w32.offer-once", "screen:W3@saved-offer-edit"],
  // Was `support-howmuch-ongoing` — this assertion locked the decision that the
  // separate ongoing wizard retires INTO the composer, and that still holds.
  // What changed (2026-08-17, Afo) is where in the composer it lands: jumping
  // straight to the amount step made this the one entry that never picked a
  // cycle, and an ongoing offer has to name where it runs, because every
  // commitment it opens carries that cycle.
  // Normalized to the bare screen id: step-what is W3's first state, and
  // validate.ts strips "@<first state>" from every target.
  ["w32.offer-over-time", "screen:W3"],
  // Was W32@series-queued. An ongoing offer used to be the one creation flow
  // that finished in the wallet's private section instead of the pool tab
  // (2026-08-17, Afo). It now lands where every other commitment lands.
  ["w3.submit-ongoing", "screen:W1@ongoing-queued"],
  ["w35.queued-done", "screen:W34@places-queued"],
];
for (const [hotId, target] of requiredTargets) {
  if (HOTS[hotId]?.to !== target) {
    throw new Error(`State-coherence regression: ${hotId} must target ${target}.`);
  }
}

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
  // The aggregate totals above agreed while 19 of 39 per-screen rows were wrong
  // in both directions (2026-08-19 review), because a total can stay right while
  // two rows drift the opposite way. Check each row, and check every screen has
  // one — a per-screen registry that omits a screen is worse than no registry.
  const listed = new Set<string>();
  for (const line of coverage.split("\n")) {
    const row = /^\|\s*([A-Za-z0-9]+)\s*\|\s*[^|]+?\s*\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*$/.exec(line);
    if (!row) continue;
    const screen = SCREENS.find((s) => s.id === row[1]);
    if (!screen) continue;
    listed.add(screen.id);
    const ids = screen.states.map((s) => s.id).join(", ");
    if (Number(row[2]) !== screen.states.length)
      console.warn(`coverage-doc drift: ${screen.id} row says ${row[2]} states, build has ${screen.states.length}`);
    else if (row[3] !== ids)
      console.warn(`coverage-doc drift: ${screen.id} row lists different state ids than the build`);
  }
  for (const s of SCREENS)
    if (!listed.has(s.id)) console.warn(`coverage-doc drift: ${s.id} has no row in the screen registry`);
} catch {
  console.warn("coverage-doc drift: prototypes-coverage.md not readable — snapshot unchecked");
}

console.log(
  "screens:", SCREENS.length,
  "| states:", totalStates,
  "| hotspots:", Object.keys(HOTS).length,
  "| journeys:", sbs.length,
  "| scenes:", sbs.reduce((a, b) => a + b.steps.length, 0),
  "| components:", COMPONENT_COUNTS.entries,
  "| specimens:", COMPONENT_COUNTS.specimens,
  "| warnings:", warnings.length,
  "| chars:", html.length,
  "| bytes:", byteSize,
  "\n→", OUT,
);
