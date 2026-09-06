import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import {
  createPublicClient,
  decodeEventLog,
  getAddress,
  hashDomain,
  http,
  isAddress,
  keccak256,
  maxUint256,
  parseAbi,
  parseUnits,
  toHex,
  zeroAddress,
} from "viem";
import { entryPoint07Address, entryPoint07Abi } from "viem/account-abstraction";
import { arbitrum, celo } from "viem/chains";

const root = new URL("../../../", import.meta.url);
const release = JSON.parse(
  readFileSync(new URL("packages/contracts/config/commitment-pooling-release.json", root))
);
const deployment = JSON.parse(
  readFileSync(new URL("packages/contracts/deployments/42161-latest.json", root))
);
const token = getAddress(release.chains.celo.gDollar);
const abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function getFees(uint256,address,address) view returns (uint256,bool)",
  "function gardenerDeliveryEnabled() view returns (bool)",
]);
// Pins from the locked permissionless Kernel 0.3.1 WebAuthn deployment map.
// Cross-chain equality is an observation, not a substitute for approved code hashes.
const pins = {
  entryPoint: entryPoint07Address,
  factory: "0xaac5D4240AF87249B3f71BC8E4A2cae074A3E419",
  metaFactory: "0xd703aaE79538628d27099B8c4f621bE4CCd142d5",
  implementation: "0xBAC849bB641841b44E965fB01A4Bf5F074f84b4D",
  validator: "0xbA45a2BFb8De3D24cA9D7F1B551E14dFF5d690Fd",
};

class SetupError extends Error {}

function requireValue(value, label) {
  if (!value) throw new SetupError(`${label} is required. Run with --help.`);
  return value;
}

function address(value, label) {
  if (!isAddress(value ?? "") || value.toLowerCase() === zeroAddress)
    throw new SetupError(`${label} must be a nonzero Ethereum address.`);
  return getAddress(value);
}

function decimal(value, label) {
  if (!/^(0|[1-9]\d*)(\.\d{1,18})?$/.test(value ?? ""))
    throw new SetupError(`${label} must be a positive decimal with at most 18 places.`);
  const amount = parseUnits(value, 18);
  if (amount <= 0n || amount > maxUint256)
    throw new SetupError(`${label} is outside the allowed range.`);
  return amount;
}

function usdCents(value, label) {
  if (!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value ?? ""))
    throw new SetupError(`${label} must be positive USD with at most two decimal places.`);
  const cents = parseUnits(value, 2);
  if (cents <= 0n || cents > BigInt(Math.floor(Number.MAX_SAFE_INTEGER / 200)))
    throw new SetupError(`${label} is outside the allowed range.`);
  return Number(cents);
}

export function policyPlan({ gasCapUsd, dailyBudgetUsd, webhook }) {
  const cap = usdCents(gasCapUsd, "gas-cap-usd");
  const budget = usdCents(dailyBudgetUsd, "daily-budget-usd");
  if (budget < cap)
    throw new SetupError("daily-budget-usd must cover at least one operation at gas-cap-usd.");
  const endpoint = new URL(requireValue(webhook, "webhook"));
  if (
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash
  )
    throw new SetupError("webhook must be HTTPS without credentials, query, or fragment.");
  return {
    kind: "green-goods-community-policy-plan-v2",
    activationReady: false,
    costBasis: "operator-selected per-operation ceiling and total daily budget in USD",
    policy: {
      policy_name: "Green Goods community transfers",
      chain_ids: { allowlist: [42161, 42220] },
      webhook_enabled: true,
      webhook_endpoint: endpoint.href,
      limits: {
        global: {
          maximum_user_operation_count: 200,
          reset_interval: "daily",
          user_operation_spending: { amount: budget, currency: "USD" },
        },
        user: {
          maximum_user_operation_count: 5,
          reset_interval: "daily",
          user_operation_spending: { amount: Math.min(5 * cap, budget), currency: "USD" },
        },
        user_operation: { user_operation_spending: { amount: cap, currency: "USD" } },
      },
    },
    requiredWebhookChecks: {
      entryPoint: entryPoint07Address,
      senderEligibility: "verified-green-goods-passkey-account",
      recipientEligibility: "verified-green-goods-gardener-or-garden-account",
      // Exact chain/address pairs from the existing app registry, protected by the direct test.
      allowedTransfers: [
        {
          chainId: 42161,
          symbol: "DAI",
          address: getAddress("0xda10009cbd5d07dd0cecc66161fc93d7c9000da1"),
        },
        {
          chainId: 42161,
          symbol: "USDC",
          address: getAddress("0xaf88d065e77c8cC2239327C5EDb3A432268e5831"),
        },
        {
          chainId: 42161,
          symbol: "WETH",
          address: getAddress("0x82af49447d8a07e3bd95bd0d56f35241523fbab1"),
        },
        { chainId: 42220, symbol: "G$", address: token },
      ],
      innerSelector: "0xa9059cbb",
      nativeValue: "0",
      singleCallOnly: true,
      rejectBatchDelegatecallApprovalAndMalformedCalldata: true,
      authenticateWebhookAndFailClosed: true,
    },
    blockers: [
      "Implement and test the authenticated Kernel-aware community recipient guard before activation.",
      "Route these transfers to this policy without replacing sponsorship for other Arbitrum app actions.",
      "Restrict browser-key permissions while preserving passkey registration/recovery; this JSON does not configure keys.",
    ],
  };
}

function client(chain, envName) {
  const url = process.env[envName];
  if (url) {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new SetupError(`${envName} must use HTTPS.`);
  }
  return createPublicClient({ chain, transport: http(url, { timeout: 15_000, retryCount: 0 }) });
}

function balance(rpc, account, blockNumber) {
  return rpc.readContract({
    address: token,
    abi,
    functionName: "balanceOf",
    args: [account],
    blockNumber,
  });
}

async function codeHash(rpc, account, blockNumber) {
  const code = await rpc.getCode({ address: account, blockNumber });
  return code && code !== "0x" ? keccak256(code) : null;
}

async function pinnedCode(rpc, pin, blockNumber, chainId) {
  const code = await rpc.getCode({ address: pin, blockNumber });
  if (!code || code === "0x") return { hash: null, comparableHash: null };
  const hash = keccak256(code);
  if (pin !== pins.implementation) return { hash, comparableHash: hash };
  // Kernel 0.3.1 caches its deployment chain and EIP-712 domain in runtime code.
  // Verify both expected values before excluding only those constants from comparison.
  const domain = hashDomain({
    domain: { name: "Kernel", version: "0.3.1", chainId, verifyingContract: pin },
    types: { EIP712Domain: [
      { name: "name", type: "string" }, { name: "version", type: "string" },
      { name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" },
    ] },
  }).slice(2);
  const chainWord = toHex(chainId, { size: 32 }).slice(2);
  if (code.split(domain).length !== 2 || code.split(chainWord).length !== 2)
    throw new SetupError("Unexpected Kernel deployment chain/domain constants.");
  // Distinct markers also require the two immutable slots to remain in place.
  const normalized = code.replace(domain, "ff".repeat(32)).replace(chainWord, "0".repeat(64));
  return { hash, comparableHash: keccak256(normalized) };
}

export async function preflight(
  options,
  source = client(arbitrum, "ARBITRUM_RPC_URL"),
  destination = client(celo, "CELO_RPC_URL")
) {
  const sender = address(options.sourceAccount, "source-account");
  const celoAccount = address(options.celoAccount, "celo-account");
  const recipient = address(options.recipient, "recipient");
  if (sender !== celoAccount) throw new SetupError("Arbitrum and Celo account addresses differ.");
  if (sender === recipient)
    throw new SetupError("The canary recipient must differ from the sender.");
  const amount = decimal(options.amount, "amount");
  const chainIds = await Promise.all([source.getChainId(), destination.getChainId()]);
  if (chainIds[0] !== 42161 || chainIds[1] !== 42220)
    throw new SetupError("RPC chain identity mismatch.");
  const [sourceBlock, destinationBlock] = await Promise.all([
    source.getBlock(),
    destination.getBlock(),
  ]);
  const sb = sourceBlock.number;
  const cb = destinationBlock.number;
  if (sb === null || cb === null) throw new SetupError("RPC returned an unmined block.");
  const [
    enabled,
    decimals,
    fees,
    senderBalance,
    recipientBalance,
    nativeBalance,
    accountCodeHash,
    code,
  ] = await Promise.all([
    source.readContract({
      address: address(deployment.settlementModule, "SettlementModule"),
      abi,
      functionName: "gardenerDeliveryEnabled",
      blockNumber: sb,
    }),
    destination.readContract({ address: token, abi, functionName: "decimals", blockNumber: cb }),
    destination.readContract({
      address: token,
      abi,
      functionName: "getFees",
      args: [amount, sender, recipient],
      blockNumber: cb,
    }),
    balance(destination, sender, cb),
    balance(destination, recipient, cb),
    destination.getBalance({ address: sender, blockNumber: cb }),
    codeHash(destination, sender, cb),
    Promise.all(
      Object.entries(pins).map(async ([name, pin]) => {
        const [arbitrumCode, celoCode] = await Promise.all([
          pinnedCode(source, pin, sb, 42161), pinnedCode(destination, pin, cb, 42220),
        ]);
        return {
          name, address: pin,
          arbitrum: arbitrumCode.hash, celo: celoCode.hash,
          comparableArbitrum: arbitrumCode.comparableHash,
          comparableCelo: celoCode.comparableHash,
        };
      })
    ),
  ]);
  if (decimals !== 18) throw new SetupError("Canonical G$ decimals differ from the shipping app.");
  const [fee, senderPays] = fees;
  const totalDebit = senderPays ? amount + fee : amount;
  const recipientAmount = senderPays ? amount : amount - fee;
  if (fee < 0n || totalDebit > maxUint256 || recipientAmount <= 0n)
    throw new SetupError("The G$ quote cannot fund a positive canary transfer.");
  const checks = {
    deliveryDisabled: enabled === false,
    pinnedCodePresentAndEqual: code.every((p) => p.comparableArbitrum && p.comparableArbitrum === p.comparableCelo),
    firstUseCeloAccount: accountCodeHash === null,
    noCeloForNetworkFee: nativeBalance === 0n,
    funded: senderBalance >= totalDebit,
  };
  return {
    kind: "gardener-celo-preflight-v1",
    activationReady: false,
    readChecksPassed: Object.values(checks).every(Boolean),
    checks,
    observedAt: new Date().toISOString(),
    sourceBlock: sb.toString(),
    sourceBlockHash: sourceBlock.hash,
    celoBlock: cb.toString(),
    celoBlockHash: destinationBlock.hash,
    celoTimestamp: destinationBlock.timestamp.toString(),
    sender,
    recipient,
    token,
    amount: amount.toString(),
    fee: fee.toString(),
    senderPays,
    totalDebit: totalDebit.toString(),
    recipientAmount: recipientAmount.toString(),
    senderBalance: senderBalance.toString(),
    recipientBalance: recipientBalance.toString(),
    fundingShortfall: (senderBalance < totalDebit ? totalDebit - senderBalance : 0n).toString(),
    nativeBalance: nativeBalance.toString(),
    accountCodeHash,
    code,
    remainingProof: [
      "Browser-derived same credential and production RP identity",
      "Approved deployment code-hash comparison",
      "Restricted active sponsorship policy",
      "Authorized operator canary signing path (WalletDrawer is gated while delivery is disabled)",
    ],
  };
}

export async function verifyReceipt(
  { before, transactionHash, userOperationHash },
  rpc = client(celo, "CELO_RPC_URL")
) {
  if (before?.kind !== "gardener-celo-preflight-v1" || before.readChecksPassed !== true)
    throw new SetupError("Use a funded preflight snapshot whose read checks all passed.");
  for (const hash of [transactionHash, userOperationHash])
    if (!/^0x[\da-fA-F]{64}$/.test(hash ?? ""))
      throw new SetupError("Both transaction and UserOperation hashes are required.");
  if ((await rpc.getChainId()) !== 42220) throw new SetupError("RPC chain identity mismatch.");
  const sender = address(before.sender, "snapshot sender");
  const recipient = address(before.recipient, "snapshot recipient");
  if (getAddress(before.token) !== token) throw new SetupError("Snapshot token mismatch.");
  const oldBlock = await rpc.getBlock({ blockNumber: BigInt(before.celoBlock) });
  if (oldBlock.hash !== before.celoBlockHash)
    throw new SetupError("Preflight block is no longer canonical.");
  const amount = BigInt(before.amount);
  if (amount <= 0n || amount > maxUint256 || sender === recipient)
    throw new SetupError("Invalid canary snapshot amount or recipient.");
  const [oldFees, oldNative, oldCode] = await Promise.all([
    rpc.readContract({
      address: token,
      abi,
      functionName: "getFees",
      args: [amount, sender, recipient],
      blockNumber: oldBlock.number,
    }),
    rpc.getBalance({ address: sender, blockNumber: oldBlock.number }),
    codeHash(rpc, sender, oldBlock.number),
  ]);
  const expectedDebit = oldFees[1] ? amount + oldFees[0] : amount;
  const expectedCredit = oldFees[1] ? amount : amount - oldFees[0];
  if (
    oldCode !== null ||
    oldNative !== 0n ||
    expectedDebit > maxUint256 ||
    expectedCredit <= 0n ||
    expectedDebit !== BigInt(before.totalDebit) ||
    expectedCredit !== BigInt(before.recipientAmount)
  )
    throw new SetupError(
      "Snapshot fee, first-use account, or zero-CELO condition does not match historical reads."
    );
  const receipt = await rpc.getTransactionReceipt({ hash: transactionHash });
  if (
    receipt.status !== "success" ||
    receipt.transactionHash.toLowerCase() !== transactionHash.toLowerCase() ||
    receipt.blockNumber <= oldBlock.number
  )
    throw new SetupError("The successful canary receipt must follow the preflight snapshot.");
  const block = await rpc.getBlock({ blockNumber: receipt.blockNumber });
  if (receipt.blockHash !== block.hash)
    throw new SetupError("Receipt block is no longer canonical.");
  const events = receipt.logs
    .filter((log) => log.address.toLowerCase() === entryPoint07Address.toLowerCase())
    .flatMap((log) => {
      try {
        const event = decodeEventLog({ abi: entryPoint07Abi, data: log.data, topics: log.topics });
        return event.eventName === "UserOperationEvent" &&
          event.args.userOpHash.toLowerCase() === userOperationHash.toLowerCase()
          ? [event.args]
          : [];
      } catch {
        return [];
      }
    });
  if (
    events.length !== 1 ||
    !events[0].success ||
    getAddress(events[0].sender) !== sender ||
    events[0].paymaster.toLowerCase() === zeroAddress
  )
    throw new SetupError(
      "Expected one successful, sponsored EntryPoint event for the canary account."
    );
  const [
    senderBefore,
    recipientBefore,
    senderAfter,
    recipientAfter,
    deployedCodeHash,
    nativeAfter,
  ] = await Promise.all([
    balance(rpc, sender, oldBlock.number),
    balance(rpc, recipient, oldBlock.number),
    balance(rpc, sender, receipt.blockNumber),
    balance(rpc, recipient, receipt.blockNumber),
    codeHash(rpc, sender, receipt.blockNumber),
    rpc.getBalance({ address: sender, blockNumber: receipt.blockNumber }),
  ]);
  if (
    senderBefore !== BigInt(before.senderBalance) ||
    recipientBefore !== BigInt(before.recipientBalance)
  )
    throw new SetupError("Snapshot balances do not match historical chain reads.");
  if (
    senderBefore - senderAfter !== BigInt(before.totalDebit) ||
    recipientAfter - recipientBefore !== BigInt(before.recipientAmount) ||
    !deployedCodeHash ||
    nativeAfter !== 0n
  )
    throw new SetupError(
      "Canary deployment, zero-CELO condition, or exact G$ balance deltas did not match."
    );
  return {
    kind: "gardener-celo-receipt-check-v1",
    receiptChecksPassed: true,
    activationReady: false,
    transactionHash,
    userOperationHash,
    block: block.number.toString(),
    blockHash: block.hash,
    timestamp: block.timestamp.toString(),
    actualGasCostWei: events[0].actualGasCost.toString(),
    actualGasUsed: events[0].actualGasUsed.toString(),
    paymaster: events[0].paymaster,
    deployedCodeHash,
    senderDebit: (senderBefore - senderAfter).toString(),
    recipientCredit: (recipientAfter - recipientBefore).toString(),
    remainingProof: [
      "Pimlico UserOperation receipt and policy usage",
      "USD cost for pilot policy sizing",
      "Browser passkey evidence and approved deployment pins",
      "Human review and separately authorized delivery activation",
    ],
  };
}

const help = `Read-only Gardener Celo setup helper. Run from the repository root with bun.
  bun .plans/active/commitment-pooling/gardener-celo-setup.mjs policy --gas-cap-usd AMOUNT --daily-budget-usd AMOUNT --webhook https://HOST/PATH
  bun .plans/active/commitment-pooling/gardener-celo-setup.mjs preflight --source-account ADDRESS --celo-account ADDRESS --recipient ADDRESS --amount G_DOLLARS
  bun .plans/active/commitment-pooling/gardener-celo-setup.mjs verify --before FILE --transaction-hash HASH --user-operation-hash HASH
Policy output is a direct community pilot plan for Arbitrum DAI/USDC/WETH and Celo G$. Both USD ceilings are explicit; no canary policy is required.
Preflight/verify only read public RPCs (ARBITRUM_RPC_URL / CELO_RPC_URL override defaults).
No signing, broadcasting, API-key access, policy creation, app deployment, or delivery-toggle changes.
Save evidence outside the repository. Exit 2 means a preflight prerequisite is unmet; exit 1 means invalid input or failed reads/checks.
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: Object.fromEntries(
      [
        "gas-cap-usd",
        "daily-budget-usd",
        "webhook",
        "source-account",
        "celo-account",
        "recipient",
        "amount",
        "before",
        "transaction-hash",
        "user-operation-hash",
      ]
        .map((key) => [key, { type: "string" }])
        .concat([["help", { type: "boolean" }]])
    ),
  });
  if (values.help || positionals.length === 0) {
    process.stdout.write(help);
    return;
  }
  if (positionals.length !== 1)
    throw new SetupError("Supply exactly one command. Run with --help.");
  let output;
  switch (positionals[0]) {
    case "policy":
      output = policyPlan({
        gasCapUsd: values["gas-cap-usd"],
        dailyBudgetUsd: values["daily-budget-usd"],
        webhook: values.webhook,
      });
      break;
    case "preflight":
      output = await preflight({
        sourceAccount: values["source-account"],
        celoAccount: values["celo-account"],
        recipient: values.recipient,
        amount: values.amount,
      });
      break;
    case "verify":
      output = await verifyReceipt({
        before: JSON.parse(readFileSync(requireValue(values.before, "before"), "utf8")),
        transactionHash: values["transaction-hash"],
        userOperationHash: values["user-operation-hash"],
      });
      break;
    default:
      throw new SetupError("Unknown command. Run with --help.");
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (output.readChecksPassed === false) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // RPC errors can contain credential-bearing URLs; never print SDK errors or input data.
    const message =
      error instanceof SetupError
        ? error.message
        : "RPC or input processing failed; inspect provider health without sharing credentials.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
