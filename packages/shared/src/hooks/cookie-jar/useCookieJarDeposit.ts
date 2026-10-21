import { useCallback } from "react";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import type { Address } from "../../types/domain";
import {
  type CookieJarMutationOptions,
  useCookieJarDepositMutation,
} from "./useCookieJarDepositMutation";

export function useCookieJarDeposit(
  gardenAddress: Address,
  options: CookieJarMutationOptions = {}
) {
  const invalidationKeys = useCallback(
    (jarAddress: Address, chainId: number) =>
      queryInvalidation.onCookieJarDeposit(gardenAddress, jarAddress, chainId),
    [gardenAddress]
  );
  return useCookieJarDepositMutation({
    options,
    source: "useCookieJarDeposit",
    toastContext: "cookie jar deposit",
    balanceWarning: "[CookieJarDeposit] Balance check failed, proceeding anyway",
    metadata: { gardenAddress },
    invalidationKeys,
  });
}
