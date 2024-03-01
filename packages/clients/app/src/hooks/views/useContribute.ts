import { useQuery } from "@apollo/client";
import {
  useContribution,
  ContributionDataProps,
} from "../contribution/useContribution";

export interface ContributeDataProps extends ContributionDataProps {}

export const useContribute = (): ContributeDataProps => {
  const contribution = useContribution();
  return {
    ...contribution,
  };
};
