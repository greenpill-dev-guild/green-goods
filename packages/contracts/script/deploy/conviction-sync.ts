import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { Contract, getAddress, JsonRpcProvider, keccak256 } from "ethers";
import {
  convictionSyncCalls,
  requireConvictionSyncReady,
  type GardenSyncState,
} from "../utils/conviction-sync-readiness";
import { HATS_DELEGATION } from "../utils/hats-delegation-release";

const GARDENS = "0x9d9F913eEeBAC1142E38E5276dE7c8bc9Cf7a183";
const SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const abi = [
  "function getGardenCommunity(address) view returns(address)",
  "function getGardenPowerRegistry(address) view returns(address)",
  "function getGardenSignalPools(address) view returns(address[])",
  "function getConvictionStrategies(address) view returns(address[])",
  "function registryCommunity() view returns(address)",
  "function votingPowerRegistry() view returns(address)",
  "function councilSafe() view returns(address)",
  "function isAuthorizedSyncCaller(address) view returns(bool)",
  "function getThreshold() view returns(uint256)",
];

async function main() {
  const { values } = parseArgs({
    strict: true,
    options: {
      "plan-only": { type: "boolean" },
      verify: { type: "boolean" },
      output: { type: "string" },
      garden: { type: "string", multiple: true },
      block: { type: "string" },
      "expected-implementation": { type: "string" },
      "expected-runtime-hash": { type: "string" },
    },
  });
  assert.equal([values["plan-only"], values.verify].filter(Boolean).length, 1, "select plan or verify");
  assert.match(values.block ?? "", /^[1-9][0-9]*$/, "an explicit proof block is required");
  const runtimeHash = values["expected-runtime-hash"];
  assert(runtimeHash, "use the reviewed release runtime hash");
  assert.match(runtimeHash, /^0x[0-9a-fA-F]{64}$/, "use the reviewed release runtime hash");
  assert(values["expected-implementation"], "use the reviewed release implementation");
  assert(values.garden?.length, "provide at least one garden");
  const gardens = values.garden.map(getAddress);
  assert.equal(new Set(gardens).size, gardens.length, "duplicate garden");
  const provider = new JsonRpcProvider(
    process.env.ARBITRUM_RPC_URL ?? "https://arb-mainnet.g.alchemy.com/public",
    42161,
    { staticNetwork: true, batchMaxCount: 1 },
  );
  try {
    assert.equal(BigInt(await provider.send("eth_chainId", [])), 42161n);
    const block = await provider.getBlock(Number(values.block));
    assert(block?.hash, "proof block unavailable");
    const at = { blockTag: block.number };
    const implementation = getAddress(
      `0x${(await provider.getStorage(HATS_DELEGATION.module, SLOT, block.number)).slice(-40)}`,
    );
    assert.equal(implementation, getAddress(values["expected-implementation"]), "Hats upgrade is not active");
    const runtime = await provider.getCode(implementation, block.number);
    assert.notEqual(runtime, "0x", "Hats implementation has no code");
    assert.equal(
      keccak256(runtime),
      runtimeHash.toLowerCase(),
      "Hats runtime differs from the reviewed gas-bound release",
    );
    assert.equal(
      await new Contract(HATS_DELEGATION.safe, abi, provider).getThreshold(at),
      2n,
      "review changed Safe policy",
    );
    const module = new Contract(HATS_DELEGATION.module, abi, provider);
    const registry = new Contract(GARDENS, abi, provider);
    const states: GardenSyncState[] = [];
    for (const garden of gardens) {
      const [community, powerRegistry, pools, registeredStrategies] = await Promise.all([
        registry.getGardenCommunity(garden, at),
        registry.getGardenPowerRegistry(garden, at),
        registry.getGardenSignalPools(garden, at),
        module.getConvictionStrategies(garden, at),
      ]);
      const poolStates = await Promise.all(
        Array.from(pools, String).map(async (address) => {
          const pool = new Contract(address, abi, provider);
          const [community, powerRegistry, authorized] = await Promise.all([
            pool.registryCommunity(at),
            pool.votingPowerRegistry(at),
            pool.isAuthorizedSyncCaller(HATS_DELEGATION.module, at),
          ]);
          const council = await new Contract(community, abi, provider).councilSafe(at);
          return { address, community, powerRegistry, council, authorized };
        }),
      );
      states.push({
        garden,
        community,
        powerRegistry,
        registeredStrategies: Array.from(registeredStrategies, String),
        pools: poolStates,
      });
    }
    const transactions = states.flatMap((state) =>
      convictionSyncCalls(state, HATS_DELEGATION.module, HATS_DELEGATION.safe),
    );
    if (values.verify)
      states.forEach((state) => requireConvictionSyncReady(state, HATS_DELEGATION.module, HATS_DELEGATION.safe));
    else {
      assert(values.output, "plan requires a private output directory");
      fs.mkdirSync(values.output, { recursive: true, mode: 0o700 });
      const write = (name: string, data: unknown) =>
        fs.writeFileSync(path.join(values.output!, name), JSON.stringify(data, null, 2) + "\n", {
          flag: "wx",
          mode: 0o600,
        });
      write("readback.json", { proofBlock: { number: block.number, hash: block.hash }, implementation, states });
      if (transactions.length)
        write("authorize-sync.safe.json", {
          version: "1.0",
          chainId: "42161",
          createdAt: block.timestamp * 1000,
          meta: {
            name: "Garden conviction sync authorization",
            txBuilderVersion: "1.18.0",
            createdFromSafeAddress: HATS_DELEGATION.safe,
          },
          transactions: transactions.map((tx) => ({ ...tx, contractMethod: null, contractInputsValues: null })),
        });
    }
    console.log(
      JSON.stringify({
        status: values.verify ? "sync-ready" : "review-only",
        proofBlock: block.number,
        gardens: states.length,
        pendingAuthorizations: transactions.length,
        broadcast: false,
      }),
    );
  } finally {
    provider.destroy();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
