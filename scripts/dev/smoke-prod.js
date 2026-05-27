#!/usr/bin/env node

/**
 * Read-only smoke check for production-backed local dev.
 *
 * This validates local browser surfaces plus production agent, Arbitrum, and
 * indexer connectivity. It never submits transactions or calls mutating RPC
 * methods.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requestUrl, reexecUnderSystemNodeIfNeeded } from "../lib/dev-shared.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");

reexecUnderSystemNodeIfNeeded({
  scriptPath: __filename,
  sentinel: "GREEN_GOODS_PROD_SMOKE_NODE_REEXEC",
  cwd: projectRoot,
});

const ARBITRUM_CHAIN_ID = 42161;
const DEFAULT_PRODUCTION_INDEXER_URL = "https://indexer.hyperindex.xyz/0bf0e0f/v1/graphql";
const DEFAULT_PRODUCTION_AGENT_URL = "https://agent.greengoods.app";
const LOCAL_INDEXER_URL = "http://localhost:3006/v1/graphql";
const DEFAULT_ARBITRUM_RPC_URL = "https://arb1.arbitrum.io/rpc";
const DEFAULT_MAX_INDEXER_LAG_BLOCKS = 2_000;
const DEFAULT_TIMEOUT_MS = 120_000;

const services = [
  {
    name: "client",
    port: 3001,
    urls: ["https://localhost:3001", "http://localhost:3001"],
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
      "Usage: node scripts/dev/smoke-prod.js [--mode prod|mirror] [--json] [--timeout seconds]",
      "",
      "Modes:",
      "  prod    local browser apps + hosted production indexer",
      "  mirror  local browser apps + local indexer mirror on localhost:3006",
      "",
      "Options:",
      `  --timeout <seconds>                Maximum time to wait for local browser surfaces (default: ${DEFAULT_TIMEOUT_MS / 1000})`,
      `  --max-indexer-lag-blocks <blocks>  Maximum accepted indexer lag (default: ${DEFAULT_MAX_INDEXER_LAG_BLOCKS})`,
      "",
    ].join("\n")
  );
  process.exit(exitCode);
}

function parseArgs(argv) {
  const options = {
    mode: "prod",
    json: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxIndexerLagBlocks: DEFAULT_MAX_INDEXER_LAG_BLOCKS,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") usage(0);
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--mode") {
      options.mode = argv[++index] || "";
      continue;
    }
    if (arg.startsWith("--mode=")) {
      options.mode = arg.slice("--mode=".length);
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

  if (!["prod", "mirror"].includes(options.mode)) {
    process.stderr.write(`Invalid mode: ${options.mode || "(missing)"}\n`);
    usage(1);
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const envFile = parseEnvFile(path.join(projectRoot, ".env"));

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const text = fs.readFileSync(filePath, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice("export ".length) : line;
    const equals = normalized.indexOf("=");
    if (equals === -1) continue;

    const key = normalized.slice(0, equals).trim();
    let value = normalized.slice(equals + 1).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

function valueFor(key) {
  return process.env[key] ?? envFile[key] ?? "";
}

function hasUsableValue(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^op:\/\//.test(trimmed)) return false;
  if (/^if\(|^\$\{?[A-Z0-9_]+\}?$/i.test(trimmed)) return false;
  return true;
}

function getArbitrumRpcUrl() {
  const explicitRpc = valueFor("ARBITRUM_RPC_URL");
  if (hasUsableValue(explicitRpc)) return explicitRpc.trim();

  const alchemyKey =
    valueFor("ALCHEMY_API_KEY") || valueFor("ALCHEMY_KEY") || valueFor("VITE_ALCHEMY_API_KEY");
  if (hasUsableValue(alchemyKey)) {
    return `https://arb-mainnet.g.alchemy.com/v2/${alchemyKey.trim()}`;
  }

  return DEFAULT_ARBITRUM_RPC_URL;
}

function getIndexerUrl() {
  if (options.mode === "mirror") return LOCAL_INDEXER_URL;
  const explicit = process.env.VITE_ENVIO_INDEXER_URL;
  return hasUsableValue(explicit || "") ? explicit.trim() : DEFAULT_PRODUCTION_INDEXER_URL;
}

function getAgentBaseUrl() {
  const explicit = process.env.VITE_API_BASE_URL;
  return hasUsableValue(explicit || "")
    ? explicit.trim().replace(/\/+$/, "")
    : DEFAULT_PRODUCTION_AGENT_URL;
}

function redactUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    parsed.pathname = parsed.pathname.replace(/\/v2\/[^/]+/i, "/v2/[redacted]");
    parsed.pathname = parsed.pathname.replace(/\/api\/[^/]+/i, "/api/[redacted]");
    return parsed.toString();
  } catch {
    return "[unparseable-url]";
  }
}

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
    // Keep the HTTP status/body preview in the error below.
  }
  return { response, payload, text };
}

async function rpc(rpcUrl, method, params = []) {
  const { response, payload, text } = await postJson(rpcUrl, {
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

async function checkRpcChain() {
  const rpcUrl = getArbitrumRpcUrl();
  try {
    const result = await rpc(rpcUrl, "eth_chainId");
    const chainId = typeof result === "string" ? Number.parseInt(result, 16) : Number(result);
    if (chainId !== ARBITRUM_CHAIN_ID) {
      throw new Error(`expected ${ARBITRUM_CHAIN_ID}, got ${chainId || "unknown"}`);
    }
    return {
      name: "arbitrum-rpc-chain",
      level: "pass",
      ready: true,
      detail: `eth_chainId=${chainId}`,
      url: redactUrl(rpcUrl),
    };
  } catch (error) {
    return {
      name: "arbitrum-rpc-chain",
      level: "fail",
      ready: false,
      detail: error instanceof Error ? error.message : String(error),
      url: redactUrl(rpcUrl),
    };
  }
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

async function checkContractBytecode() {
  const rpcUrl = getArbitrumRpcUrl();
  const candidates = deploymentAddresses();

  for (const candidate of candidates) {
    try {
      const code = await rpc(rpcUrl, "eth_getCode", [candidate.address, "latest"]);
      if (typeof code === "string" && code !== "0x") {
        return {
          name: "arbitrum-contract-bytecode",
          level: "pass",
          ready: true,
          detail: `${candidate.key} has bytecode at ${candidate.address}`,
          url: redactUrl(rpcUrl),
        };
      }
    } catch (error) {
      return {
        name: "arbitrum-contract-bytecode",
        level: "fail",
        ready: false,
        detail: error instanceof Error ? error.message : String(error),
        url: redactUrl(rpcUrl),
      };
    }
  }

  return {
    name: "arbitrum-contract-bytecode",
    level: "fail",
    ready: false,
    detail: "No checked Arbitrum deployment address returned bytecode.",
    url: redactUrl(rpcUrl),
  };
}

async function readIndexerChainMetadata(indexerUrl) {
  if (options.mode === "mirror") {
    const { response, payload, text } = await postJson(indexerUrl, {
      query:
        "query GreenGoodsLocalMirrorSmoke { envio_chains { id progress_block source_block events_processed ready_at } }",
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
    }
    if (payload?.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message).join("; "));
    }

    const rows = payload?.data?.envio_chains;
    if (!Array.isArray(rows)) {
      throw new Error("envio_chains was not returned as an array");
    }

    const chainRow = rows.find((row) => Number(row.id) === ARBITRUM_CHAIN_ID);
    if (!chainRow) {
      throw new Error(`envio_chains returned ${rows.length} row(s), none for ${ARBITRUM_CHAIN_ID}`);
    }

    const latest = Number(chainRow.progress_block);
    if (!Number.isFinite(latest) || latest <= 0) {
      throw new Error(`progress_block is not a positive number: ${chainRow.progress_block}`);
    }

    return {
      chainId: ARBITRUM_CHAIN_ID,
      latestProcessedBlock: latest,
      eventsProcessed: Number(chainRow.events_processed),
      sourceBlock: Number(chainRow.source_block),
    };
  }

  const { response, payload, text } = await postJson(indexerUrl, {
    query: "query GreenGoodsProdSmoke { chain_metadata { chain_id latest_processed_block } }",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
  }
  if (payload?.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  const rows = payload?.data?.chain_metadata;
  if (!Array.isArray(rows)) {
    throw new Error("chain_metadata was not returned as an array");
  }
  if (rows.length === 0) {
    throw new Error("chain_metadata returned no rows; cannot prove indexed chain state");
  }

  const chainRows = rows.filter((row) => Number(row.chain_id) === ARBITRUM_CHAIN_ID);
  if (chainRows.length === 0) {
    throw new Error(`chain_metadata returned ${rows.length} row(s), none for ${ARBITRUM_CHAIN_ID}`);
  }

  const latest = Number(chainRows[0]?.latest_processed_block);
  if (!Number.isFinite(latest) || latest <= 0) {
    throw new Error(`latest_processed_block is not a positive number: ${chainRows[0]?.latest_processed_block}`);
  }

  return {
    chainId: ARBITRUM_CHAIN_ID,
    latestProcessedBlock: latest,
  };
}

async function checkIndexerGraphql() {
  const indexerUrl = getIndexerUrl();
  try {
    const metadata = await readIndexerChainMetadata(indexerUrl);
    return {
      name: options.mode === "mirror" ? "local-indexer-graphql" : "hosted-indexer-graphql",
      level: "pass",
      ready: true,
      detail:
        options.mode === "mirror"
          ? `chain_id=${metadata.chainId}; progress_block=${metadata.latestProcessedBlock}; source_block=${metadata.sourceBlock}; events_processed=${metadata.eventsProcessed}`
          : `chain_id=${metadata.chainId}; latest_processed_block=${metadata.latestProcessedBlock}`,
      url: redactUrl(indexerUrl),
      latestProcessedBlock: metadata.latestProcessedBlock,
    };
  } catch (error) {
    return {
      name: options.mode === "mirror" ? "local-indexer-graphql" : "hosted-indexer-graphql",
      level: "fail",
      ready: false,
      detail: error instanceof Error ? error.message : String(error),
      url: redactUrl(indexerUrl),
    };
  }
}

async function checkIndexerLag(indexerResult) {
  const name = options.mode === "mirror" ? "local-indexer-lag" : "hosted-indexer-lag";
  if (!indexerResult.ready || typeof indexerResult.latestProcessedBlock !== "number") {
    return {
      name,
      level: "skipped",
      ready: true,
      detail: "Indexer GraphQL did not return block metadata; lag proof skipped after GraphQL failure.",
    };
  }

  const rpcUrl = getArbitrumRpcUrl();
  try {
    const blockNumber = await rpc(rpcUrl, "eth_blockNumber");
    const headBlock =
      typeof blockNumber === "string" ? Number.parseInt(blockNumber, 16) : Number(blockNumber);
    if (!Number.isFinite(headBlock) || headBlock <= 0) {
      throw new Error(`eth_blockNumber returned ${blockNumber}`);
    }

    const lagBlocks = Math.max(0, headBlock - indexerResult.latestProcessedBlock);
    if (lagBlocks > options.maxIndexerLagBlocks) {
      throw new Error(
        `lag=${lagBlocks} blocks exceeds max=${options.maxIndexerLagBlocks}; head=${headBlock}; indexed=${indexerResult.latestProcessedBlock}`
      );
    }

    return {
      name,
      level: "pass",
      ready: true,
      detail: `lag=${lagBlocks} blocks; head=${headBlock}; indexed=${indexerResult.latestProcessedBlock}; max=${options.maxIndexerLagBlocks}`,
      url: redactUrl(rpcUrl),
    };
  } catch (error) {
    return {
      name,
      level: "fail",
      ready: false,
      detail: error instanceof Error ? error.message : String(error),
      url: redactUrl(rpcUrl),
    };
  }
}

async function checkProductionAgentHealth() {
  const agentBaseUrl = getAgentBaseUrl();
  const healthUrl = new URL("/health", `${agentBaseUrl}/`).toString();

  try {
    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(12_000),
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      // Keep the body preview in the error below.
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
    }
    if (payload?.status && payload.status !== "ok") {
      throw new Error(`status=${payload.status}`);
    }

    return {
      name: "production-agent-health",
      level: "pass",
      ready: true,
      detail: payload?.services?.ai
        ? `status=${payload.status || "ok"}; ai=${payload.services.ai}`
        : `HTTP ${response.status}`,
      url: redactUrl(healthUrl),
    };
  } catch (error) {
    return {
      name: "production-agent-health",
      level: "fail",
      ready: false,
      detail: error instanceof Error ? error.message : String(error),
      url: redactUrl(healthUrl),
    };
  }
}

async function checkLocalIndexerService() {
  if (options.mode !== "mirror") {
    return {
      name: "local-indexer-service",
      level: "skipped",
      ready: true,
      detail: "Hosted indexer mode does not start the local indexer service.",
    };
  }

  const attempt = await requestUrl("http://localhost:3007/healthz", 5000);
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

function printText(payload) {
  console.log("\nGreen Goods Production Smoke\n");
  console.log(`Mode: ${payload.mode === "mirror" ? "local live-indexer mirror" : "hosted production"}`);
  console.log("Mutation policy: read-only smoke; wallet transactions remain manual.\n");

  for (const result of payload.results) {
    const mark = result.ready ? (result.level === "skipped" ? "SKIP" : "PASS") : "FAIL";
    console.log(`[${mark}] ${result.name}`);
    if (result.detail) console.log(`       ${result.detail}`);
    if (result.url) console.log(`       ${result.url}`);
  }

  if (payload.summary.ready) {
    console.log("\nProduction smoke passed.");
  } else {
    console.log(`\n${payload.summary.failures} production smoke check(s) failed.`);
  }
}

const serviceResults = await Promise.all(
  services.map((service) => waitForService(service, Date.now() + options.timeoutMs))
);
const rpcChainResult = await checkRpcChain();
const contractBytecodeResult = await checkContractBytecode();
const productionAgentHealthResult = await checkProductionAgentHealth();
const indexerGraphqlResult = await checkIndexerGraphql();
const indexerLagResult = await checkIndexerLag(indexerGraphqlResult);
const localIndexerServiceResult = await checkLocalIndexerService();
const results = [
  ...serviceResults,
  rpcChainResult,
  contractBytecodeResult,
  productionAgentHealthResult,
  indexerGraphqlResult,
  indexerLagResult,
  localIndexerServiceResult,
];
const failures = results.filter((result) => !result.ready).length;
const payload = {
  mode: options.mode,
  results,
  summary: {
    ready: failures === 0,
    failures,
    timeoutMs: options.timeoutMs,
  },
  entrypoints: {
    prod: "bun run dev:prod",
    mirror: "bun run dev:prod:mirror",
    smoke: "bun run dev:prod:smoke",
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
