import type { CategorizedError, ErrorCategory } from "@green-goods/shared";

export interface HypercertCompletionData {
  hypercertId: string;
  title: string;
  description: string;
  workScopes: string[];
  imageUri?: string;
  attestationCount: number;
  mintedAt: number;
  txHash?: `0x${string}`;
}

const ERROR_CATEGORY_KEYS: Record<ErrorCategory, string> = {
  network: "app.errors.network",
  blockchain: "app.errors.blockchain",
  auth: "app.errors.auth",
  validation: "app.errors.validation",
  permission: "app.errors.permission",
  storage: "app.errors.storage",
  unknown: "app.hypercerts.mint.error.generic.message",
};

export function getErrorMessageKey(categorized: CategorizedError): string {
  return ERROR_CATEGORY_KEYS[categorized.category];
}
