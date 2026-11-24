import { describe, expect, it } from "vitest";
import { buildSyntheticGarden, PREDICATES } from "../graph/synthetic";
import { G0_PACKET } from "../model/packet";
import { validateProposals } from "../model/validate";

const exactQuote = "Both species carry root nodules with Frankia bacteria";

describe("validateProposals", () => {
  it("accepts a proposal with a known target, a known predicate and an exact quote", () => {
    const text = JSON.stringify([
      { targetId: "question:hedgerow-nitrogen", predicate: "addresses", chunkId: "c2", quote: exactQuote, reason: "names the species" },
    ]);
    const result = validateProposals(text, G0_PACKET);
    expect(result.parseError).toBeNull();
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(0);
  });

  it("drops unknown ids, unknown predicates and paraphrased quotes, and says why", () => {
    const text = JSON.stringify([
      { targetId: "action:not-real", predicate: "relevantTo", chunkId: "c2", quote: exactQuote },
      { targetId: "action:mulch-beds", predicate: "causes", chunkId: "c1", quote: exactQuote },
      { targetId: "action:mulch-beds", predicate: "relevantTo", chunkId: "c1", quote: "Wood chips keep the soil damp for about nine days" },
      { targetId: "action:mulch-beds", predicate: "relevantTo", chunkId: "c9", quote: exactQuote },
    ]);
    const result = validateProposals(text, G0_PACKET);
    expect(result.accepted).toHaveLength(0);
    expect(result.rejected.map((entry) => entry.reason)).toEqual([
      "unknown targetId",
      "unknown predicate",
      "quote is not an exact substring of the named chunk",
      "unknown chunkId",
    ]);
  });

  it("resolves a missing chunkId when the quote belongs to exactly one chunk", () => {
    const text = JSON.stringify([{ targetId: "concept:nitrogen-fixation", predicate: "aboutConcept", quote: exactQuote }]);
    const result = validateProposals(text, G0_PACKET);
    expect(result.accepted[0]?.chunkId).toBe("c2");
  });

  it("tolerates markdown fences and caps the list at the packet maximum without duplicates", () => {
    const item = (targetId: string, predicate: string) => ({ targetId, predicate, chunkId: "c2", quote: exactQuote, reason: "" });
    const text = "```json\n" + JSON.stringify([
      item("question:hedgerow-nitrogen", "addresses"),
      item("question:hedgerow-nitrogen", "addresses"),
      item("concept:nitrogen-fixation", "aboutConcept"),
      item("action:hedgerow-planting", "relevantTo"),
      item("action:compost-trial", "relevantTo"),
    ]) + "\n```";
    const result = validateProposals(text, G0_PACKET);
    expect(result.accepted).toHaveLength(3);
    expect(result.rejected.map((entry) => entry.reason)).toEqual([
      "duplicate target and predicate",
      "more than 3 proposals",
    ]);
  });

  it("keeps the complete items of an array cut off at the token cap and says so", () => {
    const complete = { targetId: "question:hedgerow-nitrogen", predicate: "addresses", chunkId: "c2", quote: exactQuote, reason: "names the species" };
    const text = `[${JSON.stringify(complete)}, {"targetId": "action:compost-trial", "predicate": "relevantTo", "chunkId": "c4", "quote": "Compost built from alley pr`;
    const result = validateProposals(text, G0_PACKET);
    expect(result.parseError).toBeNull();
    expect(result.truncated).toBe(true);
    expect(result.accepted.map((proposal) => proposal.targetId)).toEqual(["question:hedgerow-nitrogen"]);
    expect(validateProposals("[{\"targetId\": \"question:hedgerow-nitrogen\", \"predicate\"", G0_PACKET)).toMatchObject({ parseError: "no JSON array in output", truncated: false });
  });

  it("reports unparseable output instead of guessing", () => {
    expect(validateProposals("I cannot find any connections.", G0_PACKET).parseError).toBe("no JSON array in output");
    expect(validateProposals("[{ not json }]", G0_PACKET).parseError).toMatch(/^invalid JSON/);
  });
});

describe("buildSyntheticGarden, the graph the packet points into", () => {
  const garden = buildSyntheticGarden();

  it("has about fifty nodes with unique ids and only known edge endpoints", () => {
    expect(garden.nodes).toHaveLength(50);
    const ids = new Set(garden.nodes.map((node) => node.id));
    expect(ids.size).toBe(garden.nodes.length);
    for (const edge of garden.edges) {
      expect(ids.has(edge.source)).toBe(true);
      expect(ids.has(edge.target)).toBe(true);
    }
  });

  it("uses the prototype vocabulary and keeps every packet target in the graph", () => {
    const kinds = new Set(garden.edges.map((edge) => edge.kind));
    for (const predicate of PREDICATES) expect(kinds.has(predicate)).toBe(true);
    const ids = new Set(garden.nodes.map((node) => node.id));
    for (const target of G0_PACKET.targets) expect(ids.has(target.id)).toBe(true);
    expect(ids.has(G0_PACKET.gardenId)).toBe(true);
  });

  it("is deterministic", () => {
    expect(buildSyntheticGarden()).toEqual(garden);
  });
});
