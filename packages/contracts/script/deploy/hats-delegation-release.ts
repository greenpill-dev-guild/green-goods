import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes } from "ethers";
import { CONTRACTS_ROOT, getFoundryOutDir } from "../utils/paths";
import {
  buildHatsDelegationPlan,
  hatsDelegationBuilderFiles,
  HATS_DELEGATION,
  DELEGATION_CALLS,
  type DelegationArtifact,
  type HatsDelegationPlan,
} from "../utils/hats-delegation-release";

const SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const READ_ABI = [
  "function owner() view returns(address)",
  "function nonce() view returns(uint256)",
  "function getThreshold() view returns(uint256)",
  "function canCall(address,address,bytes4) view returns(bool,uint32)",
  "function getGardenHatIds(address) view returns(uint256,uint256,uint256,uint256,uint256,uint256,uint256,bool)",
  "function protocolRoleHats() view returns(uint256,uint256,uint256,uint256)",
  "function gardensHatId() view returns(uint256)",
  "function isAdminOfHat(address,uint256) view returns(bool)",
  "function viewHat(uint256) view returns(string,uint32,uint32,address,address,string,uint16,bool,bool)",
];

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    strict: true,
    options: {
      preflight: { type: "boolean" },
      "plan-only": { type: "boolean" },
      verify: { type: "boolean" },
      output: { type: "string" },
      "safe-nonce": { type: "string" },
      block: { type: "string" },
      plan: { type: "string" },
    },
  });
  assert.equal([values.preflight, values["plan-only"], values.verify].filter(Boolean).length, 1, "select one mode");
  const artifactPath = path.join(getFoundryOutDir("production"), "Hats.sol/HatsModule.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as DelegationArtifact & {
    metadata: {
      compiler: { version: string };
      settings: { viaIR: boolean; optimizer: { enabled: boolean; runs: number }; evmVersion: string };
      sources: Record<string, { keccak256: string }>;
    };
  };
  assert(artifact.metadata.compiler.version.startsWith("0.8.28+"), "unexpected Solidity compiler");
  assert.equal(artifact.metadata.settings.viaIR, true, "production requires viaIR");
  assert.deepEqual(artifact.metadata.settings.optimizer, { enabled: true, runs: 1 }, "unexpected production optimizer");
  assert.equal(artifact.metadata.settings.evmVersion, "cancun", "unexpected production EVM");
  assert.equal(
    artifact.metadata.sources["src/modules/Hats.sol"].keccak256,
    keccak256(toUtf8Bytes(fs.readFileSync(path.join(CONTRACTS_ROOT, "src/modules/Hats.sol"), "utf8"))),
    "production artifact does not match current HatsModule source",
  );
  if (values.preflight) {
    console.log(
      JSON.stringify({
        status: "artifact-checked",
        artifact: path.relative(CONTRACTS_ROOT, artifactPath),
        broadcast: false,
      }),
    );
    return;
  }
  const provider = new JsonRpcProvider(
    process.env.ARBITRUM_RPC_URL ?? "https://arb-mainnet.g.alchemy.com/public",
    42161,
    { staticNetwork: true, batchMaxCount: 1 },
  );
  try {
    const network = await provider.send("eth_chainId", []);
    assert.equal(BigInt(network), 42161n, "wrong RPC chain");
    const safe = new Contract(HATS_DELEGATION.safe, READ_ABI, provider);
    const module = new Contract(HATS_DELEGATION.module, READ_ABI, provider);
    if (values.verify) {
      assert.equal(await safe.getThreshold(), 2n, "Safe threshold changed");
      assert(values.plan, "verify requires --plan");
      const plan = JSON.parse(fs.readFileSync(values.plan, "utf8")) as HatsDelegationPlan;
      const rebuilt = buildHatsDelegationPlan({
        artifact,
        sourceCommit: plan.sourceCommit,
        safeNonce: plan.calls[0].nonce,
        blockNumber: plan.proofBlock.number,
        blockHash: plan.proofBlock.hash,
        currentImplementation: plan.previousImplementation,
        governanceDelay: plan.governanceDelay,
      });
      assert.deepEqual(plan, rebuilt, "reviewed plan was changed");
      assert.equal(
        keccak256(await provider.getCode(plan.implementation)),
        plan.runtimeHash,
        "implementation runtime mismatch",
      );
      assert.equal(
        (await provider.getStorage(plan.module, SLOT)).slice(-40).toLowerCase(),
        plan.implementation.slice(2).toLowerCase(),
      );
      assert.equal((await module.owner()).toLowerCase(), plan.manager.toLowerCase());
      assert.deepEqual(
        Array.from(await module.protocolRoleHats(), String),
        plan.roles.map((hat) => BigInt(hat).toString()),
      );
      const core = new Contract(HATS_DELEGATION.hats, READ_ABI, provider);
      for (const hat of plan.roles) {
        const properties = await core.viewHat(hat);
        assert.equal(
          properties[3].toLowerCase(),
          plan.manager.toLowerCase(),
          "protocol eligibility controller mismatch",
        );
        assert.equal(properties[4].toLowerCase(), plan.manager.toLowerCase(), "protocol toggle controller mismatch");
      }
      const gardensHat = await core.viewHat(await module.gardensHatId());
      assert.equal(gardensHat[4].toLowerCase(), plan.manager.toLowerCase(), "Gardens toggle controller mismatch");
      const inventory = JSON.parse(
        fs.readFileSync(path.join(CONTRACTS_ROOT, "test/fixtures/hats-delegation-arbitrum.json"), "utf8"),
      ) as { gardens: { garden: string; ownerHat: string; stewardHat: string; gardenerHat: string }[] };
      assert.equal(inventory.gardens.length, 18);
      for (const row of inventory.gardens) {
        const ids = await module.getGardenHatIds(row.garden);
        assert(
          ids[7] &&
            ids[0] === BigInt(row.ownerHat) &&
            ids[1] === BigInt(row.stewardHat) &&
            ids[3] === BigInt(row.gardenerHat),
          "garden configuration mismatch",
        );
        assert.equal(
          await core.isAdminOfHat(row.garden, ids[0]),
          false,
          "garden account retains raw Hats administration",
        );
      }
      console.log(
        JSON.stringify({
          status: "activation-state-verified",
          receiptVerification: "required-separately",
          broadcast: false,
        }),
      );
      return;
    }
    assert(values.output && values["safe-nonce"], "plan requires --output and --safe-nonce");
    assert.match(values["safe-nonce"], /^(0|[1-9][0-9]*)$/);
    const sourceCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: CONTRACTS_ROOT, encoding: "utf8" }).trim();
    assert.equal(
      execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
        cwd: CONTRACTS_ROOT,
        encoding: "utf8",
      }).trim(),
      "",
      "freeze a clean signed source revision before planning",
    );
    execFileSync("git", ["verify-commit", sourceCommit], { cwd: CONTRACTS_ROOT, stdio: "pipe" });
    const block = await provider.getBlock(values.block ? Number(values.block) : "latest");
    assert(block?.hash, "proof block unavailable");
    const at = { blockTag: block.number };
    assert.equal(await safe.getThreshold(at), 2n, "reviewed Safe must retain two signatures");
    assert.equal(
      (await module.owner(at)).toLowerCase(),
      HATS_DELEGATION.manager.toLowerCase(),
      "module controller changed",
    );
    assert.equal(
      (await provider.getCode(HATS_DELEGATION.factory, block.number)).toLowerCase(),
      HATS_DELEGATION.factoryRuntime,
      "deterministic factory code mismatch",
    );
    const manager = new Contract(HATS_DELEGATION.manager, READ_ABI, provider);
    const [immediate, delay] = await manager.canCall(
      HATS_DELEGATION.safe,
      HATS_DELEGATION.module,
      DELEGATION_CALLS.getFunction("upgradeToAndCall")!.selector,
      at,
    );
    assert(!immediate && delay > 0n, "review the changed governance execution policy");
    const plan = buildHatsDelegationPlan({
      artifact,
      sourceCommit,
      safeNonce: Number(values["safe-nonce"]),
      blockNumber: block.number,
      blockHash: block.hash,
      currentImplementation: `0x${(await provider.getStorage(HATS_DELEGATION.module, SLOT, block.number)).slice(-40)}`,
      governanceDelay: Number(delay),
    });
    for (const operation of plan.operations) {
      const [canExecuteNow, operationDelay] = await manager.canCall(
        HATS_DELEGATION.safe,
        operation.target,
        operation.data.slice(0, 10),
        at,
      );
      assert(!canExecuteNow && operationDelay === delay, "review the changed operation authorization or delay");
    }
    const core = new Contract(HATS_DELEGATION.hats, READ_ABI, provider);
    for (const hat of HATS_DELEGATION.roles) {
      const properties = await core.viewHat(hat, at);
      assert(properties[7] === true, "a protocol role is immutable; review a separate migration");
      assert.equal(
        await core.isAdminOfHat(HATS_DELEGATION.manager, hat, at),
        true,
        "Safe governance cannot administer a protocol Hat",
      );
    }
    assert(plan.calls[0].nonce >= Number(await safe.nonce(at)), "Safe nonce already executed");
    assert.equal(
      await provider.getCode(plan.implementation, block.number),
      "0x",
      "implementation exists: review adoption before export",
    );
    const directory = path.resolve(values.output);
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    fs.writeFileSync(path.join(directory, "plan.json"), `${JSON.stringify(plan, null, 2)}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    for (const file of hatsDelegationBuilderFiles(plan, Date.now())) {
      fs.writeFileSync(path.join(directory, file.filename), `${JSON.stringify(file.content, null, 2)}\n`, {
        mode: 0o600,
        flag: "wx",
      });
    }
    console.log(
      JSON.stringify({
        status: "review-only",
        sourceCommit,
        implementation: plan.implementation,
        nonces: plan.calls.map((call) => call.nonce),
        governanceDelay: plan.governanceDelay,
        output: directory,
        broadcast: false,
      }),
    );
  } finally {
    provider.destroy();
  }
}

if (import.meta.main)
  main().catch(() => {
    // RPC errors can contain credential-bearing URLs; do not print their raw messages.
    console.error(
      "Hats delegation preparation failed; review source, artifact, chain, governance, nonce and output prerequisites. No broadcast was attempted.",
    );
    process.exitCode = 1;
  });
