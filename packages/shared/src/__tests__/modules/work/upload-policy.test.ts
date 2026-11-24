import { describe, it, expect } from "vitest";
import type { WorkUploadConsent } from "../../../types/domain";
import {
  assertWorkUploadConsent,
  WORK_UPLOAD_POLICY_VERSION,
} from "../../../modules/work/upload-policy";

const receipt: WorkUploadConsent = {
  policyVersion: WORK_UPLOAD_POLICY_VERSION,
  uploaderAddress: "0x1111111111111111111111111111111111111111",
  termsAcceptedAt: "2026-11-05T00:00:00Z",
  publicSharingAcceptedAt: "2026-11-05T00:01:00Z",
  locale: "en",
  permissionsConfirmed: true,
};
describe("public work upload consent", () => {
  it("accepts the current policy receipt for its uploader", () =>
    expect(() => assertWorkUploadConsent(receipt, receipt.uploaderAddress)).not.toThrow());
  it("refuses missing consent before any upload", () =>
    expect(() => assertWorkUploadConsent(undefined)).toThrow("upload-policy-required"));
  it("refuses consent belonging to a different account", () =>
    expect(() =>
      assertWorkUploadConsent(receipt, "0x2222222222222222222222222222222222222222")
    ).toThrow("upload-policy-required"));
  it.each([
    { policyVersion: "old" },
    { permissionsConfirmed: false },
    { termsAcceptedAt: "invalid" },
    { publicSharingAcceptedAt: "invalid" },
  ])("refuses a stale or incomplete acknowledgement: %j", (patch) =>
    expect(() => assertWorkUploadConsent({ ...receipt, ...patch } as WorkUploadConsent)).toThrow(
      "upload-policy-required"
    ));
});
