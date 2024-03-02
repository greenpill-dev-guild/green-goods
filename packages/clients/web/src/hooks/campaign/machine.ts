// import { toast } from "sonner"
import { createMachine, assign } from "xstate";

import { FileUpload, uploadMedia } from "@/modules/nftStorage";

export interface CampaignInfo {
  title: string | null;
  description: string | null;
  details: string | null;
  start_date: number | null;
  end_date: number | null;
  team: string[];
  capitals: Capital[];
  media: FileUpload[];
}

export interface CampaignContext {
  error: string | null;
  info: CampaignInfo;
  results: {
    id: string | null;
    hypercertTokenID: number | null;
    account: string | null;
  };
}

export const campaignMachine = createMachine(
  {
    id: "campaign",
    description:
      "Campaign machine for creating Greenpill campaigns focused on a problem.",
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
        campaignCreator: {
          data: {
            account: string;
            hypercertTokenID: number;
          };
        };
      },
      context: {
        info: {
          title: null,
          description: null,
          details: null,
          start_date: null,
          end_date: null,
          team: [],
          capitals: [],
          media: [],
        },
        results: {
          id: null,
          hypercertTokenID: null,
          account: null,
        },
        error: null,
      } as CampaignContext,
    },
    states: {
      idle: {
        on: {
          START_CAMPAIGN: {
            target: "details",
          },
        },
      },
      details: {
        on: {
          NEXT: {
            target: "review",
            cond: "areDetailsValid",
          },
          CANCEL: {
            target: "idle",
            actions: ["goHome", "reset"],
          },
        },
      },
      // team: {
      //   on: {
      //     NEXT: {
      //       target: "media",
      //     },
      //     BACK: {
      //       target: "details",
      //     },
      //     CANCEL: {
      //       target: "idle",
      //     },
      //   },
      // },
      // media: {
      //   on: {
      //     NEXT: {
      //       target: "media",
      //     },
      //     BACK: {
      //       target: "details",
      //     },
      //     CANCEL: {
      //       target: "idle",
      //     },
      //   },
      // },
      review: {
        on: {
          CREATE: {
            target: "uploading_media",
          },
          BACK: {
            target: "review",
          },
          CANCEL: {
            target: "idle",
            actions: ["goHome", "reset"],
          },
        },
      },
      uploading_media: {
        invoke: {
          id: "mediaUploader",
          src: "mediaUploader",
          onDone: {
            target: "creating_campaign",
          },
          onError: {
            target: "review",
            actions: "error",
          },
        },
      },
      creating_campaign: {
        invoke: {
          id: "campaignCreator",
          src: "campaignCreator",
          onDone: {
            target: "campaign_created",
            actions: "campaignCreated",
          },
          onError: {
            target: "review",
            actions: "error",
          },
        },
      },
      campaign_created: {
        on: {
          VIEW_CAMPAIGN: {
            target: "idle",
            actions: ["goToCampaign", "reset"],
          },
          GO_HOME: {
            target: "idle",
            actions: ["goHome", "reset"],
          },
          CREATE_ANOTHER: {
            target: "details",
            actions: "reset",
          },
        },
      },
    },
    entry: async (context) => {
      // context.element = null;
      // context.creature = null;
      context.error = null;

      // toast.info("Campaign machine entered.");
    },
  },
  {
    delays: {
      LIGHT_DELAY: (_context, _event) => {
        return true;
      },
    },
    guards: {
      areDetailsValid: (_context) => {
        return true;
      },
    },
    actions: {
      reset: assign((context, _event) => {
        context.info.title = null;
        context.info.description = null;
        context.info.details = null;
        context.info.start_date = null;
        context.info.end_date = null;
        context.info.team = [];
        context.info.capitals = [];
        context.info.media = [];

        context.results.id = null;
        context.results.hypercertTokenID = null;
        context.results.account = null;

        context.error = null;

        return context;
      }),
      error: assign((context, event) => {
        switch (event.type) {
          case "error.platform.mediaUploader":
            // @ts-ignore
            context.error = event.data.message;
            break;

          case "error.platform.campaignCreator":
            // @ts-ignore
            context.error = event.data.message;
            break;

          default:
            break;
        }
        console.log("Error!", context, event);

        return context;
      }),
    },
    services: {
      mediaUploader: async (context, _meta) => {
        if (!context.info.media.length) {
          return {
            urls: [],
          };
        }

        try {
          const urls = await uploadMedia(context.info.media);

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
