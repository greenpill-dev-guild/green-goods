import {
  type Address,
  Alert,
  adminRoutes,
  ConfirmDialog,
  PoolType,
  useAdminGardenWorkspaceSelection,
  useDeregisterHypercert,
  useGardenPermissions,
  useGardenPools,
  useGardens,
  useHypercertConviction,
  useRegisteredHypercerts,
  useRegisterHypercert,
} from "@green-goods/shared";
import { RiDeleteBinLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate, useParams } from "react-router-dom";
import { AdminButton } from "@/components/AdminButton";
import { EnsAddressText } from "@/components/EnsAddressText";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminTextField } from "@/components/AdminTextField";
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
interface GardenSignalPoolViewProps {
  layout?: "page" | "sheet";
}

export default function GardenSignalPoolView({ layout = "page" }: GardenSignalPoolViewProps = {}) {
  const { poolType: poolTypeParam } = useParams<{ poolType: string }>();
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const [newItemId, setNewItemId] = useState("");
  const [inputError, setInputError] = useState("");
  const [confirmDeregister, setConfirmDeregister] = useState<bigint | null>(null);
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const gardenId = selectedGarden?.id ?? null;

  const isActionPool = poolTypeParam === "action";
  const targetPoolType = isActionPool ? PoolType.Action : PoolType.Hypercert;

  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const garden = gardens.find((item) => item.id === gardenId);
  const gardenRouteContext = { gardenAddress: garden?.tokenAddress ?? garden?.id ?? gardenId };
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
  } = useHypercertConviction(poolAddress, {
    enabled: Boolean(poolAddress),
  });

  // i18n key helpers based on pool type
  const titleKey = isActionPool ? "app.signal.actionPool.title" : "app.signal.hypercertPool.title";
  const descriptionKey = isActionPool
    ? "app.signal.actionPool.description"
    : "app.signal.hypercertPool.description";
  const emptyKey = isActionPool ? "app.signal.actionPool.noActions" : "app.signal.noHypercerts";
  const countKey = isActionPool ? "app.signal.actionPool.actionCount" : "app.signal.hypercertCount";
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
    to: adminRoutes.communityGovernance(gardenRouteContext),
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
  const handlePoolTabChange = (nextPoolType: string) =>
    navigate(
      adminRoutes.communityGovernanceSignalPool(
        nextPoolType === "action" ? "action" : "hypercert",
        gardenRouteContext
      )
    );

  if (gardensLoading) {
    if (layout === "sheet") {
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
    if (layout === "sheet") {
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
      {layout === "sheet" ? (
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

      {(itemsError || weightsError) && (
        <Alert variant="error">{formatMessage({ id: "app.conviction.errorLoadingFailed" })}</Alert>
      )}

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
              <p className="text-xs text-text-soft">
                {formatMessage({ id: countKey }, { count: 0 }).replace(/^0\s*/, "")}
              </p>
              <p className="mt-1 text-xl font-semibold text-text-strong">
                {itemsLoading ? formatMessage({ id: "app.common.loading" }) : registeredIds.length}
              </p>
            </div>
            <div className="surface-inset">
              <p className="text-xs text-text-soft">
                {formatMessage({ id: "app.signal.conviction" })}
              </p>
              <p className="mt-1 text-xl font-semibold text-text-strong">
                {weightsLoading
                  ? formatMessage({ id: "app.common.loading" })
                  : weights.length > 0
                    ? formatMessage({ id: "app.signal.conviction" })
                    : formatMessage({ id: emptyKey })}
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

            <div className="p-4 sm:p-6">
              {itemsLoading || weightsLoading ? (
                <p className="py-4 text-center text-sm text-text-soft" role="status">
                  {formatMessage({ id: "app.signal.loading" })}
                </p>
              ) : registeredIds.length === 0 ? (
                <p className="py-4 text-center text-sm text-text-soft">
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
                          <AdminButton
                            type="button"
                            variant="danger"
                            size="sm"
                            className="h-9 w-9 min-w-0 rounded p-0"
                            onClick={() => setConfirmDeregister(itemId)}
                            disabled={deregisterMutation.isPending}
                            aria-label={formatMessage({ id: "app.conviction.removeStrategy" })}
                          >
                            <RiDeleteBinLine className="h-4 w-4" />
                          </AdminButton>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Register item form */}
              {canManage && (
                <div className="mt-4 flex gap-2">
                  <AdminTextField
                    label={formatMessage({
                      id: isActionPool
                        ? "app.signal.actionPool.actionIdPlaceholder"
                        : "app.signal.hypercertPool.hypercertIdPlaceholder",
                    })}
                    variant="outlined"
                    value={newItemId}
                    onChange={(e) => {
                      setNewItemId(e.target.value);
                      setInputError("");
                    }}
                    placeholder={formatMessage({
                      id: isActionPool
                        ? "app.signal.actionPool.actionIdPlaceholder"
                        : "app.signal.hypercertPool.hypercertIdPlaceholder",
                    })}
                    error={inputError || undefined}
                    className="flex-1"
                  />
                  <AdminButton
                    type="button"
                    variant="filled"
                    onClick={handleRegister}
                    disabled={!newItemId.trim() || registerMutation.isPending}
                    loading={registerMutation.isPending}
                  >
                    {registerMutation.isPending
                      ? formatMessage({ id: "app.common.processing" })
                      : formatMessage({ id: "app.conviction.register" })}
                  </AdminButton>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );

  const dialog = (
    <ConfirmDialog
      isOpen={confirmDeregister !== null}
      onClose={() => setConfirmDeregister(null)}
      title={formatMessage({ id: confirmDeregisterKey })}
      description={formatMessage({ id: confirmDeregisterDescKey })}
      variant="danger"
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
