import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import * as yaml from "js-yaml";

import { CHAIN_ID_MAP, NetworkManager } from "./network";

type NetworkName = "sepolia" | "arbitrum" | "celo" | "localhost";

interface VerifyOptions {
  network: NetworkName;
  chainId: string;
  rpcUrl: string;
  communitySlug: string;
  requireOctant: boolean;
  requireCookieJar: boolean;
  checkIndexer: boolean;
}

interface DeploymentRecord {
  actionRegistry: string;
  gardenToken: string;
  gardenAccountImpl?: string;
  gardensModule?: string;
  octantModule?: string;
  cookieJarModule?: string;
  greenGoodsENS?: string;
  marketplaceAdapter?: string;
  unifiedPowerRegistry?: string;
  yieldSplitter?: string;
  hatsModule?: string;
  rootGarden?: {
    address?: string;
    tokenId?: number;
  };
  [key: string]: unknown;
}

interface IndexerContract {
  name: string;
  address: string;
}

interface IndexerNetwork {
  id: number;
  contracts: IndexerContract[];
}

interface IndexerConfig {
  networks: IndexerNetwork[];
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

dotenv.config({
  path: path.join(__dirname, "../../../../.env"),
});

function parseArgs(argv: string[]): VerifyOptions {
  let network: NetworkName = "sepolia";
  let rpcUrl = "";
  let chainId = "";
  let communitySlug = process.env.COMMUNITY_GARDEN_SLUG || "community";
  let requireOctant = process.env.REQUIRE_OCTANT_READY !== "false";
  let requireCookieJar = process.env.REQUIRE_COOKIEJAR_READY !== "false";
  let checkIndexer = true;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--network":
      case "-n":
        network = argv[++i] as NetworkName;
        break;
      case "--rpc-url":
        rpcUrl = argv[++i] ?? "";
        break;
      case "--chain-id":
        chainId = argv[++i] ?? "";
        break;
      case "--community-slug":
        communitySlug = argv[++i] ?? communitySlug;
        break;
      case "--no-octant":
        requireOctant = false;
        break;
      case "--no-cookiejar":
        requireCookieJar = false;
        break;
      case "--skip-indexer":
        checkIndexer = false;
        break;
      default:
        break;
    }
  }

  const networkManager = new NetworkManager();
  const resolvedChainId = chainId || CHAIN_ID_MAP[network] || networkManager.getChainId(network).toString();
  const resolvedRpcUrl = rpcUrl || networkManager.getRpcUrl(network);

  return {
    network,
    chainId: resolvedChainId,
    rpcUrl: resolvedRpcUrl,
    communitySlug,
    requireOctant,
    requireCookieJar,
    checkIndexer,
  };
}

function isZeroAddress(value: string | undefined): boolean {
  return !value || value.toLowerCase() === ZERO_ADDRESS;
}

function castCall(rpcUrl: string, to: string, signature: string, args: string[] = []): string {
  const callArgs = ["call", to, signature, ...args, "--rpc-url", rpcUrl];
  try {
    return execFileSync("cast", callArgs, { encoding: "utf8" }).trim();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`cast call failed (${to} ${signature}): ${message}`);
  }
}

function parseAddress(output: string): string {
  const match = output.match(/0x[a-fA-F0-9]{40}/);
  return match ? match[0] : ZERO_ADDRESS;
}

function parseAddressArray(output: string): string[] {
  return output.match(/0x[a-fA-F0-9]{40}/g) ?? [];
}

function parseUint(output: string): bigint {
  const token = output.split(/\s+/)[0]?.trim();
  if (!token) return 0n;
  if (token.startsWith("0x") || token.startsWith("0X")) {
    return BigInt(token);
  }
  return BigInt(token);
}

function parseStringValue(output: string): string {
  const trimmed = output.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1);
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1);
  return trimmed;
}

function assert(condition: boolean, message: string, failures: string[]): void {
  if (!condition) failures.push(message);
}

function loadDeployment(chainId: string): DeploymentRecord {
  const deploymentPath = path.join(__dirname, "../../deployments", `${chainId}-latest.json`);
  if (!fs.existsSync(deploymentPath)) {
    throw new Error(`Deployment file not found: ${deploymentPath}`);
  }
  return JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as DeploymentRecord;
}

function validateIndexerConfig(chainId: string, deployment: DeploymentRecord, failures: string[]): void {
  const indexerPath = path.join(__dirname, "../../../indexer/config.yaml");
  if (!fs.existsSync(indexerPath)) {
    failures.push(`Indexer config not found: ${indexerPath}`);
    return;
  }

  const parsed = yaml.load(fs.readFileSync(indexerPath, "utf8")) as IndexerConfig;
  const network = parsed.networks.find((item) => item.id.toString() === chainId);
  if (!network) {
    failures.push(`Indexer config missing network id ${chainId}`);
    return;
  }

  const byName = new Map<string, string>();
  for (const contract of network.contracts) {
    byName.set(contract.name, contract.address);
  }

  const mappings: Array<{ deploymentKey: keyof DeploymentRecord; indexerName: string }> = [
    { deploymentKey: "actionRegistry", indexerName: "ActionRegistry" },
    { deploymentKey: "gardenToken", indexerName: "GardenToken" },
    { deploymentKey: "gardenAccountImpl", indexerName: "GardenAccount" },
    { deploymentKey: "hatsModule", indexerName: "HatsModule" },
    { deploymentKey: "octantModule", indexerName: "OctantModule" },
    { deploymentKey: "gardensModule", indexerName: "GardensModule" },
    { deploymentKey: "yieldSplitter", indexerName: "YieldSplitter" },
    { deploymentKey: "cookieJarModule", indexerName: "CookieJarModule" },
    { deploymentKey: "marketplaceAdapter", indexerName: "HypercertMarketplaceAdapter" },
    { deploymentKey: "unifiedPowerRegistry", indexerName: "UnifiedPowerRegistry" },
    { deploymentKey: "greenGoodsENS", indexerName: "GreenGoodsENS" },
  ];

  for (const mapping of mappings) {
    const deploymentAddress = deployment[mapping.deploymentKey] as string | undefined;
    if (isZeroAddress(deploymentAddress)) continue;

    const indexedAddress = byName.get(mapping.indexerName);
    assert(
      !!indexedAddress && !isZeroAddress(indexedAddress),
      `Indexer address missing for ${mapping.indexerName}`,
      failures,
    );
    if (indexedAddress) {
      assert(
        indexedAddress.toLowerCase() === deploymentAddress!.toLowerCase(),
        `Indexer mismatch for ${mapping.indexerName}: expected ${deploymentAddress}, got ${indexedAddress}`,
        failures,
      );
    }
  }
}

function main(): void {
  const options = parseArgs(process.argv);
  const failures: string[] = [];

  console.log(`\nPost-deploy verification`);
  console.log(`  network: ${options.network}`);
  console.log(`  chainId: ${options.chainId}`);
  console.log(`  rpcUrl: ${options.rpcUrl}`);
  console.log(`  communitySlug: ${options.communitySlug}\n`);

  const deployment = loadDeployment(options.chainId);
  const rootGarden = deployment.rootGarden?.address ?? ZERO_ADDRESS;

  assert(!isZeroAddress(deployment.actionRegistry), "deployment.actionRegistry is zero", failures);
  assert(!isZeroAddress(deployment.gardenToken), "deployment.gardenToken is zero", failures);
  assert(!isZeroAddress(rootGarden), "deployment.rootGarden.address is zero", failures);

  if (failures.length === 0) {
    const domainMask = parseUint(
      castCall(options.rpcUrl, deployment.actionRegistry, "gardenDomains(address)(uint8)", [rootGarden]),
    );
    assert(domainMask === 15n, `root garden domain mask expected 15, got ${domainMask}`, failures);
  }

  if (failures.length === 0) {
    const gardensModule = deployment.gardensModule ?? ZERO_ADDRESS;
    assert(!isZeroAddress(gardensModule), "deployment.gardensModule is zero", failures);
    if (!isZeroAddress(gardensModule)) {
      const community = parseAddress(
        castCall(options.rpcUrl, gardensModule, "getGardenCommunity(address)(address)", [rootGarden]),
      );
      assert(!isZeroAddress(community), "root garden community was not created", failures);

      const pools = parseAddressArray(
        castCall(options.rpcUrl, gardensModule, "getGardenSignalPools(address)(address[])", [rootGarden]),
      );
      assert(pools.length > 0, "root garden has no signaling pools (action pool required)", failures);

      const goodsToken = parseAddress(castCall(options.rpcUrl, gardensModule, "goodsToken()(address)"));
      assert(!isZeroAddress(goodsToken), "gardensModule.goodsToken is zero", failures);
      if (!isZeroAddress(goodsToken)) {
        const goodsBalance = parseUint(
          castCall(options.rpcUrl, goodsToken, "balanceOf(address)(uint256)", [rootGarden]),
        );
        assert(goodsBalance > 0n, "root garden GOODS balance is zero", failures);
      }
    }
  }

  if (options.requireOctant && failures.length === 0) {
    const octantModule = deployment.octantModule ?? ZERO_ADDRESS;
    assert(!isZeroAddress(octantModule), "deployment.octantModule is zero", failures);
    if (!isZeroAddress(octantModule)) {
      const assets = parseAddressArray(castCall(options.rpcUrl, octantModule, "getSupportedAssets()(address[])"));
      const activeAssets: string[] = [];
      for (const asset of assets) {
        const strategy = parseAddress(
          castCall(options.rpcUrl, octantModule, "supportedAssets(address)(address)", [asset]),
        );
        if (!isZeroAddress(strategy)) activeAssets.push(asset);
      }
      assert(activeAssets.length > 0, "octant has no active supported assets", failures);
      for (const asset of activeAssets) {
        const vault = parseAddress(
          castCall(options.rpcUrl, octantModule, "getVaultForAsset(address,address)(address)", [rootGarden, asset]),
        );
        assert(!isZeroAddress(vault), `missing Octant vault for asset ${asset}`, failures);
      }
    }
  }

  if (options.requireCookieJar && failures.length === 0) {
    const cookieJarModule = deployment.cookieJarModule ?? ZERO_ADDRESS;
    assert(!isZeroAddress(cookieJarModule), "deployment.cookieJarModule is zero", failures);
    if (!isZeroAddress(cookieJarModule)) {
      const assets = parseAddressArray(castCall(options.rpcUrl, cookieJarModule, "getSupportedAssets()(address[])"));
      assert(assets.length > 0, "cookie jar has no supported assets", failures);
      for (const asset of assets) {
        const jar = parseAddress(
          castCall(options.rpcUrl, cookieJarModule, "getGardenJar(address,address)(address)", [rootGarden, asset]),
        );
        assert(!isZeroAddress(jar), `missing CookieJar for asset ${asset}`, failures);
      }
    }
  }

  if (!isZeroAddress(deployment.greenGoodsENS) && failures.length === 0) {
    const greenGoodsENS = deployment.greenGoodsENS as string;
    const ownerSlug = parseStringValue(
      castCall(options.rpcUrl, greenGoodsENS, "ownerToSlug(address)(string)", [rootGarden]),
    );

    if (options.network === "arbitrum") {
      const envReceiver = process.env.ENS_L1_RECEIVER || ZERO_ADDRESS;
      assert(!isZeroAddress(envReceiver), "ENS_L1_RECEIVER env var is required on arbitrum", failures);
      const l1Receiver = parseAddress(castCall(options.rpcUrl, greenGoodsENS, "l1Receiver()(address)"));
      assert(
        l1Receiver.toLowerCase() === envReceiver.toLowerCase(),
        "greenGoodsENS.l1Receiver != ENS_L1_RECEIVER",
        failures,
      );
      assert(ownerSlug === options.communitySlug, "arbitrum ENS send missing for community slug", failures);
    } else if (options.network === "sepolia") {
      assert(ownerSlug === options.communitySlug, "sepolia ENS ownerToSlug mismatch for community slug", failures);
      const l1Receiver = parseAddress(castCall(options.rpcUrl, greenGoodsENS, "l1Receiver()(address)"));
      assert(!isZeroAddress(l1Receiver), "sepolia ENS receiver (l1Receiver) is zero", failures);
      if (!isZeroAddress(l1Receiver)) {
        const resolved = parseAddress(
          castCall(options.rpcUrl, l1Receiver, "resolve(string)(address)", [options.communitySlug]),
        );
        assert(
          resolved.toLowerCase() === rootGarden.toLowerCase(),
          `sepolia ENS receiver resolve(${options.communitySlug}) mismatch`,
          failures,
        );
      }
    }
  }

  if (options.checkIndexer) {
    validateIndexerConfig(options.chainId, deployment, failures);
  }

  if (failures.length > 0) {
    console.error("\nVerification failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Verification passed: deployment is ready for frontend/indexer integration checks.");
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Verification command failed: ${message}`);
  process.exit(1);
}
