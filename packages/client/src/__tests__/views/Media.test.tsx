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

// Mock shared barrel imports — component imports everything from @green-goods/shared
vi.mock("@green-goods/shared", () => ({
  DEFAULT_CHAIN_ID: 11155111,
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
  AudioPlayer: ({ file, onDelete }: any) => <div data-testid="audio-player">{file?.name}</div>,
  AudioRecorder: ({ onRecordingComplete }: any) => (
    <button
      data-testid="audio-recorder"
      onClick={() => onRecordingComplete?.(new File([], "recording.webm"))}
    >
      Record
    </button>
  ),
  track: vi.fn(),
  toastService: {
    info: vi.fn(),
    error: vi.fn(),
  },
  mediaResourceManager: {
    getOrCreateUrl: vi.fn((file: File) => `blob:mock-url-${file.name}`),
    cleanupUrls: vi.fn(),
  },
  imageCompressor: {
    shouldCompress: () => false,
    compressImages: vi.fn().mockImplementation((files: File[]) => Promise.resolve(files)),
    getCompressionStats: vi.fn().mockReturnValue({}),
  },
}));

const heicToMocks = vi.hoisted(() => ({
  heicTo: vi.fn(),
  isHeic: vi.fn(),
}));

vi.mock("heic-to/csp", () => heicToMocks);

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
import { getWorkMediaId } from "../../views/Garden/mediaProcessing";
import { WorkMedia } from "../../views/Garden/Media";

const messages = {
  "app.garden.upload.title": "Upload Media",
  "app.garden.submit.tab.media.instruction": "Please take a clear photo",
  "app.garden.upload.progress": "{current} of {required} photos uploaded",
  "app.garden.upload.maxAllowed": "max {max}",
  "app.garden.upload.cta": "Add Photos",
  "app.garden.upload.remove": "Remove",
};

const mockSetAudioNotes = vi.fn();

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <IntlProvider messages={messages} locale="en" defaultLocale="en">
      {ui}
    </IntlProvider>
  );
}

function fileListFrom(files: File[]): FileList {
  return {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      yield* files;
    },
    ...Object.fromEntries(files.map((file, index) => [index, file])),
  } as unknown as FileList;
}

function StatefulWorkMedia({ initialImages = [] }: { initialImages?: File[] }) {
  const [images, setImages] = React.useState<File[]>(initialImages);
  const [brokenMediaIds, setBrokenMediaIds] = React.useState<Set<string>>(() => new Set());

  return (
    <WorkMedia
      config={{ required: false, maxImageCount: 5 }}
      images={images}
      setImages={setImages}
      audioNotes={[]}
      setAudioNotes={mockSetAudioNotes}
      minRequired={0}
      brokenMediaIds={brokenMediaIds}
      onPreviewFailed={(file) => {
        setBrokenMediaIds((prev) => new Set(prev).add(getWorkMediaId(file)));
      }}
      onRemoveMedia={(file) => {
        const mediaId = getWorkMediaId(file);
        setImages((prev) => prev.filter((item) => getWorkMediaId(item) !== mediaId));
        setBrokenMediaIds((prev) => {
          const next = new Set(prev);
          next.delete(mediaId);
          return next;
        });
      }}
      onRemoveBrokenMedia={() => {
        setImages((prev) => prev.filter((file) => !brokenMediaIds.has(getWorkMediaId(file))));
        setBrokenMediaIds(new Set());
      }}
      ensureWorkSubmissionJourneyId={() => "journey-123"}
      authMode="wallet"
      actionUID={1}
    />
  );
}

describe("WorkMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    heicToMocks.isHeic.mockResolvedValue(false);
    heicToMocks.heicTo.mockResolvedValue(new Blob(["jpeg"], { type: "image/jpeg" }));
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
        audioNotes={[]}
        setAudioNotes={mockSetAudioNotes}
        minRequired={1}
      />
    );

    const formInfos = screen.getAllByTestId("form-info");
    expect(formInfos.length).toBeGreaterThanOrEqual(1);
  });

  it("renders file input for gallery upload", () => {
    const setImages = vi.fn();

    renderWithIntl(
      <WorkMedia
        config={{ required: false, maxImageCount: 5 }}
        images={[]}
        setImages={setImages}
        audioNotes={[]}
        setAudioNotes={mockSetAudioNotes}
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
        audioNotes={[]}
        setAudioNotes={mockSetAudioNotes}
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
        audioNotes={[]}
        setAudioNotes={mockSetAudioNotes}
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
        audioNotes={[]}
        setAudioNotes={mockSetAudioNotes}
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
        audioNotes={[]}
        setAudioNotes={mockSetAudioNotes}
        minRequired={1}
        onMediaClickRef={galleryClickRef}
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
        audioNotes={[]}
        setAudioNotes={mockSetAudioNotes}
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
        audioNotes={[]}
        setAudioNotes={mockSetAudioNotes}
        minRequired={1}
      />
    );

    const galleryInput = document.getElementById("work-media-upload") as HTMLInputElement;

    // Simulate file selection
    fireEvent.change(galleryInput, { target: { files: fileListFrom([mockFile]) } });

    // setImages should be called (may be async due to compression)
    await waitFor(() => {
      expect(setImages).toHaveBeenCalled();
    });
  });

  it("shows converted HEIC media as a JPEG preview", async () => {
    heicToMocks.isHeic.mockResolvedValue(true);
    const heic = new File(["heic"], "garden.heic", { type: "image/heic" });

    renderWithIntl(<StatefulWorkMedia />);

    const galleryInput = document.getElementById("work-media-upload") as HTMLInputElement;
    fireEvent.change(galleryInput, { target: { files: fileListFrom([heic]) } });

    await waitFor(() => {
      expect(screen.getByRole("img", { name: /uploaded 1/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("img", { name: /uploaded 1/i })).toHaveAttribute(
      "src",
      "blob:mock-url-garden.jpg"
    );
  });

  it("removes broken previews without removing good media", async () => {
    const good = new File(["good"], "good.jpg", { type: "image/jpeg" });
    const broken = new File(["broken"], "broken.jpg", { type: "image/jpeg" });

    renderWithIntl(<StatefulWorkMedia initialImages={[good, broken]} />);

    const images = screen.getAllByRole("img");
    fireEvent.error(images[1]);

    expect(await screen.findByText("Some media previews failed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove broken media" }));

    await waitFor(() => {
      expect(screen.getAllByRole("img")).toHaveLength(1);
    });
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:mock-url-good.jpg");
  });

  it("removes media by file identity rather than index", () => {
    const first = new File(["first"], "first.jpg", { type: "image/jpeg" });
    const second = new File(["second"], "second.jpg", { type: "image/jpeg" });
    const onRemoveMedia = vi.fn();

    renderWithIntl(
      <WorkMedia
        config={{ required: false, maxImageCount: 5 }}
        images={[first, second]}
        setImages={vi.fn()}
        audioNotes={[]}
        setAudioNotes={mockSetAudioNotes}
        onRemoveMedia={onRemoveMedia}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Remove media 2" }));

    expect(onRemoveMedia).toHaveBeenCalledWith(second, "media");
  });
});
