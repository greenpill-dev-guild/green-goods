import type { TransactionSender } from "../transactions/types";
import { classifySendFailure } from "../work/send-outcome";
import type { Address } from "../../types/domain";
import { GardenAccountABI } from "../../utils/blockchain/contracts";

/** A single owner-approved join. An ambiguous send is never described as safe to retry. */
export type GardenJoinResult =
  | { kind: "sent" }
  | { kind: "not_sent"; cancelled: boolean }
  | { kind: "unknown" };

export async function sendGardenJoin(
  sender: TransactionSender,
  input: { garden: Address; account: Address; chainId: number }
): Promise<GardenJoinResult> {
  let intentRecorded = false;
  let broadcastKnown = false;
  try {
    await sender.sendContractCall(
      {
        address: input.garden,
        account: input.account,
        abi: GardenAccountABI,
        functionName: "joinGarden",
        args: [],
        chainId: input.chainId,
        value: 0n,
      },
      {
        assertOwnership: () => sender.assertOwnership?.(input.account, input.chainId),
        onBeforeBroadcast: async (reference) => {
          intentRecorded = true;
          broadcastKnown = reference !== undefined;
        },
        onBroadcastReference: async () => {
          broadcastKnown = true;
        },
      }
    );
    return { kind: "sent" };
  } catch (error) {
    const failure = classifySendFailure(error, { intentRecorded, broadcastKnown });
    return failure.kind === "not-sent"
      ? { kind: "not_sent", cancelled: failure.cancelled }
      : { kind: "unknown" };
  }
}
