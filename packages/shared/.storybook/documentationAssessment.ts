/** One fictional initial-assessment scenario across all documentation steps. */
import type { CreateAssessmentFormState } from "../src/stores/useCreateAssessmentStore";
import { CynefinPhase, Domain, type Action } from "../src/types/domain";
import { DEFAULT_CHAIN_ID } from "../src/config/default-chain";
export const DOCUMENTATION_ASSESSMENT_ACTIONS: Action[] = [
  { id: `${DEFAULT_CHAIN_ID}-44`, title: "Seedling transplant", slug: "agro.seedling_transplant", domain: Domain.AGRO, startTime: 0, endTime: 0, createdAt: 0, capitals: [], media: [], description: "Transplant and water seedlings in the east beds.", inputs: [] },
  { id: `${DEFAULT_CHAIN_ID}-45`, title: "Seedling care", slug: "agro.seedling_care", domain: Domain.AGRO, startTime: 0, endTime: 0, createdAt: 0, capitals: [], media: [], description: "Check moisture and early survival.", inputs: [] },
];
export const DOCUMENTATION_ASSESSMENT: CreateAssessmentFormState = {
  title: "East beds: autumn planting baseline", description: "Record the starting conditions before the autumn planting and agree what the garden will measure.", location: "East beds, Riverside Commons Garden", diagnosis: "The east beds dry quickly after watering. Young transplants need mulch and regular moisture checks to establish before winter.",
  smartOutcomes: [{ description: "Native saplings establish in the east beds", metric: "treesPlanted", target: 36 }, { description: "Prepared beds retain moisture around the transplants", metric: "areaCoveredHa", target: 0.02 }],
  cynefinPhase: CynefinPhase.COMPLICATED, domain: Domain.AGRO, selectedActionUIDs: DOCUMENTATION_ASSESSMENT_ACTIONS.map((action) => action.id), sdgTargets: [], reportingPeriodStart: "2026-10-01", reportingPeriodEnd: "2026-11-30", attachments: [],
};
