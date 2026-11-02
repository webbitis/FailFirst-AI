import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const excluded = new Set(['node_modules', '.next', '.git', '.vercel', '.turbo', 'coverage']);
const errors = [];
const patterns = [
  new RegExp('ghp_' + '[A-Za-z0-9]{20,}', 'g'),
  new RegExp('github_pat_' + '[A-Za-z0-9_]{20,}', 'g'),
  new RegExp('sk-' + '[A-Za-z0-9_-]{24,}', 'g'),
  new RegExp('AIza' + '[A-Za-z0-9_-]{25,}', 'g'),
  new RegExp('-----BEGIN ' + '(?:RSA |EC |OPENSSH )?PRIVATE KEY-----', 'g'),
];

function fallbackFiles(folder, acc = []) {
  for (const name of readdirSync(folder)) {
    if (excluded.has(name)) continue;
    const full = join(folder, name);
    if (statSync(full).isDirectory()) fallbackFiles(full, acc);
    else if (!name.startsWith('.env') || name === '.env.example') acc.push(relative(root, full));
  }
  return acc;
}

let files;
try {
  files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
} catch {
  files = fallbackFiles(root);
  console.log('No Git repository found. Scanning distributable files; check staged Git files after git init.');
}
let checked = 0;
for (const rel of files) {
  const name = rel.split(/[\\/]/).at(-1);
  if (name.startsWith('.env') && name !== '.env.example') errors.push(`Environment file would be published: ${rel}`);
  if (/\.(pem|p12|key)$/i.test(name)) errors.push(`Possible private credential file: ${rel}`);
  if (!/\.(js|jsx|mjs|json|md|css|txt|example|gitignore)$/i.test(name) && name !== '.gitignore') continue;
  checked++;
  const content = readFileSync(join(root, rel), 'utf8');
  for (const re of patterns) if (re.test(content)) errors.push(`Possible credential pattern in ${rel}`);
}
if (errors.length) {
  console.error('PUBLISH CHECK FAILED:');
  for (const err of errors) console.error(`- ${err}`);
  process.exitCode = 1;
} else {
  console.log(`PUBLISH CHECK PASSED: ${checked} publishable text files scanned. No obvious secret patterns found.`);
  console.log('This heuristic check does not review Git history or replace manual inspection.');
}
