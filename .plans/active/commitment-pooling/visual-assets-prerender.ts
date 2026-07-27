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
// Publish:  the Claude Code Artifact tool with SHAREABLE_OUT and
//           url: https://claude.ai/code/artifact/007ef090-9e26-4b1d-898c-615155304d9d
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// `playwright`/`playwright-core` aren't symlinked at the repo root (bun workspace
// hoisting); `@playwright/test` is, and it re-exports the same chromium driver.
import { chromium } from "@playwright/test";

const DIR = import.meta.dir;
const BUILD = join(DIR, "visual-assets-artifact.build.ts");
const LOCAL_OUT = process.env.LOCAL_OUT ?? "/tmp/cp-visual-local.html";
const ARTIFACT_OUT = process.env.ARTIFACT_OUT ?? "/tmp/cp-visual-artifact-body.html";
const SHAREABLE_OUT = process.env.SHAREABLE_OUT ?? "/tmp/cp-visual-shareable.html";

const DIA_RE = /<div class="dia"><pre class="mermaid">[\s\S]*?<\/pre><\/div>/g;

function fail(message: string): never {
  throw new Error(`prerender invariant failed: ${message}`);
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

console.log("4/4 verifying shareable invariants…");
const remaining = (shareable.match(/<pre class="mermaid"/g) || []).length;
if (remaining !== 0) fail(`shareable still contains ${remaining} <pre class="mermaid"> block(s)`);
if (shareable.includes('data-embedded-runtime="mermaid@')) fail("shareable must not embed the Mermaid runtime");
if (shareable.includes(" src=") || /<script[^>]+src=/.test(shareable)) fail("shareable must not reference external scripts");
const svgCount = (shareable.match(/<svg[\s>]/g) || []).length;

writeFileSync(SHAREABLE_OUT, shareable);
console.log(`\n✅ shareable body: ${SHAREABLE_OUT}`);
console.log(`   ${Buffer.byteLength(shareable).toLocaleString()} bytes · froze ${diaCount} diagrams (light+dark) · total <svg>=${svgCount} · <pre class="mermaid">=0`);
console.log(`   publish this file to artifact 007ef090; open ${LOCAL_OUT} with file:// for the live local preview.`);
