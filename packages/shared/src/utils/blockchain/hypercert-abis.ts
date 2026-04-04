/**
 * Hypercert ABI Definitions
 *
 * Contract ABIs used for hypercert minting operations.
 *
 * @module hooks/hypercerts/hypercert-abis
 */

/**
 * ERC1155 TransferSingle event ABI for extracting hypercert IDs from logs.
 */
export const ERC1155_TRANSFER_SINGLE_ABI = [
  {
    type: "event",
    name: "TransferSingle",
    inputs: [
      { indexed: true, name: "operator", type: "address" },
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "id", type: "uint256" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
] as const;

/**
 * DeploymentRegistry ABI for reading network config.
 */
export const DEPLOYMENT_REGISTRY_ABI = [
  {
    type: "function",
    name: "getNetworkConfigForChain",
    stateMutability: "view",
    inputs: [{ name: "chainId", type: "uint256" }],
    outputs: [
      {
        name: "config",
        type: "tuple",
        components: [
          { name: "eas", type: "address" },
          { name: "easSchemaRegistry", type: "address" },
          { name: "communityToken", type: "address" },
          { name: "actionRegistry", type: "address" },
          { name: "gardenToken", type: "address" },
          { name: "workResolver", type: "address" },
          { name: "workApprovalResolver", type: "address" },
          { name: "assessmentResolver", type: "address" },
          { name: "integrationRouter", type: "address" },
          { name: "hatsAccessControl", type: "address" },
          { name: "octantFactory", type: "address" },
          { name: "unlockFactory", type: "address" },
          { name: "hypercerts", type: "address" },
          { name: "greenWillRegistry", type: "address" },
        ],
      },
    ],
  },
] as const;

/**
 * HypercertMinter createAllowlist function ABI.
 */
export const CREATE_ALLOWLIST_ABI = [
  {
    type: "function",
    name: "createAllowlist",
    stateMutability: "nonpayable",
    inputs: [
      { name: "account", type: "address" },
      { name: "totalUnits", type: "uint256" },
      { name: "merkleRoot", type: "bytes32" },
      { name: "metadataUri", type: "string" },
      { name: "transferRestrictions", type: "uint8" },
    ],
    outputs: [{ name: "hypercertId", type: "uint256" }],
  },
] as const;

// =============================================================================
// Marketplace Adapter ABIs (HypercertMarketplaceAdapter.sol)
// =============================================================================

/**
 * OrderStructs.Maker tuple type for ABI encoding.
 * Mirrors the LooksRare-based exchange order format.
 */
const MAKER_TUPLE_TYPE = {
  name: "makerAsk",
  type: "tuple",
  components: [
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

/**
 * HypercertMarketplaceAdapter — read functions for querying registered orders.
 */
export const MARKETPLACE_ADAPTER_ABI = [
  // View: get registered order by ID
  {
    type: "function",
    name: "orders",
    stateMutability: "view",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [
      { name: "hypercertId", type: "uint256" },
      { name: "encodedMakerAsk", type: "bytes" },
      { name: "signature", type: "bytes" },
      { name: "pricePerUnit", type: "uint256" },
      { name: "minUnitAmount", type: "uint256" },
      { name: "maxUnitAmount", type: "uint256" },
      { name: "seller", type: "address" },
      { name: "currency", type: "address" },
      { name: "endTime", type: "uint256" },
      { name: "active", type: "bool" },
    ],
  },
  // View: active order for hypercertId + currency pair
  {
    type: "function",
    name: "activeOrders",
    stateMutability: "view",
    inputs: [
      { name: "hypercertId", type: "uint256" },
      { name: "currency", type: "address" },
    ],
    outputs: [{ name: "orderId", type: "uint256" }],
  },
  // View: preview units for a payment amount
  {
    type: "function",
    name: "previewPurchase",
    stateMutability: "view",
    inputs: [
      { name: "hypercertId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ name: "units", type: "uint256" }],
  },
  // View: minimum price per unit
  {
    type: "function",
    name: "getMinPrice",
    stateMutability: "view",
    inputs: [
      { name: "hypercertId", type: "uint256" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ name: "pricePerUnit", type: "uint256" }],
  },
  // View: seller order count
  {
    type: "function",
    name: "getSellerOrderCount",
    stateMutability: "view",
    inputs: [{ name: "seller", type: "address" }],
    outputs: [{ name: "count", type: "uint256" }],
  },
  // View: seller order ID at index
  {
    type: "function",
    name: "getSellerOrderId",
    stateMutability: "view",
    inputs: [
      { name: "seller", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "orderId", type: "uint256" }],
  },
  // Event: order registered
  {
    type: "event",
    name: "OrderRegistered",
    inputs: [
      { indexed: true, name: "orderId", type: "uint256" },
      { indexed: true, name: "hypercertId", type: "uint256" },
      { indexed: true, name: "seller", type: "address" },
      { indexed: false, name: "currency", type: "address" },
      { indexed: false, name: "pricePerUnit", type: "uint256" },
      { indexed: false, name: "endTime", type: "uint256" },
    ],
  },
  // Event: order deactivated
  {
    type: "event",
    name: "OrderDeactivated",
    inputs: [
      { indexed: true, name: "orderId", type: "uint256" },
      { indexed: true, name: "deactivatedBy", type: "address" },
    ],
  },
  // Event: fraction purchased via yield
  {
    type: "event",
    name: "FractionPurchased",
    inputs: [
      { indexed: true, name: "orderId", type: "uint256" },
      { indexed: true, name: "hypercertId", type: "uint256" },
      { indexed: true, name: "recipient", type: "address" },
      { indexed: false, name: "units", type: "uint256" },
      { indexed: false, name: "payment", type: "uint256" },
    ],
  },
] as const;

// =============================================================================
// HypercertsModule ABIs (Hypercerts.sol)
// =============================================================================

/**
 * HypercertsModule — functions for listing/delisting hypercerts for yield.
 */
export const HYPERCERTS_MODULE_ABI = [
  // Write: list a hypercert for yield (registers order in marketplace adapter)
  {
    type: "function",
    name: "listForYield",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "hypercertId", type: "uint256" },
      MAKER_TUPLE_TYPE,
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "orderId", type: "uint256" }],
  },
  // Write: batch list multiple hypercerts for yield
  {
    type: "function",
    name: "batchListForYield",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "hypercertIds", type: "uint256[]" },
      {
        name: "makerAsks",
        type: "tuple[]",
        components: MAKER_TUPLE_TYPE.components,
      },
      { name: "signatures", type: "bytes[]" },
    ],
    outputs: [{ name: "orderIds", type: "uint256[]" }],
  },
  // Write: delist a hypercert from yield marketplace
  {
    type: "function",
    name: "delistFromYield",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "orderId", type: "uint256" },
    ],
    outputs: [],
  },
  // View: get all hypercert IDs for a garden
  {
    type: "function",
    name: "getGardenHypercerts",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "hypercertIds", type: "uint256[]" }],
  },
  // View: get garden address for a hypercert
  {
    type: "function",
    name: "hypercertGarden",
    stateMutability: "view",
    inputs: [{ name: "hypercertId", type: "uint256" }],
    outputs: [{ name: "garden", type: "address" }],
  },
  // Event: hypercert listed for yield
  {
    type: "event",
    name: "HypercertListedForYield",
    inputs: [
      { indexed: true, name: "garden", type: "address" },
      { indexed: true, name: "hypercertId", type: "uint256" },
      { indexed: false, name: "orderId", type: "uint256" },
    ],
  },
  // Event: hypercert delisted from yield
  {
    type: "event",
    name: "HypercertDelistedFromYield",
    inputs: [
      { indexed: true, name: "garden", type: "address" },
      { indexed: false, name: "orderId", type: "uint256" },
    ],
  },
] as const;

// =============================================================================
// TransferManager ABIs (for one-time approval setup)
// =============================================================================

/**
 * TransferManager — approval functions needed for marketplace setup.
 */
export const TRANSFER_MANAGER_ABI = [
  // Write: grant exchange approval (one-time setup)
  {
    type: "function",
    name: "grantApprovals",
    stateMutability: "nonpayable",
    inputs: [{ name: "operators", type: "address[]" }],
    outputs: [],
  },
  // View: check if operator is approved
  {
    type: "function",
    name: "hasUserApprovedOperator",
    stateMutability: "view",
    inputs: [
      { name: "user", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ name: "approved", type: "bool" }],
  },
] as const;
