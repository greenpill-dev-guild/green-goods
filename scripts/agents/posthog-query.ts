import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CACHE_TTL_SECONDS = 300;
const DEFAULT_LIMIT = 1000;
const DEFAULT_POSTHOG_HOST = "https://us.posthog.com";

type CommandName = "errors" | "error-detail" | "user-sessions" | "recurring" | "match-bug-report";
type PrivacyMode = "private" | "public";

export interface ParsedPosthogCommand {
  command: CommandName;
  recent?: string;
  window?: string;
  since?: string;
  errorHash?: string;
  user?: string;
  errorSnippet?: string;
  threshold: number;
  limit: number;
  privacy: PrivacyMode;
  cacheDir?: string;
  noCache: boolean;
  dryRun: boolean;
}

interface PosthogRequestConfig {
  projectId: string;
}

interface PosthogEnv extends Record<string, string | undefined> {
  POSTHOG_PROJECT_API_KEY?: string;
  POSTHOG_PROJECT_ID?: string;
  POSTHOG_HOST?: string;
}

interface ExecutionOptions {
  env?: PosthogEnv;
  cacheDir?: string;
  fetchHogql?: (request: PosthogRequest) => Promise<unknown>;
  now?: () => Date;
}

export interface PosthogRequest {
  method: "POST";
  path: string;
  payload: {
    name: string;
    query: {
      kind: "HogQLQuery";
      query: string;
    };
  };
}

interface ErrorEventRow {
  timestamp: string;
  event: string;
  exception_type: string;
  exception_message: string;
  exception_stack: string;
  current_url: string;
  session_id: string;
  distinct_id: string;
}

interface ErrorGroup {
  error_hash: string;
  exception_type: string;
  message: string;
  current_url: string;
  affected_sessions: number;
  affected_users: number;
  first_seen: string;
  last_seen: string;
  sample_stack?: string;
  score?: number;
  private_context: {
    affected_users: string[];
    sessions: Array<{
      session_id: string;
      distinct_id: string;
      replay_url: string;
      last_seen: string;
    }>;
  };
}

export interface PublicIssueMatch {
  error_hash: string;
  exception_type: string;
  message: string;
  current_url: string;
  affected_sessions: number;
  affected_users: number;
  first_seen: string;
  last_seen: string;
  score?: number;
}

export interface PosthogCommandOutput extends JsonObject {
  meta: {
    cache: {
      hit: boolean;
      ttl_seconds: number;
    };
    privacy?: PrivacyMode;
    dry_run?: boolean;
  };
  public_issue_matches?: PublicIssueMatch[];
  private_context?: unknown;
  request?: PosthogRequest;
}

interface CacheFile {
  created_at: string;
  expires_at: string;
  output: PosthogCommandOutput;
}

type JsonObject = Record<string, unknown>;

export function parsePosthogQueryArgs(argv: string[] = process.argv.slice(2)): ParsedPosthogCommand {
  const [command, ...rest] = argv;
  if (!isCommandName(command)) {
    throw new Error(
      `Unknown command "${command ?? ""}". Expected one of: errors, error-detail, user-sessions, recurring, match-bug-report.`
    );
  }

  const options = parseOptions(rest);
  const parsed: ParsedPosthogCommand = {
    command,
    threshold: parsePositiveInteger(options.threshold ?? "50", "threshold"),
    limit: parsePositiveInteger(options.limit ?? String(DEFAULT_LIMIT), "limit"),
    privacy: parsePrivacy(options.privacy),
    cacheDir: options.cacheDir,
    noCache: options.noCache === true,
    dryRun: options.dryRun === true,
  };

  if (parsed.limit > DEFAULT_LIMIT) {
    throw new Error(`Invalid limit "${parsed.limit}". Maximum supported limit is ${DEFAULT_LIMIT}.`);
  }

  switch (command) {
    case "errors": {
      parsed.recent = options.recent ?? "24h";
      assertDuration(parsed.recent);
      assertNoUnexpectedPositionals(options.positionals, command);
      break;
    }
    case "error-detail": {
      const [errorHash] = options.positionals;
      if (!errorHash) throw new Error("error-detail requires an <error-hash> positional argument.");
      parsed.errorHash = errorHash;
      parsed.window = options.window ?? "7d";
      assertDuration(parsed.window);
      assertNoUnexpectedPositionals(options.positionals.slice(1), command);
      break;
    }
    case "user-sessions": {
      const [user] = options.positionals;
      if (!user) throw new Error("user-sessions requires a <distinct-id-or-wallet> positional argument.");
      parsed.user = user;
      parsed.window = options.window ?? "24h";
      assertDuration(parsed.window);
      assertNoUnexpectedPositionals(options.positionals.slice(1), command);
      break;
    }
    case "recurring": {
      if (!options.since) throw new Error("recurring requires --since <YYYY-MM-DD>.");
      assertDate(options.since);
      parsed.since = options.since;
      assertNoUnexpectedPositionals(options.positionals, command);
      break;
    }
    case "match-bug-report": {
      if (!options.errorSnippet) {
        throw new Error("match-bug-report requires --error-snippet <text>.");
      }
      parsed.errorSnippet = options.errorSnippet;
      parsed.user = options.user;
      parsed.window = options.window ?? "7d";
      assertDuration(parsed.window);
      assertNoUnexpectedPositionals(options.positionals, command);
      break;
    }
  }

  return parsed;
}

export function buildPosthogRequest(
  command: ParsedPosthogCommand,
  config: PosthogRequestConfig
): PosthogRequest {
  const sql = buildHogql(command);
  const queryHash = createHash("sha256").update(sql).digest("hex").slice(0, 10);
  return {
    method: "POST",
    path: `/api/projects/${encodeURIComponent(config.projectId)}/query/`,
    payload: {
      name: `agent-posthog-${command.command}-${queryHash}`,
      query: {
        kind: "HogQLQuery",
        query: sql,
      },
    },
  };
}

export async function executePosthogCommand(
  command: ParsedPosthogCommand,
  options: ExecutionOptions = {}
): Promise<PosthogCommandOutput> {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date());
  const config = readConfig(env, { requireApiKey: !command.dryRun });
  const request = buildPosthogRequest(command, { projectId: config.projectId });

  if (command.dryRun) {
    return {
      command: command.command,
      generated_at: now().toISOString(),
      request,
      meta: {
        cache: { hit: false, ttl_seconds: CACHE_TTL_SECONDS },
        privacy: command.privacy,
        dry_run: true,
      },
    };
  }

  const cacheDir = command.cacheDir ?? options.cacheDir ?? defaultCacheDir();
  const cacheKey = buildCacheKey(command, request);
  const cachePath = join(cacheDir, `${cacheKey}.json`);

  if (!command.noCache) {
    const cached = await readFreshCache(cachePath, now());
    if (cached) return withCacheHit(cached.output);
  }

  const rawResponse = options.fetchHogql
    ? await options.fetchHogql(request)
    : await fetchPosthogQuery(request, config);
  const rows = normalizeErrorRows(rawResponse);
  const output = buildCommandOutput(command, rows, {
    host: config.host,
    projectId: config.projectId,
    generatedAt: now().toISOString(),
  });

  if (!command.noCache) {
    await writeCache(cachePath, output, now());
  }

  return output;
}

export function formatPublicIssueBody(matches: PublicIssueMatch[] | undefined): string {
  if (!matches?.length) return "PostHog matches: none.";

  return matches
    .slice(0, 3)
    .map((match, index) =>
      [
        `PostHog match ${index + 1}: ${match.exception_type}: ${match.message}`,
        `Affected sessions: ${match.affected_sessions}`,
        `Affected users: ${match.affected_users}`,
        `First seen: ${match.first_seen}`,
        `Last seen: ${match.last_seen}`,
        match.current_url ? `URL: ${match.current_url}` : undefined,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n");
}

function buildHogql(command: ParsedPosthogCommand): string {
  const filters = [errorEventPredicate()];

  if (command.command === "errors") {
    filters.push(windowPredicate(command.recent ?? "24h"));
  }
  if (command.command === "error-detail") {
    filters.push(windowPredicate(command.window ?? "7d"));
  }
  if (command.command === "user-sessions") {
    filters.push(windowPredicate(command.window ?? "24h"));
    filters.push(userPredicate(command.user ?? ""));
  }
  if (command.command === "recurring") {
    filters.push(`timestamp >= toDateTime('${escapeSqlString(command.since ?? "")}')`);
  }
  if (command.command === "match-bug-report") {
    filters.push(windowPredicate(command.window ?? "7d"));
    filters.push(snippetPredicate(command.errorSnippet ?? ""));
    if (command.user) filters.push(userPredicate(command.user));
  }

  return `
SELECT
  timestamp,
  event,
  coalesce(nullIf(toString(properties.$exception_type), ''), nullIf(toString(properties.error_type), ''), 'Error') AS exception_type,
  coalesce(nullIf(toString(properties.$exception_message), ''), nullIf(toString(properties.error_message), ''), nullIf(toString(properties.original_error_message), ''), '') AS exception_message,
  coalesce(nullIf(toString(properties.$exception_stack_trace_raw), ''), nullIf(toString(properties.$exception_stack), ''), nullIf(toString(properties.error_stack), ''), '') AS exception_stack,
  coalesce(nullIf(toString(properties.$current_url), ''), nullIf(toString(properties.current_url), ''), nullIf(toString(properties.path), ''), '') AS current_url,
  coalesce(nullIf(toString(properties.$session_id), ''), nullIf(toString(properties.session_id), ''), '') AS session_id,
  distinct_id
FROM events
WHERE ${filters.join("\n  AND ")}
ORDER BY timestamp DESC
LIMIT ${command.limit}
`.trim();
}

function errorEventPredicate(): string {
  return "(event = '$exception' OR event = 'error_tracked')";
}

function windowPredicate(window: string): string {
  const { amount, unit } = parseDuration(window);
  return `timestamp >= now() - INTERVAL ${amount} ${unit}`;
}

function userPredicate(user: string): string {
  const escaped = escapeSqlString(user);
  return [
    "(",
    `  distinct_id = '${escaped}'`,
    `  OR lower(toString(properties.wallet_address)) = lower('${escaped}')`,
    `  OR lower(toString(properties.address)) = lower('${escaped}')`,
    `  OR lower(toString(properties.smart_account)) = lower('${escaped}')`,
    ")",
  ].join("\n");
}

function snippetPredicate(snippet: string): string {
  const escaped = escapeSqlString(snippet.toLowerCase());
  const messageExpr =
    "lower(coalesce(nullIf(toString(properties.$exception_message), ''), nullIf(toString(properties.error_message), ''), nullIf(toString(properties.original_error_message), ''), ''))";
  const stackExpr =
    "lower(coalesce(nullIf(toString(properties.$exception_stack_trace_raw), ''), nullIf(toString(properties.$exception_stack), ''), nullIf(toString(properties.error_stack), ''), ''))";
  return `(${messageExpr} LIKE '%${escaped}%' OR ${stackExpr} LIKE '%${escaped}%')`;
}

function buildCommandOutput(
  command: ParsedPosthogCommand,
  rows: ErrorEventRow[],
  context: { host: string; projectId: string; generatedAt: string }
): PosthogCommandOutput {
  const groups = groupErrors(rows, context);
  const publicGroups = groups.map(toPublicIssueMatch);
  const privateContext = command.privacy === "private" ? toPrivateContext(groups) : undefined;

  const base = {
    command: command.command,
    generated_at: context.generatedAt,
    meta: {
      cache: { hit: false, ttl_seconds: CACHE_TTL_SECONDS },
      privacy: command.privacy,
    },
  };

  switch (command.command) {
    case "errors":
      return withOptionalPrivate({ ...base, errors: publicGroups }, privateContext);
    case "error-detail": {
      const selected = groups.find((group) => group.error_hash === command.errorHash);
      return withOptionalPrivate(
        {
          ...base,
          error_hash: command.errorHash,
          error: selected ? toPublicIssueMatch(selected) : null,
          detail: selected
            ? {
                sample_stack: selected.sample_stack,
                first_seen: selected.first_seen,
                last_seen: selected.last_seen,
              }
            : null,
        },
        selected && command.privacy === "private" ? toPrivateContext([selected]) : undefined
      );
    }
    case "user-sessions": {
      const sessions = rows
        .filter((row) => row.session_id)
        .map((row) => ({
          last_seen: row.timestamp,
          exception_type: row.exception_type,
          message: row.exception_message,
          current_url: row.current_url,
          ...(command.privacy === "private"
            ? {
                session_id: row.session_id,
                distinct_id: row.distinct_id,
                replay_url: makeReplayUrl(context.host, context.projectId, row.session_id),
              }
            : {}),
        }));
      return { ...base, sessions };
    }
    case "recurring": {
      const patterns = publicGroups.filter(
        (group) => group.affected_sessions >= command.threshold
      );
      return withOptionalPrivate({ ...base, threshold: command.threshold, patterns }, privateContext);
    }
    case "match-bug-report": {
      const ranked = rankMatches(groups, command.errorSnippet ?? "");
      const publicMatches = ranked.slice(0, 3).map(toPublicIssueMatch);
      return withOptionalPrivate(
        {
          ...base,
          public_issue_matches: publicMatches,
          public_issue_body: formatPublicIssueBody(publicMatches),
        },
        command.privacy === "private" ? toPrivateContext(ranked.slice(0, 3)) : undefined
      );
    }
  }
}

function groupErrors(
  rows: ErrorEventRow[],
  context: { host: string; projectId: string }
): ErrorGroup[] {
  const groups = new Map<
    string,
    ErrorGroup & {
      _sessions: Set<string>;
      _users: Set<string>;
    }
  >();

  for (const row of rows) {
    const hash = errorHash(row);
    const existing = groups.get(hash);
    const timestamp = row.timestamp || "";
    if (!existing) {
      groups.set(hash, {
        error_hash: hash,
        exception_type: row.exception_type || "Error",
        message: row.exception_message || "(missing error message)",
        current_url: row.current_url || "",
        affected_sessions: row.session_id ? 1 : 0,
        affected_users: row.distinct_id ? 1 : 0,
        first_seen: timestamp,
        last_seen: timestamp,
        sample_stack: row.exception_stack || undefined,
        private_context: {
          affected_users: row.distinct_id ? [row.distinct_id] : [],
          sessions: row.session_id
            ? [
                {
                  session_id: row.session_id,
                  distinct_id: row.distinct_id,
                  replay_url: makeReplayUrl(context.host, context.projectId, row.session_id),
                  last_seen: timestamp,
                },
              ]
            : [],
        },
        _sessions: new Set(row.session_id ? [row.session_id] : []),
        _users: new Set(row.distinct_id ? [row.distinct_id] : []),
      });
      continue;
    }

    if (timestamp && (!existing.first_seen || timestamp < existing.first_seen)) {
      existing.first_seen = timestamp;
    }
    if (timestamp && (!existing.last_seen || timestamp > existing.last_seen)) {
      existing.last_seen = timestamp;
    }
    if (!existing.sample_stack && row.exception_stack) {
      existing.sample_stack = row.exception_stack;
    }
    if (row.session_id && !existing._sessions.has(row.session_id)) {
      existing._sessions.add(row.session_id);
      existing.private_context.sessions.push({
        session_id: row.session_id,
        distinct_id: row.distinct_id,
        replay_url: makeReplayUrl(context.host, context.projectId, row.session_id),
        last_seen: timestamp,
      });
    }
    if (row.distinct_id && !existing._users.has(row.distinct_id)) {
      existing._users.add(row.distinct_id);
      existing.private_context.affected_users.push(row.distinct_id);
    }
    existing.affected_sessions = existing._sessions.size || existing.private_context.sessions.length;
    existing.affected_users = existing._users.size || existing.private_context.affected_users.length;
  }

  return [...groups.values()]
    .map(({ _sessions, _users, ...group }) => group)
    .sort((a, b) => b.affected_sessions - a.affected_sessions || b.last_seen.localeCompare(a.last_seen));
}

function rankMatches(groups: ErrorGroup[], snippet: string): ErrorGroup[] {
  const tokens = snippet
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  return groups
    .map((group) => {
      const haystack = `${group.exception_type} ${group.message} ${group.current_url} ${group.sample_stack ?? ""}`.toLowerCase();
      const tokenScore = tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
      return {
        ...group,
        score: tokenScore + Math.min(group.affected_sessions, 100) / 1000,
      };
    })
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.last_seen.localeCompare(a.last_seen));
}

function toPublicIssueMatch(group: ErrorGroup): PublicIssueMatch {
  return {
    error_hash: group.error_hash,
    exception_type: group.exception_type,
    message: group.message,
    current_url: group.current_url,
    affected_sessions: group.affected_sessions,
    affected_users: group.affected_users,
    first_seen: group.first_seen,
    last_seen: group.last_seen,
    ...(group.score === undefined ? {} : { score: group.score }),
  };
}

function toPrivateContext(groups: ErrorGroup[]) {
  return {
    replay_links_private_only: true,
    groups: groups.map((group) => ({
      error_hash: group.error_hash,
      affected_users: group.private_context.affected_users,
      sessions: group.private_context.sessions,
    })),
  };
}

function withOptionalPrivate(
  output: PosthogCommandOutput,
  privateContext?: unknown
): PosthogCommandOutput {
  if (!privateContext) return output;
  return { ...output, private_context: privateContext };
}

function normalizeErrorRows(response: unknown): ErrorEventRow[] {
  const source = normalizeResponseSource(response);
  if (!Array.isArray(source.results)) return [];

  if (source.results.every((row) => row && typeof row === "object" && !Array.isArray(row))) {
    return (source.results as JsonObject[]).map((row) => normalizeRowObject(row));
  }

  const columns = Array.isArray(source.columns) ? source.columns.map(String) : [];
  return (source.results as unknown[][]).map((row) => {
    const objectRow = Object.fromEntries(columns.map((column, index) => [column, row[index]]));
    return normalizeRowObject(objectRow);
  });
}

function normalizeResponseSource(response: unknown): { columns?: unknown[]; results?: unknown[] } {
  if (!response || typeof response !== "object") return {};
  const objectResponse = response as JsonObject;
  const queryStatus = objectResponse.query_status;
  if (queryStatus && typeof queryStatus === "object") {
    return queryStatus as { columns?: unknown[]; results?: unknown[] };
  }
  return objectResponse as { columns?: unknown[]; results?: unknown[] };
}

function normalizeRowObject(row: JsonObject): ErrorEventRow {
  return {
    timestamp: stringValue(row.timestamp),
    event: stringValue(row.event),
    exception_type: stringValue(row.exception_type),
    exception_message: stringValue(row.exception_message),
    exception_stack: stringValue(row.exception_stack),
    current_url: stringValue(row.current_url),
    session_id: stringValue(row.session_id),
    distinct_id: stringValue(row.distinct_id),
  };
}

function errorHash(row: ErrorEventRow): string {
  return createHash("sha256")
    .update(`${row.exception_type}|${row.exception_message}|${row.current_url}`)
    .digest("hex")
    .slice(0, 16);
}

function makeReplayUrl(host: string, projectId: string, sessionId: string): string {
  const normalizedHost = host.replace(/\/+$/, "");
  return `${normalizedHost}/project/${encodeURIComponent(projectId)}/replay/${encodeURIComponent(sessionId)}`;
}

function buildCacheKey(command: ParsedPosthogCommand, request: PosthogRequest): string {
  const cacheCommand = {
    command: command.command,
    recent: command.recent,
    window: command.window,
    since: command.since,
    errorHash: command.errorHash,
    user: command.user,
    errorSnippet: command.errorSnippet,
    threshold: command.threshold,
    limit: command.limit,
    privacy: command.privacy,
  };
  return createHash("sha256")
    .update(stableJson({ command: cacheCommand, request }))
    .digest("hex");
}

async function readFreshCache(cachePath: string, now: Date): Promise<CacheFile | null> {
  try {
    const parsed = JSON.parse(await readFile(cachePath, "utf8")) as CacheFile;
    if (new Date(parsed.expires_at).getTime() <= now.getTime()) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(
  cachePath: string,
  output: PosthogCommandOutput,
  now: Date
): Promise<void> {
  const cacheFile: CacheFile = {
    created_at: now.toISOString(),
    expires_at: new Date(now.getTime() + CACHE_TTL_SECONDS * 1000).toISOString(),
    output,
  };
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(cacheFile, null, 2)}\n`);
}

function withCacheHit(output: PosthogCommandOutput): PosthogCommandOutput {
  const meta = output.meta && typeof output.meta === "object" ? { ...(output.meta as JsonObject) } : {};
  const cache =
    meta.cache && typeof meta.cache === "object"
      ? { ...(meta.cache as JsonObject), hit: true, ttl_seconds: CACHE_TTL_SECONDS }
      : { hit: true, ttl_seconds: CACHE_TTL_SECONDS };
  return { ...output, meta: { ...meta, cache } };
}

async function fetchPosthogQuery(request: PosthogRequest, config: ReturnType<typeof readConfig>) {
  const url = `${config.host.replace(/\/+$/, "")}${request.path}`;
  const response = await fetch(url, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request.payload),
  });

  const text = await response.text();
  const body = text ? safeJsonParse(text) : {};
  if (!response.ok) {
    throw new Error(
      `PostHog query failed with HTTP ${response.status}: ${typeof body === "object" && body && "detail" in body ? String((body as JsonObject).detail) : text}`
    );
  }
  return body;
}

function readConfig(env: PosthogEnv, options: { requireApiKey?: boolean } = {}) {
  const apiKey = env.POSTHOG_PROJECT_API_KEY?.trim();
  const projectId = env.POSTHOG_PROJECT_ID?.trim();
  const host = env.POSTHOG_HOST?.trim() || DEFAULT_POSTHOG_HOST;
  const requireApiKey = options.requireApiKey ?? true;

  if (requireApiKey && !apiKey) {
    throw new Error("POSTHOG_PROJECT_API_KEY is required for read-only PostHog queries.");
  }
  if (!projectId) {
    throw new Error("POSTHOG_PROJECT_ID is required for read-only PostHog queries.");
  }

  return {
    apiKey: apiKey ?? "",
    projectId,
    host,
  };
}

function parseOptions(args: string[]) {
  const options: Record<string, string | boolean | string[]> = { positionals: [] };
  const aliases: Record<string, string> = {
    "--cache-dir": "cacheDir",
    "--dry-run": "dryRun",
    "--error-snippet": "errorSnippet",
    "--limit": "limit",
    "--no-cache": "noCache",
    "--privacy": "privacy",
    "--recent": "recent",
    "--since": "since",
    "--threshold": "threshold",
    "--user": "user",
    "--window": "window",
  };
  const booleanOptions = new Set(["--dry-run", "--no-cache"]);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      (options.positionals as string[]).push(arg);
      continue;
    }

    const [flag, inlineValue] = arg.split("=", 2);
    const key = aliases[flag];
    if (!key) throw new Error(`Unknown option "${flag}".`);

    if (booleanOptions.has(flag)) {
      options[key] = true;
      continue;
    }

    const value = inlineValue ?? args[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Option "${flag}" requires a value.`);
    options[key] = value;
    if (inlineValue === undefined) index += 1;
  }

  return options as {
    positionals: string[];
    cacheDir?: string;
    dryRun?: boolean;
    errorSnippet?: string;
    limit?: string;
    noCache?: boolean;
    privacy?: string;
    recent?: string;
    since?: string;
    threshold?: string;
    user?: string;
    window?: string;
  };
}

function isCommandName(command: string | undefined): command is CommandName {
  return (
    command === "errors" ||
    command === "error-detail" ||
    command === "user-sessions" ||
    command === "recurring" ||
    command === "match-bug-report"
  );
}

function parsePrivacy(value?: string): PrivacyMode {
  if (!value) return "private";
  if (value === "private" || value === "public") return value;
  throw new Error(`Invalid privacy mode "${value}". Expected "private" or "public".`);
}

function parsePositiveInteger(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label} "${value}". Expected a positive integer.`);
  }
  return parsed;
}

function assertDuration(value: string): void {
  parseDuration(value);
}

function parseDuration(value: string): { amount: number; unit: "MINUTE" | "HOUR" | "DAY" | "WEEK" } {
  const match = /^(\d+)(m|h|d|w)$/.exec(value);
  if (!match) {
    throw new Error(`Invalid duration "${value}". Expected values like 30m, 24h, 7d, or 2w.`);
  }
  const amount = Number(match[1]);
  const unit = match[2] === "m" ? "MINUTE" : match[2] === "h" ? "HOUR" : match[2] === "d" ? "DAY" : "WEEK";
  return { amount, unit };
}

function assertDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date "${value}". Expected YYYY-MM-DD.`);
  }
}

function assertNoUnexpectedPositionals(positionals: string[], command: string): void {
  if (positionals.length > 0) {
    throw new Error(`Unexpected positional argument(s) for ${command}: ${positionals.join(", ")}`);
  }
}

function escapeSqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as JsonObject)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function defaultCacheDir(): string {
  return resolve(process.cwd(), ".cache", "posthog");
}

async function main(): Promise<void> {
  try {
    const command = parsePosthogQueryArgs();
    const output = await executePosthogCommand(command);
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(
      `${JSON.stringify(
        {
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        },
        null,
        2
      )}\n`
    );
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  await main();
}
