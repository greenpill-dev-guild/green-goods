// Assembles voucher-lab.html: the lab shell, the screen kit CSS, the Remix Icon sprite and every screen source.
// Usage: node build.mjs [output path]; the default writes ../voucher-lab.html next to this folder.
import fs from 'node:fs';
import path from 'node:path';

const dir = path.dirname(new URL(import.meta.url).pathname);
const ids = ['Main', 'Visit', 'Offer', 'Pay', 'Send', 'Status', 'ProviderReview', 'BuyerDeposits', 'Inspector',
  'VOffer', 'VSetup', 'Holder', 'Split', 'IssuerDesk', 'EscrowInspector', 'Wallet', 'Exchange', 'Rewards', 'RewardsDesk', 'IssuersDesk',
  'SOffer', 'SPay', 'SPurchase', 'SCourse', 'SWallet', 'SRequests', 'SIssuer'];

const sources = {};
for (const id of ids) {
  const s = fs.readFileSync(path.join(dir, 'screens', id + '.dc.html'), 'utf8');
  const title = (s.match(/<title>([^<]*)<\/title>/) || [])[1] || id;
  const tpl = s.split('</helmet>')[1].split('</x-dc>')[0].trim();
  const m = s.match(/<script type="text\/x-dc" data-dc-script data-props='([^']*)'>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('No logic block in ' + id);
  const props = JSON.parse(m[1].replace(/&#39;/g, "'").replace(/&amp;/g, '&'));
  sources[id] = { title, tpl, js: m[2], props };
}

const json = JSON.stringify(sources).replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
const css = fs.readFileSync(path.join(dir, 'gg.css'), 'utf8');
const sprite = fs.readFileSync(path.join(dir, 'remix-sprite.svg'), 'utf8').trim();
let page = fs.readFileSync(path.join(dir, 'shell.html'), 'utf8');
for (const hole of ['/*__GG_CSS__*/', '/*__SOURCES__*/', '<!--__SPRITE__-->']) if (!page.includes(hole)) throw new Error('Shell placeholder missing: ' + hole);
page = page.replace('/*__GG_CSS__*/', () => css).replace('/*__SOURCES__*/', () => json).replace('<!--__SPRITE__-->', () => sprite);
const out = path.resolve(process.argv[2] || path.join(dir, '..', 'voucher-lab.html'));
fs.writeFileSync(out, page);
console.log('wrote', out, (page.length / 1024).toFixed(0) + ' KB');
