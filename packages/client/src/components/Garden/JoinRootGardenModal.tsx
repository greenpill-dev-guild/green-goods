import { useAutoJoinRootGarden } from "@/hooks/garden/useAutoJoinRootGarden";

export function JoinRootGardenModal() {
  const { showPrompt, isPending, joinGarden, dismissPrompt } = useAutoJoinRootGarden();

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md mx-4 p-6">
        <h2 className="text-2xl font-semibold mb-4">Welcome to Green Goods! 🌱</h2>

        <p className="text-gray-700 mb-6">
          Join the community garden to get started. You&apos;ll be able to participate in
          activities, submit work, and earn rewards.
        </p>

        <div className="flex gap-3">
          <button
            onClick={joinGarden}
            disabled={isPending}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Joining..." : "Join Community Garden"}
          </button>

          <button
            onClick={dismissPrompt}
            disabled={isPending}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
