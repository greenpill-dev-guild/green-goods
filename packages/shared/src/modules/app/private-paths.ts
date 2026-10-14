/**
 * Chat continuation links carry an opaque locator in their path. Analytics and error reports keep
 * the route and drop the locator, so a link can never be rebuilt from telemetry. The ceremony pages
 * also show pairing codes, accounts and report text, so recordings are not taken there at all.
 */
const REPORTING_LOCATOR = /(\/agent\/reporting\/(?:recover\/)?)[A-Za-z0-9_-]{16,}/g;
const REPORTING_PAGE = /^\/agent\/reporting\/(?!permissions\/?$)./;

export function redactPrivatePaths(value: string): string {
  return value.replace(REPORTING_LOCATOR, "$1:requestId");
}

/** True on a publish, review or recovery page; the static permissions page carries no data. */
export function isReportingCeremonyPath(pathname: string): boolean {
  return REPORTING_PAGE.test(pathname);
}
