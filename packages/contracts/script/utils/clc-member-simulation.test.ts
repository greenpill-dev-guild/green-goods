/**
 * Pure adoption/readback boundary proof; the simulation runner has separate owned-fork evidence.
 * @direct-test-subject ./clc-member-adoption
 * @direct-test-subject ./clc-member-readback
 */
import {
  type Block,
  getAddress,
  Interface,
  type TransactionReceipt,
  type TransactionRequest,
  type TransactionResponse,
  zeroPadValue,
} from "ethers";
import { describe, expect, it } from "vitest";
import { verifyCLCAdoptionPrefix } from "./clc-member-adoption";
import { getCLCProxyRuntime, verifyCLCMemberInitialState } from "./clc-member-readback";
import { buildCLCReleasePlan } from "./clc-member-release";
import {
  memberFixtureAddress as address,
  memberFixtureRevision as revision,
  memberPlannerArtifact,
  memberReleaseFixture,
} from "./clc-member.fixtures";
import {
  CLC_DEPENDENCIES,
  CLC_FACTORY_ABI,
  CLC_INDEX_ABI,
  CLC_LIMITER_ABI,
  CLC_QUOTER_ABI,
  CLC_TOKEN_ABI,
} from "./clc-release";

function fixture() {
  const manifest = memberReleaseFixture();
  const plan = buildCLCReleasePlan(manifest, memberPlannerArtifact(), revision);
  if (plan.schemaVersion !== 2) throw new Error("Expected member plan");
  return { manifest, plan };
}
function receiptFixture(count: number) {
  const { manifest, plan } = fixture();
  const records = plan.transactions.map((expected, index) => {
    const hash = `0x${(index + 1).toString(16).padStart(64, "0")}`;
    const blockHash = `0x${(index + 100).toString(16).padStart(64, "0")}`;
    const tx = {
      hash,
      chainId: 100n,
      from: expected.from,
      to: expected.to,
      nonce: expected.nonce,
      value: 0n,
      data: expected.data,
      blockNumber: 500 + index,
      blockHash,
    } as TransactionResponse;
    const receipt = {
      hash,
      from: expected.from,
      to: expected.to,
      status: 1,
      blockNumber: tx.blockNumber,
      blockHash,
      contractAddress: expected.to === null ? expected.address : null,
    } as TransactionReceipt;
    return { tx, receipt, code: index < count ? "0x6000" : "0x" };
  });
  const hashes = Object.fromEntries(
    plan.transactions.slice(0, count).map((row, index) => [row.component, records[index].tx.hash]),
  );
  const client = {
    getTransaction: async (hash: string) => records.find((row) => row.tx.hash === hash)?.tx ?? null,
    getTransactionReceipt: async (hash: string) => records.find((row) => row.tx.hash === hash)?.receipt ?? null,
    getBlock: async (number: unknown) =>
      ({ hash: records.find((row) => row.receipt.blockNumber === number)?.receipt.blockHash }) as Block,
    getCode: async (target: unknown) =>
      records[plan.transactions.findIndex((row) => row.address === target)]?.code ?? "0x",
  };
  return { manifest, plan, records, hashes, client };
}
describe("member preparation receipt adoption", () => {
  it("accepts a wholly new candidate without inventing a prior receipt", async () => {
    const f = receiptFixture(0);
    expect(await verifyCLCAdoptionPrefix(f.client, f.plan)).toEqual([]);
  });
  it("adopts all ten exact base receipts without asking to replay their transactions", async () => {
    const f = receiptFixture(10);
    const rows = await verifyCLCAdoptionPrefix(f.client, f.plan, { transactions: f.hashes });
    expect(rows).toHaveLength(10);
    expect(rows.map((row) => row.transactionHash)).toEqual(Object.values(f.hashes));
    expect(rows.every((row) => row.adopted)).toBe(true);
    expect(f.plan.transactions.slice(rows.length).map((tx) => tx.component)).toEqual([
      "member:analyst-peer-help:token",
      "member:engineer-peer-help:token",
    ]);
  });
  it("also adopts a completed member prefix for an interrupted second member deployment", async () => {
    const f = receiptFixture(11);
    const rows = await verifyCLCAdoptionPrefix(f.client, f.plan, { transactions: f.hashes });
    expect(rows.at(-1)?.component).toBe("member:analyst-peer-help:token");
    expect(f.plan.transactions.slice(rows.length).map((tx) => tx.nonce)).toEqual([14]);
  });
  it.each([
    "sender",
    "target",
    "nonce",
    "value",
    "calldata",
    "chain",
    "failed",
    "receiptSender",
    "receiptTarget",
    "createAddress",
    "reorg",
    "blockMismatch",
    "codeMissing",
  ])("rejects prior %s evidence instead of adopting it", async (kind) => {
    const f = receiptFixture(1);
    const { tx, receipt } = f.records[0];
    if (kind === "sender") Reflect.set(tx, "from", address(901));
    if (kind === "target") Reflect.set(tx, "to", address(901));
    if (kind === "nonce") Reflect.set(tx, "nonce", tx.nonce + 1);
    if (kind === "value") Reflect.set(tx, "value", 1n);
    if (kind === "calldata") Reflect.set(tx, "data", `${tx.data}00`);
    if (kind === "chain") Reflect.set(tx, "chainId", 42161n);
    if (kind === "failed") Reflect.set(receipt, "status", 0);
    if (kind === "receiptSender") Reflect.set(receipt, "from", address(901));
    if (kind === "receiptTarget") Reflect.set(receipt, "to", address(901));
    if (kind === "createAddress") Reflect.set(receipt, "contractAddress", address(901));
    if (kind === "reorg") f.client.getBlock = async () => ({ hash: `0x${"9".repeat(64)}` }) as Block;
    if (kind === "blockMismatch") Reflect.set(tx, "blockNumber", 600);
    if (kind === "codeMissing") f.records[0].code = "0x";
    await expect(verifyCLCAdoptionPrefix(f.client, f.plan, { transactions: f.hashes })).rejects.toThrow();
  });
  it("rejects matching but malformed block evidence", async () => {
    const f = receiptFixture(1);
    Reflect.set(f.records[0].tx, "blockHash", "malformed");
    Reflect.set(f.records[0].receipt, "blockHash", "malformed");
    await expect(verifyCLCAdoptionPrefix(f.client, f.plan, { transactions: f.hashes })).rejects.toThrow("canonical");
  });
  it("refuses existing code without its original receipt", async () => {
    const f = receiptFixture(1);
    await expect(verifyCLCAdoptionPrefix(f.client, f.plan)).rejects.toThrow("exact canonical receipt");
  });
  it("rejects receipt gaps, unknown keys and invalid hashes", async () => {
    const f = receiptFixture(2);
    f.records[0].code = "0x";
    delete f.hashes[f.plan.transactions[0].component];
    await expect(verifyCLCAdoptionPrefix(f.client, f.plan, { transactions: f.hashes })).rejects.toThrow("contiguous");
    await expect(
      verifyCLCAdoptionPrefix(f.client, f.plan, { transactions: { foreign: `0x${"1".repeat(64)}` } }),
    ).rejects.toThrow("Unknown");
    await expect(
      verifyCLCAdoptionPrefix(f.client, f.plan, { transactions: { [f.plan.transactions[0].component]: "" } }),
    ).rejects.toThrow("hash");
  });
});

function readbackFixture() {
  const { manifest, plan } = fixture();
  const factoryAbi = new Interface([
    ...CLC_FACTORY_ABI,
    "function changeAdmin(address,address)",
    "function upgrade(address,address)",
  ]);
  const tokenAbi = new Interface(CLC_TOKEN_ABI);
  const indexAbi = new Interface(CLC_INDEX_ABI);
  const limitAbi = new Interface(CLC_LIMITER_ABI);
  const quoteAbi = new Interface([...CLC_QUOTER_ABI, "function priceIndex(address) view returns(uint256)"]);
  const state = {
    owner: manifest.members.assets[0].ownerReserve!,
    writer: false,
    supply: 0n,
    allowance: 0n,
    registered: false,
    cap: 0n,
    price: 0n,
    implementation: CLC_DEPENDENCIES.token.address as string,
    admin: manifest.members.assets[0].ownerReserve!,
    permitUnapprovedAdmin: false,
    reinitialize: false,
    proxy: getCLCProxyRuntime(),
    transportFailure: false,
  };
  const calls: Array<{ from: string; method: string }> = [];
  const revert = () => {
    throw Object.assign(new Error("Fictional EVM revert"), { code: "CALL_EXCEPTION" });
  };
  const provider = {
    getCode: async () => state.proxy,
    getStorage: async () => zeroPadValue(state.implementation, 32),
    call: async (request: TransactionRequest) => {
      const to = String(await request.to);
      const data = String(await request.data);
      const first = plan.memberAssets[0];
      if (to === CLC_DEPENDENCIES.factory.address) {
        const parsed = factoryAbi.parseTransaction({ data });
        if (!parsed) throw new Error("Unknown factory call");
        const asset = plan.memberAssets.find((row) => row.token === parsed.args[0]);
        if (!asset) throw new Error("Unknown member token");
        if (parsed.name === "adminOf")
          return factoryAbi.encodeFunctionResult("adminOf", [asset === first ? state.admin : asset.admin]);
        const from = String(await request.from);
        calls.push({ from, method: parsed.name });
        if (from !== asset.ownerReserve && state.transportFailure) throw new Error("RPC unavailable");
        if (from !== asset.ownerReserve && !state.permitUnapprovedAdmin) revert();
        return "0x";
      }
      const asset = plan.memberAssets.find((row) => row.token === to);
      if (asset) {
        const parsed = tokenAbi.parseTransaction({ data });
        if (!parsed) throw new Error("Unknown token call");
        if (parsed.name === "initialize") return state.reinitialize ? "0x" : revert();
        const edited = asset === first;
        const result: Record<string, unknown> = {
          owner: edited ? state.owner : asset.ownerReserve,
          name: asset.name,
          symbol: asset.symbol,
          decimals: 6,
          expired: false,
          totalSupply: edited ? state.supply : 0n,
          totalMinted: 0n,
          totalBurned: 0n,
          balanceOf: 0n,
          allowance: edited ? state.allowance : 0n,
          isWriter:
            getAddress(parsed.args.length ? parsed.args[0] : asset.ownerReserve) === asset.ownerReserve ||
            (edited && state.writer),
        };
        return tokenAbi.encodeFunctionResult(parsed.name, [result[parsed.name]]);
      }
      if (to === plan.addresses.index) return indexAbi.encodeFunctionResult("have", [state.registered]);
      if (to === plan.addresses.limiter) return limitAbi.encodeFunctionResult("limitOf", [state.cap]);
      if (to === plan.addresses.quoter) return quoteAbi.encodeFunctionResult("priceIndex", [state.price]);
      throw new Error("Unexpected readback request");
    },
  };
  return { manifest, plan, state, provider, calls };
}
describe("member preparation exact readback", () => {
  it("verifies atomic member custody, direct factory controls and unconfigured state without sending a transaction", async () => {
    const f = readbackFixture();
    const rows = await verifyCLCMemberInitialState(f.provider, f.plan, f.manifest);
    expect(rows.map((row) => row.ownerReserve)).toEqual(f.plan.memberAssets.map((asset) => asset.ownerReserve));
    expect(rows.every((row) => row.initialSupply === "0" && row.initialAllowance === "0")).toBe(true);
    expect(
      f.calls.filter((call) => call.from === f.plan.memberAssets[0].ownerReserve).map((call) => call.method),
    ).toEqual(expect.arrayContaining(["changeAdmin", "upgrade"]));
  });
  it.each([
    "owner",
    "writer",
    "supply",
    "allowance",
    "registry",
    "cap",
    "price",
    "implementation",
    "admin",
    "proxy",
    "unapprovedAdmin",
    "reinitialize",
  ])("rejects altered %s state", async (kind) => {
    const f = readbackFixture();
    if (kind === "owner") f.state.owner = address(900);
    if (kind === "writer") f.state.writer = true;
    if (kind === "supply") f.state.supply = 1n;
    if (kind === "allowance") f.state.allowance = 1n;
    if (kind === "registry") f.state.registered = true;
    if (kind === "cap") f.state.cap = 1n;
    if (kind === "price") f.state.price = 1n;
    if (kind === "implementation") f.state.implementation = address(900);
    if (kind === "admin") f.state.admin = address(900);
    if (kind === "proxy") f.state.proxy += "00";
    if (kind === "unapprovedAdmin") f.state.permitUnapprovedAdmin = true;
    if (kind === "reinitialize") f.state.reinitialize = true;
    const errors: Record<string, string> = {
      owner: "member owner",
      writer: "no inherited member writer",
      supply: "member totalSupply",
      allowance: "no initial member allowance",
      registry: "unregistered member token",
      cap: "no initial member holding cap",
      price: "no initial member price index",
      implementation: "member implementation",
      admin: "member factory administrator",
      proxy: "exact member proxy runtime",
      unapprovedAdmin: "Unapproved actor",
      reinitialize: "accepted reinitialization",
    };
    await expect(verifyCLCMemberInitialState(f.provider, f.plan, f.manifest)).rejects.toThrow(errors[kind]);
  });
  it("does not misclassify transport failure as proof that an unapproved actor reverted", async () => {
    const f = readbackFixture();
    f.state.transportFailure = true;
    await expect(verifyCLCMemberInitialState(f.provider, f.plan, f.manifest)).rejects.toThrow("RPC unavailable");
  });
});
