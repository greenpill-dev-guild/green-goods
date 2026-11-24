// TEST-QUALITY: allow-small-test-file - no existing test covers the reward Safe release; its manifest rules, its factory call and its record merge are three separate subjects, and the fork rehearsal (test/fork/ArbitrumRewardSafe.t.sol) proves the deployed result.
import { readFileSync } from "node:fs";
import path from "node:path";
import { AbiCoder, Interface, ZeroAddress } from "ethers";
import { describe, expect, it } from "vitest";
import {
  HSG,
  inspectRewardSafeManifest,
  mergeRewardSafeRecord,
  type RewardSafeEntry,
  rewardSafeCall,
} from "./reward-safes-release";

const TECH_AND_SUN = "0xA2DF8Eb73444A3f3cf9b8E3749313C7471d7D5E3";
const OWNER_HAT = 2480315916136414910792148560245724935181348720173456052029169193713664n;
const STEWARD_HAT = 2480315916136414910793610061883055838099552405006172335048825126256640n;
const manifest = () => JSON.parse(readFileSync(path.join(__dirname, "../../config/reward-safes-release.json"), "utf8"));

describe("garden reward Safe release", () => {
  it("plans only checksummed Arbitrum gardens, each named once", () => {
    expect(inspectRewardSafeManifest(manifest()).gardens.length).toBeGreaterThan(0);
    const broken = [
      (m: any) => (m.chainId = 42220),
      (m: any) => (m.gardens[0].garden = m.gardens[0].garden.toLowerCase()),
      (m: any) => m.gardens.push({ ...m.gardens[0], tokenId: 99 }),
      (m: any) => m.gardens.push({ ...m.gardens[0], garden: "0x0000000000000000000000000000000000000Ab1" }),
      (m: any) => (m.ownerHat = "1"),
    ];
    for (const breakIt of broken) {
      const m = manifest();
      breakIt(m);
      expect(() => inspectRewardSafeManifest(m)).toThrow();
    }
  });

  it("asks the factory for a locked gate over the steward hat, one signer alone and two once there are two", () => {
    const call = rewardSafeCall(2, TECH_AND_SUN, OWNER_HAT, STEWARD_HAT);
    const [masterCopy, initializer, saltNonce] = new Interface([
      "function deployModule(address,bytes,uint256)",
    ]).decodeFunctionData("deployModule", call.data);
    expect(masterCopy).toBe(HSG.implementation);
    expect(String(saltNonce)).toBe(call.saltNonce);
    const [params] = new Interface(["function setUp(bytes)"]).decodeFunctionData("setUp", initializer);
    const [setup] = AbiCoder.defaultAbiCoder().decode(
      ["tuple(uint256,uint256[],address,tuple(uint8,uint120,uint120),bool,bool,address,address,address[])"],
      params,
    );
    expect(setup.toArray({ deep: true } as never)).toEqual([
      OWNER_HAT,
      [STEWARD_HAT],
      ZeroAddress,
      [0n, 1n, 2n],
      true,
      true,
      HSG.implementation,
      ZeroAddress,
      [],
    ]);
    // test/fork/ArbitrumRewardSafe.t.sol deploys this setup through the live factory and finds its gate here.
    expect(call.gate).toBe("0x0BF6DB5F18962B54b6EAF13bAc1aaFCCF7FDD431");
    expect(
      rewardSafeCall(5, "0xbcCE994513615988690aBCA373B1368218E4957C", OWNER_HAT + 1n, STEWARD_HAT + 1n).gate,
    ).not.toBe(call.gate);
  });

  it("adds a garden's Safe once and never changes or shares it", () => {
    const entry = (tokenId: number, digit: string): RewardSafeEntry => ({
      tokenId,
      garden: `0x${digit.repeat(40)}`,
      safe: `0x${`${digit}1`.repeat(20)}`,
      gate: `0x${`${digit}3`.repeat(20)}`,
      signerHat: "7",
    });
    const record = { schemaVersion: 2, chainId: 42161, description: "kept", safes: [entry(5, "5")] };
    const merged = mergeRewardSafeRecord(record, [entry(2, "2"), entry(5, "5")]);
    expect(merged.description).toBe("kept");
    expect((merged.safes as RewardSafeEntry[]).map((row) => row.tokenId)).toEqual([2, 5]);
    expect(() => mergeRewardSafeRecord(record, [{ ...entry(5, "5"), signerHat: "8" }])).toThrow(/different/);
    expect(() => mergeRewardSafeRecord(record, [{ ...entry(2, "2"), safe: entry(5, "5").safe }])).toThrow(/share/);
    expect(() => mergeRewardSafeRecord(record, [{ ...entry(2, "2"), garden: entry(5, "5").gate }])).toThrow(/share/);
    expect(() => mergeRewardSafeRecord({ ...record, schemaVersion: 1 }, [])).toThrow(/Unexpected/);
  });
});
