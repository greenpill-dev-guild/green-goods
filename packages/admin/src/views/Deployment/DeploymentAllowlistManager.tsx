import {
  type Address,
  DEPLOYMENT_REGISTRY_ABI,
  formatAddress,
  getNetworkContracts,
  logger,
  parseContractError,
  queryInvalidation,
  toastService,
  USER_FRIENDLY_ERRORS,
  useDeploymentAllowlist,
  useEnsAddress,
} from "@green-goods/shared";
import { RiClipboardLine, RiDeleteBinLine, RiUserAddLine } from "@remixicon/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { isAddress } from "viem";
import { useConfig, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface DeploymentAllowlistManagerProps {
  chainId: number;
}

export function DeploymentAllowlistManager({ chainId }: DeploymentAllowlistManagerProps) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const { writeContractAsync } = useWriteContract();
  const wagmiConfig = useConfig();
  const { allowlist, loading } = useDeploymentAllowlist(true);

  const [addressInput, setAddressInput] = useState("");
  const [error, setError] = useState("");
  const [addingAddress, setAddingAddress] = useState(false);
  const [removingAddress, setRemovingAddress] = useState<string | null>(null);

  const contracts = getNetworkContracts(chainId);
  const registryAddress = contracts.deploymentRegistry as `0x${string}`;

  const trimmed = addressInput.trim();
  const isHexAddress = useMemo(() => (trimmed ? isAddress(trimmed) : false), [trimmed]);
  const shouldResolveEns = trimmed.length > 2 && !isHexAddress;
  const { data: resolvedEnsAddress, isFetching: resolvingEns } = useEnsAddress(
    shouldResolveEns ? trimmed : null,
    { enabled: shouldResolveEns }
  );

  const invalidateQueries = () => {
    for (const key of queryInvalidation.invalidateAllowlist(chainId)) {
      queryClient.invalidateQueries({ queryKey: key });
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!trimmed) return;

    let addressToAdd: Address;
    if (isAddress(trimmed)) {
      addressToAdd = trimmed;
    } else if (resolvedEnsAddress && isAddress(resolvedEnsAddress)) {
      addressToAdd = resolvedEnsAddress;
    } else {
      setError(
        formatMessage({
          id: "app.admin.roles.error.ensResolutionFailed",
          defaultMessage: "Could not resolve ENS name",
        })
      );
      return;
    }

    setAddingAddress(true);
    try {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: DEPLOYMENT_REGISTRY_ABI,
        functionName: "addToAllowlist",
        args: [addressToAdd],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });

      toastService.success({
        title: formatMessage({ id: "app.deployment.allowlist.addSuccess" }),
      });
      setAddressInput("");
      invalidateQueries();
    } catch (err) {
      const parsed = parseContractError(err);
      const knownMessage =
        USER_FRIENDLY_ERRORS[parsed.name.toLowerCase()] ?? (parsed.isKnown ? parsed.message : null);
      const errorMsg = knownMessage ?? formatMessage({ id: "app.deployment.allowlist.addFailed" });
      setError(errorMsg);
      toastService.error({ title: errorMsg });
      logger.error("Failed to add to allowlist", { error: err, parsed });
    } finally {
      setAddingAddress(false);
    }
  };

  const handleRemove = async (address: Address) => {
    const confirmed = window.confirm(
      formatMessage(
        { id: "app.deployment.allowlist.confirmRemove" },
        { address: formatAddress(address) }
      )
    );
    if (!confirmed) return;

    setRemovingAddress(address);
    try {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: DEPLOYMENT_REGISTRY_ABI,
        functionName: "removeFromAllowlist",
        args: [address],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });

      toastService.success({
        title: formatMessage({ id: "app.deployment.allowlist.removeSuccess" }),
      });
      invalidateQueries();
    } catch (err) {
      const parsed = parseContractError(err);
      const knownMessage =
        USER_FRIENDLY_ERRORS[parsed.name.toLowerCase()] ?? (parsed.isKnown ? parsed.message : null);
      const errorMsg =
        knownMessage ?? formatMessage({ id: "app.deployment.allowlist.removeFailed" });
      toastService.error({ title: errorMsg });
      logger.error("Failed to remove from allowlist", { error: err, parsed });
    } finally {
      setRemovingAddress(null);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setAddressInput(text.trim());
        setError("");
      }
    } catch (err) {
      logger.error("Failed to read clipboard", { error: err });
    }
  };

  return (
    <Card padding="feature">
      <div className="flex items-center mb-4">
        <RiUserAddLine className="h-5 w-5 text-feature-dark mr-2" />
        <div>
          <h2 className="text-lg font-medium text-text-strong">
            {formatMessage({ id: "app.deployment.allowlist.title" })}
          </h2>
          <p className="text-sm text-text-soft">
            {formatMessage({ id: "app.deployment.allowlist.description" })}
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={addressInput}
            onChange={(e) => {
              setAddressInput(e.target.value);
              setError("");
            }}
            className="w-full px-3 py-2 pr-10 border border-stroke-sub bg-bg-white text-text-strong rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-base focus:border-primary-base"
            placeholder={formatMessage({ id: "app.deployment.allowlist.placeholder" })}
            disabled={addingAddress}
            aria-label={formatMessage({ id: "app.deployment.allowlist.placeholder" })}
          />
          <button
            type="button"
            onClick={handlePaste}
            disabled={addingAddress}
            className="absolute right-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 flex items-center justify-center text-text-soft hover:text-text-sub disabled:opacity-50"
            title={formatMessage({
              id: "admin.addMember.paste",
              defaultMessage: "Paste from clipboard",
            })}
          >
            <RiClipboardLine className="h-4 w-4" />
          </button>
        </div>
        <Button
          type="submit"
          disabled={addingAddress || !trimmed || (shouldResolveEns && resolvingEns)}
          loading={addingAddress}
        >
          {addingAddress
            ? formatMessage({ id: "app.deployment.allowlist.adding" })
            : formatMessage({ id: "app.deployment.allowlist.add" })}
        </Button>
      </form>

      {shouldResolveEns && (
        <p className="mb-2 text-xs text-text-soft">
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

      {error && (
        <p role="alert" className="mb-3 text-sm text-error-dark">
          {error}
        </p>
      )}

      {loading ? (
        <div className="py-6 text-center text-text-soft text-sm">Loading...</div>
      ) : allowlist.length === 0 ? (
        <div className="py-6 text-center text-text-soft text-sm">
          {formatMessage({ id: "app.deployment.allowlist.empty" })}
        </div>
      ) : (
        <div className="space-y-2">
          {allowlist.map((addr) => (
            <div key={addr} className="flex items-center justify-between p-3 bg-bg-weak rounded-lg">
              <code className="text-sm text-text-strong font-mono">{formatAddress(addr)}</code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemove(addr)}
                disabled={removingAddress === addr}
                loading={removingAddress === addr}
              >
                {removingAddress === addr ? (
                  formatMessage({ id: "app.deployment.allowlist.removing" })
                ) : (
                  <>
                    <RiDeleteBinLine className="h-4 w-4 mr-1" />
                    {formatMessage({ id: "app.deployment.allowlist.remove" })}
                  </>
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
