#!/usr/bin/env node
/**
 * build-story-gallery.mjs — generate the complete component gallery for
 * design.greengoods.app from Storybook's own story index.
 *
 * Runs after `storybook build` (wired into `build-storybook` in
 * packages/shared/package.json) and emits
 * `packages/shared/storybook-static/gallery/index.html`: every component with
 * at least one story, grouped by its title path, rendering the REAL lead story
 * in a same-origin iframe (`../iframe.html?id=…`) with variant links and an
 * "open in Storybook" link. Completeness is structural — anything with a story
 * is on the page by construction, so the gallery can never drift from the
 * shipped components the way hand-drawn specimens did (critique rounds 2–3).
 *
 * Frames are virtualized: an IntersectionObserver mounts an iframe when its
 * card approaches the viewport and unmounts it again far offscreen, so only a
 * handful of Storybook preview bundles are ever live at once.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const staticDir = path.resolve(repoRoot, "packages/shared/storybook-static");
const indexPath = path.join(staticDir, "index.json");
const outDir = path.join(staticDir, "gallery");

const index = JSON.parse(readFileSync(indexPath, "utf8"));
const entries = Object.values(index.entries ?? {}).filter((e) => e.type === "story");
if (entries.length === 0) {
  throw new Error(`build-story-gallery: no story entries found in ${indexPath}`);
}

// Group stories by component title ("Admin/Primitives/AdminButton").
const components = new Map();
for (const e of entries) {
  if (!components.has(e.title)) components.set(e.title, []);
  components.get(e.title).push(e);
}

// Group components by their top two title segments ("Admin/Primitives").
const groups = new Map();
for (const [title, stories] of components) {
  const segs = title.split("/");
  const group = segs.slice(0, Math.min(2, segs.length - 1)).join("/") || segs[0];
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push({ title, name: segs[segs.length - 1], stories });
}

const groupOrder = [...groups.keys()].sort((a, b) => {
  const rank = (g) => (g.startsWith("Admin") ? 0 : g.startsWith("Shared") ? 1 : 2);
  return rank(a) - rank(b) || a.localeCompare(b);
});

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// Taller frames for route/workspace-scale stories.
const tall = (group) => /Workspaces|Workflows|Shell|Pool|Routes|Layouts/.test(group);

let cards = "";
let nav = "";
let componentCount = 0;
for (const group of groupOrder) {
  const comps = groups.get(group).sort((a, b) => a.name.localeCompare(b.name));
  const gid = group.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  nav += `<a href="#g-${gid}">${esc(group)}<i>${comps.length}</i></a>`;
  cards += `<h2 id="g-${gid}">${esc(group)} <span class="count">${comps.length} component${comps.length === 1 ? "" : "s"}</span></h2>\n<div class="grid">\n`;
  for (const comp of comps) {
    componentCount++;
    const lead = comp.stories[0];
    const variants = comp.stories
      .map(
        (s) =>
          `<a href="../?path=/story/${encodeURIComponent(s.id)}" target="_blank" rel="noopener">${esc(s.name)}</a>`
      )
      .join(" · ");
    cards += `<section class="card${tall(group) ? " tall" : ""}" data-name="${esc(comp.title.toLowerCase())}">
<header><b>${esc(comp.name)}</b><a class="open" href="../?path=/story/${encodeURIComponent(lead.id)}" target="_blank" rel="noopener">Storybook ↗</a></header>
<div class="frame" data-story="${esc(lead.id)}"><button type="button" class="ph">Load ${esc(lead.name)}</button></div>
<footer>${variants}</footer>
</section>\n`;
  }
  cards += "</div>\n";
}

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Green Goods Component Gallery</title>
<style>
  :root { --canvas:#FAF8F5; --surface:#FFFFFF; --ink:#292524; --stone:#78716C; --hairline:#E8E2DA; --accent:#1A7544; }
  @media (prefers-color-scheme: dark) { :root { --canvas:#110C08; --surface:#201913; --ink:#F5F5F4; --stone:#A8A29E; --hairline:rgba(250,250,249,.12); --accent:#86EFAC; } }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--canvas); color:var(--ink); font:15px/1.55 "Plus Jakarta Sans",system-ui,sans-serif; }
  .page { max-width:1240px; margin:0 auto; padding:40px 24px 96px; }
  h1 { font-size:28px; margin:0 0 4px; letter-spacing:-.01em; }
  .sub { color:var(--stone); margin:0 0 20px; max-width:80ch; font-size:13.5px; }
  .toolbar { position:sticky; top:0; z-index:5; background:var(--canvas); padding:10px 0 12px; border-bottom:1px solid var(--hairline); margin-bottom:8px; }
  input[type=search] { width:100%; max-width:420px; padding:9px 14px; font:inherit; font-size:14px; color:var(--ink); background:var(--surface); border:1px solid var(--hairline); border-radius:9999px; outline:none; }
  input[type=search]:focus-visible { border-color:var(--accent); box-shadow:0 0 0 2px var(--accent); }
  .nav { display:flex; flex-wrap:wrap; gap:6px 10px; margin-top:10px; font-size:12px; }
  .nav a { color:var(--stone); text-decoration:none; border:1px solid var(--hairline); border-radius:9999px; padding:3px 10px; }
  .nav a i { font-style:normal; opacity:.6; margin-left:5px; }
  .nav a:hover { color:var(--accent); border-color:var(--accent); }
  h2 { font-size:18px; margin:38px 0 12px; }
  h2 .count { font-size:12px; color:var(--stone); font-weight:400; margin-left:8px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:16px; }
  .card { background:var(--surface); border:1px solid var(--hairline); border-radius:14px; overflow:hidden; display:flex; flex-direction:column; content-visibility:auto; contain-intrinsic-size: 340px 420px; }
  .card header { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 14px; border-bottom:1px solid var(--hairline); }
  .card header b { font-size:13.5px; }
  .card .open { font-size:11.5px; color:var(--accent); text-decoration:none; white-space:nowrap; }
  .frame { position:relative; height:320px; background:var(--canvas); }
  .card.tall .frame { height:480px; }
  .frame iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
  .frame .ph { position:absolute; inset:0; width:100%; border:0; background:transparent; color:var(--stone); font:inherit; font-size:12.5px; cursor:pointer; }
  .card footer { padding:8px 14px; font-size:11.5px; color:var(--stone); border-top:1px solid var(--hairline); max-height:64px; overflow-y:auto; }
  .card footer a { color:inherit; text-decoration:none; }
  .card footer a:hover { color:var(--accent); }
  .hidden { display:none; }
  a:focus-visible, button:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
</style>
</head>
<body>
<div class="page">
  <h1>Green Goods Component Gallery</h1>
  <p class="sub">Every component with a story — ${componentCount} components, ${entries.length} stories — rendered live from this Storybook build. Generated by <code>scripts/design/build-story-gallery.mjs</code> at build time; it cannot drift from shipped code. Frames load as you scroll; click a variant or ↗ for the full Storybook with controls and states.</p>
  <div class="toolbar">
    <input type="search" id="q" placeholder="Filter ${componentCount} components…" aria-label="Filter components">
    <nav class="nav">${nav}</nav>
  </div>
  ${cards}
</div>
<script>
(function () {
  // Mounting a frame boots a full Storybook preview, so mounts run through a
  // small queue: at most MAX_LOADING frames fetch at once, at most MAX_LIVE
  // stay mounted (farthest offscreen unmounts first). Keeps an anchor jump
  // into the middle of 300 cards from booting dozens of previews at once.
  var MAX_LOADING = 4;
  var MAX_LIVE = 16;
  var live = new Map();
  var loading = 0;
  var queue = [];
  function pump() {
    while (loading < MAX_LOADING && queue.length) {
      var frame = queue.shift();
      if (!frame.isConnected || frame.querySelector("iframe") || frame.dataset.wanted !== "1") continue;
      doMount(frame);
    }
  }
  function doMount(frame) {
    loading++;
    var f = document.createElement("iframe");
    f.src = "../iframe.html?id=" + encodeURIComponent(frame.dataset.story) + "&viewMode=story";
    f.title = frame.dataset.story;
    var done = function () { loading = Math.max(0, loading - 1); pump(); };
    f.addEventListener("load", done, { once: true });
    f.addEventListener("error", done, { once: true });
    frame.appendChild(f);
    var ph = frame.querySelector(".ph");
    if (ph) ph.classList.add("hidden");
    live.set(frame, f);
    if (live.size > MAX_LIVE) {
      var farthest = null, dist = -1;
      live.forEach(function (_v, fr) {
        var d = Math.abs(fr.getBoundingClientRect().top);
        if (d > dist) { dist = d; farthest = fr; }
      });
      if (farthest && farthest !== frame && dist > innerHeight * 2) unmount(farthest);
    }
  }
  function mount(frame) {
    frame.dataset.wanted = "1";
    if (frame.querySelector("iframe")) return;
    queue.push(frame);
    pump();
  }
  function unmount(frame) {
    frame.dataset.wanted = "0";
    var f = live.get(frame);
    if (!f) return;
    f.remove();
    live.delete(frame);
    var ph = frame.querySelector(".ph");
    if (ph) ph.classList.remove("hidden");
  }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) mount(e.target);
      else if (Math.abs(e.boundingClientRect.top) > innerHeight * 3) unmount(e.target);
    });
  }, { rootMargin: "300px 0px" });
  document.querySelectorAll(".frame").forEach(function (frame) {
    io.observe(frame);
    var ph = frame.querySelector(".ph");
    if (ph) ph.addEventListener("click", function () { mount(frame); });
  });
  var q = document.getElementById("q");
  q.addEventListener("input", function () {
    var v = q.value.trim().toLowerCase();
    document.querySelectorAll(".card").forEach(function (c) {
      c.classList.toggle("hidden", v !== "" && c.dataset.name.indexOf(v) === -1);
    });
    document.querySelectorAll("h2").forEach(function (h) {
      var grid = h.nextElementSibling;
      var any = grid && grid.querySelector(".card:not(.hidden)");
      h.classList.toggle("hidden", !any);
      if (grid) grid.classList.toggle("hidden", !any);
    });
  });
})();
</script>
</body>
</html>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "index.html"), html);
console.log(
  `build-story-gallery: wrote gallery/index.html — ${componentCount} components, ${entries.length} stories, ${groups.size} groups.`
);
