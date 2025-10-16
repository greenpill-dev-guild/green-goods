import { Navigate, useLocation } from "react-router-dom";
import { useAccount } from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";

export default function Login() {
  const location = useLocation();
  const { address, isConnected } = useAccount();
  const redirectTo = new URLSearchParams(location.search).get("redirectTo") || "/dashboard";

  console.log("isConnected", isConnected);
  console.log("address", address);
  console.log("redirectTo", redirectTo);

  // Redirect once connected and have address
  if (isConnected && address) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="h-8 w-8 text-green-600 dark:text-green-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Green Goods</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Garden management dashboard for the Green Goods protocol
            </p>
          </div>

          <div className="mt-8">
            {/* Custom styled connect button */}
            <ConnectButton className="w-full" size="lg" />

            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
              Connect your wallet to access garden management features
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
