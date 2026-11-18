// DSH 0.2.2: modelCatalog() is host-wide and needs no session; selectModel is
// session-specific and applies on its next request. Never change the host default.
const atlasModelAccess = externalStore(null);
function installAtlasModelAccess(ctx) {
  ctx.inject(['remote', 'remote.session'], scope => scope.effect(() => {
    const service = scope.remote.session;
    atlasModelAccess.set(service);
    return () => { if (atlasModelAccess.get() === service) atlasModelAccess.set(null); };
  }, 'aitp-atlas: discussion model selection'));
}
function atlasRequireResult(result, label) {
  if (!result?.ok) throw new Error(result?.error?.message || label);
  return result.value;
}
function atlasModelValue(selection) {
  return selection?.provider && selection?.model ? { provider: selection.provider, model: selection.model, effort: selection.reasoningEffort || selection.effort || '' } : null;
}
function atlasCatalogEntry(catalog, choice) {
  return catalog?.groups?.find(g => g.id === choice?.provider)?.models.find(m => m.id === choice.model);
}
async function atlasFetchModelCatalog(service = atlasModelAccess.get()) {
  if (!service?.modelCatalog || !service?.selectModel) throw new Error('DSH model selection is unavailable. Use the session default.');
  return atlasRequireResult(await service.modelCatalog(), 'DSH could not load its model catalog.');
}
async function atlasSelectSessionModel(id, choice) {
  const service = atlasModelAccess.get();
  if (!service?.selectModel) throw new Error('DSH model selection is unavailable. No model was changed.');
  const entry = atlasCatalogEntry(await atlasFetchModelCatalog(service), choice);
  if (!entry || (choice.effort && !entry.reasoning?.efforts?.some(e => e.id === choice.effort))) throw new Error('That model or effort is no longer available. Choose another model or use the DSH default.');
  atlasRequireResult(await service.selectModel({ sessionId: id, provider: choice.provider, model: choice.model,
    ...(choice.effort ? { reasoningEffort: choice.effort } : {}) }), 'DSH did not accept the model selection.');
}
function AtlasModelPicker({ value, onChange, sessionId, disabled }) {
  const service = React.useSyncExternalStore(atlasModelAccess.subscribe, atlasModelAccess.get);
  const [open, setOpen] = useState(false), [catalog, setCatalog] = useState(null), [error, setError] = useState('');
  const [selected, select] = useState(null), [busy, setBusy] = useState(false);
  const trigger = useRef(null), pending = useRef(false);
  useEffect(() => {
    if (!open) return;
    let here = true; setError(''); setCatalog(null);
    atlasFetchModelCatalog(service).then(next => { if (here) setCatalog(next); }, e => { if (here) setError(e.message); });
    return () => { here = false; };
  }, [open, service]);
  const choose = async choice => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await onChange(choice); setOpen(false); } catch (e) { setError(e.message); }
    finally { pending.current = false; setBusy(false); }
  };
  const entry = atlasCatalogEntry(catalog, selected), chosen = atlasCatalogEntry(catalog, value);
  const title = value ? `${chosen?.name || value.model}${value.effort ? ' · ' + value.effort : ''}` : 'DSH default';
  const row = (label, onClick, active, dis = false, key = label) => h('button', { key, type: 'button', className: 'atlas-model-option', onClick, disabled: busy || dis, 'aria-pressed': !!active }, label);
  return h(React.Fragment, null, h('button', { ref: trigger, type: 'button', className: 'atlas-model-chip', title: `Model: ${title}`, disabled, 'aria-label': `Model: ${title}`, 'aria-expanded': open, 'aria-haspopup': 'dialog', onClick: () => { select(null); setOpen(!open); } }, h(Icon, { name: 'spark', size: 14 }), h('span', null, title)),
    open && h(Popover, { label: 'Choose a model', anchor: trigger, onClose: () => { if (!pending.current) setOpen(false); }, className: 'atlas-model-popup' },
      error && h(Banner, { tone: 'error' }, error),
      catalog && value && (!chosen || (value.effort && !chosen.reasoning?.efforts?.some(e => e.id === value.effort))) && h('p', null, 'The saved model or effort is no longer available.'),
      !sessionId && row('Use DSH default', () => choose(null), !value),
      !catalog && !error && h('p', { role: 'status' }, 'Reading DSH model catalog…'),
      entry ? h(React.Fragment, null, row('Back to models', () => select(null)), h('h4', null, entry.name, ' · Effort'),
        row('Model default', () => choose({ ...selected, effort: '' }), !value?.effort && value?.model === selected.model),
        entry.reasoning.efforts.map(e => row(e.name || e.id, () => choose({ ...selected, effort: e.id }), value?.provider === selected.provider && value?.model === selected.model && value.effort === e.id, false, e.id))) : catalog?.groups.map(g => h('section', { key: g.id }, h('h4', null, g.name), g.models.map(m => row(m.name, () => {
          const choice = { provider: g.id, model: m.id, effort: '' };
          if (m.reasoning?.efforts?.length) select(choice); else choose(choice);
        }, value?.provider === g.id && value.model === m.id, false, m.id)))),
      catalog && !catalog.groups.length && h('p', null, 'No models are available in DSH.'),
      catalog?.failures?.map(f => h('p', { key: f.id, className: 'atlas-muted' }, `${f.name}: ${f.message}`))));
}

const ATLAS_DISCUSSION_CSS = `
.atlas-ask-target { display:flex; align-items:center; gap:var(--s-8); margin:var(--s-4) 0 var(--s-8); font:var(--t-meta); color:var(--text-2); }
.atlas-ask-target select { min-width:0; max-width:80%; }
.atlas-model-chip,.atlas-disc-topic { display:inline-flex; align-items:center; justify-content:center; gap:var(--s-4); min-width:var(--control-24); max-width:200px; height:var(--control-24); padding:0 var(--s-8); background:transparent; color:var(--text-2); border:1px solid var(--border-strong); border-radius:var(--r-full); font:var(--t-meta); cursor:pointer; }
.atlas-model-chip>span,.atlas-disc-topic>span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.atlas-model-popup { width:max-content; min-width:min(200px,100%); }
.atlas-model-popup h4 { font:var(--t-cap); font-variant-caps:var(--cap-variant); color:var(--text-3); margin:var(--s-8) 0 var(--s-4); }
.atlas-model-option { display:block; width:100%; padding:var(--s-4) var(--s-8); min-height:var(--control-28); text-align:start; border:0; border-radius:var(--r-sm); font:var(--t-ui); color:var(--text-1); background:transparent; cursor:pointer; }
.atlas-model-option:hover { background:var(--hover); }.atlas-model-option[aria-pressed=true] { background:var(--selected); }
.atlas-disc-panel { container-type:inline-size; display:flex; flex-direction:column; min-height:0; height:100%; }
.atlas-disc-header { display:flex; align-items:center; gap:var(--s-8); height:var(--s-48); flex:none; padding:0 var(--s-12); border-bottom:1px solid var(--border); background:var(--surface); }
.atlas-disc-title { flex:1 0 140px; min-width:min(140px,100%); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font:var(--t-h3); color:var(--text-1); text-align:start; padding:0; background:transparent; border:0; }
button.atlas-disc-title { cursor:text; }.atlas-disc-topic.is-auto { border-style:dashed; }
.atlas-disc-mark { flex:none; color:var(--text-3); }.atlas-disc-mark.is-running { color:var(--accent); animation:atlas-disc-work var(--motion-twinkle) var(--ease) infinite; }
@keyframes atlas-disc-work {0%,100%{opacity:.65;transform:scale(.75)}50%{opacity:1;transform:scale(1.1)}}
@media(prefers-reduced-motion:reduce){.atlas-disc-mark.is-running {animation:none}}
.atlas-disc-context { display:flex; flex-wrap:wrap; align-items:center; gap:var(--s-4); padding:var(--s-8); border-bottom:1px solid var(--border); }
.atlas-disc-context button { font:var(--t-meta); color:var(--text-2); border:0; background:transparent; cursor:pointer; }
@container(max-width:719px){.atlas-disc-header .atlas-model-chip{width:var(--control-24);padding:0}.atlas-disc-header .atlas-model-chip>span{display:none}.atlas-disc-header{gap:var(--s-4)}}
`;
