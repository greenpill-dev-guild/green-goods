import { createContext, useContext } from "react";
import { ApolloError, useQuery } from "@apollo/client";

import { campaignsQuery } from "@/modules/apollo";

import { useWeb3 } from "../providers/web3";

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

  const { address } = useWeb3();

  const { data, loading, error, refetch } = useQuery<any[]>(campaignsQuery, {
    variables: {
      where: {
        creator: {
          equals: address,
        },
      },
    },
  });

  const campaignMap: Record<string, Campaign> = {};

  return (
    <CampaignsContext.Provider
      value={{
        campaigns:
          data?.map((data) => {
            campaignMap[data.id] = data;

            return data;
          }) ?? [],
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
