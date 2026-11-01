import type { Address } from "@green-goods/shared/types/domain";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { AccountInfo } from "./AccountInfo";
import { AppSettings } from "./AppSettings";
import { ENSSection } from "./ENSSection";
import { GardensList } from "./GardensList";
import { InstallCta } from "./InstallCta";
import { ServiceAssets } from "./ServiceAssets";

export const ProfileAccount: React.FC = () => {
  const primaryAddress = usePrimaryAddress() as Address | undefined;

  return (
    // The tab measures itself, so each card answers the width it actually has (DL-159).
    <div className="@container flex flex-col gap-6">
      <InstallCta />
      <AppSettings />
      <GardensList primaryAddress={primaryAddress} />
      <ENSSection key={primaryAddress} primaryAddress={primaryAddress} />
      <ServiceAssets />
      <AccountInfo />
    </div>
  );
};
