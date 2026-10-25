import { Contract, getAddress, JsonRpcProvider, keccak256, toQuantity, ZeroAddress } from "ethers";
import type { CLCMemberManifest } from "./clc-member-inputs";
import { type CLCMemberPlan, validateCLCReleasePlan } from "./clc-member-release";
import { verifyCLCAdoptionPrefix } from "./clc-member-adoption";
import { getCLCProxyRuntime, verifyCLCMemberInitialState } from "./clc-member-readback";
import { CLC_DEPENDENCIES, CLC_FACTORY_ABI, CLC_FACTORY_INIT_CODE_HASH } from "./clc-release";
import {
  verifyEmptyState,
  verifyGreenGoodsAuthority,
  verifyTechSunAuthority,
  verifyTimelock,
} from "./clc-release-simulation";
import { assertIsolatedRpc, maskImmutableRuntime, minedIsolatedReceipt, startIsolatedFork } from "./isolated-fork";
import { type VoucherArtifact, voucherDigest } from "./voucher-release";

const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
function equal(actual: unknown, expected: unknown, label: string): void {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase()) throw new Error(`CLC member ${label} mismatch`);
}
/** Preparation only: refuses an already configured base and never sends to the upstream RPC. */
export async function simulateCLCMemberPlan(
  plan: CLCMemberPlan,
  manifest: CLCMemberManifest,
  artifact: VoucherArtifact,
  upstream: string,
  receipts?: unknown,
) {
  validateCLCReleasePlan(plan, manifest, artifact, plan.sourceCommit);
  const base = manifest.base;
  if (!base.deployer || !base.techAndSunSafe || !manifest.members.deployer)
    throw new Error("Missing CLC simulation senders");
  const fork = await startIsolatedFork(upstream, 100);
  let provider: JsonRpcProvider | undefined;
  try {
    assertIsolatedRpc(fork.rpc);
    provider = new JsonRpcProvider(fork.rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
    for (const [name, pin] of Object.entries(CLC_DEPENDENCIES))
      equal(keccak256(await provider.getCode(pin.address)), pin.runtimeHash, `${name} dependency runtime`);
    const factory = new Contract(CLC_DEPENDENCIES.factory.address, CLC_FACTORY_ABI, provider);
    equal(await factory.initCodeHash(), CLC_FACTORY_INIT_CODE_HASH, "factory init-code hash");
    const safes = {
      greenGoods: await verifyGreenGoodsAuthority(provider, base.greenGoodsSafe),
      techAndSun: await verifyTechSunAuthority(provider, base.techAndSunSafe),
    };
    const rows: Array<{
      component: string;
      address: string;
      transactionHash: string;
      runtimeHash: string;
      adopted: boolean;
    }> = await verifyCLCAdoptionPrefix(provider, plan, receipts);
    const remaining = plan.transactions.slice(rows.length);
    if (rows.length >= plan.basePlan.transactions.length)
      await verifyEmptyState(provider, plan.basePlan, {
        ...base,
        deployer: base.deployer,
        techAndSunSafe: base.techAndSunSafe,
      });
    for (const sender of new Set(plan.transactions.map((tx) => tx.from))) {
      if ((await provider.getCode(sender)) !== "0x") throw new Error("CLC preparation sender must be a dedicated EOA");
      const next =
        remaining.find((tx) => tx.from === sender)?.nonce ??
        Math.max(...plan.transactions.filter((tx) => tx.from === sender).map((tx) => tx.nonce)) + 1;
      for (const tag of ["latest", "pending"])
        equal(Number(await provider.send("eth_getTransactionCount", [sender, tag])), next, `${tag} deployment nonce`);
    }
    for (const tx of plan.transactions)
      if (tx.kind === "proxy")
        equal(await factory.predictDeterministicAddress(tx.salt), tx.address, "factory predicted address");
    for (const tx of remaining)
      if (tx.kind === "proxy") equal(await factory.adminOf(tx.address), ZeroAddress, "unused factory administrator");
    for (const sender of new Set(remaining.map((tx) => tx.from))) {
      await provider.send("anvil_impersonateAccount", [sender]);
      await provider.send("anvil_setBalance", [sender, toQuantity(100n * 10n ** 18n)]);
    }
    for (const tx of remaining) {
      equal(
        Number(await provider.send("eth_getTransactionCount", [tx.from, "pending"])),
        tx.nonce,
        "deployment boundary nonce",
      );
      const request = { from: tx.from, ...(tx.to ? { to: tx.to } : {}), data: tx.data, value: "0x0" };
      const gas = await provider.estimateGas(request);
      const hash = await provider.send("eth_sendTransaction", [
        { ...request, nonce: toQuantity(tx.nonce), gas: toQuantity((gas * 130n + 99n) / 100n) },
      ]);
      const receipt = await minedIsolatedReceipt(provider, hash);
      equal(receipt.status, 1, "deployment receipt status");
      equal(receipt.contractAddress, tx.to === null ? tx.address : null, "deployment CREATE address");
      rows.push({
        component: tx.component,
        address: tx.address,
        transactionHash: hash,
        runtimeHash: keccak256(await provider.getCode(tx.address)),
        adopted: false,
      });
    }
    for (const tx of plan.basePlan.transactions) {
      const code = await provider.getCode(tx.address);
      if (tx.kind === "timelock") {
        equal(
          keccak256(maskImmutableRuntime(code, artifact.deployedBytecode.immutableReferences)),
          keccak256(
            maskImmutableRuntime(
              `0x${artifact.deployedBytecode.object.replace(/^0x/, "")}`,
              artifact.deployedBytecode.immutableReferences,
            ),
          ),
          "base timelock runtime",
        );
        await verifyTimelock(
          provider,
          tx.address,
          tx.component === "greenGoodsTimelock" ? base.greenGoodsSafe : base.techAndSunSafe,
          tx.from,
        );
      } else {
        equal(code, getCLCProxyRuntime(), "base proxy runtime");
        equal(await factory.adminOf(tx.address), tx.admin, "base factory administrator");
        equal(
          getAddress(`0x${(await provider.getStorage(tx.address, IMPLEMENTATION_SLOT)).slice(-40)}`),
          tx.implementation,
          "base implementation",
        );
      }
    }
    // The empty-state predicate intentionally excludes already activated/issued bases from this preparation path.
    await verifyEmptyState(provider, plan.basePlan, {
      ...base,
      deployer: base.deployer,
      techAndSunSafe: base.techAndSunSafe,
    });
    const members = await verifyCLCMemberInitialState(provider, plan, manifest);
    for (const sender of new Set(plan.transactions.map((tx) => tx.from)))
      equal(
        Number(await provider.send("eth_getTransactionCount", [sender, "latest"])),
        Math.max(...plan.transactions.filter((tx) => tx.from === sender).map((tx) => tx.nonce)) + 1,
        "final deployment nonce",
      );
    return {
      kind: "CLC_MEMBER_PREPARATION_FORK_SIMULATION",
      sourceCommit: plan.sourceCommit,
      manifestHash: plan.manifestHash,
      planHash: voucherDigest(plan),
      basePlanHash: plan.basePlanHash,
      purpose: manifest.purpose,
      chainId: 100,
      forkBlock: fork.forkBlock,
      forkBlockHash: fork.forkBlockHash,
      rows,
      members,
      safes,
      signing: "synthetic local impersonation; actual member signatures not proved",
      gasFunding: "synthetic local balance; live funding not proved",
      configurationExecuted: false,
      issuanceExecuted: false,
      activationIncluded: false,
      liveBroadcast: false,
    };
  } finally {
    provider?.destroy();
    await fork.stop();
  }
}
