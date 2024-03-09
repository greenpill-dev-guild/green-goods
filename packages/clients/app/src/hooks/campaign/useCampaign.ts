import { useCampaigns } from "../campaign/useCampaigns";

export const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26

interface CampaignDataProps extends Campaign {}

export const useCampaign = (id: string): CampaignDataProps => {
  const { campaignMap } = useCampaigns();

  const campaign: Campaign =
    campaignMap[id] !== undefined
      ? campaignMap[id]
      : {
          id: "",
          title: "",
          description: "",
          created_at: "",
          capitals: [],
          team: [],
          banner: "",
          creator: "",
          details: "",
          end_date: "",
          hypercertID: 0,
          logo: "",
          start_date: "",
        };

  return {
    ...campaign,
  };
};
