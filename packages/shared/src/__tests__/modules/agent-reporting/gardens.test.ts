import { describe, expect, it } from "vitest";
import {
  GARDENS_HIDDEN_EVERYWHERE,
  GARDENS_HIDDEN_FROM_EDITORIAL,
} from "../../../config/garden-visibility";
import { acceptsChatReports } from "../../../modules/agent-reporting/gardens";

describe("gardens that accept chat reports", () => {
  it.each([
    {
      label: "initialized visible garden",
      address: "0x00000000000000000000000000000000000000a1",
      initialized: true,
      expected: true,
    },
    {
      label: "uninitialized garden",
      address: "0x00000000000000000000000000000000000000a1",
      initialized: false,
      expected: false,
    },
    {
      label: "garden hidden everywhere",
      address: GARDENS_HIDDEN_EVERYWHERE[0]!.address.toLowerCase(),
      initialized: true,
      expected: false,
    },
    {
      label: "garden hidden only from editorial",
      address: GARDENS_HIDDEN_FROM_EDITORIAL[0]!.address,
      initialized: true,
      expected: true,
    },
  ])("handles $label", ({ address, initialized, expected }) => {
    expect(acceptsChatReports({ address, initialized })).toBe(expected);
  });
});
