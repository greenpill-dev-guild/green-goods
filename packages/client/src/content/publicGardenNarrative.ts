import type { IntlShape } from "react-intl";
import { publicCuration } from "./publicCuration";

/** Editorial summaries simplify the public introduction; other Gardens keep their authored text. */
export function getPublicGardenDescription(
  garden: { id: string; description?: string },
  formatMessage: IntlShape["formatMessage"]
): string {
  const id = publicCuration.gardenDescriptionIds[garden.id.toLowerCase()];
  return id ? formatMessage({ id }) : (garden.description ?? "");
}
