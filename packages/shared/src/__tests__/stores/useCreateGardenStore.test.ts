/**
 * @vitest-environment jsdom
 */

import { getAddress } from "viem";
import { beforeEach, describe, expect, it } from "vitest";

import { resetCreateGardenStore, useCreateGardenStore } from "../../stores/useCreateGardenStore";

const MEMBER = "0x1234567890123456789012345678901234567890";

describe("useCreateGardenStore", () => {
  beforeEach(() => {
    resetCreateGardenStore();
  });

  it("allows planning the same address as both operator and gardener", () => {
    const store = useCreateGardenStore.getState();
    const normalized = getAddress(MEMBER);

    expect(store.addOperator(MEMBER)).toEqual({ success: true });
    expect(store.addGardener(MEMBER)).toEqual({ success: true });

    const { form } = useCreateGardenStore.getState();
    expect(form.operators).toContain(normalized);
    expect(form.gardeners).toContain(normalized);
  });

  it("keeps same-role duplicates blocked", () => {
    const store = useCreateGardenStore.getState();

    expect(store.addGardener(MEMBER)).toEqual({ success: true });
    expect(store.addGardener(MEMBER)).toEqual({
      success: false,
      error: "Address already added as gardener",
    });
  });

  it("does not assign action domains implicitly in deployment params", () => {
    const store = useCreateGardenStore.getState();

    store.setField("name", "River Garden");
    store.setField("slug", "river-garden");
    store.setField("description", "Protecting the river delta");
    store.setField("location", "Portland, Oregon");

    expect(store.getParams()?.domainMask).toBe(0);
  });
});
