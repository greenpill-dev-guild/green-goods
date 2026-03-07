import {
  type Address,
  useGardenCookieJars,
  useGardenVaults,
  useUser,
  useVaultDeposits,
} from "@green-goods/shared";
import { useState } from "react";
import { useIntl } from "react-intl";
import { CookieJarTabContent } from "./CookieJarTabContent";
import { type ModalDrawerTab, ModalDrawer } from "./ModalDrawer";
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

  const tabs: ModalDrawerTab[] = [
    { id: "treasury", label: formatMessage({ id: "app.treasury.title" }) },
    { id: "cookie-jar", label: formatMessage({ id: "app.cookieJar.title" }) },
  ];

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
    >
      {activeTab === "treasury" && (
        <TreasuryTabContent
          gardenAddress={gardenAddress}
          vaults={vaults}
          vaultsLoading={vaultsLoading}
          vaultsError={vaultsError}
          refetchVaults={refetchVaults}
          deposits={deposits}
          isOpen={isOpen}
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
