import { type Address, useAuth } from "@green-goods/shared";
import { AccountInfo } from "./AccountInfo";
import { AppSettings } from "./AppSettings";
import { ENSSection } from "./ENSSection";
import { GardensList } from "./GardensList";
import { InstallCta } from "./InstallCta";

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
