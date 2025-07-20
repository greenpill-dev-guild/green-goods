#!/usr/bin/env node

const fs = require("node:fs").promises;
const path = require("node:path");
const { execSync } = require("node:child_process");
const https = require("node:https");

// Gas optimization strategies
const GAS_STRATEGIES = {
  // Conservative - pay more for faster inclusion
  conservative: {
    multiplier: 1.2,
    maxWait: 60, // seconds
    priority: "fast",
  },

  // Standard - balanced approach
  standard: {
    multiplier: 1.1,
    maxWait: 180,
    priority: "average",
  },

  // Aggressive - minimize gas costs
  aggressive: {
    multiplier: 1.0,
    maxWait: 600,
    priority: "slow",
  },
};

class GasOptimizer {
  constructor(network, strategy = "standard") {
    this.network = network;
    this.strategy = GAS_STRATEGIES[strategy] || GAS_STRATEGIES.standard;
    this.gasHistory = [];
    this.networkConfig = null;
  }

  async initialize() {
    // Load network configuration
    const configPath = path.join(__dirname, "..", "..", "deployments", "networks.json");
    const config = JSON.parse(await fs.readFile(configPath, "utf8"));
    this.networkConfig = config[this.network];

    if (!this.networkConfig) {
      throw new Error(`Network ${this.network} not found in configuration`);
    }
  }

  async getOptimalGasPrice() {
    console.log(`Getting optimal gas price for ${this.network}...`);

    try {
      // Try multiple sources for gas prices
      const prices = await Promise.allSettled([
        this.getGasPriceFromEthGasStation(),
        this.getGasPriceFromBlocknative(),
        this.getGasPriceFromNetwork(),
      ]);

      // Filter successful results
      const validPrices = prices.filter((p) => p.status === "fulfilled" && p.value).map((p) => p.value);

      if (validPrices.length === 0) {
        throw new Error("Could not fetch gas prices from any source");
      }

      // Calculate median gas price
      const median = this.calculateMedian(validPrices);
      const optimized = Math.floor(median * this.strategy.multiplier);

      console.log(`Recommended gas price: ${optimized} gwei`);
      console.log(`Strategy: ${this.strategy.priority}`);

      return optimized;
    } catch (error) {
      console.error("Error getting gas price:", error);
      // Fallback to network default
      return await this.getGasPriceFromNetwork();
    }
  }

  async getGasPriceFromEthGasStation() {
    if (!["mainnet", "sepolia"].includes(this.network)) {
      return null;
    }

    return new Promise((resolve, reject) => {
      https
        .get("https://api.ethgasstation.info/api/ethgasAPI.json", (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              const price = json[this.strategy.priority] / 10; // Convert to gwei
              resolve(price);
            } catch (err) {
              reject(err);
            }
          });
        })
        .on("error", reject);
    });
  }

  async getGasPriceFromBlocknative() {
    // Blocknative API integration
    return new Promise((resolve, reject) => {
      const options = {
        hostname: "api.blocknative.com",
        path: "/gasprices/blockprices",
        headers: {
          Authorization: process.env.BLOCKNATIVE_API_KEY || "",
        },
      };

      https
        .get(options, (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              if (json.blockPrices?.[0]) {
                const prices = json.blockPrices[0].estimatedPrices;
                const price = prices.find((p) => p.confidence === 90);
                resolve(price ? price.price : null);
              } else {
                resolve(null);
              }
            } catch (err) {
              reject(err);
            }
          });
        })
        .on("error", reject);
    });
  }

  async getGasPriceFromNetwork() {
    try {
      const result = execSync(`cast gas-price --rpc-url ${this.networkConfig.rpcUrl}`, { encoding: "utf8" });

      // Convert from wei to gwei
      const wei = Number.parseInt(result.trim());
      return wei / 1e9;
    } catch (error) {
      console.error("Error getting gas price from network:", error);
      return 20; // Default fallback
    }
  }

  calculateMedian(values) {
    const sorted = values.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  async monitorGasPrices(duration = 300) {
    console.log(`Monitoring gas prices for ${duration} seconds...`);

    const startTime = Date.now();
    const interval = 30000; // Check every 30 seconds

    const monitor = setInterval(async () => {
      const gasPrice = await this.getOptimalGasPrice();
      this.gasHistory.push({
        timestamp: Date.now(),
        price: gasPrice,
      });

      // Analyze trends
      if (this.gasHistory.length >= 3) {
        const trend = this.analyzeTrend();
        console.log(`Gas price trend: ${trend}`);

        if (trend === "decreasing" && this.strategy.priority !== "fast") {
          console.log("Gas prices are decreasing, consider waiting...");
        }
      }

      if (Date.now() - startTime >= duration * 1000) {
        clearInterval(monitor);
        this.recommendDeploymentTime();
      }
    }, interval);

    // Initial check
    const initialPrice = await this.getOptimalGasPrice();
    this.gasHistory.push({
      timestamp: Date.now(),
      price: initialPrice,
    });
  }

  analyzeTrend() {
    if (this.gasHistory.length < 3) return "unknown";

    const recent = this.gasHistory.slice(-3);
    const prices = recent.map((h) => h.price);

    const increasing = prices[1] > prices[0] && prices[2] > prices[1];
    const decreasing = prices[1] < prices[0] && prices[2] < prices[1];

    if (increasing) return "increasing";
    if (decreasing) return "decreasing";
    return "stable";
  }

  recommendDeploymentTime() {
    if (this.gasHistory.length === 0) {
      console.log("No gas price data collected");
      return;
    }

    // Find the lowest gas price period
    const lowest = this.gasHistory.reduce((min, curr) => (curr.price < min.price ? curr : min));

    const average = this.gasHistory.reduce((sum, h) => sum + h.price, 0) / this.gasHistory.length;

    console.log("\n=== Gas Price Analysis ===");
    console.log(`Average gas price: ${average.toFixed(2)} gwei`);
    console.log(`Lowest gas price: ${lowest.price} gwei`);
    console.log(`Current gas price: ${this.gasHistory[this.gasHistory.length - 1].price} gwei`);

    const savings = (((average - lowest.price) / average) * 100).toFixed(1);
    console.log(`Potential savings by waiting: ${savings}%`);

    return {
      average,
      lowest: lowest.price,
      current: this.gasHistory[this.gasHistory.length - 1].price,
      savings: Number.parseFloat(savings),
    };
  }

  async generateGasReport(deploymentResult) {
    const report = {
      network: this.network,
      timestamp: new Date().toISOString(),
      strategy: this.strategy.priority,
      gasUsed: deploymentResult.gasUsed,
      gasPrice: deploymentResult.gasPrice,
      totalCost: (deploymentResult.gasUsed * deploymentResult.gasPrice) / 1e9,
      optimization: {
        targetPrice: await this.getOptimalGasPrice(),
        actualPrice: deploymentResult.gasPrice / 1e9,
        savings: 0,
      },
    };

    report.optimization.savings = (
      ((report.optimization.targetPrice - report.optimization.actualPrice) / report.optimization.targetPrice) *
      100
    ).toFixed(2);

    const reportPath = path.join(
      __dirname,
      "..",
      "..",
      "deployments",
      "gas-reports",
      `${this.network}-${Date.now()}.json`,
    );

    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    console.log("\n=== Gas Usage Report ===");
    console.log(`Total gas used: ${report.gasUsed.toLocaleString()}`);
    console.log(`Gas price: ${report.optimization.actualPrice} gwei`);
    console.log(`Total cost: ${report.totalCost.toFixed(4)} ETH`);
    console.log(`Optimization savings: ${report.optimization.savings}%`);

    return report;
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: gas-optimizer.js <network> [command] [options]");
    console.error("Commands:");
    console.error("  price          Get current optimal gas price");
    console.error("  monitor        Monitor gas prices over time");
    console.error("  report         Generate gas usage report");
    console.error("Options:");
    console.error("  --strategy     Gas strategy (conservative/standard/aggressive)");
    console.error("  --duration     Monitoring duration in seconds");
    process.exit(1);
  }

  const network = args[0];
  const command = args[1] || "price";
  const strategy = args.find((a) => a.startsWith("--strategy="))?.split("=")[1] || "standard";
  const duration = Number.parseInt(args.find((a) => a.startsWith("--duration="))?.split("=")[1] || "300");

  const optimizer = new GasOptimizer(network, strategy);
  await optimizer.initialize();

  switch (command) {
    case "price": {
      const price = await optimizer.getOptimalGasPrice();
      console.log(`\nOptimal gas price: ${price} gwei`);
      break;
    }

    case "monitor":
      await optimizer.monitorGasPrices(duration);
      break;

    case "report":
      // This would be called after a deployment
      console.log("Run this after a deployment to generate a gas report");
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { GasOptimizer };
