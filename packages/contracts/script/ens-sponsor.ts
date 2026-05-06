#!/usr/bin/env bun

import path from "node:path";
import dotenv from "dotenv";
import { type Address, isAddress } from "viem";
import {
  DEFAULT_ENS_SPONSOR_MIN_CLAIMS,
  DEFAULT_ENS_SPONSOR_SAMPLE_SLUG,
  DEFAULT_ENS_SPONSOR_TOP_UP,
  formatENSSponsorStatus,
  getENSSponsorStatus,
  sendENSSponsorTopUp,
} from "./utils/ens-sponsor";

dotenv.config({ path: path.join(__dirname, "../../../", ".env") });

type Command = "status" | "monitor" | "top-up";

interface Options {
  network: string;
  broadcast: boolean;
  amount?: string;
  account?: string;
  minSponsoredClaims: number;
  sampleSlug: string;
  sampleOwner?: Address;
}

function showHelp(): void {
  console.log(`
Green Goods ENS Sponsor Operations

Usage:
  bun script/ens-sponsor.ts status --network arbitrum
  bun script/ens-sponsor.ts monitor --network arbitrum
  bun script/ens-sponsor.ts top-up --network arbitrum --amount ${DEFAULT_ENS_SPONSOR_TOP_UP} --broadcast

Commands:
  status       Print current sponsor balance, fee estimates, and covered actions
  monitor      Same as status, but exits non-zero when the sponsor balance is below target
  top-up       Send ETH to GreenGoodsENS from the Foundry deployer keystore

Options:
  --network <name>               Network to inspect or fund (default: arbitrum)
  --amount <value>               Top-up amount, e.g. 0.05ether, 0.05eth, 50000000000000000wei
  --account <keystore>           Foundry keystore name (default: FOUNDRY_KEYSTORE_ACCOUNT or green-goods-deployer)
  --min-sponsored-claims <count> Minimum sponsored actions to keep funded (default: ${DEFAULT_ENS_SPONSOR_MIN_CLAIMS})
  --sample-slug <slug>           Slug used for CCIP fee estimation (default: ${DEFAULT_ENS_SPONSOR_SAMPLE_SLUG})
  --sample-owner <address>       Owner used for registration fee estimation
  --broadcast                    Required for top-up
  --help                         Show this help
`);
}

function parseCommand(args: string[]): Command {
  const command = args[0] ?? "status";
  if (command === "status" || command === "monitor" || command === "top-up") {
    return command;
  }
  throw new Error(`Unknown command: ${command}`);
}

function parseOptions(args: string[]): Options {
  let network = "arbitrum";
  let broadcast = false;
  let amount: string | undefined;
  let account: string | undefined;
  let minSponsoredClaims = DEFAULT_ENS_SPONSOR_MIN_CLAIMS;
  let sampleSlug = DEFAULT_ENS_SPONSOR_SAMPLE_SLUG;
  let sampleOwner: Address | undefined;

  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--network": {
        const value = args[i + 1];
        if (!value || value.startsWith("-")) throw new Error("--network requires a value");
        network = value;
        i += 1;
        break;
      }
      case "--amount": {
        const value = args[i + 1];
        if (!value || value.startsWith("-")) throw new Error("--amount requires a value");
        amount = value;
        i += 1;
        break;
      }
      case "--account": {
        const value = args[i + 1];
        if (!value || value.startsWith("-")) throw new Error("--account requires a keystore name");
        account = value;
        i += 1;
        break;
      }
      case "--min-sponsored-claims": {
        const value = args[i + 1];
        if (!value || value.startsWith("-")) throw new Error("--min-sponsored-claims requires a value");
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          throw new Error("--min-sponsored-claims must be a positive integer");
        }
        minSponsoredClaims = parsed;
        i += 1;
        break;
      }
      case "--sample-slug": {
        const value = args[i + 1];
        if (!value || value.startsWith("-")) throw new Error("--sample-slug requires a value");
        sampleSlug = value;
        i += 1;
        break;
      }
      case "--sample-owner": {
        const value = args[i + 1];
        if (!value || value.startsWith("-")) throw new Error("--sample-owner requires an address");
        if (!isAddress(value)) throw new Error(`Invalid --sample-owner address: ${value}`);
        sampleOwner = value;
        i += 1;
        break;
      }
      case "--broadcast":
        broadcast = true;
        break;
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
        throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }

  return {
    network,
    broadcast,
    amount,
    account,
    minSponsoredClaims,
    sampleSlug,
    sampleOwner,
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    return;
  }

  const command = parseCommand(args);
  const options = parseOptions(args);

  if (command === "top-up") {
    if (!options.broadcast) {
      throw new Error("top-up requires --broadcast so funding cannot happen accidentally");
    }

    sendENSSponsorTopUp({
      network: options.network,
      amount: options.amount,
      account: options.account,
    });
  }

  const status = await getENSSponsorStatus({
    network: options.network,
    minSponsoredClaims: options.minSponsoredClaims,
    sampleSlug: options.sampleSlug,
    sampleOwner: options.sampleOwner,
  });
  console.log(formatENSSponsorStatus(status));

  if (command === "monitor" && !status.healthy) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`ENS sponsor command failed: ${message}`);
  process.exit(1);
});
