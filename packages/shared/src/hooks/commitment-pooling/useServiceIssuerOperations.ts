import { useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { createServiceIssuerOperations } from "../../modules/commitment-pooling/service-issuer-operations";
import type {
  ServiceIssuerActor,
  ServiceIssuerAction,
  ServiceIssuerReview,
} from "../../modules/commitment-pooling/service-issuer-types";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { useOnlineStatus } from "../app/useOnlineStatus";

/** Selected account/asset controller. All mutations require a fresh explicit review; none enter an offline queue. */
export function useServiceIssuerOperations(actor: ServiceIssuerActor | null) {
  const user = useUser();
  const sender = useTransactionSender();
  const online = useOnlineStatus();
  const identity = `${user.authMode}:${user.primaryAddress}:${user.passkeyAccountProfile}:${actor?.routeId}:${actor?.assetId}:${actor?.address}`;
  const current = useRef({ identity, generation: 0, user, sender, online });
  if (current.current.identity !== identity || current.current.sender !== sender)
    current.current.generation++;
  Object.assign(current.current, { identity, user, sender, online });
  const operations = useMemo(
    () =>
      createServiceIssuerOperations({
        session: () => ({
          address: current.current.user.primaryAddress,
          authMode: current.current.user.authMode,
          profile: current.current.user.passkeyAccountProfile ?? null,
          generation: current.current.generation,
          online: current.current.online && (typeof navigator === "undefined" || navigator.onLine),
        }),
        sender: () => current.current.sender,
      }),
    []
  );
  const client = useQueryClient();
  const key = commitmentPoolingKeys.issuerOperations(
    actor?.address,
    actor?.routeId,
    actor?.assetId
  );
  const refresh = () => client.invalidateQueries({ queryKey: key });
  const requiredActor = () => {
    if (!actor) throw new Error("Select a member service asset");
    return actor;
  };
  const snapshot = useQuery({
    queryKey: [...key, identity, current.current.generation],
    retry: false,
    enabled: actor !== null,
    queryFn: () => operations.read(requiredActor()),
  });
  const review = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: (action: ServiceIssuerAction) => operations.review(requiredActor(), action),
  });
  const quote = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: (input: { outputAssetId: string; amount: bigint }) =>
      operations.quote(requiredActor(), input.outputAssetId, input.amount),
  });
  const execute = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: (value: ServiceIssuerReview) => {
      const selected = requiredActor();
      if (
        selected.address.toLowerCase() !== value.actor.address.toLowerCase() ||
        selected.routeId !== value.actor.routeId ||
        selected.assetId !== value.actor.assetId
      )
        throw new Error("Selected issuer context changed; review again");
      return operations.execute(value);
    },
    onSettled: refresh,
  });
  const reconcile = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: () => operations.reconcile(requiredActor()),
    onSettled: refresh,
  });
  return { snapshot, quote, review, execute, reconcile };
}
