import {
  useCampaigns as useCampaignsDataHook,
  CampaignsDataProps as CampaignsProviderDataProps,
} from "../campaign/useCampaigns";

export interface CampaignsDataProps extends CampaignsProviderDataProps {}

export const useCampaigns = (): CampaignsDataProps => {
  const campaignsData = useCampaignsDataHook();

  return {
    ...campaignsData,
  };
};
