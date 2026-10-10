// Builds the "Commitment Loop Walk" claude.ai artifact: every screen of the
// commitment pooling feature, on all three surfaces it ships on, as one tabbed
// page.
//
//   1) Client PWA        — the D1 commitment loop on the phone (PR #749)
//   2) Editorial website — the public record and the protocol band (PR #748)
//   3) Admin console     — the steward's six flows (PR #752)
//
// Rebuild:  bun .plans/active/commitment-pooling/commitment-walk-artifact.build.ts
// Republish via the Claude Code Artifact tool with
//   url: https://claude.ai/code/artifact/5351a22a-771f-446b-ba1c-d86c5fcd5380
//   favicon: 🤝   title: Commitment Loop Walk   (both stable across rebuilds)
//
// Unlike visual-assets-artifact.build.ts there is no local/publishable split and
// no UNFROZEN sentinel here: that guard exists because the gallery embeds
// `<pre class="mermaid">`, which only the Artifact host can render, so its local
// preview is never publishable. This build emits plain <img> and one output file
// that is the same bytes locally and on the host.
//
// INPUTS — pre-encoded WebP, one directory per surface, default under tmp/ and
// overridable with WALK_FRAMES. They are deliberately NOT checked in: the client
// frames carry real local garden records, and .plans/ is world-readable.
//
//   <WALK_FRAMES>/client/NN-slug.webp             42 frames, 780x1688
//   <WALK_FRAMES>/editorial/desktop/NN-slug.webp   19 frames, 1280 wide
//   <WALK_FRAMES>/editorial/mobile/NN-slug.webp    19 frames, 640 wide
//   <WALK_FRAMES>/admin/NN-slug.webp               38 frames; routes 1280 wide,
//                                                  components trimmed to content, ≤1024
//
// Regenerate the admin inputs after a cockpit change:
//   bun --cwd packages/shared run build-storybook
//   node packages/shared/.storybook/capture-admin-stories.mjs \
//     --ids-file=.plans/active/commitment-pooling/commitment-walk-admin-stories.json \
//     --themes=light --route-fullpage=false
//   bun .plans/active/commitment-pooling/commitment-walk-artifact.build.ts --prepare-admin
//
// Captions and section prose live in commitment-walk-frames.json beside this
// file, so the words are version controlled even though the pixels are not.
// One-shot op per CLAUDE.md scripts policy — lives in .plans, not scripts/.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import sharp from "sharp";

const DIR = import.meta.dir;
const ROOT = join(DIR, "../../..");
const FRAMES = process.env.WALK_FRAMES ?? join(ROOT, "tmp/commitment-walk-frames");
const OUT = process.env.OUT ?? "/tmp/commitment-walk.artifact.html";
const MANIFEST = join(DIR, "commitment-walk-frames.json");

// Ceilings, in base64 bytes as they land in the document. The published page must
// stay under 16 MB and the assets capability is not available on this account, so
// every frame is inline and the budget is the design constraint, not a nicety.
const TAB_CEILING = { client: 2_900_000, editorial: 3_200_000, admin: 3_700_000 } as const;
const DOCUMENT_CEILING = 13_000_000;

interface Frame {
  file: string;
  title: string;
  state: string;
  caption: string;
}
interface Section {
  id: string;
  heading: string;
  lead: string;
  frames: Frame[];
}
interface Tab {
  id: "client" | "editorial" | "admin";
  label: string;
  sections: Section[];
}

// ---------- --prepare-admin: encode freshly captured admin PNGs into the input tree ----------
// The capture harness names files <bucket>/<theme>/<TitleSlug>/<VariantSlug>.png,
// which is right for a design sweep and wrong for a curated walk, so this step
// resolves each story id through the Storybook index and renames as it encodes.
if (process.argv.includes("--prepare-admin")) {
  const shotRoot = join(ROOT, "tmp/storybook-design-assets/screenshots");
  const indexPath = join(ROOT, "packages/shared/storybook-static/index.json");
  if (!existsSync(indexPath)) {
    console.error(`No ${indexPath}. Run: bun --cwd packages/shared run build-storybook`);
    process.exit(1);
  }
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as {
    entries: Record<string, { title: string; name: string }>;
  };
  const map = JSON.parse(readFileSync(join(DIR, "commitment-walk-admin-stories.json"), "utf8")) as {
    stories: Record<string, string>;
  };
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, "_");
  const outDir = join(FRAMES, "admin");
  mkdirSync(outDir, { recursive: true });

  let bytes = 0;
  const gone: string[] = [];
  for (const [id, file] of Object.entries(map.stories)) {
    const entry = index.entries[id];
    if (!entry) {
      gone.push(`${id} (not in the Storybook index — was the story renamed?)`);
      continue;
    }
    // Route stories render the whole cockpit and earn more pixels than a component.
    const isRoute = /^Admin\/Workspaces\//.test(entry.title);
    const png = findShot(shotRoot, safe(entry.title), safe(entry.name));
    if (!png) {
      gone.push(`${id} (no capture under ${shotRoot})`);
      continue;
    }
    // A component story renders its subject at natural size on a full canvas, so
    // most of the capture is empty paper. Trim the uniform border back to the
    // component, but never trust a trim that ate almost everything — a skeleton or
    // an all-white dialog can trim to nothing.
    let pipeline = sharp(png);
    if (!isRoute) {
      const trimmed = await sharp(png).trim({ threshold: 5 }).toBuffer({ resolveWithObject: true });
      if (trimmed.info.width >= 200 && trimmed.info.height >= 160) pipeline = sharp(trimmed.data);
    }
    const info = await pipeline
      .resize({ width: isRoute ? 1280 : 1024, withoutEnlargement: true })
      .webp({ quality: 80, effort: 4, smartSubsample: true })
      .toFile(join(outDir, file));
    bytes += info.size;
  }
  if (gone.length) {
    console.error(`Could not prepare ${gone.length} frame(s):`);
    for (const g of gone) console.error(`  ${g}`);
    process.exit(1);
  }
  console.log(`admin: ${Object.keys(map.stories).length} frames, ${bytes} bytes → ${outDir}`);
  process.exit(0);
}

function findShot(root: string, titleSlug: string, variantSlug: string): string | null {
  if (!existsSync(root)) return null;
  for (const bucket of readdirSync(root)) {
    const candidate = join(root, bucket, "light", titleSlug, `${variantSlug}.png`);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

// ---------- load ----------
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { tabs: Tab[] };

function frameDirs(tab: Tab["id"]): string[] {
  if (tab === "editorial") return [join(FRAMES, "editorial/desktop"), join(FRAMES, "editorial/mobile")];
  return [join(FRAMES, tab)];
}

const missing: string[] = [];
for (const tab of manifest.tabs) {
  for (const dir of frameDirs(tab.id)) {
    if (!existsSync(dir)) {
      missing.push(dir);
      continue;
    }
    const have = new Set(readdirSync(dir));
    for (const section of tab.sections) {
      for (const frame of section.frames) {
        if (!have.has(frame.file)) missing.push(join(dir, frame.file));
      }
    }
  }
}
if (missing.length) {
  console.error(`Missing ${missing.length} input frame(s). First few:`);
  for (const m of missing.slice(0, 8)) console.error(`  ${m}`);
  console.error("\nSee this file's header for how to regenerate the input tree.");
  process.exit(1);
}

// ---------- helpers ----------
const escapeHtml = (s: string) =>
  s.replace(/&(?![a-zA-Z#][a-zA-Z0-9]*;)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/<[^>]*>/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

interface Embedded {
  uri: string;
  width: number;
  height: number;
  bytes: number;
}
const cache = new Map<string, Embedded>();

async function embed(path: string): Promise<Embedded> {
  const hit = cache.get(path);
  if (hit) return hit;
  const buf = readFileSync(path);
  const meta = await sharp(buf).metadata();
  const uri = `data:image/webp;base64,${buf.toString("base64")}`;
  const value = { uri, width: meta.width ?? 0, height: meta.height ?? 0, bytes: uri.length };
  cache.set(path, value);
  return value;
}

// Real width/height plus decoding=async gives zero CLS with no aspect-ratio guessing.
// No loading="lazy": it is a no-op on data: URIs and must not be mistaken for the
// memory story. content-visibility on the figure is what actually defers work.
function img(e: Embedded, alt: string): string {
  return `<img src="${e.uri}" alt="${escapeHtml(alt)}" width="${e.width}" height="${e.height}" decoding="async">`;
}

// ---------- panes ----------
const prefix = { client: "c", editorial: "e", admin: "a" } as const;
const tabBytes: Record<string, number> = { client: 0, editorial: 0, admin: 0 };

async function renderTab(tab: Tab): Promise<{ body: string; nav: string }> {
  const navParts: string[] = [];
  const sections: string[] = [];

  for (const section of tab.sections) {
    const sid = `${prefix[tab.id]}-${section.id}`;
    navParts.push(
      `<a href="#${sid}">${escapeHtml(section.heading)} <span class="count">${section.frames.length}</span></a>`
    );

    const figures: string[] = [];
    for (const frame of section.frames) {
      const head =
        `<div class="frame-head"><h3>${escapeHtml(frame.title)}</h3>` +
        (frame.state ? `<code class="state">${escapeHtml(frame.state)}</code>` : "") +
        `</div>`;
      const cap = `<figcaption>${head}<p>${frame.caption}</p></figcaption>`;

      if (tab.id === "editorial") {
        const d = await embed(join(FRAMES, "editorial/desktop", frame.file));
        const m = await embed(join(FRAMES, "editorial/mobile", frame.file));
        tabBytes.editorial += d.bytes + m.bytes;
        figures.push(
          `<figure class="frame"><div class="pair-shots">` +
            `<div class="screen">${img(d, `${frame.title} at 1280 wide`)}</div>` +
            `<div class="screen narrow">${img(m, `${frame.title} at 390 wide`)}</div>` +
            `</div>${cap}</figure>`
        );
        continue;
      }

      const e = await embed(join(FRAMES, tab.id, frame.file));
      tabBytes[tab.id] += e.bytes;
      const shell = tab.id === "client" ? "phone" : "screen";
      // Trimmed component frames vary hugely in width. Anything near full width
      // spans the admin grid; a small card sits two-up beside its neighbour.
      const wide = tab.id === "admin" && e.width >= 900 ? " wide" : "";
      figures.push(
        `<figure class="frame${wide}"><div class="${shell}">${img(e, frame.title)}</div>${cap}</figure>`
      );
    }

    const gridClass =
      tab.id === "client" ? "frames frames-client" : tab.id === "admin" ? "frames-admin" : "pairs";
    sections.push(
      `<section id="${sid}"><h2>${escapeHtml(section.heading)}</h2>` +
        `<p class="lead">${section.lead}</p>` +
        `<div class="${gridClass}">${figures.join("")}</div></section>`
    );
  }

  return { body: sections.join("\n"), nav: navParts.join("") };
}

// ---------- per-tab trailing panels ----------
// Deliberately not shared. Each surface has a different reproduce recipe, and a
// shared trailer would have to sit outside .paneshost, breaking the sticky TOC's
// max-height and making scrollspy's bottom-of-document rule light up the shared
// panel on every tab.
function panel(id: string, heading: string, lead: string, items: string[], ordered = true): string {
  const tag = ordered ? "ol" : "ul";
  return (
    `<section id="${id}" class="panel how"><h2>${heading}</h2>` +
    (lead ? `<p class="lead">${lead}</p>` : "") +
    `<${tag}>${items.map((i) => `<li>${i}</li>`).join("")}</${tag}></section>`
  );
}

const CLIENT_PANELS =
  panel(
    "c-drive",
    "Walk it yourself",
    "",
    [
      'With the dev stack up, open <code>https://localhost:3001/home?mockAuth=deployer&amp;presentation=pwa&amp;mockPooling=1</code>. The flag sticks for the tab; <code>?mockPooling=0</code> turns it off.',
      "Tap the hand icon in the header for the sheet. Switch to <code>mockAuth=user</code> for the member's view (no To confirm tab).",
      "Open Green Goods Community Garden → Pool for the rail, the rows and the doors. Place an offer: it comes back as a queued row.",
      "Growecosystems → Pool is the paused pool; TAS HUB → Pool is the protocol pool, where taking something up asks who takes it.",
      "Queued acts stay on the phone in this mode: the mock identity has no signer, so nothing is sent and nothing touches the fork.",
    ]
  ) +
  panel(
    "c-fixes",
    "What the walk caught",
    "Six defects the frames found that the tests did not.",
    [
      "<b>Composer chips and cards did nothing in the built app.</b> Every beat read the form with <code>form.watch()</code>; the React Compiler memoised the beats and never saw the form change. Tests run without the compiler and passed. Now <code>useWatch</code>.",
      "<b>Opening a commitment from the sheet landed on Garden not found.</b> Pool rows carry lowercase garden addresses, the gardens list is checksummed, and the route compared them exactly.",
      "<b>A steward saw the garden's claim in To confirm, then no act on it.</b> The contract seats a garden's stewards as its ordinary confirmers; the seat selector did not.",
      "<b>A paused pool with nothing in it hid its reason.</b> The notice lived inside the list that the empty state replaces.",
      "<b>Row titles were three letters wide on a phone.</b> The state chip sat beside the title; it now rides under the words.",
      "<b>The pool readiness row said promises.</b> Public copy says commitment.",
    ],
    false
  ) +
  panel(
    "c-not-shown",
    "Not in these frames",
    "",
    [
      "<code>step-advanced</code> (named confirmers and the fallback opt-out in the composer): the shared form does not model confirmers yet.",
      "Team setup, adding, removing and assigning people: steward-gated online roster acts, deferred.",
      "The claim card on the pool tab, the state timeline, and the composer's media capture: deferred.",
      "Steward fallback confirmation with a reason, and the campaign-request confirm cast.",
      "Saved offers and the ongoing path (D2), and settlement.",
    ],
    false
  );

const EDITORIAL_PANELS =
  panel(
    "e-how",
    "How these were captured",
    "Worth stating plainly, because it is not the same method as the client frames.",
    [
      "The demo world does not reach the editorial surfaces. <code>demoAware</code> in <code>modules/commitment-pooling/data.ts</code> wraps the eight app-side readers; <code>getPublicGardenPool</code> and <code>getPublicCommitmentImpact</code> query the indexer directly and have no fixture behind them, so <code>?mockPooling=1</code> changes nothing on <code>/gardens/:id</code> or <code>/impact</code>.",
      "The local indexer has nothing to show. All 18 pools on the Arbitrum fork are <code>NOT_READY</code> with zero commitments offered, accepted or fulfilled, so the live editorial panels render the PreLaunch frame and nothing else.",
      "So these 19 states come from the two Storybook story files that ship with the components, each seeded through its own query key: no network, no mocked hook, the real component against the real selectors and formatters.",
      "Reproduce them with <code>bun run --cwd packages/shared storybook</code>, then <code>Client/Public/GardenDetail/CommitmentsSection</code> and <code>Client/Public/PublicCommitmentsBand</code>. Captured headless at 1280 × 900 and 390 × 844, full page, light theme.",
    ]
  ) +
  panel(
    "e-not-shown",
    "Not in these frames",
    "",
    [
      "The editorial hero, the nav and the footer: these are the two commitment panels, not the whole page around them.",
      "Certificates. The record's closing line points at them; they are their own surface.",
      "Anything a signed-out reader must never see: provider rows, addresses, pause reasons and cancelled cycles are absent by design, not by omission.",
    ],
    false
  );

const ADMIN_PANELS =
  panel(
    "a-how",
    "How these were captured",
    "Storybook again, and for a sharper reason than the editorial frames.",
    [
      "<code>?mockPooling=1</code> deliberately excludes the console. <code>data.ts</code> leaves <code>getPoolClaimRequests</code>, <code>getCommitmentActivity</code>, <code>getFallbackConfirmationCandidates</code> and <code>getPoolMemberHistory</code> unwrapped, with the reason in a comment: the console is an operator surface, not one of the member screens the demo world stands in for.",
      "<code>?mockAuth=</code> fakes the address, never the role. <code>canManage</code> and <code>isPoolSteward</code> resolve from the indexer and from on-chain <code>GardenAccountABI</code> reads, so a live capture needs the whole stack and a mock address that genuinely holds operator on a fork garden — and still shows an empty claims card, timeline and charter.",
      "The console has a purpose-built fixture world instead: <code>POOL_STORY_SEEDS</code> seeds the real <code>queryKeys.commitmentPooling.*</code> keys, including <code>poolClaims(…, \"PENDING\")</code> which demo mode cannot reach, so the real route components render over fixtures with no indexer at all.",
      "Reproduce with <code>bun --cwd packages/shared run build-storybook</code>, then <code>node packages/shared/.storybook/capture-admin-stories.mjs --ids-file=.plans/active/commitment-pooling/commitment-walk-admin-stories.json --themes=light --route-fullpage=false</code>, then <code>bun .plans/active/commitment-pooling/commitment-walk-artifact.build.ts --prepare-admin</code>. Route stories at 1440 × 1024, component stories at 1280 × 800, light theme.",
      "Route frames are captured at viewport size, not full page. <code>withCanvasFrame</code> sets a <em>min</em> height and <code>CanvasLayout</code> scrolls internally, so a full-page shot stretches the cockpit to three times its real height.",
      "The three whole-cockpit frames are shells, not consoles. All three <code>Admin/Workspaces/*</code> route stories seed the shell but not the pooling content — <code>Admin/Workspaces/Garden · Pool</code> stops at the chain-availability gate and <code>Workspaces/Hub · ConfirmQueue</code> renders an empty stage — so each one is paired with the component story that carries the data. Worth fixing in the stories; it is recorded here rather than papered over.",
      "A component story renders its subject at natural size on a full 1280 × 800 canvas, so the prepare step trims the uniform border back to the content. A small card is published as a small card, not as a card floating in a page of empty paper.",
    ]
  ) +
  panel(
    "a-not-shown",
    "Not in these frames",
    "D2 and settlement-gated work, per the D1 dispatch.",
    [
      "Settlement and payout: recording a payout, contributor allocation, queueing settlement for a garden, editing a declared value.",
      "The Baseline readiness row: no shared selector for a qualifying starting assessment exists, so the checklist shows two rows, not three.",
      "Roster setup and forming — adding, removing and assigning people — and the captured-for cast in the seeding console.",
      "Closing and composting a cycle as acts; finished cycles render with their state, but the acts are D2.",
      "Dark mode. The cockpit has one and the capture harness supports it; this walk is light only.",
    ],
    false
  );

const TRAILERS: Record<string, string> = {
  client: CLIENT_PANELS,
  editorial: EDITORIAL_PANELS,
  admin: ADMIN_PANELS,
};
const TRAILER_NAV: Record<string, string> = {
  client:
    '<a href="#c-drive">Walk it yourself</a><a href="#c-fixes">What the walk caught</a><a href="#c-not-shown">Not in these frames</a>',
  editorial: '<a href="#e-how">How these were captured</a><a href="#e-not-shown">Not in these frames</a>',
  admin: '<a href="#a-how">How these were captured</a><a href="#a-not-shown">Not in these frames</a>',
};

const PREAMBLE = `<section id="c-read"><h2>How to read this walk</h2><p class="lead">Three tabs, one per surface commitment pooling ships on. <b>Client PWA</b> is the gardener's phone, captured from the running app against the local Arbitrum fork with the demo world on. <b>Editorial website</b> is what a signed-out reader sees. <b>Admin console</b> is the steward's cockpit. The editorial and console frames come from Storybook rather than the running app, and each tab's last panels say exactly how it was captured and what it leaves out.</p></section>`;

// ---------- assemble ----------
const rendered = await Promise.all(manifest.tabs.map(renderTab));
const panes = manifest.tabs.map((tab, i) => {
  const first = tab.id === "client" ? PREAMBLE : "";
  const body = first + rendered[i]!.body + TRAILERS[tab.id];
  const nav =
    (tab.id === "client" ? '<a href="#c-read">How to read this walk</a>' : "") +
    rendered[i]!.nav +
    TRAILER_NAV[tab.id];
  return { tab, body, nav };
});

const frameTotal = manifest.tabs.reduce(
  (n, t) => n + t.sections.reduce((m, s) => m + s.frames.length, 0),
  0
);
const imageTotal = cache.size;

const html = `<title>Commitment Loop Walk</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Public+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
  :root {
    --canvas: #f5f2ea; --card: #fffdf8; --ink: #1f2a22; --ink-soft: #4c564f;
    --stone: #8a8f86; --line: #dcd8cd; --green: #2a6f43; --green-soft: #dfeadf;
    --clay: #b85c2a; --shadow: 0 18px 40px -24px rgba(31, 42, 34, 0.45);
    --header-h: 104px;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --canvas: #161a17; --card: #1f2520; --ink: #ece8dd; --ink-soft: #c2bfb4;
      --stone: #8d948c; --line: #343c36; --green: #7fbf93; --green-soft: #22352a;
      --clay: #e39a6a; --shadow: 0 18px 40px -24px rgba(0, 0, 0, 0.8);
    }
  }
  :root[data-theme="dark"] {
    --canvas: #161a17; --card: #1f2520; --ink: #ece8dd; --ink-soft: #c2bfb4;
    --stone: #8d948c; --line: #343c36; --green: #7fbf93; --green-soft: #22352a;
    --clay: #e39a6a; --shadow: 0 18px 40px -24px rgba(0, 0, 0, 0.8);
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--canvas); color: var(--ink);
    font-family: "Public Sans", "Helvetica Neue", Arial, sans-serif; font-size: 16px; line-height: 1.5; }
  a { color: var(--green); }
  a:focus-visible, button:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }
  code, .state { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.82em; }
  .skip-link { position: fixed; top: .5rem; left: .5rem; z-index: 50; transform: translateY(-180%);
    background: var(--card); color: var(--ink); border: 2px solid var(--green); border-radius: 8px; padding: .55rem .8rem; font-weight: 600; }
  .skip-link:focus { transform: translateY(0); }

  header.top { position: sticky; top: 0; z-index: 30; background: var(--canvas);
    border-bottom: 1px solid var(--line); padding: 18px 32px 0; }
  .mast { max-width: 1320px; margin: 0 auto; }
  .mast h1 { font-family: "Fraunces", Georgia, serif; font-weight: 600; font-size: 28px; line-height: 1.1;
    margin: 0 0 6px; letter-spacing: -0.01em; }
  .mast .sub { color: var(--stone); font-size: 13px; line-height: 1.45; margin: 0 0 12px; max-width: 104ch;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
  /* Wrapping, never clipping: a tab must not become unreachable on a phone. */
  nav.tabs { display: flex; flex-wrap: wrap; gap: .25rem; max-width: 1320px; margin: 0 auto; }
  nav.tabs button { appearance: none; border: 0; background: none; color: var(--stone); font: inherit;
    font-size: 15px; padding: .5rem .9rem; border-radius: 10px 10px 0 0; cursor: pointer; border-bottom: 2.5px solid transparent; }
  nav.tabs button[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--green); font-weight: 600; }

  main { max-width: 1320px; margin: 0 auto; padding: 28px 32px 96px;
    display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 48px; }
  aside.toc { position: sticky; top: calc(var(--header-h) + .6rem); align-self: start;
    max-height: calc(100dvh - var(--header-h) - 1.6rem); overflow-y: auto; overscroll-behavior: contain; }
  aside.toc a { display: block; color: var(--ink-soft); text-decoration: none; font-size: 14px;
    padding: 4px 0 4px 10px; border-left: 2px solid transparent; }
  aside.toc a:hover { color: var(--ink); border-left-color: var(--green); }
  aside.toc a.is-current { color: var(--green); border-left-color: var(--green); font-weight: 600; }
  aside.toc .count { color: var(--stone); font-variant-numeric: tabular-nums; }
  /* On a wide screen the disclosure is invisible scaffolding; on a phone it is the
     navigation, collapsed by default. Deleting the TOC below 860px (the gallery's
     choice) would leave a phone reader with 98 frames and no way to move. */
  .toc-disclosure { display: contents; }
  .toc-disclosure > summary { display: none; }
  @media (max-width: 860px) {
    main { grid-template-columns: minmax(0, 1fr); gap: 20px; padding: 20px 16px 64px; }
    .toc-disclosure { display: block; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 4px 14px; }
    .toc-disclosure > summary { display: list-item; cursor: pointer; font-size: 14px; font-weight: 600; color: var(--ink-soft); padding: 8px 0; }
    aside.toc { position: static; max-height: none; padding: 2px 0 8px; }
  }

  .paneshost { position: relative; min-width: 0; overflow-x: clip; overflow-y: visible; }
  .pane { min-width: 0; display: grid; gap: 56px; }
  /* display:none, not the gallery's 1px collapse. That trick exists so Mermaid can
     measure clientWidth in a hidden pane; this build has no measured content, and
     visibility:hidden would keep ~60 hidden frames in the render tree. */
  .pane[aria-hidden="true"] { display: none; }
  section { scroll-margin-top: calc(var(--header-h) + 1rem); }
  section h2 { font-family: "Fraunces", Georgia, serif; font-weight: 500; font-size: 28px; margin: 0 0 6px; letter-spacing: -0.01em; }
  section .lead { color: var(--ink-soft); max-width: 68ch; margin: 0 0 22px; }

  .frames { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 28px 22px; }
  .frames-admin { display: grid; grid-template-columns: repeat(auto-fill, minmax(400px, 1fr)); gap: 34px 26px; align-items: start; }
  .frames-admin .frame.wide { grid-column: 1 / -1; }
  @media (max-width: 700px) { .frames-admin { grid-template-columns: minmax(0, 1fr); } }
  .pairs { display: grid; gap: 38px; }
  .pair-shots { display: grid; grid-template-columns: minmax(0, 1fr) 176px; gap: 18px; align-items: start; }
  @media (max-width: 620px) { .pair-shots { grid-template-columns: minmax(0, 1fr); } .pair-shots .narrow { max-width: 200px; } }
  .frame { margin: 0; display: grid; gap: 12px; align-content: start; }
  .phone { border-radius: 26px; overflow: hidden; border: 1px solid var(--line); background: var(--card); box-shadow: var(--shadow); }
  .screen { border-radius: 12px; overflow: hidden; border: 1px solid var(--line); background: var(--card); box-shadow: var(--shadow); }
  .screen.narrow { border-radius: 16px; }
  .phone img, .screen img { display: block; width: 100%; height: auto; }
  /* Per-aspect intrinsic sizes: one global value would make the scrollbar jump and
     corrupt the getBoundingClientRect reads the scrollspy depends on. */
  .frame { content-visibility: auto; }
  .frames-client .frame { contain-intrinsic-size: auto 360px auto 820px; }
  .frames-admin .frame { contain-intrinsic-size: auto 1000px auto 760px; }
  .pairs .frame { contain-intrinsic-size: auto 1000px auto 800px; }
  figcaption h3 { font-size: 15px; font-weight: 600; margin: 0; }
  .frame-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 10px; }
  .state { color: var(--green); background: var(--green-soft); padding: 1px 7px; border-radius: 6px; }
  figcaption p { margin: 4px 0 0; font-size: 14px; color: var(--ink-soft); max-width: 72ch; }

  .panel { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 22px 24px; }
  .panel h2 { font-size: 22px; }
  .panel .lead { margin-bottom: 14px; }
  .panel ol, .panel ul { margin: 0; padding-left: 20px; display: grid; gap: 10px; max-width: 78ch; }
  .panel ul { list-style: none; padding-left: 14px; }
  .panel ul li { border-left: 3px solid var(--clay); padding-left: 12px; }
  .panel code { background: var(--canvas); padding: 2px 6px; border-radius: 5px; overflow-wrap: anywhere; }
  @media (prefers-reduced-motion: no-preference) {
    .phone, .screen { transition: transform 200ms ease; }
    .frame:hover .phone, .frame:hover .screen { transform: translateY(-2px); }
  }
</style>
<a class="skip-link" href="#content">Skip to the frames</a>
<header class="top">
  <div class="mast">
    <h1>Commitment Loop Walk</h1>
    <p class="sub">Green Goods · commitment pooling on all three surfaces · ${frameTotal} frames, ${imageTotal} captures · client PR #749 · editorial PR #748 · console PR #752 · source: <code>.plans/active/commitment-pooling/</code></p>
  </div>
  <nav class="tabs" role="tablist" aria-label="Surfaces">
${manifest.tabs
  .map(
    (t, i) =>
      `    <button id="tab-${t.id}" role="tab" aria-selected="${i === 0}" aria-controls="pane-${t.id}" tabindex="${i === 0 ? 0 : -1}" data-tab="${t.id}">${t.label}</button>`
  )
  .join("\n")}
  </nav>
</header>
<main id="content" tabindex="-1">
  <details class="toc-disclosure" id="toc-disclosure" open>
    <summary>Sections</summary>
    <aside class="toc" id="toc" aria-label="Section navigation"></aside>
  </details>
  <div class="paneshost">
${panes
  .map(
    (p, i) =>
      `    <div class="pane" id="pane-${p.tab.id}" role="tabpanel" aria-labelledby="tab-${p.tab.id}" aria-hidden="${i !== 0}"${i !== 0 ? " inert" : ""} data-nav='${p.nav.replace(/'/g, "&#39;")}'>\n${p.body}\n    </div>`
  )
  .join("\n")}
  </div>
</main>
<script>
(function(){
  var tabs = Array.from(document.querySelectorAll('nav.tabs button'));
  var panes = Array.from(document.querySelectorAll('.pane'));
  var toc = document.getElementById('toc');
  var headerEl = document.querySelector('header.top');

  function syncHeaderHeight(){
    if (!headerEl) return;
    var height = Math.ceil(headerEl.getBoundingClientRect().height);
    if (height > 0) document.documentElement.style.setProperty('--header-h', height + 'px');
  }

  var spyTargets = [], spyCurrent = null, spyFrame = 0;

  function updateScrollspy(){
    spyFrame = 0;
    if (!spyTargets.length) return;
    var edge = (headerEl ? headerEl.getBoundingClientRect().height : 96) + 28;
    var found = spyTargets[0];
    for (var i = 0; i < spyTargets.length; i += 1) {
      if (spyTargets[i].el.getBoundingClientRect().top <= edge) found = spyTargets[i];
      else break;
    }
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      found = spyTargets[spyTargets.length - 1];
    }
    if (found === spyCurrent) return;
    if (spyCurrent) { spyCurrent.link.classList.remove('is-current'); spyCurrent.link.removeAttribute('aria-current'); }
    spyCurrent = found;
    found.link.classList.add('is-current');
    found.link.setAttribute('aria-current', 'true');
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
    }).filter(function(t){ return t.el; });
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
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('tab', name);
      history.replaceState(null, '', url);
    } catch (err) {}
    requestAnimationFrame(function(){ syncHeaderHeight(); buildScrollspy(); });
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

  // Hidden panes are display:none, so a bare #hash cannot reach one. Resolve the
  // owning pane first, activate it, then scroll.
  var initial = tabs[0] ? tabs[0].dataset.tab : 'client';
  var hash = '';
  try { hash = decodeURIComponent(window.location.hash.slice(1)); } catch (err) { hash = ''; }
  var target = hash ? document.getElementById(hash) : null;
  if (target) {
    var owner = target.closest('.pane');
    if (owner) initial = owner.id.replace('pane-', '');
  } else {
    try {
      var wanted = new URL(window.location.href).searchParams.get('tab');
      if (wanted && document.getElementById('pane-' + wanted)) initial = wanted;
    } catch (err) {}
  }
  activate(initial, false, false);
  if (target) requestAnimationFrame(function(){ target.scrollIntoView(); });

  // Phones start with the navigation folded, and fold it again after a pick so
  // the section lands in view rather than under the list.
  var disclosure = document.getElementById('toc-disclosure');
  var narrow = window.matchMedia ? window.matchMedia('(max-width: 860px)') : null;
  if (disclosure && narrow && narrow.matches) disclosure.open = false;
  toc.addEventListener('click', function(event){
    if (disclosure && narrow && narrow.matches && event.target.closest('a')) disclosure.open = false;
  });

  window.addEventListener('scroll', scheduleScrollspy, { passive: true });
  window.addEventListener('resize', function(){ syncHeaderHeight(); scheduleScrollspy(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncHeaderHeight);
})();
</script>
`;

// ---------- assertions ----------
function assertBuild(ok: boolean, message: string): void {
  if (!ok) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  }
}

// Every anchor must be unique: all three panes share one DOM, so a duplicate id
// silently routes getElementById and #hash to whichever comes first.
const ids = [...html.matchAll(/<section id="([^"]+)"/g)].map((m) => m[1]!);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
assertBuild(dupes.length === 0, `duplicate section ids: ${[...new Set(dupes)].join(", ")}`);

// Nav/body parity, both directions.
const navIds = [...html.matchAll(/data-nav='([^']*)'/g)]
  .flatMap((m) => [...m[1]!.matchAll(/href="#([^"]+)"/g)].map((h) => h[1]!));
for (const id of navIds) assertBuild(ids.includes(id), `nav link #${id} has no section`);
for (const id of ids) assertBuild(navIds.includes(id), `section #${id} is not in any nav`);

for (const [tab, ceiling] of Object.entries(TAB_CEILING)) {
  const used = tabBytes[tab] ?? 0;
  console.log(`  ${tab.padEnd(10)} ${(used / 1e6).toFixed(2)} MB base64  (ceiling ${(ceiling / 1e6).toFixed(1)} MB)`);
  assertBuild(used <= ceiling, `${tab} tab over budget: ${used} > ${ceiling}`);
}

const size = Buffer.byteLength(html, "utf8");
console.log(`  document   ${(size / 1e6).toFixed(2)} MB  (ceiling ${(DOCUMENT_CEILING / 1e6).toFixed(0)} MB, host cap 16 MB)`);
assertBuild(size <= DOCUMENT_CEILING, `document over budget: ${size} > ${DOCUMENT_CEILING}`);

if (process.exitCode) {
  console.error("\nBuild failed; nothing written.");
  process.exit(1);
}

mkdirSync(join(OUT, ".."), { recursive: true });
writeFileSync(OUT, html, "utf8");
console.log(`\n${frameTotal} frames, ${imageTotal} captures → ${OUT}`);
console.log(`Publish with url: https://claude.ai/code/artifact/5351a22a-771f-446b-ba1c-d86c5fcd5380`);
