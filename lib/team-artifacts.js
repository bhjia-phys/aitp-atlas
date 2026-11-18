// Read-only projection of the documented team formats, not a general YAML loader.
// No imports, filesystem access, expansion, implicit types, or content-derived file paths.
const FILE_LIMIT = 256 * 1024, HEADER_LIMIT = 40 * 1024, LINE_LIMIT = 4096, MAX_LINES = 512;
const forbidden = new Set(['__proto__','prototype','constructor']);
const reportStatuses = ['draft','submitted','accepted','needs-work','rejected','superseded'];
const verdicts = ['holds','holds-with-changes','fails','cannot-check'];
function invalid(msg) { throw new Error(msg); }
const dict = x => x !== null && typeof x === 'object' && !Array.isArray(x);
function keyPair(s) {
  const m = /^([A-Za-z][A-Za-z0-9_.-]{0,79}):(?: (.*)|$)/.exec(s);
  if (!m || forbidden.has(m[1]) || !m[1]) invalid('Unsupported mapping key.');
  return [m[1], (m[2] || '').trim()];
}
function put(obj, k, v) {
  if (Object.hasOwn(obj,k) || forbidden.has(k)) invalid('Duplicate or unsupported mapping key.');
  obj[k] = v;
}
// Quotes start at a scalar boundary, not in Ward's identity. A hash in a URL fragment is data.
function scan(s, mode) {
  let quote = '', start = 0;
  const parts = [];
  for (let i=0;i<s.length;i++) {
    const ch = s[i];
    if (quote) {
      if (quote === '"' && ch === '\\') { i++; continue; }
      if (quote === "'" && ch === quote && s[i+1] === quote) { i++; continue; }
      if (ch === quote) quote='';
    } else if ((ch === '"' || ch === "'") && (!i || /[\s:,\[{]/.test(s[i-1]))) quote=ch;
    else if (mode === 'comment' && ch === '#' && (!i || /\s/.test(s[i-1]))) return s.slice(0,i).trimEnd();
    else if (mode === 'comma' && ch === ',') {parts.push(s.slice(start,i).trim());start=i+1;}
  }
  if (quote) invalid('Unterminated quoted value.');
  return mode === 'comma' ? [...parts,s.slice(start).trim()] : s.trimEnd();
}
function scalar(s) {
  if (!s || /^[!&*|>{}\[\]`@]/.test(s) || /[\x00-\x08\x0b-\x1f]/.test(s)) invalid('Unsupported scalar or YAML feature.');
  if (s[0] === '"') { const v=JSON.parse(s); if(typeof v !== 'string' || /[\x00-\x08\x0b-\x1f]/.test(v)) invalid('Expected text.'); return v; }
  if (s[0] === "'") { if (!/^'(?:[^']|'')*'$/.test(s)) invalid('Invalid quoted text.'); return s.slice(1,-1).replace(/''/g,"'"); }
  if (/:\s/.test(s)) invalid('Use quotes around a value containing colon-space.');
  return s;
}
function value(s) {
  if (s.startsWith('[') || s.startsWith('{')) {
    const array=s[0]==='[', end=array?']':'}'; if(!s.endsWith(end))invalid('Unterminated inline collection.');
    const inside=s.slice(1,-1).trim(), parts=inside?scan(inside,'comma'):[];
    if(parts.length>160)invalid('Too many values.');
    if(array)return parts.map(scalar);
    const obj={}; for(const part of parts){const [k,v]=keyPair(part);put(obj,k,scalar(v));} return obj;
  }
  return scalar(s);
}
function bounded(raw) {
  if(typeof raw!=='string' || raw.length>FILE_LIMIT)invalid('File exceeds the display limit.');
  if(raw.includes('\0'))invalid('Not a text artifact.');
  return raw.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
}
function header(text) {
  if(!text.startsWith('---\n'))invalid('Missing front matter.');
  const match=/^---[ \t]*$/m.exec(text.slice(4,HEADER_LIMIT));
  if(!match)invalid('Missing end of front matter or header too large.');
  const raw=text.slice(4,4+match.index).split('\n');
  if(raw.length>MAX_LINES)invalid('Too many header lines.');
  const lines=[];
  for(const line of raw){
    if(line.length>LINE_LIMIT || /^ *\t/.test(line))invalid('Unsupported indentation or oversized line.');
    const s=scan(line,'comment');if(!s.trim())continue;
    const indent=s.length-s.trimStart().length;
    if(![0,2,4].includes(indent))invalid('Use two spaces for each indentation level.');
    lines.push({n:indent,s:s.slice(indent)});
  }
  // The templates need exactly three block shapes: scalar by key, map/list at indent 2,
  // and a list of short mappings whose continuation keys sit at indent 4. No recursion.
  const result={};
  for(let i=0;i<lines.length;){
    const top=lines[i++];if(top.n!==0)invalid('Unexpected indentation.');
    const [k,v]=keyPair(top.s);
    if(v){put(result,k,value(v));continue;}
    if(!lines[i] || lines[i].n===0){put(result,k,'');continue;}
    const isList=lines[i].s.startsWith('- '),out=isList?[]:{};
    while(i<lines.length && lines[i].n){
      const l=lines[i++]; if(l.n!==2 || isList!==l.s.startsWith('- '))invalid('Mixed or nested block types.');
      if(!isList){const [a,b]=keyPair(l.s);put(out,a,scalar(b));continue;}
      const rest=l.s.slice(2);
      if(!/^[A-Za-z][\w.-]*:(?: |$)/.test(rest)){out.push(scalar(rest));continue;}
      const obj={}; let [a,b]=keyPair(rest);put(obj,a,scalar(b));
      while(i<lines.length && lines[i].n===4){[a,b]=keyPair(lines[i++].s);put(obj,a,scalar(b));}
      out.push(obj);
    }
    put(result,k,out);
  }
  return {meta:result,body:text.slice(4+match.index+match[0].length).replace(/^\n/,'')};
}
function simple(v, key, regex) {
  if(typeof v!=='string'||!v.trim()||(regex&&!regex.test(v)))invalid('Missing or invalid '+key+'.'); return v;
}
function one(v,key,allowed) { if(!allowed.includes(v))invalid('Missing or invalid '+key+'.');return v; }
function strings(v,key) { if(v===undefined)return [];if(!Array.isArray(v)||v.some(x=>typeof x!=='string'))invalid('Expected a list for '+key+'.');return v; }
function objects(v,key) { if(v===undefined)return [];if(!Array.isArray(v)||v.some(x=>!dict(x)))invalid('Expected a list of records for '+key+'.');return v; }
function titleOf(text,path) { return /^#\s+([^\n]{1,300})/m.exec(String(text||'').slice(0,FILE_LIMIT))?.[1].trim() || String(path||'Artifact').split(/[\\/]/).at(-1); }
const RID=/^R\d{2,8}$/, VID=/^V\d{2,8}$/, DID=/^D\d{2,8}$/, SEAT=/^[a-z][a-z0-9-]{0,31}$/;
function info(kind,text,{path='',mtimeMs=0}={}) { return {kind,id:null,path,mtimeMs,title:titleOf(text,path),formatted:false,issue:''}; }
// A malformed file never borrows identity, a status, an option, or a verdict from its filename.
export function parseTeamArtifact(kind, raw, file) {
  const base=info(kind,raw,file);
  try {
    const {meta:m,body}=header(bounded(raw));
    if(m.kind!==kind || !['report','review','decision'].includes(kind))invalid('Kind does not match its directory.');
    const id=simple(m.id,'id',kind==='report'?RID:kind==='review'?VID:DID),title=m.title?simple(m.title,'title'):titleOf(body,base.path);
    const common={...base,id,title,formatted:true};
    if(kind==='report') {
      const claims=objects(m.claims,'claims').map(x=>({id:simple(x.id,'claim id',/^R\d{2,8}\.\d+$/),text:simple(x.text,'claim text'),basis:one(x.basis,'basis',['derived','computed','cited','conjectured'])}));
      if(claims.some(x=>!x.id.startsWith(id+'.')) || new Set(claims.map(x=>x.id)).size!==claims.length)invalid('Mismatched or duplicate claim id.');
      return {...common,seat:simple(m.seat,'seat',SEAT),task:m.task?simple(m.task,'task',/^task-\d+$/):null,status:one(m.status,'status',reportStatuses),claims,
        assumptions:strings(m.assumptions,'assumptions'),evidence:strings(m.evidence,'evidence'),checks:strings(m.checks,'checks'),open:strings(m.open,'open'),implication:m.implication?simple(m.implication,'implication'):'',incomplete:!claims.length};
    }
    if(kind==='review') {
      const on=simple(m.on,'review target',RID),claims=m.claims??{};if(!dict(claims))invalid('Invalid review claims.');
      for(const [k,v] of Object.entries(claims)){if(!/^R\d{2,8}\.\d+$/.test(k) || !k.startsWith(on+'.'))invalid('Mismatched claim target.');one(v,'claim verdict',['holds','fails','unverified']);}
      const findings=objects(m.findings,'findings').map(x=>({severity:one(x.severity,'severity',['blocking','major','minor']),where:simple(x.where,'finding location'),text:simple(x.text,'finding text')}));
      const verdict=m.verdict?one(m.verdict,'verdict',verdicts):null;
      return {...common,seat:simple(m.seat,'seat',SEAT),on,verdict,claims,findings,incomplete:!verdict};
    }
    const options=m.options;if(!dict(options)||Object.keys(options).length<2||Object.entries(options).some(([k,v])=>!/^([A-Z])$/.test(k)||typeof v!=='string'||!v.trim()))invalid('Expected at least two lettered options.');
    if(m.recommendation && !Object.hasOwn(options,m.recommendation))invalid('Recommendation is not an option.');
    const answer=/^## Answer \([^\n]+, researcher\)\s*\n([\s\S]*)$/m.exec(body);
    return {...common,title:m.title||m.question,from:one(m.from,'from',['lead']),status:one(m.status,'decision status',['open','answered','withdrawn']),question:simple(m.question,'question'),options,recommendation:m.recommendation||null,answerText:answer?answer[1].trim().slice(0,8192):null};
  }catch(e){return {...base,issue:e.message};}
}

// Account only for real Markdown headings; quoted code examples are not state or charter sections.
function segments(text) {
  const parts=new Map(); let active=null, fence='';
  for(const line of text.split('\n')){
    const mark=/^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
    if(mark){if(!fence)fence=mark;else if(mark[0]===fence[0] && mark.length>=fence.length && line.trim()===mark)fence='';continue;}
    if(fence)continue;
    const h=/^##\s+(.+?)\s*#*\s*$/.exec(line);
    if(h){active=h[1];if(parts.has(active))invalid('Repeated section: '+active);parts.set(active,[]);}
    else if(/^#\s/.test(line))active=null;
    else if(active!==null)parts.get(active).push(line);
  }
  return parts;
}
function logItems(lines) {
  const items=[];let text='';
  function flush(){if(!text)return;const refs=Array.from(new Set(text.match(/\b[RV]\d{2,8}\b/g)||[]),id=>({kind:id[0]==='R'?'report':'review',id}));items.push({text,refs});text='';}
  for(const line of lines||[]){const bullet=/^\s*(?:[-*+] |\d+\. )(.*)/.exec(line);if(!line.trim()||bullet)flush();if(line.trim())text+=(text?' ':'')+(bullet?bullet[1]:line.trim());}flush();return items;
}
export function parseTeamState(raw,file){
  const base=info('state',raw,file),keys=['Established','Open','Conflicts','Next'],sections=Object.fromEntries(keys.map(k=>[k,[]]));
  try{const parts=segments(bounded(raw));if(!keys.some(k=>parts.has(k)))invalid('No logbook sections.');for(const k of keys)sections[k]=logItems(parts.get(k));return {...base,formatted:true,sections};}catch(e){return {...base,sections,issue:e.message};}
}
export function parseTeamCharter(raw,file){
  const base=info('charter',raw,file);
  try{const text=bounded(raw), {body,meta}=header(text);if(meta.kind!=='charter')invalid('Not a charter.');const parts=segments(body),section=name=>(parts.get(name)||[]).join('\n').trim();
    return {...base,formatted:true,title:titleOf(body,base.path),goal:section('Goal'),doneWhen:section('Done when'),conventions:section('Conventions and assumptions'),seats:section('Seats'),allowedFiles:section('Allowed files'),askBefore:section('Ask me before'),inputs:section('Inputs')};
  }catch(e){return {...base,goal:'',doneWhen:'',issue:e.message};}
}
