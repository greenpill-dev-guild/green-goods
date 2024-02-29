// This file was automatically generated. Edits will be overwritten

export interface Typegen0 {
  "@@xstate/typegen": true;
  internalEvents: {
    "done.invoke.mediaUploader": {
      type: "done.invoke.mediaUploader";
      data: unknown;
      __tip: "See the XState TS docs to learn how to strongly type this.";
    };
    "done.invoke.workAttester": {
      type: "done.invoke.workAttester";
      data: unknown;
      __tip: "See the XState TS docs to learn how to strongly type this.";
    };
    "error.platform.mediaUploader": {
      type: "error.platform.mediaUploader";
      data: unknown;
    };
    "error.platform.workAttester": {
      type: "error.platform.workAttester";
      data: unknown;
    };
    "xstate.init": { type: "xstate.init" };
  };
  invokeSrcNameMap: {
    mediaUploader: "done.invoke.mediaUploader";
    workAttester: "done.invoke.workAttester";
  };
  missingImplementations: {
    actions: "verified" | "worked";
    delays: never;
    guards: never;
    services: never;
  };
  eventsCausingActions: {
    error: "error.platform.mediaUploader" | "error.platform.workAttester";
    reset: "VIEW_WORK";
    verified: "done.invoke.mediaUploader";
    worked: "done.invoke.workAttester";
  };
  eventsCausingDelays: {};
  eventsCausingGuards: {};
  eventsCausingServices: {
    mediaUploader: "CREATE";
    workAttester: "done.invoke.mediaUploader";
  };
  matchesStates:
    | "attesting_work"
    | "details"
    | "idle"
    | "media"
    | "review"
    | "uploading_media"
    | "work_attested";
  tags: never;
}
