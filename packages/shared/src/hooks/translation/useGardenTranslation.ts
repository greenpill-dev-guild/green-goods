import type { Garden } from "../../types/domain";
import type { Translator } from "../../modules/translation/browser-translator";
import { useTranslation } from "./useTranslation";

export function useGardenTranslation(
  garden: Garden | null,
  options: { translator?: Translator } = {}
) {
  const translatedName = useTranslation(garden?.name, "en", options);
  const translatedDescription = useTranslation(garden?.description, "en", options);
  const translatedLocation = useTranslation(garden?.location, "en", options);

  if (!garden) {
    return { translatedGarden: null, isTranslating: false };
  }

  const isTranslating =
    translatedName.isTranslating ||
    translatedDescription.isTranslating ||
    translatedLocation.isTranslating;

  return {
    translatedGarden: {
      ...garden,
      name: translatedName.translated || garden.name,
      description: translatedDescription.translated || garden.description,
      location: translatedLocation.translated || garden.location,
    } as Garden,
    isTranslating,
  };
}
