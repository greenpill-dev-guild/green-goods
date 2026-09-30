import { track } from "../app/posthog";

export interface GardenJoinRequestFailure {
  operation: "create" | "read_self" | "withdraw" | "list" | "resolve";
  /** HTTP status when the service answered; absent when it could not be reached. */
  status?: number;
  errorCode?: string;
  /** The error's class name when the failure happened before the service was called. */
  errorName?: string;
}

/**
 * An error's class name ends in `Error` or `Exception` (`TypeError`,
 * `ConnectorNotConnectedError`, `DOMException`). `name` is writable, so a name in any other
 * shape is not a class name and could carry anything: it is recorded as `unknown`.
 */
function recordableErrorName(name: string | undefined): string | undefined {
  if (name === undefined) return undefined;
  return /^[A-Za-z]{0,40}(Error|Exception)$/.test(name) ? name : "unknown";
}

/** Records a join-request call the person saw fail, without the account, name, or note. */
export function trackGardenJoinRequestFailed(failure: GardenJoinRequestFailure): void {
  track(
    "garden_join_request_failed",
    {
      operation: failure.operation,
      status: failure.status,
      error_code: failure.errorCode,
      error_name: recordableErrorName(failure.errorName),
    },
    { anonymizeIdentity: true, includeSessionId: false }
  );
}
