import CodeBlock from "@theme/CodeBlock";
import onboarding from "@site/src/data/onboarding.json";

/**
 * The repository's ONBOARDING.md, embedded so a reader can copy it into an agent in one click.
 * The text is a generator projection (docs/src/data/onboarding.json), so it cannot drift from
 * the file in the repository root.
 */
export function OnboardingProcedure() {
  return (
    <CodeBlock language="markdown" title="ONBOARDING.md">
      {onboarding.text}
    </CodeBlock>
  );
}
