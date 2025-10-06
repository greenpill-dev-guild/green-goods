import { RiFingerprint2Line, RiWallet3Line } from "@remixicon/react";
import { getConnectors } from "@wagmi/core";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { wagmiConfig } from "@/config/wagmi";
import { useAuth } from "@/hooks/auth/useAuth";

type LoginMode = "passkey" | "wallet";

export function Login() {
  const navigate = useNavigate();
  const {
    credential,
    walletAddress,
    createPasskey,
    connectWallet,
    isCreating,
    smartAccountAddress,
    error,
  } = useAuth();
  const [loginMode, setLoginMode] = useState<LoginMode>("passkey");

  // Redirect if already logged in
  if ((credential && smartAccountAddress) || walletAddress) {
    return <Navigate to="/home" replace />;
  }

  const handleCreatePasskey = async () => {
    try {
      await createPasskey();
      // Will auto-redirect via the Navigate above on next render
    } catch (err) {
      // Error is already set in context
      console.error("[Login] Failed to create passkey:", err);
    }
  };

  const handleConnectWallet = async (connectorId: string) => {
    try {
      const connectors = getConnectors(wagmiConfig);
      const connector = connectors.find((c) => c.id === connectorId);
      if (connector) {
        await connectWallet(connector);
      }
    } catch (err) {
      console.error("[Login] Failed to connect wallet:", err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Green Goods</h1>
          <p className="text-xl text-gray-600">Start Bringing Biodiversity Onchain</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Welcome! 🌱</h2>

          <p className="text-gray-600 mb-6">
            Join regenerative garden communities and document your biodiversity work.
          </p>

          {/* Mode Tabs */}
          <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setLoginMode("passkey")}
              className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                loginMode === "passkey"
                  ? "bg-white text-green-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <RiFingerprint2Line className="inline-block mr-1 h-4 w-4" />
              Passkey
            </button>
            <button
              onClick={() => setLoginMode("wallet")}
              className={`flex-1 py-2 px-4 rounded-md font-medium text-sm transition-colors ${
                loginMode === "wallet"
                  ? "bg-white text-green-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <RiWallet3Line className="inline-block mr-1 h-4 w-4" />
              Wallet
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> {error.message}
              </p>
            </div>
          )}

          {/* Passkey Login */}
          {loginMode === "passkey" && (
            <>
              <button
                onClick={handleCreatePasskey}
                disabled={isCreating}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-lg mb-4"
              >
                {isCreating ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Creating Wallet...
                  </span>
                ) : (
                  "Create Passkey Wallet"
                )}
              </button>

              <div className="space-y-3 text-sm text-gray-500">
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mr-2 mt-0.5"
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
                  <span>Secure biometric authentication</span>
                </div>
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mr-2 mt-0.5"
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
                  <span>No passwords or seed phrases</span>
                </div>
                <div className="flex items-start">
                  <svg
                    className="w-5 h-5 text-green-500 mr-2 mt-0.5"
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
                  <span>Sponsored transactions - no gas fees</span>
                </div>
              </div>
            </>
          )}

          {/* Wallet Login */}
          {loginMode === "wallet" && (
            <>
              <div className="space-y-3">
                <button
                  onClick={() => handleConnectWallet("injected")}
                  disabled={isCreating}
                  className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-base flex items-center justify-center"
                >
                  <RiWallet3Line className="mr-2 h-5 w-5" />
                  {isCreating ? "Connecting..." : "MetaMask / Browser Wallet"}
                </button>

                <button
                  onClick={() => handleConnectWallet("walletConnect")}
                  disabled={isCreating}
                  className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-base flex items-center justify-center"
                >
                  <RiWallet3Line className="mr-2 h-5 w-5" />
                  {isCreating ? "Connecting..." : "WalletConnect"}
                </button>

                <button
                  onClick={() => handleConnectWallet("coinbaseWallet")}
                  disabled={isCreating}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium text-base flex items-center justify-center"
                >
                  <RiWallet3Line className="mr-2 h-5 w-5" />
                  {isCreating ? "Connecting..." : "Coinbase Wallet"}
                </button>
              </div>

              <div className="mt-6 space-y-2 text-sm text-gray-500">
                <p className="font-medium text-gray-700">For operators and admins:</p>
                <ul className="space-y-1 pl-4">
                  <li>• Connect your existing wallet</li>
                  <li>• Manage gardens and approvals</li>
                  <li>• Control your own keys</li>
                </ul>
              </div>
            </>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              {loginMode === "passkey"
                ? "Make sure passkeys are enabled on your device"
                : "Ensure your wallet is installed and ready to connect"}
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => navigate("/")}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}

export default Login;
