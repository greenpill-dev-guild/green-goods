import { Interface, ZeroAddress } from "ethers";
import { describe, expect, it } from "vitest";
import manifest from "../../config/clc-aiyeloja-test-pool.json";
import {
  buildCLCAiyelojaPlan,
  inspectCLCAiyelojaManifest,
  validateCLCAiyelojaPlan,
  aiyelojaMultiSendData,
  aiyelojaSafeUpload,
  AIYELOJA_TEST_SAFE,
} from "./clc-aiyeloja-release";
import { CLC_FACTORY_ABI, CLC_TOKEN_ABI } from "./clc-release";
import { existingCLCAddress } from "./clc-garden-release";
import { gardenExecutionJournal, validateGardenExecutionJournal } from "./clc-garden-execution";
import { aiyelojaGasEnvelope } from "./clc-aiyeloja-downstream";
import { voucherDigest } from "./voucher-release";
// A dependency-free data file: the deployed pin that test and QA harnesses read through Shared's `./testing` export.
import { AIYELOJA_TEST_POOL } from "../../../shared/src/__tests__/test-utils/aiyeloja-test-pool";
const revision = "a".repeat(40);
const plan = () => buildCLCAiyelojaPlan(structuredClone(manifest), revision);

describe("Aiyeloja test-only pool preparation", () => {
  it("deploys nine initialized proxies with Safe custody and no production-token calls", () => {
    const p = plan();
    expect(p.safeBatchExecutor).toEqual({
      version: "1.4.1",
      address: "0x9641d764fc13c8B624c04430C7356C1C7C8102e2",
      runtimeHash: "0xecd5bd14a08c5d2122379900b2f272bdf107a7e92423c10dd5fe3254386c9939",
      operation: 1,
    });
    expect(p.transactions).toHaveLength(9);
    expect(p.transactions.map((tx) => tx.nonce)).toEqual(Array.from({ length: 9 }, (_, i) => manifest.nonce + i));
    expect(new Set(p.transactions.map((tx) => tx.address)).size).toBe(9);
    const factory = new Interface(CLC_FACTORY_ABI);
    for (const tx of p.transactions) {
      const init = factory.decodeFunctionData("deployDeterministicAndCall", tx.data);
      expect(init[0]).toBe(tx.implementation);
      expect(init[1]).toBe(AIYELOJA_TEST_SAFE);
      expect(init[2]).toBe(tx.salt);
      expect(init[3]).toBe(tx.initializer);
      expect(tx.admin).toBe(AIYELOJA_TEST_SAFE);
      expect(tx.value).toBe("0");
    }
    for (const asset of p.assets)
      expect(
        new Interface(CLC_TOKEN_ABI).decodeFunctionData(
          "initialize",
          p.transactions.find((tx) => tx.address === asset.token)!.initializer,
        )[3],
      ).toBe(AIYELOJA_TEST_SAFE);
    const destinations = p.batches.flatMap((b) => b.calls.map((c) => c.to));
    for (const component of ["pool", "index", "greenGoodsToken", "techAndSunToken", "GnosisVoucherAdapter"])
      expect(destinations).not.toContain(existingCLCAddress(component));
    expect(p.appActivationIncluded).toBe(false);
    expect(p.liveBroadcast).toBe(false);
  });
  it("keeps mint/configuration, exact funding and automation distributions in nonce order", () => {
    const p = plan();
    expect(p.batches.map((b) => b.nonce)).toEqual([0, 1, 2]);
    expect(p.batches.map((b) => b.calls.length)).toEqual([13, 6, 3]);
    const token = new Interface(CLC_TOKEN_ABI);
    const approvals = p.batches[1].calls.filter((call) => call.to !== p.addresses.pool);
    expect(approvals).toHaveLength(3);
    for (const call of approvals) expect(token.decodeFunctionData("approve", call.data)[1]).toBe(10_000_000n);
    for (const b of p.batches) {
      const upload = aiyelojaSafeUpload(b);
      expect(upload.chainId).toBe("100");
      expect(upload.meta.createdFromSafeAddress).toBe(AIYELOJA_TEST_SAFE);
      const [packed] = new Interface(["function multiSend(bytes)"]).decodeFunctionData(
        "multiSend",
        aiyelojaMultiSendData(b),
      );
      let offset = 2;
      for (const c of upload.transactions) {
        expect(packed.slice(offset, offset + 2)).toBe("00");
        offset += 2;
        expect(`0x${packed.slice(offset, offset + 40)}`.toLowerCase()).toBe(c.to.toLowerCase());
        offset += 40;
        expect(BigInt(`0x${packed.slice(offset, offset + 64)}`)).toBe(0n);
        offset += 64;
        const bytes = Number(BigInt(`0x${packed.slice(offset, offset + 64)}`));
        offset += 64;
        expect(`0x${packed.slice(offset, offset + bytes * 2)}`).toBe(c.data);
        offset += bytes * 2;
      }
      expect(offset).toBe(packed.length);
    }
  });
  it.each([
    { chainId: 42161 },
    { testOnly: false },
    { safe: ZeroAddress },
    { garden: ZeroAddress },
    { safeOwners: [manifest.safeOwners[0], manifest.safeOwners[0]] },
    { automation: ZeroAddress },
    { nonce: -1 },
    { safeNonce: Number.MAX_SAFE_INTEGER },
    { hidden: true },
    { tokens: manifest.tokens.map((t, i) => (i ? t : { ...t, holdingCap: t.inventory })) },
    { tokens: manifest.tokens.map((t, i) => (i ? t : { ...t, supply: "101000000" })) },
    { tokens: manifest.tokens.map((t, i) => (i ? t : { ...t, symbol: "GGV" })) },
    { tokens: manifest.tokens.map((t, i) => (i ? t : { ...t, kind: "individual" })) },
  ])("rejects wrong authority, mainnet assets and unsafe test bounds: %j", (patch) => {
    expect(() => inspectCLCAiyelojaManifest({ ...structuredClone(manifest), ...patch })).toThrow();
  });
  it("predicts exactly the nine proxies deployed on Gnosis, at the pinned deployer nonces", () => {
    const p = plan();
    const pinned = [
      ...Object.entries(AIYELOJA_TEST_POOL.contracts),
      ...Object.entries(AIYELOJA_TEST_POOL.vouchers).map(([id, voucher]) => [`fixture:${id}`, voucher] as const),
    ];
    expect(p.transactions.map((tx) => [tx.component, tx.address])).toEqual(
      pinned.map(([component, pin]) => [component, pin.address]),
    );
    expect(p.addresses).toEqual(
      Object.fromEntries(Object.entries(AIYELOJA_TEST_POOL.contracts).map(([key, pin]) => [key, pin.address])),
    );
    expect(p.assets.map((a) => [a.symbol, a.token])).toEqual(
      Object.values(AIYELOJA_TEST_POOL.vouchers).map((v) => [v.symbol, v.address]),
    );
    expect([p.safe, p.garden, p.automation]).toEqual([
      AIYELOJA_TEST_POOL.safe,
      AIYELOJA_TEST_POOL.garden,
      AIYELOJA_TEST_POOL.automation,
    ]);
    const blocks = pinned.map(([, pin]) => pin.receipt.blockNumber);
    expect(blocks).toEqual([...blocks].sort((a, b) => (a < b ? -1 : 1)));
  });
  it("binds every deployment and Safe call, and keeps deterministic addresses independent of sender nonce", () => {
    const p = plan();
    validateCLCAiyelojaPlan(p, manifest, revision);
    expect(() =>
      validateCLCAiyelojaPlan(
        { ...p, safeBatchExecutor: { ...p.safeBatchExecutor, address: ZeroAddress } },
        manifest,
        revision,
      ),
    ).toThrow("plan mismatch");
    expect(() => validateCLCAiyelojaPlan({ ...p, batches: [] }, manifest, revision)).toThrow("plan mismatch");
    expect(() => validateCLCAiyelojaPlan(p, { ...manifest, safeNonce: 1 }, revision)).toThrow("plan mismatch");
    const next = buildCLCAiyelojaPlan({ ...manifest, nonce: manifest.nonce + 9 }, revision);
    expect(next.transactions.map((t) => t.address)).toEqual(p.transactions.map((t) => t.address));
    expect(next.transactions.map((t) => t.nonce)).not.toEqual(p.transactions.map((t) => t.nonce));
  });
  it("shares exact-prefix recovery while rejecting uncertain sends and plan substitution", () => {
    const p = plan(),
      journal = gardenExecutionJournal(p);
    validateGardenExecutionJournal(journal, p);
    expect(() =>
      validateGardenExecutionJournal(
        { ...journal, transactions: { [p.transactions[1].component]: `0x${"b".repeat(64)}` } },
        p,
      ),
    ).toThrow("prefix");
    expect(() => validateGardenExecutionJournal(journal, { ...p, sourceCommit: "b".repeat(40) })).toThrow();
    expect(() =>
      validateGardenExecutionJournal(
        {
          ...journal,
          pending: { component: p.transactions[1].component, nonce: p.transactions[1].nonce, transactionHash: null },
        },
        p,
      ),
    ).toThrow("pending");
  });
  it("requires complete exact-plan fork proof and rejects a gas budget above the native cap", () => {
    const p = plan();
    const proof = {
      kind: "AIYELOJA_TEST_POOL_REHEARSAL",
      evidence: "isolated-fork",
      liveBroadcast: false,
      chainId: 100,
      planHash: voucherDigest(p),
      forkBlock: 49239315,
      forkBlockHash: `0x${"b".repeat(64)}`,
      deployments: p.transactions.map((t) => ({ component: t.component, address: t.address, gasLimit: "200000" })),
      batches: p.batches,
      swaps: [{}, {}],
      unauthorizedDirectMintRejected: true,
      rejectedPrematureFunding: { status: 0 },
      rejectedHoldingCap: { status: 0 },
      unauthorizedProxyAdminRejected: true,
    };
    expect(Object.keys(aiyelojaGasEnvelope(proof, p))).toHaveLength(9);
    expect(() => aiyelojaGasEnvelope({ ...proof, liveBroadcast: true }, p)).toThrow();
    expect(() => aiyelojaGasEnvelope({ ...proof, deployments: proof.deployments.slice(1) }, p)).toThrow();
    expect(() =>
      aiyelojaGasEnvelope({ ...proof, deployments: proof.deployments.map((d) => ({ ...d, gasLimit: "20000000" })) }, p),
    ).toThrow("cap");
  });
});
