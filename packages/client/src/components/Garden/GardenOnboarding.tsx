import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { type Hex } from "viem";
import { useAuth } from "@/hooks/auth/useAuth";
import { useGardenJoin } from "@/hooks/garden/useGardenJoin";

interface GardenOnboardingProps {
  className?: string;
}

export function GardenOnboarding({ className }: GardenOnboardingProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { credential, createPasskey, isCreating, smartAccountAddress } = useAuth();
  const { joinWithInvite, isJoining, validateInvite } = useGardenJoin();

  const [step, setStep] = useState<"init" | "creating" | "joining" | "success" | "error">("init");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gardenName, _setGardenName] = useState<string>("this garden");
  const [transactionHash, setTransactionHash] = useState<Hex | null>(null);

  // Extract invite code and garden address from URL
  const inviteCode = searchParams.get("invite") as Hex | null;
  const gardenAddress = searchParams.get("garden") as Hex | null;

  useEffect(() => {
    // Validate invite code on mount
    if (inviteCode && gardenAddress) {
      validateInvite(gardenAddress, inviteCode).then((validation) => {
        if (!validation.isValid) {
          setStep("error");
          setErrorMessage(validation.error || "Invalid invite");
        }
      });
    } else {
      setStep("error");
      setErrorMessage("Missing invite code or garden address");
    }
  }, [inviteCode, gardenAddress]);

  const handleCreatePasskeyAndJoin = async () => {
    if (!inviteCode || !gardenAddress) {
      setErrorMessage("Missing invite information");
      setStep("error");
      return;
    }

    try {
      // Step 1: Create passkey if not already created
      if (!credential) {
        setStep("creating");
        await createPasskey();
      }

      // Step 2: Join garden with invite
      setStep("joining");
      const result = await joinWithInvite(gardenAddress, inviteCode);

      if (result.success) {
        setTransactionHash(result.transactionHash || null);
        setStep("success");

        // Redirect to garden page after a delay
        setTimeout(() => {
          navigate(`/gardens/${gardenAddress}`);
        }, 3000);
      } else {
        setErrorMessage(result.error || "Failed to join garden");
        setStep("error");
      }
    } catch (err) {
      console.error("[Onboarding] Error:", err);
      setErrorMessage(err instanceof Error ? err.message : "An error occurred");
      setStep("error");
    }
  };

  const handleJoinOnly = async () => {
    if (!inviteCode || !gardenAddress) {
      setErrorMessage("Missing invite information");
      setStep("error");
      return;
    }

    setStep("joining");
    const result = await joinWithInvite(gardenAddress, inviteCode);

    if (result.success) {
      setTransactionHash(result.transactionHash || null);
      setStep("success");

      setTimeout(() => {
        navigate(`/gardens/${gardenAddress}`);
      }, 3000);
    } else {
      setErrorMessage(result.error || "Failed to join garden");
      setStep("error");
    }
  };

  if (step === "init") {
    return (
      <div className={`max-w-md mx-auto p-6 ${className || ""}`}>
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Join {gardenName}</h2>

          <p className="text-gray-600 mb-6">
            You've been invited to join a regenerative garden community.
            {!credential
              ? " Create a secure passkey wallet to get started."
              : " Your passkey wallet is ready. Join the garden now!"}
          </p>

          {!credential ? (
            <button
              onClick={handleCreatePasskeyAndJoin}
              disabled={isCreating || isJoining}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isCreating ? "Creating Wallet..." : "Create Wallet & Join"}
            </button>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-green-800">
                  <strong>Wallet Address:</strong>
                  <br />
                  <code className="text-xs">{smartAccountAddress}</code>
                </p>
              </div>

              <button
                onClick={handleJoinOnly}
                disabled={isJoining}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
              >
                {isJoining ? "Joining..." : "Join Garden"}
              </button>
            </div>
          )}

          <p className="text-xs text-gray-500 mt-4">
            ✨ This transaction is sponsored - no gas fees required!
          </p>
        </div>
      </div>
    );
  }

  if (step === "creating") {
    return (
      <div className={`max-w-md mx-auto p-6 ${className || ""}`}>
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Creating Your Passkey Wallet</h2>
          <p className="text-gray-600">
            Please follow your browser's prompts to create a secure passkey...
          </p>
        </div>
      </div>
    );
  }

  if (step === "joining") {
    return (
      <div className={`max-w-md mx-auto p-6 ${className || ""}`}>
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Joining Garden</h2>
          <p className="text-gray-600">Processing your sponsored transaction...</p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className={`max-w-md mx-auto p-6 ${className || ""}`}>
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to the Garden! 🌱</h2>

          <p className="text-gray-600 mb-4">You've successfully joined {gardenName}</p>

          {transactionHash && (
            <p className="text-xs text-gray-500 mb-4">
              Transaction: <code className="text-xs break-all">{transactionHash}</code>
            </p>
          )}

          <p className="text-sm text-gray-500">Redirecting you to the garden...</p>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className={`max-w-md mx-auto p-6 ${className || ""}`}>
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Join Garden</h2>

          <p className="text-gray-600 mb-6">{errorMessage || "An unexpected error occurred"}</p>

          <button
            onClick={() => navigate("/")}
            className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return null;
}
