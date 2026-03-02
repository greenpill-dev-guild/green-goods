/**
 * Domain Enum Tests
 *
 * Validates that Domain, Confidence, and VerificationMethod enums
 * mirror Solidity values exactly for correct EAS encoding.
 */

import { describe, expect, it } from "vitest";

import { Capital, Confidence, CynefinPhase, Domain, VerificationMethod } from "../../types/domain";

describe("types/domain enums", () => {
  describe("Domain enum", () => {
    it("has exactly 4 values matching Solidity enum order", () => {
      expect(Domain.SOLAR).toBe(0);
      expect(Domain.AGRO).toBe(1);
      expect(Domain.EDU).toBe(2);
      expect(Domain.WASTE).toBe(3);
    });

    it("is a numeric enum (values are numbers)", () => {
      expect(typeof Domain.SOLAR).toBe("number");
      expect(typeof Domain.AGRO).toBe("number");
      expect(typeof Domain.EDU).toBe("number");
      expect(typeof Domain.WASTE).toBe("number");
    });

    it("supports reverse mapping (number to name)", () => {
      expect(Domain[0]).toBe("SOLAR");
      expect(Domain[1]).toBe("AGRO");
      expect(Domain[2]).toBe("EDU");
      expect(Domain[3]).toBe("WASTE");
    });
  });

  describe("Confidence enum", () => {
    it("has exactly 4 values matching on-chain uint8 encoding", () => {
      expect(Confidence.NONE).toBe(0);
      expect(Confidence.LOW).toBe(1);
      expect(Confidence.MEDIUM).toBe(2);
      expect(Confidence.HIGH).toBe(3);
    });

    it("supports reverse mapping", () => {
      expect(Confidence[0]).toBe("NONE");
      expect(Confidence[1]).toBe("LOW");
      expect(Confidence[2]).toBe("MEDIUM");
      expect(Confidence[3]).toBe("HIGH");
    });
  });

  describe("VerificationMethod enum (bitmask)", () => {
    it("has power-of-2 values for bitmask composition", () => {
      expect(VerificationMethod.HUMAN).toBe(1);
      expect(VerificationMethod.IOT).toBe(2);
      expect(VerificationMethod.ONCHAIN).toBe(4);
      expect(VerificationMethod.AGENT).toBe(8);
    });

    it("can compose multiple methods via bitwise OR", () => {
      const humanAndIot = VerificationMethod.HUMAN | VerificationMethod.IOT;
      expect(humanAndIot).toBe(3);

      const allMethods =
        VerificationMethod.HUMAN |
        VerificationMethod.IOT |
        VerificationMethod.ONCHAIN |
        VerificationMethod.AGENT;
      expect(allMethods).toBe(15);
    });

    it("can check individual methods via bitwise AND", () => {
      const methods = VerificationMethod.HUMAN | VerificationMethod.ONCHAIN; // 5
      expect((methods & VerificationMethod.HUMAN) !== 0).toBe(true);
      expect((methods & VerificationMethod.IOT) !== 0).toBe(false);
      expect((methods & VerificationMethod.ONCHAIN) !== 0).toBe(true);
      expect((methods & VerificationMethod.AGENT) !== 0).toBe(false);
    });

    it("max bitmask value is 15 (all 4 lower bits)", () => {
      const maxMask =
        VerificationMethod.HUMAN |
        VerificationMethod.IOT |
        VerificationMethod.ONCHAIN |
        VerificationMethod.AGENT;
      expect(maxMask).toBe(0x0f);
    });
  });

  describe("CynefinPhase enum", () => {
    it("has exactly 4 values in correct order", () => {
      expect(CynefinPhase.CLEAR).toBe(0);
      expect(CynefinPhase.COMPLICATED).toBe(1);
      expect(CynefinPhase.COMPLEX).toBe(2);
      expect(CynefinPhase.CHAOTIC).toBe(3);
    });

    it("is a numeric enum (values are numbers)", () => {
      expect(typeof CynefinPhase.CLEAR).toBe("number");
      expect(typeof CynefinPhase.COMPLICATED).toBe("number");
      expect(typeof CynefinPhase.COMPLEX).toBe("number");
      expect(typeof CynefinPhase.CHAOTIC).toBe("number");
    });

    it("supports reverse mapping (number to name)", () => {
      expect(CynefinPhase[0]).toBe("CLEAR");
      expect(CynefinPhase[1]).toBe("COMPLICATED");
      expect(CynefinPhase[2]).toBe("COMPLEX");
      expect(CynefinPhase[3]).toBe("CHAOTIC");
    });
  });

  describe("Capital enum (existing, unchanged)", () => {
    it("still has 8 values", () => {
      expect(Capital.SOCIAL).toBe(0);
      expect(Capital.CULTURAL).toBe(7);
    });
  });
});
