import enMessages from "@green-goods/shared/i18n/en";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import {
  buildGardenSettingsSaveRows,
  type GardenSettingsSaveRun,
  gardenSettingsSaveLine,
} from "./gardenSettingsSave";

const { formatMessage } = createIntl({ locale: "en", messages: enMessages });

const stopped: GardenSettingsSaveRun = {
  status: "stopped",
  fields: ["name", "description", "location"],
  progress: {
    name: { state: "saved", hash: "0x01" },
    description: { state: "failed", hash: null },
    location: { state: "queued", hash: null },
  },
};

describe("buildGardenSettingsSaveRows", () => {
  it.each([
    ["queued", "pending", null, false],
    ["uploading", "active", "Uploading the image…", true],
    ["waiting", "active", "Waiting for your wallet", true],
    ["saved", "complete", "Confirmed", false],
    ["proposed", "warning", "Sent to your Safe", false],
    ["failed", "failed", "Didn’t go through", false],
  ] as const)("a %s field reads %s with %s", (state, marker, label, current) => {
    const [row] = buildGardenSettingsSaveRows(
      { status: "running", fields: ["banner"], progress: { banner: { state, hash: "0x01" } } },
      formatMessage
    );
    expect(row).toMatchObject({ title: "Banner image", status: state, marker, label, current });
    // Only a saved field links to the transaction that carried it.
    expect(row.hash).toBe(state === "saved" ? "0x01" : null);
  });

  it("numbers each row by the wallet prompt it takes, in save order", () => {
    const rows = buildGardenSettingsSaveRows(stopped, formatMessage);
    expect(rows.map((row) => [row.title, row.prompt])).toEqual([
      ["Name", 1],
      ["Description", 2],
      ["Location", 3],
    ]);
  });
});

describe("gardenSettingsSaveLine", () => {
  it.each([
    ["before a save, one confirmation per change", null, 3, "3 changes · 3 wallet confirmations"],
    ["a single change", null, 1, "1 change · 1 wallet confirmation"],
    ["nothing to save", null, 0, "All changes saved"],
    ["a running save", { ...stopped, status: "running" as const }, 2, "Saving changes…"],
    [
      "a stopped save",
      stopped,
      2,
      "Stopped at Description. 1 of 3 saved. Your other edits are still here.",
    ],
    ["a finished save", { ...stopped, status: "complete" as const }, 0, "All changes saved"],
    [
      "a save a Safe still has to execute",
      {
        status: "complete" as const,
        fields: ["name"] as const,
        progress: { name: { state: "proposed" as const, hash: null } },
      },
      0,
      "Sent to your Safe. The changes apply once the Safe executes them.",
    ],
  ])("reads %s", (_case, run, pendingCount, line) => {
    expect(gardenSettingsSaveLine(run, pendingCount, formatMessage)).toBe(line);
  });
});
