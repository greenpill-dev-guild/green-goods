import type { InvestigationPacket } from "./packet";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

// One bounded JSON step (decision 4). The model sees the chunks, the allowed targets and the
// allowed predicates, and nothing else about the graph.
export function buildProposalMessages(packet: InvestigationPacket): ChatMessage[] {
  const targets = packet.targets.map((target) => `- ${target.id} (${target.kind}): ${target.label}`).join("\n");
  const chunks = packet.chunks.map((chunk) => `[${chunk.id}] ${chunk.text}`).join("\n\n");
  const system =
    "You connect passages from a saved source to items in a community garden's knowledge graph. " +
    "You answer with JSON only: an array of at most " +
    `${packet.maxProposals} objects, each with the keys targetId, predicate, chunkId, quote, reason. ` +
    "Use only targetId values and predicate values from the lists given. The quote must be copied " +
    "character for character from the named chunk, between one short clause and two sentences long. " +
    "Propose a connection only when the quoted passage clearly supports it. If nothing qualifies, " +
    "answer []. No prose, no markdown fences.";
  const user =
    `Source: ${packet.sourceTitle}\n\n` +
    `Chunks:\n${chunks}\n\n` +
    `Allowed targets:\n${targets}\n\n` +
    `Allowed predicates: ${packet.predicates.join(", ")}\n` +
    "Predicate meanings: relevantTo = the passage is useful evidence for the target; " +
    "addresses = the passage answers the target question; aboutConcept = the passage is about the " +
    "concept; informedBy = the target was shaped by this source.\n\n" +
    "Return the JSON array now.";
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
