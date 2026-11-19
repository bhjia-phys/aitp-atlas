// Source checkout only. Inspect the actual npm tarball without installing it or fetching dependencies.
// Requires the system tar (included in current Windows, macOS and standard Linux toolchains).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
if(process.argv.length!==3)throw Error('Usage: node scripts/verify-package.mjs <candidate.tgz>');
const archive=path.resolve(process.argv[2]);
const tar=(...args)=>execFileSync('tar',args,{maxBuffer:16*1024*1024,windowsHide:true});
const paths=tar('-tzf',archive).toString('utf8').trimEnd().split(/\r?\n/).map(p=>{
  assert.match(p,/^package\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/);assert(!p.split('/').some(part=>!part || part==='.' || part==='..'));return p.slice(8);
});
const names=new Set(paths);assert.equal(names.size,paths.length,'duplicate archive entry');
const read=p=>tar('-xOzf',archive,'package/'+p);
const json=JSON.parse(read('package.json'));assert.equal(json.name,'aitp-atlas');
assert.equal(json.version,JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version);
const allowed=/^(?:package\.json|client\.js|index\.js|README\.md|LICENSE|cordis\.patch\.yml|lib\/[\w-]+\.js|templates\/team\/(?:roles\/)?[\w-]+\.md|vendor\/(?:fonts|pdfjs)\/[\w.-]+|docs\/(?:guide\.md|assets\/atlas-mark\.svg|assets\/workbench\/[\w-]+\.png)|scripts\/install-dsh\.mjs)$/;
for(const p of paths){assert.match(p,allowed,'unexpected package member: '+p);assert.deepEqual(read(p),fs.readFileSync(path.join(root,p)),p+' differs from the reviewed checkout');}
for(const p of [...Object.values(json.exports),json.dsh.bundle.patch,'README.md','LICENSE','docs/guide.md','scripts/install-dsh.mjs','docs/assets/workbench/team-day.png','docs/assets/workbench/team-night.png','vendor/fonts/OFL.txt','vendor/fonts/SourceSerif4Variable-Roman.woff2','vendor/fonts/SourceSerif4Variable-Italic.woff2','vendor/pdfjs/LICENSE','vendor/pdfjs/pdf.min.mjs','vendor/pdfjs/pdf.worker.min.mjs',...['charter','lead-brief','seat-call','state','roles/README','roles/lead','roles/literature','roles/numerics','roles/referee','roles/theorist','roles/writer'].map(k=>`templates/team/${k}.md`)])assert(names.has(p.replace(/^\.\//,'')),'missing '+p);
assert(read('client.js').includes(`const ATLAS_VERSION = ${JSON.stringify(json.version)};`),'About Atlas has the wrong version');
// README is also the DSH detail fallback. Its relative links and the guide must work without design/ or a repository.
for(const doc of ['README.md','docs/guide.md'])for(const [,uri] of read(doc).toString('utf8').matchAll(/!?\[[^\]\n]*\]\(<?([^>\s)]+)>?\)/g)){
  if(/^(?:https?:\/\/|mailto:|#)/i.test(uri))continue;
  assert(names.has(path.posix.normalize(path.posix.join(path.posix.dirname(doc),decodeURIComponent(uri.split('#')[0])))),`${doc} links outside the package: ${uri}`);
}
const bytes=fs.readFileSync(archive); console.log(JSON.stringify({name:json.name,version:json.version,entries:paths.length,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},null,2));
