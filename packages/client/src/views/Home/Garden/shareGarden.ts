import { shareLink } from "@green-goods/shared/utils/app/clipboard";

/**
 * Shares the garden's in-app link, keeping the fragment route on hash-routed builds.
 * Rejects when the share sheet and the clipboard fallback both fail.
 */
export async function shareGarden(gardenId: string, name: string): Promise<void> {
  const url = new URL(window.location.href);
  const path = `/home/${encodeURIComponent(gardenId)}`;
  if (url.hash.startsWith("#/")) {
    url.hash = path;
  } else {
    url.pathname = path;
    url.hash = "";
  }
  url.search = "";
  await shareLink({ title: name, url: url.toString() });
}
