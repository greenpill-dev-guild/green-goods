/**
 * ENS Registration Progress Timeline
 *
 * Tracks CCIP delivery status for ENS subdomain registrations.
 * Shows three states: pending (pulsing), active (green check), timed_out (warning).
 * Includes copyable CCIP message ID and explorer link.
 *
 * @module components/Progress/ENSProgressTimeline
 */

import {
  RiCheckLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiLoader4Line,
  RiTimeLine,
} from "@remixicon/react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";

import { useTimeout } from "../../hooks/utils/useTimeout";
import type { ENSRegistrationData } from "../../types/domain";
import { copyToClipboard } from "../../utils/app/clipboard";
import { formatAddress } from "../../utils/app/text";

const CCIP_EXPLORER_BASE = "https://ccip.chain.link/msg";

/** Derive timed_out from elapsed time (>25 min since submission) */
function deriveStatus(data: ENSRegistrationData): ENSRegistrationData["status"] {
  if (data.status === "active" || data.status === "timed_out") return data.status;
  if (data.status === "pending" && data.submittedAt) {
    const elapsed = Date.now() - data.submittedAt;
    if (elapsed > 25 * 60_000) return "timed_out";
  }
  return data.status;
}

/** Format elapsed time as human-readable string */
function formatElapsed(submittedAt: number): string {
  const elapsed = Math.max(0, Date.now() - submittedAt);
  const minutes = Math.floor(elapsed / 60_000);
  const seconds = Math.floor((elapsed % 60_000) / 1_000);
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

interface ENSProgressTimelineProps {
  /** Registration data from useENSRegistrationStatus */
  data: ENSRegistrationData;
  /** The slug being registered */
  slug: string;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode for inline display */
  compact?: boolean;
}

export function ENSProgressTimeline({
  data,
  slug,
  className,
  compact = false,
}: ENSProgressTimelineProps) {
  const intl = useIntl();
  const [copied, setCopied] = useState(false);
  const [elapsed, setElapsed] = useState("");
  const status = deriveStatus(data);
  const copyResetTimer = useTimeout();

  // Update elapsed time every second while pending
  // Note: setInterval with cleanup is correct here — no useInterval util exists
  useEffect(() => {
    if (status !== "pending" || !data.submittedAt) return;
    setElapsed(formatElapsed(data.submittedAt));
    const interval = window.setInterval(() => {
      setElapsed(formatElapsed(data.submittedAt!));
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [status, data.submittedAt]);

  const handleCopyMessageId = async () => {
    if (!data.ccipMessageId) return;
    await copyToClipboard(data.ccipMessageId);
    setCopied(true);
    copyResetTimer.set(() => setCopied(false), 2_000);
  };

  if (status === "available") return null;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-sm ${className ?? ""}`}>
        {status === "pending" && (
          <>
            <RiLoader4Line className="h-4 w-4 animate-spin text-amber-500" />
            <span className="text-text-sub">
              {intl.formatMessage(
                { id: "ens.status.registering", defaultMessage: "Registering {name}..." },
                { name: `${slug}.greengoods.eth` }
              )}
            </span>
            {elapsed && <span className="text-xs text-text-soft">{elapsed}</span>}
          </>
        )}
        {status === "active" && (
          <>
            <RiCheckLine className="h-4 w-4 text-green-500" />
            <span className="text-text-strong">
              {intl.formatMessage(
                { id: "ens.status.active", defaultMessage: "{name} is live" },
                { name: `${slug}.greengoods.eth` }
              )}
            </span>
          </>
        )}
        {status === "timed_out" && (
          <>
            <RiTimeLine className="h-4 w-4 text-amber-500" />
            <span className="text-text-sub">
              {intl.formatMessage({
                id: "ens.status.timedOut",
                defaultMessage: "Registration is taking longer than usual",
              })}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border border-stroke-soft bg-bg-white-0 p-4 ${className ?? ""}`}
      role="status"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        {status === "pending" && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 animate-pulse">
            <RiLoader4Line className="h-4 w-4 animate-spin" />
          </div>
        )}
        {status === "active" && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
            <RiCheckLine className="h-4 w-4" />
          </div>
        )}
        {status === "timed_out" && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <RiTimeLine className="h-4 w-4" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-strong truncate">{slug}.greengoods.eth</p>
          <p className="text-xs text-text-sub">
            {status === "pending" &&
              intl.formatMessage({
                id: "ens.timeline.pending",
                defaultMessage: "Cross-chain registration in progress (~15-20 min)",
              })}
            {status === "active" &&
              intl.formatMessage({
                id: "ens.timeline.active",
                defaultMessage: "Successfully registered on Ethereum mainnet",
              })}
            {status === "timed_out" &&
              intl.formatMessage({
                id: "ens.timeline.timedOut",
                defaultMessage: "Taking longer than expected. Check the explorer for updates.",
              })}
          </p>
        </div>
        {elapsed && status === "pending" && (
          <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            {elapsed}
          </span>
        )}
      </div>

      {/* CCIP Message ID */}
      {data.ccipMessageId && (
        <div className="flex items-center gap-2 rounded-lg bg-bg-weak px-3 py-2">
          <span className="text-xs text-text-soft shrink-0">
            {intl.formatMessage({
              id: "ens.timeline.messageId",
              defaultMessage: "CCIP Message",
            })}
          </span>
          <span className="flex-1 text-xs font-mono text-text-sub truncate">
            {formatAddress(data.ccipMessageId)}
          </span>
          <button
            type="button"
            onClick={handleCopyMessageId}
            className="shrink-0 rounded p-1 text-text-soft transition-colors hover:bg-bg-weak hover:text-text-sub"
            aria-label={intl.formatMessage({
              id: "ens.timeline.copyMessageId",
              defaultMessage: "Copy CCIP message ID",
            })}
          >
            {copied ? (
              <RiCheckLine className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <RiFileCopyLine className="h-3.5 w-3.5" />
            )}
          </button>
          <a
            href={`${CCIP_EXPLORER_BASE}/${data.ccipMessageId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded p-1 text-text-soft transition-colors hover:bg-bg-weak hover:text-text-sub"
            aria-label={intl.formatMessage({
              id: "ens.timeline.trackExplorer",
              defaultMessage: "Track on CCIP Explorer",
            })}
          >
            <RiExternalLinkLine className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
