import { describe, expect, it } from "vitest";
import { sendGardenJoin } from "../../../modules/agent-reporting/garden-join";
import type { TransactionSender } from "../../../modules/transactions/types";

const ACCOUNT = "0x00000000000000000000000000000000000000a1";
const GARDEN = "0x00000000000000000000000000000000000000b2";
const HASH = `0x${"12".repeat(32)}` as `0x${string}`;

function sender(send: TransactionSender["sendContractCall"]): TransactionSender {
  return {
    authMode: "wallet",
    supportsSponsorship: false,
    supportsBatching: false,
    sendContractCall: send,
  };
}

describe("sendGardenJoin", () => {
  it("asks the owner's sender for the exact garden call", async () => {
    let called = false;
    const result = await sendGardenJoin(
      sender(async (call) => {
        expect(call).toMatchObject({
          address: GARDEN,
          account: ACCOUNT,
          functionName: "joinGarden",
          args: [],
          chainId: 42161,
          value: 0n,
        });
        called = true;
        return { hash: HASH, sponsored: false };
      }),
      { garden: GARDEN, account: ACCOUNT, chainId: 42161 }
    );
    expect(called).toBe(true);
    expect(result).toEqual({ kind: "sent" });
  });

  it("treats a declined wallet prompt as cancelled and not sent", async () => {
    const declined = sender(async () => {
      throw Object.assign(new Error("declined"), { code: 4001 });
    });
    expect(
      await sendGardenJoin(declined, { garden: GARDEN, account: ACCOUNT, chainId: 42161 })
    ).toEqual({ kind: "not_sent", cancelled: true });
  });

  it("keeps a lost response after send intent as unknown", async () => {
    const uncertain = sender(async (_call, options) => {
      await options?.onBeforeBroadcast?.();
      throw new Error("lost response");
    });
    expect(
      await sendGardenJoin(uncertain, { garden: GARDEN, account: ACCOUNT, chainId: 42161 })
    ).toEqual({ kind: "unknown" });
  });

  it("allows a clear failure before broadcast to be retried", async () => {
    const unavailable = sender(async () => {
      throw new Error("wallet unavailable");
    });
    expect(
      await sendGardenJoin(unavailable, { garden: GARDEN, account: ACCOUNT, chainId: 42161 })
    ).toEqual({ kind: "not_sent", cancelled: false });
  });
});
