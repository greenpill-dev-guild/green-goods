import { Contract, getAddress, JsonRpcProvider, keccak256, toQuantity, ZeroAddress } from "ethers";
import { type CLCGardenManifest, type CLCGardenPlan, validateCLCGardenPlan } from "./clc-garden-release";
import { readCLCAdoptedGardenState, verifyCLCGardenAuthorities, verifyCLCGardenPool } from "./clc-garden-readback";
import { verifyCLCAdoptionPrefix } from "./clc-member-adoption";
import { getCLCProxyRuntime } from "./clc-member-readback";
import { CLC_DEPENDENCIES, CLC_FACTORY_ABI, CLC_FACTORY_INIT_CODE_HASH, CLC_TOKEN_ABI } from "./clc-release";
import { assertIsolatedRpc, minedIsolatedReceipt, startIsolatedFork } from "./isolated-fork";
import { voucherDigest } from "./voucher-release";

function equal(actual: unknown, expected: unknown, label: string) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase())
    throw new Error(`CLC garden simulation ${label} mismatch`);
}
/** Executes deployment only on an isolated fork, leaving existing tokens and GG activity intact. */
export async function simulateCLCGardenPlan(
  plan: CLCGardenPlan,
  manifest: CLCGardenManifest,
  upstream: string,
  adoptionReceipts?: unknown,
) {
  validateCLCGardenPlan(plan, manifest, plan.sourceCommit);
  const fork = await startIsolatedFork(upstream, 100);
  let provider: JsonRpcProvider | undefined;
  try {
    assertIsolatedRpc(fork.rpc);
    provider = new JsonRpcProvider(fork.rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
    for (const [name, pin] of Object.entries(CLC_DEPENDENCIES))
      equal(keccak256(await provider.getCode(pin.address)), pin.runtimeHash, `${name} dependency runtime`);
    const factory = new Contract(CLC_DEPENDENCIES.factory.address, CLC_FACTORY_ABI, provider);
    equal(await factory.initCodeHash(), CLC_FACTORY_INIT_CODE_HASH, "factory identity");
    const authority = await verifyCLCGardenAuthorities(provider, plan);
    const before = await readCLCAdoptedGardenState(provider, plan);
    const adopted = await verifyCLCAdoptionPrefix(provider, plan, adoptionReceipts);
    const remaining = plan.transactions.slice(adopted.length);
    const sender = plan.transactions[0].from;
    equal(await provider.getCode(sender), "0x", "dedicated deployment sender");
    for (const tag of ["latest", "pending"])
      equal(
        Number(await provider.send("eth_getTransactionCount", [sender, tag])),
        plan.transactions[0].nonce + adopted.length,
        `${tag} deployment nonce`,
      );
    for (const tx of remaining) {
      equal(await provider.getCode(tx.address), "0x", "unused deployment address");
      equal(await factory.adminOf(tx.address), ZeroAddress, "unused factory administrator");
      equal(await factory.predictDeterministicAddress(tx.salt), tx.address, "factory prediction");
    }
    await provider.send("anvil_impersonateAccount", [sender]);
    await provider.send("anvil_setBalance", [sender, toQuantity(100n * 10n ** 18n)]);
    const receipts: {
      component: string;
      address: string;
      transactionHash: string;
      runtimeHash: string;
      adopted: boolean;
      blockNumber?: number;
      gasLimit?: string;
    }[] = [...adopted];
    for (const tx of remaining) {
      equal(
        Number(await provider.send("eth_getTransactionCount", [sender, "pending"])),
        tx.nonce,
        "deployment boundary nonce",
      );
      const request = { from: sender, to: tx.to, data: tx.data, value: "0x0" };
      const gas = await provider.estimateGas(request);
      const gasLimit = (gas * 130n + 99n) / 100n;
      const hash = await provider.send("eth_sendTransaction", [
        { ...request, nonce: toQuantity(tx.nonce), gas: toQuantity(gasLimit) },
      ]);
      const receipt = await minedIsolatedReceipt(provider, hash);
      equal(receipt.status, 1, "deployment receipt");
      equal(await provider.getCode(tx.address), getCLCProxyRuntime(), "deployed proxy runtime");
      equal(await factory.adminOf(tx.address), tx.admin, "deployed proxy administrator");
      receipts.push({
        component: tx.component,
        address: tx.address,
        transactionHash: hash,
        blockNumber: receipt.blockNumber,
        gasLimit: String(gasLimit),
        adopted: false,
        runtimeHash: keccak256(await provider.getCode(tx.address)),
      });
    }
    await verifyCLCGardenPool(provider, plan.pools.techAndSun, manifest);
    for (const asset of plan.assets.filter((row) => row.mode === "deploy")) {
      const token = new Contract(asset.token, CLC_TOKEN_ABI, provider);
      equal(await token.owner(), asset.ownerReserve, "member token owner");
      equal(await token.totalSupply(), 0, "member issuance excluded");
      equal(await token.isWriter(sender), false, "deployer cannot issue");
      equal(await token.isWriter(plan.pools.techAndSun.owner), false, "pool authority cannot issue member token");
      equal(getAddress(await factory.adminOf(asset.token)), asset.ownerReserve, "member upgrade control");
    }
    const after = await readCLCAdoptedGardenState(provider, plan);
    equal(voucherDigest(after), voucherDigest(before), "preserved adopted token inventory and bindings");
    equal(
      voucherDigest(await verifyCLCGardenAuthorities(provider, plan)),
      voucherDigest(authority),
      "preserved Safe and timelock policy",
    );
    return {
      schemaVersion: 1,
      kind: "CLC_GARDEN_EXCHANGE_SIMULATION",
      planHash: voucherDigest(plan),
      sourceCommit: plan.sourceCommit,
      chainId: 100,
      evidence: "isolated-fork",
      authority,
      adoptedState: after,
      receipts,
      activationIncluded: false,
      liveBroadcast: false,
    };
  } finally {
    provider?.destroy();
    await fork.stop();
  }
}
