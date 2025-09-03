#!/usr/bin/env node

const { ethers } = require("ethers");

/**
 * Gnosis Safe Integration for Green Goods Factory System
 *
 * Provides utilities for creating and managing Gnosis Safe transactions
 * for secure contract deployment approvals.
 */
class GnosisSafeIntegration {
  constructor(safeAddress, provider, signer) {
    this.safeAddress = safeAddress;
    this.provider = provider;
    this.signer = signer;

    // Gnosis Safe ABI (minimal interface)
    this.safeABI = [
      "function getThreshold() external view returns (uint256)",
      "function getOwners() external view returns (address[])",
      "function isOwner(address owner) external view returns (bool)",
      "function nonce() external view returns (uint256)",
      "function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes calldata signatures) external payable returns (bool success)",
    ];

    this.safe = new ethers.Contract(safeAddress, this.safeABI, provider);
  }

  /**
   * Get Safe information
   */
  async getSafeInfo() {
    try {
      const [threshold, owners, nonce] = await Promise.all([
        this.safe.getThreshold(),
        this.safe.getOwners(),
        this.safe.nonce(),
      ]);

      return {
        address: this.safeAddress,
        threshold: Number(threshold),
        owners,
        nonce: Number(nonce),
      };
    } catch (error) {
      console.error("❌ Failed to get Safe info:", error.message);
      throw error;
    }
  }

  /**
   * Create a Safe transaction for template registration
   * @param {string} templateHash - The template hash to register
   * @param {number} expirationTime - Unix timestamp for expiration
   * @param {string} registryAddress - DeploymentRegistry address
   */
  async createTemplateRegistrationTransaction(templateHash, expirationTime, registryAddress) {
    console.log("🔐 Creating Safe transaction for template registration");

    try {
      const registryABI = ["function registerTemplate(bytes32 templateHash, uint256 expirationTime) external"];

      const registryInterface = new ethers.Interface(registryABI);
      const data = registryInterface.encodeFunctionData("registerTemplate", [templateHash, expirationTime]);

      const safeInfo = await this.getSafeInfo();

      const safeTransaction = {
        to: registryAddress,
        value: "0",
        data,
        operation: 0, // CALL
        safeTxGas: 0,
        baseGas: 0,
        gasPrice: 0,
        gasToken: ethers.ZeroAddress,
        refundReceiver: ethers.ZeroAddress,
        nonce: safeInfo.nonce,
      };

      console.log("✅ Safe transaction prepared:");
      console.log(`   Template Hash: ${templateHash}`);
      console.log(`   Expiration: ${new Date(expirationTime * 1000).toISOString()}`);
      console.log(`   Required Signatures: ${safeInfo.threshold}/${safeInfo.owners.length}`);
      console.log(`   Nonce: ${safeInfo.nonce}`);

      return {
        safeTransaction,
        safeInfo,
        templateHash,
        expirationTime,
      };
    } catch (error) {
      console.error("❌ Failed to create Safe transaction:", error.message);
      throw error;
    }
  }

  /**
   * Create a Safe transaction for emergency guardian setup
   * @param {string} guardianAddress - afo.eth address
   * @param {string} registryAddress - DeploymentRegistry address
   */
  async createGuardianSetupTransaction(guardianAddress, registryAddress) {
    console.log("🔐 Creating Safe transaction for emergency guardian setup");

    try {
      const registryABI = ["function setEmergencyGuardian(address _emergencyGuardian) external"];

      const registryInterface = new ethers.Interface(registryABI);
      const data = registryInterface.encodeFunctionData("setEmergencyGuardian", [guardianAddress]);

      const safeInfo = await this.getSafeInfo();

      const safeTransaction = {
        to: registryAddress,
        value: "0",
        data,
        operation: 0, // CALL
        safeTxGas: 0,
        baseGas: 0,
        gasPrice: 0,
        gasToken: ethers.ZeroAddress,
        refundReceiver: ethers.ZeroAddress,
        nonce: safeInfo.nonce,
      };

      console.log("✅ Guardian setup transaction prepared:");
      console.log(`   Guardian: ${guardianAddress} (afo.eth)`);
      console.log(`   Required Signatures: ${safeInfo.threshold}/${safeInfo.owners.length}`);

      return {
        safeTransaction,
        safeInfo,
        guardianAddress,
      };
    } catch (error) {
      console.error("❌ Failed to create guardian setup transaction:", error.message);
      throw error;
    }
  }

  /**
   * Generate Safe transaction hash for signing
   */
  generateSafeTransactionHash(safeTransaction) {
    const domain = {
      chainId: this.provider.network.chainId,
      verifyingContract: this.safeAddress,
    };

    const types = {
      SafeTx: [
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
        { name: "operation", type: "uint8" },
        { name: "safeTxGas", type: "uint256" },
        { name: "baseGas", type: "uint256" },
        { name: "gasPrice", type: "uint256" },
        { name: "gasToken", type: "address" },
        { name: "refundReceiver", type: "address" },
        { name: "nonce", type: "uint256" },
      ],
    };

    return ethers.TypedDataEncoder.hash(domain, types, safeTransaction);
  }

  /**
   * Export transaction for Gnosis Safe UI
   * @param {Object} safeTransaction - The prepared Safe transaction
   * @param {string} outputPath - Where to save the transaction JSON
   */
  async exportForSafeUI(safeTransaction, outputPath) {
    const exportData = {
      version: "1.0",
      chainId: (await this.provider.getNetwork()).chainId.toString(),
      createdAt: Date.now(),
      meta: {
        name: "Green Goods Factory Transaction",
        description: "Secure deployment via Gnosis Safe",
        txBuilderVersion: "1.16.1",
      },
      transactions: [safeTransaction],
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));

    console.log("📄 Transaction exported for Gnosis Safe UI:");
    console.log(`   File: ${outputPath}`);
    console.log("   Import this file in the Gnosis Safe web interface");

    return exportData;
  }

  /**
   * Monitor Safe transaction execution
   * @param {string} safeTxHash - The Safe transaction hash
   */
  async monitorExecution(safeTxHash) {
    console.log(`👀 Monitoring Safe transaction: ${safeTxHash}`);

    // This would typically poll the Safe API or listen for events
    // For now, we'll provide instructions
    console.log(`🔗 Monitor at: https://app.safe.global/transactions/history?safe=${this.safeAddress}`);

    return {
      status: "pending",
      monitorUrl: `https://app.safe.global/transactions/history?safe=${this.safeAddress}`,
    };
  }
}

/**
 * CLI Helper functions
 */
async function setupGnosisSafeIntegration(safeAddress, provider, signer) {
  const integration = new GnosisSafeIntegration(safeAddress, provider, signer);

  // Validate Safe exists and is accessible
  try {
    const safeInfo = await integration.getSafeInfo();
    console.log("✅ Gnosis Safe connected:");
    console.log(`   Address: ${safeAddress}`);
    console.log(`   Threshold: ${safeInfo.threshold}/${safeInfo.owners.length}`);
    console.log(`   Owners: ${safeInfo.owners.join(", ")}`);

    return integration;
  } catch (error) {
    console.error(`❌ Failed to connect to Gnosis Safe: ${safeAddress}`);
    throw error;
  }
}

module.exports = {
  GnosisSafeIntegration,
  setupGnosisSafeIntegration,
};
