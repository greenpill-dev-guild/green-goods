import { readFileSync } from "node:fs";
import { type JsonRpcProvider } from "ethers";
import { buildCastJsonArgs, buildUpgradeBoundarySendArgs } from "../upgrade";
import { OPERATOR } from "../cli/operations.mjs";
import { execCastCaptured, parseCastTransactionHash } from "./cast-env";
import { CONTRACTS_ROOT } from "./paths";
import { releaseJsonPath } from "./release-inputs";
import { writeReleaseJsonAtomic } from "./release-artifacts";
import {
  assertSourceSignedSafeCalldata,
  sourceSafeSignature,
  sourceSafeSignedCalldata,
} from "./source-upgrade-safe-signing";
import { SOURCE_SAFE_EXECUTION, sourceSafeTypedData } from "./source-upgrade-safe-execution";
import type { SourceExecutionContext, SourceBoundaryInput } from "./source-upgrade-execution-types";

export function sourceSafeSignArgs(account: string, typedDataPath: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(account)) throw new Error("Use a normal owner keystore account alias");
  return ["wallet", "sign", typedDataPath, "--data", "--from-file", "--account", account];
}
export function collectSourceSafeSignature(
  context: SourceExecutionContext,
  step: number,
  input: { typedDataPath: string; account?: string; signature?: string },
) {
  if (Boolean(input.account) === Boolean(input.signature))
    throw new Error("Select an owner keystore or one public signature");
  const call = context.plan.ownerCalls[step - context.plan.deployments.length - 1];
  const boundary = context.envelope.boundaries[step - 1];
  writeReleaseJsonAtomic(input.typedDataPath, sourceSafeTypedData(call, boundary, context.manifest.authority.address));
  const env = { ...process.env };
  for (const key of [
    "ETH_FROM",
    "ETH_PRIVATE_KEY",
    "PRIVATE_KEY",
    "ETH_KEYSTORE",
    "ETH_KEYSTORE_ACCOUNT",
    "ETH_PASSWORD",
    "MNEMONIC",
    "ETH_MNEMONIC",
  ])
    delete env[key];
  const signature =
    input.signature ??
    execCastCaptured(
      sourceSafeSignArgs(input.account!, input.typedDataPath),
      {
        cwd: CONTRACTS_ROOT,
        env,
        inputStdio: "inherit",
      },
      "Safe owner EIP-712 signing",
    ).trim();
  return sourceSafeSignature(context, step, signature);
}
export function sourceSafeSendArgs(context: SourceExecutionContext, step: number, data: string, rpcUrl: string) {
  const b = context.envelope.boundaries[step - 1];
  if (
    b.kind !== "safe" ||
    b.from.toLowerCase() !== OPERATOR.toLowerCase() ||
    context.manifest.deployer?.toLowerCase() !== OPERATOR.toLowerCase()
  )
    throw new Error("Safe submission requires the bound approved deployer");
  assertSourceSignedSafeCalldata(context, step, data);
  const args = buildUpgradeBoundarySendArgs(
    {
      index: step - 1,
      transactionType: "CALL",
      contractName: "Safe",
      from: b.from,
      to: context.manifest.authority.address,
      nonce: String(b.outerNonce),
      value: "0",
      gas: b.gasLimit,
      data,
      contractAddress: context.manifest.authority.address,
      function: null,
    },
    "42161",
    b.outerNonce!,
    "green-goods-deployer",
    b.maxFeeWei,
  );
  args.splice(1, 0, "--from", OPERATOR, "--value", "0");
  return buildCastJsonArgs(args, rpcUrl);
}
export function sourceSafeSubmission(input: {
  context: SourceExecutionContext;
  step: number;
  directory: string;
  signatureOne: string;
  signatureTwo: string;
  provider: JsonRpcProvider;
  rpcUrl: string;
}): NonNullable<SourceBoundaryInput["safeSubmission"]> {
  const { context, step, provider, rpcUrl } = input;
  const records = [input.signatureOne, input.signatureTwo].map((file) =>
    JSON.parse(readFileSync(releaseJsonPath(input.directory, file), "utf8")),
  );
  const data = sourceSafeSignedCalldata(context, step, records);
  const b = context.envelope.boundaries[step - 1];
  const args = sourceSafeSendArgs(context, step, data, rpcUrl);
  return Object.freeze({
    data,
    async preflight() {
      const result = await provider.call({
        from: b.from,
        to: context.manifest.authority.address,
        data,
        value: 0n,
        nonce: b.outerNonce,
        gasLimit: BigInt(b.gasLimit),
        maxFeePerGas: BigInt(b.maxFeeWei),
        maxPriorityFeePerGas: 0n,
      });
      if (SOURCE_SAFE_EXECUTION.decodeFunctionResult("execTransaction", result)[0] !== true)
        throw new Error("Signed Safe call simulation did not succeed");
    },
    async submit() {
      return parseCastTransactionHash(
        execCastCaptured(
          args,
          {
            cwd: CONTRACTS_ROOT,
            env: process.env,
            inputStdio: "inherit",
          },
          "Bound Safe owner transaction",
        ),
        "Bound Safe owner transaction",
      );
    },
  });
}
