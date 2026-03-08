/**
 * Minimal ABIs for Garden roles and Hats module interactions.
 *
 * These are intentionally small to avoid relying on stale generated ABIs
 * from contracts/out when new functions are added.
 */

export const GARDEN_ACCOUNT_ROLE_ABI = [
  {
    type: "function",
    name: "isGardener",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isEvaluator",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isOperator",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isOwner",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isFunder",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "isCommunity",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const GARDEN_ACCOUNT_TOKEN_ABI = [
  {
    type: "function",
    name: "token",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "chainId", type: "uint256" },
      { name: "tokenContract", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
  },
] as const;

export const GARDEN_TOKEN_MODULES_ABI = [
  {
    type: "function",
    name: "hatsModule",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "karmaGAPModule",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "gardensModule",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const HATS_MODULE_ABI = [
  {
    type: "function",
    name: "grantRole",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "account", type: "address" },
      { name: "role", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "revokeRole",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "account", type: "address" },
      { name: "role", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "grantRoles",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "accounts", type: "address[]" },
      { name: "roles", type: "uint8[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isConfigured",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const HATS_MODULE_CONVICTION_ABI = [
  {
    type: "function",
    name: "setConvictionStrategies",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "strategies", type: "address[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getConvictionStrategies",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
] as const;

export const HYPERCERT_SIGNAL_POOL_ABI = [
  {
    type: "function",
    name: "registerHypercert",
    stateMutability: "nonpayable",
    inputs: [{ name: "hypercertId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "deregisterHypercert",
    stateMutability: "nonpayable",
    inputs: [{ name: "hypercertId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "allocateSupport",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "signals",
        type: "tuple[]",
        components: [
          { name: "hypercertId", type: "uint256" },
          { name: "deltaSupport", type: "int256" },
        ],
      },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "calculateConviction",
    stateMutability: "view",
    inputs: [{ name: "hypercertId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getConvictionWeights",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "ids", type: "uint256[]" },
      { name: "weights", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "getVoterAllocations",
    stateMutability: "view",
    inputs: [{ name: "voter", type: "address" }],
    outputs: [
      { name: "ids", type: "uint256[]" },
      { name: "amounts", type: "uint256[]" },
    ],
  },
  {
    type: "function",
    name: "getRegisteredHypercerts",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "function",
    name: "isEligibleVoter",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "voterTotalStake",
    stateMutability: "view",
    inputs: [{ name: "voter", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "pointsPerVoter",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decay",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "setRoleHatIds",
    stateMutability: "nonpayable",
    inputs: [{ name: "hatIds", type: "uint256[]" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setDecay",
    stateMutability: "nonpayable",
    inputs: [{ name: "newDecay", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setPointsPerVoter",
    stateMutability: "nonpayable",
    inputs: [{ name: "newPoints", type: "uint256" }],
    outputs: [],
  },
] as const;

export const GARDENS_MODULE_ABI = [
  {
    type: "function",
    name: "getGardenCommunity",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getGardenSignalPools",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getGardenWeightScheme",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "getGardenPowerRegistry",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "goodsToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "stakeAmountPerMember",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "createGardenPools",
    stateMutability: "nonpayable",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "pools", type: "address[]" }],
  },
] as const;

export const YIELD_SPLITTER_ABI = [
  {
    type: "function",
    name: "splitYield",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
      { name: "vault", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setSplitRatio",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "cookieJarBps", type: "uint256" },
      { name: "fractionsBps", type: "uint256" },
      { name: "juiceboxBps", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getSplitConfig",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "cookieJarBps", type: "uint256" },
          { name: "fractionsBps", type: "uint256" },
          { name: "juiceboxBps", type: "uint256" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "pendingYield",
    stateMutability: "view",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "minYieldThreshold",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getEscrowedFractions",
    stateMutability: "view",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "gardenShares",
    stateMutability: "view",
    inputs: [
      { name: "garden", type: "address" },
      { name: "vault", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "gardenVaults",
    stateMutability: "view",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "withdrawEscrowedFractions",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "to", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "rescueTokens",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const JUICEBOX_ABI = [
  {
    type: "function",
    name: "pay",
    stateMutability: "payable",
    inputs: [
      { name: "projectId", type: "uint256" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "beneficiary", type: "address" },
      { name: "minReturnedTokens", type: "uint256" },
      { name: "memo", type: "string" },
      { name: "metadata", type: "bytes" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenOf",
    stateMutability: "view",
    inputs: [{ name: "projectId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const ERC20_DECIMALS_ABI = [
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export const COOKIE_JAR_ABI = [
  {
    name: "CURRENCY",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    name: "currencyHeldByJar",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "maxWithdrawal",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "withdrawalInterval",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "fixedAmount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "WITHDRAWAL_OPTION",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "lastWithdrawalTime",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalWithdrawn",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "paused",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "EMERGENCY_WITHDRAWAL_ENABLED",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "purpose", type: "string" },
    ],
    outputs: [],
  },
  {
    name: "MIN_DEPOSIT",
    type: "function",
    stateMutability: "pure",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "deposit",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
  { name: "pause", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { name: "unpause", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    name: "updateMaxWithdrawalAmount",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_maxWithdrawal", type: "uint256" }],
    outputs: [],
  },
  {
    name: "updateWithdrawalInterval",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_withdrawalInterval", type: "uint256" }],
    outputs: [],
  },
  {
    name: "emergencyWithdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const COOKIE_JAR_MODULE_ABI = [
  {
    name: "getGardenJars",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ type: "address[]" }],
  },
  {
    name: "getGardenJar",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ type: "address" }],
  },
  {
    name: "getSupportedAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
] as const;

export const ERC20_ALLOWANCE_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const OCTANT_MODULE_ABI = [
  {
    type: "function",
    name: "harvest",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "emergencyPause",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setDonationAddress",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "donationAddress", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getVaultForAsset",
    stateMutability: "view",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "gardenDonationAddresses",
    stateMutability: "view",
    inputs: [{ name: "garden", type: "address" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getSupportedAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "configureVaultRoles",
    stateMutability: "nonpayable",
    inputs: [
      { name: "garden", type: "address" },
      { name: "asset", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const OCTANT_VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [
      { name: "shares", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "convertToAssets",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "convertToShares",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "previewDeposit",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "previewWithdraw",
    stateMutability: "view",
    inputs: [{ name: "assets", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxDeposit",
    stateMutability: "view",
    inputs: [{ name: "receiver", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
      { name: "maxLoss", type: "uint256" },
      { name: "strategies", type: "address[]" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "maxWithdraw",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "maxLoss", type: "uint256" },
      { name: "strategies", type: "address[]" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "depositLimit",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "isShutdown",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "maxRedeem",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "maxLoss", type: "uint256" },
      { name: "strategies", type: "address[]" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "asset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;
