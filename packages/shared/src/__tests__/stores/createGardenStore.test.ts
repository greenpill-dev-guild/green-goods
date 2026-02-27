import { beforeEach, describe, expect, it } from "vitest";
import { getAddress } from "viem";

import { resetCreateGardenStore, useCreateGardenStore } from "../../stores/useCreateGardenStore";
import { Domain } from "../../types/domain";

const GARDENER = "0x1234567890123456789012345678901234567890";
const OPERATOR = "0xabcdef0123456789abcdef0123456789abcdef01";

describe("stores/useCreateGardenStore", () => {
  beforeEach(() => {
    resetCreateGardenStore();
  });

  it("defaults to all domains selected", () => {
    const { form } = useCreateGardenStore.getState();
    expect(form.domains).toEqual([Domain.SOLAR, Domain.AGRO, Domain.EDU, Domain.WASTE]);
  });

  it("builds garden params with computed domainMask and role arrays", () => {
    const store = useCreateGardenStore.getState();
    store.setField("name", "Test Garden");
    store.setField("slug", "test-garden");
    store.setField("description", "A thriving test garden");
    store.setField("location", "Test City");
    store.setField("domains", [Domain.SOLAR, Domain.WASTE]);
    store.addGardener(GARDENER);
    store.addOperator(OPERATOR);

    const params = useCreateGardenStore.getState().getParams();
    expect(params).not.toBeNull();
    expect(params?.domainMask).toBe((1 << Domain.SOLAR) | (1 << Domain.WASTE));
    expect(params?.gardeners).toEqual([GARDENER]);
    expect(params?.operators).toEqual([getAddress(OPERATOR)]);
  });

  it("treats details step as invalid when no domains are selected", () => {
    const store = useCreateGardenStore.getState();
    store.setField("name", "Test Garden");
    store.setField("slug", "test-garden");
    store.setField("description", "A thriving test garden");
    store.setField("location", "Test City");
    store.setField("domains", []);

    expect(useCreateGardenStore.getState().isStepValid("details")).toBe(false);
  });
});
