import { Contract, getAddress, keccak256, type JsonRpcProvider, type TransactionRequest } from "ethers";
import { maskImmutableRuntime } from "./isolated-fork";
import {
  STEWARD_PUBLISHER_ABI,
  STEWARD_RECEIVER_ABI,
  type StewardPlan,
  type StewardManifest,
  type StewardArtifacts,
  type StewardNetwork,
} from "./steward-safe-release";

function equal(actual: unknown, expected: unknown, label: string) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase())
    throw new Error(`Steward readback ${label} mismatch`);
}

export async function readStewardDeployment(
  plan: StewardPlan,
  manifest: StewardManifest,
  artifacts: StewardArtifacts,
  network: StewardNetwork,
  provider: JsonRpcProvider,
  initial = false,
  blockNumber?: number,
) {
  blockNumber ??= await provider.getBlockNumber();
  const reader = {
    provider: null,
    call: (transaction: TransactionRequest) => provider.call({ ...transaction, blockTag: blockNumber }),
  };
  const tx = plan.transactions.find((row) => row.network === network)!;
  const c = manifest.networks[network];
  equal((await provider.getNetwork()).chainId, c.chainId, "chain");
  const artifact = artifacts[tx.contract as keyof StewardArtifacts];
  if (!artifact) throw new Error("Missing steward artifact");
  const code = await provider.getCode(tx.address, blockNumber);
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
    network === "arbitrum"
      ? [...STEWARD_PUBLISHER_ABI, ...STEWARD_RECEIVER_ABI.filter((entry) => !STEWARD_PUBLISHER_ABI.includes(entry))]
      : STEWARD_RECEIVER_ABI,
    reader,
  );
  equal(await endpoint.garden(), manifest.garden, "garden");
  const peer = plan.transactions.find((t) => t.network !== network)!.address;
  let safeState: Record<string, unknown> | null = null;
  if (network === "arbitrum") {
    equal(await endpoint.receiver(), peer, "destination peer");
    equal(await endpoint.router(), c.router, "source router");
    equal(await endpoint.hatsModule(), manifest.hatsModule, "canonical HatsModule");
    equal(await endpoint.stewardHat(), manifest.stewardHat, "pinned steward Hat");
  }
  if (network === "gnosis") {
    equal(await endpoint.publisher(), peer, "source peer");
    equal(await endpoint.getRouter(), c.router, "router");
  }
  if (network === "gnosis" || manifest.schemaVersion === 2) {
    const expectedTopHat = network === "arbitrum" ? manifest.sourceSafe!.expectedTopHat : manifest.expectedTopHat;
    equal(await endpoint.ownerHat(), expectedTopHat, "expected root tree");
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
      reader,
    );
    const safe = new Contract(
      safeAddress,
      [
        "function VERSION() view returns(string)",
        "function getThreshold() view returns(uint256)",
        "function getOwners() view returns(address[])",
        "function getModulesPaginated(address,uint256) view returns(address[],address)",
      ],
      reader,
    );
    const bootstrap = network === "gnosis" ? (manifest.bootstrapSigner ?? null) : null;
    equal(await gate.locked(), true, "gate locked at deployment");
    equal(await gate.claimableFor(), true, "permissionless reconciliation");
    equal(await gate.safe(), safeAddress, "gate Safe");
    equal(await gate.ownerHat(), expectedTopHat, "gate owner Hat");
    equal(await gate.implementation(), "0x148057884AC910Bdd93693F230C5c35a8c47CA3b", "reviewed HSG");
    const config = await gate.thresholdConfig();
    // One steward signs alone; a second owner always raises the requirement to two signatures.
    equal(config[0], 0, "absolute threshold");
    equal(config[1], 1, "minimum");
    equal(config[2], 2, "target");
    equal(await safe.VERSION(), "1.4.1", "HSG-created Safe version");
    const owners = [...(await safe.getOwners())] as string[];
    const threshold = Number(await safe.getThreshold());
    const validSigners = Number(await gate.validSignerCount());
    equal(threshold, Math.min(2, owners.length), "roster threshold");
    if (initial) {
      equal(threshold, 1, "bootstrap physical threshold");
      equal(validSigners, bootstrap ? 1 : 0, "valid signers");
      equal(owners.length, 1, "placeholder owner count");
      equal(owners[0], bootstrap ?? gateAddress, "initial owner");
    }
    const [modules, next] = await safe.getModulesPaginated("0x0000000000000000000000000000000000000001", 2);
    equal(modules.length, 1, "sole Safe module");
    equal(modules[0], gateAddress, "gate module");
    equal(next, "0x0000000000000000000000000000000000000001", "end of modules");
    const [submodules] = await gate.getModulesPaginated("0x0000000000000000000000000000000000000001", 1);
    equal(submodules.length, 0, "no gate submodules");
    const guard = await provider.getStorage(
      safeAddress,
      "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8",
      blockNumber,
    );
    equal(getAddress(`0x${guard.slice(-40)}`), gateAddress, "Safe transaction guard");
    for (const target of [
      "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D",
      "0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B",
      "0x9641d764fc13c8B624c04430C7356C1C7C8102e2",
    ])
      equal(
        await gate.enabledDelegatecallTargets(target),
        target === "0x9641d764fc13c8B624c04430C7356C1C7C8102e2",
        "pinned call-only batch permission",
      );
    const hats = new Contract(
      "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137",
      [
        "function isWearerOfHat(address,uint256) view returns(bool)",
        "function isAdminOfHat(address,uint256) view returns(bool)",
        "function viewHat(uint256) view returns(string,uint32,uint32,address,address,string,uint16,bool,bool)",
      ],
      reader,
    );
    equal(await hats.isWearerOfHat(tx.address, expectedTopHat), true, "receiver owns root Hat");
    equal(await hats.isAdminOfHat(safeAddress, signerHat), false, "Safe has no Hat admin authority");
    const hat = await hats.viewHat(signerHat);
    equal(hat[0], `Arbitrum ${manifest.gardenName} stewards`, "signer Hat name");
    equal(hat[3], tx.address, "eligibility");
    equal(hat[4], tx.address, "toggle");
    equal(hat[7], false, "immutable signer Hat");
    safeState = {
      address: safeAddress,
      gate: gateAddress,
      signerHat: String(signerHat),
      ownerHat: String(expectedTopHat),
      owners,
      effectiveThreshold: threshold,
      physicalThreshold: threshold,
      validSigners,
      spendingEnabled: validSigners >= threshold,
    };
  }
  return {
    network,
    chainId: c.chainId,
    blockNumber,
    address: tx.address,
    runtimeHash: keccak256(code),
    safe: safeState,
  };
}

/** Before either CREATE, its immutable peer must still be deployable or exactly match the rehearsal. */
export async function checkStewardPeer(
  plan: StewardPlan,
  manifest: StewardManifest,
  artifacts: StewardArtifacts,
  network: StewardNetwork,
  provider: JsonRpcProvider,
  expectedRuntimeHash: string,
) {
  const tx = plan.transactions.find((row) => row.network === network)!;
  equal((await provider.getNetwork()).chainId, tx.chainId, "peer chain");
  if (network === "arbitrum") {
    const authority = new Contract(
      manifest.hatsModule!,
      ["function getGardenHatIds(address) view returns(uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)"],
      provider,
    );
    const ids = await authority.getGardenHatIds(manifest.garden);
    equal(ids[1], manifest.stewardHat, "peer canonical steward Hat");
    equal(ids[7], true, "peer garden configured");
  }
  if ((await provider.getCode(tx.address)) !== "0x") {
    const peer = await readStewardDeployment(plan, manifest, artifacts, network, provider);
    equal(peer.runtimeHash, expectedRuntimeHash, "exact deployed peer runtime");
    return;
  }
  for (const tag of ["latest", "pending"])
    equal(await provider.getTransactionCount(tx.from, tag), tx.nonce, `peer ${tag} nonce`);
  const hats = new Contract(
    "0x3bc1A0Ad72417f2d411118085256fC53CBdDd137",
    ["function lastTopHatId() view returns(uint256)"],
    provider,
  );
  const expectedRoot = network === "arbitrum" ? manifest.sourceSafe!.expectedTopHat : manifest.expectedTopHat;
  equal(((await hats.lastTopHatId()) + 1n) << 224n, expectedRoot, "peer next Hats root");
  await provider.estimateGas({ from: tx.from, data: tx.data, value: 0n, nonce: tx.nonce });
}
