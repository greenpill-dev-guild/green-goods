import { useWeb3 } from "../providers/web3";

interface ContributionDataProps {
  loading?: boolean;
  error?: string | null;
}

export const useContribution = (): ContributionDataProps => {
  const { address, user } = useWeb3();

  return {
    loading: false,
    error: null,
  };
};
