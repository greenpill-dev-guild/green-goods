#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), "..");

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = args.indexOf(name);
  if (idx === -1) return fallback;
  return args[idx + 1] ?? fallback;
};

const mcpPath = getArg("--mcp", path.join(repoRoot, ".mcp.json"));
const configPath = getArg("--config", path.join(os.homedir(), ".codex", "config.toml"));
const dryRun = args.includes("--dry-run");

if (!fs.existsSync(mcpPath)) {
  console.error(`Missing MCP config: ${mcpPath}`);
  process.exit(1);
}

const mcp = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
const servers = mcp?.servers ?? {};

if (Object.keys(servers).length === 0) {
  console.error("No MCP servers found in .mcp.json");
  process.exit(1);
}

let configText = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";

for (const name of Object.keys(servers)) {
  configText = removeServerBlock(configText, name);
}

const blocks = Object.entries(servers).map(([name, server]) => renderServerBlock(name, server));
const nextText = `${configText.trimEnd()}${configText.trim() ? "\n\n" : ""}${blocks.join("\n\n")}\n`;

if (dryRun) {
  process.stdout.write(nextText);
  process.exit(0);
}

fs.mkdirSync(path.dirname(configPath), { recursive: true });
fs.writeFileSync(configPath, nextText, "utf8");

console.log(`Updated ${configPath} with ${blocks.length} MCP server(s).`);

function removeServerBlock(text, name) {
  const targets = new Set([`[mcp_servers.${name}]`, `[mcp_servers.${name}.env]`]);
  const lines = text.split("\n");
  const out = [];
  let skip = false;

  for (const line of lines) {
    const match = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (match) {
      const header = `[${match[1]}]`;
      skip = targets.has(header);
    }
    if (!skip) out.push(line);
  }

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function renderServerBlock(name, server) {
  const lines = [];
  const envLines = [];

  lines.push(`[mcp_servers.${name}]`);

  if (server.url) {
    lines.push(`url = "${escapeTomlString(server.url)}"`);
  }

  let command = null;
  let args = [];

  if (Array.isArray(server.command)) {
    command = server.command[0];
    args = server.command.slice(1);
  } else if (typeof server.command === "string") {
    command = server.command;
    args = Array.isArray(server.args) ? server.args : [];
  }

  if (command) {
    const { nextCommand, nextArgs, envTable, envVars } = applyEnvMapping(command, args, server.env);
    lines.push(`command = "${escapeTomlString(nextCommand)}"`);
    if (nextArgs.length > 0) {
      lines.push(`args = ${tomlStringArray(nextArgs)}`);
    }
    if (envVars.length > 0) {
      lines.push(`env_vars = ${tomlStringArray(envVars)}`);
    }
    if (Object.keys(envTable).length > 0) {
      envLines.push(`[mcp_servers.${name}.env]`);
      for (const [key, value] of Object.entries(envTable)) {
        envLines.push(`${key} = "${escapeTomlString(value)}"`);
      }
    }
  }

  if (server.enabled === false) {
    lines.push("enabled = false");
  }

  if (envLines.length > 0) {
    lines.push("", ...envLines);
  }

  return lines.join("\n");
}

function applyEnvMapping(command, args, env) {
  const envTable = {};
  const envVars = new Set();
  const envMap = [];

  if (env && typeof env === "object") {
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === "string") {
        const match = value.match(/^\$\{([A-Z0-9_]+)\}$/);
        if (match) {
          envVars.add(match[1]);
          envMap.push({ key, envVar: match[1] });
          continue;
        }
      }
      envTable[key] = String(value);
    }
  }

  if (envMap.length === 0) {
    return { nextCommand: command, nextArgs: args, envTable, envVars: [] };
  }

  const exports = envMap.map(({ key, envVar }) => `${key}="$${envVar}"`).join(" ");
  const rawCommand = [command, ...args].map(shellEscape).join(" ");
  const wrapped = `${exports} ${rawCommand}`.trim();

  return {
    nextCommand: "bash",
    nextArgs: ["-lc", wrapped],
    envTable,
    envVars: Array.from(envVars),
  };
}

function shellEscape(value) {
  if (value === "") return "''";
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function tomlStringArray(values) {
  return `[${values.map((value) => `"${escapeTomlString(value)}"`).join(", ")}]`;
}

function escapeTomlString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
