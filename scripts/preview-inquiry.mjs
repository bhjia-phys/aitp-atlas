// Manual, opt-in teaching fixture. Only authored local inputs and text replies;
// no browser automation, session seeding, tools, network clients or background jobs.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const title = 'Schwarzschild–AdS (schematic fixture)';
const topic = 'ads', note = 'ads/comparison.md', fig = 'ads/traces.atlas-figure.json';
const data = 'ads/traces.csv';
const horizon = 'Could a feature in the bulk produce an observable boundary echo?';
const focus = 'What can two radial profiles tell us before a boundary response is measured?';
const prompts = [
  'Teach me what a radial profile can tell us in the AdS fixture.',
  'Map the checks between the radial profiles and a boundary echo.',
  'Draft an editable team proposal for the AdS comparison.',
  'Show the result from the prepared AdS traces, without running a solver.',
];
const steps = [
  { from:'Compare two profiles', to:'Check the shared grid and normalization', status:'supported',
    assumptions:['Only the prepared toy traces are being compared.'], evidence:[`${note}#L3`, data] },
  { from:'Compare two profiles', to:'Test for a long-lived bulk mode', status:'open',
    assumptions:['Would need actual radial solutions with stated horizon and outer boundary conditions.'], evidence:[] },
  { from:'A long-lived bulk mode', to:'Look for a delayed boundary signal', status:'conditional',
    assumptions:['The chosen source must excite the mode and the boundary observable must couple to it.'], evidence:[] },
];
const card = extra => '\n\n```atlas-inquiry\n' + JSON.stringify({ longQuestion:horizon, currentQuestion:focus, edges:steps, ...extra }) + '\n```';
const replies = [
  'Synthetic AdS teaching example. A radial profile tells you how the field varies with position at a specified time or frequency. A boundary echo asks something else: after a pulse, does a chosen boundary observable respond again at a later time? A peak on a spatial slice gives no arrival time. Even its height changes if you multiply the field by a constant. Before comparing profiles, fix the normalization and the boundary conditions; before claiming an echo, specify the source, readout and time dependence. The two prepared traces are drawings, not solutions of the radial equation.',
  'Synthetic AdS route. First compare like with like: the fixture traces share sample indices and start at one. A separate question is whether a solution is long-lived; neither toy profile supplies a decay time. Even a long-lived mode need not give a visible echo in a particular readout.' + card({}),
  'Synthetic proposal for review, not a launch. One seat can inventory what the traces actually show while another checks which assumptions a physical interpretation would add.' + card({ proposal:{
    goal:'Separate a visible toy-profile difference from an untested boundary-echo prediction.',
    firstTask:'Check the common index and normalization against the supplied table.',
    doneWhen:'The draft names one check supported by the table and one boundary observable it cannot establish.',
    conventions:'Use dimensionless fixture samples, not radius or time measurements.',
    stopWhen:'Stop before running a solver or submitting any job.',
    seats:[{name:'reader',role:'numerics',task:'Compare the two prepared columns at sample index 2.'},
      {name:'referee',role:'referee',task:'Identify the missing measurement needed to claim a boundary echo.'}], evidence:[note, data],
  } }),
  'Prepared schematic result only. At sample index 2 the toy amplitudes are 0.45 and 0.62. These are entries in the fixture table, not measurements, new calculations or team output.' + card({ result:{
    claim:'At sample index 2, trace B is above trace A (0.62 versus 0.45).',
    limits:'The index is neither radius nor time. Invented samples cannot establish trapping, a mode lifetime or a boundary echo.',
    evidence:[`${note}#L3`, data],
  }, figure:{source:fig} }),
];

// Called before DSH starts so its first workspace scan already includes the demo.
export async function seedInquiryFixture({base,root}) {
  if (path.dirname(base) !== os.tmpdir() || !/^atlas-fixture-[a-z0-9]+$/i.test(path.basename(base)) ||
      root !== path.join(base,'topics') || await fs.realpath(root) !== path.join(await fs.realpath(os.tmpdir()),path.basename(base),'topics')) {
    throw Error('AdS demo requires a fresh Atlas fixture');
  }
  const folder = path.join(root,topic);
  await fs.mkdir(folder); // exclusive: do not follow/overwrite an existing topic
  const files = {
    'research.md':`# ${title}\n\n${horizon} This teaching example contains [two invented traces](comparison.md), not a calculation.\n`,
    'comparison.md':'# Comparison notebook — synthetic AdS fixture\n\nBoth traces use the same dimensionless sample index and start at one. At index 2, A = 0.45 and B = 0.62.\n\n[Prepared samples](traces.csv) are invented for display. No solver, physical measurement or team was involved.\n',
    'traces.csv':'Sample index,Trace A,Trace B\n0,1,1\n1,0.70,0.92\n2,0.45,0.62\n3,0.31,0.36\n4,0.20,0.22\n',
    'traces.atlas-figure.json':JSON.stringify({kind:'schematic',data,report:note,xLabel:'Sample index',xUnit:'1',yLabel:'Toy amplitude',yUnit:'1',
      commonParameters:'Same dimensionless sample indices; no physical parameters or solver.',normalization:'Both invented traces start at one.'}),
  };
  for (const [file,text] of Object.entries(files)) await fs.writeFile(path.join(folder,file),text,{flag:'wx'});
}

export function prepareInquiryDemo(model) {
  // Arm exactly one text response at a time. Only the previous native-turn marker
  // receipt unlocks the next one. Pending promises own no timers or open handles.
  const arm = i => {
    const receipt = model.replyNext(replies[i],prompts[i]);
    if (i+1 < replies.length) receipt.matched.then(() => arm(i+1));
  };
  arm(0);
  return `Schwarzschild–AdS inquiry · synthetic teaching fixture, not a calculation.
Atlas → Desk → Discuss. Choose “${title}” and keep DSH default.
Optional: expand Frame the inquiry. Long-term question: ${horizon}
Current question: ${focus}
Send these four prompts exactly, in order, in the SAME discussion. Wait for each reply.
  1 (Desk, teaching): ${prompts[0]}
  2 (follow-up): ${prompts[1]}
     Open Branching routes. Expand a step to see its assumptions and cited files.
  3 (follow-up): ${prompts[2]}
     Open Review team proposal…, edit a first task, and inspect Brief the lead will receive.
     Choose Cancel; do NOT start the team. No team is required for this example.
  4 (follow-up): ${prompts[3]}
     Load comparison figure to see the prepared schematic. Inspect its data and limits.
Only those prompts advance the script. Nothing is dispatched; restart the preview to replay.`;
}
