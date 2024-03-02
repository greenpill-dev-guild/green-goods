import { useMachine } from "@xstate/react";
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";

export const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26

import { ContributionContext, contributionMachine } from "./machine";
import { useNavigate } from "react-router-dom";
// import { FileUpload } from "@/modules/nftStorage";
import { useWeb3 } from "../providers/web3";

export interface ContributionDataProps extends ContributionContext {
  isIdle: boolean;
  isDetails: boolean;
  isCampaign: boolean;
  isReview: boolean;
  isUploading: boolean;
  isAttesting: boolean;
  isAttested: boolean;
  contribute: () => void;
  setDetails: (details: { title: string; description: string }) => void;
  setCampaign: (campaign: string) => void;
  attestContribution: () => void;
  back: () => void;
  cancel: () => void;
  goHome: () => void;
  contributeMore: () => void;
}

export const useContribution = (): ContributionDataProps => {
  const { ethersProvider } = useWeb3();
  const navigate = useNavigate();

  const [state, send] = useMachine(contributionMachine, {
    actions: {
      goHome: () => {
        // Refetch contributions
        navigate("home");
      },
    },
    services: {
      contributionAttester: async (context, event) => {
        console.log("Contribution attestation started!", context, event);

        const { campaign, title, description, capitals, value } = context.info;
        const { data } = event;

        try {
          const signer = ethersProvider?.getSigner();

          if (!signer) {
            throw new Error("No signer found!");
          }

          const eas = new EAS(EASContractAddress);

          // @ts-ignore
          eas.connect(signer);

          // Initialize SchemaEncoder with the schema string
          const schemaEncoder = new SchemaEncoder(
            "uint256 value, address campaign, string title, string description, string[] media, string[] capitals"
          );

          const encodedData = schemaEncoder.encodeData([
            { name: "value", value: value, type: "uint256" },
            { name: "campaign", value: campaign, type: "address" },
            { name: "title", value: title ?? "", type: "string" },
            {
              name: "description",
              value: description ?? "",
              type: "string",
            },
            { name: "media", value: data.urls, type: "string[]" },
            {
              name: "capitals",
              value: capitals,
              type: "string[]",
            },
          ]);

          const schemaUID = ""; // TODO: Get the schema UID from the registry

          const tx = await eas.attest({
            schema: schemaUID,
            data: {
              recipient: "",
              revocable: true, // Be aware that if your schema is not revocable, this MUST be false
              data: encodedData,
            },
          });

          const newAttestationUID = await tx.wait();

          console.log("New attestation UID:", newAttestationUID);
          return { id: newAttestationUID };
        } catch (error) {
          console.log("Contribution attestation failed!", error);
          throw error;
        }
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

  function setCampaign(campaign: string) {
    if (state.matches("campaign")) {
      send({ type: "NEXT", campaign });
    }
  }

  function back() {
    if (state.matches("campaign") || state.matches("review")) {
      send("BACK");
    }
  }

  function cancel() {
    if (
      state.matches("details") ||
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
    isIdle: state.matches("idle"),
    isDetails: state.matches("details"),
    isCampaign: state.matches("campaign"),
    isReview: state.matches("review"),
    isAttested: state.matches("contribution_attested"),
    isAttesting: state.matches("attesting_contribution"),
    isUploading: state.matches("uploading_media"),
    ...state.context,
    contribute,
    setDetails,
    setCampaign,
    attestContribution,
    back,
    cancel,
    goHome,
    contributeMore,
  };
};
