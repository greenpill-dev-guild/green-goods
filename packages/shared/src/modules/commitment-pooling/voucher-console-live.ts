import EscrowABI from "@green-goods/contracts/abis/GnosisVoucherEscrow.json";
import { type Abi, type Hex, type PublicClient, encodeFunctionData } from "viem";
import { createPublicClientForChain } from "../../config/pimlico";
import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import type { GraphQLReader } from "../data/graphql-client";
import {
  LEDGER_MAX_AGE_SECONDS,
  ledgerAgeSeconds,
  readProcessedBlockTimestamps,
} from "./data-pool-funding-freshness";
import { queryProcessedBlocks } from "./data-pool-funding-indexed-queries";
import {
  serviceAddress,
  serviceHash,
  serviceTuple,
  serviceUint,
} from "./service-access-chain-values";
import type { VoucherLegProgress } from "./service-access-voucher-types";
import { context, issuerFor, same, type Dependencies } from "./voucher-console-live-context";
import {
  UNAVAILABLE_VOUCHER_CONSOLE,
  type VoucherAsk,
  type VoucherBooking,
  type VoucherConsoleSnapshot,
} from "./voucher-console";

const needsExecution = (leg: VoucherLegProgress | undefined) =>
  leg?.state === "pending" || leg?.state === "failed";

/**
 * Whether the index has every booking prepared on the source chain up to two minutes ago, read
 * from the time of the last block it processed there. Destination custody comes from the chain,
 * so a cross-chain message still in flight shows on its booking instead of hiding it.
 */
async function discoveryCurrent(
  chainId: number,
  reader: GraphQLReader,
  deps: Dependencies
): Promise<boolean> {
  const processed = await queryProcessedBlocks(reader, [chainId]);
  if (!processed) return false;
  const timestamps = await readProcessedBlockTimestamps(
    processed,
    deps.createClient ?? (createPublicClientForChain as (chainId: number) => PublicClient)
  );
  const age = ledgerAgeSeconds(timestamps, deps.now ?? Math.floor(Date.now() / 1_000));
  return age !== null && age <= LEDGER_MAX_AGE_SECONDS;
}

/** The index discovers candidates; exact source consent and destination custody own the console. */
export async function readLiveVoucherConsole(
  input: { chainId: number; garden: Address },
  deps: Dependencies = {}
): Promise<VoucherConsoleSnapshot> {
  let ctx;
  try {
    ctx = await context(input, deps);
  } catch (error) {
    logger.warn("Voucher console route is unavailable", { error, garden: input.garden });
    return UNAVAILABLE_VOUCHER_CONSOLE;
  }
  if (!ctx) return UNAVAILABLE_VOUCHER_CONSOLE;
  const { route, reader } = ctx;
  const asset = route.assets.find((a) => a.garden && same(a.garden, input.garden));
  const snapshot: VoucherConsoleSnapshot = {
    evidence: "onchain",
    status: "observed",
    observedAt: 0,
    asks: [],
    bookings: [],
    reserve: null,
    issuer: asset
      ? {
          kind: "collective",
          name: asset.issuerName ?? asset.symbol,
          safe: asset.issuer,
          decimals: asset.decimals,
          chainId: 100,
          execution: "safe-file",
        }
      : null,
    incomplete: true,
  };
  const current = discoveryCurrent(input.chainId, reader, deps).catch((error: unknown) => {
    logger.warn("Voucher discovery freshness is unknown", { error, garden: input.garden });
    return false;
  });
  try {
    const result = await reader.query<{ VoucherServiceSetup: unknown[] }>(
      `query GardenVoucherSetups($chain: Int!, $module: String!, $core: String!, $garden: String!) {
        VoucherServiceSetup(where: {chainId: {_eq: $chain}, moduleAddress: {_eq: $module}, coreModule: {_eq: $core}, providerGarden: {_eq: $garden}, authorizationSeen: {_eq: true}}, order_by: {id: asc}, limit: 101) {
          id chainId moduleAddress coreModule providerGarden setupId commitmentId buyer authorizationSeen
        }
      }`,
      {
        chain: input.chainId,
        module: route.source.address.toLowerCase(),
        core: route.core.address.toLowerCase(),
        garden: input.garden.toLowerCase(),
      },
      "gardenVoucherSetups"
    );
    if (result.error) throw result.error;
    if (!Array.isArray(result.data.VoucherServiceSetup))
      throw new Error("Voucher console discovery unavailable");
    const asks: VoucherAsk[] = [];
    const bookings: VoucherBooking[] = [];
    const seen = new Set<Hex>();
    for (const value of result.data.VoucherServiceSetup.slice(0, 100)) {
      const row = serviceTuple(value, [
        "id",
        "chainId",
        "moduleAddress",
        "coreModule",
        "providerGarden",
        "setupId",
        "commitmentId",
        "buyer",
        "authorizationSeen",
      ]);
      const setupId = serviceHash(row.setupId);
      if (
        seen.has(setupId) ||
        row.id !== `${input.chainId}-${route.source.address.toLowerCase()}-${setupId}` ||
        row.chainId !== input.chainId ||
        row.authorizationSeen !== true ||
        !same(serviceAddress(row.moduleAddress), route.source.address) ||
        !same(serviceAddress(row.coreModule), route.core.address) ||
        !same(serviceAddress(row.providerGarden), input.garden) ||
        typeof row.commitmentId !== "string" ||
        !/^(0|[1-9]\d*)$/.test(row.commitmentId)
      )
        throw new Error("Voucher console discovery identity mismatch");
      seen.add(setupId);
      const { snapshot: source, setup } = await ctx.booking(
        serviceUint(BigInt(row.commitmentId)),
        serviceAddress(row.buyer),
        setupId
      );
      snapshot.observedAt = Math.max(snapshot.observedAt, Number(source.sourceTimestamp ?? 0n));
      if (source.currentVoucherSetupId !== setupId) continue;
      const issuer = issuerFor(route, setup);
      const a = setup.authorization;
      const d = setup.destination;
      if (source.consent?.state === "pending") {
        asks.push({
          paused:
            source.pause.core !== false ||
            source.pause.sourceVoucher !== false ||
            source.pause.destinationVoucher !== false,
          commitmentId: a.commitmentId,
          buyer: a.buyer,
          claimHash: source.consent.claimHash,
          agreed: { revision: source.consent.revision, termsHash: source.consent.termsHash },
          current: { revision: source.offer!.revision, termsHash: source.offer!.termsHash },
          agreedAt: null,
          issuer,
          setup: d
            ? {
                setupId: setup.setupId,
                authorizationHash: setup.authorizationHash,
                voucherUnits: a.voucherUnits,
                approvedAt: null,
                issuerApproved: d.result.issuerApproved,
                depositedUnits: d.result.depositedUnits - d.result.setupRefundedUnits,
                depositConfirmed:
                  setup.source.setupResult !== null &&
                  setup.source.setupResult.depositReceiptHash !== null &&
                  setup.source.setupResult.depositReceiptHash === d.result.depositReceiptHash &&
                  setup.source.setupResult.depositedUnits === d.result.depositedUnits &&
                  setup.source.setupResult.setupRefundedUnits === d.result.setupRefundedUnits,
                acceptBy: Number(a.acceptanceDeadline),
              }
            : null,
        });
      }
      if (
        source.consent?.state !== "accepted" ||
        d?.result.decision !== "activate" ||
        d.finalAllocation?.financiallyClosed
      )
        continue;
      const final = d.finalAllocation;
      const releaseNeedsExecution = needsExecution(final?.release);
      const refundNeedsExecution = needsExecution(final?.refund);
      bookings.push({
        commitmentId: a.commitmentId,
        holder: a.holder,
        setupId,
        issuer,
        voucherUnits: a.voucherUnits,
        service: {
          kind: "units",
          units: a.serviceUnits,
          label: source.offer!.unitLabel,
          // This is the contract ceiling for a new issuer permission, not a calculated remedy entitlement.
          // Safe signers must review the pinned service/remedy terms before authorizing it.
          returnLimit: d.finalAllocation || d.issuerReturnCeiling === null ? null : a.voucherUnits,
          returnCeiling: d.issuerReturnCeiling ?? 0n,
        },
        stage:
          releaseNeedsExecution || refundNeedsExecution
            ? {
                kind:
                  final?.release.state === "failed"
                    ? "transfer-failed"
                    : final?.refund.state === "failed"
                      ? "return-failed"
                      : "transfer-pending",
                units:
                  (releaseNeedsExecution ? final!.allocation.releaseVoucherUnits : 0n) +
                  (refundNeedsExecution ? final!.allocation.refundVoucherUnits : 0n),
              }
            : { kind: "in-progress" },
      });
    }
    snapshot.asks = asks;
    snapshot.bookings = bookings;
    // A full bounded read or an index behind the source chain can still be missing bookings.
    snapshot.incomplete = result.data.VoucherServiceSetup.length > 100 || !(await current);
  } catch (error) {
    snapshot.status = "unavailable";
    logger.warn("Voucher console discovery is unavailable", { error, garden: input.garden });
  }
  return snapshot;
}

export interface VoucherSafeFile {
  version: "1.0";
  chainId: "100";
  createdAt: number;
  meta: { name: string; description: string; createdFromSafeAddress: Address };
  transactions: { to: Address; value: "0"; data: Hex }[];
}

/** Re-read before exporting. The file is a proposal; Safe execution and canonical observations remain separate. */
export async function prepareVoucherSafeFile(
  input: { chainId: number; garden: Address },
  action:
    | { kind: "approve"; ask: VoucherAsk }
    | { kind: "return"; booking: VoucherBooking; ceiling: bigint }
    | { kind: "retry"; booking: VoucherBooking },
  deps: Dependencies = {}
): Promise<VoucherSafeFile> {
  const ctx = await context(input, deps);
  if (!ctx) throw new Error("Voucher route unavailable");
  const candidate = action.kind === "approve" ? action.ask : action.booking;
  if (candidate.issuer.kind !== "collective")
    throw new Error("Member issuers do not use Safe files");
  const buyer = action.kind === "approve" ? action.ask.buyer : action.booking.holder;
  const { snapshot, setup } = await ctx.booking(
    candidate.commitmentId,
    buyer,
    action.kind === "approve" ? undefined : action.booking.setupId
  );
  const issuer = issuerFor(ctx.route, setup);
  const a = setup.authorization;
  const d = setup.destination;
  if (
    !same(issuer.safe, candidate.issuer.safe) ||
    issuer.chainId !== candidate.issuer.chainId ||
    !d ||
    d.evidence !== "onchain"
  )
    throw new Error("Voucher issuer or execution state changed");
  let functionName: string;
  let calls: readonly (readonly unknown[])[];
  if (action.kind === "approve") {
    if (
      snapshot.pause.core !== false ||
      snapshot.pause.sourceVoucher !== false ||
      snapshot.pause.destinationVoucher !== false ||
      snapshot.consent?.state !== "pending" ||
      snapshot.consent.claimHash !== action.ask.claimHash ||
      snapshot.offer?.termsHash !== action.ask.current.termsHash ||
      snapshot.offer.revision !== action.ask.current.revision ||
      action.ask.setup?.setupId !== setup.setupId ||
      action.ask.setup.authorizationHash !== setup.authorizationHash ||
      action.ask.setup.voucherUnits !== a.voucherUnits ||
      action.ask.setup.acceptBy !== Number(a.acceptanceDeadline) ||
      a.claimHash !== snapshot.consent.claimHash ||
      a.termsHash !== snapshot.offer.termsHash ||
      a.termsRevision !== snapshot.offer.revision ||
      snapshot.sourceTimestamp === null ||
      snapshot.sourceTimestamp > a.acceptanceDeadline ||
      d.result.issuerApproved ||
      d.result.decision !== "none" ||
      d.holderAbortRequested
    )
      throw new Error("Booking consent, deadline or approval changed");
    functionName = "approveSetupAuthorization";
    calls = [[setup.setupId, setup.authorizationHash]];
  } else if (action.kind === "return") {
    if (
      !d.result.issuerApproved ||
      d.result.decision !== "activate" ||
      d.finalAllocation ||
      d.issuerReturnCeiling === null ||
      action.ceiling <= d.issuerReturnCeiling ||
      action.ceiling > a.voucherUnits
    )
      throw new Error("Return ceiling is invalid or the allocation is already frozen");
    serviceUint(action.ceiling);
    functionName = "authorizeReturn";
    calls = [[setup.setupId, setup.authorizationHash, action.ceiling]];
  } else {
    const final = d.finalAllocation;
    if (!final) throw new Error("No pending or failed frozen transfer to execute");
    calls = [final.release, final.refund].flatMap((leg, index) =>
      needsExecution(leg) ? [[setup.setupId, final.decisionId, index]] : []
    );
    if (!calls.length) throw new Error("No pending or failed frozen transfer to execute");
    functionName = "executeFinalLeg";
  }
  return {
    version: "1.0",
    chainId: "100",
    createdAt: Date.now(),
    meta: {
      name: `Voucher ${action.kind}`,
      createdFromSafeAddress: issuer.safe,
      description: `Review current state in Safe before execution. Holder ${a.holder}; token ${a.token}; voucher units ${a.voucherUnits}; service units ${a.serviceUnits}; terms revision ${a.termsRevision}; source acceptance deadline ${a.acceptanceDeadline}. Setup ${setup.setupId}; authorization ${setup.authorizationHash}; service terms ${a.serviceTermsRef}; remedy terms ${a.remedyTermsRef}.${action.kind === "return" ? ` Authorized return ceiling: ${action.ceiling} voucher units.` : ""} No transaction has been submitted.`,
    },
    transactions: calls.map((args) => ({
      to: ctx.route.destination.address,
      value: "0",
      data: encodeFunctionData({ abi: EscrowABI as Abi, functionName, args }),
    })),
  };
}
