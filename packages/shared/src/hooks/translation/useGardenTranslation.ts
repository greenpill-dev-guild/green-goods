import { useTranslation } from "../useTranslation";

export function useGardenTranslation(garden: Garden | null) {
  const translatedName = useTranslation(garden?.name);
  const translatedDescription = useTranslation(garden?.description);
  const translatedLocation = useTranslation(garden?.location);

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
