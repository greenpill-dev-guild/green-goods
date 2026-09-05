// Builds the "Tech and Sun: the first commitment cycle" claude.ai artifact: a
// sixteen by nine presentation deck for the Tech and Sun core team working
// session, September 2026. Seventeen full bleed slides, keyboard, tap and
// swipe navigation, a progress line, a speaker notes drawer on the N key,
// staggered reveals, a phone layout, and a print stylesheet that lays slides
// out one per page.
//
// Rebuild:  bun .plans/active/commitment-pooling/tas-first-cycle-deck.build.ts
// Republish via the Claude Code Artifact tool with
//   url: https://claude.ai/code/artifact/172ae48b-124e-4bc1-9ad4-13cafc4d6030
//   favicon: 🌞   title: Tech and Sun: the first commitment cycle   (both stable across rebuilds)
//
// Same pattern as commitment-walk-artifact.build.ts: no local/publishable split
// and no UNFROZEN sentinel. The circulation drawing is inline <svg> read from
// artifacts/visuals/; the promise loop is an <svg> ring the build draws itself;
// every other visual is plain HTML, so the one output file is the same bytes
// locally and on the Artifact host. No Mermaid, no external scripts, no fetch.
// The only external reference is the Google Fonts stylesheet (Fraunces +
// Inter), which the Artifact CSP admits and which falls back to the system
// stack.
//
// Revision 3, 2026-09-03 (Afo's reviews of 2026-09-02 and 2026-09-03): the
// deck sits on the DESIGN.md tokens with hairline rules and at most one tonal
// band per slide, no status labels, no page chrome (each slide fills the
// page), Grassroots Economics first and the Green Goods structure second, the
// promise drawn as a loop with G$ support sent after the certificate, a pause
// slide of four questions for the Tech and Sun pool, and a closing slide. The
// pools handout drawing was retired.
//
// INPUTS
//   tas-first-cycle-deck.content.json   every slide's words: titles, blocks,
//                                       speaker notes, sources. Edit wording
//                                       there, never in this file.
//   artifacts/visuals/tas-first-cycle-circulation.svg   the circulation drawing,
//                                       inlined, id-namespaced, canvas rect
//                                       stripped, viewBox cropped per slide.
//
// OUTPUT — tmp/tas-first-cycle-deck.artifact.html under the repo root by
// default, overridable with OUT. Build fails on any validation miss below.
// One-shot op per CLAUDE.md scripts policy — lives in .plans, not scripts/.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const DIR = import.meta.dir;
const ROOT = join(DIR, "../../..");
const VISUALS = join(DIR, "artifacts/visuals");
const CONTENT = join(DIR, "tas-first-cycle-deck.content.json");
const OUT = process.env.OUT ?? join(ROOT, "tmp/tas-first-cycle-deck.artifact.html");
const ARTIFACT_URL = "https://claude.ai/code/artifact/172ae48b-124e-4bc1-9ad4-13cafc4d6030";

// The one case-study asset this deck embeds. The pools handout was retired on
// 2026-09-03; its absence is asserted below so it cannot quietly come back.
const EMBEDDED_ASSETS = ["tas-first-cycle-circulation"];
const RETIRED_ASSETS = ["tas-first-cycle-pools"];
const WORD_BUDGET = 90;

// ---------- content types ----------
interface Item {
  text: string;
  sub?: string;
}
interface GoalColumn {
  heading: string;
  items: string[];
  foot?: string;
  more?: string;
}
type Block =
  | { type: "bullets"; heading?: string; size?: "large"; items: Item[] }
  | { type: "numbers"; items: { value: string; text: string; sub?: string }[] }
  | { type: "visual"; asset: string; caption?: string; crop?: [number, number, number, number] }
  | { type: "table"; head: string[]; rows: string[][]; num?: number[]; caption?: string }
  | { type: "steps"; size?: "large"; items: Item[] }
  | { type: "note"; text: string }
  | { type: "functions"; items: Item[] }
  | { type: "flow"; items: Item[] }
  | { type: "ring"; items: Item[]; center?: string; centerSub?: string }
  | { type: "roles"; items: Item[] }
  | { type: "timeline" }
  | { type: "facts"; items: { label: string; value?: string; blank?: boolean }[] }
  | { type: "questions"; items: Item[] }
  | { type: "goals"; columns: GoalColumn[]; meet?: string };
const KNOWN_TYPES = new Set(["bullets", "numbers", "visual", "table", "steps", "note", "functions", "flow", "ring", "roles", "timeline", "facts", "questions", "goals"]);
interface Slide {
  id: string;
  section: string;
  layout?: "title" | "visual" | "closing" | "default";
  split?: "5-7" | "6-6" | "7-5";
  title: string;
  lead?: string;
  columns: Block[][];
  notes: string[];
  sources: string[];
}
interface Content {
  deck: { title: string; subtitle: string; footer: string; keyHint: string };
  slides: Slide[];
}

const content = JSON.parse(readFileSync(CONTENT, "utf8")) as Content;

// ---------- helpers ----------
const escapeHtml = (s: string) =>
  s.replace(/&(?![a-zA-Z#][a-zA-Z0-9]*;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad2 = (n: number) => String(n).padStart(2, "0");

// Every revealable element gets its own index so the stagger reads top to
// bottom in document order, one counter per slide.
class Reveal {
  private n = 0;
  attr(): string {
    return ` data-reveal style="--i:${this.n++}"`;
  }
}

// ---------- inline SVG ----------
const assetCache = new Map<string, string>();
const usedAssets = new Set<string>();

function inlineSvg(slug: string, slideId: string, crop?: [number, number, number, number]): string {
  const path = join(VISUALS, `${slug}.svg`);
  if (!existsSync(path)) throw new Error(`missing asset: ${path}`);
  let svg = assetCache.get(slug);
  if (svg === undefined) {
    svg = readFileSync(path, "utf8").replace(/<\?xml[^>]*\?>\s*/, "").trim();
    assetCache.set(slug, svg);
  }
  usedAssets.add(slug);
  const prefix = `${slideId}-${slug}`;
  // Namespace every id so two inlined assets never share a marker or title id.
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!);
  let out = svg;
  for (const id of ids) {
    const re = new RegExp(`(\\bid="|url\\(#|href="#)${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=["\\)])`, "g");
    out = out.replace(re, `$1${prefix}-${id}`);
  }
  out = out.replace(/aria-labelledby="([^"]+)"/, (_m, v: string) =>
    `aria-labelledby="${v
      .split(/\s+/)
      .map((t) => `${prefix}-${t}`)
      .join(" ")}"`
  );
  // Let CSS size the drawing: keep the viewBox, drop the 2x export dimensions.
  // A crop trims the standalone asset's own title band and footer stamp from
  // the inline copy, because the slide already carries the title; the asset
  // file keeps them for print and Linear. The paper canvas rect goes too, so
  // the drawing sits directly on the deck's linen.
  out = out.replace(/<svg\b([^>]*)>/, (_m, attrs: string) => {
    let kept = attrs.replace(/\s(width|height)="[^"]*"/g, "");
    if (crop) kept = kept.replace(/viewBox="[^"]*"/, `viewBox="${crop.join(" ")}"`);
    return `<svg${kept} class="asset">`;
  });
  out = out.replace(/<rect x="0" y="0" width="900" height="900" fill="#FBF8F2"\/>\s*/, "");
  // Deck rule: no em dash character anywhere in the output.
  out = out.replace(/\s—\s/g, " · ").replace(/—/g, "·");
  return out;
}

function assetAccessibility(slug: string): string[] {
  const svg = readFileSync(join(VISUALS, `${slug}.svg`), "utf8");
  const problems: string[] = [];
  const root = svg.match(/<svg\b[^>]*>/)?.[0] ?? "";
  if (!/\brole="img"/.test(root)) problems.push(`${slug}: root <svg> lacks role="img"`);
  const labelled = root.match(/aria-labelledby="([^"]+)"/)?.[1]?.split(/\s+/) ?? [];
  if (labelled.length !== 2) problems.push(`${slug}: aria-labelledby must name a title id and a desc id`);
  const titleId = svg.match(/<title\s+id="([^"]+)"/)?.[1];
  const descId = svg.match(/<desc\s+id="([^"]+)"/)?.[1];
  if (!titleId) problems.push(`${slug}: missing <title id>`);
  if (!descId) problems.push(`${slug}: missing <desc id>`);
  if (titleId && !labelled.includes(titleId)) problems.push(`${slug}: aria-labelledby does not name the <title> id`);
  if (descId && !labelled.includes(descId)) problems.push(`${slug}: aria-labelledby does not name the <desc> id`);
  const vb = root.match(/viewBox="0 0 (\d+) (\d+)"/);
  if (!vb) problems.push(`${slug}: viewBox must start at 0 0`);
  else if (Number(vb[1]) / Number(vb[2]) > 1.3) problems.push(`${slug}: canvas wider than 1.3:1`);
  return problems;
}

// ---------- the promise loop: an SVG ring the build draws ----------
// Steps sit on an ellipse, clockwise from the top; a small arrowhead between
// each pair shows the direction; labels sit outside the ring, anchored by side.
function ringSvg(items: Item[], center?: string, centerSub?: string): string {
  const W = 1320, H = 620, cx = 660, cy = 300, rx = 330, ry = 200;
  const n = items.length;
  const pt = (t: number, kx = rx, ky = ry): [number, number] => [cx + kx * Math.cos(t), cy + ky * Math.sin(t)];
  const f = (v: number) => v.toFixed(1);
  const parts: string[] = [`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="ring-track"/>`];
  items.forEach((it, i) => {
    const t = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const [x, y] = pt(t);
    const tm = t + Math.PI / n;
    const [mx, my] = pt(tm);
    const ang = (Math.atan2(ry * Math.cos(tm), -rx * Math.sin(tm)) * 180) / Math.PI;
    parts.push(`<path d="M -7 -6 L 6 0 L -7 6 Z" class="ring-arrow" transform="translate(${f(mx)} ${f(my)}) rotate(${f(ang)})"/>`);
    parts.push(`<circle cx="${f(x)}" cy="${f(y)}" r="20" class="ring-node"/>`);
    parts.push(`<text x="${f(x)}" y="${f(y + 6)}" text-anchor="middle" class="ring-n">${i + 1}</text>`);
    const [lx, ly] = pt(t, rx + 60, ry + 60);
    const c = Math.cos(t), s = Math.sin(t);
    const anchor = c > 0.35 ? "start" : c < -0.35 ? "end" : "middle";
    const dy = s < -0.35 ? -10 : s > 0.35 ? 22 : 8;
    parts.push(`<text x="${f(lx)}" y="${f(ly + dy)}" text-anchor="${anchor}" class="ring-name">${escapeHtml(it.text)}</text>`);
    if (it.sub) parts.push(`<text x="${f(lx)}" y="${f(ly + dy + 26)}" text-anchor="${anchor}" class="ring-sub">${escapeHtml(it.sub)}</text>`);
  });
  if (center) parts.push(`<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="ring-center">${escapeHtml(center)}</text>`);
  if (centerSub) parts.push(`<text x="${cx}" y="${cy + 28}" text-anchor="middle" class="ring-center-sub">${escapeHtml(centerSub)}</text>`);
  const label = `${items.length} steps around a loop: ${items.map((it) => it.text).join(", ")}, and back to the start.`;
  return `<svg viewBox="0 0 ${W} ${H}" class="ring" role="img" aria-label="${escapeHtml(label)}">${parts.join("")}</svg>`;
}

// ---------- block renderers ----------
function itemInner(it: Item): string {
  return `<span class="it-text">${escapeHtml(it.text)}</span>` + (it.sub ? `<span class="it-sub">${escapeHtml(it.sub)}</span>` : "");
}

// A cell is the one unit of the deck's grids: a hairline on top, a serif name,
// a stone line. No box, no fill.
function cell(it: Item, rv: Reveal, cls: string, n?: number): string {
  return (
    `<div class="cell ${cls}"${rv.attr()}>` +
    (n !== undefined ? `<span class="cell-n" aria-hidden="true">${pad2(n)}</span>` : "") +
    `<h3>${escapeHtml(it.text)}</h3>` +
    (it.sub ? `<p>${escapeHtml(it.sub)}</p>` : "") +
    `</div>`
  );
}

function renderBlock(block: Block, slideId: string, rv: Reveal): string {
  switch (block.type) {
    case "bullets":
      return (
        `<div class="block">` +
        (block.heading ? `<h3 class="block-heading"${rv.attr()}>${escapeHtml(block.heading)}</h3>` : "") +
        `<ul class="bullets${block.size === "large" ? " large" : ""}">` +
        block.items.map((it) => `<li${rv.attr()}>${itemInner(it)}</li>`).join("") +
        `</ul></div>`
      );
    case "numbers":
      return (
        `<div class="numbers">` +
        block.items
          .map(
            (n) =>
              `<div class="number"${rv.attr()}><div class="num-value">${escapeHtml(n.value)}</div>` +
              `<div class="num-text">${escapeHtml(n.text)}</div>` +
              (n.sub ? `<div class="num-sub">${escapeHtml(n.sub)}</div>` : "") +
              `</div>`
          )
          .join("") +
        `</div>`
      );
    case "visual":
      return (
        `<figure class="visual"${rv.attr()}><div class="visual-scroll">${inlineSvg(block.asset, slideId, block.crop)}</div>` +
        (block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : "") +
        `</figure>`
      );
    case "ring":
      return `<figure class="visual"${rv.attr()}><div class="visual-scroll">${ringSvg(block.items, block.center, block.centerSub)}</div></figure>`;
    case "table": {
      const num = new Set(block.num ?? []);
      return (
        `<div class="table-wrap"${rv.attr()}><table><thead><tr>${block.head.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>` +
        `<tbody>${block.rows
          .map((r) => `<tr${rv.attr()}>${r.map((c, i) => `<td${num.has(i) ? ' class="num"' : ""}>${escapeHtml(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>` +
        (block.caption ? `<p class="table-caption"${rv.attr()}>${escapeHtml(block.caption)}</p>` : "") +
        `</div>`
      );
    }
    case "steps":
      return (
        `<ol class="steps${block.size === "large" ? " large" : ""}">` +
        block.items.map((it) => `<li${rv.attr()}>${itemInner(it)}</li>`).join("") +
        `</ol>`
      );
    case "note":
      return `<p class="note"${rv.attr()}>${escapeHtml(block.text)}</p>`;
    case "functions": {
      const cols = block.items.length === 6 ? 3 : block.items.length;
      return `<div class="functions" style="--cols:${cols}">` + block.items.map((it, i) => cell(it, rv, "fn", i + 1)).join("") + `</div>`;
    }
    case "flow":
      return (
        `<ol class="flow" style="--n:${block.items.length}">` +
        block.items
          .map(
            (it, i) =>
              `<li class="flow-step"${rv.attr()}><span class="flow-n" aria-hidden="true">${i + 1}</span>` +
              `<span class="flow-name">${escapeHtml(it.text)}</span>` +
              (it.sub ? `<span class="flow-sub">${escapeHtml(it.sub)}</span>` : "") +
              `</li>`
          )
          .join("") +
        `</ol>`
      );
    case "roles":
      return `<div class="roles">` + block.items.map((it) => cell(it, rv, "role")).join("") + `</div>`;
    case "timeline":
      return (
        `<div class="timeline" role="img" aria-label="One long season with three commitments inside it, two shorter campaigns running alongside it with a commitment each, one commitment made on its own, and a band of Needs above them all"${rv.attr()}>` +
        `<div class="tl-row"><span class="tl-label">Needs</span><span class="tl-track"><span class="tl-band"></span></span></div>` +
        `<div class="tl-row"><span class="tl-label">Season</span><span class="tl-track"><span class="tl-bar season"></span><i class="tl-dot" style="left:14%"></i><i class="tl-dot" style="left:44%"></i><i class="tl-dot" style="left:72%"></i></span></div>` +
        `<div class="tl-row"><span class="tl-label">Campaigns</span><span class="tl-track"><span class="tl-bar" style="left:10%;width:28%"></span><i class="tl-dot" style="left:24%"></i><span class="tl-bar" style="left:56%;width:24%"></span><i class="tl-dot" style="left:68%"></i></span></div>` +
        `<div class="tl-row"><span class="tl-label">On its own</span><span class="tl-track"><i class="tl-dot" style="left:88%"></i></span></div>` +
        `<div class="tl-row tl-key"><span class="tl-label"></span><span class="tl-caption">each dot is a commitment; the band above is the garden's Needs</span></div>` +
        `</div>`
      );
    case "facts":
      return (
        `<dl class="facts">` +
        block.items
          .map(
            (f) =>
              `<div class="fact"${rv.attr()}><dt>${escapeHtml(f.label)}</dt>` +
              (f.blank ? `<dd class="blank" aria-label="to fill in during the session"></dd>` : `<dd>${escapeHtml(f.value ?? "")}</dd>`) +
              `</div>`
          )
          .join("") +
        `</dl>`
      );
    case "questions":
      return (
        `<div class="questions">` +
        block.items
          .map(
            (q, i) =>
              `<div class="question"${rv.attr()}><span class="cell-n" aria-hidden="true">${pad2(i + 1)}</span><h3>${escapeHtml(q.text)}</h3>` +
              (q.sub ? `<p class="q-draft"><span>Draft</span>${escapeHtml(q.sub)}</p>` : "") +
              `</div>`
          )
          .join("") +
        `</div>`
      );
    case "goals":
      return (
        `<div class="goals">` +
        block.columns
          .map(
            (c) =>
              `<div class="goals-col"${rv.attr()}><h3>${escapeHtml(c.heading)}</h3><ul>${c.items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>` +
              (c.more ? `<p class="goals-more">${escapeHtml(c.more)}</p>` : "") +
              (c.foot ? `<p class="goals-foot">${escapeHtml(c.foot)}</p>` : "") +
              `</div>`
          )
          .join("") +
        (block.meet ? `<p class="goals-meet"${rv.attr()}>${escapeHtml(block.meet)}</p>` : "") +
        `</div>`
      );
  }
}

// ---------- content validation (shape) ----------
const problems: string[] = [];
const fail = (m: string) => problems.push(m);

let blanks = 0;
const blankSlides = new Set<string>();
for (const s of content.slides) {
  for (const col of s.columns) {
    for (const b of col) {
      if (!KNOWN_TYPES.has(b.type)) {
        fail(`${s.id}: unknown block type "${(b as { type: string }).type}"`);
        continue;
      }
      if (b.type === "functions" && (b.items.length < 3 || b.items.length > 6)) fail(`${s.id}: functions needs 3 to 6 items`);
      if (b.type === "flow") {
        if (b.items.length < 3 || b.items.length > 7) fail(`${s.id}: flow needs 3 to 7 steps`);
        for (const it of b.items) {
          if (it.text.length > 22) fail(`${s.id}: flow name over 22 characters: "${it.text}"`);
          if ((it.sub ?? "").length > 48) fail(`${s.id}: flow line over 48 characters: "${it.sub}"`);
        }
      }
      if (b.type === "ring") {
        if (b.items.length < 5 || b.items.length > 8) fail(`${s.id}: ring needs 5 to 8 steps`);
        for (const it of b.items) {
          if (it.text.length > 22) fail(`${s.id}: ring name over 22 characters: "${it.text}"`);
          if ((it.sub ?? "").length > 32) fail(`${s.id}: ring line over 32 characters: "${it.sub}"`);
        }
      }
      if (b.type === "roles") {
        if (b.items.length !== 5) fail(`${s.id}: roles needs exactly 5 items`);
        for (const it of b.items) if (it.text.length > 16) fail(`${s.id}: role heading over 16 characters: "${it.text}"`);
      }
      if (b.type === "questions" && (b.items.length < 3 || b.items.length > 6)) fail(`${s.id}: questions needs 3 to 6 items`);
      if (b.type === "goals" && b.columns.length !== 2) fail(`${s.id}: goals needs exactly 2 columns`);
      if (b.type === "facts") {
        for (const f of b.items) if (f.blank) { blanks += 1; blankSlides.add(s.id); }
      }
      if (b.type === "visual" && b.crop && b.crop[1] + b.crop[3] > 830) fail(`${s.id}: visual crop runs into the footer stamp`);
    }
  }
}
if (blanks !== 2 || blankSlides.size !== 1) fail(`expected exactly two fill in blanks on one slide, found ${blanks} on ${blankSlides.size}`);

// ---------- slides ----------
const total = content.slides.length;

function renderSlide(slide: Slide, index: number): string {
  const isTitle = slide.layout === "title";
  const isVisual = slide.layout === "visual";
  const isClosing = slide.layout === "closing";
  const rv = new Reveal();
  const head =
    `<header class="slide-head"><p class="kicker"${rv.attr()}>${escapeHtml(slide.section)}</p>` +
    `<h2 class="slide-title"${rv.attr()}>${escapeHtml(slide.title)}</h2>` +
    (slide.lead ? `<p class="lead"${rv.attr()}>${escapeHtml(slide.lead)}</p>` : "") +
    `</header>`;
  const cols = slide.columns.map((blocks) => `<div class="col">${blocks.map((b) => renderBlock(b, slide.id, rv)).join("")}</div>`);
  const split = slide.columns.length === 2 ? ` split-${slide.split ?? "6-6"}` : " single";
  const body = `<div class="body${split}">${cols.join("")}</div>`;
  const notesHtml =
    `<aside class="slide-notes" hidden><h2>Speaker notes</h2><p>${escapeHtml(slide.notes.join(" "))}</p>` +
    `<p class="sources"><span>Sources</span> ${slide.sources.map((s) => escapeHtml(s)).join(" · ")}</p></aside>`;
  const footLeft = isTitle ? `<span class="foot-hint">${escapeHtml(content.deck.keyHint)}</span>` : `<span>${escapeHtml(content.deck.footer)}</span>`;
  const cls = ["slide", isTitle ? "title-slide" : "", isVisual ? "visual-slide" : "", isClosing ? "closing-slide" : ""].filter(Boolean).join(" ");
  return (
    `<section class="${cls}" id="${slide.id}" data-index="${index}" data-section="${escapeHtml(slide.section)}"${index === 0 ? "" : " hidden"} aria-label="Slide ${index + 1} of ${total}">` +
    head +
    body +
    `<footer class="slide-foot">${footLeft}<span class="foot-num">${index + 1} / ${total}</span></footer>` +
    notesHtml +
    `</section>`
  );
}

const slidesHtml = problems.length ? "" : content.slides.map(renderSlide).join("\n");

// ---------- page ----------
// The Artifact host adds its own charset meta; the local tmp/ preview is served
// by a plain static server that sends none, so the file declares it too.
const html = `<meta charset="utf-8">
<title>${escapeHtml(content.deck.title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap">
<style>
  :root {
    color-scheme: light;
    --canvas: #FAF8F5; --surface-1: #F4F0EA; --surface-2: #EDE8E0; --white: #FFFFFF;
    --ink: #292524; --ink-soft: #44403C; --stone: #78716C; --stone-soft: #A8A29E;
    --hairline: rgba(41, 37, 36, 0.12); --rule: rgba(41, 37, 36, 0.28);
    --accent: #1FC16B; --action: #1A7544; --amber: #D97706; --sky: #3B82F6;
    --r-md: 8px; --r-lg: 16px; --r-xl: 20px; --r-2xl: 24px;
    --s-1: 8px; --s-2: 16px; --s-3: 24px;
    --shadow-2: 0 4px 12px rgba(14, 18, 27, 0.06), 0 1px 3px rgba(14, 18, 27, 0.04);
    --spring-spatial-easing: cubic-bezier(0.16, 1, 0.3, 1); --spring-spatial-duration: 300ms;
    --spring-spatial-fast-easing: cubic-bezier(0.34, 1.56, 0.64, 1); --spring-spatial-fast-duration: 200ms;
    --spring-effects-easing: cubic-bezier(0.2, 0, 0, 1); --spring-effects-duration: 250ms; --spring-effects-fast-duration: 150ms;
    --display: "Fraunces", Georgia, "Times New Roman", serif;
    --body: "Inter", "Helvetica Neue", Arial, sans-serif;
    --stage-w: 1280px; --stage-h: 720px;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; background: var(--canvas); color: var(--ink); }
  body { font-family: var(--body); font-size: 16px; line-height: 1.45; min-height: 100dvh; }
  a { color: var(--action); }
  :focus-visible { outline: 2px solid var(--action); outline-offset: 2px; }

  /* ----- the stage: a 1280 × 720 canvas scaled to fill the page, no chrome ----- */
  .stage-host { min-height: 100dvh; display: grid; place-items: center; }
  .stage-wrap { position: relative; width: var(--stage-w); height: var(--stage-h); transform-origin: top left; }
  .stage { position: absolute; inset: 0; width: var(--stage-w); height: var(--stage-h); background: var(--canvas); overflow: hidden; }
  .slide { position: absolute; inset: 0; padding: 48px 64px 32px; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: var(--s-3); }
  .slide[hidden] { display: none; }
  .progress-line { position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: var(--surface-2); z-index: 5; }
  .progress-line span { display: block; height: 100%; width: 0; background: var(--action); transition: width var(--spring-spatial-duration) var(--spring-spatial-easing); }

  /* ----- type ----- */
  .kicker, .block-heading, th, .fact dt, .goals-col h3, .q-draft span { font-family: var(--body); font-size: 13px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; color: var(--stone); }
  .kicker { margin: 0 0 var(--s-1); }
  .slide-title { margin: 0; font-family: var(--display); font-weight: 600; font-size: 40px; line-height: 1.1; letter-spacing: -0.005em;
    text-wrap: balance; max-width: 30ch; font-variation-settings: "opsz" 72; }
  .lead { margin: 12px 0 0; font-size: 20px; line-height: 1.4; color: var(--stone); max-width: 56ch; text-wrap: balance; }

  /* ----- layout ----- */
  .body { display: grid; gap: var(--s-3); min-height: 0; align-items: start; }
  .body.single { grid-template-columns: minmax(0, 1fr); }
  .body.split-5-7 { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); }
  .body.split-6-6 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .body.split-7-5 { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); }
  .body[class*="split-"] > .col + .col { border-left: 1px solid var(--hairline); padding-left: var(--s-3); }
  .col { min-height: 0; height: 100%; display: grid; grid-auto-rows: max-content; gap: var(--s-3); align-content: start; }
  .col:has(> .visual:only-child), .col:has(> .roles:only-child), .col:has(> .goals:only-child) { grid-auto-rows: minmax(0, 1fr); }
  .block-heading { margin: 0 0 10px; }

  /* bullets */
  .bullets { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; font-size: 21px; line-height: 1.4; }
  .bullets.large { font-size: 24px; gap: 16px; }
  .bullets li { position: relative; padding-left: 20px; }
  .bullets li::before { content: ""; position: absolute; left: 0; top: 0.6em; width: 6px; height: 6px; border-radius: 50%; background: var(--stone-soft); }
  .it-sub { display: block; color: var(--stone); font-size: 16px; margin-top: 3px; }

  /* cells: hairline on top, serif name, stone line. The deck's one grid unit. */
  .cell { border-top: 1px solid var(--rule); padding-top: var(--s-2); display: grid; gap: var(--s-1); align-content: start; }
  .cell-n { font-family: var(--display); font-size: 16px; color: var(--stone); font-variant-numeric: tabular-nums; }
  .cell h3 { margin: 0; font-family: var(--display); font-weight: 600; font-size: 26px; line-height: 1.15; letter-spacing: -0.005em; }
  .cell p { margin: 0; font-size: 17.5px; line-height: 1.4; color: var(--stone); }
  .functions { display: grid; grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); gap: 32px var(--s-3); }
  .functions[style*="--cols:4"] .cell h3 { font-size: 22px; }
  /* roles: five full height columns, so the slide is a spread and not a row of
     cells floating above empty paper */
  .roles { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 0; height: 100%; border-top: 1px solid var(--rule); }
  .roles .cell { border-top: 0; border-left: 1px solid var(--hairline); padding: var(--s-3) 18px; height: 100%; align-content: center; gap: 14px; }
  .roles .cell:first-child { border-left: 0; padding-left: 0; }
  .roles .cell:last-child { padding-right: 0; }
  .roles .cell h3 { font-size: 24px; white-space: nowrap; }
  .roles .cell p { font-size: 18px; line-height: 1.45; }

  /* flow: steps on one rail, numerals sitting on the rail */
  .flow { list-style: none; margin: 0; padding: var(--s-3) 0 0; display: grid; grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr)); gap: 0 var(--s-2); position: relative; }
  .flow::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 1px; background: var(--rule); }
  .flow::after { content: ""; position: absolute; right: -1px; top: -3px; width: 6px; height: 6px; border-top: 1px solid var(--rule); border-right: 1px solid var(--rule); transform: rotate(45deg); }
  .flow-step { display: grid; grid-template-rows: 24px 56px auto; gap: var(--s-1); align-content: start; }
  .flow-n { font-family: var(--display); font-size: 15px; color: var(--stone); background: var(--canvas); margin-top: -37px; padding: 0 4px; width: max-content; font-variant-numeric: tabular-nums; line-height: 1; }
  .flow-name { font-family: var(--display); font-weight: 600; font-size: 22px; line-height: 1.15; letter-spacing: -0.005em; }
  .flow-sub { font-size: 16px; line-height: 1.35; color: var(--stone); }
  .flow[style*="--n:3"] .flow-step { grid-template-rows: 24px auto auto; }
  .flow[style*="--n:3"] .flow-name { font-size: 28px; }
  .flow[style*="--n:3"] .flow-sub { font-size: 18px; }

  /* the promise loop */
  .ring { display: block; width: auto; height: 100%; max-width: 100%; max-height: 100%; }
  .ring-track { fill: none; stroke: var(--rule); stroke-width: 1.5; }
  .ring-node { fill: var(--canvas); stroke: var(--rule); stroke-width: 1.5; }
  .ring-n { font-family: var(--display); font-size: 17px; fill: var(--stone); }
  .ring-arrow { fill: var(--stone-soft); }
  .ring-name { font-family: var(--display); font-weight: 600; font-size: 25px; fill: var(--ink); }
  .ring-sub { font-family: var(--body); font-size: 16.5px; fill: var(--stone); }
  .ring-center { font-family: var(--display); font-weight: 600; font-size: 32px; fill: var(--ink); }
  .ring-center-sub { font-family: var(--body); font-size: 17px; fill: var(--stone); }

  /* big numbers */
  .numbers { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--s-3); }
  .number { border-top: 1px solid var(--rule); padding-top: var(--s-2); }
  .num-value { font-family: var(--display); font-weight: 600; font-size: 56px; line-height: 1; letter-spacing: -0.015em; font-variation-settings: "opsz" 144; font-variant-numeric: tabular-nums; }
  .num-text { font-size: 19px; color: var(--ink-soft); margin-top: 12px; line-height: 1.35; }
  .num-sub { font-size: 15px; color: var(--stone); margin-top: var(--s-1); }

  /* timeline: seasons and campaigns, purely illustrative */
  .timeline { display: grid; gap: 12px; padding: 4px 0; }
  .tl-row { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: var(--s-2); align-items: center; }
  .tl-label { font-size: 14px; font-weight: 500; letter-spacing: 0.02em; color: var(--stone); text-align: right; }
  .tl-track { position: relative; height: 26px; }
  .tl-band { position: absolute; inset: 2px 0; border-radius: var(--r-md); background: var(--surface-2); }
  .tl-bar { position: absolute; top: 2px; height: 22px; border-radius: var(--r-md); background: var(--surface-1); border: 1px solid var(--hairline); }
  .tl-bar.season { left: 0; right: 0; background: var(--surface-2); border: 0; }
  .tl-dot { position: absolute; top: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 50%; background: var(--ink); }
  .tl-key .tl-track, .tl-caption { height: auto; }
  .tl-caption { font-size: 14px; color: var(--stone); }

  /* drawings */
  .visual { margin: 0; min-height: 0; height: 100%; display: grid; grid-template-rows: minmax(0, 1fr) auto; gap: 10px; justify-items: center; }
  .visual-scroll { min-height: 0; height: 100%; width: 100%; display: grid; justify-items: center; }
  .visual .asset { display: block; width: auto; height: 100%; max-width: 100%; max-height: 100%; }
  .visual figcaption { font-size: 16px; color: var(--stone); text-align: center; max-width: 70ch; text-wrap: balance; }

  /* facts with fill lines */
  .facts { margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2) 48px; }
  .fact { border-top: 1px solid var(--hairline); padding-top: 12px; display: grid; gap: var(--s-1); }
  .fact dd { margin: 0; font-family: var(--display); font-weight: 600; font-size: 26px; line-height: 1.2; }
  .fact dd.blank { height: 40px; border-bottom: 1.5px solid var(--stone); }

  /* questions: a pause to decide, with the draft answer under each */
  .questions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 30px 48px; }
  .question { border-top: 1px solid var(--rule); padding-top: var(--s-2); display: grid; gap: 10px; align-content: start; }
  .question h3 { margin: 0; font-family: var(--display); font-weight: 600; font-size: 28px; line-height: 1.15; letter-spacing: -0.005em; }
  .q-draft { margin: 0; font-size: 18px; line-height: 1.42; color: var(--stone); }
  .q-draft span { display: block; margin-bottom: 4px; }

  /* goals: two columns on a hairline, one tonal band beneath */
  .goals { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: minmax(0, 1fr) auto; height: 100%; }
  .goals-col { padding: 0 var(--s-3); display: grid; gap: 12px; align-content: start; }
  .goals-col:first-child { padding-left: 0; }
  .goals-col + .goals-col { border-left: 1px solid var(--hairline); }
  .goals-col h3 { margin: 0 0 4px; }
  .goals-col ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; font-size: 20px; line-height: 1.35; }
  .goals-col li { position: relative; padding-left: 18px; }
  .goals-col li::before { content: ""; position: absolute; left: 0; top: 0.6em; width: 6px; height: 6px; border-radius: 50%; background: var(--stone-soft); }
  .goals-more { margin: 0; padding-left: 18px; font-size: 17px; font-style: italic; color: var(--stone-soft); }
  .goals-foot { margin: 6px 0 0; font-size: 14px; color: var(--stone); border-top: 1px solid var(--hairline); padding-top: 10px; }
  .goals-meet { grid-column: 1 / -1; margin: var(--s-3) 0 0; position: relative; background: var(--surface-1); border-radius: var(--r-lg); padding: var(--s-2) var(--s-3) var(--s-2) 44px; font-size: 18px; line-height: 1.42; color: var(--ink-soft); }
  .goals-meet::before { content: ""; position: absolute; left: 20px; top: 24px; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }

  /* tables */
  .table-wrap { overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 17px; font-variant-numeric: tabular-nums; }
  th { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--rule); }
  td { padding: 14px 12px; border-bottom: 1px solid var(--hairline); vertical-align: top; line-height: 1.4; }
  td:first-child { font-weight: 600; white-space: nowrap; }
  td.num { font-family: var(--display); font-weight: 600; font-size: 28px; line-height: 1; white-space: nowrap; }
  .table-caption { margin: var(--s-2) 0 0; font-size: 16px; color: var(--stone); max-width: 78ch; }

  /* numbered steps: a real order, bare serif numerals */
  .steps { list-style: none; margin: 0; padding: 0; counter-reset: step; display: grid; gap: 14px; font-size: 18px; }
  .steps.large { font-size: 24px; gap: 20px; }
  .steps li { counter-increment: step; position: relative; padding-left: 48px; }
  .steps li::before { content: counter(step); position: absolute; left: 0; top: -2px; font-family: var(--display); font-weight: 600; font-size: 24px; color: var(--stone); font-variant-numeric: tabular-nums; }
  .steps .it-text { font-weight: 600; }
  .steps.large .it-sub { font-size: 17px; }

  /* the one tonal band a slide may carry */
  .note { margin: 0; padding: var(--s-2) var(--s-3); background: var(--surface-1); border-radius: var(--r-lg); font-size: 19px; line-height: 1.42; color: var(--ink-soft); max-width: 78ch; }

  .slide-foot { display: flex; justify-content: space-between; gap: 16px; font-size: 12.5px; color: var(--stone); border-top: 1px solid var(--hairline); padding-top: 10px; }
  .foot-num { font-variant-numeric: tabular-nums; }

  /* visual slide: one line of title, the drawing takes everything else */
  .visual-slide { gap: 14px; padding-top: 34px; }
  .visual-slide .slide-title { font-size: 32px; max-width: none; }
  .visual-slide .kicker { margin-bottom: 4px; }

  /* title and closing slides: linen band, one accent rule, no decoration */
  .title-slide, .closing-slide { grid-template-rows: minmax(0, 1fr) auto auto; padding-top: 96px; background: var(--surface-1); }
  .title-slide .kicker::before, .closing-slide .kicker::before { content: ""; display: block; width: 48px; height: 4px; border-radius: 2px; background: var(--accent); margin-bottom: var(--s-2); }
  .title-slide .slide-title, .closing-slide .slide-title { font-size: 60px; line-height: 1.05; max-width: 16ch; font-variation-settings: "opsz" 144; }
  .title-slide .lead { font-size: 22px; margin-top: 18px; }
  .closing-slide .lead { font-size: 28px; margin-top: 22px; max-width: 30ch; color: var(--ink-soft); }
  .title-slide .body, .closing-slide .body { align-self: end; }
  .title-slide .bullets li, .closing-slide .bullets li { padding-left: 0; max-width: 40ch; }
  .title-slide .bullets li::before, .closing-slide .bullets li::before { display: none; }
  .closing-slide .bullets.large { font-size: 20px; color: var(--stone); }

  /* ----- motion: soft fades between slides; content rises in reading order ----- */
  @keyframes rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fade-out { to { opacity: 0; } }
  [data-reveal] { animation: rise var(--spring-spatial-duration) var(--spring-spatial-easing) both; animation-delay: calc(var(--i, 0) * 80ms); }
  .stage.anim .slide:not([hidden]):not(.leaving) { animation: fade-in var(--spring-effects-duration) var(--spring-effects-easing) both; }
  .slide.leaving { pointer-events: none; z-index: 1; animation: fade-out var(--spring-effects-fast-duration) var(--spring-effects-easing) both; }
  .slide.leaving [data-reveal] { animation: none; }
  .stage.no-anim .slide, .stage.no-anim [data-reveal] { animation: none !important; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }

  /* speaker notes: hidden inside each slide, cloned into the drawer on N, printed under each page */
  .slide-notes h2 { font-size: 12.5px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 500; color: var(--stone); margin: 0 0 6px; }
  .slide-notes p { margin: 0 0 8px; font-size: 15.5px; line-height: 1.5; max-width: 80ch; }
  .slide-notes .sources { color: var(--stone); font-size: 13.5px; }
  .slide-notes .sources span { font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11.5px; margin-right: 6px; }
  .drawer { position: fixed; left: 0; right: 0; bottom: 0; max-height: 42dvh; overflow: auto; background: var(--white); border-top: 1px solid var(--rule);
    padding: 16px 24px 20px; box-shadow: var(--shadow-2); z-index: 20; }
  .drawer[hidden] { display: none; }
  .drawer .slide-notes { display: block; }

  .skip-link { position: fixed; top: .5rem; left: .5rem; z-index: 50; transform: translateY(-180%); background: var(--white); color: var(--ink); border: 2px solid var(--action); border-radius: var(--r-md); padding: .55rem .8rem; font-weight: 600; }
  .skip-link:focus { transform: translateY(0); }

  /* ----- phones: no fixed canvas, everything flows; drawings scroll sideways at a readable size ----- */
  @media (max-width: 719px) {
    .stage-host { display: block; min-height: 0; }
    .stage-wrap { width: auto !important; height: auto !important; transform: none !important; }
    .stage { position: static; width: auto; height: auto; overflow: visible; }
    .progress-line { position: fixed; bottom: 0; }
    .slide { position: static; display: block; padding: 22px 18px 30px; min-height: 100dvh; }
    .slide-title { font-size: 30px; max-width: none; }
    .title-slide, .closing-slide { padding-top: 40px; }
    .title-slide .slide-title, .closing-slide .slide-title { font-size: 40px; }
    .title-slide .lead { font-size: 18px; }
    .closing-slide .lead { font-size: 22px; }
    .lead { font-size: 17px; }
    .body { display: grid; grid-template-columns: minmax(0, 1fr) !important; gap: 22px; margin-top: 20px; }
    .body[class*="split-"] > .col + .col { border-left: 0; padding-left: 0; border-top: 1px solid var(--hairline); padding-top: 18px; }
    .col { display: block; }
    .col > * + * { margin-top: 18px; }
    .functions, .roles, .numbers, .facts, .goals, .questions { grid-template-columns: minmax(0, 1fr) !important; }
    .roles { height: auto; border-top: 0; }
    .roles .cell { border-left: 0; border-top: 1px solid var(--rule); padding: var(--s-2) 0 0; height: auto; align-content: start; }
    .roles .cell:first-child { padding-left: 0; }
    .roles .cell h3 { white-space: normal; font-size: 24px; }
    .goals { height: auto; }
    .goals-col { padding: 0; }
    .goals-col + .goals-col { border-left: 0; border-top: 1px solid var(--hairline); padding-top: 16px; margin-top: 16px; }
    .flow { grid-template-columns: minmax(0, 1fr) !important; padding: 0 0 0 28px; gap: 18px; }
    .flow::before { inset: 0 auto 0 8px; width: 1px; height: auto; }
    .flow::after { display: none; }
    .flow-step { grid-template-rows: auto auto auto; gap: 4px; }
    .flow-n { margin: 0 0 0 -28px; padding: 2px 4px; }
    .tl-row { grid-template-columns: 84px minmax(0, 1fr); }
    .visual { display: block; height: auto; }
    .visual-scroll { display: block !important; overflow-x: auto; -webkit-overflow-scrolling: touch; justify-items: normal; text-align: left; }
    .visual .asset, .ring { height: auto; width: 720px; max-width: none; margin: 0; }
    .visual figcaption { margin-top: 8px; }
    .bullets { font-size: 18px; }
    .bullets.large { font-size: 21px; }
    .num-value { font-size: 44px; }
    .steps.large { font-size: 19px; }
    .note { font-size: 16px; }
    .slide-foot { margin-top: 22px; }
    .drawer { max-height: 50dvh; }
  }

  /* ----- print: one slide per page, notes under each ----- */
  @media print {
    @page { size: landscape; margin: 10mm; }
    html, body { background: #fff; }
    .drawer, .skip-link, .progress-line { display: none !important; }
    .stage-host { display: block; min-height: 0; }
    .stage-wrap { width: auto; height: auto; transform: none !important; }
    .stage { position: static; width: auto; height: auto; overflow: visible; background: #fff; }
    .slide, .slide[hidden] { display: grid !important; position: static; height: auto; min-height: 0; break-after: page; page-break-after: always; padding: 6mm 4mm; animation: none !important; }
    .slide:last-of-type { break-after: auto; page-break-after: auto; }
    [data-reveal] { animation: none !important; }
    .visual .asset, .ring { max-height: 120mm; height: auto; }
    .title-slide, .closing-slide { padding-top: 30mm; background: none; }
    .slide-notes, .slide-notes[hidden] { display: block !important; margin-top: 6mm; padding-top: 4mm; border-top: 1px solid var(--hairline); }
  }
</style>
<a class="skip-link" href="#deck">Skip to the slides</a>
<div class="stage-host">
  <div class="stage-wrap" id="stage-wrap">
    <div class="stage" id="deck" role="region" aria-roledescription="slide deck" aria-label="${escapeHtml(content.deck.title)}" tabindex="-1">
${slidesHtml}
      <div class="progress-line" aria-hidden="true"><span id="progress-fill"></span></div>
    </div>
  </div>
</div>
<aside class="drawer" id="drawer" hidden aria-label="Speaker notes"></aside>
<script>
(function(){
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  var total = slides.length;
  var stage = document.getElementById('deck');
  var wrap = document.getElementById('stage-wrap');
  var drawer = document.getElementById('drawer');
  var fill = document.getElementById('progress-fill');
  var current = 0;
  var notesOpen = false;
  var leaveTimer = 0;
  var leaving = null;
  var phone = window.matchMedia ? window.matchMedia('(max-width: 719px)') : null;
  function isPhone(){ return phone ? phone.matches : window.innerWidth < 720; }

  function indexFromHash(){
    var id = '';
    try { id = decodeURIComponent(window.location.hash.slice(1)); } catch (err) { id = ''; }
    for (var i = 0; i < total; i += 1) if (slides[i].id === id) return i;
    return 0;
  }

  function renderNotes(){
    var src = slides[current].querySelector('.slide-notes');
    drawer.innerHTML = src ? src.innerHTML : '';
  }

  function settleLeaving(){
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = 0; }
    if (leaving) { leaving.hidden = true; leaving.classList.remove('leaving'); leaving = null; }
  }

  // Soft fade between slides; the new slide's content rises in reading order.
  function show(i, pushHash, animate){
    if (i < 0) i = 0;
    if (i > total - 1) i = total - 1;
    var from = current;
    current = i;
    settleLeaving();
    stage.classList.remove('anim');
    // Animations only advance while the page is visible; in a background tab
    // show the slide plainly so nothing sits at opacity zero waiting.
    stage.classList.toggle('no-anim', !!document.hidden);
    if (animate && i !== from && !document.hidden) {
      stage.classList.add('anim');
      leaving = slides[from];
      leaving.classList.add('leaving');
      leaveTimer = setTimeout(settleLeaving, 220);
    }
    slides.forEach(function(s, k){ if (s !== leaving) s.hidden = k !== i; });
    fill.style.width = ((i + 1) / total * 100) + '%';
    if (notesOpen) renderNotes();
    try {
      if (pushHash !== false) history.replaceState(null, '', '#' + slides[i].id);
    } catch (err) {}
    if (isPhone()) window.scrollTo({ top: 0 });
  }
  function next(){ show(current + 1, true, true); }
  function prev(){ show(current - 1, true, true); }

  function setNotes(open){
    notesOpen = open;
    drawer.hidden = !open;
    if (open) renderNotes();
    fit();
  }

  // Scale the 1280 × 720 canvas to fill the page (minus an open notes drawer).
  function fit(){
    if (isPhone()) { wrap.style.transform = ''; wrap.style.width = ''; wrap.style.height = ''; return; }
    var drawerH = drawer.hidden ? 0 : drawer.getBoundingClientRect().height;
    var s = Math.min(window.innerWidth / 1280, (window.innerHeight - drawerH) / 720);
    if (!(s > 0)) s = 1;
    wrap.style.transform = 'scale(' + s + ')';
    wrap.style.width = (1280 * s) + 'px';
    wrap.style.height = (720 * s) + 'px';
  }

  document.addEventListener('keydown', function(e){
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case ' ': case 'Enter': e.preventDefault(); next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': e.preventDefault(); prev(); break;
      case 'Home': e.preventDefault(); show(0, true, true); break;
      case 'End': e.preventDefault(); show(total - 1, true, true); break;
      case 'n': case 'N': e.preventDefault(); setNotes(!notesOpen); break;
      case 'Escape': if (notesOpen) { e.preventDefault(); setNotes(false); } break;
    }
  });

  // Tap the right third to advance, the left third to go back. A drag is a
  // scroll or a swipe, never a tap; a swipe of its own moves by direction.
  var start = null;
  stage.addEventListener('pointerdown', function(e){ start = { x: e.clientX, y: e.clientY, t: Date.now() }; });
  stage.addEventListener('pointerup', function(e){
    if (!start) return;
    var dx = e.clientX - start.x, dy = e.clientY - start.y, dt = Date.now() - start.t;
    start = null;
    if (e.target.closest && e.target.closest('a')) return;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) { if (dx < 0) next(); else prev(); return; }
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8 || dt > 500) return;
    var r = stage.getBoundingClientRect();
    var frac = (e.clientX - r.left) / r.width;
    if (frac > 0.67) next(); else if (frac < 0.33) prev();
  });

  window.addEventListener('hashchange', function(){ var i = indexFromHash(); if (i !== current) show(i, false, true); });
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) stage.classList.remove('no-anim'); });
  window.addEventListener('resize', fit);
  if (phone && phone.addEventListener) phone.addEventListener('change', fit);
  window.addEventListener('beforeprint', function(){ settleLeaving(); slides.forEach(function(s){ s.hidden = false; }); });
  window.addEventListener('afterprint', function(){ show(current, false, false); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  show(indexFromHash(), false, false);
  fit();
})();
</script>
`;

// ---------- validation ----------

// 1. No em dash anywhere in the published bytes.
const emDashes = (html.match(/—/g) ?? []).length;
if (emDashes) fail(`${emDashes} em dash character(s) in the output`);

// Text-only view of the deck's prose for vocabulary checks (script, style and
// the drawings excluded; every tag becomes a separator so runs cannot fuse).
const textOnly = html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<style[\s\S]*?<\/style>/g, " ")
  .replace(/<svg[\s\S]*?<\/svg>/g, " ")
  .replace(/<[^>]+>/g, " | ")
  .replace(/&[a-z#0-9]+;/g, " ")
  .replace(/\s+/g, " ");

// Slide prose only (no notes, no sources), for the plain-language checks and
// the copy budget. Only the words a viewer reads count.
const SKIP_KEYS = new Set(["type", "asset", "size", "layout", "split", "id", "section"]);
function slideStrings(slide: Slide): string[] {
  const out: string[] = [slide.title, slide.lead ?? ""];
  const walk = (v: unknown) => {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) if (!SKIP_KEYS.has(k)) walk(val);
    }
  };
  walk(slide.columns);
  return out.filter(Boolean);
}
const prose = content.slides.map((s) => ({ id: s.id, text: slideStrings(s).join(" | "), words: slideStrings(s).join(" ").split(/\s+/).filter(Boolean).length }));

// 2. Banned vocabulary and rankings imagery.
const BANNED = [
  /\bstreaks?\b/i, /\bcountdowns?\b/i, /\bleaderboards?\b/i, /\bfomo\b/i, /\bhurry\b/i, /\bact now\b/i,
  /\blast chance\b/i, /\blimited time\b/i, /\bdon'?t miss\b/i, /\burgen(t|cy)\b/i, /\bdeadlines?\b/i,
  /\brank(ed|ing|ings|s)?\b/i, /\btop performers?\b/i, /\bwinners?\b/i, /\bnumber one\b/i, /#1\b/,
  /\bfirst place\b/i, /\bpodium\b/i, /\btroph(y|ies)\b/i, /\bmedals?\b/i, /\bscoreboard\b/i,
];
const assetText = EMBEDDED_ASSETS.map((slug) =>
  readFileSync(join(VISUALS, `${slug}.svg`), "utf8").replace(/<[^>]+>/g, " | ").replace(/\s+/g, " ")
).join(" ");
for (const re of BANNED) {
  for (const [where, text] of [["deck prose", textOnly], ["the drawing", assetText]] as const) {
    const hit = text.match(re);
    if (hit) fail(`banned vocabulary "${hit[0]}" in ${where}: …${text.slice(Math.max(0, hit.index! - 50), hit.index! + 50)}…`);
  }
}

// 3. This is a presentation for people: implementation words stay off the
//    slides (speaker notes may name them).
const TECHNICAL = [/\bArbitrum\b/, /\bunpaused?\b/i, /\bfallback\b/i, /\bprotocol\b/i, /\bregistered\b/i, /\bindexer\b/i, /\bCCIP\b/, /\bZodiac\b/, /\bsmart account\b/i, /\bevidence[ -]gated\b/i];
for (const { id, text } of prose) {
  for (const re of TECHNICAL) {
    const hit = text.match(re);
    if (hit) fail(`${id}: implementation word "${hit[0]}" on a slide`);
  }
}

// 4. No status vocabulary anywhere: the deck presents the working system.
if (html.includes('class="chip')) fail("a status chip is still emitted");
const STATUS = [/\bBuilt\b/, /\bIn progress\b/i, /\bPlanned\b/, /\bbeing switched on\b/i, /\bmoves now\b/i];
for (const { id, text } of prose) {
  for (const re of STATUS) {
    const hit = text.match(re);
    if (hit) fail(`${id}: status wording "${hit[0]}" on a slide`);
  }
}

// 5. "member payout" must never sit next to "done" or "moved".
for (const m of textOnly.matchAll(/member payouts?/gi)) {
  const around = textOnly.slice(Math.max(0, m.index! - 60), m.index! + 80);
  if (/\b(done|moved)\b/i.test(around)) fail(`"member payout" appears next to done/moved: …${around}…`);
}

// 6. House of Alignment wording: the canonical sentence exactly once on the
//    slides, every $2,400 a total, no number in G$ tokens, the report date
//    September 15 and never September 30.
const CANON = "$800 per month, paid in G$, July through September 2026, $2,400 total";
const canonCount = prose.reduce((n, p) => n + p.text.split(CANON).length - 1, 0);
if (canonCount !== 1) fail(`canonical funding sentence appears ${canonCount} times on the slides; want exactly 1`);
for (const m of textOnly.matchAll(/\$2,400/g)) {
  const after = textOnly.slice(m.index!, m.index! + 20);
  if (!/\$2,400 total/.test(after)) fail(`"$2,400" without "total": …${after}…`);
}
const tokenCount = textOnly.match(/\d[\d,.]*\s*G\$|G\$\s*\d/);
if (tokenCount) fail(`transaction level G$ token count in prose: "${tokenCount[0]}"`);
if (!prose.some((p) => /September 15/.test(p.text))) fail("report date September 15 missing from the slides");
if (prose.some((p) => /September 30/.test(p.text))) fail("September 30 appears on a slide; the report is due September 15");

// 7. The split table reads garden led 600/200, balanced 400/400, earn led 200/600.
const EXPECTED_SPLITS: [string, RegExp, RegExp][] = [["Garden led", /^\$600\b/, /^\$200\b/], ["Balanced", /^\$400\b/, /^\$400\b/], ["Earn led", /^\$200\b/, /^\$600\b/]];
let splitTables = 0;
for (const s of content.slides) {
  for (const col of s.columns) {
    for (const b of col) {
      if (b.type !== "table" || b.head[0] !== "Split") continue;
      splitTables += 1;
      if (b.rows.length !== 3) fail(`${s.id}: the split table needs three rows`);
      EXPECTED_SPLITS.forEach(([name, dayOne, earned], i) => {
        const r = b.rows[i];
        if (!r || r[0] !== name || !dayOne.test(r[1] ?? "") || !earned.test(r[2] ?? "")) fail(`${s.id}: split row ${i + 1} should read ${name} ${dayOne.source} ${earned.source}`);
      });
    }
  }
}
if (splitTables !== 1) fail(`expected one split table, found ${splitTables}`);

// 8. Naming: the two pools by name, never "our pool"; the loop ends with the
//    reward after the certificate.
const allProse = prose.map((p) => p.text).join(" | ");
if (!allProse.includes("Tech and Sun pool")) fail('"Tech and Sun pool" missing from the slides');
if (!allProse.includes("Green Goods pool")) fail('"Green Goods pool" missing from the slides');
for (const { id, text } of prose) if (/\bour pool\b/i.test(text)) fail(`${id}: says "our pool"`);
// The reward follows the confirmed promise: a payout plan is created from a
// Fulfilled commitment, while the certificate is the cycle's record and comes
// later. Saying support waits on the certificate reverses the real order.
if (/after (?:the |a )?certificate/i.test(allProse)) fail("a slide says support comes after the certificate; support follows the confirmed promise");
if (!allProse.includes("sent on the kept promise")) fail("the loop must say G$ support is sent on the kept promise");

// 9. Copy budget: a slide carries at most WORD_BUDGET words a viewer reads.
for (const p of prose) if (p.words > WORD_BUDGET) fail(`${p.id}: ${p.words} words on the slide (budget ${WORD_BUDGET})`);

// 10. The drawing: accessible, one solid style, uniform blocks, no status
//     wording; the retired handout must not exist.
for (const slug of EMBEDDED_ASSETS) {
  for (const problem of assetAccessibility(slug)) fail(problem);
  if (!usedAssets.has(slug) && !problems.length) fail(`embedded asset ${slug} is not used by any slide`);
  if (!existsSync(join(VISUALS, `${slug}.png`))) fail(`missing PNG companion for ${slug}`);
  const src = readFileSync(join(VISUALS, `${slug}.svg`), "utf8");
  if (!src.includes("Green Goods · Commitment Pooling · v1 (2026-09)")) fail(`${slug}: footer stamp missing or not the 2026-09 middot form`);
  if (src.includes("—")) fail(`${slug}: em dash in the drawing`);
  if (/stroke-dasharray/.test(src)) fail(`${slug}: dashed strokes remain; the drawing is one solid style`);
  if ((src.match(/<marker\b/g) ?? []).length !== 1) fail(`${slug}: expected exactly one arrow marker`);
  if (/#DFEBDE|#4C7A57/.test(src)) fail(`${slug}: blocks must share one fill; the green tint is gone`);
  for (const word of ["being switched on", "Dashed", "Solid:", "proven", "signers", "evidence gated"]) if (src.includes(word)) fail(`${slug}: status wording "${word}" in the drawing`);
}
for (const slug of RETIRED_ASSETS) {
  for (const ext of ["svg", "png"]) if (existsSync(join(VISUALS, `${slug}.${ext}`))) fail(`retired asset ${slug}.${ext} still exists`);
}

// 11. Self-contained: no external script, no fetch, no external URL other than
//     the one fonts stylesheet; no page chrome.
if (/<script\b[^>]*\ssrc=/i.test(html)) fail("external script reference");
if (/\bfetch\s*\(/.test(html)) fail("fetch call in page script");
if (/<nav\b|<button\b/i.test(html)) fail("page chrome (a nav or button) is still emitted");
const XMLNS = new Set(["http://www.w3.org/2000/svg", "http://www.w3.org/1999/xlink"]);
for (const m of html.matchAll(/https?:\/\/[^\s"'<>)]+/g)) {
  if (XMLNS.has(m[0])) continue; // namespace names, not resources
  if (!m[0].startsWith("https://fonts.googleapis.com/")) fail(`external URL in output: ${m[0]}`);
}

// 12. Slide contract: unique ids, two to five note sentences, a named source each.
const ids = content.slides.map((s) => s.id);
if (new Set(ids).size !== ids.length) fail("duplicate slide ids");
for (const s of content.slides) {
  const sentences = s.notes.join(" ").split(/(?<=[.!?])\s+(?=[A-Z$])/).filter((x) => x.trim().length > 0).length;
  if (sentences < 2 || sentences > 5) fail(`${s.id}: speaker notes have ${sentences} sentences (want 2 to 5)`);
  if (!s.sources.length) fail(`${s.id}: no source named`);
  if (!/Source/.test(s.notes.join(" "))) fail(`${s.id}: notes do not name their source`);
  if (s.columns.length < 1 || s.columns.length > 2) fail(`${s.id}: a slide has one or two columns`);
}
const ids2 = [...html.matchAll(/<section class="slide[^"]*" id="([^"]+)"/g)].map((m) => m[1]!);
if (!problems.length && ids2.length !== total) fail(`rendered ${ids2.length} slides for ${total} in content`);

// 13. Hyphen audit: printed for review, never a failure.
const hyphenated = [...new Set([...textOnly.matchAll(/\b[\p{L}]+-[\p{L}]+\b/gu)].map((m) => m[0]))];

if (problems.length) {
  console.error(`Build failed with ${problems.length} problem(s):`);
  for (const p of problems) console.error(`  · ${p}`);
  process.exit(1);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html, "utf8");
const size = Buffer.byteLength(html, "utf8");
console.log(`${total} slides · ${usedAssets.size} inline drawing(s) · ${(size / 1024).toFixed(0)} KB → ${OUT}`);
console.log(`words on slide (budget ${WORD_BUDGET}): ${prose.map((p) => `${p.id}=${p.words}`).join(" ")}`);
console.log(`hyphenated words in prose (${hyphenated.length}): ${hyphenated.join(", ") || "none"}`);
console.log(`Publish with url: ${ARTIFACT_URL}`);
