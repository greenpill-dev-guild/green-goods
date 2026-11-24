import type { WorkInput } from "@green-goods/shared/types/domain";

/**
 * A work input's label, naming its unit once. An action's title often carries
 * the unit already ("Delivered Duration (min)"), so the unit is added only when
 * the title does not show it.
 */
export function workInputLabel(input: Pick<WorkInput, "title" | "unit">): string {
  const unit = input.unit?.trim();
  if (!unit) return input.title;
  const shown = input.title.toLocaleLowerCase().includes(`(${unit.toLocaleLowerCase()})`);
  return shown ? input.title : `${input.title} (${unit})`;
}
