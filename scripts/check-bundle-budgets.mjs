import { mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const KiB = 1024;
const MiB = 1024 * KiB;

const budgets = [
  { name: 'storefront-js', dir: 'apps/storefront-web/dist', extensions: ['.js'], maxBytes: 650 * KiB },
  { name: 'storefront-css', dir: 'apps/storefront-web/dist', extensions: ['.css'], maxBytes: 80 * KiB },
  { name: 'admin-js', dir: 'apps/admin-web/dist', extensions: ['.js'], maxBytes: 650 * KiB },
  { name: 'admin-css', dir: 'apps/admin-web/dist', extensions: ['.css'], maxBytes: 80 * KiB },
  { name: 'mobile-web-js', dir: 'apps/mobile/dist-web', extensions: ['.js'], maxBytes: 1.5 * MiB },
  { name: 'mobile-ios-hbc', dir: 'apps/mobile/dist-ios', extensions: ['.hbc'], maxBytes: 4.5 * MiB },
  { name: 'mobile-android-hbc', dir: 'apps/mobile/dist-android', extensions: ['.hbc'], maxBytes: 4.5 * MiB },
];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function formatBytes(bytes) {
  if (bytes >= MiB) return `${(bytes / MiB).toFixed(2)} MiB`;
  return `${(bytes / KiB).toFixed(1)} KiB`;
}

const results = [];
let failed = false;

for (const budget of budgets) {
  const files = await walk(budget.dir);
  const matching = files.filter((file) => budget.extensions.includes(path.extname(file)));
  if (matching.length === 0) {
    throw new Error(`No ${budget.extensions.join('/')} files found under ${budget.dir}. Build outputs are missing.`);
  }

  const sizes = await Promise.all(matching.map(async (file) => ({
    file,
    bytes: (await stat(file)).size,
  })));
  const totalBytes = sizes.reduce((sum, item) => sum + item.bytes, 0);
  const largest = sizes.reduce((current, item) => item.bytes > current.bytes ? item : current, sizes[0]);
  const passed = totalBytes <= budget.maxBytes;
  failed ||= !passed;
  results.push({
    name: budget.name,
    totalBytes,
    maxBytes: budget.maxBytes,
    passed,
    fileCount: sizes.length,
    largestFile: largest.file,
    largestFileBytes: largest.bytes,
  });

  console.log(`${passed ? 'PASS' : 'FAIL'} ${budget.name}: ${formatBytes(totalBytes)} / ${formatBytes(budget.maxBytes)} (${sizes.length} file${sizes.length === 1 ? '' : 's'})`);
}

await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/bundle-budget.json', `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`);

if (failed) {
  process.exitCode = 1;
  console.error('Bundle budget exceeded. Review the generated artifacts/bundle-budget.json report before raising thresholds.');
}
