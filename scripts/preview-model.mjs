// Local Messages fixture. Ordinary preview never inspects prompts or emits tools. Only the
// in-process M3 fixture opts into the fixed, bounded native-seat conversation below.
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const reply = ['This is the Atlas fixture. ', 'Open the [worm note](mc/worm/research.md)',
  ' or compare [arXiv:1510.07698](https://arxiv.org/abs/1510.07698).'];

// Accept controls only from the test process. Parsed model requests are never logged or kept.
// A fixed test lead can start exactly the two Derive-and-check seats; a child can read only
// the generated card for its seat. No arbitrary tool/call forwarding or filesystem tools here.
function fixtureTeam(root, worker) {
  const base=path.dirname(root);
  if(path.dirname(base)!==os.tmpdir() || !/^atlas-fixture-[a-z0-9]+$/i.test(path.basename(base)) || path.basename(root)!=='topics') throw Error('Team mock requires a fresh Atlas fixture');
  if(!['theorist','numerics'].includes(worker))throw Error('Unknown fixture worker');
  const seats=[worker,'referee'], sent=new Set(), seen=new Set(), requested=new Set(), received=new Set();
  const calls=new Map(), messages={member:[],decision:[],unknown:[]};
  let boardRequested=false;
  const textOf=v=>typeof v==='string'?v:Array.isArray(v)?v.map(x=>x?.type==='tool_result'?textOf(x.content):x?.text||'').join('\n'):'';
  const script=body=>{
    const tools=Array.isArray(body.tools)?body.tools:[], user=(body.messages||[]).filter(m=>m.role==='user');
    const last=textOf(user.at(-1)?.content), history=user.map(m=>textOf(m.content));
    const lead=history.find(t=>t.includes('You lead an AITP research team') && t.includes('Start the members now'));
    const recipient=lead?'lead':[...calls].find(([,v])=>history.some(t=>t.includes(v.prompt)))?.[0] || 'unknown';
    if(last.includes('Check fixture member delivery.')) messages.member.push(recipient);
    if(last.includes('fixture decision receipt') && /Decision D01 answered/i.test(last)) messages.decision.push(recipient);
    if(last.includes('Do not route fixture unknown.')) messages.unknown.push(recipient);
    if(lead) {
      const match=/^Run directory:\s*(.+)$/m.exec(lead), run=match && path.resolve(match[1].trim());
      if(!run || !/^mc\/worm\/runs\/team-[\w-]+$/i.test(path.relative(root,run).replaceAll('\\','/')))return {};
      for(const seat of seats){
        const card=path.join(run,'roles',seat+'.md');
        if(sent.has(seat))continue;
        // Inherited fixture route only: never forward a provider/model from a prompt.
        const row=lead.split('\n').map(x=>x.trim()).find(x=>x.startsWith(`- subagent(name="${seat}",`));
        const args=/^- subagent\(name="(?:theorist|numerics|referee)", description=("(?:\\.|[^"\\])*"), prompt=("(?:\\.|[^"\\])*")\)(?:\s|$)/.exec(row||'');
        if(!args)continue;
        const description=JSON.parse(args[1]), prompt=JSON.parse(args[2]);
        if(!prompt.replaceAll('\\','/').includes(card.replaceAll('\\','/')) || !prompt.includes('fixture'))continue;
        const tool=tools.find(x=>x.name==='subagent'); if(!tool) return {};
        calls.set(seat,{card,prompt});sent.add(seat);return {tool:tool.name,input:{name:seat,description,prompt}};
      }
      if(!boardRequested && sent.size===2 && tools.some(t=>t.name==='team_task_create')) {
        boardRequested=true;return {tool:'team_task_create',input:{subject:'Check the limiting coefficient',description:'Record the fixture convention and check the dimensionless limit in the numerical report.'}};
      }
    } else for(const [seat,{card,prompt}] of calls){
      if(!history.some(t=>t.includes(prompt)))continue;
      seen.add(seat);
      if(requested.has(seat) && Array.isArray(user.at(-1)?.content) && user.at(-1).content.some(b=>b?.type==='tool_result' && !b.is_error && textOf(b.content).includes(`# Role: ${seat}`))) {
        received.add(seat);return {text:`Fixture ${seat} received role card and first task.`};
      }
      if(!requested.has(seat) && tools.some(x=>x.name==='read')){requested.add(seat);return {tool:'read',input:{file_path:card,limit:18}};}
    }
    return {};
  };
  return {script,receipts:()=>({started:[...sent],promptDelivered:[...seen],roleRead:[...received],messages:{member:[...messages.member],decision:[...messages.decision],unknown:[...messages.unknown]}})};
}

export async function startModel() {
  const key = randomUUID();
  // Only the in-process smoke driver can schedule a gated turn. No HTTP control endpoint;
  // no prompt/body inspection. The ordinary CLI continues streaming its short fixture.
  const plans = [], stop = new AbortController();
  let team, nextReply;
  // Text-only, one-shot acceptance fixture. A session request must have native agent tools and
  // its final user text must contain the expected marker. Background titles/summaries cannot
  // spend a queued turn. No HTTP configuration, request logs, tool calls or prompt forwarding.
  const replyNext = (text, marker) => {
    if(nextReply || typeof text!=='string' || !text || text.length>24000 || typeof marker!=='string' || !marker || marker.length>1000)throw Error('Invalid or overlapping fixture reply');
    let mark;
    const matched=new Promise(resolve=>{mark=resolve;});
    const plan={text,marker,used:false,mark};nextReply=plan;
    return Object.assign(()=>plan.used,{matched}); // Optional notification; no polling or timer.
  };
  const enableFixtureTeam = (root,worker='theorist') => {if(team)throw Error('Team fixture already armed');team=fixtureTeam(root,worker);return team.receipts;};
  const holdNext = label => {
    if (!['A', 'B'].includes(label)) throw new Error('Unknown fixture stream');
    let start, release, finish;
    const started = new Promise(resolve => { start = resolve; });
    const released = new Promise(resolve => { release = resolve; });
    const finished = new Promise(resolve => { finish = resolve; });
    plans.push({ label, start, released, finish });
    return { started, release, finished };
  };
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || !/^\/(?:v1\/)?messages(?:\?|$)/.test(req.url)) return res.writeHead(404).end();
    if (req.headers['x-api-key'] !== key && req.headers.authorization !== `Bearer ${key}`) return res.writeHead(401).end();
    let scripted={};
    if(team || nextReply){
      const chunks=[];let bytes=0;
      try {for await(const chunk of req){bytes+=chunk.length;if(bytes>4*1024*1024)return res.writeHead(413).end();chunks.push(chunk);}
        const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const last=body.messages?.at(-1), text=typeof last?.content==='string'?last.content:Array.isArray(last?.content)?last.content.filter(b=>b.type==='text').map(b=>b.text).join('\n'):'';
        if(nextReply && last?.role==='user' && body.tools?.some(t=>t.name==='read') && text.includes(nextReply.marker)){
          nextReply.used=true;scripted={text:nextReply.text};nextReply.mark();nextReply=null;
        }else if(team)scripted=team.script(body);
      }catch{return res.writeHead(400).end();}
    }else req.resume(); // Default preview discards, rather than buffering or logging, all input.
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
    const send = (type, fields = {}) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...fields })}\n\n`);
    send('message_start', { message: { id: `msg_${randomUUID()}`, type: 'message', role: 'assistant', model: 'deepseek-flash', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } } });
    if(scripted.tool){
      send('content_block_start',{index:0,content_block:{type:'tool_use',id:`toolu_${randomUUID()}`,name:scripted.tool,input:{}}});
      send('content_block_delta',{index:0,delta:{type:'input_json_delta',partial_json:JSON.stringify(scripted.input)}});
      send('content_block_stop',{index:0});send('message_delta',{delta:{stop_reason:'tool_use',stop_sequence:null},usage:{output_tokens:32}});send('message_stop');res.end();return;
    }
    send('content_block_start', { index: 0, content_block: { type: 'text', text: '' } });
    const plan = plans.shift();
    const delta = text => send('content_block_delta', { index: 0, delta: { type: 'text_delta', text } });
    if (plan) {
      delta(`Fixture stream ${plan.label} begins. `);
      plan.start();
      // Cancellation or an early failed test must never leave a request/timer running.
      const timeout = AbortSignal.timeout(45000), cancel = AbortSignal.any([timeout, stop.signal]);
      const abort = new Promise(resolve => cancel.addEventListener('abort', resolve, { once: true }));
      await Promise.race([plan.released, abort]);
      if (res.destroyed || stop.signal.aborted) return;
    }
    for (const text of plan ? [...reply, ` Stream ${plan.label} complete.`] : scripted.text ? [scripted.text] : reply) {
      await delay(180);
      if (res.destroyed) return;
      send('content_block_delta', { index: 0, delta: { type: 'text_delta', text } });
    }
    send('content_block_stop', { index: 0 });
    send('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 42 } });
    send('message_stop');
    res.end();
    plan?.finish();
  });
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  return {
    url: `http://127.0.0.1:${server.address().port}`, key, holdNext, replyNext, enableFixtureTeam,
    close: () => new Promise((resolve) => { stop.abort(); server.close(resolve); server.closeAllConnections(); }),
  };
}
