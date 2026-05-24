/**
 * Story Quality Checker
 *
 * Keeps the design-system Storybook surface deterministic and agent-readable without
 * turning coverage into a broad visual-audit pass. Scope is intentionally
 * narrow: admin stories, shared Canvas stories consumed by admin shell work,
 * token contract stories, and curated client PWA/public shell stories.
 *
 * Usage: bun run scripts/quality/check-story-quality.ts
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Glob } from "bun";

const REPO_ROOT = join(import.meta.dir, "..", "..");

const TARGET_GLOBS = [
  "packages/admin/src/**/*.stories.tsx",
  "packages/shared/src/components/Canvas/**/*.stories.tsx",
] as const;

const TARGET_FILES = [
  "packages/shared/src/components/Cards/WorkCard/WorkCard.stories.tsx",
  "packages/shared/src/components/Display/ImageWithFallback.stories.tsx",
  "packages/shared/src/components/Dialog/ConfirmDialog.stories.tsx",
  "packages/shared/src/components/Dialog/ImagePreviewDialog.stories.tsx",
  "packages/shared/src/components/Dialog/PwaSheet.stories.tsx",
  "packages/shared/src/components/Tokens/Animations.stories.tsx",
  "packages/shared/src/components/Vault/AssetSelector.stories.tsx",
  "packages/client/src/components/Layout/AppBar.stories.tsx",
  "packages/client/src/components/Communication/Offline/OfflineIndicator.stories.tsx",
  "packages/client/src/components/Dialogs/ModalDrawer.stories.tsx",
  "packages/client/src/components/Navigation/SiteHeader.stories.tsx",
  "packages/client/src/views/PwaProtectedSurfaces.stories.tsx",
  "packages/client/src/views/PublicBrowserSurfaces.stories.tsx",
] as const;

interface Finding {
  file: string;
  line: number;
  rule: string;
  message: string;
}

function lineForIndex(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function hasNearbyAllowComment(source: string, index: number, token: string): boolean {
  const start = Math.max(0, index - 400);
  const nearby = source.slice(start, index);
  return new RegExp(`storybook-quality-allow\\s+${token}`, "i").test(nearby);
}

function hasVisualHarnessTag(source: string): boolean {
  return /tags\s*:\s*\[[^\]]*["']visual-harness["'][^\]]*\]/.test(source);
}

function isHarnessName(name: string): boolean {
  return name.endsWith("Harness");
}

function isMockName(name: string): boolean {
  return /^Mock[A-Z0-9_]/.test(name);
}

function extractObjectBlock(
  source: string,
  objectStart: number,
): { block: string; start: number; end: number } | null {
  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = objectStart; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    const prev = source[i - 1];

    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (quote) {
      if (char === quote && prev !== "\\") quote = null;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          block: source.slice(objectStart, i + 1),
          start: objectStart,
          end: i + 1,
        };
      }
    }
  }

  return null;
}

function extractMetaBlock(source: string): { block: string; start: number; end: number } | null {
  const metaIndex = source.search(/\bconst\s+meta\b/);
  if (metaIndex === -1) return null;

  const objectStart = source.indexOf("{", metaIndex);
  if (objectStart === -1) return null;

  return extractObjectBlock(source, objectStart);
}

function extractStoryBlocks(source: string): Array<{ name: string; block: string; start: number }> {
  const matches = [...source.matchAll(/export\s+const\s+([A-Z][A-Za-z0-9_]*)\b/g)];
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const nextStart = matches[index + 1]?.index ?? source.length;
    return {
      name: match[1],
      block: source.slice(start, nextStart),
      start,
    };
  });
}

function metaComponentName(metaBlock: string): string | null {
  return /component\s*:\s*([A-Za-z_$][A-Za-z0-9_$]*)/.exec(metaBlock)?.[1] ?? null;
}

function hasNotRealComponentText(source: string): boolean {
  return /not\s+the\s+real(?:\s+component|\s+[`"']?[A-Z][A-Za-z0-9_$]*)/i.test(source);
}

function addLiteralFindings(
  findings: Finding[],
  file: string,
  source: string,
  pattern: RegExp,
  rule: string,
  message: string,
): void {
  for (const match of source.matchAll(pattern)) {
    findings.push({
      file,
      line: lineForIndex(source, match.index ?? 0),
      rule,
      message,
    });
  }
}

function checkFile(file: string, source: string): Finding[] {
  const findings: Finding[] = [];
  const meta = extractMetaBlock(source);
  const metaSource = meta?.block ?? "";
  const metaIsVisualHarness = hasVisualHarnessTag(metaSource);
  const componentName = metaComponentName(metaSource);

  addLiteralFindings(
    findings,
    file,
    source,
    /picsum\.photos/g,
    "deterministic-media",
    "Use deterministic Storybook fixture media instead of picsum.photos.",
  );

  addLiteralFindings(
    findings,
    file,
    source,
    /ipfs:\/\/(?:(?:Qm[A-Za-z0-9]*Example)|(?:bafy[a-z0-9]*example)|(?:[^"'`\s]*placeholder[^"'`\s]*)|(?:[^"'`\s]*mock[^"'`\s]*)|(?:[^"'`\s]*test[^"'`\s]*))/gi,
    "placeholder-ipfs",
    "Use deterministic fixture data instead of placeholder IPFS URIs.",
  );

  addLiteralFindings(
    findings,
    file,
    source,
    /Date\s*\.\s*now\s*\(/g,
    "frozen-clock",
    "Use STORYBOOK_NOW_SECONDS, hoursAgo, daysAgo, or daysFromNow instead of Date.now().",
  );

  addLiteralFindings(
    findings,
    file,
    source,
    /new\s+Date\s*\(\s*\)/g,
    "frozen-clock",
    "Use the frozen Storybook fixture clock instead of zero-argument new Date().",
  );

  if (meta) {
    if (componentName && isMockName(componentName) && !metaIsVisualHarness) {
      findings.push({
        file,
        line: lineForIndex(source, meta.start + metaSource.indexOf(componentName)),
        rule: "mock-meta-component",
        message:
          "Default meta.component should point at the real component; tag visual harness files with visual-harness.",
      });
    }

    if (
      componentName &&
      isHarnessName(componentName) &&
      !metaIsVisualHarness &&
      !hasNearbyAllowComment(source, meta.start + metaSource.indexOf(componentName), "state-harness")
    ) {
      findings.push({
        file,
        line: lineForIndex(source, meta.start + metaSource.indexOf(componentName)),
        rule: "harness-meta-component",
        message:
          "Default meta.component should not point at a *Harness wrapper unless the file is tagged visual-harness or has a nearby storybook-quality-allow state-harness comment for a real provider/state wrapper.",
      });
    }

    if (hasNotRealComponentText(metaSource) && !metaIsVisualHarness) {
      findings.push({
        file,
        line: lineForIndex(source, meta.start),
        rule: "visual-harness-tag",
        message:
          'Stories whose docs say they are not the real component must be tagged "visual-harness".',
      });
    }
  }

  for (const story of extractStoryBlocks(source)) {
    const storyIsVisualHarness = hasVisualHarnessTag(story.block);

    if (hasNotRealComponentText(story.block) && !metaIsVisualHarness && !storyIsVisualHarness) {
      findings.push({
        file,
        line: lineForIndex(source, story.start),
        rule: "visual-harness-tag",
        message:
          'Stories whose docs say they are not the real component must be tagged "visual-harness".',
      });
    }

    for (const renderMatch of story.block.matchAll(/<([A-Z][A-Za-z0-9_$]*(?:Mock|Harness))[\s/>]/g)) {
      const index = story.start + (renderMatch.index ?? 0);
      const name = renderMatch[1];
      if (
        (isHarnessName(name) || isMockName(name)) &&
        !metaIsVisualHarness &&
        !storyIsVisualHarness &&
        !hasNearbyAllowComment(source, index, "state-harness")
      ) {
        findings.push({
          file,
          line: lineForIndex(source, index),
          rule: "harness-render",
          message:
            "Stories should render the real component by default; tag visual harness stories with visual-harness or add a nearby storybook-quality-allow state-harness comment for a real provider/state wrapper.",
        });
      }
    }

    if (!/DarkMode/.test(story.name)) continue;
    const index = story.start;
    if (hasNearbyAllowComment(source, index, "dark-mode")) continue;
    findings.push({
      file,
      line: lineForIndex(source, index),
      rule: "dark-mode-duplicate",
      message:
        "Use the Storybook theme toolbar instead of DarkMode story exports, or add a nearby storybook-quality-allow dark-mode comment explaining the distinct behavior.",
    });
  }

  for (const story of extractStoryBlocks(source)) {
    if (story.name !== "Gallery") continue;
    const index = story.start;
    if (hasNearbyAllowComment(source, index, "gallery")) continue;
    findings.push({
      file,
      line: lineForIndex(source, index),
      rule: "generic-gallery",
      message:
        "Prefer StateCatalog for state matrices. Axis catalogs like VariantGallery and SizeGallery are allowed.",
    });
  }

  return findings;
}

async function collectStoryFiles(): Promise<string[]> {
  const files = new Set<string>();

  for (const pattern of TARGET_GLOBS) {
    const glob = new Glob(pattern);
    for await (const match of glob.scan({ cwd: REPO_ROOT })) {
      files.add(match);
    }
  }

  for (const file of TARGET_FILES) {
    if (existsSync(join(REPO_ROOT, file))) {
      files.add(file);
    }
  }

  return [...files].sort((a, b) => a.localeCompare(b));
}

async function main() {
  const files = await collectStoryFiles();
  const findings = files.flatMap((file) =>
    checkFile(file, readFileSync(join(REPO_ROOT, file), "utf8")),
  );

  console.log("\n--- Storybook Story Quality (design-system stories) ---\n");
  console.log(`Checked ${files.length} story file(s).\n`);

  if (findings.length > 0) {
    console.error("Story quality issues:");
    for (const finding of findings) {
      console.error(
        `  - ${finding.file}:${finding.line} [${finding.rule}] ${finding.message}`,
      );
    }
    console.error(`\nFAIL: ${findings.length} story quality issue(s) found.\n`);
    process.exit(1);
  }

  console.log("PASS: Story quality guardrails are satisfied.\n");
}

main();
