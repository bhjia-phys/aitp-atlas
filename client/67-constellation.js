// TM-20. One projection of a charter for all three surfaces: the live room,
// the proposed crew in Assembly, and the decorative miniature in a Teams row.
// This renderer does not infer activity from a task title, or create a session.
function constellationModel(seat, assembly) {
  const model = seat.model;
  const name = typeof model === 'string' ? model : [model?.provider, model?.model].filter(Boolean).join(' / ');
  const effort = seat.effort || model?.effort;
  return [name || (assembly ? (seat.name === 'lead' ? 'DSH default' : 'Same as the lead') : 'Model unknown'), effort].filter(Boolean).join(' · ');
}

function layoutConstellation({ lead, seats = [], paths = [], mode = 'room', width = 560 } = {}) {
  const assembly = mode === 'assembly', tiny = mode === 'thumbnail';
  width = tiny ? 48 : Math.max(32, Number.isFinite(width) ? width : 560);
  const height = tiny ? 32 : assembly ? 120 : 230;
  const cx = width / 2, cy = height / 2, rx = width * (assembly ? 0.4 : 0.35), ry = height * (assembly ? 1 / 3 : 0.31);
  const source = [lead || { name: 'lead', role: 'Lead' }, ...seats];
  const marks = source.map((seat, i) => {
    const central = !i, name = central ? 'lead' : seat.name || '(unnamed)';
    const theta = (200 + 360 * (i - 1) / Math.max(1, seats.length)) * Math.PI / 180;
    const x = central ? cx : cx + rx * Math.cos(theta), y = central ? cy : cy + ry * Math.sin(theta);
    const state = ['working','idle','starting','not-started','failed'].includes(seat.state) ? seat.state : 'unknown';
    const counted = Number.isInteger(seat.done) && Number.isInteger(seat.total) && seat.total > 0 && seat.done >= 0 && seat.done <= seat.total;
    const fraction = assembly || central || !counted ? null : seat.done / seat.total;
    const color = central ? 'var(--accent)' : i <= 8 ? `var(--n${i})` : 'var(--dx)';
    const stateLabel = state === 'not-started' ? 'not started' : state === 'unknown' ? 'state unknown' : state;
    const detail = [stateLabel, seat.task].filter(Boolean).join(' · ');
    return { key: central ? 'lead' : `member-${i}`, seat, name, central, x, y, color, fraction, state, stateLabel, detail,
      role: seat.role || (central ? 'Lead' : 'Role unknown'), model: constellationModel(seat, assembly),
      working: !assembly && state === 'working', missing: !assembly && (state === 'not-started' || state === 'failed') };
  });
  const arcs = [];
  if (!assembly && !tiny) {
    const byName = new Map(marks.map((m) => [m.name, m]));
    const keys = new Set();
    // Only an explicitly submitted report going to the lead or an in-flight
    // review by another member is evidence for a light path. Terminal artifacts
    // (accepted/rejected/reviewed) never animate. Identity is per artifact.
    for (const path of paths) {
      if (arcs.length === 6) break;
      const from = byName.get(path?.from), to = byName.get(path?.to);
      if (!from || !to || from === to || !path.id || !['review','submitted'].includes(path.kind)) continue;
      if (path.kind === 'submitted' ? !to.central : to.central) continue;
      const key = JSON.stringify([path.kind, path.id, from.name, to.name]);
      if (keys.has(key)) continue;
      keys.add(key);
      // A quadratic interpolates the endpoints. Choose the perpendicular on
      // the outside of their chord, not the one that crosses the center.
      const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy);
      const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
      const side = (-dy * (mx - cx) + dx * (my - cy)) < 0 ? -1 : 1;
      const bow = Math.min(54, length * 0.3), qx = mx - dy / length * side * bow, qy = my + dx / length * side * bow;
      arcs.push({ key, kind: path.kind, id: path.id, from, to, qx, qy, d: `M${from.x},${from.y} Q${qx},${qy} ${to.x},${to.y}` });
    }
  }
  // As in the Desk sky, omit a colliding line rather than shrinking type or
  // changing seat order; focus/card and the full text list always retain it.
  const labels = [];
  if (!tiny) {
    const boxes = marks.map((m) => ({ x: m.x, y: m.y, w: assembly ? 15 : 30, h: assembly ? 15 : 30 }));
    const intersects = (a, b) => Math.abs(a.x - b.x) * 2 <= a.w + b.w && Math.abs(a.y - b.y) * 2 <= a.h + b.h;
    const text = (s, max) => [...s].length <= max ? s : [...s].slice(0, max - 1).join('') + '…';
    const textWidth = (s, step) => [...s].reduce((w, c) => w + (/[^\u0000-\u024f]/u.test(c) ? 12 : step), 0);
    for (const m of marks) {
      const name = text(m.name, Math.min(24, Math.max(7, Math.floor(width / 22)))), detail = text(m.detail, Math.min(29, Math.max(10, Math.floor(width / 22))));
      const w1 = textWidth(name, assembly ? 5.5 : 7), w2 = textWidth(detail, 5.7);
      let placed = false;
      for (const lines of (assembly ? [1] : [2,1])) {
        const w = Math.min(width - 8, Math.max(w1, lines === 2 ? w2 : 0) + 6), h = lines === 2 ? 28 : 15;
        const x = Math.max(w / 2 + 2, Math.min(width - w / 2 - 2, m.x)), gap = assembly ? 9 : 17;
        for (const sign of [1,-1]) {
          const y = m.y + sign * (gap + h / 2 + 1), b = { x, y, w, h };
          if (y < h / 2 || y > height - h / 2 || boxes.some((o) => intersects(o, b))) continue;
          boxes.push(b); labels.push({ key: m.key, x, y: y - (lines === 2 ? 7 : 0), name, detail: lines === 2 ? detail : '', w1: Math.min(w1,w - 4), w2: Math.min(w2,w - 4), box: b });
          placed = true; break;
        }
        if (placed) break;
      }
    }
  }
  return { mode, width, height, cx, cy, rx, ry, marks, labels, arcs };
}

// The same action decision is used for a pointer click and Enter/Space. A
// missing seat never opens an invented member session; the card explains it.
function constellationCommand(key, mark, mode, handlers) {
  if (mode === 'thumbnail') return null;
  if (mode === 'assembly') return (key === 'Enter' || key === ' ') && handlers.onSelect ? 'select' : null;
  if (key === 'ArrowDown') return 'details';
  if (key !== 'Enter' && key !== ' ') return null;
  return mark.seat.sessionId && handlers.onOpen ? 'open' : 'details';
}

function constellationArtifacts(values) {
  return Array.isArray(values) ? values.map((v) => typeof v === 'string' ? v : v?.id || v?.title || v?.file).filter(Boolean).join(', ') : '';
}

function TeamConstellation({ lead, seats = [], paths = [], mode = 'room', onOpen, onMessage, onAskStart, onSelect }) {
  const host = useRef(null), timer = useRef(null), hovering = useRef(null), id = React.useId();
  const [width, setWidth] = useState(mode === 'assembly' ? 300 : 560), [card, setCard] = useState(null);
  const assembly = mode === 'assembly', tiny = mode === 'thumbnail', interactive = !tiny && (!assembly || !!onSelect);
  const cancel = () => clearTimeout(timer.current);
  const close = () => { cancel(); setCard(null); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (tiny || !host.current) return;
    const el = host.current;
    const measure = () => { if (el.clientWidth) setWidth(el.clientWidth); }; measure();
    if (typeof ResizeObserver !== 'undefined') { const ob = new ResizeObserver(measure); ob.observe(el); return () => ob.disconnect(); }
  }, [tiny]);
  const g = useMemo(() => layoutConstellation({ lead, seats, paths, mode, width }), [lead, seats, paths, mode, width]);
  const active = card && g.marks.find((m) => m.key === card.key && m.name === card.name);
  const show = (m, anchor, focus) => { cancel(); if (anchor.isConnected) setCard({ key: m.key, name: m.name, anchor, focus }); };
  const leave = () => { cancel(); timer.current = setTimeout(() => { if (!hovering.current?.contains(hovering.current.ownerDocument.activeElement)) setCard(null); }, 300); };
  const run = (command, m, e) => {
    if (command === 'details') show(m, e.currentTarget, true);
    else if (command === 'open') { close(); onOpen(m.seat, e); }
    else if (command === 'select') onSelect(m.seat);
  };
  const handlers = { onOpen, onSelect };
  const desc = (m) => [m.name, m.role, m.model, ...(assembly ? [] : [m.detail, m.fraction !== null ? `${m.seat.done} of ${m.seat.total} tasks done` : null])].filter(Boolean).join(' · ');
  const gfx = (m) => {
    const x = m.x, y = m.y, c = m.color;
    const dot = tiny ? (m.central ? 2.3 : 1.8) : assembly ? (m.central ? 5 : 4.5) : (m.central ? 6.5 : 5.5);
    const attrs = interactive ? {
      role: 'button', tabIndex: 0, 'aria-label': `${desc(m)}. ${assembly ? 'Select seat.' : `Enter to ${m.seat.sessionId && onOpen ? 'open conversation' : 'inspect'}; Down for seat details.`}`,
      'aria-haspopup': assembly ? undefined : 'dialog', 'aria-expanded': assembly ? undefined : active?.key === m.key,
      onClick: (e) => run(constellationCommand('Enter', m, mode, handlers), m, e),
      onKeyDown: (e) => {
        const command = constellationCommand(e.key, m, mode, handlers);
        if (command && !e.repeat) { e.preventDefault(); e.stopPropagation(); run(command, m, e); }
      },
      onPointerEnter: assembly ? undefined : (e) => { const el = e.currentTarget; cancel(); timer.current = setTimeout(() => show(m, el, false), 300); },
      onPointerLeave: assembly ? undefined : leave,
    } : {};
    return h('g', { key: m.key, ...attrs, className: 'atlas-crew-star' }, !tiny ? h('title', null, desc(m)) : null,
      !tiny && m.central ? h('circle', { cx: x, cy: y, r: assembly ? 12 : 22, fill: `url(#${id}-halo)` }) : null,
      !tiny && !assembly && !m.central ? h('circle', { className: 'atlas-crew-track', cx: x, cy: y, r: 13 }) : null,
      !tiny && m.fraction > 0 ? h('circle', { className: 'atlas-crew-progress', cx: x, cy: y, r: 13, pathLength: 100, stroke: c, strokeDasharray: `${100 * m.fraction} 100`, transform: `rotate(-90 ${x} ${y})` }) : null,
      h('circle', { cx: x, cy: y, r: dot, fill: m.missing ? 'none' : c, stroke: m.missing ? c : undefined, strokeDasharray: m.missing ? '2 2' : undefined }),
      !tiny && m.working ? h('path', { className: 'atlas-crew-twinkle', transform: `translate(${m.central ? x : x + 14} ${y - 17})`, fill: c, d: 'M0 -6 L1.6 -1.6 6 0 1.6 1.6 0 6 -1.6 1.6 -6 0 -1.6 -1.6Z' }) : null,
      interactive ? h('circle', { cx: x, cy: y, r: assembly ? 12 : 15, className: 'atlas-crew-hit' }) : null);
  };
  const svg = h('svg', { width: tiny ? 48 : '100%', height: g.height, viewBox: `0 0 ${g.width} ${g.height}`, role: tiny ? undefined : interactive ? 'group' : 'img', 'aria-hidden': tiny || undefined, 'aria-label': tiny ? undefined : assembly ? 'Proposed crew constellation' : 'Team constellation' },
    !tiny ? h('defs', null, h('radialGradient', { id: id + '-halo' }, h('stop', { offset: 0, stopColor: 'var(--accent)', stopOpacity: 0.5 }), h('stop', { offset: 1, stopColor: 'var(--accent)', stopOpacity: 0 }))) : null,
    h('g', { 'aria-hidden': true }, !assembly && !tiny ? [0.5, 1.3].map((r) => h('ellipse', { key: r, className: 'atlas-crew-graticule', cx: g.cx, cy: g.cy, rx: g.rx * r, ry: g.ry * r })) : null,
      h('ellipse', { className: 'atlas-crew-orbit', cx: g.cx, cy: g.cy, rx: g.rx, ry: g.ry }),
      g.arcs.map((a) => h('path', { key: a.key, d: a.d, className: cx('atlas-crew-light', a.kind === 'submitted' && 'is-submitted') }, h('title', null, `${a.id}: ${a.from.name} → ${a.to.name}`)))),
    g.marks.map(gfx),
    h('g', { 'aria-hidden': true, pointerEvents: 'none' }, g.labels.map((l) => h('g', { key: l.key },
      h('text', { x: l.x, y: l.y, textAnchor: 'middle', dominantBaseline: 'central', className: assembly ? 'atlas-crew-subtitle' : 'atlas-crew-name', textLength: l.w1, lengthAdjust: 'spacingAndGlyphs' }, l.name),
      l.detail ? h('text', { x: l.x, y: l.y + 14, textAnchor: 'middle', dominantBaseline: 'central', className: 'atlas-crew-subtitle', textLength: l.w2, lengthAdjust: 'spacingAndGlyphs' }, l.detail) : null))));
  if (tiny) return svg;
  return h('div', { className: cx('atlas-crew-chart', assembly && 'is-preview'), ref: host }, svg,
    h('ul', { className: 'atlas-crew-text', 'aria-label': assembly ? 'Proposed seats' : 'Seats and current work' }, g.marks.map((m) => h('li', { key: m.key }, desc(m)))),
    active ? h(Popover, { key: active.key, nodeRef: hovering, anchor: card.anchor, autoFocus: card.focus, onClose: close, label: `${active.name} seat details`, side: 'bottom', align: 'center', className: 'atlas-crew-card', onPointerEnter: cancel, onPointerLeave: leave, onFocus: cancel },
      h('h3', null, active.name), h('p', null, active.role, ' · ', active.model), h('p', null, active.detail),
      h('dl', null, h('dt', null, 'Reports'), h('dd', null, constellationArtifacts(active.seat.reports) || 'None observed'), h('dt', null, 'Reviews'), h('dd', null, constellationArtifacts(active.seat.reviews) || 'None observed')),
      h('div', { className: 'atlas-crew-actions' },
        active.seat.sessionId && onMessage ? h(Button, { small: true, onClick: () => { close(); onMessage(active.seat); } }, 'Message') : null,
        active.seat.sessionId && onOpen ? h(Button, { small: true, onClick: (e) => { close(); onOpen(active.seat, e); } }, 'Open') : null,
        !active.seat.sessionId && active.missing && !active.central && onAskStart ? h(Button, { small: true, onClick: () => { close(); onAskStart(active.seat); } }, 'Ask the lead to start it') : null)) : null);
}

const ATLAS_CONSTELLATION_CSS = `
.atlas-crew-chart { width:100%; min-width:0; }
.atlas-crew-chart > svg { display:block; width:100%; overflow:visible; }
.atlas-crew-orbit { fill:none; stroke:var(--sky-line-2); stroke-width:1; stroke-dasharray:2 5; }
.atlas-crew-graticule { fill:none; stroke:var(--sky-line); stroke-width:1; }
.atlas-crew-track { fill:none; stroke:var(--sky-line-2); stroke-width:2.2; }
.atlas-crew-progress { fill:none; stroke-width:2.2; stroke-linecap:round; }
.atlas-crew-light { fill:none; stroke:var(--accent); stroke-width:1.4; stroke-dasharray:3 6; opacity:.9; animation:atlas-crew-flow var(--motion-flow) linear infinite; }
.atlas-crew-light.is-submitted { animation-duration:var(--motion-flow-slow); }
.atlas-crew-twinkle { animation:atlas-crew-pulse var(--motion-twinkle) var(--ease) infinite; }
@keyframes atlas-crew-flow { to { stroke-dashoffset:-18; } }
@keyframes atlas-crew-pulse { 0%,100% { opacity:.45; } 50% { opacity:1; } }
@media (prefers-reduced-motion:reduce) { .atlas-crew-twinkle,.atlas-crew-light { animation:none; } }
.atlas-crew-name { font:var(--t-cap); font-size:13px; font-variant-caps:var(--cap-variant); letter-spacing:var(--cap-tracking); fill:var(--text-1); }
.atlas-crew-subtitle { font:var(--t-meta); font-size:10.5px; fill:var(--text-3); }
.atlas-crew-star[role=button] { cursor:pointer; outline:none; }
.atlas-crew-hit { fill:transparent; pointer-events:all; }
.atlas-crew-star:is(:focus-visible,:hover) .atlas-crew-hit { stroke:var(--accent); stroke-width:2; }
.atlas-crew-text { position:absolute; width:1px; height:1px; margin:-1px; padding:0; border:0; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
.atlas-crew-card { width:280px; }
.atlas-crew-card h3 { font:var(--t-h3); margin:0 0 var(--s-4); }
.atlas-crew-card p,.atlas-crew-card dl { margin:var(--s-4) 0; color:var(--text-2); font:var(--t-meta); overflow-wrap:anywhere; }
.atlas-crew-card dl { display:grid; grid-template-columns:max-content minmax(0,1fr); gap:var(--s-4) var(--s-8); }
.atlas-crew-card dd { margin:0; } .atlas-crew-card dt { font:var(--t-cap); font-variant-caps:var(--cap-variant); }
.atlas-crew-actions { display:flex; flex-wrap:wrap; gap:var(--s-4); margin-top:var(--s-8); }
`;
