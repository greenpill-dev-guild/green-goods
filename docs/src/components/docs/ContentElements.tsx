import type { ComponentProps, ReactNode } from "react";
import Admonition from "@theme/Admonition";

type GuideImageProps = Omit<ComponentProps<"img">, "children"> & {
  children?: ReactNode;
  maxWidth?: string;
};

/** Image presentation stays with the site while editors change the image and caption. */
export function GuideImage({ className, maxWidth, children, ...image }: GuideImageProps) {
  return (
    <figure className={className} style={maxWidth ? { maxWidth } : undefined}>
      <img {...image} />
      {children ? <figcaption>{children}</figcaption> : null}
    </figure>
  );
}

export function Callout({ kind, title, children }: { kind: string; title?: string; children: ReactNode }) {
  return <Admonition type={kind} title={title}>{children}</Admonition>;
}

export function InlineLabel({ children }: { children: ReactNode }) {
  return <strong className="gg-inline-label">{children}</strong>;
}

export function ContentLink(props: ComponentProps<"a">) {
  return <a {...props} />;
}
