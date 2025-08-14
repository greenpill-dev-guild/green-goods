#!/usr/bin/env node

require("dotenv").config();
const { ethers } = require("ethers");
const { GARDEN_ABI, setupProvider, exportToJSON, formatAddress } = require("./utils/garden-utils");

class GardenAnalytics {
  constructor(options = {}) {
    this.options = {
      network: "localhost",
      period: "30d", // 7d, 30d, 90d, all
      reportType: "summary", // summary, activity, members
      ...options,
    };
  }

  parsePeriod(period) {
    const now = Math.floor(Date.now() / 1000);
    const day = 24 * 60 * 60;

    switch (period) {
      case "7d":
        return now - 7 * day;
      case "30d":
        return now - 30 * day;
      case "90d":
        return now - 90 * day;
      case "all":
        return 0;
      default:
        return now - 30 * day;
    }
  }

  // Find the earliest block number whose timestamp is >= targetTimestamp
  // Returns an object: { blockNumber, blockTimestamp }
  async findBlockByTimestamp(provider, targetTimestamp, latestBlockNumber) {
    if (targetTimestamp <= 0) {
      return { blockNumber: 0, blockTimestamp: 0 };
    }

    const latestBlock = await provider.getBlock(latestBlockNumber);
    if (!latestBlock) {
      return { blockNumber: 0, blockTimestamp: 0 };
    }

    // If target is after latest, clamp to latest
    if (targetTimestamp >= latestBlock.timestamp) {
      return { blockNumber: latestBlockNumber, blockTimestamp: latestBlock.timestamp };
    }

    let low = 0;
    let high = latestBlockNumber;
    let resultBlockNumber = 0;
    let resultTimestamp = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const block = await provider.getBlock(mid);
      if (!block) {
        // If the block can't be fetched, shrink the search window
        high = mid - 1;
        continue;
      }

      if (block.timestamp < targetTimestamp) {
        low = mid + 1;
      } else {
        resultBlockNumber = mid;
        resultTimestamp = block.timestamp;
        high = mid - 1;
      }
    }

    return { blockNumber: resultBlockNumber, blockTimestamp: resultTimestamp };
  }

  async generateAnalytics(gardenAddress) {
    console.log("\n📊 Garden Analytics Report");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Garden: ${gardenAddress}`);
    console.log(`Network: ${this.options.network}`);
    console.log(`Period: ${this.options.period}`);
    console.log(`Report Type: ${this.options.reportType}`);

    const { provider } = await setupProvider(this.options.network);
    const gardenContract = new ethers.Contract(gardenAddress, GARDEN_ABI, provider);

    // Get basic info
    const [name, description, location, communityToken] = await Promise.all([
      gardenContract.name(),
      gardenContract.description(),
      gardenContract.location(),
      gardenContract.communityToken(),
    ]);

    console.log(`\n📍 Garden: ${name}`);
    console.log(`  Location: ${location}`);

    const currentBlock = await provider.getBlockNumber();
    const startTimestamp = this.parsePeriod(this.options.period);

    let fromBlockInfo;
    if (this.options.period === "all") {
      fromBlockInfo = { blockNumber: 0, blockTimestamp: 0 };
    } else {
      fromBlockInfo = await this.findBlockByTimestamp(provider, startTimestamp, currentBlock);
    }
    const fromBlock = fromBlockInfo.blockNumber;

    console.log(`\n📦 Analyzing blocks ${Math.floor(fromBlock)} to ${currentBlock}`);

    // Fetch all events in the period
    let gardenerAddedEvents = [];
    let gardenerRemovedEvents = [];
    let operatorAddedEvents = [];
    let operatorRemovedEvents = [];
    let nameUpdatedEvents = [];
    let descriptionUpdatedEvents = [];

    try {
      [
        gardenerAddedEvents,
        gardenerRemovedEvents,
        operatorAddedEvents,
        operatorRemovedEvents,
        nameUpdatedEvents,
        descriptionUpdatedEvents,
      ] = await Promise.all([
        gardenContract.queryFilter("GardenerAdded", fromBlock, currentBlock),
        gardenContract.queryFilter("GardenerRemoved", fromBlock, currentBlock),
        gardenContract.queryFilter("GardenOperatorAdded", fromBlock, currentBlock),
        gardenContract.queryFilter("GardenOperatorRemoved", fromBlock, currentBlock),
        gardenContract.queryFilter("NameUpdated", fromBlock, currentBlock),
        gardenContract.queryFilter("DescriptionUpdated", fromBlock, currentBlock),
      ]);
    } catch (error) {
      console.warn("  ⚠️  Could not fetch all events:", error.message);
    }

    // Process member changes
    const memberActivity = {
      gardenersAdded: gardenerAddedEvents.length,
      gardenersRemoved: gardenerRemovedEvents.length,
      operatorsAdded: operatorAddedEvents.length,
      operatorsRemoved: operatorRemovedEvents.length,
      totalEvents:
        gardenerAddedEvents.length +
        gardenerRemovedEvents.length +
        operatorAddedEvents.length +
        operatorRemovedEvents.length +
        nameUpdatedEvents.length +
        descriptionUpdatedEvents.length,
    };

    // Get unique members from events
    const uniqueGardeners = new Set();
    const uniqueOperators = new Set();
    const activeUpdaters = new Set();

    gardenerAddedEvents.forEach((e) => {
      uniqueGardeners.add(e.args.gardener);
      activeUpdaters.add(e.args.updater);
    });
    gardenerRemovedEvents.forEach((e) => {
      activeUpdaters.add(e.args.updater);
    });
    operatorAddedEvents.forEach((e) => {
      uniqueOperators.add(e.args.operator);
      activeUpdaters.add(e.args.updater);
    });
    operatorRemovedEvents.forEach((e) => {
      activeUpdaters.add(e.args.updater);
    });

    // Build current member list
    const currentGardeners = new Set();
    const currentOperators = new Set();

    // Process events chronologically to get current state
    const allGardenerEvents = [
      ...gardenerAddedEvents.map((e) => ({ ...e, type: "add" })),
      ...gardenerRemovedEvents.map((e) => ({ ...e, type: "remove" })),
    ].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);

    for (const event of allGardenerEvents) {
      if (event.type === "add") {
        currentGardeners.add(event.args.gardener);
      } else {
        currentGardeners.delete(event.args.gardener);
      }
    }

    const allOperatorEvents = [
      ...operatorAddedEvents.map((e) => ({ ...e, type: "add" })),
      ...operatorRemovedEvents.map((e) => ({ ...e, type: "remove" })),
    ].sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);

    for (const event of allOperatorEvents) {
      if (event.type === "add") {
        currentOperators.add(event.args.operator);
      } else {
        currentOperators.delete(event.args.operator);
      }
    }

    // Calculate growth metrics
    const growthMetrics = {
      netGardenerGrowth: memberActivity.gardenersAdded - memberActivity.gardenersRemoved,
      netOperatorGrowth: memberActivity.operatorsAdded - memberActivity.operatorsRemoved,
      gardenerChurnRate:
        uniqueGardeners.size > 0
          ? ((memberActivity.gardenersRemoved / uniqueGardeners.size) * 100).toFixed(2) + "%"
          : "0%",
      operatorChurnRate:
        uniqueOperators.size > 0
          ? ((memberActivity.operatorsRemoved / uniqueOperators.size) * 100).toFixed(2) + "%"
          : "0%",
    };

    // Activity timeline (group by day)
    const activityByDay = {};
    const allEvents = [
      ...gardenerAddedEvents,
      ...gardenerRemovedEvents,
      ...operatorAddedEvents,
      ...operatorRemovedEvents,
      ...nameUpdatedEvents,
      ...descriptionUpdatedEvents,
    ];

    for (const event of allEvents) {
      const block = await provider.getBlock(event.blockNumber);
      const date = new Date(block.timestamp * 1000).toISOString().split("T")[0];
      activityByDay[date] = (activityByDay[date] || 0) + 1;
    }

    // Generate report based on type
    let report;
    switch (this.options.reportType) {
      case "summary":
        report = {
          garden: {
            address: gardenAddress,
            name,
            description: description.substring(0, 100) + (description.length > 100 ? "..." : ""),
            location,
            communityToken,
          },
          period: {
            type: this.options.period,
            fromBlock,
            toBlock: currentBlock,
            totalBlocks: currentBlock - fromBlock,
          },
          memberStats: {
            currentGardeners: currentGardeners.size,
            currentOperators: currentOperators.size,
            uniqueGardenersInPeriod: uniqueGardeners.size,
            uniqueOperatorsInPeriod: uniqueOperators.size,
            activeUpdaters: activeUpdaters.size,
          },
          activity: memberActivity,
          growth: growthMetrics,
          activityTimeline: activityByDay,
        };

        console.log("\n📈 Summary Report");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("\n👥 Current Members:");
        console.log(`  Gardeners: ${currentGardeners.size}`);
        console.log(`  Operators: ${currentOperators.size}`);

        console.log("\n📊 Period Activity:");
        console.log(`  Total events: ${memberActivity.totalEvents}`);
        console.log(`  Gardeners added: ${memberActivity.gardenersAdded}`);
        console.log(`  Gardeners removed: ${memberActivity.gardenersRemoved}`);
        console.log(`  Operators added: ${memberActivity.operatorsAdded}`);
        console.log(`  Operators removed: ${memberActivity.operatorsRemoved}`);

        console.log("\n📈 Growth Metrics:");
        console.log(
          `  Net gardener growth: ${growthMetrics.netGardenerGrowth >= 0 ? "+" : ""}${growthMetrics.netGardenerGrowth}`,
        );
        console.log(
          `  Net operator growth: ${growthMetrics.netOperatorGrowth >= 0 ? "+" : ""}${growthMetrics.netOperatorGrowth}`,
        );
        console.log(`  Gardener churn rate: ${growthMetrics.gardenerChurnRate}`);
        console.log(`  Operator churn rate: ${growthMetrics.operatorChurnRate}`);

        console.log("\n📅 Most Active Days:");
        {
          const sortedDays = Object.entries(activityByDay)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
          sortedDays.forEach(([date, count]) => {
            console.log(`  ${date}: ${count} events`);
          });
        }
        break;

      case "activity": {
        report = {
          garden: gardenAddress,
          period: this.options.period,
          events: allEvents.map((e) => ({
            type: e.event,
            block: e.blockNumber,
            transactionHash: e.transactionHash,
            args: e.args,
          })),
          dailyActivity: activityByDay,
          totalEvents: allEvents.length,
        };

        console.log("\n📊 Activity Report");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Total events: ${allEvents.length}`);
        console.log("\nDaily breakdown:");
        Object.entries(activityByDay).forEach(([date, count]) => {
          console.log(`  ${date}: ${count} events`);
        });
        break;
      }

      case "members": {
        const memberList = [];
        for (const address of currentGardeners) {
          memberList.push({
            address,
            isGardener: true,
            isOperator: currentOperators.has(address),
          });
        }
        for (const address of currentOperators) {
          if (!currentGardeners.has(address)) {
            memberList.push({
              address,
              isGardener: false,
              isOperator: true,
            });
          }
        }

        report = {
          garden: gardenAddress,
          totalMembers: memberList.length,
          totalGardeners: currentGardeners.size,
          totalOperators: currentOperators.size,
          members: memberList,
        };

        console.log("\n👥 Members Report");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`Total unique members: ${memberList.length}`);
        console.log(`Gardeners: ${currentGardeners.size}`);
        console.log(`Operators: ${currentOperators.size}`);

        console.log("\nTop 10 Members:");
        memberList.slice(0, 10).forEach((member) => {
          const roles = [];
          if (member.isGardener) roles.push("Gardener");
          if (member.isOperator) roles.push("Operator");
          console.log(`  ${formatAddress(member.address)}: ${roles.join(", ")}`);
        });
        break;
      }

      default:
        throw new Error(`Unknown report type: ${this.options.reportType}`);
    }

    // Export if requested
    if (this.options.export) {
      const filename = `garden-analytics-${this.options.reportType}-${Date.now()}.json`;
      exportToJSON(report, filename);
    }

    return report;
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
📊 Garden Analytics Tool

Usage: node garden-analytics.js --chain <network> --garden <address> [options]

Required:
  --chain <network>      Network to use
  --garden <address>     Garden contract address

Options:
  --report <type>        Report type: summary, activity, members (default: summary)
  --period <period>      Analysis period: 7d, 30d, 90d, all (default: 30d)
  --export              Export report to JSON file

Report Types:
  summary              Overall statistics and growth metrics
  activity             Detailed event activity timeline
  members              Current member list and roles

Examples:
  # Generate summary report for last 30 days
  node garden-analytics.js --chain arbitrum --garden 0x123... --report summary

  # Generate activity report for last 7 days
  node garden-analytics.js --chain arbitrum --garden 0x123... --report activity --period 7d

  # Export members report
  node garden-analytics.js --chain arbitrum --garden 0x123... --report members --export
    `);
    process.exit(0);
  }

  const options = {
    network: "localhost",
    period: "30d",
    reportType: "summary",
    export: false,
  };

  let gardenAddress;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--chain" || arg === "--network") {
      options.network = args[++i];
    } else if (arg === "--garden") {
      gardenAddress = args[++i];
    } else if (arg === "--report") {
      options.reportType = args[++i];
    } else if (arg === "--period") {
      options.period = args[++i];
    } else if (arg === "--export") {
      options.export = true;
    }
  }

  if (!gardenAddress || !ethers.isAddress(gardenAddress)) {
    console.error("❌ Valid --garden address required");
    process.exit(1);
  }

  const validReports = ["summary", "activity", "members"];
  if (!validReports.includes(options.reportType)) {
    console.error(`❌ Invalid report type. Must be one of: ${validReports.join(", ")}`);
    process.exit(1);
  }

  const validPeriods = ["7d", "30d", "90d", "all"];
  if (!validPeriods.includes(options.period)) {
    console.error(`❌ Invalid period. Must be one of: ${validPeriods.join(", ")}`);
    process.exit(1);
  }

  try {
    const analytics = new GardenAnalytics(options);
    await analytics.generateAnalytics(gardenAddress);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { GardenAnalytics };
