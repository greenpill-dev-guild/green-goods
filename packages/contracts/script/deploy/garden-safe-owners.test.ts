import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { AbiCoder, dataSlice, getAddress, Interface, keccak256, ZeroAddress } from "ethers";
import { afterEach, describe, expect, it } from "vitest";
import {
  atomicWrite,
  buildBootstrapInitializer,
  buildSwapExecutionData,
  confinedRuntimePath,
  deriveSaltNonce,
  parseArguments,
  predictSafeAddress,
  prevalidatedSignature,
  previousOwner,
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
});
