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
 * Parse the key contract in env.schema. A @required-in annotation may appear
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

const SECRET_REFERENCE_SCHEME = "op://";

function unquote(value) {
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
  return quoted && value.length > 1 ? value.slice(1, -1) : value;
}

/**
 * env.schema is also the template `bun run env:sync` hands to `op inject`, which replaces a
 * 1Password reference wherever it appears in the file and copies everything else to .env as
 * written. Report what would break that sync or put a wrong value in .env. Never prints values.
 */
export function findSyncProblems(text) {
  const problems = [];
  const seen = new Set();

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    const where = `line ${index + 1}`;
    if (!line) return;

    if (line.startsWith("#")) {
      if (line.includes(SECRET_REFERENCE_SCHEME)) {
        problems.push(`${where}: a comment holds a 1Password reference; the sync would try to resolve it.`);
      }
      return;
    }

    const equals = line.indexOf("=");
    const key = equals === -1 ? "" : line.slice(0, equals).trim();
    if (!ENV_KEY_PATTERN.test(key)) return;

    if (seen.has(key)) problems.push(`${where}: ${key} is declared twice; the later value wins in .env.`);
    seen.add(key);

    if (key.endsWith("_OP_REF")) {
      problems.push(`${where}: ${key} is a reference companion nothing resolves; put the reference on the key itself.`);
    }

    // Split before trimming so `KEY= # note` reads as an empty value with a comment.
    const afterEquals = line.slice(equals + 1);
    const commentIndex = commentStart(afterEquals);
    const value = unquote(
      (commentIndex === -1 ? afterEquals : afterEquals.slice(0, commentIndex)).trim()
    );
    const comment = commentIndex === -1 ? "" : afterEquals.slice(commentIndex);

    if (comment.includes(SECRET_REFERENCE_SCHEME)) {
      problems.push(`${where}: ${key} has a 1Password reference in its comment; the sync would try to resolve it.`);
    }
    if (/^(?:if|op)\s*\(|^\$\{?[A-Za-z_]/.test(value)) {
      problems.push(
        `${where}: ${key} holds a $VAR or function expression; it reaches .env as written and loaders do not agree on evaluating it.`
      );
    }
    if (value.includes(SECRET_REFERENCE_SCHEME)) {
      const path = value.slice(SECRET_REFERENCE_SCHEME.length).split("/");
      const whole = value.startsWith(SECRET_REFERENCE_SCHEME) && path.length >= 3 && path.every(Boolean);
      if (!whole) {
        problems.push(`${where}: ${key} is not a whole 1Password reference (scheme, then vault/item/field).`);
      }
    }
  });

  return problems;
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
