import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTeamArtifact, parseTeamCharter, parseTeamState } from '../lib/team-artifacts.js';
const templates=readFileSync(new URL('../design/1.0/team-templates/roles/README.md',import.meta.url),'utf8');
const examples=Array.from(templates.matchAll(/```yaml\n([\s\S]+?)\n```/g),m=>m[1]+'\n# An artifact\n');
const flow=new Function(readFileSync(new URL('../client/67-team-flow.js',import.meta.url),'utf8')+'\nreturn {teamFlowRows,teamBoardGroups};')();
const file=(path,mtimeMs=100)=>({path,mtimeMs});
const parse=(kind,text,path)=>parseTeamArtifact(kind,text,file(path));
const report=(m={})=>({...parse('report',examples[0],'reports/03.md'),...m});
const review=(m={})=>({...parse('review',examples[1],'reviews/02.md'),...m});

test('parses the three canonical examples, preserving paths, real nested claims and actual findings',()=>{
  const r=report(),v=review(),d=parse('decision',examples[2],'decisions/D01.md');
  for(const a of [r,v,d])assert.equal(a.formatted,true,a.issue);assert.equal(r.mtimeMs,100);
  assert.equal(r.task,'task-4');assert.deepEqual(r.claims,[{id:'R03.1',text:'One checkable statement.',basis:'derived'}]);assert.equal(r.evidence[0],'work/theorist/file.md#where');
  assert.equal(v.claims['R03.1'],'holds');assert.equal(v.verdict,'holds');assert.equal(v.findings[0].where,'R03, eq. (7)');
  assert.deepEqual(d.options,{A:'First option, with its consequence (an exact command if it is a job).',B:'Second option.'});assert.equal(d.recommendation,'B');assert.equal(d.status,'open');assert.equal(d.answerText,null);
  const response=parse('decision',examples[2].replace('status: open','status: answered')+'\n## Answer (2026-11-18, researcher)\n\nB. Use the small cluster.','D01');assert.equal(response.answerText,'B. Use the small cluster.');
});

test('rejects unsupported YAML, contradictory identity or options; visible fallback never supplies action fields',()=>{
  for(const text of [examples[0].replace('status: submitted','status: accepted\nstatus: submitted'),examples[0].replace('kind: report','kind: review'),examples[0].replace('seat: theorist','seat: &id theorist'),examples[0].replace('seat: theorist','seat: !!str theorist'),examples[0].replace('seat: theorist','seat: theorist\nconstructor: bad'),examples[0].replace('seat: theorist','seat: theorist\nunknown: |\n  text'),examples[0].replace('seat: theorist','seat: *pointer'),examples[0].replace('status: submitted','status: looks-good'),examples[0].replace('id: R03.1','id: R04.1'),examples[0].replace('assumptions: [','assumptions: [['),examples[0].replace('title: One line saying what was found','title: '+ 'a'.repeat(5000)),examples[0].replace('seat: theorist','seat: theorist\n'+'# x\n'.repeat(700)),examples[0].replace('seat: theorist','seat: theorist\n__proto__: {}'), '# Unformatted note\n' + 'x'.repeat(300000)]) {
    const a=parse('report',text,'reports/R99.md'); assert.equal(a.formatted,false,JSON.stringify(a));assert.equal(a.id,null);assert.equal(a.path,'reports/R99.md');assert.ok(a.title);assert.ok(a.issue);assert.equal(a.status,undefined);
  }
  for(const bad of [examples[2].replace('recommendation: B','recommendation: Z'), examples[2].replace('  B: Second option.','  A: duplicate'),examples[2].replace('id: D01','id: R01')])assert.equal(parse('decision',bad,'D01').formatted,false);
  const quoted=parse('report',examples[0].replace('title: One line saying what was found',`title: "A: q # 0" # ignored`).replace('assumptions: [each assumption the claims need]',`assumptions: ['ladder, static', "T: 0", Ward's limit]`),'R03');assert.equal(quoted.title,'A: q # 0');assert.deepEqual(quoted.assumptions,['ladder, static','T: 0',"Ward's limit"]);
});

test('an unfinished review has a real target but no verdict; a missing front matter never invents target or verdict',()=>{
  const v=parse('review',examples[1].replace(/^verdict:.*\n/m,''),'reviews/02-review-on-R03.md');assert.equal(v.formatted,true,v.issue);assert.equal(v.on,'R03');assert.equal(v.verdict,null);assert.equal(v.incomplete,true);
  const bad=parse('review','# Half a review\nI could not check this.',v.path);assert.equal(bad.title,'Half a review');assert.equal(bad.verdict,undefined);assert.equal(bad.on,undefined);
});

test('charter sections and logbook references come from actual Markdown outside examples',()=>{
  const charter=readFileSync(new URL('../design/1.0/team-templates/charter.md',import.meta.url),'utf8').replaceAll('{{teamName}}','Ward').replaceAll('{{date}}','2026-11-18').replaceAll('{{topicPath}}','/fixture/ward/research.md').replaceAll('{{goal}}','Check signs.').replaceAll('{{doneWhen}}','Limit checked.');
  const c=parseTeamCharter(charter,file('/fixture/run/charter.md'));assert.equal(c.formatted,true,c.issue);assert.equal(c.goal,'Check signs.');assert.equal(c.doneWhen,'Limit checked.');
  const state=parseTeamState('# Log\n## Established\n- Bound [R03](reports/03.md), V02\n  at zero.\n## Open\n- Timing\n```md\n## Next\nV99 is fictional\n```\n## Conflicts\n- Two signs (R04)\n## Next\n- Recheck V02.\n',file('/fixture/run/state.md'));
  assert.deepEqual(state.sections.Established,[{text:'Bound [R03](reports/03.md), V02 at zero.',refs:[{kind:'report',id:'R03'},{kind:'review',id:'V02'}]}]);assert.deepEqual(state.sections.Open,[{text:'Timing',refs:[]}]);assert.equal(state.sections.Next.length,1);
});

test('Flow uses explicit task/report/review links; distinguishes pending reviews, taskless work and unattributed note changes',()=>{
  const tasks=[{id:'task-4',subject:'Check',status:'in_progress'},{id:'task-2',subject:'Review R03: sign',owner:'referee',status:'pending',blockedBy:['task-4']},{id:'task-3',subject:'Read discussion of R03',owner:'referee',status:'completed'},{id:'task-7',subject:'Another',status:'pending',blockedBy:['task-3']}];
  const r=report(), loose=report({id:'R04',task:null,path:'reports/04.md'}), incompleteReview=review({verdict:null,incomplete:true});
  const artifacts={reports:[r,loose],reviews:[incompleteReview]},rows=flow.teamFlowRows(tasks,artifacts,[{session:'lead',edits:2}]);assert.equal(rows.length,4);
  const main=rows.find(x=>x.report===r);assert.deepEqual(main.reviewTasks,[tasks[1]]);assert.deepEqual(main.reviews,[incompleteReview]);assert.equal(main.reviews[0].verdict,null);assert.equal(main.integrated,false);assert.equal(main.leadRouting,false);assert.deepEqual(main.noteRefs,[]);
  const independent=rows.find(x=>x.report===loose);assert.equal(independent.task,null);assert.equal(independent.label,'(no task)');assert.equal(independent.leadRouting,true);
  const board=flow.teamBoardGroups(tasks);assert.deepEqual(board,{ready:[tasks[3]],blocked:[tasks[1]],inProgress:[tasks[0]],done:[tasks[2]]});
  r.status='accepted';const note={reportId:'R03',editId:'stable-edit',path:'/fixture/own/research.md'};
  const accepted=flow.teamFlowRows(tasks,artifacts,[{session:'lead',edits:2},note,{reportId:'R03',path:'no-edit-id'},{...note,reportId:'R44'}]).find(x=>x.report===r);assert.equal(accepted.integrated,true);assert.deepEqual(accepted.noteRefs,[note]);
  const ambiguous=flow.teamFlowRows(tasks,{reports:[r,report({path:'reports/other.md'})],reviews:[incompleteReview]},[note]).find(x=>x.report===r);assert.equal(ambiguous.ambiguous,true);assert.deepEqual(ambiguous.noteRefs,[]);assert.deepEqual(ambiguous.reviews,[]);
  const orphan=flow.teamFlowRows([],{reports:[report({task:'task-999'})]})[0];assert.equal(orphan.task,null);assert.equal(orphan.label,'Unknown task: task-999');
});
