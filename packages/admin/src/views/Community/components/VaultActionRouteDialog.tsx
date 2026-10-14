import { Alert } from "@green-goods/shared/components/Alert";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useAdminGardenWorkspaceSelection } from "@green-goods/shared/hooks/garden/useAdminGardenWorkspaceSelection";
import { useGardenVaults } from "@green-goods/shared/hooks/vault/useGardenVaults";
import type { Address } from "@green-goods/shared/types/domain";
import { adminRoutes } from "@green-goods/shared/utils/navigation/admin-routes";
import { useCallback, useMemo } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate } from "react-router-dom";
import { isAddress } from "viem";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog } from "@/components/AdminDialog";
import { DepositModal, WithdrawModal } from "@/components/Vault";

export type VaultActionRoute = "deposit" | "withdraw";

interface VaultActionRouteDialogProps {
  action: VaultActionRoute | null;
  gardenAddress?: Address | string;
}

export function VaultActionRouteDialog({ action, gardenAddress }: VaultActionRouteDialogProps) {
  const { formatMessage } = useIntl();
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedGarden } = useAdminGardenWorkspaceSelection();
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const requestedAsset = useMemo(
    () => new URLSearchParams(location.search).get("item") ?? undefined,
    [location.search]
  );
  const resolvedGardenId = gardenAddress ?? selectedGarden?.id;
  const garden = gardens.find((item) => item.id === resolvedGardenId);
  const dialogGardenId = garden?.id ?? resolvedGardenId;
  const vaultGardenAddress =
    dialogGardenId && isAddress(dialogGardenId) ? dialogGardenId : undefined;
  const {
    vaults,
    isLoading: vaultsLoading,
    isError: vaultsHasError,
    refetch,
    isFetching,
  } = useGardenVaults(vaultGardenAddress, {
    enabled: Boolean(action && vaultGardenAddress),
  });
  // Closing a Deposit/Withdraw form returns to the endowment tab itself — never to the
  // `/vault` route, which used to re-pop a duplicate jars-inspector dialog on close.
  const closeTo = adminRoutes.communityEndowment({ gardenId: dialogGardenId });
  const handleClose = useCallback(() => navigate(closeTo), [closeTo, navigate]);

  if (!action) return null;

  const isDeposit = action === "deposit";
  const title = formatMessage({
    id: isDeposit ? "app.treasury.deposit" : "app.treasury.withdraw",
  });
  const description = formatMessage({
    id: isDeposit ? "app.treasury.depositDescription" : "app.treasury.withdrawDescription",
  });

  if (gardensLoading || vaultsLoading || !vaultGardenAddress || vaultsHasError) {
    return (
      <AdminDialog
        open
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
        size="md"
        tone="community"
        title={title}
        description={description}
        actions={
          <>
            {vaultsHasError && vaultGardenAddress ? (
              <AdminButton
                type="button"
                variant="outlined"
                onClick={() => {
                  void refetch();
                }}
                disabled={isFetching}
              >
                {isFetching
                  ? formatMessage({ id: "app.common.refreshing" })
                  : formatMessage({ id: "app.common.tryAgain" })}
              </AdminButton>
            ) : null}
            <AdminButton type="button" variant="text" onClick={handleClose}>
              {formatMessage({ id: "app.common.cancel" })}
            </AdminButton>
          </>
        }
      >
        <Alert variant={vaultsHasError || !vaultGardenAddress ? "error" : "info"}>
          {!vaultGardenAddress
            ? formatMessage({ id: "app.treasury.gardenNotFound" })
            : vaultsHasError
              ? formatMessage({ id: "app.treasury.errorLoading" })
              : formatMessage({ id: "app.treasury.loadingVaults" })}
        </Alert>
      </AdminDialog>
    );
  }

  if (isDeposit) {
    return (
      <DepositModal
        isOpen
        onClose={handleClose}
        gardenAddress={vaultGardenAddress}
        vaults={vaults}
        defaultAsset={requestedAsset}
        tone="community"
      />
    );
  }

  return (
    <WithdrawModal
      isOpen
      onClose={handleClose}
      gardenAddress={vaultGardenAddress}
      vaults={vaults}
      defaultAsset={requestedAsset}
      tone="community"
    />
  );
}
