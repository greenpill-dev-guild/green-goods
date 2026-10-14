/**
 * FileUploadField decides which chosen files are compressed before they reach the form, reports a
 * failed compression without sending anything, and shows staged file names as plain text.
 */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FileUploadField } from "../../components/FileUploadField";
import { toastService } from "../../components/Toast/toast.service";
import { imageCompressor } from "../../utils/work/image-compression";
import { renderWithProviders } from "../test-utils/render-helpers";

const file = (name: string, type: string, sizeBytes: number) =>
  new File([new Uint8Array(sizeBytes)], name, { type });

function chooseFiles(files: File[]) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("FileUploadField renders no file input");
  fireEvent.change(input, { target: { files } });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FileUploadField", () => {
  it("hands chosen files straight to the form when compression is off", async () => {
    const onFilesChange = vi.fn();
    const shouldCompress = vi.spyOn(imageCompressor, "shouldCompress");
    const photo = file("photo.jpg", "image/jpeg", 4 * 1024 * 1024);
    renderWithProviders(<FileUploadField onFilesChange={onFilesChange} accept="image/*" />);

    chooseFiles([photo]);

    await waitFor(() => expect(onFilesChange).toHaveBeenCalledWith([photo]));
    expect(shouldCompress).not.toHaveBeenCalled();
  });

  it("compresses only the images over the size limit and keeps the rest as chosen", async () => {
    const onFilesChange = vi.fn();
    const small = file("small.png", "image/png", 10 * 1024);
    const large = file("large.jpg", "image/jpeg", 4 * 1024 * 1024);
    const compressed = file("large.jpg", "image/jpeg", 700 * 1024);
    vi.spyOn(imageCompressor, "shouldCompress").mockImplementation(
      (candidate, thresholdKB = 500) => candidate.size > thresholdKB * 1024
    );
    const compressImages = vi
      .spyOn(imageCompressor, "compressImages")
      .mockResolvedValue([
        { file: compressed } as Awaited<ReturnType<typeof imageCompressor.compressImages>>[number],
      ]);
    renderWithProviders(
      <FileUploadField onFilesChange={onFilesChange} accept="image/*" compress multiple />
    );

    chooseFiles([small, large]);

    await waitFor(() => expect(onFilesChange).toHaveBeenCalledWith([small, compressed]));
    expect(compressImages).toHaveBeenCalledWith([large], expect.any(Object), expect.any(Function));
  });

  it("reports a failed compression in a short message and sends nothing to the form", async () => {
    const onFilesChange = vi.fn();
    vi.spyOn(imageCompressor, "shouldCompress").mockReturnValue(true);
    vi.spyOn(imageCompressor, "compressImages").mockRejectedValue(new Error("x".repeat(300)));
    const error = vi.spyOn(toastService, "error").mockReturnValue("file-upload");
    renderWithProviders(
      <FileUploadField onFilesChange={onFilesChange} accept="image/*" compress />
    );

    chooseFiles([file("large.jpg", "image/jpeg", 4 * 1024 * 1024)]);

    await waitFor(() => expect(error).toHaveBeenCalledTimes(1));
    const message = error.mock.calls[0][0].message ?? "";
    expect(message.endsWith("...")).toBe(true);
    expect(message.length).toBeLessThan(160);
    expect(onFilesChange).not.toHaveBeenCalled();
  });

  it("shows a staged file's name as text, without markup or control characters", () => {
    const hostile = file('<img src=x onerror="alert(1)">\u0007.png', "text/plain", 2048);
    renderWithProviders(
      <FileUploadField onFilesChange={vi.fn()} currentFiles={[hostile]} onRemoveFile={vi.fn()} />
    );

    expect(screen.getByText("img src=x onerror=alert(1).png")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove img src=x onerror=alert(1).png" })
    ).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
