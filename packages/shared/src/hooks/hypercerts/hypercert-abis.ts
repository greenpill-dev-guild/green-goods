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
 * HatsAccessControl ABI for checking operator permissions.
 */
export const HATS_MODULE_ABI = [
  {
    type: "function",
    name: "isOperator",
    stateMutability: "view",
    inputs: [
      { name: "garden", type: "address" },
      { name: "account", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
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
