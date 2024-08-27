import {defineConfig} from 'orval';

export default defineConfig({
    agora: {
        input: 'https://vote.optimism.io/api/v1/spec',
        output: {target: './src/__generated__/api/agora.ts', baseUrl: "https://vote.optimism.io/api/v1/"},
        hooks: {
            afterAllFilesWrite: 'prettier --write',
        },
    },
});