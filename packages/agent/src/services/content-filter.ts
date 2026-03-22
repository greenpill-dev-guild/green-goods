/**
 * Content filter for outbound bot messages.
 *
 * Enforces messaging constraints from product.md — gardener-facing copy
 * must never contain blockchain vocabulary, carbon credit terminology,
 * or wallet jargon. These terms confuse communities in Nigeria, Brazil,
 * and Uganda who interact via SMS/WhatsApp without blockchain awareness.
 */

const PROHIBITED_PATTERNS: RegExp[] = [
  /\bcarbon\s*credits?\b/i,
  /\bcarbon\s*offsets?\b/i,
  /\bclimate\s*neutral\b/i,
  /\bnet\s*zero\b/i,
  /\btokenized\s*carbon\b/i,
  /\bweb\s?3\b/i,
  /\bblockchain\b/i,
  /\bdecentralized\b/i,
  /\bseed\s*phrase\b/i,
  /\bgas\s*fees?\b/i,
  /\bchain\s*switch\w*/i,
];

export function checkMessageContent(text: string): {
  clean: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  for (const pattern of PROHIBITED_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      violations.push(match[0]);
    }
  }
  return { clean: violations.length === 0, violations };
}
