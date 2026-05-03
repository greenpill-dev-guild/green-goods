#!/usr/bin/env node
// Build per-session combined paste-ready messages for claude.ai/design.
// Each output = 00-SYSTEM.md body + per-view body + inline token reference + attachment checklist.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const planDir = resolve(__dirname, "..");
const repoRoot = resolve(planDir, "../../..");

const destDir = process.argv[2] ?? planDir;

const tokenSource = JSON.parse(
  readFileSync(resolve(repoRoot, "tmp/storybook-design-assets/design-md.generated.json"), "utf8"),
);

function readPrompt(name) {
  return readFileSync(resolve(planDir, name), "utf8")
    .replace(/^---[\s\S]*?---\n/, "")
    .trim();
}

function tokenBlock() {
  const c = tokenSource.colors;
  return `## Token reference (compact, inline)

The full token export is in \`design-md.generated.json\` and \`theme.css\` in the bundle. The essentials:

### Colors (Warm Earth)

| Role | DesignMD name | Hex (light) | Notes |
|------|---------------|-------------|-------|
| Canvas | \`neutral\` | ${c.neutral} | warm cream / off-white |
| Canvas dark | \`neutral-dark\` | ${c["neutral-dark"]} | dark mode base |
| Ink | \`primary\` | ${c.primary} | warm charcoal — the codebase calls this **secondary text** in some places, NOT the green |
| Ink inverse | \`primary-inverse\` | ${c["primary-inverse"]} | warm cream on dark |
| Stone | \`secondary\` | ${c.secondary} | warm gray for secondary text |
| Stone inverse | \`secondary-inverse\` | ${c["secondary-inverse"]} | dark-mode secondary |
| **Accent green** | \`tertiary\` | ${c.tertiary} | bright PWA accent — **the codebase \`--color-primary\` resolves to this** |
| Accent on-bg | \`on-tertiary\` | ${c["on-tertiary"]} | readable text on bright green |
| Accent action | \`tertiary-action\` | ${c["tertiary-action"]} | filled button green (contrast-safe) |
| Accent action hover | \`tertiary-action-hover\` | ${c["tertiary-action-hover"]} | hover state |
| Accent action text | \`on-tertiary-action\` | ${c["on-tertiary-action"]} | white text on filled green |
| Warning | \`amber\` | ${c.amber} | flagged work, alerts |
| Info | \`sky\` | ${c.sky} | informational accents |

**Vital naming gotcha**: The codebase token \`--color-primary\` resolves to the **green accent** (DesignMD \`tertiary\` role), NOT the DesignMD \`primary\` (ink). Don't rename it.

### Typography (admin dialect = Plus Jakarta Sans)

| Token | Family | Size / Line | Weight |
|-------|--------|-------------|--------|
| body-md | Plus Jakarta Sans | 16 / 24 | 400 |
| label-md | Plus Jakarta Sans | 12 / 16 | 500 |
| app-title | Plus Jakarta Sans | 22 / 28 | 600 |

No serif faces in admin. (The client PWA uses Inter; the docs surface uses Fraunces. Admin stays sans.)

### Spacing (semantic)

| Token | Value |
|-------|-------|
| sm | 8px |
| md | 16px |
| lg | 24px |

### Radius

| Token | Value |
|-------|-------|
| md | 8px |
| lg | 16px |
| xl | 20px |
| 2xl | 24px |
| full | 9999px |

### M3 control sizes (pick ONE per variation as default)

| Size | Height | Use for |
|------|--------|---------|
| Small | 40px | Compact toolbars, dense lists |
| Medium | 48px | Default for most variations |
| Large | 56px | Spacious / hero variations |
`;
}

const sessions = [
  {
    num: "01",
    view: "HUB",
    file: "01-HUB.md",
    routeShort: "/hub",
    routeName: "Hub",
    bucket: "hub",
    routeBlurb: "operator pipeline (Review → Assess → Certify → History)",
  },
  {
    num: "02",
    view: "GARDEN",
    file: "02-GARDEN.md",
    routeShort: "/garden",
    routeName: "Garden",
    bucket: "garden",
    routeBlurb: "single-garden management (Overview / Members / Settings / Hypercerts / Yield)",
  },
  {
    num: "03",
    view: "COMMUNITY",
    file: "03-COMMUNITY.md",
    routeShort: "/community",
    routeName: "Community",
    bucket: "community",
    routeBlurb: "roster of operator-managed gardens",
  },
  {
    num: "04",
    view: "ACTIONS",
    file: "04-ACTIONS.md",
    routeShort: "/actions",
    routeName: "Actions",
    bucket: "actions",
    routeBlurb: "action template catalog and per-garden configuration",
  },
];

const systemBody = readPrompt("00-SYSTEM.md");
const tokensInline = tokenBlock();

for (const s of sessions) {
  const viewBody = readPrompt(s.file);
  const sessionMessage = `# Paste-ready Claude Design session — ${s.routeShort} (${s.routeName})

> **How to use this file**: select all (\`Cmd+A\`), copy, paste into a fresh claude.ai/design chat as the first message. Then attach the images listed under "Attach these images" below. The whole prompt is self-contained — you do not need to attach the design system markdown files; the relevant content is inlined.

---

## Attach these images (in this chat)

**Required**:
1. \`reference-image.png\` — the validated north-star direction (see § "Reference image — north star" below).

**Strongly recommended** (current admin state for ${s.routeShort}):
2. \`screenshots/${s.bucket}/light/Admin_Workspaces_${s.routeName}/[any].png\` — current ${s.routeShort} route in light theme.
3. \`screenshots/${s.bucket}/dark/Admin_Workspaces_${s.routeName}/[any].png\` — current ${s.routeShort} route in dark theme.

**Useful chrome reference** (composition cues for the floating shell):
4. \`screenshots/shell/light/Shared_Canvas_AppBar/[any].png\` — top chrome composition.
5. \`screenshots/shell/light/Shared_Canvas_NavigationBar/[any].png\` — floating bottom NavigationBar.

**Optional supplementary** (attach if Claude Design's image limit allows):
6. \`screenshots/primitives/light/Admin_Primitives_AdminCard/[any].png\` — current card primitive baseline.
7. \`screenshots/primitives/light/Admin_Primitives_AdminTabRail/[any].png\` — current tab rail baseline.
8. \`screenshots/tokens/light/Shared_Tokens_Colors/[any].png\` — color token surface.

---

## Session brief — what I want from you

You are designing **${s.routeShort}** — the ${s.routeBlurb} — for the Green Goods admin cockpit.

Produce **2 direction variations** for this route, each with light + dark renders, a dark-mode contrast table, and a 200–300 word rationale. Honor the system context (below) and the per-view prompt (further below). The reference image is a validated north-star direction — match or exceed it. Do not propose new routes, components, or vocabulary.

---

${systemBody}

---

${viewBody}

---

${tokensInline}

---

## End of message

Reply with **2 direction variations** for ${s.routeShort} per the output format in § 6 of the system context above. Show your work: light + dark renders, dark contrast table with WCAG ratios, composition note listing \`Admin*\` primitives + Canvas shells used, and a pixel-area budget check confirming the tertiary accent occupies ≤ 3% of the rendered route.
`;

  const outPath = resolve(destDir, `SESSION-${s.num}-${s.view}.md`);
  writeFileSync(outPath, sessionMessage, "utf8");
  console.log(
    `→ ${outPath.replace(repoRoot + "/", "")}  (${(sessionMessage.length / 1024).toFixed(1)} KB, ${sessionMessage.split(/\s+/).length} words)`,
  );
}

console.log(`\nDone. ${sessions.length} session messages built in ${destDir}`);
