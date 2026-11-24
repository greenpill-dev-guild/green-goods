import { useEffect } from "react";

export interface PublicPageHeadProps {
  /** The tab and share title, such as "Vida Verde | Green Goods". */
  title: string;
  /** Absolute canonical URL of the page. */
  url: string;
  /** One or two sentences about the page; the shell's stays when absent. */
  description?: string;
  /** Absolute URL of the page's sharing image; the shell's stays when absent. */
  image?: string;
}

/** Each head entry the page names, and the attribute that carries it. */
function headEntries({ title, url, description, image }: PublicPageHeadProps) {
  return [
    ['meta[name="description"]', "content", description],
    ['link[rel="canonical"]', "href", url],
    ['meta[property="og:title"]', "content", title],
    ['meta[property="og:description"]', "content", description],
    ['meta[property="og:url"]', "content", url],
    ['meta[property="og:image"]', "content", image],
    ['meta[name="twitter:title"]', "content", title],
    ['meta[name="twitter:description"]', "content", description],
    ['meta[name="twitter:image"]', "content", image],
  ] as const;
}

/**
 * Names a public record page in the document head (PUB-032): its own title, description,
 * canonical URL and sharing image, in place of the route shell's, which come back once the page
 * closes. The shell is served per route (`vite/social-preview.ts`), so a record page such as a
 * garden would otherwise carry its list's head, canonical included. This sets what a browser and
 * a crawler that runs scripts read; a link preview reads the served shell.
 */
export function PublicPageHead(props: PublicPageHeadProps) {
  const { title, url, description, image } = props;
  useEffect(() => {
    const restore: Array<() => void> = [];
    const previousTitle = document.title;
    document.title = title;
    restore.push(() => {
      document.title = previousTitle;
    });
    for (const [selector, attribute, value] of headEntries({ title, url, description, image })) {
      if (!value) continue;
      let element = document.head.querySelector(selector);
      if (!element && selector.startsWith("link")) {
        element = document.createElement("link");
        element.setAttribute("rel", "canonical");
        document.head.append(element);
        const added = element;
        restore.push(() => added.remove());
      } else if (element) {
        const target = element;
        const previous = target.getAttribute(attribute);
        restore.push(() => {
          if (previous === null) target.removeAttribute(attribute);
          else target.setAttribute(attribute, previous);
        });
      }
      element?.setAttribute(attribute, value);
    }
    return () => {
      for (const undo of restore.reverse()) undo();
    };
  }, [title, url, description, image]);
  return null;
}
