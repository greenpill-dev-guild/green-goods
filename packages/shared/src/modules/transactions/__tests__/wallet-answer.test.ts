// TEST-QUALITY: allow-small-test-file - the senders inject this read, so only here do its account kinds meet the answer they decide.
import type { Hex } from "viem";
import { describe, expect, it, vi } from "vitest";
import { readWalletAnswer, type WalletAnswerReader } from "../wallet-answer";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const ANSWER = `0x${"5a".repeat(32)}` as Hex;
const SAFE_CODE = `0x608060405273${"ab".repeat(20)}` as Hex;

/** A chain where the account has `code`, answers `getThreshold` with `threshold`, and knows `known` transactions. */
function chain(code: Hex | undefined, threshold?: bigint, known = false): WalletAnswerReader {
  return {
    getCode: vi.fn(async () => code),
    readContract: vi.fn(async () => {
      if (threshold === undefined) throw new Error("execution reverted");
      return threshold;
    }),
    getTransaction: vi.fn(async () => {
      if (!known) throw Object.assign(new Error("not found"), { name: "TransactionNotFoundError" });
      return { hash: ANSWER };
    }),
  };
}

describe("readWalletAnswer", () => {
  it.each([
    ["a plain account", chain("0x"), "transaction"],
    ["an account with no code read", chain(undefined), "transaction"],
    [
      "an account an EIP-7702 delegation upgraded",
      chain(`0xef0100${"cd".repeat(20)}`),
      "transaction",
    ],
    ["a smart account that is not a Safe", chain(SAFE_CODE), "transaction"],
    [
      "a Safe whose answer the network runs as a transaction",
      chain(SAFE_CODE, 1n, true),
      "transaction",
    ],
    ["a Safe whose answer no transaction has: its proposal", chain(SAFE_CODE, 2n), "safe-proposal"],
  ] as const)("reads %s as a %s", async (_case, reader, expected) => {
    await expect(readWalletAnswer(reader, ACCOUNT, ANSWER)).resolves.toBe(expected);
  });

  it("leaves the answer a transaction when the account cannot be read", async () => {
    const reader = chain(SAFE_CODE, 1n);
    vi.mocked(reader.getCode).mockRejectedValue(new Error("rpc down"));
    await expect(readWalletAnswer(reader, ACCOUNT, ANSWER)).resolves.toBe("transaction");
  });

  // PRD-957: a short proposal id names no transaction, and the node refuses to look it up.
  it.each([
    ["a Safe", chain(SAFE_CODE, 2n), "safe-proposal"],
    ["a plain account", chain("0x"), "transaction"],
  ] as const)("reads a short id from %s as a %s", async (_case, reader, expected) => {
    const shortId = `0x${"5a".repeat(20)}` as Hex;
    vi.mocked(reader.getTransaction).mockRejectedValue(new Error("invalid argument 0: hex string"));
    await expect(readWalletAnswer(reader, ACCOUNT, shortId)).resolves.toBe(expected);
  });
});
