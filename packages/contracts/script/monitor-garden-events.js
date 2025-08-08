#!/usr/bin/env node

require("dotenv").config();
const { ethers } = require("ethers");
const { GARDEN_ABI, setupProvider, formatAddress, sleep } = require("./utils/garden-utils");

class GardenEventMonitor {
  constructor(options = {}) {
    this.options = {
      network: "localhost",
      fromBlock: "latest",
      pollInterval: 5000, // 5 seconds
      events: ["all"], // or specific events
      ...options,
    };
    this.running = false;
  }

  getEventFilters(_gardenContract) {
    const allEvents = [
      "NameUpdated",
      "DescriptionUpdated",
      "GardenerAdded",
      "GardenerRemoved",
      "GardenOperatorAdded",
      "GardenOperatorRemoved",
    ];

    const eventsToMonitor = this.options.events[0] === "all" ? allEvents : this.options.events;

    // In ethers v6, we use event names directly instead of filter methods
    return eventsToMonitor.filter((e) => allEvents.includes(e));
  }

  formatEvent(eventName, event) {
    const timestamp = new Date().toISOString();
    const block = event.blockNumber;
    const txHash = event.transactionHash;

    let details = "";
    switch (eventName) {
      case "NameUpdated":
        details = `New name: "${event.args.newName}"`;
        break;
      case "DescriptionUpdated":
        details = `New description: "${event.args.newDescription.substring(0, 50)}..."`;
        break;
      case "GardenerAdded":
        details = `Gardener added: ${formatAddress(event.args.gardener)} by ${formatAddress(event.args.updater)}`;
        break;
      case "GardenerRemoved":
        details = `Gardener removed: ${formatAddress(event.args.gardener)} by ${formatAddress(event.args.updater)}`;
        break;
      case "GardenOperatorAdded":
        details = `Operator added: ${formatAddress(event.args.operator)} by ${formatAddress(event.args.updater)}`;
        break;
      case "GardenOperatorRemoved":
        details = `Operator removed: ${formatAddress(event.args.operator)} by ${formatAddress(event.args.updater)}`;
        break;
      default:
        details = JSON.stringify(event.args);
    }

    return {
      timestamp,
      block,
      txHash,
      event: eventName,
      details,
    };
  }

  async monitorRealtime(gardenAddress) {
    console.log("\n🏡 Garden Event Monitor - Real-time Mode");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Garden: ${gardenAddress}`);
    console.log(`Network: ${this.options.network}`);
    console.log(`Events: ${this.options.events.join(", ")}`);
    console.log("\n⏳ Listening for events... (Press Ctrl+C to stop)\n");

    const { provider } = await setupProvider(this.options.network);
    const gardenContract = new ethers.Contract(gardenAddress, GARDEN_ABI, provider);

    // Verify connection
    try {
      const name = await gardenContract.name();
      console.log(`📍 Connected to: ${name}`);
    } catch (error) {
      throw new Error(`Failed to connect to garden: ${error.message}`);
    }

    const eventNames = this.getEventFilters(gardenContract);

    // Set up listeners for each event
    for (const eventName of eventNames) {
      gardenContract.on(eventName, (...args) => {
        const event = args[args.length - 1]; // Last argument is the event object
        const formatted = this.formatEvent(eventName, event);

        console.log("\n🔔 New Event Detected!");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`📅 Time: ${formatted.timestamp}`);
        console.log(`📦 Block: ${formatted.block}`);
        console.log(`🏷️  Event: ${formatted.event}`);
        console.log(`📝 Details: ${formatted.details}`);
        console.log(`🔗 TX: ${formatted.txHash}`);
      });
    }

    // Keep the process running
    this.running = true;
    while (this.running) {
      await sleep(this.options.pollInterval);
    }
  }

  async scanHistorical(gardenAddress) {
    console.log("\n🏡 Garden Event Monitor - Historical Scan");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`Garden: ${gardenAddress}`);
    console.log(`Network: ${this.options.network}`);
    console.log(`Events: ${this.options.events.join(", ")}`);

    const { provider } = await setupProvider(this.options.network);
    const gardenContract = new ethers.Contract(gardenAddress, GARDEN_ABI, provider);

    // Verify connection
    try {
      const name = await gardenContract.name();
      console.log(`📍 Garden: ${name}`);
    } catch (error) {
      throw new Error(`Failed to connect to garden: ${error.message}`);
    }

    const currentBlock = await provider.getBlockNumber();
    const fromBlock = this.options.fromBlock === "latest" ? currentBlock : Number.parseInt(this.options.fromBlock);
    const toBlock = this.options.toBlock || currentBlock;

    console.log(`📦 Scanning blocks ${fromBlock} to ${toBlock}...\n`);

    const eventNames = this.getEventFilters(gardenContract);
    const allEvents = [];

    // Query historical events
    for (const eventName of eventNames) {
      try {
        const events = await gardenContract.queryFilter(eventName, fromBlock, toBlock);
        for (const event of events) {
          const formatted = this.formatEvent(eventName, event);
          allEvents.push(formatted);
        }
      } catch (error) {
        console.warn(`⚠️  Could not fetch ${eventName} events: ${error.message}`);
      }
    }

    // Sort by block number
    allEvents.sort((a, b) => a.block - b.block);

    if (allEvents.length === 0) {
      console.log("ℹ️  No events found in the specified range");
    } else {
      console.log(`Found ${allEvents.length} event(s):\n`);

      for (const event of allEvents) {
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log(`📦 Block ${event.block}`);
        console.log(`🏷️  ${event.event}`);
        console.log(`📝 ${event.details}`);
        console.log(`🔗 ${event.txHash.substring(0, 10)}...`);
      }
    }

    return allEvents;
  }

  stop() {
    this.running = false;
  }
}

// CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
🏡 Garden Event Monitor

Usage: node monitor-garden-events.js --chain <network> --garden <address> [options]

Required:
  --chain <network>      Network to use
  --garden <address>     Garden contract address

Modes:
  --realtime            Monitor events in real-time (default)
  --historical          Scan historical events

Options:
  --events <list>       Events to monitor (comma-separated) or "all" (default: all)
                        Available: NameUpdated, DescriptionUpdated, GardenerAdded, 
                                  GardenerRemoved, GardenOperatorAdded, GardenOperatorRemoved
  --from-block <n>      Starting block for scan (default: latest)
  --to-block <n>        Ending block for scan (default: latest)
  --poll-interval <ms>  Polling interval in milliseconds (default: 5000)

Examples:
  # Monitor all events in real-time
  node monitor-garden-events.js --chain arbitrum --garden 0x123... --realtime

  # Monitor specific events
  node monitor-garden-events.js --chain arbitrum --garden 0x123... --events GardenerAdded,GardenerRemoved

  # Scan historical events
  node monitor-garden-events.js --chain arbitrum --garden 0x123... --historical --from-block 1000000 --to-block 1100000
    `);
    process.exit(0);
  }

  const options = {
    network: "localhost",
    fromBlock: "latest",
    pollInterval: 5000,
    events: ["all"],
  };

  let gardenAddress;
  let mode = "realtime"; // default mode

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--chain" || arg === "--network") {
      options.network = args[++i];
    } else if (arg === "--garden") {
      gardenAddress = args[++i];
    } else if (arg === "--realtime") {
      mode = "realtime";
    } else if (arg === "--historical") {
      mode = "historical";
    } else if (arg === "--events") {
      options.events = args[++i].split(",").map((e) => e.trim());
    } else if (arg === "--from-block") {
      options.fromBlock = args[++i];
    } else if (arg === "--to-block") {
      options.toBlock = args[++i];
    } else if (arg === "--poll-interval") {
      options.pollInterval = Number.parseInt(args[++i]);
    }
  }

  if (!gardenAddress || !ethers.isAddress(gardenAddress)) {
    console.error("❌ Valid --garden address required");
    process.exit(1);
  }

  const monitor = new GardenEventMonitor(options);

  // Handle graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n\n👋 Stopping monitor...");
    monitor.stop();
    process.exit(0);
  });

  try {
    if (mode === "realtime") {
      await monitor.monitorRealtime(gardenAddress);
    } else {
      await monitor.scanHistorical(gardenAddress);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { GardenEventMonitor };
