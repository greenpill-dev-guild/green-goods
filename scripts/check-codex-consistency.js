#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

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

function parseEnvironmentActions(toml) {
  const actionRegex = /\[\[actions\]\]\s*name = "([^"]+)"\s*icon = "[^"]+"\s*command = """([\s\S]*?)"""/g;
  const actions = new Map();

  for (const match of toml.matchAll(actionRegex)) {
    const name = match[1];
    const command = match[2]
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("export PATH="))
      .join(" && ");
    actions.set(name, normalizeForDocs(command));
  }

  return actions;
}

function parseDocActions(markdown) {
  const section = getSection(markdown, "Predefined Actions");
  const tableLines = section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  const actions = new Map();
  for (const line of tableLines.slice(2)) {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length !== 2) continue;
    const [name, command] = cells;
    actions.set(name, normalizeForDocs(command.replace(/^`|`$/g, "")));
  }
  return actions;
}

function normalizeForDocs(command) {
  return command
    .replace(/\$\{[A-Za-z_][A-Za-z0-9_]*:-([^}]+)\}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function validateActions() {
  const envActions = parseEnvironmentActions(read(".codex/environments/environment.toml"));
  const docActions = parseDocActions(read("docs/docs/builders/agentic/codex.mdx"));

  for (const [name, command] of envActions) {
    if (!docActions.has(name)) {
      fail(`docs/docs/builders/agentic/codex.mdx: missing action "${name}" from action table`);
      continue;
    }
    if (docActions.get(name) !== command) {
      fail(
        `docs/docs/builders/agentic/codex.mdx: action "${name}" command mismatch\n` +
          `  docs: ${docActions.get(name)}\n` +
          `  env:  ${command}`
      );
    }
  }

  for (const name of docActions.keys()) {
    if (!envActions.has(name)) {
      fail(`.codex/environments/environment.toml: missing action "${name}" documented in codex.mdx`);
    }
  }
}

function validateRootGuide() {
  const rootGuide = read("AGENTS.md");
  const rootScripts = parseJson("package.json").scripts ?? {};

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

  for (const command of extractCodeLiterals(getSection(rootGuide, "Validation Ladder"))) {
    validateCommand(command, rootScripts, ".", "AGENTS.md");
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
        "docs/docs/builders/packages/admin.mdx",
        "CanvasLayout",
        "DashboardLayout",
        "Sidebar",
        "Header",
      ],
    },
    {
      relPath: "packages/admin/AGENTS.md",
      requiredTerms: [
        "docs/docs/builders/packages/admin.mdx",
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
        "docs/docs/builders/packages/admin.mdx",
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

validateActions();
validateRootGuide();
validatePackageGuides();
validateGuideReferences();

if (failures.length > 0) {
  console.error("Codex consistency check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Codex consistency check passed.");
