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
import { createLiveServiceAccessAdapter } from "../../modules/commitment-pooling/service-access-live";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useOnlineStatus } from "../app/useOnlineStatus";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";

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

function queryKey(key: ServiceAccessKey | null, session: string) {
  return [
    ...commitmentPoolingKeys.serviceAccess(
      key?.sourceChainId ?? 0,
      key?.coreModule ?? EMPTY_ADDRESS,
      key?.commitmentId ?? 0n,
      key?.buyer ?? EMPTY_ADDRESS,
      key ? rehearsalEnabled(key) : false
    ),
    session,
  ];
}

function useLiveServiceAdapter() {
  const user = useUser();
  const sender = useTransactionSender();
  const online = useOnlineStatus();
  const identity = `${user.authMode}:${user.primaryAddress}:${user.passkeyAccountProfile ?? ""}`;
  const state = useRef({ identity, generation: 0, user, sender, online });
  if (state.current.identity !== identity || state.current.sender !== sender)
    state.current.generation += 1;
  Object.assign(state.current, { identity, user, sender, online });
  const adapter = useMemo(
    () =>
      createLiveServiceAccessAdapter({
        session: () => ({
          address: state.current.user.primaryAddress,
          authMode: state.current.user.authMode,
          profile: state.current.user.passkeyAccountProfile ?? null,
          generation: state.current.generation,
          online: state.current.online && (typeof navigator === "undefined" || navigator.onLine),
        }),
        sender: () => state.current.sender,
        readSnapshot: (key) => serviceReads.getServiceAccess(key),
      }),
    []
  );
  return { adapter, session: `${identity}:${state.current.generation}` };
}

export function useServiceAccess(key: ServiceAccessKey | null) {
  const online = useOnlineStatus();
  const live = useLiveServiceAdapter();
  const query = useQuery({
    queryKey: queryKey(key, live.session),
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
      return live.adapter.read(key);
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
  const live = useLiveServiceAdapter();
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
      if (!key)
        throw new Error(
          "Service access unavailable: reviewed deployment, chain and signer configuration required"
        );
      if (!connectivity.current || (typeof navigator !== "undefined" && !navigator.onLine))
        throw new Error("Service actions require an online connection");
      if (!rehearsalEnabled(key)) return live.adapter.execute(key, action);
      const { serviceRehearsalAdapter } = await import(
        "../../modules/commitment-pooling/demo/demo-service-access"
      );
      await serviceRehearsalAdapter.read(key);
      if (current.current !== identity || !rehearsalEnabled(key) || !connectivity.current)
        throw new Error("Service account or rehearsal context changed; review again");
      return serviceRehearsalAdapter.execute(key, action);
    },
    onSuccess: (result) => {
      if (current.current === identity && key) {
        client.setQueryData(queryKey(key, live.session), result.snapshot);
        if (result.snapshot.pilot) {
          for (const commitmentId of [1023n, 1025n, 1026n]) {
            if (commitmentId !== key.commitmentId)
              void client.invalidateQueries({
                queryKey: queryKey({ ...key, commitmentId }, live.session),
                exact: true,
              });
          }
        }
      }
    },
    onError: (error) => {
      handleError(error);
      if (key)
        void client.invalidateQueries({ queryKey: queryKey(key, live.session), exact: true });
    },
    // Holdings, escrow and returns move with any service act, on this promise or another.
    onSettled: () => {
      if (key)
        void client.invalidateQueries({
          queryKey: commitmentPoolingKeys.voucherWallets(key.sourceChainId),
        });
    },
  });
}
