/**
 * Return-focus handoff between the Gardens archive and a Garden page.
 *
 * While `/gardens/:id` was a modal the archive never unmounted, so going back
 * cost the reader nothing. As a route it does: `<ScrollRestoration>` puts the
 * scroll position back, but keyboard and screen-reader users still land at the
 * top of the document instead of on the card they opened.
 *
 * The Garden page records which card it came from; the archive focuses that
 * card when the reader arrives back through a POP navigation. Module state is
 * deliberate — a hard reload has no return context to restore, and that is the
 * correct outcome rather than something to persist around.
 */

let rememberedSlug: string | null = null;

/** Called by the Garden page on mount. */
export function rememberGardenReturn(slug: string | null | undefined): void {
  rememberedSlug = slug?.trim().toLowerCase() || null;
}

/** Read and clear the remembered slug. Exported for tests. */
function consumeGardenReturn(): string | null {
  const slug = rememberedSlug;
  rememberedSlug = null;
  return slug;
}

/**
 * Focus the archive card for the Garden the reader just came back from.
 *
 * Retries across two animation frames because the card list may not have
 * painted yet when the archive remounts. The dialog needed a five-step timeout
 * ladder here to outlast the card-to-hero morph; with the morph gone, waiting
 * for the next paint is enough.
 */
export function focusRememberedGardenCard(): void {
  if (typeof window === "undefined") return;
  const slug = consumeGardenReturn();
  if (!slug) return;

  const href = `/gardens/${slug}`;
  const focusCard = () => {
    const link = document.querySelector<HTMLAnchorElement>(`a[href="${CSS.escape(href)}"]`);
    link?.focus({ preventScroll: true });
    return Boolean(link);
  };

  if (focusCard()) return;
  window.requestAnimationFrame(() => {
    if (focusCard()) return;
    window.requestAnimationFrame(focusCard);
  });
}
