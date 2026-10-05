import useBaseUrl from '@docusaurus/useBaseUrl';
import manifest from '../../data/brand-kit-v3.json';
import styles from './BrandAssets.module.css';

// Command surface: brand previews with direct downloads.
type AssetFile = {file: string; format: string; url: string; width?: number; height?: number};
type BundleName = (typeof manifest.bundles)[number]['label'];
const files: AssetFile[] = manifest.files;
const colors = [
  {id: 'dark-green', label: 'Dark green', note: 'Canonical'},
  {id: 'white', label: 'White', note: 'Reverse'},
  {id: 'black', label: 'Black', note: 'Monochrome'},
] as const;

/** Look up a required inventory entry; missing files fail the page build. */
function asset(file: string) {
  const found = files.find((item) => item.file === file);
  if (!found) throw new Error(`Brand kit asset is missing: ${file}`);
  return found;
}

/** Select SVG and common PNG sizes for one color/framing; ZIPs retain other sizes. */
function colorFiles(color: string, layout: string) {
  return files.filter((file) =>
    file.file.startsWith(`primary/${color}/${layout}/`) &&
    (file.format === 'svg' || (file.format === 'png' && [512, 1024, 2048].includes(file.width ?? 0)))
  );
}

/** Resolve a named ZIP from the inventory and respect the docs deployment base URL. */
function BundleLink({name, label}: {name: BundleName; label: string}) {
  const baseUrl = useBaseUrl('/');
  const bundle = manifest.bundles.find((item) => item.label === name);
  if (!bundle) throw new Error(`Brand kit bundle is missing: ${name}`);
  return <a href={`${baseUrl}${bundle.url.slice(1)}`} download>{label}</a>;
}

/** Keep file type and dimensions visible and identify the asset for screen readers. */
function DownloadLink({file, name, label}: {file: AssetFile; name: string; label?: string}) {
  const baseUrl = useBaseUrl('/');
  const dimensions = file.width ? ` ${file.width} by ${file.height} pixels` : '';
  const defaultLabel = file.format === 'html' ? 'HTML links'
    : file.file.endsWith('icons.manifest.json') ? 'Manifest JSON'
    : `${file.format.toUpperCase()}${file.width ? ` ${file.width}` : ''}`;
  return <a href={`${baseUrl}${file.url.slice(1)}`} download
    aria-label={`Download ${name} ${file.format.toUpperCase()}${dimensions}`}>
    {label ?? defaultLabel}
  </a>;
}

type PreviewProps = {
  name: string;
  items: AssetFile[];
  dark?: boolean;
  favicon?: boolean;
  wide?: boolean;
  preferPng?: boolean;
  eager?: boolean;
};

/**
 * Prefer scalable SVG previews, or PNG references for graphics and templates.
 * Fall back to available PNGs, show favicons at native sizes, and reject missing previews.
 */
function AssetPreview({name, items, dark, favicon, wide, preferPng, eager}: PreviewProps) {
  const baseUrl = useBaseUrl('/');
  const pngs = items.filter((file) => file.format === 'png');
  const png = pngs.find((file) => file.width === 512) ?? pngs[0];
  const preview = (preferPng ? png : items.find((file) => file.format === 'svg')) ?? png;
  if (!preview) throw new Error(`Brand kit preview is missing: ${name}`);
  return <a
    className={`${styles.preview} ${dark ? styles.darkPreview : ''} ${favicon ? styles.faviconPreview : ''} ${wide ? styles.widePreview : ''}`}
    href={`${baseUrl}${preview.url.slice(1)}`} target="_blank" rel="noopener noreferrer"
    aria-label={`Preview ${name} at full size`}>
    <img src={`${baseUrl}${preview.url.slice(1)}`} alt={name}
      width={preview.width ?? 240} height={preview.height ?? 240}
      loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : undefined} />
    {favicon && <span className={styles.faviconSizes}>
      {[16, 32].map((width) => {
        const file = pngs.find((item) => item.width === width);
        return file && <span key={width}>
          <img src={`${baseUrl}${file.url.slice(1)}`} alt="" width={width} height={width} loading="lazy" />
          {width} px
        </span>;
      })}
    </span>}
  </a>;
}

/** Keep each preview beside its downloads; nested symbols use the logo heading hierarchy. */
function AssetCard({title, description, id, nested, bundle, ...preview}: PreviewProps & {
  title: string;
  description: string;
  id?: string;
  nested?: boolean;
  bundle?: BundleName;
}) {
  const Heading = nested ? 'h4' : 'h3';
  return <article className={styles.card} aria-label={preview.name} id={id}>
    <AssetPreview {...preview} />
    <div className={styles.cardBody}>
      <Heading>{title}</Heading>
      <p className={styles.caption}>{description}</p>
      <div className={styles.downloadLinks}>
        {preview.items.map((file) => <DownloadLink key={file.file} file={file} name={preview.name} />)}
        {bundle && <BundleLink name={bundle} label="Website icons ZIP" />}
      </div>
    </div>
  </article>;
}

/** Compare standard and enlarged square framing with direct downloads for each. */
function LogoCard({color}: {color: (typeof colors)[number]}) {
  return <article className={styles.card} aria-label={`${color.label} logos`}>
    <div className={styles.cardBody}>
      <h3>{color.label}</h3>
      <p className={styles.caption}>{color.note}</p>
    </div>
    <div className={styles.logoPair}>
      {[
        {id: 'logo-square-standard', label: 'Standard'},
        {id: 'logo-square-large', label: 'Enlarged'},
      ].map((layout) => {
        const items = colorFiles(color.id, layout.id);
        const name = `${color.label} ${layout.label.toLowerCase()} logo`;
        return <div className={styles.logoVariant} key={layout.id}>
          <h4>{layout.label}</h4>
          <AssetPreview name={name} items={items} dark={color.id === 'white'}
            eager={color.id === 'dark-green'} />
          <div className={styles.downloadLinks}>
            {items.map((file) => <DownloadLink key={file.file} file={file} name={name} />)}
          </div>
        </div>;
      })}
    </div>
  </article>;
}

/** Render the curated catalogue from the versioned inventory, with full-kit access. */
export default function BrandAssets() {
  const baseUrl = useBaseUrl('/');
  return <div className={styles.assets}>
    <div className={styles.kitBar}>
      <h1>Brand kit</h1>
      <a className="button button--primary" href={`${baseUrl}${manifest.wholeKit.url.slice(1)}`} download>
        Download the whole kit <span className={styles.zipSize}>v3 · ZIP</span>
      </a>
    </div>
    <p className={styles.lead}>Preview and download. Dark green <code>#367D44</code> is canonical.</p>
    <nav className={styles.sectionNav} aria-label="Brand asset types">
      {['Logos', 'Palette', 'Typography', 'Graphics', 'Templates', 'Website files'].map((label) =>
        <a key={label} href={`#${label.toLowerCase().replaceAll(' ', '-')}`}>{label}</a>)}
    </nav>

    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2 id="logos">Logos</h2>
        <BundleLink name="Logos" label="All logo sizes ZIP" />
      </div>
      <p className={styles.sectionCaption}>Transparent SVG and PNG. Compare standard and enlarged square framing.</p>
      <div className={styles.grid}>{colors.map((color) => <LogoCard key={color.id} color={color} />)}</div>
      <div className={styles.sectionHeading}>
        <h3 id="symbols">Symbols</h3>
        <BundleLink name="Symbols" label="All symbol sizes ZIP" />
      </div>
      <p className={styles.sectionCaption}>For avatars and compact spaces.</p>
      <div className={styles.grid}>{colors.map((color) => <AssetCard key={color.id} title={color.label}
        name={`${color.label} symbol`} description={color.note} dark={color.id === 'white'} nested
        items={colorFiles(color.id, 'symbol-square-large')} />)}</div>
      <p className={styles.archiveNote}>Other colors, framing, and sizes are included in the complete kit.</p>
    </section>

    <section className={styles.section}>
      <h2 id="palette">Palette</h2>
      <p className={styles.sectionCaption}>Dark green leads. White and black provide reverse and monochrome artwork; warm paper is the template canvas.</p>
      <div className={styles.paletteGrid}>{manifest.palette.map((color) => <article className={styles.colorCard} key={color.id}>
        <div className={styles.colorSwatch} style={{backgroundColor: color.hex}} aria-hidden="true" />
        <div className={styles.cardBody}><h3>{color.name}</h3><code>{color.hex}</code><p className={styles.caption}>{color.role}</p></div>
      </article>)}</div>
      <p className={styles.sectionCaption}>The original Figma green and four board colors remain reference options.</p>
      <div className={styles.downloadLinks}>
        <DownloadLink file={asset('palette/green-goods-palette.json')} name="Green Goods palette" label="Palette JSON" />
        <DownloadLink file={asset('palette/green-goods-palette.css')} name="Green Goods palette" label="Palette CSS" />
      </div>
    </section>

    <section className={styles.section}>
      <h2 id="typography">Typography</h2>
      <p className={styles.sectionCaption}>Inter and Fraunces for templates, following the existing Warm Earth direction.</p>
      <div className={styles.typeGrid}>{manifest.typography.map((font) => <article className={styles.typeCard} key={font.name}>
        <div className={`${styles.typeSample} ${styles[font.className]}`}>{font.sample}</div>
        <div className={styles.cardBody}><h3>{font.name}</h3><p className={styles.caption}>{font.role}</p>
          <div className={styles.downloadLinks}>
            <DownloadLink file={asset(font.file)} name={`${font.name} Regular font`} label="Regular TTF" />
            {font.alternateFile && <DownloadLink file={asset(font.alternateFile)} name={`${font.name} Italic font`} label="Italic TTF" />}
            <a href={font.source} target="_blank" rel="noopener noreferrer" aria-label={`${font.name} full font family`}>Full family ↗</a>
          </div>
        </div>
      </article>)}</div>
      <div className={styles.downloadLinks}>
        <DownloadLink file={asset('typography/OFL.txt')} name="Font license" label="Font license" />
        <DownloadLink file={asset('typography/green-goods-type.css')} name="Green Goods font styles" label="Font CSS" />
        <DownloadLink file={asset('typography/type-specimen.png')} name="Typography specimen" label="Specimen PNG" />
        <DownloadLink file={asset('typography/type-specimen.svg')} name="Typography specimen" label="Specimen SVG" />
      </div>
    </section>

    <section className={styles.section}>
      <h2 id="graphics">Graphic elements</h2>
      <p className={styles.sectionCaption}>Symbol patterns and backgrounds, created for this kit.</p>
      <div className={styles.editorialGrid}>{manifest.graphics.map((graphic) => <AssetCard key={graphic.id} title={graphic.title}
        name={graphic.title} description={graphic.description} wide preferPng
        items={files.filter((file) => file.file.startsWith(`${graphic.prefix}.`))} />)}</div>
    </section>

    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <h2 id="templates">Templates</h2>
        <BundleLink name="Templates" label="Templates and fonts ZIP" />
      </div>
      <p className={styles.sectionCaption}>Install the fonts, edit the SVG text, and replace the sample copy. PNGs are ready-to-view references.</p>
      <div className={styles.editorialGrid}>{manifest.templates.map((template) => <AssetCard key={template.id} title={template.title}
        name={`${template.title} template`} description={template.description} wide preferPng
        items={files.filter((file) => file.file.startsWith(`${template.prefix}.`))} />)}</div>
      <div className={styles.downloadLinks}>
        <DownloadLink file={asset('templates/README.txt')} name="Template editing notes" label="Editing notes" />
      </div>
    </section>

    <section className={styles.section}>
      <h2 id="website-files">Website files</h2>
      <p className={styles.sectionCaption}>Favicons for browser tabs and an icon pack for installed websites and phone home screens.</p>
      <div className={styles.websiteGrid}>
        <AssetCard id="favicons" title="Favicon" name="Dark green website favicon"
          description="Browser tabs · Canonical dark green" favicon
          items={['favicon.svg', 'favicon.ico', 'favicon-16.png', 'favicon-32.png'].map((name) => asset(`website-ready/${name}`))} />
        <AssetCard id="app-icons" title="Website icon set" name="Website icon set"
          description="Touch and maskable icons · Canonical dark green" bundle="Website"
          items={['icon-512.png', 'head-snippet.html', 'icons.manifest.json'].map((name) => asset(`website-ready/${name}`))} />
      </div>
    </section>
  </div>;
}
