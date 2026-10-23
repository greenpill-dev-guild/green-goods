import { Contract, getAddress, Interface, JsonRpcProvider, keccak256, toQuantity, ZeroAddress } from "ethers";
import { assertIsolatedRpc, maskImmutableRuntime, minedIsolatedReceipt, startIsolatedFork } from "./isolated-fork";
import {
  SOURCE_IMPLEMENTATION_SLOT,
  SOURCE_SAFE_GUARD_SLOT,
  SOURCE_SAFE_MODULE_GUARD_SLOT,
  SOURCE_UPGRADE_TARGETS,
  type SourceTarget,
  type SourceUpgradeArtifacts,
  type SourceUpgradeManifest,
  type SourceUpgradePlan,
  validateSourceUpgradePlan,
} from "./source-upgrade-release";

const SAFE_ABI = [
  "function getOwners() view returns(address[])",
  "function getThreshold() view returns(uint256)",
  "function nonce() view returns(uint256)",
  "function getModulesPaginated(address,uint256) view returns(address[],address)",
];
const PRESERVED: Record<SourceTarget, string[]> = {
  pooling: [
    "owner",
    "hatsModule",
    "gardenToken",
    "commitmentRegistry",
    "actionRegistry",
    "workApprovalResolver",
    "eas",
    "workSchemaUID",
    "workApprovalSchemaUID",
    "legacyAssessmentSchemaUID",
    "assessmentV3SchemaUID",
    "nextPoolId",
    "nextCycleId",
    "nextCommitmentId",
    "nextCommitmentSeriesId",
    "protocolPoolId",
    "rootGarden",
  ],
  settlement: [
    "owner",
    "hatsModule",
    "commitmentPoolingModule",
    "protocolGarden",
    "gDollarToken",
    "gardenerDeliveryEnabled",
    "batchSizeLimit",
    "dispatcher",
    "feeReserveMinimum",
    "ccipRoute",
    "creditRegistry",
    "nativeFeeBalance",
  ],
};
function equal(actual: unknown, expected: unknown, label: string) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase())
    throw new Error(`Source upgrade simulation ${label} mismatch`);
}
async function snapshot(provider: JsonRpcProvider, proxy: string, abi: Interface, names: string[]) {
  const rows: Record<string, string> = {};
  for (const name of names) rows[name] = await provider.call({ to: proxy, data: abi.encodeFunctionData(name, []) });
  return rows;
}
/** Every mutation targets this process's owned loopback; upstream receives read-only fork requests. */
export async function simulateSourceUpgradePlan(
  plan: SourceUpgradePlan,
  m: SourceUpgradeManifest,
  artifacts: SourceUpgradeArtifacts,
  upstream: string,
) {
  validateSourceUpgradePlan(plan, m, artifacts, plan.sourceCommit);
  const fork = await startIsolatedFork(upstream, 42161);
  assertIsolatedRpc(fork.rpc);
  const provider = new JsonRpcProvider(fork.rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  provider.pollingInterval = 10;
  try {
    if ((await provider.getCode(m.deployer!)) !== "0x")
      throw new Error("Source deployment sender must be an EOA without code");
    for (const tag of ["latest", "pending"])
      equal(
        Number(await provider.send("eth_getTransactionCount", [m.deployer, tag])),
        m.nonce,
        `deployer ${tag} nonce`,
      );
    if ((await provider.getCode(m.authority.address)) === "0x") throw new Error("Missing source owner Safe code");
    const safe = new Contract(m.authority.address, SAFE_ABI, provider);
    const owners = Array.from(await safe.getOwners(), (o) => getAddress(o as string));
    equal(JSON.stringify(owners), JSON.stringify(m.authority.owners.map(getAddress)), "Safe owners");
    equal(await safe.getThreshold(), m.authority.threshold, "Safe threshold");
    equal(await safe.nonce(), m.authority.nonce, "Safe nonce");
    const modules = await safe.getModulesPaginated("0x0000000000000000000000000000000000000001", 1);
    equal(modules[0].length, 0, "Safe modules");
    equal(modules[1], "0x0000000000000000000000000000000000000001", "Safe module sentinel");
    for (const slot of [SOURCE_SAFE_GUARD_SLOT, SOURCE_SAFE_MODULE_GUARD_SLOT])
      equal(BigInt(await provider.getStorage(m.authority.address, slot)), 0n, "Safe guard");
    const before: Partial<Record<SourceTarget, Record<string, string>>> = {};
    for (const target of ["pooling", "settlement"] as const) {
      const pin = m[target];
      if (!pin) continue;
      equal(
        getAddress(`0x${(await provider.getStorage(pin.proxy, SOURCE_IMPLEMENTATION_SLOT)).slice(-40)}`),
        getAddress(pin.implementation),
        `${target} implementation`,
      );
      equal(
        keccak256(await provider.getCode(pin.implementation)),
        pin.implementationCodeHash,
        `${target} implementation code`,
      );
      const abi = new Interface(artifacts[SOURCE_UPGRADE_TARGETS[target]].abi);
      const core = new Contract(pin.proxy, abi, provider);
      equal(await core.owner(), m.authority.address, `${target} owner`);
      before[target] = await snapshot(provider, pin.proxy, abi, PRESERVED[target]);
      if (target === "settlement") {
        equal(await core.CCIP_ROUTER(), m.settlement!.router, "Settlement router");
        equal(await core.getRouter(), m.settlement!.router, "Settlement receiver router");
        equal(await core.SOURCE_CHAIN_SELECTOR(), m.settlement!.sourceSelector, "Settlement source selector");
        equal(await core.DESTINATION_EVM_CHAIN_ID(), m.settlement!.destinationChainId, "Settlement destination chain");
      }
    }
    for (const from of [m.deployer!, m.authority.address]) {
      await provider.send("anvil_impersonateAccount", [from]);
      await provider.send("anvil_setBalance", [from, toQuantity(100n * 10n ** 18n)]);
    }
    const deployments = [];
    for (const tx of plan.deployments) {
      equal(await provider.getCode(tx.address), "0x", "unused CREATE address");
      equal(
        Number(await provider.send("eth_getTransactionCount", [tx.from, "pending"])),
        tx.nonce,
        "deployment boundary nonce",
      );
      const gas = await provider.estimateGas({ from: tx.from, data: tx.data, value: 0n });
      const hash = await provider.send("eth_sendTransaction", [
        {
          from: tx.from,
          nonce: toQuantity(tx.nonce),
          data: tx.data,
          value: "0x0",
          gas: toQuantity((gas * 130n + 99n) / 100n),
        },
      ]);
      const receipt = await minedIsolatedReceipt(provider, hash);
      equal(receipt.status, 1, "deployment receipt");
      equal(receipt.contractAddress, tx.address, "CREATE address");
      const code = await provider.getCode(tx.address);
      equal(
        keccak256(maskImmutableRuntime(code, tx.immutableReferences)),
        keccak256(maskImmutableRuntime(tx.runtimeTemplate, tx.immutableReferences)),
        `${tx.key} runtime`,
      );
      if (tx.kind === "implementation") {
        const implementation = new Contract(tx.address, ["function proxiableUUID() view returns(bytes32)"], provider);
        equal(await implementation.proxiableUUID(), SOURCE_IMPLEMENTATION_SLOT, "UUPS slot");
        if (tx.key === SOURCE_UPGRADE_TARGETS.settlement) {
          const candidate = new Contract(tx.address, new Interface(artifacts[tx.key].abi), provider);
          equal(await candidate.CCIP_ROUTER(), m.settlement!.router, "replacement router");
          equal(await candidate.getRouter(), m.settlement!.router, "replacement receiver router");
          equal(await candidate.SOURCE_CHAIN_SELECTOR(), m.settlement!.sourceSelector, "replacement source selector");
          equal(
            await candidate.DESTINATION_EVM_CHAIN_ID(),
            m.settlement!.destinationChainId,
            "replacement destination chain",
          );
        }
      }
      deployments.push({ key: tx.key, address: tx.address, transactionHash: hash, gasUsed: String(receipt.gasUsed) });
    }
    const ownerCalls = [];
    for (const tx of plan.ownerCalls) {
      const gas = await provider.estimateGas({ from: tx.from, to: tx.to, data: tx.data, value: 0n });
      const hash = await provider.send("eth_sendTransaction", [
        { from: tx.from, to: tx.to, data: tx.data, value: "0x0", gas: toQuantity((gas * 130n + 99n) / 100n) },
      ]);
      const receipt = await minedIsolatedReceipt(provider, hash);
      equal(receipt.status, 1, "owner call receipt");
      ownerCalls.push({
        target: tx.target,
        action: tx.action,
        transactionHash: hash,
        gasUsed: String(receipt.gasUsed),
      });
    }
    const targets = [];
    for (const target of ["pooling", "settlement"] as const) {
      const pin = m[target];
      if (!pin) continue;
      const deployment = plan.deployments.find((d) => d.key === SOURCE_UPGRADE_TARGETS[target])!;
      equal(
        getAddress(`0x${(await provider.getStorage(pin.proxy, SOURCE_IMPLEMENTATION_SLOT)).slice(-40)}`),
        getAddress(deployment.address),
        `${target} final implementation`,
      );
      const abi = new Interface(artifacts[SOURCE_UPGRADE_TARGETS[target]].abi);
      const core = new Contract(pin.proxy, abi, provider);
      equal(await core.paused(), true, `${target} paused end state`);
      const preserved = await snapshot(provider, pin.proxy, abi, PRESERVED[target]);
      equal(JSON.stringify(preserved), JSON.stringify(before[target]), `${target} preserved state`);
      if (target === "pooling") {
        equal(await core.voucherAcceptanceProtocolVersion(), 1, "voucher acceptance protocol");
        // Newly added peer storage must remain empty; binding is a separate reviewed operation.
        equal(await core.voucherServiceSetupModule(), ZeroAddress, "unbound service peer");
      }
      targets.push({
        target,
        proxy: pin.proxy,
        previousImplementation: pin.implementation,
        implementation: deployment.address,
        preserved,
      });
    }
    return {
      forkBlock: fork.forkBlock,
      forkBlockHash: fork.forkBlockHash,
      deployments,
      ownerCalls,
      targets,
      paused: true,
      liveBroadcast: false,
      activationIncluded: false,
      proofClass: "owned-fork owner impersonation; no Safe signatures or live execution",
    };
  } finally {
    provider.destroy();
    await fork.stop();
  }
}
