/**
 * Marketplace Module — Barrel Export
 *
 * Re-exports all marketplace SDK integration utilities:
 * - Client: singleton HypercertExchangeClient management
 * - Signing: EIP-712 maker ask order building and signing
 * - Approvals: one-time approval checks and transaction building
 *
 * @module modules/marketplace
 */

// Client
export {
  getMarketplaceClient,
  getMarketplaceAddresses,
  getOrderNonces,
  isMarketplaceSupported,
  resetMarketplaceClients,
} from "./client";

// Signing
export type { MakerAskOrder, ValidationResult } from "./signing";
export { buildMakerAsk, signMakerAsk, validateOrder } from "./signing";

// Approvals
export type { MarketplaceApprovals, EncodedApprovalCall } from "./approvals";
export { checkMarketplaceApprovals, buildApprovalTransactions } from "./approvals";
