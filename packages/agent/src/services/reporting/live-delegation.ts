import { formatUserOperation } from "viem/account-abstraction";
import { dirname, join } from "node:path";
import {
  grantPolicyDigest,
  type GrantPolicy,
  type PermissionModuleEntry,
  VERIFIED_PERMISSION_MODULES,
} from "@green-goods/shared/modules/agent-reporting";
import {
  grantPermissionValidator,
  grantRevocationDescriptor,
  publicGrantSigner,
  signGrantedKernelActivation,
  signGrantedKernelOperation,
} from "@green-goods/shared/modules/agent-reporting/kernel-permissions";
import { createPublicClient, http, zeroAddress, type Chain, type Hex } from "viem";
import type { ReportingRuntimeOptions } from "../../runtime/reporting";
import type { ReportingConfig } from "./config";
import { createReportingKeyring } from "./keyring";
import { createGrantSignerCustody } from "./signer-custody";

/** No signer is loaded/created unless deployed policy pins, measured budgets and custody exist. */
export function createLiveDelegation(input: {
  config: ReportingConfig;
  chain: Chain;
  rpcUrl: string;
  env: Record<string, string | undefined>;
}): {
  delegationModules: readonly PermissionModuleEntry[];
  delegation?: ReportingRuntimeOptions["delegation"];
} {
  const module = VERIFIED_PERMISSION_MODULES.find((entry) => entry.chainId === input.chain.id);
  const wrappingKeys = input.env.AGENT_REPORTING_SIGNER_KEYS?.trim();
  const apiKey = input.env.PIMLICO_API_KEY?.trim() || input.env.VITE_PIMLICO_API_KEY?.trim();
  const sponsorshipPolicyId =
    input.env.PIMLICO_SPONSORSHIP_POLICY_ID?.trim() ||
    input.env.VITE_PIMLICO_SPONSORSHIP_POLICY_ID?.trim();
  if (
    !module?.singleCallPolicy ||
    !module.singleCallPolicyCodeHash ||
    !module.approvedPaymaster ||
    !module.gasCostCapsWei ||
    !module.measuredGasUnitsPerSubmission ||
    !wrappingKeys ||
    !apiKey ||
    !sponsorshipPolicyId
  ) {
    return { delegationModules: [] };
  }
  const gasPerSubmission = module.measuredGasUnitsPerSubmission;
  const client = createPublicClient({ chain: input.chain, transport: http(input.rpcUrl) });
  const custody = createGrantSignerCustody(
    join(dirname(input.config.dbPath), "reporting-signers"),
    createReportingKeyring(wrappingKeys)
  );
  const bundlerUrl = `https://api.pimlico.io/v2/${input.chain.id}/rpc?apikey=${encodeURIComponent(apiKey)}`;
  const permissionIdFor = async (policy: GrantPolicy) =>
    (
      await grantPermissionValidator(client, {
        policy,
        signer: publicGrantSigner(policy),
        scope: {
          purpose: policy.purpose,
          easAddress: policy.easAddress as Hex,
          schemaUID: policy.schemaUID,
          gardenAddress: policy.gardenAddress as Hex,
        },
      })
    ).getIdentifier();
  return {
    delegationModules: [module],
    delegation: {
      gasCap: gasPerSubmission * 5,
      gasPerSubmission,
      permissionIdFor,
      createSigner: () => custody.create(),
      descriptorFor: (policy, permissionId) =>
        JSON.stringify(
          grantRevocationDescriptor({
            policy,
            permissionId,
            validatorAddress: module.validatorAddress as Hex,
            validatorCodeHash: module.validatorCodeHash,
            policyDigest: grantPolicyDigest(policy),
          })
        ),
      sender: {
        signerAddress: zeroAddress,
        async sign({ grant, envelope, nonceRef, onPrepared }) {
          const signer = await custody.account(grant.signerKeyRef);
          return signGrantedKernelOperation({
            client,
            bundlerUrl,
            sponsorshipPolicyId,
            signer,
            policy: grant.policy,
            envelope,
            reservedGasUnits: gasPerSubmission,
            ...(nonceRef ? { nonce: BigInt(nonceRef) } : {}),
            ...(onPrepared ? { onPrepared } : {}),
          });
        },
        async signActivation({ grant, envelope, userOperation }) {
          const signer = await custody.account(grant.signerKeyRef);
          return signGrantedKernelActivation({
            client,
            policy: grant.policy,
            envelope,
            signer,
            operation: formatUserOperation({ ...userOperation, signature: "0x" }),
          });
        },
        async submit(signedOperation) {
          const signed = JSON.parse(signedOperation) as {
            userOperationHash?: string;
            request?: unknown;
          };
          if (
            !signed.request ||
            !signed.userOperationHash ||
            !/^0x[0-9a-fA-F]{64}$/.test(signed.userOperationHash)
          )
            throw new Error("Invalid signed operation");
          const response = await fetch(bundlerUrl, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "eth_sendUserOperation",
              params: [signed.request, "0x0000000071727De22E5E9d8BAf0edAc6f37da032"],
            }),
            signal: AbortSignal.timeout(20_000),
          });
          const result = (await response.json()) as { result?: string; error?: unknown };
          return {
            accepted:
              response.ok &&
              result.result?.toLowerCase() === signed.userOperationHash.toLowerCase(),
            retryable: false,
            ...(result.error ? { errorCode: "bundler_refused" } : {}),
          };
        },
      },
    },
  };
}
