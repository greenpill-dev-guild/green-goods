import { useMachine } from "@xstate/react";

// import { useWeb3 } from "../providers/web3";
import { ContributionContext, contributionMachine } from "./machine";
import { useNavigate } from "react-router-dom";
import { FileUpload } from "@/modules/nftStorage";

export interface ContributionDataProps extends ContributionContext {
  contribute: () => void;
  setDetails: (details: { title: string; description: string }) => void;
  setMedia: (media: FileUpload[]) => void;
  setCampaign: (campaign: string) => void;
  attestContribution: () => void;
  back: () => void;
  cancel: () => void;
  goHome: () => void;
  contributeMore: () => void;
}

export const useContribution = (): ContributionDataProps => {
  // const { address, user, provider } = useWeb3();
  const navigate = useNavigate();

  const [state, send] = useMachine(contributionMachine, {
    actions: {
      goHome: () => {
        // Refetch contributions
        navigate("home");
      },
    },
  });

  function contribute() {
    send("ATTEST_WORK");
  }

  function setDetails(details: { title: string; description: string }) {
    if (state.matches("details")) {
      send({ type: "NEXT", details });
    }
  }

  function setMedia(media: FileUpload[]) {
    if (state.matches("media")) {
      send({ type: "NEXT", media });
    }
  }

  function setCampaign(campaign: string) {
    if (state.matches("campaign")) {
      send({ type: "NEXT", campaign });
    }
  }

  function back() {
    if (
      state.matches("media") ||
      state.matches("campaign") ||
      state.matches("review")
    ) {
      send("BACK");
    }
  }

  function cancel() {
    if (
      state.matches("details") ||
      state.matches("media") ||
      state.matches("campaign") ||
      state.matches("review")
    ) {
      send("CANCEL");
    }
  }

  function attestContribution() {
    if (state.matches("review")) {
      send("ATTEST");
    }
  }

  function goHome() {
    if (state.matches("contribution_attested")) {
      send("GO_HOME");
    }
  }

  function contributeMore() {
    if (state.matches("contribution_attested")) {
      send("CONTRIBUTE_MORE");
    }
  }

  return {
    ...state.context,
    contribute,
    setDetails,
    setMedia,
    setCampaign,
    attestContribution,
    back,
    cancel,
    goHome,
    contributeMore,
  };
};
