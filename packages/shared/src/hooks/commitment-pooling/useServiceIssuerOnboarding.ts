import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import {
  type ServiceIssuerDraft,
  type ServiceIssuerDraftRecord,
  signServiceIssuerApproval,
} from "../../modules/commitment-pooling/service-issuer-approval";
import { serviceActorAccountSupported } from "../../modules/commitment-pooling/service-actor-session";
import {
  issuerPoolListing,
  serviceIssuerChain,
} from "../../modules/commitment-pooling/service-issuer-chain";
import { SERVICE_ISSUER_ROUTES } from "../../modules/commitment-pooling/service-issuer-metadata";
import type {
  ServiceIssuerPoolListing,
  ServiceIssuerRoute,
} from "../../modules/commitment-pooling/service-issuer-types";
import type { Address } from "../../types/domain";
import { useOnlineStatus } from "../app/useOnlineStatus";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";

export type ServiceIssuerDrafts =
  | { status: "unavailable" }
  | { status: "observed"; records: readonly ServiceIssuerDraftRecord[] };

const NO_DRAFT_DESK: ServiceIssuerDrafts = { status: "unavailable" };

/**
 * The drafts stewards prepared for member issuers: one member's own, or every member's for the
 * stewards' card. No draft desk exists yet, so the read answers unavailable and no live draft
 * reaches a member's approval; Storybook seeds the key.
 */
export function useServiceIssuerDrafts(member?: Address | null) {
  return useQuery({
    queryKey: commitmentPoolingKeys.issuerDrafts(member),
    queryFn: async (): Promise<ServiceIssuerDrafts> => NO_DRAFT_DESK,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/**
 * The member signs one draft revision's exact terms from their own account; nothing is sent or
 * issued. The signed record joins the drafts read, where the desk that records it will keep it.
 * `canSign` says whether this account can sign on the voucher network at all, so a draft waits
 * visibly instead of offering an approval that would be refused.
 */
export function useServiceIssuerApproval() {
  const user = useUser();
  const sender = useTransactionSender();
  const online = useOnlineStatus();
  const identity = `${user.authMode}:${user.primaryAddress}:${user.passkeyAccountProfile}`;
  const current = useRef({ identity, generation: 0, user, sender, online });
  if (current.current.identity !== identity || current.current.sender !== sender)
    current.current.generation++;
  Object.assign(current.current, { identity, user, sender, online });
  const client = useQueryClient();
  const approve = useMutation({
    retry: false,
    networkMode: "always",
    mutationFn: (draft: ServiceIssuerDraft) =>
      signServiceIssuerApproval(
        {
          session: () => ({
            address: current.current.user.primaryAddress,
            authMode: current.current.user.authMode,
            profile: current.current.user.passkeyAccountProfile ?? null,
            generation: current.current.generation,
            online:
              current.current.online && (typeof navigator === "undefined" || navigator.onLine),
          }),
          sender: () => current.current.sender,
          chain: serviceIssuerChain,
          now: () => BigInt(Math.floor(Date.now() / 1000)),
        },
        draft
      ),
    onSuccess: (approval) =>
      client.setQueriesData<ServiceIssuerDrafts>(
        { queryKey: commitmentPoolingKeys.issuerDrafts() },
        (drafts) =>
          drafts?.status === "observed"
            ? {
                status: "observed",
                records: drafts.records.map((record) =>
                  record.draft.id === approval.draftId ? { ...record, approval } : record
                ),
              }
            : drafts
      ),
  });
  const canSign = serviceActorAccountSupported({
    authMode: user.authMode,
    profile: user.passkeyAccountProfile ?? null,
  });
  return { approve, canSign };
}

export type ServiceIssuerListings = ReadonlyMap<string, ServiceIssuerPoolListing>;
export const serviceIssuerListingKey = (routeId: string, assetId: string) =>
  `${routeId}:${assetId}`;

/** Each reviewed issuer token's admission and holding limit in the shared pool, for the card. */
export function useServiceIssuerListings(
  routes: readonly ServiceIssuerRoute[] = SERVICE_ISSUER_ROUTES
) {
  return useQuery({
    queryKey: commitmentPoolingKeys.issuerListings(routes.map((route) => route.service.id)),
    enabled: routes.length > 0,
    retry: false,
    queryFn: async (): Promise<ServiceIssuerListings> =>
      new Map(
        await Promise.all(
          routes.flatMap((route) =>
            route.assets.map(
              async (asset) =>
                [
                  serviceIssuerListingKey(route.service.id, asset.id),
                  await issuerPoolListing(serviceIssuerChain, route, asset),
                ] as const
            )
          )
        )
      ),
  });
}
