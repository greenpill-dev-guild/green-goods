import { useCampaigns, CampaignsDataProps } from "../campaign/useCampaigns";

export interface HomeDataProps extends CampaignsDataProps {}

export const useHome = (): HomeDataProps => {
  const campaignsData = useCampaigns();

  return {
    ...campaignsData,
  };
};
