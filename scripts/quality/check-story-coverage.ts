/**
 * Story Coverage Checker
 *
 * Walks required surfaces and fails if a visual component is missing a sibling
 * .stories.tsx file:
 *
 *   1. `packages/shared/src/components/**` — shared UI primitives and canvas
 *      pieces. Type-only files and the `NON_VISUAL_SHARED_COMPONENTS` set
 *      are excluded.
 *
 *   2. `packages/admin/src/components/**` + `packages/admin/src/views/**`
 *      — admin `Admin*` primitives, the canvas shell, and all workflow
 *      components. Every admin `.tsx` under those trees defaults to
 *      "needs a story"; add paths to `NON_VISUAL_ADMIN_COMPONENTS` /
 *      `NON_VISUAL_ADMIN_VIEWS` with an inline comment explaining *why*
 *      a file is excluded (helpers, hooks, route-level glue with no
 *      reviewable "state catalog" of its own, etc.).
 *
 *   3. Curated client dialect surfaces — PWA chrome/status and public browser
 *      chrome/route frames. Client still has legacy component stories outside
 *      this contract; the files in `REQUIRED_CLIENT_STORIES` are the protected
 *      design-system surfaces that must not regress silently.
 *
 * Skip rules (applied before exclusion sets):
 *   - `*.stories.tsx`, `*.test.tsx(.tsx)`, `*.service.tsx` — not components.
 *   - Type-only files (files that export only `type` / `interface` /
 *     type re-exports, no runtime JSX).
 *   - `index.tsx` files that are true barrels (only `export` re-exports,
 *     no JSX). Visual `index.tsx` files — where the file itself defines
 *     a component — ARE enforced and need a sibling story.
 *
 * Chain-scoped query-key note: if a story seeds the React Query cache
 * against a chain-scoped key, use `DEFAULT_CHAIN_ID` from
 * `@green-goods/shared` — never a literal chain id. Build-time
 * `VITE_CHAIN_ID` varies per environment, and a literal seed silently
 * mismatches the component's `useCurrentChain()` read.
 *
 * Usage: bun run scripts/check-story-coverage.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { Glob } from "bun";

const COMPONENTS_DIR = join(
  import.meta.dir,
  "..",
  "packages",
  "shared",
  "src",
  "components",
);

const ADMIN_COMPONENTS_DIR = join(
  import.meta.dir,
  "..",
  "packages",
  "admin",
  "src",
  "components",
);

const ADMIN_VIEWS_DIR = join(
  import.meta.dir,
  "..",
  "packages",
  "admin",
  "src",
  "views",
);

const CLIENT_SRC_DIR = join(import.meta.dir, "..", "packages", "client", "src");

const REQUIRED_CLIENT_STORIES = [
  {
    path: "components/Layout/AppBar.stories.tsx",
    reason: "installed-PWA bottom navigation",
  },
  {
    path: "components/Communication/Offline/OfflineIndicator.stories.tsx",
    reason: "PWA online/offline/install status material",
  },
  {
    path: "components/Navigation/SiteHeader.stories.tsx",
    reason: "public browser header and mobile drawer",
  },
  {
    path: "views/PwaProtectedSurfaces.stories.tsx",
    reason: "protected PWA route shell catalog",
  },
  {
    path: "views/PublicBrowserSurfaces.stories.tsx",
    reason: "public browser route shell catalog",
  },
] as const;

/**
 * Admin files that intentionally do NOT require a sibling story.
 * Every entry should explain *why* — this is the audit trail for the
 * admin coverage contract.
 */
const NON_VISUAL_ADMIN_COMPONENTS = new Set<string>([
  // Internal helpers for the Assessment wizard step set (LabeledField,
  // Section, DOMAIN_GUIDANCE, etc.). Rendered through the step stories.
  "components/Assessment/CreateAssessmentSteps/shared.tsx",

  // Internal types module for HypercertWizard — exports only types and
  // a `HypercertWizardProps` interface. No runtime UI.
  "components/Hypercerts/HypercertWizard/types.ts",

  // Hook module that powers HypercertWizard — no JSX.
  "components/Hypercerts/HypercertWizard/useWizardData.ts",
]);

/**
 * Admin view files that intentionally do NOT require a sibling story.
 * Views are route-level surfaces; we prefer smaller workflow stories for
 * the components they compose. Entries here are route shells, helper
 * modules, and non-visual descriptors — NOT exported visual components
 * like `CommunityTab`, `ImpactTab`, `OverviewTab`, `ReviewForm`, or
 * `SubmissionDetails`, which each get their own story.
 */
const NON_VISUAL_ADMIN_VIEWS = new Set<string>([
  // Route-level pages. Each page composes top-level providers, routing
  // params, and workflow components. They are reviewed through their
  // composed children — we do not render a whole route inside a single
  // story.
  "Actions/ActionDetail.tsx",
  "Actions/CreateAction.tsx",
  "Actions/EditAction.tsx",
  "Actions/GreenWillPanel.tsx",
  "Actions/index.tsx",
  "Community/index.tsx",
  "Garden/Assessment.tsx",
  "Garden/CreateGarden.tsx",
  "Garden/HypercertDetail.tsx",
  "Garden/SignalPool.tsx",
  "Garden/Strategies.tsx",
  "Garden/SubmitWork.tsx",
  "Garden/Vault.tsx",
  "Garden/WorkTab.tsx",
  "Garden/index.tsx",
  "Hub/CreateAssessment.tsx",
  "Hub/CreateHypercert.tsx",
  "Hub/index.tsx",
  "NotFound.tsx",
  "Profile/index.tsx",

  // WorkDetail route shell. Exports `WorkDetailPanel` but is essentially
  // a router+auth+store composition around `ReviewForm` and
  // `SubmissionDetails` (both of which have dedicated stories).
  "Garden/WorkDetail/index.tsx",

  // Pure helpers — small visual primitives (`DetailRow`, `ReviewSummary`,
  // `TabBadge`, `SectionStateCard`, `GardenHeroBanner`, etc.) plus
  // non-visual utilities (zod schemas, parsers). Reviewed implicitly
  // through the tab stories that consume them.
  "Garden/components/GardenDetailHelpers.tsx",
  "Garden/WorkDetail/helpers.tsx",

  // Non-visual descriptor that calls `useLeftSheetConfig` and returns null
  // — it has no UI to review in Storybook.
  "Community/components/CommunitySheetDescriptor.tsx",
  "Garden/components/GardenSheetDescriptor.tsx",
  "Hub/components/HubSheetDescriptor.tsx",

  // Thin route/controller adapters. They switch between reusable shell states
  // and already-covered tab/queue stories, but do not own a distinct visual
  // contract worth snapshotting as another full composition layer.
  "Community/components/CommunityWorkspaceContent.tsx",
  "Garden/components/GardenWorkspaceContent.tsx",
  "Hub/components/HubStageContent.tsx",
]);

const NON_VISUAL_SHARED_COMPONENTS = new Set([
  "Canvas/LeftSheetContext.tsx",
]);

/**
 * Visual harness stories are useful, but they do not prove real-component
 * coverage. Entries here are audited harness-only exceptions that remain
 * intentionally excluded from the "real story" contract until those
 * components get provider seams that can be exercised deterministically.
 */
const AUDITED_HARNESS_ONLY_STORIES = new Map<string, string>([
  [
    "admin/components/Garden/GardenDomainEditor.tsx",
    "wallet-bound wagmi read/write hooks; visual dialog states are explicit fixtures",
  ],
  [
    "admin/components/Hypercerts/HypercertWizard/index.tsx",
    "full wizard depends on useWizardData, draft persistence, attestations, and mint mutations",
  ],
	  [
	    "admin/components/Vault/GardenSupporters.tsx",
	    "ranked supporter data terminates in wagmi contract reads that are not seedable in Storybook",
	  ],
  [
    "admin/components/Vault/ImpactFunders.tsx",
    "protocol-wide supporter data terminates in wagmi contract reads that are not seedable in Storybook",
  ],
  [
    "admin/components/Vault/PositionCard.tsx",
    "real card reads several vault, balance, and transaction hooks; visual state matrix is fixture-driven",
  ],
  [
    "admin/views/Hub/components/CookieJarDepositModal.tsx",
    "real modal reads wallet balances and garden cookie jars before mutating deposit flows",
  ],
  [
    "admin/views/Hub/components/CookieJarManageModal.tsx",
    "real modal wires cookie-jar reads plus pause, resume, edit, and emergency-withdraw mutations",
  ],
  [
    "admin/views/Hub/components/CookieJarPayoutPanel.tsx",
    "real panel is gated by garden cookie-jar wagmi reads",
  ],
  [
    "admin/views/Hub/components/CookieJarWithdrawModal.tsx",
    "real modal reads garden cookie jars and mutates withdraw flows through wagmi hooks",
  ],
]);

// Files to skip unconditionally — never represent a visual component.
const SKIP_PATTERNS = [
  /\.stories\.tsx$/, // story files themselves
  /\.test\.tsx?$/, // test files
  /\.service\.tsx?$/, // service files (e.g., toast.service.tsx)
];

/**
 * Check if a file only exports types/interfaces (no runtime code).
 */
function isTypeOnlyFile(filePath: string): boolean {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines, comments, imports
    if (
      !trimmed ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("import ")
    ) {
      continue;
    }

    // Type-only exports
    if (
      trimmed.startsWith("export type ") ||
      trimmed.startsWith("export interface ") ||
      trimmed.startsWith("type ") ||
      trimmed.startsWith("interface ")
    ) {
      continue;
    }

    // Re-exports of types
    if (trimmed.startsWith("export {") && trimmed.includes("type")) {
      continue;
    }

    // Any other export or statement means it has runtime code
    return false;
  }

  return true;
}

/**
 * Check if an `index.tsx` is a true barrel — only re-exports, no JSX.
 * Visual index files (e.g., `HypercertWizard/index.tsx`) are NOT barrels
 * and must have stories. A file counts as a barrel iff every non-comment,
 * non-import, non-blank line starts with `export ` and the file contains
 * no JSX return / `<Tag` construct.
 */
function isBarrelIndex(filePath: string): boolean {
  if (basename(filePath) !== "index.tsx" && basename(filePath) !== "index.ts") {
    return false;
  }
  const content = readFileSync(filePath, "utf-8");
  // Any JSX usage implies a component definition rather than a barrel.
  // Matching `<Foo` (capitalized tag) or `<>` fragment is a solid proxy.
  if (/<[A-Z][A-Za-z0-9]*[\s/>]/.test(content) || /<>\s/.test(content)) {
    return false;
  }
  const lines = content.split("\n");
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (
      !trimmed ||
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("*/") ||
      trimmed.startsWith("import ")
    ) {
      continue;
    }
    if (trimmed.startsWith("export ")) continue;
    // Any other runtime line means it's not a barrel.
    return false;
  }
  return true;
}

function extractMetaBlock(source: string): string {
  const metaIndex = source.search(/\bconst\s+meta\b/);
  if (metaIndex === -1) return "";

  const objectStart = source.indexOf("{", metaIndex);
  if (objectStart === -1) return "";

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
      if (depth === 0) return source.slice(objectStart, i + 1);
    }
  }

  return "";
}

function isVisualHarnessOnlyStory(filePath: string): boolean {
  const source = readFileSync(filePath, "utf-8");
  const meta = extractMetaBlock(source);
  if (!meta) return false;

  const metaTagsVisualHarness = /tags\s*:\s*\[[^\]]*["']visual-harness["'][^\]]*\]/.test(meta);
  const metaSaysNotReal =
    /not\s+the\s+real(?:\s+component|\s+[`"']?[A-Z][A-Za-z0-9_$]*)/i.test(meta);

  return metaTagsVisualHarness || metaSaysNotReal;
}

interface Target {
  cwd: string;
  relativePath: string;
  label: string;
}

async function collectShared(): Promise<Target[]> {
  const glob = new Glob("**/*.tsx");
  const out: Target[] = [];

  for await (const match of glob.scan({ cwd: COMPONENTS_DIR })) {
    const fileName = basename(match);
    if (SKIP_PATTERNS.some((p) => p.test(fileName))) continue;
    if (NON_VISUAL_SHARED_COMPONENTS.has(match)) continue;

    const fullPath = join(COMPONENTS_DIR, match);
    if (isTypeOnlyFile(fullPath)) continue;
    if (isBarrelIndex(fullPath)) continue;

    out.push({
      cwd: COMPONENTS_DIR,
      relativePath: match,
      label: `shared/${match}`,
    });
  }
  return out;
}

async function collectAdminComponents(): Promise<Target[]> {
  const glob = new Glob("**/*.{ts,tsx}");
  const out: Target[] = [];

  for await (const match of glob.scan({ cwd: ADMIN_COMPONENTS_DIR })) {
    const fileName = basename(match);
    if (SKIP_PATTERNS.some((p) => p.test(fileName))) continue;

    const normalized = `components/${match}`;
    if (NON_VISUAL_ADMIN_COMPONENTS.has(normalized)) continue;

    const fullPath = join(ADMIN_COMPONENTS_DIR, match);
    if (isTypeOnlyFile(fullPath)) continue;
    if (isBarrelIndex(fullPath)) continue;

    // Only .tsx files need stories; .ts files that slipped past the
    // type-only check are non-visual helpers.
    if (!fileName.endsWith(".tsx")) continue;

    out.push({
      cwd: ADMIN_COMPONENTS_DIR,
      relativePath: match,
      label: `admin/components/${match}`,
    });
  }
  return out;
}

async function collectAdminViews(): Promise<Target[]> {
  const glob = new Glob("**/*.tsx");
  const out: Target[] = [];

  for await (const match of glob.scan({ cwd: ADMIN_VIEWS_DIR })) {
    const fileName = basename(match);
    if (SKIP_PATTERNS.some((p) => p.test(fileName))) continue;
    if (NON_VISUAL_ADMIN_VIEWS.has(match)) continue;

    const fullPath = join(ADMIN_VIEWS_DIR, match);
    if (isTypeOnlyFile(fullPath)) continue;
    if (isBarrelIndex(fullPath)) continue;

    out.push({
      cwd: ADMIN_VIEWS_DIR,
      relativePath: match,
      label: `admin/views/${match}`,
    });
  }
  return out;
}

function verifyExclusionsExist() {
  const missing: string[] = [];
  for (const rel of NON_VISUAL_ADMIN_COMPONENTS) {
    const abs = join(ADMIN_COMPONENTS_DIR, "..", rel);
    if (!existsSync(abs)) missing.push(`admin/${rel}`);
  }
  for (const rel of NON_VISUAL_ADMIN_VIEWS) {
    const abs = join(ADMIN_VIEWS_DIR, rel);
    if (!existsSync(abs)) missing.push(`admin/views/${rel}`);
  }
  if (missing.length > 0) {
    console.error(
      "Exclusion list references files that no longer exist. Update the exclusion sets:",
    );
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(2);
  }
}

function verifyRequiredClientStories() {
  const missing: string[] = [];
  for (const story of REQUIRED_CLIENT_STORIES) {
    const abs = join(CLIENT_SRC_DIR, story.path);
    if (!existsSync(abs)) missing.push(`client/${story.path} — ${story.reason}`);
  }
  if (missing.length > 0) {
    console.error(
      "Required client design-system stories are missing. Add the story or update REQUIRED_CLIENT_STORIES with an audited reason:",
    );
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }
}

async function main() {
  verifyExclusionsExist();
  verifyRequiredClientStories();

  const targets: Target[] = [
    ...(await collectShared()),
    ...(await collectAdminComponents()),
    ...(await collectAdminViews()),
  ];
  targets.sort((a, b) => a.label.localeCompare(b.label));

  const covered: string[] = [];
  const uncovered: string[] = [];
  const harnessOnly: string[] = [];
  const auditedHarnessOnly: Array<{ label: string; reason: string }> = [];

  for (const target of targets) {
    const dir = dirname(target.relativePath);
    const fileName = basename(target.relativePath, ".tsx");

    // Candidate story paths. For visual `index.tsx` we also accept a
    // sibling named after the containing directory (e.g.
    // `VaultPositionCard/VaultPositionCard.stories.tsx`), which is a
    // long-standing convention in `shared/Cards/*`.
    const candidates = [join(dir, `${fileName}.stories.tsx`)];
    if (fileName === "index") {
      const dirName = basename(dir);
      if (dirName && dirName !== ".") {
        candidates.push(join(dir, `${dirName}.stories.tsx`));
      }
    }

    const storyPath =
      candidates.map((candidate) => join(target.cwd, candidate)).find((candidate) => existsSync(candidate)) ??
      null;

    if (storyPath === null) {
      uncovered.push(target.label);
      continue;
    }

    if (isVisualHarnessOnlyStory(storyPath)) {
      const reason = AUDITED_HARNESS_ONLY_STORIES.get(target.label);
      if (reason) {
        covered.push(target.label);
        auditedHarnessOnly.push({ label: target.label, reason });
      } else {
        harnessOnly.push(target.label);
      }
    } else {
      covered.push(target.label);
    }
  }

  const total = targets.length;
  const count = covered.length;
  const percentage = total > 0 ? Math.round((count / total) * 100) : 100;

  console.log("\n--- Required Storybook Contract ---\n");
  console.log(`${count}/${total} required Storybook surfaces have stories (${percentage}%)\n`);
  console.log("Client dialect stories:");
  for (const story of REQUIRED_CLIENT_STORIES) {
    console.log(`  + client/${story.path} — ${story.reason}`);
  }
  console.log();

  if (covered.length > 0) {
    console.log("Covered:");
    for (const f of covered) console.log(`  + ${f}`);
    console.log();
  }

  if (uncovered.length > 0) {
    console.log("Missing required stories:");
    for (const f of uncovered) console.log(`  - ${f}`);
    console.log();
  }

  if (harnessOnly.length > 0) {
    console.log("Harness-only stories cannot satisfy real-component coverage:");
    for (const f of harnessOnly) console.log(`  - ${f}`);
    console.log();
  }

  if (auditedHarnessOnly.length > 0) {
    console.log("Audited harness-only coverage exceptions:");
    for (const entry of auditedHarnessOnly) {
      console.log(`  ! ${entry.label} — ${entry.reason}`);
    }
    console.log();
  }

  if (uncovered.length > 0 || harnessOnly.length > 0) {
    console.log(
      `FAIL: ${uncovered.length + harnessOnly.length} required Storybook surface(s) missing real stories.\n`,
    );
    process.exit(1);
  }

  console.log("PASS: Required Storybook contract is satisfied.\n");
  process.exit(0);
}

main();
