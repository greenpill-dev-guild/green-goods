import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { logger } from "../modules/app/logger";
import type { Address, WorkApprovalDraft } from "../types/domain";

/** Where this device keeps the reviews a steward has decided and not yet sent. */
export const REVIEW_BATCH_STORAGE_KEY = "green-goods:review-batch";

/** One steward's list, in one garden, on one chain. */
export const reviewBatchScope = (chainId: number, account: Address, gardenAddress: Address) =>
  `${chainId}:${account.toLowerCase()}:${gardenAddress.toLowerCase()}`;

/** What the last send said about a review it could not send. The next send asks again. */
export interface StagedReviewNote {
  /** Why the chain would refuse it. */
  refusal?: string;
  /** It would have needed more signatures than the list promised. */
  notBatchable?: boolean;
}

export interface StagedReview extends StagedReviewNote {
  draft: WorkApprovalDraft;
}

const reviewKey = (workUID: string) => workUID.toLowerCase();

interface ReviewBatchState {
  reviewsByScope: Record<string, Record<string, StagedReview>>;
  /** A work holds one decision, so staging it again replaces the last one and its notes. */
  stage: (scope: string, draft: WorkApprovalDraft) => void;
  unstage: (scope: string, workUIDs: readonly string[]) => void;
  /** Keyed by work UID, in any case. A review not named here starts clean. */
  note: (scope: string, notes: ReadonlyMap<string, StagedReviewNote>) => void;
}

/**
 * Local storage read at call time, so a refused write (a full quota, blocked storage) is logged
 * and the list lasts for this session instead of breaking the review that added to it.
 */
const deviceStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      logger.warn("Could not save the review batch", { source: "useReviewBatchStore", error });
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Storage that cannot be read holds nothing to remove.
    }
  },
};

const isOptionalString = (value: unknown) => value === undefined || typeof value === "string";

function parseDraft(value: unknown): WorkApprovalDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<Record<keyof WorkApprovalDraft, unknown>>;
  const isWellFormed =
    typeof draft.actionUID === "number" &&
    typeof draft.workUID === "string" &&
    typeof draft.approved === "boolean" &&
    typeof draft.confidence === "number" &&
    typeof draft.verificationMethod === "number" &&
    isOptionalString(draft.feedback) &&
    isOptionalString(draft.reviewNotesCID);
  return isWellFormed ? (draft as WorkApprovalDraft) : null;
}

/**
 * Saved reviews are untrusted input: a malformed one goes, and the chain rechecks the rest. Notes
 * come only from this session: a saved one described a send that has passed, and the next asks again.
 */
function parseReviewsByScope(
  value: unknown,
  current: ReviewBatchState["reviewsByScope"]
): ReviewBatchState["reviewsByScope"] {
  if (!value || typeof value !== "object") return {};
  const scopes: ReviewBatchState["reviewsByScope"] = {};
  for (const [scope, reviews] of Object.entries(value)) {
    if (!reviews || typeof reviews !== "object") continue;
    const parsed: Record<string, StagedReview> = {};
    for (const saved of Object.values(reviews) as { draft?: unknown }[]) {
      const draft = parseDraft(saved?.draft);
      if (!draft) continue;
      const key = reviewKey(draft.workUID);
      const { draft: _kept, ...notes } = current[scope]?.[key] ?? {};
      parsed[key] = { draft, ...notes };
    }
    if (Object.keys(parsed).length > 0) scopes[scope] = parsed;
  }
  return scopes;
}

/**
 * The reviews a steward has decided and not yet sent, kept on this device per chain, account, and
 * garden until they go out. It holds each decision and the link to any audio note, never a file.
 */
export const useReviewBatchStore = create<ReviewBatchState>()(
  persist(
    (set, get, api) => ({
      reviewsByScope: {},
      // Each write starts from what's saved: another tab's may not have reached this one yet, and a
      // write saves the whole list.
      stage: (scope, draft) => {
        void api.persist.rehydrate();
        set((state) => ({
          reviewsByScope: {
            ...state.reviewsByScope,
            [scope]: { ...state.reviewsByScope[scope], [reviewKey(draft.workUID)]: { draft } },
          },
        }));
      },
      // With nothing to remove, nothing changes, so a caller that runs on every read settles.
      unstage: (scope, workUIDs) => {
        const leaving = new Set(workUIDs.map(reviewKey));
        const listed = Object.keys(get().reviewsByScope[scope] ?? {});
        if (!listed.some((key) => leaving.has(key))) return;
        void api.persist.rehydrate();
        set((state) => {
          const kept = Object.entries(state.reviewsByScope[scope] ?? {}).filter(
            ([key]) => !leaving.has(key)
          );
          const { [scope]: _emptied, ...others } = state.reviewsByScope;
          return {
            reviewsByScope:
              kept.length > 0 ? { ...others, [scope]: Object.fromEntries(kept) } : others,
          };
        });
      },
      note: (scope, notes) => {
        void api.persist.rehydrate();
        set((state) => {
          const reviews = state.reviewsByScope[scope];
          if (!reviews) return state;
          const named = new Map([...notes].map(([workUID, note]) => [reviewKey(workUID), note]));
          return {
            reviewsByScope: {
              ...state.reviewsByScope,
              [scope]: Object.fromEntries(
                Object.entries(reviews).map(([key, { draft }]) => [
                  key,
                  { draft, ...named.get(key) },
                ])
              ),
            },
          };
        });
      },
    }),
    {
      name: REVIEW_BATCH_STORAGE_KEY,
      storage: createJSONStorage(() => deviceStorage),
      partialize: (state) => ({ reviewsByScope: state.reviewsByScope }),
      merge: (persisted, current) => ({
        ...current,
        reviewsByScope: parseReviewsByScope(
          (persisted as { reviewsByScope?: unknown } | undefined)?.reviewsByScope,
          current.reviewsByScope
        ),
      }),
    }
  )
);
