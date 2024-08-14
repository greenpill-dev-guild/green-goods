import { createContext, useContext } from "react";
import { ApolloError, useQuery } from "@apollo/client";

import { mockCampaigns } from "@/lib/mockData";

import { campaignsQuery } from "@/modules/apollo";

export interface CampaignsDataProps {
  campaigns: Campaign[];
  campaignMap: Record<string, Campaign>;
  fetchCampaigns: () => void;
  loading?: boolean;
  campaignsError?: ApolloError;
}

const CampaignsContext = createContext<CampaignsDataProps | null>(null);

type Props = {
  children: React.ReactNode;
};

export const CampaignsProvider = ({ children }: Props) => {
  const currentValue = useContext(CampaignsContext);

  if (currentValue) throw new Error("Campaign/Provider can only be used once");

  const { data, loading, error, refetch } = useQuery<any[]>(campaignsQuery, {});

  const campaignMap: Record<string, Campaign> = {};

  const campaigns = data
    ? data?.map((data) => {
        console.log(data);

        campaignMap[data.id] = data;

        return {
          id: data.id,
          hypercertID: data.hypercertID,
          title: data.title,
          description: data.description,
          banner: data.banner,
          logo: data.logo,
          details: data.details,
          start_date: data.start_date,
          end_date: data.end_date,
          creator: data.creator,
          team: data.team,
          capitals: data.capitals,
          created_at: data.created_at,
        };
      })
    : mockCampaigns.map((data) => {
        campaignMap[data.id] = data;

        return data;
      });

  return (
    <CampaignsContext.Provider
      value={{
        campaigns,
        campaignMap,
        loading,
        campaignsError: error,
        fetchCampaigns: refetch,
      }}
    >
      {children}
    </CampaignsContext.Provider>
  );
};

export const useCampaigns = () => {
  const value = useContext(CampaignsContext);
  if (!value) throw new Error("Must be used within a CampaignsProvider");
  return value;
};
