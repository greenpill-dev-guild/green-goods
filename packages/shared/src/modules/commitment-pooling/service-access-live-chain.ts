import EscrowABI from "@green-goods/contracts/abis/GnosisVoucherEscrow.json";
import SourceABI from "@green-goods/contracts/abis/VoucherRedemptionModule.json";
import { getPublicClient } from "@wagmi/core";
import { type Abi, erc20Abi } from "viem";
import { getWagmiConfig } from "../../config/appkit";
import type { Address } from "../../types/domain";
import {
  serviceFlag as flag,
  serviceHash as hash,
  serviceTuple as tuple,
  serviceUint as uint,
  SERVICE_ZERO_HASH as ZERO,
} from "./service-access-chain-values";
import type { ServiceLiveRoute } from "./service-access-live-config";
import type { ServiceLiveChain } from "./service-access-live-route";
import type { ServiceAccessSnapshot } from "./service-access-types";
import {
  mapVoucherFinalResult,
  mapVoucherSetupResult,
} from "./service-access-voucher-chain-mappers";

export { type ServiceLiveChain, verifyServiceLiveRoute } from "./service-access-live-route";

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function publicClient(chainId: number) {
  const client = getPublicClient(getWagmiConfig(), { chainId });
  if (!client || client.chain?.id !== chainId) throw new Error("Service chain reader unavailable");
  return client;
}
export const serviceLiveChain: ServiceLiveChain = {
  read: async (input) =>
    publicClient(input.chainId).readContract({ ...input, args: input.args ?? [] }),
  code: async (chain, account) => (await publicClient(chain).getCode({ address: account })) ?? "0x",
  storage: async (chain, account, slot) =>
    (await publicClient(chain).getStorageAt({ address: account, slot })) ?? "0x",
  receipt: (chain, transactionHash) =>
    publicClient(chain).getTransactionReceipt({ hash: transactionHash }),
  transaction: (chain, transactionHash) =>
    publicClient(chain).getTransaction({ hash: transactionHash }),
  balance: (chain, address) => publicClient(chain).getBalance({ address }),
};

/** Destination decisions, custody, allowance, fees and immutable allocation come from RPC, never the index. */
export async function hydrateLiveVoucherSnapshot(
  s: ServiceAccessSnapshot,
  route: ServiceLiveRoute,
  chain: ServiceLiveChain
) {
  const call = (
    chainId: number,
    account: Address,
    abi: Abi,
    functionName: string,
    args: readonly unknown[] = []
  ) => chain.read({ chainId, address: account, abi, functionName, args });
  s.pause.destinationVoucher = flag(
    await call(100, route.destination.address, EscrowABI as Abi, "paused")
  );
  for (const row of s.voucherSetups) {
    const a = row.authorization;
    const asset = route.assets.find((v) => same(v.token, a.token) && same(v.issuer, a.issuer));
    if (
      !asset ||
      !same(a.sourceModule, route.source.address) ||
      !same(a.destinationEscrow, route.destination.address) ||
      a.destinationChainId !== 100 ||
      // The live member adapter signs both chains as the source buyer. Distinct holders
      // require a separately reviewed actor/session path; rehearsal support does not enable it.
      !same(a.buyer, a.holder)
    )
      throw new Error("Voucher authorization is outside the reviewed pilot route");
    row.asset = {
      chainId: 100,
      token: asset.token,
      symbol: asset.symbol,
      decimals: asset.decimals,
    };
    const source = (fn: string, args: readonly unknown[]) =>
      call(42161, route.source.address, SourceABI as Abi, fn, args);
    const dest = (fn: string, args: readonly unknown[] = [row.setupId]) =>
      call(100, route.destination.address, EscrowABI as Abi, fn, args);
    row.fees.authorization = uint(await source("quoteSetupCommand", [row.setupId, 0]));
    row.fees.decision =
      row.source.decision === "none"
        ? null
        : uint(await source("quoteSetupCommand", [row.setupId, 1]));
    const execution = tuple(await dest("getSetupExecution"), [
      "authorization",
      "result",
      "pendingAction",
      "decision",
      "failureReason",
      "issuerReturnCeiling",
      "holderAbortRequested",
      "setupAcknowledgment",
      "finalAcknowledgment",
      "finalSequence",
      "finalAllocation",
    ]);
    const result = mapVoucherSetupResult(execution.result, row.setupId, row.authorizationHash, a);
    if (!result) {
      row.destination = null;
      continue;
    }
    const [allowance, balance] = await Promise.all([
      call(100, asset.token, erc20Abi, "allowance", [a.holder, a.destinationEscrow]),
      call(100, asset.token, erc20Abi, "balanceOf", [a.holder]),
    ]);
    const finalRaw = tuple(execution.finalAllocation, [
      "decisionId",
      "activationDecisionId",
      "issuerReturnApprovalAtFreeze",
      "allocation",
      "release",
      "refund",
    ]);
    const final =
      hash(finalRaw.decisionId) === ZERO
        ? null
        : mapVoucherFinalResult(
            await dest("getFinalResult"),
            row.setupId,
            row.authorizationHash,
            a
          );
    if (typeof execution.pendingAction !== "number" || ![0, 1, 2].includes(execution.pendingAction))
      throw new Error("Unknown voucher recovery action");
    row.destination = {
      evidence: "onchain",
      result,
      issuerReturnCeiling: uint(execution.issuerReturnCeiling),
      pendingAction: ([null, "deposit", "abort-refund"] as const)[execution.pendingAction]!,
      holderAbortRequested: flag(execution.holderAbortRequested),
      allowance: uint(allowance),
      holderBalance: uint(balance),
      finalAllocation: final,
    };
    for (const [name, sequence] of [
      ["setup", result.sequence],
      ["final", uint(execution.finalSequence, 64)],
    ] as const) {
      const ack = tuple(execution[`${name}Acknowledgment`], [
        "sequence",
        "messageId",
        "failureHash",
      ]);
      const sent = uint(ack.sequence, 64);
      row.acknowledgments[name] = {
        ...row.acknowledgments[name],
        destinationSequence: sequence,
        sentSequence: sent,
        pending: sent < sequence,
        sent: hash(ack.messageId) !== ZERO,
      };
    }
    row.fees.holderAbortRequest =
      result.decision === "none" ? uint(await dest("quoteSetupAbortRequest")) : null;
    row.fees.setupAcknowledgment = uint(await dest("quoteSetupAcknowledgment"));
    row.fees.finalAcknowledgment = final ? uint(await dest("quoteFinalAcknowledgment")) : null;
  }
}
