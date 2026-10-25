/**
 * Active garden store tests: one remembered garden per chain and account, saved under its own
 * key, brought back after a reload, with malformed saved choices dropped.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ACTIVE_GARDEN_STORAGE_KEY, useActiveGardenStore } from "../../stores/useActiveGardenStore";

const ALICE_SCOPE = "42161:0xa11ce00000000000000000000000000000000001";
const BOB_SCOPE = "42161:0xb0b0000000000000000000000000000000000002";
const GARDEN_A = "0xA000000000000000000000000000000000000001";
const GARDEN_B = "0xB000000000000000000000000000000000000002";

function storedKeys(): string[] {
  return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index) ?? "");
}

function saveChoices(gardenIdsByScope: unknown) {
  localStorage.setItem(
    ACTIVE_GARDEN_STORAGE_KEY,
    JSON.stringify({ state: { gardenIdsByScope }, version: 0 })
  );
}

beforeEach(() => {
  localStorage.clear();
  useActiveGardenStore.setState({ gardenIdsByScope: {} });
});

describe("stores/useActiveGardenStore", () => {
  it("remembers one garden per chain and account without touching another's", () => {
    const { rememberGarden } = useActiveGardenStore.getState();

    rememberGarden(ALICE_SCOPE, GARDEN_A);
    rememberGarden(BOB_SCOPE, GARDEN_B);
    rememberGarden(ALICE_SCOPE, GARDEN_B);

    expect(useActiveGardenStore.getState().gardenIdsByScope).toEqual({
      [ALICE_SCOPE]: GARDEN_B,
      [BOB_SCOPE]: GARDEN_B,
    });
  });

  it("saves under its own key, apart from the UI store's", () => {
    useActiveGardenStore.getState().rememberGarden(ALICE_SCOPE, GARDEN_A);

    const saved = JSON.parse(localStorage.getItem(ACTIVE_GARDEN_STORAGE_KEY) ?? "null");
    expect(saved?.state).toEqual({ gardenIdsByScope: { [ALICE_SCOPE]: GARDEN_A } });
    expect(storedKeys()).toEqual([ACTIVE_GARDEN_STORAGE_KEY]);
  });

  it("brings the saved choices back after a reload", async () => {
    saveChoices({ [ALICE_SCOPE]: GARDEN_A, [BOB_SCOPE]: GARDEN_B });

    await useActiveGardenStore.persist.rehydrate();

    expect(useActiveGardenStore.getState().gardenIdsByScope).toEqual({
      [ALICE_SCOPE]: GARDEN_A,
      [BOB_SCOPE]: GARDEN_B,
    });
  });

  it("drops saved choices that are not a garden id", async () => {
    saveChoices({ [ALICE_SCOPE]: 7, [BOB_SCOPE]: "", "1:0xc": GARDEN_B });
    await useActiveGardenStore.persist.rehydrate();
    expect(useActiveGardenStore.getState().gardenIdsByScope).toEqual({ "1:0xc": GARDEN_B });

    saveChoices("not a map");
    await useActiveGardenStore.persist.rehydrate();
    expect(useActiveGardenStore.getState().gardenIdsByScope).toEqual({});
  });
});
