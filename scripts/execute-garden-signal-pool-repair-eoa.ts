#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import dotenv from "dotenv";
import { createPublicClient, createWalletClient, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPORTS_DIR = path.resolve(PROJECT_ROOT, "reports");
dotenv.config({ path: path.resolve(SCRIPT_DIR, "../.env"), quiet: true });

const CHAIN_CONFIGS: Record<
  number,
  { label: string; envKey: string; defaultRpcUrl: string }
> = {
  11155111: {
    label: "sepolia",
    envKey: "SEPOLIA_RPC_URL",
    defaultRpcUrl: "https://ethereum-sepolia.publicnode.com",
  },
  42161: {
    label: "arbitrum",
    envKey: "ARBITRUM_RPC_URL",
    defaultRpcUrl: "https://arb1.arbitrum.io/rpc",
  },
  42220: {
    label: "celo",
    envKey: "CELO_RPC_URL",
    defaultRpcUrl: "https://forno.celo.org",
  },
};

type EoaPlanTransaction = {
  to: `0x${string}`;
  value: string;
  data: `0x${string}`;
  contractMethod?: { name: string };
};

type EoaExecutionPlan = {
  kind: "garden-signal-pool-eoa-plan";
  chainId: number;
  network: string;
  createdAt: string;
  name: string;
  description?: string;
  moduleOwnerAddress: `0x${string}`;
  transactions: EoaPlanTransaction[];
};

type BroadcastSigner =
  | {
      kind: "private-key";
      account: ReturnType<typeof privateKeyToAccount>;
      sourceLabel: string;
    }
  | {
      kind: "keystore";
      account: ReturnType<typeof privateKeyToAccount>;
      sourceLabel: string;
    };

function usage(): never {
  console.error(
    [
      "Usage:",
      "  bun scripts/execute-garden-signal-pool-repair-eoa.ts [options]",
      "",
      "Options:",
      "  --plan <path>       Optional override for the EOA execution plan JSON",
      "  --rpc-url <url>     Override RPC URL",
      "  --account <name>    Foundry keystore account name (default: green-goods-deployer)",
      "  --broadcast         Send transactions instead of dry-running them",
      "  --help              Show this help",
      "",
      "Environment:",
      "  FOUNDRY_KEYSTORE_ACCOUNT              Preferred Foundry keystore account",
      "  CAST_UNSAFE_PASSWORD                  Optional non-interactive keystore password",
      "  GARDEN_SIGNAL_POOL_REPAIR_PRIVATE_KEY Optional raw signer private key",
      "  MIGRATION_PRIVATE_KEY                 Fallback signer private key",
      "  PRIVATE_KEY                           Final fallback signer private key",
    ].join("\n")
  );
  process.exit(1);
}

function resolveRpcUrl(chainId: number, explicitRpcUrl?: string): string {
  if (explicitRpcUrl) return explicitRpcUrl;
  const config = CHAIN_CONFIGS[chainId];
  if (!config) throw new Error(`Unsupported chain id: ${chainId}`);
  const envValue = process.env[config.envKey]?.trim();
  return envValue || config.defaultRpcUrl;
}

function resolvePrivateKey(): `0x${string}` | null {
  const rawKey =
    process.env.GARDEN_SIGNAL_POOL_REPAIR_PRIVATE_KEY?.trim() ||
    process.env.MIGRATION_PRIVATE_KEY?.trim() ||
    process.env.PRIVATE_KEY?.trim();

  if (!rawKey) {
    return null;
  }

  const normalizedKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalizedKey)) {
    throw new Error("Private key must be 32 bytes hex-encoded.");
  }

  return normalizedKey as `0x${string}`;
}

function resolveKeystoreName(explicitAccount?: string): string {
  return (
    explicitAccount?.trim() ||
    process.env.FOUNDRY_KEYSTORE_ACCOUNT?.trim() ||
    "green-goods-deployer"
  );
}

function decryptFoundryKeystore(keystoreName: string): `0x${string}` {
  const args = ["wallet", "decrypt-keystore", keystoreName];
  const unsafePassword = process.env.CAST_UNSAFE_PASSWORD?.trim();

  if (unsafePassword) {
    args.push("--unsafe-password", unsafePassword);
  }

  const output = execFileSync("cast", args, {
    encoding: "utf8",
    stdio: ["inherit", "pipe", "inherit"],
    env: process.env,
  }).trim();

  const privateKey = output.match(/0x[0-9a-fA-F]{64}/)?.[0];
  if (!privateKey) {
    throw new Error(`Failed to decrypt Foundry keystore account ${keystoreName}.`);
  }

  return privateKey as `0x${string}`;
}

function resolveBroadcastSigner(explicitAccount?: string): BroadcastSigner {
  const privateKey = resolvePrivateKey();
  if (privateKey) {
    return {
      kind: "private-key",
      account: privateKeyToAccount(privateKey),
      sourceLabel: "private key env",
    };
  }

  const keystoreName = resolveKeystoreName(explicitAccount);
  const decryptedPrivateKey = decryptFoundryKeystore(keystoreName);

  return {
    kind: "keystore",
    account: privateKeyToAccount(decryptedPrivateKey),
    sourceLabel: `Foundry keystore ${keystoreName}`,
  };
}

async function loadPlan(planPath: string): Promise<EoaExecutionPlan> {
  const raw = await readFile(planPath, "utf8");
  const parsed = JSON.parse(raw) as EoaExecutionPlan;

  if (parsed.kind !== "garden-signal-pool-eoa-plan") {
    throw new Error(`Unsupported plan kind: ${String((parsed as { kind?: string }).kind)}`);
  }

  if (!Array.isArray(parsed.transactions) || parsed.transactions.length === 0) {
    throw new Error("EOA execution plan has no transactions.");
  }

  return parsed;
}

async function resolveDefaultPlanPath(): Promise<string> {
  const defaultReportPath = path.resolve(REPORTS_DIR, "garden-signal-pool-repair-report-42161.json");

  try {
    const reportRaw = await readFile(defaultReportPath, "utf8");
    const report = JSON.parse(reportRaw) as { moduleEoaPlanPath?: string | null };
    if (report.moduleEoaPlanPath) {
      return path.resolve(report.moduleEoaPlanPath);
    }
  } catch {
    // Fall through to glob-based discovery.
  }

  const entries = await readdir(REPORTS_DIR);
  const candidates = entries
    .filter((entry) => /^garden-signal-pool-eoa-plan-\d+-\d+\.json$/.test(entry))
    .sort()
    .reverse();

  if (candidates.length === 0) {
    throw new Error(
      `Could not find a garden signal pool EOA plan. Generate one first with bun scripts/generate-garden-signal-pool-safe-txs.ts --all.`
    );
  }

  return path.resolve(REPORTS_DIR, candidates[0]);
}

async function main() {
  const { values } = parseArgs({
    options: {
      plan: { type: "string" },
      "rpc-url": { type: "string" },
      account: { type: "string" },
      broadcast: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    usage();
  }

  const planPath = values.plan
    ? path.resolve(values.plan)
    : await resolveDefaultPlanPath();
  const plan = await loadPlan(planPath);
  const rpcUrl = resolveRpcUrl(plan.chainId, values["rpc-url"]);
  const expectedOwner = getAddress(plan.moduleOwnerAddress);
  const signer = values.broadcast ? resolveBroadcastSigner(values.account) : null;
  const account = signer?.account ?? null;

  if (signer) {
    const signerAddress = getAddress(signer.account.address);
    if (signerAddress !== expectedOwner) {
      throw new Error(
        `Signer mismatch: expected ${expectedOwner}, got ${signerAddress}. Refusing to execute plan.`
      );
    }
  }

  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const walletClient = account
    ? createWalletClient({ account, transport: http(rpcUrl) })
    : null;
  const chainLabel = CHAIN_CONFIGS[plan.chainId]?.label ?? plan.network;

  console.log(
    `Loaded EOA execution plan ${planPath}\n` +
      `  Name:         ${plan.name}\n` +
      `  Chain:        ${chainLabel} (${plan.chainId})\n` +
      `  Owner EOA:    ${expectedOwner}\n` +
      `  Transactions: ${plan.transactions.length}\n` +
      `  Signer:       ${account ? `${getAddress(account.address)} via ${signer?.sourceLabel}` : "(not required for dry-run)"}\n` +
      `  Mode:         ${values.broadcast ? "broadcast" : "dry-run"}\n`
  );

  for (const [index, tx] of plan.transactions.entries()) {
    const label = tx.contractMethod?.name ?? `tx-${index + 1}`;
    const to = getAddress(tx.to);
    const value = BigInt(tx.value);

    if (!values.broadcast) {
      await publicClient.call({
        account: expectedOwner,
        to,
        data: tx.data,
        value,
      });
      console.log(
        `[dry-run ${index + 1}/${plan.transactions.length}] ${label} -> ${to} OK`
      );
      continue;
    }

    const hash = await walletClient!.sendTransaction({
      account: account!,
      to,
      data: tx.data,
      value,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(
      `[broadcast ${index + 1}/${plan.transactions.length}] ${label} -> ${to} ${receipt.transactionHash}`
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
