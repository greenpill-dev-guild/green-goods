import enMessages from "@green-goods/shared/i18n/en";
import { Domain } from "@green-goods/shared/types/domain";
import { createIntl } from "react-intl";
import { describe, expect, it } from "vitest";
import {
  buildGardenSettingsSaveRows,
  type GardenSettingsSaveRun,
  gardenSettingsSaveLine,
  gardenSettingsValueText,
  settleGardenSettingsRun,
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

describe("a save under one signature", () => {
  const together = (
    state: "waiting" | "saved" | "failed" | "unconfirmed",
    status: GardenSettingsSaveRun["status"]
  ): GardenSettingsSaveRun => ({
    status,
    fields: ["name", "description"],
    oneSignature: true,
    progress: {
      name: { state, hash: null },
      description: { state, hash: null },
    },
  });

  it("numbers its rows as one prompt and says what they wait for", () => {
    const rows = buildGardenSettingsSaveRows(together("waiting", "running"), formatMessage);
    expect(rows.map((row) => [row.prompt, row.label])).toEqual([
      [1, "Waiting for your signature"],
      [1, "Waiting for your signature"],
    ]);
    expect(buildGardenSettingsSaveRows(together("saved", "complete"), formatMessage)[0].label).toBe(
      "Saved"
    );
    expect(
      buildGardenSettingsSaveRows(together("unconfirmed", "unconfirmed"), formatMessage)[0]
    ).toMatchObject({ label: "Not confirmed yet", marker: "queued", current: false });
  });

  it("says one signature before it starts, and what happened after", () => {
    expect(gardenSettingsSaveLine(null, 3, formatMessage, true)).toBe("3 changes · 1 signature");
    expect(gardenSettingsSaveLine(together("failed", "stopped"), 2, formatMessage)).toBe(
      "Nothing was saved. Your edits are still here."
    );
    expect(gardenSettingsSaveLine(together("unconfirmed", "unconfirmed"), 0, formatMessage)).toBe(
      "We couldn’t confirm this save. Your edits are still here."
    );
  });

  describe("settleGardenSettingsRun", () => {
    const unknown = together("unconfirmed", "unconfirmed");

    it("stays unconfirmed while its fields are held", () => {
      expect(settleGardenSettingsRun(unknown, [], ["name", "description"])).toEqual(unknown);
    });

    it("finishes when every field landed", () => {
      expect(settleGardenSettingsRun(unknown, ["name", "description"], [])).toMatchObject({
        status: "complete",
        progress: { name: { state: "saved" }, description: { state: "saved" } },
      });
    });

    it("gives way to the form when the person moved on", () => {
      expect(settleGardenSettingsRun(unknown, [], [])).toBeNull();
    });

    it("leaves any other run alone", () => {
      const stopped = together("failed", "stopped");
      expect(settleGardenSettingsRun(stopped, [], [])).toBe(stopped);
      expect(settleGardenSettingsRun(null, [], [])).toBeNull();
    });
  });

  it.each([
    [{ field: "name", value: "Tech and Sun" }, "Tech and Sun"],
    [{ field: "location", value: "" }, "Empty"],
    [{ field: "openJoining", value: true }, "On"],
    [{ field: "openJoining", value: false }, "Off"],
    [{ field: "maxGardeners", value: 25 }, "25"],
    [{ field: "maxGardeners", value: 0 }, "No limit"],
    [{ field: "domains", value: [Domain.SOLAR, Domain.EDU] }, "Solar, Education"],
    [{ field: "domains", value: [] }, "None"],
    [{ field: "banner", value: "https://example.org/a.png" }, "An image"],
    [{ field: "banner", value: "" }, "No image"],
  ] as const)("reads %o as %s", (change, text) => {
    expect(gardenSettingsValueText(change, formatMessage)).toBe(text);
  });
});
