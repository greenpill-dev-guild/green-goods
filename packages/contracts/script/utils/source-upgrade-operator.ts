import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Interface, JsonRpcProvider } from "ethers";
import { buildCastJsonArgs, buildUpgradeBoundarySendArgs } from "../upgrade";
import { OPERATOR } from "../cli/operations.mjs";
import { execCastCaptured, parseCastTransactionHash } from "./cast-env";
import { CONTRACTS_ROOT, getFoundryOutDir } from "./paths";
import { writeReleaseJsonAtomic } from "./release-artifacts";
import { releaseJsonPath, releaseRevision } from "./release-inputs";
import { loadSourceUpgradeCompilerJobs } from "./source-upgrade-compiler";
import { sourceExecutionRemainingBudget, validateSourceExecutionEnvelope } from "./source-upgrade-execution";
import type {
  SourceExecutionContext,
  SourceExecutionEnvelope,
  SourceExecutionRehearsal,
  SourceSafePins,
  SourceExecutionBoundary,
} from "./source-upgrade-execution-types";
import { createSourceExecutionStore, SOURCE_EXECUTION_FILES } from "./source-upgrade-execution-store";
import { prepareSourceUpgradeExecution } from "./source-upgrade-prepare";
import { createSourceUpgradeReadback } from "./source-upgrade-readback";
import {
  buildSourceUpgradePlan,
  inspectSourceUpgradeManifest,
  loadSourceUpgradeArtifacts,
  SOURCE_UPGRADE_TARGETS,
  type SourceUpgradeArtifacts,
  type SourceUpgradeManifest,
  type SourceUpgradePlan,
  type SourceUpgradeDeployment,
} from "./source-upgrade-release";
import { materializeSourceUpgradeRuntimes } from "./source-upgrade-runtime";
import { voucherDigest } from "./voucher-release";
import { collectSourceSafeSignature, sourceSafeSubmission } from "./source-upgrade-safe-operator";
import { sourceSafeTypedData } from "./source-upgrade-safe-execution";
import { runSourceBatchOperator } from "./source-upgrade-batch-operator";

type Options = Record<string, string | boolean | undefined>;
type Loaded = {
  options: Options;
  manifestPath: string;
  manifest: SourceUpgradeManifest;
  plan: SourceUpgradePlan;
  artifacts: SourceUpgradeArtifacts;
  revision: string;
  rpcUrl: string;
};
const SAFE_HASH = new Interface([
  "function getTransactionHash(address,uint256,bytes,uint8,uint256,uint256,uint256,address,address,uint256) view returns(bytes32)",
]);
const directory = path.join(CONTRACTS_ROOT, ".generated/source-upgrades");
function required(options: Options, key: string) {
  const value = options[key];
  if (typeof value !== "string" || !value) throw new Error(`Missing source operator --${key}`);
  return value;
}
function loadJson(root: string, file: string): unknown {
  return JSON.parse(readFileSync(releaseJsonPath(root, file), "utf8"));
}
export function sourceUpgradeOutputPath(root: string, options: Options, fallback: string) {
  const output = releaseJsonPath(root, typeof options.output === "string" ? options.output : fallback);
  if (Object.values(SOURCE_EXECUTION_FILES).some((file) => path.basename(output).toLowerCase() === file))
    throw new Error("Source output cannot overwrite the shared journal or execution locks");
  for (const key of ["plan", "rehearsal", "envelope", "signature-one", "signature-two", "typed-data"])
    if (typeof options[key] === "string" && output.toLowerCase() === releaseJsonPath(root, options[key]).toLowerCase())
      throw new Error("Source output cannot overwrite its reviewed input");
  if (
    ["plan", "simulate", "prepare-execution"].includes(String(options.mode)) &&
    Object.values(SOURCE_EXECUTION_FILES).some((file) => existsSync(releaseJsonPath(root, path.join(root, file))))
  )
    throw new Error("Source preparation cannot replace reviewed inputs after the shared journal or lock exists");
  return output;
}
export function sourceUpgradeCreateArgs(
  deployment: SourceUpgradeDeployment,
  bound: SourceExecutionBoundary,
  rpcUrl: string,
) {
  if (
    deployment.from.toLowerCase() !== OPERATOR.toLowerCase() ||
    bound.from.toLowerCase() !== OPERATOR.toLowerCase() ||
    deployment.to !== null ||
    deployment.value !== "0"
  )
    throw new Error("Source signing requires the approved deployer and zero-value CREATE");
  const transaction = {
    index: bound.step - 1,
    transactionType: "CREATE",
    contractName: deployment.key,
    from: deployment.from,
    to: null,
    nonce: String(deployment.nonce),
    value: "0",
    gas: bound.gasLimit,
    data: deployment.data,
    contractAddress: deployment.address,
    function: null,
  };
  const args = buildUpgradeBoundarySendArgs(
    transaction,
    "42161",
    deployment.nonce,
    "green-goods-deployer",
    bound.maxFeeWei,
  );
  // Cast validates an explicit --from against the unlocked signer before submitting.
  args.splice(1, 0, "--from", OPERATOR, "--value", "0");
  return buildCastJsonArgs(args, rpcUrl);
}

/** Composition root only: protected environment and interactive keystore stay in the operator process. */
export async function runSourceUpgradeOperator(input: Loaded) {
  const { options: o, manifest, manifestPath, plan, revision, artifacts } = input;
  if (manifest.deployer?.toLowerCase() !== OPERATOR.toLowerCase())
    throw new Error("Source execution requires the approved deployer");
  const provider = new JsonRpcProvider(input.rpcUrl, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  try {
    const runtime = materializeSourceUpgradeRuntimes(
      plan,
      manifest,
      artifacts,
      loadSourceUpgradeCompilerJobs(getFoundryOutDir("production"), artifacts),
    );
    const rehearsal = loadJson(directory, required(o, "rehearsal")) as SourceExecutionRehearsal;
    const abis = Object.fromEntries(
      Object.entries(SOURCE_UPGRADE_TARGETS)
        .filter(([target]) => target === "pooling" || manifest.settlement)
        .map(([target, key]) => [target, new Interface(artifacts[key].abi)]),
    );
    const regenerateBindings = async () => {
      if (releaseRevision(CONTRACTS_ROOT, manifestPath) !== revision)
        throw new Error("Source operator revision changed");
      const fresh = inspectSourceUpgradeManifest(JSON.parse(readFileSync(manifestPath, "utf8"))).manifest;
      const compiled = loadSourceUpgradeArtifacts(getFoundryOutDir("production"), fresh);
      // The CLI validates explicit resume; every readback retains the original immutable plan binding.
      const regenerated = buildSourceUpgradePlan(fresh, compiled, plan.sourceCommit);
      const regeneratedRuntime = materializeSourceUpgradeRuntimes(
        regenerated,
        fresh,
        compiled,
        loadSourceUpgradeCompilerJobs(getFoundryOutDir("production"), compiled),
      );
      if (
        voucherDigest(regenerated) !== voucherDigest(plan) ||
        voucherDigest(regeneratedRuntime) !== voucherDigest(runtime)
      )
        throw new Error("Source plan or compiler runtime changed during operation");
      return { plan: regenerated, runtime: regeneratedRuntime };
    };
    if (o.mode === "prepare-execution") {
      const pinsPath = releaseJsonPath(path.join(CONTRACTS_ROOT, "config"), required(o, "safe-pins"));
      if (releaseRevision(CONTRACTS_ROOT, pinsPath) !== revision)
        throw new Error("Safe pins must share the reviewed committed revision");
      const safePins = JSON.parse(readFileSync(pinsPath, "utf8")) as SourceSafePins;
      const result = await prepareSourceUpgradeExecution({
        plan,
        manifest,
        runtime,
        rehearsal,
        provider,
        abis,
        safePins,
        otherArbitrumReservedWei: required(o, "other-reserved-wei"),
      });
      await regenerateBindings();
      if (releaseRevision(CONTRACTS_ROOT, pinsPath) !== revision)
        throw new Error("Safe pins revision changed during preparation");
      const output = sourceUpgradeOutputPath(
        directory,
        o,
        `.generated/source-upgrades/${plan.releaseId}.execution.json`,
      );
      writeReleaseJsonAtomic(output, result.envelope);
      return {
        state: "execution-prepared",
        output: path.relative(CONTRACTS_ROOT, output),
        gasQuotes: result.gasQuotes,
        liveBroadcast: false,
        activationIncluded: false,
      };
    }
    const envelope = loadJson(directory, required(o, "envelope")) as SourceExecutionEnvelope;
    const context: SourceExecutionContext = { plan, manifest, runtime, rehearsal, envelope };
    validateSourceExecutionEnvelope(context);
    if (["export-safe-batch", "adopt-safe-batch"].includes(String(o.mode))) {
      return await runSourceBatchOperator({
        options: o,
        context,
        directory,
        provider,
        abis,
        revision,
        regenerateBindings,
      });
    }
    const step = Number(required(o, "step")),
      expectedNonce = Number(required(o, "expected-nonce"));
    const boundary = envelope.boundaries[step - 1];
    if (!boundary) throw new Error("Unknown source execution boundary");
    if (o.mode === "broadcast" && boundary.kind !== "create")
      throw new Error("Safe boundaries require external signatures and receipt adoption");
    if (["export-safe", "sign-safe", "broadcast-safe"].includes(String(o.mode)) && boundary.kind !== "safe")
      throw new Error("Only Safe owner boundaries support this mode");
    const store = createSourceExecutionStore({ directory, context });
    const port = createSourceUpgradeReadback({
      provider,
      context,
      abis,
      journal: () => store.readJournal(),
      regenerateBindings,
    });
    if (o.mode !== "adopt") {
      const journal = store.readJournal();
      const budget = sourceExecutionRemainingBudget(journal, envelope, journal.completed.length);
      const reserved =
        BigInt(budget.remainingMaximumWei) + BigInt(envelope.otherArbitrumReservedWei) + BigInt(envelope.ccipBudgetWei);
      if ((await provider.getBalance(manifest.deployer!, "pending")) < reserved)
        throw new Error("Deployer balance cannot cover remaining gas and shared CCIP reservations");
    }
    const args = { step, expectedNonce, port, ...(typeof o.receipt === "string" ? { receiptHash: o.receipt } : {}) };
    const safeSubmission =
      o.mode === "broadcast-safe"
        ? sourceSafeSubmission({
            context,
            step,
            directory,
            signatureOne: required(o, "signature-one"),
            signatureTwo: required(o, "signature-two"),
            provider,
            rpcUrl: input.rpcUrl,
          })
        : undefined;
    const result = o["recover-lock"]
      ? await store.recoverBoundary({ ...args, receiptHash: required(o, "receipt") })
      : await store.executeBoundary({
          ...args,
          ...(safeSubmission ? { safeSubmission } : {}),
          ...(o.mode === "broadcast"
            ? {
                operatorSubmitCreate: async (deployment, bound) => {
                  const output = execCastCaptured(
                    sourceUpgradeCreateArgs(deployment, bound, input.rpcUrl),
                    { cwd: CONTRACTS_ROOT, env: process.env, inputStdio: "inherit" },
                    "Source upgrade boundary",
                  );
                  return parseCastTransactionHash(output, "Source upgrade boundary");
                },
              }
            : {}),
        });
    if (result.state === "needs-external-safe-signatures") {
      if (!["export-safe", "sign-safe"].includes(String(o.mode)))
        throw new Error("Use export-safe or sign-safe for a Safe boundary");
      const recipe = result.boundary;
      const head = await provider.getBlock("latest");
      if (!head?.hash) throw new Error("Missing canonical Safe export block");
      const data = SAFE_HASH.encodeFunctionData("getTransactionHash", [
        recipe.to,
        recipe.value,
        recipe.data,
        recipe.operation,
        recipe.safeTxGas,
        recipe.baseGas,
        recipe.gasPrice,
        recipe.gasToken,
        recipe.refundReceiver,
        recipe.nonce,
      ]);
      const liveHash = SAFE_HASH.decodeFunctionResult(
        "getTransactionHash",
        await provider.call({ to: manifest.authority.address, data, blockTag: head.number }),
      )[0];
      if (
        String(liveHash).toLowerCase() !== recipe.safeTransactionHash.toLowerCase() ||
        (await provider.getBlock(head.number))?.hash !== head.hash
      )
        throw new Error("Canonical Safe transaction hash mismatch");
      const typedDataPath = sourceUpgradeOutputPath(
        directory,
        {
          ...o,
          output: `.generated/source-upgrades/${plan.releaseId}.safe-step-${step}.typed-data.json`,
        },
        "unused.json",
      );
      writeReleaseJsonAtomic(
        typedDataPath,
        sourceSafeTypedData(plan.ownerCalls[step - plan.deployments.length - 1], boundary, manifest.authority.address),
      );
      if (o.mode === "sign-safe") {
        if (typeof o.output === "string")
          sourceUpgradeOutputPath(directory, { ...o, "typed-data": typedDataPath }, "unused.json");
        console.log(
          `Review Safe ${recipe.safe} step ${step}, SafeTx ${recipe.safeTransactionHash}; signing does not broadcast.`,
        );
        const signature = collectSourceSafeSignature(context, step, {
          typedDataPath,
          account: typeof o["signer-account"] === "string" ? o["signer-account"] : undefined,
          signature: typeof o["owner-signature"] === "string" ? o["owner-signature"] : undefined,
        });
        await regenerateBindings();
        await port.assertPreconditions(step, store.readJournal());
        if ((await port.getPendingNonce(boundary.from)) !== expectedNonce)
          throw new Error("Pending nonce changed during owner signing");
        const output = sourceUpgradeOutputPath(
          directory,
          { ...o, "typed-data": typedDataPath },
          `.generated/source-upgrades/${plan.releaseId}.safe-step-${step}.signature-${signature.owner.toLowerCase()}.json`,
        );
        writeReleaseJsonAtomic(output, signature);
        return {
          state: "owner-signature-verified",
          output: path.relative(CONTRACTS_ROOT, output),
          owner: signature.owner,
          safeTransactionHash: signature.safeTransactionHash,
          liveBroadcast: false,
        };
      }
      const output = sourceUpgradeOutputPath(
        directory,
        o,
        `.generated/source-upgrades/${plan.releaseId}.safe-step-${step}.json`,
      );
      writeReleaseJsonAtomic(output, {
        ...recipe,
        planHash: envelope.planHash,
        envelopeHash: store.readJournal().envelopeHash,
        observation: { blockNumber: head.number, blockHash: head.hash },
        liveBroadcast: false,
        activationIncluded: false,
      });
      return {
        state: result.state,
        output: path.relative(CONTRACTS_ROOT, output),
        typedDataOutput: path.relative(CONTRACTS_ROOT, typedDataPath),
        safeTransactionHash: recipe.safeTransactionHash,
        liveBroadcast: false,
        activationIncluded: false,
      };
    }
    return {
      ...result,
      liveBroadcast: ["broadcast", "broadcast-safe"].includes(String(o.mode)),
      activationIncluded: false,
    };
  } finally {
    provider.destroy();
  }
}
