import React, {useEffect, useRef, type ReactNode} from "react";
import {useLocation} from "@docusaurus/router";
import Heading from "@theme/Heading";

/** Native disclosures keep answers available to browser find and without JavaScript. */
export function FaqQuestion({id, question, children}: {id: string; question: string; children: ReactNode}) {
  return (
    <details className="gg-faq-question">
      <summary><Heading as="h3" id={id}>{question}</Heading></summary>
      <div className="gg-faq-answer">{children}</div>
    </details>
  );
}

/** Reveal an answer for direct visits, site-search results, and in-page fragment navigation. */
export function FaqQuestions({children}: {children: ReactNode}) {
  const root = useRef<HTMLDivElement>(null);
  const location = useLocation();
  useEffect(() => {
    const reveal = () => {
      if (new URLSearchParams(location.search).has("_highlight")) {
        root.current?.querySelectorAll("details").forEach(answer => { answer.open = true; });
      }
      let id: string;
      try { id = decodeURIComponent(location.hash.slice(1)); }
      catch { return; }
      const target = document.getElementById(id);
      if (!target || !root.current?.contains(target)) return;
      const answer = target.closest("details");
      if (answer) answer.open = true;
      target.scrollIntoView({block: "start"});
    };
    reveal();
  }, [location.hash, location.search]);
  const setAll = (open: boolean) => root.current?.querySelectorAll("details").forEach(answer => { answer.open = open; });
  return (
    <div ref={root} className="gg-faq">
      <div className="gg-faq-tools" aria-label="FAQ answers">
        <button type="button" className="button button--outline button--primary button--sm" onClick={() => setAll(true)}>Open all answers</button>
        <button type="button" className="button button--outline button--secondary button--sm" onClick={() => setAll(false)}>Close all answers</button>
      </div>
      {children}
    </div>
  );
}
