/**
 * Garden reporting lab: the dashboard-name candidates (PRD-1485) and the words they share
 * with the workspaces inside the dashboard. Nothing here is decided.
 */
export type NameId = "current" | "garden-hub" | "steward-hub";
/** The Hub workspace keeps its name, or the lab tries "Review" to see the overlap go. */
export type HubLabel = "hub" | "review";

export interface NameCandidate {
  id: NameId;
  name: string;
  note: string;
}

export const NAME_CANDIDATES: readonly NameCandidate[] = [
  {
    id: "current",
    name: "Green Goods Admin",
    note: 'Today\'s browser title. The brand voice retires "admin" for stewards.',
  },
  {
    id: "garden-hub",
    name: "Garden Hub",
    note: "Candidate. Both of its words are already workspace names.",
  },
  {
    id: "steward-hub",
    name: "Steward Hub",
    note: 'Candidate. Names who it serves; shares "Hub" with the review workspace.',
  },
];

export function workspaceLabels(hubLabel: HubLabel) {
  return [hubLabel === "hub" ? "Hub" : "Review", "Garden", "Community", "Actions"];
}

/** The workspace names a dashboard name repeats, word for word. */
export function sharedWords(name: string, hubLabel: HubLabel) {
  const words = new Set(name.toLowerCase().split(/\s+/));
  return workspaceLabels(hubLabel).filter((label) => words.has(label.toLowerCase()));
}

export function candidateName(id: NameId) {
  return NAME_CANDIDATES.find((candidate) => candidate.id === id)?.name ?? NAME_CANDIDATES[0].name;
}
