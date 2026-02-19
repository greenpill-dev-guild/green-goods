#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const chains = [
  { chainId: 11155111, name: "Sepolia" },
  { chainId: 42161, name: "Arbitrum" },
  { chainId: 42220, name: "Celo" },
];

const moduleDefs = [
  {
    id: "core",
    label: "Core gardens/actions/roles",
    source: "indexer",
    deploymentKeys: ["actionRegistry", "gardenToken", "gardenAccountImpl"],
    indexerNames: ["ActionRegistry", "GardenToken", "GardenAccount"],
  },
  {
    id: "hats",
    label: "Hats role membership",
    source: "indexer",
    deploymentKeys: ["hatsModule"],
    indexerNames: ["HatsModule"],
  },
  {
    id: "octant-module",
    label: "Vault lifecycle events",
    source: "indexer",
    deploymentKeys: ["octantModule"],
    indexerNames: ["OctantModule"],
  },
  {
    id: "octant-vault",
    label: "Vault deposit/withdraw history",
    source: "indexer",
    deploymentKeys: ["octantModule", "octantFactory"],
    indexerNames: ["OctantVault"],
  },
  {
    id: "yield-splitter",
    label: "Yield split history",
    source: "indexer",
    deploymentKeys: ["yieldSplitter"],
    indexerNames: ["YieldSplitter"],
  },
  {
    id: "hypercert-linkage",
    label: "Hypercert GG linkage + claims",
    source: "indexer",
    deploymentKeys: ["hypercertsModule"],
    indexerNames: ["HypercertMinter"],
  },
  {
    id: "eas-attestations",
    label: "EAS attestations",
    source: "external",
    externalSource: "EAS GraphQL",
    deploymentKeys: [],
    indexerNames: [],
  },
  {
    id: "gardens-v2",
    label: "Gardens V2 community/pools",
    source: "external",
    externalSource: "Gardens subgraph",
    deploymentKeys: ["gardensModule"],
    indexerNames: [],
  },
  {
    id: "cookie-jar",
    label: "Cookie jars",
    source: "external",
    externalSource: "On-chain reads",
    deploymentKeys: ["cookieJarModule"],
    indexerNames: [],
  },
  {
    id: "marketplace",
    label: "Marketplace orders/trades",
    source: "external",
    externalSource: "On-chain reads/logs",
    deploymentKeys: ["marketplaceAdapter"],
    indexerNames: [],
  },
  {
    id: "ens",
    label: "ENS registration lifecycle",
    source: "external",
    externalSource: "RPC reads",
    deploymentKeys: ["greenGoodsENS"],
    indexerNames: [],
  },
  {
    id: "power-registry-audit",
    label: "Power registry audit entities",
    source: "external",
    externalSource: "Not required at runtime",
    deploymentKeys: ["unifiedPowerRegistry"],
    indexerNames: [],
  },
];

const zeroAddress = "0x0000000000000000000000000000000000000000";
const nonZero = (value) => Boolean(value && String(value).toLowerCase() !== zeroAddress);

const loadJson = async (relativePath) => {
  const abs = path.resolve(repoRoot, relativePath);
  return JSON.parse(await fs.readFile(abs, "utf8"));
};

const indexerYaml = await fs.readFile(path.resolve(repoRoot, "packages/indexer/config.yaml"), "utf8");
const indexerConfig = yaml.load(indexerYaml);

const indexerAddress = (chainId, contractName) => {
  const network = indexerConfig.networks?.find((item) => Number(item.id) === Number(chainId));
  const contract = network?.contracts?.find((item) => item.name === contractName);
  return contract?.address ?? null;
};

const chainSummaries = [];

for (const chain of chains) {
  const deployment = await loadJson(`packages/contracts/deployments/${chain.chainId}-latest.json`);

  const modules = moduleDefs.map((moduleDef) => {
    const deploymentAddresses = moduleDef.deploymentKeys.map((key) => deployment[key] ?? null);
    const deploymentReady =
      deploymentAddresses.length === 0 ||
      (deploymentAddresses.length > 0 && deploymentAddresses.every(nonZero));

    const indexerAddresses = moduleDef.indexerNames.map((name) => indexerAddress(chain.chainId, name));
    const indexerReady =
      moduleDef.source === "indexer"
        ? indexerAddresses.length > 0 && indexerAddresses.every(nonZero)
        : null;

    let effectiveStatus = "Implemented (activation pending deployment)";
    if (moduleDef.source === "external") {
      if (deploymentReady) {
        effectiveStatus = "Live (external source)";
      }
    } else if (deploymentReady && indexerReady) {
      effectiveStatus = "Live";
    } else if (deploymentReady && !indexerReady) {
      effectiveStatus = "Implemented (activation pending indexing)";
    }

    return {
      id: moduleDef.id,
      label: moduleDef.label,
      data_source:
        moduleDef.source === "indexer"
          ? "Envio indexer"
          : (moduleDef.externalSource ?? "External source"),
      implemented_in_code: true,
      deployment_ready: deploymentReady,
      indexer_ready: indexerReady,
      effective_status: effectiveStatus,
      deployment_addresses: Object.fromEntries(
        moduleDef.deploymentKeys.map((key, idx) => [key, deploymentAddresses[idx]])
      ),
      indexer_addresses: Object.fromEntries(
        moduleDef.indexerNames.map((name, idx) => [name, indexerAddresses[idx]])
      ),
    };
  });

  chainSummaries.push({
    chainId: chain.chainId,
    chainName: chain.name,
    modules,
  });
}

const generated = {
  generated_at: new Date().toISOString(),
  source_files: [
    "packages/contracts/deployments/11155111-latest.json",
    "packages/contracts/deployments/42161-latest.json",
    "packages/contracts/deployments/42220-latest.json",
    "packages/indexer/config.yaml",
  ],
  status_scale: [
    "Live",
    "Live (external source)",
    "Implemented (activation pending indexing)",
    "Implemented (activation pending deployment)",
    "Planned",
  ],
  chains: chainSummaries,
};

const outputPath = path.resolve(repoRoot, "docs/src/data/protocol-status.generated.json");
await fs.writeFile(outputPath, `${JSON.stringify(generated, null, 2)}\n`, "utf8");
console.log(`Wrote ${path.relative(repoRoot, outputPath)}`);
