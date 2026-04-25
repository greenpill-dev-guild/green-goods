import { create } from "zustand";
import { createJSONStorage, persist, subscribeWithSelector } from "zustand/middleware";

export const GARDEN_STATE_STORAGE_KEY = "green-goods:garden-state";
export const ALL_GARDENS_KEY = "__all__";

export type GardenWorkspaceKey = "hub" | "garden" | "community" | "actions";

export type GardenWorkspaceState = {
  activeMode: string;
  filter: string;
  search: string;
  selectedItem: string | null;
  scrollPosition: number;
  sheetOpen: boolean;
};

export type GardenState = {
  activeTab: string;
  filter: string;
  selectedItem: string | null;
  scrollPosition: number;
  sheetOpen: boolean;
  workspaces: Partial<Record<GardenWorkspaceKey, GardenWorkspaceState>>;
};

export type GardenStateStore = {
  gardenStates: Record<string, GardenState>;
  getGardenState: (gardenKey: string) => GardenState;
  setGardenState: (gardenKey: string, partial: Partial<GardenState>) => void;
  getGardenWorkspaceState: (
    gardenKey: string,
    workspaceKey: GardenWorkspaceKey
  ) => GardenWorkspaceState;
  setGardenWorkspaceState: (
    gardenKey: string,
    workspaceKey: GardenWorkspaceKey,
    partial: Partial<GardenWorkspaceState>
  ) => void;
  clearGardenState: (gardenKey: string) => void;
  clearAll: () => void;
};

const createDefaultGardenWorkspaceState = (): GardenWorkspaceState => ({
  activeMode: "",
  filter: "",
  search: "",
  selectedItem: null,
  scrollPosition: 0,
  sheetOpen: false,
});

const createDefaultGardenState = (): GardenState => ({
  activeTab: "work",
  filter: "",
  selectedItem: null,
  scrollPosition: 0,
  sheetOpen: false,
  workspaces: {},
});

const GARDEN_WORKSPACE_KEYS: GardenWorkspaceKey[] = ["hub", "garden", "community", "actions"];

const normalizeGardenKey = (gardenKey: string): string => gardenKey || ALL_GARDENS_KEY;

function normalizeGardenWorkspaceState(
  state?: Partial<GardenWorkspaceState>
): GardenWorkspaceState {
  return {
    ...createDefaultGardenWorkspaceState(),
    ...(state ?? {}),
  };
}

function normalizeGardenState(state?: Partial<GardenState>): GardenState {
  const workspaceEntries = state?.workspaces ?? {};
  const workspaces = GARDEN_WORKSPACE_KEYS.reduce<GardenState["workspaces"]>((next, key) => {
    const workspaceState = workspaceEntries[key];
    if (workspaceState) {
      next[key] = normalizeGardenWorkspaceState(workspaceState);
    }
    return next;
  }, {});

  return {
    ...createDefaultGardenState(),
    ...(state ?? {}),
    workspaces,
  };
}

export const useGardenStateStore = create<GardenStateStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        gardenStates: {},

        getGardenState: (gardenKey) => {
          const normalizedKey = normalizeGardenKey(gardenKey);
          return normalizeGardenState(get().gardenStates[normalizedKey]);
        },

        setGardenState: (gardenKey, partial) => {
          const normalizedKey = normalizeGardenKey(gardenKey);
          set((state) => ({
            gardenStates: {
              ...state.gardenStates,
              [normalizedKey]: normalizeGardenState({
                ...normalizeGardenState(state.gardenStates[normalizedKey]),
                ...partial,
              }),
            },
          }));
        },

        getGardenWorkspaceState: (gardenKey, workspaceKey) => {
          const gardenState = get().getGardenState(gardenKey);
          return gardenState.workspaces[workspaceKey] ?? createDefaultGardenWorkspaceState();
        },

        setGardenWorkspaceState: (gardenKey, workspaceKey, partial) => {
          const normalizedKey = normalizeGardenKey(gardenKey);
          set((state) => {
            const gardenState = normalizeGardenState(state.gardenStates[normalizedKey]);
            const workspaceState =
              gardenState.workspaces[workspaceKey] ?? createDefaultGardenWorkspaceState();

            return {
              gardenStates: {
                ...state.gardenStates,
                [normalizedKey]: {
                  ...gardenState,
                  workspaces: {
                    ...gardenState.workspaces,
                    [workspaceKey]: {
                      ...workspaceState,
                      ...partial,
                    },
                  },
                },
              },
            };
          });
        },

        clearGardenState: (gardenKey) => {
          const normalizedKey = normalizeGardenKey(gardenKey);
          set((state) => {
            const { [normalizedKey]: _, ...rest } = state.gardenStates;
            return { gardenStates: rest };
          });
        },

        clearAll: () => set({ gardenStates: {} }),
      }),
      {
        name: GARDEN_STATE_STORAGE_KEY,
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({ gardenStates: state.gardenStates }),
      }
    )
  )
);
