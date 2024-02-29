import { contractClient } from "../../modules/apollo";

import { useQuery } from "@apollo/client";

export const useCampaigns = () => {
  const { data, loading, error } = useQuery(CAMPAIGNS, {
    client: contractClient,
  });

  return {
    campaigns: data?.campaigns,
    loading,
    error,
  };
};
