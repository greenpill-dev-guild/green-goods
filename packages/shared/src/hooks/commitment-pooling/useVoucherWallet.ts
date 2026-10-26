import { useQuery } from "@tanstack/react-query";
import { commitmentPoolingKeys } from "../../config/query-keys/commitment-pooling";
import { isDemoPoolingActive } from "../../modules/commitment-pooling/demo/demo-mode";
import { serviceLiveChain } from "../../modules/commitment-pooling/service-access-live-chain";
import {
  readLiveVoucherWallet,
  readVoucherIssuerApproval,
} from "../../modules/commitment-pooling/service-access-wallet";
import type {
  VoucherIssuer,
  VoucherWalletScope,
} from "../../modules/commitment-pooling/service-access-wallet-types";
import type { Address } from "../../types/domain";

const EMPTY_ADDRESS = `0x${"0".repeat(40)}` as Address;

function rehearsalActive(): boolean {
  return import.meta.env.DEV && isDemoPoolingActive();
}

/** Holdings per issuer token, each booking's escrow and the returns on their way, for one account. */
export function useVoucherWallet(scope: VoucherWalletScope | null) {
  const rehearsal = scope !== null && scope.sourceChainId === 42161 && rehearsalActive();
  return useQuery({
    queryKey: commitmentPoolingKeys.voucherWallet(
      scope?.sourceChainId ?? 0,
      scope?.coreModule ?? EMPTY_ADDRESS,
      scope?.account ?? EMPTY_ADDRESS,
      rehearsal
    ),
    enabled: scope !== null,
    retry: false,
    queryFn: async () => {
      if (!scope) throw new Error("Voucher wallet scope required");
      if (!rehearsal) return readLiveVoucherWallet(scope);
      const { serviceRehearsalAdapter } = await import(
        "../../modules/commitment-pooling/demo/demo-service-access"
      );
      return serviceRehearsalAdapter.wallet(scope);
    },
  });
}

/** How many signatures the issuer's approval takes, read from the issuer and never from copy. */
export function useVoucherIssuerApproval(
  issuer: Pick<VoucherIssuer, "account" | "kind" | "asset"> | null
) {
  const rehearsal = rehearsalActive();
  return useQuery({
    queryKey: commitmentPoolingKeys.issuerApproval(
      issuer?.asset.chainId ?? 0,
      issuer?.account ?? EMPTY_ADDRESS,
      rehearsal
    ),
    enabled: issuer !== null,
    retry: false,
    queryFn: async () => {
      if (!issuer) throw new Error("Voucher issuer required");
      if (!rehearsal) return readVoucherIssuerApproval(serviceLiveChain.read, issuer);
      const { rehearsalIssuerApproval } = await import(
        "../../modules/commitment-pooling/demo/demo-service-wallet"
      );
      return rehearsalIssuerApproval(issuer.account);
    },
  });
}
