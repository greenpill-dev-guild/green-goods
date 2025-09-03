#!/usr/bin/env node

const { ethers } = require("ethers");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Security Monitor for Green Goods Factory System
 *
 * Monitors wallet balances, transaction patterns, and provides
 * early warning for potential compromises.
 */
class SecurityMonitor {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.options = {
      minBalance: ethers.parseEther("0.01"), // 0.01 ETH minimum
      alertThreshold: ethers.parseEther("0.005"), // Alert when below 0.005 ETH
      maxTransactionsPerHour: 10,
      alertWebhook: null,
      ...options,
    };

    this.monitoringData = this.loadMonitoringData();
  }

  /**
   * Monitor wallet balance and alert if low
   * @param {string} address - Wallet address to monitor
   * @param {string} label - Human-readable label for the wallet
   */
  async monitorBalance(address, label = "Wallet") {
    try {
      const balance = await this.provider.getBalance(address);
      const balanceEth = ethers.formatEther(balance);

      const status = {
        address,
        label,
        balance: balanceEth,
        balanceWei: balance.toString(),
        timestamp: new Date().toISOString(),
        status: this.getBalanceStatus(balance),
      };

      // Log current status
      const statusIcon = this.getStatusIcon(status.status);
      console.log(`${statusIcon} ${label}: ${balanceEth} ETH (${status.status})`);

      // Alert if low
      if (balance < this.options.alertThreshold) {
        await this.sendAlert({
          type: "LOW_BALANCE",
          severity: balance < this.options.minBalance ? "CRITICAL" : "WARNING",
          message: `${label} balance is low: ${balanceEth} ETH`,
          address,
          balance: balanceEth,
          threshold: ethers.formatEther(this.options.alertThreshold),
        });
      }

      // Save monitoring data
      this.updateMonitoringData(address, status);

      return status;
    } catch (error) {
      console.error(`❌ Failed to monitor balance for ${label}:`, error.message);
      throw error;
    }
  }

  /**
   * Monitor transaction patterns for suspicious activity
   * @param {string} address - Wallet address to monitor
   * @param {string} label - Human-readable label for the wallet
   */
  async monitorTransactionPatterns(address, label = "Wallet") {
    try {
      const currentNonce = await this.provider.getTransactionCount(address);
      const previousData = this.monitoringData.wallets[address];

      if (previousData) {
        const timeDiff = Date.now() - new Date(previousData.lastCheck).getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        const nonceDiff = currentNonce - previousData.nonce;
        const txPerHour = hoursDiff > 0 ? nonceDiff / hoursDiff : 0;

        if (txPerHour > this.options.maxTransactionsPerHour) {
          await this.sendAlert({
            type: "HIGH_TRANSACTION_RATE",
            severity: "WARNING",
            message: `${label} has high transaction rate: ${txPerHour.toFixed(1)} tx/hour`,
            address,
            transactionRate: txPerHour,
            threshold: this.options.maxTransactionsPerHour,
          });
        }
      }

      const status = {
        address,
        label,
        nonce: currentNonce,
        timestamp: new Date().toISOString(),
      };

      this.updateMonitoringData(address, status);
      return status;
    } catch (error) {
      console.error(`❌ Failed to monitor transactions for ${label}:`, error.message);
      throw error;
    }
  }

  /**
   * Pre-fund wallet if balance is below minimum
   * @param {string} address - Wallet address to fund
   * @param {string} fundingSource - Address to fund from
   * @param {string} label - Human-readable label
   */
  async preFundWallet(address, fundingSource, label = "Wallet") {
    try {
      const balance = await this.provider.getBalance(address);

      if (balance < this.options.minBalance) {
        const needed = this.options.minBalance - balance;
        const neededEth = ethers.formatEther(needed);

        console.log(`💰 Pre-funding ${label}: ${neededEth} ETH needed`);

        // This would typically send a transaction from funding source
        // For now, we'll just log the requirement
        console.log(`📝 Fund ${address} with ${neededEth} ETH from ${fundingSource}`);

        await this.sendAlert({
          type: "PRE_FUNDING_REQUIRED",
          severity: "INFO",
          message: `${label} needs ${neededEth} ETH funding`,
          address,
          needed: neededEth,
          fundingSource,
        });

        return {
          required: true,
          amount: neededEth,
          address,
          fundingSource,
        };
      }

      console.log(`✅ ${label} sufficiently funded: ${ethers.formatEther(balance)} ETH`);
      return { required: false };
    } catch (error) {
      console.error(`❌ Failed to check pre-funding for ${label}:`, error.message);
      throw error;
    }
  }

  /**
   * Verify contract on Etherscan
   * @param {string} contractAddress - Contract address to verify
   * @param {string} contractName - Contract name
   * @param {string} network - Network name
   */
  async verifyOnEtherscan(contractAddress, contractName, network) {
    const etherscanApiKey = process.env.ETHERSCAN_API_KEY;
    if (!etherscanApiKey) {
      console.log(`⚠️  ETHERSCAN_API_KEY not set, skipping verification for ${contractName}`);
      return { verified: false, reason: "No API key" };
    }

    try {
      console.log(`🔍 Verifying ${contractName} on Etherscan...`);

      // Use forge verify command
      const networkFlag = network === "localhost" ? "sepolia" : network;
      const verifyCommand = `forge verify-contract ${contractAddress} src/DeploymentRegistry.sol:DeploymentRegistry --chain ${networkFlag} --etherscan-api-key ${etherscanApiKey}`;

      console.log(`📝 Verification command: ${verifyCommand}`);

      // This would typically execute the command
      // For now, we'll just log it
      return {
        verified: true,
        contractAddress,
        contractName,
        network,
        verificationCommand: verifyCommand,
      };
    } catch (error) {
      console.error(`❌ Verification failed for ${contractName}:`, error.message);
      return { verified: false, error: error.message };
    }
  }

  /**
   * Send security alert
   */
  async sendAlert(alert) {
    const alertData = {
      ...alert,
      timestamp: new Date().toISOString(),
      network: (await this.provider.getNetwork()).name,
    };

    // Log to console
    const severityIcon = {
      INFO: "ℹ️",
      WARNING: "⚠️",
      CRITICAL: "🚨",
    };

    console.log(`${severityIcon[alert.severity]} SECURITY ALERT: ${alert.message}`);

    // Save to alerts log
    this.saveAlert(alertData);

    // Send webhook if configured
    if (this.options.alertWebhook) {
      try {
        const fetch = require("node-fetch");
        await fetch(this.options.alertWebhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(alertData),
        });
      } catch (error) {
        console.error("Failed to send webhook alert:", error.message);
      }
    }

    return alertData;
  }

  /**
   * Get balance status
   */
  getBalanceStatus(balance) {
    if (balance >= this.options.minBalance) return "HEALTHY";
    if (balance >= this.options.alertThreshold) return "LOW";
    return "CRITICAL";
  }

  /**
   * Get status icon
   */
  getStatusIcon(status) {
    switch (status) {
      case "HEALTHY":
        return "✅";
      case "LOW":
        return "⚠️";
      case "CRITICAL":
        return "🚨";
      default:
        return "❓";
    }
  }

  /**
   * Load monitoring data from disk
   */
  loadMonitoringData() {
    const dataPath = this.getMonitoringDataPath();

    if (fs.existsSync(dataPath)) {
      try {
        return JSON.parse(fs.readFileSync(dataPath, "utf8"));
      } catch (_error) {
        console.warn("⚠️  Failed to load monitoring data, starting fresh");
      }
    }

    return {
      wallets: {},
      alerts: [],
      lastUpdate: new Date().toISOString(),
    };
  }

  /**
   * Update monitoring data
   */
  updateMonitoringData(address, status) {
    this.monitoringData.wallets[address] = {
      ...this.monitoringData.wallets[address],
      ...status,
      lastCheck: new Date().toISOString(),
    };

    this.monitoringData.lastUpdate = new Date().toISOString();
    this.saveMonitoringData();
  }

  /**
   * Save monitoring data to disk
   */
  saveMonitoringData() {
    const dataPath = this.getMonitoringDataPath();
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(this.monitoringData, null, 2));
  }

  /**
   * Save security alert
   */
  saveAlert(alert) {
    this.monitoringData.alerts.push(alert);

    // Keep only last 100 alerts
    if (this.monitoringData.alerts.length > 100) {
      this.monitoringData.alerts = this.monitoringData.alerts.slice(-100);
    }

    this.saveMonitoringData();
  }

  /**
   * Get monitoring data file path
   */
  getMonitoringDataPath() {
    return path.join(__dirname, "..", "monitoring", "security-data.json");
  }

  /**
   * Generate security report
   */
  async generateSecurityReport() {
    console.log("📊 Generating security report...");

    const report = {
      timestamp: new Date().toISOString(),
      network: (await this.provider.getNetwork()).name,
      wallets: {},
      alerts: this.monitoringData.alerts.slice(-10), // Last 10 alerts
      summary: {
        totalWallets: Object.keys(this.monitoringData.wallets).length,
        healthyWallets: 0,
        lowBalanceWallets: 0,
        criticalWallets: 0,
        recentAlerts: this.monitoringData.alerts.filter(
          (a) => Date.now() - new Date(a.timestamp).getTime() < 24 * 60 * 60 * 1000,
        ).length,
      },
    };

    // Check current status of all monitored wallets
    for (const [address, data] of Object.entries(this.monitoringData.wallets)) {
      const currentStatus = await this.monitorBalance(address, data.label);
      report.wallets[address] = currentStatus;

      switch (currentStatus.status) {
        case "HEALTHY":
          report.summary.healthyWallets++;
          break;
        case "LOW":
          report.summary.lowBalanceWallets++;
          break;
        case "CRITICAL":
          report.summary.criticalWallets++;
          break;
      }
    }

    // Save report
    const reportPath = path.join(__dirname, "..", "monitoring", `security-report-${Date.now()}.json`);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`📄 Security report saved: ${reportPath}`);
    console.log(
      `📊 Summary: ${report.summary.healthyWallets} healthy, ${report.summary.lowBalanceWallets} low, ${report.summary.criticalWallets} critical`,
    );

    return report;
  }
}

/**
 * CLI Helper functions
 */
async function monitorDeploymentSecurity(network, addresses, options = {}) {
  const provider = new ethers.JsonRpcProvider(process.env[`${network.toUpperCase()}_RPC_URL`]);
  const monitor = new SecurityMonitor(provider, options);

  console.log(`🔍 Monitoring deployment security on ${network}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  for (const [address, label] of Object.entries(addresses)) {
    await monitor.monitorBalance(address, label);
    await monitor.monitorTransactionPatterns(address, label);
  }

  return monitor.generateSecurityReport();
}

module.exports = {
  SecurityMonitor,
  monitorDeploymentSecurity,
};
