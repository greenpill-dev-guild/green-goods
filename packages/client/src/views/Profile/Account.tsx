import { useAuth, type Address } from "@green-goods/shared";
import { InstallCta } from "./InstallCta";
import { AppSettings } from "./AppSettings";
import { GardensList } from "./GardensList";
import { ENSSection } from "./ENSSection";
import { AccountInfo } from "./AccountInfo";

export const ProfileAccount: React.FC = () => {
  const { smartAccountAddress, walletAddress } = useAuth();
  const primaryAddress = (smartAccountAddress || walletAddress) as Address | undefined;

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
