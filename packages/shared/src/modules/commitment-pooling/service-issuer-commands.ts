import { readIssuerBooking } from "./service-issuer-bookings";
import { type Abi } from "viem";
import type { ContractCall } from "../transactions/types";
import { serviceAddress, serviceFlag, serviceTuple } from "./service-access-chain-values";
import {
  AdapterABI,
  EscrowABI,
  TokenABI,
  PoolABI,
  issuerAssetState,
  issuerPoolState,
  verifyIssuerRoute,
  type ServiceIssuerChain,
} from "./service-issuer-chain";
import {
  issuerAsset,
  issuerDigest,
  issuerSame,
  ISSUER_REVIEW_SECONDS,
} from "./service-issuer-metadata";
import type {
  ServiceIssuerAction,
  ServiceIssuerActor,
  ServiceIssuerRoute,
} from "./service-issuer-types";

const MAX = (1n << 256n) - 1n;
const positive = (n: bigint) => typeof n === "bigint" && n > 0n && n < MAX;
/** Actual contract argument order and quantities; each approval/configuration/spend is a separate review. */
export async function prepareIssuerCall(
  chain: ServiceIssuerChain,
  route: ServiceIssuerRoute,
  actor: ServiceIssuerActor,
  action: ServiceIssuerAction,
  expiresAt: bigint
) {
  const recovery =
    action.kind === "revokeReserve" ||
    action.kind === "revokeExchange" ||
    action.kind === "authorizeReturn" ||
    (action.kind === "configureReserve" && !action.enabled);
  const asset = issuerAsset(route, actor.assetId, recovery);
  const exchange = ["exchange", "approveExchange", "revokeExchange"].includes(action.kind);
  if (!exchange && (asset.kind !== "individual" || !issuerSame(actor.address, asset.ownerReserve)))
    throw new Error(
      "This issuer action requires the owning member; collective actions use the Safe workflow"
    );
  await verifyIssuerRoute(route, asset, chain);
  const [state, timestamp] = await Promise.all([
    issuerAssetState(chain, route, asset, actor.address),
    chain.timestamp(),
  ]);
  if (typeof expiresAt !== "bigint" || expiresAt > timestamp + ISSUER_REVIEW_SECONDS)
    throw new Error("Issuer review expiry exceeds its bounded window");
  if (timestamp >= expiresAt) throw new Error("Issuer review expired; review again");
  if (!recovery && state.expired) throw new Error("Service token expired");
  const call = (
    address: typeof actor.address,
    abi: Abi,
    functionName: string,
    args: readonly unknown[]
  ): ContractCall => ({
    address,
    abi,
    functionName,
    args,
    chainId: 100,
    account: actor.address,
    value: 0n,
  });
  let command: ContractCall;
  const expected: Record<string, bigint | boolean> = {};
  let extra: unknown = null;
  switch (action.kind) {
    case "issue":
      if (!positive(action.amount) || state.minted + action.amount > asset.initialSupply!)
        throw new Error("Issuance exceeds the member-reviewed finite supply");
      expected.minted = state.minted + action.amount;
      expected.balance = state.balance + action.amount;
      command = call(asset.token.address, TokenABI as Abi, "mintTo", [
        asset.ownerReserve,
        action.amount,
      ]);
      break;
    case "approveReserve":
    case "revokeReserve":
    case "approveExchange":
    case "revokeExchange": {
      const pool = action.kind.includes("Exchange");
      const amount = "amount" in action ? action.amount : 0n;
      const previous = pool ? state.poolAllowance : state.reserveAllowance;
      if ("amount" in action && !positive(amount))
        throw new Error("Finite approval must be positive; review a revoke separately");
      if (
        amount !== 0n &&
        (!positive(amount) ||
          amount > state.balance ||
          (!pool && amount > asset.adapterAllowance!) ||
          previous !== 0n)
      )
        throw new Error("Finite approval needs a zero allowance and sufficient reviewed reserve");
      expected.allowance = amount;
      command = call(asset.token.address, TokenABI as Abi, "approve", [
        pool ? route.pool.deployment.address : route.adapter.address,
        amount,
      ]);
      break;
    }
    case "configureReserve":
      if (
        action.enabled &&
        (state.reserveAllowance === 0n ||
          state.reserveAllowance > asset.adapterAllowance! ||
          !issuerSame(state.sourceAuthority, asset.sourceAuthority))
      )
        throw new Error(
          "Reserve configuration needs finite member allowance and registered source authority"
        );
      expected.enabled = action.enabled;
      command = call(route.adapter.address, AdapterABI as Abi, "configureAsset", [
        asset.token.address,
        asset.sourceAuthority,
        action.enabled,
      ]);
      break;
    case "approveBooking":
    case "authorizeReturn": {
      const b = await readIssuerBooking(chain, route, actor.assetId, action);
      extra = b;
      if (action.kind === "approveBooking" && !b.reviewedTermsMatch)
        throw new Error("Booking issuer, terms, unit or exact authorization changed");
      if (b.frozen || b.result.decision === "abort")
        throw new Error("Booking no longer permits this issuer review");
      if (action.kind === "approveBooking") {
        // Pausing new bookings disables the reserve; the member approves none until resuming.
        if (!serviceFlag(serviceTuple(state.authorization, ["issuerAuthority", "enabled"]).enabled))
          throw new Error("New bookings are paused; resume them before approving one");
        if (
          b.result.issuerApproved ||
          b.result.decision !== "none" ||
          b.holderAbortRequested ||
          timestamp >= b.authorization.acceptanceDeadline
        )
          throw new Error("Booking approval is no longer eligible");
        expected.issuerApproved = true;
        command = call(
          route.service.destination.address,
          EscrowABI as Abi,
          "approveSetupAuthorization",
          [action.setupId, action.authorizationHash]
        );
      } else {
        if (
          !b.result.issuerApproved ||
          typeof action.ceiling !== "bigint" ||
          action.ceiling <= b.ceiling ||
          action.ceiling > b.authorization.voucherUnits
        )
          throw new Error("Return approval must increase the exact booking's bounded ceiling");
        expected.ceiling = action.ceiling;
        command = call(route.service.destination.address, EscrowABI as Abi, "authorizeReturn", [
          action.setupId,
          action.authorizationHash,
          action.ceiling,
        ]);
      }
      break;
    }
    case "exchange": {
      const output = issuerAsset(route, action.outputAssetId);
      if (
        issuerSame(output.token.address, asset.token.address) ||
        !positive(action.amount) ||
        !positive(action.minimumOutput) ||
        action.deadline <= timestamp ||
        action.deadline > expiresAt
      )
        throw new Error(
          "Exchange needs distinct assets, finite quantities and a current bounded deadline"
        );
      const pool = await issuerPoolState(chain, route, asset, output, action.amount);
      extra = pool;
      if (
        pool.outputExpired ||
        pool.quote !== action.quotedOutput ||
        action.minimumOutput > pool.quote ||
        state.balance < action.amount ||
        state.poolAllowance !== action.amount ||
        pool.availableOutput < pool.grossQuote ||
        pool.poolInput + action.amount > pool.cap
      )
        throw new Error("Exchange quote, minimum, inventory, cap or exact allowance changed");
      expected.grossOutput = pool.grossQuote;
      command = call(route.pool.deployment.address, PoolABI as Abi, "withdraw", [
        output.token.address,
        asset.token.address,
        action.amount,
        actor.address,
        action.minimumOutput,
        action.deadline,
      ]);
      break;
    }
    default:
      throw new Error("Unsupported issuer operation");
  }
  return { call: command, state: issuerDigest({ state, extra }), expected, timestamp };
}

export async function issuerReadback(
  chain: ServiceIssuerChain,
  route: ServiceIssuerRoute,
  actor: ServiceIssuerActor,
  action: ServiceIssuerAction,
  expected: Readonly<Record<string, bigint | boolean>>
) {
  const asset = issuerAsset(route, actor.assetId, true);
  await verifyIssuerRoute(route, asset, chain);
  const state = await issuerAssetState(chain, route, asset, actor.address);
  let matchesReceipt = true;
  if (
    (typeof expected.minted === "bigint" &&
      typeof expected.balance === "bigint" &&
      (state.minted !== expected.minted || state.balance !== expected.balance)) ||
    ("allowance" in expected &&
      (action.kind.includes("Exchange") ? state.poolAllowance : state.reserveAllowance) !==
        expected.allowance)
  )
    matchesReceipt = false;
  if (action.kind === "configureReserve") {
    const auth = serviceTuple(state.authorization, ["issuerAuthority", "enabled"]);
    if (
      !issuerSame(serviceAddress(auth.issuerAuthority), asset.sourceAuthority) ||
      auth.enabled !== expected.enabled
    )
      matchesReceipt = false;
  }
  if (action.kind === "approveBooking" || action.kind === "authorizeReturn") {
    const b = await readIssuerBooking(chain, route, actor.assetId, action);
    if (
      (action.kind === "approveBooking" && !b.result.issuerApproved) ||
      (action.kind === "authorizeReturn" && b.ceiling !== action.ceiling)
    )
      matchesReceipt = false;
  }
  return matchesReceipt;
}
