/** Opt-in real DSH acceptance: node test/inquiry-ui.mjs [--capture], after a normal client build.
 * The transcript, Markdown, toy CSV and model output below are authored synthetic examples.
 * This checks the product, not Schwarzschild–AdS physics, source validity or a live model.
 * No real profile, shared conversation URL, provider, solver, cluster, or install is used.
 */
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runBrowserSmoke } from './ui-smoke.mjs';

const capture=process.argv.includes('--capture'), shots=new Map(), J=JSON.stringify;
const topic='gravity', title='Schwarzschild–AdS · synthetic fixture';
const longQuestion='Synthetic fixture · How would a trap in Schwarzschild–AdS appear in a boundary response?';
const currentQuestion='Which observable would distinguish a radial feature from a boundary echo?';
const revised='Which boundary conditions must agree before comparing radial profiles?';
const opener='Synthetic fixture · Look at the radial solutions. Do not start a team.';
const later='Draft a reviewable synthetic comparison plan; do not launch it.';
const source='https://example.invalid/synthetic-discussion'; // never navigated/fetched
const excerpt='Synthetic excerpt, not an imported conversation: would matching the horizon and boundary conditions help?';
const pointer='gravity/comparison.md#L3';
const edges=[
  {from:'Bulk trapping · synthetic fixture',to:'Radial profile',status:'conditional',assumptions:['Same geometry and boundary conditions'],evidence:[pointer]},
  {from:'Radial profile',to:'Boundary response',status:'open',assumptions:['A bulk amplitude is not a boundary observable'],evidence:[]},
  {from:'Radial profile',to:'Mode lifetime',status:'open',assumptions:['Needs a mode or time-domain check'],evidence:[]}
];
const proposal={goal:'Synthetic fixture: compare two radial profiles under one convention.',firstTask:'List the shared boundary conditions before proposing a solve.',doneWhen:'The comparison lists assumptions and names one falsifying check.',conventions:'Fixed toy units; no physical solution is supplied.',stopWhen:'Stop before any numerical solve or external request.',seats:[{name:'theorist',role:'theorist',task:'State the toy horizon and boundary prescription.'},{name:'referee',role:'referee',task:'Flag any unsupported inference about a boundary signal.'}],evidence:[pointer]};
const result={claim:'Synthetic illustration only: the two toy traces differ.',limits:'Invented points, not radial solutions; no evidence for trapping or a boundary echo.',evidence:[pointer]};
const editedTask='Check only the synthetic axes and common normalization; do not solve a wave equation.';
const teaching='Synthetic teaching example. A radial profile samples a bulk field; a boundary response is a different quantity. Before treating curves as a comparison, fix the boundary conditions, normalization and readout. The invented traces here cannot establish trapping.';
const snapshot=(prose,card)=>`${prose}\n\n\`\`\`atlas-inquiry\n${J(card)}\n\`\`\``;
const planCard={longQuestion,currentQuestion:revised,edges,proposal};
const resultCard={longQuestion,currentQuestion:revised,edges,result,figure:{source:'gravity/compare.atlas-figure.json'}};

// Seed files in the disposable research tree only; never seed a discussion, team, model
// receipt, chart DOM or Atlas registry. The toy series is drawn from disk by the product.
async function seed(fx){
  assert.equal(path.dirname(fx.base),os.tmpdir());assert.match(path.basename(fx.base),/^atlas-fixture-[\w-]+$/);
  assert.equal(await fs.realpath(fx.root),path.join(fx.base,'topics'));
  const dir=path.join(fx.root,topic);await fs.mkdir(dir);
  const docs={
    'research.md':`# ${title}\n\nSynthetic UI fixture; not a calculation, paper or scientific validation.\n\n[Comparison notebook](comparison.md)\n`,
    'comparison.md':'# Comparison notebook — synthetic fixture\n\nInvented samples for a schematic illustration; no solver was run. No research result follows.\n',
    'data.csv':'Toy sample index,Trace A,Trace B\n0,1,1\n1,0.70,0.92\n2,0.45,0.62\n3,0.31,0.36\n4,0.20,0.22\n',
    'compare.atlas-figure.json':J({kind:'schematic',data:'gravity/data.csv',report:'gravity/comparison.md',xLabel:'Toy sample index',xUnit:'1',yLabel:'Invented amplitude',yUnit:'1',commonParameters:'Synthetic fixture, identical sample grid. No solver or physical parameters.',normalization:'Both toy traces start at 1.'})
  };
  for(const [file,body] of Object.entries(docs))await fs.writeFile(path.join(dir,file),body,{flag:'wx'});
  await fs.appendFile(path.join(fx.root,'research.md'),`\n## Synthetic examples\n\n- [${title}](gravity/research.md): invented UI evidence only.\n`);
}

// Read the *actual* rendered leaf's computed text and paint stack. Skip image/gradient or
// group-opacity stacks rather than invent a background; ratios are WCAG text spot checks.
function ratioOf(el){
  if(!el)return null;
  const rgba=s=>s.replace(/^rgba?\(|\)$/g,'').split(/,\s*/).map(Number);
  const over=(a,b)=>a.slice(0,3).map((v,i)=>v*(a[3]??1)+b[i]*(1-(a[3]??1)));
  const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const fg=rgba(getComputedStyle(el).color), layers=[];let opaque=false;
  for(let n=el;n;n=n.parentElement){const s=getComputedStyle(n);if(s.backgroundImage!=='none'||s.opacity!=='1'||!/^rgba?\(/.test(s.backgroundColor))return null;
    const a=rgba(s.backgroundColor);layers.push(a);if((a[3]??1)===1){opaque=true;break;}}
  if(!opaque)return null;
  const bg=layers.reverse().reduce((base,a)=>over(a,base),[255,255,255]);const x=lum(over(fg,bg)),y=lum(bg);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}

await runBrowserSmoke(async function researchInquiry({q,wait,click,key,c,ev,place,model,fx}){
  assert.match(await ev('location.hostname'),/^127\.77\.\d+\.\d+$/);
  await seed(fx);
  const api=name=>`(await (await fetch('/aitp-atlas/api/${name}')).json())`;
  await wait(`(async()=>!!${api('overview?fresh=1')}.topics.gravity)()`,'synthetic topic indexed');
  await c.call('Page.reload',{ignoreCache:true});await click(q('button[aria-label="Atlas"]'),'Atlas sidebar after indexing fixture');
  await place('Desk');
  const text=(sel,t)=>q(sel,`el.textContent.trim()===${J(t)}`), btn=t=>text('button',t);
  const summary=t=>q('summary',`el.textContent.trim().startsWith(${J(t)})`);
  const field=label=>q('textarea,input',`el.ariaLabel===${J(label)} || Array.from(el.labels||[]).some(l=>l.textContent.trim()===${J(label)})`);
  const fill=async(expr,value,label)=>{await click(expr,label);await key('a','KeyA',2);await c.call('Input.insertText',{text:value});};
  const palettes=async target=>{const mode=`document.querySelector('.atlas-root').dataset.themeBase`;
    for(let i=0;i<4;i++){if(await ev(mode)===target)return;await click(q('button[aria-label="Atlas destinations"]'),'workspace menu');await click(q('[role="menuitem"]',`el.ariaLabel?.startsWith('Theme:')`),'cycle Atlas palette');}
    assert.equal(await ev(mode),target);
  };
  const resize=async(width,height)=>{await c.call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await wait(`innerWidth===${width} && innerHeight===${height}`,'actual viewport');};
  const stable=()=>ev('document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))');
  const shot=async(name,expr)=>{if(!capture)return;await stable();
    // Screen pixels of the actual visible app region, not a clone. Exclude native transcript
    // paths, usernames, browser chrome and launch credentials from published documentation.
    const clip=await ev(`(()=>{const e=(${expr}),r=e.getBoundingClientRect();let x=Math.max(0,r.left),y=Math.max(0,r.top),right=Math.min(innerWidth,r.right),bottom=Math.min(innerHeight,r.bottom);for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(/auto|scroll|clip|hidden/.test(s.overflowX)){x=Math.max(x,b.left);right=Math.min(right,b.right);}if(/auto|scroll|clip|hidden/.test(s.overflowY)){y=Math.max(y,b.top);bottom=Math.min(bottom,b.bottom);}}x=Math.ceil(x);y=Math.ceil(y);return {x,y,width:Math.floor(right)-x,height:Math.floor(bottom)-y,scale:1};})()`);
    assert.ok(clip.width>180 && clip.height>40,`empty capture region: ${name}`);
    shots.set(name,Buffer.from((await c.call('Page.captureScreenshot',{format:'png',clip,fromSurface:true,captureBeyondViewport:false})).data,'base64'));
  };
  const panel=q('[aria-label="Research inquiry"]'), inPanel=t=>`(${panel})?.innerText.includes(${J(t)})`;
  const noTeam=async label=>assert.equal(await ev(`(async()=>${api('teams')}.teams.length)()`),0,label);
  const assertLayout=async(expr,label)=>{await stable();const m=await ev(`(()=>{const e=(${expr}),r=e.getBoundingClientRect();return [document.documentElement.scrollWidth-innerWidth,e.scrollWidth-e.clientWidth,r.right-innerWidth,0-r.left,e.clientWidth]})()`);
    assert.ok(m.slice(0,4).every(n=>n<=2) && m[4]>160,`${label}: page/region overflow px [${m}]`);};
  await resize(1440,900);
  await click(q('button[aria-label^="Choose topic:"]'),'choose fixture topic');await click(q('.atlas-desk-choice',`el.textContent.includes(${J(title)})`),'fixture topic');
  await click(summary('Frame the inquiry'),'frame a Desk inquiry');
  // A synthetic, never-opened public URL exercises consent reset. Source text below is the only input sent.
  const fakePublic='https://chatgpt.com/share/00000000-0000-4000-8000-000000000001';
  await fill(field('Source link'),fakePublic,'typed public-format reference, never opened');const optIn=q('.atlas-iq-desk input[type="checkbox"]');await wait(`Boolean(${optIn})`,'explicit read consent');assert.equal(await ev(`(${optIn}).checked`),false);await click(optIn,'test opt-in reset after editing URL');
  await fill(field('Source link'),fakePublic.replace(/1$/,'2'),'replace synthetic URL');await wait(`(${optIn})?.checked===false`,'consent not inherited by new URL');
  for(const [label,value] of [['Long-term question',longQuestion],['Current question',currentQuestion],['Source link',source],['Source excerpt',excerpt],['Discussion question',opener]])await fill(field(label),value,label);
  await click(summary('Frame the inquiry'),'collapse optional context before sending');
  const desk=q('.atlas-desk');await palettes('night');await ev(`(${desk}).scrollIntoView({block:'start'})`);assert.doesNotMatch(await ev(`(${desk}).innerText`),/[A-Za-z]:[\\/]|\/Users\/|[?&]token=/);await shot('desk-night-1440',desk);
  const opening=model.replyNext(snapshot('Synthetic fixture. Start with the boundary conditions; looking at a radial solution is not a request to form a team.',{longQuestion,currentQuestion,edges}),opener);
  await click(q('[aria-label="Send discussion"]'),'begin discussion, not a team');
  const rec=await wait(`(async()=>${api('discussions')}.discussions.find(r=>r.question===${J(opener)}))()`,'real registered discussion',30000);
  assert.deepEqual([rec.context.inquiry.longQuestion,rec.context.inquiry.currentQuestion,rec.context.inquiry.sourceUrl,rec.context.inquiry.sourceExcerpt],[longQuestion,currentQuestion,source,excerpt]);
  assert.equal(rec.topic.id,topic);
  const body=`.atlas-tab-body[data-session-id=${J(rec.id)}] .atlas-companion-body`;
  const rendered=t=>`Boolean(${q(body,`el.innerText.includes(${J(t)})`)})`;
  await wait(rendered('Start with the boundary conditions;'),'fixture answer rendered as native assistant message',30000);
  assert.ok(opening());await wait(inPanel(currentQuestion),'current question from the real conversation');
  await click(summary('Branching routes'),'open route disclosure');await wait(inPanel('Bulk trapping'),'route graph not a list of fixes');
  assert.ok(await ev(inPanel('Mode lifetime')),'second branch rendered');
  assert.equal(await ev(`Boolean(${btn('Review team proposal…')})`),false,'radial trigger alone never projects a proposal');await noTeam('no team on opening turn');
  for(const mood of ['day','night']){
    await palettes(mood);for(const [w,h] of [[1440,900],[1024,768]]){await resize(w,h);await assertLayout(panel,`${mood}/${w} route`);
      if(w===1440)await ev(`(${panel}).querySelector('header').scrollIntoView({block:'start'})`);else await ev(`(${panel}).querySelector('details[aria-label="Branching routes"]').scrollIntoView({block:'end'})`);await shot(`routes-${mood}-${w}`,w===1440?panel:q('details[aria-label="Branching routes"]'));}
    const ratio=await ev(`(${ratioOf})(${btn('Edit questions')})`);assert.ok(ratio>=4.5,`${mood} Edit questions text contrast ${ratio}`);console.log(`${mood}: Edit questions computed text contrast ${ratio.toFixed(2)}:1`);
  }
  for(const width of [768,500]){await resize(width,900);await assertLayout(panel,`${width}px route`);const narrow=await ev(`(()=>{const p=(${panel});return {width:p.clientWidth,columns:getComputedStyle(p.querySelector('.atlas-iq-question-pair')).gridTemplateColumns.split(/\\s+/).length}})()`);console.log(`${width}px viewport: inquiry region`,narrow);assert.equal(narrow.columns,narrow.width<=520?1:2);}
  await resize(1440,900);
  await click(summary('Radial profile'),'inspect an individual route');const edge=q('.atlas-iq-edge[open]');
  await wait(`(${edge})?.innerText.includes('Same geometry and boundary conditions')`,'route assumptions');
  await click(q('button[aria-label='+J('Open evidence: '+pointer)+']'),'read cited workspace evidence');await wait(`Boolean(${q('[role="tabpanel"]',`el.innerText.includes('Invented samples for a schematic illustration; no solver was run.')`)})`,'real Markdown citation opened');
  await click(q('button[aria-label="Close comparison.md"]'),'close only the cited note');
  await click(btn('Edit questions'),'correct framing in this discussion');await fill(field('Current question'),revised,'user correction');
  const correction=model.replyNext(snapshot('Synthetic correction received. Match the boundary conditions and normalization first.',{longQuestion,currentQuestion:revised,edges}),revised);
  await click(btn('Save questions'),'save and send revised scope to lead');await wait(rendered('Synthetic correction received.'),'actual lead received correction',30000);assert.ok(correction());await wait(inPanel(revised),'corrected question projected');await wait(`(async()=>${api('discussions')}.discussions.find(r=>r.id===${J(rec.id)})?.inquiryFocus?.currentQuestion===${J(revised)})()`,'explicit correction persisted in this discussion only');
  const prompt=q(`${body} [contenteditable="true"],${body} textarea`);
  async function turn(request,reply,proof){const receipt=model.replyNext(reply,request);await click(prompt,'focus native DSH follow-up');await wait(`document.activeElement===(${prompt}) || (${prompt})?.contains(document.activeElement)`,'native composer received focus');await c.call('Input.insertText',{text:request});const drafted=await ev(`(()=>{const e=(${prompt});return [e?.outerHTML.slice(0,320),document.activeElement?.outerHTML.slice(0,320)]})()`);await wait(`((${prompt})?.value || (${prompt})?.innerText || '').includes(${J(request)})`,'native follow-up draft '+J(drafted));await click(q(`${body} button`, `['Send message','发送消息'].includes(el.ariaLabel)`),'send native follow-up');await wait(rendered(proof),'new assistant reply '+proof,40000);assert.ok(receipt());}
  await turn(later,snapshot('Synthetic proposal ready for your review.',planCard),'Synthetic proposal ready');
  const review=btn('Review team proposal…');await wait(`Boolean(${review})`,'bounded proposed charter, not execution');await noTeam('a proposal must not launch');
  const proposed=q('[data-kind="proposal"]');for(const mood of ['day','night']){await palettes(mood);await ev(`(${proposed}).scrollIntoView({block:'center'})`);await shot(`proposal-${mood}`,proposed);}
  await click(review,'review suggested branches');const sheet=q('.atlas-crew-sheet[role="dialog"]');
  const firstTask=field('First task for theorist');await wait(`(${firstTask})?.value===${J(proposal.seats[0].task)}`,'proposed branch task is editable');
  assert.equal(await ev(`(${field('First task for referee')}).value`),proposal.seats[1].task);
  await fill(firstTask,editedTask,'edit before approval');await click(summary('Brief the lead will receive'),'inspect exact would-be lead brief');
  await wait(`(${sheet})?.querySelector('pre')?.textContent.includes(${J(editedTask)})`,'edited branch task reached host-generated preview');await noTeam('editing or previewing cannot launch');
  await click(text('.atlas-crew-sheet button','Cancel'),'decline draft, no launch');await noTeam('declined draft did not start a team');
  const explain=model.replyNext(teaching,'Atlas · Explain this step');await click(btn('Explain first'),'teach instead of launching');await wait(rendered(teaching),'substantive teaching, native text-only model reply',30000);assert.ok(explain());await noTeam('teaching did not launch a team');
  const reconsider='Show the synthetic proposal again so I can approve a bounded charter.';
  await turn(reconsider,snapshot('Synthetic charter available again for explicit approval.',planCard),'Synthetic charter available again');
  await click(review,'review the new proposal');await fill(field('First task for theorist'),editedTask,'approve edited first task');await noTeam('only the final Start may launch');
  await click(text('.atlas-crew-sheet button','Start the team'),'explicitly start one bounded private team');
  const team=await wait(`(async()=>${api('teams')}.teams.find(t=>t.origin?.discussionId===${J(rec.id)} && t.startedAt && t.leadId))()`,'confirmed native lead and origin receipt',40000);
  assert.match(team.origin.proposalId,/^reply-\d+$/);assert.notEqual(team.leadId,rec.id);assert.equal(team.seats.find(s=>s.name==='theorist').task,editedTask);
  // Real DSH lead, real run, real file parser: the model is still text-only. These are
  // explicitly *authored samples*, not outputs of workers, solvers or an independent review.
  assert.equal(path.dirname(team.runDir),path.join(fx.root,topic,'runs'));assert.equal(await fs.realpath(team.runDir),team.runDir);
  const sources={
    'reports/01-fixture.md':'---\nkind: report\nid: R01\nseat: theorist\ntitle: Synthetic comparison inventory\nstatus: draft\nclaims:\n  - id: R01.1\n    text: The invented series share an index.\n    basis: cited\nassumptions: [Toy inputs]\nevidence: [gravity/data.csv]\nchecks: [Shared index]\nopen: [Physical calculation absent]\nimplication: No physical inference.\n---\n# Synthetic fixture report\n\nNo agent produced or checked these data.\n',
    'reviews/01-fixture.md':'---\nkind: review\nid: V01\nseat: referee\non: R01\nverdict: holds\nclaims: { R01.1: holds }\nfindings: []\n---\n# Synthetic review receipt\n\nAuthored UI fixture only, not a scientific endorsement.\n'
  };
  for(const [name,data] of Object.entries(sources))await fs.writeFile(path.join(team.runDir,name),data,{flag:'wx'});
  await wait(`Boolean(${q('.atlas-team-room')})`,'one native team launched');
  const sourceTab=q('[role="tab"]',`el.getAttribute('aria-controls')===document.querySelector(${J(`.atlas-tab-body[data-session-id=${J(rec.id)}]`)})?.id`);
  await click(sourceTab,'return to original discussion via tab');const inventory=q('[aria-label="Team evidence"]');
  await wait(`Boolean(${inventory})`,'linked evidence from just-confirmed team');await click(btn('Refresh files'),'discover authored fixture report and review');
  await wait(`Boolean(${q('[aria-label="Include R01"]')}) && Boolean(${q('[aria-label="Include V01"]')})`,'two parsed files from real run');
  const assess=model.replyNext(snapshot('Synthetic assessment of selected evidence, not a scientific validation.',resultCard),'Assess the selected team evidence');
  await click(btn('Ask this discussion to assess evidence'),'send selected provenance to source discussion');await wait(rendered('Synthetic assessment of selected evidence'),'origin session with actual lead assessment',40000);assert.ok(assess());await wait(inPanel(result.limits),'scoped result and uncertainty');
  await click(btn('Load comparison figure'),'read local fixture manifest and CSV');const svg=q('svg[role="img"][aria-label="Schematic comparison"]');await wait(`Boolean(${svg})`,'actual schematic from file, not computed evidence');
  const figure=q('[aria-label="Comparison figure"] figure');
  await resize(560,1160);for(const mood of ['day','night']){await palettes(mood);await ev(`(${figure}).scrollIntoView({block:'start'})`);await assertLayout(figure,`${mood} figure`);await shot(`schematic-${mood}`,figure);}
  await click(summary('Source and comparison conditions'),'audit the sampled rows and units');await wait(`(${figure}).innerText.includes('5 shared samples') && (${figure}).innerText.includes('No solver or physical parameters.')`,'chart caption and conditions from fixture manifest');
  const explainResult=model.replyNext('Synthetic teaching follow-up: the input grid has no units of radius or time; do not interpret the slope as a measured decay rate.','Atlas · Explain this step');
  await click(btn('Explain this step'),'explain the scoped result');await wait(rendered('do not interpret the slope'),'actual explanation of result',30000);assert.ok(explainResult());assert.equal(await ev(`(async()=>${api('teams')}.teams.length)()`),1,'teaching/assessment did not launch another team');
  console.log('PASS real private DSH turns, scope correction, branching routes, review/cancel/teach, explicit edited charter launch, source-linked fixture report/review assessment and schematic. Synthetic inputs only; no physics validation.');
});
if(capture){assert.equal(shots.size,9);const dir=new URL('../design/inquiry/screens/',import.meta.url);await fs.mkdir(dir,{recursive:true});for(const [name,png] of shots)await fs.writeFile(new URL(name+'.png',dir),png);console.log(`Saved ${shots.size} real private UI crops after all acceptance gates passed.`);}
