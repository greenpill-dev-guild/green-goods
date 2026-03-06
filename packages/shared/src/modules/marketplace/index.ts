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

// Approvals
export type { EncodedApprovalCall, MarketplaceApprovals } from "./approvals";
export { buildApprovalTransactions, checkMarketplaceApprovals } from "./approvals";
// Client
export {
  getMarketplaceAddresses,
  getMarketplaceClient,
  getOrderNonces,
  isMarketplaceSupported,
  resetMarketplaceClients,
} from "./client";
// Signing
export type { MakerAskOrder, ValidationResult } from "./signing";
export { buildMakerAsk, signMakerAsk, validateOrder } from "./signing";
