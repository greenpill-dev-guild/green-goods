import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { toastService } from "../../../components/Toast/toast.service";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { worksKeys } from "../../../config/query-keys/work";
import { jobQueue } from "../../../modules/job-queue/default-instance";
import { isUserAddress } from "../../../utils/blockchain/address";
import { isValidAttestationId, openEASExplorer } from "../../../utils/eas/explorers";
import {
  downloadWorkData,
  downloadWorkMedia,
  shareWork,
  type WorkData,
} from "../../../utils/work/workActions";
import { useNavigateToTop } from "../../app/useNavigateToTop";
import { useOffline } from "../../app/useOffline";
import { useUser } from "../../auth/useUser";
import { useActions, useGardens } from "../../blockchain/useBaseLists";
import { useTransactionSender } from "../../blockchain/useTransactionSender";
import { useGardenPermissions } from "../../garden/useGardenPermissions";
import { useWorkApprovalActions } from "../../work/useWorkApprovalActions";
import { useWorkMetadata } from "../../work/useWorkMetadata";
import { useWorks } from "../../work/useWorks";

export type WorkViewingMode = "steward" | "gardener" | "viewer";

export function useWorkDetailController() {
  const intl = useIntl();
  const { id: gardenIdParam, workId } = useParams<{ id: string; workId: string }>();
  const { gardenId: gardenIdFromContext } = (useOutletContext() as { gardenId?: string }) || {};
  const navigateToTop = useNavigateToTop();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isOnline } = useOffline();
  const chainId = DEFAULT_CHAIN_ID;
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const gardenId = (gardenIdFromContext || gardenIdParam) as string;
  const garden = gardens.find((candidate) => candidate.id === gardenId);
  const { data: actions = [] } = useActions(chainId);
  const { works } = useWorks(gardenId || "", { offline: true });
  const work = works.find((candidate) => candidate.id === (workId || ""));
  const metadata = useWorkMetadata(work?.metadata);
  const matchedAction = useMemo(() => {
    if (!work) return null;
    return actions.find((action) => action.id === `${chainId}-${work.actionUID}`) ?? null;
  }, [actions, chainId, work]);
  const { user } = useUser();
  const transactionSender = useTransactionSender();
  const permissions = useGardenPermissions();
  const [isRetrying, setIsRetrying] = useState(false);

  const viewingMode = useMemo<WorkViewingMode>(() => {
    if (!garden || !work) return "viewer";
    if (permissions.canManageGarden(garden)) return "steward";
    if (isUserAddress(work.gardenerAddress, user?.id)) return "gardener";
    return "viewer";
  }, [garden, permissions, user?.id, work]);

  const approval = useWorkApprovalActions({
    work,
    gardenId: garden?.id,
    chainId,
    viewingMode,
    onApprovalComplete: (id) => navigateToTop(`/home/${id || gardenIdParam || ""}`),
  });
  const isOfflineWork = Boolean(
    work?.id.startsWith("0xoffline_") || (work?.id && !work.id.startsWith("0x"))
  );

  const toWorkData = (): WorkData | null =>
    work
      ? {
          id: work.id,
          title: work.feedback || `Work ${work.id}`,
          description: work.feedback,
          status: work.status,
          createdAt: work.createdAt,
          media: work.media || [],
          metadata: metadata.metadata,
          feedback: work.feedback,
          gardenId: garden?.id || "",
        }
      : null;

  const retry = async () => {
    if (!transactionSender || !work) return;
    setIsRetrying(true);
    try {
      const result = await jobQueue.processJob(work.id, { transactionSender });
      if (!result.success) {
        toastService.error({
          title: intl.formatMessage({
            id: "app.home.work.retryFailed",
            defaultMessage: "Sending failed",
          }),
          message:
            result.error ||
            intl.formatMessage({
              id: "app.home.work.retryFailedMessage",
              defaultMessage: "Please try again.",
            }),
          context: "work upload",
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: worksKeys.merged(gardenId, chainId) });
      queryClient.invalidateQueries({ queryKey: worksKeys.offline(gardenId) });
      toastService.success({
        title: intl.formatMessage({
          id: "app.home.work.retrySuccess",
          defaultMessage: "Your work was sent",
        }),
        message: intl.formatMessage({
          id: "app.home.work.retrySuccessMessage",
          defaultMessage: "Saved to the garden record.",
        }),
        context: "work upload",
      });
    } catch (error) {
      toastService.error({
        title: intl.formatMessage({
          id: "app.home.work.retryError",
          defaultMessage: "Couldn't send your work",
        }),
        message:
          error instanceof Error
            ? error.message
            : intl.formatMessage({
                id: "app.home.work.unknownError",
                defaultMessage: "Something went wrong",
              }),
        context: "work upload",
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const downloadMedia = async () => {
    const data = toWorkData();
    if (!data) return;
    try {
      await downloadWorkMedia(data);
    } catch (error) {
      toastService.error({
        title: intl.formatMessage({
          id: "app.home.work.downloadMediaFailed",
          defaultMessage: "Failed to download media",
        }),
        message: error instanceof Error ? error.message : "Unknown error",
        context: "work media download",
      });
    }
  };
  const downloadData = () => {
    const data = toWorkData();
    if (!data) return;
    try {
      downloadWorkData(data);
    } catch (error) {
      toastService.error({
        title: intl.formatMessage({
          id: "app.home.work.downloadDataFailed",
          defaultMessage: "Failed to download data",
        }),
        message: error instanceof Error ? error.message : "Unknown error",
        context: "work data download",
      });
    }
  };
  const share = async () => {
    const data = toWorkData();
    if (!data) return;
    try {
      await shareWork(data);
    } catch (error) {
      toastService.error({
        title: intl.formatMessage({
          id: "app.home.work.shareFailed",
          defaultMessage: "Failed to share work",
        }),
        message: error instanceof Error ? error.message : "Unknown error",
        context: "work sharing",
      });
    }
  };
  const onChainWorkId = work?.id && isValidAttestationId(work.id) ? work.id : null;
  const viewAttestation = () => {
    if (onChainWorkId) openEASExplorer(chainId, onChainWorkId);
  };
  const back = () => {
    const state = (location.state as { from?: string; returnTo?: string } | null | undefined) ?? {};
    if (state.from === "dashboard") return navigateToTop("/home");
    if (state.returnTo) return navigateToTop(state.returnTo);
    if (gardenId) return navigateToTop(`/home/${gardenId}`);
    if (window.history.length > 1) return navigate(-1);
    navigateToTop("/home");
  };

  return {
    ...approval,
    actionTitle: matchedAction?.title ?? null,
    back,
    canViewAttestation: onChainWorkId !== null,
    chainId,
    downloadData,
    downloadMedia,
    garden,
    gardenId,
    gardensLoading,
    isActionExpired: matchedAction ? matchedAction.endTime <= Date.now() / 1000 : false,
    isOfflineWork,
    isOnline,
    isRetrying,
    metadataError: metadata.error,
    metadataStatus: metadata.status,
    onChainWorkId,
    retry,
    retryMetadata: metadata.retryFetch,
    share,
    viewAttestation,
    viewingMode,
    work,
    workMetadata: metadata.metadata,
  };
}
