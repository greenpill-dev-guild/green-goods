import * as fs from "node:fs";
import * as path from "node:path";

export interface NetworkConfig {
  chainId: number;
  rpcUrl: string;
  verifyApiUrl?: string;
  verifyApiKey?: string;
  contracts?: {
    communityToken?: string;
    [key: string]: string | undefined;
  };
  name?: string;
}

export interface DeploymentDefaults {
  factory: string;
  tokenboundRegistry: string;
  safe: string;
  safeFactory: string;
  safe4337Module: string;
  greenGoodsSafe: string;
  multisig: string;
  [key: string]: string;
}

export interface NetworksFile {
  networks: Record<string, NetworkConfig>;
  deploymentDefaults?: DeploymentDefaults;
}

export interface VerifierConfig {
  apiUrl: string;
  apiKey?: string;
}

/** Canonical network name → chain ID string mapping. Single source of truth. */
export const CHAIN_ID_MAP: Record<string, string> = {
  localhost: "31337",
  arbitrum: "42161",
  sepolia: "11155111",
  celo: "42220",
};

/**
 * Networks supported by Alchemy URL auto-derivation.
 * Intentionally excludes Celo, which often uses dedicated RPC infra.
 */
const ALCHEMY_NETWORK_PATHS: Record<string, string> = {
  mainnet: "eth-mainnet",
  sepolia: "eth-sepolia",
  arbitrum: "arb-mainnet",
};

/**
 * NetworkManager - Single source of truth for network configuration
 *
 * Consolidates network configuration handling that was previously
 * duplicated across deploy.js, garden-manager.js, and action-manager.js
 */
export class NetworkManager {
  private networksConfig: NetworksFile;

  constructor() {
    this.networksConfig = this._loadNetworksConfig();
  }

  /**
   * Load networks.json configuration
   */
  private _loadNetworksConfig(): NetworksFile {
    const networksPath = path.join(__dirname, "../../deployments/networks.json");
    if (!fs.existsSync(networksPath)) {
      throw new Error(`Networks configuration not found: ${networksPath}`);
    }
    return JSON.parse(fs.readFileSync(networksPath, "utf8")) as NetworksFile;
  }

  /**
   * Get network configuration by name or chainId
   * @param networkIdentifier - Network name (e.g., 'arbitrum') or chainId (e.g., 42161)
   * @returns Network configuration
   */
  getNetwork(networkIdentifier: string | number): NetworkConfig & { name: string } {
    const networks = this.networksConfig.networks;

    // Try by network name first
    if (typeof networkIdentifier === "string" && networks[networkIdentifier]) {
      return {
        ...networks[networkIdentifier],
        name: networkIdentifier,
      };
    }

    // Try by chainId
    const chainId = typeof networkIdentifier === "string" ? Number.parseInt(networkIdentifier, 10) : networkIdentifier;
    for (const [name, config] of Object.entries(networks)) {
      if (config.chainId === chainId) {
        return {
          ...config,
          name,
        };
      }
    }

    throw new Error(`Network not found: ${networkIdentifier}`);
  }

  /**
   * Get RPC URL for a network, handling environment variable substitution
   * @param networkName - Network name
   * @returns Resolved RPC URL
   */
  getRpcUrl(networkName: string): string {
    const network = this.getNetwork(networkName);
    let rpcUrl = network.rpcUrl;
    const derivedAlchemyRpc = this._deriveAlchemyRpcUrl(networkName);

    // Handle environment variable substitution (e.g., ${ARBITRUM_RPC_URL})
    if (rpcUrl.startsWith("${") && rpcUrl.endsWith("}")) {
      const envVar = rpcUrl.slice(2, -1);
      rpcUrl = process.env[envVar] || "";

      // Prefer Alchemy on supported networks when the configured RPC is a
      // default public endpoint (for example publicnode) or missing.
      if (derivedAlchemyRpc && this._shouldPreferAlchemyRpc(rpcUrl)) {
        return derivedAlchemyRpc;
      }

      if (!rpcUrl) {
        throw new Error(
          `Environment variable ${envVar} not set for network ${networkName}. ` +
            `Set ${envVar} or provide ALCHEMY_API_KEY/ALCHEMY_KEY/VITE_ALCHEMY_API_KEY for supported networks.`,
        );
      }
    }

    if (derivedAlchemyRpc && this._shouldPreferAlchemyRpc(rpcUrl)) {
      return derivedAlchemyRpc;
    }

    return rpcUrl;
  }

  /**
   * Derive provider URL from a shared Alchemy key for supported networks.
   * Returns null when key/network is unsupported so explicit RPC env vars still work.
   */
  private _deriveAlchemyRpcUrl(networkName: string): string | null {
    const apiKey = process.env.ALCHEMY_API_KEY || process.env.ALCHEMY_KEY || process.env.VITE_ALCHEMY_API_KEY;
    if (!apiKey) {
      return null;
    }

    const networkPath = ALCHEMY_NETWORK_PATHS[networkName];
    if (!networkPath) {
      return null;
    }

    return `https://${networkPath}.g.alchemy.com/v2/${apiKey}`;
  }

  private _shouldPreferAlchemyRpc(rpcUrl: string): boolean {
    if (!rpcUrl) {
      return true;
    }

    return rpcUrl.toLowerCase().includes("publicnode.com");
  }

  /**
   * Get chain ID for a network
   * @param networkName - Network name
   * @returns Chain ID
   */
  getChainId(networkName: string): number {
    const network = this.getNetwork(networkName);
    return network.chainId;
  }

  /**
   * Get community token address for a network
   * @param networkName - Network name
   * @returns Community token address
   */
  getCommunityToken(networkName: string): string {
    const network = this.getNetwork(networkName);
    if (!network.contracts?.communityToken) {
      throw new Error(`Community token not configured for network ${networkName}`);
    }
    return network.contracts.communityToken;
  }

  /**
   * Get all available network names
   * @returns Array of network names
   */
  getAvailableNetworks(): string[] {
    return Object.keys(this.networksConfig.networks);
  }

  /**
   * Check if a network is localhost/anvil
   * @param networkName - Network name
   * @returns True if localhost
   */
  isLocalhost(networkName: string): boolean {
    return networkName === "localhost";
  }

  /**
   * Get verifier configuration for a network
   * @param networkName - Network name
   * @returns Verifier config with apiUrl and apiKey, or null
   */
  getVerifierConfig(networkName: string): VerifierConfig | null {
    const network = this.getNetwork(networkName);

    if (!network.verifyApiUrl) {
      return null;
    }

    let apiKey = network.verifyApiKey;

    // Handle environment variable substitution for API key
    if (apiKey && apiKey.startsWith("${") && apiKey.endsWith("}")) {
      const envVar = apiKey.slice(2, -1);
      apiKey = process.env[envVar];
    }

    return {
      apiUrl: network.verifyApiUrl,
      apiKey,
    };
  }

  /**
   * Map network name to chain ID string for file paths
   * @param networkName - Network name
   * @returns Chain ID as string
   */
  getChainIdString(networkName: string): string {
    return CHAIN_ID_MAP[networkName] || this.getChainId(networkName).toString();
  }

  /**
   * Get a deployment default value from networks.json
   * @param key - The default key (e.g., 'multisig', 'greenGoodsSafe')
   * @returns The address string, or undefined if not set
   */
  getDeploymentDefault(key: string): string | undefined {
    return this.networksConfig.deploymentDefaults?.[key];
  }
}
