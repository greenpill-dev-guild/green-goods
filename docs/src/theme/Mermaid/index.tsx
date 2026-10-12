/**
 * Ported from @docusaurus/theme-mermaid 3.10.2 (lib/theme/Mermaid/index.js); re-diff against that
 * file on every Docusaurus upgrade. Two changes: the render config carries a palette chosen per
 * color mode (palettes.ts), because the theme config can hold only one set of theme variables,
 * and the error fallback is local because `@docusaurus/theme-common` is not a docs dependency.
 *
 * The theme config names a different mermaid theme per color mode (`base` light, `dark` dark);
 * that name is the color-mode signal here, and both modes render on `base` with their palette.
 */
import {useEffect, useMemo, useRef, type ReactNode} from 'react';
import ErrorBoundary from '@docusaurus/ErrorBoundary';
import {
  MermaidContainerClassName,
  useMermaidConfig,
  useMermaidRenderResult,
} from '@docusaurus/theme-mermaid/client';

import {themeVariablesFor} from './palettes';
import styles from './styles.module.css';

type Props = {value: string};
type RenderResult = NonNullable<ReturnType<typeof useMermaidRenderResult>>;

function MermaidRenderResult({renderResult}: {renderResult: RenderResult}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const div = ref.current!;
    renderResult.bindFunctions?.(div);
  }, [renderResult]);
  return (
    <div
      ref={ref}
      className={`${MermaidContainerClassName} ${styles.container}`}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{__html: renderResult.svg}}
    />
  );
}

function MermaidRenderer({value}: Props): ReactNode {
  const baseConfig = useMermaidConfig();
  const colorMode = baseConfig.theme === 'dark' ? 'dark' : 'light';
  // Memoized on purpose: the render hook re-runs whenever the config identity changes.
  const config = useMemo(
    () => ({...baseConfig, theme: 'base' as const, themeVariables: themeVariablesFor(colorMode)}),
    [baseConfig, colorMode],
  );
  const renderResult = useMermaidRenderResult({text: value, config});
  if (renderResult === null) {
    return null;
  }
  return <MermaidRenderResult renderResult={renderResult} />;
}

function RenderFailure({error, tryAgain}: {error: Error; tryAgain: () => void}): ReactNode {
  return (
    <div className={styles.failure} role="alert">
      <p>This diagram could not be drawn.</p>
      <pre>{error.message}</pre>
      <button type="button" className="button button--secondary button--sm" onClick={tryAgain}>
        Try again
      </button>
    </div>
  );
}

export default function Mermaid(props: Props): ReactNode {
  return (
    <ErrorBoundary fallback={(params) => <RenderFailure {...params} />}>
      <MermaidRenderer {...props} />
    </ErrorBoundary>
  );
}
