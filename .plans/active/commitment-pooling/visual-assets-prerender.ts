// Deploy step for the Commitment Pooling — Visual Asset Gallery artifact.
//
// WHY: An artifact containing <pre class="mermaid"> blocks cannot be shared to a
// public link — the Claude host renders Mermaid at view time, and public
// (unauthenticated) viewers can't invoke that renderer, so the share is refused
// ("This version can't be shared publicly"). Confirmed empirically 2026-07-22.
//
// VOCABULARY: this step only freezes what the builder produced — it introduces no
// labels of its own. The gallery's vocabulary source is the ontology sidecar,
// packages/shared/src/ontology/green-goods-ontology.json; every state/enum label
// in diagrams.md maps 1:1 onto a canonical member there. `bun run check:ontology`
// guards the code layers and parses neither Markdown nor the SVGs frozen here, so
// that mapping is maintained by hand (see visual-assets.md § Vocabulary source).
//
// WHAT: This step freezes every Mermaid diagram to inline <svg> at build time,
// so the published body is fully self-contained static HTML with NO
// <pre class="mermaid"> blocks — exactly the form that shares (like the hand-drawn
// story-tab SVGs, which already share fine).
//
// It renders through the already-installed playwright chromium (no new dependency)
// and does NOT modify visual-assets-artifact.build.ts. It runs that build read-only,
// consumes its two outputs, and writes a third, shareable one.
//
//   Local preview (LOCAL_OUT)   — untouched: embedded runtime, live Mermaid.
//   Deploy body   (SHAREABLE_OUT) — this file's output: frozen SVG, publicly shareable.
//
// Run:      bun .plans/active/commitment-pooling/visual-assets-prerender.ts
// Verify:   bun .plans/active/commitment-pooling/visual-assets-prerender.ts --verify <file>
//           Prints SAFE TO PUBLISH / DO NOT PUBLISH and exits non-zero on the latter.
//           Run it on the exact path you are about to hand the Artifact tool.
// Publish:  the Claude Code Artifact tool with SHAREABLE_OUT and
//           url: https://claude.ai/code/artifact/007ef090-9e26-4b1d-898c-615155304d9d
//
// RECURRING DEFECT (2026-07-22, 2026-07-31, 2026-08-01): the wrong file gets published.
// It presents as a Mermaid *rendering* regression — the reader is told the latest version
// can't be viewed — while diagrams.md is perfectly healthy, so the hunt starts in the
// wrong place. Diagnose from the published side first: fetch the artifact URL and grep the
// body. `<pre class="mermaid">` present and `dia-frozen` absent means the wrong build is
// live, and the fix is a republish, not a source edit. Guards, in the order they bite:
// DO-NOT-PUBLISH in the unpublishable filenames, a sentinel comment inside each body that
// survives renames and env overrides, and --verify above.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// `playwright`/`playwright-core` aren't symlinked at the repo root (bun workspace
// hoisting); `@playwright/test` is, and it re-exports the same chromium driver.
import { chromium } from "@playwright/test";

const DIR = import.meta.dir;
const BUILD = join(DIR, "visual-assets-artifact.build.ts");
// DO-NOT-PUBLISH / PUBLISH-THIS are load-bearing, not decoration: the path string is the
// last thing read before it becomes the Artifact tool's file_path. Keep in sync with the
// builder's own defaults.
const LOCAL_OUT = process.env.LOCAL_OUT ?? "/tmp/cp-visual-local.DO-NOT-PUBLISH.html";
const ARTIFACT_OUT = process.env.ARTIFACT_OUT ?? "/tmp/cp-visual-artifact-body.DO-NOT-PUBLISH.html";
const SHAREABLE_OUT = process.env.SHAREABLE_OUT ?? "/tmp/cp-visual-shareable.PUBLISH-THIS.html";

// Must match visual-assets-artifact.build.ts's UNFROZEN_SENTINEL exactly. Asserted below
// rather than assumed, so a rename in either script fails loudly instead of quietly
// disarming the guard. Neither may contain ` src=` — the external-reference check greps it.
const UNFROZEN_SENTINEL =
  "<!-- GG-GALLERY-BUILD unfrozen · DO NOT PUBLISH · host-rendered Mermaid refuses public sharing · publish the prerender's PUBLISH-THIS output instead -->";
const SHAREABLE_SENTINEL =
  "<!-- GG-GALLERY-BUILD shareable · Mermaid frozen to inline SVG · safe to publish -->";

const DIA_RE = /<div class="dia"><pre class="mermaid">[\s\S]*?<\/pre><\/div>/g;

function fail(message: string): never {
  throw new Error(`prerender invariant failed: ${message}`);
}

// The single definition of "publishable". Used by --verify and by this script's own final
// gate, so the check that clears a file is literally the check that produced it.
function publishBlockers(file: string): string[] {
  if (!existsSync(file)) return [`file does not exist: ${file}`];
  const html = readFileSync(file, "utf8");
  const problems: string[] = [];
  const unfrozen = (html.match(/<pre class="mermaid"/g) || []).length;

  if (html.includes(UNFROZEN_SENTINEL))
    problems.push("carries the builder's DO-NOT-PUBLISH sentinel — this is a build output, not a deploy output");
  if (!html.includes(SHAREABLE_SENTINEL))
    problems.push("missing the shareable sentinel — this file did not come out of the prerender");
  if (unfrozen > 0)
    problems.push(`${unfrozen} <pre class="mermaid"> block(s) — the host renders these at view time, so public sharing is refused`);
  if (!html.includes("dia-frozen")) problems.push("no frozen diagrams — expected inline <svg> tagged dia-frozen");
  if (html.trimStart().startsWith("<!doctype"))
    problems.push("complete HTML document — the Artifact tool wants body content only");
  if (html.includes('data-embedded-runtime="mermaid@')) problems.push("embeds the Mermaid runtime");
  if (/<script[^>]+ src=/.test(html)) problems.push("references an external script — blocked by the artifact CSP");
  return problems;
}

function reportVerdict(file: string): number {
  const problems = publishBlockers(file);
  console.log(`\n  file: ${file}`);
  if (problems.length === 0) {
    console.log("\n  ✅ SAFE TO PUBLISH — Mermaid frozen to inline SVG, nothing renders at view time.\n");
    return 0;
  }
  console.log("\n  ⛔ DO NOT PUBLISH\n");
  for (const problem of problems) console.log(`     · ${problem}`);
  console.log("\n  Produce a publishable body with:");
  console.log("     bun .plans/active/commitment-pooling/visual-assets-prerender.ts\n");
  return 1;
}

const verifyFlag = process.argv.indexOf("--verify");
if (verifyFlag !== -1) {
  process.exit(reportVerdict(process.argv[verifyFlag + 1] ?? SHAREABLE_OUT));
}

// Trackpad/pan hardening for the frozen deploy build. The gallery preview opens every
// diagram fit-to-whole; large architecture diagrams then fit entirely, so the viewport
// never overflows and drag-to-pan stays disabled (pointerdown gates on is-pannable).
// Two edits make big diagrams explorable by trackpad:
//   1) open oversize diagrams at actual size — immediately pannable and legible
//   2) plain wheel / two-finger scroll pans; only pinch (ctrl+wheel) zooms
// Applied to the deploy output only; the source build.ts (another session's WIP) is
// left untouched — the same two edits belong there for the local preview.
// Idempotent: these fixes now live upstream in visual-assets-artifact.build.ts (so the
// local preview gets them too). This stays as a safety net in case that source is
// reverted — it patches only when the unfixed form is present, and no-ops when already fixed.
function patchPreviewInteractions(html: string): string {
  let out = html;

  const openFixed = "if (oversize) actualSizePreview(); else fitPreview();";
  const openNeedle = "requestAnimationFrame(fitPreview);";
  if (out.includes(openFixed)) {
    console.log("    open-zoom fix already present upstream — skipping patch");
  } else if (out.includes(openNeedle)) {
    out = out.replace(
      openNeedle,
      "requestAnimationFrame(function(){var oversize=previewState.width>previewViewport.clientWidth+2||previewState.height>previewViewport.clientHeight+2;oversize?actualSizePreview():fitPreview();});",
    );
    console.log("    applied open-zoom fix (oversize diagrams open pannable)");
  } else {
    fail("preview open hook not found in either fixed or unfixed form — upstream preview code changed");
  }

  const wheelNeedle = "if (!event.ctrlKey && !isDiscreteWheel) return;";
  if (!out.includes(wheelNeedle)) {
    console.log("    scroll-to-pan fix already present upstream — skipping patch");
  } else {
    out = out.replace(wheelNeedle, "if (!event.ctrlKey) return; /* pan on scroll; zoom only on pinch */");
    console.log("    applied scroll-to-pan fix");
  }

  return out;
}

console.log("1/4 building fresh outputs (read-only run of visual-assets-artifact.build.ts)…");
const built = spawnSync("bun", [BUILD], { env: { ...process.env, LOCAL_OUT, ARTIFACT_OUT }, stdio: "inherit" });
if (built.status !== 0) fail("gallery build failed");

const artifactBody = readFileSync(ARTIFACT_OUT, "utf8");
// If this trips, the builder's UNFROZEN_SENTINEL was renamed or dropped. Fix both scripts
// together — a silently absent sentinel would let an unfrozen body pass --verify.
if (!artifactBody.includes(UNFROZEN_SENTINEL))
  fail(`builder output is missing UNFROZEN_SENTINEL — the two scripts have drifted apart; re-sync the constant in visual-assets-artifact.build.ts`);
const diaCount = (artifactBody.match(DIA_RE) || []).length;
if (diaCount === 0) fail("no <div class=\"dia\"><pre class=\"mermaid\"> blocks found to freeze");
console.log(`    diagrams to freeze: ${diaCount}`);

console.log("2/4 rendering Mermaid via playwright chromium (light + dark)…");
const browser = await chromium.launch();
let shareable: string;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  await page.goto(`file://${LOCAL_OUT}`, { waitUntil: "load" });
  await page.waitForFunction(
    () => {
      const s = document.documentElement.dataset.mermaidState;
      return s === "ready" || s === "partial" || s === "failed";
    },
    undefined,
    { timeout: 120000 },
  );
  const status = await page.evaluate(() => ({
    state: document.documentElement.dataset.mermaidState,
    rendered: document.documentElement.dataset.mermaidRendered,
    failed: document.documentElement.dataset.mermaidFailed,
  }));
  console.log(`    render status: ${status.state} (rendered ${status.rendered}, failed ${status.failed})`);

  const capture = async (theme: "light" | "dark"): Promise<string[]> => {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    await page.waitForFunction((t) => document.documentElement.dataset.mermaidTheme === t, theme, { timeout: 120000 });
    await page.waitForTimeout(200);
    return page.evaluate(() =>
      Array.from(document.querySelectorAll(".dia")).map((dia) => {
        const rendered = dia.querySelector(".mermaid-rendered");
        return rendered ? (rendered as HTMLElement).outerHTML : "";
      }),
    );
  };

  const light = await capture("light");
  const dark = await capture("dark");
  if (light.length !== diaCount || dark.length !== diaCount)
    fail(`dia count mismatch: source=${diaCount} light=${light.length} dark=${dark.length}`);
  const missing = light.map((s, i) => (s.includes("<svg") ? -1 : i)).filter((i) => i >= 0);
  if (missing.length) fail(`diagrams did not render to SVG at indices ${missing.join(",")}`);

  console.log("3/4 freezing each diagram to inline SVG (both themes) and splicing…");
  let i = 0;
  shareable = artifactBody.replace(DIA_RE, () => {
    const idx = i++;
    const l = light[idx].replace('class="mermaid mermaid-rendered"', 'class="mermaid mermaid-rendered dia-frozen dia-frozen-light"');
    const d = dark[idx].replace('class="mermaid mermaid-rendered"', 'class="mermaid mermaid-rendered dia-frozen dia-frozen-dark"');
    return `<div class="dia">${l}${d}</div>`;
  });

  // Theme toggle for the frozen diagrams, mirroring the gallery's own data-theme /
  // prefers-color-scheme logic. !important so it wins over the inherited
  // ".dia .mermaid-rendered{display:grid}" rule regardless of source order.
  const toggleCss =
    '<style id="frozen-dia-theme">' +
    ".dia-frozen-dark{display:none!important}.dia-frozen-light{display:grid!important}" +
    ':root[data-theme="dark"] .dia-frozen-light{display:none!important}:root[data-theme="dark"] .dia-frozen-dark{display:grid!important}' +
    ':root[data-theme="light"] .dia-frozen-light{display:grid!important}:root[data-theme="light"] .dia-frozen-dark{display:none!important}' +
    "@media(prefers-color-scheme:dark){:root:not([data-theme=\"light\"]) .dia-frozen-light{display:none!important}:root:not([data-theme=\"light\"]) .dia-frozen-dark{display:grid!important}}" +
    "</style>";
  if (!shareable.includes("</style>")) fail("could not find a </style> anchor to inject theme toggle");
  shareable = shareable.replace("</style>", `</style>${toggleCss}`);
} finally {
  await browser.close();
}

console.log("3.5/4 hardening preview pan/zoom (open oversize diagrams pannable; scroll-to-pan)…");
shareable = patchPreviewInteractions(shareable);

console.log("4/4 flipping the sentinel and verifying shareable invariants…");
// The body is only publishable from here on, so this is exactly where it stops carrying
// the builder's DO-NOT-PUBLISH marker and starts carrying the shareable one.
shareable = shareable.replace(UNFROZEN_SENTINEL, SHAREABLE_SENTINEL);
if (shareable.includes(UNFROZEN_SENTINEL)) fail("failed to clear the DO-NOT-PUBLISH sentinel");
if (shareable.includes(" src=")) fail("shareable must not reference external scripts");
const svgCount = (shareable.match(/<svg[\s>]/g) || []).length;

// Write first, then verify the bytes on disk — the file is what gets published, not the
// string in memory, and this runs the same check --verify runs.
writeFileSync(SHAREABLE_OUT, shareable);
const blockers = publishBlockers(SHAREABLE_OUT);
if (blockers.length) fail(`shareable output is not publishable:\n     · ${blockers.join("\n     · ")}`);

console.log(`\n✅ shareable body: ${SHAREABLE_OUT}`);
console.log(`   ${Buffer.byteLength(shareable).toLocaleString()} bytes · froze ${diaCount} diagrams (light+dark) · total <svg>=${svgCount} · <pre class="mermaid">=0`);
console.log(`   verified publishable — publish THIS path to artifact 007ef090:`);
console.log(`     ${SHAREABLE_OUT}`);
console.log(`   re-check any candidate path with:  bun ${BUILD.replace("visual-assets-artifact.build.ts", "visual-assets-prerender.ts")} --verify <file>`);
console.log(`   local visual validation (never publish this one): open ${LOCAL_OUT} with file://`);
