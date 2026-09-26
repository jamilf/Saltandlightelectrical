// Check the built site: node tools/check.mjs
// Exits with code 1 on any failure, so a failed check stops the deploy.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatReport, runCheck } from './lib/check.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const report = runCheck({ root });
console.log(formatReport(report));
process.exitCode = report.failures.length ? 1 : 0;
