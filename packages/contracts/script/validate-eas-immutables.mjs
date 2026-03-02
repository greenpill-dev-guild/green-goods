#!/usr/bin/env bun
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
/**
 * EAS Immutable Address Validator
 *
 * Validates the complete chain of findings:
 *   1. Which EAS address is baked into each resolver's implementation
 *   2. Whether it matches the expected EAS for the target chain
 *   3. Whether the deploy script fix is in place (upgradeTo outside _isDeployed guard)
 *
 * Usage:
 *   bun packages/contracts/script/validate-eas-immutables.mjs                # defaults to Arbitrum
 *   bun packages/contracts/script/validate-eas-immutables.mjs --chain 11155111  # Sepolia
 */
import { createPublicClient, encodeFunctionData, http } from "viem";
import { arbitrum, celo, sepolia } from "viem/chains";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

// Known EAS addresses across chains — used to identify which _eas is baked in
const KNOWN_EAS = {
  "0xC2679fBD37d54388Ce493F1DB75320D236e1815e": "Sepolia (11155111)",
  "0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458": "Arbitrum (42161)",
  "0x72E1d8ccf5299fb36fEfD8CC4394B8ef7e98Af92": "Celo (42220)",
  "0xA1207F3BBa224E2c9c3c6D5aF63D0eb1582Ce587": "Mainnet (1)",
};

const CHAIN_MAP = { 42161: arbitrum, 11155111: sepolia, 42220: celo };
const DEFAULT_RPC = {
  42161: "https://arb1.arbitrum.io/rpc",
  11155111: "https://rpc.sepolia.org",
  42220: "https://forno.celo.org",
};

// SchemaResolver.attest(Attestation) ABI for probing _onlyEAS
const attestAbi = [{
  name: "attest", type: "function", stateMutability: "payable",
  inputs: [{
    name: "attestation", type: "tuple",
    components: [
      { name: "uid", type: "bytes32" },
      { name: "schema", type: "bytes32" },
      { name: "time", type: "uint64" },
      { name: "expirationTime", type: "uint64" },
      { name: "revocationTime", type: "uint64" },
      { name: "refUID", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "attester", type: "address" },
      { name: "revocable", type: "bool" },
      { name: "data", type: "bytes" },
    ],
  }],
  outputs: [{ type: "bool" }],
}];

function getDeepRevertData(error) {
  let cause = error;
  while (cause) {
    if (cause.data && typeof cause.data === "string" && cause.data.startsWith("0x"))
      return cause.data;
    cause = cause.cause;
  }
  return null;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let chainId = 42161; // default Arbitrum
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--chain" && args[i + 1]) {
      chainId = Number.parseInt(args[i + 1], 10);
    }
  }
  return { chainId };
}

async function probeEASAddress(client, proxyAddress, candidateEAS) {
  const calldata = encodeFunctionData({
    abi: attestAbi,
    functionName: "attest",
    args: [{
      uid: "0x" + "00".repeat(32),
      schema: "0x" + "00".repeat(32),
      time: 0n, expirationTime: 0n, revocationTime: 0n,
      refUID: "0x" + "00".repeat(32),
      recipient: "0x0000000000000000000000000000000000000001",
      attester: "0x0000000000000000000000000000000000000001",
      revocable: false, data: "0x",
    }],
  });

  try {
    await client.call({ to: proxyAddress, account: candidateEAS, data: calldata });
    return "passed"; // no revert — _onlyEAS passed (reverted later on business logic somehow didn't)
  } catch (e) {
    const data = getDeepRevertData(e);
    if (data && data.startsWith("0x4ca88867")) return "AccessDenied";
    return "other_revert"; // _onlyEAS passed, business logic reverted
  }
}

async function identifyBakedEAS(client, proxyAddress) {
  for (const [addr, label] of Object.entries(KNOWN_EAS)) {
    const result = await probeEASAddress(client, proxyAddress, addr);
    if (result !== "AccessDenied") {
      return { address: addr, label, result };
    }
  }
  return { address: "unknown", label: "Unknown (not a known chain EAS)", result: "AccessDenied" };
}

function checkDeployScriptFix() {
  const deployBasePath = path.join(__dirname, "../test/helpers/DeploymentBase.sol");
  if (!fs.existsSync(deployBasePath)) return { checked: false, reason: "file not found" };

  const content = fs.readFileSync(deployBasePath, "utf8");

  // The bug: upgradeTo inside _isDeployed guard. The fix: upgradeTo outside.
  // Check all 3 resolver deploy functions
  const resolverPatterns = [
    { name: "WorkResolver", fn: "_deployWorkResolver" },
    { name: "WorkApprovalResolver", fn: "_deployWorkApprovalResolver" },
    { name: "AssessmentResolver", fn: "_deployAssessmentResolver" },
  ];

  const results = [];
  for (const { name, fn } of resolverPatterns) {
    // Find the function body
    const fnStart = content.indexOf(`function ${fn}`);
    if (fnStart === -1) { results.push({ name, status: "not_found" }); continue; }

    // Extract ~60 lines after function start
    const snippet = content.slice(fnStart, fnStart + 2500);

    // Check: is upgradeTo INSIDE the _isDeployed block or OUTSIDE?
    const isDeployedIdx = snippet.indexOf("if (!_isDeployed(predicted))");
    const upgradeToIdx = snippet.indexOf("upgradeTo(address(implementation))");

    if (isDeployedIdx === -1 || upgradeToIdx === -1) {
      results.push({ name, status: "pattern_not_found" });
      continue;
    }

    // Find the closing brace of the _isDeployed block
    let braceDepth = 0;
    let blockEndIdx = -1;
    for (let i = snippet.indexOf("{", isDeployedIdx); i < snippet.length; i++) {
      if (snippet[i] === "{") braceDepth++;
      if (snippet[i] === "}") {
        braceDepth--;
        if (braceDepth === 0) { blockEndIdx = i; break; }
      }
    }

    const upgradeInsideGuard = upgradeToIdx < blockEndIdx;
    results.push({
      name,
      status: upgradeInsideGuard ? "VULNERABLE" : "FIXED",
      upgradeToIdx,
      blockEndIdx,
    });
  }

  return { checked: true, results };
}

async function main() {
  const { chainId } = parseArgs();
  const deploymentPath = path.join(__dirname, `../deployments/${chainId}-latest.json`);

  if (!fs.existsSync(deploymentPath)) {
    console.error(`Deployment artifact not found: ${deploymentPath}`);
    process.exit(2);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const expectedEAS = deployment.eas?.address;
  const chain = CHAIN_MAP[chainId];
  const rpcUrl = DEFAULT_RPC[chainId];

  if (!chain || !rpcUrl) {
    console.error(`Unsupported chain: ${chainId}`);
    process.exit(2);
  }

  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  const resolvers = {
    workResolver: deployment.workResolver,
    workApprovalResolver: deployment.workApprovalResolver,
    assessmentResolver: deployment.assessmentResolver,
  };

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║       EAS Immutable Address Validator            ║");
  console.log("╚══════════════════════════════════════════════════╝\n");
  console.log(`Chain:        ${chain.name} (${chainId})`);
  console.log(`Expected EAS: ${expectedEAS}`);
  console.log(`Deployment:   ${deploymentPath}\n`);

  // ── Part 1: Check _onlyEAS on each resolver ──
  console.log("── Part 1: Resolver _onlyEAS Check ──\n");

  let onChainIssues = 0;

  for (const [name, proxyAddress] of Object.entries(resolvers)) {
    if (!proxyAddress || /^0x0+$/.test(proxyAddress)) {
      console.log(`  ${name}: SKIP (not deployed)\n`);
      continue;
    }

    const code = await client.getCode({ address: proxyAddress });
    if (!code || code === "0x" || code.length <= 2) {
      console.log(`  ${name}: SKIP (no code at ${proxyAddress})\n`);
      continue;
    }

    // Read implementation address
    const implBytes = await client.getStorageAt({ address: proxyAddress, slot: IMPL_SLOT });
    const implAddress = "0x" + implBytes.slice(26);

    // Test: does _onlyEAS pass when called from expected EAS?
    const expectedResult = await probeEASAddress(client, proxyAddress, expectedEAS);
    const expectedPasses = expectedResult !== "AccessDenied";

    // Identify which EAS address is actually baked in
    let bakedEAS = null;
    if (!expectedPasses) {
      bakedEAS = await identifyBakedEAS(client, proxyAddress);
    }

    const status = expectedPasses ? "OK" : "FAIL";
    if (!expectedPasses) onChainIssues++;

    console.log(`  ${name}: ${proxyAddress}`);
    console.log(`    Proxy implementation: ${implAddress}`);
    console.log(`    _onlyEAS(${expectedEAS.slice(0, 10)}...): ${status}`);
    if (bakedEAS) {
      console.log(`    Baked _eas matches:   ${bakedEAS.address !== "unknown" ? bakedEAS.label + " (" + bakedEAS.address.slice(0, 10) + "...)" : bakedEAS.label}`);
    }
    console.log();
  }

  if (onChainIssues > 0) {
    console.log(`  ⚠  ${onChainIssues} resolver(s) have stale _eas immutable\n`);
  } else {
    console.log("  ✓  All resolvers have correct EAS configuration\n");
  }

  // ── Part 2: Check deploy script fix ──
  console.log("── Part 2: Deploy Script Fix ──\n");

  const scriptCheck = checkDeployScriptFix();
  let scriptIssues = 0;

  if (!scriptCheck.checked) {
    console.log(`  SKIP: ${scriptCheck.reason}\n`);
  } else {
    for (const r of scriptCheck.results) {
      const icon = r.status === "FIXED" ? "✓" : r.status === "VULNERABLE" ? "✗" : "?";
      console.log(`  ${icon} ${r.name}: ${r.status}`);
      if (r.status === "VULNERABLE") scriptIssues++;
    }
    console.log();

    if (scriptIssues > 0) {
      console.log(`  ⚠  ${scriptIssues} resolver deploy function(s) still have upgradeTo inside _isDeployed guard`);
      console.log("     Fix: move UUPSUpgradeable(predicted).upgradeTo(address(implementation)) outside the if block\n");
    } else {
      console.log("  ✓  All resolver deploy functions have upgradeTo outside _isDeployed guard\n");
    }
  }

  // ── Part 3: Summary ──
  console.log("── Summary ──\n");

  const totalIssues = onChainIssues + scriptIssues;

  if (totalIssues === 0) {
    console.log("  All checks passed. Resolvers and deploy script are correctly configured.");
  } else {
    if (onChainIssues > 0) {
      console.log("  On-chain fix required:");
      for (const [name] of Object.entries(resolvers)) {
        const slug = name.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "");
        console.log(`    bun script/upgrade.ts ${slug} --network ${chain.name.toLowerCase().replace(/ .*/,"")} --broadcast --override-sepolia-gate`);
      }
      console.log();
    }
    if (scriptIssues > 0) {
      console.log("  Code fix required:");
      console.log("    Move upgradeTo() outside if (!_isDeployed) in DeploymentBase.sol");
      console.log();
    }
  }

  process.exit(totalIssues > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
