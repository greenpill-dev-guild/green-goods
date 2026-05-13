import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  buildPosthogRequest,
  executePosthogCommand,
  formatPublicIssueBody,
  parsePosthogQueryArgs,
} from "./posthog-query";

const TEST_ENV = {
  POSTHOG_PROJECT_API_KEY: "phx_read_test",
  POSTHOG_PROJECT_ID: "12345",
  POSTHOG_HOST: "https://us.posthog.com",
};

const POSTHOG_ERROR_RESPONSE = {
  columns: [
    "timestamp",
    "event",
    "exception_type",
    "exception_message",
    "exception_stack",
    "current_url",
    "session_id",
    "distinct_id",
  ],
  results: [
    [
      "2026-05-04T10:00:00Z",
      "$exception",
      "TypeError",
      "Garden select failed",
      "stack line 1",
      "https://greengoods.app/home/garden",
      "session-one",
      "0xUserOne",
    ],
    [
      "2026-05-04T10:05:00Z",
      "error_tracked",
      "TypeError",
      "Garden select failed",
      "stack line 2",
      "https://greengoods.app/home/garden",
      "session-two",
      "0xUserTwo",
    ],
  ],
};

const cacheDirs: string[] = [];

afterEach(async () => {
  await Promise.all(cacheDirs.splice(0).map((dir) => rm(dir, { force: true, recursive: true })));
});

async function createCacheDir() {
  const dir = await mkdtemp(join(tmpdir(), "posthog-query-test-"));
  cacheDirs.push(dir);
  return dir;
}

describe("parsePosthogQueryArgs", () => {
  it("parses the five curated read-only commands", () => {
    expect(parsePosthogQueryArgs(["errors", "--recent", "24h"])).toMatchObject({
      command: "errors",
      recent: "24h",
      privacy: "private",
    });
    expect(parsePosthogQueryArgs(["error-detail", "abc123", "--window", "7d"])).toMatchObject({
      command: "error-detail",
      errorHash: "abc123",
      window: "7d",
    });
    expect(parsePosthogQueryArgs(["user-sessions", "0xabc", "--window", "12h"])).toMatchObject({
      command: "user-sessions",
      user: "0xabc",
      window: "12h",
    });
    expect(parsePosthogQueryArgs(["recurring", "--since", "2026-04-01"])).toMatchObject({
      command: "recurring",
      since: "2026-04-01",
      threshold: 50,
    });
    expect(
      parsePosthogQueryArgs([
        "match-bug-report",
        "--error-snippet",
        "garden select",
        "--user",
        "0xabc",
        "--privacy",
        "public",
      ])
    ).toMatchObject({
      command: "match-bug-report",
      errorSnippet: "garden select",
      user: "0xabc",
      privacy: "public",
    });
  });

  it("rejects mutating or malformed commands", () => {
    expect(() => parsePosthogQueryArgs(["capture", "anything"])).toThrow(/Unknown command/);
    expect(() => parsePosthogQueryArgs(["errors", "--recent", "soon"])).toThrow(/duration/);
    expect(() => parsePosthogQueryArgs(["recurring", "--since", "04-01-2026"])).toThrow(/date/);
  });
});

describe("buildPosthogRequest", () => {
  it("shapes HogQL query requests for exception and structured error events", () => {
    const request = buildPosthogRequest(parsePosthogQueryArgs(["errors", "--recent", "24h"]), {
      projectId: "12345",
    });

    expect(request.path).toBe("/api/projects/12345/query/");
    expect(request.payload.query.kind).toBe("HogQLQuery");
    expect(request.payload.name).toContain("agent-posthog-errors");
    expect(request.payload.query.query).toContain("event = '$exception'");
    expect(request.payload.query.query).toContain("event = 'error_tracked'");
    expect(request.payload.query.query).toContain("properties.$exception_message");
    expect(request.payload.query.query).toContain("properties.error_message");
    expect(request.payload.query.query).toContain("now() - INTERVAL 24 HOUR");
  });

  it("adds user and fuzzy snippet filters without changing the read-only endpoint", () => {
    const request = buildPosthogRequest(
      parsePosthogQueryArgs([
        "match-bug-report",
        "--error-snippet",
        "can't choose garden",
        "--user",
        "0xabc",
      ]),
      { projectId: "12345" }
    );

    expect(request.path).toBe("/api/projects/12345/query/");
    expect(request.payload.query.query).toContain("LIKE '%can\\'t choose garden%'");
    expect(request.payload.query.query).toContain("distinct_id = '0xabc'");
    expect(request.method).toBe("POST");
  });
});

describe("executePosthogCommand cache", () => {
  it("allows dry-run query shaping without loading the PostHog API key", async () => {
    const output = await executePosthogCommand(
      parsePosthogQueryArgs(["errors", "--recent", "24h", "--dry-run"]),
      {
        env: { POSTHOG_PROJECT_ID: "12345" },
        now: () => new Date("2026-05-04T10:10:00Z"),
      }
    );

    expect(output.request).toMatchObject({
      method: "POST",
      path: "/api/projects/12345/query/",
    });
    expect(output.meta).toMatchObject({
      dry_run: true,
      cache: { hit: false, ttl_seconds: 300 },
    });
  });

  it("uses a five-minute cache for identical queries", async () => {
    const cacheDir = await createCacheDir();
    const parsed = parsePosthogQueryArgs(["errors", "--recent", "24h"]);
    let calls = 0;

    const first = await executePosthogCommand(parsed, {
      cacheDir,
      env: TEST_ENV,
      fetchHogql: async () => {
        calls += 1;
        return POSTHOG_ERROR_RESPONSE;
      },
      now: () => new Date("2026-05-04T10:10:00Z"),
    });

    const second = await executePosthogCommand(parsed, {
      cacheDir,
      env: TEST_ENV,
      fetchHogql: async () => {
        calls += 1;
        return POSTHOG_ERROR_RESPONSE;
      },
      now: () => new Date("2026-05-04T10:11:00Z"),
    });

    expect(calls).toBe(1);
    expect(first.meta.cache.hit).toBe(false);
    expect(first.meta.cache.ttl_seconds).toBe(300);
    expect(second.meta.cache.hit).toBe(true);
  });
});

describe("public issue privacy", () => {
  it("keeps replay links and user identifiers out of public issue evidence", async () => {
    const output = await executePosthogCommand(
      parsePosthogQueryArgs([
        "match-bug-report",
        "--error-snippet",
        "garden select",
        "--privacy",
        "private",
      ]),
      {
        cacheDir: await createCacheDir(),
        env: TEST_ENV,
        fetchHogql: async () => POSTHOG_ERROR_RESPONSE,
        now: () => new Date("2026-05-04T10:10:00Z"),
      }
    );

    const publicBody = formatPublicIssueBody(output.public_issue_matches);

    expect(publicBody).toContain("Garden select failed");
    expect(publicBody).toContain("Affected sessions: 2");
    expect(publicBody).not.toContain("session-one");
    expect(publicBody).not.toContain("0xUserOne");
    expect(publicBody).not.toMatch(/replay/i);
    expect(JSON.stringify(output.public_issue_matches)).not.toContain("0xUserOne");
    expect(JSON.stringify(output.public_issue_matches)).not.toContain("session-one");
    expect(JSON.stringify(output.private_context)).toContain("0xUserOne");
    expect(JSON.stringify(output.private_context)).toContain("/replay/session-one");
  });

  it("suppresses private context entirely for public privacy mode", async () => {
    const output = await executePosthogCommand(
      parsePosthogQueryArgs([
        "match-bug-report",
        "--error-snippet",
        "garden select",
        "--privacy",
        "public",
      ]),
      {
        cacheDir: await createCacheDir(),
        env: TEST_ENV,
        fetchHogql: async () => POSTHOG_ERROR_RESPONSE,
        now: () => new Date("2026-05-04T10:10:00Z"),
      }
    );

    expect(output.private_context).toBeUndefined();
    expect(JSON.stringify(output)).not.toContain("0xUserOne");
    expect(JSON.stringify(output)).not.toContain("session-one");
  });
});
