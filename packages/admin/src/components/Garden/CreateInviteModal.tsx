import { useState } from "react";
import { RiCloseLine, RiClipboardLine } from "@remixicon/react";
import { cn } from "@/utils/cn";
import { useGardenInvites } from "@/hooks/useGardenInvites";

interface CreateInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: string;
}

export function CreateInviteModal({ isOpen, onClose, gardenAddress }: CreateInviteModalProps) {
  const { createInvite, isLoading } = useGardenInvites(gardenAddress);
  const [inviteLink, setInviteLink] = useState<string>("");
  const [expiryDays, setExpiryDays] = useState(7);
  const [step, setStep] = useState<"config" | "created">("config");
  const [copied, setCopied] = useState(false);

  const handleCreate = async () => {
    try {
      const link = await createInvite(expiryDays);
      setInviteLink(link);
      setStep("created");
    } catch (error) {
      console.error("Failed to create invite:", error);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleClose = () => {
    setStep("config");
    setInviteLink("");
    setExpiryDays(7);
    setCopied(false);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-20"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">
            {step === "config" ? "Create Garden Invite" : "Invite Created"}
          </h3>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
            type="button"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>

        {step === "config" ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="expiry" className="block text-sm font-medium text-gray-700 mb-2">
                Invite Expiration
              </label>
              <select
                id="expiry"
                value={expiryDays}
                onChange={(e) => setExpiryDays(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                disabled={isLoading}
              >
                <option value={1}>1 day</option>
                <option value={7}>1 week</option>
                <option value={30}>1 month</option>
                <option value={90}>3 months</option>
                <option value={365}>1 year</option>
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Invite codes are single-use and will expire after the
                selected duration. The transaction to join the garden will be sponsored (no gas fees
                for the user).
              </p>
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
                type="button"
                onClick={handleCreate}
                disabled={isLoading}
                className={cn(
                  "px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500",
                  isLoading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
                )}
              >
                {isLoading ? "Creating..." : "Create Invite"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800 mb-2">
                <strong>✓ Invite created successfully!</strong>
              </p>
              <p className="text-xs text-green-700">
                Share this link or QR code with people you want to invite to your garden.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Invite Link</label>
              <div className="relative">
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                  title="Copy to clipboard"
                >
                  <RiClipboardLine className="h-4 w-4" />
                </button>
              </div>
              {copied && <p className="text-xs text-green-600 mt-1">✓ Copied to clipboard!</p>}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
