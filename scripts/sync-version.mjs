import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const versionManifestPath = path.join(root, 'public', 'version.json');

const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const version = packageJson.version ?? '0.0.0';
const commitSha =
  process.env.GITHUB_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.CI_COMMIT_SHA ??
  'local';
const branch =
  process.env.GITHUB_REF_NAME ??
  process.env.VERCEL_GIT_COMMIT_REF ??
  process.env.CI_COMMIT_REF_NAME ??
  'local';
const repository =
  process.env.GITHUB_REPOSITORY ?? process.env.CI_PROJECT_PATH ?? packageJson.name;
const actor = process.env.GITHUB_ACTOR ?? process.env.USERNAME ?? 'local-user';
const runNumber = process.env.GITHUB_RUN_NUMBER ?? process.env.CI_PIPELINE_IID ?? null;

const manifest = {
  appName: packageJson.name,
  appVersion: 1,
  version,
  builtAt: new Date().toISOString(),
  environment: process.env.NODE_ENV ?? 'production',
  repository,
  branch,
  commitSha,
  shortSha: commitSha.slice(0, 7),
  runNumber,
  builtBy: actor
};

fs.mkdirSync(path.dirname(versionManifestPath), { recursive: true });
fs.writeFileSync(versionManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Synced ${path.relative(root, versionManifestPath)} to version ${version}`);
