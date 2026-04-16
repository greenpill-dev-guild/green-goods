import { create } from "zustand";
import { createJSONStorage, persist, subscribeWithSelector } from "zustand/middleware";

export const SHEET_STATE_STORAGE_KEY = "gg-admin-sheet-state";

export interface ViewSheetState {
  sheetOpen: "left" | "right" | null;
  sheetContentId: string | null;
  formState: Record<string, unknown>;
  scrollPosition: number;
}

export interface SheetOrchestratorState {
  viewStates: Record<string, ViewSheetState>;
  activeSheet: "left" | "right" | null;
  activeContentId: string | null;

  openSheet: (side: "left" | "right", contentId: string) => void;
  closeSheet: () => void;
  saveViewState: (path: string) => void;
  restoreViewState: (path: string) => ViewSheetState | null;
  setFormState: (path: string, formState: Record<string, unknown>) => void;
  setScrollPosition: (path: string, position: number) => void;
  clearViewState: (path: string) => void;
}

const createDefaultViewState = (): ViewSheetState => ({
  sheetOpen: null,
  sheetContentId: null,
  formState: {},
  scrollPosition: 0,
});

export const useSheetOrchestratorStore = create<SheetOrchestratorState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        viewStates: {},
        activeSheet: null,
        activeContentId: null,

        openSheet: (side, contentId) => set({ activeSheet: side, activeContentId: contentId }),

        closeSheet: () => set({ activeSheet: null, activeContentId: null }),

        saveViewState: (path) => {
          const { activeSheet, activeContentId, viewStates } = get();
          const existing = viewStates[path] ?? createDefaultViewState();
          set({
            viewStates: {
              ...viewStates,
              [path]: {
                ...existing,
                sheetOpen: activeSheet,
                sheetContentId: activeContentId,
              },
            },
          });
        },

        restoreViewState: (path) => {
          return get().viewStates[path] ?? null;
        },

        setFormState: (path, formState) => {
          const { viewStates } = get();
          const existing = viewStates[path] ?? createDefaultViewState();
          set({
            viewStates: {
              ...viewStates,
              [path]: {
                ...existing,
                formState,
              },
            },
          });
        },

        setScrollPosition: (path, position) => {
          const { viewStates } = get();
          const existing = viewStates[path] ?? createDefaultViewState();
          set({
            viewStates: {
              ...viewStates,
              [path]: {
                ...existing,
                scrollPosition: position,
              },
            },
          });
        },

        clearViewState: (path) => {
          set((state) => {
            const { [path]: _, ...rest } = state.viewStates;
            return { viewStates: rest };
          });
        },
      }),
      {
        name: SHEET_STATE_STORAGE_KEY,
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({ viewStates: state.viewStates }),
      }
    )
  )
);
