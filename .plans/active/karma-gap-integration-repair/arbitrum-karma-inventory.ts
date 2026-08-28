import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Contract, JsonRpcProvider, getAddress, keccak256, toBeHex } from "ethers";
import type { Address } from "viem";

const CHAIN_ID = 42_161;
const TOKENBOUND_REGISTRY = "0x000000006551c19487814612e58FE06813775758";
const TOKENBOUND_SALT =
  "0x6551655165516551655165516551655165516551655165516551655165516551";
const REQUIRED_SYNC_VERSION = 1;
const AIYELOJA_SLUG = "aiyeloja-family-garden";
const MAX_GARDENS = 512n;
const ERC1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const GARDEN_TOKEN_ABI = [
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function karmaGAPModule() view returns (address)",
  "function hatsModule() view returns (address)",
] as const;
const REGISTRY_ABI = [
  "function account(address implementation,bytes32 salt,uint256 chainId,address tokenContract,uint256 tokenId) view returns (address)",
] as const;
const GARDEN_ACCOUNT_ABI = [
  "function name() view returns (string)",
  "function slug() view returns (string)",
  "function karmaSyncVersion() view returns (uint32)",
] as const;
const KARMA_MODULE_ABI = ["function getProjectUID(address garden) view returns (bytes32)"] as const;

interface CliOptions {
  rpcUrl: string;
}

interface DeploymentJson {
  accountProxy: string;
  gardenAccountImpl: string;
  gardenToken: string;
  karmaGAPModule: string;
}

interface Deployment {
  accountProxy: Address;
  gardenAccountImpl: Address;
  gardenToken: Address;
  karmaGAPModule: Address;
}

interface StorageLayout {
  storage: Array<{ label: string; slot: string }>;
}

function usage(): string {
  return [
    "Read-only Arbitrum Karma release inventory",
    "",
    "Usage:",
    "  bun .plans/active/karma-gap-integration-repair/arbitrum-karma-inventory.ts --rpc-url <archive-or-finalized-RPC>",
    "",
    "The command reads finalized chain state and prints JSON to stdout. It has no signer, write mode,",
    "transaction path, output-file flag, or broadcast capability.",
  ].join("\n");
}

function parseArgs(argv: string[]): CliOptions | null {
  if (argv.includes("--help") || argv.includes("-h")) return null;
  let rpcUrl = "";
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === "--rpc-url") {
      rpcUrl = argv[++index] ?? "";
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!rpcUrl) throw new Error("--rpc-url is required");
  const parsed = new URL(rpcUrl);
  if (parsed.protocol !== "https:") {
    throw new Error("--rpc-url must use https");
  }
  return { rpcUrl };
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(resolve(filePath), "utf8")) as T;
}

function normalizeDeployment(raw: DeploymentJson): Deployment {
  return {
    accountProxy: getAddress(raw.accountProxy) as Address,
    gardenAccountImpl: getAddress(raw.gardenAccountImpl) as Address,
    gardenToken: getAddress(raw.gardenToken) as Address,
    karmaGAPModule: getAddress(raw.karmaGAPModule) as Address,
  };
}

async function optionalRead<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch {
    return null;
  }
}

function implementationFromSlot(value: string): string | null {
  const normalized = value.replace(/^0x/, "").padStart(64, "0");
  if (/^0+$/.test(normalized)) return null;
  return getAddress(`0x${normalized.slice(-40)}`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const deployment = normalizeDeployment(
    readJson<DeploymentJson>("packages/contracts/deployments/42161-latest.json")
  );
  const tokenLayout = readJson<StorageLayout>("packages/contracts/storage-layouts/GardenToken.json");
  const nextTokenSlot = tokenLayout.storage.find((entry) => entry.label === "_nextTokenId")?.slot;
  if (nextTokenSlot === undefined) throw new Error("GardenToken _nextTokenId storage slot is missing");

  const provider = new JsonRpcProvider(options.rpcUrl);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== CHAIN_ID) {
    throw new Error(`Expected Arbitrum chain ${CHAIN_ID}, received ${network.chainId}`);
  }
  const finalized = await provider.getBlock("finalized");
  if (!finalized) throw new Error("RPC did not return a finalized block");
  const blockTag = finalized.number;

  const gardenTokenAddress = getAddress(deployment.gardenToken);
  const gardenAccountImplementation = getAddress(deployment.gardenAccountImpl);
  const configuredAccountProxy = getAddress(deployment.accountProxy);
  const gardenToken = new Contract(gardenTokenAddress, GARDEN_TOKEN_ABI, provider);
  const registry = new Contract(TOKENBOUND_REGISTRY, REGISTRY_ABI, provider);
  const observedKarmaModule = getAddress(
    await gardenToken.karmaGAPModule({ blockTag })
  );
  const observedHatsModule = getAddress(await gardenToken.hatsModule({ blockTag }));
  const karmaModule = new Contract(observedKarmaModule, KARMA_MODULE_ABI, provider);

  const rawCount = await provider.getStorage(gardenTokenAddress, BigInt(nextTokenSlot), blockTag);
  const gardenCount = BigInt(rawCount);
  if (gardenCount > MAX_GARDENS) {
    throw new Error(`Garden inventory exceeds the ${MAX_GARDENS} row safety bound`);
  }

  const gardens = [];
  for (let tokenId = 0n; tokenId < gardenCount; tokenId++) {
    const owner = getAddress(await gardenToken.ownerOf(tokenId, { blockTag }));
    const garden = getAddress(
      await registry.account(
        gardenAccountImplementation,
        TOKENBOUND_SALT,
        CHAIN_ID,
        gardenTokenAddress,
        tokenId,
        { blockTag }
      )
    );
    const account = new Contract(garden, GARDEN_ACCOUNT_ABI, provider);
    const [name, slug, syncVersion, projectUID, code, implementationSlot] = await Promise.all([
      optionalRead(() => account.name({ blockTag }) as Promise<string>),
      optionalRead(() => account.slug({ blockTag }) as Promise<string>),
      optionalRead(async () => Number(await account.karmaSyncVersion({ blockTag }))),
      optionalRead(() => karmaModule.getProjectUID(garden, { blockTag }) as Promise<string>),
      provider.getCode(garden, blockTag),
      provider.getStorage(garden, ERC1967_IMPLEMENTATION_SLOT, blockTag),
    ]);
    const activeImplementation = implementationFromSlot(implementationSlot);
    const proxyKind = activeImplementation
      ? "erc1967_account_proxy"
      : "legacy_immutable_erc6551";

    gardens.push({
      tokenId: tokenId.toString(),
      garden,
      owner,
      name,
      slug,
      karmaProfileUrl: slug ? `https://www.karmahq.org/project/${encodeURIComponent(slug)}` : null,
      projectUID:
        projectUID && projectUID !== toBeHex(0, 32) ? projectUID : null,
      syncVersion,
      requiredSyncVersion: REQUIRED_SYNC_VERSION,
      proxyKind,
      activeImplementation,
      registryImplementation: gardenAccountImplementation,
      codeHash: code === "0x" ? null : keccak256(code),
      migrationRequired:
        proxyKind === "legacy_immutable_erc6551" ||
        syncVersion === null ||
        syncVersion < REQUIRED_SYNC_VERSION,
      upgradeAuthority:
        proxyKind === "erc1967_account_proxy"
          ? { kind: "garden_nft_owner", address: owner }
          : { kind: "blocked_immutable_account", address: null },
    });
  }

  const canaries = gardens.filter((garden) => garden.slug === AIYELOJA_SLUG);
  const blockers = [];
  if (canaries.length !== 1) {
    blockers.push(`Expected exactly one ${AIYELOJA_SLUG} canary, found ${canaries.length}`);
  }
  const immutableCount = gardens.filter(
    (garden) => garden.proxyKind === "legacy_immutable_erc6551"
  ).length;
  if (immutableCount > 0) {
    blockers.push(
      `${immutableCount} GardenAccounts use immutable ERC-6551 delegation and cannot execute UUPS upgrades`
    );
  }
  if (observedKarmaModule !== getAddress(deployment.karmaGAPModule)) {
    blockers.push("GardenToken Karma module does not match the deployment artifact");
  }

  const canary = canaries[0] ?? null;
  const releaseOrder = canary
    ? [canary, ...gardens.filter((garden) => garden.garden !== canary.garden)]
    : gardens;
  const result = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: "read_only",
    mutationAuthorized: false,
    chainId: CHAIN_ID,
    finalizedBlock: { number: finalized.number, hash: finalized.hash },
    contracts: {
      gardenToken: gardenTokenAddress,
      gardenAccountImplementation,
      configuredAccountProxy,
      karmaGAPModule: observedKarmaModule,
      hatsModule: observedHatsModule,
    },
    gardenCount: gardens.length,
    canarySlug: AIYELOJA_SLUG,
    canaryGarden: canary?.garden ?? null,
    releaseOrder: releaseOrder.map((garden) => garden.garden),
    blockers,
    postStateRequiredBeforeExpansion: [
      "canary account reports the required sync version",
      "Karma project UID is non-zero and the canonical slug URL resolves",
      "ProjectDetails image and description render on Karma",
      "every live Owner and Steward is a project member and admin",
      "revoked Owner and Steward access is absent while membership history remains",
      "indexer projections report project, details, membership, and access as synced",
    ],
    gardens,
  };

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (blockers.length > 0) process.exitCode = 2;
}

await main();
