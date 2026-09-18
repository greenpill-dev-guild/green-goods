#!/usr/bin/env bun
/**
 * Upload all: Pimlico simulation cases
 *
 * Measures whether one UserOperation carrying N queued works (and decisions) is
 * accepted and sponsored, without signing or sending anything. The results set
 * MAX_ITEMS_PER_USER_OPERATION and MAX_ITEMS_PER_WALLET_CALL in
 * src/modules/work/upload-queued-work.ts.
 *
 * Each case builds the call Upload all sends (buildQueuedAttestationsCall) at
 * realistic calldata, by default a 1,000-character field note and 10 photos per
 * work. Every work carries its own note and its own photo CIDs: Arbitrum prices a
 * transaction's L1 share on its compressed size, and identical works would
 * compress to almost nothing and understate the cost sponsorship has to cover.
 * Then:
 *   1. eth_call from the account: would the resolvers accept it?
 *   2. prepareUserOperation on the Kernel 0.3.1 passkey account with the app's
 *      paymaster context: bundler estimation and sponsorship. Nothing is signed
 *      or sent. Estimation uses a stub signature, so no passkey is needed.
 *   3. eth_estimateGas from --wallet, when given: the wallet call's gas.
 * With --ended-action, a work on an ended action must be refused.
 *
 * What it cannot measure: an account that is not deployed yet. Its first
 * UserOperation also pays for the deployment, and this run refuses such an
 * account, since the stub owner below has a different address. A gardener a
 * steward added, whose first UserOperation is an Upload all, needs a device check
 * before the limits are trusted for them.
 *
 * Run from packages/shared, with the root .env loaded for VITE_PIMLICO_API_KEY:
 *
 *   bun --env-file=../../.env scripts/simulate-upload-all.ts \
 *     --account 0x<deployed Kernel account of a garden member> \
 *     --garden 0x<that garden> --action <an active action UID> \
 *     [--ended-action <an ended action UID>] \
 *     [--work-uid 0x<a work by someone else> --work-action <its action UID>] \
 *     [--wallet 0x<a member's wallet address>] \
 *     [--chain <id>] [--sizes 1,2,5,10] [--photos 10] [--feedback-chars 1000] [--rpc <url>]
 *
 * Decisions need --account to be an operator of the garden.
 * VITE_PIMLICO_SPONSORSHIP_POLICY_ID overrides the app's default sponsorship policy.
 */

import { parseArgs } from "node:util";
import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { createSmartAccountClient } from "permissionless";
import { toKernelSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import {
  BaseError,
  type Chain,
  createPublicClient,
  encodeFunctionData,
  type Hex,
  http,
  isAddress,
} from "viem";
import { entryPoint07Address, toWebAuthnAccount } from "viem/account-abstraction";
import { arbitrum, celo, sepolia } from "viem/chains";
import { DEFAULT_CHAIN_ID, getEASConfig } from "../src/config/blockchain";
import {
  buildQueuedAttestationsCall,
  type QueuedAttestation,
} from "../src/utils/eas/transaction-builder";

const CHAINS: Record<number, Chain> = { 42161: arbitrum, 42220: celo, 11155111: sepolia };

/** The app's policy when VITE_PIMLICO_SPONSORSHIP_POLICY_ID is unset (workflows/auth-passkey-adapters.ts). */
const DEFAULT_SPONSORSHIP_POLICY_ID = "sp_next_monster_badoon";

/** The P-256 generator point. The owner only shapes the stub signature; it never signs. */
const STUB_PASSKEY_PUBLIC_KEY =
  "0x046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5" as Hex;

/**
 * A CIDv1 of the length Pinata returns for photos and metadata, different on every
 * call. These stand in for real CIDs so the batch compresses the way a real one
 * does; nothing here is a secret, so an ordinary random source is the right one.
 */
const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";
const pick = <T>(items: ArrayLike<T>): T => items[Math.floor(Math.random() * items.length)];
function randomCid(): string {
  return `bafkrei${Array.from({ length: 52 }, () => pick(BASE32)).join("")}`;
}
const TITLE = "Soil Health Assessment and Community Composting Workshop";

interface CaseResult {
  case: string;
  calldataBytes: number;
  resolvers: string;
  userOperation: string;
  totalUserOperationGas?: string;
  walletGas?: string;
}

function usage(message?: string): never {
  if (message) console.error(`\n${message}`);
  console.error(
    "\nUsage (from packages/shared): bun --env-file=../../.env scripts/simulate-upload-all.ts " +
      "--account 0x… --garden 0x… --action <uid> " +
      "[--ended-action <uid>] [--work-uid 0x… --work-action <uid>] [--wallet 0x…] " +
      "[--chain <id>] [--sizes 1,2,5,10] [--photos 10] [--feedback-chars 1000] [--rpc <url>]\n"
  );
  process.exit(1);
}

function redact(text: string): string {
  return text.replace(/apikey=[^&\s"']+/gi, "apikey=***");
}

function describeError(error: unknown): string {
  const message =
    error instanceof BaseError
      ? [error.shortMessage, error.details].filter(Boolean).join(": ")
      : error instanceof Error
        ? error.message
        : String(error);
  return redact(message).slice(0, 160);
}

// `0x${string}`, not Address: viem's Address is a plain string under this repo's
// register, and the attestation builders want the literal form.
function requireAddress(value: string | undefined, flag: string): `0x${string}` {
  if (!value || !isAddress(value)) usage(`${flag} must be an address`);
  return value as `0x${string}`;
}

function requireUid(value: string | undefined, flag: string): bigint {
  if (!value || !/^\d+$/.test(value)) usage(`${flag} must be an action UID`);
  return BigInt(value);
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((arg) => arg !== "--"),
    options: {
      account: { type: "string" },
      garden: { type: "string" },
      action: { type: "string" },
      "ended-action": { type: "string" },
      "work-uid": { type: "string" },
      "work-action": { type: "string" },
      wallet: { type: "string" },
      // The limits this measures are read on the app's own chain.
      chain: { type: "string", default: String(DEFAULT_CHAIN_ID) },
      sizes: { type: "string", default: "1,2,5,10" },
      photos: { type: "string", default: "10" },
      "feedback-chars": { type: "string", default: "1000" },
      rpc: { type: "string" },
    },
  });

  const chainId = Number(values.chain);
  const chain = CHAINS[chainId] ?? usage(`--chain ${values.chain} is not one of ${Object.keys(CHAINS)}`);
  const account = requireAddress(values.account, "--account");
  const garden = requireAddress(values.garden, "--garden");
  const action = requireUid(values.action, "--action");
  const endedAction = values["ended-action"]
    ? requireUid(values["ended-action"], "--ended-action")
    : undefined;
  const workUid = values["work-uid"] as Hex | undefined;
  if (workUid && !/^0x[0-9a-fA-F]{64}$/.test(workUid)) usage("--work-uid must be a bytes32 UID");
  const workAction = values["work-action"] ? requireUid(values["work-action"], "--work-action") : action;
  const wallet = values.wallet ? requireAddress(values.wallet, "--wallet") : undefined;
  const sizes = values.sizes.split(",").map((size) => Number(size.trim()));
  if (sizes.some((size) => !Number.isInteger(size) || size < 1)) usage("--sizes must be positive integers");
  const photos = Number(values.photos);
  const feedbackChars = Number(values["feedback-chars"]);

  const apiKey = process.env.VITE_PIMLICO_API_KEY;
  if (!apiKey) usage("VITE_PIMLICO_API_KEY is not set. Load the root .env.");
  const sponsorshipPolicyId =
    process.env.VITE_PIMLICO_SPONSORSHIP_POLICY_ID || DEFAULT_SPONSORSHIP_POLICY_ID;

  const eas = getEASConfig(chainId);
  const publicClient = createPublicClient({ chain, transport: http(values.rpc) });
  const bundlerUrl = `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${apiKey}`;
  const pimlicoClient = createPimlicoClient({
    transport: http(bundlerUrl),
    entryPoint: { address: entryPoint07Address, version: "0.7" },
  });
  const kernel = await toKernelSmartAccount({
    client: publicClient,
    version: "0.3.1",
    owners: [
      toWebAuthnAccount({
        credential: { id: "upload-all-simulation", publicKey: STUB_PASSKEY_PUBLIC_KEY },
      }),
    ],
    entryPoint: { address: entryPoint07Address, version: "0.7" },
    address: account,
  });
  if (!(await publicClient.getCode({ address: account })))
    usage(`--account ${account} has no code on chain ${chainId}: use a deployed Kernel account`);
  const smartAccountClient = createSmartAccountClient({
    account: kernel,
    chain,
    bundlerTransport: http(bundlerUrl),
    paymaster: pimlicoClient,
    paymasterContext: { sponsorshipPolicyId },
    userOperation: {
      estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  });

  // Field notes repeat words, as real ones do, but no two works share a note.
  const NOTE_WORDS =
    "compost windrows soil moisture beds seedlings survival mulch swale rainwater canopy pruning nursery transplant weeding harvest pollinators fencing irrigation terrace".split(
      " "
    );
  const fieldNote = (chars = feedbackChars) => {
    let note = "";
    while (note.length < chars) note += `${pick(NOTE_WORDS)} `;
    return note.slice(0, chars);
  };
  const workEncoder = new SchemaEncoder(eas.WORK.schema);
  const approvalEncoder = new SchemaEncoder(eas.WORK_APPROVAL.schema);
  const work = (actionUID: bigint): QueuedAttestation => ({
    schema: eas.WORK.uid as Hex,
    gardenAddress: garden,
    attestationData: workEncoder.encodeData([
      { name: "actionUID", value: actionUID, type: "uint256" },
      { name: "title", value: TITLE, type: "string" },
      { name: "feedback", value: fieldNote(), type: "string" },
      { name: "metadata", value: randomCid(), type: "string" },
      { name: "media", value: Array.from({ length: photos }, randomCid), type: "string[]" },
    ]) as Hex,
  });
  const decision = (): QueuedAttestation => ({
    schema: eas.WORK_APPROVAL.uid as Hex,
    gardenAddress: garden,
    attestationData: approvalEncoder.encodeData([
      { name: "actionUID", value: workAction, type: "uint256" },
      { name: "workUID", value: workUid as Hex, type: "bytes32" },
      { name: "approved", value: true, type: "bool" },
      { name: "feedback", value: fieldNote(280), type: "string" },
      { name: "confidence", value: 2, type: "uint8" },
      { name: "verificationMethod", value: 1, type: "uint8" },
      { name: "reviewNotesCID", value: randomCid(), type: "string" },
    ]) as Hex,
  });

  const runCase = async (label: string, queued: QueuedAttestation[]): Promise<CaseResult> => {
    const call = buildQueuedAttestationsCall(eas.EAS.address as `0x${string}`, queued);
    const data = encodeFunctionData({
      abi: call.abi,
      functionName: call.functionName,
      args: call.args,
    });
    const result: CaseResult = {
      case: label,
      calldataBytes: (data.length - 2) / 2,
      resolvers: "accepted",
      userOperation: "sponsored",
    };
    try {
      await publicClient.call({ account, to: call.address, data });
    } catch (error) {
      result.resolvers = describeError(error);
    }
    try {
      const prepared = await smartAccountClient.prepareUserOperation({
        calls: [{ to: call.address, data, value: 0n }],
      });
      const gas =
        prepared.callGasLimit +
        prepared.verificationGasLimit +
        prepared.preVerificationGas +
        (prepared.paymasterVerificationGasLimit ?? 0n) +
        (prepared.paymasterPostOpGasLimit ?? 0n);
      if (!prepared.paymaster) result.userOperation = "estimated, not sponsored";
      result.totalUserOperationGas = gas.toString();
    } catch (error) {
      result.userOperation = describeError(error);
    }
    if (wallet) {
      try {
        result.walletGas = (
          await publicClient.estimateGas({ account: wallet, to: call.address, data })
        ).toString();
      } catch (error) {
        result.walletGas = describeError(error);
      }
    }
    return result;
  };

  const results: CaseResult[] = [];
  for (const size of sizes) {
    console.log(`Simulating ${size} ${size === 1 ? "work" : "works"}…`);
    results.push(
      await runCase(
        `${size} works`,
        Array.from({ length: size }, () => work(action))
      )
    );
  }
  const largest = Math.max(...sizes);
  if (workUid) {
    console.log("Simulating works with decisions…");
    results.push(
      await runCase(`${largest} works + 2 decisions`, [
        ...Array.from({ length: largest }, () => work(action)),
        decision(),
        decision(),
      ])
    );
  }
  if (endedAction !== undefined) {
    console.log("Simulating a work on an ended action…");
    const culprit = await runCase("culprit: 1 ended + 1 active", [
      work(endedAction),
      work(action),
    ]);
    // The resolvers decide this, not the paymaster: sponsorship says a bundler
    // would carry the call, not that the chain would accept it.
    culprit.case +=
      culprit.resolvers === "accepted" ? " (UNEXPECTEDLY ACCEPTED)" : " (refused, as expected)";
    results.push(culprit);
  }

  console.table(results);
  const sponsored = results
    .filter((row) => row.case.endsWith(" works") && row.userOperation === "sponsored")
    .map((row) => Number.parseInt(row.case, 10));
  const walletAccepted = results
    .filter((row) => row.case.endsWith(" works") && row.walletGas && /^\d+$/.test(row.walletGas))
    .map((row) => Number.parseInt(row.case, 10));
  console.log(
    `Largest sponsored UserOperation: ${sponsored.length ? Math.max(...sponsored) : "none"} works` +
      (wallet
        ? `; largest wallet call estimated: ${walletAccepted.length ? Math.max(...walletAccepted) : "none"} works`
        : "")
  );
  console.log(`Sponsorship policy: ${sponsorshipPolicyId}. Nothing was signed or sent.`);
}

main().catch((error: unknown) => {
  console.error(describeError(error));
  process.exit(1);
});
