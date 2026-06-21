import {
  type Address,
  AddressDisplay,
  Alert,
  adminRoutes,
  compareAddresses,
  useAdminGardenWorkspaceSelection,
  useConvictionStrategies,
  useGardenPermissions,
  useGardens,
  useSetConvictionStrategies,
} from "@green-goods/shared";
import { RiDeleteBinLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { isAddress } from "viem";
import { AdminButton } from "@/components/AdminButton";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { AdminTextField } from "@/components/AdminTextField";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";

interface GardenStrategiesViewProps {
  layout?: "page" | "sheet";
}

export default function GardenStrategiesView({ layout = "page" }: GardenStrategiesViewProps = {}) {
  const { formatMessage } = useIntl();
  const [newAddress, setNewAddress] = useState("");
  const [addressError, setAddressError] = useState("");
  const [confirmRemoveIndex, setConfirmRemoveIndex] = useState<number | null>(null);
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const gardenId = selectedGarden?.id ?? null;

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((item) => compareAddresses(item.id, gardenId));
  const gardenRouteContext = { gardenAddress: garden?.id ?? gardenId };
  const permissions = useGardenPermissions();

  const {
    strategies,
    isLoading: strategiesLoading,
    isError: strategiesError,
  } = useConvictionStrategies((gardenId as Address | null) ?? undefined, {
    enabled: Boolean(gardenId),
  });

  const { mutate: setStrategies, isPending: isSaving } = useSetConvictionStrategies();
  const communityBackLink = {
    to: adminRoutes.communityGovernance(gardenRouteContext),
    label: formatMessage({ id: "cockpit.nav.community", defaultMessage: "Community" }),
  };

  if (gardensLoading) {
    if (layout === "sheet") {
      return (
        <Alert variant="info">{formatMessage({ id: "app.conviction.loadingStrategies" })}</Alert>
      );
    }

    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          maxWidthClassName="max-w-4xl"
          title={formatMessage({ id: "app.conviction.title" })}
          description={formatMessage({ id: "app.conviction.loadingStrategies" })}
          backLink={communityBackLink}
        />
      </CanvasRouteFrame>
    );
  }

  if (!garden) {
    if (layout === "sheet") {
      return (
        <Alert variant="error">{formatMessage({ id: "app.conviction.gardenNotFound" })}</Alert>
      );
    }

    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          maxWidthClassName="max-w-4xl"
          title={formatMessage({ id: "app.conviction.title" })}
          description={formatMessage({ id: "app.conviction.gardenNotFound" })}
          backLink={communityBackLink}
        />
      </CanvasRouteFrame>
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
      { gardenAddress: gardenId as Address, strategies: updated },
      { onSuccess: () => setNewAddress("") }
    );
  };

  const handleRemoveStrategy = (index: number, onSettled?: () => void) => {
    const updated = strategies.filter((_, i) => i !== index);
    setStrategies({ gardenAddress: gardenId as Address, strategies: updated }, { onSettled });
  };

  const content = (
    <>
      {/* Stats */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="surface-inset">
          <p className="text-xs text-text-soft">
            {formatMessage({ id: "app.conviction.strategies" })}
          </p>
          <p className="mt-1 text-xl font-semibold text-text-strong">{strategies.length}</p>
        </div>
      </section>

      {strategiesError && (
        <Alert variant="error">{formatMessage({ id: "app.conviction.errorLoadingFailed" })}</Alert>
      )}

      {/* Info banner — only show when no strategies configured */}
      {strategies.length === 0 && !strategiesLoading && (
        <Alert variant="info">{formatMessage({ id: "app.conviction.notDeployed" })}</Alert>
      )}

      {/* Strategy list */}
      <section className="surface-inset p-0">
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
                    <AdminButton
                      type="button"
                      variant="danger"
                      size="sm"
                      className="h-9 w-9 min-w-0 rounded p-0"
                      onClick={() => setConfirmRemoveIndex(index)}
                      disabled={isSaving}
                      aria-label={formatMessage({ id: "app.conviction.removeStrategy" })}
                    >
                      <RiDeleteBinLine className="h-4 w-4" />
                    </AdminButton>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add strategy form */}
          {canManage && (
            <div className="mt-4 flex gap-2">
              <AdminTextField
                label={formatMessage({ id: "app.conviction.strategyAddress" })}
                variant="outlined"
                value={newAddress}
                onChange={(e) => {
                  setNewAddress(e.target.value);
                  setAddressError("");
                }}
                placeholder={formatMessage({ id: "app.conviction.strategyAddressPlaceholder" })}
                error={addressError || undefined}
                className="flex-1"
              />
              <AdminButton
                type="button"
                variant="filled"
                onClick={handleAddStrategy}
                disabled={isSaving || !newAddress.trim()}
                loading={isSaving}
              >
                {formatMessage({ id: "app.conviction.addStrategy" })}
              </AdminButton>
            </div>
          )}
        </div>
      </section>
    </>
  );

  const dialog = (
    <AdminConfirmDialog
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
  );

  if (layout === "sheet") {
    return (
      <div className="space-y-6">
        {content}
        {dialog}
      </div>
    );
  }

  return (
    <CanvasRouteFrame>
      <CanvasRouteHeader
        maxWidthClassName="max-w-4xl"
        title={formatMessage({ id: "app.conviction.title" })}
        description={formatMessage(
          { id: "app.conviction.description" },
          { gardenName: garden.name }
        )}
        backLink={communityBackLink}
        sticky
      />

      <CanvasRouteContent maxWidthClassName="max-w-4xl" className="mt-6 space-y-6">
        {content}
      </CanvasRouteContent>
      {dialog}
    </CanvasRouteFrame>
  );
}
