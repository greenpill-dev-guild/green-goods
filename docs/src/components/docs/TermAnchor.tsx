import React, {useEffect} from "react";
import useBrokenLinks from "@docusaurus/useBrokenLinks";

/** Register a real table destination with Docusaurus's build-time link checker. */
export default function TermAnchor({id, to}: {id: string; to?: string}) {
  useBrokenLinks().collectAnchor(id);
  useEffect(() => {
    if (!to) return;
    const followLegacyLink = () => {
      if (window.location.hash === `#${id}`) window.location.replace(to);
    };
    followLegacyLink();
    window.addEventListener("hashchange", followLegacyLink);
    return () => window.removeEventListener("hashchange", followLegacyLink);
  }, [id, to]);
  return <a id={id} aria-hidden="true" />;
}
