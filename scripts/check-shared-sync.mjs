/**
 * Verifies this repository's copy of the API contract still matches the
 * backend's.
 *
 * The contract (DTOs, Zod schemas, date and money helpers) is the one piece of
 * code both repositories genuinely share. Splitting the monorepo left two
 * copies, and two copies drift - usually silently, usually the day someone adds
 * a field to a DTO on one side only, and the type error appears somewhere
 * unrelated three weeks later.
 *
 * This script makes that drift loud. It hashes every file under shared/src and
 * compares against the backend's copy.
 *
 *   node scripts/check-shared-sync.mjs                        # needs ../Hostel-hub-backend
 *   node scripts/check-shared-sync.mjs --backend <path>
 *   node scripts/check-shared-sync.mjs --update               # copy backend -> here
 *
 * Skips with a warning (exit 0) when the backend checkout is not present, so a
 * frontend-only CI run does not fail for a reason it cannot fix.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const localShared = join(repoRoot, 'shared', 'src');

const args = process.argv.slice(2);
const update = args.includes('--update');
const backendFlag = args.indexOf('--backend');
const backendRoot =
  backendFlag !== -1 && args[backendFlag + 1]
    ? resolve(args[backendFlag + 1])
    : resolve(repoRoot, '..', 'Hostel-hub-backend');
const backendShared = join(backendRoot, 'shared', 'src');

/** Every .ts file under a directory, relative to it, sorted for a stable diff. */
function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      // Tests live only in the backend copy; they are not part of the contract.
      else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
        out.push(relative(root, full).split('\\').join('/'));
      }
    }
  };
  walk(root);
  return out.sort();
}

const hash = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');

if (!existsSync(backendShared)) {
  console.warn(
    `[shared] Backend checkout not found at ${backendRoot} - skipping the drift check.\n` +
      `[shared] Clone Hostel-hub-backend beside this repository, or pass --backend <path>.`,
  );
  process.exit(0);
}

const localFiles = listFiles(localShared);
const backendFiles = listFiles(backendShared);
const all = [...new Set([...localFiles, ...backendFiles])].sort();

const differences = [];
for (const file of all) {
  const localPath = join(localShared, file);
  const backendPath = join(backendShared, file);
  const inLocal = existsSync(localPath);
  const inBackend = existsSync(backendPath);

  if (!inLocal) differences.push({ file, why: 'missing here' });
  else if (!inBackend) differences.push({ file, why: 'not in the backend' });
  else if (hash(localPath) !== hash(backendPath)) differences.push({ file, why: 'content differs' });
}

if (differences.length === 0) {
  console.info(`[shared] In sync with the backend - ${all.length} files match.`);
  process.exit(0);
}

if (update) {
  for (const { file } of differences) {
    const backendPath = join(backendShared, file);
    if (!existsSync(backendPath)) continue;
    const target = join(localShared, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(backendPath, target);
    console.info(`[shared] updated ${file}`);
  }
  console.info('[shared] Copied from the backend. Review the diff before committing.');
  process.exit(0);
}

console.error(`[shared] Out of sync with the backend (${differences.length} file(s)):`);
for (const { file, why } of differences) console.error(`  ${file} - ${why}`);
console.error('\n[shared] The backend is the source of truth. Re-run with --update to copy it here.');
process.exit(1);
