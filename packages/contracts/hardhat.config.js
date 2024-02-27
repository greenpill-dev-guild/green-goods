require("dotenv/config");
require("hardhat-deploy");
require("hardhat-contract-sizer");
require("@nomicfoundation/hardhat-foundry");
require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");

const {
  ETHEREUM_BASE_PROVIDER_URL = "https://mainnet.base.org",
  ETHEREUM_BASE_GOERLI_PROVIDER_URL = "https://goerli.base.org",
  ETHERSCAN_API_KEY,
  FORGE_PRIVATE_KEY:
    deployer = "ledger://0x0000000000000000000000000000000000000000",

  PROFILE: isProfiling,
} = process.env;

const base = (address) => ({
  8453: address,
});

const baseGoerli = (address) => ({
  84531: address,
});

const NamedAccounts = {
  deployer: {
    ...base(deployer),
    ...baseGoerli(deployer),
  },
};

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.21",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000000,
      },
      metadata: {
        bytecodeHash: "none",
      },
    },
  },
  paths: {
    deploy: ["deploy"],
  },
  typechain: {
    target: "ethers-v6",
  },
  namedAccounts: NamedAccounts,
  networks: {
    hardhat: {
      accounts: {
        count: 20,
        accountsBalance: "10000000000000000000000000000000000000000000000",
      },
      allowUnlimitedContractSize: true,
      saveDeployments: false,
      live: false,
    },
    base: {
      chainId: 8453,
      url: ETHEREUM_BASE_PROVIDER_URL,
      saveDeployments: true,
      live: true,
      accounts: [deployer],
    },
    "base-goerli": {
      chainId: 84531,
      url: ETHEREUM_BASE_GOERLI_PROVIDER_URL,
      saveDeployments: true,
      live: true,
      // gasMultiplier: 2,
      gasPrice: 1000000000,
      accounts: [deployer],
    },
  },
  contractSizer: {
    alphaSort: true,
    runOnCompile: true,
    disambiguatePaths: false,
  },
  verify: {
    etherscan: {
      apiKey: ETHERSCAN_API_KEY,
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: isProfiling,
  },
};
