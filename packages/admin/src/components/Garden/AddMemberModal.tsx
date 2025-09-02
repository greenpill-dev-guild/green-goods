import { useState } from "react";
import { RiCloseLine } from "@remixicon/react";
import { cn } from "@/utils/cn";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberType: "gardener" | "operator";
  onAdd: (address: string) => Promise<void>;
  isLoading: boolean;
}

export function AddMemberModal({ isOpen, onClose, memberType, onAdd, isLoading }: AddMemberModalProps) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!address) {
      setError("Address is required");
      return;
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setError("Invalid Ethereum address");
      return;
    }

    try {
      await onAdd(address);
      setAddress("");
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to add member");
    }
  };

  const handleClose = () => {
    setAddress("");
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" 
          onClick={handleClose}
          onKeyDown={(e) => e.key === 'Escape' && handleClose()}
          role="button"
          tabIndex={0}
          aria-label="Close modal"
        />

        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              Add {memberType === "gardener" ? "Gardener" : "Operator"}
            </h3>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
            >
              <RiCloseLine className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="member-address" className="block text-sm font-medium text-gray-700 mb-2">
                Ethereum Address
              </label>
              <input
                id="member-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="0x..."
                disabled={isLoading}
              />
              {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !address}
                className={cn(
                  "px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500",
                  isLoading || !address
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                )}
              >
                {isLoading ? "Adding..." : `Add ${memberType === "gardener" ? "Gardener" : "Operator"}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}