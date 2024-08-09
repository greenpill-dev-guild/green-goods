import { createMachine, assign } from "xstate";

import { uploadMedia } from "@/modules/nftStorage";

export const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26

export interface ContributionInfo {
  value: number;
  campaign: string;
  title: string | null;
  description: string | null;
  media: { file: File; title: string; description: string } | null;
  capitals: Capital[];
}

export interface ContributionContext {
  info: ContributionInfo;
  result: {
    id: string | null;
  };
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
        info: {
          value: 0,
          campaign: "",
          title: null,
          description: null,
          media: null,
          capitals: [],
        },
        result: {
          id: null,
        },
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
            target: "campaign",
            cond: "areDetailsValid",
            actions: "saveDetails",
          },
          CANCEL: {
            target: "idle",
            actions: "reset",
          },
        },
      },
      // media: {
      //   on: {
      //     NEXT: {
      //       target: "campaign",
      //       cond: "isMediaValid",
      //       actions: "saveMedia",
      //     },
      //     BACK: {
      //       target: "details",
      //     },
      //     CANCEL: {
      //       target: "idle",
      //       actions: "reset",
      //     },
      //   },
      // },
      campaign: {
        on: {
          NEXT: {
            target: "review",
            cond: "isCampaignValid",
            actions: "saveCampaign",
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
      isCampaignValid: (_context) => {
        return true;
      },
    },
    actions: {
      saveDetails: assign((context, event) => {
        console.log("saveDetails", context, event);

        return context;
      }),
      saveCampaign: assign((context, event) => {
        console.log("saveCampaign", context, event);

        return context;
      }),
      contributed: assign((context, event) => {
        console.log("contributed", context, event);

        return context;
      }),
      reset: assign((context, _event) => {
        context.info.value = 0;
        context.info.campaign = "";
        context.info.title = null;
        context.info.description = null;
        context.info.media = null;
        context.info.capitals = [];

        context.result.id = null;

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
        if (!context.info.media) {
          return {
            urls: [],
          };
        }

        try {
          const urls = await uploadMedia([context.info.media]);

          return {
            urls,
          };
        } catch (error) {
          console.log("Media uploading failed!", error);
          throw error;
        }
      },
    },
  }
);
