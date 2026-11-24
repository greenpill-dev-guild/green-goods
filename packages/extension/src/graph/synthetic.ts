// A deterministic synthetic garden graph for the G0 spike. Every name is invented; nothing here
// describes a real garden, person or place. The shape follows the prototype vocabulary
// (decision 9): Garden, Action, Work, Source, Question, Concept, and the four predicates.

export type NodeKind = "garden" | "action" | "work" | "source" | "question" | "concept";

export type Predicate = "informedBy" | "relevantTo" | "addresses" | "aboutConcept";

export type EdgeKind = Predicate | "partOf";

export interface GardenNode {
  id: string;
  kind: NodeKind;
  label: string;
}

export interface GardenEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
}

export interface SyntheticGarden {
  nodes: GardenNode[];
  edges: GardenEdge[];
}

export const PREDICATES: readonly Predicate[] = ["informedBy", "relevantTo", "addresses", "aboutConcept"];

const GARDEN = { id: "garden:cedar-hollow", label: "Cedar Hollow Community Garden" };

const ACTIONS = [
  ["compost-trial", "Compost trial on bed 2"],
  ["mulch-beds", "Mulch the annual beds"],
  ["hedgerow-planting", "Plant the north hedgerow"],
  ["rainwater-tanks", "Install rainwater tanks"],
  ["seed-library", "Run the seed library"],
  ["soil-sampling", "Sample soil each season"],
] as const;

const SOURCES = [
  ["agroforestry-note", "Alley cropping notes for small plots"],
  ["compost-temperature-guide", "Compost temperature guide"],
  ["mulch-field-sheet", "Wood chip mulch field sheet"],
  ["hedgerow-species-list", "Hedgerow species list for cool climates"],
  ["rain-capture-handbook", "Rain capture handbook"],
  ["seed-saving-primer", "Seed saving primer"],
] as const;

const CONCEPTS = [
  ["soil-moisture", "Soil moisture"],
  ["nitrogen-fixation", "Nitrogen fixation"],
  ["thermophilic-composting", "Thermophilic composting"],
  ["windbreaks", "Windbreaks"],
  ["water-storage", "Water storage"],
  ["seed-viability", "Seed viability"],
  ["soil-organic-matter", "Soil organic matter"],
] as const;

const QUESTIONS = [
  ["hedgerow-nitrogen", "Which hedgerow species fix nitrogen in this climate?"],
  ["mulch-depth", "How deep should the wood chip mulch be on bed 2?"],
  ["compost-turning", "How often should the compost pile be turned?"],
  ["tank-size", "What tank volume covers a dry August?"],
  ["seed-storage", "How long do saved brassica seeds stay viable?"],
  ["soil-test-cadence", "Is one soil test per season enough?"],
] as const;

const WORK_PER_ACTION = 4;
const MONTHS = ["2026-03", "2026-04", "2026-05", "2026-06"] as const;

export function buildSyntheticGarden(): SyntheticGarden {
  const nodes: GardenNode[] = [{ id: GARDEN.id, kind: "garden", label: GARDEN.label }];
  const edges: GardenEdge[] = [];
  const edge = (source: string, target: string, kind: EdgeKind) => {
    edges.push({ id: `${kind}:${source}->${target}`, source, target, kind });
  };

  for (const [slug, label] of ACTIONS) {
    const id = `action:${slug}`;
    nodes.push({ id, kind: "action", label });
    edge(id, GARDEN.id, "partOf");
    for (let index = 0; index < WORK_PER_ACTION; index += 1) {
      const workId = `work:${MONTHS[index]}-${slug}`;
      nodes.push({ id: workId, kind: "work", label: `${label}, ${MONTHS[index]}` });
      edge(workId, id, "partOf");
    }
  }
  for (const [slug, label] of SOURCES) nodes.push({ id: `source:${slug}`, kind: "source", label });
  for (const [slug, label] of CONCEPTS) nodes.push({ id: `concept:${slug}`, kind: "concept", label });
  for (const [slug, label] of QUESTIONS) nodes.push({ id: `question:${slug}`, kind: "question", label });

  // Sources inform the actions they were saved for; questions are addressed by actions.
  edge("action:compost-trial", "source:compost-temperature-guide", "informedBy");
  edge("action:mulch-beds", "source:mulch-field-sheet", "informedBy");
  edge("action:hedgerow-planting", "source:hedgerow-species-list", "informedBy");
  edge("action:rainwater-tanks", "source:rain-capture-handbook", "informedBy");
  edge("action:seed-library", "source:seed-saving-primer", "informedBy");
  edge("source:agroforestry-note", "action:hedgerow-planting", "relevantTo");
  edge("source:agroforestry-note", "question:hedgerow-nitrogen", "relevantTo");
  edge("source:mulch-field-sheet", "question:mulch-depth", "relevantTo");
  edge("action:hedgerow-planting", "question:hedgerow-nitrogen", "addresses");
  edge("action:mulch-beds", "question:mulch-depth", "addresses");
  edge("action:compost-trial", "question:compost-turning", "addresses");
  edge("action:rainwater-tanks", "question:tank-size", "addresses");
  edge("action:seed-library", "question:seed-storage", "addresses");
  edge("action:soil-sampling", "question:soil-test-cadence", "addresses");
  edge("action:compost-trial", "concept:thermophilic-composting", "aboutConcept");
  edge("action:compost-trial", "concept:soil-organic-matter", "aboutConcept");
  edge("action:mulch-beds", "concept:soil-moisture", "aboutConcept");
  edge("action:hedgerow-planting", "concept:nitrogen-fixation", "aboutConcept");
  edge("action:hedgerow-planting", "concept:windbreaks", "aboutConcept");
  edge("action:rainwater-tanks", "concept:water-storage", "aboutConcept");
  edge("action:seed-library", "concept:seed-viability", "aboutConcept");
  edge("action:soil-sampling", "concept:soil-organic-matter", "aboutConcept");
  edge("source:agroforestry-note", "concept:nitrogen-fixation", "aboutConcept");
  edge("source:compost-temperature-guide", "concept:thermophilic-composting", "aboutConcept");

  return { nodes, edges };
}
