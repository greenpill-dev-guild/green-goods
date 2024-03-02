import { useQuery } from "@apollo/client";

import {
  attestationClient,
  campaignConfirmationsQuery,
  campaignContributionsQuery,
} from "@/modules/apollo";

import { useWeb3 } from "../providers/web3";
import { useCampaigns } from "./useCampaigns";

export const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26

interface CampaignDataProps extends Campaign {
  address: string | null;
  loading: boolean;
  isOwner: boolean;
  contributions: Contribution[];
  confirmations: Confirmation[];
}

export const useCampaign = (account: string): CampaignDataProps => {
  const { address } = useWeb3();
  const { campaignMap } = useCampaigns();

  const campaign = campaignMap[account];

  const { data: contributions, loading: loadingContributions } = useQuery<
    any[]
  >(campaignContributionsQuery, {
    variables: {
      where: {
        recipient: {
          equals: account,
        },
      },
      schemaId: {
        equals: "contribution",
      },
    },
    client: attestationClient,
  });

  const { data: confirmations, loading: loadingConfirmations } = useQuery<
    any[]
  >(campaignConfirmationsQuery, {
    variables: {
      where: {
        decodedDataJson: {
          contains: account,
        },
      },
      schemaId: {
        equals: "confirmation",
      },
    },
    client: attestationClient,
  });

  return {
    id: campaign?.id ?? "",
    title: campaign?.title ?? "",
    description: campaign?.description ?? "",
    creator: campaign?.creator ?? "",
    capitals: campaign?.capitals ?? [],
    team: campaign?.team ?? [],
    banner: campaign?.banner ?? "",
    logo: campaign?.logo ?? "",
    created_at: campaign?.created_at ?? "",
    details: campaign?.details ?? "",
    hypercertID: campaign?.hypercertID ?? 0,
    end_date: campaign?.end_date ?? "",
    start_date: campaign?.start_date ?? "",
    isOwner: address === campaign?.creator,
    confirmations: confirmations?.length
      ? confirmations?.map((confirmation) => {
          return confirmation;
        })
      : [],
    contributions: contributions?.length
      ? contributions?.map((contribution) => {
          return contribution;
        })
      : [],
    address,
    loading: loadingContributions || loadingConfirmations,
  };
};
