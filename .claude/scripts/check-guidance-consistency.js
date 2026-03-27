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
    if (!/^##\s+Part\s+/m.test(content)) fail(`${relPath}: missing numbered "## Part" section`);
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
      "deprecated_replacement",
      "listed_in_index",
      "default_mode",
      "triggers",
      "dependencies",
    ];

    for (const key of required) {
      if (!(key in record)) fail(`${registryPath}: ${record.name ?? "unknown"} missing key: ${key}`);
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

  if (!/##\s+Command Skills/m.test(indexText)) {
    fail(`${indexPath}: missing "Command Skills" section`);
  }
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

const commandsRegistryPath = ".claude/registry/commands.json";
const registrySchemas = [
  ".claude/registry/skills.schema.json",
  ".claude/registry/skill-bundles.schema.json",
  ".claude/registry/commands.schema.json",
];
for (const relPath of registrySchemas) {
  if (!exists(relPath)) {
    fail(`${relPath}: schema file does not exist`);
  }
}

const commandsSchemaPath = ".claude/registry/commands.schema.json";
if (exists(commandsSchemaPath)) {
  const commandsSchema = JSON.parse(read(commandsSchemaPath));
  const sourceConst = commandsSchema?.properties?.source?.const;
  if (sourceConst !== ".claude/skills/*/SKILL.md") {
    fail(`${commandsSchemaPath}: source must be locked to .claude/skills/*/SKILL.md`);
  }

  const entryPattern = commandsSchema?.$defs?.command?.properties?.entry_file?.pattern;
  if (entryPattern !== "^\\.claude\\/skills\\/[a-z0-9-]+\\/SKILL\\.md$") {
    fail(`${commandsSchemaPath}: entry_file pattern must target .claude/skills/*/SKILL.md`);
  }
}

const expectedCanonicalCommands = new Set(["plan", "debug", "review", "audit", "meeting-notes"]);
let canonicalCommandNames = new Set();
let commandAliases = {};

if (!exists(commandsRegistryPath)) {
  fail(`${commandsRegistryPath}: file does not exist`);
} else {
  const registry = JSON.parse(read(commandsRegistryPath));

  if (registry.source !== ".claude/skills/*/SKILL.md") {
    fail(`${commandsRegistryPath}: source must be .claude/skills/*/SKILL.md`);
  }

  if (!Array.isArray(registry.canonical_commands)) {
    fail(`${commandsRegistryPath}: canonical_commands must be an array`);
  } else {
    canonicalCommandNames = new Set(registry.canonical_commands);
  }

  if (!Array.isArray(registry.commands)) {
    fail(`${commandsRegistryPath}: commands must be an array`);
  }

  if (!registry.aliases || typeof registry.aliases !== "object" || Array.isArray(registry.aliases)) {
    fail(`${commandsRegistryPath}: aliases must be an object`);
  } else {
    commandAliases = registry.aliases;
  }

  if (canonicalCommandNames.size !== expectedCanonicalCommands.size) {
    fail(`${commandsRegistryPath}: canonical_commands must contain exactly plan, debug, review, audit, meeting-notes`);
  }
  for (const cmd of expectedCanonicalCommands) {
    if (!canonicalCommandNames.has(cmd)) {
      fail(`${commandsRegistryPath}: missing canonical command: ${cmd}`);
    }
  }

  const seenCommands = new Set();
  for (const command of registry.commands ?? []) {
    const requiredKeys = ["name", "status", "default_mode", "intent", "entry_file", "owned_skills"];
    for (const key of requiredKeys) {
      if (!(key in command)) {
        fail(`${commandsRegistryPath}: ${command.name ?? "unknown"} missing key: ${key}`);
      }
    }

    if (seenCommands.has(command.name)) {
      fail(`${commandsRegistryPath}: duplicate command definition: ${command.name}`);
      continue;
    }
    seenCommands.add(command.name);

    if (!canonicalCommandNames.has(command.name)) {
      fail(`${commandsRegistryPath}: command is not in canonical_commands: ${command.name}`);
    }

    if (!exists(command.entry_file)) {
      fail(`${commandsRegistryPath}: command entry file missing: ${command.entry_file}`);
    }
    if (!/^\.claude\/skills\/[a-z0-9-]+\/SKILL\.md$/.test(command.entry_file)) {
      fail(`${commandsRegistryPath}: ${command.name} has invalid entry_file format: ${command.entry_file}`);
    } else {
      const entrySkillName = command.entry_file.match(/^\.claude\/skills\/([a-z0-9-]+)\/SKILL\.md$/)?.[1];
      if (entrySkillName !== command.name) {
        fail(`${commandsRegistryPath}: ${command.name} entry_file must point to matching skill directory`);
      }
    }

    for (const ownedSkill of command.owned_skills ?? []) {
      if (!activeSkillNames.has(ownedSkill)) {
        fail(`${commandsRegistryPath}: ${command.name} references unknown owned skill: ${ownedSkill}`);
      }
    }
  }

  for (const cmd of canonicalCommandNames) {
    if (!seenCommands.has(cmd)) {
      fail(`${commandsRegistryPath}: missing command object for canonical command: ${cmd}`);
    }
  }

  const requiredAliases = {
    "/teams": "/plan --mode teams",
    "cross-package-verify": "/review --mode verify_only --scope cross-package",
    "autonomous review": "/review --mode apply_fixes",
    "tdd bugfix": "/debug --mode tdd_bugfix",
  };

  for (const [alias, expectedRoute] of Object.entries(requiredAliases)) {
    if (commandAliases[alias] !== expectedRoute) {
      fail(`${commandsRegistryPath}: required alias ${alias} -> ${expectedRoute} is missing`);
    }
  }

  for (const [alias, route] of Object.entries(commandAliases)) {
    const token = extractCommandToken(route);
    if (!token) {
      fail(`${commandsRegistryPath}: alias target must start with canonical command route: ${alias} -> ${route}`);
      continue;
    }
    if (!canonicalCommandNames.has(token)) {
      fail(`${commandsRegistryPath}: alias target points to non-canonical command: ${alias} -> ${route}`);
    }
  }
}

if (exists(".claude/commands")) {
  const commandDocs = listDirFiles(".claude/commands");
  fail(`.claude/commands: command docs surface should remain removed (${commandDocs.join(", ") || "directory present"})`);
}

const bundlesPath = ".claude/registry/skill-bundles.json";
if (!exists(bundlesPath)) {
  fail(`${bundlesPath}: file does not exist`);
} else {
  const bundlesData = JSON.parse(read(bundlesPath));
  if (!bundlesData.bundles || typeof bundlesData.bundles !== "object" || Array.isArray(bundlesData.bundles)) {
    fail(`${bundlesPath}: bundles must be an object`);
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
      if (!(id in bundlesData.bundles)) fail(`${bundlesPath}: missing required bundle: ${id}`);
    }

    for (const [id, bundle] of Object.entries(bundlesData.bundles)) {
      const requiredKeys = ["entrypoint", "default_mode", "skills", "user_facing", "contract_touching"];
      for (const key of requiredKeys) {
        if (!(key in bundle)) fail(`${bundlesPath}: ${id} missing key: ${key}`);
      }

      const entryCommand = extractCommandToken(bundle.entrypoint);
      if (!entryCommand) {
        fail(`${bundlesPath}: ${id} entrypoint must start with canonical command route (received: ${bundle.entrypoint})`);
      } else if (!canonicalCommandNames.has(entryCommand)) {
        fail(`${bundlesPath}: ${id} entrypoint references non-canonical command: ${bundle.entrypoint}`);
      }

      if (!Array.isArray(bundle.skills) || bundle.skills.length === 0) {
        fail(`${bundlesPath}: ${id} skills must be a non-empty array`);
        continue;
      }

      for (const skill of bundle.skills) {
        if (skill === "offline" || skill === "storage") {
          fail(`${bundlesPath}: ${id} uses removed skill id: ${skill}`);
        }
        if (!activeSkillNames.has(skill)) {
          fail(`${bundlesPath}: ${id} references unknown skill: ${skill}`);
        }
      }

      if (bundle.default_mode === "apply_fixes" && !bundle.skills.includes("testing")) {
        fail(`${bundlesPath}: ${id} (apply_fixes) must include testing`);
      }

      if (bundle.contract_touching) {
        if (!bundle.skills.includes("contracts")) {
          fail(`${bundlesPath}: ${id} (contract_touching) must include contracts`);
        }
      }

      if (bundle.user_facing) {
        if (!bundle.skills.includes("ui")) {
          fail(`${bundlesPath}: ${id} (user_facing) must include ui`);
        }
      }
    }
  }
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

for (const relPath of ["CLAUDE.md", ".claude/hooks.json", ".claude/skills/autonomous-review/SKILL.md", ".claude/skills/tdd-bugfix/SKILL.md"]) {
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

const codeReviewer = read(".claude/agents/code-reviewer.md");
if (/Every review MUST be posted to GitHub PR/i.test(codeReviewer)) {
  fail(`.claude/agents/code-reviewer.md: unconditional GitHub posting statement is not allowed`);
}
if (!/If reviewing a PR/i.test(codeReviewer)) {
  fail(`.claude/agents/code-reviewer.md: missing conditional GitHub posting guidance`);
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
  ".claude/skills/migration/SKILL.md",
  ".claude/agents/migration.md",
]) {
  const content = read(relPath);
  if (/(^|[\s`])forge\s+(build|test)\b/im.test(content)) {
    fail(`${relPath}: raw forge build/test command detected; use bun wrappers`);
  }
}

const crackedCoder = read(".claude/agents/cracked-coder.md");
if (!/bundle_id/.test(crackedCoder)) {
  fail(`.claude/agents/cracked-coder.md: missing required bundle_id intake guidance`);
}
if (!/\.claude\/registry\/skill-bundles\.json/.test(crackedCoder)) {
  fail(`.claude/agents/cracked-coder.md: missing skill-bundle registry reference`);
}

const triageDoc = read(".claude/agents/triage.md");
if (/cross-package-verify/i.test(triageDoc)) {
  fail(`.claude/agents/triage.md: should route cross-package work via canonical /review command, not cross-package-verify`);
}

const reviewSurfaces = [
  ".claude/agents/code-reviewer.md",
  ".claude/skills/review/SKILL.md",
];

for (const relPath of reviewSurfaces) {
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

assertInOrder(read(".claude/agents/triage.md"), [
  "### Classification",
  "### Affected Packages",
  "### Recommended Route",
  "### Context for Next Agent",
], ".claude/agents/triage.md");

for (const relPath of [
  ".claude/agents/code-reviewer.md",
  ".claude/skills/review/SKILL.md",
]) {
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

assertInOrder(read(".claude/agents/migration.md"), [
  "### Summary",
  "### Blast Radius",
  "### Execution Order",
  "### Validation Results",
  "### Risks / Rollback",
  "### Completion Checklist",
], ".claude/agents/migration.md");

const thinWrappers = {
  ".claude/agents/code-reviewer.md": {
    maxLines: 220,
    mustContain: ["Canonical review protocol", "Canonical output contract"],
  },
};

for (const [relPath, rule] of Object.entries(thinWrappers)) {
  const content = read(relPath);
  const count = lineCount(content);
  if (count > rule.maxLines) {
    fail(`${relPath}: wrapper too large (${count} lines > ${rule.maxLines})`);
  }
  for (const snippet of rule.mustContain) {
    if (!content.includes(snippet)) {
      fail(`${relPath}: missing canonical wrapper marker: ${snippet}`);
    }
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
const commandSurfaceDocs = ["CLAUDE.md", "AGENTS.md", ".claude/skills/index.md", ".claude/agents/triage.md"];
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
