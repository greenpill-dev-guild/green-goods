import type { Address } from "@green-goods/shared/types/domain";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { AccountInfo } from "./AccountInfo";
import { AppSettings } from "./AppSettings";
import { ENSSection } from "./ENSSection";
import { GardensList } from "./GardensList";
import { InstallCta } from "./InstallCta";

export const ProfileAccount: React.FC = () => {
  const primaryAddress = usePrimaryAddress() as Address | undefined;

  return (
    <>
      <InstallCta />
      <AppSettings />
      <GardensList primaryAddress={primaryAddress} />
      <ENSSection primaryAddress={primaryAddress} />
      <AccountInfo />
    </>
  );
};
