import Graph from "graphology";
import Sigma from "sigma";
import type { GardenEdge, GardenNode, NodeKind, SyntheticGarden } from "./synthetic";

export interface CanvasStats {
  nodeCount: number;
  edgeCount: number;
  /** Building the Graphology graph and placing its nodes. */
  buildMs: number;
  /** Constructing Sigma, which renders the first frame synchronously. */
  mountMs: number;
  /** Time until a scheduled refresh reported `afterRender`, or null when no frame was confirmed in 5 s. */
  renderConfirmedMs: number | null;
}

const RING_BY_KIND: Record<NodeKind, number> = { garden: 0, action: 1, work: 2.1, source: 3, question: 3, concept: 3 };
const SIZE_BY_KIND: Record<NodeKind, number> = { garden: 18, action: 11, work: 5, source: 8, question: 7, concept: 7 };
const COLOR_BY_KIND: Record<NodeKind, string> = {
  garden: "#3f6b3a",
  action: "#6a8f3c",
  work: "#b7a77a",
  source: "#8a5a2b",
  question: "#c47b2a",
  concept: "#5d6b8c",
};
const EDGE_COLOR: Record<GardenEdge["kind"], string> = {
  partOf: "#d9d2c3",
  informedBy: "#8a5a2b",
  relevantTo: "#c47b2a",
  addresses: "#6a8f3c",
  aboutConcept: "#5d6b8c",
};

// Deterministic concentric placement: the garden at the centre, actions on the first ring, work
// on the second, sources, questions and concepts on the outer ring. No force layout, so a run is
// reproducible and the first-render timing measures Sigma, not the layout.
function placeNodes(nodes: GardenNode[]): Map<string, { x: number; y: number }> {
  const byRing = new Map<number, GardenNode[]>();
  for (const node of nodes) {
    const ring = RING_BY_KIND[node.kind];
    byRing.set(ring, [...(byRing.get(ring) ?? []), node]);
  }
  const positions = new Map<string, { x: number; y: number }>();
  for (const [ring, members] of byRing) {
    members.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / members.length - Math.PI / 2;
      positions.set(node.id, { x: Math.cos(angle) * ring * 10, y: Math.sin(angle) * ring * 10 });
    });
  }
  return positions;
}

export function mountGardenGraph(container: HTMLElement, garden: SyntheticGarden): Promise<{ sigma: Sigma; stats: CanvasStats }> {
  const started = performance.now();
  const graph = new Graph({ type: "directed", multi: false });
  const positions = placeNodes(garden.nodes);
  for (const node of garden.nodes) {
    const position = positions.get(node.id) ?? { x: 0, y: 0 };
    graph.addNode(node.id, {
      label: node.label,
      kind: node.kind,
      size: SIZE_BY_KIND[node.kind],
      color: COLOR_BY_KIND[node.kind],
      x: position.x,
      y: position.y,
    });
  }
  for (const edge of garden.edges) {
    graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
      kind: edge.kind,
      color: EDGE_COLOR[edge.kind],
      size: edge.kind === "partOf" ? 0.6 : 1.4,
    });
  }
  const buildMs = performance.now() - started;
  const mountStarted = performance.now();
  const sigma = new Sigma(graph, container);
  const mountMs = performance.now() - mountStarted;
  const round = (value: number) => Math.round(value * 10) / 10;
  return new Promise((resolve) => {
    const finish = (confirmed: boolean) =>
      resolve({
        sigma,
        stats: {
          nodeCount: graph.order,
          edgeCount: graph.size,
          buildMs: round(buildMs),
          mountMs: round(mountMs),
          renderConfirmedMs: confirmed ? round(performance.now() - started) : null,
        },
      });
    const timer = setTimeout(() => finish(false), 5000);
    sigma.once("afterRender", () => {
      clearTimeout(timer);
      finish(true);
    });
    sigma.scheduleRefresh();
  });
}
