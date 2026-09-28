/** @vitest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENSProgressTimeline } from "../../components/Progress/ENSProgressTimeline";
import { toastService } from "../../components/toast";
import { copyToClipboard } from "../../utils/app/clipboard";

const resetTimer = vi.hoisted(() => vi.fn());

vi.mock("../../utils/app/clipboard", () => ({ copyToClipboard: vi.fn() }));
vi.mock("../../components/toast", () => ({ toastService: { error: vi.fn() } }));
vi.mock("../../hooks/utils/useTimeout", () => ({
  useTimeout: () => ({ set: resetTimer }),
}));

function renderTimeline() {
  return render(
    <IntlProvider locale="en">
      <ENSProgressTimeline data={{ status: "pending", ccipMessageId: "0x1234" }} slug="my-garden" />
    </IntlProvider>
  );
}

describe("ENSProgressTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports a clipboard failure without scheduling a copied state", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue(false);
    renderTimeline();

    await userEvent.click(screen.getByRole("button", { name: "Copy CCIP message ID" }));

    await waitFor(() => expect(toastService.error).toHaveBeenCalledWith({ title: "Copy failed" }));
    expect(copyToClipboard).toHaveBeenCalledWith("0x1234");
    expect(resetTimer).not.toHaveBeenCalled();
  });

  it("schedules reset only after the clipboard succeeds", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue(true);
    renderTimeline();

    await userEvent.click(screen.getByRole("button", { name: "Copy CCIP message ID" }));

    await waitFor(() => expect(resetTimer).toHaveBeenCalledWith(expect.any(Function), 2000));
    expect(toastService.error).not.toHaveBeenCalled();
  });
});
