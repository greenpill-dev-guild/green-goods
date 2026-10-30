import { getAddress, getNumber, Interface, keccak256, toBeHex, ZeroAddress, type JsonRpcProvider } from "ethers";
import type {
  SourceBoundaryEvidence,
  SourceExecutionContext,
  SourceExecutionEnvelope,
  SourceExecutionJournal,
  SourceExecutionReadPort,
  SourceExecutionRuntime,
  SourceProxyState,
  SourcePublicReceipt,
  SourcePublicTransaction,
  SourceSafePins,
  SourceSafeState,
} from "./source-upgrade-execution-types";
import { verifySourceBoundaryEvidence } from "./source-upgrade-execution";
import {
  SOURCE_IMPLEMENTATION_SLOT,
  SOURCE_SAFE_GUARD_SLOT,
  SOURCE_SAFE_MODULE_GUARD_SLOT,
  SOURCE_UPGRADE_TARGETS,
  type SourceTarget,
  type SourceUpgradeManifest,
  type SourceUpgradePlan,
} from "./source-upgrade-release";
import { snapshotSourceUpgradeState } from "./source-upgrade-simulation";
import { voucherDigest } from "./voucher-release";

type ReadProvider = Pick<
  JsonRpcProvider,
  | "call"
  | "getCode"
  | "getStorage"
  | "getNetwork"
  | "getTransactionCount"
  | "getBlock"
  | "getTransaction"
  | "getTransactionReceipt"
>;
type ReadersInput = {
  provider: ReadProvider;
  manifest: SourceUpgradeManifest;
  abis: Partial<Record<SourceTarget, Interface>>;
};
const SENTINEL = "0x0000000000000000000000000000000000000001";
const SAFE = new Interface([
  "function getOwners() view returns(address[])",
  "function getThreshold() view returns(uint256)",
  "function nonce() view returns(uint256)",
  "function getModulesPaginated(address,uint256) view returns(address[],address)",
]);
const UUID = new Interface(["function proxiableUUID() view returns(bytes32)"]);
const targets = ["pooling", "settlement"] as const;
function equal(actual: unknown, expected: unknown, label: string) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase())
    throw new Error(`Source readback ${label} mismatch`);
}
function same(actual: unknown, expected: unknown, label: string) {
  equal(voucherDigest(actual), voucherDigest(expected), label);
}
function addressWord(word: string) {
  return getAddress(toBeHex(BigInt(word), 20));
}
function assertSafe(state: SourceSafeState, pins: SourceSafePins, manifest: SourceUpgradeManifest, nonce: number) {
  for (const key of ["runtimeHash", "singleton", "singletonRuntimeHash"] as const)
    equal(state[key], pins[key], `Safe ${key}`);
  same(state.owners, manifest.authority.owners.map(getAddress), "Safe owners");
  equal(state.threshold, manifest.authority.threshold, "Safe threshold");
  equal(state.nonce, nonce, "Safe nonce");
  equal(state.guard, ZeroAddress, "Safe guard");
  equal(state.moduleGuard, ZeroAddress, "Safe module guard");
  if (state.modules.length) throw new Error("Source readback Safe modules mismatch");
}
export function sourceUpgradeStateReaders({ provider, manifest: m, abis }: ReadersInput) {
  const abi = (target: SourceTarget) => {
    if (!m[target] || !abis[target]) throw new Error(`Missing selected source ABI ${target}`);
    return abis[target]!;
  };
  const block = async (tag: number | "latest") => {
    const value = await provider.getBlock(tag);
    if (!value?.hash || !Number.isSafeInteger(value.number) || value.number < 0)
      throw new Error("Missing canonical source block");
    if (typeof tag === "number") equal(value.number, tag, "block number");
    return { hash: value.hash, number: value.number };
  };
  const read = async (to: string, contract: Interface, method: string, at: number, args: unknown[] = []) =>
    contract.decodeFunctionResult(
      method,
      await provider.call({ to, data: contract.encodeFunctionData(method, args), blockTag: at }),
    );
  const codeHash = async (address: string, at: number) => {
    const code = await provider.getCode(address, at);
    if (code === "0x") throw new Error("Missing source runtime code");
    return keccak256(code);
  };
  const getSafeState = async (at: number): Promise<SourceSafeState> => {
    const safe = m.authority.address;
    const singleton = addressWord(await provider.getStorage(safe, 0, at));
    const modules = await read(safe, SAFE, "getModulesPaginated", at, [SENTINEL, 1]);
    equal(modules[1], SENTINEL, "Safe module sentinel");
    return {
      runtimeHash: await codeHash(safe, at),
      singleton,
      singletonRuntimeHash: await codeHash(singleton, at),
      owners: Array.from((await read(safe, SAFE, "getOwners", at))[0], (owner) => getAddress(String(owner))),
      threshold: getNumber((await read(safe, SAFE, "getThreshold", at))[0]),
      nonce: getNumber((await read(safe, SAFE, "nonce", at))[0]),
      guard: addressWord(await provider.getStorage(safe, SOURCE_SAFE_GUARD_SLOT, at)),
      moduleGuard: addressWord(await provider.getStorage(safe, SOURCE_SAFE_MODULE_GUARD_SLOT, at)),
      modules: Array.from(modules[0], (module) => getAddress(String(module))),
    };
  };
  const getProxyState = async (target: SourceTarget, at: number): Promise<SourceProxyState> => {
    const contract = abi(target),
      proxy = m[target]!.proxy;
    const preserved = Object.fromEntries(
      Object.entries(await snapshotSourceUpgradeState(provider, proxy, contract, target, at)).map(([key, value]) => [
        key,
        value.toLowerCase(),
      ]),
    );
    return {
      implementation: addressWord(await provider.getStorage(proxy, SOURCE_IMPLEMENTATION_SLOT, at)),
      owner: getAddress(contract.decodeFunctionResult("owner", preserved.owner)[0]),
      paused: (await read(proxy, contract, "paused", at))[0],
      preserved,
    };
  };
  const implementation = async (target: SourceTarget, address: string, at: number) => {
    equal((await read(address, UUID, "proxiableUUID", at))[0], SOURCE_IMPLEMENTATION_SLOT, "implementation UUID");
    if (target !== "settlement") return;
    const pin = m.settlement!,
      contract = abi(target);
    for (const [method, expected] of [
      ["CCIP_ROUTER", pin.router],
      ["getRouter", pin.router],
      ["SOURCE_CHAIN_SELECTOR", pin.sourceSelector],
      ["DESTINATION_EVM_CHAIN_ID", pin.destinationChainId],
    ])
      equal((await read(address, contract, method, at))[0], expected, `Settlement ${method}`);
  };
  const assertNewPeerPinsEmpty = async (target: SourceTarget, at: number) => {
    if (target !== "pooling") return;
    const contract = abi(target),
      proxy = m.pooling.proxy;
    equal(
      (await read(proxy, contract, "voucherServiceSetupModule", at))[0],
      ZeroAddress,
      "unbound voucher service peer",
    );
    for (const method of ["serviceOfferProtocolVersion", "voucherAcceptanceProtocolVersion"])
      equal((await read(proxy, contract, method, at))[0], 1, method);
  };
  return { block, codeHash, getSafeState, getProxyState, implementation, assertNewPeerPinsEmpty };
}

/** Observation-bound selected getters only; historical mapping entries are not enumerated. */
export async function prepareSourceUpgradeBaseline(
  input: ReadersInput & { safePins: SourceSafePins },
): Promise<SourceExecutionEnvelope["baseline"]> {
  const { provider, manifest: m, safePins } = input,
    r = sourceUpgradeStateReaders(input);
  equal((await provider.getNetwork()).chainId, m.chainId, "chain");
  const observation = await r.block(m.observation.blockNumber);
  equal(observation.hash, m.observation.blockHash, "observation hash");
  const safe = await r.getSafeState(observation.number);
  assertSafe(safe, safePins, m, m.authority.nonce!);
  const sources: SourceExecutionEnvelope["baseline"]["sources"] = {};
  for (const target of targets) {
    const pin = m[target];
    if (!pin) continue;
    const state = await r.getProxyState(target, observation.number);
    equal(state.owner, m.authority.address, `${target} owner`);
    equal(state.implementation, pin.implementation, `${target} implementation`);
    equal(
      await r.codeHash(pin.implementation, observation.number),
      pin.implementationCodeHash,
      `${target} implementation runtime`,
    );
    await r.implementation(target, pin.implementation, observation.number);
    sources[target] = state;
  }
  equal((await r.block(observation.number)).hash, observation.hash, "observation canonicality");
  return { observation: { blockNumber: observation.number, blockHash: observation.hash }, safe, sources };
}

/** Uses supplied public reads only. The host owns files, compiler regeneration and journal persistence. */
export function createSourceUpgradeReadback(
  input: Omit<ReadersInput, "manifest"> & {
    context: SourceExecutionContext;
    journal(): SourceExecutionJournal;
    regenerateBindings(): Promise<{ plan: SourceUpgradePlan; runtime: SourceExecutionRuntime }>;
  },
): SourceExecutionReadPort {
  const { provider, context: c, journal } = input,
    m = c.manifest,
    r = sourceUpgradeStateReaders({ ...input, manifest: m });
  const assertCurrentPrefixState = async (prefix: number) => {
    if (!Number.isSafeInteger(prefix) || prefix < 0 || prefix > c.plan.deployments.length + c.plan.ownerCalls.length)
      throw new Error("Invalid source prefix length");
    const head = await r.block("latest"),
      calls = c.plan.ownerCalls.slice(0, Math.max(0, prefix - c.plan.deployments.length));
    equal(await provider.getCode(m.deployer!, head.number), "0x", "deployer EOA code");
    assertSafe(
      await r.getSafeState(head.number),
      c.envelope.safePins,
      m,
      c.envelope.baseline.safe.nonce + calls.length,
    );
    for (const deployment of c.plan.deployments.slice(0, prefix)) {
      const expected = c.runtime.deployments.find(
        (row) => row.key === deployment.key && row.address.toLowerCase() === deployment.address.toLowerCase(),
      );
      if (!expected) throw new Error("Missing exact source runtime binding");
      equal(await r.codeHash(deployment.address, head.number), expected.runtimeHash, "completed CREATE runtime");
    }
    for (const target of targets) {
      const pin = m[target];
      if (!pin) continue;
      const baseline = c.envelope.baseline.sources[target];
      if (!baseline) throw new Error(`Missing selected source baseline ${target}`);
      const upgraded = calls.some((call) => call.target === target && call.action === "upgrade");
      const next = c.plan.deployments.find((deployment) => deployment.key === SOURCE_UPGRADE_TARGETS[target]);
      const expectedImplementation = upgraded ? next!.address : pin.implementation;
      const state = await r.getProxyState(target, head.number);
      equal(state.implementation, expectedImplementation, `${target} prefix implementation`);
      equal(state.owner, baseline.owner, `${target} prefix owner`);
      equal(
        state.paused,
        calls.some((call) => call.target === target && call.action === "pause") || baseline.paused,
        `${target} prefix pause`,
      );
      same(state.preserved, baseline.preserved, `${target} selected preserved getters`);
      const expectedHash = upgraded
        ? c.runtime.deployments.find((row) => row.address.toLowerCase() === expectedImplementation.toLowerCase())!
            .runtimeHash
        : pin.implementationCodeHash;
      equal(await r.codeHash(expectedImplementation, head.number), expectedHash, `${target} active runtime`);
      await r.implementation(target, expectedImplementation, head.number);
      if (upgraded) await r.assertNewPeerPinsEmpty(target, head.number);
    }
    const saved = journal();
    for (const evidence of saved.completed.slice(0, prefix)) {
      const index =
        c.envelope.boundaries.findIndex((boundary) => boundary.step === evidence.step) - c.plan.deployments.length;
      const call = c.plan.ownerCalls[index];
      if (call?.action !== "pause") continue;
      const snapshot = saved.pausedSnapshots[call.target];
      if (!snapshot) throw new Error("Missing completed source pause snapshot");
      equal((await r.block(snapshot.blockNumber)).hash, snapshot.blockHash, "pause snapshot canonicality");
      const state = await r.getProxyState(call.target, snapshot.blockNumber);
      equal(state.paused, true, "pause snapshot state");
      equal(state.owner, c.envelope.baseline.sources[call.target]!.owner, "pause snapshot owner");
      equal(voucherDigest(state.preserved), snapshot.preservedHash, "pause snapshot selected getters");
    }
    equal((await r.block(head.number)).hash, head.hash, "current prefix canonicality");
  };
  const port: SourceExecutionReadPort = {
    async revalidateBindings() {
      const regenerated = await input.regenerateBindings();
      same(regenerated.plan, c.plan, "regenerated plan");
      same(regenerated.runtime, c.runtime, "regenerated runtime");
    },
    async assertPreconditions(step, saved) {
      equal(c.envelope.boundaries[saved.completed.length]?.step, step, "next boundary");
      await port.revalidateBindings();
      same(
        await prepareSourceUpgradeBaseline({ ...input, manifest: m, safePins: c.envelope.safePins }),
        c.envelope.baseline,
        "observation baseline",
      );
      await assertCurrentPrefixState(saved.completed.length);
    },
    async reverifyCompleted(evidence: SourceBoundaryEvidence, entirePrefixLength) {
      const checked = await verifySourceBoundaryEvidence({
        ...c,
        step: evidence.step,
        transactionHash: evidence.transactionHash,
        port,
        pausedSnapshots: journal().pausedSnapshots,
        entirePrefixLength,
      });
      same(checked, evidence, "completed receipt evidence");
    },
    async getPendingNonce(from) {
      return provider.getTransactionCount(from, "pending");
    },
    async getChainId() {
      return getNumber((await provider.getNetwork()).chainId);
    },
    async getTransaction(hash): Promise<SourcePublicTransaction | null> {
      const tx = await provider.getTransaction(hash);
      if (!tx || tx.blockNumber === null || tx.blockHash === null) return null;
      if (tx.maxFeePerGas === null || tx.maxPriorityFeePerGas === null)
        throw new Error("Missing EIP-1559 source transaction fee fields");
      return {
        hash: tx.hash,
        chainId: tx.chainId,
        from: getAddress(tx.from),
        to: tx.to === null ? null : getAddress(tx.to),
        nonce: tx.nonce,
        data: tx.data,
        value: tx.value,
        gasLimit: tx.gasLimit,
        maxFeePerGas: tx.maxFeePerGas,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
        blockNumber: tx.blockNumber,
        blockHash: tx.blockHash,
      };
    },
    async getReceipt(hash): Promise<SourcePublicReceipt | null> {
      const receipt = await provider.getTransactionReceipt(hash);
      if (!receipt) return null;
      if (receipt.status !== 0 && receipt.status !== 1) throw new Error("Missing source receipt status");
      return {
        hash: receipt.hash,
        status: receipt.status,
        blockNumber: receipt.blockNumber,
        blockHash: receipt.blockHash,
        gasUsed: receipt.gasUsed,
        gasPrice: receipt.gasPrice,
        contractAddress: receipt.contractAddress,
        logs: receipt.logs.map((log) => ({ address: log.address, topics: [...log.topics], data: log.data })),
      };
    },
    getBlock: r.block,
    getCode: (address, block) => provider.getCode(address, block),
    getSafeState: r.getSafeState,
    getProxyState: r.getProxyState,
    verifyImplementationGetters: async (deployment, _manifest, block) => {
      if (deployment.kind === "implementation")
        await r.implementation(
          deployment.key === SOURCE_UPGRADE_TARGETS.settlement ? "settlement" : "pooling",
          deployment.address,
          block,
        );
    },
    assertNewPeerPinsEmpty: r.assertNewPeerPinsEmpty,
    assertCurrentPrefixState,
  };
  return port;
}
