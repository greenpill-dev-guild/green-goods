import type { InvestigationPacket } from "./packet";

export interface Proposal {
  targetId: string;
  predicate: string;
  chunkId: string;
  quote: string;
  reason: string;
}

export interface RejectedProposal {
  candidate: unknown;
  reason: string;
}

export interface ValidationResult {
  accepted: Proposal[];
  rejected: RejectedProposal[];
  parseError: string | null;
}

const MIN_QUOTE_LENGTH = 12;
const MAX_QUOTE_LENGTH = 400;

// The honesty rule in code: a proposal survives only with a known target, a known predicate and a
// quote that is an exact substring of the saved text. Everything else is dropped and reported.
export function validateProposals(rawText: string, packet: InvestigationPacket): ValidationResult {
  const parsed = parseJsonArray(rawText);
  if (!parsed.ok) return { accepted: [], rejected: [], parseError: parsed.error };

  const targetIds = new Set(packet.targets.map((target) => target.id));
  const predicates = new Set<string>(packet.predicates);
  const chunksById = new Map(packet.chunks.map((chunk) => [chunk.id, chunk.text]));
  const seen = new Set<string>();
  const accepted: Proposal[] = [];
  const rejected: RejectedProposal[] = [];

  for (const candidate of parsed.items) {
    const reason = rejectionReason(candidate, { targetIds, predicates, chunksById, packet });
    if (reason) {
      rejected.push({ candidate, reason });
      continue;
    }
    const proposal = candidate as Proposal;
    const chunkId = proposal.chunkId || findOwningChunk(proposal.quote, chunksById) || "";
    const key = `${proposal.targetId}|${proposal.predicate}`;
    if (seen.has(key)) {
      rejected.push({ candidate, reason: "duplicate target and predicate" });
      continue;
    }
    if (accepted.length >= packet.maxProposals) {
      rejected.push({ candidate, reason: `more than ${packet.maxProposals} proposals` });
      continue;
    }
    seen.add(key);
    accepted.push({ ...proposal, chunkId, reason: String(proposal.reason ?? "") });
  }
  return { accepted, rejected, parseError: null };
}

interface Vocabulary {
  targetIds: Set<string>;
  predicates: Set<string>;
  chunksById: Map<string, string>;
  packet: InvestigationPacket;
}

function rejectionReason(candidate: unknown, vocabulary: Vocabulary): string | null {
  if (!candidate || typeof candidate !== "object") return "not an object";
  const item = candidate as Record<string, unknown>;
  if (typeof item.targetId !== "string" || !vocabulary.targetIds.has(item.targetId)) return "unknown targetId";
  if (typeof item.predicate !== "string" || !vocabulary.predicates.has(item.predicate)) return "unknown predicate";
  if (typeof item.quote !== "string") return "quote missing";
  const quote = item.quote;
  if (quote.length < MIN_QUOTE_LENGTH) return "quote too short";
  if (quote.length > MAX_QUOTE_LENGTH) return "quote too long";
  if (typeof item.chunkId === "string" && item.chunkId.length > 0) {
    const text = vocabulary.chunksById.get(item.chunkId);
    if (text === undefined) return "unknown chunkId";
    if (!text.includes(quote)) return "quote is not an exact substring of the named chunk";
    return null;
  }
  return findOwningChunk(quote, vocabulary.chunksById) ? null : "quote is not an exact substring of any chunk";
}

function findOwningChunk(quote: string, chunksById: Map<string, string>): string | null {
  const owners = [...chunksById.entries()].filter(([, text]) => text.includes(quote)).map(([id]) => id);
  return owners.length === 1 ? (owners[0] ?? null) : null;
}

function parseJsonArray(rawText: string): { ok: true; items: unknown[] } | { ok: false; error: string } {
  const withoutFences = rawText.replace(/```(?:json)?/gi, "").trim();
  const start = withoutFences.indexOf("[");
  const end = withoutFences.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return { ok: false, error: "no JSON array in output" };
  try {
    const value: unknown = JSON.parse(withoutFences.slice(start, end + 1));
    if (!Array.isArray(value)) return { ok: false, error: "top-level JSON is not an array" };
    return { ok: true, items: value };
  } catch (error) {
    return { ok: false, error: `invalid JSON: ${(error as Error).message}` };
  }
}
