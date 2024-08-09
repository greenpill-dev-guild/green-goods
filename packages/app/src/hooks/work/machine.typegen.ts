// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  "@@xstate/typegen": true;
  internalEvents: {
    "done.invoke.contributionAttester": {
      type: "done.invoke.contributionAttester";
      data: unknown;
      __tip: "See the XState TS docs to learn how to strongly type this.";
    };
    "done.invoke.mediaUploader": {
      type: "done.invoke.mediaUploader";
      data: unknown;
      __tip: "See the XState TS docs to learn how to strongly type this.";
    };
    "error.platform.contributionAttester": {
      type: "error.platform.contributionAttester";
      data: unknown;
    };
    "error.platform.mediaUploader": {
      type: "error.platform.mediaUploader";
      data: unknown;
    };
    "xstate.init": { type: "xstate.init" };
  };
  invokeSrcNameMap: {
    contributionAttester: "done.invoke.contributionAttester";
    mediaUploader: "done.invoke.mediaUploader";
  };
  missingImplementations: {
    actions: "goHome";
    delays: never;
    guards: never;
    services: "contributionAttester";
  };
  eventsCausingActions: {
    contributed: "done.invoke.contributionAttester";
    error:
      | "error.platform.contributionAttester"
      | "error.platform.mediaUploader";
    goHome: "GO_HOME";
    reset: "CANCEL" | "CONTRIBUTE_MORE" | "GO_HOME";
    saveCampaign: "NEXT";
    saveDetails: "NEXT";
  };
  eventsCausingDelays: {};
  eventsCausingGuards: {
    areDetailsValid: "NEXT";
    isCampaignValid: "NEXT";
  };
  eventsCausingServices: {
    contributionAttester: "done.invoke.mediaUploader";
    mediaUploader: "ATTEST";
  };
  matchesStates:
    | "attesting_contribution"
    | "campaign"
    | "contribution_attested"
    | "details"
    | "idle"
    | "review"
    | "uploading_media";
  tags: never;
}
