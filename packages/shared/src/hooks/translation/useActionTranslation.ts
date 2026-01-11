import { useTranslation } from "./useTranslation";

export function useActionTranslation(action: Action | null) {
  // Translate only the UI-facing fields
  const translatedTitle = useTranslation(action?.title);
  const translatedDescription = useTranslation(action?.description);
  const translatedMediaInfo = useTranslation(action?.mediaInfo);
  const translatedDetails = useTranslation(action?.details);
  const translatedReview = useTranslation(action?.review);
  // Inputs are complex objects with WorkInput[], translate as Record<string, unknown>
  const translatedInputs = useTranslation(
    action?.inputs as unknown as Record<string, unknown>[] | undefined
  );

  if (!action) {
    return { translatedAction: null, isTranslating: false };
  }

  const isTranslating =
    translatedTitle.isTranslating ||
    translatedDescription.isTranslating ||
    translatedMediaInfo.isTranslating ||
    translatedDetails.isTranslating ||
    translatedReview.isTranslating ||
    translatedInputs.isTranslating;

  return {
    translatedAction: {
      ...action,
      title: translatedTitle.translated || action.title,
      description: translatedDescription.translated || action.description,
      mediaInfo: translatedMediaInfo.translated || action.mediaInfo,
      details: translatedDetails.translated || action.details,
      review: translatedReview.translated || action.review,
      inputs: (translatedInputs.translated as unknown as WorkInput[]) || action.inputs,
    } as Action,
    isTranslating,
  };
}
