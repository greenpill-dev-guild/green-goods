import * as Dialog from "@radix-ui/react-dialog";
import { useEnsAddress } from "@green-goods/shared/hooks";
import { cn, formatAddress, resolveEnsAddress } from "@green-goods/shared/utils";
import { RiClipboardLine, RiCloseLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { isAddress } from "viem";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberType: "gardener" | "operator";
  onAdd: (address: string) => Promise<void>;
  isLoading: boolean;
}

/**
 * Modal for adding a new gardener or operator to a garden.
 * Uses Radix Dialog for accessibility, supports ENS name resolution.
 */
export function AddMemberModal({
  isOpen,
  onClose,
  memberType,
  onAdd,
  isLoading,
}: AddMemberModalProps) {
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  const trimmed = address.trim();
  const isHexAddress = useMemo(() => (trimmed ? isAddress(trimmed) : false), [trimmed]);
  const shouldResolveEns = trimmed.length > 2 && !isHexAddress;
  const { data: resolvedEnsAddress, isFetching: resolvingEns } = useEnsAddress(
    shouldResolveEns ? trimmed : null,
    { enabled: shouldResolveEns }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!trimmed) {
      setError("Address is required");
      return;
    }

    try {
      let addressToAdd = trimmed;

      if (!isAddress(addressToAdd)) {
        const lookup = resolvedEnsAddress ?? (await resolveEnsAddress(addressToAdd));
        if (!lookup || !isAddress(lookup)) {
          setError("Could not resolve ENS name");
          return;
        }
        addressToAdd = lookup;
      }

      await onAdd(addressToAdd);
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

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[10000] -translate-x-1/2 -translate-y-1/2 bg-bg-white rounded-lg shadow-2xl ring-1 ring-black/5 max-w-md w-full p-6 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200"
          onPointerDownOutside={(e) => {
            if (isLoading) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isLoading) e.preventDefault();
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Dialog.Title className="text-lg font-medium text-text-strong">
              Add {memberType === "gardener" ? "Gardener" : "Operator"}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="p-2 text-text-soft hover:text-text-sub rounded-md focus:outline-none focus:ring-2 focus:ring-primary-base/20"
                type="button"
                disabled={isLoading}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="member-address"
                className="block text-sm font-medium text-text-sub mb-2"
              >
                Ethereum Address or ENS Name
              </label>
              <div className="relative">
                <input
                  id="member-address"
                  type="text"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setError("");
                  }}
                  className="w-full px-3 py-2 pr-10 border border-stroke-sub bg-bg-white text-text-strong rounded-md focus:outline-none focus:ring-2 focus:ring-primary-base focus:border-primary-base"
                  placeholder="0x..."
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  disabled={isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-soft hover:text-text-sub disabled:opacity-50"
                  title="Paste from clipboard"
                >
                  <RiClipboardLine className="h-4 w-4" />
                </button>
              </div>
              {shouldResolveEns && (
                <p className="mt-2 text-xs text-text-soft">
                  {resolvingEns
                    ? "Resolving ENS name..."
                    : resolvedEnsAddress
                      ? `Resolves to ${formatAddress(resolvedEnsAddress)}`
                      : "Enter a valid ENS name or 0x address."}
                </p>
              )}
              {error && <p className="mt-1 text-sm text-error-dark">{error}</p>}
            </div>

            {/* Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-stroke-soft">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={isLoading}
                  className="px-4 py-2 border border-stroke-sub text-sm font-medium rounded-md text-text-sub bg-bg-white hover:bg-bg-weak focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-base disabled:opacity-50"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isLoading || !trimmed || (shouldResolveEns && resolvingEns)}
                className={cn(
                  "px-4 py-2 border border-transparent text-sm font-medium rounded-md text-primary-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-base",
                  isLoading || !trimmed || (shouldResolveEns && resolvingEns)
                    ? "bg-bg-surface cursor-not-allowed"
                    : "bg-primary-base hover:bg-primary-darker"
                )}
              >
                {isLoading
                  ? "Adding..."
                  : `Add ${memberType === "gardener" ? "Gardener" : "Operator"}`}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
