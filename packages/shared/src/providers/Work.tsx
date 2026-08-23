/**
 * Work Provider
 *
 * Composes the work submission flow into split selection and form contexts.
 *
 * @module providers/work
 */

import React, { useContext } from "react";
import type { Control, UseFormRegister, UseFormSetValue } from "react-hook-form";
import type { WorkFormData } from "../hooks/work/useWorkForm";
import {
  useWorkSubmissionFlow,
  type WorkDataProps,
  type WorkFormValue,
  type WorkSelectionValue,
} from "../hooks/work/useWorkSubmissionFlow";
import { WorkTab } from "../stores/workFlowTypes";

export { WorkTab };
export type { WorkDataProps, WorkFormValue, WorkSelectionValue };

const WorkSelectionContext = React.createContext<WorkSelectionValue | null>(null);
const WorkFormContext = React.createContext<WorkFormValue | null>(null);
const WorkContext = React.createContext<WorkDataProps>({
  form: {
    register: () => ({}) as ReturnType<UseFormRegister<WorkFormData>>,
    setValue: (() => {}) as UseFormSetValue<WorkFormData>,
    control: {} as Control<WorkFormData>,
    actionUID: null,
    setActionUID: () => {},
    uploadWork: async () => {},
    gardenAddress: null,
    setGardenAddress: () => {},
    reset: () => {},
    validationErrors: [],
  },
} as unknown as WorkDataProps);

export function useWorkSelection(): WorkSelectionValue {
  const context = useContext(WorkSelectionContext);
  if (!context) throw new Error("useWorkSelection must be used within a WorkProvider");
  return context;
}

export function useWorkFormContext(): WorkFormValue {
  const context = useContext(WorkFormContext);
  if (!context) throw new Error("useWorkFormContext must be used within a WorkProvider");
  return context;
}

/** @deprecated Prefer useWorkSelection or useWorkFormContext to limit re-renders. */
export const useWork = () => useContext(WorkContext);

export const WorkProvider = ({ children }: { children: React.ReactNode }) => {
  const { selectionValue, formValue, legacyValue } = useWorkSubmissionFlow();

  return (
    <WorkSelectionContext.Provider value={selectionValue}>
      <WorkFormContext.Provider value={formValue}>
        <WorkContext.Provider value={legacyValue}>{children}</WorkContext.Provider>
      </WorkFormContext.Provider>
    </WorkSelectionContext.Provider>
  );
};
