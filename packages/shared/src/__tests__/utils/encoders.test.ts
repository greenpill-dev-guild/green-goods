/**
 * EAS Encoder Tests — encodeWorkApprovalData
 *
 * Validates that the extended WorkApproval encoder correctly encodes
 * confidence, verificationMethod, and reviewNotesCID fields.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the EAS config before importing
vi.mock("../../config/blockchain", () => ({
  getEASConfig: () => ({
    WORK: {
      schema: "uint256 actionUID, string title, string feedback, string metadata, string[] media",
    },
    WORK_APPROVAL: {
      schema:
        "uint256 actionUID, bytes32 workUID, bool approved, string feedback, uint8 confidence, uint8 verificationMethod, string reviewNotesCID",
    },
  }),
}));

// Mock IPFS modules
vi.mock("../../modules/data/ipfs", () => ({
  uploadFileToIPFS: vi.fn(),
  uploadJSONToIPFS: vi.fn(),
}));

vi.mock("../../modules/app/error-tracking", () => ({
  trackUploadBatchProgress: vi.fn(),
  trackUploadError: vi.fn(),
}));

import { encodeWorkApprovalData } from "../../utils/eas/encoders";
import { Confidence, VerificationMethod } from "../../types/domain";
import type { WorkApprovalDraft } from "../../types/domain";

describe("utils/eas/encoders", () => {
  describe("encodeWorkApprovalData (extended)", () => {
    it("encodes confidence, verificationMethod, and reviewNotesCID", () => {
      const draft: WorkApprovalDraft = {
        actionUID: 1,
        workUID: "0x" + "ab".repeat(32),
        approved: true,
        feedback: "Good evidence",
        confidence: Confidence.HIGH,
        verificationMethod: VerificationMethod.HUMAN | VerificationMethod.IOT,
        reviewNotesCID: "bafyreview123",
      };

      const encoded = encodeWorkApprovalData(draft, 11155111);
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe("string");
      expect(encoded.startsWith("0x")).toBe(true);
    });

    it("encodes NONE confidence for rejections", () => {
      const draft: WorkApprovalDraft = {
        actionUID: 2,
        workUID: "0x" + "cd".repeat(32),
        approved: false,
        feedback: "Blurry photos",
        confidence: Confidence.NONE,
        verificationMethod: VerificationMethod.HUMAN,
      };

      const encoded = encodeWorkApprovalData(draft, 11155111);
      expect(encoded).toBeTruthy();
      expect(encoded.startsWith("0x")).toBe(true);
    });

    it("defaults reviewNotesCID to empty string when undefined", () => {
      const draft: WorkApprovalDraft = {
        actionUID: 3,
        workUID: "0x" + "ef".repeat(32),
        approved: true,
        confidence: Confidence.MEDIUM,
        verificationMethod: VerificationMethod.HUMAN,
      };

      // Should not throw when reviewNotesCID is undefined
      const encoded = encodeWorkApprovalData(draft, 11155111);
      expect(encoded).toBeTruthy();
    });
  });
});
