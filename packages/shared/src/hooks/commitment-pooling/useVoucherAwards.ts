import { useCallback, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSignMessage } from "wagmi";
import { useUser } from "../auth/useUser";
import { useTransactionSender } from "../blockchain/useTransactionSender";
import { SERVICE_LIVE_ROUTES } from "../../modules/commitment-pooling/service-access-live-config";
import { createAccountMessageSigner } from "../../modules/auth/account-message-signer";
import { createVoucherAwardClient } from "../../modules/commitment-pooling/voucher-award-client";
import {
  recoverVoucherAward,
  sendVoucherAward,
} from "../../modules/commitment-pooling/voucher-award-send";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { logger } from "../../modules/app/logger";
import type { Address } from "../../types/domain";
import type { VoucherAwardInput, VoucherAwardRecord } from "../../public-contracts/voucher-awards";

/** Reads require an explicit account proof; mounting a wallet or steward panel never prompts. */
export function useVoucherAwards(reserve?: Address | null) {
  const awardReserve = reserve as VoucherAwardInput["reserve"] | null | undefined;
  const user = useUser();
  const sender = useTransactionSender();
  const { signMessageAsync } = useSignMessage();
  const cache = useQueryClient();
  const identity = `${user.authMode}:${user.primaryAddress}:${user.passkeyAccountProfile}:${reserve ?? "received"}`;
  const current = useRef({ identity, user, sender, signMessageAsync, generation: 0 });
  if (current.current.identity !== identity || current.current.sender !== sender)
    current.current.generation++;
  Object.assign(current.current, { identity, user, sender, signMessageAsync });
  const generation = current.current.generation;
  const assertCurrent = useCallback(() => {
    if (current.current.generation !== generation)
      throw new Error("Award account changed; review again");
    if (typeof navigator !== "undefined" && !navigator.onLine)
      throw new Error("Award connection unavailable");
  }, [generation]);
  const key = commitmentPoolingKeys.voucherAwards(user.primaryAddress, reserve);
  const client = useMemo(() => {
    const account = user.primaryAddress;
    if (!account) return null;
    return createVoucherAwardClient({
      account,
      assertCurrent,
      sign: async (message) => {
        assertCurrent();
        const auth = current.current.user;
        const accountClient =
          auth.authMode === "passkey" ? await auth.resolveSmartAccountClient?.(100) : null;
        assertCurrent();
        return createAccountMessageSigner({
          authMode: auth.authMode,
          signMessage: current.current.signMessageAsync,
          account: accountClient?.account,
        })(message);
      },
    });
  }, [assertCurrent, user.primaryAddress]);
  const records = useQuery<VoucherAwardRecord[]>({
    queryKey: key,
    enabled: false,
    queryFn: async () => [],
  });
  const error = (cause: unknown) =>
    logger.error("Voucher award action failed", {
      error: cause instanceof Error ? cause.message : "unknown",
    });
  const required = () => {
    if (!client) throw new Error("Connect an account first");
    return client;
  };
  const remember = (record: VoucherAwardRecord) => {
    assertCurrent();
    cache.setQueryData<VoucherAwardRecord[]>(key, (previous = []) => [
      record,
      ...previous.filter(
        (r) => r.award.awardId !== record.award.awardId || r.award.reserve !== record.award.reserve
      ),
    ]);
    if (record.state === "confirmed")
      for (const route of SERVICE_LIVE_ROUTES) {
        void cache.invalidateQueries({
          queryKey: commitmentPoolingKeys.voucherWallets(route.sourceChainId),
        });
        void cache.invalidateQueries({
          queryKey: [...commitmentPoolingKeys.all(route.sourceChainId), "voucher-console"],
        });
      }
  };
  const mutationOptions = { retry: false, networkMode: "always" as const, onError: error };
  const load = useMutation({
    ...mutationOptions,
    mutationFn: async () => {
      const response = await required().request(
        awardReserve ? { action: "list", reserve: awardReserve } : { action: "received" }
      );
      assertCurrent();
      cache.setQueryData(key, response.records!);
      return response.records!;
    },
  });
  const prepare = useMutation({
    ...mutationOptions,
    mutationFn: async (award: VoucherAwardInput) => {
      if (!reserve || award.reserve.toLowerCase() !== reserve.toLowerCase())
        throw new Error("Select the award reserve");
      const record = (await required().request({ action: "prepare", award })).record!;
      remember(record);
      return record;
    },
  });
  const reconcile = useMutation({
    ...mutationOptions,
    mutationFn: async (input: { awardId: string; transactionHash: `0x${string}` }) => {
      if (!awardReserve) throw new Error("Select the award reserve");
      const record = (
        await required().request({ action: "reconcile", reserve: awardReserve, ...input })
      ).record!;
      remember(record);
      return record;
    },
  });
  const execution = (record: VoucherAwardRecord) => {
    if (
      !user.primaryAddress ||
      !sender ||
      !reserve ||
      record.award.reserve.toLowerCase() !== reserve.toLowerCase()
    )
      throw new Error("Select the award reserve and connect its signer");
    return { record, actor: user.primaryAddress, sender, client: required(), assertCurrent };
  };
  const send = useMutation({
    ...mutationOptions,
    mutationFn: async (record: VoucherAwardRecord) => {
      const result = await sendVoucherAward(execution(record));
      remember(result.record);
      return result;
    },
  });
  const recover = useMutation({
    ...mutationOptions,
    mutationFn: async (record: VoucherAwardRecord) => {
      const result = await recoverVoucherAward(execution(record));
      remember(result.record);
      return result;
    },
  });
  return {
    records: records.data ?? [],
    isLimited: records.data?.length === 200,
    load,
    prepare,
    reconcile,
    send,
    recover,
    directSigningAvailable: user.authMode !== "passkey" && Boolean(sender?.signTypedData),
  };
}
