/**
 * Topic env-var parsing — `TELEGRAM_BUGS_TOPIC` / `TELEGRAM_IDEAS_TOPIC`.
 *
 * The agent reads one env var per `CaptureType` and tags captured rows with
 * the matching `inferredType`. A bad parse silently drops the entry (logs a
 * warn) so a misconfigured env var disables that one topic without crashing.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadCaptureTopicsFromEnv, loadConfig, parseTopicEnvVar, validateConfig } from "../config";

describe("parseTopicEnvVar", () => {
  it("returns undefined for unset / blank values", () => {
    expect(parseTopicEnvVar("TELEGRAM_BUGS_TOPIC", undefined, "bug")).toBeUndefined();
    expect(parseTopicEnvVar("TELEGRAM_BUGS_TOPIC", "", "bug")).toBeUndefined();
    expect(parseTopicEnvVar("TELEGRAM_BUGS_TOPIC", "   ", "bug")).toBeUndefined();
  });

  it("parses chat_id_thread_id with the supergroup -100 prefix intact", () => {
    expect(parseTopicEnvVar("TELEGRAM_BUGS_TOPIC", "-1002847752257_311", "bug")).toEqual({
      chatId: "-1002847752257",
      threadId: "311",
      inferredType: "bug",
    });
  });

  it("uses the LAST underscore as the thread-id separator (chat ids may have leading minus)", () => {
    // The parser splits on the last underscore so negative chat ids work.
    expect(parseTopicEnvVar("TELEGRAM_IDEAS_TOPIC", "-1002847752257_312", "idea")).toEqual({
      chatId: "-1002847752257",
      threadId: "312",
      inferredType: "idea",
    });
  });

  it("trims whitespace", () => {
    expect(parseTopicEnvVar("TELEGRAM_BUGS_TOPIC", "  -100_311  ", "bug")).toEqual({
      chatId: "-100",
      threadId: "311",
      inferredType: "bug",
    });
  });

  it("drops values missing the underscore separator", () => {
    expect(parseTopicEnvVar("TELEGRAM_BUGS_TOPIC", "-1002847752257", "bug")).toBeUndefined();
    expect(parseTopicEnvVar("TELEGRAM_BUGS_TOPIC", "311", "bug")).toBeUndefined();
  });

  it("drops values with empty chat_id or thread_id", () => {
    expect(parseTopicEnvVar("TELEGRAM_BUGS_TOPIC", "_311", "bug")).toBeUndefined();
    expect(parseTopicEnvVar("TELEGRAM_BUGS_TOPIC", "-100_", "bug")).toBeUndefined();
  });
});

describe("loadCaptureTopicsFromEnv", () => {
  const ORIGINAL_BUGS = process.env.TELEGRAM_BUGS_TOPIC;
  const ORIGINAL_IDEAS = process.env.TELEGRAM_IDEAS_TOPIC;

  beforeEach(() => {
    delete process.env.TELEGRAM_BUGS_TOPIC;
    delete process.env.TELEGRAM_IDEAS_TOPIC;
  });

  afterEach(() => {
    if (ORIGINAL_BUGS === undefined) delete process.env.TELEGRAM_BUGS_TOPIC;
    else process.env.TELEGRAM_BUGS_TOPIC = ORIGINAL_BUGS;
    if (ORIGINAL_IDEAS === undefined) delete process.env.TELEGRAM_IDEAS_TOPIC;
    else process.env.TELEGRAM_IDEAS_TOPIC = ORIGINAL_IDEAS;
  });

  it("returns an empty list when both env vars are unset (group capture disabled)", () => {
    expect(loadCaptureTopicsFromEnv()).toEqual([]);
  });

  it("loads only the topic that's set when one env var is missing", () => {
    process.env.TELEGRAM_BUGS_TOPIC = "-1002847752257_311";
    expect(loadCaptureTopicsFromEnv()).toEqual([
      { chatId: "-1002847752257", threadId: "311", inferredType: "bug" },
    ]);
  });

  it("loads both bug and idea topics when both env vars are set", () => {
    process.env.TELEGRAM_BUGS_TOPIC = "-1002847752257_311";
    process.env.TELEGRAM_IDEAS_TOPIC = "-1002847752257_312";
    expect(loadCaptureTopicsFromEnv()).toEqual([
      { chatId: "-1002847752257", threadId: "311", inferredType: "bug" },
      { chatId: "-1002847752257", threadId: "312", inferredType: "idea" },
    ]);
  });

  it("dedupes when both env vars point at the same chat+thread (keeps the first)", () => {
    process.env.TELEGRAM_BUGS_TOPIC = "-100_311";
    process.env.TELEGRAM_IDEAS_TOPIC = "-100_311";
    expect(loadCaptureTopicsFromEnv()).toEqual([
      { chatId: "-100", threadId: "311", inferredType: "bug" },
    ]);
  });

  it("drops malformed values silently and loads the well-formed ones", () => {
    process.env.TELEGRAM_BUGS_TOPIC = "not-valid";
    process.env.TELEGRAM_IDEAS_TOPIC = "-1002847752257_312";
    expect(loadCaptureTopicsFromEnv()).toEqual([
      { chatId: "-1002847752257", threadId: "312", inferredType: "idea" },
    ]);
  });
});

describe("loadConfig analytics env", () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const ORIGINAL_ANALYTICS_ENABLED = process.env.ANALYTICS_ENABLED;
  const ORIGINAL_POSTHOG_AGENT_KEY = process.env.POSTHOG_AGENT_KEY;
  const ORIGINAL_VITE_POSTHOG_AGENT_KEY = process.env.VITE_POSTHOG_AGENT_KEY;
  const ORIGINAL_SENTRY_AGENT_DSN = process.env.SENTRY_AGENT_DSN;
  const ORIGINAL_SENTRY_DSN = process.env.SENTRY_DSN;
  const ORIGINAL_SENTRY_ENABLED = process.env.SENTRY_ENABLED;
  const ORIGINAL_SENTRY_TRACES_SAMPLE_RATE = process.env.SENTRY_TRACES_SAMPLE_RATE;
  const ORIGINAL_SENTRY_RELEASE = process.env.SENTRY_RELEASE;
  const ORIGINAL_FLY_MACHINE_VERSION = process.env.FLY_MACHINE_VERSION;
  const ORIGINAL_AGENT_ALLOWED_ORIGINS = process.env.AGENT_ALLOWED_ORIGINS;
  const ORIGINAL_AGENT_PUBLIC_ALLOWED_ORIGINS = process.env.AGENT_PUBLIC_ALLOWED_ORIGINS;

  afterEach(() => {
    if (ORIGINAL_NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    if (ORIGINAL_ANALYTICS_ENABLED === undefined) delete process.env.ANALYTICS_ENABLED;
    else process.env.ANALYTICS_ENABLED = ORIGINAL_ANALYTICS_ENABLED;
    if (ORIGINAL_POSTHOG_AGENT_KEY === undefined) delete process.env.POSTHOG_AGENT_KEY;
    else process.env.POSTHOG_AGENT_KEY = ORIGINAL_POSTHOG_AGENT_KEY;
    if (ORIGINAL_VITE_POSTHOG_AGENT_KEY === undefined) delete process.env.VITE_POSTHOG_AGENT_KEY;
    else process.env.VITE_POSTHOG_AGENT_KEY = ORIGINAL_VITE_POSTHOG_AGENT_KEY;
    if (ORIGINAL_SENTRY_AGENT_DSN === undefined) delete process.env.SENTRY_AGENT_DSN;
    else process.env.SENTRY_AGENT_DSN = ORIGINAL_SENTRY_AGENT_DSN;
    if (ORIGINAL_SENTRY_DSN === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = ORIGINAL_SENTRY_DSN;
    if (ORIGINAL_SENTRY_ENABLED === undefined) delete process.env.SENTRY_ENABLED;
    else process.env.SENTRY_ENABLED = ORIGINAL_SENTRY_ENABLED;
    if (ORIGINAL_SENTRY_TRACES_SAMPLE_RATE === undefined) {
      delete process.env.SENTRY_TRACES_SAMPLE_RATE;
    } else {
      process.env.SENTRY_TRACES_SAMPLE_RATE = ORIGINAL_SENTRY_TRACES_SAMPLE_RATE;
    }
    if (ORIGINAL_SENTRY_RELEASE === undefined) delete process.env.SENTRY_RELEASE;
    else process.env.SENTRY_RELEASE = ORIGINAL_SENTRY_RELEASE;
    if (ORIGINAL_FLY_MACHINE_VERSION === undefined) delete process.env.FLY_MACHINE_VERSION;
    else process.env.FLY_MACHINE_VERSION = ORIGINAL_FLY_MACHINE_VERSION;
    if (ORIGINAL_AGENT_ALLOWED_ORIGINS === undefined) delete process.env.AGENT_ALLOWED_ORIGINS;
    else process.env.AGENT_ALLOWED_ORIGINS = ORIGINAL_AGENT_ALLOWED_ORIGINS;
    if (ORIGINAL_AGENT_PUBLIC_ALLOWED_ORIGINS === undefined) {
      delete process.env.AGENT_PUBLIC_ALLOWED_ORIGINS;
    } else {
      process.env.AGENT_PUBLIC_ALLOWED_ORIGINS = ORIGINAL_AGENT_PUBLIC_ALLOWED_ORIGINS;
    }
  });

  it("uses POSTHOG_AGENT_KEY as the only agent analytics token", () => {
    process.env.NODE_ENV = "production";
    process.env.ANALYTICS_ENABLED = "true";
    process.env.POSTHOG_AGENT_KEY = "server-agent-token";
    process.env.VITE_POSTHOG_AGENT_KEY = "browser-style-token";

    const config = loadConfig();

    expect(config.analyticsEnabled).toBe(true);
    expect(config.posthogApiKey).toBe("server-agent-token");
  });

  it("ignores VITE_POSTHOG_AGENT_KEY when POSTHOG_AGENT_KEY is absent", () => {
    process.env.NODE_ENV = "production";
    process.env.ANALYTICS_ENABLED = "true";
    delete process.env.POSTHOG_AGENT_KEY;
    process.env.VITE_POSTHOG_AGENT_KEY = "browser-style-token";

    const config = loadConfig();

    expect(config.analyticsEnabled).toBe(true);
    expect(config.posthogApiKey).toBeUndefined();
  });

  it("loads agent Sentry config from server-only env vars", () => {
    process.env.NODE_ENV = "production";
    process.env.SENTRY_AGENT_DSN = "https://agent@sentry.io/1";
    process.env.SENTRY_TRACES_SAMPLE_RATE = "0.25";
    process.env.SENTRY_RELEASE = "green-goods-agent@test";

    const config = loadConfig();

    expect(config.sentryEnabled).toBe(true);
    expect(config.sentryDsn).toBe("https://agent@sentry.io/1");
    expect(config.sentryTracesSampleRate).toBe(0.25);
    expect(config.sentryRelease).toBe("green-goods-agent@test");
  });

  it("uses the Fly machine version as the agent Sentry release fallback", () => {
    process.env.NODE_ENV = "production";
    process.env.SENTRY_AGENT_DSN = "https://agent@sentry.io/1";
    delete process.env.SENTRY_RELEASE;
    process.env.FLY_MACHINE_VERSION = "fly-version-123";

    const config = loadConfig();

    expect(config.sentryRelease).toBe("fly-version-123");
  });

  it("falls back to the standard SENTRY_DSN when SENTRY_AGENT_DSN is absent", () => {
    process.env.NODE_ENV = "production";
    delete process.env.SENTRY_AGENT_DSN;
    process.env.SENTRY_DSN = "https://standard@sentry.io/1";

    const config = loadConfig();

    expect(config.sentryDsn).toBe("https://standard@sentry.io/1");
  });

  it("uses the public origin alias when the canonical origin env is blank", () => {
    process.env.AGENT_ALLOWED_ORIGINS = "";
    process.env.AGENT_PUBLIC_ALLOWED_ORIGINS = "https://admin.greengoods.app";

    const config = loadConfig();

    expect(config.publicAllowedOrigins).toBe("https://admin.greengoods.app");
  });
});

describe("production Saved Offers configuration", () => {
  const ENV_KEYS = [
    "NODE_ENV",
    "TELEGRAM_BOT_TOKEN",
    "BOT_MODE",
    "TELEGRAM_WEBHOOK_SECRET",
    "ENCRYPTION_SECRET",
    "AGENT_ALLOWED_ORIGINS",
    "SAVED_OFFERS_ENCRYPTION_KEY",
    "SAVED_OFFERS_AUDIENCE",
    "JOIN_REQUESTS_ENCRYPTION_KEY",
    "AGENT_TRUSTED_PROXY_HOPS",
    "AGENT_TRUSTED_PROXY_CIDRS",
  ] as const;
  const original = new Map<string, string | undefined>(
    ENV_KEYS.map((key) => [key, process.env[key]])
  );

  beforeEach(() => {
    process.env.NODE_ENV = "production";
    process.env.TELEGRAM_BOT_TOKEN = "1:production-token";
    process.env.BOT_MODE = "webhook";
    process.env.TELEGRAM_WEBHOOK_SECRET = "webhook-secret";
    process.env.ENCRYPTION_SECRET = "a".repeat(32);
    process.env.AGENT_ALLOWED_ORIGINS = "https://greengoods.app";
    process.env.SAVED_OFFERS_ENCRYPTION_KEY = "b".repeat(64);
    process.env.SAVED_OFFERS_AUDIENCE = "agent.greengoods.app";
    process.env.JOIN_REQUESTS_ENCRYPTION_KEY = "c".repeat(64);
    process.env.AGENT_TRUSTED_PROXY_HOPS = "1";
    process.env.AGENT_TRUSTED_PROXY_CIDRS = "10.0.0.0/8";
  });

  afterEach(() => {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it.each([
    ["SAVED_OFFERS_ENCRYPTION_KEY", "SAVED_OFFERS_ENCRYPTION_KEY"],
    ["SAVED_OFFERS_AUDIENCE", "SAVED_OFFERS_AUDIENCE"],
    ["JOIN_REQUESTS_ENCRYPTION_KEY", "JOIN_REQUESTS_ENCRYPTION_KEY"],
    ["AGENT_TRUSTED_PROXY_HOPS", "AGENT_TRUSTED_PROXY_HOPS"],
    ["AGENT_TRUSTED_PROXY_CIDRS", "AGENT_TRUSTED_PROXY_CIDRS"],
  ] as const)("fails startup when %s is missing", (envKey, message) => {
    delete process.env[envKey];
    expect(() => validateConfig(loadConfig())).toThrow(message);
  });

  it("accepts the complete production Saved Offers configuration", () => {
    expect(() => validateConfig(loadConfig())).not.toThrow();
  });
});
