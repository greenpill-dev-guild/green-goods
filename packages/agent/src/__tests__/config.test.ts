/**
 * Topic env-var parsing — `TELEGRAM_BUGS_TOPIC` / `TELEGRAM_IDEAS_TOPIC`.
 *
 * The agent reads one env var per `CaptureType` and tags captured rows with
 * the matching `inferredType`. A bad parse silently drops the entry (logs a
 * warn) so a misconfigured env var disables that one topic without crashing.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadCaptureTopicsFromEnv, parseTopicEnvVar } from "../config";

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
