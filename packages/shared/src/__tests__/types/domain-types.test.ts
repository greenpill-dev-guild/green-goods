/**
 * Domain Type Generalization Tests
 *
 * Validates that generalized types have the correct shape
 * for the action domain upgrade (WorkSubmission, WorkMetadata v2,
 * ActionCard with domain/slug, extended WorkInput, WorkApprovalDraft).
 */

import { describe, expect, it } from "vitest";

import type {
  AssessmentAttachment,
  AssessmentDraft,
  GardenAssessment,
  SmartOutcome,
  WorkSubmission,
  WorkMetadata,
  WorkMetadataV1,
  ActionCard,
  WorkInput,
  WorkApprovalDraft,
} from "../../types/domain";

import { CynefinPhase, Domain, Confidence, VerificationMethod } from "../../types/domain";

describe("types/domain generalized types", () => {
  describe("GardenAssessment v2", () => {
    it("has schemaVersion set to assessment_v2", () => {
      const assessment: GardenAssessment = {
        id: "assessment-1",
        schemaVersion: "assessment_v2",
        authorAddress: "0xAuthor",
        gardenAddress: "0xGarden",
        title: "Q1 2026 Strategy",
        description: "Waste reduction strategy for riverbank area",
        diagnosis: "Riverbank accumulates 500kg waste monthly from upstream runoff",
        smartOutcomes: [
          { description: "Reduce waste by 50%", metric: "waste_removed_kg", target: 250 },
        ],
        cynefinPhase: CynefinPhase.COMPLICATED,
        domain: Domain.WASTE,
        selectedActionUIDs: ["action-1", "action-2"],
        reportingPeriod: { start: 1704067200, end: 1711929600 },
        sdgTargets: [6, 14, 15],
        attachments: [{ name: "baseline.pdf", cid: "bafy123", mimeType: "application/pdf" }],
        location: "Riverbank Park, Austin TX",
        createdAt: 1704067200,
      };

      expect(assessment.schemaVersion).toBe("assessment_v2");
      expect(assessment.diagnosis).toBe(
        "Riverbank accumulates 500kg waste monthly from upstream runoff"
      );
      expect(assessment.smartOutcomes).toHaveLength(1);
      expect(assessment.smartOutcomes[0].target).toBe(250);
      expect(assessment.cynefinPhase).toBe(CynefinPhase.COMPLICATED);
      expect(assessment.domain).toBe(Domain.WASTE);
      expect(assessment.selectedActionUIDs).toEqual(["action-1", "action-2"]);
      expect(assessment.reportingPeriod.start).toBe(1704067200);
      expect(assessment.reportingPeriod.end).toBe(1711929600);
      expect(assessment.sdgTargets).toEqual([6, 14, 15]);
      expect(assessment.attachments).toHaveLength(1);
    });

    it("supports multiple SMART outcomes", () => {
      const assessment: GardenAssessment = {
        id: "assessment-2",
        schemaVersion: "assessment_v2",
        authorAddress: "0xAuthor",
        gardenAddress: "0xGarden",
        title: "Solar Initiative",
        description: "Community solar installation",
        diagnosis: "Area lacks renewable energy access",
        smartOutcomes: [
          { description: "Install panels", metric: "panels_installed", target: 20 },
          { description: "Generate power", metric: "kwh_generated", target: 5000 },
          { description: "Train installers", metric: "people_trained", target: 10 },
        ],
        cynefinPhase: CynefinPhase.CLEAR,
        domain: Domain.SOLAR,
        selectedActionUIDs: ["solar-install", "solar-train"],
        reportingPeriod: { start: 1704067200, end: 1711929600 },
        sdgTargets: [7],
        attachments: [],
        location: "Community Center",
        createdAt: 1704067200,
      };

      expect(assessment.smartOutcomes).toHaveLength(3);
      expect(assessment.domain).toBe(Domain.SOLAR);
    });

    it("supports empty arrays for optional collections", () => {
      const assessment: GardenAssessment = {
        id: "assessment-3",
        schemaVersion: "assessment_v2",
        authorAddress: "0xAuthor",
        gardenAddress: "0xGarden",
        title: "Minimal Assessment",
        description: "Basic test",
        diagnosis: "Testing",
        smartOutcomes: [],
        cynefinPhase: CynefinPhase.CHAOTIC,
        domain: Domain.EDU,
        selectedActionUIDs: [],
        reportingPeriod: { start: 0, end: 0 },
        sdgTargets: [],
        attachments: [],
        location: "",
        createdAt: 0,
      };

      expect(assessment.smartOutcomes).toEqual([]);
      expect(assessment.selectedActionUIDs).toEqual([]);
      expect(assessment.sdgTargets).toEqual([]);
      expect(assessment.attachments).toEqual([]);
    });
  });

  describe("AssessmentDraft v2", () => {
    it("has strategy kernel, domain selection, harvest intent, and SDG alignment", () => {
      const draft: AssessmentDraft = {
        title: "Q1 Strategy",
        description: "Waste reduction plan",
        diagnosis: "Upstream runoff deposits waste on riverbank",
        smartOutcomes: [{ description: "Remove waste", metric: "waste_removed_kg", target: 250 }],
        cynefinPhase: CynefinPhase.COMPLICATED,
        domain: Domain.WASTE,
        selectedActionUIDs: ["action-1"],
        reportingPeriod: { start: 1704067200, end: 1711929600 },
        sdgTargets: [6, 14],
        attachments: [],
        location: "Austin TX",
      };

      expect(draft.diagnosis).toBe("Upstream runoff deposits waste on riverbank");
      expect(draft.smartOutcomes).toHaveLength(1);
      expect(draft.cynefinPhase).toBe(CynefinPhase.COMPLICATED);
      expect(draft.domain).toBe(Domain.WASTE);
      expect(draft.selectedActionUIDs).toEqual(["action-1"]);
      expect(draft.reportingPeriod.start).toBe(1704067200);
      expect(draft.sdgTargets).toEqual([6, 14]);
    });

    it("does not include dropped fields (assessmentType, capitals, metrics, etc.)", () => {
      const draft: AssessmentDraft = {
        title: "Test",
        description: "Test",
        diagnosis: "Test",
        smartOutcomes: [],
        cynefinPhase: CynefinPhase.CLEAR,
        domain: Domain.EDU,
        selectedActionUIDs: [],
        reportingPeriod: { start: 0, end: 0 },
        sdgTargets: [],
        attachments: [],
        location: "",
      };

      // These fields should not exist on the v2 draft
      expect("assessmentType" in draft).toBe(false);
      expect("capitals" in draft).toBe(false);
      expect("metrics" in draft).toBe(false);
      expect("evidenceMedia" in draft).toBe(false);
      expect("reportDocuments" in draft).toBe(false);
      expect("impactAttestations" in draft).toBe(false);
      expect("tags" in draft).toBe(false);
    });
  });

  describe("WorkSubmission (generalized)", () => {
    it("accepts generic details instead of hardcoded planting fields", () => {
      const submission: WorkSubmission = {
        actionUID: 1,
        title: "Cleanup Event",
        timeSpentMinutes: 90,
        feedback: "Collected lots of plastic",
        media: [],
        details: {
          participantsCount: 12,
          amountRemovedKg: 32.5,
          unitType: "kg",
        },
        tags: ["riverbank", "plastic"],
        audioNotes: [],
      };

      expect(submission.actionUID).toBe(1);
      expect(submission.timeSpentMinutes).toBe(90);
      expect(submission.details.participantsCount).toBe(12);
      expect(submission.tags).toEqual(["riverbank", "plastic"]);
      expect(submission.audioNotes).toEqual([]);
    });

    it("makes tags and audioNotes optional", () => {
      const submission: WorkSubmission = {
        actionUID: 2,
        title: "Planting Event",
        timeSpentMinutes: 120,
        feedback: "",
        media: [],
        details: { seedlingsPlanted: 50 },
      };

      expect(submission.tags).toBeUndefined();
      expect(submission.audioNotes).toBeUndefined();
    });

    it("requires timeSpentMinutes (not optional)", () => {
      const submission: WorkSubmission = {
        actionUID: 3,
        title: "Test",
        timeSpentMinutes: 30,
        feedback: "",
        media: [],
        details: {},
      };

      expect(submission.timeSpentMinutes).toBe(30);
    });
  });

  describe("WorkMetadata v2", () => {
    it("has schemaVersion field set to work_metadata_v2", () => {
      const metadata: WorkMetadata = {
        schemaVersion: "work_metadata_v2",
        domain: Domain.WASTE,
        actionSlug: "waste.cleanup_event",
        timeSpentMinutes: 90,
        details: { participantsCount: 12 },
        tags: ["riverbank"],
        audioNoteCids: ["bafy123"],
        clientWorkId: "client-123",
        submittedAt: "2026-02-13T00:00:00Z",
      };

      expect(metadata.schemaVersion).toBe("work_metadata_v2");
      expect(metadata.domain).toBe(Domain.WASTE);
      expect(metadata.actionSlug).toBe("waste.cleanup_event");
    });

    it("makes tags, audioNoteCids, and location optional", () => {
      const metadata: WorkMetadata = {
        schemaVersion: "work_metadata_v2",
        domain: Domain.AGRO,
        actionSlug: "agro.planting_event",
        timeSpentMinutes: 60,
        details: {},
        clientWorkId: "client-456",
        submittedAt: "2026-02-13T00:00:00Z",
      };

      expect(metadata.tags).toBeUndefined();
      expect(metadata.audioNoteCids).toBeUndefined();
      expect(metadata.location).toBeUndefined();
    });

    it("supports optional GPS location", () => {
      const metadata: WorkMetadata = {
        schemaVersion: "work_metadata_v2",
        domain: Domain.SOLAR,
        actionSlug: "solar.site_setup",
        timeSpentMinutes: 45,
        details: {},
        clientWorkId: "client-789",
        submittedAt: "2026-02-13T00:00:00Z",
        location: { lat: 1.234, lng: 5.678, accuracy: 10 },
      };

      expect(metadata.location).toEqual({ lat: 1.234, lng: 5.678, accuracy: 10 });
    });
  });

  describe("WorkMetadataV1 (backward compat)", () => {
    it("preserves the old shape for legacy works", () => {
      const v1: WorkMetadataV1 = {
        plantCount: 5,
        plantSelection: ["Rose", "Tulip"],
        timeSpentMinutes: 60,
      };

      expect(v1.plantCount).toBe(5);
      expect(v1.plantSelection).toEqual(["Rose", "Tulip"]);
    });
  });

  describe("ActionCard (with domain + slug)", () => {
    it("includes domain and slug fields", () => {
      const card: ActionCard = {
        id: "action-1",
        slug: "waste.cleanup_event",
        startTime: 1000,
        endTime: 2000,
        title: "Cleanup Event",
        capitals: [],
        media: [],
        domain: Domain.WASTE,
        createdAt: 1000,
      };

      expect(card.slug).toBe("waste.cleanup_event");
      expect(card.domain).toBe(Domain.WASTE);
    });
  });

  describe("WorkInput (extended)", () => {
    it("supports new type variants: multi-select, band, repeater", () => {
      const multiSelect: WorkInput = {
        key: "speciesTags",
        title: "Species",
        placeholder: "Select species",
        type: "multi-select",
        required: true,
        options: ["oak", "maple", "pine"],
      };
      expect(multiSelect.type).toBe("multi-select");

      const band: WorkInput = {
        key: "siteSizeBand",
        title: "Site Size",
        placeholder: "Select range",
        type: "band",
        required: true,
        options: [],
        bands: ["small", "medium", "large", "extra-large"],
      };
      expect(band.type).toBe("band");
      expect(band.bands).toEqual(["small", "medium", "large", "extra-large"]);

      const repeater: WorkInput = {
        key: "categoryBreakdown",
        title: "Category Breakdown",
        placeholder: "",
        type: "repeater",
        required: false,
        options: [],
        repeaterFields: [
          {
            key: "category",
            title: "Category",
            placeholder: "Select",
            type: "select",
            required: true,
            options: ["plastic", "metal", "organic"],
          },
          {
            key: "amountKg",
            title: "Amount (kg)",
            placeholder: "0",
            type: "number",
            required: true,
            options: [],
          },
        ],
      };
      expect(repeater.type).toBe("repeater");
      expect(repeater.repeaterFields).toHaveLength(2);
    });

    it("supports optional unit field", () => {
      const input: WorkInput = {
        key: "kwhGenerated",
        title: "kWh Generated",
        placeholder: "0",
        type: "number",
        required: true,
        options: [],
        unit: "kWh",
      };
      expect(input.unit).toBe("kWh");
    });
  });

  describe("SmartOutcome", () => {
    it("has description, metric, and target fields", () => {
      const outcome: SmartOutcome = {
        description: "Reduce plastic waste by 50% in riverbank area",
        metric: "waste_removed_kg",
        target: 500,
      };

      expect(outcome.description).toBe("Reduce plastic waste by 50% in riverbank area");
      expect(outcome.metric).toBe("waste_removed_kg");
      expect(outcome.target).toBe(500);
    });

    it("supports zero target", () => {
      const outcome: SmartOutcome = {
        description: "Eliminate illegal dumping",
        metric: "dumping_incidents",
        target: 0,
      };

      expect(outcome.target).toBe(0);
    });
  });

  describe("AssessmentAttachment", () => {
    it("has name, cid, and mimeType fields", () => {
      const attachment: AssessmentAttachment = {
        name: "baseline-report.pdf",
        cid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
        mimeType: "application/pdf",
      };

      expect(attachment.name).toBe("baseline-report.pdf");
      expect(attachment.cid).toBe("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi");
      expect(attachment.mimeType).toBe("application/pdf");
    });

    it("supports image mime types", () => {
      const attachment: AssessmentAttachment = {
        name: "site-photo.png",
        cid: "bafy123",
        mimeType: "image/png",
      };

      expect(attachment.mimeType).toBe("image/png");
    });
  });

  describe("WorkApprovalDraft (extended)", () => {
    it("includes confidence, verificationMethod, and reviewNotesCID", () => {
      const draft: WorkApprovalDraft = {
        actionUID: 1,
        workUID: "0xWorkUID123",
        approved: true,
        feedback: "Good evidence",
        confidence: Confidence.HIGH,
        verificationMethod: VerificationMethod.HUMAN | VerificationMethod.IOT,
        reviewNotesCID: "bafy456",
      };

      expect(draft.confidence).toBe(Confidence.HIGH);
      expect(draft.verificationMethod).toBe(3); // HUMAN(1) | IOT(2)
      expect(draft.reviewNotesCID).toBe("bafy456");
    });

    it("defaults to NONE confidence for rejections", () => {
      const draft: WorkApprovalDraft = {
        actionUID: 1,
        workUID: "0xWorkUID456",
        approved: false,
        feedback: "Blurry photos",
        confidence: Confidence.NONE,
        verificationMethod: VerificationMethod.HUMAN,
      };

      expect(draft.confidence).toBe(0);
      expect(draft.approved).toBe(false);
    });

    it("makes reviewNotesCID optional", () => {
      const draft: WorkApprovalDraft = {
        actionUID: 1,
        workUID: "0xWorkUID789",
        approved: true,
        confidence: Confidence.MEDIUM,
        verificationMethod: VerificationMethod.HUMAN,
      };

      expect(draft.reviewNotesCID).toBeUndefined();
    });
  });
});
