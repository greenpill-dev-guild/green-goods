import { useContributions } from "./useContributions";

export const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26

interface ContributionDataProps extends Contribution {}

export const useContribution = (id: string): ContributionDataProps => {
  const { confirmationMap, contributionMap } = useContributions();

  const confirmation = confirmationMap[id];
  const contribution = contributionMap[id];

  return {
    ...contribution,
    status: confirmation
      ? confirmation.approval
        ? "approved"
        : "rejected"
      : "pending",
  };
};
