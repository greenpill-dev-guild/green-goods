import { useCallback, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSignMessage } from "wagmi";
import type {
  ServiceIssuerDeskRecord,
  ServiceIssuerDeskSelection,
  ServiceIssuerDraft,
} from "../../public-contracts/service-issuer-desk";
import { createServiceIssuerDeskClient } from "../../modules/commitment-pooling/service-issuer-desk-client";
import { signServiceIssuerApproval } from "../../modules/commitment-pooling/service-issuer-approval";
import { serviceIssuerTermsDigest } from "../../modules/commitment-pooling/service-issuer-approval-terms";
import { serviceIssuerChain } from "../../modules/commitment-pooling/service-issuer-chain";
import { serviceActorAccountSupported } from "../../modules/commitment-pooling/service-actor-session";
import { createAccountMessageSigner } from "../../modules/auth/account-message-signer";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { logger } from "../../modules/app/logger";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";

/** An explicit signed desk session. Loading or reviewing never deploys, issues or sends tokens. */
export function useServiceIssuerDesk(selection?: ServiceIssuerDeskSelection | null) {
  const user = useUser();
  const sender = useTransactionSender();
  const cache = useQueryClient();
  const { signMessageAsync } = useSignMessage();
  const identity = `${user.authMode}:${user.primaryAddress}:${user.passkeyAccountProfile}:${selection?.routeId}:${selection?.poolId}`;
  const current = useRef({ identity, generation: 0, user, sender, signMessageAsync });
  if (current.current.identity !== identity || current.current.sender !== sender)
    current.current.generation++;
  Object.assign(current.current, { identity, user, sender, signMessageAsync });
  const generation = current.current.generation;
  const assertCurrent = useCallback(() => {
    if (current.current.generation !== generation)
      throw new Error("Desk account changed; review again");
    if (typeof navigator !== "undefined" && !navigator.onLine)
      throw new Error("Desk connection unavailable");
  }, [generation]);
  const client = useMemo(
    () =>
      user.primaryAddress
        ? createServiceIssuerDeskClient({
            account: user.primaryAddress,
            assertCurrent,
            sign: async (message) => {
              assertCurrent();
              const auth = current.current.user;
              const account =
                auth.authMode === "passkey" ? await auth.resolveSmartAccountClient?.(100) : null;
              assertCurrent();
              return createAccountMessageSigner({
                authMode: auth.authMode,
                signMessage: current.current.signMessageAsync,
                account: account?.account,
              })(message);
            },
          })
        : null,
    [assertCurrent, user.primaryAddress]
  );
  const key = commitmentPoolingKeys.issuerDesk(user.primaryAddress, selection);
  const records = useQuery<ServiceIssuerDeskRecord[]>({
    queryKey: key,
    enabled: false,
    queryFn: async () => [],
  });
  const required = () => {
    assertCurrent();
    if (!client) throw new Error("Connect an account first");
    return client;
  };
  const remember = (record: ServiceIssuerDeskRecord) => {
    assertCurrent();
    cache.setQueryData<ServiceIssuerDeskRecord[]>(key, (previous = []) => [
      record,
      ...previous.filter((r) => r.draft.id !== record.draft.id),
    ]);
    return record;
  };
  const options = {
    retry: false,
    networkMode: "always" as const,
    onError: (cause: unknown) =>
      logger.error("Service issuer desk action failed", {
        error: cause instanceof Error ? cause.message : "unknown",
      }),
  };
  const load = useMutation({
    ...options,
    mutationFn: async () => {
      const result = await required().request({ action: "list", selection: selection ?? null });
      assertCurrent();
      cache.setQueryData(key, result.records!);
      return result.records!;
    },
  });
  const save = useMutation({
    ...options,
    mutationFn: async (input: { draft: ServiceIssuerDraft; expectedRevision: number | null }) => {
      if (!selection) throw new Error("Select the service exchange pool");
      return remember((await required().request({ action: "save", selection, ...input })).record!);
    },
  });
  const send = useMutation({
    ...options,
    mutationFn: async (record: ServiceIssuerDeskRecord) =>
      remember(
        (
          await required().request({
            action: "send",
            id: record.draft.id,
            expectedRevision: record.revision,
          })
        ).record!
      ),
  });
  const decline = useMutation({
    ...options,
    mutationFn: async (record: ServiceIssuerDeskRecord) =>
      remember(
        (
          await required().request({
            action: "decline",
            id: record.draft.id,
            expectedRevision: record.revision,
          })
        ).record!
      ),
  });
  const approve = useMutation({
    ...options,
    mutationFn: async (record: ServiceIssuerDeskRecord) => {
      if (record.draft.member.toLowerCase() !== user.primaryAddress?.toLowerCase())
        throw new Error("Only the member can approve these terms");
      const fresh = (await required().request({ action: "read", id: record.draft.id })).record!;
      if (
        fresh.revision !== record.revision ||
        serviceIssuerTermsDigest(fresh.draft) !== serviceIssuerTermsDigest(record.draft) ||
        fresh.draft.sentAt === null ||
        fresh.declinedAt !== null
      )
        throw new Error("Draft changed; review again");
      if (fresh.approval !== null) return remember(fresh);
      const approval = await signServiceIssuerApproval(
        {
          session: () => {
            assertCurrent();
            return {
              address: current.current.user.primaryAddress,
              authMode: current.current.user.authMode,
              profile: current.current.user.passkeyAccountProfile ?? null,
              generation: current.current.generation,
              online: true,
            };
          },
          sender: () => current.current.sender,
          chain: serviceIssuerChain,
          now: () => BigInt(Math.floor(Date.now() / 1000)),
        },
        fresh.draft
      );
      assertCurrent();
      return remember(
        (
          await required().request({
            action: "approve",
            id: fresh.draft.id,
            expectedRevision: fresh.revision,
            approval,
          })
        ).record!
      );
    },
  });
  return {
    records: records.data ?? [],
    loaded: records.data !== undefined,
    isLimited: records.data?.length === 200,
    load,
    save,
    send,
    approve,
    decline,
    canSign: serviceActorAccountSupported({
      authMode: user.authMode,
      profile: user.passkeyAccountProfile ?? null,
    }),
  };
}
