import { renderHookWithQueryClient, waitFor } from "@green-goods/shared/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useActionsByUID } from "../../../hooks/action/useAction";
import { getActions } from "../../../modules/data/greengoods";
import { type Action, Domain } from "../../../types/domain";

vi.mock("../../../modules/data/greengoods", () => ({ getActions: vi.fn() }));
vi.mock("../../../modules/data/historical-action", () => ({ getActionAtWork: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useActionsByUID", () => {
  it("loads a full activity page in one request and reuses reordered identities", async () => {
    const uids = Array.from({ length: 50 }, (_, index) => index + 1);
    const actions: Action[] = uids.map((uid) => ({
      id: `42161-${uid}`,
      title: `Custom action ${uid}`,
      slug: `custom.${uid}`,
      inputs: [],
      description: "",
      domain: Domain.AGRO,
      capitals: [],
      media: [],
      createdAt: 0,
      startTime: 0,
      endTime: 0,
    }));
    vi.mocked(getActions).mockResolvedValue(actions);
    const { result, rerender } = renderHookWithQueryClient(
      ({ ids }) => useActionsByUID(ids, 42161),
      {
        initialProps: { ids: [...uids].reverse().concat(1, -1, Number.NaN) },
      }
    );
    await waitFor(() => expect(result.current).toEqual(actions));
    expect(getActions).toHaveBeenCalledExactlyOnceWith(undefined, {
      chainId: 42161,
      actionIds: uids.map((uid) => `42161-${uid}`),
    });
    rerender({ ids: [...uids, 1] });
    expect(result.current).toEqual(actions);
    expect(getActions).toHaveBeenCalledTimes(1);
  });

  it("does not fetch an unfiltered catalog for an empty activity list", () => {
    const { result } = renderHookWithQueryClient(() => useActionsByUID([], 42161));
    expect(result.current).toEqual([]);
    expect(getActions).not.toHaveBeenCalled();
  });
});
