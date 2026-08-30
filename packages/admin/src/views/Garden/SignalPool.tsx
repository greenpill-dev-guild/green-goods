import { Alert } from "@green-goods/shared/components/Alert";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useDeregisterHypercert } from "@green-goods/shared/hooks/conviction/useDeregisterHypercert";
import { useGardenPools } from "@green-goods/shared/hooks/conviction/useGardenPools";
import { useHypercertConviction } from "@green-goods/shared/hooks/conviction/useHypercertConviction";
import { useRegisteredHypercerts } from "@green-goods/shared/hooks/conviction/useRegisteredHypercerts";
import { useRegisterHypercert } from "@green-goods/shared/hooks/conviction/useRegisterHypercert";
import { useAdminGardenWorkspaceSelection } from "@green-goods/shared/hooks/garden/useAdminGardenWorkspaceSelection";
import { useGardenPermissions } from "@green-goods/shared/hooks/garden/useGardenPermissions";
import type { Address } from "@green-goods/shared/types/domain";
import { PoolType } from "@green-goods/shared/types/gardens-community";
import { compareAddresses } from "@green-goods/shared/utils/blockchain/address";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { RiDeleteBinLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";
import { AdminButton, AdminIconButton } from "@/components/AdminButton";
import { AdminConfirmDialog } from "@/components/AdminDialog";
import { AdminInlineField } from "@/components/AdminInlineField";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import { AdminTabRail } from "@/components/AdminTabRail";
import { EnsAddressText } from "@/components/EnsAddressText";
import {
  CanvasRouteContent,
  CanvasRouteFrame,
  CanvasRouteHeader,
} from "@/components/Layout/CanvasRouteFrame";

/**
 * Unified signal pool management view.
 *
 * Supports both pool types via the :poolType URL param:
 * - "hypercert" -> PoolType.Hypercert (index 0) — hypercert curation
 * - "action"    -> PoolType.Action    (index 1) — action signaling
 *
 * Both pool types share the same contract ABI (registerHypercert/deregisterHypercert)
 * because "hypercertId" at the contract level is a generic proposal identifier.
 */
type SignalPoolType = "hypercert" | "action";

interface GardenSignalPoolViewProps {
  layout?: "page" | "sheet" | "inline";
  /**
   * When embedded inline (Coordination tab) the parent owns the active pool
   * type; falls back to the `:poolType` route param for the standalone routes.
   */
  poolType?: SignalPoolType;
  onPoolTypeChange?: (next: SignalPoolType) => void;
}

export default function GardenSignalPoolView({
  layout = "page",
  poolType,
  onPoolTypeChange,
}: GardenSignalPoolViewProps = {}) {
  const { poolType: poolTypeParam } = useParams<{ poolType: string }>();
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const [newItemId, setNewItemId] = useState("");
  const [inputError, setInputError] = useState("");
  const [confirmDeregister, setConfirmDeregister] = useState<bigint | null>(null);
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const gardenId = selectedGarden?.id ?? null;

  const activePoolType = poolType ?? poolTypeParam;
  const isActionPool = activePoolType === "action";
  const targetPoolType = isActionPool ? PoolType.Action : PoolType.Hypercert;

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((item) => compareAddresses(item.id, gardenId));
  const gardenRouteContext = { gardenId: garden?.id ?? gardenId ?? undefined };
  const permissions = useGardenPermissions();

  // Load pools from GardensModule — typed with PoolType
  const { pools } = useGardenPools((gardenId as Address | null) ?? undefined, {
    enabled: Boolean(gardenId),
  });

  const pool = pools.find((p) => p.poolType === targetPoolType);
  const poolAddress = pool?.poolAddress;

  // Load registered items from the signal pool
  const {
    hypercertIds: registeredIds,
    isLoading: itemsLoading,
    isError: itemsError,
    refetch: refetchItems,
  } = useRegisteredHypercerts(poolAddress, {
    enabled: Boolean(poolAddress),
  });

  const registerMutation = useRegisterHypercert();
  const deregisterMutation = useDeregisterHypercert();

  // Load conviction weights for display
  const {
    weights,
    isLoading: weightsLoading,
    isError: weightsError,
    refetch: refetchWeights,
  } = useHypercertConviction(poolAddress, {
    enabled: Boolean(poolAddress),
  });

  const hasReadError = itemsError || weightsError;
  const retryReads = () => {
    void refetchItems();
    void refetchWeights();
  };

  // i18n key helpers based on pool type
  const titleKey = isActionPool ? "app.signal.actionPool.title" : "app.signal.hypercertPool.title";
  const descriptionKey = isActionPool
    ? "app.signal.actionPool.description"
    : "app.signal.hypercertPool.description";
  const emptyKey = isActionPool ? "app.signal.actionPool.noActions" : "app.signal.noHypercerts";
  const countLabelKey = isActionPool
    ? "app.signal.actionPool.countLabel"
    : "app.signal.hypercertPool.countLabel";
  const idRequiredKey = isActionPool
    ? "app.signal.actionPool.actionIdRequired"
    : "app.conviction.hypercertIdRequired";
  const alreadyRegisteredKey = isActionPool
    ? "app.signal.actionPool.alreadyRegistered"
    : "app.signal.alreadyRegistered";
  const confirmDeregisterKey = isActionPool
    ? "app.signal.actionPool.confirmDeregister"
    : "app.signal.hypercertPool.confirmDeregister";
  const confirmDeregisterDescKey = isActionPool
    ? "app.signal.actionPool.confirmDeregisterDescription"
    : "app.signal.hypercertPool.confirmDeregisterDescription";
  const communityBackLink = {
    to: adminRoutes.communityCoordination(gardenRouteContext),
    label: formatMessage({ id: "cockpit.nav.community", defaultMessage: "Community" }),
  };
  const poolTabs = [
    {
      id: "hypercert",
      label: formatMessage({ id: "app.signal.viewHypercertPool" }),
    },
    {
      id: "action",
      label: formatMessage({ id: "app.signal.viewActionPool" }),
    },
  ];
  const handlePoolTabChange = (nextPoolType: string) => {
    const next: SignalPoolType = nextPoolType === "action" ? "action" : "hypercert";
    // Inline (Coordination tab) owns the toggle locally; the standalone routes
    // still navigate so deep links and the browser back button keep working.
    if (onPoolTypeChange) {
      onPoolTypeChange(next);
      return;
    }
    navigate(adminRoutes.communityCoordinationSignalPool(next, gardenRouteContext));
  };

  if (gardensLoading) {
    if (layout !== "page") {
      return <Alert variant="info">{formatMessage({ id: "app.signal.loading" })}</Alert>;
    }

    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          maxWidthClassName="max-w-4xl"
          title={formatMessage({ id: titleKey })}
          description={formatMessage({ id: "app.signal.loading" })}
          backLink={communityBackLink}
        />
      </CanvasRouteFrame>
    );
  }

  if (!garden) {
    if (layout !== "page") {
      return (
        <Alert variant="error">{formatMessage({ id: "app.conviction.gardenNotFound" })}</Alert>
      );
    }

    return (
      <CanvasRouteFrame>
        <CanvasRouteHeader
          maxWidthClassName="max-w-4xl"
          title={formatMessage({ id: titleKey })}
          description={formatMessage({ id: "app.conviction.gardenNotFound" })}
          backLink={communityBackLink}
        />
      </CanvasRouteFrame>
    );
  }

  const canManage = permissions.canManageGarden(garden);

  // Build a weight lookup map
  const weightMap = new Map<string, bigint>();
  let totalWeight = 0n;
  for (const w of weights) {
    weightMap.set(w.hypercertId.toString(), w.weight);
    totalWeight += w.weight;
  }

  const handleRegister = () => {
    const trimmed = newItemId.trim();
    if (!trimmed) {
      setInputError(formatMessage({ id: idRequiredKey }));
      return;
    }

    try {
      const parsed = BigInt(trimmed);
      if (parsed < 0n) {
        setInputError(formatMessage({ id: "app.conviction.errorInvalidHypercertId" }));
        return;
      }
      if (registeredIds.some((existingId) => existingId === parsed)) {
        setInputError(formatMessage({ id: alreadyRegisteredKey }));
        return;
      }
    } catch {
      setInputError(formatMessage({ id: "app.conviction.errorMustBeNumber" }));
      return;
    }

    if (!poolAddress) return;
    setInputError("");
    registerMutation.mutate(
      { poolAddress, hypercertId: BigInt(trimmed) },
      { onSuccess: () => setNewItemId("") }
    );
  };

  const getWeightPercentage = (itemId: bigint): number => {
    if (totalWeight === 0n) return 0;
    const weight = weightMap.get(itemId.toString()) ?? 0n;
    return Number((weight * 100n) / totalWeight);
  };

  const content = (
    <>
      {layout !== "page" ? (
        <AdminTabRail
          ariaLabel={formatMessage({ id: "app.community.pools" })}
          activeId={isActionPool ? "action" : "hypercert"}
          onChange={handlePoolTabChange}
          tabs={poolTabs}
        />
      ) : null}

      {/* Pool not deployed */}
      {!poolAddress && (
        <Alert variant="info">{formatMessage({ id: "app.signal.poolNotFound" })}</Alert>
      )}

      {/* Read errors render inside the weights section below (never as a banner
          above content) so a failed load does not shift the layout. */}

      {poolAddress && (
        <>
          {/* Stats */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="surface-inset">
              <p className="text-xs text-text-soft">
                {formatMessage({ id: "app.conviction.poolAddress" })}
              </p>
              <p className="mt-1 text-sm font-medium text-text-strong">
                <EnsAddressText address={poolAddress} />
              </p>
            </div>
            <div className="surface-inset">
              <p className="text-xs text-text-soft">{formatMessage({ id: countLabelKey })}</p>
              {/* Value slots keep their final geometry while loading — a
                  shimmer block the size of the number, never swapped-in text. */}
              <p className="mt-1 text-lg font-semibold text-text-strong">
                {itemsError ? (
                  <span className="text-text-soft">—</span>
                ) : itemsLoading ? (
                  <span className="block h-7 w-12 rounded-md skeleton-shimmer" aria-hidden />
                ) : (
                  registeredIds.length
                )}
              </p>
            </div>
            <div className="surface-inset">
              <p className="text-xs text-text-soft">
                {formatMessage({ id: "app.signal.weightsRecordedLabel" })}
              </p>
              <p className="mt-1 text-lg font-semibold text-text-strong">
                {weightsError ? (
                  <span className="text-text-soft">—</span>
                ) : weightsLoading ? (
                  <span className="block h-7 w-12 rounded-md skeleton-shimmer" aria-hidden />
                ) : (
                  weights.length
                )}
              </p>
            </div>
          </section>

          {/* Conviction weights */}
          <section className="surface-inset p-0">
            <div className="border-b border-stroke-soft p-4 sm:p-6">
              <h3 className="text-base font-medium text-text-strong sm:text-lg">
                {formatMessage({ id: "app.signal.conviction" })}
              </h3>
              <p className="mt-1 text-sm text-text-sub">
                {formatMessage({ id: "app.conviction.convictionWeightsDescription" })}
              </p>
            </div>

            <div className="min-h-52 p-4 sm:p-6">
              {hasReadError ? (
                // Read failures fill this reserved region (they never mount as a
                // banner above content) so a failed load does not shift layout.
                <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center">
                  <p className="text-sm text-text-soft">
                    {formatMessage({ id: "app.conviction.errorLoadingFailed" })}
                  </p>
                  <AdminButton type="button" variant="tonal" size="sm" onClick={retryReads}>
                    {formatMessage({ id: "app.common.retry" })}
                  </AdminButton>
                </div>
              ) : itemsLoading || weightsLoading ? (
                // Skeleton rows match the loaded row height so the section
                // does not shift when weights land.
                <div
                  className="space-y-2"
                  role="status"
                  aria-label={formatMessage({ id: "app.signal.loading" })}
                >
                  <div className="h-16 rounded-md skeleton-shimmer" />
                  <div className="h-16 rounded-md skeleton-shimmer" />
                  <div className="h-16 rounded-md skeleton-shimmer" />
                </div>
              ) : registeredIds.length === 0 ? (
                <p className="flex min-h-40 items-center justify-center text-center text-sm text-text-soft">
                  {formatMessage({ id: emptyKey })}
                </p>
              ) : (
                <div className="space-y-2">
                  {registeredIds.map((itemId) => {
                    const pct = getWeightPercentage(itemId);
                    return (
                      <div
                        key={itemId.toString()}
                        className="flex items-center justify-between gap-3 rounded-md bg-bg-weak p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-sm font-medium text-text-strong">
                            #{itemId.toString()}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <AdminLinearProgress
                              value={Math.min(pct, 100)}
                              ariaLabel={formatMessage(
                                { id: "app.signal.weightFor" },
                                { id: itemId.toString() }
                              )}
                              className="flex-1"
                            />
                            <span className="text-xs text-text-sub">{pct}%</span>
                          </div>
                        </div>
                        {canManage && (
                          <AdminIconButton
                            variant="danger"
                            onClick={() => setConfirmDeregister(itemId)}
                            disabled={deregisterMutation.isPending}
                            label={formatMessage({ id: "app.conviction.removeStrategy" })}
                          >
                            <RiDeleteBinLine />
                          </AdminIconButton>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Register item form — hidden while a read failed so the
                  duplicate check against registeredIds stays trustworthy. */}
              {canManage && !hasReadError && (
                <AdminInlineField
                  className="mt-4"
                  label={formatMessage({
                    id: isActionPool
                      ? "app.signal.actionPool.actionIdLabel"
                      : "app.signal.hypercertPool.hypercertIdLabel",
                  })}
                  value={newItemId}
                  onChange={(next) => {
                    setNewItemId(next);
                    setInputError("");
                  }}
                  onSubmit={handleRegister}
                  inputMode="numeric"
                  error={inputError || undefined}
                  action={
                    <AdminButton
                      type="button"
                      variant="filled"
                      onClick={handleRegister}
                      disabled={!newItemId.trim() || registerMutation.isPending}
                      loading={registerMutation.isPending}
                    >
                      {formatMessage({ id: "app.conviction.register" })}
                    </AdminButton>
                  }
                />
              )}
            </div>
          </section>
        </>
      )}
    </>
  );

  const dialog = (
    <AdminConfirmDialog
      isOpen={confirmDeregister !== null}
      onClose={() => setConfirmDeregister(null)}
      title={formatMessage({ id: confirmDeregisterKey })}
      description={formatMessage({ id: confirmDeregisterDescKey })}
      variant="danger"
      tone="garden"
      onConfirm={() => {
        if (poolAddress && confirmDeregister !== null) {
          deregisterMutation.mutate(
            { poolAddress, hypercertId: confirmDeregister },
            { onSettled: () => setConfirmDeregister(null) }
          );
        }
      }}
    />
  );

  if (layout === "sheet" || layout === "inline") {
    return (
      <div className="space-y-6 overflow-x-hidden">
        {content}
        {dialog}
      </div>
    );
  }

  return (
    <CanvasRouteFrame>
      <CanvasRouteHeader
        maxWidthClassName="max-w-4xl"
        title={formatMessage({ id: titleKey })}
        description={formatMessage({ id: descriptionKey }, { gardenName: garden.name })}
        variant="canvas"
        backLink={communityBackLink}
        sticky
      >
        <AdminTabRail
          ariaLabel={formatMessage({ id: "app.community.pools" })}
          activeId={isActionPool ? "action" : "hypercert"}
          onChange={handlePoolTabChange}
          tabs={poolTabs}
        />
      </CanvasRouteHeader>

      <CanvasRouteContent maxWidthClassName="max-w-4xl" className="mt-6 space-y-6">
        {content}
      </CanvasRouteContent>
      {dialog}
    </CanvasRouteFrame>
  );
}
