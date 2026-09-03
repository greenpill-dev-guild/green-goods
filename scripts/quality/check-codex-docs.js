#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const failures = [];

function fail(message) {
  failures.push(message);
}

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.join(repoRoot, relPath));
}

function parseJson(relPath) {
  return JSON.parse(read(relPath));
}

function getSection(markdown, heading) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^#{2,6}\\s+${escapedHeading}\\n([\\s\\S]*?)(?=^#{2,6}\\s+|\\Z)`, "m");
  const match = markdown.match(regex);
  return match?.[1] ?? "";
}

function extractCodeLiterals(text) {
  return Array.from(text.matchAll(/`([^`]+)`/g), (match) => match[1]);
}

function extractBulletCommands(markdown, heading) {
  return extractCodeLiterals(getSection(markdown, heading)).filter((value) => value.includes(" "));
}

function stripEnvAssignments(command) {
  let remaining = command.trim();
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(remaining)) {
    const parts = remaining.split(/\s+/, 2);
    remaining = remaining.slice(parts[0].length).trimStart();
  }
  return remaining;
}

function splitCommandChain(command) {
  return command
    .split(/\s*&&\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function validateCommand(command, scripts, relBaseDir, label) {
  for (const segment of splitCommandChain(command)) {
    const stripped = stripEnvAssignments(segment);
    if (!stripped) continue;

    if (stripped.startsWith("bun run ")) {
      const scriptName = stripped.slice("bun run ".length).split(/\s+/)[0];
      if (!scripts[scriptName]) {
        fail(`${label}: missing package script "${scriptName}" for command \`${segment}\``);
      }
      continue;
    }

    if (stripped.startsWith("bun ")) {
      const scriptName = stripped.slice("bun ".length).split(/\s+/)[0];
      if (!scripts[scriptName]) {
        fail(`${label}: missing package script "${scriptName}" for command \`${segment}\``);
      }
      continue;
    }

    if (stripped.startsWith("node ") || stripped.startsWith("bash ")) {
      const scriptPath = stripped.split(/\s+/)[1];
      const candidate = path.resolve(repoRoot, relBaseDir, scriptPath);
      if (!fs.existsSync(candidate)) {
        fail(`${label}: referenced file does not exist for command \`${segment}\` -> ${scriptPath}`);
      }
      continue;
    }

    fail(`${label}: unsupported command form \`${segment}\``);
  }
}

function policyBlocks(markdown, minWords) {
  const blocks = [];
  const lines = markdown.split(/\r?\n/);
  let buffer = [];
  let startLine = 0;
  let inFence = false;

  function flush() {
    if (buffer.length === 0) return;
    const raw = buffer.join(" ").trim();
    const normalized = raw
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[`*_>#~-]/g, " ")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const words = normalized.split(" ").filter(Boolean);
    if (words.length >= minWords) {
      blocks.push({
        line: startLine,
        raw,
        words,
        wordSet: new Set(words),
      });
    }
    buffer = [];
    startLine = 0;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      flush();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (!trimmed || /^#{1,6}\s/.test(trimmed) || trimmed.startsWith("|")) {
      flush();
      continue;
    }
    if (buffer.length === 0) startLine = index + 1;
    buffer.push(trimmed);
  }
  flush();
  return blocks;
}

export function findNearDuplicatePolicyBlocks(leftMarkdown, rightMarkdown, options = {}) {
  const minWords = options.minWords ?? 30;
  const minimumSimilarity = options.minimumSimilarity ?? 0.82;
  const leftBlocks = policyBlocks(leftMarkdown, minWords);
  const rightBlocks = policyBlocks(rightMarkdown, minWords);
  const matches = [];

  for (const left of leftBlocks) {
    for (const right of rightBlocks) {
      const lengthRatio = Math.min(left.words.length, right.words.length) /
        Math.max(left.words.length, right.words.length);
      if (lengthRatio < 0.65) continue;
      const smallerSet = left.wordSet.size <= right.wordSet.size ? left.wordSet : right.wordSet;
      const largerSet = smallerSet === left.wordSet ? right.wordSet : left.wordSet;
      let sharedWords = 0;
      for (const word of smallerSet) {
        if (largerSet.has(word)) sharedWords += 1;
      }
      const similarity = sharedWords / smallerSet.size;
      if (similarity < minimumSimilarity) continue;
      matches.push({
        leftLine: left.line,
        rightLine: right.line,
        similarity,
        leftExcerpt: left.raw.slice(0, 120),
        rightExcerpt: right.raw.slice(0, 120),
      });
    }
  }

  return matches;
}

function validateRootGuide() {
  const rootGuide = read("AGENTS.md");
  const rootScripts = parseJson("package.json").scripts ?? {};

  if (!rootGuide.includes(".claude/context/values.md#implementation-quality-contract")) {
    fail("AGENTS.md: missing canonical Implementation Quality Contract reference");
  }

  if (rootScripts["lint:rules"] !== "node scripts/quality/check-react-patterns.js") {
    fail("package.json: lint:rules must execute the high-confidence pattern gate directly");
  }
  if (!rootScripts.lint?.includes("bun run lint:rules")) {
    fail("package.json: root lint must include lint:rules");
  }

  const patternGate = read("scripts/quality/check-react-patterns.js");
  for (const marker of [
    "BLOCKING_RULES",
    "rule-11-undeclared-shared-import",
    "includeAdvisory: false",
    "Default lint ignores this file",
  ]) {
    if (!patternGate.includes(marker)) {
      fail(`scripts/quality/check-react-patterns.js: missing high-signal gate marker: ${marker}`);
    }
  }

  for (const relPath of [
    "packages/contracts/AGENTS.md",
    "packages/shared/AGENTS.md",
    "packages/client/AGENTS.md",
    "packages/admin/AGENTS.md",
    "packages/agent/AGENTS.md",
    "packages/indexer/AGENTS.md",
  ]) {
    if (!rootGuide.includes(`\`${relPath}\``)) {
      fail(`AGENTS.md: package guide list is missing ${relPath}`);
    }
  }

  for (const command of extractBulletCommands(rootGuide, "Common Commands")) {
    validateCommand(command, rootScripts, ".", "AGENTS.md");
  }

  const validationHeadings = Array.from(rootGuide.matchAll(/^## Validation(?:\s|$)/gm));
  if (validationHeadings.length !== 1) {
    fail(`AGENTS.md: expected one canonical Validation section, found ${validationHeadings.length}`);
  }

  for (const reference of [
    ".claude/context/validation-pipeline.md",
    ".claude/context/codebase-architecture.md",
    ".claude/context/task-routing.json",
  ]) {
    if (!rootGuide.includes(reference)) {
      fail(`AGENTS.md: missing canonical guidance reference ${reference}`);
    }
  }
}

function validateGuideDuplication() {
  const duplicates = findNearDuplicatePolicyBlocks(read("AGENTS.md"), read("CLAUDE.md"));
  for (const duplicate of duplicates) {
    fail(
      `AGENTS.md:${duplicate.leftLine} and CLAUDE.md:${duplicate.rightLine}: near-verbatim policy block ` +
        `(${Math.round(duplicate.similarity * 100)}% shared vocabulary); keep one canonical source`,
    );
  }
}

function validatePackageGuides() {
  const expectedPackages = ["admin", "agent", "client", "contracts", "indexer", "shared"];

  for (const packageName of expectedPackages) {
    const agentsRelPath = `packages/${packageName}/AGENTS.md`;
    const packageJsonRelPath = `packages/${packageName}/package.json`;

    if (!exists(agentsRelPath)) {
      fail(`Missing required package guide: ${agentsRelPath}`);
      continue;
    }

    const guide = read(agentsRelPath);
    const scripts = parseJson(packageJsonRelPath).scripts ?? {};
    const commands = extractBulletCommands(guide, "Commands");

    if (commands.length === 0) {
      fail(`${agentsRelPath}: missing executable commands in "## Commands" section`);
      continue;
    }

    for (const command of commands) {
      validateCommand(command, scripts, `packages/${packageName}`, agentsRelPath);
    }
  }

  const indexerTsconfig = read("packages/indexer/tsconfig.json");
  for (const marker of ['"strict": true', '"noImplicitAny": true']) {
    if (!indexerTsconfig.includes(marker)) {
      fail(`packages/indexer/tsconfig.json: strict handwritten TypeScript marker missing: ${marker}`);
    }
  }

  const indexerGuide = read("packages/indexer/AGENTS.md");
  for (const marker of ["`strict`", "`noImplicitAny`", "do not weaken compiler flags"]) {
    if (!indexerGuide.includes(marker)) {
      fail(`packages/indexer/AGENTS.md: missing strict TypeScript guidance: ${marker}`);
    }
  }
}

function validateCodexImplementationAgent() {
  // Committed agent definitions were retired with the lean-skills consolidation;
  // the Implementation Quality Contract obligation now lives in AGENTS.md § Agent Workflow.
  const guide = read("AGENTS.md");
  for (const marker of [
    "Implementation Quality Contract",
    ".claude/context/values.md#implementation-quality-contract",
  ]) {
    if (!guide.includes(marker)) {
      fail(`AGENTS.md: missing Implementation Quality Contract reference: ${marker}`);
    }
  }
}

function validateGuideTerms(relPath, requiredTerms) {
  const guide = read(relPath);

  for (const term of requiredTerms) {
    if (!guide.includes(term)) {
      fail(`${relPath}: missing required design-system reference ${term}`);
    }
  }
}

function validateGuideReferences() {
  const guideExpectations = [
    {
      relPath: "AGENTS.md",
      requiredTerms: [
        "packages/admin/DESIGN.md",
        "CanvasLayout",
        "DashboardLayout",
        "Sidebar",
        "Header",
      ],
    },
    {
      relPath: "packages/admin/AGENTS.md",
      requiredTerms: [
        "packages/admin/DESIGN.md",
        "CanvasLayout",
        "DashboardLayout",
        "Sidebar",
        "Header",
        "AppBar",
        "NavigationBar",
        "GardenChip",
        "MainSheet",
        "CommandPalette",
        "AccountSurface",
        "AccountSettingsPanel",
        "LeftSheet",
        "RightSheet",
        "BottomSheet",
        "PageHeader",
        "ListToolbar",
        "SortSelect",
        "Card",
        "Alert",
        "StatusBadge",
        "FormField",
        "DialogShell",
      ],
    },
    {
      relPath: "packages/shared/AGENTS.md",
      requiredTerms: [
        "packages/admin/DESIGN.md",
        "Storybook",
        "AppBar",
        "NavigationBar",
        "GardenChip",
        "MainSheet",
        "LeftSheet",
        "RightSheet",
        "BottomSheet",
        "Alert",
        "Card",
        "DialogShell",
        "FormField",
        "ListToolbar",
        "SortSelect",
        "StatusBadge",
      ],
    },
  ];

  for (const { relPath, requiredTerms } of guideExpectations) {
    validateGuideTerms(relPath, requiredTerms);
  }
}

function validateSkillMirrorSymlink() {
  const mirrorPath = path.join(repoRoot, ".agents/skills");
  let stat;
  try {
    stat = fs.lstatSync(mirrorPath);
  } catch {
    fail(".agents/skills: missing; expected a symlink to ../.claude/skills (Codex skill discovery depends on it)");
    return;
  }
  if (!stat.isSymbolicLink()) {
    fail(".agents/skills: must be a symlink to ../.claude/skills, not a real directory");
    return;
  }
  const target = fs.readlinkSync(mirrorPath);
  if (target !== "../.claude/skills") {
    fail(`.agents/skills: symlink target must be "../.claude/skills" (found "${target}")`);
  }
}

function validateRepoDerivedGuidanceFacts() {
  const agenticDocs = fs
    .readdirSync(path.join(repoRoot, "docs/docs/builders/agentic"))
    .filter((name) => name.endsWith(".mdx"))
    .map((name) => `docs/docs/builders/agentic/${name}`);
  for (const relPath of agenticDocs) {
    const doc = read(relPath);
    if (doc.includes(".claude/context/intent.md") || /(?:^|[^/])intent\.md\b/m.test(doc)) {
      fail(`${relPath}: references nonexistent intent.md; use product.md and values.md`);
    }
  }

  const contractsGuide = read("packages/contracts/AGENTS.md");
  for (const relPath of [
    "packages/contracts/src/modules/CommitmentPooling.sol",
    "packages/contracts/src/modules/SettlementModule.sol",
    "packages/contracts/src/registries/Credit.sol",
    "packages/contracts/src/registries/Deployment.sol",
  ]) {
    const packageRelative = relPath.replace("packages/contracts/", "");
    if (!exists(relPath) || !contractsGuide.includes(packageRelative)) {
      fail(`packages/contracts/AGENTS.md: architecture map must include existing ${packageRelative}`);
    }
  }
  if (contractsGuide.includes("src/DeploymentRegistry.sol")) {
    fail("packages/contracts/AGENTS.md: references nonexistent src/DeploymentRegistry.sol");
  }

  const hookFolders = fs
    .readdirSync(path.join(repoRoot, "packages/shared/src/hooks"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${entry.name}/`)
    .sort();
  const hookSection = getSection(read("packages/shared/src/MODULES.md"), "hooks/ -- React hooks");
  const documentedHookFolders = Array.from(
    hookSection.matchAll(/^\| `([^`]+\/)` \|/gm),
    (match) => match[1],
  ).sort();
  if (JSON.stringify(documentedHookFolders) !== JSON.stringify(hookFolders)) {
    fail(
      "packages/shared/src/MODULES.md: hook folder inventory drifted from packages/shared/src/hooks",
    );
  }

  const adminGuide = read("packages/admin/AGENTS.md");
  const adminVitest = read("packages/admin/vitest.config.ts");
  if (
    !adminVitest.includes('exclude: [\n      "**/node_modules/**"') ||
    /default admin Vitest run excludes `src\/__tests__\/views/.test(adminGuide)
  ) {
    fail("packages/admin/AGENTS.md: default Vitest discovery guidance drifted from vitest.config.ts");
  }

  const testsReadme = read("tests/README.md");
  for (const relPath of [
    "tests/fixtures/playwright-services.ts",
    "tests/fixtures/anvil-fork.ts",
    "tests/fixtures/contract-helpers.ts",
    "tests/helpers/test-utils.ts",
    "tests/helpers/test-config.ts",
    "tests/mocks/pimlico-handlers.ts",
    "scripts/dev/test-e2e.js",
  ]) {
    if (!exists(relPath) || !testsReadme.includes(relPath)) {
      fail(`tests/README.md: missing current E2E path ${relPath}`);
    }
  }
  for (const stalePath of [
    "tests/run-tests.ts",
    "docs/developer/getting-started.md",
    "docs/developer/cursor-workflows.md",
    ".github/workflows/e2e-tests.yml",
  ]) {
    if (testsReadme.includes(stalePath)) {
      fail(`tests/README.md: references removed path ${stalePath}`);
    }
  }

  const testingGuide = read("docs/docs/builders/testing/index.mdx");
  if (testingGuide.includes("npx playwright")) {
    fail("docs/docs/builders/testing/index.mdx: use the repo's Bun Playwright entrypoint");
  }
  if (/\bbun build:(?:fast|full|target)\b/.test(testingGuide)) {
    fail("docs/docs/builders/testing/index.mdx: package scripts require `bun run`");
  }
}

function run() {
  validateRootGuide();
  validateGuideDuplication();
  validatePackageGuides();
  validateGuideReferences();
  validateSkillMirrorSymlink();
  validateCodexImplementationAgent();
  validateRepoDerivedGuidanceFacts();

  if (failures.length > 0) {
    console.error("Codex consistency check failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Codex consistency check passed.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  run();
}
