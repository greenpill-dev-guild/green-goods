import type { Address } from "@green-goods/shared/types/domain";
import {
  getVaultAssetDecimals,
  validateDecimalInput,
} from "@green-goods/shared/utils/blockchain/vaults";
import { useDebouncedValue } from "@green-goods/shared/hooks/utils/useDebouncedValue";
import { useGardenCookieJars } from "@green-goods/shared/hooks/cookie-jar/useGardenCookieJars";
import { useGardenVaults } from "@green-goods/shared/hooks/vault/useGardenVaults";
import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useVaultDeposit } from "@green-goods/shared/hooks/vault/useVaultDeposit";
import { useVaultDeposits } from "@green-goods/shared/hooks/vault/useVaultDeposits";
import { useVaultPreview } from "@green-goods/shared/hooks/vault/useVaultPreview";
import type { SheetActionsProps } from "@green-goods/shared/components/Dialog/SheetActions";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { parseUnits } from "viem";
import { useBalance } from "wagmi";
import { AppSheet, type AppSheetTab } from "../AppSheet";
import { CookieJarTabContent } from "./CookieJarTabContent";
import { TreasuryTabContent } from "./TreasuryTabContent";

interface EndowmentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
  gardenName: string;
}

export function EndowmentSheet({
  isOpen,
  onClose,
  gardenAddress,
  gardenName,
}: EndowmentSheetProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const { isOnline } = useOffline();
  const depositMutation = useVaultDeposit();
  const [activeTab, setActiveTab] = useState("treasury");

  const {
    vaults,
    isLoading: vaultsLoading,
    isError: vaultsError,
    refetch: refetchVaults,
  } = useGardenVaults(gardenAddress, { enabled: isOpen });
  const {
    jars: cookieJars,
    isLoading: jarsLoading,
    error: jarsError,
    moduleConfigured: jarsModuleConfigured,
    hasDetailReadFailure: jarsDetailReadFailure,
  } = useGardenCookieJars(gardenAddress, { enabled: isOpen });
  const { deposits } = useVaultDeposits(gardenAddress, {
    userAddress: primaryAddress ?? undefined,
    enabled: isOpen && Boolean(primaryAddress),
  });

  const [selectedAsset, setSelectedAsset] = useState("");
  const [amountInput, setAmountInput] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAsset("");
    setAmountInput("");
    setActiveTab("treasury");
  }, [gardenAddress, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const hasSelectedVault =
      selectedAsset &&
      vaults.some((vault) => vault.asset.toLowerCase() === selectedAsset.toLowerCase());
    if (hasSelectedVault) return;

    const nextAsset = vaults[0]?.asset ?? "";
    if (selectedAsset !== nextAsset) {
      setSelectedAsset(nextAsset);
      setAmountInput("");
    }
  }, [isOpen, selectedAsset, vaults]);

  const selectedVault = useMemo(
    () => vaults.find((vault) => vault.asset.toLowerCase() === selectedAsset.toLowerCase()),
    [selectedAsset, vaults]
  );

  const { data: balance } = useBalance({
    address: primaryAddress as Address | undefined,
    token: selectedVault?.asset as Address | undefined,
    query: { enabled: isOpen && Boolean(primaryAddress && selectedVault) },
  });

  const decimals =
    balance?.decimals ?? getVaultAssetDecimals(selectedAsset, selectedVault?.chainId);
  const inputError = useMemo(
    () => validateDecimalInput(amountInput, decimals),
    [amountInput, decimals]
  );

  const amount = useMemo(() => {
    if (!amountInput.trim() || inputError) return 0n;
    try {
      return parseUnits(amountInput, decimals);
    } catch {
      return 0n;
    }
  }, [amountInput, decimals, inputError]);

  const debouncedAmount = useDebouncedValue(amount, 300);

  const { preview } = useVaultPreview({
    vaultAddress: selectedVault?.vaultAddress as Address | undefined,
    amount: debouncedAmount,
    userAddress: primaryAddress as Address | undefined,
    enabled: isOpen && Boolean(selectedVault && debouncedAmount > 0n),
  });

  const myDeposits = useMemo(() => deposits.filter((deposit) => deposit.shares > 0n), [deposits]);

  const onDeposit = () => {
    if (!selectedVault || !primaryAddress || amount <= 0n) return;

    depositMutation.mutate(
      {
        gardenAddress,
        assetAddress: selectedVault.asset,
        vaultAddress: selectedVault.vaultAddress,
        amount,
        receiver: primaryAddress as Address,
      },
      { onSuccess: () => setAmountInput("") }
    );
  };

  const tabs: AppSheetTab[] = [
    { id: "treasury", label: formatMessage({ id: "app.treasury.endowmentsTab" }) },
    { id: "cookie-jar", label: formatMessage({ id: "app.cookieJar.title" }) },
  ];

  const depositActions: SheetActionsProps | undefined =
    activeTab === "treasury" && primaryAddress
      ? {
          primary: {
            label: formatMessage({ id: "app.treasury.deposit" }),
            onClick: onDeposit,
            loading: depositMutation.isPending,
            disabled:
              !isOnline ||
              !selectedVault ||
              !primaryAddress ||
              amount <= 0n ||
              amount > (balance?.value ?? 0n),
          },
        }
      : undefined;

  return (
    <AppSheet
      isOpen={isOpen}
      onClose={onClose}
      header={{ title: formatMessage({ id: "app.treasury.title" }), description: gardenName }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      contentClassName="overflow-y-auto p-0"
      size="full"
      actions={depositActions}
    >
      {activeTab === "treasury" && (
        <TreasuryTabContent
          isOnline={isOnline}
          vaults={vaults}
          vaultsLoading={vaultsLoading}
          vaultsError={vaultsError}
          refetchVaults={refetchVaults}
          myDeposits={myDeposits}
          gardenAddress={gardenAddress}
          primaryAddress={primaryAddress}
          selectedAsset={selectedAsset}
          onSelectAsset={setSelectedAsset}
          amountInput={amountInput}
          onAmountChange={setAmountInput}
          balance={balance}
          previewShares={preview?.previewShares}
          decimals={decimals}
        />
      )}

      {activeTab === "cookie-jar" && (
        <CookieJarTabContent
          gardenAddress={gardenAddress}
          gardenName={gardenName}
          jars={cookieJars}
          isLoading={jarsLoading}
          isError={Boolean(jarsError)}
          moduleConfigured={jarsModuleConfigured}
          hasDetailReadFailure={jarsDetailReadFailure}
        />
      )}
    </AppSheet>
  );
}
