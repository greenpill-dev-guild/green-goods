/**
 * useSettlementOperationsController Hook
 *
 * The settlement module's operations flags for the protocol console: who
 * owns the module, whether the source is paused, and whether gardener
 * delivery is enabled. The one write it offers, `setGardenerDeliveryEnabled`,
 * is owner-only on chain; the card shows it to owners and deployers, enables
 * it for the owner alone, and reads the flag back from the chain after the
 * transaction rather than assuming the flip landed.
 *
 * @module hooks/admin-ui/pool/useSettlementOperationsController
 */

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SettlementActStatus, SettlementOperationsController } from "./controller.types";

import { STALE_TIME_MEDIUM } from "../../../config/query-keys/constants";
import { commitmentPoolingKeys } from "../../../config/query-keys/commitment-pooling";
import { readSettlementOperationsState } from "../../../modules/commitment-pooling/data-settlement-operations";
import type { HexString } from "../../../modules/commitment-pooling/types-core";
import { isZeroAddress } from "../../../utils/blockchain/address";
import { getNetworkContracts } from "../../../utils/blockchain/contracts";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useCommitmentPoolingAvailability } from "../../commitment-pooling/useCommitmentPoolingAvailability";
import { useSettlementMutation } from "../../commitment-pooling/useSettlement";
import { useRole } from "../../gardener/useRole";

export function useSettlementOperationsController(input: {
  chainId: number;
}): SettlementOperationsController {
  const { chainId } = input;
  const viewer = usePrimaryAddress() ?? undefined;
  const { isDeployer } = useRole();
  const availability = useCommitmentPoolingAvailability({ chainId });
  const settlementModule = getNetworkContracts(chainId).settlementModule;
  const query = useQuery({
    queryKey: commitmentPoolingKeys.settlementOperations(chainId),
    queryFn: () => readSettlementOperationsState(chainId),
    enabled: availability.status === "available" && !isZeroAddress(settlementModule),
    staleTime: STALE_TIME_MEDIUM,
  });
  const mutation = useSettlementMutation({ chainId });
  const [lastAct, setLastAct] = useState<SettlementActStatus | null>(null);
  const requestedDelivery = useRef<boolean | null>(null);

  const owner = query.data?.owner ?? null;
  const isSettlementOwner = Boolean(
    viewer && owner && owner.toLowerCase() === viewer.toLowerCase()
  );

  const reconcileDeliveryReadback = useCallback((actual: boolean | undefined) => {
    const requested = requestedDelivery.current;
    if (requested === null || actual === undefined || actual !== requested) return;
    requestedDelivery.current = null;
    setLastAct((current) =>
      current?.kind === "set-gardener-delivery"
        ? { kind: current.kind, phase: "confirmed", hash: current.hash }
        : current
    );
  }, []);

  useEffect(() => {
    reconcileDeliveryReadback(query.data?.gardenerDeliveryEnabled);
  }, [query.data?.gardenerDeliveryEnabled, reconcileDeliveryReadback]);

  const checkDeliveryStatus = useCallback(async (): Promise<void> => {
    const result = await query.refetch();
    reconcileDeliveryReadback(result.data?.gardenerDeliveryEnabled);
  }, [query, reconcileDeliveryReadback]);

  const setGardenerDelivery = useCallback(
    async (enabled: boolean): Promise<HexString> => {
      requestedDelivery.current = enabled;
      setLastAct({ kind: "set-gardener-delivery", phase: "signing" });
      try {
        const hash = (await mutation.mutateAsync({
          action: "setGardenerDeliveryEnabled",
          enabled,
        })) as HexString;
        setLastAct({ kind: "set-gardener-delivery", phase: "submitted", hash });
        // The flag the card shows is the chain's answer, never the request.
        const result = await query.refetch();
        reconcileDeliveryReadback(result.data?.gardenerDeliveryEnabled);
        return hash;
      } catch (error) {
        requestedDelivery.current = null;
        setLastAct({ kind: "set-gardener-delivery", phase: "failed", error });
        await query.refetch().catch(() => undefined);
        throw error;
      }
    },
    [mutation, query, reconcileDeliveryReadback]
  );

  return {
    chainId,
    viewer,
    availability,
    gardenerDeliveryEnabled: query.data ? query.data.gardenerDeliveryEnabled : null,
    sourcePaused: query.data ? query.data.sourcePaused : null,
    owner,
    isSettlementOwner,
    isDeployer,
    canConfigureDelivery: isSettlementOwner && Boolean(viewer),
    showControl: isSettlementOwner || isDeployer,
    isLoading: query.isLoading,
    isError: query.isError,
    isPending: mutation.isPending,
    lastAct,
    setGardenerDelivery,
    checkDeliveryStatus,
    refetch: query.refetch,
  };
}
