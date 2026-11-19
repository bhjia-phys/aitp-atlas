// Offline release smoke helpers. Every writable location is below makeFixture().base.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {existsSync,promises as fs} from 'node:fs';
import path from 'node:path';
const exec=promisify(execFile);
export const skillsName='dsh-aitp-skills';
export async function releaseEnv(fx,{exe,cli,modelUrl,online}) {
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(path|systemroot|windir|comspec|pathext|systemdrive|lang|lc_all|tz)$/i.test(k)));
  const f=fx.file;
  Object.assign(env,{DSH_EXE:exe,DSH_CLI:cli,ELECTRON_RUN_AS_NODE:'1',DSH_HOME:f('dsh-home'),HOME:f('user'),USERPROFILE:f('user'),APPDATA:f('user/roaming'),LOCALAPPDATA:f('user/local'),TMP:f('tmp'),TEMP:f('tmp'),TMPDIR:f('tmp'),XDG_CONFIG_HOME:f('user/config'),XDG_CACHE_HOME:f('user/cache'),XDG_DATA_HOME:f('user/data'),XDG_STATE_HOME:f('user/state'),PNPM_HOME:f('pnpm'),npm_config_cache:f('npm-cache'),npm_config_store_dir:f('pnpm-store'),npm_config_userconfig:f('user/.npmrc'),npm_config_globalconfig:f('user/global.npmrc'),npm_config_audit:'false',npm_config_fund:'false',GIT_CONFIG_NOSYSTEM:'1',GIT_TERMINAL_PROMPT:'0',CI:'1',DEEPSEEK_BASE_URL:modelUrl,DEEPSEEK_API_KEY:'sk-atlas-e2e-placeholder',NO_PROXY:'127.0.0.1,localhost',no_proxy:'127.0.0.1,localhost'});
  if(!online) Object.assign(env,{npm_config_offline:'true',npm_config_registry:'http://127.0.0.1:9/',HTTP_PROXY:'http://127.0.0.1:9',HTTPS_PROXY:'http://127.0.0.1:9',ALL_PROXY:'http://127.0.0.1:9'});
  for(const p of [env.HOME,env.APPDATA,env.LOCALAPPDATA,env.TMP,env.DSH_HOME])await fs.mkdir(p,{recursive:true});
  return env;
}
export async function packedSubject(root,fx,env,provided){
  let tarball=provided;
  if(!tarball){
    const bin=path.dirname(process.execPath);
    const npm=[process.env.npm_execpath,path.join(bin,'node_modules/npm/bin/npm-cli.js'),path.resolve(bin,'../lib/node_modules/npm/bin/npm-cli.js')].find(p=>p && path.isAbsolute(p) && path.basename(p)==='npm-cli.js' && existsSync(p));
    if(!npm)throw Error('Provide a local Atlas .tgz or run with npm run test:dsh.');
    // Do not execute lifecycle hooks; test the committed build separately, then pack it.
    await exec(process.execPath,[path.join(root,'build-client.mjs'),'--check'],{cwd:root,env});
    const {stdout}=await exec(process.execPath,[npm,'pack','--ignore-scripts','--json','--pack-destination',fx.base],{cwd:root,env});
    const [{filename}]=JSON.parse(stdout);tarball=fx.file(path.basename(filename));
  }
  if(!/\.tgz$/i.test(tarball) || !(await fs.stat(tarball)).isFile())throw Error('Expected a local Atlas release .tgz');
  // Extract only fixed members to stdout, never execute a checkout helper in their place.
  const part=async member=>(await exec('tar',['-xOf',tarball,'package/'+member],{env,cwd:fx.base,encoding:'buffer',maxBuffer:8*1024*1024})).stdout;
  const manifest=JSON.parse(await part('package.json'));if(manifest.name!=='aitp-atlas')throw Error('Not an Atlas package');
  const script=await part('scripts/install-dsh.mjs'),installer=fx.file('packed-install-dsh.mjs');await fs.writeFile(installer,script,{flag:'wx'});
  return {tarball,installer,manifest,client:await part('client.js')};
}
export async function seedProfile(env,profile,{stub,baseBundles}){
  const dir=path.join(env.DSH_HOME,'profiles',profile),source=path.join(env.HOME,'fixture-skills');
  await fs.mkdir(dir,{recursive:true});
  if(stub){
    await fs.mkdir(source,{recursive:true});
    await fs.writeFile(path.join(source,'package.json'),JSON.stringify({name:skillsName,version:'0.0.0-fixture',private:true,dsh:{bundle:{patch:'./cordis.patch.yml'}}}));
    const localSkills=path.join(source,'skills');await fs.mkdir(localSkills,{recursive:true});
    await fs.writeFile(path.join(localSkills,'atlas-release-fixture.md'),'---\nname: atlas-release-fixture\ndescription: Identifies the local synthetic release-smoke bundle only.\n---\nThis is a test marker, not an upstream skill.\n');
    await fs.writeFile(path.join(source,'cordis.patch.yml'),JSON.stringify([{insert:[{id:'atlas-release-skill-fixture',name:'@deepseek-ai/dsh-skill-filesystem',config:{providerName:'atlas-release-fixture',includeDefaultRoots:false,watch:false,customSkillDirs:[localSkills]}}]}]));
    await fs.mkdir(path.join(dir,'node_modules'),{recursive:true});await fs.cp(source,path.join(dir,'node_modules',skillsName),{recursive:true});
  }
  await fs.writeFile(path.join(dir,'package.json'),JSON.stringify({name:'dsh-profile-'+profile,private:true,dsh:{profile:{bundles:[...baseBundles,...(stub?[skillsName]:[])]}},dependencies:stub?{[skillsName]:'file:'+source.replaceAll('\\','/')}:{}}));
  await fs.writeFile(path.join(dir,'pnpm-workspace.yaml'),'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n');
}
