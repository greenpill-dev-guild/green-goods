import {
  userConfirmationsQuery,
  userContributionsQuery,
} from "@/modules/apollo";
import { useQuery } from "@apollo/client";

export interface HomeDataProps {
  contributions: Contribution[];
  confirmationMap: Record<string, Confirmation>;
}

export const useHome = (): HomeDataProps => {
  const { data: contributionData } = useQuery<any[]>(userContributionsQuery);
  const { data: confirmationData } = useQuery<any[]>(userConfirmationsQuery);

  const contributions =
    contributionData?.map((contribution) => contribution) || [];

  const confirmationMap: Record<string, Confirmation> = {};

  confirmationData?.forEach((confirmation) => {
    confirmationMap[confirmation.id] = confirmation;
  });

  return {
    contributions,
    confirmationMap,
  };
};
