import { maxUint256 } from "viem";
import { createPublicClientForChain } from "../../config/pimlico";
import { CELO_G_DOLLAR_TOKEN } from "../../config/tokens";
import type { Address } from "../../types/domain";
import { GOOD_DOLLAR_ABI } from "../../utils/blockchain/abis/goodDollar";

export interface GoodDollarFeeQuote {
  amount: bigint;
  fee: bigint;
  senderPays: boolean;
  totalDebit: bigint;
  recipientAmount: bigint;
}

/** Fees depend on the amount and both participants; never infer them from gas sponsorship. */
export async function quoteGoodDollarTransfer(
  amount: bigint,
  sender: Address,
  recipient: Address
): Promise<GoodDollarFeeQuote> {
  const result: unknown = await createPublicClientForChain(42220).readContract({
    address: CELO_G_DOLLAR_TOKEN.address,
    abi: GOOD_DOLLAR_ABI,
    functionName: "getFees",
    args: [amount, sender, recipient],
  });
  if (
    amount <= 0n ||
    amount > maxUint256 ||
    !Array.isArray(result) ||
    result.length !== 2 ||
    typeof result[0] !== "bigint" ||
    typeof result[1] !== "boolean" ||
    result[0] < 0n ||
    result[0] > maxUint256
  )
    throw new Error("Invalid G$ token fee quote");
  const [fee, senderPays] = result as [bigint, boolean];
  const totalDebit = senderPays ? amount + fee : amount;
  const recipientAmount = senderPays ? amount : amount - fee;
  if (totalDebit > maxUint256 || recipientAmount < 0n)
    throw new Error("Invalid G$ token fee quote");
  return { amount, fee, senderPays, totalDebit, recipientAmount };
}
