import { useState, useEffect } from "react";
import { RiCloseLine, RiClipboardLine } from "@remixicon/react";
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

  // 🐛 DEBUG: Log modal state changes
  useEffect(() => {
    console.log("🔴 AddMemberModal state:", { isOpen, memberType, isLoading });
  }, [isOpen, memberType, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    console.log("🔴 Modal submit:", { address, memberType });

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
      console.error("🔴 Modal add error:", error);
      setError(error instanceof Error ? error.message : "Failed to add member");
    }
  };

  const handleClose = () => {
    setAddress("");
    setError("");
    onClose();
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setAddress(text.trim());
        setError("");
      }
    } catch (err) {
      console.error("Failed to read clipboard:", err);
      setError("Failed to paste from clipboard");
    }
  };

  if (!isOpen) {
    console.log("🔴 Modal not open, returning null");
    return null;
  }

  console.log("🔴 Modal rendering...");

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-20" 
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            Add {memberType === "gardener" ? "Gardener" : "Operator"}
          </h3>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
            type="button"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="member-address" className="block text-sm font-medium text-gray-700 mb-2">
              Ethereum Address
            </label>
            <div className="relative">
              <input
                id="member-address"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="0x..."
                disabled={isLoading}
                autoFocus
              />
              <button
                type="button"
                onClick={handlePaste}
                disabled={isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                title="Paste from clipboard"
              >
                <RiClipboardLine className="h-4 w-4" />
              </button>
            </div>
            {error && (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
          </div>

          {/* Buttons */}
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
  );
}