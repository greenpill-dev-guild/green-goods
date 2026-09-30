import type { Address } from "./core";

export const PUBLIC_AGENT_ROUTES = {
  subscribe: "/public/subscribe",
  fundingIntents: "/public/funding-intents",
  fundingIntentProof: "/public/funding-intents/proof",
  fundingIntentReceipt: "/public/funding-intents/:id",
  gardenImpact: "/public/gardens/:chainId/:gardenAddress/impact",
  uploadSign: "/api/uploads/sign",
  thirdwebWebhook: "/webhooks/thirdweb",
} as const;

export function buildPublicGardenImpactPath(
  chainId: number | string,
  gardenAddress: Address
): string {
  return `/public/gardens/${encodeURIComponent(String(chainId))}/${encodeURIComponent(gardenAddress)}/impact`;
}
