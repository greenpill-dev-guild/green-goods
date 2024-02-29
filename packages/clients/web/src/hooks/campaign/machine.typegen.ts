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
    actions: "campaigned" | "verified";
    delays: never;
    guards: never;
    services: never;
  };
  eventsCausingActions: {
    campaigned: "done.invoke.campaignCreator";
    error: "error.platform.campaignCreator" | "error.platform.mediaUploader";
    reset: "VIEW_CAMPAIGN";
    verified: "done.invoke.mediaUploader";
  };
  eventsCausingDelays: {};
  eventsCausingGuards: {};
  eventsCausingServices: {
    campaignCreator: "done.invoke.mediaUploader";
    mediaUploader: "CREATE";
  };
  matchesStates:
    | "campaign_created"
    | "creating_campaign"
    | "details"
    | "idle"
    | "media"
    | "review"
    | "team"
    | "uploading_media";
  tags: never;
}
