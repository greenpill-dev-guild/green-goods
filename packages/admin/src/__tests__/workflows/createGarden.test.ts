import { describe, it, expect, beforeEach } from "vitest";
import { createActor } from "xstate";
import { createGardenMachine } from "@/workflows/createGarden";
import type { CreateGardenParams } from "@/types/contracts";

describe("createGarden workflow", () => {
  let actor: ReturnType<typeof createActor>;

  beforeEach(() => {
    actor = createActor(createGardenMachine);
    actor.start();
  });

  afterEach(() => {
    actor.stop();
  });

  it("should start in idle state", () => {
    expect(actor.getSnapshot().value).toBe("idle");
    expect(actor.getSnapshot().context.retryCount).toBe(0);
  });

  it("should transition through validating to ready when started with valid params", () => {
    const params: CreateGardenParams = {
      name: "Test Garden",
      description: "A test garden",
      location: "Test Location",
      bannerImage: "https://example.com/banner.jpg",
      communityToken: "0x1234567890123456789012345678901234567890",
      operators: ["0x123"],
      gardeners: ["0x456"],
    };

    actor.send({ type: "START", params });

    // The machine automatically validates and transitions to ready if params are valid
    expect(actor.getSnapshot().value).toBe("ready");
    expect(actor.getSnapshot().context.gardenParams).toEqual(params);
  });

  it("should transition to ready after successful validation", () => {
    const validParams: CreateGardenParams = {
      name: "Test Garden",
      description: "A test garden",
      location: "Test Location",
      bannerImage: "https://example.com/banner.jpg",
      communityToken: "0x1234567890123456789012345678901234567890",
      operators: ["0x123"],
      gardeners: ["0x456"],
    };

    actor.send({ type: "START", params: validParams });

    // Should automatically transition to ready if params are valid
    expect(actor.getSnapshot().value).toBe("ready");
  });

  it("should transition to submitting when submit is triggered", () => {
    const validParams: CreateGardenParams = {
      name: "Test Garden",
      description: "A test garden",
      location: "Test Location",
      bannerImage: "https://example.com/banner.jpg",
      communityToken: "0x1234567890123456789012345678901234567890",
      operators: ["0x123"],
      gardeners: ["0x456"],
    };

    actor.send({ type: "START", params: validParams });
    actor.send({ type: "SUBMIT" });

    expect(actor.getSnapshot().value).toBe("submitting");
  });

  it("should transition to success when transaction succeeds", () => {
    const validParams: CreateGardenParams = {
      name: "Test Garden",
      description: "A test garden",
      location: "Test Location",
      bannerImage: "https://example.com/banner.jpg",
      communityToken: "0x1234567890123456789012345678901234567890",
      operators: ["0x123"],
      gardeners: ["0x456"],
    };

    actor.send({ type: "START", params: validParams });
    actor.send({ type: "SUBMIT" });
    actor.send({ type: "SUCCESS", txHash: "0xabcdef" });

    expect(actor.getSnapshot().value).toBe("success");
    expect(actor.getSnapshot().context.txHash).toBe("0xabcdef");
  });

  it("should transition to error when transaction fails", () => {
    const validParams: CreateGardenParams = {
      name: "Test Garden",
      description: "A test garden",
      location: "Test Location",
      bannerImage: "https://example.com/banner.jpg",
      communityToken: "0x1234567890123456789012345678901234567890",
      operators: ["0x123"],
      gardeners: ["0x456"],
    };

    actor.send({ type: "START", params: validParams });
    actor.send({ type: "SUBMIT" });
    actor.send({ type: "FAILURE", error: "Transaction failed" });

    expect(actor.getSnapshot().value).toBe("error");
    expect(actor.getSnapshot().context.error).toBe("Transaction failed");
  });

  it("should handle retry from error state", () => {
    const validParams: CreateGardenParams = {
      name: "Test Garden",
      description: "A test garden",
      location: "Test Location",
      bannerImage: "https://example.com/banner.jpg",
      communityToken: "0x1234567890123456789012345678901234567890",
      operators: ["0x123"],
      gardeners: ["0x456"],
    };

    actor.send({ type: "START", params: validParams });
    actor.send({ type: "SUBMIT" });
    actor.send({ type: "FAILURE", error: "Transaction failed" });

    expect(actor.getSnapshot().value).toBe("error");

    actor.send({ type: "RETRY" });

    // After retry, should go back to submitting state
    expect(actor.getSnapshot().value).toBe("submitting");
    expect(actor.getSnapshot().context.retryCount).toBe(1);
  });

  it("should reset to idle state", () => {
    const validParams: CreateGardenParams = {
      name: "Test Garden",
      description: "A test garden",
      location: "Test Location",
      bannerImage: "https://example.com/banner.jpg",
      communityToken: "0x1234567890123456789012345678901234567890",
      operators: ["0x123"],
      gardeners: ["0x456"],
    };

    actor.send({ type: "START", params: validParams });
    actor.send({ type: "SUBMIT" });
    actor.send({ type: "SUCCESS", txHash: "0xabcdef" });
    actor.send({ type: "RESET" });

    expect(actor.getSnapshot().value).toBe("idle");
    expect(actor.getSnapshot().context.retryCount).toBe(0);
    expect(actor.getSnapshot().context.txHash).toBeUndefined();
    expect(actor.getSnapshot().context.error).toBeUndefined();
  });

  it("should reject invalid params during validation", () => {
    const invalidParams: CreateGardenParams = {
      name: "", // Invalid: empty name
      description: "A test garden",
      location: "Test Location",
      bannerImage: "https://example.com/banner.jpg",
      communityToken: "invalid-token", // Invalid: not a proper address
      operators: ["0x123"],
      gardeners: ["0x456"],
    };

    actor.send({ type: "START", params: invalidParams });

    // Should transition to invalid state due to validation failure
    expect(actor.getSnapshot().value).toBe("invalid");
  });
});
