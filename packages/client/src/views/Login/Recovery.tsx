import { useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/UI/Button";
import { FormInput } from "@/components/UI/Form/Input";
import { APP_NAME } from "@/config/app";
import { useAuth } from "@/hooks/auth/useAuth";
import { recoverPasskeyAccount } from "@/modules/auth/passkey";

export function Recovery() {
  const navigate = useNavigate();
  const { setPasskeySession } = useAuth();
  const [ensName, setEnsName] = useState("");
  const [isRecovering, setIsRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRecover = async () => {
    setError(null);
    setIsRecovering(true);

    try {
      // Validate ENS name format
      if (!ensName || ensName.trim().length === 0) {
        throw new Error("Please enter your username");
      }

      const cleanUsername = ensName.trim().toLowerCase();

      // Call recovery function from passkey module
      toast.loading("Looking up your account...", { id: "recovery" });

      const session = await recoverPasskeyAccount(cleanUsername);

      toast.dismiss("recovery");
      toast.success("Account recovered successfully!");

      // Set the session in the auth provider
      setPasskeySession(session);

      // Navigate to home
      navigate("/home", { replace: true });
    } catch (err) {
      toast.dismiss("recovery");
      const message = err instanceof Error ? err.message : "Failed to recover account";
      setError(message);
      console.error("Account recovery failed", err);
    } finally {
      setIsRecovering(false);
    }
  };

  const handleBack = () => {
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white px-4 pb-12 pt-[12vh]">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <img src="/icon.png" alt={APP_NAME} width={180} />
        <div className="w-full space-y-2 text-center">
          <h3 className="text-xl font-bold text-[#367D42]">Recover Account</h3>
          <p className="text-sm text-gray-600">Enter your username to recover your account</p>
        </div>

        <div className="w-full space-y-4">
          <FormInput
            label="Username"
            placeholder="e.g., alice"
            value={ensName}
            onChange={(e) => setEnsName(e.target.value)}
            disabled={isRecovering}
            helperText="Your Green Goods username (without .greengoods.eth)"
            error={error || undefined}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isRecovering) {
                void handleRecover();
              }
            }}
          />

          <div className="space-y-3">
            <Button
              onClick={handleRecover}
              disabled={isRecovering || !ensName.trim()}
              className="w-full"
              shape="pilled"
              label={isRecovering ? "Recovering..." : "Recover Account"}
            />

            <button
              onClick={handleBack}
              disabled={isRecovering}
              className="w-full text-sm text-gray-600 underline transition-colors hover:text-green-600 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              Back to Login
            </button>
          </div>
        </div>

        <div className="mt-4 max-w-md space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-semibold">How Recovery Works:</p>
          <ol className="ml-4 list-decimal space-y-1 text-xs">
            <li>Your username looks up your account address on mainnet ENS</li>
            <li>You'll be prompted to verify with your passkey (biometric or security key)</li>
            <li>If the passkey matches, your account is recovered instantly</li>
          </ol>
          <p className="mt-2 text-xs">
            <strong>Note:</strong> Your passkey must be synced across devices (iCloud Keychain,
            Google Password Manager, etc.) for recovery to work.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Recovery;
