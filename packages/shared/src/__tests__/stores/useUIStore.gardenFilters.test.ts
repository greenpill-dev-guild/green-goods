/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_GARDEN_FILTERS, parseGardenFilters } from "../../hooks/garden/useFilteredGardens";
import { useUIStore } from "../../stores/useUIStore";
import { Domain } from "../../types/domain";

const STORAGE_KEY = "green-goods:debug-mode";

describe("Home garden filters in the UI store", () => {
  beforeEach(() => {
    localStorage.clear();
    useUIStore.getState().resetGardenFilters();
  });

  it("saves the filters on the device and restores them on the next launch", async () => {
    useUIStore.getState().setGardenFilters(() => ({ scope: "mine", sort: "name" }));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    expect(saved.state.gardenFilters).toEqual({ scope: "mine", sort: "name" });

    // A relaunch starts from defaults and reads what was saved.
    useUIStore.setState({ gardenFilters: DEFAULT_GARDEN_FILTERS });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    await useUIStore.persist.rehydrate();

    expect(useUIStore.getState().gardenFilters).toEqual({ scope: "mine", sort: "name" });
  });

  it("keeps the debug flag that the same storage entry already held", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { debugMode: true }, version: 0 }));
    await useUIStore.persist.rehydrate();

    expect(useUIStore.getState().debugMode).toBe(true);
    expect(useUIStore.getState().gardenFilters).toEqual(DEFAULT_GARDEN_FILTERS);
  });

  it("restores the open-gardens scope saved on the device", () => {
    expect(parseGardenFilters({ scope: "open", sort: "recent" })).toEqual({
      scope: "open",
      sort: "recent",
    });
  });

  it("falls back field by field when saved filters are not ones it knows", () => {
    expect(parseGardenFilters(null)).toEqual(DEFAULT_GARDEN_FILTERS);
    expect(
      parseGardenFilters({ scope: "everyone", sort: "name", domains: [Domain.AGRO, 9, "SOLAR"] })
    ).toEqual({ scope: "all", sort: "name", domains: [Domain.AGRO] });
  });
});
