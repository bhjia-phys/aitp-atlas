import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const aitpSkills = 'github:bhjia-phys/AITP-Research-Protocol#b1db3f1ef162be5374e8d42ad5e22ce9a5c71082&path:/plugins/aitp';
const [profile, atlasPath, ...extra] = process.argv.slice(2);

if (!profile || !/^[a-z0-9][a-z0-9._-]*$/i.test(profile) || !atlasPath || extra.length) {
  console.error('Usage: node install-dsh.mjs <profile> <Atlas .tgz or source directory>');
  process.exit(2);
}

const bundle = path.resolve(atlasPath);
if (!existsSync(bundle)) {
  console.error(`Atlas package not found: ${bundle}`);
  process.exit(2);
}

const desktop = process.platform === 'win32' && process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness')
  : '';
const desktopExe = desktop && path.join(desktop, 'DeepSeek Harness.exe');
const desktopCli = desktop && path.join(desktop, 'resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js');
const exe = process.env.DSH_EXE || (desktopExe && existsSync(desktopExe) ? desktopExe : 'dsh');
const cli = process.env.DSH_CLI || (exe === desktopExe ? desktopCli : '');
const env = cli ? { ...process.env, ELECTRON_RUN_AS_NODE: '1' } : process.env;
const profileDir = path.join(process.env.DSH_HOME?.trim() || path.join(homedir(), '.dsh'), 'profiles', profile);
const profileManifest = path.join(profileDir, 'package.json');
const skillsManifest = path.join(profileDir, 'node_modules', 'dsh-aitp-skills', 'package.json');
let installedSkills = false;
if (existsSync(profileManifest) && existsSync(skillsManifest)) {
  const manifest = JSON.parse(readFileSync(profileManifest, 'utf8'));
  installedSkills = Boolean(manifest.dependencies?.['dsh-aitp-skills']);
}
if (installedSkills) console.log('Reusing the AITP Skills bundle already installed in this profile.');
const targets = installedSkills ? [bundle] : [bundle, aitpSkills];
const args = [...(cli ? ['--expose-internals', cli] : []), 'plugin', '--profile', profile, 'add', ...targets];

// Install both as first-class profile bundles with the same native DSH command.
const installed = spawnSync(exe, args, { stdio: 'inherit', env });
if (installed.error) console.error(`Could not start DeepSeek Harness: ${installed.error.message}`);
process.exitCode = installed.status ?? 1;
