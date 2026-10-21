/** @vitest-environment happy-dom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  trackGraphQLError: vi.fn(),
  failedOnSteadyConnection: vi.fn(),
  steady: true,
}));

vi.mock("graphql-request", () => ({
  GraphQLClient: class {
    request = mocks.request;
  },
}));

vi.mock("../../modules/app/error-tracking", () => ({
  trackGraphQLError: mocks.trackGraphQLError,
}));

vi.mock("../../stores/connectivity", () => ({
  connectivityStore: {
    failedOnSteadyConnection: mocks.failedOnSteadyConnection,
  },
}));

import { GQLClient } from "../../modules/data/graphql-client";

describe("GraphQL error telemetry connectivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.steady = true;
    mocks.request.mockRejectedValue(new Error("network unavailable"));
    mocks.failedOnSteadyConnection.mockImplementation(() => Promise.resolve(mocks.steady));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports a query failure on a steady connection", async () => {
    const result = await new GQLClient("https://example.test/graphql").query(
      "query Test { value }",
      {},
      "Test"
    );

    expect(result).toMatchObject({ error: { message: "network unavailable" } });
    await vi.waitFor(() => expect(mocks.trackGraphQLError).toHaveBeenCalledTimes(1));
  });

  it("does not report a query failure that a network change caused", async () => {
    mocks.steady = false;

    const result = await new GQLClient("https://example.test/graphql").query(
      "query Test { value }",
      {},
      "Test"
    );

    expect(result).toMatchObject({ error: { message: "network unavailable" } });
    await Promise.resolve();
    expect(mocks.trackGraphQLError).not.toHaveBeenCalled();
  });

  it("classifies a failure from the moment its request started", async () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    mocks.request.mockImplementation(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("network unavailable")), 3_000);
        })
    );

    const result = new GQLClient("https://example.test/graphql").query(
      "query Test { value }",
      {},
      "Test"
    );
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(result).resolves.toMatchObject({ error: { message: "network unavailable" } });
    expect(mocks.failedOnSteadyConnection).toHaveBeenCalledWith(startedAt);
  });
});
