#!/usr/bin/env bun

import { spawnSync } from "node:child_process";
import path from "node:path";
import { config as loadDotenv } from "dotenv";

const NO_MATCH_TEST = ".*[cC]elo.*|.*[uU]nlock.*";
const DEFAULT_THREADS = "1";
const DEFAULT_VERBOSITY = "-vvv";
const DEFAULTS = {
  ARBITRUM_RPC_URL: "https://arbitrum-one.public.blastapi.io",
  ARBITRUM_FORK_BLOCK_NUMBER: "466388412",
  SEPOLIA_RPC_URL: "https://sepolia.drpc.org",
  SEPOLIA_FORK_BLOCK_NUMBER: "10917257",
  ETHEREUM_RPC_URL: "https://ethereum-rpc.publicnode.com",
  ETHEREUM_FORK_BLOCK_NUMBER: "25170563",
};

const SHARDS = {
  arbitrum: {
    description: "Arbitrum core, ENS, Gardens module, EAS, Hypercerts, Karma GAP, and full-protocol fork coverage",
    glob:
      "test/fork/{ArbitrumActionRegistry,ArbitrumConvictionVoting,ArbitrumENS,ArbitrumGardenAccount,ArbitrumGardenAccountConfig,ArbitrumGardenAccountMembership,ArbitrumGardenAccountMetadata,ArbitrumGardenToken,ArbitrumGardensModule,ArbitrumGardensNegativePaths,ArbitrumGoodsToken,ArbitrumHats,ArbitrumHypercerts,ArbitrumKarmaGAP,ArbitrumLiveGardenSignalPoolRepair,ArbitrumMultiGardenIsolation,ArbitrumNegativePaths,ArbitrumRoleRevocation,e2e/ArbitrumFullProtocolE2E,eas/ArbitrumEASAttestationLifecycle}.t.sol",
  },
  sepolia: {
    description: "Sepolia protocol, EAS, ENS, Karma GAP, CookieJar, and full-protocol fork coverage",
    glob:
      "test/fork/{SepoliaActionRegistry,SepoliaConvictionVoting,SepoliaCookieJar,SepoliaENS,SepoliaGardenAccount,SepoliaGardenAccountConfig,SepoliaGardenAccountMembership,SepoliaGardenAccountMetadata,SepoliaGardenToken,SepoliaGardensModule,SepoliaGoodsToken,SepoliaHats,SepoliaKarmaGAP,SepoliaNegativePaths,e2e/FullProtocolE2E,e2e/SepoliaExtendedE2E,eas/EASAttestationLifecycle}.t.sol",
  },
  ethereum: {
    description: "Ethereum mainnet ENS receiver, NameWrapper, and cross-chain ENS fork coverage",
    glob: "test/fork/{CrossChainENS,EthereumENSNameWrapper,EthereumENSReceiver}.t.sol",
  },
  gardens: {
    description: "Mixed-chain Gardens V2 community governance and deployment registry fork coverage",
    glob: "test/fork/{DeploymentRegistryFork,gardens/GardensCommunityGovernance,gardens/GardensV2Community}.t.sol",
  },
  octant: {
    description: "Arbitrum Octant, Aave strategy, vault, yield splitter, CookieJar, and GreenWill readiness coverage",
    glob:
      "test/fork/{ArbitrumAaveStrategy,ArbitrumCookieJar,ArbitrumGreenWillSupport,ArbitrumOctantVault,ArbitrumVaultYieldE2E,ArbitrumYieldSplitterCore,e2e/ArbitrumExtendedE2E}.t.sol",
    extraRuns: [
      {
        profile: "e2e",
        glob: "test/fork/e2e/ArbitrumExtendedE2E.t.sol",
        matchTest:
          "testForkArbitrum_e2e_(octantVaultCreatedOnGardenMint|fullYieldPipelineWithRealAaveAndSplit|hypercertPoolReadiness_requiresYieldReadablePool)",
        description: "Octant readiness smoke under the e2e profile",
      },
    ],
  },
};

const SHARD_ORDER = ["arbitrum", "sepolia", "ethereum", "gardens", "octant"];

function loadEnv() {
  loadDotenv({ path: path.resolve(process.cwd(), "../../.env"), override: false, quiet: true });
  loadDotenv({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });
}

function forgeEnv(profile = "fork") {
  const env = { ...process.env, FOUNDRY_PROFILE: profile };

  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!env[key]) env[key] = value;
  }

  env.ARBITRUM_FORK_RPC_URL ||= env.ARBITRUM_RPC_URL;
  env.SEPOLIA_FORK_RPC_URL ||= env.SEPOLIA_RPC_URL;
  env.ETHEREUM_FORK_RPC_URL ||= env.ETHEREUM_RPC_URL;
  env.MAINNET_RPC_URL ||= env.ETHEREUM_RPC_URL;

  return env;
}

function runForge(args, { profile = "fork", capture = false } = {}) {
  const result = spawnSync("forge", args, {
    env: forgeEnv(profile),
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  });

  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result.stdout ?? "";
}

function commonArgs() {
  const verbosity = process.env.FORK_TEST_VERBOSITY || DEFAULT_VERBOSITY;
  const args = [
    "--no-match-test",
    NO_MATCH_TEST,
    "--threads",
    process.env.FORK_TEST_THREADS || DEFAULT_THREADS,
    "--suppress-successful-traces",
  ];
  if (verbosity) args.push(verbosity);
  return args;
}

function runShard(name) {
  const shard = SHARDS[name];
  if (!shard) {
    console.error(`Unknown fork shard: ${name}`);
    usage(1);
  }

  console.log(`[fork-shard] ${name}: ${shard.description}`);
  console.log(`[fork-shard] match-path: ${shard.glob}`);
  runForge(["test", "--match-path", shard.glob, ...commonArgs()]);

  for (const extraRun of shard.extraRuns || []) {
    console.log(`[fork-shard] ${name}: ${extraRun.description}`);
    const args = ["test", "--match-path", extraRun.glob, "--match-test", extraRun.matchTest, ...commonArgs()];
    runForge(args, { profile: extraRun.profile });
  }
}

function listShard(name) {
  const shard = SHARDS[name];
  if (!shard) {
    console.error(`Unknown fork shard: ${name}`);
    usage(1);
  }
  return listTests(shard.glob);
}

function listTests(glob) {
  const stdout = runForge(
    ["test", "--list", "--json", "--match-path", glob, "--no-match-test", NO_MATCH_TEST],
    { capture: true },
  );
  return JSON.parse(stdout.trim() || "{}");
}

function flattenTests(listing) {
  const ids = [];
  for (const [file, contracts] of Object.entries(listing)) {
    for (const [contractName, tests] of Object.entries(contracts)) {
      for (const testName of tests) {
        ids.push(`${file}::${contractName}::${testName}`);
      }
    }
  }
  return ids.sort();
}

function checkCoverage() {
  const baseline = flattenTests(listTests("test/fork/**"));
  const baselineSet = new Set(baseline);
  const seen = new Map();
  const counts = [];

  for (const shardName of SHARD_ORDER) {
    const shardTests = flattenTests(listShard(shardName));
    counts.push(`${shardName}=${shardTests.length}`);
    for (const id of shardTests) {
      const owners = seen.get(id) || [];
      owners.push(shardName);
      seen.set(id, owners);
    }
  }

  const union = new Set(seen.keys());
  const missing = baseline.filter((id) => !union.has(id));
  const extra = [...union].filter((id) => !baselineSet.has(id)).sort();
  const duplicates = [...seen.entries()].filter(([, owners]) => owners.length > 1);

  console.log(`[fork-shards] baseline=${baseline.length} ${counts.join(" ")} union=${union.size}`);

  if (missing.length || extra.length || duplicates.length) {
    if (missing.length) {
      console.error(`[fork-shards] missing tests (${missing.length}):`);
      for (const id of missing) console.error(`  - ${id}`);
    }
    if (extra.length) {
      console.error(`[fork-shards] extra tests (${extra.length}):`);
      for (const id of extra) console.error(`  - ${id}`);
    }
    if (duplicates.length) {
      console.error(`[fork-shards] duplicate tests (${duplicates.length}):`);
      for (const [id, owners] of duplicates) console.error(`  - ${id} (${owners.join(", ")})`);
    }
    process.exit(1);
  }

  console.log("[fork-shards] shard coverage matches the former fork protocol suite");
}

function printManifest() {
  for (const name of SHARD_ORDER) {
    console.log(`${name}: ${SHARDS[name].glob}`);
  }
}

function usage(exitCode = 0) {
  console.log("Usage: bun script/utils/fork-shards.mjs <run|check|manifest> [shard|all]");
  console.log(`Shards: ${SHARD_ORDER.join(", ")}`);
  process.exit(exitCode);
}

loadEnv();

const command = process.argv[2];
const target = process.argv[3] || "all";

if (command === "run") {
  const shardNames = target === "all" ? SHARD_ORDER : [target];
  for (const name of shardNames) runShard(name);
} else if (command === "check") {
  checkCoverage();
} else if (command === "manifest") {
  printManifest();
} else {
  usage(command ? 1 : 0);
}
