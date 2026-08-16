import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { AbiCoder, getAddress, Interface, type JsonRpcProvider, keccak256, ZeroAddress } from "ethers";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertCheckpointReceiptBlock,
  assertFinalSafeState,
  assertNextBoundary,
  assertRecoverySafeConfiguration,
  assertRecoverySafeMatchesPlan,
  atomicWrite,
  buildFinalDeploymentArtifact,
  buildFinalSafeInitializer,
  type Checkpoint,
  confinedRuntimePath,
  deriveSaltNonce,
  type FinalSafePlan,
  isContractCallRevert,
  parseArguments,
  predictSafeAddress,
  type SafeInspection,
  verifyReceipt,
} from "./garden-safe-owners";

const GARDEN_ACCOUNT = "0x1111111111111111111111111111111111111111";
const GREEN_GOODS_SAFE = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19";
const DEV_GUILD_SAFE = "0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C";
const FACTORY = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67";
const SINGLETON = "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762";
const HANDLER = "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99";

const SAFE_INTERFACE = new Interface([
  "function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address payable paymentReceiver)",
]);

const temporaryDirectories: string[] = [];

function safeInspection(overrides: Partial<SafeInspection> = {}): SafeInspection {
  return {
    codePresent: true,
    singleton: getAddress(SINGLETON),
    version: "1.4.1",
    owners: [GARDEN_ACCOUNT, GREEN_GOODS_SAFE, DEV_GUILD_SAFE].map(getAddress),
    threshold: "2",
    modules: [],
    guard: ZeroAddress,
    fallbackHandler: getAddress(HANDLER),
    nonce: "0",
    nativeBalance: "0",
    tokenBalance: "0",
    ...overrides,
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("Garden Safe final owner tooling", () => {
  it("builds the exact final threshold-two Safe initializer", () => {
    const initializer = buildFinalSafeInitializer(GARDEN_ACCOUNT, GREEN_GOODS_SAFE, DEV_GUILD_SAFE);
    const decoded = SAFE_INTERFACE.decodeFunctionData("setup", initializer);

    expect([...decoded.owners]).toEqual(
      [GARDEN_ACCOUNT, GREEN_GOODS_SAFE, DEV_GUILD_SAFE]
        .map(getAddress)
        .sort((left, right) => left.toLowerCase().localeCompare(right.toLowerCase())),
    );
    expect(decoded.threshold).toBe(2n);
    expect(decoded.to).toBe(ZeroAddress);
    expect(decoded.data).toBe("0x");
    expect(decoded.fallbackHandler).toBe(getAddress(HANDLER));
    expect(decoded.paymentToken).toBe(ZeroAddress);
    expect(decoded.payment).toBe(0n);
    expect(decoded.paymentReceiver).toBe(ZeroAddress);
  });

  it("rejects duplicate or zero final owners", () => {
    expect(() => buildFinalSafeInitializer(GARDEN_ACCOUNT, GREEN_GOODS_SAFE, GREEN_GOODS_SAFE)).toThrow(
      /three unique owners/,
    );
    expect(() => buildFinalSafeInitializer(ZeroAddress, GREEN_GOODS_SAFE, DEV_GUILD_SAFE)).toThrow(
      /three unique owners/,
    );
  });

  it("derives Garden-specific salts and deterministic Safe addresses", () => {
    const gardenTwo = "0x2222222222222222222222222222222222222222";
    const initializer = buildFinalSafeInitializer(GARDEN_ACCOUNT, GREEN_GOODS_SAFE, DEV_GUILD_SAFE);
    const proxyCreationCode = "0x6080604052600080fd";

    const firstSalt = deriveSaltNonce(GARDEN_ACCOUNT);
    expect(firstSalt).not.toBe(deriveSaltNonce(gardenTwo));
    const first = predictSafeAddress(FACTORY, SINGLETON, proxyCreationCode, initializer, firstSalt);
    expect(predictSafeAddress(FACTORY, SINGLETON, proxyCreationCode, initializer, firstSalt)).toBe(first);
    expect(predictSafeAddress(FACTORY, SINGLETON, proxyCreationCode, initializer, deriveSaltNonce(gardenTwo))).not.toBe(
      first,
    );
  });

  it("exposes only plan, verify, and direct deployment commands", () => {
    expect(parseArguments(["plan"])).toMatchObject({ command: "plan", broadcast: false });
    expect(parseArguments(["verify"])).toMatchObject({ command: "verify", broadcast: false });
    expect(parseArguments(["deploy", "--broadcast", "--step", "2"])).toMatchObject({
      command: "deploy",
      broadcast: true,
      recoveryStep: 2,
    });
    expect(() => parseArguments(["deploy"])).toThrow(/requires --broadcast/);
    expect(() => parseArguments(["deploy", "--broadcast"])).toThrow(/requires one explicit --step/);
    expect(() => parseArguments(["plan", "--broadcast"])).toThrow(/does not accept/);
    expect(() => parseArguments(["verify", "--broadcast"])).toThrow(/does not accept/);
    expect(() => parseArguments(["swap-plan"])).toThrow(/plan\|verify\|deploy/);
    expect(() => parseArguments(["swap", "--broadcast", "--step", "1"])).toThrow(/plan\|verify\|deploy/);
    expect(() => parseArguments(["deploy", "--broadcast", "--private-key", "secret"])).toThrow(/Unknown argument/);
  });

  it("confines artifacts to the generated runtime directory", () => {
    expect(confinedRuntimePath(".generated/runtime/reviewed.json", "plan")).toMatch(
      /packages\/contracts\/\.generated\/runtime\/reviewed\.json$/u,
    );
    expect(() => confinedRuntimePath("../outside.json", "plan")).toThrow(/must stay inside/);
  });

  it("permits only the next uncheckpointed deployment boundary", () => {
    expect(assertNextBoundary(4, 3, "Final Safe deployment")).toBe(4);
    expect(() => assertNextBoundary(undefined, 3, "Final Safe deployment")).toThrow(/next uncheckpointed boundary 4/);
    expect(() => assertNextBoundary(5, 3, "Final Safe deployment")).toThrow(/next uncheckpointed boundary 4/);
  });

  it("writes complete JSON atomically without leaving its temporary file", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "garden-safe-owner-test-"));
    temporaryDirectories.push(directory);
    const filePath = path.join(directory, "artifact.json");

    atomicWrite(filePath, { safe: "reviewed" });

    expect(JSON.parse(fs.readFileSync(filePath, "utf8"))).toEqual({ safe: "reviewed" });
    expect(fs.readdirSync(directory)).toEqual(["artifact.json"]);
  });

  it("binds the salt domain to the source-chain Garden address", () => {
    const encoded = AbiCoder.defaultAbiCoder().encode(
      ["string", "uint64", "address"],
      ["GG_COMMITMENT_POOL_SAFE_V1", 42161, GARDEN_ACCOUNT],
    );
    expect(deriveSaltNonce(GARDEN_ACCOUNT)).toBe(BigInt(keccak256(encoded)));
  });

  it("requires exact reviewed Safe v1.4.1 recovery identities", () => {
    const recovery = safeInspection({
      owners: [
        "0x04D60647836bcA09c37B379550038BdaaFD82503",
        "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
        "0xD2838aCb302F40E06f3FDC05f5b357034113262E",
      ].map(getAddress),
    });

    expect(() => assertRecoverySafeConfiguration(recovery, SINGLETON, HANDLER)).not.toThrow();
    expect(() => assertRecoverySafeConfiguration({ ...recovery, version: "1.3.0" }, SINGLETON, HANDLER)).toThrow(
      /Safe v1.4.1/,
    );
    expect(() =>
      assertRecoverySafeConfiguration({ ...recovery, modules: [GARDEN_ACCOUNT] }, SINGLETON, HANDLER),
    ).toThrow(/Safe v1.4.1/);
    expect(() =>
      assertRecoverySafeConfiguration({ ...recovery, fallbackHandler: ZeroAddress }, SINGLETON, HANDLER),
    ).toThrow(/Safe v1.4.1/);
  });

  it("rejects a reviewed recovery Safe whose owner set changes", () => {
    const reviewed = safeInspection({
      owners: [
        "0x04D60647836bcA09c37B379550038BdaaFD82503",
        "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
        "0xD2838aCb302F40E06f3FDC05f5b357034113262E",
      ].map(getAddress),
    });
    const changed = { ...reviewed, owners: [...reviewed.owners.slice(0, 2), GARDEN_ACCOUNT].map(getAddress) };

    expect(() => assertRecoverySafeMatchesPlan(reviewed, reviewed, SINGLETON, HANDLER)).not.toThrow();
    expect(() => assertRecoverySafeMatchesPlan(changed, reviewed, SINGLETON, HANDLER)).toThrow(
      /changed after final Safe planning/,
    );
  });

  it("requires the pristine final 2-of-3 Garden Safe state", () => {
    const finalState = safeInspection();
    expect(() =>
      assertFinalSafeState(finalState, GARDEN_ACCOUNT, GREEN_GOODS_SAFE, DEV_GUILD_SAFE, SINGLETON, HANDLER),
    ).not.toThrow();
    expect(() =>
      assertFinalSafeState(
        { ...finalState, nonce: "1" },
        GARDEN_ACCOUNT,
        GREEN_GOODS_SAFE,
        DEV_GUILD_SAFE,
        SINGLETON,
        HANDLER,
      ),
    ).toThrow(/final 2-of-3 state/);
    expect(() =>
      assertFinalSafeState(
        { ...finalState, tokenBalance: "1" },
        GARDEN_ACCOUNT,
        GREEN_GOODS_SAFE,
        DEV_GUILD_SAFE,
        SINGLETON,
        HANDLER,
      ),
    ).toThrow(/final 2-of-3 state/);
    expect(() =>
      assertFinalSafeState(
        { ...finalState, modules: [GARDEN_ACCOUNT] },
        GARDEN_ACCOUNT,
        GREEN_GOODS_SAFE,
        DEV_GUILD_SAFE,
        SINGLETON,
        HANDLER,
      ),
    ).toThrow(/final 2-of-3 state/);
  });

  it("rejects checkpoint blocks that do not equal the verified receipt", () => {
    const checkpoint = {
      index: 1,
      transactionHash: `0x${"ab".repeat(32)}`,
      blockNumber: 123,
      safe: "0x4444444444444444444444444444444444444444",
      garden: GARDEN_ACCOUNT,
    };
    expect(() => assertCheckpointReceiptBlock(checkpoint, 123)).not.toThrow();
    expect(() => assertCheckpointReceiptBlock(checkpoint, 124)).toThrow(/verified receipt is block 124/);
  });

  it("distinguishes a contract revert from RPC and transport failures", () => {
    expect(isContractCallRevert({ code: "CALL_EXCEPTION" })).toBe(true);
    expect(isContractCallRevert({ code: "NETWORK_ERROR" })).toBe(false);
    expect(isContractCallRevert(new Error("timeout"))).toBe(false);
  });

  it("retries until both transaction and receipt evidence are available", async () => {
    let receiptReads = 0;
    let transactionReads = 0;
    const transactionHash = `0x${"ab".repeat(32)}`;
    const to = "0x4444444444444444444444444444444444444444";
    const data = "0x1234";
    const sender = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
    const provider = {
      getTransactionReceipt: async () => {
        receiptReads += 1;
        return receiptReads === 1 ? null : { status: 1, blockNumber: 123 };
      },
      getTransaction: async () => {
        transactionReads += 1;
        return transactionReads === 1 ? null : { from: sender, to, data, value: 0n, nonce: 7 };
      },
    } as unknown as JsonRpcProvider;

    await expect(
      verifyReceipt(
        provider,
        transactionHash,
        sender,
        { to, value: "0", data, nonce: 7 },
        {
          attempts: 2,
          wait: async () => undefined,
        },
      ),
    ).resolves.toEqual({ blockNumber: 123 });
    expect(receiptReads).toBe(2);
    expect(transactionReads).toBe(2);
  });

  it("promotes complete final deployment receipts without an owner-swap stage", () => {
    const safe = "0x4444444444444444444444444444444444444444";
    const evidence = {
      index: 1,
      transactionHash: `0x${"ab".repeat(32)}`,
      blockNumber: 123,
      safe,
      garden: GARDEN_ACCOUNT,
    };
    const plan = {
      releaseId: "commitment-pooling-settlement-credit-v1",
      releaseSourceCommit: `0x${"22".repeat(20)}`,
      singleton: SINGLETON,
      factory: FACTORY,
      compatibilityFallbackHandler: HANDLER,
      greenGoodsRecoverySafe: GREEN_GOODS_SAFE,
      devGuildRecoverySafe: DEV_GUILD_SAFE,
      valueAssertion: {
        nativeBalance: "zero",
        canonicalTokenBalance: "zero",
        arbitraryTokenInventory: "not-enumerated",
      },
      entries: [
        {
          tokenId: 0,
          garden: GARDEN_ACCOUNT,
          safe,
          owners: [GARDEN_ACCOUNT, GREEN_GOODS_SAFE, DEV_GUILD_SAFE].map(getAddress),
          threshold: "2",
          initializerHash: `0x${"11".repeat(32)}`,
          saltNonce: "1",
        },
      ],
    } as unknown as FinalSafePlan;
    const checkpoint = { completed: [evidence] } as Checkpoint;

    expect(buildFinalDeploymentArtifact(plan, checkpoint)).toMatchObject({
      stage: "final-garden-account-ownership",
      ownerPolicy: "2-of-3 exact GardenAccount plus two reviewed recovery Safes; no modules or guard",
      valueAssertion: {
        nativeBalance: "zero",
        canonicalTokenBalance: "zero",
        arbitraryTokenInventory: "not-enumerated",
      },
      safes: [
        {
          owners: expect.arrayContaining([
            getAddress(GARDEN_ACCOUNT),
            getAddress(GREEN_GOODS_SAFE),
            getAddress(DEV_GUILD_SAFE),
          ]),
          threshold: "2",
          deployment: evidence,
        },
      ],
    });
    expect(JSON.stringify(buildFinalDeploymentArtifact(plan, checkpoint))).not.toContain("ownerSwap");
  });
});
