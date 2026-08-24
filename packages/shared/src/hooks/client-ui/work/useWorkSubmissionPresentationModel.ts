import { useMemo } from "react";
import { useIntl } from "react-intl";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import type { Action, Domain, Garden } from "../../../types/domain";
import { findActionByUID } from "../../../utils/action/parsers";
import { useActionTranslation } from "../../translation/useActionTranslation";
import { useGardenTranslation } from "../../translation/useGardenTranslation";

interface WorkSubmissionPresentationOptions {
  actions: Action[];
  gardens: Garden[];
  joinableCommunityGarden: Garden | null | undefined;
  actionUID: number | null;
  gardenAddress: string | null;
  selectedDomain: Domain | null;
}

export function useWorkSubmissionPresentationModel({
  actions,
  gardens,
  joinableCommunityGarden,
  actionUID,
  gardenAddress,
  selectedDomain,
}: WorkSubmissionPresentationOptions) {
  const intl = useIntl();
  const selectedAction = useMemo(
    () => (typeof actionUID === "number" ? findActionByUID(actions, actionUID) : null),
    [actionUID, actions]
  );
  const { translatedAction } = useActionTranslation(selectedAction);
  const selectedGarden = useMemo(
    () =>
      gardenAddress
        ? (gardens.find((garden) => garden.id === gardenAddress) ??
          (joinableCommunityGarden?.id === gardenAddress ? joinableCommunityGarden : null))
        : null,
    [gardenAddress, gardens, joinableCommunityGarden]
  );
  const { translatedGarden } = useGardenTranslation(selectedGarden);
  const mediaConfig = useMemo(() => {
    const defaults = {
      title: intl.formatMessage({ id: "app.garden.upload.title", defaultMessage: "Upload Media" }),
      description: intl.formatMessage({
        id: "app.garden.submit.tab.media.instruction",
        defaultMessage: "Please take a clear photo of the plants in the garden",
      }),
      required: false,
      needed: [] as string[],
      optional: [] as string[],
      maxImageCount: 0,
      minImageCount: undefined as number | undefined,
    };
    if (!translatedAction?.mediaInfo) return defaults;
    const {
      needed = [],
      optional = [],
      maxImageCount = 0,
      minImageCount,
      ...rest
    } = translatedAction.mediaInfo;
    return {
      ...defaults,
      ...rest,
      needed: Array.isArray(needed) ? needed : [],
      optional: Array.isArray(optional) ? optional : [],
      maxImageCount,
      minImageCount,
    };
  }, [intl, translatedAction]);
  const minRequired = mediaConfig.required ? (mediaConfig.minImageCount ?? 1) : 0;
  const detailsConfig = useMemo(() => {
    const defaults = {
      title: intl.formatMessage({
        id: "app.garden.details.title",
        defaultMessage: "Enter Details",
      }),
      description: intl.formatMessage({
        id: "app.garden.submit.tab.details.instruction",
        defaultMessage: "Provide detailed information and feedback",
      }),
      feedbackPlaceholder: intl.formatMessage({
        id: "app.garden.details.feedbackPlaceholder",
        defaultMessage: "Provide feedback or any observations",
      }),
    };
    return translatedAction?.details ? { ...defaults, ...translatedAction.details } : defaults;
  }, [intl, translatedAction]);
  const reviewConfig = useMemo(() => {
    const defaults = {
      title: intl.formatMessage({ id: "app.garden.review.title", defaultMessage: "Review Work" }),
      description: intl.formatMessage({
        id: "app.garden.submit.tab.review.instruction",
        defaultMessage: "Check if the information is correct",
      }),
    };
    return translatedAction?.review ? { ...defaults, ...translatedAction.review } : defaults;
  }, [intl, translatedAction]);
  const detailInputs = useMemo(() => translatedAction?.inputs ?? [], [translatedAction]);
  const reviewData = useMemo(() => {
    const garden: Garden = translatedGarden || {
      id: gardenAddress || "",
      chainId: DEFAULT_CHAIN_ID,
      tokenAddress: "",
      tokenID: 0n,
      name: intl.formatMessage({ id: "app.garden.unknown", defaultMessage: "Unknown Garden" }),
      description: "",
      location: "",
      bannerImage: "",
      gardeners: [],
      operators: [],
      evaluators: [],
      owners: [],
      funders: [],
      communities: [],
      assessments: [],
      works: [],
      createdAt: Date.now(),
    };
    const action: Action = translatedAction || {
      id: `${DEFAULT_CHAIN_ID}-${actionUID ?? 0}`,
      slug: "",
      domain: selectedDomain,
      startTime: Date.now(),
      endTime: Date.now(),
      title: intl.formatMessage({ id: "app.action.selected", defaultMessage: "Selected Action" }),
      instructions: "",
      capitals: [],
      media: ["/images/no-image-placeholder.png"],
      createdAt: Date.now(),
      description: "",
      inputs: detailInputs,
      mediaInfo: mediaConfig,
      details: detailsConfig,
      review: reviewConfig,
    };
    return { action, garden };
  }, [
    actionUID,
    detailInputs,
    detailsConfig,
    gardenAddress,
    intl,
    mediaConfig,
    reviewConfig,
    selectedDomain,
    translatedAction,
    translatedGarden,
  ]);

  return { detailInputs, detailsConfig, mediaConfig, minRequired, reviewConfig, reviewData };
}
