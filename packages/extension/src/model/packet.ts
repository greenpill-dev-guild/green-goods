import { PREDICATES, type Predicate } from "../graph/synthetic";

// The one fixed investigation packet G0 feeds the model. The chunks are invented text written
// for this spike. Chunk c3 is a distractor: it supports no connection to any target.

export interface SourceChunk {
  id: string;
  text: string;
}

export interface PacketTarget {
  id: string;
  kind: "action" | "question" | "concept";
  label: string;
}

export interface InvestigationPacket {
  packetId: string;
  gardenId: string;
  sourceTitle: string;
  chunks: SourceChunk[];
  targets: PacketTarget[];
  predicates: readonly Predicate[];
  maxProposals: number;
}

export const G0_PACKET: InvestigationPacket = {
  packetId: "g0-fixed-packet-1",
  gardenId: "garden:cedar-hollow",
  sourceTitle: "Alley cropping notes for small plots (synthetic)",
  chunks: [
    {
      id: "c1",
      text:
        "On the plots we measured, a wood chip layer between eight and ten centimetres kept the top " +
        "soil damp for nine days after watering, against four days on bare beds. Thinner layers " +
        "dried almost as fast as bare soil, and layers above twelve centimetres slowed seedling " +
        "emergence in spring.",
    },
    {
      id: "c2",
      text:
        "A hedgerow of alder and sea buckthorn on the windward edge gave the alleys shelter within " +
        "three seasons. Both species carry root nodules with Frankia bacteria, so they fix nitrogen " +
        "without a legume inoculant, and leaf drop from the alder raised soil nitrogen in the " +
        "nearest alley by a measurable amount in the second autumn.",
    },
    {
      id: "c3",
      text:
        "Volunteer sessions ran on the first Saturday of each month. Tools were counted out and " +
        "back in by the session lead, and the shared calendar listed who held the gate key. Most " +
        "sessions lasted three hours and ended with tea.",
    },
    {
      id: "c4",
      text:
        "Compost built from alley prunings reached sixty degrees Celsius within five days when the " +
        "pile held at least one cubic metre and was turned on day five and day twelve. Smaller piles " +
        "never passed forty-five degrees and took a full season to finish.",
    },
  ],
  targets: [
    { id: "action:compost-trial", kind: "action", label: "Compost trial on bed 2" },
    { id: "action:mulch-beds", kind: "action", label: "Mulch the annual beds" },
    { id: "action:hedgerow-planting", kind: "action", label: "Plant the north hedgerow" },
    { id: "action:rainwater-tanks", kind: "action", label: "Install rainwater tanks" },
    { id: "question:hedgerow-nitrogen", kind: "question", label: "Which hedgerow species fix nitrogen in this climate?" },
    { id: "question:mulch-depth", kind: "question", label: "How deep should the wood chip mulch be on bed 2?" },
    { id: "question:compost-turning", kind: "question", label: "How often should the compost pile be turned?" },
    { id: "concept:nitrogen-fixation", kind: "concept", label: "Nitrogen fixation" },
    { id: "concept:soil-moisture", kind: "concept", label: "Soil moisture" },
    { id: "concept:thermophilic-composting", kind: "concept", label: "Thermophilic composting" },
  ],
  predicates: PREDICATES,
  maxProposals: 3,
};
