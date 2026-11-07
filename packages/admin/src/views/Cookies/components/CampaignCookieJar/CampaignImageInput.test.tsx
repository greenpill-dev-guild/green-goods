import { AdminUploadPolicyContext } from "@green-goods/shared/hooks/admin-ui/useAdminUploadPolicy";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import enMessages from "@green-goods/shared/i18n/en";
import { UnpublishableImageError } from "@green-goods/shared/modules/data/ipfs/upload";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CampaignImageInput } from "./CampaignImageInput";

const { mockUploadFileToIPFS } = vi.hoisted(() => ({ mockUploadFileToIPFS: vi.fn() }));

vi.mock("@green-goods/shared/modules/data/ipfs/upload", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@green-goods/shared/modules/data/ipfs/upload")>();
  return { ...actual, uploadFileToIPFS: mockUploadFileToIPFS };
});

function selectImage(authorizeUpload: () => Promise<boolean>, onChange = vi.fn()) {
  const { container } = render(
    <IntlProvider locale="en" messages={enMessages}>
      <AdminUploadPolicyContext.Provider value={authorizeUpload}>
        <CampaignImageInput
          value=""
          onChange={onChange}
          file={null}
          onFileChange={vi.fn()}
          source="campaign-image-test"
        />
      </AdminUploadPolicyContext.Provider>
    </IntlProvider>
  );
  fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
    target: { files: [new File(["heic"], "cover.heic", { type: "image/heic" })] },
  });
  return onChange;
}

describe("CampaignImageInput", () => {
  beforeEach(() => {
    mockUploadFileToIPFS.mockReset();
  });

  it("waits for the agreement before publishing a selected file", async () => {
    let accept!: (accepted: boolean) => void;
    const authorizeUpload = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          accept = resolve;
        })
    );
    mockUploadFileToIPFS.mockResolvedValue({ cid: "test-cid" });
    const onChange = selectImage(authorizeUpload);
    expect(authorizeUpload).toHaveBeenCalledOnce();
    expect(mockUploadFileToIPFS).not.toHaveBeenCalled();

    await act(async () => accept(true));
    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(mockUploadFileToIPFS).toHaveBeenCalledOnce();
  });

  it("does not upload or set the image when the agreement is canceled", async () => {
    const authorizeUpload = vi.fn(async () => false);
    const onChange = selectImage(authorizeUpload);
    await act(async () => {});
    expect(authorizeUpload).toHaveBeenCalledOnce();
    expect(mockUploadFileToIPFS).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("says an image that could not be checked for its location was not uploaded, and sets no URL", async () => {
    mockUploadFileToIPFS.mockRejectedValue(new UnpublishableImageError("cover.heic"));
    // Stubbed, so no dismiss timer outlives the test.
    const toastError = vi.spyOn(toastService, "error").mockImplementation(() => "toast");
    const onChange = selectImage(async () => true);

    expect(await screen.findByText(enMessages["app.common.imageUnreadable"])).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(
      expect.objectContaining({ message: enMessages["app.common.imageUnreadable"] })
    );
    toastError.mockRestore();
  });
});
