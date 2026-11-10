/**
 * Domain Enum Tests
 *
 * Validates that Domain, Confidence, and VerificationMethod enums
 * mirror Solidity values exactly for correct EAS encoding, and that the
 * Capital enum converts to the hypercert capital words as the ontology declares.
 */

import { describe, expect, it } from "vitest";

import { getOntology } from "../../ontology";
import {
  Capital,
  Confidence,
  CynefinPhase,
  Domain,
  DOMAIN_COLORS,
  DOMAIN_TOKEN_SLUG,
  VerificationMethod,
} from "../../types/domain";
import {
  ACTION_DOMAINS,
  type CapitalType,
  capitalToCapitalType,
  capitalTypeToCapital,
} from "../../types/hypercerts";

import { DOMAIN_CONFIG, getDomainStyle } from "../../config/domain";
import en from "../../i18n/en.json";
import es from "../../i18n/es.json";
import pt from "../../i18n/pt.json";
import { PUBLIC_GARDEN_IMPACT_DOMAINS } from "../../public-contracts/garden-impact";
import {
  ALL_DOMAINS,
  DOMAIN_ACTION_DOMAIN,
  DOMAIN_LABELS,
  DOMAIN_SLUG_PREFIX,
  resolveDisplayDomain,
} from "../../utils/domain";
import { DOMAIN_LABEL_IDS } from "../../utils/garden-detail";

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

describe("action domain vocabulary and presentation", () => {
  it("maps every enum member to each published spelling as declared by the ontology", () => {
    const vocabulary = getOntology().vocabularies.find((item) => item.id === "domain");
    expect(vocabulary).toBeDefined();
    expect(ALL_DOMAINS).toEqual(
      vocabulary?.canonical.members.map((name) => Domain[name as keyof typeof Domain])
    );
    for (const [id, map] of [
      ["domain-to-design-token", DOMAIN_TOKEN_SLUG],
      ["domain-to-slug-prefix", DOMAIN_SLUG_PREFIX],
      ["domain-to-action-domain", DOMAIN_ACTION_DOMAIN],
    ] as const) {
      const pairs = vocabulary?.mappings.find((mapping) => mapping.id === id)?.pairs;
      expect(Object.keys(pairs ?? {})).toHaveLength(ALL_DOMAINS.length);
      expect(Object.keys(map).map(Number)).toEqual(ALL_DOMAINS);
      for (const domain of ALL_DOMAINS) expect(map[domain]).toBe(pairs?.[Domain[domain]]);
    }
  });

  it("keeps the public garden-impact vocabulary in enum order and equal to the hypercert words", () => {
    expect(PUBLIC_GARDEN_IMPACT_DOMAINS).toEqual(
      ALL_DOMAINS.map((domain) => DOMAIN_ACTION_DOMAIN[domain])
    );
    expect(new Set(PUBLIC_GARDEN_IMPACT_DOMAINS)).toEqual(new Set(ACTION_DOMAINS));
  });

  it("keeps the statically discoverable Tailwind palette and inline colors aligned with the token map", () => {
    expect(Object.keys(DOMAIN_CONFIG).map(Number)).toEqual(ALL_DOMAINS);
    for (const domain of ALL_DOMAINS) {
      const token = DOMAIN_TOKEN_SLUG[domain];
      const style = DOMAIN_CONFIG[domain];
      expect(style.colors).toEqual({
        bg: `bg-domain-${token}-soft`,
        fill: `bg-domain-${token}`,
        text: `text-domain-${token}`,
        border: `border-domain-${token}/30`,
      });
      expect(style.gradient).toEqual({
        from: `from-domain-${token}-soft`,
        to: `to-domain-${token}-soft`,
      });
      expect(DOMAIN_COLORS[domain]).toBe(`rgb(var(--domain-${token}-rgb))`);
      expect(getDomainStyle(token)).toBe(style);
    }
  });

  it("resolves the shared, assessment, and garden label keys in every locale", () => {
    for (const domain of ALL_DOMAINS) {
      const label = DOMAIN_LABELS[domain];
      expect(DOMAIN_CONFIG[domain].labelId).toBe(label.id);
      expect(DOMAIN_LABEL_IDS[domain]).toBe(label.id);
      expect(DOMAIN_CONFIG[domain].defaultLabel).toBe(label.defaultMessage);
      for (const messages of [en, es, pt] as Record<string, string>[]) {
        expect(messages[label.id]).toBeTruthy();
        expect(messages[label.assessmentLabelId]).toBe(messages[label.id]);
        expect(messages[label.gardenLabelId]).toBe(messages[label.id]);
      }
      expect(en[label.id as keyof typeof en]).toBe(label.defaultMessage);
    }
  });

  it.each(ALL_DOMAINS)("resolves enum %s and its case-insensitive display spelling", (domain) => {
    expect(resolveDisplayDomain(domain)).toBe(domain);
    expect(resolveDisplayDomain(DOMAIN_TOKEN_SLUG[domain].toUpperCase())).toBe(domain);
    expect(getDomainStyle(domain)).toBe(DOMAIN_CONFIG[domain]);
  });

  it.each([
    null,
    undefined,
    -1,
    99,
    0.5,
    Number.NaN,
    Infinity,
    "0",
    "edu",
    "agroforestry",
    "UNKNOWN",
    "__proto__",
    "constructor",
    "toString",
  ])("keeps unknown display domain %s neutral", (value) => {
    expect(resolveDisplayDomain(value)).toBeNull();
    expect(getDomainStyle(value)).toBeUndefined();
  });
});
