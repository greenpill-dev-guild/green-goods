/**
 * WorkMedia Component Tests
 *
 * Tests for the media upload component used in work submission.
 */

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

// Mock the shared modules
vi.mock("@green-goods/shared/modules", () => ({
  track: vi.fn(),
  mediaResourceManager: {
    getOrCreateUrl: vi.fn((file: File) => `blob:mock-url-${file.name}`),
    cleanupUrls: vi.fn(),
  },
}));

// Mock image compressor
vi.mock("@green-goods/shared/utils/work/image-compression", () => ({
  imageCompressor: {
    shouldCompress: () => false,
    compressImages: vi.fn().mockImplementation((files) => Promise.resolve(files)),
    getCompressionStats: vi.fn().mockReturnValue({}),
  },
}));

// Mock the components that WorkMedia uses
vi.mock("@/components/Cards", () => ({
  FormInfo: ({ title, description }: any) => (
    <div data-testid="form-info">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock("@/components/Communication", () => ({
  Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}));

vi.mock("@/components/Dialogs", () => ({
  ImagePreviewDialog: ({ isOpen }: any) =>
    isOpen ? <div data-testid="image-preview-dialog">Preview</div> : null,
}));

vi.mock("@/components/Features", () => ({
  Books: () => <div data-testid="books-icon" />,
}));

// Import after mocks
import { WorkMedia } from "../../views/Garden/Media";

const messages = {
  "app.garden.upload.title": "Upload Media",
  "app.garden.submit.tab.media.instruction": "Please take a clear photo",
  "app.garden.upload.progress": "{current} of {required} photos uploaded",
  "app.garden.upload.maxAllowed": "max {max}",
  "app.garden.upload.cta": "Add Photos",
  "app.garden.upload.remove": "Remove",
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <IntlProvider messages={messages} locale="en" defaultLocale="en">
      {ui}
    </IntlProvider>
  );
}

describe("WorkMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with upload title from config", () => {
    const setImages = vi.fn();

    renderWithIntl(
      <WorkMedia
        config={{
          required: false,
          maxImageCount: 5,
          title: "Upload Photos",
          description: "Take some photos",
        }}
        images={[]}
        setImages={setImages}
        minRequired={1}
      />
    );

    expect(screen.getByTestId("form-info")).toBeInTheDocument();
  });

  it("renders file input for gallery upload", () => {
    const setImages = vi.fn();

    renderWithIntl(
      <WorkMedia
        config={{ required: false, maxImageCount: 5 }}
        images={[]}
        setImages={setImages}
        minRequired={1}
      />
    );

    const galleryInput = document.getElementById("work-media-upload") as HTMLInputElement;
    expect(galleryInput).toBeTruthy();
    expect(galleryInput.type).toBe("file");
    expect(galleryInput.accept).toContain("image/");
  });

  it("renders camera input for capture", () => {
    const setImages = vi.fn();

    renderWithIntl(
      <WorkMedia
        config={{ required: false, maxImageCount: 5 }}
        images={[]}
        setImages={setImages}
        minRequired={1}
      />
    );

    const cameraInput = document.getElementById("work-media-camera") as HTMLInputElement;
    expect(cameraInput).toBeTruthy();
    expect(cameraInput.type).toBe("file");
    expect(cameraInput.getAttribute("capture")).toBe("environment");
  });

  it("displays existing images", () => {
    const setImages = vi.fn();
    const mockFile1 = new File(["content1"], "photo1.jpg", { type: "image/jpeg" });
    const mockFile2 = new File(["content2"], "photo2.jpg", { type: "image/jpeg" });

    renderWithIntl(
      <WorkMedia
        config={{ required: true, maxImageCount: 5 }}
        images={[mockFile1, mockFile2]}
        setImages={setImages}
        minRequired={1}
      />
    );

    // Should render image thumbnails
    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThanOrEqual(2);
  });

  it("shows upload progress when minRequired is set", () => {
    const setImages = vi.fn();

    renderWithIntl(
      <WorkMedia
        config={{ required: true, maxImageCount: 5, minImageCount: 2 }}
        images={[]}
        setImages={setImages}
        minRequired={2}
      />
    );

    // Should show progress indicator via badge
    expect(screen.getByTestId("badge")).toBeInTheDocument();
  });

  it("exposes gallery click handler via ref", () => {
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

    // The ref should be populated with a function
    expect(galleryClickRef.current).toBeInstanceOf(Function);
  });

  it("exposes camera click handler via ref", () => {
    const setImages = vi.fn();
    const cameraClickRef = { current: null as (() => void) | null };

    renderWithIntl(
      <WorkMedia
        config={{ required: false, maxImageCount: 5 }}
        images={[]}
        setImages={setImages}
        minRequired={1}
        onCameraClickRef={cameraClickRef}
      />
    );

    // The ref should be populated with a function
    expect(cameraClickRef.current).toBeInstanceOf(Function);
  });

  it("calls setImages when files are added", async () => {
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

    // setImages should be called (may be async due to compression)
    await waitFor(() => {
      expect(setImages).toHaveBeenCalled();
    });
  });
});
