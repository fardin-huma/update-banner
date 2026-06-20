import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const versionManifestPath = path.join(root, 'public', 'version.json');

const firstNonEmpty = (...values) => values.find((value) => typeof value === 'string' && value.trim().length > 0);

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const version = packageJson.version ?? '0.0.0';
const commitSha = firstNonEmpty(process.env.GITHUB_SHA) ?? null;
const shortSha = commitSha ? commitSha.slice(0, 7) : null;
const runNumber = firstNonEmpty(process.env.GITHUB_RUN_NUMBER) ?? null;
const environment =
  firstNonEmpty(process.env.APP_ENV, process.env.NODE_ENV) ??
  (process.env.GITHUB_ACTIONS ? 'production' : 'development');
const release = shortSha && runNumber ? `${shortSha}-${runNumber}` : null;

const manifest = {
  appName: packageJson.name,
  schemaVersion: 1,
  version,
  builtAt: new Date().toISOString(),
  environment,
  release
};

fs.mkdirSync(path.dirname(versionManifestPath), { recursive: true });
const nextContent = `${JSON.stringify(manifest, null, 2)}\n`;
const currentContent = fs.existsSync(versionManifestPath)
  ? fs.readFileSync(versionManifestPath, 'utf8')
  : null;

if (currentContent !== nextContent) {
  fs.writeFileSync(versionManifestPath, nextContent, 'utf8');
}

console.log(`Synced ${path.relative(root, versionManifestPath)} to version ${version}`);
