import { usePrivy } from "@privy-io/react-auth";
import { Navigate, useLocation } from "react-router-dom";
import { useUser } from "@/providers/user";

export default function Login() {
  const { login, authenticated } = usePrivy();
  const location = useLocation();
  const { address } = useUser();
  const redirectTo = new URLSearchParams(location.search).get("redirectTo") || "/dashboard";

  // Only redirect once authenticated AND address is available
  if (authenticated && address) {
    return <Navigate to={redirectTo} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Green Goods Admin</h2>
          <p className="mt-2 text-sm text-gray-600">
            Administrative dashboard for platform management
          </p>
        </div>
        
        <div className="mt-8">
          <button
            onClick={login}
            disabled={authenticated && !address}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {authenticated && !address ? "Connecting..." : "Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}