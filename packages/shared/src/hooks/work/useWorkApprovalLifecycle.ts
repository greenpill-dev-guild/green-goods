import { useCallback, useEffect, useRef, useState } from "react";
import {
  TransactionReceiptTimeoutError,
  waitForReceiptWithTimeout,
} from "../../modules/work/wallet-submission/receipt";
import type { ApprovalWalletLifecycleEvent } from "../../modules/work/wallet-submission/types";

export const PENDING_WORK_APPROVAL_STORAGE_KEY = "gg:pending-work-approval:v1";

export type WorkApprovalLifecycleStage =
  | "idle"
  | "handoff"
  | "broadcast"
  | "confirmed"
  | "indexing"
  | "completed"
  | "cancelled"
  | "failed";

export type WorkApprovalRetryableReason =
  | "receipt-timeout"
  | "indexer-delay"
  | "presentation-failed";

export interface WorkApprovalCompletion {
  approved: boolean;
  gardenId: string;
  workUID: string;
}

export interface PendingWorkApproval extends WorkApprovalCompletion {
  version: 1;
  chainId: number;
  stage: "handoff" | "broadcast" | "confirmed" | "indexing" | "completed";
  startedAt: number;
  updatedAt: number;
  txHash?: `0x${string}`;
  retryableReason?: WorkApprovalRetryableReason;
}

interface UseWorkApprovalLifecycleOptions {
  waitForReceipt?: (hash: `0x${string}`, chainId: number) => Promise<unknown>;
  onConfirmed: (approval: PendingWorkApproval) => void | Promise<void>;
  onComplete?: (completion: WorkApprovalCompletion) => void | Promise<void>;
  onFailure?: (error: unknown, approval: PendingWorkApproval) => void;
  onStage?: (event: {
    approved: boolean;
    reason?: WorkApprovalRetryableReason;
    stage: Exclude<WorkApprovalLifecycleStage, "idle" | "failed">;
  }) => void;
  onRetryable?: (reason: WorkApprovalRetryableReason) => void;
}

function getStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isPersistedStage(value: unknown): value is PendingWorkApproval["stage"] {
  return ["handoff", "broadcast", "confirmed", "indexing", "completed"].includes(value as string);
}

function isPendingWorkApproval(value: unknown): value is PendingWorkApproval {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PendingWorkApproval>;
  return (
    record.version === 1 &&
    typeof record.approved === "boolean" &&
    typeof record.chainId === "number" &&
    typeof record.gardenId === "string" &&
    typeof record.workUID === "string" &&
    typeof record.startedAt === "number" &&
    typeof record.updatedAt === "number" &&
    isPersistedStage(record.stage) &&
    (record.txHash === undefined ||
      (typeof record.txHash === "string" && record.txHash.startsWith("0x")))
  );
}

function readPendingWorkApproval(): PendingWorkApproval | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(PENDING_WORK_APPROVAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isPendingWorkApproval(parsed)) return parsed;
    storage.removeItem(PENDING_WORK_APPROVAL_STORAGE_KEY);
  } catch {
    // Blocked or corrupt storage must not make an approval unusable.
  }
  return null;
}

function writePendingWorkApproval(record: PendingWorkApproval): void {
  try {
    getStorage()?.setItem(PENDING_WORK_APPROVAL_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // The live mutation can still finish when durable browser storage is unavailable.
  }
}

function clearPendingWorkApproval(): void {
  try {
    getStorage()?.removeItem(PENDING_WORK_APPROVAL_STORAGE_KEY);
  } catch {
    // Storage cleanup is best effort.
  }
}

function isReceiptTimeout(error: unknown): boolean {
  return (
    error instanceof TransactionReceiptTimeoutError ||
    (error instanceof Error && error.name === "TransactionReceiptTimeoutError")
  );
}

export function useWorkApprovalLifecycle(options: UseWorkApprovalLifecycleOptions) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const reconciliationRef = useRef(false);
  const presentedHashRef = useRef<string | null>(null);
  const [initialPendingRecord] = useState<PendingWorkApproval | null>(readPendingWorkApproval);
  const pendingRecordRef = useRef<PendingWorkApproval | null>(initialPendingRecord);
  const [hasPendingRecord, setHasPendingRecord] = useState(initialPendingRecord !== null);
  const [stage, setStage] = useState<WorkApprovalLifecycleStage>(
    initialPendingRecord?.stage ?? "idle"
  );

  const getPendingRecord = useCallback((): PendingWorkApproval | null => {
    const pending = pendingRecordRef.current ?? readPendingWorkApproval();
    if (pending) pendingRecordRef.current = pending;
    return pending;
  }, []);

  const persistStage = useCallback(
    (
      nextStage: PendingWorkApproval["stage"],
      updates: Partial<Pick<PendingWorkApproval, "retryableReason" | "txHash">> = {}
    ): PendingWorkApproval | null => {
      const current = getPendingRecord();
      if (!current) return null;
      const next: PendingWorkApproval = {
        ...current,
        ...updates,
        stage: nextStage,
        updatedAt: Date.now(),
      };
      if (updates.retryableReason === undefined) delete next.retryableReason;
      pendingRecordRef.current = next;
      writePendingWorkApproval(next);
      setHasPendingRecord(true);
      setStage(nextStage);
      if (
        current.stage !== next.stage ||
        current.txHash !== next.txHash ||
        current.retryableReason !== next.retryableReason
      ) {
        optionsRef.current.onStage?.({
          approved: next.approved,
          reason: next.retryableReason,
          stage: next.stage,
        });
      }
      return next;
    },
    [getPendingRecord]
  );

  const begin = useCallback((completion: WorkApprovalCompletion & { chainId: number }) => {
    const now = Date.now();
    const pending: PendingWorkApproval = {
      ...completion,
      version: 1,
      stage: "handoff",
      startedAt: now,
      updatedAt: now,
    };
    presentedHashRef.current = null;
    pendingRecordRef.current = pending;
    writePendingWorkApproval(pending);
    setHasPendingRecord(true);
    setStage("handoff");
    optionsRef.current.onStage?.({ approved: pending.approved, stage: "handoff" });
  }, []);

  const recordWalletStage = useCallback(
    (event: ApprovalWalletLifecycleEvent) => {
      const current = getPendingRecord();
      const repeatedRetryableStage =
        "reason" in event &&
        current?.stage === event.stage &&
        current.txHash === event.txHash &&
        current.retryableReason === event.reason;
      persistStage(event.stage, {
        txHash: "txHash" in event ? event.txHash : undefined,
        retryableReason: "reason" in event ? event.reason : undefined,
      });
      if ("reason" in event && event.reason && !repeatedRetryableStage) {
        optionsRef.current.onRetryable?.(event.reason);
      }
    },
    [getPendingRecord, persistStage]
  );

  const notifyRetryable = useCallback(
    (reason: WorkApprovalRetryableReason, record: PendingWorkApproval) => {
      const next: PendingWorkApproval = {
        ...record,
        retryableReason: reason,
        updatedAt: Date.now(),
      };
      pendingRecordRef.current = next;
      writePendingWorkApproval(next);
      setHasPendingRecord(true);
      setStage(next.stage);
      optionsRef.current.onStage?.({
        approved: next.approved,
        reason,
        stage: next.stage,
      });
      optionsRef.current.onRetryable?.(reason);
    },
    []
  );

  const present = useCallback(
    async (record: PendingWorkApproval): Promise<void> => {
      if (record.txHash && presentedHashRef.current === record.txHash) return;
      const completed = persistStage("completed") ?? { ...record, stage: "completed" as const };
      try {
        await optionsRef.current.onComplete?.({
          approved: completed.approved,
          gardenId: completed.gardenId,
          workUID: completed.workUID,
        });
        presentedHashRef.current = completed.txHash ?? null;
        pendingRecordRef.current = null;
        clearPendingWorkApproval();
        setHasPendingRecord(false);
        setStage("completed");
      } catch {
        notifyRetryable("presentation-failed", completed);
      }
    },
    [notifyRetryable, persistStage]
  );

  const reconcileConfirmed = useCallback(
    async (record: PendingWorkApproval): Promise<void> => {
      const confirmed = persistStage("confirmed", { txHash: record.txHash }) ?? record;
      const indexing = persistStage("indexing", { txHash: confirmed.txHash }) ?? confirmed;
      try {
        await optionsRef.current.onConfirmed(indexing);
      } catch {
        notifyRetryable("indexer-delay", indexing);
        return;
      }
      await present(indexing);
    },
    [notifyRetryable, persistStage, present]
  );

  const resume = useCallback(async (): Promise<void> => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    if (reconciliationRef.current) return;
    const pending = getPendingRecord();
    if (!pending) return;

    reconciliationRef.current = true;
    try {
      if (pending.stage === "completed") {
        await present(pending);
        return;
      }
      if (pending.stage === "confirmed" || pending.stage === "indexing") {
        await reconcileConfirmed(pending);
        return;
      }
      if (!pending.txHash) return;

      await (optionsRef.current.waitForReceipt ?? waitForReceiptWithTimeout)(
        pending.txHash,
        pending.chainId
      );
      await reconcileConfirmed(pending);
    } catch (error) {
      if (isReceiptTimeout(error)) {
        const broadcast = persistStage("broadcast", {
          retryableReason: "receipt-timeout",
          txHash: pending.txHash,
        });
        if (broadcast) notifyRetryable("receipt-timeout", broadcast);
        return;
      }
      pendingRecordRef.current = null;
      clearPendingWorkApproval();
      setHasPendingRecord(false);
      setStage("failed");
      optionsRef.current.onFailure?.(error, pending);
    } finally {
      reconciliationRef.current = false;
    }
  }, [getPendingRecord, notifyRetryable, persistStage, present, reconcileConfirmed]);

  useEffect(() => {
    const resumeWhenVisible = () => {
      if (document.visibilityState !== "hidden") void resume();
    };
    document.addEventListener("visibilitychange", resumeWhenVisible);
    window.addEventListener("focus", resumeWhenVisible);
    window.addEventListener("pageshow", resumeWhenVisible);
    resumeWhenVisible();
    return () => {
      document.removeEventListener("visibilitychange", resumeWhenVisible);
      window.removeEventListener("focus", resumeWhenVisible);
      window.removeEventListener("pageshow", resumeWhenVisible);
    };
  }, [resume]);

  const cancel = useCallback(() => {
    const pending = getPendingRecord();
    pendingRecordRef.current = null;
    clearPendingWorkApproval();
    setHasPendingRecord(false);
    setStage("cancelled");
    if (pending) {
      optionsRef.current.onStage?.({ approved: pending.approved, stage: "cancelled" });
    }
  }, [getPendingRecord]);

  const fail = useCallback(() => {
    pendingRecordRef.current = null;
    clearPendingWorkApproval();
    setHasPendingRecord(false);
    setStage("failed");
  }, []);

  const completeConfirmed = useCallback(async () => {
    if (reconciliationRef.current) return;
    const pending = getPendingRecord();
    if (!pending) return;
    reconciliationRef.current = true;
    try {
      await reconcileConfirmed(pending);
    } finally {
      reconciliationRef.current = false;
    }
  }, [getPendingRecord, reconcileConfirmed]);

  return {
    begin,
    cancel,
    completeConfirmed,
    fail,
    isPending: hasPendingRecord && stage !== "handoff",
    recordWalletStage,
    resume,
    stage,
  };
}
