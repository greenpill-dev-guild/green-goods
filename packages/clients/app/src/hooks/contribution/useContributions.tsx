import { createContext, useContext } from "react";
import { ApolloError, useQuery } from "@apollo/client";

import { useWeb3 } from "../providers/web3";
import {
  attestationClient,
  userConfirmationsQuery,
  userContributionsQuery,
} from "@/modules/apollo";

export interface ContributionsDataProps {
  contributions: Contribution[];
  contributionMap: Record<string, Contribution>;
  confirmationMap: Record<string, Confirmation>;
  contributionsError?: ApolloError;
  confirmationsError?: ApolloError;
}

const ContributionsContext = createContext<ContributionsDataProps | null>(null);

type Props = {
  children: React.ReactNode;
};

export const ContributionsProvider = ({ children }: Props) => {
  const currentValue = useContext(ContributionsContext);

  if (currentValue)
    throw new Error("Contribution/Provider can only be used once");

  const { address } = useWeb3();

  const { data: contributionData } = useQuery<any[]>(userContributionsQuery, {
    client: attestationClient,
    variables: {
      where: {
        attester: {
          equals: address,
        },
      },
    },
  });

  const { data: confirmationData } = useQuery<any[]>(userConfirmationsQuery, {
    client: attestationClient,
    variables: {
      where: {
        recipient: {
          equals: address,
        },
      },
    },
  });

  const contributionMap: Record<string, Contribution> = {};
  const confirmationMap: Record<string, Confirmation> = {};

  console.log("confirmationData", confirmationData);
  console.log("contributionData", contributionData);

  return (
    <ContributionsContext.Provider
      value={{
        contributions: [],
        contributionMap,
        confirmationMap,
      }}
    >
      {children}
    </ContributionsContext.Provider>
  );
};

export const useContributions = () => {
  const value = useContext(ContributionsContext);
  if (!value) throw new Error("Must be used within a ContributionsProvider");
  return value;
};
