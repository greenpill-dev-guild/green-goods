import { create } from "zustand";
import { createJSONStorage, persist, subscribeWithSelector } from "zustand/middleware";

export const GARDEN_STATE_STORAGE_KEY = "green-goods:garden-state";
export const ALL_GARDENS_KEY = "__all__";

export type GardenState = {
  activeTab: string;
  filter: string;
  selectedItem: string | null;
  scrollPosition: number;
  sheetOpen: boolean;
};

export type GardenStateStore = {
  gardenStates: Record<string, GardenState>;
  getGardenState: (gardenKey: string) => GardenState;
  setGardenState: (gardenKey: string, partial: Partial<GardenState>) => void;
  clearGardenState: (gardenKey: string) => void;
  clearAll: () => void;
};

const createDefaultGardenState = (): GardenState => ({
  activeTab: "work",
  filter: "",
  selectedItem: null,
  scrollPosition: 0,
  sheetOpen: false,
});

const normalizeGardenKey = (gardenKey: string): string => gardenKey || ALL_GARDENS_KEY;

export const useGardenStateStore = create<GardenStateStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        gardenStates: {},

        getGardenState: (gardenKey) => {
          const normalizedKey = normalizeGardenKey(gardenKey);
          return get().gardenStates[normalizedKey] ?? createDefaultGardenState();
        },

        setGardenState: (gardenKey, partial) => {
          const normalizedKey = normalizeGardenKey(gardenKey);
          set((state) => ({
            gardenStates: {
              ...state.gardenStates,
              [normalizedKey]: {
                ...(state.gardenStates[normalizedKey] ?? createDefaultGardenState()),
                ...partial,
              },
            },
          }));
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
