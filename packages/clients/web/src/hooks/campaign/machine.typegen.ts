// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  "@@xstate/typegen": true;
  internalEvents: {
    "done.invoke.campaignCreator": {
      type: "done.invoke.campaignCreator";
      data: unknown;
      __tip: "See the XState TS docs to learn how to strongly type this.";
    };
    "done.invoke.mediaUploader": {
      type: "done.invoke.mediaUploader";
      data: unknown;
      __tip: "See the XState TS docs to learn how to strongly type this.";
    };
    "error.platform.campaignCreator": {
      type: "error.platform.campaignCreator";
      data: unknown;
    };
    "error.platform.mediaUploader": {
      type: "error.platform.mediaUploader";
      data: unknown;
    };
    "xstate.init": { type: "xstate.init" };
  };
  invokeSrcNameMap: {
    campaignCreator: "done.invoke.campaignCreator";
    mediaUploader: "done.invoke.mediaUploader";
  };
  missingImplementations: {
    actions: "campaignCreated" | "goHome" | "goToCampaign";
    delays: never;
    guards: never;
    services: "campaignCreator";
  };
  eventsCausingActions: {
    campaignCreated: "done.invoke.campaignCreator";
    error: "error.platform.campaignCreator" | "error.platform.mediaUploader";
    goHome: "CANCEL" | "GO_HOME";
    goToCampaign: "VIEW_CAMPAIGN";
    reset: "CANCEL" | "CREATE_ANOTHER" | "GO_HOME" | "VIEW_CAMPAIGN";
  };
  eventsCausingDelays: {};
  eventsCausingGuards: {
    areDetailsValid: "NEXT";
  };
  eventsCausingServices: {
    campaignCreator: "done.invoke.mediaUploader";
    mediaUploader: "CREATE";
  };
  matchesStates:
    | "campaign_created"
    | "creating_campaign"
    | "details"
    | "idle"
    | "review"
    | "uploading_media";
  tags: never;
}
