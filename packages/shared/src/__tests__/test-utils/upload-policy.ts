import type { Address, WorkUploadConsent } from "../../types/domain";
import { WORK_UPLOAD_POLICY_VERSION } from "../../modules/work/upload-policy";

export function uploadConsent(
  uploaderAddress: Address = "0x1111111111111111111111111111111111111111"
): WorkUploadConsent {
  return {
    policyVersion: WORK_UPLOAD_POLICY_VERSION,
    uploaderAddress,
    termsAcceptedAt: "2026-11-05T00:00:00.000Z",
    publicSharingAcceptedAt: "2026-11-05T00:01:00.000Z",
    locale: "en",
    permissionsConfirmed: true,
  };
}
