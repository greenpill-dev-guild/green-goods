import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AssessmentSubmission } from "../modules/assessment/create-assessment-command";
import { getTransactionScopeKey } from "../modules/transactions/types";

export function assessmentSubmissionKey(
  account: AssessmentSubmission["account"],
  chainId: number,
  gardenId: string
): string {
  return `${getTransactionScopeKey(account, chainId)}:${gardenId.toLowerCase()}`;
}

interface State {
  pending: Record<string, AssessmentSubmission>;
  record: (submission: AssessmentSubmission) => void;
  clear: (key: string) => void;
}

// These records belong to accepted transactions, not the editable assessment draft.
export const useAssessmentSubmissionStore = create<State>()(
  persist(
    (set) => ({
      pending: {},
      record: (submission) =>
        set((state) => ({
          pending: {
            ...state.pending,
            [assessmentSubmissionKey(submission.account, submission.chainId, submission.gardenId)]:
              submission,
          },
        })),
      clear: (key) =>
        set((state) => {
          const { [key]: _removed, ...pending } = state.pending;
          return { pending };
        }),
    }),
    {
      name: "green-goods:assessment-submissions",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ pending: state.pending }),
    }
  )
);
