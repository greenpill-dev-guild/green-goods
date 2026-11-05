import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { runGardenRoleWrites } from "../../hooks/garden/gardenRoleWriteQueue";
import type { GardenMemberRow } from "../../modules/garden/members-batch";

const garden = "0x1111111111111111111111111111111111111111";
const row: GardenMemberRow = {
  address: "0x2222222222222222222222222222222222222222",
  role: "gardener",
};
const other: GardenMemberRow = { ...row, address: "0x3333333333333333333333333333333333333333" };

describe("garden role writes sharing a cache", () => {
  it("holds overlapping batches through settlement and releases after a rejection", async () => {
    const client = new QueryClient();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const write = vi.fn(async () => "added");
    const failed = runGardenRoleWrites(client, 42161, garden, [row, other], async () => {
      await pending;
      throw new Error("declined");
    });
    const rejection = expect(failed).rejects.toThrow("declined");
    const next = runGardenRoleWrites(client, 42161, garden, [other, row], write);
    await Promise.resolve();
    expect(write).not.toHaveBeenCalled();
    release();
    await rejection;
    await expect(next).resolves.toBe("added");
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("lets independent people, roles, chains and query caches proceed", async () => {
    const client = new QueryClient();
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const held = runGardenRoleWrites(client, 42161, garden, [row], () => pending);
    const independent = vi.fn(async () => "settled");
    await Promise.all([
      runGardenRoleWrites(client, 42161, garden, [other], independent),
      runGardenRoleWrites(client, 42161, garden, [{ ...row, role: "steward" }], independent),
      runGardenRoleWrites(client, 100, garden, [row], independent),
      runGardenRoleWrites(new QueryClient(), 42161, garden, [row], independent),
    ]);
    expect(independent).toHaveBeenCalledTimes(4);
    release();
    await held;
  });
});
