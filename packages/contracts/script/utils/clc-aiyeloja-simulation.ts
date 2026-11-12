import { Contract, concat, Interface, JsonRpcProvider, keccak256, toQuantity, zeroPadValue } from "ethers";
import {
  type CLCAiyelojaManifest,
  type CLCAiyelojaPlan,
  type AiyelojaBatch,
  AIYELOJA_MULTISEND,
  AIYELOJA_SWAP_ABI,
  aiyelojaMultiSendData,
  validateCLCAiyelojaPlan,
} from "./clc-aiyeloja-release";
import {
  AIYELOJA_SAFE_ABI,
  aiyelojaEqual as equal,
  aiyelojaProductionSnapshot,
  verifyAiyelojaActivation,
  verifyAiyelojaAuthority,
  verifyAiyelojaDependencies,
  verifyAiyelojaDeployment,
} from "./clc-aiyeloja-readback";
import { CLC_FACTORY_ABI, CLC_DEPENDENCIES, CLC_TOKEN_ABI } from "./clc-release";
import { minedIsolatedReceipt, startIsolatedFork, assertIsolatedRpc } from "./isolated-fork";
import { getCLCProxyRuntime } from "./clc-member-readback";
import { verifyCLCAdoptionPrefix } from "./clc-member-adoption";
import { assertSourceSafeSuccess } from "./source-upgrade-safe-execution";
import { voucherDigest } from "./voucher-release";

/** All impersonation and funding are confined to a fresh owned loopback fork. */
export async function simulateCLCAiyelojaPlan(
  plan: CLCAiyelojaPlan,
  manifest: CLCAiyelojaManifest,
  upstream: string,
  adoptionReceipts?: unknown,
) {
  validateCLCAiyelojaPlan(plan, manifest, plan.sourceCommit);
  const fork = await startIsolatedFork(upstream, 100);
  assertIsolatedRpc(fork.rpc);
  const provider = new JsonRpcProvider(fork.rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  provider.pollingInterval = 25;
  const zero = "0x0000000000000000000000000000000000000000";
  try {
    await verifyAiyelojaDependencies(provider);
    const authority = await verifyAiyelojaAuthority(provider, plan, true);
    const before = await aiyelojaProductionSnapshot(provider, plan);
    const factory = new Contract(CLC_DEPENDENCIES.factory.address, CLC_FACTORY_ABI, provider);
    const adopted = await verifyCLCAdoptionPrefix(provider, plan, adoptionReceipts);
    const sender = plan.transactions[0].from;
    equal(await provider.getCode(sender), "0x", "EOA deployer");
    for (const tag of ["latest", "pending"])
      equal(
        await provider.send("eth_getTransactionCount", [sender, tag]),
        toQuantity(manifest.nonce + adopted.length),
        `fresh ${tag} deployment nonce`,
      );
    const fund = async (actor: string) => {
      await provider.send("anvil_impersonateAccount", [actor]);
      await provider.send("anvil_setBalance", [actor, toQuantity(100n * 10n ** 18n)]);
    };
    await fund(sender);
    const deployments: {
      component: string;
      address: string;
      transactionHash: string;
      gasLimit: string;
      gasUsed: string;
      runtimeHash: string;
      adopted?: boolean;
    }[] = [];
    for (const tx of plan.transactions.slice(adopted.length)) {
      equal(await factory.predictDeterministicAddress(tx.salt), tx.address, "factory prediction");
      equal(await provider.getCode(tx.address), "0x", "unused address");
      equal(await factory.adminOf(tx.address), zero, "unused factory administration");
      const request = { from: sender, to: tx.to, data: tx.data, value: "0x0", nonce: toQuantity(tx.nonce) };
      const gas = ((await provider.estimateGas({ ...request, nonce: tx.nonce })) * 130n + 99n) / 100n;
      const hash = await provider.send("eth_sendTransaction", [{ ...request, gas: toQuantity(gas) }]);
      const receipt = await minedIsolatedReceipt(provider, hash);
      equal(receipt.status, 1, "deployment status");
      equal(await provider.getCode(tx.address), getCLCProxyRuntime(), "proxy runtime");
      deployments.push({
        component: tx.component,
        address: tx.address,
        transactionHash: hash,
        gasLimit: String(gas),
        gasUsed: String(receipt.gasUsed),
        runtimeHash: keccak256(await provider.getCode(tx.address)),
      });
    }
    await verifyAiyelojaDeployment(provider, plan, true);
    const safe = new Contract(plan.safe, AIYELOJA_SAFE_ABI, provider),
      safeABI = new Interface(AIYELOJA_SAFE_ABI);
    // A real existing owner submits a prevalidated signature on this fork only.
    const owner = plan.automation;
    await fund(owner);
    const signature = concat([zeroPadValue(owner, 32), zeroPadValue("0x00", 32), "0x01"]);
    const execute = async (batch: AiyelojaBatch, success: boolean) => {
      const nonce = Number(await safe.nonce()),
        data = aiyelojaMultiSendData(batch);
      const expectedHash = await safe.getTransactionHash(AIYELOJA_MULTISEND, 0, data, 1, 0, 0, 0, zero, zero, nonce);
      const payload = safeABI.encodeFunctionData("execTransaction", [
        AIYELOJA_MULTISEND,
        0,
        data,
        1,
        0,
        0,
        0,
        zero,
        zero,
        signature,
      ]);
      const hash = await provider.send("eth_sendTransaction", [
        { from: owner, to: plan.safe, data: payload, gas: "0x7a1200" },
      ]);
      const receipt = await minedIsolatedReceipt(provider, hash);
      equal(receipt.status, success ? 1 : 0, "Safe batch receipt");
      equal(await safe.nonce(), nonce + (success ? 1 : 0), "atomic Safe nonce");
      if (success) {
        assertSourceSafeSuccess(
          receipt.logs.map((log) => ({ address: log.address, topics: [...log.topics], data: log.data })),
          plan.safe,
          expectedHash,
        );
      }
      return {
        batch: batch.name,
        nonce,
        safeTransactionHash: expectedHash,
        transactionHash: hash,
        gasUsed: String(receipt.gasUsed),
        status: receipt.status,
      };
    };
    // Funding before issuance must roll back even the preceding approval.
    const failed = await execute(plan.batches[1], false);
    for (const asset of plan.assets)
      equal(
        await new Contract(asset.token, CLC_TOKEN_ABI, provider).allowance(plan.safe, plan.addresses.pool),
        0,
        "failed batch allowance rollback",
      );
    const batches = [];
    for (const batch of plan.batches) {
      equal(await safe.nonce(), batch.nonce, "reviewed batch nonce");
      batches.push(await execute(batch, true));
    }
    const activation = await verifyAiyelojaActivation(provider, plan);
    const excessiveFunding: AiyelojaBatch = {
      name: "negative-holding-cap",
      nonce: Number(await safe.nonce()),
      safe: plan.safe,
      chainId: 100,
      calls: [
        {
          to: plan.assets[0].token,
          value: "0",
          operation: 0,
          data: new Interface(CLC_TOKEN_ABI).encodeFunctionData("approve", [
            plan.addresses.pool,
            BigInt(plan.assets[0].holdingCap) + 1n,
          ]),
        },
        {
          to: plan.addresses.pool,
          value: "0",
          operation: 0,
          data: new Interface(AIYELOJA_SWAP_ABI).encodeFunctionData("deposit", [
            plan.assets[0].token,
            BigInt(plan.assets[0].holdingCap) + 1n,
          ]),
        },
      ],
    };
    const rejectedHoldingCap = await execute(excessiveFunding, false);
    await verifyAiyelojaActivation(provider, plan);
    const factoryAdmin = new Interface(["function changeAdmin(address,address)"]);
    const forbiddenAdmin = await provider.send("eth_sendTransaction", [
      {
        from: sender,
        to: CLC_DEPENDENCIES.factory.address,
        data: factoryAdmin.encodeFunctionData("changeAdmin", [plan.addresses.pool, sender]),
        gas: "0x30d40",
      },
    ]);
    equal(
      (await minedIsolatedReceipt(provider, forbiddenAdmin)).status,
      0,
      "deployer cannot take proxy administration",
    );
    // Direct automation minting is forbidden; the same key may act through the Safe.
    const tokenABI = new Interface(CLC_TOKEN_ABI),
      first = plan.assets[0];
    const forbiddenHash = await provider.send("eth_sendTransaction", [
      { from: owner, to: first.token, data: tokenABI.encodeFunctionData("mintTo", [owner, 1]), gas: "0x30d40" },
    ]);
    equal((await minedIsolatedReceipt(provider, forbiddenHash)).status, 0, "unauthorized direct mint");
    const swaps = [];
    const swapABI = new Interface(AIYELOJA_SWAP_ABI),
      pool = new Contract(plan.addresses.pool, AIYELOJA_SWAP_ABI, provider);
    const [a, b] = plan.assets.filter((asset) => asset.kind === "member-fixture");
    if (!a || !b) throw new Error("Rehearsal requires two member fixtures");
    for (const [input, output] of [
      [a, b],
      [b, a],
    ]) {
      equal(await pool.getQuote(input.token, output.token, 1_000_000), 1_000_000, "exact swap quote");
      const beforeBalance = await new Contract(output.token, CLC_TOKEN_ABI, provider).balanceOf(owner);
      const approve = await provider.send("eth_sendTransaction", [
        {
          from: owner,
          to: input.token,
          data: tokenABI.encodeFunctionData("approve", [plan.addresses.pool, 1_000_000]),
          gas: "0x30d40",
        },
      ]);
      equal((await minedIsolatedReceipt(provider, approve)).status, 1, "swap approval");
      const deadline = (await provider.getBlock("latest"))!.timestamp + 600;
      const hash = await provider.send("eth_sendTransaction", [
        {
          from: owner,
          to: plan.addresses.pool,
          data: swapABI.encodeFunctionData("withdraw", [
            output.token,
            input.token,
            1_000_000,
            owner,
            1_000_000,
            deadline,
          ]),
          gas: "0xf4240",
        },
      ]);
      equal((await minedIsolatedReceipt(provider, hash)).status, 1, "member fixture swap");
      equal(
        await new Contract(output.token, CLC_TOKEN_ABI, provider).balanceOf(owner),
        beforeBalance + 1_000_000n,
        "exact swap output",
      );
      swaps.push({
        input: input.id,
        output: output.id,
        amountIn: "1000000",
        amountOut: "1000000",
        transactionHash: hash,
      });
    }
    await verifyAiyelojaActivation(provider, plan);
    const after = await aiyelojaProductionSnapshot(provider, plan);
    equal(after.hash, before.hash, "production tokens, pools and authorities preserved");
    return {
      schemaVersion: 1,
      kind: "AIYELOJA_TEST_POOL_REHEARSAL",
      evidence: "isolated-fork",
      chainId: 100,
      sourceCommit: plan.sourceCommit,
      planHash: voucherDigest(plan),
      forkBlock: fork.forkBlock,
      forkBlockHash: fork.forkBlockHash,
      authority,
      adopted,
      deployments,
      rejectedPrematureFunding: failed,
      batches,
      activation,
      swaps,
      unauthorizedDirectMintRejected: true,
      unauthorizedProxyAdminRejected: true,
      rejectedHoldingCap,
      productionSnapshot: after,
      appActivationIncluded: false,
      liveBroadcast: false,
    };
  } finally {
    provider.destroy();
    await fork.stop();
  }
}
