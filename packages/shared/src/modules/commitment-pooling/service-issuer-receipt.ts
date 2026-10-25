import { decodeEventLog, erc20Abi, type Hex } from "viem";
import { entryPoint07Abi, entryPoint07Address } from "viem/account-abstraction";
import type { TxResult } from "../transactions/types";
import { AdapterABI, BookingEventsABI, PoolABI } from "./service-issuer-abis";
import type { ServiceIssuerChain } from "./service-issuer-chain";
import { issuerAsset, issuerSame } from "./service-issuer-metadata";
import type { ServiceIssuerReview, ServiceIssuerRoute } from "./service-issuer-types";

type Log = NonNullable<Awaited<ReturnType<ServiceIssuerChain["receipt"]>>["logs"]>[number];
function executionLogs(logs: readonly Log[], review: ServiceIssuerReview, submission: TxResult) {
  const reference = submission.broadcastReference;
  if (reference?.kind !== "user-operation") return logs;
  let start = 0;
  let matched: readonly Log[] | undefined;
  for (const [index, log] of logs.entries()) {
    if (!issuerSame(log.address, entryPoint07Address) || !log.topics[0]) continue;
    try {
      const event = decodeEventLog({
        abi: entryPoint07Abi,
        topics: [log.topics[0], ...log.topics.slice(1)],
        data: log.data,
      });
      if (event.eventName !== "UserOperationEvent") continue;
      if (issuerSame(event.args.userOpHash, reference.hash)) {
        if (matched || !issuerSame(event.args.sender, review.actor.address) || !event.args.success)
          throw new Error("Invalid issuer UserOperation execution boundary");
        matched = logs.slice(start, index);
      }
      start = index + 1;
    } catch (error) {
      if (error instanceof Error && error.message.includes("execution boundary")) throw error;
    }
  }
  if (!matched) throw new Error("Issuer UserOperation execution boundary unavailable");
  return matched;
}

/** A bundled transaction's unrelated operations cannot establish this holder's delivery. */
function verifyExchange(
  logs: readonly Log[],
  route: ServiceIssuerRoute,
  review: ServiceIssuerReview
) {
  const action = review.action;
  if (action.kind !== "exchange") return;
  const input = issuerAsset(route, review.actor.assetId, true);
  const output = issuerAsset(route, action.outputAssetId, true);
  let settlementOutput: bigint | undefined;
  let delivered = 0n;
  for (const log of logs) {
    if (!log.topics[0]) continue;
    try {
      if (issuerSame(log.address, route.pool.deployment.address)) {
        const event = decodeEventLog({
          abi: PoolABI,
          topics: [log.topics[0], ...log.topics.slice(1)],
          data: log.data,
        });
        if (event.eventName === "SwapSettlement") {
          const a = event.args;
          if (
            issuerSame(a.initiator, review.actor.address) &&
            issuerSame(a.tokenIn, input.token.address) &&
            issuerSame(a.tokenOut, output.token.address) &&
            a.amountIn === action.amount &&
            a.nominalAmountOut + a.poolFee + a.protocolFee === a.quotedAmountOut &&
            a.amountOut <= a.nominalAmountOut &&
            a.amountOut >= action.minimumOutput
          ) {
            if (settlementOutput !== undefined) throw new Error("Duplicate issuer settlement");
            settlementOutput = a.amountOut;
          }
        }
      } else if (issuerSame(log.address, output.token.address)) {
        const event = decodeEventLog({
          abi: erc20Abi,
          topics: [log.topics[0], ...log.topics.slice(1)],
          data: log.data,
        });
        if (
          event.eventName === "Transfer" &&
          issuerSame(event.args.from, route.pool.deployment.address) &&
          issuerSame(event.args.to, review.actor.address)
        )
          delivered += event.args.value;
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Duplicate issuer settlement") throw error;
    }
  }
  if (settlementOutput === undefined || delivered !== settlementOutput)
    throw new Error("Exact exchange settlement and holder delivery need reconciliation");
  return settlementOutput;
}

/** Canonical own-effect events prove execution even if a later legitimate action consumes the resulting balance/allowance. */
export async function verifyIssuerReceipt(
  chain: ServiceIssuerChain,
  route: ServiceIssuerRoute,
  review: ServiceIssuerReview,
  submission: TxResult,
  hash: Hex
) {
  const receipt = await chain.receipt(100, hash);
  const logs = executionLogs(receipt.logs ?? [], review, submission);
  if (review.action.kind === "exchange") return verifyExchange(logs, route, review);
  const asset = issuerAsset(route, review.actor.assetId, true);
  const action = review.action;
  let matched = false;
  for (const log of logs) {
    if (!log.topics[0]) continue;
    const topics: [Hex, ...Hex[]] = [log.topics[0], ...log.topics.slice(1)];
    try {
      if (issuerSame(log.address, asset.token.address)) {
        const event = decodeEventLog({ abi: erc20Abi, topics, data: log.data });
        if (
          action.kind === "issue" &&
          event.eventName === "Transfer" &&
          /^0x0{40}$/i.test(event.args.from) &&
          issuerSame(event.args.to, asset.ownerReserve) &&
          event.args.value === action.amount
        )
          matched = true;
        if (
          ["approveReserve", "revokeReserve", "approveExchange", "revokeExchange"].includes(
            action.kind
          ) &&
          event.eventName === "Approval" &&
          issuerSame(event.args.owner, review.actor.address) &&
          issuerSame(
            event.args.spender,
            action.kind.includes("Exchange") ? route.pool.deployment.address : route.adapter.address
          ) &&
          event.args.value === ("amount" in action ? action.amount : 0n)
        )
          matched = true;
      }
      if (action.kind === "configureReserve" && issuerSame(log.address, route.adapter.address)) {
        const event = decodeEventLog({ abi: AdapterABI, topics, data: log.data });
        if (
          event.eventName === "AssetConfigured" &&
          issuerSame(event.args.issuer, review.actor.address) &&
          issuerSame(event.args.token, asset.token.address) &&
          issuerSame(event.args.issuerAuthority, asset.sourceAuthority) &&
          event.args.enabled === action.enabled
        )
          matched = true;
      }
      if (
        (action.kind === "approveBooking" || action.kind === "authorizeReturn") &&
        issuerSame(log.address, route.service.destination.address)
      ) {
        const event = decodeEventLog({ abi: BookingEventsABI, topics, data: log.data });
        if (
          issuerSame(event.args.issuer, review.actor.address) &&
          event.args.redemptionId === action.setupId &&
          ((action.kind === "approveBooking" &&
            event.eventName === "RedemptionIssuerApproved" &&
            event.args.payloadHash === action.authorizationHash) ||
            (action.kind === "authorizeReturn" &&
              event.eventName === "RedemptionReturnAuthorized" &&
              event.args.cumulativeReturnCeiling === action.ceiling))
        )
          matched = true;
      }
    } catch {
      /* Unrelated or malformed logs do not prove this exact operation. */
    }
  }
  if (!matched) throw new Error("Exact issuer receipt effect needs reconciliation");
}
