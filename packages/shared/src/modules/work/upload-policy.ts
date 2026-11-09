import type { Address, WorkUploadConsent } from "../../types/domain";

export const WORK_UPLOAD_POLICY_VERSION = "2026-11-05";

export class UploadPolicyRequiredError extends Error {
  constructor() {
    super("upload-policy-required");
    this.name = "UploadPolicyRequiredError";
  }
}

export class UploadPolicyCancelledError extends Error {
  constructor() {
    super("User cancelled upload");
    this.name = "UploadPolicyCancelledError";
  }
}

export function assertWorkUploadConsent(
  consent: WorkUploadConsent | undefined,
  uploader?: Address
): asserts consent is WorkUploadConsent {
  if (
    !consent ||
    consent.policyVersion !== WORK_UPLOAD_POLICY_VERSION ||
    consent.permissionsConfirmed !== true ||
    typeof consent.uploaderAddress !== "string" ||
    typeof consent.termsAcceptedAt !== "string" ||
    !/^0x[0-9a-f]{40}$/i.test(consent.uploaderAddress) ||
    (uploader && consent.uploaderAddress.toLowerCase() !== uploader.toLowerCase()) ||
    !Number.isFinite(Date.parse(consent.termsAcceptedAt)) ||
    (consent.publicSharingAcceptedAt !== undefined &&
      (typeof consent.publicSharingAcceptedAt !== "string" ||
        !Number.isFinite(Date.parse(consent.publicSharingAcceptedAt)))) ||
    !["en", "es", "pt"].includes(consent.locale)
  )
    throw new UploadPolicyRequiredError();
}
