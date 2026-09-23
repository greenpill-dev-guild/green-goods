import { readFile } from 'node:fs/promises';

process.stdout.write(await readFile(new URL('../../.generated/runtime/ipfs-cache.json', import.meta.url), 'utf8'));
