import {
  EAS,
  SchemaEncoder,
  TransactionSigner,
} from "@ethereum-attestation-service/eas-sdk";
import { createMachine, assign } from "xstate";

import { uploadMedia } from "@/modules/nftStorage";

export const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26

export interface ContributionContext {
  value: number;
  campaign: string;
  title: string | null;
  description: string | null;
  media: { file: File; title: string; description: string }[];
  capitals: Capital[];
  signer: TransactionSigner | null;
  error: string | null;
}

export const contributionMachine = createMachine(
  {
    id: "contribution",
    description:
      "Contribution machine for providing data of contribution for campaign.",
    strict: true,
    tsTypes: {} as import("./machine.typegen").Typegen0,
    predictableActionArguments: true,
    initial: "details",
    schema: {
      services: {} as {
        mediaUploader: {
          data: {
            urls: string[];
          };
        };
        contributionAttester: {
          data: {
            id: string;
          };
        };
      },
      context: {
        value: 0,
        campaign: "",
        title: null,
        description: null,
        media: [],
        capitals: [],
        signer: null,
        error: null,
      } as ContributionContext,
    },
    states: {
      idle: {
        on: {
          ATTEST_WORK: {
            target: "details",
          },
        },
      },
      details: {
        on: {
          NEXT: {
            target: "media",
            cond: "areDetailsValid",
            actions: "saveDetails",
          },
          CANCEL: {
            target: "idle",
            actions: "reset",
          },
        },
      },
      media: {
        on: {
          NEXT: {
            target: "campaign",
            cond: "isMediaValid",
            actions: "saveMedia",
          },
          BACK: {
            target: "details",
          },
          CANCEL: {
            target: "idle",
            actions: "reset",
          },
        },
      },
      campaign: {
        on: {
          NEXT: {
            target: "review",
            cond: "isCampaignValid",
            actions: "saveCampaign",
          },
          BACK: {
            target: "media",
          },
          CANCEL: {
            target: "idle",
            actions: "reset",
          },
        },
      },
      review: {
        on: {
          ATTEST: {
            target: "uploading_media",
          },
          BACK: {
            target: "campaign",
          },
          CANCEL: {
            target: "idle",
          },
        },
      },
      uploading_media: {
        invoke: {
          id: "mediaUploader",
          src: "mediaUploader",
          onDone: {
            target: "attesting_contribution",
          },
          onError: {
            target: "review",
            actions: "error",
          },
        },
      },
      attesting_contribution: {
        invoke: {
          id: "contributionAttester",
          src: "contributionAttester",
          onDone: {
            target: "contribution_attested",
            actions: "contributed",
          },
          onError: {
            target: "review",
            actions: "error",
          },
        },
      },
      contribution_attested: {
        on: {
          GO_HOME: {
            target: "idle",
            actions: ["goHome", "reset"],
          },
          CONTRIBUTE_MORE: {
            target: "details",
            actions: "reset",
          },
        },
      },
    },
  },
  {
    delays: {
      LIGHT_DELAY: (_context, _event) => {
        return true;
      },
    },
    guards: {
      areDetailsValid: (_context, _event) => {
        return true;
      },
      isMediaValid: (_context) => {
        return true;
      },
      isCampaignValid: (_context) => {
        return true;
      },
    },
    actions: {
      saveDetails: assign((context, event) => {
        console.log("saveDetails", context, event);

        context.title = "";
        // context.description = event.description;

        return context;
      }),
      saveMedia: assign((context, event) => {
        console.log("saveMedia", context, event);

        context.title = "";
        // context.description = event.description;

        return context;
      }),
      saveCampaign: assign((context, event) => {
        console.log("saveCampaign", context, event);

        context.title = "";
        // context.description = event.description;

        return context;
      }),
      contributed: assign((context, event) => {
        console.log("contributed", context, event);

        return context;
      }),
      reset: assign((context, _event) => {
        context.value = 0;
        context.campaign = "";
        context.title = null;
        context.description = null;
        context.media = [];
        context.capitals = [];
        context.signer = null;
        context.error = null;

        return context;
      }),
      error: assign((context, event) => {
        switch (event.type) {
          case "error.platform.mediaUploader":
            // context.image = null;
            // context.element = null;

            // @ts-ignore
            context.error = event.data.message;
            break;

          case "error.platform.contributionAttester":
            // @ts-ignore
            context.error = event.data.message;
            break;

          default:
            break;
        }
        console.log("Error!", context, event);

        // toast.error(context.error || "Error with creature generator.");

        return context;
      }),
    },
    services: {
      mediaUploader: async (context, _meta) => {
        if (!context.media.length) {
          return {
            urls: [],
          };
        }

        try {
          const urls = await uploadMedia(context.media);

          return {
            urls,
          };
        } catch (error) {
          console.log("Media uploading failed!", error);
          throw error;
        }
      },
      contributionAttester: async (context, event) => {
        console.log("Contribution attestation started!", context, event);

        try {
          const { signer, campaign, title, description, capitals, value } =
            context;
          const { data } = event;

          if (!signer) {
            throw new Error("No signer found!");
          }

          const eas = new EAS(EASContractAddress);

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
  }
);
