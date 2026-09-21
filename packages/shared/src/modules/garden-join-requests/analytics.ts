import { track } from "../app/posthog";

export interface GardenJoinRequestFailure {
  operation: "create" | "read_self" | "withdraw" | "list" | "resolve";
  /** HTTP status when the service answered; absent when it could not be reached. */
  status?: number;
  errorCode?: string;
  /** The error's class name when the failure happened before the service was called. */
  errorName?: string;
}

/** Records a join-request call the person saw fail, without the account, name, or note. */
export function trackGardenJoinRequestFailed(failure: GardenJoinRequestFailure): void {
  track(
    "garden_join_request_failed",
    {
      operation: failure.operation,
      status: failure.status,
      error_code: failure.errorCode,
      error_name: failure.errorName,
    },
    { anonymizeIdentity: true, includeSessionId: false }
  );
}
