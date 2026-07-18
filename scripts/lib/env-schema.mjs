import fs from "node:fs";

const ENV_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const PROFILE_PATTERN = /^[a-z][a-z0-9-]*$/;

function commentStart(value) {
  return value.search(/\s+#/);
}

function annotationProfiles(line) {
  const profiles = new Set();
  const annotation = /@required-in\s+([a-z][a-z0-9-]*(?:\s*,\s*[a-z][a-z0-9-]*)*)/gi;

  for (const match of line.matchAll(annotation)) {
    for (const profile of match[1].split(",")) {
      const normalized = profile.trim().toLowerCase();
      if (PROFILE_PATTERN.test(normalized)) profiles.add(normalized);
    }
  }

  return [...profiles];
}

/**
 * Parse dotenv-style content without resolving or printing any values.
 */
export function parseEnvText(text) {
  const env = {};

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice("export ".length) : line;
    const equals = normalized.indexOf("=");
    if (equals === -1) continue;

    const key = normalized.slice(0, equals).trim();
    let value = normalized.slice(equals + 1).trim();
    if (!ENV_KEY_PATTERN.test(key)) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

/**
 * Parse the key contract in .env.schema. A @required-in annotation may appear
 * on its own comment line immediately before a key or inline with that key.
 */
export function parseSchemaText(text) {
  const entries = [];
  let pendingOptional = false;
  let pendingProfiles = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("#")) {
      if (/@optional/i.test(line)) pendingOptional = true;
      const profiles = annotationProfiles(line);
      if (profiles.length > 0) pendingProfiles = profiles;
      continue;
    }

    const equals = line.indexOf("=");
    if (equals === -1) {
      pendingOptional = false;
      pendingProfiles = [];
      continue;
    }

    const key = line.slice(0, equals).trim();
    const valueWithComment = line.slice(equals + 1).trim();
    if (!ENV_KEY_PATTERN.test(key)) {
      pendingOptional = false;
      pendingProfiles = [];
      continue;
    }

    const commentIndex = commentStart(valueWithComment);
    const value = commentIndex === -1 ? valueWithComment : valueWithComment.slice(0, commentIndex);
    const inlineProfiles = annotationProfiles(line);
    entries.push({
      key,
      hasDefault: value.trim().length > 0,
      optional: pendingOptional || /@optional/i.test(line),
      requiredIn: [...new Set([...pendingProfiles, ...inlineProfiles])],
    });

    pendingOptional = false;
    pendingProfiles = [];
  }

  return entries;
}

export function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return parseEnvText(fs.readFileSync(filePath, "utf8"));
}

export function parseSchema(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return parseSchemaText(fs.readFileSync(filePath, "utf8"));
}

export function requiredKeysForProfile(entries, profile) {
  const normalizedProfile = profile?.trim().toLowerCase();
  if (!normalizedProfile) return [];

  return entries
    .filter((entry) => !entry.optional && entry.requiredIn.includes(normalizedProfile))
    .map((entry) => entry.key);
}

/**
 * Keep process-only checks independent of a local .env file. This is used by
 * CI preflights where the workflow already provides the contract values.
 */
export function readEnvironment({ source = "file", envFilePath, processEnv = process.env }) {
  if (source === "process") return { ...processEnv };
  if (source === "file") return parseEnvFile(envFilePath);
  throw new Error(`Unsupported env source: ${source}`);
}

export function validateRequiredEnvironment(requiredKeys, env) {
  const missing = [];
  const empty = [];

  for (const key of requiredKeys) {
    if (!(key in env)) {
      missing.push(key);
      continue;
    }
    const value = env[key];
    if (typeof value !== "string" || value.trim() === "") empty.push(key);
  }

  return { missing, empty };
}
