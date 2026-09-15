import {
  type MediaStatsReply,
  OFFLINE_CONTENT_VERSION,
  type OfflineContentCapabilitiesReply,
  type QuietAckReply,
  type ServiceWorkerMessage,
  SW_MESSAGE,
  SW_REPLY,
  type TailStatus,
  type UpdateAckReply,
  type UpdateAckStatus,
} from "@green-goods/shared/modules/app/service-worker-protocol";
import type { BackgroundWork } from "./background-work";
import type { MediaCache } from "./media";
import { registerBackgroundSync } from "./runtime";
import type { PwaShell } from "./shell";

export interface MessageDependencies {
  scope: ServiceWorkerGlobalScope;
  shell: PwaShell;
  media: MediaCache;
  work: BackgroundWork;
}

function readPolicy(data: unknown): { budgetBytes: number; keep: string[] } | null {
  const message = data as Partial<{ budgetBytes: unknown; keep: unknown }>;
  const budgetBytes = Number(message?.budgetBytes);
  if (!Number.isFinite(budgetBytes) || budgetBytes <= 0) return null;
  return { budgetBytes, keep: Array.isArray(message.keep) ? message.keep.map(String) : [] };
}

/** Answer the page's messages; replies go to the port the page attached. */
export function createMessageHandler({ scope, shell, media, work }: MessageDependencies) {
  return (event: ExtendableMessageEvent): void => {
    const message = event.data as ServiceWorkerMessage | undefined;
    const port = event.ports[0];
    const reply = (value: unknown) => port?.postMessage(value);
    switch (message?.type) {
      case SW_MESSAGE.PAUSE_PWA_TAIL:
        shell.pauseTail();
        reply({ status: "paused" satisfies TailStatus });
        return;
      case SW_MESSAGE.PREPARE_PWA_TAIL: {
        if (!work.isAccepting) {
          reply({ status: "blocked" satisfies TailStatus });
          return;
        }
        event.waitUntil(
          work.track(shell.prepareTail()).then(
            (metadata) =>
              reply({
                status: (metadata?.tailReady ? "ready" : "unavailable") satisfies TailStatus,
              }),
            (error: unknown) =>
              reply({
                status: ((error as { name?: string })?.name === "AbortError"
                  ? "paused"
                  : "failed") satisfies TailStatus,
              })
          )
        );
        return;
      }
      case SW_MESSAGE.PREPARE_TO_ACTIVATE_UPDATE:
        event.waitUntil(
          work
            .quiet(() => shell.pauseTail())
            .then(
              () => reply({ type: SW_REPLY.QUIET_ACK, status: "quiet" } satisfies QuietAckReply),
              () => reply({ type: SW_REPLY.QUIET_ACK, status: "failed" } satisfies QuietAckReply)
            )
        );
        return;
      case SW_MESSAGE.RESUME_BACKGROUND_WORK:
        work.resume();
        reply({ status: "resumed" });
        return;
      case SW_MESSAGE.OFFLINE_CONTENT_CAPABILITIES:
        reply({
          offlineContentVersion: OFFLINE_CONTENT_VERSION,
        } satisfies OfflineContentCapabilitiesReply);
        return;
      case SW_MESSAGE.MEDIA_POLICY: {
        const policy = readPolicy(message);
        if (!policy) {
          reply({ failed: true });
          return;
        }
        event.waitUntil(
          work.track(media.writePolicy(policy)).then(
            () => reply({ ready: true }),
            () => reply({ failed: true })
          )
        );
        return;
      }
      case SW_MESSAGE.MEDIA_STATS:
      case SW_MESSAGE.MEDIA_SWEEP: {
        const policy = message.type === SW_MESSAGE.MEDIA_SWEEP ? readPolicy(message) : null;
        const result =
          message.type === SW_MESSAGE.MEDIA_SWEEP
            ? policy
              ? media.sweep({ ...policy, persistPolicy: true })
              : Promise.reject(new Error("Invalid offline media budget"))
            : media.stats();
        event.waitUntil(
          work.track(result).then(
            (stats) => reply(stats satisfies MediaStatsReply),
            () => reply({ bytes: 0, count: 0, failed: true } satisfies MediaStatsReply)
          )
        );
        return;
      }
      case SW_MESSAGE.REGISTER_SYNC:
        event.waitUntil(registerBackgroundSync(scope));
        return;
      case SW_MESSAGE.SKIP_WAITING: {
        const ack = (status: UpdateAckStatus) =>
          reply({ type: SW_REPLY.UPDATE_ACK, status } satisfies UpdateAckReply);
        ack("received");
        event.waitUntil(
          Promise.resolve()
            .then(() => scope.skipWaiting())
            .then(
              () => ack("requested"),
              () => ack("rejected")
            )
        );
        return;
      }
      case SW_MESSAGE.ENS_REGISTRATION_COMPLETE: {
        const slug = message.slug ?? "";
        event.waitUntil(
          scope.registration.showNotification("ENS Name Active", {
            body: `Your name ${slug}.greengoods.eth is now active!`,
            icon: "/icon-192.png",
            badge: "/images/android-icon-72x72.png",
            tag: `ens-complete-${slug}`,
            data: { url: "/home/profile", slug },
          })
        );
        return;
      }
      default:
        return;
    }
  };
}
