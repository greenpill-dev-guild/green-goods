import { useCallback } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { toastService } from "../../../components/Toast/toast.service";
import { logger } from "../../../modules/app/logger";
import type { Address, Garden } from "../../../types/domain";
import { useJoinGarden } from "../../garden/useJoinGarden";

interface UseCommunityGardenOnrampOptions {
  /** The Community Garden a gardener with no garden of their own can join from the flow. */
  garden: Garden | null;
  /** Selects the joined garden for the work being composed. */
  selectGarden: (value: Address | null) => void;
  profileRoute: string;
}

/**
 * Joins the Community Garden from the work flow and says how it went. A join already in flight is
 * left alone, and a failed join offers Profile, where the gardener can join from their garden list.
 */
export function useCommunityGardenOnramp({
  garden,
  selectGarden,
  profileRoute,
}: UseCommunityGardenOnrampOptions) {
  const intl = useIntl();
  const navigate = useNavigate();
  const join = useJoinGarden();

  const joinCommunityGarden = useCallback(async () => {
    if (!garden?.id) return;
    try {
      const result = await join.joinGarden(garden.id);
      if (result === "already-joining") return;
      selectGarden(garden.id as Address);
      toastService.success({
        title:
          result === "already-member"
            ? intl.formatMessage({
                id: "app.garden.alreadyMember",
                defaultMessage: "You are already a member of this garden",
              })
            : intl.formatMessage({
                id: "app.garden.joinSuccess",
                defaultMessage: "Successfully joined garden",
              }),
      });
    } catch (error) {
      logger.error("Community Garden join failed", {
        error,
        source: "GardenFlow",
        gardenAddress: garden.id,
      });
      toastService.error({
        title: intl.formatMessage({
          id: "app.garden.joinError",
          defaultMessage: "Failed to join garden",
        }),
        message: intl.formatMessage({
          id: "app.garden.communityOnramp.errorMessage",
          defaultMessage: "Try again here, or open Profile to join from your garden list.",
        }),
        action: {
          label: intl.formatMessage({ id: "app.profile", defaultMessage: "Profile" }),
          onClick: () => navigate(profileRoute),
          dismissOnClick: true,
        },
      });
    }
  }, [intl, join, garden, navigate, profileRoute, selectGarden]);

  return {
    joinCommunityGarden,
    isJoiningCommunityGarden:
      join.isJoining && (!join.joiningGardenId || join.joiningGardenId === garden?.id),
  };
}
