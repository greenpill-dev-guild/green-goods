import React from "react";
import useBrokenLinks from "@docusaurus/useBrokenLinks";

/** Register a real table destination with Docusaurus's build-time link checker. */
export default function TermAnchor({id}: {id: string}) {
  useBrokenLinks().collectAnchor(id);
  return <a id={id} aria-hidden="true" />;
}
