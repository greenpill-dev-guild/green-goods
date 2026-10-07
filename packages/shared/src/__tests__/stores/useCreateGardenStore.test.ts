/**
 * @vitest-environment happy-dom
 */

import { getAddress } from "viem";
import { beforeEach, describe, expect, it } from "vitest";

import { resetCreateGardenStore, useCreateGardenStore } from "../../stores/useCreateGardenStore";
import { Domain } from "../../types/domain";

const MEMBER = "0x1234567890123456789012345678901234567890";
const GARDENER = "0x1234567890123456789012345678901234567890";
const OPERATOR = "0xabcdef0123456789abcdef0123456789abcdef01";

describe("useCreateGardenStore", () => {
  beforeEach(() => {
    resetCreateGardenStore();
  });

  it("allows planning the same address as both steward and gardener", () => {
    const store = useCreateGardenStore.getState();
    const normalized = getAddress(MEMBER);

    expect(store.addSteward(MEMBER)).toEqual({ success: true });
    expect(store.addGardener(MEMBER)).toEqual({ success: true });

    const { form } = useCreateGardenStore.getState();
    expect(form.stewards).toContain(normalized);
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

    // With no domains selected, the details step is invalid so getParams returns null
    expect(store.getParams()).toBeNull();
    // Verify the form itself has an empty domains array
    expect(useCreateGardenStore.getState().form.domains).toEqual([]);
  });
});

describe("stores/useCreateGardenStore", () => {
  beforeEach(() => {
    resetCreateGardenStore();
  });

  it("defaults to no domains selected", () => {
    const { form } = useCreateGardenStore.getState();
    expect(form.domains).toEqual([]);
  });

  it("builds garden params with computed domainMask and role arrays", () => {
    const store = useCreateGardenStore.getState();
    store.setField("name", "Test Garden");
    store.setField("slug", "test-garden");
    store.setField("description", "A thriving test garden");
    store.setField("location", "Test City");
    store.setField("domains", [Domain.SOLAR, Domain.WASTE]);
    store.addGardener(GARDENER);
    store.addSteward(OPERATOR);

    const params = useCreateGardenStore.getState().getParams();
    expect(params).not.toBeNull();
    expect(params?.domainMask).toBe((1 << Domain.SOLAR) | (1 << Domain.WASTE));
    expect(params?.gardeners).toEqual([GARDENER]);
    expect(params?.stewards).toEqual([getAddress(OPERATOR)]);
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

it("retains an accepted submission across draft reset and session rehydration", async () => {
  resetCreateGardenStore();
  const pendingSubmission = {
    accountAddress: MEMBER as `0x${string}`,
    chainId: 11155111,
    gardenName: "Pending garden",
    result: {
      hash: "0xSafeProposalIdentifier" as const,
      sponsored: false,
      confirmation: "pending" as const,
    },
  };
  useCreateGardenStore.setState({ pendingSubmission });
  useCreateGardenStore.getState().reset();
  expect(useCreateGardenStore.getState().pendingSubmission).toEqual(pendingSubmission);
  const saved = sessionStorage.getItem("green-goods:create-garden")!;
  useCreateGardenStore.setState({ pendingSubmission: undefined });
  sessionStorage.setItem("green-goods:create-garden", saved);
  await useCreateGardenStore.persist.rehydrate();
  expect(useCreateGardenStore.getState().pendingSubmission).toEqual(pendingSubmission);
  resetCreateGardenStore();
  expect(useCreateGardenStore.getState().pendingSubmission).toBeUndefined();
});
