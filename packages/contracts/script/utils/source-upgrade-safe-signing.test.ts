/**
 * @direct-test-subject ./source-upgrade-safe-signing
 * @direct-test-subject ./source-upgrade-safe-operator
 * @direct-test-subject ./source-upgrade-safe-execution
 * @direct-test-subject ./source-upgrade-execution
 * @direct-test-subject ./source-upgrade-execution-store
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Interface, Wallet } from "ethers";
import { describe, expect, it, vi } from "vitest";
import * as cast from "./cast-env";
import { resolveCommand } from "../cli/operations.mjs";
import { sourceSafeSigningFixture } from "./source-upgrade-safe-signing.fixtures";
import {
  assertSourceSignedSafeCalldata,
  sourceSafeSignature,
  sourceSafeSignedCalldata,
} from "./source-upgrade-safe-signing";
import { collectSourceSafeSignature, sourceSafeSignArgs, sourceSafeSendArgs } from "./source-upgrade-safe-operator";
import { sourceSafeTransactionHash, verifySourceSafeReceipt } from "./source-upgrade-safe-execution";
import { runSourceExecutionBoundary, sourceBoundaryIntentHash } from "./source-upgrade-execution";
import { createSourceExecutionStore, SOURCE_EXECUTION_FILES } from "./source-upgrade-execution-store";
import type { SourceExecutionJournal } from "./source-upgrade-execution-types";

describe("source Safe owner signing and bound submission", () => {
  it("adopts the indexed execution hash emitted by the observed Safe singleton", async () => {
    const f = await sourceSafeSigningFixture();
    const events = new Interface(["event ExecutionSuccess(bytes32 indexed txHash,uint256 payment)"]);
    const event = events.encodeEventLog(events.getEvent("ExecutionSuccess")!, [f.signatures[0].safeTransactionHash, 0]);
    const receipt = (await f.port.getReceipt(f.transactionHash))!;
    receipt.logs = [{ address: f.context.manifest.authority.address, ...event }];
    await expect(
      verifySourceSafeReceipt(
        {
          ...f.context,
          step: 2,
          transactionHash: f.transactionHash,
          port: f.port,
          recordMatchedAttempt: async () => {},
        },
        receipt,
        2,
      ),
    ).resolves.toBe(f.signatures[0].safeTransactionHash);
  });
  it("rejects an indexed failure even when an indexed success is also present", async () => {
    const f = await sourceSafeSigningFixture();
    const events = new Interface([
      "event ExecutionSuccess(bytes32 indexed txHash,uint256 payment)",
      "event ExecutionFailure(bytes32 indexed txHash,uint256 payment)",
    ]);
    const receipt = (await f.port.getReceipt(f.transactionHash))!;
    receipt.logs = ["ExecutionSuccess", "ExecutionFailure"].map((name) => ({
      address: f.context.manifest.authority.address,
      ...events.encodeEventLog(events.getEvent(name)!, [f.signatures[0].safeTransactionHash, 0]),
    }));
    await expect(
      verifySourceSafeReceipt(
        {
          ...f.context,
          step: 2,
          transactionHash: f.transactionHash,
          port: f.port,
          recordMatchedAttempt: async () => {},
        },
        receipt,
        2,
      ),
    ).rejects.toThrow("one successful");
  });
  it("accepts signatures in either file order and produces canonical sorted Safe calldata", async () => {
    const f = await sourceSafeSigningFixture();
    expect(sourceSafeSignedCalldata(f.context, 2, [...f.signatures].reverse())).toBe(f.data);
    expect(() => assertSourceSignedSafeCalldata(f.context, 2, f.data)).not.toThrow();
    expect(f.signatures[0].safeTransactionHash).toBe(
      sourceSafeTransactionHash(
        f.context.plan.ownerCalls[0],
        f.context.envelope.boundaries[1],
        f.context.manifest.authority.address,
      ),
    );
  });
  it("rejects duplicate, foreign, wrong-domain, malformed and stale owner approvals", async () => {
    const f = await sourceSafeSigningFixture();
    expect(() => sourceSafeSignedCalldata(f.context, 2, [f.signatures[0], f.signatures[0]])).toThrow("distinct");
    const foreign = await Wallet.createRandom().signTypedData(
      f.typed.domain,
      { SafeTx: f.typed.types.SafeTx },
      f.typed.message,
    );
    expect(() => sourceSafeSignature(f.context, 2, foreign)).toThrow("original owner");
    const wrongChain = await f.wallets[0].signTypedData(
      { ...f.typed.domain, chainId: 1 },
      { SafeTx: f.typed.types.SafeTx },
      f.typed.message,
    );
    expect(() => sourceSafeSignature(f.context, 2, wrongChain)).toThrow("original owner");
    for (const change of [
      { step: 3 },
      { sourceCommit: "b".repeat(40) },
      { envelopeHash: "0".repeat(64) },
      { owner: f.wallets[2].address },
    ])
      expect(() =>
        sourceSafeSignedCalldata(f.context, 2, [{ ...f.signatures[0], ...change }, f.signatures[1]]),
      ).toThrow("reviewed boundary");
    expect(() => sourceSafeSignature(f.context, 2, "0x1234")).toThrow("65-byte");
    expect(() => sourceSafeSignedCalldata(f.context, 2, [f.signatures[0]])).toThrow("exactly two");
  });
  it("keeps owner keystore selection separate from the fixed outer deployer and nonce", async () => {
    const f = await sourceSafeSigningFixture();
    expect(sourceSafeSignArgs("owner-wallet", "/public/request.json")).toEqual([
      "wallet",
      "sign",
      "/public/request.json",
      "--data",
      "--from-file",
      "--account",
      "owner-wallet",
    ]);
    expect(() => sourceSafeSignArgs("../other-wallet", "request.json")).toThrow("alias");
    const args = sourceSafeSendArgs(f.context, 2, f.data, "https://public.invalid");
    for (const [flag, value] of [
      ["--from", f.context.manifest.deployer!],
      ["--account", "green-goods-deployer"],
      ["--nonce", "1040"],
      ["--gas-limit", "2000000"],
      ["--gas-price", "50000000"],
      ["--priority-gas-price", "0"],
      ["--chain", "42161"],
      ["--value", "0"],
    ])
      expect(args[args.indexOf(flag) + 1]).toBe(value);
    expect(args.slice(-2)).toEqual([f.context.manifest.authority.address, f.data]);
  });
  it("does not inherit deployer identity or password selectors when an owner signs", async () => {
    const f = await sourceSafeSigningFixture(),
      dir = fs.mkdtempSync("/private/tmp/source-safe-owner-env-");
    vi.stubEnv("ETH_FROM", f.context.manifest.deployer!);
    vi.stubEnv("ETH_PASSWORD", "public-fixture-selector");
    const signer = vi.spyOn(cast, "execCastCaptured").mockImplementation((args, options) => {
      expect(args.slice(-2)).toEqual(["--account", "owner-wallet"]);
      expect(options.env?.ETH_FROM).toBeUndefined();
      expect(options.env?.ETH_PASSWORD).toBeUndefined();
      return f.signatures[0].signature;
    });
    try {
      expect(
        collectSourceSafeSignature(f.context, 2, {
          account: "owner-wallet",
          typedDataPath: path.join(dir, "typed.json"),
        }).owner,
      ).toBe(f.wallets[0].address);
      expect(signer).toHaveBeenCalledTimes(1);
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllEnvs();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it("proves Cast's installed typed-data signing interoperates using only an isolated encrypted fixture", async () => {
    const f = await sourceSafeSigningFixture(),
      dir = fs.mkdtempSync("/private/tmp/source-safe-cast-");
    try {
      const request = path.join(dir, "typed.json"),
        keyfile = path.join(dir, "synthetic-wallet.json");
      fs.writeFileSync(request, JSON.stringify(f.typed));
      const encrypted = JSON.parse(await f.wallets[0].encrypt("public-test-fixture-password"));
      encrypted.crypto = encrypted.Crypto;
      delete encrypted.Crypto;
      fs.writeFileSync(keyfile, JSON.stringify(encrypted));
      const signature = execFileSync(
        "cast",
        [
          "wallet",
          "sign",
          request,
          "--data",
          "--from-file",
          "--keystore",
          keyfile,
          "--password",
          "public-test-fixture-password",
        ],
        { encoding: "utf8", env: { PATH: process.env.PATH } },
      ).trim();
      expect(sourceSafeSignature(f.context, 2, signature).owner).toBe(f.wallets[0].address);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it("persists a Safe intent before sending, verifies its receipt and never sends a completed boundary twice", async () => {
    const f = await sourceSafeSigningFixture(),
      writes: SourceExecutionJournal[] = [];
    const submit = vi.fn(async () => {
      expect(writes.at(-1)?.pending?.dataHash).toBe(sourceBoundaryIntentHash(f.context, 2));
      expect(writes.at(-1)?.pending?.nonce).toBe(1040);
      return f.transactionHash;
    });
    const preflight = vi.fn(async () => {});
    const input = {
      ...f.context,
      step: 2,
      expectedNonce: 1040,
      port: f.port,
      journal: f.journal,
      writeJournal: async (j: SourceExecutionJournal) => {
        writes.push(structuredClone(j));
      },
      safeSubmission: { data: f.data, preflight, submit },
    };
    expect((await runSourceExecutionBoundary(input)).state).toBe("verified");
    expect(f.journal.pending).toBeUndefined();
    expect((await runSourceExecutionBoundary(input)).state).toBe("already-verified");
    expect(submit).toHaveBeenCalledTimes(1);
    expect(preflight).toHaveBeenCalledTimes(1);
  });
  it("does not create a pending spend when the signed call preflight fails", async () => {
    const f = await sourceSafeSigningFixture(),
      submit = vi.fn(async () => f.transactionHash);
    await expect(
      runSourceExecutionBoundary({
        ...f.context,
        step: 2,
        expectedNonce: 1040,
        port: f.port,
        journal: f.journal,
        writeJournal: async () => {},
        safeSubmission: {
          data: f.data,
          preflight: async () => {
            throw Error("signed Safe rejected");
          },
          submit,
        },
      }),
    ).rejects.toThrow("signed Safe rejected");
    expect(f.journal.pending).toBeUndefined();
    expect(submit).not.toHaveBeenCalled();
  });
  it("rechecks the outer pending nonce after signed-call simulation", async () => {
    const f = await sourceSafeSigningFixture(),
      submit = vi.fn(async () => f.transactionHash);
    let nonce = 1040;
    f.port.getPendingNonce = async () => nonce;
    await expect(
      runSourceExecutionBoundary({
        ...f.context,
        step: 2,
        expectedNonce: 1040,
        port: f.port,
        journal: f.journal,
        writeJournal: async () => {},
        safeSubmission: {
          data: f.data,
          preflight: async () => {
            nonce++;
          },
          submit,
        },
      }),
    ).rejects.toThrow("nonce drift after Safe simulation");
    expect(f.journal.pending).toBeUndefined();
    expect(submit).not.toHaveBeenCalled();
  });
  it("retains an ambiguous Safe send and can adopt its exact receipt without another signer", async () => {
    const f = await sourceSafeSigningFixture(),
      submit = vi.fn(async (): Promise<string> => {
        throw Error("lost response");
      });
    const input = {
      ...f.context,
      step: 2,
      expectedNonce: 1040,
      port: f.port,
      journal: f.journal,
      writeJournal: async () => {},
      safeSubmission: { data: f.data, preflight: async () => {}, submit },
    };
    await expect(runSourceExecutionBoundary(input)).rejects.toThrow("lost response");
    await expect(runSourceExecutionBoundary(input)).rejects.toThrow("ambiguous previous submit");
    expect(submit).toHaveBeenCalledTimes(1);
    expect(
      (await runSourceExecutionBoundary({ ...input, safeSubmission: undefined, receiptHash: f.transactionHash })).state,
    ).toBe("verified");
  });
  it("reloads a bound Safe pending journal and rejects a mutated intent hash", async () => {
    const f = await sourceSafeSigningFixture(),
      dir = fs.mkdtempSync("/private/tmp/source-safe-journal-");
    try {
      f.journal.pending = {
        step: 2,
        from: f.context.manifest.deployer!,
        nonce: 1040,
        dataHash: sourceBoundaryIntentHash(f.context, 2),
        gasLimit: "2000000",
        maxFeeWei: "50000000",
      };
      const file = path.join(dir, SOURCE_EXECUTION_FILES.journal);
      fs.writeFileSync(file, JSON.stringify(f.journal));
      expect(createSourceExecutionStore({ directory: dir, context: f.context }).readJournal().pending?.nonce).toBe(
        1040,
      );
      f.journal.pending.dataHash = `0x${"0".repeat(64)}`;
      fs.writeFileSync(file, JSON.stringify(f.journal));
      expect(() => createSourceExecutionStore({ directory: dir, context: f.context }).readJournal()).toThrow(
        "pending intent binding",
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
  it("requires explicit signer inputs and signature files while rejecting signer overrides on submission", () => {
    const base = [
      "release",
      "source-upgrades",
      "--plan",
      "p.json",
      "--rehearsal",
      "r.json",
      "--envelope",
      "e.json",
      "--step",
      "24",
      "--expected-nonce",
      "1062",
    ];
    expect(() => resolveCommand([...base, "--mode", "sign-safe"])).toThrow("Select one owner");
    expect(() => resolveCommand([...base, "--mode", "sign-safe", "--signer-account", "owner-one"])).not.toThrow();
    expect(() =>
      resolveCommand([...base, "--mode", "broadcast-safe", "--signature-one", "a.json", "--signature-two", "b.json"]),
    ).not.toThrow();
    expect(() => resolveCommand([...base, "--mode", "broadcast-safe", "--signature-one", "a.json"])).toThrow(
      "signature-two",
    );
    expect(() =>
      resolveCommand([
        ...base,
        "--mode",
        "broadcast-safe",
        "--signature-one",
        "a.json",
        "--signature-two",
        "b.json",
        "--signer-account",
        "other",
      ]),
    ).toThrow("Unexpected");
  });
});
