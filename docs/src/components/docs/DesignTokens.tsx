import tokens from "@site/src/data/design-tokens.json";

import styles from "./DesignTokens.module.css";
import {COLOR_GROUPS, FONT_STACKS, PAIRINGS} from "./designTokens.data";

type TypographyToken = {
  fontFamily: string;
  fontSize: string;
  fontWeight: number;
  lineHeight: string | number;
};

const colors = tokens.colors as Record<string, string>;
const typography = tokens.typography as Record<string, TypographyToken>;
const rounded = tokens.rounded as Record<string, string>;
const spacing = tokens.spacing as Record<string, string>;

function color(key: string): string {
  const value = colors[key];
  if (!value) {
    throw new Error(`Design token page references a color the projection does not carry: ${key}`);
  }
  return value;
}

/**
 * The core Warm Earth tokens, rendered from the generated projection of the root DESIGN.md so the
 * page can never disagree with the file that governs the product. Swatches are absolute colors on
 * purpose; the card chrome around them follows the docs theme.
 */
export function DesignTokens() {
  return (
    <div className={styles.tokens}>
      <section className={styles.block}>
        <h3>Colors</h3>
        <p>Sixteen named colors. Ink and canvas carry the reading surfaces; the greens carry every action.</p>
        {COLOR_GROUPS.map((group) => (
          <div key={group.label} className={styles.group}>
            <span className={styles.groupLabel}>{group.label}</span>
            <div className={styles.swatches}>
              {group.keys.map((key) => (
                <div key={key} className={styles.swatch}>
                  <div className={styles.swatchColor} style={{background: color(key)}} />
                  <div className={styles.swatchMeta}>
                    {key}
                    <code>{color(key)}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className={styles.block}>
        <h3>Pairings</h3>
        <p>Text on fill, as the components use them. Each one is a contract from the root DESIGN.md.</p>
        <div className={styles.pairings}>
          {PAIRINGS.map((pairing) => (
            <div
              key={pairing.label}
              className={styles.pairing}
              style={{background: color(pairing.bg), color: color(pairing.fg)}}
            >
              {pairing.label}
              <small>
                {pairing.fg} on {pairing.bg}
              </small>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h3>Type</h3>
        <p>Inter for the interface, Fraunces for editorial moments. The samples use the brand kit's font files.</p>
        <div className={styles.type}>
          {Object.entries(typography).map(([name, token]) => (
            <div key={name} className={styles.typeRow}>
              <span className={styles.typeMeta}>
                {name}: {token.fontFamily} {token.fontSize} / {token.fontWeight} / line {String(token.lineHeight)}
              </span>
              <p
                className={styles.typeSample}
                style={{
                  fontFamily: FONT_STACKS[token.fontFamily] ?? token.fontFamily,
                  fontSize: token.fontSize,
                  fontWeight: token.fontWeight,
                  lineHeight: token.lineHeight,
                }}
              >
                Regenerative work, made visible
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.block}>
        <h3>Radii and spacing</h3>
        <p>Seven corner radii and three spacing steps; the squircle is the installed app's card corner.</p>
        <div className={styles.chips}>
          {Object.entries(rounded).map(([name, value]) => (
            <div key={name} className={styles.radius} style={{borderRadius: value}} title={value}>
              {name}
            </div>
          ))}
        </div>
        <div className={styles.spacing} style={{marginTop: "1rem"}}>
          {Object.entries(spacing).map(([name, value]) => (
            <div key={name}>
              <div className={styles.spacingBar} style={{width: value, height: value}} />
              <span className={styles.spacingLabel}>
                {name} {value}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
