import { expect } from "storybook/test";

/**
 * How a list of item rows fits (F7): each row's height, and for every detail whether it
 * sits whole on its row's one detail line, was dropped whole below the line's clip, or is
 * a first detail cut with an ellipsis because it is too long on its own.
 */
export interface ItemRowFit {
  heights: number[];
  shown: number;
  dropped: number;
  ellipsized: number;
  /** Details that start on the line but run past its end: a broken rule. */
  cut: number;
  /** Detail lines taller than one line: a broken rule. */
  wrapped: number;
}

export function measureItemRowFit(root: ParentNode): ItemRowFit {
  const fit: ItemRowFit = { heights: [], shown: 0, dropped: 0, ellipsized: 0, cut: 0, wrapped: 0 };
  for (const row of root.querySelectorAll<HTMLElement>(".gg-item-row")) {
    fit.heights.push(Math.round(row.getBoundingClientRect().height));
    const line = row.querySelector<HTMLElement>(".gg-item-row-details");
    if (!line) continue;
    const lineBox = line.getBoundingClientRect();
    const lineHeight = Number.parseFloat(getComputedStyle(line).lineHeight);
    if (lineBox.height > lineHeight + 0.5) fit.wrapped += 1;
    const details = [...line.querySelectorAll<HTMLElement>(".gg-item-row-detail")];
    for (const [index, detail] of details.entries()) {
      const box = detail.getBoundingClientRect();
      if (box.top >= lineBox.bottom - 1) {
        fit.dropped += 1;
        continue;
      }
      const text = detail.querySelector<HTMLElement>(".gg-item-row-detail-text");
      const ellipsized = Boolean(text && text.scrollWidth > text.clientWidth + 0.5);
      if (box.right > lineBox.right + 0.5 || (ellipsized && index > 0)) fit.cut += 1;
      else if (ellipsized) fit.ellipsized += 1;
      else fit.shown += 1;
    }
  }
  return fit;
}

/**
 * Every row is the given height, no detail line holds more than one line, and every detail
 * is whole or dropped whole; only a first detail too long on its own may end in an ellipsis.
 */
export async function expectItemRowsFit(root: ParentNode, height = 88): Promise<ItemRowFit> {
  const fit = measureItemRowFit(root);
  await expect(fit.heights.length).toBeGreaterThan(0);
  await expect(fit.heights.filter((rowHeight) => rowHeight !== height)).toEqual([]);
  await expect(fit.wrapped).toBe(0);
  await expect(fit.cut).toBe(0);
  return fit;
}
