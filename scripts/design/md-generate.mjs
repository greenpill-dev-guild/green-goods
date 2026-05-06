#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import process from "node:process";
import yaml from "js-yaml";

const REPO_ROOT = process.cwd();
const CHECK_MODE = process.argv.includes("--check");
const DESIGN_PATH = join(REPO_ROOT, "DESIGN.md");
const GENERATED_JSON_PATH = join(
  REPO_ROOT,
  "packages/shared/src/styles/design-md.generated.json",
);
const GENERATED_CSS_PATH = join(
  REPO_ROOT,
  "packages/shared/src/styles/design-md.generated.css",
);
const GENERATED_AUDIT_PATH = join(
  REPO_ROOT,
  "docs/docs/builders/packages/client-pwa-token-audit.generated.md",
);

const TOKEN_PATTERN =
  /\b(?:bg-primary(?:-[\w-]+)?|text-primary(?:-[\w-]+)?|border-primary(?:-[\w-]+)?|ring-primary(?:-[\w-]+)?|outline-primary(?:-[\w-]+)?|primary-base|primary-action(?:-[\w-]+)?|green-[0-9]{2,3}|emerald-[0-9]{2,3})\b/g;
const PWA_AUDIT_EXCLUDED_FILES = new Set([
  "packages/client/src/components/Layout/Hero.tsx",
  "packages/client/src/views/Landing/index.tsx",
]);
const BRIGHT_GREEN_BACKGROUND_PATTERN =
  /\b(?:bg-primary(?:-base)?|bg-green-(?:400|500|600)|bg-emerald-(?:400|500|600))\b/;
const APPROVED_BRIGHT_GREEN_FOREGROUND_PATTERN = /\btext-primary-accent-foreground\b/;
const UNAPPROVED_BRIGHT_GREEN_FOREGROUND_PATTERN =
  /\b(?:text-white|text-white-0|text-primary-foreground|text-neutral-0|text-static-white)\b/;

function readDesignFrontMatter() {
  const source = readFileSync(DESIGN_PATH, "utf8");
  const match = /^---\n([\s\S]*?)\n---/.exec(source);
  if (!match) {
    throw new Error("DESIGN.md must start with YAML front matter.");
  }
  return yaml.load(match[1]);
}

function hexToRgbTriplet(hex) {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
    throw new Error(`Expected 6-digit hex color, got ${hex}`);
  }
  return [0, 2, 4].map((offset) => parseInt(clean.slice(offset, offset + 2), 16)).join(" ");
}

function sortRecord(record) {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

function getExpectedTokenData(design) {
  const colors = sortRecord(design.colors ?? {});
  const rounded = sortRecord(design.rounded ?? {});
  const spacing = sortRecord(design.spacing ?? {});
  const typography = sortRecord(design.typography ?? {});

  return {
    source: "DESIGN.md",
    designMdVersion: design.version ?? "unknown",
    name: design.name ?? "Green Goods Design System",
    colors,
    rounded,
    spacing,
    typography,
    implementationAliases: [
      {
        designToken: "colors.tertiary",
        implementation:
          "--color-primary, --primary-base, bg-primary, text-primary, text-primary-base",
        purpose:
          "Protected PWA accent rhythm for active nav, icons, badges, progress, filters, and highlights.",
      },
      {
        designToken: "colors.on-tertiary",
        implementation: "--primary-accent-foreground, text-primary-accent-foreground",
        purpose:
          "Readable foreground for tiny text on bright tertiary accents; keeps the bright green background intact.",
      },
      {
        designToken: "colors.tertiary-action",
        implementation: "--primary-action, --color-primary-action, bg-primary-action",
        purpose: "Contrast-safe filled text actions.",
      },
      {
        designToken: "colors.tertiary-action-hover",
        implementation: "--primary-action-hover, bg-primary-action-hover",
        purpose: "Hover state for contrast-safe filled text actions.",
      },
      {
        designToken: "colors.on-tertiary-action",
        implementation:
          "--primary-action-foreground, --color-primary-action-foreground, text-primary-action-foreground",
        purpose: "Foreground for contrast-safe filled text actions.",
      },
      {
        designToken: "rounded.*",
        implementation: "--gg-radius-* only; no shared Tailwind rounded-* override",
        purpose: "Canonical radius outputs without changing existing client rounded utilities.",
      },
    ],
    pwaProtection: {
      primaryRole:
        "DesignMD colors.primary is ink/charcoal and must not be mapped to --color-primary.",
      tertiaryRole:
        "DesignMD colors.tertiary is the existing bright PWA green accent implementation.",
      actionRole:
        "DesignMD colors.tertiary-action is reserved for filled text actions that need white foreground contrast.",
      shellFreeze:
        "Token generation must not change AppShell height, bottom AppBar behavior, safe-area padding, or /garden and /work/:id AppBar hiding.",
    },
  };
}

function generateCss(design) {
  const colors = design.colors ?? {};
  const rounded = design.rounded ?? {};
  const spacing = design.spacing ?? {};
  const colorLines = Object.entries(sortRecord(colors)).map(
    ([name, value]) => `    --gg-design-${name}: ${hexToRgbTriplet(value)};`,
  );
  const roundedLines = Object.entries(sortRecord(rounded)).map(
    ([name, value]) => `    --gg-radius-${name}: ${value};`,
  );
  const spacingLines = Object.entries(sortRecord(spacing)).map(
    ([name, value]) => `    --gg-space-${name}: ${value};`,
  );

  return `/* AUTO-GENERATED by scripts/design/md-generate.mjs from DESIGN.md.
 * Do not edit directly. Run \`bun run design:generate\`.
 *
 * These outputs intentionally use the non-disruptive --gg-* namespace.
 * Do not map DesignMD colors.primary to --color-primary; in this codebase
 * --color-primary is the protected PWA tertiary accent alias.
 */

@layer theme {
  :root {
${colorLines.join("\n")}

${roundedLines.join("\n")}

${spacingLines.join("\n")}
  }
}
`;
}

function walkFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkFiles(fullPath));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function isPwaRuntimeFile(file) {
  const rel = relative(REPO_ROOT, file);
  if (!rel.startsWith("packages/client/src/")) return false;
  if (PWA_AUDIT_EXCLUDED_FILES.has(rel)) return false;
  if (rel.includes("/__tests__/")) return false;
	  if (rel.endsWith(".stories.tsx") || rel.endsWith(".test.tsx") || rel.endsWith(".test.ts")) {
	    return false;
	  }
	  if (rel.includes("/views/Landing/")) return false;
	  if (rel.includes("/views/Public/")) return false;
	  if (rel.includes("/routes/PublicShell.tsx")) return false;
	  if (rel.includes("/components/Navigation/SiteHeader.tsx")) return false;
	  return [".ts", ".tsx", ".css"].includes(extname(file));
	}

function classifyUsage({ file, line, token }) {
  const rel = relative(REPO_ROOT, file);
  const lowerLine = line.toLowerCase();
  const hasBrightGreenBackground = BRIGHT_GREEN_BACKGROUND_PATTERN.test(line);
  if (hasBrightGreenBackground && UNAPPROVED_BRIGHT_GREEN_FOREGROUND_PATTERN.test(line)) {
    return "contrast-risk";
  }
  if (hasBrightGreenBackground && APPROVED_BRIGHT_GREEN_FOREGROUND_PATTERN.test(line)) {
    return "contrast-exception";
  }
  if (token.includes("primary-action")) return "action";
  if (/(focus|ring|border|outline|active|selected|data-state|aria-selected)/.test(lowerLine)) {
    return "state";
  }
  if (/(badge|count|tab|progress|icon|indicator|highlight|accent|ri[A-Z])/i.test(line)) {
    return "accent";
  }
  if (rel.includes("/Dialogs/") || rel.includes("/Features/Garden/Work.tsx")) return "action";
  return "accent";
}

function auditPwaTokenUsage() {
  const clientSrc = join(REPO_ROOT, "packages/client/src");
  const rows = [];
  for (const file of walkFiles(clientSrc).filter(isPwaRuntimeFile)) {
    const source = readFileSync(file, "utf8");
    source.split("\n").forEach((line, index) => {
      const tokens = [...new Set([...line.matchAll(TOKEN_PATTERN)].map((match) => match[0]))];
      for (const token of tokens) {
        rows.push({
          file,
          lineNumber: index + 1,
          token,
          line: line.trim(),
          classification: classifyUsage({ file, line, token }),
        });
      }
    });
  }
  rows.sort((a, b) => {
    const fileCompare = relative(REPO_ROOT, a.file).localeCompare(relative(REPO_ROOT, b.file));
    if (fileCompare !== 0) return fileCompare;
    return a.lineNumber - b.lineNumber || a.token.localeCompare(b.token);
  });
  return rows;
}

function escapeMdxTableCode(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("|", "\\|")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("`", "&#96;")
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;");
}

function generateAuditMarkdown(rows) {
  const counts = rows.reduce((acc, row) => {
    acc[row.classification] = (acc[row.classification] ?? 0) + 1;
    return acc;
  }, {});
  const countLine = ["accent", "action", "state", "contrast-exception", "contrast-risk"]
    .map((key) => `${key}: ${counts[key] ?? 0}`)
    .join(", ");
  const contrastRiskRows = rows.filter((row) => row.classification === "contrast-risk");
  const riskLine =
    contrastRiskRows.length > 0
      ? `Unapproved bright-green text-bearing combinations: ${contrastRiskRows.length}.`
      : "Unapproved bright-green text-bearing combinations: 0.";
  const table = rows
    .map((row) => {
      const rel = relative(REPO_ROOT, row.file);
      return `| \`${rel}:${row.lineNumber}\` | \`${row.token}\` | ${row.classification} | <code>${escapeMdxTableCode(row.line)}</code> |`;
    })
    .join("\n");

  return `---
title: Client PWA Token Usage Audit
sidebar_label: Client PWA Token Audit
slug: /builders/packages/client-pwa-token-audit.generated
unlisted: true
audience: developer
owner: docs
last_verified: 2026-04-25
feature_status: Planned
source_of_truth:
  - scripts/design/md-generate.mjs
---

<!-- AUTO-GENERATED by scripts/design/md-generate.mjs from packages/client/src. -->
# Client PWA Token Usage Audit

Scope: installed-PWA runtime files in \`packages/client/src\`. Public browser routes, stories, and tests are excluded so the freeze audit stays focused on the protected app surface.

Summary: ${rows.length} token references (${countLine}).

${riskLine}

Classification rules:
- \`accent\`: bright tertiary green should stay visually bright.
- \`action\`: filled text actions should use \`primary-action\` aliases.
- \`state\`: focus, border, selected, or active state usage.
- \`contrast-exception\`: approved tiny text on bright green using \`text-primary-accent-foreground\`.
- \`contrast-risk\`: unapproved white/light foreground currently placed directly on a bright green surface.

Approved contrast exceptions:
- Tiny count badges keep bright \`bg-primary\` / \`bg-primary-base\` backgrounds but use \`text-primary-accent-foreground\`.
- Selected chips keep bright \`bg-primary-base\` backgrounds but use \`text-primary-accent-foreground\`.
- The back-online bar keeps a bright green material background but uses \`text-primary-accent-foreground\`.

| Location | Token | Classification | Source Line |
|---|---:|---|---|
${table}
`;
}

function writeOrCheck(filePath, expected) {
  const current = existsSync(filePath) ? readFileSync(filePath, "utf8") : null;
  if (current === expected) return false;
  if (CHECK_MODE) {
    console.error(`DesignMD generated artifact is stale: ${relative(REPO_ROOT, filePath)}`);
    return true;
  }
  writeFileSync(filePath, expected);
  return true;
}

const design = readDesignFrontMatter();
const generatedJson = `${JSON.stringify(getExpectedTokenData(design), null, 2)}\n`;
const generatedCss = generateCss(design);
const pwaAuditRows = auditPwaTokenUsage();
const generatedAudit = generateAuditMarkdown(pwaAuditRows);
const contrastRisks = pwaAuditRows.filter((row) => row.classification === "contrast-risk");

const changed = [
  writeOrCheck(GENERATED_JSON_PATH, generatedJson),
  writeOrCheck(GENERATED_CSS_PATH, generatedCss),
  writeOrCheck(GENERATED_AUDIT_PATH, generatedAudit),
].some(Boolean);

if (contrastRisks.length > 0) {
  console.error(
    `PWA token audit found ${contrastRisks.length} unapproved bright-green text-bearing combination(s):`
  );
  for (const row of contrastRisks.slice(0, 20)) {
    console.error(
      `- ${relative(REPO_ROOT, row.file)}:${row.lineNumber} ${row.token} ${row.line}`
    );
  }
  if (contrastRisks.length > 20) {
    console.error(`...and ${contrastRisks.length - 20} more.`);
  }
  if (CHECK_MODE) {
    process.exit(1);
  }
}

if (CHECK_MODE && changed) {
  console.error("Run `bun run design:generate` and commit the updated generated artifacts.");
  process.exit(1);
}

if (!CHECK_MODE) {
  console.log(
    `Generated ${relative(REPO_ROOT, GENERATED_JSON_PATH)}, ${relative(
      REPO_ROOT,
      GENERATED_CSS_PATH,
    )}, and ${relative(REPO_ROOT, GENERATED_AUDIT_PATH)}.`,
  );
}
