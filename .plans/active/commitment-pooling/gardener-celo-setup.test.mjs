import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { encodeAbiParameters, encodeEventTopics, hashDomain, parseAbi, parseUnits, toHex, zeroAddress } from "viem";
import { entryPoint07Address } from "viem/account-abstraction";
import { policyPlan, preflight, verifyReceipt } from "./gardener-celo-setup.mjs";

const sender = "0x1111111111111111111111111111111111111111";
const recipient = "0x2222222222222222222222222222222222222222";
const paymaster = "0x3333333333333333333333333333333333333333";
const hash = (n) => `0x${n.repeat(64)}`;
const unit = parseUnits("1", 18);
const input = { sourceAccount: sender, celoAccount: sender, recipient, amount: "1" };
const implementation = "0xBAC849bB641841b44E965fB01A4Bf5F074f84b4D";
function kernelCode(chainId, suffix = "6001") {
  const domain = hashDomain({
    domain: { name: "Kernel", version: "0.3.1", chainId, verifyingContract: implementation },
    types: { EIP712Domain: [
      { name: "name", type: "string" }, { name: "version", type: "string" },
      { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" },
    ] },
  });
  return `0x6000${domain.slice(2)}${toHex(chainId, { size: 32 }).slice(2)}${suffix}`;
}
const policy = {
  gasCapUsd: "0.02",
  dailyBudgetUsd: "2.00",
  webhook: "https://policy.example.org/transfers",
};
const eventAbi = parseAbi([
  "event UserOperationEvent(bytes32 indexed userOpHash, address indexed sender, address indexed paymaster, uint256 nonce, bool success, uint256 actualGasCost, uint256 actualGasUsed)",
]);

function event({ success = true, sponsoredBy = paymaster, account = sender } = {}) {
  return {
    address: entryPoint07Address,
    topics: encodeEventTopics({
      abi: eventAbi,
      eventName: "UserOperationEvent",
      args: { userOpHash: hash("b"), sender: account, paymaster: sponsoredBy },
    }),
    data: encodeAbiParameters(
      [{ type: "uint256" }, { type: "bool" }, { type: "uint256" }, { type: "uint256" }],
      [0n, success, 100n, 50n]
    ),
  };
}

function rpc(chainId, overrides = {}) {
  return {
    getChainId: async () => chainId,
    getBlock: async ({ blockNumber = 100n } = {}) => ({
      number: blockNumber,
      hash: hash(blockNumber === 100n ? "1" : "2"),
      timestamp: 1000n,
    }),
    getBalance: async () => 0n,
    getCode: async ({ address, blockNumber }) =>
      address === implementation ? kernelCode(chainId) : address === sender && blockNumber === 100n ? "0x" : "0x1234",
    readContract: async ({ functionName, args, blockNumber }) => {
      if (functionName === "gardenerDeliveryEnabled") return false;
      if (functionName === "decimals") return 18;
      if (functionName === "getFees") return [0n, true];
      if (functionName === "balanceOf")
        return args[0] === sender
          ? (blockNumber === 100n ? 10n : 9n) * unit
          : blockNumber === 100n
            ? 0n
            : unit;
      throw new Error("Unexpected read");
    },
    getTransactionReceipt: async () => ({
      status: "success",
      transactionHash: hash("a"),
      blockNumber: 101n,
      blockHash: hash("2"),
      logs: [event()],
    }),
    ...overrides,
  };
}
const snapshot = () => preflight(input, rpc(42161), rpc(42220));
const receiptInput = async () => ({
  before: await snapshot(),
  transactionHash: hash("a"),
  userOperationHash: hash("b"),
});

test("accepts only the expected chain-dependent Kernel constants", async () => {
  const before = await snapshot();
  const pin = before.code.find((p) => p.name === "implementation");
  assert.notEqual(pin.arbitrum, pin.celo);
  assert.equal(before.readChecksPassed, true);
  const base = rpc(42220);
  await assert.rejects(() => preflight(input, rpc(42161), rpc(42220, {
    getCode: (args) => args.address === implementation ? kernelCode(42161) : base.getCode(args),
  })), /Kernel.*constants/);
});

test("rejects implementation changes outside the verified chain constants", async () => {
  const base = rpc(42220);
  const before = await preflight(input, rpc(42161), rpc(42220, {
    getCode: (args) => args.address === implementation ? kernelCode(42220, "6002") : base.getCode(args),
  }));
  assert.equal(before.checks.pinnedCodePresentAndEqual, false);
});

test("rejects swapped immutable slots and duplicate expected constants", async () => {
  const base = rpc(42220);
  const code = kernelCode(42220);
  const domain = code.slice(6, 70);
  const chainWord = code.slice(70, 134);
  const swapped = `0x6000${chainWord}${domain}6001`;
  const before = await preflight(input, rpc(42161), rpc(42220, {
    getCode: (args) => args.address === implementation ? swapped : base.getCode(args),
  }));
  assert.equal(before.checks.pinnedCodePresentAndEqual, false);
  await assert.rejects(() => preflight(input, rpc(42161), rpc(42220, {
    getCode: (args) => args.address === implementation ? code + domain : base.getCode(args),
  })), /Kernel.*constants/);
});

test("direct community policy shares counts and explicit USD budgets across both chains", () => {
  const result = policyPlan(policy);
  assert.equal(result.activationReady, false);
  assert.equal(result.policy.limits.user_operation.user_operation_spending.amount, 2);
  assert.equal(result.policy.limits.user.maximum_user_operation_count, 5);
  assert.equal(result.policy.limits.global.maximum_user_operation_count, 200);
  assert.equal(result.policy.limits.global.user_operation_spending.amount, 200);
  assert.equal(result.policy.limits.global.reset_interval, "daily");
  assert.deepEqual(result.policy.chain_ids.allowlist, [42161, 42220]);
  assert.equal(result.policy.webhook_enabled, true);
  assert.equal(
    result.requiredWebhookChecks.recipientEligibility,
    "verified-green-goods-gardener-or-garden-account"
  );
});

test("allowlist binds three Arbitrum tokens and only G$ on Celo to exact contracts", () => {
  const transfers = policyPlan(policy).requiredWebhookChecks.allowedTransfers;
  assert.deepEqual(
    transfers.map((t) => [t.chainId, t.symbol, t.address.toLowerCase()]),
    [
      [42161, "DAI", "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1"],
      [42161, "USDC", "0xaf88d065e77c8cc2239327c5edb3a432268e5831"],
      [42161, "WETH", "0x82af49447d8a07e3bd95bd0d56f35241523fbab1"],
      [42220, "G$", "0x62b8b11039fcfe5ab0c56e502b1c372a3d2a9c7a"],
    ]
  );
  const registry = readFileSync(
    new URL("../../../packages/shared/src/utils/cookie-jar-campaign.ts", import.meta.url),
    "utf8"
  ).toLowerCase();
  const arbitrumRegistry = registry.slice(
    registry.indexOf("42161: {"),
    registry.indexOf("11155111: {")
  );
  for (const t of transfers.filter((t) => t.chainId === 42161))
    assert.ok(arbitrumRegistry.includes(t.address.toLowerCase()));
});

for (const gasCapUsd of ["0", "-1", "1e3", "NaN", "0.004", "9".repeat(80)]) {
  test(`rejects invalid, sub-cent or unsafe gas ceiling ${gasCapUsd}`, () =>
    assert.throws(() => policyPlan({ ...policy, gasCapUsd })));
}

test("daily budget is explicit and must allow at least one operation at the cap", () => {
  assert.throws(() => policyPlan({ ...policy, dailyBudgetUsd: undefined }));
  assert.throws(() => policyPlan({ ...policy, dailyBudgetUsd: "0.01" }));
  assert.equal(
    policyPlan({ ...policy, dailyBudgetUsd: "0.03" }).policy.limits.user.user_operation_spending
      .amount,
    3
  );
});

for (const webhook of [
  "http://example.org",
  "https://user:secret@example.org",
  "https://example.org/?key=secret",
  "https://example.org/#secret",
]) {
  test("rejects insecure or credential-bearing webhook URL", () =>
    assert.throws(() => policyPlan({ ...policy, webhook })));
}

test("preflight observes pinned code, funding, zero CELO and first-use account without certifying activation", async () => {
  const before = await snapshot();
  assert.equal(before.readChecksPassed, true);
  assert.equal(before.activationReady, false);
  assert.equal(before.fundingShortfall, "0");
  const requireShared = createRequire(
    new URL("../../../packages/shared/package.json", import.meta.url)
  );
  const lockedKernel = readFileSync(
    join(
      dirname(requireShared.resolve("permissionless/accounts")),
      "kernel/toKernelSmartAccount.js"
    ),
    "utf8"
  );
  const map = lockedKernel.slice(
    lockedKernel.indexOf('"0.3.1":'),
    lockedKernel.indexOf('"0.3.2":')
  );
  for (const pin of before.code.filter((p) => p.name !== "entryPoint"))
    assert.ok(map.includes(pin.address), `${pin.name} differs from shipping dependency`);
});

test("identity mismatch fails before any RPC read", async () => {
  await assert.rejects(
    () => preflight({ ...input, celoAccount: recipient }, {}, {}),
    /addresses differ/
  );
});

test("wrong RPC chain fails", async () => {
  await assert.rejects(() => preflight(input, rpc(1), rpc(42220)), /chain identity/);
});

test("sender fees compute gross funding and recipient fees compute net credit", async () => {
  for (const senderPays of [true, false]) {
    const base = rpc(42220);
    const destination = rpc(42220, {
      readContract: async (args) =>
        args.functionName === "getFees" ? [unit / 10n, senderPays] : base.readContract(args),
    });
    const before = await preflight(input, rpc(42161), destination);
    assert.equal(before.totalDebit, (senderPays ? (unit * 11n) / 10n : unit).toString());
    assert.equal(before.recipientAmount, (senderPays ? unit : (unit * 9n) / 10n).toString());
  }
});

test("unfunded, non-first-use, nonzero CELO, and missing pinned code remain blocked", async () => {
  const base = rpc(42220);
  const before = await preflight(
    input,
    rpc(42161),
    rpc(42220, {
      getBalance: async () => 1n,
      getCode: async ({ address }) => (address === sender ? "0x1234" : "0x"),
      readContract: async (args) =>
        args.functionName === "balanceOf" ? 0n : base.readContract(args),
    })
  );
  assert.equal(before.readChecksPassed, false);
  assert.equal(before.checks.firstUseCeloAccount, false);
  assert.equal(before.checks.noCeloForNetworkFee, false);
  assert.equal(before.checks.pinnedCodePresentAndEqual, false);
  assert.equal(before.fundingShortfall, unit.toString());
});

test("enabled delivery flag blocks pre-activation canary preparation", async () => {
  const before = await preflight(input, rpc(42161, { readContract: async () => true }), rpc(42220));
  assert.equal(before.readChecksPassed, false);
});

test("receipt checks successful sponsored EntryPoint event and exact historical balance deltas", async () => {
  const result = await verifyReceipt(await receiptInput(), rpc(42220));
  assert.equal(result.receiptChecksPassed, true);
  assert.equal(result.activationReady, false);
  assert.equal(result.actualGasCostWei, "100");
});

for (const options of [{ success: false }, { sponsoredBy: zeroAddress }, { account: recipient }]) {
  test("rejects failed, unsponsored, or wrong-account UserOperation inside successful transaction", async () => {
    const base = rpc(42220);
    await assert.rejects(
      () =>
        receiptInput().then((args) =>
          verifyReceipt(
            args,
            rpc(42220, {
              getTransactionReceipt: async () => ({
                ...(await base.getTransactionReceipt()),
                logs: [event(options)],
              }),
            })
          )
        ),
      /EntryPoint event/
    );
  });
}

test("rejects missing and duplicate matching EntryPoint events", async () => {
  for (const logs of [[], [event(), event()]]) {
    const base = rpc(42220);
    await assert.rejects(
      () =>
        receiptInput().then((args) =>
          verifyReceipt(
            args,
            rpc(42220, {
              getTransactionReceipt: async () => ({
                ...(await base.getTransactionReceipt()),
                logs,
              }),
            })
          )
        ),
      /EntryPoint event/
    );
  }
});

test("reorg and changed balances fail receipt proof", async () => {
  const args = await receiptInput();
  await assert.rejects(
    () =>
      verifyReceipt({ ...args, before: { ...args.before, celoBlockHash: hash("f") } }, rpc(42220)),
    /canonical/
  );
  const base = rpc(42220);
  await assert.rejects(
    () =>
      verifyReceipt(
        args,
        rpc(42220, {
          readContract: async (a) =>
            a.functionName === "balanceOf" && a.blockNumber === 101n ? 0n : base.readContract(a),
        })
      ),
    /balance deltas/
  );
});

test("snapshot cannot fake fee or first-use evidence", async () => {
  const args = await receiptInput();
  await assert.rejects(
    () => verifyReceipt({ ...args, before: { ...args.before, totalDebit: "1" } }, rpc(42220)),
    /historical reads/
  );
  await assert.rejects(
    () => verifyReceipt(args, rpc(42220, { getCode: async () => "0x1234" })),
    /historical reads/
  );
});

test("RPC failure propagates instead of becoming a zero balance", async () => {
  await assert.rejects(
    () =>
      preflight(
        input,
        rpc(42161),
        rpc(42220, {
          readContract: async () => {
            throw new Error("unavailable");
          },
        })
      ),
    /unavailable/
  );
});
