#!/usr/bin/env bun
/**
 * Validates whether EAS resolver proxies on Arbitrum have the correct _eas immutable.
 *
 * Root cause: DeploymentBase._deploy*Resolver() had upgradeTo() inside an
 * `if (!_isDeployed)` guard — if the proxy already existed from a prior run,
 * the implementation (and its immutable _eas) was never updated.
 *
 * Usage: bun packages/contracts/script/validate-resolver-eas.mjs
 */
import { createPublicClient, http, encodeFunctionData } from "viem";
import { arbitrum } from "viem/chains";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEPLOYMENT_PATH = path.join(__dirname, "../deployments/42161-latest.json");
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

// SchemaResolver.attest(Attestation) ABI
const attestAbi = [{
  name: "attest",
  type: "function",
  stateMutability: "payable",
  inputs: [{
    name: "attestation",
    type: "tuple",
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

async function main() {
  // Load deployment artifact
  const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_PATH, "utf8"));
  const easAddress = deployment.eas.address;

  const resolvers = {
    workResolver: deployment.workResolver,
    workApprovalResolver: deployment.workApprovalResolver,
    assessmentResolver: deployment.assessmentResolver,
  };

  console.log("=== EAS Resolver Validation (Arbitrum) ===\n");
  console.log(`Expected EAS address: ${easAddress}`);
  console.log(`Deployment artifact:  ${DEPLOYMENT_PATH}\n`);

  const client = createPublicClient({
    chain: arbitrum,
    transport: http("https://arb1.arbitrum.io/rpc"),
  });

  const dummyCalldata = encodeFunctionData({
    abi: attestAbi,
    functionName: "attest",
    args: [{
      uid: "0x" + "00".repeat(32),
      schema: "0x" + "00".repeat(32),
      time: 0n, expirationTime: 0n, revocationTime: 0n,
      refUID: "0x" + "00".repeat(32),
      recipient: "0x0000000000000000000000000000000000000001",
      attester: "0x0000000000000000000000000000000000000001",
      revocable: false,
      data: "0x",
    }],
  });

  let allPassed = true;

  for (const [name, proxyAddress] of Object.entries(resolvers)) {
    if (!proxyAddress || proxyAddress === "0x" + "0".repeat(40)) {
      console.log(`  ${name}: SKIP (not deployed)\n`);
      continue;
    }

    // Read current implementation
    const implBytes = await client.getStorageAt({ address: proxyAddress, slot: IMPL_SLOT });
    const implAddress = "0x" + implBytes.slice(26);

    // Call resolver.attest() from the expected EAS address
    let easCheckPassed = false;
    let revertSelector = null;

    try {
      await client.call({ to: proxyAddress, account: easAddress, data: dummyCalldata });
      easCheckPassed = true; // No revert at all (unlikely with dummy data, but OK)
    } catch (e) {
      const data = getDeepRevertData(e);
      if (data && data.startsWith("0x4ca88867")) {
        // 0x4ca88867 = AccessDenied() — _onlyEAS check failed
        easCheckPassed = false;
        revertSelector = "AccessDenied()";
      } else {
        // Reverted for a different reason — _onlyEAS passed, business logic failed
        easCheckPassed = true;
        revertSelector = data ? data.slice(0, 10) : "unknown";
      }
    }

    const status = easCheckPassed ? "OK" : "FAIL";
    if (!easCheckPassed) allPassed = false;

    console.log(`  ${name}: ${proxyAddress}`);
    console.log(`    implementation: ${implAddress}`);
    console.log(`    _onlyEAS check: ${status}${revertSelector ? ` (${revertSelector})` : ""}`);

    if (!easCheckPassed) {
      console.log(`    FIX: bun script/upgrade.ts ${name.replace(/([A-Z])/g, "-$1").toLowerCase().replace(/^-/, "")} --network arbitrum --broadcast`);
    }
    console.log();
  }

  console.log(allPassed
    ? "All resolvers have correct EAS configuration."
    : "One or more resolvers need upgrading. Run:\n  bun script/upgrade.ts all --network arbitrum --broadcast"
  );

  process.exit(allPassed ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
