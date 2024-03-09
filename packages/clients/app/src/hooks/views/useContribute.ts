import {
  useMakeContribution,
  MakeContributionDataProps,
} from "../contribution/useMakeContribution";
import { useCampaigns } from "../campaign/useCampaigns";

export interface ContributeDataProps extends MakeContributionDataProps {
  campaigns: Campaign[];
}

export const useContribute = (): ContributeDataProps => {
  const contribution = useMakeContribution();
  const { campaigns } = useCampaigns();

  return {
    campaigns,
    ...contribution,
  };
};
