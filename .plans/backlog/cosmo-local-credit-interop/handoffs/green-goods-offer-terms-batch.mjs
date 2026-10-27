#!/usr/bin/env bun
/**
 * One-shot for the Green Goods voucher offers under terms pilot-2026-10-27-r2.
 *
 * Finds the service promises seeded for the pilot in the Green Goods Community Garden's pool,
 * checks each against the approved offer shape, test-calls setServiceOfferTerms as the Green
 * Goods Safe, and writes a Safe Transaction Builder file for Arbitrum. It reads chain state
 * only: it never signs or sends. green-goods-offer-publishing-runbook.md says when to run it.
 *
 * From the repository root:
 *   bun --no-env-file <this file> --preflight      check the gates only
 *   bun --no-env-file <this file>                  build the batch for the assisted sessions
 *   bun --no-env-file <this file> --with-claude    also include the Claude seats
 *   bun --no-env-file <this file> --verify         read back the published offers
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { createPublicClient, encodeFunctionData, http, keccak256, parseAbi, toHex } from "viem";
import { arbitrum, gnosis } from "viem/chains";

const ROOT = path.resolve(import.meta.dir, "../../../..");

// Public addresses, as pinned in packages/shared/src/modules/commitment-pooling/service-access-live-config.ts.
const SAFE = "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19"; // Green Goods Safe: Pooling owner and GGV issuer
const CORE = "0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a"; // Pooling core, Arbitrum
const GG_GARDEN = "0xf401f34378384713222d1d21f63359cc4E8a858a"; // Green Goods Community Garden, Arbitrum
const GGV = "0xbaF8c6f7c0cA8310Df725D90023C188FA8f1B590"; // Green Goods voucher, Gnosis, 6 decimals
const POOL = "0x6AFc963B583fBB536F05B2D7ae832880662b98A4"; // shared exchange pool, Gnosis
const ADAPTER = "0x80a906C175ea875af8a2afcA8F91F60b201dc824"; // reward adapter, Gnosis
const LIMITER = "0xbA96741cc022F48a1F936a085b7549AEa3B01b9C"; // pool holding limiter, Gnosis

const VOUCHER = 1_000_000n;
const ISSUANCE = 120n * VOUCHER;
const ADAPTER_ALLOWANCE = 110n * VOUCHER;
const POOL_LIMIT = 120n * VOUCHER;
const VOUCHER_ROUTE = 2; // ICommitmentServiceOffers.ServicePaymentRoute.Voucher
const POOL_OPEN = 3; // ICommitmentPoolingModule.PoolState.Open
// Bookings close on 31 December 2026, and a Claude seat runs thirty days after that.
const EARLIEST_DUE = BigInt(Date.UTC(2027, 1, 1) / 1000);

// The approved offers. Each statement's keccak256 is the reference written on chain, so a
// statement changes only with a new terms revision.
const OFFERS = {
  session: {
    name: "45-minute assisted session",
    unitLabel: "minutes",
    targetUnits: 45n,
    voucherUnits: 2n * VOUCHER,
    seats: 10,
    service:
      "Green Goods voucher offer, terms pilot-2026-10-27-r2: 2 Green Goods vouchers buy one 45-minute remote or in-person session to set up a garden or document a contribution. Bookings open 28 October 2026 and close 31 December 2026. Green Goods confirms a booking within two business days. Activation needs accepted terms and full escrow, not proof of delivery.",
    remedy:
      "Green Goods voucher remedy, terms pilot-2026-10-27-r2: the holder approves one final allocation. Delivered vouchers are the approved delivered minutes / 45 x 2, rounded down at token precision and capped at 2; the rest returns to the holder. A failed connection with no useful session delivers zero. Changes need mutual consent; a timeout alone decides neither delivery nor refund.",
  },
  claude: {
    name: "30 days of Claude Team access",
    unitLabel: "seat days",
    targetUnits: 30n,
    voucherUnits: 10n * VOUCHER,
    seats: 10,
    service:
      "Green Goods voucher offer, terms pilot-2026-10-27-r2: 10 Green Goods vouchers buy thirty consecutive days of a named Claude Team Standard seat in Green Goods' organization, starting when the participant can sign in and confirms access. No automatic renewal, paid extra usage, API credits or Premium access. Bookings open 28 October 2026 and close 31 December 2026.",
    remedy:
      "Green Goods voucher remedy, terms pilot-2026-10-27-r2: the holder approves one final allocation. Delivered vouchers are the approved available days / 30 x 10, rounded down at token precision and capped at 10; the rest returns to the holder. Normal provider usage limits are not an outage; losing the seat is. Changes need mutual consent; a timeout alone decides neither delivery nor refund.",
  },
};
for (const offer of Object.values(OFFERS)) {
  offer.serviceRef = keccak256(toHex(offer.service));
  offer.remedyRef = keccak256(toHex(offer.remedy));
}

const { values: args } = parseArgs({
  options: {
    preflight: { type: "boolean", default: false },
    verify: { type: "boolean", default: false },
    "with-claude": { type: "boolean", default: false },
    creator: { type: "string" },
    from: { type: "string", default: "43" },
    out: { type: "string" },
    "arbitrum-rpc": { type: "string", default: "https://arb1.arbitrum.io/rpc" },
    "gnosis-rpc": { type: "string", default: "https://rpc.gnosischain.com" },
  },
});

const abiFile = async (name) =>
  JSON.parse(await readFile(path.join(ROOT, "packages/contracts/abis", `${name}.json`), "utf8"));
const coreAbi = await abiFile("ICommitmentPoolingModule");
const offersAbi = await abiFile("ICommitmentServiceOffers");
const ownerAbi = parseAbi(["function owner() view returns(address)"]);
const tokenAbi = parseAbi([
  "function owner() view returns(address)",
  "function decimals() view returns(uint8)",
  "function totalSupply() view returns(uint256)",
  "function balanceOf(address) view returns(uint256)",
  "function allowance(address,address) view returns(uint256)",
]);
const limiterAbi = parseAbi(["function limitOf(address,address) view returns(uint256)"]);
const adapterAbi = parseAbi([
  "function assetAuthorizations(address issuer,address token) view returns(address issuerAuthority,bool enabled)",
]);

const arb = createPublicClient({ chain: arbitrum, transport: http(args["arbitrum-rpc"]) });
const gno = createPublicClient({ chain: gnosis, transport: http(args["gnosis-rpc"]) });
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const vouchers = (units) => `${Number(units) / Number(VOUCHER)}`;
const read = (client, address, abi, functionName, readArgs = []) =>
  client.readContract({ address, abi, functionName, args: readArgs });

for (const [kind, offer] of Object.entries(OFFERS)) {
  console.log(`${kind} service statement: ${offer.serviceRef}\n  ${offer.service}`);
  console.log(`${kind} remedy statement: ${offer.remedyRef}\n  ${offer.remedy}`);
}

async function preflight() {
  const [owner, version, [poolId, pool]] = await Promise.all([
    read(arb, CORE, ownerAbi, "owner"),
    read(arb, CORE, offersAbi, "serviceOfferProtocolVersion"),
    read(arb, CORE, coreAbi, "getPoolByGarden", [GG_GARDEN]),
  ]);
  const [tokenOwner, decimals, supply, safeBalance, poolBalance, allowance, limit, authorization] =
    await Promise.all([
      read(gno, GGV, tokenAbi, "owner"),
      read(gno, GGV, tokenAbi, "decimals"),
      read(gno, GGV, tokenAbi, "totalSupply"),
      read(gno, GGV, tokenAbi, "balanceOf", [SAFE]),
      read(gno, GGV, tokenAbi, "balanceOf", [POOL]),
      read(gno, GGV, tokenAbi, "allowance", [SAFE, ADAPTER]),
      read(gno, LIMITER, limiterAbi, "limitOf", [GGV, POOL]),
      read(gno, ADAPTER, adapterAbi, "assetAuthorizations", [SAFE, GGV]),
    ]);
  const checks = [
    ["Pooling core owner is the Green Goods Safe", same(owner, SAFE), owner],
    ["Pooling core speaks service offer protocol 1", version === 1, version],
    ["Community Garden pool is pool 1 and open", poolId === 1n && pool.state === POOL_OPEN, `pool ${poolId}, state ${pool.state}`],
    ["GGV is owned by the Safe with 6 decimals", same(tokenOwner, SAFE) && decimals === 6, `${tokenOwner}, ${decimals}`],
    ["GGV issued is 120", supply === ISSUANCE, vouchers(supply)],
    ["Pool holding limit for GGV is 120", limit === POOL_LIMIT, vouchers(limit)],
    ["Adapter allowance from the Safe is 110", allowance === ADAPTER_ALLOWANCE, vouchers(allowance)],
    ["Safe reserve covers the allowance", safeBalance >= ADAPTER_ALLOWANCE, vouchers(safeBalance)],
    ["Adapter authorizes the Safe for GGV", same(authorization[0], SAFE) && authorization[1] === true, `${authorization[0]}, ${authorization[1]}`],
  ];
  for (const [label, ok, actual] of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${label} (${actual})`);
  console.log(`info  Pool inventory of GGV: ${vouchers(poolBalance)}`);
  return checks.every(([, ok]) => ok);
}

/** Every promise in pool 1 from --from upward, with its current offer terms. */
async function poolPromises() {
  const found = [];
  let id = BigInt(args.from);
  for (let empty = 0; empty < 50; ) {
    const ids = Array.from({ length: 50 }, (_, i) => id + BigInt(i));
    const results = await arb.multicall({
      contracts: ids.map((each) => ({ address: CORE, abi: coreAbi, functionName: "getCommitment", args: [each] })),
      allowFailure: true,
    });
    for (let i = 0; i < ids.length; i++) {
      const promise = results[i].status === "success" ? results[i].result : null;
      if (!promise || promise.poolId === 0n) {
        empty++;
        continue;
      }
      empty = 0;
      if (promise.poolId === 1n) found.push({ id: ids[i], promise });
    }
    id += 50n;
  }
  const terms = await arb.multicall({
    contracts: found.map(({ id: each }) => ({ address: CORE, abi: offersAbi, functionName: "getServiceOfferTerms", args: [each] })),
    allowFailure: false,
  });
  return found.map((entry, i) => ({ ...entry, offer: terms[i] }));
}

const kindOf = (promise) =>
  Object.keys(OFFERS).find(
    (kind) => promise.unitLabel === OFFERS[kind].unitLabel && promise.targetUnits === OFFERS[kind].targetUnits
  );

/** Why a seeded promise cannot carry this offer, or null when it can. */
function unfit(promise) {
  if (promise.direction !== 0) return "not an offer";
  if (promise.commitmentType !== 1) return "not a support or service promise";
  if (promise.claimType !== 1) return "not taken up by one person";
  if (promise.claimMode !== 1) return "not steward-reviewed";
  if (promise.state !== 1) return `state ${promise.state}, not offered`;
  if (promise.counterCommitmentId !== 0n) return "linked to another promise";
  if (promise.dueDate < EARLIEST_DUE) return `due ${new Date(Number(promise.dueDate) * 1000).toISOString()}, before 1 February 2027`;
  if (args.creator && !same(promise.creator, args.creator)) return "seeded by another account";
  return null;
}

async function verify() {
  const published = (await poolPromises()).filter(({ offer }) => offer.revision > 0n && same(offer.terms.voucherToken, GGV));
  let ok = published.length > 0;
  for (const { id, promise, offer } of published) {
    const kind = kindOf(promise);
    const expected = kind && OFFERS[kind];
    const good =
      expected &&
      offer.terms.route === VOUCHER_ROUTE &&
      offer.terms.voucherChainId === 100n &&
      same(offer.terms.voucherIssuer, SAFE) &&
      offer.terms.voucherUnits === expected.voucherUnits &&
      offer.terms.serviceTermsRef === expected.serviceRef &&
      offer.terms.remedyTermsRef === expected.remedyRef;
    ok &&= Boolean(good);
    console.log(`${good ? "PASS" : "FAIL"}  #${id} ${kind ?? "unknown unit"} revision ${offer.revision}, ${vouchers(offer.terms.voucherUnits)} GGV, terms hash ${offer.termsHash}`);
  }
  if (!published.length) console.log("FAIL  No Green Goods voucher offer is published in pool 1 yet.");
  return ok;
}

async function build() {
  const promises = await poolPromises();
  const live = { session: 0, claude: 0 };
  const picked = [];
  for (const { id, promise, offer } of promises) {
    const kind = kindOf(promise);
    if (!kind) continue;
    if (offer.revision > 0n) {
      if (same(offer.terms.voucherToken, GGV)) live[kind]++;
      continue;
    }
    const reason = unfit(promise);
    if (reason) {
      console.log(`skip  #${id} ${kind}: ${reason}`);
      continue;
    }
    if (kind === "claude" && !args["with-claude"]) {
      console.log(`hold  #${id} claude: pass --with-claude once Claude seats are confirmed`);
      continue;
    }
    picked.push({ id, kind, promise });
  }
  for (const kind of Object.keys(OFFERS)) {
    const count = live[kind] + picked.filter((each) => each.kind === kind).length;
    if (count > OFFERS[kind].seats)
      throw new Error(`${count} ${kind} offers exceed the approved ${OFFERS[kind].seats}; cancel the extra promises first`);
  }
  if (!picked.length) {
    console.log("Nothing to publish: no seeded promise matches an approved offer.");
    return false;
  }
  const calls = [];
  for (const { id, kind, promise } of picked) {
    const offer = OFFERS[kind];
    const terms = {
      route: VOUCHER_ROUTE,
      serviceTermsRef: offer.serviceRef,
      remedyTermsRef: offer.remedyRef,
      voucherChainId: 100n,
      voucherIssuer: SAFE,
      voucherToken: GGV,
      voucherUnits: offer.voucherUnits,
    };
    const callArgs = [id, 0n, terms, 0n];
    // Each promise is independent, so each call is tested alone against current state.
    await arb.simulateContract({ address: CORE, abi: offersAbi, functionName: "setServiceOfferTerms", args: callArgs, account: SAFE });
    calls.push({ id, kind, data: encodeFunctionData({ abi: offersAbi, functionName: "setServiceOfferTerms", args: callArgs }) });
    console.log(`ok    #${id} ${kind}: ${vouchers(offer.voucherUnits)} GGV, due ${new Date(Number(promise.dueDate) * 1000).toISOString().slice(0, 10)}, seeded by ${promise.creator}`);
  }
  const count = (kind) => calls.filter((call) => call.kind === kind).length;
  const file = {
    version: "1.0",
    chainId: "42161",
    createdAt: Date.now(),
    meta: {
      name: "Publish Green Goods voucher offers",
      createdFromSafeAddress: SAFE,
      description: `setServiceOfferTerms on the Pooling core ${CORE} for ${count("session")} assisted sessions (2 GGV each) and ${count("claude")} Claude seats (10 GGV each), terms pilot-2026-10-27-r2. Promises ${calls.map((call) => `#${call.id}`).join(", ")}. Session refs ${OFFERS.session.serviceRef} / ${OFFERS.session.remedyRef}; Claude refs ${OFFERS.claude.serviceRef} / ${OFFERS.claude.remedyRef}. Review in Safe before signing. No transaction has been submitted.`,
    },
    transactions: calls.map((call) => ({ to: CORE, value: "0", data: call.data })),
  };
  const out = path.resolve(ROOT, args.out ?? `output/voucher-offers/green-goods-offer-terms-${file.createdAt}.json`);
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(file, null, 2)}\n`);
  console.log(`Wrote ${calls.length} ${calls.length === 1 ? "call" : "calls"} to ${out}. Nothing was signed or sent.`);
  return true;
}

const gatesPass = await preflight();
if (args.preflight) process.exit(gatesPass ? 0 : 1);
if (args.verify) process.exit((await verify()) ? 0 : 1);
if (!gatesPass) {
  console.log("Stop: a gate failed. Finish the Gnosis mint, limit and approve batch first.");
  process.exit(1);
}
process.exit((await build()) ? 0 : 1);
