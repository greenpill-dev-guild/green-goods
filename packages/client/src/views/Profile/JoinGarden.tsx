import { useState } from "react";
import { useWriteContract } from "wagmi";
import { keccak256, toHex, encodeFunctionData } from "viem";
import { useUser } from "@/hooks/auth/useUser";
import GardenAccountABI from "@/utils/blockchain/abis/GardenAccount.json";

interface JoinGardenFormProps {
  gardenAddress: `0x${string}`;
}

export function JoinGardenForm({ gardenAddress }: JoinGardenFormProps) {
  const [inviteCode, setInviteCode] = useState("");
  const { smartAccountClient } = useUser();
  const { writeContractAsync, isPending } = useWriteContract();

  async function handleJoin() {
    if (!inviteCode) return;

    const inviteCodeBytes32 = keccak256(toHex(inviteCode));

    try {
      if (smartAccountClient?.account) {
        // Use smart account for passkey authentication
        await (smartAccountClient.sendTransaction as any)({
          to: gardenAddress,
          value: 0n,
          data: encodeFunctionData({
            abi: GardenAccountABI,
            functionName: "joinGardenWithInvite",
            args: [inviteCodeBytes32],
          }),
        });

        console.log("Successfully joined garden with passkey");
      } else {
        // Use wagmi for wallet authentication
        await writeContractAsync({
          address: gardenAddress,
          abi: GardenAccountABI,
          functionName: "joinGardenWithInvite",
          args: [inviteCodeBytes32],
        });

        console.log("Successfully joined garden with wallet");
      }

      alert("Successfully joined garden!");
      setInviteCode("");
    } catch (error) {
      console.error("Failed to join garden:", error);
      alert("Failed to join. Check your invite code.");
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Join with Invite Code</h3>

      <input
        type="text"
        value={inviteCode}
        onChange={(e) => setInviteCode(e.target.value)}
        placeholder="Enter invite code"
        className="w-full px-3 py-2 border rounded-md"
      />

      <button
        onClick={handleJoin}
        disabled={!inviteCode || isPending}
        className="w-full px-4 py-2 bg-green-600 text-white rounded-md disabled:opacity-50"
      >
        {isPending ? "Joining..." : "Join Garden"}
      </button>
    </div>
  );
}
