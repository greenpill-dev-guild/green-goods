import { type QueryKey, useIsMutating, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useIntl } from "react-intl";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { toastService } from "../../components/toast";
import { INDEXER_LAG_SCHEDULE_MS } from "../../config/query-keys/constants";
import { batchKeys } from "../../config/query-keys/garden";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import {
  createDepositChain,
  type DepositHold,
  type DepositTarget,
  depositDomain,
  moveOnFromDepositHold,
  type ProvenDeposit,
  readDepositHold,
} from "../../modules/garden/deposit-batch";
import { depositRoute, walletRouteListed } from "../../modules/garden/deposit-route";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useHeldBatches } from "../garden/useHeldBatches";
import { useProgressiveInvalidation } from "../utils/useTimeout";

/**
 * What a deposit form needs before anyone presses: how many signatures this deposit takes, and any
 * earlier deposit into this target whose outcome is unknown, which pauses the next one here.
 * Recovery does not depend on the rail being listed, so a hold still shows after one is taken off.
 */
export function useDepositPlan(input: {
  target: DepositTarget | null;
  amount: bigint;
  /** For the amounts a hold shows. */
  decimals: number;
  symbol: string;
  /** Whose lists to refresh when a held deposit proves it landed. A campaign jar has no garden. */
  gardenAddress?: string;
  enabled?: boolean;
}) {
  const { target, amount, decimals, symbol, gardenAddress, enabled = true } = input;
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const sender = useTransactionSender();
  const { primaryAddress: account, passkeyAccountProfile } = useUser();
  const { connector } = useAccount();
  const handleError = createMutationErrorHandler({
    source: "useDepositPlan",
    toastContext: "deposit",
    formatMessage,
  });

  const rail =
    sender?.authMode === "passkey" || sender?.authMode === "wallet" ? sender.authMode : null;
  const action = target?.kind === "jar" ? ("jar-deposit" as const) : ("vault-deposit" as const);
  const asset = target?.asset ?? "";
  const canAskWallet =
    enabled &&
    Boolean(target) &&
    rail === "wallet" &&
    walletRouteListed({ action, chainId, asset });

  // Asked only when it can change the route: until then no wallet hears from this hook.
  const { data: walletAtomic } = useQuery({
    queryKey: batchKeys.capability(account ?? "", chainId, connector?.uid ?? ""),
    queryFn: async () => {
      const capability = await sender!.getBatchCapability!({ account: account!, chainId });
      return capability.atomic === "supported";
    },
    enabled: canAskWallet,
    retry: false,
  });
  const route = target
    ? depositRoute({
        action,
        rail,
        passkeyProfile: passkeyAccountProfile,
        walletAtomic,
        chainId,
        asset,
      })
    : null;

  const { data: allowance } = useQuery({
    queryKey: batchKeys.allowance(asset, account ?? "", target?.address ?? "", chainId),
    queryFn: () => createDepositChain(chainId).allowance(account!, target!),
    // Read once there's something to count: a page can hold a form per jar.
    enabled: enabled && Boolean(target && account) && amount > 0n,
    retry: false,
  });
  const domain = target ? depositDomain(target) : "";
  const { data: overCeilings = false } = useQuery<boolean>({
    queryKey: batchKeys.overCeilings(domain, account ?? "", chainId, amount.toString()),
    // Written by the send: nothing to fetch.
    queryFn: () => false,
    enabled: false,
  });

  const stepCount =
    allowance === undefined
      ? null
      : 1 +
        (allowance < amount ? 1 : 0) +
        (target?.kind === "vault" && allowance > 0n && allowance < amount ? 1 : 0);
  const signatures = route?.atomic && !overCeilings ? 1 : stepCount;

  const targetKind = target?.kind;
  const targetAddress = target?.address ?? "";
  const refreshDeposits = useCallback(() => {
    const keys: QueryKey[] =
      targetKind === "jar"
        ? gardenAddress
          ? queryInvalidation.onCookieJarDeposit(gardenAddress, targetAddress, chainId)
          : queryInvalidation.onCampaignCookieJarChanged(
              targetAddress,
              account ?? undefined,
              chainId
            )
        : gardenAddress
          ? queryInvalidation.onVaultDeposit(gardenAddress, account ?? undefined, chainId)
          : [];
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
  }, [targetKind, targetAddress, gardenAddress, account, chainId, queryClient]);
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
    refreshDeposits,
    INDEXER_LAG_SCHEDULE_MS
  );

  const batches = sender?.batches;
  const batchInput = () => ({
    batches: batches!,
    chain: createDepositChain(chainId),
    target: target!,
    scope: { account: account!, chainId },
  });
  const sending = useIsMutating({ mutationKey: batchKeys.depositSend(account ?? "", chainId) }) > 0;
  const held = useHeldBatches<DepositHold, ProvenDeposit>({
    domain,
    account,
    chainId,
    enabled: enabled && Boolean(batches && account && target) && !sending,
    read: (shown) => readDepositHold(batchInput(), shown),
    moveOn: (hold) => moveOnFromDepositHold(batchInput(), hold),
    onSaved: () => {
      const isJar = targetKind === "jar";
      toastService.success({
        title: formatMessage({ id: isJar ? "app.cookieJar.deposit" : "app.treasury.deposit" }),
        message: formatMessage({
          id: isJar ? "app.cookieJar.depositSuccess" : "app.treasury.depositSuccess",
        }),
      });
      void queryClient.invalidateQueries({
        queryKey: batchKeys.allowance(asset, account ?? "", target?.address ?? "", chainId),
      });
      refreshDeposits();
      scheduleFollowUp();
    },
    onError: (error) =>
      handleError(error, { authMode: rail, metadata: { target: target?.address } }),
  });

  const amountText = (value: bigint) => `${formatUnits(value, decimals)} ${symbol}`.trim();
  const { hold } = held;
  return {
    /** How many signatures this deposit takes, once the allowance has been read. */
    signatures,
    signatureLine:
      signatures !== null && amount > 0n
        ? formatMessage({ id: "app.treasury.signatures" }, { count: signatures })
        : null,
    isHeld: hold !== null,
    isSettlingHold: held.isSettlingHold,
    /** On this route an unknown outcome is held, so the hold notice says it, not an error line. */
    unconfirmedIsHeld: route !== null,
    /** What a form shows while held. Spread it onto `TxHoldFeedback`. */
    holdFeedback: hold
      ? {
          title: formatMessage({ id: "app.treasury.hold.title" }),
          message: formatMessage({ id: "app.treasury.hold.body" }),
          detail: formatMessage(
            {
              id:
                hold.held === null
                  ? "app.treasury.hold.attempted"
                  : targetKind === "jar"
                    ? "app.treasury.hold.jar"
                    : "app.treasury.hold.vault",
            },
            { attempted: amountText(hold.amount), held: amountText(hold.held ?? 0n) }
          ),
          hasUnreadValues: hold.held === null,
          isSettling: held.isSettlingHold,
          onCheckAgain: () => void held.checkAgain(),
          onMoveOn: () => void held.moveOn(),
        }
      : null,
  };
}
