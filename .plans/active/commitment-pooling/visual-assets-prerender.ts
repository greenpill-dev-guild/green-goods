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
import { createHash } from "node:crypto";
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

// Match class tokens independently of attribute order, quote style, or casing. The builder
// currently emits `<div class="dia"><pre class="mermaid">`, but publish safety must not depend
// on that serializer detail: a host-rendered Mermaid block left behind under a reordered `id`
// attribute is still unpublishable.
const MERMAID_PRE_RE =
  /<pre\b(?=[^>]*\bclass\s*=\s*(["'])[^"']*\bmermaid\b[^"']*\1)[^>]*>/gi;
const DIA_RE =
  /<div\b(?=[^>]*\bclass\s*=\s*(["'])[^"']*\bdia\b[^"']*\1)[^>]*>\s*<pre\b(?=[^>]*\bclass\s*=\s*(["'])[^"']*\bmermaid\b[^"']*\2)[^>]*>[\s\S]*?<\/pre>\s*<\/div>/gi;
const EXTERNAL_SCRIPT_RE = /<script\b[^>]*\ssrc\s*=/i;
const MANIFEST_RE = /<!-- GG-GALLERY-MANIFEST ([A-Za-z0-9+/=]+) -->/g;
const SVG_TAG_RE = /<svg\b[^>]*>/gi;

type GalleryExpectation = {
  sourceSha256: string;
  diagramCount: number;
};

type GalleryManifest = GalleryExpectation & {
  version: 1;
  lightDiagramCount: number;
  darkDiagramCount: number;
  contentSha256: string;
};

function fail(message: string): never {
  throw new Error(`prerender invariant failed: ${message}`);
}

function countMermaidPreBlocks(html: string): number {
  return (html.match(MERMAID_PRE_RE) || []).length;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function attribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match?.[2];
}

function hasClass(tag: string, token: string): boolean {
  return (attribute(tag, "class") ?? "").split(/\s+/).includes(token);
}

function encodeManifest(manifest: GalleryManifest): string {
  return `<!-- GG-GALLERY-MANIFEST ${Buffer.from(JSON.stringify(manifest)).toString("base64")} -->`;
}

function sealShareable(html: string, expected: GalleryExpectation): string {
  if (Array.from(html.matchAll(MANIFEST_RE)).length > 0) fail("shareable body already contains a gallery manifest");
  MANIFEST_RE.lastIndex = 0;
  const manifest: GalleryManifest = {
    version: 1,
    sourceSha256: expected.sourceSha256,
    diagramCount: expected.diagramCount,
    lightDiagramCount: expected.diagramCount,
    darkDiagramCount: expected.diagramCount,
    contentSha256: sha256(html),
  };
  return `${html}${encodeManifest(manifest)}`;
}

function assertMermaidMatcherContract(): void {
  const reordered =
    "<DIV data-kind='diagram' CLASS='dia frame'><PRE id='left-behind' CLASS='extra mermaid'>graph TD</PRE></DIV>";
  if (countMermaidPreBlocks(reordered) !== 1 || (reordered.match(DIA_RE) || []).length !== 1)
    fail("Mermaid matcher does not cover reordered attributes, single quotes, and mixed tag/attribute casing");
  const frozenOnly = '<div class="dia"><svg class="dia-frozen"></svg></div>';
  if (countMermaidPreBlocks(frozenOnly) !== 0 || (frozenOnly.match(DIA_RE) || []).length !== 0)
    fail("Mermaid matcher mistakes an already-frozen SVG for a host-rendered block");
}

assertMermaidMatcherContract();

// The single definition of "publishable". Used by --verify and by this script's own final
// gate, so the check that clears a file is literally the check that produced it.
function publishBlockersFromHtml(html: string, expected: GalleryExpectation): string[] {
  const problems: string[] = [];
  const unfrozen = countMermaidPreBlocks(html);
  const manifestMatches = Array.from(html.matchAll(MANIFEST_RE));
  MANIFEST_RE.lastIndex = 0;
  let manifest: GalleryManifest | undefined;

  if (html.includes(UNFROZEN_SENTINEL))
    problems.push("carries the builder's DO-NOT-PUBLISH sentinel — this is a build output, not a deploy output");
  if (!html.includes(SHAREABLE_SENTINEL))
    problems.push("missing the shareable sentinel — this file did not come out of the prerender");
  if (unfrozen > 0)
    problems.push(`${unfrozen} <pre class="mermaid"> block(s) — the host renders these at view time, so public sharing is refused`);
  if (html.trimStart().startsWith("<!doctype"))
    problems.push("complete HTML document — the Artifact tool wants body content only");
  if (html.includes('data-embedded-runtime="mermaid@')) problems.push("embeds the Mermaid runtime");
  if (EXTERNAL_SCRIPT_RE.test(html))
    problems.push("references an external script — blocked by the artifact CSP");

  if (manifestMatches.length !== 1) {
    problems.push(`expected exactly one gallery manifest, found ${manifestMatches.length}`);
  } else {
    try {
      manifest = JSON.parse(Buffer.from(manifestMatches[0][1], "base64").toString("utf8")) as GalleryManifest;
    } catch {
      problems.push("gallery manifest is not valid base64-encoded JSON");
    }
  }

  if (manifest) {
    const contentWithoutManifest = html.replace(MANIFEST_RE, "");
    MANIFEST_RE.lastIndex = 0;
    if (manifest.version !== 1) problems.push(`unsupported gallery manifest version: ${String(manifest.version)}`);
    if (manifest.sourceSha256 !== expected.sourceSha256)
      problems.push("gallery manifest source digest does not match the current generated gallery");
    if (manifest.diagramCount !== expected.diagramCount)
      problems.push(`gallery manifest expects ${manifest.diagramCount} diagrams; current source has ${expected.diagramCount}`);
    if (manifest.lightDiagramCount !== manifest.diagramCount || manifest.darkDiagramCount !== manifest.diagramCount)
      problems.push("gallery manifest does not declare one light and one dark SVG for every diagram");
    if (manifest.contentSha256 !== sha256(contentWithoutManifest))
      problems.push("gallery content digest does not match the manifest — candidate is truncated or altered");
  }

  const frozenTags = (html.match(SVG_TAG_RE) ?? []).filter((tag) => hasClass(tag, "dia-frozen"));
  if (frozenTags.length === 0) {
    problems.push("no frozen diagrams — expected indexed inline <svg> elements tagged dia-frozen");
  } else if (manifest) {
    const seen = new Map<string, number>();
    for (const tag of frozenTags) {
      const index = attribute(tag, "data-gg-diagram-index");
      const theme = attribute(tag, "data-gg-theme");
      if (!index || !/^(0|[1-9]\d*)$/.test(index)) {
        problems.push("a frozen SVG is missing a valid data-gg-diagram-index");
        continue;
      }
      if (theme !== "light" && theme !== "dark") {
        problems.push(`frozen diagram ${index} is missing a valid light/dark data-gg-theme`);
        continue;
      }
      if (!hasClass(tag, `dia-frozen-${theme}`))
        problems.push(`frozen diagram ${index}/${theme} is missing its theme-specific class`);
      const key = `${index}:${theme}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (let index = 0; index < manifest.diagramCount; index++) {
      for (const theme of ["light", "dark"] as const) {
        const count = seen.get(`${index}:${theme}`) ?? 0;
        if (count !== 1) problems.push(`expected one frozen ${theme} SVG for diagram ${index}, found ${count}`);
      }
    }
    if (frozenTags.length !== manifest.diagramCount * 2)
      problems.push(`expected ${manifest.diagramCount * 2} indexed frozen SVGs, found ${frozenTags.length}`);
  }
  return problems;
}

function publishBlockers(file: string, expected: GalleryExpectation): string[] {
  if (!existsSync(file)) return [`file does not exist: ${file}`];
  return publishBlockersFromHtml(readFileSync(file, "utf8"), expected);
}

function assertGalleryManifestContract(): void {
  const expected = { sourceSha256: sha256("current-source-fixture"), diagramCount: 2 };
  const svg = (index: number, theme: "light" | "dark") =>
    `<svg class="dia-frozen dia-frozen-${theme}" data-gg-diagram-index="${index}" data-gg-theme="${theme}"></svg>`;
  const complete =
    SHAREABLE_SENTINEL +
    `<div class="dia">${svg(0, "light")}${svg(0, "dark")}</div>` +
    `<div class="dia">${svg(1, "light")}${svg(1, "dark")}</div>`;
  const sealed = sealShareable(complete, expected);
  if (publishBlockersFromHtml(sealed, expected).length !== 0)
    fail("gallery manifest contract rejects a complete current-source fixture");
  const oneSvg = `${SHAREABLE_SENTINEL}\n<svg class="dia-frozen"></svg>`;
  if (publishBlockersFromHtml(oneSvg, expected).length === 0)
    fail("gallery manifest contract accepts the former sentinel-plus-one-SVG false positive");
  const truncated = sealed.replace(`<div class="dia">${svg(1, "light")}${svg(1, "dark")}</div>`, "");
  if (!publishBlockersFromHtml(truncated, expected).some((problem) => problem.includes("content digest")))
    fail("gallery manifest contract does not reject a truncated candidate");
  const stale = { sourceSha256: sha256("newer-source-fixture"), diagramCount: 2 };
  if (!publishBlockersFromHtml(sealed, stale).some((problem) => problem.includes("source digest")))
    fail("gallery manifest contract does not reject a stale candidate");
}

assertGalleryManifestContract();

function reportVerdict(file: string, expected: GalleryExpectation): number {
  const problems = publishBlockers(file, expected);
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

function buildFreshOutputs(): GalleryExpectation & { artifactBody: string } {
  console.log("1/4 building fresh outputs (read-only run of visual-assets-artifact.build.ts)…");
  // Reuse the running Bun binary instead of resolving `bun` through PATH. Agent
  // runtimes may intentionally omit PATH from process.env even though this script
  // itself was launched by Bun; the deploy pipeline must still be self-contained.
  const built = spawnSync(process.execPath, [BUILD], {
    env: { ...process.env, LOCAL_OUT, ARTIFACT_OUT },
    stdio: "inherit",
  });
  if (built.status !== 0) fail("gallery build failed");

  const artifactBody = readFileSync(ARTIFACT_OUT, "utf8");
  if (!artifactBody.includes(UNFROZEN_SENTINEL))
    fail("builder output is missing UNFROZEN_SENTINEL — re-sync the constant in visual-assets-artifact.build.ts");
  const diagramCount = (artifactBody.match(DIA_RE) || []).length;
  if (diagramCount === 0) fail('no <div class="dia"><pre class="mermaid"> blocks found to freeze');
  return { artifactBody, sourceSha256: sha256(artifactBody), diagramCount };
}

const verifyFlag = process.argv.indexOf("--verify");
if (verifyFlag !== -1) {
  const expected = buildFreshOutputs();
  process.exit(reportVerdict(process.argv[verifyFlag + 1] ?? SHAREABLE_OUT, expected));
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

const currentGallery = buildFreshOutputs();
const { artifactBody, diagramCount: diaCount } = currentGallery;
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
    const annotate = (svg: string, theme: "light" | "dark") => {
      const withClass = svg.replace(
        'class="mermaid mermaid-rendered"',
        `class="mermaid mermaid-rendered dia-frozen dia-frozen-${theme}"`,
      );
      if (withClass === svg) fail(`rendered diagram ${idx}/${theme} is missing the expected Mermaid class`);
      return withClass.replace(
        /<svg\b/i,
        `<svg data-gg-diagram-index="${idx}" data-gg-theme="${theme}"`,
      );
    };
    const l = annotate(light[idx], "light");
    const d = annotate(dark[idx], "dark");
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
shareable = sealShareable(shareable, currentGallery);
const svgCount = (shareable.match(/<svg[\s>]/g) || []).length;

// Write first, then verify the bytes on disk — the file is what gets published, not the
// string in memory, and this runs the same check --verify runs.
writeFileSync(SHAREABLE_OUT, shareable);
const blockers = publishBlockers(SHAREABLE_OUT, currentGallery);
if (blockers.length) fail(`shareable output is not publishable:\n     · ${blockers.join("\n     · ")}`);

console.log(`\n✅ shareable body: ${SHAREABLE_OUT}`);
console.log(`   ${Buffer.byteLength(shareable).toLocaleString()} bytes · froze ${diaCount} diagrams (light+dark) · total <svg>=${svgCount} · host-rendered Mermaid blocks=${countMermaidPreBlocks(shareable)}`);
console.log(`   verified publishable — publish THIS path to artifact 007ef090:`);
console.log(`     ${SHAREABLE_OUT}`);
console.log(`   re-check any candidate path with:  bun ${BUILD.replace("visual-assets-artifact.build.ts", "visual-assets-prerender.ts")} --verify <file>`);
console.log(`   local visual validation (never publish this one): open ${LOCAL_OUT} with file://`);
