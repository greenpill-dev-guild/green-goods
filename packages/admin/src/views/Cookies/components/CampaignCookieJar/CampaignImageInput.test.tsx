// TEST-QUALITY: allow-small-test-file - the campaign image input's only test, pinning what a steward reads when an image cannot be checked for its location
import enMessages from "@green-goods/shared/i18n/en";
import { UnpublishableImageError } from "@green-goods/shared/modules/data/ipfs/upload";
import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { CampaignImageInput } from "./CampaignImageInput";

const { mockUploadFileToIPFS } = vi.hoisted(() => ({ mockUploadFileToIPFS: vi.fn() }));

vi.mock("@green-goods/shared/modules/data/ipfs/upload", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@green-goods/shared/modules/data/ipfs/upload")>();
  return { ...actual, uploadFileToIPFS: mockUploadFileToIPFS };
});

describe("CampaignImageInput", () => {
  it("says an image that could not be checked for its location was not uploaded, and sets no URL", async () => {
    mockUploadFileToIPFS.mockRejectedValue(new UnpublishableImageError("cover.heic"));
    const onChange = vi.fn();
    const { container } = render(
      <IntlProvider locale="en" messages={enMessages}>
        <CampaignImageInput
          value=""
          onChange={onChange}
          file={null}
          onFileChange={vi.fn()}
          source="campaign-image-test"
        />
      </IntlProvider>
    );

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["heic"], "cover.heic", { type: "image/heic" })] },
    });

    expect(await screen.findByText(enMessages["app.common.imageUnreadable"])).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
