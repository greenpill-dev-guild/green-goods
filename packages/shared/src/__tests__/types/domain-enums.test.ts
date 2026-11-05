/**
 * Domain Enum Tests
 *
 * Validates that Domain, Confidence, and VerificationMethod enums
 * mirror Solidity values exactly for correct EAS encoding, and that the
 * Capital enum converts to the hypercert capital words as the ontology declares.
 */

import { describe, expect, it } from "vitest";

import { getOntology } from "../../ontology";
import { Capital, Confidence, CynefinPhase, Domain, VerificationMethod } from "../../types/domain";
import {
  type CapitalType,
  capitalToCapitalType,
  capitalTypeToCapital,
} from "../../types/hypercerts";

describe("types/domain enums", () => {
  describe("Domain enum", () => {
    it("has exactly 4 values matching Solidity enum order", () => {
      expect(Domain.SOLAR).toBe(0);
      expect(Domain.AGRO).toBe(1);
      expect(Domain.EDU).toBe(2);
      expect(Domain.WASTE).toBe(3);
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
  });

  describe("CynefinPhase enum", () => {
    it("has exactly 4 values in correct order", () => {
      expect(CynefinPhase.CLEAR).toBe(0);
      expect(CynefinPhase.COMPLICATED).toBe(1);
      expect(CynefinPhase.COMPLEX).toBe(2);
      expect(CynefinPhase.CHAOTIC).toBe(3);
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

  describe("Capital and CapitalType", () => {
    it("converts each form of capital to its hypercert word and back as the ontology declares", () => {
      const pairs =
        getOntology()
          .vocabularies.find((vocabulary) => vocabulary.id === "capital")
          ?.mappings.find((mapping) => mapping.id === "capital-enum-to-capital-type")?.pairs ?? {};

      expect(Object.keys(pairs)).toHaveLength(8);
      for (const [name, word] of Object.entries(pairs)) {
        const capital = Capital[name as keyof typeof Capital];
        expect(capitalToCapitalType(capital)).toBe(word);
        expect(capitalTypeToCapital(word as CapitalType)).toBe(capital);
      }
    });
  });
});
