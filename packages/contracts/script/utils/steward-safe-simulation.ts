import { readStewardDeployment } from "./steward-safe-readback";
import { Contract, JsonRpcProvider, keccak256, toQuantity } from "ethers";
import { assertIsolatedRpc, maskImmutableRuntime, minedIsolatedReceipt, startIsolatedFork } from "./isolated-fork";
import {
  type StewardArtifacts,
  type StewardManifest,
  type StewardNetwork,
  type StewardPlan,
} from "./steward-safe-release";

function equal(actual: unknown, expected: unknown, label: string) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase())
    throw new Error(`Steward simulation ${label} mismatch`);
}
export async function simulateStewardNetwork(
  plan: StewardPlan,
  manifest: StewardManifest,
  artifacts: StewardArtifacts,
  network: StewardNetwork,
  upstream: string,
) {
  const tx = plan.transactions.find((t) => t.network === network)!;
  const c = manifest.networks[network];
  const fork = await startIsolatedFork(upstream, c.chainId);
  assertIsolatedRpc(fork.rpc);
  const provider = new JsonRpcProvider(fork.rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  try {
    for (const tag of ["latest", "pending"])
      equal(Number(await provider.send("eth_getTransactionCount", [tx.from, tag])), tx.nonce, tag);
    equal(await provider.getCode(tx.address), "0x", "unused CREATE address");
    if ((await provider.getCode(c.router!)) === "0x") throw new Error("Missing CCIP router code");
    if (network === "arbitrum") {
      const router = new Contract(c.router!, ["function isChainSupported(uint64) view returns(bool)"], provider);
      if (!(await router.isChainSupported("465200170687744372"))) throw new Error("CCIP destination lane unavailable");
      const hats = new Contract(
        manifest.hatsModule!,
        [
          "function getGardenHatIds(address) view returns(uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)",
        ],
        provider,
      );
      const ids = await hats.getGardenHatIds(manifest.garden);
      equal(ids[1], manifest.stewardHat, "canonical steward Hat");
      equal(ids[7], true, "garden configured");
    }
    // Only this process-owned loopback receives impersonation, synthetic funding and deployment calls.
    await provider.send("anvil_impersonateAccount", [tx.from]);
    await provider.send("anvil_setBalance", [tx.from, toQuantity(100n * 10n ** 18n)]);
    const gas = await provider.estimateGas({ from: tx.from, data: tx.data, value: 0n });
    const hash = await provider.send("eth_sendTransaction", [
      {
        from: tx.from,
        nonce: toQuantity(tx.nonce),
        value: "0x0",
        data: tx.data,
        gas: toQuantity((gas * 130n + 99n) / 100n),
      },
    ]);
    const receipt = await minedIsolatedReceipt(provider, hash);
    if (receipt.status !== 1) throw new Error("Steward deployment reverted");
    equal(receipt.contractAddress, tx.address, "CREATE address");
    const artifact = artifacts[tx.contract as keyof StewardArtifacts]!;
    const code = await provider.getCode(tx.address);
    equal(
      keccak256(maskImmutableRuntime(code, artifact.deployedBytecode.immutableReferences)),
      keccak256(
        maskImmutableRuntime(
          `0x${artifact.deployedBytecode.object.replace(/^0x/, "")}`,
          artifact.deployedBytecode.immutableReferences,
        ),
      ),
      "production runtime",
    );
    const verified = await readStewardDeployment(plan, manifest, artifacts, network, provider, true);
    return {
      network,
      chainId: c.chainId,
      forkBlock: fork.forkBlock,
      forkBlockHash: fork.forkBlockHash,
      transactionHash: hash,
      address: tx.address,
      gasUsed: String(receipt.gasUsed),
      runtimeHash: keccak256(code),
      safe: verified.safe,
      activationIncluded: Boolean(manifest.bootstrapSigner),
      transportDelivered: false,
      observerRegistered: false,
      funding: "synthetic local balance; live funding not proved",
    };
  } finally {
    provider.destroy();
    await fork.stop();
  }
}
