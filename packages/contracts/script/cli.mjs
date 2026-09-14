#!/usr/bin/env node
import { executeOperation } from './cli/execute.mjs';
import { explainOperation, renderHelp, resolveCommand } from './cli/operations.mjs';

try {
  const resolution = resolveCommand(process.argv.slice(2));
  if (resolution.help) process.stdout.write(`${renderHelp(resolution.topic)}\n`);
  else if (resolution.explain) {
    const explanation = explainOperation(resolution);
    process.stdout.write(`${JSON.stringify(explanation, null, resolution.json ? 0 : 2)}\n`);
  } else process.exitCode = (await executeOperation(resolution)).code;
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : 'Contract command failed'}\n`);
  process.exitCode = 1;
}
