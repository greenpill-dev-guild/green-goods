import {
  RiCheckLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiLoader4Line,
  RiTimeLine,
} from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";
import type { ENSRegistrationData } from "../../types/domain";
import { useTimeout } from "../../hooks/utils/useTimeout";
import { copyToClipboard } from "../../utils/app/clipboard";
import { IconButton } from "../IconButton";
import { toastService } from "../toast";

interface ENSProgressTimelineProps {
  data: ENSRegistrationData;
  slug: string;
  className?: string;
  compact?: boolean;
  /** The profile card already supplies its own border and padding. */
  embedded?: boolean;
  /** Local submission and initial verification precede a confirmed status. */
  phase?: "submitting" | "checking";
}

/** Status is owned by the query; elapsed time alone cannot override confirmation. */
export function ENSProgressTimeline({
  data,
  slug,
  className,
  compact = false,
  embedded = false,
  phase,
}: ENSProgressTimelineProps) {
  const intl = useIntl();
  const [copied, setCopied] = useState(false);
  const copyResetTimer = useTimeout();
  const copyMessageId = async () => {
    if (!data.ccipMessageId) return;
    const copiedOk = await copyToClipboard(data.ccipMessageId);
    if (!copiedOk) {
      setCopied(false);
      toastService.error({
        title: intl.formatMessage({ id: "app.toast.copyFailed", defaultMessage: "Copy failed" }),
      });
      return;
    }
    setCopied(true);
    copyResetTimer.set(() => setCopied(false), 2000);
  };
  const status = phase ?? data.status;
  if (status === "available") return null;

  const isReady = status === "active";
  const isDelayed = status === "timed_out";
  const isReleasing = !phase && Boolean(data.release);
  const Icon = isReady ? RiCheckLine : isDelayed ? RiTimeLine : RiLoader4Line;
  const title =
    status === "submitting"
      ? intl.formatMessage({
          id: "ens.timeline.submitting",
          defaultMessage: "Submitting your request",
        })
      : status === "checking"
        ? intl.formatMessage({ id: "ens.timeline.checking", defaultMessage: "Checking your name" })
        : isReleasing
          ? isDelayed
            ? intl.formatMessage({
                id: "ens.timeline.releaseDelayed",
                defaultMessage: "Release is taking longer than usual",
              })
            : intl.formatMessage({
                id: "ens.timeline.releasing",
                defaultMessage: "Releasing your name",
              })
          : isReady
            ? intl.formatMessage({ id: "ens.timeline.ready", defaultMessage: "Ready to use" })
            : isDelayed
              ? intl.formatMessage({
                  id: "ens.status.timedOut",
                  defaultMessage: "Registration is taking longer than usual",
                })
              : intl.formatMessage({
                  id: "ens.timeline.settingUp",
                  defaultMessage: "Setting up your name",
                });
  const description =
    status === "submitting"
      ? intl.formatMessage({
          id: "ens.timeline.submittingDescription",
          defaultMessage:
            "Complete any confirmation from your account. Your request will appear here once received.",
        })
      : status === "checking"
        ? intl.formatMessage({
            id: "ens.timeline.checkingDescription",
            defaultMessage: "We’re checking whether your name is ready to use.",
          })
        : isReleasing
          ? intl.formatMessage({
              id: "ens.timeline.releasingDescription",
              defaultMessage:
                "Release received. We’re waiting for your name to clear before you choose another one.",
            })
          : isReady
            ? intl.formatMessage({
                id: "ens.timeline.active",
                defaultMessage: "Your name is ready. People can use it to find your work.",
              })
            : isDelayed
              ? intl.formatMessage({
                  id: "ens.timeline.timedOut",
                  defaultMessage:
                    "Your request is still being checked. You can check again without claiming another name.",
                })
              : intl.formatMessage({
                  id: "ens.timeline.pending",
                  defaultMessage:
                    "Request received. Setup usually takes 15–20 minutes. You can leave and check back here.",
                });

  return (
    <div
      className={className}
      style={{
        border: embedded || compact ? undefined : "1px solid rgb(var(--stroke-soft-200))",
        borderRadius: "var(--radius-xl)",
        padding: embedded || compact ? undefined : 16,
        background: "rgb(var(--bg-white-0))",
      }}
    >
      <div
        role="status"
        aria-live="polite"
        style={{ display: "flex", gap: 12, alignItems: "center" }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: "50%",
            color: "rgb(var(--primary-on-surface))",
            background: "rgb(var(--bg-weak-50))",
          }}
        >
          <Icon
            size={16}
            aria-hidden="true"
            className={!isReady && !isDelayed ? "animate-spin" : undefined}
          />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "rgb(var(--text-strong-950))" }}>
            {title}
          </p>
          {slug && (
            <p
              style={{ fontSize: 12, overflowWrap: "anywhere", color: "rgb(var(--text-sub-600))" }}
            >
              {slug}.greengoods.eth
            </p>
          )}
          {!compact && (
            <p
              style={{
                fontSize: 12,
                lineHeight: "18px",
                marginTop: 4,
                color: "rgb(var(--text-sub-600))",
              }}
            >
              {description}
            </p>
          )}
        </div>
      </div>
      {!compact && data.ccipMessageId && (
        <details style={{ marginTop: 12, fontSize: 12, color: "rgb(var(--text-sub-600))" }}>
          <summary style={{ cursor: "pointer" }}>
            {isReleasing
              ? intl.formatMessage({
                  id: "ens.timeline.releaseDetails",
                  defaultMessage: "Release details",
                })
              : intl.formatMessage({
                  id: "ens.timeline.details",
                  defaultMessage: "Registration details",
                })}
          </summary>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <code style={{ overflowWrap: "anywhere", minWidth: 0, flex: 1 }}>
              {data.ccipMessageId}
            </code>
            <IconButton
              size="sm"
              aria-label={intl.formatMessage({
                id: "ens.timeline.copyMessageId",
                defaultMessage: "Copy CCIP message ID",
              })}
              onClick={copyMessageId}
              icon={
                copied ? <RiCheckLine aria-hidden="true" /> : <RiFileCopyLine aria-hidden="true" />
              }
            />
          </div>
          <a
            href={`https://ccip.chain.link/msg/${data.ccipMessageId}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              minHeight: 40,
              color: "rgb(var(--primary-on-surface))",
            }}
          >
            {intl.formatMessage({
              id: "ens.timeline.trackExplorer",
              defaultMessage: "Track on CCIP Explorer",
            })}
            <RiExternalLinkLine size={16} aria-hidden="true" />
          </a>
        </details>
      )}
    </div>
  );
}
