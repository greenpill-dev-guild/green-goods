import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { unavailableServiceAccess } from "../../modules/commitment-pooling/data-service-access";
import { isDemoPoolingActive } from "../../modules/commitment-pooling/demo/demo-mode";
import { createCommitmentPoolingReadRepository } from "../../modules/commitment-pooling/read-repository";
import type {
  ServiceAccessAction,
  ServiceAccessKey,
} from "../../modules/commitment-pooling/service-access-types";
import { greenGoodsIndexer } from "../../modules/data/graphql-client";
import type { Address } from "../../types/domain";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useOnlineStatus } from "../app/useOnlineStatus";

const EMPTY_ADDRESS = `0x${"0".repeat(40)}` as Address;
const serviceReads = createCommitmentPoolingReadRepository(greenGoodsIndexer);

function rehearsalEnabled(key: ServiceAccessKey): boolean {
  return (
    import.meta.env.DEV &&
    isDemoPoolingActive() &&
    key.sourceChainId === 42161 &&
    [1022n, 1023n, 1024n, 1025n, 1026n].includes(key.commitmentId)
  );
}

function queryKey(key: ServiceAccessKey | null) {
  return commitmentPoolingKeys.serviceAccess(
    key?.sourceChainId ?? 0,
    key?.coreModule ?? EMPTY_ADDRESS,
    key?.commitmentId ?? 0n,
    key?.buyer ?? EMPTY_ADDRESS,
    key ? rehearsalEnabled(key) : false
  );
}

export function useServiceAccess(key: ServiceAccessKey | null) {
  const online = useOnlineStatus();
  const query = useQuery({
    queryKey: queryKey(key),
    enabled: key !== null,
    retry: false,
    queryFn: async () => {
      if (!key) throw new Error("Service context required");
      if (rehearsalEnabled(key)) {
        const { serviceRehearsalAdapter } = await import(
          "../../modules/commitment-pooling/demo/demo-service-access"
        );
        if (!rehearsalEnabled(key)) return unavailableServiceAccess(key);
        return serviceRehearsalAdapter.read(key);
      }
      return serviceReads.getServiceAccess(key);
    },
  });
  const data = useMemo(() => {
    if (!query.data || online) return query.data;
    return {
      ...query.data,
      availableActions: [],
      voucherSetups: query.data.voucherSetups.map((setup) => ({ ...setup, availableActions: [] })),
      capabilities: {
        ...query.data.capabilities,
        reasons: [...query.data.capabilities.reasons, "offline" as const],
      },
    };
  }, [query.data, online]);
  return { ...query, data };
}

/** Online-only explicit acts. No financial action is admitted to the legacy offline claim queue. */
export function useServiceAccessMutation(key: ServiceAccessKey | null) {
  const client = useQueryClient();
  const handleError = createMutationErrorHandler({
    source: "useServiceAccessMutation",
    toastContext: "service access",
  });
  const online = useOnlineStatus();
  const identity = key
    ? `${key.sourceChainId}:${key.coreModule.toLowerCase()}:${key.commitmentId}:${key.buyer.toLowerCase()}`
    : null;
  const current = useRef(identity);
  current.current = identity;
  const connectivity = useRef(online);
  connectivity.current = online;
  return useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: async (action: ServiceAccessAction) => {
      if (!key || !rehearsalEnabled(key))
        throw new Error(
          "Service access unavailable: reviewed deployment, chain and signer configuration required"
        );
      if (!connectivity.current || (typeof navigator !== "undefined" && !navigator.onLine))
        throw new Error("Service actions require an online connection");
      const { serviceRehearsalAdapter } = await import(
        "../../modules/commitment-pooling/demo/demo-service-access"
      );
      await serviceRehearsalAdapter.read(key);
      if (current.current !== identity || !rehearsalEnabled(key) || !connectivity.current)
        throw new Error("Service account or rehearsal context changed; review again");
      return serviceRehearsalAdapter.execute(key, action);
    },
    onSuccess: (result) => {
      if (current.current === identity && key && rehearsalEnabled(key)) {
        client.setQueryData(queryKey(key), result.snapshot);
        if (result.snapshot.pilot) {
          for (const commitmentId of [1023n, 1025n, 1026n]) {
            if (commitmentId !== key.commitmentId)
              void client.invalidateQueries({
                queryKey: queryKey({ ...key, commitmentId }),
                exact: true,
              });
          }
        }
      }
    },
    onError: (error) => {
      handleError(error);
    },
  });
}
