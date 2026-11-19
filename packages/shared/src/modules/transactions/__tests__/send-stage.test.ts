import { describe, expect, it, vi } from "vitest";
import en from "../../../i18n/en.json";
import es from "../../../i18n/es.json";
import pt from "../../../i18n/pt.json";
import { SEND_STAGE_WORDS, type SendStage, withSendStageReports } from "../send-stage";

// TEST-QUALITY: allow-small-test-file - the one set of stage words, pinned against each catalog the App, the Hub and the bot read, and when a send says them

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
    const { detail } = SEND_STAGE_WORDS["still-confirming"];
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

describe("withSendStageReports", () => {
  const OPERATION = `0x${"0a".repeat(32)}` as const;
  const TX = `0x${"0b".repeat(32)}` as const;

  // A passkey's UserOperation is accepted long before its receipt and its onBroadcast (PRD-1552).
  it("says confirming once the network has a passkey's operation, not after its receipt", async () => {
    const report = vi.fn();
    const options = withSendStageReports({}, "passkey", report);
    await options.onBeforeBroadcast?.({ kind: "user-operation", hash: OPERATION });
    await options.onBroadcastReference?.({ kind: "user-operation", hash: OPERATION });
    expect(report.mock.calls).toEqual([[{ stage: "confirming", txHash: OPERATION }]]);
    await options.onBroadcast?.(TX);
    expect(report).toHaveBeenCalledOnce();
  });

  it("says a wallet's two stages once each, after the send's own callbacks", async () => {
    const order: string[] = [];
    const options = withSendStageReports(
      {
        onBeforeBroadcast: async () => void order.push("checkpoint: before"),
        onBroadcastReference: async () => void order.push("checkpoint: reference"),
        onBroadcast: async () => void order.push("checkpoint: broadcast"),
      },
      "wallet",
      ({ stage }) => order.push(`stage: ${stage}`)
    );
    await options.onBeforeBroadcast?.();
    await options.onBroadcastReference?.({ kind: "transaction", hash: TX });
    await options.onBroadcast?.(TX);
    expect(order).toEqual([
      "checkpoint: before",
      "stage: wallet",
      "checkpoint: reference",
      "stage: confirming",
      "checkpoint: broadcast",
    ]);
  });
});
