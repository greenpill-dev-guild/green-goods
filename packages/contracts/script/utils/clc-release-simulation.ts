import { Contract, getAddress, id, JsonRpcProvider, keccak256, toQuantity, ZeroAddress } from "ethers";
import {
  CLC_DEPENDENCIES,
  CLC_FACTORY_ABI,
  CLC_FACTORY_INIT_CODE_HASH,
  CLC_FEE_POLICY_ABI,
  CLC_INDEX_ABI,
  CLC_LIMITER_ABI,
  CLC_POOL_ABI,
  CLC_PROTOCOL_FEE_ABI,
  CLC_QUOTER_ABI,
  CLC_TIMELOCK_ABI,
  CLC_TOKEN_ABI,
  type CLCPilotManifest,
  type CLCPilotPlan,
  validateCLCPilotPlan,
} from "./clc-release";
import { assertIsolatedRpc, maskImmutableRuntime, minedIsolatedReceipt, startIsolatedFork } from "./isolated-fork";
import type { VoucherArtifact } from "./voucher-release";

const SENTINEL = "0x0000000000000000000000000000000000000001";
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const GUARD_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";
const HSG = "0x148057884AC910Bdd93693F230C5c35a8c47CA3b";
const HSG_RUNTIME_HASH = "0x7c1917a3082780bda5fbba9cbfdae8ac9d74487ede6ca42c249bc03a20f0531d";
const SAFE_SINGLETON = "0x29fcB43b46531BcA003ddC8FCB67FFE91900C762";
const SAFE_SINGLETON_HASH = "0xb1f926978a0f44a2c0ec8fe822418ae969bd8c3f18d61e5103100339894f81ff";
const SAFE_ABI = [
  "function getThreshold() view returns(uint256)",
  "function getOwners() view returns(address[])",
  "function getModulesPaginated(address,uint256) view returns(address[],address)",
];

function equal(actual: unknown, expected: unknown, label: string) {
  if (String(actual).toLowerCase() !== String(expected).toLowerCase())
    throw new Error(`CLC simulation ${label} mismatch`);
}
const storedAddress = (word: string) => getAddress(`0x${word.slice(-40)}`);

async function readSafeState(provider: JsonRpcProvider, address: string) {
  if ((await provider.getCode(address)) === "0x") throw new Error("CLC issuer Safe is not deployed");
  const safe = new Contract(address, SAFE_ABI, provider);
  const threshold = Number(await safe.getThreshold());
  const owners: string[] = await safe.getOwners();
  if (
    owners.length === 0 ||
    new Set(owners.map((owner) => getAddress(owner))).size !== owners.length ||
    owners.some((owner) => BigInt(owner) <= 1n) ||
    threshold < 1 ||
    threshold > owners.length
  )
    throw new Error("Invalid CLC issuer Safe owner state");
  return { safe, threshold, owners };
}

export async function verifyGreenGoodsAuthority(provider: JsonRpcProvider, address: string) {
  const { threshold, owners } = await readSafeState(provider, address);
  equal(threshold, 2, "existing Green Goods threshold");
  equal(owners.length, 5, "existing Green Goods owner count");
  return { address, physicalThreshold: threshold, effectiveThreshold: threshold, owners: owners.length };
}

/** Read the fixed-two steward authority even when physical Safe ownership changes. */
export async function verifyTechSunAuthority(provider: JsonRpcProvider, address: string) {
  const { safe, threshold, owners } = await readSafeState(provider, address);
  const gateAddress = storedAddress(await provider.getStorage(address, GUARD_SLOT));
  if (BigInt(gateAddress) <= 1n) throw new Error("Tech and Sun Safe requires the reviewed HSG guard");
  equal(
    await provider.getCode(gateAddress),
    `0x363d3d373d3d3d363d73${HSG.slice(2).toLowerCase()}5af43d82803e903d91602b57fd5bf3`,
    "reviewed HSG module proxy",
  );
  equal(storedAddress(await provider.getStorage(address, "0x0")), SAFE_SINGLETON, "HSG Safe singleton");
  equal(keccak256(await provider.getCode(SAFE_SINGLETON)), SAFE_SINGLETON_HASH, "reviewed Safe singleton");
  equal(keccak256(await provider.getCode(HSG)), HSG_RUNTIME_HASH, "reviewed HSG implementation");
  const gate = new Contract(
    gateAddress,
    [
      "function implementation() view returns(address)",
      "function safe() view returns(address)",
      "function locked() view returns(bool)",
      "function claimableFor() view returns(bool)",
      "function thresholdConfig() view returns(uint8,uint120,uint120)",
      "function validSignerCount() view returns(uint256)",
      "function isValidSigner(address) view returns(bool)",
      "function getModulesPaginated(address,uint256) view returns(address[],address)",
      "function enabledDelegatecallTargets(address) view returns(bool)",
    ],
    provider,
  );
  equal(await gate.implementation(), HSG, "HSG implementation");
  equal(await gate.safe(), address, "HSG Safe binding");
  equal(await gate.locked(), true, "irreversibly locked HSG");
  equal(await gate.claimableFor(), true, "permissionless steward reconciliation");
  const config = await gate.thresholdConfig();
  equal(config[0], 0, "absolute HSG threshold");
  equal(config[1], 2, "HSG minimum signatures");
  equal(config[2], 2, "HSG target signatures");
  const validSigners = Number(await gate.validSignerCount());
  let validOwners = 0;
  for (const owner of owners) if (await gate.isValidSigner(owner)) validOwners++;
  equal(validSigners, validOwners, "HSG valid owner count");
  // HSG v2 caps the physical threshold at owner count while its guard still
  // requires ABSOLUTE two valid signatures. Fully reconcile stale owners first.
  if (validSigners === 0) {
    equal(owners.length, 1, "HSG bootstrap owner count");
    equal(owners[0], gateAddress, "HSG bootstrap placeholder");
  } else {
    equal(validOwners, owners.length, "fully reconciled steward owners");
  }
  equal(threshold, Math.min(owners.length, 2), "HSG physical threshold");
  const [modules, next] = await safe.getModulesPaginated(SENTINEL, 2);
  equal(modules.length, 1, "sole HSG module count");
  equal(modules[0], gateAddress, "sole HSG module");
  equal(next, SENTINEL, "Safe module list end");
  const [submodules, nextSubmodule] = await gate.getModulesPaginated(SENTINEL, 1);
  equal(submodules.length, 0, "no HSG submodules");
  equal(nextSubmodule, SENTINEL, "HSG module list end");
  for (const target of [
    "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D",
    "0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B",
    "0x9641d764fc13c8B624c04430C7356C1C7C8102e2",
  ])
    equal(await gate.enabledDelegatecallTargets(target), false, "disabled default HSG delegatecall target");
  return {
    address,
    physicalThreshold: threshold,
    effectiveThreshold: 2,
    owners: owners.length,
    validSigners,
    gate: gateAddress,
    spendingEnabled: validSigners >= 2,
  };
}

export async function verifyTimelock(provider: JsonRpcProvider, address: string, safe: string, deployer: string) {
  const timelock = new Contract(address, CLC_TIMELOCK_ABI, provider);
  equal(await timelock.getMinDelay(), 0, "upgrade delay");
  const admin = await timelock.TIMELOCK_ADMIN_ROLE();
  equal(admin, id("TIMELOCK_ADMIN_ROLE"), "timelock admin role");
  equal(await timelock.hasRole(admin, address), true, "timelock self administration");
  equal(await timelock.hasRole(admin, deployer), false, "deployer has no timelock administration");
  equal(await timelock.hasRole(admin, safe), false, "Safe has no bypass admin role");
  for (const role of [id("PROPOSER_ROLE"), id("EXECUTOR_ROLE"), id("CANCELLER_ROLE")]) {
    equal(await timelock.hasRole(role, safe), true, "issuer Safe timelock role");
    equal(await timelock.hasRole(role, deployer), false, "deployer has no timelock role");
    equal(await timelock.hasRole(role, ZeroAddress), false, "closed timelock role");
  }
}

export async function verifyEmptyState(
  provider: JsonRpcProvider,
  plan: CLCPilotPlan,
  manifest: CLCPilotManifest & { deployer: string; techAndSunSafe: string },
) {
  const a = plan.addresses;
  const owner = manifest.greenGoodsSafe;
  const tokens = [a.greenGoodsToken, a.techAndSunToken];
  for (const [index, issuer] of ["greenGoods", "techAndSun"].entries()) {
    const token = new Contract(tokens[index], CLC_TOKEN_ABI, provider);
    const safe = issuer === "greenGoods" ? owner : manifest.techAndSunSafe;
    equal(await token.owner(), safe, `${issuer} issuer owner`);
    equal(await token.name(), manifest.issuers[issuer as "greenGoods" | "techAndSun"].name, "token name");
    equal(await token.symbol(), manifest.issuers[issuer as "greenGoods" | "techAndSun"].symbol, "token symbol");
    equal(await token.decimals(), manifest.decimals, "token decimals");
    // Expiry zero is bound in the atomic initializer; no undocumented getter is assumed.
    equal(await token.expired(), false, "token not expired");
    equal(await token.totalSupply(), 0, "zero initial token supply");
    equal(await token.totalMinted(), 0, "no historical minting");
    equal(await token.totalBurned(), 0, "no historical burning");
    equal(await token.isWriter(safe), true, "issuer is writer");
    equal(await token.isWriter(manifest.deployer), false, "deployer has no mint authority");
    if (manifest.earnedAdapter)
      equal(await token.isWriter(manifest.earnedAdapter), false, "adapter has no mint authority");
    for (const account of [owner, manifest.techAndSunSafe, a.pool]) {
      equal(await token.balanceOf(account), 0, "empty issuer/pool token balance");
      equal(await token.allowance(account, a.pool), 0, "no pool token allowance");
    }
  }
  const pool = new Contract(a.pool, CLC_POOL_ABI, provider);
  const index = new Contract(a.index, CLC_INDEX_ABI, provider);
  const limiter = new Contract(a.limiter, CLC_LIMITER_ABI, provider);
  const quoter = new Contract(a.quoter, CLC_QUOTER_ABI, provider);
  const fee = new Contract(a.feePolicy, CLC_FEE_POLICY_ABI, provider);
  const protocol = new Contract(a.protocolFee, CLC_PROTOCOL_FEE_ABI, provider);
  for (const component of [pool, index, limiter, quoter, fee, protocol])
    equal(await component.owner(), owner, "Green Goods pool administration");
  for (const [getter, expected] of Object.entries({
    feePolicy: a.feePolicy,
    feeAddress: owner,
    tokenRegistry: a.index,
    tokenLimiter: a.limiter,
    quoter: a.quoter,
    protocolFeeController: a.protocolFee,
  }))
    equal(await pool[getter](), expected, `pool ${getter}`);
  equal(await pool.name(), manifest.pool.name, "pool name");
  equal(await pool.symbol(), manifest.pool.symbol, "pool symbol");
  equal(await pool.decimals(), manifest.decimals, "pool decimals");
  equal(await pool.feesDecoupled(), true, "decoupled fees");
  equal(await pool.isSealed(0), false, "configuration remains unsealed");
  equal(await index.entryCount(), 0, "empty token registry");
  equal(await index.identifierCount(), 0, "empty symbol registry");
  equal(await index.isWriter(manifest.deployer), false, "no deployer registry authority");
  equal(await limiter.isWriter(owner), true, "limiter owner is writer");
  equal(await limiter.isWriter(manifest.deployer), false, "no deployer limiter authority");
  equal(await fee.getDefaultFee(), 0, "zero default pool fee");
  equal(await protocol.getProtocolFee(), 0, "zero protocol fee");
  equal(await protocol.getProtocolFeeRecipient(), owner, "protocol fee recipient");
  equal(await protocol.isActive(), true, "initialized zero-rate protocol fee controller");
  for (const token of tokens) {
    equal(await index.have(token), false, "unregistered pilot token");
    equal(await limiter.limitOf(token, a.pool), 0, "zero pool deposit limit");
    equal(await pool.fees(token), 0, "zero accrued pool fees");
  }
  const unit = 10n ** BigInt(manifest.decimals);
  for (const [input, output] of [tokens, [...tokens].reverse()]) {
    equal(await quoter.valueFor(output, input, unit), unit, "default one-to-one quote");
    equal(await quoter.reverseValueFor(output, input, unit), unit, "default reverse quote");
    equal(await pool.getQuote(output, input, unit), unit, "pool quote");
    equal(await fee.getFee(input, output), 0, "zero pilot pair fee");
  }
  equal(await provider.getBalance(a.pool), 0, "no native pool funding");
}

/** Rehearses only the ten preparation transactions on a new, process-owned fork. */
export async function simulateCLCPilotPlan(
  plan: CLCPilotPlan,
  manifest: CLCPilotManifest,
  timelockArtifact: VoucherArtifact,
  upstream: string,
) {
  validateCLCPilotPlan(plan, manifest, timelockArtifact, plan.sourceCommit);
  const { deployer, nonce, techAndSunSafe } = manifest;
  if (deployer === null || nonce === null || techAndSunSafe === null) throw new Error("Missing CLC deployment inputs");
  const fork = await startIsolatedFork(upstream, 100);
  let provider: JsonRpcProvider | undefined;
  try {
    assertIsolatedRpc(fork.rpc);
    provider = new JsonRpcProvider(fork.rpc, undefined, { cacheTimeout: -1, batchStallTime: 0 });
    equal((await provider.getNetwork()).chainId, 100, "fork chain");
    if ((await provider.getCode(deployer)) !== "0x")
      throw new Error("CLC preparation requires a dedicated EOA deployer without contract code");
    for (const tag of ["latest", "pending"])
      equal(Number(await provider.send("eth_getTransactionCount", [deployer, tag])), nonce, `${tag} nonce`);
    for (const [name, pin] of Object.entries(CLC_DEPENDENCIES))
      equal(keccak256(await provider.getCode(pin.address)), pin.runtimeHash, `${name} dependency runtime hash`);
    const factory = new Contract(CLC_DEPENDENCIES.factory.address, CLC_FACTORY_ABI, provider);
    equal(await factory.initCodeHash(), CLC_FACTORY_INIT_CODE_HASH, "factory proxy init code hash");
    for (const tx of plan.transactions) {
      equal(await provider.getCode(tx.address), "0x", `${tx.component} unused deployment address`);
      if (tx.kind === "proxy")
        equal(await factory.predictDeterministicAddress(tx.salt), tx.address, `${tx.component} factory prediction`);
    }
    const safes = {
      greenGoods: await verifyGreenGoodsAuthority(provider, manifest.greenGoodsSafe),
      techAndSun: await verifyTechSunAuthority(provider, techAndSunSafe),
    };
    // Upstream RPCs never receive impersonation, funding or transactions.
    await provider.send("anvil_impersonateAccount", [deployer]);
    await provider.send("anvil_setBalance", [deployer, toQuantity(100n * 10n ** 18n)]);
    const rows = [];
    for (const tx of plan.transactions) {
      equal(Number(await provider.send("eth_getTransactionCount", [tx.from, "pending"])), tx.nonce, "boundary nonce");
      const request = { from: tx.from, ...(tx.to ? { to: tx.to } : {}), data: tx.data, value: "0x0" };
      const gas = await provider.estimateGas(request);
      const hash = await provider.send("eth_sendTransaction", [
        { ...request, nonce: toQuantity(tx.nonce), gas: toQuantity((gas * 130n + 99n) / 100n) },
      ]);
      const receipt = await minedIsolatedReceipt(provider, hash);
      if (receipt.status !== 1) throw new Error(`CLC preparation deployment reverted: ${tx.component}`);
      const code = await provider.getCode(tx.address);
      if (code === "0x") throw new Error(`Missing CLC deployment code: ${tx.component}`);
      if (tx.kind === "timelock") {
        equal(receipt.contractAddress, tx.address, "timelock CREATE address");
        equal(
          keccak256(maskImmutableRuntime(code, timelockArtifact.deployedBytecode.immutableReferences)),
          keccak256(
            maskImmutableRuntime(
              `0x${timelockArtifact.deployedBytecode.object.replace(/^0x/, "")}`,
              timelockArtifact.deployedBytecode.immutableReferences,
            ),
          ),
          "reviewed timelock runtime",
        );
        await verifyTimelock(
          provider,
          tx.address,
          tx.component === "greenGoodsTimelock" ? manifest.greenGoodsSafe : techAndSunSafe,
          tx.from,
        );
      } else {
        equal(await factory.adminOf(tx.address), tx.admin, "proxy timelock admin");
        equal(
          storedAddress(await provider.getStorage(tx.address, IMPLEMENTATION_SLOT)),
          tx.implementation,
          "proxy implementation",
        );
        let rejected = false;
        try {
          await provider.call({ from: tx.from, to: tx.address, data: tx.initializer });
        } catch {
          rejected = true;
        }
        if (!rejected) throw new Error(`Initialized CLC proxy accepted reinitialization: ${tx.component}`);
      }
      rows.push({
        component: tx.component,
        address: tx.address,
        transactionHash: hash,
        gasUsed: String(receipt.gasUsed),
        runtimeHash: keccak256(code),
      });
    }
    await verifyEmptyState(provider, plan, { ...manifest, deployer, techAndSunSafe });
    equal(
      Number(await provider.send("eth_getTransactionCount", [deployer, "latest"])),
      nonce + 10,
      "final deployment nonce",
    );
    return {
      kind: "CLC_PILOT_PREPARATION_FORK_SIMULATION",
      sourceCommit: plan.sourceCommit,
      manifestHash: plan.manifestHash,
      chainId: 100,
      forkBlock: fork.forkBlock,
      forkBlockHash: fork.forkBlockHash,
      rows,
      safes,
      gasFunding: "synthetic local balance; live deployer funding not proved",
      liveBroadcast: false,
      activationIncluded: false,
      transportDelivered: false,
      configurationExecuted: false,
      issuanceExecuted: false,
      initialSupply: "0",
      poolDepositsEnabled: false,
    };
  } finally {
    provider?.destroy();
    await fork.stop();
  }
}
