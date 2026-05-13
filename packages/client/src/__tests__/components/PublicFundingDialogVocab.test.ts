/**
 * Public funding decision-moment vocabulary guard.
 *
 * Locks the Phase 1 promise of the website UX flow plan: a visitor reading the
 * funding decision dialog (`PublicFundingCard`) or the linked tax/risk
 * disclosures must never be shown the technical web3 vocabulary that the
 * editorial bridge already retired (smart contract, yield, wallet recovery,
 * onchain). The test scans every locale so a regression in en/es/pt is caught
 * the moment it lands, even when the offending key is orphaned from the
 * component graph but still ships in the bundle.
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import enMessages from "../../../../shared/src/i18n/en.json";
import esMessages from "../../../../shared/src/i18n/es.json";
import ptMessages from "../../../../shared/src/i18n/pt.json";

const BANNED_TERMS: { label: string; pattern: RegExp }[] = [
  { label: "smart contract", pattern: /smart contract/i },
  { label: "yield", pattern: /\byield\b/i },
  { label: "wallet recovery", pattern: /wallet recovery/i },
  { label: "onchain", pattern: /\bonchain\b|\bon-chain\b/i },
];

const FUNDING_DIALOG_KEY_PREFIXES = ["public.fund.dialog.", "public.fund.card."];

interface Violation {
  locale: string;
  key: string;
  term: string;
  value: string;
}

function findViolations(messages: Record<string, string>, locale: string): Violation[] {
  const violations: Violation[] = [];
  for (const [key, value] of Object.entries(messages)) {
    if (!FUNDING_DIALOG_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      continue;
    }
    for (const banned of BANNED_TERMS) {
      if (banned.pattern.test(value)) {
        violations.push({ locale, key, term: banned.label, value });
      }
    }
  }
  return violations;
}

describe("public funding decision-moment vocabulary", () => {
  it("never ships smart contract / yield / wallet recovery / onchain in any funding dialog or card key (en/es/pt)", () => {
    const violations = [
      ...findViolations(enMessages as Record<string, string>, "en"),
      ...findViolations(esMessages as Record<string, string>, "es"),
      ...findViolations(ptMessages as Record<string, string>, "pt"),
    ];
    expect(violations).toEqual([]);
  });
});
