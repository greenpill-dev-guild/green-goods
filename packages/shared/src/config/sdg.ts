/**
 * UN Sustainable Development Goals (SDGs) constants.
 * 17 goals with numeric IDs (1-17) and official short labels.
 *
 * @see https://sdgs.un.org/goals
 */

export interface SDGTarget {
  id: number;
  label: string;
}

export const SDG_TARGETS: readonly SDGTarget[] = [
  { id: 1, label: "No Poverty" },
  { id: 2, label: "Zero Hunger" },
  { id: 3, label: "Good Health and Well-being" },
  { id: 4, label: "Quality Education" },
  { id: 5, label: "Gender Equality" },
  { id: 6, label: "Clean Water and Sanitation" },
  { id: 7, label: "Affordable and Clean Energy" },
  { id: 8, label: "Decent Work and Economic Growth" },
  { id: 9, label: "Industry, Innovation and Infrastructure" },
  { id: 10, label: "Reduced Inequalities" },
  { id: 11, label: "Sustainable Cities and Communities" },
  { id: 12, label: "Responsible Consumption and Production" },
  { id: 13, label: "Climate Action" },
  { id: 14, label: "Life Below Water" },
  { id: 15, label: "Life on Land" },
  { id: 16, label: "Peace, Justice and Strong Institutions" },
  { id: 17, label: "Partnerships for the Goals" },
] as const;

/** Valid SDG goal IDs (1-17) */
export type SDGGoalId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17;

/** Look up an SDG target by its ID */
export function getSDGLabel(id: number): string | undefined {
  return SDG_TARGETS.find((t) => t.id === id)?.label;
}
