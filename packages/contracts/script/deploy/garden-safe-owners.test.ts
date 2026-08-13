import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { AbiCoder, dataSlice, getAddress, Interface, keccak256, type JsonRpcProvider, ZeroAddress } from "ethers";
import { afterEach, describe, expect, it } from "vitest";
import {
  atomicWrite,
  assertBootstrapState,
  assertSwappedState,
  assertUniqueReplacementOwners,
  buildBootstrapInitializer,
  buildSwappedDeploymentArtifact,
  buildSwapExecutionData,
  confinedRuntimePath,
  deriveSaltNonce,
  isContractCallRevert,
  parseArguments,
  predictSafeAddress,
  prevalidatedSignature,
  previousOwner,
  type BootstrapPlan,
  type Checkpoint,
  type SafeInspection,
  type SwapPlan,
  verifyReceipt,
} from "./garden-safe-owners";

const DEPLOYMENT_OWNER = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
const RECOVERY_SAFE = "0x49fa954B6C2Cd14B4b3604EF1Cc17cED20a9E42C";
const REPLACEMENT_OWNER = "0x1111111111111111111111111111111111111111";
const FACTORY = "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67";
const SINGLETON = "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762";
const HANDLER = "0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99";
const SAFE_SENTINEL = "0x0000000000000000000000000000000000000001";

const SAFE_INTERFACE = new Interface([
  "function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address payable paymentReceiver)",
  "function swapOwner(address prevOwner,address oldOwner,address newOwner)",
  "function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address payable refundReceiver,bytes signatures) returns (bool success)",
]);

const temporaryDirectories: string[] = [];

function safeInspection(owners: string[], nonce: string): SafeInspection {
  return {
    codePresent: true,
    singleton: getAddress(SINGLETON),
    version: "1.4.1",
    owners: owners.map(getAddress),
    threshold: "1",
    modules: [],
    guard: ZeroAddress,
    fallbackHandler: getAddress(HANDLER),
    nonce,
    nativeBalance: "0",
    tokenBalance: "0",
  };
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("Garden Safe temporary owner tooling", () => {
  it("builds the exact empty threshold-one Safe initializer", () => {
    const initializer = buildBootstrapInitializer(DEPLOYMENT_OWNER, RECOVERY_SAFE);
    const decoded = SAFE_INTERFACE.decodeFunctionData("setup", initializer);

    expect([...decoded.owners]).toEqual(
      [getAddress(DEPLOYMENT_OWNER), getAddress(RECOVERY_SAFE)].sort((left, right) =>
        left.toLowerCase().localeCompare(right.toLowerCase()),
      ),
    );
    expect(decoded.threshold).toBe(1n);
    expect(decoded.to).toBe(ZeroAddress);
    expect(decoded.data).toBe("0x");
    expect(decoded.fallbackHandler).toBe(getAddress(HANDLER));
    expect(decoded.paymentToken).toBe(ZeroAddress);
    expect(decoded.payment).toBe(0n);
    expect(decoded.paymentReceiver).toBe(ZeroAddress);
  });

  it("derives Garden-specific salts and deterministic Safe addresses", () => {
    const gardenOne = "0x2222222222222222222222222222222222222222";
    const gardenTwo = "0x3333333333333333333333333333333333333333";
    const initializer = buildBootstrapInitializer(DEPLOYMENT_OWNER, RECOVERY_SAFE);
    const proxyCreationCode = "0x6080604052600080fd";

    const firstSalt = deriveSaltNonce(gardenOne);
    expect(firstSalt).not.toBe(deriveSaltNonce(gardenTwo));
    const first = predictSafeAddress(FACTORY, SINGLETON, proxyCreationCode, initializer, firstSalt);
    expect(predictSafeAddress(FACTORY, SINGLETON, proxyCreationCode, initializer, firstSalt)).toBe(first);
    expect(predictSafeAddress(FACTORY, SINGLETON, proxyCreationCode, initializer, deriveSaltNonce(gardenTwo))).not.toBe(
      first,
    );
  });

  it("encodes one self-call that swaps only the deployment owner", () => {
    const safe = "0x4444444444444444444444444444444444444444";
    const owners = [getAddress(RECOVERY_SAFE), getAddress(DEPLOYMENT_OWNER)];
    const built = buildSwapExecutionData(safe, owners, DEPLOYMENT_OWNER, REPLACEMENT_OWNER);
    const outer = SAFE_INTERFACE.decodeFunctionData("execTransaction", built.data);
    const inner = SAFE_INTERFACE.decodeFunctionData("swapOwner", outer.data);

    expect(built.previousOwner).toBe(getAddress(RECOVERY_SAFE));
    expect(outer.to).toBe(getAddress(safe));
    expect(outer.value).toBe(0n);
    expect(outer.operation).toBe(0n);
    expect(inner.prevOwner).toBe(getAddress(RECOVERY_SAFE));
    expect(inner.oldOwner).toBe(getAddress(DEPLOYMENT_OWNER));
    expect(inner.newOwner).toBe(getAddress(REPLACEMENT_OWNER));
    expect(outer.signatures).toBe(prevalidatedSignature(DEPLOYMENT_OWNER));
  });

  it("uses the Safe sentinel for the first owner and rejects invalid replacements", () => {
    const owners = [getAddress(DEPLOYMENT_OWNER), getAddress(RECOVERY_SAFE)];
    expect(previousOwner(owners, DEPLOYMENT_OWNER)).toBe(SAFE_SENTINEL);
    expect(() => previousOwner(owners, REPLACEMENT_OWNER)).toThrow(/is absent/);
    expect(() =>
      buildSwapExecutionData("0x4444444444444444444444444444444444444444", owners, DEPLOYMENT_OWNER, RECOVERY_SAFE),
    ).toThrow(/Invalid replacement owner/);
  });

  it("produces the Safe prevalidated signature shape", () => {
    const signature = prevalidatedSignature(DEPLOYMENT_OWNER);
    expect(signature.length).toBe(132);
    expect(getAddress(dataSlice(signature, 12, 32))).toBe(getAddress(DEPLOYMENT_OWNER));
    expect(BigInt(dataSlice(signature, 32, 64))).toBe(0n);
    expect(dataSlice(signature, 64)).toBe("0x01");
  });

  it("confines artifacts and parses only the reviewed CLI surface", () => {
    expect(confinedRuntimePath(".generated/runtime/reviewed.json", "plan")).toMatch(
      /packages\/contracts\/\.generated\/runtime\/reviewed\.json$/u,
    );
    expect(() => confinedRuntimePath("../outside.json", "plan")).toThrow(/must stay inside/);
    expect(parseArguments(["deploy", "--broadcast", "--step", "2", "--receipt", `0x${"ab".repeat(32)}`])).toMatchObject(
      { command: "deploy", broadcast: true, recoveryStep: 2 },
    );
    expect(() => parseArguments(["deploy"])).toThrow(/requires --broadcast/);
    expect(() => parseArguments(["plan", "--broadcast"])).toThrow(/does not accept/);
    expect(() => parseArguments(["swap", "--broadcast", "--private-key", "secret"])).toThrow(/Unknown argument/);
    expect(() => parseArguments(["deploy", "--broadcast", "--step", "2"])).toThrow(/supplied together/);
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
    const garden = "0x2222222222222222222222222222222222222222";
    const encoded = AbiCoder.defaultAbiCoder().encode(
      ["string", "uint64", "address"],
      ["GG_COMMITMENT_POOL_SAFE_V1", 42161, garden],
    );
    expect(deriveSaltNonce(garden)).toBe(BigInt(keccak256(encoded)));
  });

  it("requires pristine bootstrap and exactly one owner-swap transaction", () => {
    const bootstrap = safeInspection([DEPLOYMENT_OWNER, RECOVERY_SAFE], "0");
    const swapped = safeInspection([REPLACEMENT_OWNER, RECOVERY_SAFE], "1");

    expect(() => assertBootstrapState(bootstrap, DEPLOYMENT_OWNER, RECOVERY_SAFE, SINGLETON, HANDLER)).not.toThrow();
    expect(() =>
      assertBootstrapState({ ...bootstrap, nonce: "2" }, DEPLOYMENT_OWNER, RECOVERY_SAFE, SINGLETON, HANDLER),
    ).toThrow(/bootstrap state/);
    expect(() => assertSwappedState(swapped, REPLACEMENT_OWNER, RECOVERY_SAFE, SINGLETON, HANDLER)).not.toThrow();
    expect(() =>
      assertSwappedState({ ...swapped, nonce: "3" }, REPLACEMENT_OWNER, RECOVERY_SAFE, SINGLETON, HANDLER),
    ).toThrow(/post-swap state/);
  });

  it("rejects replacement-owner reuse across Gardens", () => {
    expect(() =>
      assertUniqueReplacementOwners([
        {
          garden: "0x2222222222222222222222222222222222222222",
          safe: "0x4444444444444444444444444444444444444444",
          replacementOwner: REPLACEMENT_OWNER,
        },
        {
          garden: "0x3333333333333333333333333333333333333333",
          safe: "0x5555555555555555555555555555555555555555",
          replacementOwner: REPLACEMENT_OWNER,
        },
      ]),
    ).toThrow(/reuses one replacement owner/);
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
    const provider = {
      getTransactionReceipt: async () => {
        receiptReads += 1;
        return receiptReads === 1 ? null : { status: 1, blockNumber: 123 };
      },
      getTransaction: async () => {
        transactionReads += 1;
        return transactionReads === 1 ? null : { from: DEPLOYMENT_OWNER, to, data, value: 0n, nonce: 7 };
      },
    } as unknown as JsonRpcProvider;

    await expect(
      verifyReceipt(
        provider,
        transactionHash,
        DEPLOYMENT_OWNER,
        { to, value: "0", data, nonce: 7 },
        { attempts: 2, wait: async () => undefined },
      ),
    ).resolves.toEqual({ blockNumber: 123 });
    expect(receiptReads).toBe(2);
    expect(transactionReads).toBe(2);
  });

  it("promotes complete swap receipts and final owners into the durable artifact", () => {
    const garden = "0x2222222222222222222222222222222222222222";
    const safe = "0x4444444444444444444444444444444444444444";
    const evidence = {
      index: 1,
      transactionHash: `0x${"ab".repeat(32)}`,
      blockNumber: 123,
      safe,
      garden,
    };
    const bootstrap = {
      factory: FACTORY,
      recoverySafe: RECOVERY_SAFE,
      entries: [{ tokenId: 0, garden, safe, initializerHash: `0x${"11".repeat(32)}`, saltNonce: "1" }],
    } as unknown as BootstrapPlan;
    const plan = {
      releaseId: "commitment-pooling-settlement-credit-v1",
      releaseSourceCommit: `0x${"22".repeat(20)}`,
      singleton: SINGLETON,
      compatibilityFallbackHandler: HANDLER,
      recoverySafe: RECOVERY_SAFE,
      entries: [{ garden, safe, replacementOwner: REPLACEMENT_OWNER }],
    } as unknown as SwapPlan;
    const checkpoint = { completed: [evidence] } as Checkpoint;

    expect(buildSwappedDeploymentArtifact(plan, bootstrap, checkpoint, checkpoint)).toMatchObject({
      stage: "reviewed-owner-swap-complete",
      ownerPolicy: "1-of-2 unique per-Garden owner plus 2-of-3 recovery Safe; no value or modules",
      safes: [
        {
          owners: expect.arrayContaining([getAddress(REPLACEMENT_OWNER), getAddress(RECOVERY_SAFE)]),
          deployment: evidence,
          ownerSwap: evidence,
        },
      ],
    });
  });
});
