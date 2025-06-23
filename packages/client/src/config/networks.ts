import schemas from "../../../eas/src/resources/schemas.json";

export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  indexerUrl: string;
  contracts: {
    eas: string;
    schemaRegistry: string;
    actionRegistry: string;
    gardenToken: string;
    workResolver: string;
    workApprovalResolver: string;
  };
  schemas: {
    gardenAssessment: { uid: string; schema: string };
    work: { uid: string; schema: string };
    workApproval: { uid: string; schema: string };
  };
}

// Load local deployment addresses dynamically
async function loadLocalDeployment(): Promise<any> {
  try {
    // Try to load from the deployment output
    const response = await fetch("http://localhost:5173/deployments/local.json");
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    // If that fails, try the contracts directory (for dev server)
    try {
      const response2 = await fetch("/contracts/deployments/local.json");
      if (response2.ok) {
        return await response2.json();
      }
    } catch (error2) {
      console.warn("Local deployment config not found, using defaults");
    }
  }
  return {
    contracts: {},
    schemas: {},
  };
}

export const NETWORKS: Record<string, NetworkConfig> = {
  // Arbitrum One
  "42161": {
    chainId: 42161,
    name: "Arbitrum One",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    indexerUrl:
      import.meta.env.VITE_ENVIO_INDEXER_URL ||
      "https://indexer.hypersync.xyz/4e02df79-f0c7-498a-9df6-8a4a1c9c8dd4",
    contracts: {
      eas: "0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458",
      schemaRegistry: "0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB",
      actionRegistry: "0x933b88Ef33a25d14a68354C88b2eb31e475cd482",
      gardenToken: "0x508198C3f071987D5eEb0030825628F9B10c6037",
      workResolver: "0x1cdDfe922FC92F692bA7db69A2D451d874449c9c",
      workApprovalResolver: "0x63279204b744C4fDb7dbE8331F6b13D7F8344a1d",
    },
    schemas: {
      gardenAssessment: {
        uid:
          schemas[0]?.UID || "0x7433e24287be826b49e5eb28cd52192823e542521c94084a691e67e5cc7e8176",
        schema: schemas[0]?.parsed || "",
      },
      work: {
        uid:
          schemas[1]?.UID || "0x0eb5361c4f892a251e31ff9468ce1b767017eb3696a09bc77955d146c941a25a",
        schema: schemas[1]?.parsed || "",
      },
      workApproval: {
        uid:
          schemas[2]?.UID || "0x047ed74a39f6e98ed82e4423cba3134c81afe8d97525c1107e2a9ed9c975ec77",
        schema: schemas[2]?.parsed || "",
      },
    },
  },

  // Celo Mainnet
  "42220": {
    chainId: 42220,
    name: "Celo",
    rpcUrl: "https://forno.celo.org",
    indexerUrl: "", // To be configured
    contracts: {
      eas: "0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458",
      schemaRegistry: "0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB",
      actionRegistry: "", // Deploy when ready
      gardenToken: "",
      workResolver: "",
      workApprovalResolver: "",
    },
    schemas: {
      gardenAssessment: { uid: "", schema: "" },
      work: { uid: "", schema: "" },
      workApproval: { uid: "", schema: "" },
    },
  },

  // Base
  "8453": {
    chainId: 8453,
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    indexerUrl: "", // To be configured
    contracts: {
      eas: "0x4200000000000000000000000000000000000021",
      schemaRegistry: "0x4200000000000000000000000000000000000020",
      actionRegistry: "", // Deploy when ready
      gardenToken: "",
      workResolver: "",
      workApprovalResolver: "",
    },
    schemas: {
      gardenAssessment: { uid: "", schema: "" },
      work: { uid: "", schema: "" },
      workApproval: { uid: "", schema: "" },
    },
  },

  // Local Development (dynamically loaded)
  "31337": {
    chainId: 31337,
    name: "Local Fork",
    rpcUrl: import.meta.env.VITE_LOCAL_RPC_URL || "http://localhost:8545",
    indexerUrl: import.meta.env.VITE_LOCAL_INDEXER_URL || "http://localhost:8080",
    contracts: {
      eas: "",
      schemaRegistry: "",
      actionRegistry: "",
      gardenToken: "",
      workResolver: "",
      workApprovalResolver: "",
    },
    schemas: {
      gardenAssessment: { uid: "", schema: "" },
      work: { uid: "", schema: "" },
      workApproval: { uid: "", schema: "" },
    },
  },
};

export async function getNetworkConfig(chainId: string | number): Promise<NetworkConfig> {
  const config = NETWORKS[chainId.toString()];
  if (!config) {
    throw new Error(`Network configuration not found for chain ID: ${chainId}`);
  }

  // For local development, try to load dynamic addresses
  if (chainId.toString() === "31337") {
    const localDeployment = await loadLocalDeployment();
    if (localDeployment.contracts) {
      config.contracts = { ...config.contracts, ...localDeployment.contracts };
    }
    if (localDeployment.schemas) {
      config.schemas = { ...config.schemas, ...localDeployment.schemas };
    }
  }

  return config;
}

export function getStaticNetworkConfig(chainId: string | number): NetworkConfig {
  const config = NETWORKS[chainId.toString()];
  if (!config) {
    throw new Error(`Network configuration not found for chain ID: ${chainId}`);
  }
  return config;
}

// Export network constants
export const SUPPORTED_CHAINS = Object.keys(NETWORKS).map(Number);
export const DEFAULT_CHAIN_ID = 42161; // Arbitrum
export const LOCAL_CHAIN_ID = 31337;
