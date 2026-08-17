import type { Address } from "../../types/domain";

function normalizeAddress(value: Address | string): string {
  return value.toLowerCase();
}

export const creditKeys = {
  all: (chainId: number) => ["greengoods", "credit", chainId] as const,
  loan: (chainId: number, loanId: bigint | string | number) =>
    [...creditKeys.all(chainId), "loan", String(loanId)] as const,
  subjectLoans: (
    chainId: number,
    poolId: bigint | string | number,
    subject: Address | string,
    viewer: Address | string
  ) =>
    [
      ...creditKeys.all(chainId),
      "subject-loans",
      String(poolId),
      normalizeAddress(subject),
      normalizeAddress(viewer),
    ] as const,
  poolStats: (chainId: number, poolId: bigint | string | number) =>
    [...creditKeys.all(chainId), "pool-stats", String(poolId)] as const,
  settlementRelationship: (chainId: number, disbursementId: bigint | string | number) =>
    [...creditKeys.all(chainId), "settlement-relationship", String(disbursementId)] as const,
} as const;

export function creditInvalidationKeys(input: {
  chainId: number;
  loanId?: bigint;
  poolId?: bigint;
  borrower?: Address;
  viewer?: Address;
}) {
  const keys: ReadonlyArray<unknown>[] = [creditKeys.all(input.chainId)];
  if (input.loanId !== undefined) keys.push(creditKeys.loan(input.chainId, input.loanId));
  if (input.poolId !== undefined) keys.push(creditKeys.poolStats(input.chainId, input.poolId));
  if (input.poolId !== undefined && input.borrower && input.viewer) {
    keys.push(creditKeys.subjectLoans(input.chainId, input.poolId, input.borrower, input.viewer));
  }
  return keys;
}
