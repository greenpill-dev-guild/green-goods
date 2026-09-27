import { describe, expect, it } from "vitest";
import {
  GARDENS_HIDDEN_EVERYWHERE,
  GARDENS_HIDDEN_FROM_EDITORIAL,
} from "../../../config/garden-visibility";
import { acceptsChatReports } from "../../../modules/agent-reporting/gardens";

describe("gardens that accept chat reports", () => {
  it("takes every initialized garden the app shows, including ones kept off the public website", () => {
    const aGarden = "0x00000000000000000000000000000000000000a1";
    expect(acceptsChatReports({ address: aGarden, initialized: true })).toBe(true);
    expect(acceptsChatReports({ address: aGarden, initialized: false })).toBe(false);

    const [hidden] = GARDENS_HIDDEN_EVERYWHERE;
    const [editorialOnly] = GARDENS_HIDDEN_FROM_EDITORIAL;
    expect(
      acceptsChatReports({ address: hidden?.address.toLowerCase() ?? "", initialized: true })
    ).toBe(false);
    expect(acceptsChatReports({ address: editorialOnly?.address ?? "", initialized: true })).toBe(
      true
    );
  });
});
