/** @vitest-environment happy-dom */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PublicImpactEvidenceRecord } from "@green-goods/shared/public-contracts/public-impact";
import messages from "@green-goods/shared/i18n/en";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PublicEvidenceDialog } from "../../components/Public/PublicEvidenceDialog";

const defaultChain = vi.hoisted(() => ({ id: 42161 }));
vi.mock("@green-goods/shared/config/default-chain", () => ({
  get DEFAULT_CHAIN_ID() {
    return defaultChain.id;
  },
}));

const UID = `0x${"ab".repeat(32)}`;
const record: PublicImpactEvidenceRecord = {
  id: `assessment:${UID}`,
  kind: "assessment",
  gardenId: "0x1111",
  gardenName: "Fixture Garden",
  title: "Soil assessment",
  easUid: UID,
  sourceAvailable: true,
  createdAt: 1742256000,
};

function renderDialog(value = record) {
  return render(
    <IntlProvider locale="en" messages={messages}>
      <PublicEvidenceDialog open onClose={() => {}} record={value} />
    </IntlProvider>
  );
}

describe("Public evidence explorer links", () => {
  beforeEach(() => {
    defaultChain.id = 42161;
    // The site is served over HTTPS, where the Clipboard API is available.
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    { chainId: 42161, domain: "arbitrum" },
    { chainId: 11155111, domain: "sepolia" },
  ])("links and displays the default chain's explorer ($domain)", async ({ chainId, domain }) => {
    defaultChain.id = chainId;
    const user = userEvent.setup();
    renderDialog();
    await user.click(screen.getByText("Record Details"));
    expect(screen.getByRole("link", { name: "Open ↗" })).toHaveAttribute(
      "href",
      `https://${domain}.easscan.org/attestation/view/${UID}`
    );
    expect(
      screen.getByText(`${domain}.easscan.org/attestation/view/0xababab…abab`)
    ).toBeInTheDocument();
  });

  it("copies the same Arbitrum source URL when the reader cites a record", async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Cite this record" }));
    expect(write).toHaveBeenCalledWith(`https://arbitrum.easscan.org/attestation/view/${UID}`);
    // PUB-048: the reader sees that the citation is on the clipboard.
    expect(await screen.findByRole("button", { name: "Citation copied" })).toBeInTheDocument();
  });

  it("says when a citation could not be copied", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    renderDialog();
    await user.click(screen.getByRole("button", { name: "Cite this record" }));
    expect(
      await screen.findByRole("button", { name: "Couldn’t copy. Try again" })
    ).toBeInTheDocument();
  });

  // PUB-048: View Source opens the record it names, or says its source is still to come.
  it("links View Source to the record's attestation, and says so when it has none yet", () => {
    renderDialog();
    expect(screen.getByRole("link", { name: /View Source/ })).toHaveAttribute(
      "href",
      `https://arbitrum.easscan.org/attestation/view/${UID}`
    );
    cleanup();
    renderDialog({ ...record, easUid: undefined, sourceAvailable: true });
    expect(screen.queryByRole("link", { name: /View Source/ })).not.toBeInTheDocument();
    expect(screen.getByText("Source pending")).toBeInTheDocument();
  });

  it("does not invent an explorer link or citation when the attestation is absent", () => {
    renderDialog({ ...record, easUid: undefined, sourceAvailable: false });
    expect(screen.queryByRole("link", { hidden: true })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cite this record" })).not.toBeInTheDocument();
    expect(screen.getByText("Awaiting steward review")).toBeInTheDocument();
  });
});
