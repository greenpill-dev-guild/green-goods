import {
  type Address,
  ConfirmDialog,
  useConvictionStrategies,
  useSetConvictionStrategies,
  useGardenPermissions,
  useGardens,
} from "@green-goods/shared";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useParams } from "react-router-dom";
import { isAddress } from "viem";
import { PageHeader } from "@/components/Layout/PageHeader";
import { AddressDisplay } from "@/components/AddressDisplay";
import { RiDeleteBinLine } from "@remixicon/react";

export default function GardenStrategiesView() {
  const { id } = useParams<{ id: string }>();
  const { formatMessage } = useIntl();
  const [newAddress, setNewAddress] = useState("");
  const [addressError, setAddressError] = useState("");
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((item) => item.id === id);
  const permissions = useGardenPermissions();

  const {
    strategies,
    isLoading: strategiesLoading,
    isError: strategiesError,
  } = useConvictionStrategies((id as Address) ?? undefined, { enabled: Boolean(id) });

  const { mutate: setStrategies, isPending: isSaving } = useSetConvictionStrategies();

  if (gardensLoading) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.conviction.title" })}
          description={formatMessage({ id: "app.conviction.loadingStrategies" })}
          backLink={{
            to: "/gardens",
            label: formatMessage({ id: "app.conviction.backToGarden" }),
          }}
        />
      </div>
    );
  }

  if (!garden) {
    return (
      <div className="pb-6">
        <PageHeader
          title={formatMessage({ id: "app.conviction.title" })}
          description={formatMessage({ id: "app.conviction.gardenNotFound" })}
          backLink={{
            to: "/gardens",
            label: formatMessage({ id: "app.conviction.backToGarden" }),
          }}
        />
      </div>
    );
  }

  const canManage = permissions.canManageGarden(garden);

  const handleAddStrategy = () => {
    const trimmed = newAddress.trim();
    if (!isAddress(trimmed)) {
      setAddressError(formatMessage({ id: "app.conviction.errorInvalidAddress" }));
      return;
    }
    if (strategies.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setAddressError(formatMessage({ id: "app.conviction.errorAddressAlreadyAdded" }));
      return;
    }

    setAddressError("");
    const updated = [...strategies, trimmed as Address];
    setStrategies(
      { gardenAddress: id as Address, strategies: updated },
      { onSuccess: () => setNewAddress("") }
    );
  };

  const handleRemoveStrategy = (index: number, onSettled?: () => void) => {
    const updated = strategies.filter((_, i) => i !== index);
    setStrategies({ gardenAddress: id as Address, strategies: updated }, { onSettled });
  };

  return (
    <div className="pb-6">
      <PageHeader
        title={formatMessage({ id: "app.conviction.title" })}
        description={formatMessage(
          { id: "app.conviction.description" },
          { gardenName: garden.name }
        )}
        backLink={{
          to: `/gardens/${garden.id}`,
          label: formatMessage({ id: "app.conviction.backToGarden" }),
        }}
        sticky
      />

      <div className="mx-auto mt-6 max-w-4xl space-y-6 px-4 sm:px-6">
        {/* Stats */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-stroke-soft bg-bg-white p-4 shadow-sm">
            <p className="text-xs text-text-soft">
              {formatMessage({ id: "app.conviction.strategies" })}
            </p>
            <p className="mt-1 text-xl font-semibold text-text-strong">{strategies.length}</p>
          </div>
        </section>

        {strategiesError && (
          <div className="rounded-md border border-error-light bg-error-lighter px-4 py-3 text-sm text-error-dark">
            {formatMessage({ id: "app.conviction.errorLoadingFailed" })}
          </div>
        )}

        {/* Info banner — only show when no strategies configured */}
        {strategies.length === 0 && !strategiesLoading && (
          <div className="rounded-md border border-information-light bg-information-lighter px-4 py-3 text-sm text-information-dark">
            {formatMessage({ id: "app.conviction.notDeployed" })}
          </div>
        )}

        {/* Strategy list */}
        <section className="rounded-lg border border-stroke-soft bg-bg-white shadow-sm">
          <div className="border-b border-stroke-soft p-4 sm:p-6">
            <h3 className="text-base font-medium text-text-strong sm:text-lg">
              {formatMessage({ id: "app.conviction.strategies" })}
            </h3>
            <p className="mt-1 text-sm text-text-sub">
              {formatMessage({ id: "app.conviction.strategiesDescription" })}
            </p>
          </div>

          <div className="p-4 sm:p-6">
            {strategiesLoading ? (
              <p className="py-4 text-center text-sm text-text-soft">
                {formatMessage({ id: "app.conviction.loadingStrategies" })}
              </p>
            ) : strategies.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-soft">
                {formatMessage({ id: "app.conviction.noStrategies" })}
              </p>
            ) : (
              <div className="space-y-2">
                {strategies.map((strategy, index) => (
                  <div
                    key={strategy}
                    className="flex items-center justify-between gap-2 rounded-md bg-bg-weak p-3"
                  >
                    <AddressDisplay address={strategy} className="min-w-0 flex-1" />
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => setConfirmRemoveIndex(index)}
                        disabled={isSaving}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded text-error-base transition hover:bg-error-lighter active:scale-95 disabled:opacity-50"
                        aria-label={formatMessage({ id: "app.conviction.removeStrategy" })}
                      >
                        <RiDeleteBinLine className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add strategy form */}
            {canManage && (
              <div className="mt-4 flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => {
                      setNewAddress(e.target.value);
                      setAddressError("");
                    }}
                    placeholder={formatMessage({ id: "app.conviction.strategyAddressPlaceholder" })}
                    className="w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2 font-mono text-sm text-text-strong placeholder:text-text-soft focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-base/20"
                    aria-label={formatMessage({ id: "app.conviction.strategyAddress" })}
                  />
                  {addressError && <p className="mt-1 text-xs text-error-base">{addressError}</p>}
                </div>
                <button
                  type="button"
                  onClick={handleAddStrategy}
                  disabled={isSaving || !newAddress.trim()}
                  className="rounded-md bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker active:scale-95 disabled:opacity-50"
                >
                  {formatMessage({ id: "app.conviction.addStrategy" })}
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        isOpen={confirmRemoveIndex !== null}
        onClose={() => setConfirmRemoveIndex(null)}
        title={formatMessage({ id: "app.conviction.confirmRemoveStrategy" })}
        description={formatMessage({ id: "app.conviction.confirmRemoveStrategyDescription" })}
        variant="danger"
        onConfirm={() => {
          if (confirmRemoveIndex !== null) {
            handleRemoveStrategy(confirmRemoveIndex, () => setConfirmRemoveIndex(null));
          }
        }}
      />
    </div>
  );
}
