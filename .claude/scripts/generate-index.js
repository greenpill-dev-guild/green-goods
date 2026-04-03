#!/usr/bin/env node

/**
 * Generates .claude/skills/index.md from .claude/registry/skills.json.
 *
 * Run: node .claude/scripts/generate-index.js
 * Produces a deterministic index — safe to run repeatedly.
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

const registry = JSON.parse(read(".claude/registry/skills.json"));
const skills = registry.skills;
const aliases = registry.aliases;
const canonicalCommands = new Set(registry.canonical_commands);

const commandSkills = skills.filter((s) => s.user_invocable);
const domainSkills = skills.filter((s) => !s.user_invocable);

// Group aliases by target (skip command-route aliases)
const aliasesByTarget = {};
for (const [alias, target] of Object.entries(aliases)) {
  if (typeof target === "string" && target.startsWith("/")) continue;
  if (!aliasesByTarget[target]) aliasesByTarget[target] = [];
  aliasesByTarget[target].push(alias);
}

// Command-route aliases
const commandAliases = Object.entries(aliases).filter(
  ([, val]) => typeof val === "string" && val.startsWith("/")
);

function buildModesStr(skill) {
  if (!skill.modes || skill.modes.length === 0) return "";
  return skill.modes
    .filter((m) => m !== "default")
    .map((m) => `\`--mode ${m}\``)
    .join(", ");
}

function buildSubFilesStr(skill) {
  if (!skill.sub_files || skill.sub_files.length === 0) return "";
  return skill.sub_files.map((f) => f.replace(".md", "")).join(", ");
}

const lines = [];

lines.push("# Skills Quick Reference");
lines.push("");
lines.push("> **For humans**: Find your task, use the skill. **For Claude**: Match keywords to invoke.");
lines.push("");
lines.push("---");
lines.push("");

// Command Skills
lines.push("## Command Skills (User-Invocable)");
lines.push("");
lines.push("| Skill | Invoke With | Modes | Use For |");
lines.push("|-------|-------------|-------|---------|");

for (const s of commandSkills) {
  const invoke = `\`/${s.name}\``;
  const modes = buildModesStr(s) || "—";
  lines.push(`| **${s.name}** | ${invoke} | ${modes} | ${s.intent} |`);
}

lines.push("");
lines.push("---");
lines.push("");

// Domain Skills
lines.push("## Domain Skills (Auto-Loaded by Context)");
lines.push("");
lines.push("| Skill | Keywords | Sub-files |");
lines.push("|-------|----------|-----------|");

for (const s of domainSkills) {
  const keywords = s.triggers.slice(0, 5).join(", ");
  const subFiles = buildSubFilesStr(s) || "—";
  lines.push(`| **${s.name}** | ${keywords} | ${subFiles} |`);
}

lines.push("");
lines.push("---");
lines.push("");

// User-Level Skills
lines.push("## User-Level Skills (Available Across All Projects)");
lines.push("");
lines.push("| Skill | Use For |");
lines.push("|-------|---------|");
lines.push("| **meeting-notes** | Extract GitHub issues from meeting transcripts |");
lines.push("| **drive** | Find, sort, and read meeting notes from Google Drive |");
lines.push("| **dream-on** | Overnight autonomous cross-project exploration |");
lines.push("");
lines.push("---");
lines.push("");

// Agents
lines.push("## Agents (Multi-Step Automation)");
lines.push("");
lines.push("| Agent | Use For |");
lines.push("|-------|---------|");
lines.push("| **oracle** | Deep research requiring 3+ sources |");
lines.push("| **cracked-coder** | Complex implementation with TDD |");
lines.push("| **code-reviewer** | Systematic 6-pass PR review |");
lines.push("| **migration** | Cross-package migration orchestration |");
lines.push("| **triage** | Issue classification and routing |");
lines.push("");
lines.push("---");
lines.push("");

// Decision Tree
lines.push("## Decision Tree");
lines.push("");
lines.push("```");
lines.push("What do you need?");
lines.push("│");

for (const s of commandSkills) {
  lines.push(`├─► ${s.intent}? ──► /${s.name}`);
}

lines.push("│");

for (const s of domainSkills) {
  const shortTrigger = s.triggers[0];
  lines.push(`├─► ${shortTrigger}? ──► ${s.name}`);
}

lines.push("│");
lines.push("└─► Simple change? ──► Direct Claude (no skill needed)");
lines.push("```");
lines.push("");
lines.push("---");
lines.push("");

// Aliases
lines.push("## Aliases");
lines.push("");
lines.push("Old names route to their new homes automatically:");
lines.push("");
lines.push("| Alias | Routes To |");
lines.push("|-------|-----------|");

for (const [target, aliasList] of Object.entries(aliasesByTarget).sort(([a], [b]) => a.localeCompare(b))) {
  for (const alias of aliasList.sort()) {
    lines.push(`| \`${alias}\` | ${target} |`);
  }
}

if (commandAliases.length > 0) {
  lines.push("");
  lines.push("### Command Mode Shortcuts");
  lines.push("");
  lines.push("| Shortcut | Routes To |");
  lines.push("|----------|-----------|");
  for (const [alias, route] of commandAliases.sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`| \`${alias}\` | \`${route}\` |`);
  }
}

lines.push("");
lines.push("---");
lines.push("");
lines.push("## Package Context Files");
lines.push("");
lines.push("When working deeply in a specific package, load `.claude/context/{package}.md` for detailed patterns.");
lines.push("");

const output = lines.join("\n");
const outPath = path.join(root, ".claude/skills/index.md");
fs.writeFileSync(outPath, output, "utf8");

console.log(`Generated ${outPath} (${lines.length} lines)`);
