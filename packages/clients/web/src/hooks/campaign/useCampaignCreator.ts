import { assign } from "xstate";
import { useMachine } from "@xstate/react";
import { useNavigate } from "react-router-dom";

import { useWeb3 } from "../providers/web3";
import { CampaignContext, CampaignInfo, campaignMachine } from "./machine";

export interface CampaignCreationDataProps extends CampaignContext {
  isIdle: boolean;
  isDetails: boolean;
  isReview: boolean;
  isUploading: boolean;
  isCreating: boolean;
  isCreated: boolean;
  confirmDetails: (campaign: CampaignInfo) => void;
  createCampaign: () => void;
  back: () => void;
  cancel: () => void;
  goHome: () => void;
  createAnotherCampaign: () => void;
}

export const useCampaignCreator = (): CampaignCreationDataProps => {
  const navigate = useNavigate();
  const { ethersProvider } = useWeb3();

  const [state, send] = useMachine(campaignMachine, {
    actions: {
      campaignCreated: assign((context, event) => {
        return {
          ...context,
          account: event.data.account,
          hypercertTokenID: event.data.hypercertTokenID,
        };
      }),
      goToCampaign: (context) => {
        navigate(`/campaigns/${context.results.account}`);
        // Riute wikk fetch campaign data
      },
      goHome: () => {
        // Refetch campaigns
        navigate("home");
      },
    },
    services: {
      campaignCreator: async (_context, _event) => {
        // const mediaUrls = event.data.urls;

        // TODO: Using provider get signer and make rpc call to deploy campaign

        try {
          const signer = await ethersProvider?.getSigner();

          if (!signer) {
            throw new Error("Signer not found");
          }

          return {
            account: "0x1234",
            hypercertTokenID: 1234,
          };
        } catch (error) {
          console.log("Creature generation failed!", error);
          throw error;
        }
      },
    },
  });

  function confirmDetails(campaign: CampaignInfo) {
    send({ type: "NEXT", campaign });
  }

  function createCampaign() {
    send("CREATE_CAMPAIGN");
  }

  function back() {
    if (state.matches("review")) {
      send("BACK");
    }
  }

  function cancel() {
    if (state.matches("details") || state.matches("review")) {
      send("CANCEL");
    }
  }

  function goHome() {
    if (state.matches("campaign_created")) {
      send("GO_HOME");
    }
  }

  function createAnotherCampaign() {
    if (state.matches("campaign_created")) {
      send("CREATE_ANOTHER");
    }
  }

  return {
    ...state.context,
    isIdle: state.matches("idle"),
    isDetails: state.matches("details"),
    isReview: state.matches("review"),
    isUploading: state.matches("uploading_media"),
    isCreating: state.matches("creating_campaign"),
    isCreated: state.matches("campaign_created"),
    confirmDetails,
    createCampaign,
    back,
    cancel,
    goHome,
    createAnotherCampaign,
  };
};
