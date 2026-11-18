// Map: the programme, without a dashboard around it. Map and Desk project the same
// ordered catalogue. Empty directions stay in the legend but take no angular area.
function atlasStarCatalogue(ov) {
  const topics = ov.topics || {};
  const seen = new Set();
  const collect = (roots) => {
    const members = [], stack = [...roots].reverse().map((id) => [id, 0]);
    while (stack.length) {
      const [id, depth] = stack.pop(), t = topics[id];
      if (!id || !t || seen.has(id)) continue;
      seen.add(id);
      members.push({ id, t, depth });
      for (const child of [...(t.children || [])].reverse()) stack.push([child, depth + 1]);
    }
    return members;
  };
  const sectors = (ov.directions || []).map((d) => ({ key: d.slug, title: d.heading.replace(/^\d+\.\s*/, ''), color: directionColor(ov, d.slug), members: collect(d.topics || []) }));
  const beyond = collect([...(ov.other || []), ...(ov.unreached || []), ...Object.keys(topics).sort()]);
  if (beyond.length) sectors.push({ key: null, title: 'Outside the directions', color: otherColor(), members: beyond });
  return sectors;
}

// A unit angle runs left-to-right around the dome (or clockwise around the globe).
// Use overview.scannedAt, never the wall clock: refreshing the snapshot can change
// the active-this-week classification, simply redrawing it cannot.
function atlasChartLayout(ov, geometry) {
  const { cx, cy, rx, ry, start, span, keepOut, width, height } = geometry;
  const sectors = atlasStarCatalogue(ov);
  const count = sectors.reduce((n, s) => n + s.members.length, 0);
  const point = (angle, radial) => ({ x: cx + rx * Math.cos(angle) * radial, y: cy + ry * Math.sin(angle) * radial });
  const overlaps = (a, b) => a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
  const box = (p, w, h) => ({ left: p.x - w / 2, right: p.x + w / 2, top: p.y - h / 2, bottom: p.y + h / 2 });
  const stars = [], labels = [], edges = [], byId = new Map();
  let cursor = 0;
  for (const s of sectors) {
    s.a0 = start + span * cursor / (count || 1);
    for (const member of s.members) {
      const index = cursor++;
      const angle = start + span * (index + 0.5) / count;
      // Spread neighbours in radius with a low-discrepancy sequence. Select from
      // positions on their own ray, never push a star into a neighbouring sector.
      const phase = ((index + 1) * 0.61803398875) % 1;
      let p;
      for (let j = 0; j <= 32; j++) {
        const r = 0.38 + 0.56 * ((phase + j / 33) % 1);
        p = point(angle, r);
        if (!keepOut || !overlaps(box(p, 20, 20), keepOut)) break;
      }
      const last = Date.parse(member.t.latest?.date || '');
      const days = Math.max(0, (ov.scannedAt - last) / 86400000);
      const size = days <= 7 ? 2.6 : days <= 30 ? 2.2 : 1.7;
      const star = { ...member, ...p, angle, size, direction: s.title, sector: s.key, color: s.color };
      byId.set(member.id, star);
      stars.push(star);
    }
    s.a1 = start + span * cursor / (count || 1);
  }
  for (const star of stars) {
    const parent = byId.get(star.t.parent);
    if (parent) edges.push({ from: parent, to: star });
  }
  const obstacles = [...(keepOut ? [keepOut] : []), ...stars.map((s) => box(s, 12, 12))];
  for (const s of sectors) {
    if (!s.members.length) continue;
    const angle = (s.a0 + s.a1) / 2;
    // Clamp long labels to the viewport; omit a colliding label, not its marks
    // or its accessible name. The rendered textLength enforces this footprint.
    const text = shortTitle(s.title, geometry.labelLimit || 38), length = Math.min(width - 16, [...text].reduce((w, ch) => w + (/[^\u0000-\u00ff]/.test(ch) ? 12 : 7), 0));
    const p = point(angle, 0.98);
    p.x = Math.max(8 + length / 2, Math.min(width - 8 - length / 2, p.x));
    const bounds = box(p, length + 8, 20);
    if (bounds.top < 0 || bounds.bottom > height || obstacles.some((b) => overlaps(bounds, b))) continue;
    obstacles.push(bounds);
    labels.push({ ...p, text, length, bounds, sector: s.key, title: s.title });
  }
  return { ...geometry, sectors, stars, edges, labels };
}

function layoutUniverse(ov, { width = 1000, height = 740 } = {}) {
  // Lay out in pane pixels. Scaling a fixed 1000-unit SVG into a split pane
  // also shrank its 11.5px labels and pointer targets down to a third of size.
  const scale = Math.min(width / 1000, height / 740);
  return atlasChartLayout(ov, { width, height, cx: width / 2, cy: height / 2, rx: 466 * scale, ry: 327 * scale, start: -Math.PI / 2, span: Math.PI * 2, labelLimit: Math.max(12, Math.min(38, Math.floor(width / 28))) });
}

function atlasSkyArc(g, a, b, scale) {
  const r = g.rx * scale, s = g.ry * scale;
  const pt = (t) => `${g.cx + r * Math.cos(t)} ${g.cy + s * Math.sin(t)}`;
  // Two arcs also describe a complete ellipse (a single SVG arc cannot).
  return `M${pt(a)} A${r} ${s} 0 0 1 ${pt((a + b) / 2)} A${r} ${s} 0 0 1 ${pt(b)}`;
}

function ChartMarks({ g, ov, onOpen, onPoint, onLeave, onInspect, hoverSector }) {
  return h(React.Fragment, null,
    h('g', { 'aria-hidden': true }, g.sectors.filter((s) => s.a1 > s.a0).map((s) => h('path', { key: String(s.key), d: atlasSkyArc(g, s.a0, s.a1, 1) + ` L${g.cx} ${g.cy} Z`, fill: s.color, opacity: 'var(--wash)' }, h('title', null, s.title))),
      [0.5, 0.75, 1].map((r) => h('path', { key: r, d: atlasSkyArc(g, g.start, g.start + g.span, r), className: 'atlas-cart-grid' })),
      g.sectors.filter((s) => s.a1 > s.a0).map((s) => h('line', { key: 'm' + s.key, x1: g.cx, y1: g.cy, x2: g.cx + g.rx * Math.cos(s.a0), y2: g.cy + g.ry * Math.sin(s.a0), className: 'atlas-cart-grid', strokeDasharray: '1 6' })),
      g.edges.map(({ from, to }) => h('line', { key: to.id, x1: from.x, y1: from.y, x2: to.x, y2: to.y, className: 'atlas-cart-edge' })),
      g.labels.map((l) => h('text', { key: String(l.sector), x: l.x, y: l.y, textAnchor: 'middle', dominantBaseline: 'central', textLength: l.length, lengthAdjust: 'spacingAndGlyphs', className: cx('atlas-cart-label', hoverSector === l.sector && 'is-revealed') }, l.text))),
    g.stars.map((s) => h('g', { key: s.id, className: 'atlas-cart-star', role: 'button', tabIndex: 0, 'data-atlas-open': true, 'aria-label': `${s.t.title} · ${s.direction}. Open topic; Arrow down for details.`,
      onMouseEnter: (e) => onPoint(s, e.currentTarget, false), onMouseLeave: onLeave,
      onFocus: (e) => onPoint(s, e.currentTarget, true), onBlur: onLeave,
      onClick: (e) => onOpen(s, e),
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(s, e); }
        if (e.key === 'ArrowDown') { e.preventDefault(); onInspect(s, e.currentTarget); }
      } }, h('title', null, `${s.t.title} · ${s.direction}`),
      h('circle', { cx: s.x, cy: s.y, r: s.size, fill: 'var(--star)' }), h('circle', { cx: s.x, cy: s.y, r: 10, className: 'atlas-cart-star-target' }))));
}

// Both skies share the mouse-to-card grace period and the keyboard path:
// focus the star, Down to its actions, Esc back to the same star.
function useAtlasStarCard(host) {
  const [tip, setTip] = useState(null);
  const timer = useRef(null), first = useRef(null), origin = useRef(null), suppress = useRef(false);
  const cancel = () => clearTimeout(timer.current);
  const close = () => { cancel(); setTip(null); };
  useEffect(() => () => clearTimeout(timer.current), []);
  const point = (star, el, immediate, focus = false) => {
    cancel();
    if (suppress.current) return;
    const show = () => {
      if (!host.current || !el.isConnected) return;
      const parent = host.current.getBoundingClientRect(), a = el.getBoundingClientRect();
      origin.current = el;
      const left = Math.min(Math.max(4, parent.width - 284), Math.max(4, a.right - parent.left));
      setTip({ star, left, top: Math.max(0, a.top - parent.top), flip: a.top - parent.top > parent.height * 0.6, focus });
    };
    if (immediate) show(); else timer.current = setTimeout(show, 300);
  };
  useLayoutEffect(() => { if (tip?.focus) first.current?.focus(); }, [tip]);
  const dismiss = (e) => {
    if (e.key !== 'Escape' || !tip) return;
    e.preventDefault(); e.stopPropagation(); close();
    suppress.current = true; origin.current?.focus(); suppress.current = false;
  };
  return { tip, first, close, cancel, dismiss, point, leave: () => { cancel(); timer.current = setTimeout(() => setTip(null), 300); }, inspect: (s, el) => point(s, el, true, true) };
}

function ChartCard({ state, onOpen, onDiscuss }) {
  if (!state.tip) return null;
  const { star: s, top, left, flip } = state.tip, t = s.t;
  return h('section', { className: cx('atlas-cart-card', flip && 'is-above'), role: 'group', 'aria-label': `${t.title} details`, style: { left, top }, onMouseEnter: state.cancel, onMouseLeave: state.leave, onFocus: state.cancel, onBlur: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) state.leave(); } },
    h('span', { className: 'atlas-cart-caption' }, h('i', { className: 'atlas-dot', style: { background: s.color } }), s.direction),
    h('h3', null, t.title), h('p', null, t.latest ? [t.latest.date, t.latest.name, t.latest.status].filter(Boolean).join(' · ') : 'No Current work recorded.'),
    h('p', null, `${plural(t.threads || 0, 'entry', 'entries')} · ${(t.waiting || []).length} waiting`),
    h('div', { className: 'atlas-cart-actions' },
      h('button', { type: 'button', className: 'atlas-button is-small', 'data-atlas-open': true, ref: state.first, onClick: (e) => { state.close(); onOpen(s, e); } }, 'Open'),
      h(Button, { small: true, quiet: true, onClick: () => { state.close(); onDiscuss(s); } }, 'Discuss')));
}

function UniverseView({ overview: ov, go, anchor }) {
  const host = useRef(null), scroller = useRef(null);
  const [size, setSize] = useState({ width: 1000, height: 740 });
  useLayoutEffect(() => {
    const el = host.current;
    const measure = () => {
      const width = el.clientWidth, height = el.clientHeight;
      if (width && height) setSize((s) => s.width === width && s.height === height ? s : { width, height });
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') { const observer = new ResizeObserver(measure); observer.observe(el); return () => observer.disconnect(); }
  }, []);
  const g = useMemo(() => layoutUniverse(ov, size), [ov, size]);
  const card = useAtlasStarCard(host), actions = React.useContext(AtlasActions);
  const [zoom, setZoom] = useState(1), [list, setList] = useState(!!anchor), [legend, setLegend] = useState(false);
  const open = (s, e) => go({ view: 'doc', path: s.t.file }, e);
  const discuss = (s) => actions.ask(focusContext({ topic: { id: s.id, title: s.t.title, path: s.t.file } }), 'ask', `Discuss the current work on ${s.t.title}.`, `Discuss ${shortTitle(s.t.title)}`);
  usePublishFocus({ kind: 'universe', topic: { id: '', title: ov.title, path: ov.rootFile } }, [ov.title, ov.rootFile]);
  useEffect(() => { if (anchor) setList(true); }, [anchor]);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) { el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; el.scrollTop = (el.scrollHeight - el.clientHeight) / 2; }
  }, [zoom, list]);
  return h('section', { className: 'atlas-map', 'aria-label': 'Research map', ref: host, onKeyDown: card.dismiss },
    !list ? h('div', { className: 'atlas-map-scroll', ref: scroller, onScroll: card.close }, h('svg', { viewBox: `0 0 ${g.width} ${g.height}`, style: { width: `${zoom * 100}%`, height: `${zoom * 100}%` }, role: 'group', 'aria-label': `Map of ${plural(g.stars.length, 'topic')}` },
      h(ChartMarks, { g, ov, onOpen: open, onPoint: card.point, onLeave: card.leave, onInspect: card.inspect }))) : null,
    h('div', { className: 'atlas-map-head' }, h('button', { type: 'button', className: 'atlas-map-title', 'data-atlas-open': true, onClick: (e) => go({ view: 'doc', path: ov.rootFile }, e), title: 'Open the root note' }, ov.title),
      h('span', { className: 'atlas-map-counts' }, [plural(ov.counts.topics, 'topic'), plural(ov.directions.length, 'direction'), plural(ov.counts.papers, 'paper'), plural(ov.counts.entries, 'knowledge entry', 'knowledge entries')].join(' · '))),
    h('div', { className: 'atlas-map-key' }, h(Button, { small: true, onClick: () => { setLegend(!legend); card.close(); }, 'aria-expanded': legend }, legend ? 'Hide directions' : 'Directions'),
      legend ? h('ul', null, g.sectors.map((s) => h('li', { key: String(s.key) }, h('span', { className: 'atlas-dot', style: { background: s.color } }), s.title, h('i', null, s.members.length)))) : null),
    list ? h('div', { className: 'atlas-map-list' }, h('h2', null, 'Topics by direction'), g.sectors.map((s) => h('section', { key: String(s.key), id: s.key ? 'atlas-dir-' + s.key : undefined }, h('h3', null, s.title),
      s.members.length ? h('ul', null, s.members.map(({ t }) => h('li', { key: t.id }, h('button', { type: 'button', className: 'atlas-link', 'data-atlas-open': true, onClick: (e) => go({ view: 'doc', path: t.file }, e) }, t.title)))) : h(TextButton, { onClick: (e) => go({ view: 'doc', path: ov.rootFile, anchor: s.key }, e) }, 'No topic yet · read direction')))) : null,
    !g.stars.length && !list ? h('p', { className: 'atlas-map-empty' }, 'No topics in this programme yet.') : null,
    h('div', { className: 'atlas-map-controls' }, !list ? h(React.Fragment, null,
      h(Button, { small: true, title: 'Zoom out', 'aria-label': 'Zoom out', disabled: zoom <= 0.75, onClick: () => { card.close(); setZoom((z) => z - 0.25); } }, '−'),
      h(Button, { small: true, title: 'Zoom in', 'aria-label': 'Zoom in', disabled: zoom >= 3, onClick: () => { card.close(); setZoom((z) => z + 0.25); } }, '+'),
      h(Button, { small: true, title: `Zoom: ${zoom * 100}%`, onClick: () => { card.close(); setZoom(1); if (scroller.current) scroller.current.scrollTo(0, 0); } }, 'Reset')) : null,
      h(Button, { small: true, onClick: () => { setList(!list); setLegend(false); card.close(); } }, list ? 'Show chart' : 'Topic list')),
    h(ChartCard, { state: card, onOpen: open, onDiscuss: discuss }));
}

const ATLAS_MAP_CSS = `
.atlas-cart-grid { fill:none; stroke:var(--sky-line); }
.atlas-cart-edge { fill:none; stroke:var(--sky-line-2); }
.atlas-cart-label { fill:var(--text-3); font:var(--t-cap); font-size:11.5px; font-variant-caps:all-small-caps; letter-spacing:.14em; pointer-events:none; }
.atlas-cart-star { cursor:pointer; outline:none; }
.atlas-cart-star-target { fill:transparent; }
.atlas-cart-star:is(:focus-visible,:hover) .atlas-cart-star-target { stroke:var(--accent); fill:var(--accent-soft); }
.atlas-cart-card { position:absolute; z-index:var(--z-popover); width:280px; max-width:calc(100% - var(--s-8)); box-sizing:border-box; padding:var(--s-12); border:1px solid var(--border); border-radius:var(--r-md); background:var(--raised); box-shadow:var(--shadow-2); color:var(--text-1); }
.atlas-cart-card.is-above { transform:translateY(-100%); }
.atlas-cart-card h3 { font:var(--t-h3); margin:var(--s-4) 0; overflow-wrap:anywhere; }
.atlas-cart-card p { font:var(--t-meta); color:var(--text-2); margin:var(--s-4) 0; }
.atlas-cart-caption { display:flex; gap:var(--s-8); align-items:center; font:var(--t-cap); font-variant-caps:all-small-caps; color:var(--text-3); }
.atlas-cart-actions,.atlas-map-controls { display:flex; gap:var(--s-4); }
.atlas-map { display:grid; grid-template-columns:minmax(0,1fr) auto; grid-template-rows:auto minmax(0,1fr) auto; gap:var(--s-8); position:relative; isolation:isolate; height:100%; min-height:240px; padding:var(--s-16); box-sizing:border-box; background:var(--surface); }
.atlas-map-scroll { position:absolute; inset:0; overflow:auto; z-index:-1; background:radial-gradient(ellipse at center,var(--accent-soft),transparent 68%); }
.atlas-map-scroll svg { display:block; margin:auto; }
.atlas-map-head,.atlas-map-key,.atlas-map-controls { align-self:start; justify-self:start; border:1px solid var(--border); background:color-mix(in srgb,var(--surface) 90%,transparent); border-radius:var(--r-md); }
.atlas-map-head { min-width:0; max-width:100%; padding:var(--s-8) var(--s-12); }
.atlas-map-title { display:block; max-width:100%; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; font:var(--t-h3); color:var(--text-1); background:none; border:none; padding:0; cursor:pointer; }
.atlas-map-title:hover { text-decoration:underline; }
.atlas-map-counts { display:block; font:var(--t-meta); color:var(--text-2); }
.atlas-map-key { position:relative; justify-self:end; z-index:1; }
.atlas-map-key ul { position:absolute; right:0; top:100%; max-height:40vh; overflow:auto; width:max-content; max-width:min(280px,80cqw); list-style:none; margin:0; padding:var(--s-12); border:1px solid var(--border); background:var(--raised); border-radius:var(--r-md); box-shadow:var(--shadow-2); }
.atlas-map-key li { display:flex; align-items:baseline; gap:var(--s-8); font:var(--t-meta); padding:var(--s-4) 0; }
.atlas-map-key i { margin-left:auto; font:var(--t-count); }
.atlas-map-controls { grid-row:3; grid-column:1/-1; padding:var(--s-4); }
.atlas-map-list,.atlas-map-empty { grid-row:2; grid-column:1/-1; }
.atlas-map-list { overflow:auto; padding:var(--s-16); }
.atlas-map-list h2 { font:var(--t-h2); } .atlas-map-list h3 { font:var(--t-h3); }
.atlas-map-empty { place-self:center; font:var(--t-count); color:var(--text-2); }
`;
