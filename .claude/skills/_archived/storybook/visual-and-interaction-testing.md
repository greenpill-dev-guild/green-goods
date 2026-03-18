# Visual & Interaction Testing

Visual testing, visual regression with Chromatic, and advanced interaction testing with play functions.

---

## Visual Testing

### Snapshot Testing with Play Functions

```typescript
export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};
```

### Responsive Stories

```typescript
export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  args: {
    garden: createMockGarden(),
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};
```

### Testing States

Every component should have stories for:
- [ ] Default state
- [ ] Loading state
- [ ] Error state
- [ ] Empty state
- [ ] Disabled state
- [ ] Mobile viewport
- [ ] Dark theme
- [ ] RTL layout (if text-heavy)

---

## Visual Regression Testing

### Chromatic Integration

[Chromatic](https://www.chromatic.com/) captures visual snapshots of every story and detects pixel-level changes on PRs.

#### Setup

```bash
# Install
bun add -D chromatic

# Add to package.json scripts (packages/shared)
# "chromatic": "chromatic --project-token=$CHROMATIC_PROJECT_TOKEN"

# Run visual tests
cd packages/shared
bunx chromatic --project-token=$CHROMATIC_PROJECT_TOKEN
```

#### CI Integration (GitHub Actions)

```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression
on: pull_request

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for baseline comparison
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun --filter shared build
      - uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          workingDir: packages/shared
          buildScriptName: build-storybook
```

#### Workflow

```text
1. PR opened -> Chromatic builds Storybook
2. Chromatic detects visual changes -> flags for review
3. Team reviews changes in Chromatic UI
4. Approve or reject visual diffs
5. PR can merge after visual review passes
```

### Storybook Test Runner (Alternative)

For local visual regression without Chromatic:

```bash
# Install test runner
bun add -D @storybook/test-runner

# Add script
# "test-storybook": "test-storybook"

# Run (requires Storybook running on port 6006)
cd packages/shared
bun run storybook &  # Start Storybook
bunx test-storybook  # Run all play functions and a11y checks
```

### Snapshot Strategy

| Level | Tool | What It Catches |
|-------|------|-----------------|
| **Component** | Storybook play functions | Interaction bugs |
| **Visual** | Chromatic | Unintended pixel changes |
| **Accessibility** | a11y addon + test runner | WCAG violations |
| **Responsive** | Viewport stories + Chromatic | Layout breakage |

### When to Review Visual Diffs

- **Accept**: Intentional style changes, new components
- **Reject**: Unintended regressions, broken layouts, contrast issues
- **Investigate**: Flaky diffs (animation timing, async content)

---

## Advanced Interaction Testing

### Multi-Step Play Functions

For complex user flows (wizards, multi-field forms, conditional UI):

```typescript
import { within, userEvent, expect, waitFor } from "@storybook/test";

export const FormWizardFlow: Story = {
  args: { garden: createMockGarden() },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("Step 1: Fill basic info", async () => {
      await userEvent.type(canvas.getByLabelText("Title"), "Morning weeding");
      await userEvent.type(canvas.getByLabelText("Description"), "Removed invasive species");
      await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    });

    await step("Step 2: Upload photo", async () => {
      // Wait for step transition
      await waitFor(() => {
        expect(canvas.getByText("Add Photos")).toBeInTheDocument();
      });

      // Simulate file upload
      const fileInput = canvas.getByLabelText("Upload");
      const file = new File(["photo"], "work.jpg", { type: "image/jpeg" });
      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(canvas.getByAltText("work.jpg")).toBeInTheDocument();
      });

      await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    });

    await step("Step 3: Review and submit", async () => {
      await waitFor(() => {
        expect(canvas.getByText("Morning weeding")).toBeInTheDocument();
      });

      await userEvent.click(canvas.getByRole("button", { name: "Submit" }));
      await waitFor(() => {
        expect(canvas.getByText("Work queued")).toBeInTheDocument();
      });
    });
  },
};
```

### Async State Testing

Test components that depend on async data loading or state transitions:

```typescript
export const AsyncDataLoading: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify loading state appears first
    await expect(canvas.getByRole("progressbar")).toBeInTheDocument();

    // Wait for data to resolve
    await waitFor(
      () => {
        expect(canvas.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(canvas.getByRole("list")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Verify rendered data
    const items = canvas.getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
  },
};
```

### Testing Error States

```typescript
export const SubmissionFailure: Story = {
  parameters: {
    // Mock the mutation to fail
    msw: {
      handlers: [
        http.post("/api/submit", () => HttpResponse.error()),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(canvas.getByRole("alert")).toHaveTextContent(/failed/i);
    });

    // Verify retry button appears
    await expect(
      canvas.getByRole("button", { name: "Retry" })
    ).toBeInTheDocument();
  },
};
```

### Testing Offline Scenarios

Simulate offline state in stories for the offline-first PWA:

```typescript
export const OfflineSubmission: Story = {
  decorators: [
    (Story) => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Submit Work" }));

    // Verify offline queuing feedback
    await waitFor(() => {
      expect(canvas.getByText(/queued for sync/i)).toBeInTheDocument();
    });

    // Verify no error shown (offline is expected)
    expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};
```

### Play Function Best Practices

| Practice | Why |
|----------|-----|
| Use `step()` for multi-part flows | Named steps appear in Interactions panel for debugging |
| Use `waitFor()` for async states | Avoids flaky timing-dependent assertions |
| Set reasonable timeouts | Default 1s may be too short for complex transitions |
| Test keyboard navigation | Verifies accessibility alongside interactions |
| Avoid `sleep()`/`setTimeout()` | Use `waitFor()` to wait for DOM conditions instead |
