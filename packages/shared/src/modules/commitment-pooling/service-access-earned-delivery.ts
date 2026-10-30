import EntitlementABI from "@green-goods/contracts/abis/VoucherEntitlementModule.json";
import { type Abi, erc20Abi } from "viem";
import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import { AdapterABI } from "./service-issuer-abis";
import type { ServiceChainRead } from "./service-access-chain";
import {
  serviceEnum,
  serviceFlag,
  serviceHash,
  serviceTuple,
  serviceUint,
  SERVICE_ZERO_HASH,
} from "./service-access-chain-values";
import type { ServiceAccessSnapshot } from "./service-access-types";
import type { RequestRewardDelivery } from "./service-access-wallet-types";

/** Called only after the live adapter verifies the reward module, destination and asset route. */
export async function readEarnedRewardDelivery(
  snapshot: ServiceAccessSnapshot,
  adapter: Address,
  read: ServiceChainRead
): Promise<RequestRewardDelivery | undefined> {
  const earned = snapshot.acceptancePolicy.earned;
  const terms = earned.terms;
  if (!earned.module || !earned.termsHash || !terms || snapshot.coreState !== "FULFILLED")
    return undefined;
  const reward: RequestRewardDelivery = {
    id: earned.termsHash,
    kind: "voucher",
    asset: terms.asset,
    amount: terms.totalUnits,
    funder: terms.issuer,
    status: "preparing",
    shortOf: null,
    receipt: null,
    attempts: 0n,
    messageId: null,
  };
  const source = (functionName: string, args: readonly unknown[]) =>
    read({
      chainId: snapshot.key.sourceChainId,
      address: earned.module!,
      abi: EntitlementABI as Abi,
      functionName,
      args,
    });
  try {
    const id = serviceHash(await source("distributionOfCommitment", [snapshot.key.commitmentId]));
    if (id === SERVICE_ZERO_HASH) return reward;
    reward.id = id;
    const distribution = serviceTuple(await source("getDistribution", [id]), [
      "commitmentId",
      "payloadHash",
      "state",
      "resultSequence",
      "resultHash",
      "failureHash",
      "lastMessageId",
    ]);
    const state = serviceEnum(distribution.state, [
      "none",
      "prepared",
      "pending",
      "failed",
      "delivered",
    ]);
    const payload = serviceHash(distribution.payloadHash);
    const message = serviceHash(distribution.lastMessageId);
    const sequence = serviceUint(distribution.resultSequence, 64);
    if (
      serviceUint(distribution.commitmentId) !== snapshot.key.commitmentId ||
      payload === SERVICE_ZERO_HASH ||
      state === "none"
    )
      throw new Error("Reward distribution identity mismatch");
    reward.messageId = message === SERVICE_ZERO_HASH ? null : message;
    reward.attempts = sequence;
    if (state === "prepared") return reward;
    if (!reward.messageId) throw new Error("Reward dispatch has no message");
    reward.status =
      state === "delivered" ? "received" : state === "failed" ? "delayed" : "on-the-way";
    // An authenticated source acknowledgment already proves delivery, even if the destination RPC is down.
    if (state === "delivered") {
      if (sequence === 0n || serviceHash(distribution.failureHash) !== SERVICE_ZERO_HASH)
        throw new Error("Invalid delivered reward result");
      return reward;
    }
    const result = serviceTuple(
      await read({
        chainId: terms.asset.chainId,
        address: adapter,
        abi: AdapterABI,
        functionName: "getExecutionResult",
        args: [id],
      }),
      [
        "payloadHash",
        "sequence",
        "success",
        "acknowledgmentSequence",
        "failureHash",
        "acknowledgmentMessageId",
        "acknowledgmentFailureHash",
      ]
    );
    const destinationSequence = serviceUint(result.sequence, 64);
    if (destinationSequence === 0n) return reward;
    if (serviceHash(result.payloadHash) !== payload || destinationSequence < sequence)
      throw new Error("Reward destination result mismatch");
    reward.attempts = destinationSequence;
    if (serviceFlag(result.success)) {
      reward.status = "received";
      return reward;
    }
    reward.status = "delayed";
    const [reserve, allowance] = await Promise.all([
      read({
        chainId: terms.asset.chainId,
        address: terms.asset.token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [terms.issuer],
      }),
      read({
        chainId: terms.asset.chainId,
        address: terms.asset.token,
        abi: erc20Abi,
        functionName: "allowance",
        args: [terms.issuer, adapter],
      }),
    ]);
    reward.shortOf =
      serviceUint(reserve) < terms.totalUnits
        ? "reserve"
        : serviceUint(allowance) < terms.totalUnits
          ? "allowance"
          : null;
    if (reward.shortOf) reward.status = "waiting";
    return reward;
  } catch (error) {
    logger.warn("Earned voucher delivery status unavailable", {
      error,
      commitmentId: snapshot.key.commitmentId.toString(),
    });
    return { ...reward, status: "unavailable", shortOf: null };
  }
}
