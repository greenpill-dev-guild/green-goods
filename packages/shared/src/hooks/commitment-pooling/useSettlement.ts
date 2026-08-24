import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Hex } from "viem";
import { useReadContract } from "wagmi";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { selectCommitmentPoolingAvailability } from "../../modules/commitment-pooling/selectors";
import { selectOperationsCapabilities } from "../../modules/commitment-pooling/settlement";
import { isPoolSteward } from "../../modules/commitment-pooling/steward-selectors";
import { getOntologyChainMaturity } from "../../ontology/query";
import type { Address } from "../../types/domain";
import { isZeroAddress } from "../../utils/blockchain/address";
import { getNetworkContracts, SettlementModuleABI } from "../../utils/blockchain/contracts";
import { parseContractError } from "../../utils/errors/contract-errors";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useGardenRoles } from "../roles/useGardenRoles";

const OWNER_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;

export type SettlementMutationInput =
  | { action: "queueFunding"; garden: Address; amount: bigint }
  | { action: "recordFunding"; commitmentId: bigint; funder: Address; refundAccount: Address }
  | { action: "recordFundingDeposit"; fundingId: bigint; amount: bigint; depositReference: Hex }
  | { action: "consumeFunding" | "queueFundingRefund"; fundingId: bigint }
  | {
      action: "createCommitmentPayoutPlan";
      commitmentId: bigint;
      recognitionEntries: readonly { contributor: Address; recognitionWeightBps: number }[];
      recognitionSnapshotHash: Hex;
    }
  | {
      action: "setContributorPayouts";
      payoutPlanId: bigint;
      gardenRetainedAmount: bigint;
      payouts: readonly { contributor: Address; amount: bigint }[];
      reasonCID: string;
    }
  | {
      action: "finalizeCommitmentPayoutPlan" | "prepareGardenBeneficiaryPayout";
      payoutPlanId: bigint;
    }
  | { action: "prepareContributorPayout"; payoutPlanId: bigint; contributor: Address }
  | { action: "createBatch"; disbursementIds: readonly bigint[] }
  | { action: "dispatchDisbursement" | "retryCommand" | "requeue"; disbursementId: bigint }
  | { action: "dispatchBatch" | "retryBatchCommand"; batchId: bigint }
  | { action: "cancelDisbursement"; disbursementId: bigint; reasonCID: string }
  | { action: "cancelBatch"; batchId: bigint; reasonCID: string }
  | { action: "setGardenerDeliveryEnabled"; enabled: boolean }
  | { action: "setAccountActive"; garden: Address; active: boolean }
  | {
      action: "updateSettlementRecovery";
      garden: Address;
      recoveryOwners: readonly [Address, Address, Address];
    };

function settlementArgs(input: SettlementMutationInput): readonly unknown[] {
  switch (input.action) {
    case "queueFunding":
      return [input.garden, input.amount];
    case "recordFunding":
      return [input.commitmentId, input.funder, input.refundAccount];
    case "recordFundingDeposit":
      return [input.fundingId, input.amount, input.depositReference];
    case "consumeFunding":
    case "queueFundingRefund":
      return [input.fundingId];
    case "createCommitmentPayoutPlan":
      return [input.commitmentId, input.recognitionEntries, input.recognitionSnapshotHash];
    case "setContributorPayouts":
      return [input.payoutPlanId, input.gardenRetainedAmount, input.payouts, input.reasonCID];
    case "finalizeCommitmentPayoutPlan":
    case "prepareGardenBeneficiaryPayout":
      return [input.payoutPlanId];
    case "prepareContributorPayout":
      return [input.payoutPlanId, input.contributor];
    case "createBatch":
      return [input.disbursementIds];
    case "dispatchDisbursement":
    case "retryCommand":
    case "requeue":
      return [input.disbursementId];
    case "dispatchBatch":
    case "retryBatchCommand":
      return [input.batchId];
    case "cancelDisbursement":
      return [input.disbursementId, input.reasonCID];
    case "cancelBatch":
      return [input.batchId, input.reasonCID];
    case "setGardenerDeliveryEnabled":
      return [input.enabled];
    case "setAccountActive":
      return [input.garden, input.active];
    case "updateSettlementRecovery":
      return [input.garden, input.recoveryOwners];
  }
}

export function useSettlementMutation(options: { chainId?: number } = {}) {
  const currentChainId = useCurrentChain();
  const chainId = options.chainId ?? currentChainId;
  const sender = useTransactionSender();
  const queryClient = useQueryClient();
  const handleError = createMutationErrorHandler({
    source: "useSettlementMutation",
    toastContext: "settlement update",
  });
  return useMutation({
    mutationFn: async (input: SettlementMutationInput) => {
      if (!sender) throw new Error("Transaction sender is unavailable");
      const availability = selectCommitmentPoolingAvailability(
        getOntologyChainMaturity("entity:commitment-pool", chainId)
      );
      if (availability.status !== "available") {
        throw new Error("Commitment Pooling is unavailable on this chain");
      }
      const settlementModule = getNetworkContracts(chainId).settlementModule;
      if (isZeroAddress(settlementModule))
        throw new Error("Settlement is not deployed on this chain");
      const result = await sender.sendContractCall({
        address: settlementModule,
        abi: SettlementModuleABI,
        functionName: input.action,
        args: settlementArgs(input),
        chainId,
      });
      return result.hash;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: commitmentPoolingKeys.all(chainId) });
    },
    onError: (error, input) => {
      const parsed = parseContractError(error);
      handleError(error, {
        metadata: { action: input.action, chainId, parsedErrorName: parsed.name },
      });
    },
  });
}

export function useSettlementOperationsCapabilities(input: {
  chainId: number;
  account?: Address;
  protocolGarden?: Address | null;
  executorGarden?: Address | null;
  isDeployer: boolean;
}) {
  const settlementModule = getNetworkContracts(input.chainId).settlementModule;
  const availability = selectCommitmentPoolingAvailability(
    getOntologyChainMaturity("entity:commitment-pool", input.chainId)
  );
  const enabled = Boolean(
    input.account && availability.status === "available" && !isZeroAddress(settlementModule)
  );
  const owner = useReadContract({
    address: settlementModule,
    abi: OWNER_ABI,
    functionName: "owner",
    chainId: input.chainId,
    query: { enabled },
  });
  const dispatcher = useReadContract({
    address: settlementModule,
    abi: SettlementModuleABI,
    functionName: "dispatcher",
    chainId: input.chainId,
    query: { enabled },
  });
  const protocolRoles = useGardenRoles(input.protocolGarden, input.account, input.chainId);
  const executorRoles = useGardenRoles(input.executorGarden, input.account, input.chainId);
  const role = isPoolSteward;
  const authorityResolved =
    enabled &&
    !owner.isLoading &&
    !dispatcher.isLoading &&
    !protocolRoles.isLoading &&
    !executorRoles.isLoading &&
    !owner.error &&
    !dispatcher.error &&
    !protocolRoles.error &&
    !executorRoles.error;
  const normalized = input.account?.toLowerCase();
  return {
    ...selectOperationsCapabilities({
      authorityResolved,
      isSettlementOwner: typeof owner.data === "string" && owner.data.toLowerCase() === normalized,
      isProtocolSteward: role(protocolRoles.roles),
      isExecutorSteward: role(executorRoles.roles),
      isDispatcher:
        typeof dispatcher.data === "string" && dispatcher.data.toLowerCase() === normalized,
      isDeployer: input.isDeployer,
    }),
    isLoading:
      owner.isLoading || dispatcher.isLoading || protocolRoles.isLoading || executorRoles.isLoading,
  };
}
