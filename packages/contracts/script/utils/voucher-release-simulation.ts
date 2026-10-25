import { Contract, getAddress, JsonRpcProvider, keccak256, toQuantity } from "ethers";
import { assertIsolatedRpc, startIsolatedFork, maskImmutableRuntime, minedIsolatedReceipt } from "./isolated-fork";
import { NetworkManager } from "./network";
import type { VoucherManifest, VoucherNetwork, VoucherPlan } from "./voucher-release";

const ENDPOINT_ABI = [
  "function owner() view returns(address)",
  "function guardian() view returns(address)",
  "function paused() view returns(bool)",
  "function remotePeer() view returns(address)",
  "function remoteChainId() view returns(uint256)",
  "function remoteChainSelector() view returns(uint64)",
  "function LOCAL_CHAIN_ID() view returns(uint256)",
  "function CCIP_ROUTER() view returns(address)",
  "function getRouter() view returns(address)",
  "function proxiableUUID() view returns(bytes32)",
];
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
function requireEqual(actual: unknown, expected: unknown, label: string) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase())
    throw new Error(`Voucher simulation ${label} mismatch`);
}
/** Only this function's owned loopback fork receives impersonation, synthetic gas or transactions. */
export async function simulateVoucherNetwork(
  plan: VoucherPlan,
  manifest: VoucherManifest,
  network: VoucherNetwork,
  upstream: string,
) {
  const chain = manifest.networks[network];
  const fork = await startIsolatedFork(upstream, chain.chainId);
  assertIsolatedRpc(fork.rpc);
  const provider = new JsonRpcProvider(fork.rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  provider.pollingInterval = 10;
  const rows = [];
  try {
    const nonce = Number(await provider.send("eth_getTransactionCount", [chain.deployer, "pending"]));
    const latest = Number(await provider.send("eth_getTransactionCount", [chain.deployer, "latest"]));
    requireEqual(nonce, chain.nonce, "pending nonce");
    requireEqual(latest, chain.nonce, "latest nonce");
    for (const [role, address] of Object.entries({
      router: chain.router,
      owner: chain.owner,
      ...(network === "arbitrum" ? { commitmentPooling: chain.commitmentPooling, hatsModule: chain.hatsModule } : {}),
    })) {
      if (!address || (await provider.getCode(address)) === "0x")
        throw new Error(`Missing live ${network} ${role} code`);
    }
    const remoteNetwork = network === "arbitrum" ? "gnosis" : "arbitrum";
    const router = new Contract(chain.router!, ["function isChainSupported(uint64) view returns(bool)"], provider);
    if (!(await router.isChainSupported(manifest.networks[remoteNetwork].selector)))
      throw new Error("Configured CCIP router does not support the peer selector");
    const owner = new Contract(chain.owner!, ["function getThreshold() view returns(uint256)"], provider);
    if ((await owner.getThreshold()) < 2n) throw new Error("Endpoint owner Safe threshold is below two");
    await provider.send("anvil_impersonateAccount", [chain.deployer]);
    await provider.send("anvil_setBalance", [chain.deployer, toQuantity(100n * 10n ** 18n)]);
    for (const tx of plan.transactions.filter((t) => t.network === network)) {
      if (
        tx.to !== null ||
        tx.value !== "0" ||
        tx.chainId !== chain.chainId ||
        getAddress(tx.from) !== getAddress(chain.deployer!)
      )
        throw new Error("Unexpected voucher transaction boundary");
      requireEqual(await provider.getCode(tx.address), "0x", "unused CREATE address");
      requireEqual(
        Number(await provider.send("eth_getTransactionCount", [tx.from, "pending"])),
        tx.nonce,
        "boundary nonce",
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
      if (receipt.status !== 1 || receipt.contractAddress !== tx.address)
        throw new Error(`Failed paused deployment ${tx.contract}`);
      const code = await provider.getCode(tx.address);
      requireEqual(
        keccak256(maskImmutableRuntime(code, tx.immutableReferences)),
        keccak256(maskImmutableRuntime(tx.runtimeTemplate, tx.immutableReferences)),
        "production runtime template",
      );
      if (tx.kind !== "library") {
        const endpoint = new Contract(tx.address, ENDPOINT_ABI, provider);
        requireEqual(await endpoint.CCIP_ROUTER(), chain.router, "router immutable");
        requireEqual(await endpoint.getRouter(), chain.router, "CCIP receiver router");
        requireEqual(await endpoint.LOCAL_CHAIN_ID(), chain.chainId, "chain immutable");
        if (tx.kind === "implementation")
          requireEqual(await endpoint.proxiableUUID(), IMPLEMENTATION_SLOT, "UUPS implementation context");
        if (tx.kind === "proxy") {
          const peerNetwork = network === "arbitrum" ? "gnosis" : "arbitrum",
            peer = manifest.networks[peerNetwork];
          const peerName =
            tx.contract === "VoucherEntitlementModule"
              ? "GnosisVoucherAdapter"
              : tx.contract === "VoucherRedemptionModule"
                ? "GnosisVoucherEscrow"
                : tx.contract === "GnosisVoucherAdapter"
                  ? "VoucherEntitlementModule"
                  : "VoucherRedemptionModule";
          const remote = plan.transactions.find((t) => t.contract === peerName && t.kind === "proxy")!;
          requireEqual(await endpoint.owner(), chain.owner, "proxy owner");
          requireEqual(await endpoint.guardian(), chain.guardian, "proxy guardian");
          requireEqual(await endpoint.paused(), true, "paused end state");
          requireEqual(await endpoint.remotePeer(), remote.address, "authenticated peer");
          requireEqual(await endpoint.remoteChainId(), peer.chainId, "remote chain");
          requireEqual(await endpoint.remoteChainSelector(), peer.selector, "remote selector");
          const implementation = plan.transactions.find(
            (t) => t.network === network && t.contract === tx.contract && t.kind === "implementation",
          )!;
          const stored = await provider.getStorage(tx.address, IMPLEMENTATION_SLOT);
          requireEqual(getAddress(`0x${stored.slice(-40)}`), implementation.address, "proxy implementation");
          let rejected = false;
          try {
            await provider.call({ from: chain.deployer!, to: tx.address, data: tx.initializer });
          } catch {
            rejected = true;
          }
          if (!rejected) throw new Error("Initialized voucher proxy accepted reinitialization");
        }
      }
      rows.push({
        contract: tx.contract,
        kind: tx.kind,
        address: tx.address,
        transactionHash: hash,
        gasUsed: receipt.gasUsed.toString(),
        runtimeHash: keccak256(code),
      });
    }
    return {
      network,
      chainId: chain.chainId,
      forkBlock: fork.forkBlock,
      forkBlockHash: fork.forkBlockHash,
      rows,
      paused: true,
      gasFunding: "synthetic local balance; live deployer funding not proved",
      authorityEnabled: false,
      transportDispatchExercised: false,
    };
  } finally {
    provider.destroy();
    await fork.stop();
  }
}
export async function simulateVoucherPlan(plan: VoucherPlan, manifest: VoucherManifest) {
  const networks = new NetworkManager(),
    results = [];
  // Resolve both upstreams before starting either isolated state mutation.
  const upstreams = { arbitrum: networks.getRpcUrl("arbitrum"), gnosis: networks.getRpcUrl("gnosis") };
  for (const name of ["arbitrum", "gnosis"] as const)
    results.push(await simulateVoucherNetwork(plan, manifest, name, upstreams[name]));
  return {
    kind: "PAUSED_VOUCHER_FORK_SIMULATION",
    sourceCommit: plan.sourceCommit,
    manifestHash: plan.manifestHash,
    results,
    liveBroadcast: false,
    activationIncluded: false,
  };
}
