import { describe, expect, it } from "vitest";
import en from "../../../i18n/en.json";
import es from "../../../i18n/es.json";
import pt from "../../../i18n/pt.json";
import { SEND_STAGE_WORDS, type SendStage } from "../send-stage";

// TEST-QUALITY: allow-small-test-file - the one set of stage words, pinned against each catalog the App, the Hub and the bot read

const CATALOGS = { en, es, pt } as Record<string, Record<string, string>>;
const STAGES: SendStage[] = ["wallet", "confirming", "still-confirming", "safe-signers"];
const messages = STAGES.flatMap((stage) => {
  const { label, detail, stopped } = SEND_STAGE_WORDS[stage];
  return [label, detail, stopped].filter((message) => message !== undefined);
});

describe("send stage words", () => {
  it("say each stage in the words every surface shows", () => {
    expect(STAGES.map((stage) => en[SEND_STAGE_WORDS[stage].label.id as keyof typeof en])).toEqual([
      "Confirm in your wallet",
      "Confirming…",
      "Still confirming…",
      "Waiting for the Safe's signers",
    ]);
  });

  it.each(Object.keys(CATALOGS))("has every stage's words in %s", (locale) => {
    const missing = messages.filter(({ id }) => !CATALOGS[locale]![id]?.trim());
    expect(missing).toEqual([]);
  });

  it("falls back to the English catalog's own text", () => {
    for (const { id, defaultMessage } of messages) expect(defaultMessage).toBe(CATALOGS.en![id]);
  });

  // A send past its receipt limit went out and may still land (PRD-1495).
  it("never calls a send still confirming failed, and lets the person leave", () => {
    const detail = SEND_STAGE_WORDS["still-confirming"].detail!;
    expect(CATALOGS.en![detail.id]).toMatch(/^Sent\..*You can leave/);
    expect(CATALOGS.en![detail.id]).not.toMatch(/fail|didn.t|error/i);
  });

  // The wallet may still hold a request the person stopped waiting for (PRD-1551).
  it("never says a send the person stopped waiting for was cancelled or failed", () => {
    const { stopped } = SEND_STAGE_WORDS.wallet;
    expect(CATALOGS.en![stopped!.id]).toMatch(/reject it there/);
    expect(CATALOGS.en![stopped!.id]).not.toMatch(/cancel|fail|nothing changed/i);
  });
});
