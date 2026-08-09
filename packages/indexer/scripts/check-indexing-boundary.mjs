#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexerRoot = path.resolve(__dirname, "..");

const ALLOWED_CONTRACT_EVENTS = {
  ActionRegistry: new Set([
    "ActionRegistered",
    "GardenDomainsUpdated",
    "ActionStartTimeUpdated",
    "ActionEndTimeUpdated",
    "ActionTitleUpdated",
    "ActionInstructionsUpdated",
    "ActionMediaUpdated",
  ]),
  GardenToken: new Set(["GardenMinted"]),
  GardenAccount: new Set([
    "NameUpdated",
    "DescriptionUpdated",
    "LocationUpdated",
    "BannerImageUpdated",
    "GAPProjectCreated",
    "OpenJoiningUpdated",
  ]),
  HatsModule: new Set(["RoleGranted", "RoleRevoked"]),
  OctantModule: new Set([
    "VaultCreated",
    "HarvestTriggered",
    "EmergencyPaused",
    "DonationAddressUpdated",
  ]),
  OctantVault: new Set(["Deposit", "Withdraw"]),
  YieldSplitter: new Set(["YieldSplit"]),
  HypercertMinter: new Set(["TransferSingle", "ClaimStored"]),
  GreenWill: new Set(["BadgeClassConfigured", "BadgeIssued"]),
  CookieJarFactory: new Set(["JarCreated", "MetadataUpdated"]),
  // Green Goods' own Arbitrum settlement command state (registers #90/#91). The boundary this
  // gate protects — no EAS re-indexing, no raw Celo/G$ transfer indexing — is unchanged: these
  // events are the module's command/acknowledgment lifecycle, not token movement observation.
  SettlementModule: new Set([
    "FundingConfigurationLocked",
    "CommitmentPayoutPlanCreated",
    "CommitmentPayoutPlanFinalized",
    "DisbursementQueued",
    "SettlementAcknowledged",
    "DisbursementRequeued",
    "DisbursementCancelled",
  ]),
};

const ALLOWED_CONTRACTS = new Set(Object.keys(ALLOWED_CONTRACT_EVENTS));
const REQUIRED_CHAIN_BOUNDARIES = new Map([
  [42161, { startBlock: 433_713_812, endBlock: undefined }],
  [11155111, { startBlock: 10_243_363, endBlock: undefined }],
]);

const DISALLOWED_SCHEMA_ENTITIES = [
  "GardenHatTree",
  "PartialGrantFailure",
  "GardenCommunity",
  "GardenSignalPool",
  "YieldAccumulation",
  "YieldFractionPurchase",
  "YieldCookieJarTransfer",
  "YieldJuiceboxPayment",
  "YieldStranded",
  "GoodsAirdrop",
  "GardenTreasury",
  "CookieJar",
  "ENSRegistration",
  "MarketplaceOrder",
  "MarketplacePurchase",
  "PowerRegistryConfig",
  "PowerRegistryDeregistration",
];

function getEventName(eventSignature) {
  return String(eventSignature).split("(")[0]?.trim() || "";
}

function hasField(schema, typeName, fieldName) {
  const typeRegex = new RegExp(`type\\s+${typeName}\\s*\\{([\\s\\S]*?)\\}`, "m");
  const match = schema.match(typeRegex);
  if (!match) return false;
  const body = match[1] || "";
  return new RegExp(`\\b${fieldName}\\b`).test(body);
}

async function main() {
  const errors = [];

  const configPath = path.join(indexerRoot, "config.yaml");
  const schemaPath = path.join(indexerRoot, "schema.graphql");

  const configRaw = await fs.readFile(configPath, "utf8");
  const schemaRaw = await fs.readFile(schemaPath, "utf8");

  const config = yaml.load(configRaw, { schema: yaml.CORE_SCHEMA });

  const contracts = Array.isArray(config?.contracts) ? config.contracts : [];
  const contractNames = new Set(contracts.map((contract) => String(contract?.name || "")));

  for (const allowedName of ALLOWED_CONTRACTS) {
    if (!contractNames.has(allowedName)) {
      errors.push(`Missing required contract in config.yaml: ${allowedName}`);
    }
  }

  for (const contract of contracts) {
    const contractName = String(contract?.name || "");

    if (!ALLOWED_CONTRACTS.has(contractName)) {
      errors.push(`Disallowed contract in config.yaml: ${contractName}`);
      continue;
    }

    if (!contract?.handler || typeof contract.handler !== "string") {
      errors.push(`Contract ${contractName} is missing a handler path`);
    }

    const events = Array.isArray(contract?.events) ? contract.events : [];
    if (events.length === 0) {
      errors.push(`Contract ${contractName} has no configured events`);
      continue;
    }

    const allowedEvents = ALLOWED_CONTRACT_EVENTS[contractName];
    for (const eventEntry of events) {
      const signature = eventEntry?.event;
      if (!signature || typeof signature !== "string") {
        errors.push(`Contract ${contractName} has an invalid event entry`);
        continue;
      }

      if ("handler" in eventEntry && !eventEntry.handler) {
        errors.push(`Contract ${contractName} has a handlerless event: ${signature}`);
      }

      const eventName = getEventName(signature);
      if (!allowedEvents.has(eventName)) {
        errors.push(`Disallowed event on ${contractName}: ${eventName}`);
      }
    }
  }

  const chains = Array.isArray(config?.chains) ? config.chains : [];
  if (chains.length !== REQUIRED_CHAIN_BOUNDARIES.size) {
    errors.push(
      `Expected ${REQUIRED_CHAIN_BOUNDARIES.size} configured chains, found ${chains.length}`
    );
  }

  for (const chain of chains) {
    const chainId = Number(chain?.id);
    const requiredBoundary = REQUIRED_CHAIN_BOUNDARIES.get(chainId);
    const chainContracts = Array.isArray(chain?.contracts) ? chain.contracts : [];

    if (!requiredBoundary) {
      errors.push(`Unexpected chain in config.yaml: ${chain?.id ?? "unknown"}`);
      continue;
    }

    if (Number(chain?.start_block) !== requiredBoundary.startBlock) {
      errors.push(
        `Chain ${chainId} start_block changed: expected ${requiredBoundary.startBlock}, found ${chain?.start_block ?? "missing"}`
      );
    }

    if (chain?.end_block !== requiredBoundary.endBlock) {
      errors.push(
        `Chain ${chainId} end_block changed: expected none, found ${chain.end_block}`
      );
    }

    for (const chainContract of chainContracts) {
      const name = String(chainContract?.name || "");
      if (!ALLOWED_CONTRACTS.has(name)) {
        errors.push(`Chain ${chainId} includes disallowed contract: ${name}`);
      }
    }

    const octantVault = chainContracts.find((contract) => contract?.name === "OctantVault");
    if (!octantVault) {
      errors.push(`Chain ${chainId} is missing the dynamic OctantVault contract`);
    } else if (Object.hasOwn(octantVault, "address")) {
      errors.push(`Chain ${chainId} OctantVault must omit address for dynamic registration`);
    }

    const gardenAccount = chainContracts.find((contract) => contract?.name === "GardenAccount");
    if (!gardenAccount?.address) {
      errors.push(`Chain ${chainId} is missing the seeded GardenAccount implementation address`);
    }

    const greenWill = chainContracts.find((contract) => contract?.name === "GreenWill");
    if (chainId === 42161 && !greenWill?.address) {
      errors.push("Chain 42161 is missing the GreenWill deployment address");
    }
    if (chainId === 11155111 && greenWill) {
      errors.push("Chain 11155111 must omit undeployed GreenWill");
    }
  }

  for (const requiredChainId of REQUIRED_CHAIN_BOUNDARIES.keys()) {
    if (!chains.some((chain) => Number(chain?.id) === requiredChainId)) {
      errors.push(`Missing required chain in config.yaml: ${requiredChainId}`);
    }
  }

  if (Object.hasOwn(config ?? {}, "networks")) {
    errors.push("config.yaml still uses the removed V2 networks key");
  }

  if (Object.hasOwn(config ?? {}, "output")) {
    errors.push("config.yaml still uses the removed V2 output key");
  }

  if (Object.hasOwn(config ?? {}, "preRegisterDynamicContracts")) {
    errors.push("config.yaml still uses the removed V2 preRegisterDynamicContracts key");
  }

  for (const contract of contracts) {
    if (Object.hasOwn(contract ?? {}, "preRegisterDynamicContracts")) {
      errors.push(
        `Contract ${String(contract?.name || "unknown")} still uses preRegisterDynamicContracts`
      );
    }
    for (const eventEntry of Array.isArray(contract?.events) ? contract.events : []) {
      if (Object.hasOwn(eventEntry ?? {}, "preRegisterDynamicContracts")) {
        errors.push(
          `Event ${String(eventEntry?.event || "unknown")} still uses preRegisterDynamicContracts`
        );
      }
    }
  }

  for (const entity of DISALLOWED_SCHEMA_ENTITIES) {
    if (new RegExp(`\\btype\\s+${entity}\\b`).test(schemaRaw)) {
      errors.push(`schema.graphql still contains removed entity: ${entity}`);
    }
  }

  if (hasField(schemaRaw, "Garden", "slug")) {
    errors.push("schema.graphql still contains removed field Garden.slug");
  }

  if (hasField(schemaRaw, "Garden", "ensStatus")) {
    errors.push("schema.graphql still contains removed field Garden.ensStatus");
  }

  for (const field of ["title", "description", "imageUri", "workScopes"]) {
    if (hasField(schemaRaw, "Hypercert", field)) {
      errors.push(`schema.graphql still contains removed field Hypercert.${field}`);
    }
  }

  if (errors.length > 0) {
    console.error("Indexing boundary check failed:\n");
    for (const err of errors) {
      console.error(`- ${err}`);
    }
    process.exit(1);
  }

  console.log(
    `Indexing boundary check passed: ${contracts.length} contracts validated, ${chains.length} chains validated with preserved block boundaries.`
  );
}

main().catch((error) => {
  console.error("Indexing boundary check crashed:", error);
  process.exit(1);
});
