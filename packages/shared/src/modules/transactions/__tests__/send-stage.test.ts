import { describe, expect, it } from "vitest";
import en from "../../../i18n/en.json";
import es from "../../../i18n/es.json";
import pt from "../../../i18n/pt.json";
import { SEND_STAGE_WORDS, type SendStage } from "../send-stage";

// TEST-QUALITY: allow-small-test-file - the one set of stage words, pinned against each catalog the App, the Hub and the bot read

const CATALOGS = { en, es, pt } as Record<string, Record<string, string>>;
const STAGES: SendStage[] = ["wallet", "confirming", "still-confirming"];
const messages = STAGES.flatMap((stage) => {
  const { label, detail } = SEND_STAGE_WORDS[stage];
  return detail ? [label, detail] : [label];
});

describe("send stage words", () => {
  it("say each stage in the words every surface shows", () => {
    expect(STAGES.map((stage) => en[SEND_STAGE_WORDS[stage].label.id as keyof typeof en])).toEqual([
      "Confirm in your wallet",
      "Confirming…",
      "Still confirming…",
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
    const { detail } = SEND_STAGE_WORDS["still-confirming"];
    expect(CATALOGS.en![detail.id]).toMatch(/^Sent\..*You can leave/);
    expect(CATALOGS.en![detail.id]).not.toMatch(/fail|didn.t|error/i);
  });
});
