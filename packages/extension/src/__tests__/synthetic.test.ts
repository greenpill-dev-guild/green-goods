import { describe, expect, it } from "vitest";
import { buildSyntheticGarden, PREDICATES } from "../graph/synthetic";
import { G0_PACKET } from "../model/packet";

describe("buildSyntheticGarden", () => {
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
