/**
 * Marketplace Order Signing Utilities
 *
 * Build EIP-712 maker ask orders and sign them using viem walletClient.
 * The maker ask is the gasless order that operators sign off-chain,
 * later registered on-chain via HypercertsModule.listForYield().
 *
 * @module modules/marketplace/signing
 */

import { type Address, encodeAbiParameters, type Hex, type WalletClient } from "viem";

import type { CreateListingParams } from "../../types/hypercerts";
import { createLogger } from "../app/logger";
import { getMarketplaceAddresses } from "./client";

const log = createLogger({ source: "marketplace/signing" });

// ---------------------------------------------------------------------------
// EIP-712 constants (from marketplace SDK: constants/eip712.ts)
// ---------------------------------------------------------------------------

const DOMAIN_NAME = "LooksRareProtocol";
const DOMAIN_VERSION = "2";

// ---------------------------------------------------------------------------
// Maker types for EIP-712 (from SDK: utils/eip712.ts)
// ---------------------------------------------------------------------------

const MAKER_EIP712_TYPES = {
  Maker: [
    { name: "quoteType", type: "uint8" },
    { name: "globalNonce", type: "uint256" },
    { name: "subsetNonce", type: "uint256" },
    { name: "orderNonce", type: "uint256" },
    { name: "strategyId", type: "uint256" },
    { name: "collectionType", type: "uint8" },
    { name: "collection", type: "address" },
    { name: "currency", type: "address" },
    { name: "signer", type: "address" },
    { name: "startTime", type: "uint256" },
    { name: "endTime", type: "uint256" },
    { name: "price", type: "uint256" },
    { name: "itemIds", type: "uint256[]" },
    { name: "amounts", type: "uint256[]" },
    { name: "additionalParameters", type: "bytes" },
  ],
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MakerAskOrder {
  quoteType: number; // 1 = MakerAsk
  globalNonce: bigint;
  subsetNonce: bigint;
  orderNonce: bigint;
  strategyId: bigint;
  collectionType: number; // 2 = Hypercert
  collection: Address;
  currency: Address;
  signer: Address;
  startTime: bigint;
  endTime: bigint;
  price: bigint; // price per unit
  itemIds: bigint[];
  amounts: bigint[];
  additionalParameters: Hex;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Build maker ask
// ---------------------------------------------------------------------------

/**
 * Converts CreateListingParams into a LooksRare-format MakerAskOrder.
 *
 * The order uses:
 * - quoteType = 1 (Ask)
 * - collectionType = 2 (Hypercert)
 * - strategyId = 1 (hypercertFractionOffer)
 * - collection = HypercertMinter address from SDK
 * - additionalParameters = abi.encode(minUnitAmount, maxUnitAmount, minUnitsToKeep, sellLeftover)
 *
 * Nonces are initialized to 0. The API or SDK should be used to fetch
 * the correct nonce before registering the order.
 */
export function buildMakerAsk(
  params: CreateListingParams,
  signer: Address,
  chainId: number,
  nonces?: { globalNonce?: bigint; subsetNonce?: bigint; orderNonce?: bigint }
): MakerAskOrder {
  const addresses = getMarketplaceAddresses(chainId);
  if (!addresses) {
    throw new Error(`Marketplace not supported on chain ${chainId}`);
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const durationSeconds = BigInt(params.durationDays) * 86400n;

  // Encode additional parameters for fractional sale strategy:
  // (uint256 minUnitAmount, uint256 maxUnitAmount, uint256 minUnitsToKeep, bool sellLeftoverFraction)
  const additionalParameters = encodeAbiParameters(
    [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }, { type: "bool" }],
    [params.minUnitAmount, params.maxUnitAmount, params.minUnitsToKeep, params.sellLeftover]
  );

  return {
    quoteType: 1, // Ask
    globalNonce: nonces?.globalNonce ?? 0n,
    subsetNonce: nonces?.subsetNonce ?? 0n,
    orderNonce: nonces?.orderNonce ?? 0n,
    strategyId: 1n, // hypercertFractionOffer
    collectionType: 2, // Hypercert
    collection: addresses.MINTER as Address,
    currency: params.currency,
    signer,
    startTime: now,
    endTime: now + durationSeconds,
    price: params.pricePerUnit,
    itemIds: [params.fractionId],
    amounts: [1n], // Always 1 for hypercert fractions (they're unique)
    additionalParameters: additionalParameters as Hex,
  };
}

// ---------------------------------------------------------------------------
// Sign maker ask
// ---------------------------------------------------------------------------

/**
 * Signs a MakerAskOrder using viem's walletClient.signTypedData.
 *
 * Uses the EIP-712 domain separator matching the HypercertExchange contract:
 * - name: "LooksRareProtocol"
 * - version: "2"
 * - chainId: target chain
 * - verifyingContract: HypercertExchange address
 */
export async function signMakerAsk(
  makerAsk: MakerAskOrder,
  walletClient: WalletClient,
  chainId: number
): Promise<Hex> {
  const addresses = getMarketplaceAddresses(chainId);
  if (!addresses) {
    throw new Error(`Marketplace not supported on chain ${chainId}`);
  }

  const domain = {
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    chainId,
    verifyingContract: addresses.EXCHANGE_V2 as Address,
  };

  log.debug("Signing maker ask order", {
    chainId,
    signer: makerAsk.signer,
    collection: makerAsk.collection,
    price: makerAsk.price.toString(),
  });

  // Cast to work around viem's strict WalletClient generics —
  // the account is resolved at runtime from the connected wallet.
  const signature = await (walletClient as WalletClient).signTypedData({
    account: makerAsk.signer,
    domain,
    types: MAKER_EIP712_TYPES,
    primaryType: "Maker" as const,
    message: {
      quoteType: makerAsk.quoteType,
      globalNonce: makerAsk.globalNonce,
      subsetNonce: makerAsk.subsetNonce,
      orderNonce: makerAsk.orderNonce,
      strategyId: makerAsk.strategyId,
      collectionType: makerAsk.collectionType,
      collection: makerAsk.collection,
      currency: makerAsk.currency,
      signer: makerAsk.signer,
      startTime: makerAsk.startTime,
      endTime: makerAsk.endTime,
      price: makerAsk.price,
      itemIds: makerAsk.itemIds,
      amounts: makerAsk.amounts,
      additionalParameters: makerAsk.additionalParameters,
    },
  } as Parameters<WalletClient["signTypedData"]>[0]);

  return signature;
}

// ---------------------------------------------------------------------------
// Validate order
// ---------------------------------------------------------------------------

/**
 * Basic client-side validation of a MakerAskOrder.
 *
 * Checks:
 * - endTime is in the future
 * - startTime < endTime
 * - price > 0
 * - itemIds is non-empty
 * - collection matches HypercertMinter for the chain
 */
export function validateOrder(makerAsk: MakerAskOrder, chainId: number): ValidationResult {
  const errors: string[] = [];
  const now = BigInt(Math.floor(Date.now() / 1000));

  if (makerAsk.endTime <= now) {
    errors.push("endTime must be in the future");
  }

  if (makerAsk.startTime >= makerAsk.endTime) {
    errors.push("startTime must be before endTime");
  }

  if (makerAsk.price <= 0n) {
    errors.push("price must be greater than zero");
  }

  if (makerAsk.itemIds.length === 0) {
    errors.push("itemIds must not be empty");
  }

  const addresses = getMarketplaceAddresses(chainId);
  if (addresses && makerAsk.collection.toLowerCase() !== addresses.MINTER.toLowerCase()) {
    errors.push(
      `collection must be HypercertMinter (${addresses.MINTER}), got ${makerAsk.collection}`
    );
  }

  if (errors.length > 0) {
    log.debug("Order validation failed", { chainId, errors });
  }

  return { valid: errors.length === 0, errors };
}
