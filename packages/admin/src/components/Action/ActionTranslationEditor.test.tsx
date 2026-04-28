import { fireEvent, render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import type { ActionTranslationMap } from "@green-goods/shared";
import { defaultTemplate, getActionSourceHash } from "@green-goods/shared";
import { ActionTranslationEditor } from "./ActionTranslationEditor";

function renderEditor(value: ActionTranslationMap = {}, onChange = vi.fn()) {
  render(
    <IntlProvider locale="en" messages={{}}>
      <ActionTranslationEditor
        sourceTitle="Plant trees"
        sourceConfig={defaultTemplate}
        value={value}
        onChange={onChange}
      />
    </IntlProvider>
  );
  return onChange;
}

describe("ActionTranslationEditor", () => {
  it("renders locale tabs and a non-blocking publish warning for missing translations", () => {
    renderEditor();

    expect(screen.getByRole("button", { name: /Spanish · Missing/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Portuguese · Missing/i })).toBeInTheDocument();
    expect(screen.getByText(/Publishing can continue with missing/i)).toBeInTheDocument();
  });

  it("does not mark an empty locale reviewed", () => {
    const onChange = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: /Mark reviewed/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText(/Add translation text before marking/i)).toBeInTheDocument();
    expect(screen.getByText(/Publishing can continue with missing/i)).toBeInTheDocument();
  });

  it("marks the active locale reviewed without changing canonical source fields", () => {
    const onChange = renderEditor({
      es: {
        status: "draft",
        sourceHash: getActionSourceHash("Plant trees", defaultTemplate),
        data: { title: "Plantar árboles" },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: /Mark reviewed/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0] as ActionTranslationMap;
    expect(next.es?.status).toBe("reviewed");
    expect(next.es?.sourceHash).toBe(getActionSourceHash("Plant trees", defaultTemplate));
    expect(next.es?.data).toEqual({ title: "Plantar árboles" });
  });

  it("keeps reviewed locales with no translated text in the publish warning", () => {
    renderEditor({
      es: {
        status: "reviewed",
        sourceHash: getActionSourceHash("Plant trees", defaultTemplate),
        data: {},
      },
      pt: {
        status: "reviewed",
        sourceHash: getActionSourceHash("Plant trees", defaultTemplate),
        data: { title: "Plantar árvores" },
      },
    });

    expect(screen.getByRole("button", { name: /Spanish · Missing/i })).toBeInTheDocument();
    expect(screen.getByText(/Publishing can continue with missing/i)).toBeInTheDocument();
  });

  it("shows stale reviewed translations when the English source hash changes", () => {
    renderEditor({
      es: {
        status: "reviewed",
        sourceHash: "old-source",
        data: { title: "Plantar árboles" },
      },
    });

    expect(screen.getByRole("button", { name: /Spanish · Stale/i })).toBeInTheDocument();
    expect(screen.getByText(/The English source changed/i)).toBeInTheDocument();
  });

  it("uses browser translation only as an optional draft helper", () => {
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: /Generate draft/i }));

    expect(screen.getByText(/Browser translation is not available/i)).toBeInTheDocument();
  });
});
