// The Desk owns its seed; a discussion owns a projected, read-only inquiry.
// All mutations/navigation are explicit callbacks. Key a discussion by session ID
// so an unsaved correction never follows navigation into a different conversation.
const INQUIRY_FIELDS = {
  longQuestion: { label: 'Long-term question', hint: 'What do you ultimately want to understand?', limit: 4000 },
  currentQuestion: { label: 'Current question', hint: 'Which part can this discussion settle?', limit: 4000 },
  sourceUrl: { label: 'Source link', hint: 'https://…', limit: 2048 },
  sourceExcerpt: { label: 'Source excerpt', hint: 'Paste the passage you want to discuss.', limit: 6000 },
};

// A source URL comes from researcher input. Never turn another URL scheme or
// a string containing credentials into a clickable external destination.
function inquirySourceLink(raw) {
  if (!raw) return null;
  try { return new URL(normalizeInquirySeed({ sourceUrl: raw }).sourceUrl); }
  catch { return null; }
}

function InquiryField({ name, value, onChange, disabled, focusRef, required = false }) {
  const { label, hint, limit } = INQUIRY_FIELDS[name];
  const id = React.useId(), link = name === 'sourceUrl';
  const invalid = link && !!value?.trim() && !inquirySourceLink(value.trim());
  return h('div', { className: 'atlas-iq-field' }, h('label', { htmlFor: id }, label),
    h(link ? 'input' : 'textarea', { id, ref: focusRef, type: link ? 'url' : undefined, rows: link ? undefined : 2,
      maxLength: limit, value: value || '', placeholder: hint, disabled, required, spellCheck: !link,
      'aria-invalid': invalid || undefined, 'aria-describedby': invalid ? id + '-hint' : undefined,
      onChange: e => onChange({ [name]: e.target.value }) }),
    invalid && h('small', { id: id + '-hint', className: 'atlas-iq-warning' }, 'Use a full http:// or https:// link without credentials.'));
}

function InquiryDesk({ inquiry, onChange, disabled }) {
  const summary = inquiry.currentQuestion?.trim() || inquiry.longQuestion?.trim();
  const canRead = !!inquiryPublicShareUrl(inquiry.sourceUrl);
  const helpId = React.useId();
  // Consent belongs to the exact link, not to the field or the next URL.
  const change = patch => onChange(Object.hasOwn(patch, 'sourceUrl') ? { ...patch, readPublicSource: false } : patch);
  return h('section', { className: 'atlas-iq atlas-iq-desk', 'aria-label': 'Research inquiry' },
    h('details', { className: 'atlas-iq-frame' },
      h('summary', null, h(Icon, { name: 'branch' }), h('strong', null, 'Frame the inquiry'),
        h('span', { className: 'atlas-iq-preview' }, summary || 'Connect the next step to a longer question.'), h(Icon, { name: 'chevron' })),
      h('div', { className: 'atlas-iq-edit' }, h('p', { className: 'atlas-iq-caption' }, 'Optional context for the discussion. Pasting a link does not open or read it.'),
        h('div', { className: 'atlas-iq-grid' }, Object.keys(INQUIRY_FIELDS).map(name => h(InquiryField, {
          key: name, name, value: inquiry[name], disabled: disabled || !onChange, onChange: change,
        }))),
        canRead && h('div', { className: 'atlas-iq-optin' }, h('label', null,
          h('input', { type: 'checkbox', checked: inquiry.readPublicSource === true, disabled: disabled || !onChange,
            'aria-describedby': helpId, onChange: e => change({ readPublicSource: e.target.checked }) }), 'Ask the lead to read this public shared chat'),
          h('p', { id: helpId, className: 'atlas-iq-caption' }, 'When you start the discussion, the lead can try this link without signing in. If the chat is unavailable, paste the relevant passage in Source excerpt.')))));
}

// Persist failures in context. A ref prevents double submission during the
// same frame, before React has committed the pending UI.
function useInquiryAction() {
  const latch = useRef(false), [pending, setPending] = useState(''), [error, setError] = useState('');
  async function run(key, fn) {
    if (latch.current || !fn) return false;
    latch.current = true; setPending(key); setError('');
    try { await fn(); return true; }
    catch (e) { setError(e?.message || 'The action could not be completed. Please try again.'); return false; }
    finally { latch.current = false; setPending(''); }
  }
  return { pending, error, run, clear: () => setError('') };
}

function InquiryQuestions({ inquiry, provenance, onSave, disabled }) {
  const [draft, setDraft] = useState(null), action = useInquiryAction();
  const first = useRef(null), trigger = useRef(null), restoreFocus = useRef(false);
  const editing = draft !== null;
  useLayoutEffect(() => {
    if (editing) first.current?.focus();
    else if (restoreFocus.current) { trigger.current?.focus(); restoreFocus.current = false; }
  }, [editing]);
  const close = () => { restoreFocus.current = true; setDraft(null); action.clear(); };
  const values = { longQuestion: inquiry.longQuestion || '', currentQuestion: inquiry.currentQuestion || '' };
  const corrected = draft && { longQuestion: draft.longQuestion.trim(), currentQuestion: draft.currentQuestion.trim() };
  const changed = corrected && (corrected.longQuestion !== values.longQuestion.trim() || corrected.currentQuestion !== values.currentQuestion.trim());
  const saving = Boolean(action.pending);
  const byline = { seed: 'Your starting frame', lead: 'Lead’s framing', correction: 'Your correction', prior: 'Last mapped route' }[provenance];
  const save = async () => {
    if (changed && corrected.currentQuestion && !disabled && await action.run('save', () => {
      const { longQuestion, currentQuestion } = normalizeInquirySeed(corrected);
      return onSave({ longQuestion, currentQuestion });
    })) close();
  };
  return h(React.Fragment, null,
    h('header', { className: 'atlas-iq-head' }, h('h2', null, h(Icon, { name: 'branch' }), 'Research inquiry'),
      byline && h('span', { className: 'atlas-iq-caption atlas-iq-byline' }, byline), !editing && onSave && h(Button, { buttonRef: trigger, small: true, quiet: true, icon: 'edit', disabled, onClick: () => { action.clear(); setDraft(values); } }, 'Edit questions')),
    editing ? h('div', { className: 'atlas-iq-edit', 'aria-busy': saving },
      h('div', { className: 'atlas-iq-grid' }, ['longQuestion', 'currentQuestion'].map((name, i) => h(InquiryField, { key: name, name, focusRef: i ? undefined : first,
        value: draft[name], required: name === 'currentQuestion', disabled: disabled || saving, onChange: patch => setDraft(prev => ({ ...prev, ...patch })) }))),
      h('p', { className: 'atlas-iq-caption' }, corrected.currentQuestion ? 'Saving sends these questions to the discussion as a correction.' : 'Enter a current question to send a correction.'),
      action.error && h('p', { role: 'alert', className: 'atlas-iq-warning' }, action.error),
      h('div', { className: 'atlas-iq-actions' }, h(Button, { primary: true, small: true, disabled: disabled || saving || !changed || !corrected.currentQuestion, onClick: save }, saving ? 'Saving…' : 'Save questions'),
        h(Button, { quiet: true, small: true, disabled: saving, onClick: close }, 'Cancel')))
      : h('dl', { className: 'atlas-iq-question-pair' }, ['longQuestion', 'currentQuestion'].map(name => h('div', { key: name },
        h('dt', { className: 'atlas-iq-label' }, INQUIRY_FIELDS[name].label), h('dd', null, values[name] || h('span', { className: 'atlas-iq-caption' }, 'Not specified'))))));
}

function InquirySource({ sourceUrl, sourceExcerpt }) {
  if (!sourceUrl && !sourceExcerpt) return null;
  const url = inquirySourceLink(sourceUrl);
  return h('details', { className: 'atlas-iq-fold atlas-iq-source' },
    h('summary', null, h(Icon, { name: 'attach' }), 'Source', h('span', { className: 'atlas-iq-preview' }, url?.hostname || (sourceExcerpt ? 'Researcher’s excerpt' : 'Researcher’s link')), h(Icon, { name: 'chevron' })),
    h('div', { className: 'atlas-iq-fold-body' }, sourceExcerpt && h('blockquote', null, sourceExcerpt),
      sourceUrl && (url ? h('a', { href: url.href, target: '_blank', rel: 'noopener noreferrer', referrerPolicy: 'no-referrer' },
        sourceUrl, h(Icon, { name: 'external', size: 13, title: 'Opens in a new tab' })) : h('p', { className: 'atlas-iq-caption' }, sourceUrl))));
}

function InquiryEvidence({ evidence, onOpenEvidence }) {
  const action = useInquiryAction();
  if (!evidence?.length) return h('p', { className: 'atlas-iq-caption' }, 'No evidence cited.');
  return h(React.Fragment, null, h('ul', { className: 'atlas-iq-pointers', 'aria-label': 'Evidence cited by the lead' }, evidence.map((pointer, i) => h('li', { key: i },
    onOpenEvidence ? h('button', { type: 'button', className: 'atlas-iq-pointer', 'aria-label': 'Open evidence: ' + pointer,
      disabled: !!action.pending, onClick: () => action.run(pointer, () => onOpenEvidence(pointer)) },
      h(Icon, { name: 'note', size: 14 }), h('code', null, pointer)) : h('code', null, pointer)))),
    action.error && h('p', { role: 'alert', className: 'atlas-iq-warning' }, action.error));
}

// Group siblings by their source, not by index or by status. No traversal is
// needed: converging routes and cycles stay faithful to the lead's edge list.
function inquiryBranches(edges) {
  const groups = new Map();
  for (const edge of edges || []) {
    if (!groups.has(edge.from)) groups.set(edge.from, []);
    groups.get(edge.from).push(edge);
  }
  return Array.from(groups);
}

function InquiryBranchStep({ edge, onOpenEvidence }) {
  return h('li', null, h('details', { className: 'atlas-iq-edge' },
    h('summary', null, h('span', { className: 'atlas-iq-target' }, edge.to),
      h('span', { className: 'atlas-iq-status', 'data-status': edge.status }, edge.status), h(Icon, { name: 'chevron', size: 14 })),
    h('div', { className: 'atlas-iq-edge-body' }, h('h4', { className: 'atlas-iq-label' }, 'Assumptions'),
      edge.assumptions?.length ? h('ul', null, edge.assumptions.map((s, j) => h('li', { key: j }, s))) : h('p', { className: 'atlas-iq-caption' }, 'None stated.'),
      h('h4', { className: 'atlas-iq-label' }, 'Evidence'), h(InquiryEvidence, { evidence: edge.evidence, onOpenEvidence }))));
}

function InquiryEdges({ edges, onOpenEvidence, previous = false }) {
  if (!edges?.length) return null;
  return h('details', { className: 'atlas-iq-fold', 'aria-label': 'Branching routes' },
    h('summary', null, h(Icon, { name: 'topics' }), 'Branching routes', h('span', { className: 'atlas-iq-count' }, edges.length), h(Icon, { name: 'chevron' })),
    h('div', { className: 'atlas-iq-fold-body' }, h('p', { className: 'atlas-iq-caption' }, previous
      ? 'From an earlier lead reply. The latest reply did not update this map or recheck its evidence.'
      : 'Statuses and evidence are reported by the lead. Expand a step to inspect its assumptions.'),
      inquiryBranches(edges).map(([from, branches]) => h('div', { key: from, className: 'atlas-iq-branch' },
        h('p', { className: 'atlas-iq-origin' }, h('span', { className: 'atlas-iq-label' }, 'From'), ' ', from),
        h('ul', { className: 'atlas-iq-edges', 'aria-label': 'Routes from ' + from },
          branches.map((edge, i) => h(InquiryBranchStep, { key: edge.to + ':' + i, edge, onOpenEvidence })))))));
}

function InquiryCard({ kind, item, onProposal, onTeach, onOpenEvidence, disabled }) {
  const action = useInquiryAction(), titleId = React.useId();
  const proposal = kind === 'proposal', busy = !!action.pending;
  const actionButton = (label, call, primary, icon) => call && h(Button, { small: true, primary, icon, disabled: disabled || busy,
    onClick: () => action.run(label, call) }, action.pending === label ? 'Working…' : label);
  return h('article', { className: 'atlas-iq-card', 'data-kind': kind, 'aria-labelledby': titleId, 'aria-busy': busy },
    h('h3', { id: titleId, className: 'atlas-iq-label' }, h(Icon, { name: proposal ? 'team' : 'report', size: 15 }), proposal ? 'Proposed team' : 'Lead-reported result'),
    h('p', { className: 'atlas-iq-claim' }, proposal ? item.goal : item.claim),
    proposal && item.firstTask && h('p', { className: 'atlas-iq-detail' }, h('strong', null, 'First task: '), item.firstTask),
    !proposal && item.limits && h('p', { className: 'atlas-iq-detail' }, h('strong', null, 'Limits: '), item.limits),
    h('details', { className: 'atlas-iq-card-more' }, h('summary', null, proposal ? 'Charter and evidence' : 'Cited evidence', h(Icon, { name: 'chevron', size: 14 })),
      proposal && h('dl', { className: 'atlas-iq-charter' }, [['doneWhen','Done when'],['conventions','Conventions'],['stopWhen','Stop when']].map(([key, label]) => item[key] && h('div', { key }, h('dt', null, label), h('dd', null, item[key])))),
      proposal && item.seats?.length > 0 && h('ul', { className: 'atlas-iq-seats', 'aria-label': 'Proposed seats' }, item.seats.map((seat, i) => h('li', { key: i }, h('strong', null, seat.name), ' · ', seat.role, seat.task && h('div', null, seat.task)))),
      h(InquiryEvidence, { evidence: item.evidence, onOpenEvidence, disabled })),
    (onTeach || proposal && onProposal) && h('div', { className: 'atlas-iq-actions' },
      proposal && actionButton('Review team proposal…', onProposal && (() => onProposal(item)), true, 'team'),
      actionButton(proposal ? 'Explain first' : 'Explain this step', onTeach && (() => onTeach(kind, item)), false, 'learn')),
    action.error && h('p', { role: 'alert', className: 'atlas-iq-warning' }, action.error));
}

/** Shared view API: use mode='desk' with controlled onChange(partialSeed).
 * A discussion accepts onSave(questions), onOpenEvidence(relativePointer),
 * onProposal(proposal) and onTeach('proposal'|'result', payload). Async actions
 * must reject on failure. No inquiry -> no inferred discussion record. */
function InquiryStrip({ mode = 'discussion', inquiry, provenance, onChange, onSave, onOpenEvidence, onProposal, onTeach, disabled = false }) {
  if (mode === 'desk') return h(InquiryDesk, { inquiry: inquiry || {}, onChange, disabled });
  if (!inquiry) return null;
  const shared = { onOpenEvidence, disabled };
  return h('section', { className: 'atlas-iq atlas-iq-discussion', 'aria-label': 'Research inquiry', tabIndex: 0 },
    h(InquiryQuestions, { inquiry, provenance: inquiry.previous && provenance !== 'correction' ? 'prior' : provenance, onSave, disabled }), h(InquirySource, { sourceUrl: inquiry.sourceUrl, sourceExcerpt: inquiry.sourceExcerpt }),
    h(InquiryEdges, { edges: inquiry.edges, previous: !!inquiry.previous, ...shared }),
    !inquiry.previous && inquiry.proposal && h(InquiryCard, { kind: 'proposal', item: inquiry.proposal, onProposal, onTeach, ...shared }),
    !inquiry.previous && inquiry.result && h(InquiryCard, { kind: 'result', item: inquiry.result, onTeach, ...shared }));
}

// Include once in injectStyles() with the other surface styles.
const ATLAS_INQUIRY_CSS = `
.atlas-iq { box-sizing:border-box; min-width:0; overflow-wrap:anywhere; color:var(--text-1); font:var(--t-body); container:inquiry / inline-size; }
.atlas-iq * { box-sizing:border-box; }
.atlas-iq :is(p,dl,dd,dt,ul,blockquote,h2,h3,h4) { margin:0; }
.atlas-iq summary { display:flex; align-items:center; gap:var(--s-8); min-height:var(--control-32); padding:var(--s-4) var(--s-8); cursor:pointer; list-style:none; font:var(--t-ui); }
.atlas-iq summary::-webkit-details-marker { display:none; }
.atlas-iq summary > .atlas-icon { flex:none; color:var(--text-3); }
.atlas-iq summary > .atlas-icon:last-child { margin-inline-start:auto; transform:rotate(-90deg); }
.atlas-iq details[open] > summary > .atlas-icon:last-child { transform:none; }
.atlas-iq summary:hover,.atlas-iq-pointer:hover { background:var(--hover); }
.atlas-iq :is(summary,button,a,input,textarea):focus-visible,.atlas-iq:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }
.atlas-iq-label,.atlas-iq-head h2 { font:var(--t-cap); font-variant-caps:var(--cap-variant); letter-spacing:var(--cap-tracking); color:var(--text-2); }
.atlas-iq-caption,.atlas-iq-preview { color:var(--text-3); font:var(--t-meta); }
.atlas-iq-preview { min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.atlas-iq-warning { color:var(--danger-text); font:var(--t-meta); }
.atlas-iq-desk { max-width:720px; margin:var(--s-12) auto; }
.atlas-iq-frame { background:var(--surface); border:1px solid var(--border-strong); border-radius:var(--r-md); }
.atlas-iq-frame > summary { padding:var(--s-8) var(--s-12); border-radius:inherit; }
.atlas-iq-frame > summary > strong { flex:none; font:var(--t-h3); }
.atlas-iq-frame > summary > .atlas-icon:first-child,.atlas-iq-head .atlas-icon { color:var(--accent); }
.atlas-iq-edit { display:grid; gap:var(--s-12); }
.atlas-iq-frame .atlas-iq-edit { padding:var(--s-8) var(--s-12) var(--s-16); }
.atlas-iq-grid,.atlas-iq-question-pair { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--s-12); }
.atlas-iq-field { display:grid; align-content:start; gap:var(--s-4); min-width:0; }
.atlas-iq-field label,.atlas-iq-charter dt { color:var(--text-2); font:var(--t-ui); font-weight:600; }
.atlas-iq-field :is(input,textarea) { min-width:0; width:100%; min-height:var(--control-32); padding:var(--s-8); border:1px solid var(--border-control); border-radius:var(--r-sm); color:var(--text-1); background:var(--raised); font:var(--t-body); }
.atlas-iq-field textarea { resize:vertical; }
.atlas-iq-optin { padding-block-start:var(--s-8); border-block-start:1px solid var(--border); }
.atlas-iq-optin label { display:flex; align-items:center; gap:var(--s-8); min-height:var(--control-28); font:var(--t-ui); cursor:pointer; }
.atlas-iq-optin input { flex:none; accent-color:var(--accent); }
.atlas-iq-optin p { margin-block-start:var(--s-4); }
.atlas-iq-field :is(input,textarea)::placeholder { color:var(--text-3); }
.atlas-iq-field [aria-invalid=true] { border-color:var(--danger-text); }
.atlas-iq-discussion { flex:0 1 auto; max-height:36vh; max-height:36dvh; overflow:auto; overscroll-behavior:contain; scrollbar-gutter:stable; padding:var(--s-8) var(--s-12); border-block-end:1px solid var(--border-strong); background:var(--surface); }
.atlas-inquiry-disc-wrap > .atlas-iq-discussion { max-height:none; overflow:visible; scrollbar-gutter:auto; }
.atlas-iq-byline { margin-inline-end:auto; }
.atlas-iq-head,.atlas-iq-head h2,.atlas-iq-card h3,.atlas-iq-actions { display:flex; align-items:center; flex-wrap:wrap; gap:var(--s-8); }
.atlas-iq-head { justify-content:space-between; margin-bottom:var(--s-8); }
.atlas-iq-question-pair,.atlas-iq-discussion > .atlas-iq-edit { padding-block-end:var(--s-8); }
.atlas-iq-question-pair > div { padding-inline-start:var(--s-8); border-inline-start:2px solid var(--border-strong); min-width:0; }
.atlas-iq-question-pair > div:last-child { border-color:var(--accent); }
.atlas-iq-question-pair dd { margin-block-start:var(--s-4); white-space:pre-line; font:var(--t-h3); }
.atlas-iq-fold { border-block-start:1px solid var(--border); }
.atlas-iq-count { font:var(--t-count); color:var(--text-2); }
.atlas-iq-fold-body,.atlas-iq-edge-body { display:grid; gap:var(--s-8); padding:var(--s-8); }
.atlas-iq-source blockquote { border-inline-start:2px solid var(--border-control); padding-inline-start:var(--s-12); color:var(--text-2); font:var(--t-read-compact); white-space:pre-wrap; }
.atlas-iq-source a { color:var(--accent); font:var(--t-ui); }
.atlas-iq-source a svg { margin-inline-start:var(--s-4); }
.atlas-iq-origin { font:var(--t-h3); }
.atlas-iq-origin .atlas-iq-label { margin-inline-end:var(--s-4); }
.atlas-iq .atlas-iq-edges { list-style:none; padding-inline-start:var(--s-16); margin-block:var(--s-4); }
.atlas-iq-edges > li { position:relative; padding-inline-start:var(--s-12); border-inline-start:1px solid var(--border-control); }
.atlas-iq-edges > li::before { content:''; position:absolute; inset-block-start:var(--s-16); inset-inline-start:0; width:var(--s-12); border-block-start:1px solid var(--border-control); }
.atlas-iq-edge summary { flex-wrap:wrap; border-radius:var(--r-sm); }
.atlas-iq-target { flex:1 1 14ch; }
.atlas-iq-status { border:1px solid var(--border-strong); border-radius:var(--r-full); padding:0 var(--s-8); color:var(--text-2); font:var(--t-meta); }
.atlas-iq-status[data-status=conditional] { color:var(--gold); background:var(--gold-soft); }
.atlas-iq-status[data-status=supported] { color:var(--success-text); background:var(--success-soft); }
.atlas-iq-status[data-status=contradicted] { color:var(--danger-text); background:var(--danger-soft); }
.atlas-iq-edge-body { gap:var(--s-4); background:var(--sunken); border-radius:var(--r-sm); color:var(--text-2); font:var(--t-body); }
.atlas-iq-edge-body ul:not(.atlas-iq-pointers),.atlas-iq-seats { padding-inline-start:var(--s-20); }
.atlas-iq .atlas-iq-pointers { display:flex; flex-wrap:wrap; gap:var(--s-4); list-style:none; padding:0; }
.atlas-iq-pointers li { min-width:0; max-width:100%; }
.atlas-iq-pointer { display:inline-flex; gap:var(--s-4); align-items:center; max-width:100%; min-height:var(--control-28); padding:var(--s-4) var(--s-8); border:1px solid var(--border-strong); border-radius:var(--r-sm); color:var(--accent); background:transparent; text-align:start; cursor:pointer; }
.atlas-iq-pointers code { min-width:0; overflow-wrap:anywhere; white-space:normal; font:var(--t-mono); }
.atlas-iq-pointer svg { flex:none; }
.atlas-iq-card { display:grid; gap:var(--s-8); margin-block:var(--s-8); padding:var(--s-12); border:1px solid var(--border-strong); border-inline-start:3px solid var(--gold); border-radius:var(--r-md); background:var(--raised); }
.atlas-iq-card[data-kind=result] { border-inline-start-color:var(--accent); }
.atlas-iq-card h3 { color:var(--gold); }
.atlas-iq-card[data-kind=result] h3 { color:var(--accent); }
.atlas-iq-claim { font:var(--t-h3); white-space:pre-line; }
.atlas-iq-detail,.atlas-iq-charter,.atlas-iq-seats { font:var(--t-ui); color:var(--text-2); white-space:pre-line; }
.atlas-iq-card-more summary { padding-inline:0; border-block-start:1px solid var(--border); color:var(--text-2); }
.atlas-iq-card-more > :not(summary),.atlas-iq-charter > div + div { margin-block-start:var(--s-8); }
.atlas-iq-actions .atlas-button { max-width:100%; height:auto; min-height:var(--control-28); white-space:normal; }
@container inquiry (max-width:520px) {
  .atlas-iq-grid,.atlas-iq-question-pair { grid-template-columns:minmax(0,1fr); gap:var(--s-8); }
  .atlas-iq-frame > summary { flex-wrap:wrap; }
  .atlas-iq-frame > summary .atlas-iq-preview { flex-basis:100%; order:2; white-space:normal; }
}
`;
