const fs = require("node:fs");
const path = require("node:path");

/**
 * NetworkManager - Single source of truth for network configuration
 *
 * Consolidates network configuration handling that was previously
 * duplicated across deploy.js, garden-manager.js, and action-manager.js
 */
class NetworkManager {
  constructor() {
    this.networksConfig = this._loadNetworksConfig();
  }

  /**
   * Load networks.json configuration
   */
  _loadNetworksConfig() {
    const networksPath = path.join(__dirname, "../../deployments/networks.json");
    if (!fs.existsSync(networksPath)) {
      throw new Error(`Networks configuration not found: ${networksPath}`);
    }
    return JSON.parse(fs.readFileSync(networksPath, "utf8"));
  }

  /**
   * Get network configuration by name or chainId
   * @param {string|number} networkIdentifier - Network name (e.g., 'arbitrum') or chainId (e.g., 42161)
   * @returns {Object} Network configuration
   */
  getNetwork(networkIdentifier) {
    const networks = this.networksConfig.networks;

    // Try by network name first
    if (networks[networkIdentifier]) {
      return {
        ...networks[networkIdentifier],
        name: networkIdentifier,
      };
    }

    // Try by chainId
    const chainId = typeof networkIdentifier === "string" ? Number.parseInt(networkIdentifier) : networkIdentifier;
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
   * @param {string} networkName - Network name
   * @returns {string} Resolved RPC URL
   */
  getRpcUrl(networkName) {
    const network = this.getNetwork(networkName);
    let rpcUrl = network.rpcUrl;

    // Handle environment variable substitution (e.g., ${ARBITRUM_RPC_URL})
    if (rpcUrl.startsWith("${") && rpcUrl.endsWith("}")) {
      const envVar = rpcUrl.slice(2, -1);
      rpcUrl = process.env[envVar];

      if (!rpcUrl) {
        throw new Error(`Environment variable ${envVar} not set for network ${networkName}`);
      }
    }

    return rpcUrl;
  }

  /**
   * Get chain ID for a network
   * @param {string} networkName - Network name
   * @returns {number} Chain ID
   */
  getChainId(networkName) {
    const network = this.getNetwork(networkName);
    return network.chainId;
  }

  /**
   * Get community token address for a network
   * @param {string} networkName - Network name
   * @returns {string} Community token address
   */
  getCommunityToken(networkName) {
    const network = this.getNetwork(networkName);
    if (!network.contracts?.communityToken) {
      throw new Error(`Community token not configured for network ${networkName}`);
    }
    return network.contracts.communityToken;
  }

  /**
   * Get all available network names
   * @returns {string[]} Array of network names
   */
  getAvailableNetworks() {
    return Object.keys(this.networksConfig.networks);
  }

  /**
   * Check if a network is localhost/anvil
   * @param {string} networkName - Network name
   * @returns {boolean} True if localhost
   */
  isLocalhost(networkName) {
    return networkName === "localhost";
  }

  /**
   * Get verifier configuration for a network
   * @param {string} networkName - Network name
   * @returns {Object|null} Verifier config with apiUrl and apiKey
   */
  getVerifierConfig(networkName) {
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
   * @param {string} networkName - Network name
   * @returns {string} Chain ID as string
   */
  getChainIdString(networkName) {
    const chainMap = {
      localhost: "31337",
      arbitrum: "42161",
      baseSepolia: "84532",
      celo: "42220",
    };

    return chainMap[networkName] || this.getChainId(networkName).toString();
  }
}

module.exports = { NetworkManager };
