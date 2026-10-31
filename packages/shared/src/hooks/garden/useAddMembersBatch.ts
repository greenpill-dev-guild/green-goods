import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useIntl } from "react-intl";
import { toastService } from "../../components/toast";
import { DEFAULT_CHAIN_ID } from "../../config/default-chain";
import { batchKeys, gardensKeys } from "../../config/query-keys/garden";
import {
  trackAdminMemberAddFailed,
  trackAdminMemberAddStarted,
  trackAdminMemberAddSuccess,
} from "../../modules/app/analytics-events";
import {
  type AddMembersHold,
  type AddMembersOutcome,
  addGardenMembersBatch,
  addMembersDomain,
  createGardenMembersChain,
  type GardenMemberRow,
  gardenMembersBudget,
  moveOnFromAddMembersHold,
  readAddMembersHold,
  signaturesForMembers,
} from "../../modules/garden/members-batch";
import { isBatchEnabled } from "../../modules/transactions/batch-enablement";
import type { Address, Garden } from "../../types/domain";
import { parseContractError } from "../../utils/errors/contract-errors";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { applyOptimisticUpdate, resetRoleHatAnswers } from "./gardenRosterCache";
import { useHeldBatches } from "./useHeldBatches";

interface AddMembersRequest {
  rows: readonly GardenMemberRow[];
  onLanded?: (rows: readonly GardenMemberRow[]) => void;
}

/**
 * Add a list of people under as few signatures as the rail allows, and settle an add whose outcome
 * is unknown. One `grantRoles` call carries each group, so every wallet can send it. Recovery does
 * not depend on `available`, so a hold from an earlier add still shows after batching is switched
 * off.
 */
export function useAddMembersBatch(gardenId: string) {
  const gardenAddress = gardenId as Address;
  const chainId = DEFAULT_CHAIN_ID;
  const queryClient = useQueryClient();
  const { formatMessage } = useIntl();
  const sender = useTransactionSender();
  const { primaryAddress: account, passkeyAccountProfile } = useUser();
  const handleError = createMutationErrorHandler({
    source: "useAddMembersBatch",
    toastContext: "add members",
    formatMessage,
  });

  const batches = sender?.batches;
  const rail =
    sender?.authMode === "passkey" || sender?.authMode === "wallet" ? sender.authMode : null;
  const profile = rail === "wallet" ? "contract-call" : passkeyAccountProfile;
  const available = Boolean(
    batches &&
      account &&
      rail &&
      profile &&
      gardenMembersBudget(rail, chainId) &&
      isBatchEnabled({ action: "add-members", rail, profile, chainId })
  );

  const domain = addMembersDomain(gardenAddress);
  const holdKey = batchKeys.hold(domain, account ?? "", chainId);
  const batchInput = () => ({
    batches: batches!,
    chain: createGardenMembersChain(gardenAddress, chainId),
    gardenAddress,
    scope: { account: account!, chainId },
  });
  // The roster lags the chain, so what landed joins it now and the role answers start over.
  const landRows = (rows: readonly GardenMemberRow[]) => {
    const key = gardensKeys.byChain(chainId);
    for (const { address, role } of rows) {
      const gardens = queryClient.getQueryData<Garden[]>(key);
      if (gardens) {
        queryClient.setQueryData(
          key,
          applyOptimisticUpdate(gardens, gardenId, role, "add", address)
        );
      }
      void resetRoleHatAnswers(queryClient, gardenId, address);
    }
  };
  const announceAdded = (count: number) =>
    toastService.success({
      title: formatMessage({ id: "app.admin.roles.addedCount" }, { count }),
    });
  const trackFailed = ({ address, role }: GardenMemberRow, error: string) =>
    trackAdminMemberAddFailed({
      gardenAddress,
      memberType: role,
      targetAddress: address,
      error,
    });

  const add = useMutation({
    onMutate: ({ rows }: AddMembersRequest) => {
      for (const { address, role } of rows) {
        trackAdminMemberAddStarted({ gardenAddress, memberType: role, targetAddress: address });
      }
      return queryClient.cancelQueries({ queryKey: holdKey });
    },
    mutationFn: async ({ rows, onLanded }: AddMembersRequest): Promise<AddMembersOutcome> => {
      try {
        return await addGardenMembersBatch({ ...batchInput(), rail: rail!, rows, onLanded });
      } catch (error) {
        return {
          added: [],
          alreadyHeld: [],
          refused: [],
          notSent: [...rows],
          notBatchable: [],
          unknown: [],
          failure: error,
        };
      }
    },
    onSuccess: (outcome) => {
      landRows([...outcome.added, ...outcome.alreadyHeld]);
      for (const { address, role, transactionHash } of outcome.added) {
        trackAdminMemberAddSuccess({
          gardenAddress,
          memberType: role,
          targetAddress: address,
          txHash: transactionHash,
        });
      }
      for (const { reason, ...row } of outcome.refused) trackFailed(row, reason);
      if (outcome.failure) {
        const { message } = parseContractError(outcome.failure);
        for (const row of outcome.notSent) trackFailed(row, message);
        handleError(outcome.failure, { authMode: rail, gardenAddress });
      }
      if (outcome.added.length > 0) {
        announceAdded(outcome.added.length);
      } else if (outcome.alreadyHeld.length > 0 && outcome.notSent.length === 0) {
        toastService.info({
          message: formatMessage(
            { id: "app.admin.roles.alreadyHeldCount" },
            { count: outcome.alreadyHeld.length }
          ),
        });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: holdKey }),
  });

  const held = useHeldBatches<AddMembersHold, GardenMemberRow>({
    domain,
    account,
    chainId,
    enabled: Boolean(batches && account) && !add.isPending,
    read: (shown) => readAddMembersHold(batchInput(), shown),
    moveOn: (hold) => moveOnFromAddMembersHold(batchInput(), hold),
    onSaved: (saved) => {
      landRows(saved);
      announceAdded(saved.length);
    },
    onError: (error) => handleError(error, { authMode: rail, gardenAddress }),
  });

  return {
    ...held,
    available,
    signaturesFor: signaturesForMembers,
    add: (rows: readonly GardenMemberRow[], onLanded?: AddMembersRequest["onLanded"]) =>
      add.mutateAsync({ rows, onLanded }),
  };
}
