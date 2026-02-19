#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

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
};

const ALLOWED_CONTRACTS = new Set(Object.keys(ALLOWED_CONTRACT_EVENTS));

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

  const config = yaml.load(configRaw);

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

  const networks = Array.isArray(config?.networks) ? config.networks : [];
  for (const network of networks) {
    const networkId = network?.id ?? "unknown";
    const networkContracts = Array.isArray(network?.contracts) ? network.contracts : [];

    for (const networkContract of networkContracts) {
      const name = String(networkContract?.name || "");
      if (!ALLOWED_CONTRACTS.has(name)) {
        errors.push(`Network ${networkId} includes disallowed contract: ${name}`);
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
    `Indexing boundary check passed: ${contracts.length} contracts validated, ${networks.length} networks validated.`
  );
}

main().catch((error) => {
  console.error("Indexing boundary check crashed:", error);
  process.exit(1);
});
