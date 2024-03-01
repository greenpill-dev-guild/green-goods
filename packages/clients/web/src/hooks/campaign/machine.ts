// import { toast } from "react-toastify";
import { createMachine, assign } from "xstate";

export interface CampaignContext {
  title: string | null;
  description: string | null;
  details: string | null;
  start_date: number | null;
  end_date: number | null;
  team: string[];
  capitals: Capital[];
  media: File[];
  error: string | null;
}

export const campaignMachine = createMachine(
  {
    id: "campaign",
    description:
      "Campaign machine for creating Greenpill campaigns focused on a problem.",
    strict: true,
    tsTypes: {} as import("./machine.typegen").Typegen0,
    predictableActionArguments: true,
    initial: "idle",
    schema: {
      services: {} as {
        mediaUploader: {
          data: {
            plantId: number;
            // details: PlantDetails | undefined;
            img: string;
          };
        };
        campaignCreator: {
          data: {
            element: any;
            img: string;
          };
        };
      },
      context: {
        title: null,
        description: null,
        details: null,
        start_date: null,
        end_date: null,
        team: [],
        capitals: [],
        media: [],
        error: null,
      } as CampaignContext,
    },
    states: {
      idle: {
        on: {
          CREATE_CAMPAIGN: {
            target: "details",
            // cond: "areDetailsValid",
          },
        },
      },
      details: {
        on: {
          NEXT: {
            target: "media",
          },
          CANCEL: {
            target: "idle",
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
      media: {
        on: {
          NEXT: {
            target: "media",
          },
          BACK: {
            target: "details",
          },
          CANCEL: {
            target: "idle",
          },
        },
      },
      review: {
        on: {
          CREATE: {
            target: "uploading_media",
          },
          BACK: {
            target: "media",
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
            target: "creating_campaign",
            actions: "verified",
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
            actions: "campaigned",
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
            actions: "reset",
          },
          GO_HOME: {
            target: "idle",
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
    // exit: (context, event) => {
    //   console.log("Campaign machine exited.", context, event);
    // },
  },
  {
    delays: {
      LIGHT_DELAY: (_context, _event) => {
        return true;
      },
    },
    guards: {
      areDetailsValid: (_context, event: { image: string | ArrayBuffer }) => {
        return !!event.image;
      },
      isTeamValid: (context, event: { element: any }) => {
        return !!context.image && (!!event.element || !!context.element);
      },
      isMediaValid: (context) => {
        return !context.creature && !!context.element;
      },
    },
    actions: {
      reset: assign((context, _event) => {
        context.address = undefined;
        context.image = null;
        // context.element = null;
        // context.plant = null;
        // context.creature = null;
        context.imageVerified = false;
        context.error = null;

        return context;
      }),
      error: assign((context, event) => {
        switch (event.type) {
          case "error.platform.mediaUploader":
            context.imageVerified = false;
            // context.image = null;
            // context.element = null;

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

        // toast.error(context.error || "Error with creature generator.");

        return context;
      }),
    },
    services: {
      mediaUploader: async (context, event: { image?: string }, _meta) => {
        let image: string | null = context.image;

        if (event.image) {
          image = event.image;
        }

        if (!image) {
          throw new Error("No image provided!");
        }

        // TODO: Add form image upload
        // const formData = new FormData();

        // formData.append("image", image, image.name);

        // const data = {
        //   // Add other parameters here
        // };
        // formData.append("data", JSON.stringify(data));

        try {
          // const { data } = await apiClient.post<{ plant: PlantResponse }>(
          //   "/plants/detect",
          //   { image },
          // );

          return {
            // plantId: data.plant.suggestions[0].id,
            // details: data.plant.suggestions[0].plant_details,
            img: image,
          };
        } catch (error) {
          console.log("Photo verification failed!", error);
          throw error;
        }
      },
      campaignCreator: async (context, event: { element?: any }) => {
        let element: any | null = context.element;

        if (event.element) {
          element = event.element;
          // context.element = event.element;
        }

        if (!element || !context.plant) {
          throw new Error("No element or plant provided!");
        }

        try {
          return { element, img: `data:image/png;base64,${data.img}` };
        } catch (error) {
          console.log("Creature generation failed!", error);
          throw error;
        }
      },
    },
  },
);
