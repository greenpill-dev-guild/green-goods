import { useCampaigns } from "../campaign/useCampaigns";
import { useContributions } from "../work/useContributions";

export interface HomeDataProps {
  address?: string | null;
  campaigns: Campaign[];
  contributions: Contribution[];
  contributionMap: Record<string, Contribution>;
}

export const useHome = (): HomeDataProps => {
  const { campaigns } = useCampaigns();
  const { address, contributionMap, contributions } = useContributions();

  return {
    address,
    campaigns,
    contributions,
    contributionMap,
  };
};
