/**
 * Cookie Jar ABIs
 *
 * ABIs for CookieJar (withdrawal/deposit) and CookieJarModule (jar discovery).
 */

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
    name: "ACCESS_TYPE",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "ONE_TIME_WITHDRAWAL",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    name: "STRICT_PURPOSE",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
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
  {
    name: "getAllowlist",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address[]" }],
  },
  {
    name: "hasRole",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "grantJarAllowlistRole",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_users", type: "address[]" }],
    outputs: [],
  },
  {
    name: "revokeJarAllowlistRole",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "_users", type: "address[]" }],
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
    name: "cookieJarFactory",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
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

export const COOKIE_JAR_FACTORY_ABI = [
  {
    type: "event",
    name: "JarCreated",
    inputs: [
      { name: "jarAddress", type: "address", indexed: true },
      { name: "creator", type: "address", indexed: true },
    ],
    anonymous: false,
  },
  {
    name: "createCookieJar",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "jarOwner", type: "address" },
          { name: "supportedCurrency", type: "address" },
          { name: "feeCollector", type: "address" },
          { name: "accessType", type: "uint8" },
          { name: "withdrawalOption", type: "uint8" },
          { name: "strictPurpose", type: "bool" },
          { name: "emergencyWithdrawalEnabled", type: "bool" },
          { name: "oneTimeWithdrawal", type: "bool" },
          { name: "fixedAmount", type: "uint256" },
          { name: "maxWithdrawal", type: "uint256" },
          { name: "withdrawalInterval", type: "uint256" },
          { name: "minDeposit", type: "uint256" },
          { name: "feePercentageOnDeposit", type: "uint256" },
          { name: "maxWithdrawalPerPeriod", type: "uint256" },
          { name: "metadata", type: "string" },
          {
            name: "multiTokenConfig",
            type: "tuple",
            components: [
              { name: "enabled", type: "bool" },
              { name: "maxSlippagePercent", type: "uint256" },
              { name: "minSwapAmount", type: "uint256" },
              { name: "defaultFee", type: "uint24" },
            ],
          },
        ],
      },
      {
        name: "accessConfig",
        type: "tuple",
        components: [
          { name: "allowlist", type: "address[]" },
          {
            name: "nftRequirement",
            type: "tuple",
            components: [
              { name: "nftContract", type: "address" },
              { name: "tokenId", type: "uint256" },
              { name: "minBalance", type: "uint256" },
              { name: "isPoapEventGate", type: "bool" },
            ],
          },
        ],
      },
      {
        name: "multiTokenConfig",
        type: "tuple",
        components: [
          { name: "enabled", type: "bool" },
          { name: "maxSlippagePercent", type: "uint256" },
          { name: "minSwapAmount", type: "uint256" },
          { name: "defaultFee", type: "uint24" },
        ],
      },
    ],
    outputs: [{ name: "jarAddress", type: "address" }],
  },
  {
    name: "getJarInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jarAddress", type: "address" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "createdAt", type: "uint256" },
      { name: "metadata", type: "string" },
    ],
  },
  {
    name: "getMetadata",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "jarAddress", type: "address" }],
    outputs: [{ name: "metadata", type: "string" }],
  },
  {
    name: "updateMetadata",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "jarAddress", type: "address" },
      { name: "newMetadata", type: "string" },
    ],
    outputs: [],
  },
] as const;
