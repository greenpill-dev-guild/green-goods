import { Contract, getAddress, JsonRpcProvider, keccak256, toQuantity } from "ethers";
import { assertIsolatedRpc, maskImmutableRuntime, minedIsolatedReceipt, startIsolatedFork } from "./isolated-fork";
import {
  STEWARD_PUBLISHER_ABI,
  STEWARD_RECEIVER_ABI,
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
    const artifact = artifacts[network === "arbitrum" ? "StewardRolePublisher" : "StewardSafeReceiver"];
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
    const endpoint = new Contract(
      tx.address,
      network === "arbitrum" ? STEWARD_PUBLISHER_ABI : STEWARD_RECEIVER_ABI,
      provider,
    );
    equal(await endpoint.garden(), manifest.garden, "garden");
    const peer = plan.transactions.find((t) => t.network !== network)!.address;
    let safeState: Record<string, unknown> | null = null;
    if (network === "arbitrum") {
      equal(await endpoint.receiver(), peer, "destination peer");
      equal(await endpoint.router(), c.router, "source router");
      equal(await endpoint.hatsModule(), manifest.hatsModule, "canonical HatsModule");
      equal(await endpoint.stewardHat(), manifest.stewardHat, "pinned steward Hat");
    } else {
      equal(await endpoint.publisher(), peer, "source peer");
      equal(await endpoint.getRouter(), c.router, "router");
      equal(await endpoint.ownerHat(), manifest.expectedTopHat, "expected root tree");
      const gateAddress = await endpoint.gate(),
        safeAddress = await endpoint.safe(),
        signerHat = await endpoint.signerHat();
      const gate = new Contract(
        gateAddress,
        [
          "function locked() view returns(bool)",
          "function safe() view returns(address)",
          "function claimableFor() view returns(bool)",
          "function ownerHat() view returns(uint256)",
          "function implementation() view returns(address)",
          "function thresholdConfig() view returns(uint8,uint120,uint120)",
          "function validSignerCount() view returns(uint256)",
          "function getModulesPaginated(address,uint256) view returns(address[],address)",
          "function enabledDelegatecallTargets(address) view returns(bool)",
        ],
        provider,
      );
      const safe = new Contract(
        safeAddress,
        [
          "function VERSION() view returns(string)",
          "function getThreshold() view returns(uint256)",
          "function getOwners() view returns(address[])",
          "function getModulesPaginated(address,uint256) view returns(address[],address)",
        ],
        provider,
      );
      const bootstrap = manifest.bootstrapSigner ?? null;
      equal(await gate.locked(), !bootstrap, "gate lock mode");
      equal(await gate.claimableFor(), true, "permissionless reconciliation");
      equal(await gate.safe(), safeAddress, "gate Safe");
      equal(await gate.ownerHat(), manifest.expectedTopHat, "gate owner Hat");
      equal(await gate.implementation(), "0x148057884AC910Bdd93693F230C5c35a8c47CA3b", "reviewed HSG");
      const config = await gate.thresholdConfig();
      equal(config[0], 0, "absolute threshold");
      equal(config[1], bootstrap ? 1 : 2, "minimum");
      equal(config[2], bootstrap ? 1 : 2, "target");
      equal(await safe.VERSION(), "1.4.1", "HSG-created Safe version");
      equal(await safe.getThreshold(), 1, "bootstrap physical threshold");
      equal(await gate.validSignerCount(), bootstrap ? 1 : 0, "valid signers");
      const owners = await safe.getOwners();
      equal(owners.length, 1, "placeholder owner count");
      equal(owners[0], bootstrap ?? gateAddress, "initial owner");
      const [modules, next] = await safe.getModulesPaginated("0x0000000000000000000000000000000000000001", 2);
      equal(modules.length, 1, "sole Safe module");
      equal(modules[0], gateAddress, "gate module");
      equal(next, "0x0000000000000000000000000000000000000001", "end of modules");
      const [submodules] = await gate.getModulesPaginated("0x0000000000000000000000000000000000000001", 1);
      equal(submodules.length, 0, "no gate submodules");
      const guard = await provider.getStorage(
        safeAddress,
        "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8",
      );
      equal(getAddress(`0x${guard.slice(-40)}`), gateAddress, "Safe transaction guard");
      for (const target of [
        "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D",
        "0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B",
        "0x9641d764fc13c8B624c04430C7356C1C7C8102e2",
      ])
        equal(
          await gate.enabledDelegatecallTargets(target),
          Boolean(bootstrap) && target === "0x9641d764fc13c8B624c04430C7356C1C7C8102e2",
          "pinned call-only batch permission",
        );
      const hats = new Contract(
        "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137",
        [
          "function isWearerOfHat(address,uint256) view returns(bool)",
          "function isAdminOfHat(address,uint256) view returns(bool)",
          "function viewHat(uint256) view returns(string,uint32,uint32,address,address,string,uint16,bool,bool)",
        ],
        provider,
      );
      equal(await hats.isWearerOfHat(tx.address, manifest.expectedTopHat), true, "receiver owns root Hat");
      equal(await hats.isAdminOfHat(safeAddress, signerHat), false, "Safe has no Hat admin authority");
      const hat = await hats.viewHat(signerHat);
      equal(hat[3], tx.address, "eligibility");
      equal(hat[4], tx.address, "toggle");
      equal(hat[7], false, "immutable signer Hat");
      safeState = {
        address: safeAddress,
        gate: gateAddress,
        signerHat: String(signerHat),
        effectiveThreshold: bootstrap ? 1 : 2,
        physicalThreshold: 1,
        validSigners: bootstrap ? 1 : 0,
        spendingEnabled: Boolean(bootstrap),
      };
    }
    return {
      network,
      chainId: c.chainId,
      forkBlock: fork.forkBlock,
      forkBlockHash: fork.forkBlockHash,
      transactionHash: hash,
      address: tx.address,
      gasUsed: String(receipt.gasUsed),
      runtimeHash: keccak256(code),
      safe: safeState,
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
