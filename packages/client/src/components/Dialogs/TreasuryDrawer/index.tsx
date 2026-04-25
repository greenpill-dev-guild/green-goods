import {
  type Address,
  getVaultAssetDecimals,
  useDebouncedValue,
  useGardenCookieJars,
  useGardenVaults,
  useOffline,
  useUser,
  useVaultDeposit,
  useVaultDeposits,
  useVaultPreview,
  validateDecimalInput,
} from "@green-goods/shared";
import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { parseUnits } from "viem";
import { useBalance } from "wagmi";
import { ModalDrawer, type ModalDrawerTab } from "../ModalDrawer";
import { CookieJarTabContent } from "./CookieJarTabContent";
import { TreasuryTabContent } from "./TreasuryTabContent";

interface EndowmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  gardenAddress: Address;
  gardenName: string;
}

export function EndowmentDrawer({
  isOpen,
  onClose,
  gardenAddress,
  gardenName,
}: EndowmentDrawerProps) {
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
  } = useGardenCookieJars(gardenAddress, { enabled: isOpen });
  const { deposits } = useVaultDeposits(gardenAddress, {
    userAddress: primaryAddress ?? undefined,
    enabled: isOpen && Boolean(primaryAddress),
  });

  const [selectedAsset, setSelectedAsset] = useState("");
  const [amountInput, setAmountInput] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedAsset(vaults[0]?.asset ?? "");
    setAmountInput("");
    setActiveTab("treasury");
  }, [isOpen, vaults]);

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

  const tabs: ModalDrawerTab[] = [
    { id: "treasury", label: formatMessage({ id: "app.treasury.endowmentsTab" }) },
    { id: "cookie-jar", label: formatMessage({ id: "app.cookieJar.title" }) },
  ];

  const depositFooter =
    activeTab === "treasury" && primaryAddress ? (
      <button
        type="button"
        onClick={onDeposit}
        disabled={
          !isOnline ||
          !selectedVault ||
          !primaryAddress ||
          amount <= 0n ||
          amount > (balance?.value ?? 0n) ||
          depositMutation.isPending
        }
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary-action px-4 py-2.5 text-sm font-medium text-primary-action-foreground transition hover:bg-primary-action-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {depositMutation.isPending
          ? formatMessage({ id: "app.treasury.depositing" })
          : formatMessage({ id: "app.treasury.deposit" })}
      </button>
    ) : undefined;

  return (
    <ModalDrawer
      isOpen={isOpen}
      onClose={onClose}
      header={{ title: formatMessage({ id: "app.treasury.title" }), description: gardenName }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      contentClassName="overflow-y-auto p-0"
      maxHeight="95vh"
      footer={depositFooter}
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
          jars={cookieJars}
          isLoading={jarsLoading}
          isError={Boolean(jarsError)}
          moduleConfigured={jarsModuleConfigured}
        />
      )}
    </ModalDrawer>
  );
}
