import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Mock window.matchMedia before anything else
beforeAll(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

// Mock the shared modules - must use inline function for hoisting
vi.mock("@green-goods/shared/modules", () => ({
  track: vi.fn(),
  mediaResourceManager: {
    getOrCreateUrl: vi.fn((file: File) => URL.createObjectURL(file)),
    cleanupUrls: vi.fn(),
  },
}));

// Mock image compressor
vi.mock("@green-goods/shared/utils/work/image-compression", () => ({
  imageCompressor: {
    shouldCompress: () => false,
    compressImages: vi.fn().mockResolvedValue([]),
    getCompressionStats: vi.fn().mockReturnValue({}),
  },
}));

import { track } from "@green-goods/shared/modules";
// Import after mocks
import { WorkMedia } from "../../views/Garden/Media";

const messages = {
  "app.garden.upload.title": "Upload Media",
  "app.garden.submit.tab.media.instruction": "Please take a clear photo",
  "app.garden.upload.progress": "{current} of {required} photos uploaded",
  "app.garden.upload.maxAllowed": "max {max}",
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <IntlProvider messages={messages} locale="en" defaultLocale="en">
      {ui}
    </IntlProvider>
  );
}

// Cast track to mock for type safety
const mockTrack = track as ReturnType<typeof vi.fn>;

describe("WorkMedia PostHog diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tracks media_upload_button_clicked when gallery button ref is called", () => {
    const setImages = vi.fn();
    const galleryClickRef = { current: null as (() => void) | null };

    renderWithIntl(
      <WorkMedia
        config={{ required: false, maxImageCount: 5 }}
        images={[]}
        setImages={setImages}
        minRequired={1}
        onGalleryClickRef={galleryClickRef}
      />
    );

    // Call the exposed handler
    if (galleryClickRef.current) {
      galleryClickRef.current();
    }

    expect(mockTrack).toHaveBeenCalledWith(
      "media_upload_button_clicked",
      expect.objectContaining({
        source: "gallery",
        programmatic_click: true,
        platform: expect.any(String),
        isStandalone: expect.any(Boolean),
      })
    );
  });

  it("tracks media_upload_empty_files when onChange fires with no files", async () => {
    const setImages = vi.fn();

    renderWithIntl(
      <WorkMedia
        config={{ required: false, maxImageCount: 5 }}
        images={[]}
        setImages={setImages}
        minRequired={1}
      />
    );

    // Find the hidden file input and trigger change with no files
    const galleryInput = document.getElementById("work-media-upload") as HTMLInputElement;
    expect(galleryInput).toBeTruthy();

    // Simulate file picker closing without selection
    fireEvent.change(galleryInput, { target: { files: null } });

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        "media_upload_onchange_fired",
        expect.objectContaining({
          files_length: 0,
          files_is_null: true,
        })
      );
    });

    expect(mockTrack).toHaveBeenCalledWith(
      "media_upload_empty_files",
      expect.objectContaining({
        files_is_null: true,
        files_length: 0,
      })
    );
  });

  it("tracks media_upload_files_received when files are selected", async () => {
    const setImages = vi.fn();
    const mockFile = new File(["content"], "test.jpg", { type: "image/jpeg" });

    renderWithIntl(
      <WorkMedia
        config={{ required: false, maxImageCount: 5 }}
        images={[]}
        setImages={setImages}
        minRequired={1}
      />
    );

    const galleryInput = document.getElementById("work-media-upload") as HTMLInputElement;

    // Create a mock FileList
    const mockFileList = {
      0: mockFile,
      length: 1,
      item: (index: number) => (index === 0 ? mockFile : null),
      [Symbol.iterator]: function* () {
        yield mockFile;
      },
    } as unknown as FileList;

    // Simulate file selection
    fireEvent.change(galleryInput, { target: { files: mockFileList } });

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith(
        "media_upload_files_received",
        expect.objectContaining({
          file_count: 1,
          mime_types: ["image/jpeg"],
        })
      );
    });
  });

  it("displays upload progress badge when minRequired is set", () => {
    const setImages = vi.fn();

    renderWithIntl(
      <WorkMedia
        config={{ required: true, maxImageCount: 5, minImageCount: 2 }}
        images={[]}
        setImages={setImages}
        minRequired={2}
      />
    );

    // Should show "0 of 2 photos uploaded" in a badge
    expect(screen.getByText(/0 of 2 photos uploaded/)).toBeInTheDocument();
  });

  it("shows checkmark in badge when images meet minRequired", () => {
    const setImages = vi.fn();
    const mockFile = new File(["content"], "test.jpg", { type: "image/jpeg" });

    renderWithIntl(
      <WorkMedia
        config={{ required: true, maxImageCount: 5, minImageCount: 1 }}
        images={[mockFile]}
        setImages={setImages}
        minRequired={1}
      />
    );

    // Should show "1 of 1 photos uploaded ✓" in the badge
    expect(screen.getByText(/1 of 1 photos uploaded.*✓/)).toBeInTheDocument();
  });
});
