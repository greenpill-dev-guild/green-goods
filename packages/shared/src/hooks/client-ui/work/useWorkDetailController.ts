import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { createQueueToasts } from "../../../components/Toast/presets/queue";
import { toastService } from "../../../components/Toast/toast.service";
import { logger } from "../../../modules/app/logger";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { worksKeys } from "../../../config/query-keys/work";
import { jobQueue } from "../../../modules/job-queue/default-instance";
import type { JobSendPhase } from "../../../modules/job-queue/ports";
import { takeUpOf } from "../../../modules/job-queue/take-up-hold";
import { readWorkByUID } from "../../../modules/work/work-list";
import {
  type OverlayWork,
  resolveGardenWorkRows,
} from "../../../modules/work/local-status-overlay";
import { connectivityStore } from "../../../stores/connectivity";
import { useDashboardNavigation } from "../useDashboardNavigation";
import { isUserAddress } from "../../../utils/blockchain/address";
import { isValidAttestationId, openEASExplorer } from "../../../utils/eas/explorers";
import {
  downloadWorkData,
  downloadWorkMedia,
  shareWork,
  type WorkData,
} from "../../../utils/work/workActions";
import { useNavigateToTop } from "../../app/useNavigateToTop";
import { useOnlineStatus } from "../../app/useOnlineStatus";
import { useUser } from "../../auth/useUser";
import { useActions, useGardens } from "../../blockchain/useBaseLists";
import { useTransactionSender } from "../../blockchain/useTransactionSender";
import { useGardenPermissions } from "../../garden/useGardenPermissions";
import { useWorkApprovalActions } from "../../work/useWorkApprovalActions";
import { useWorkMetadata } from "../../work/useWorkMetadata";
import { useWorks } from "../../work/useWorks";
import { useWorkVisibility } from "../../work/useWorkVisibility";
import { queuedUploadStatus } from "../../../modules/work/upload-state";
import { isCancelledTxError } from "../../../utils/errors/tx-error-classifier";
import { WALLET_RECONNECT_REQUIRED } from "../../../utils/errors/unsent-failures";
import type { Work, WorkDisplayStatus } from "../../../types/domain";

export type WorkViewingMode = "steward" | "gardener" | "viewer";

/**
 * The work a notification row carried in the route's state, when it is this route's work in
 * this route's garden. History state outlives the screen that wrote it, so it is read as
 * untrusted input.
 */
function carriedRouteWork(
  candidate: unknown,
  workId: string | undefined,
  gardenId: string | undefined
): Work | undefined {
  if (!candidate || typeof candidate !== "object" || !workId || !gardenId) return undefined;
  const { id, gardenAddress, status, media } = candidate as Partial<Work>;
  if (typeof id !== "string" || typeof gardenAddress !== "string") return undefined;
  if (typeof status !== "string" || !Array.isArray(media)) return undefined;
  if (id.toLowerCase() !== workId.toLowerCase()) return undefined;
  return gardenAddress.toLowerCase() === gardenId.toLowerCase() ? (candidate as Work) : undefined;
}

export function useWorkDetailController() {
  const intl = useIntl();
  const { id: gardenIdParam, workId } = useParams<{ id: string; workId: string }>();
  const { gardenId: gardenIdFromContext } = (useOutletContext() as { gardenId?: string }) || {};
  const navigateToTop = useNavigateToTop();
  const navigate = useNavigate();
  const dashboardNavigation = useDashboardNavigation();
  const location = useLocation();
  const queryClient = useQueryClient();
  const isOnline = useOnlineStatus();
  const chainId = DEFAULT_CHAIN_ID;
  const visibility = useWorkVisibility(chainId);
  const { data: gardens = [], isLoading: gardensLoading } = useGardens();
  const gardenId = (gardenIdFromContext || gardenIdParam) as string;
  const garden = gardens.find((candidate) => candidate.id === gardenId);
  const { data: actions = [] } = useActions(chainId);
  const {
    works,
    isLoading: worksLoading,
    queuedLoading,
  } = useWorks(gardenId || "", {
    offline: true,
  });
  const listedWork = works.find((candidate) => candidate.id === (workId || ""));
  const routeState = location.state as
    | { workStatus?: WorkDisplayStatus; work?: unknown }
    | null
    | undefined;
  const routeStatus = routeState?.workStatus;
  // A notification row can open a work outside the garden's loaded page, and offline the direct
  // read below is paused, so the record the row carried opens it when nothing fresher has.
  const routeWork = carriedRouteWork(routeState?.work, workId, gardenId);
  const workByUID = useQuery({
    queryKey: worksKeys.byUID(workId ?? "", chainId),
    queryFn: () => readWorkByUID(workId!, chainId, visibility.snapshot),
    enabled:
      visibility.isReady && !listedWork && !!workId && isValidAttestationId(workId) && isOnline,
  });
  // A direct read of older work may be stale too. Use the same saved decision
  // as the garden list while the indexer catches up.
  const decisionOverlayKey = worksKeys.merged(gardenId || "", chainId);
  const { data: decisionOverlay } = useQuery<OverlayWork[], Error, OverlayWork | undefined>({
    queryKey: decisionOverlayKey,
    queryFn: () => queryClient.getQueryData<OverlayWork[]>(decisionOverlayKey) ?? [],
    enabled: false,
    select: (rows) => rows.find((row) => row.id === workId),
  });
  const fetchedWork = useMemo(() => {
    const row = workByUID.data;
    if (!row || row.gardenAddress.toLowerCase() !== gardenId.toLowerCase()) return undefined;
    const saved = routeStatus ? [{ ...row, status: routeStatus }] : undefined;
    return resolveGardenWorkRows({
      remote: [row],
      saved,
      overlay: decisionOverlay ? [decisionOverlay] : undefined,
    }).rows[0];
  }, [workByUID.data, gardenId, routeStatus, decisionOverlay]);
  // Online, the direct read decides: a carried row may be stale (another steward decided the work),
  // so it never stands in, and never offers a decision, before that read answers.
  const candidate = listedWork ?? fetchedWork ?? (isOnline ? undefined : routeWork);
  const work = candidate && visibility.isVisible(candidate.id) ? candidate : undefined;
  const metadata = useWorkMetadata(work?.metadata);
  const matchedAction = useMemo(() => {
    if (!work) return null;
    return actions.find((action) => action.id === `${chainId}-${work.actionUID}`) ?? null;
  }, [actions, chainId, work]);
  const { user } = useUser();
  const transactionSender = useTransactionSender();
  const permissions = useGardenPermissions();
  const [isRetrying, setIsRetrying] = useState(false);
  // Where Upload now's send stands while it runs: the wallet is asked, then the chain confirms.
  const [sendStage, setSendStage] = useState<JobSendPhase["stage"] | null>(null);
  const onPhase = (phase: JobSendPhase) => setSendStage(phase.stage);

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
    onApprovalComplete: (id) => {
      if (!dashboardNavigation.back()) navigateToTop(`/home/${id || gardenIdParam || ""}`);
    },
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

  const reportNotSent = () =>
    toastService.info({
      title: intl.formatMessage({ id: "app.offline.degraded" }),
      message: intl.formatMessage({ id: "app.work.connectionUnconfirmed" }),
      context: "work upload",
    });

  /**
   * One toast answers an Upload now that did not send, in the app's words, never the error's
   * (DL-177). A send the queue gave up on already raised the queue's own failure toast; this one
   * takes its place under the same id, so the page shows one toast that points at the page's own
   * Upload now. A send the queue held without failing is not called a failure: one whose answer
   * was lost, or that is already being sent (by this tab's sync or another tab), is being
   * checked, and any other is not sent yet and still saved.
   */
  const reportUploadNowOutcome = ({ error, skipped }: { error?: string; skipped?: boolean }) => {
    if (skipped) {
      const checking = error === "awaiting-confirmation" || error === "already-processing";
      toastService.info({
        id: "work-upload",
        title: intl.formatMessage({
          id: checking ? "app.home.work.checking.title" : "app.home.work.held.title",
        }),
        message: intl.formatMessage({
          id: checking ? "app.home.work.checking.message" : "app.home.work.held.message",
        }),
        devMessage: error,
        context: "work upload",
      });
      return;
    }
    toastService.error({
      id: "work-upload",
      title: intl.formatMessage({ id: "app.home.work.retryFailed", defaultMessage: "Didn't send" }),
      message: intl.formatMessage({ id: "app.home.work.retryStillSaved" }),
      devMessage: error,
      context: "work upload",
    });
  };

  const retry = async () => {
    if (!transactionSender || !work) return;
    setIsRetrying(true);
    try {
      // The tap checks the connection now, so nothing is signed on one that may drop the send.
      if (!(await connectivityStore.confirmOnline())) {
        reportNotSent();
        return;
      }
      // The queue refuses a work that reverted or used up its retries, so the
      // tap gives it its retries back first. Without this, Upload now on either
      // one answers with the refusal instead of sending.
      const queued = await jobQueue.getJobs(user?.id ?? work.gardenerAddress, { synced: false });
      const job = queued.find((candidate) => candidate.id === work.id);
      if (job && ["failed", "reverted"].includes(queuedUploadStatus(job).state))
        await jobQueue.retryJob(work.id);
      // Work for a promise taken up in the same tap goes after that take-up (decision 18), so
      // Upload now sends the take-up first, on a fresh run of tries, and the work once it lands.
      const takeUp = job ? takeUpOf(job, queued) : null;
      if (takeUp) {
        await jobQueue.retryJob(takeUp.id);
        const taken = await jobQueue.processJob(takeUp.id, {
          transactionSender,
          explicit: true,
          onPhase,
        });
        if (!taken.success) {
          // A wallet that has not answered was already asked to reconnect by its own prompt.
          if (
            isCancelledTxError(taken.error) ||
            taken.error === "send-cancelled" ||
            taken.error === WALLET_RECONNECT_REQUIRED
          )
            return;
          if (taken.error === "offline" || taken.error === "connection-unconfirmed") {
            reportNotSent();
            return;
          }
          // Still on its way: membership being read, or a send awaiting its receipt.
          if (taken.skipped) {
            toastService.info({
              id: "take-up",
              title: intl.formatMessage({ id: "app.home.work.takeUpQueued.title" }),
              message: intl.formatMessage({ id: "app.home.work.takeUpQueued.message" }),
              context: "work upload",
            });
            return;
          }
          // Refused. The queue raises its own take-up toast after it reads the work waiting on
          // the take-up, which can land after this one; raising that same toast here means
          // either order leaves one toast in the same words.
          createQueueToasts(intl.formatMessage).takeUpFailed();
          return;
        }
        // The take-up landed. The work's own send starts with its uploads, not a stage.
        setSendStage(null);
      }
      const result = await jobQueue.processJob(work.id, {
        transactionSender,
        explicit: true,
        onPhase,
      });
      // Declining the prompt is not a failure; the work stays ready to send. A wallet that has
      // not answered was already asked to reconnect by its own prompt.
      if (result.error === "send-cancelled" || result.error === WALLET_RECONNECT_REQUIRED) return;
      if (result.error === "offline" || result.error === "connection-unconfirmed") {
        reportNotSent();
        return;
      }
      if (!result.success) {
        reportUploadNowOutcome(result);
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
      logger.error("[WorkDetail] Upload now failed", { error, workId: work.id });
      reportUploadNowOutcome({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      setIsRetrying(false);
      setSendStage(null);
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
          defaultMessage: "Couldn't share work",
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
    if (dashboardNavigation.back()) return;
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
    workLoading:
      !work && (workByUID.isLoading || worksLoading || queuedLoading || visibility.isLoading),
    workLoadError: !work && (workByUID.isError || (!visibility.isReady && !visibility.isLoading)),
    retryWorkLoad: async () => {
      await visibility.refetch();
      return workByUID.refetch();
    },
    isActionExpired: matchedAction ? matchedAction.endTime <= Date.now() : false,
    isOfflineWork,
    isOnline,
    isRetrying,
    metadataError: metadata.error,
    metadataStatus: metadata.status,
    onChainWorkId,
    retry,
    retryMetadata: metadata.retryFetch,
    sendStage,
    share,
    viewAttestation,
    viewingMode,
    work,
    workMetadata: metadata.metadata,
  };
}
