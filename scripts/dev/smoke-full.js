#!/usr/bin/env node

/**
 * Read-only smoke check for the default full-local Green Goods stack.
 *
 * This validates browser surfaces, the local agent, local Envio/Hasura/Postgres,
 * and the local Arbitrum Anvil fork. It never submits transactions.
 */

import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requestUrl, reexecUnderSystemNodeIfNeeded } from "../lib/dev-shared.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

reexecUnderSystemNodeIfNeeded({
  scriptPath: __filename,
  sentinel: "GREEN_GOODS_FULL_SMOKE_NODE_REEXEC",
  cwd: projectRoot,
});

const ARBITRUM_CHAIN_ID = 42161;
const LOCAL_RPC_URL = "http://127.0.0.1:3009";
const LOCAL_AGENT_HEALTH_URL = "http://127.0.0.1:3005/health";
const LOCAL_INDEXER_URL = "http://127.0.0.1:3006/v1/graphql";
const LOCAL_INDEXER_SERVICE_HEALTH_URL = "http://127.0.0.1:3007/healthz";
const LOCAL_POSTGRES_HOST = "127.0.0.1";
const LOCAL_POSTGRES_PORT = 3008;
const DEFAULT_MAX_INDEXER_LAG_BLOCKS = 2_000;

const services = [
  {
    name: "client-pwa",
    port: 3001,
    urls: ["https://localhost:3001/?presentation=pwa", "http://localhost:3001/?presentation=pwa"],
  },
  {
    name: "client-editorial",
    port: 3001,
    urls: [
      "https://localhost:3001/?presentation=website",
      "http://localhost:3001/?presentation=website",
    ],
  },
  {
    name: "admin",
    port: 3002,
    urls: ["https://localhost:3002", "http://localhost:3002"],
  },
  {
    name: "docs",
    port: 3003,
    urls: ["http://localhost:3003", "https://localhost:3003"],
  },
  {
    name: "storybook",
    port: 3004,
    urls: ["http://localhost:3004"],
  },
];

function usage(exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(
    [
      "Usage: node scripts/dev/smoke-full.js [--json] [--timeout seconds]",
      "",
      "Options:",
      `  --max-indexer-lag-blocks <blocks>  Maximum accepted local indexer lag (default: ${DEFAULT_MAX_INDEXER_LAG_BLOCKS})`,
      "",
    ].join("\n")
  );
  process.exit(exitCode);
}

function parseArgs(argv) {
  const options = {
    json: false,
    timeoutMs: 60_000,
    maxIndexerLagBlocks: DEFAULT_MAX_INDEXER_LAG_BLOCKS,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") usage(0);
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--timeout") {
      const seconds = Number.parseInt(argv[++index] || "", 10);
      if (!Number.isFinite(seconds) || seconds <= 0) usage(1);
      options.timeoutMs = seconds * 1000;
      continue;
    }
    if (arg.startsWith("--timeout=")) {
      const seconds = Number.parseInt(arg.slice("--timeout=".length), 10);
      if (!Number.isFinite(seconds) || seconds <= 0) usage(1);
      options.timeoutMs = seconds * 1000;
      continue;
    }
    if (arg === "--max-indexer-lag-blocks" || arg === "--max-indexer-lag") {
      const blocks = Number.parseInt(argv[++index] || "", 10);
      if (!Number.isFinite(blocks) || blocks < 0) usage(1);
      options.maxIndexerLagBlocks = blocks;
      continue;
    }
    if (arg.startsWith("--max-indexer-lag-blocks=")) {
      const blocks = Number.parseInt(arg.slice("--max-indexer-lag-blocks=".length), 10);
      if (!Number.isFinite(blocks) || blocks < 0) usage(1);
      options.maxIndexerLagBlocks = blocks;
      continue;
    }
    if (arg.startsWith("--max-indexer-lag=")) {
      const blocks = Number.parseInt(arg.slice("--max-indexer-lag=".length), 10);
      if (!Number.isFinite(blocks) || blocks < 0) usage(1);
      options.maxIndexerLagBlocks = blocks;
      continue;
    }

    process.stderr.write(`Unknown option: ${arg}\n`);
    usage(1);
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));

async function waitForService(service, deadlineMs) {
  const attempts = [];

  while (Date.now() < deadlineMs) {
    for (const url of service.urls) {
      const attempt = await requestUrl(url, 2500);
      attempts.push(attempt);
      if (attempt.ok) {
        return {
          name: service.name,
          port: service.port,
          level: "pass",
          ready: true,
          url: attempt.url,
          statusCode: attempt.statusCode,
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return {
    name: service.name,
    port: service.port,
    level: "fail",
    ready: false,
    detail: `No response on port ${service.port}.`,
    attempts: attempts.slice(-service.urls.length).map((attempt) => ({
      url: attempt.url,
      error: attempt.error || `HTTP ${attempt.statusCode}`,
    })),
  };
}

async function postJson(url, body, timeoutMs = 12_000) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // Preserve the HTTP status/body preview in the caller error.
  }
  return { response, payload, text };
}

async function rpc(method, params = []) {
  const { response, payload, text } = await postJson(LOCAL_RPC_URL, {
    jsonrpc: "2.0",
    id: 1,
    method,
    params,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
  }
  if (payload?.error) {
    throw new Error(`RPC ${payload.error.code}: ${payload.error.message}`);
  }
  if (payload?.result === undefined) {
    throw new Error(`${method} returned no result`);
  }
  return payload.result;
}

function deploymentAddresses() {
  const deploymentPath = path.join(
    projectRoot,
    "packages/contracts/deployments/42161-latest.json"
  );
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  return ["gardenToken", "actionRegistry", "deploymentRegistry", "workResolver"]
    .map((key) => ({ key, address: deployment[key] }))
    .filter((item) => /^0x[a-fA-F0-9]{40}$/.test(item.address));
}

async function checkLocalAgent() {
  try {
    const response = await fetch(LOCAL_AGENT_HEALTH_URL, {
      signal: AbortSignal.timeout(5_000),
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
    if (payload.status && payload.status !== "ok") throw new Error(`status=${payload.status}`);

    return {
      name: "local-agent-health",
      level: "pass",
      ready: true,
      detail: payload?.services?.ai
        ? `status=${payload.status || "ok"}; ai=${payload.services.ai}`
        : `HTTP ${response.status}`,
      url: LOCAL_AGENT_HEALTH_URL,
    };
  } catch (error) {
    return {
      name: "local-agent-health",
      level: "fail",
      ready: false,
      detail: error instanceof Error ? error.message : String(error),
      url: LOCAL_AGENT_HEALTH_URL,
    };
  }
}

async function checkAnvilChain() {
  try {
    const result = await rpc("eth_chainId");
    const chainId = typeof result === "string" ? Number.parseInt(result, 16) : Number(result);
    if (chainId !== ARBITRUM_CHAIN_ID) {
      throw new Error(`expected ${ARBITRUM_CHAIN_ID}, got ${chainId || "unknown"}`);
    }
    return {
      name: "anvil-arbitrum-chain",
      level: "pass",
      ready: true,
      detail: `eth_chainId=${chainId}`,
      url: LOCAL_RPC_URL,
    };
  } catch (error) {
    return {
      name: "anvil-arbitrum-chain",
      level: "fail",
      ready: false,
      detail: error instanceof Error ? error.message : String(error),
      url: LOCAL_RPC_URL,
    };
  }
}

async function checkAnvilContractBytecode() {
  const candidates = deploymentAddresses();

  for (const candidate of candidates) {
    try {
      const code = await rpc("eth_getCode", [candidate.address, "latest"]);
      if (typeof code === "string" && code !== "0x") {
        return {
          name: "anvil-contract-bytecode",
          level: "pass",
          ready: true,
          detail: `${candidate.key} has bytecode at ${candidate.address}`,
          url: LOCAL_RPC_URL,
        };
      }
    } catch (error) {
      return {
        name: "anvil-contract-bytecode",
        level: "fail",
        ready: false,
        detail: error instanceof Error ? error.message : String(error),
        url: LOCAL_RPC_URL,
      };
    }
  }

  return {
    name: "anvil-contract-bytecode",
    level: "fail",
    ready: false,
    detail: "No checked Arbitrum deployment address returned bytecode on the local fork.",
    url: LOCAL_RPC_URL,
  };
}

async function checkAnvilFundedWallet() {
  try {
    const accounts = await rpc("eth_accounts");
    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error("eth_accounts returned no local Anvil accounts");
    }

    const balanceHex = await rpc("eth_getBalance", [accounts[0], "latest"]);
    const balance = BigInt(balanceHex);
    if (balance <= 0n) {
      throw new Error(`${accounts[0]} has zero balance`);
    }

    return {
      name: "anvil-funded-wallet",
      level: "pass",
      ready: true,
      detail: `${accounts.length} account(s); first account funded`,
      url: LOCAL_RPC_URL,
    };
  } catch (error) {
    return {
      name: "anvil-funded-wallet",
      level: "fail",
      ready: false,
      detail: error instanceof Error ? error.message : String(error),
      url: LOCAL_RPC_URL,
    };
  }
}

async function checkLocalIndexerGraphql() {
  try {
    const { response, payload, text } = await postJson(LOCAL_INDEXER_URL, {
      query:
        "query GreenGoodsFullLocalSmoke { envio_chains { id progress_block source_block events_processed ready_at } }",
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
    if (payload?.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }

    const rows = payload?.data?.envio_chains;
    if (!Array.isArray(rows)) throw new Error("envio_chains was not returned as an array");
    const chainRow = rows.find((row) => Number(row.id) === ARBITRUM_CHAIN_ID);
    if (!chainRow) {
      throw new Error(`envio_chains returned ${rows.length} row(s), none for ${ARBITRUM_CHAIN_ID}`);
    }

    const progressBlock = Number(chainRow.progress_block);
    const sourceBlock = Number(chainRow.source_block);
    const eventsProcessed = Number(chainRow.events_processed);
    if (!Number.isFinite(progressBlock) || progressBlock <= 0) {
      throw new Error(`progress_block is not a positive number: ${chainRow.progress_block}`);
    }

    return {
      name: "local-indexer-graphql",
      level: "pass",
      ready: true,
      detail: `chain_id=${ARBITRUM_CHAIN_ID}; progress_block=${progressBlock}; source_block=${sourceBlock}; events_processed=${eventsProcessed}`,
      url: LOCAL_INDEXER_URL,
      progressBlock,
      sourceBlock,
    };
  } catch (error) {
    return {
      name: "local-indexer-graphql",
      level: "fail",
      ready: false,
      detail: error instanceof Error ? error.message : String(error),
      url: LOCAL_INDEXER_URL,
    };
  }
}

function checkIndexerLag(indexerResult) {
  if (
    typeof indexerResult.progressBlock !== "number" ||
    typeof indexerResult.sourceBlock !== "number" ||
    !Number.isFinite(indexerResult.progressBlock) ||
    !Number.isFinite(indexerResult.sourceBlock)
  ) {
    return {
      name: "local-indexer-lag",
      level: "skipped",
      ready: true,
      detail: "Local indexer did not return progress/source blocks; lag proof skipped.",
    };
  }

  const lagBlocks = Math.max(0, indexerResult.sourceBlock - indexerResult.progressBlock);
  if (lagBlocks > options.maxIndexerLagBlocks) {
    return {
      name: "local-indexer-lag",
      level: "fail",
      ready: false,
      detail: `lag=${lagBlocks} blocks exceeds max=${options.maxIndexerLagBlocks}; source=${indexerResult.sourceBlock}; indexed=${indexerResult.progressBlock}`,
    };
  }

  return {
    name: "local-indexer-lag",
    level: "pass",
    ready: true,
    detail: `lag=${lagBlocks} blocks; source=${indexerResult.sourceBlock}; indexed=${indexerResult.progressBlock}; max=${options.maxIndexerLagBlocks}`,
  };
}

async function checkLocalIndexerService() {
  const attempt = await requestUrl(LOCAL_INDEXER_SERVICE_HEALTH_URL, 5000);
  if (attempt.ok) {
    return {
      name: "local-indexer-service",
      level: "pass",
      ready: true,
      url: attempt.url,
      statusCode: attempt.statusCode,
    };
  }

  return {
    name: "local-indexer-service",
    level: "fail",
    ready: false,
    url: attempt.url,
    detail: attempt.error || `HTTP ${attempt.statusCode}`,
  };
}

function checkPostgresTcp() {
  return new Promise((resolve) => {
    const socket = net.createConnection(
      { host: LOCAL_POSTGRES_HOST, port: LOCAL_POSTGRES_PORT, timeout: 5000 },
      () => {
        socket.end();
        resolve({
          name: "local-indexer-postgres",
          level: "pass",
          ready: true,
          detail: "TCP listener accepted a connection.",
          url: `${LOCAL_POSTGRES_HOST}:${LOCAL_POSTGRES_PORT}`,
        });
      }
    );
    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        name: "local-indexer-postgres",
        level: "fail",
        ready: false,
        detail: "Timed out connecting to Postgres TCP listener.",
        url: `${LOCAL_POSTGRES_HOST}:${LOCAL_POSTGRES_PORT}`,
      });
    });
    socket.on("error", (error) => {
      resolve({
        name: "local-indexer-postgres",
        level: "fail",
        ready: false,
        detail: error.code || error.message,
        url: `${LOCAL_POSTGRES_HOST}:${LOCAL_POSTGRES_PORT}`,
      });
    });
  });
}

function printText(payload) {
  console.log("\nGreen Goods Full Local Smoke\n");
  console.log("Mutation policy: read-only smoke; no transactions are submitted.\n");

  for (const result of payload.results) {
    const mark = result.ready ? (result.level === "skipped" ? "SKIP" : "PASS") : "FAIL";
    console.log(`[${mark}] ${result.name}`);
    if (result.detail) console.log(`       ${result.detail}`);
    if (result.url) console.log(`       ${result.url}`);
  }

  if (payload.summary.ready) {
    console.log("\nFull local smoke passed.");
  } else {
    console.log(`\n${payload.summary.failures} full local smoke check(s) failed.`);
  }
}

const serviceResults = await Promise.all(
  services.map((service) => waitForService(service, Date.now() + options.timeoutMs))
);
const agentResult = await checkLocalAgent();
const anvilChainResult = await checkAnvilChain();
const anvilContractResult = await checkAnvilContractBytecode();
const anvilWalletResult = await checkAnvilFundedWallet();
const indexerGraphqlResult = await checkLocalIndexerGraphql();
const indexerLagResult = checkIndexerLag(indexerGraphqlResult);
const indexerServiceResult = await checkLocalIndexerService();
const postgresResult = await checkPostgresTcp();

const results = [
  ...serviceResults,
  agentResult,
  anvilChainResult,
  anvilContractResult,
  anvilWalletResult,
  indexerGraphqlResult,
  indexerLagResult,
  indexerServiceResult,
  postgresResult,
];
const failures = results.filter((result) => !result.ready).length;
const payload = {
  mode: "full-local",
  results,
  summary: {
    ready: failures === 0,
    failures,
    timeoutMs: options.timeoutMs,
  },
  entrypoints: {
    start: "bun run dev",
    smoke: "bun run dev:smoke:full",
    health: "bun run dev:health",
    stop: "bun run dev:stop",
  },
};

if (options.json) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  printText(payload);
}

if (!payload.summary.ready) {
  process.exitCode = 1;
}
