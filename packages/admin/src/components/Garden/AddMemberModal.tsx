import {
  type Address,
  cn,
  formatAddress,
  type GardenRole,
  logger,
  parseContractError,
  resolveEnsAddress,
  USER_FRIENDLY_ERRORS,
  useEnsAddress,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiClipboardLine, RiCloseLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { isAddress } from "viem";
import { FormField } from "@/components/ui/FormField";

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  memberType: GardenRole;
  onAdd: (address: Address) => Promise<void>;
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
  const { formatMessage } = useIntl();
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  const trimmed = address.trim();
  const isHexAddress = useMemo(() => (trimmed ? isAddress(trimmed) : false), [trimmed]);
  const shouldResolveEns = trimmed.length > 2 && !isHexAddress;
  const { data: resolvedEnsAddress, isFetching: resolvingEns } = useEnsAddress(
    shouldResolveEns ? trimmed : null,
    { enabled: shouldResolveEns }
  );

  const roleLabelMap: Record<GardenRole, string> = {
    gardener: formatMessage({ id: "app.roles.gardener" }),
    operator: formatMessage({ id: "app.roles.operator" }),
    evaluator: formatMessage({ id: "app.roles.evaluator" }),
    owner: formatMessage({ id: "app.roles.owner" }),
    funder: formatMessage({ id: "app.roles.funder" }),
    community: formatMessage({ id: "app.roles.community" }),
  };
  const roleLabel = roleLabelMap[memberType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!trimmed) {
      setError(formatMessage({ id: "app.admin.roles.error.addressRequired" }));
      return;
    }

    try {
      let addressToAdd: Address;

      if (isAddress(trimmed)) {
        addressToAdd = trimmed;
      } else {
        const lookup = resolvedEnsAddress ?? (await resolveEnsAddress(trimmed));
        if (!lookup || !isAddress(lookup)) {
          setError(formatMessage({ id: "app.admin.roles.error.ensResolutionFailed" }));
          return;
        }
        addressToAdd = lookup;
      }

      await onAdd(addressToAdd);
      setAddress("");
      onClose();
    } catch (error) {
      const parsed = parseContractError(error);
      const normalizedName = parsed.name.toLowerCase();
      const knownMessage =
        USER_FRIENDLY_ERRORS[normalizedName] ??
        Object.entries(USER_FRIENDLY_ERRORS).find(([pattern]) => {
          const lowerMessage = parsed.message.toLowerCase();
          return normalizedName.includes(pattern) || lowerMessage.includes(pattern);
        })?.[1];

      const safeMessage = knownMessage ?? (parsed.isKnown ? parsed.message : null);
      setError(safeMessage ?? formatMessage({ id: "app.admin.roles.error.addFailed" }));
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
      logger.error("Failed to read clipboard", { error: err });
      setError(formatMessage({ id: "app.admin.roles.error.clipboardFailed" }));
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-60 bg-overlay backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-150" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-60 -translate-x-1/2 -translate-y-1/2 bg-bg-white rounded-lg shadow-2xl ring-1 ring-black/5 max-w-[calc(100vw-2rem)] sm:max-w-md w-full p-6 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 duration-200"
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
              {formatMessage({ id: "app.admin.roles.add" }, { role: roleLabel })}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="min-h-11 min-w-11 p-2 text-text-soft hover:text-text-sub rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-base/40"
                type="button"
                disabled={isLoading}
                aria-label={formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              label={formatMessage({ id: "app.admin.roles.addressLabel" })}
              htmlFor="member-address"
              error={error || undefined}
            >
              <div className="relative">
                <input
                  id="member-address"
                  type="text"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setError("");
                  }}
                  className="w-full px-3 py-2 pr-10 border border-stroke-sub bg-bg-white text-text-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-base focus:border-primary-base"
                  placeholder={formatMessage({
                    id: "admin.addMember.placeholder",
                    defaultMessage: "0x... or name.eth",
                  })}
                  disabled={isLoading}
                  aria-required="true"
                  aria-invalid={!!error}
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  disabled={isLoading}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 flex items-center justify-center text-text-soft hover:text-text-sub disabled:opacity-50"
                  title={formatMessage({
                    id: "admin.addMember.paste",
                    defaultMessage: "Paste from clipboard",
                  })}
                >
                  <RiClipboardLine className="h-4 w-4" />
                </button>
              </div>
              {shouldResolveEns && (
                <p className="mt-2 text-xs text-text-soft">
                  {resolvingEns
                    ? formatMessage({
                        id: "admin.addMember.resolvingEns",
                        defaultMessage: "Resolving ENS name...",
                      })
                    : resolvedEnsAddress
                      ? formatMessage(
                          {
                            id: "admin.addMember.ensResolved",
                            defaultMessage: "Resolves to {address}",
                          },
                          { address: formatAddress(resolvedEnsAddress) }
                        )
                      : formatMessage({
                          id: "admin.addMember.enterValidAddress",
                          defaultMessage: "Enter a valid ENS name or 0x address.",
                        })}
                </p>
              )}
            </FormField>

            {/* Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t border-stroke-soft">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={isLoading}
                  className="px-4 py-2 border border-stroke-sub text-sm font-medium rounded-lg text-text-sub bg-bg-white hover:bg-bg-weak focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-base disabled:opacity-50"
                >
                  {formatMessage({ id: "admin.common.cancel", defaultMessage: "Cancel" })}
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isLoading || !trimmed || (shouldResolveEns && resolvingEns)}
                className={cn(
                  "px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-primary-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-base disabled:text-text-soft disabled:opacity-50",
                  isLoading || !trimmed || (shouldResolveEns && resolvingEns)
                    ? "bg-bg-surface cursor-not-allowed"
                    : "bg-primary-base hover:bg-primary-darker"
                )}
              >
                {isLoading
                  ? formatMessage({ id: "admin.addMember.adding", defaultMessage: "Adding..." })
                  : formatMessage({ id: "app.admin.roles.add" }, { role: roleLabel })}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
