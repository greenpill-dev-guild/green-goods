#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function fail(message) {
  errors.push(message);
}

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), "utf8");
}

function exists(filePath) {
  return fs.existsSync(path.join(root, filePath));
}

function listDirFiles(relDir, ext = ".md") {
  return fs
    .readdirSync(path.join(root, relDir))
    .filter((name) => name.endsWith(ext))
    .map((name) => path.join(relDir, name));
}

function listSkillFiles() {
  const skillsDir = path.join(root, ".claude/skills");
  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "_archived")
    .map((entry) => path.join(".claude/skills", entry.name, "SKILL.md"))
    .filter((filePath) => exists(filePath))
    .sort();
}

function parseFrontmatter(content, relPath) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    fail(`${relPath}: missing frontmatter block`);
    return null;
  }

  const meta = {};
  for (const rawLine of match[1].split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();

    if (value.startsWith("[") && value.endsWith("]")) {
      value = value.slice(1, -1).trim();
      meta[key] = value
        ? value
            .split(",")
            .map((item) => item.trim().replace(/^"|"$/g, ""))
            .filter(Boolean)
        : [];
    } else {
      meta[key] = value.replace(/^"|"$/g, "");
    }
  }

  return meta;
}

function getBoldOrStrikeTokens(markdown) {
  const found = new Set();
  const bold = /\*\*([a-z0-9-]+)\*\*/g;
  const strike = /~~([a-z0-9-]+)~~/g;
  let match;

  while ((match = bold.exec(markdown)) !== null) found.add(match[1]);
  while ((match = strike.exec(markdown)) !== null) found.add(match[1]);

  return found;
}

function assertInOrder(text, labels, relPath) {
  let cursor = -1;
  for (const label of labels) {
    const idx = text.indexOf(label);
    if (idx === -1) {
      fail(`${relPath}: missing required section marker: ${label}`);
      return;
    }
    if (idx < cursor) {
      fail(`${relPath}: section order violated around marker: ${label}`);
      return;
    }
    cursor = idx;
  }
}

function extractRelatedSkillTokens(content) {
  const match = content.match(/##\s+Related Skills([\s\S]*?)(\n##\s+|$)/m);
  if (!match) return [];

  const tokens = new Set();
  const re = /`([a-z0-9-]+)`/g;
  let tokenMatch;
  while ((tokenMatch = re.exec(match[1])) !== null) {
    tokens.add(tokenMatch[1]);
  }
  return [...tokens];
}

function lineCount(text) {
  return text.split("\n").length;
}

function extractCommandToken(route) {
  if (typeof route !== "string") return null;
  const match = route.trim().match(/^\/([a-z0-9-]+)/);
  return match ? match[1] : null;
}

const skillFiles = listSkillFiles();
const skillMeta = new Map();

for (const relPath of skillFiles) {
  const content = read(relPath);
  const meta = parseFrontmatter(content, relPath);
  if (!meta) continue;

  const required = ["name", "description", "version", "status", "packages", "dependencies", "last_updated"];
  for (const key of required) {
    if (!(key in meta)) fail(`${relPath}: missing frontmatter key: ${key}`);
  }

  if (meta.status !== "deprecated" && !("last_verified" in meta)) {
    fail(`${relPath}: missing frontmatter key: last_verified`);
  }

  skillMeta.set(meta.name, { meta, relPath, content });

  if (meta.status !== "deprecated") {
    if (!/^##\s+Activation/m.test(content)) fail(`${relPath}: missing section "## Activation"`);
    // Skills must have substantive content sections (numbered Parts or major concept headings)
    const hasPartSections = /^##\s+Part\s+/m.test(content);
    const hasConceptSections = (content.match(/^##\s+[A-Z]/gm) || []).length >= 3;
    if (!hasPartSections && !hasConceptSections) {
      fail(`${relPath}: missing substantive content sections (numbered "## Part" or 3+ concept headings)`);
    }
    if (!/^##\s+Anti-Patterns/m.test(content)) fail(`${relPath}: missing section "## Anti-Patterns"`);
    if (!/^##\s+Related Skills/m.test(content)) fail(`${relPath}: missing section "## Related Skills"`);
  }
}

const registryPath = ".claude/registry/skills.json";
let activeSkillNames = new Set();
let aliases = {};

if (!exists(registryPath)) {
  fail(`${registryPath}: file does not exist`);
} else {
  const registry = JSON.parse(read(registryPath));

  if (!Array.isArray(registry.skills)) {
    fail(`${registryPath}: skills must be an array`);
  }

  if (!registry.aliases || typeof registry.aliases !== "object" || Array.isArray(registry.aliases)) {
    fail(`${registryPath}: aliases must be an object`);
  } else {
    aliases = registry.aliases;
  }

  if (registry.aliases?.offline !== "data-layer") {
    fail(`${registryPath}: required alias offline -> data-layer is missing`);
  }
  if (registry.aliases?.storage !== "data-layer") {
    fail(`${registryPath}: required alias storage -> data-layer is missing`);
  }

  const names = new Set();
  for (const record of registry.skills ?? []) {
    const required = [
      "name",
      "status",
      "listed_in_index",
      "default_mode",
      "triggers",
      "dependencies",
    ];

    for (const key of required) {
      if (!(key in record)) fail(`${registryPath}: ${record.name ?? "unknown"} missing key: ${key}`);
    }

    if (record.status === "deprecated" && !("deprecated_replacement" in record)) {
      fail(`${registryPath}: deprecated skill ${record.name} missing key: deprecated_replacement`);
    }

    if (record.name === "offline" || record.name === "storage") {
      fail(`${registryPath}: deprecated stub skill should not exist in active registry: ${record.name}`);
    }

    if (names.has(record.name)) fail(`${registryPath}: duplicate skill name: ${record.name}`);
    names.add(record.name);

    if (!skillMeta.has(record.name)) fail(`${registryPath}: registry skill missing SKILL.md: ${record.name}`);
  }

  for (const name of skillMeta.keys()) {
    if (!names.has(name)) fail(`${registryPath}: SKILL.md missing from registry: ${name}`);
  }

  activeSkillNames = names;

  for (const [alias, target] of Object.entries(aliases)) {
    // Skip command-route aliases (values starting with "/") — validated separately
    if (typeof target === "string" && target.startsWith("/")) continue;

    if (activeSkillNames.has(alias)) {
      fail(`${registryPath}: alias key collides with active skill: ${alias}`);
    }
    if (!activeSkillNames.has(target)) {
      fail(`${registryPath}: alias target does not exist in active skills: ${alias} -> ${target}`);
    }
  }

  const indexPath = ".claude/skills/index.md";
  const indexText = read(indexPath);
  const indexTokens = getBoldOrStrikeTokens(indexText);

  for (const record of registry.skills) {
    if (record.listed_in_index && !indexTokens.has(record.name)) {
      fail(`${indexPath}: listed_in_index=true but token not found: ${record.name}`);
    }
    if (!record.listed_in_index && indexTokens.has(record.name)) {
      fail(`${indexPath}: listed_in_index=false but token is present: ${record.name}`);
    }
  }

  if (/##\s+Deprecated Skills/m.test(indexText)) {
    fail(`${indexPath}: deprecated skills section should be removed`);
  }

  // Verify command skills section exists
  if (!/##\s+Command Skills/m.test(indexText)) {
    fail(`${indexPath}: missing "Command Skills" section`);
  }

  // Verify domain skills section exists
  if (!/##\s+Domain Skills/m.test(indexText)) {
    fail(`${indexPath}: missing "Domain Skills" section`);
  }
}

for (const [name, info] of skillMeta.entries()) {
  const related = extractRelatedSkillTokens(info.content);
  for (const token of related) {
    if (!activeSkillNames.has(token) && !(token in aliases)) {
      fail(`${info.relPath}: unknown related skill reference: ${token}`);
    }
  }
}

// === Unified registry: canonical commands, command skills, and bundles ===
// All now live in skills.json alongside skills and aliases.

const expectedCanonicalCommands = new Set([
  "plan",
  "debug",
  "drift",
  "audit-then-ship",
  "review",
  "status",
  "clean",
  "doc-feedback",
]);
let canonicalCommandNames = new Set();

{
  const registry = JSON.parse(read(registryPath));

  if (registry.source !== ".claude/skills/*/SKILL.md") {
    fail(`${registryPath}: source must be .claude/skills/*/SKILL.md`);
  }

  // Canonical commands
  if (!Array.isArray(registry.canonical_commands)) {
    fail(`${registryPath}: canonical_commands must be an array`);
  } else {
    canonicalCommandNames = new Set(registry.canonical_commands);
  }

  for (const cmd of expectedCanonicalCommands) {
    if (!canonicalCommandNames.has(cmd)) {
      fail(`${registryPath}: missing canonical command: ${cmd}`);
    }
  }
  for (const cmd of canonicalCommandNames) {
    if (!expectedCanonicalCommands.has(cmd)) {
      fail(`${registryPath}: unexpected canonical command: ${cmd}`);
    }
  }

  // Command skills (user_invocable: true) must have command-specific fields
  for (const record of registry.skills ?? []) {
    if (record.user_invocable) {
      const commandKeys = ["intent", "entry_file", "owned_skills", "modes"];
      for (const key of commandKeys) {
        if (!(key in record)) {
          fail(`${registryPath}: command skill ${record.name} missing key: ${key}`);
        }
      }

      if (!canonicalCommandNames.has(record.name)) {
        fail(`${registryPath}: user_invocable skill ${record.name} is not in canonical_commands`);
      }

      if (record.entry_file && !exists(record.entry_file)) {
        fail(`${registryPath}: command entry file missing: ${record.entry_file}`);
      }
      if (record.entry_file && !/^\.claude\/skills\/[a-z0-9-]+\/SKILL\.md$/.test(record.entry_file)) {
        fail(`${registryPath}: ${record.name} has invalid entry_file format: ${record.entry_file}`);
      }

      for (const ownedSkill of record.owned_skills ?? []) {
        if (!activeSkillNames.has(ownedSkill)) {
          fail(`${registryPath}: ${record.name} references unknown owned skill: ${ownedSkill}`);
        }
      }
    }
  }

  // Every canonical command must have a user_invocable skill
  for (const cmd of canonicalCommandNames) {
    const skill = (registry.skills ?? []).find((s) => s.name === cmd);
    if (!skill || !skill.user_invocable) {
      fail(`${registryPath}: canonical command ${cmd} has no user_invocable skill entry`);
    }
  }

  // Command aliases (keys starting with "/" or containing spaces route to /command modes)
  const commandAliasKeys = Object.entries(aliases).filter(
    ([key, val]) => key.startsWith("/") || (typeof val === "string" && val.startsWith("/"))
  );
  for (const [alias, route] of commandAliasKeys) {
    const token = extractCommandToken(route);
    if (!token) {
      fail(`${registryPath}: command alias target must start with / command route: ${alias} -> ${route}`);
      continue;
    }
    if (!canonicalCommandNames.has(token)) {
      fail(`${registryPath}: command alias target points to non-canonical command: ${alias} -> ${route}`);
    }
  }

  // Bundles
  if (!registry.bundles || typeof registry.bundles !== "object" || Array.isArray(registry.bundles)) {
    fail(`${registryPath}: bundles must be an object`);
  } else {
    const requiredBundleIds = [
      "frontend-change",
      "shared-domain-change",
      "contracts-change",
      "indexer-change",
      "agent-change",
      "cross-package-change",
      "incident-hotfix",
    ];

    for (const id of requiredBundleIds) {
      if (!(id in registry.bundles)) fail(`${registryPath}: missing required bundle: ${id}`);
    }

    for (const [id, bundle] of Object.entries(registry.bundles)) {
      const requiredKeys = ["entrypoint", "default_mode", "skills", "user_facing", "contract_touching"];
      for (const key of requiredKeys) {
        if (!(key in bundle)) fail(`${registryPath}: bundle ${id} missing key: ${key}`);
      }

      const entryCommand = extractCommandToken(bundle.entrypoint);
      if (!entryCommand) {
        fail(`${registryPath}: bundle ${id} entrypoint must start with / command route (received: ${bundle.entrypoint})`);
      } else if (!canonicalCommandNames.has(entryCommand)) {
        fail(`${registryPath}: bundle ${id} entrypoint references non-canonical command: ${bundle.entrypoint}`);
      }

      if (!Array.isArray(bundle.skills) || bundle.skills.length === 0) {
        fail(`${registryPath}: bundle ${id} skills must be a non-empty array`);
        continue;
      }

      for (const skill of bundle.skills) {
        if (!activeSkillNames.has(skill)) {
          fail(`${registryPath}: bundle ${id} references unknown skill: ${skill}`);
        }
      }

      if (bundle.default_mode === "apply_fixes" && !bundle.skills.includes("testing")) {
        fail(`${registryPath}: bundle ${id} (apply_fixes) must include testing`);
      }

      if (bundle.contract_touching && !bundle.skills.includes("contracts")) {
        fail(`${registryPath}: bundle ${id} (contract_touching) must include contracts`);
      }

      if (bundle.user_facing && !bundle.skills.includes("ui")) {
        fail(`${registryPath}: bundle ${id} (user_facing) must include ui`);
      }
    }
  }
}

// Deleted registries should not be reintroduced
for (const removedRegistry of [".claude/registry/commands.json", ".claude/registry/skill-bundles.json"]) {
  if (exists(removedRegistry)) {
    fail(`${removedRegistry}: merged into skills.json — should not exist as separate file`);
  }
}

if (exists(".claude/commands")) {
  const commandDocs = listDirFiles(".claude/commands");
  fail(`.claude/commands: command docs surface should remain removed (${commandDocs.join(", ") || "directory present"})`);
}

const removedSurfaceFiles = [
  ".cursor/BUGBOT.md",
  ".cursor/rules/deployment-patterns.mdc",
  ".cursor/rules/rules.mdc",
  ".cursor/rules/schema-management.mdc",
  ".cursor/rules/uups-upgrades.mdc",
];

for (const relPath of removedSurfaceFiles) {
  if (exists(relPath)) fail(`${relPath}: removed cursor guidance surface reintroduced`);
}

if (exists(".cursor")) {
  const rulesDir = path.join(root, ".cursor/rules");
  if (fs.existsSync(rulesDir)) {
    const trackedRules = fs.readdirSync(rulesDir).filter((name) => name.endsWith(".mdc"));
    if (trackedRules.length) {
      fail(`.cursor/rules: mdc guidance files should not exist (${trackedRules.join(", ")})`);
    }
  }
}

for (const relPath of ["CLAUDE.md", ".claude/settings.json"]) {
  if (exists(relPath) && /13 architectural rules/i.test(read(relPath))) {
    fail(`${relPath}: contains stale phrase "13 architectural rules"`);
  }
}

const docsToScan = [
  ...skillFiles,
  ...listDirFiles(".claude/agents"),
  "CLAUDE.md",
  "AGENTS.md",
];

for (const relPath of docsToScan) {
  const content = read(relPath);
  if (/^[\t ]*curl\b/m.test(content) || /^[\t ]*wget\b/m.test(content)) {
    fail(`${relPath}: includes blocked command example (curl/wget)`);
  }
}

const reviewSkill = read(".claude/skills/review/SKILL.md");
if (/ALWAYS POST TO GITHUB/i.test(reviewSkill)) {
  fail(`.claude/skills/review/SKILL.md: unconditional GitHub posting statement is not allowed`);
}
if (!/Only post when PR context exists/i.test(reviewSkill) && !/POST TO GITHUB ONLY IN PR CONTEXT/i.test(reviewSkill)) {
  fail(`.claude/skills/review/SKILL.md: missing conditional GitHub posting guidance`);
}

const debugSkill = read(".claude/skills/debug/SKILL.md");
const forbiddenDebugPatterns = [
  /git checkout \[last-good-commit\] -- \./i,
  /rm -rf\s+green-goods/i,
  /git stash\s*&&\s*git checkout main/i,
];
for (const pattern of forbiddenDebugPatterns) {
  if (pattern.test(debugSkill)) {
    fail(`.claude/skills/debug/SKILL.md: contains forbidden recovery pattern: ${pattern}`);
  }
}

for (const relPath of [
  ".claude/skills/debug/SKILL.md",
  ".claude/skills/ops/migration.md",
]) {
  if (!exists(relPath)) continue;
  const content = read(relPath);
  if (/(^|[\s`])forge\s+(build|test)\b/im.test(content)) {
    fail(`${relPath}: raw forge build/test command detected; use bun wrappers`);
  }
}

const crackedCoder = read(".claude/agents/cracked-coder.md");
if (!/bundle_id/.test(crackedCoder)) {
  fail(`.claude/agents/cracked-coder.md: missing required bundle_id intake guidance`);
}
if (!/\.claude\/registry\/skills\.json/.test(crackedCoder)) {
  fail(`.claude/agents/cracked-coder.md: missing skills registry reference (bundles are in skills.json)`);
}

const reviewSurfaces = [".claude/skills/review/SKILL.md"];

for (const relPath of reviewSurfaces) {
  if (!exists(relPath)) continue;
  const content = read(relPath);
  if (!/Severity Mapping/i.test(content)) {
    fail(`${relPath}: missing "Severity Mapping" section`);
  }
  if (!/Critical\|High\s*->\s*must-fix/i.test(content.replace(/`/g, ""))) {
    fail(`${relPath}: missing required severity bucket mapping (Critical|High -> must-fix)`);
  }
  if (/\bP[0-4]\b/.test(content)) {
    fail(`${relPath}: review surfaces must not use triage severity labels P0-P4`);
  }
}

for (const relPath of [".claude/skills/review/SKILL.md"]) {
  if (!exists(relPath)) continue;
  const content = read(relPath);
  assertInOrder(content, [
    "### Summary",
    "### Severity Mapping",
    "### Must-Fix",
    "### Should-Fix",
    "### Nice-to-Have",
    "### Verification",
    "### Recommendation",
  ], relPath);
}

// Retired agents — ensure removal stays clean
for (const retiredAgent of [
  ".claude/agents/triage.md",
  ".claude/agents/code-reviewer.md",
  ".claude/agents/migration.md",
  ".claude/agents/storybook-author.md",
]) {
  if (exists(retiredAgent)) {
    fail(`${retiredAgent}: retired agent surface should not be reintroduced`);
  }
}

const mcpPath = ".mcp.json";
if (!exists(mcpPath)) {
  fail(`${mcpPath}: file does not exist`);
} else {
  const mcp = JSON.parse(read(mcpPath));
  const servers = new Set(Object.keys(mcp.servers ?? {}));

  for (const [agentName, access] of Object.entries(mcp.agentAccess ?? {})) {
    for (const serverName of access.servers ?? []) {
      if (!servers.has(serverName)) {
        fail(`${mcpPath}: agentAccess.${agentName} references undefined server: ${serverName}`);
      }
    }
  }
}

const mcpDocs = [
  "CLAUDE.md",
  "AGENTS.md",
  ".claude/agents/oracle.md",
  ".claude/skills/mermaid-diagrams/SKILL.md",
  ".claude/settings.local.json",
];

for (const relPath of mcpDocs) {
  if (exists(relPath) && /\bmiro\b/i.test(read(relPath))) {
    fail(`${relPath}: stale miro reference detected`);
  }
}

if (exists("CLAUDE.md") && /docs\/docs\/developer\/claude-mcp-workflows\.md/.test(read("CLAUDE.md"))) {
  fail(`CLAUDE.md: stale claude-mcp-workflows path detected`);
}

const removedSurfaceMentions = [".cursor/rules/", ".cursor/BUGBOT.md", "BUGBOT.md"];
for (const relPath of ["CLAUDE.md", "AGENTS.md", "docs/docs/reference/changelog.md", ...docsToScan]) {
  if (!exists(relPath)) continue;
  const content = read(relPath);
  for (const pattern of removedSurfaceMentions) {
    if (content.includes(pattern)) {
      fail(`${relPath}: removed cursor surface reference detected: ${pattern}`);
    }
  }
}

const removedCommandSurfaceMentions = [".claude/commands/", "/teams ship", "/teams review", "/teams entropy"];
const commandSurfaceDocs = ["CLAUDE.md", "AGENTS.md", ".claude/skills/index.md"];
for (const relPath of commandSurfaceDocs) {
  if (!exists(relPath)) continue;
  const content = read(relPath);
  for (const pattern of removedCommandSurfaceMentions) {
    if (content.includes(pattern)) {
      fail(`${relPath}: removed command-doc surface reference detected: ${pattern}`);
    }
  }
}

if (errors.length) {
  console.error("\nGuidance consistency check failed:\n");
  for (const issue of errors) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

console.log("Guidance consistency check passed.");
