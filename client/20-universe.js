// --------------------------------------------------------------- universe ---
// The whole research as a star chart: directions are sectors in the root note's
// order, topics stars on the inner ring, branches on the outer rings, brightness
// how recently their Current work moved. Below it, the same research as a list.

const CHART = { size: 1000, c: 500, r: 318, rings: [0.42, 0.66, 0.84, 0.97] };

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function glowOf(t) {
  const days = daysSince(t.latest && t.latest.date ? t.latest.date : t.date);
  return days <= 7 ? 0.62 : days <= 30 ? 0.34 : days <= 90 ? 0.14 : 0;
}

/** Sectors, stars, tree edges and labels for the chart, from the overview alone. */
function layoutUniverse(ov) {
  const { c, r, rings } = CHART;
  const leafMemo = new Map();
  const leaves = (id) => {
    if (leafMemo.has(id)) return leafMemo.get(id);
    const t = ov.topics[id];
    const n = t && t.children.length ? t.children.reduce((sum, k) => sum + leaves(k), 0) : 1;
    leafMemo.set(id, n);
    return n;
  };
  const sectors = ov.directions.map((d) => ({ key: d.slug, label: d.heading, color: directionColor(ov, d.slug), ids: d.topics }));
  const beyond = [...ov.other, ...ov.unreached];
  if (beyond.length) sectors.push({ key: '__beyond', label: 'Beyond the directions', color: OTHER_COLOR, ids: beyond });
  const weightOf = (s) => Math.max(0.9, s.ids.reduce((sum, id) => sum + leaves(id), 0));
  const total = sectors.reduce((sum, s) => sum + weightOf(s), 0) || 1;
  const gap = sectors.length > 1 ? 0.045 : 0;
  const span = Math.PI * 2 - gap * sectors.length;
  const stars = [];
  const edges = [];
  const place = (id, a0, a1, depth, sector, parent) => {
    const t = ov.topics[id];
    if (!t) return;
    const theta = (a0 + a1) / 2;
    const radius = r * rings[Math.min(depth, rings.length - 1)];
    const star = {
      id, t, depth, theta, sector: sector.key, color: sector.color, parent: parent ? parent.id : '',
      x: c + radius * Math.cos(theta), y: c + radius * Math.sin(theta),
      size: depth === 0 ? 6.5 + Math.min(4, t.threads / 2.5) : depth === 1 ? 4.4 + Math.min(1.6, t.threads / 4) : 3.3,
      glow: glowOf(t),
    };
    stars.push(star);
    if (parent) edges.push({ from: parent, to: star, color: sector.color });
    const sum = t.children.reduce((n, k) => n + leaves(k), 0);
    let a = a0;
    for (const k of t.children) {
      const share = ((a1 - a0) * leaves(k)) / sum;
      place(k, a, a + share, depth + 1, sector, star);
      a += share;
    }
  };
  let angle = -Math.PI / 2 + gap / 2;
  for (const s of sectors) {
    const w = (weightOf(s) / total) * span;
    s.a0 = angle;
    s.a1 = angle + w;
    const sum = s.ids.reduce((n, id) => n + leaves(id), 0) || 1;
    let a = s.a0;
    for (const id of s.ids) {
      const share = (w * leaves(id)) / sum;
      place(id, a, a + share, 0, s, null);
      a += share;
    }
    angle += w + gap;
  }
  // Labels for the inner-ring topics, at the rim, most recently active first; one that would collide is left to the tooltip.
  const boxes = [];
  const labels = [];
  const firsts = stars.filter((s) => s.depth === 0).sort((a, b) => b.glow - a.glow || b.t.threads - a.t.threads);
  for (const s of firsts) {
    const text = shortTitle(s.t.title, 24);
    const cos = Math.cos(s.theta);
    const sin = Math.sin(s.theta);
    const lr = r + 20;
    const x = c + lr * cos;
    const y = c + lr * sin + 4;
    const anchor = cos > 0.2 ? 'start' : cos < -0.2 ? 'end' : 'middle';
    const width = text.length * 6.3;
    const left = anchor === 'start' ? x : anchor === 'end' ? x - width : x - width / 2;
    const top = y + (anchor === 'middle' ? (sin < 0 ? -8 : 8) : 0) - 11;
    const box = { left: left - 3, right: left + width + 3, top: top - 2, bottom: top + 15 };
    if (box.left < 4 || box.right > CHART.size - 4 || boxes.some((b) => !(box.right < b.left || box.left > b.right || box.bottom < b.top || box.top > b.bottom))) continue;
    boxes.push(box);
    labels.push({ id: s.id, text, x, y: y + (anchor === 'middle' ? (sin < 0 ? -8 : 8) : 0), anchor, star: s });
  }
  return { sectors, stars, edges, labels };
}

function StarChart({ ov, go, dim, focusSector, onFocusSector }) {
  const layout = useMemo(() => layoutUniverse(ov), [ov]);
  const byId = useMemo(() => new Map(layout.stars.map((s) => [s.id, s])), [layout]);
  const field = useMemo(() => {
    const rand = mulberry32(20261115);
    return Array.from({ length: 280 }, () => ({ x: rand() * CHART.size, y: rand() * CHART.size, r: 0.3 + rand() * 1.1, o: 0.1 + rand() * 0.5 }));
  }, []);
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const [width, setWidth] = useState(640);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 640));
    ro.observe(el);
    setWidth(el.clientWidth || 640);
    return () => ro.disconnect();
  }, []);
  const related = useMemo(() => {
    if (!hover) return null;
    const set = new Set([hover]);
    for (let s = byId.get(hover); s && s.parent; s = byId.get(s.parent)) set.add(s.parent);
    const down = (id) => {
      const t = ov.topics[id];
      if (t) for (const k of t.children) {
        set.add(k);
        down(k);
      }
    };
    down(hover);
    for (const [a, b] of ov.web) {
      if (a === hover) set.add(b);
      if (b === hover) set.add(a);
    }
    return set;
  }, [hover, byId, ov]);
  const faded = (s) => (related && !related.has(s.id)) || (focusSector && s.sector !== focusSector) || (dim && !dim.has(s.id));
  const { c, r, rings } = CHART;
  const scale = width / CHART.size;
  const hovered = hover ? byId.get(hover) : null;
  const arcPath = (a0, a1, radius) => {
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${c + radius * Math.cos(a0)} ${c + radius * Math.sin(a0)} A ${radius} ${radius} 0 ${large} 1 ${c + radius * Math.cos(a1)} ${c + radius * Math.sin(a1)}`;
  };
  const gradients = [...new Set(layout.stars.map((s) => s.color))];
  const open = (s) => go({ view: 'doc', path: s.t.file });
  return h('div', { className: 'atlas-chart', ref: box },
    h('svg', { viewBox: `0 0 ${CHART.size} ${CHART.size}`, role: 'group', 'aria-label': `Star chart of ${plural(ov.counts.topics, 'topic')} in ${plural(ov.directions.length, 'direction')}`, onMouseLeave: () => setHover(null) },
      h('defs', null,
        h('radialGradient', { id: 'atlas-core' }, h('stop', { offset: '0', stopColor: '#fff4d6', stopOpacity: 0.95 }), h('stop', { offset: '0.35', stopColor: '#ffd27a', stopOpacity: 0.55 }), h('stop', { offset: '1', stopColor: '#ff9f43', stopOpacity: 0 })),
        h('radialGradient', { id: 'atlas-nebula', cx: '50%', cy: '50%', r: '50%' }, h('stop', { offset: '0', stopColor: '#2a3a78', stopOpacity: 0.35 }), h('stop', { offset: '1', stopColor: '#0b1020', stopOpacity: 0 })),
        gradients.map((color, i) => h('radialGradient', { key: color, id: `atlas-glow-${i}` }, h('stop', { offset: '0', stopColor: color, stopOpacity: 0.9 }), h('stop', { offset: '1', stopColor: color, stopOpacity: 0 })))),
      h('circle', { cx: c, cy: c, r: r * 1.12, fill: 'url(#atlas-nebula)' }),
      h('g', { className: 'atlas-starfield', 'aria-hidden': true }, field.map((f, i) => h('circle', { key: i, cx: f.x, cy: f.y, r: f.r, fill: '#dfe6ff', opacity: f.o }))),
      h('g', { className: 'atlas-grid', 'aria-hidden': true },
        rings.slice(0, 3).map((k) => h('circle', { key: k, cx: c, cy: c, r: r * k, fill: 'none' })),
        Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return h('line', { key: i, x1: c + 34 * Math.cos(a), y1: c + 34 * Math.sin(a), x2: c + r * Math.cos(a), y2: c + r * Math.sin(a) });
        })),
      h('g', { className: 'atlas-sectors' }, layout.sectors.filter((s) => s.a1 > s.a0).map((s) => h('path', {
        key: s.key, d: arcPath(s.a0, s.a1, r + 7), stroke: s.color, className: cx('atlas-sector', focusSector && focusSector !== s.key && 'is-faded'),
        onMouseEnter: () => onFocusSector && onFocusSector(s.key), onMouseLeave: () => onFocusSector && onFocusSector(null),
      }, h('title', null, s.label)))),
      h('g', { className: 'atlas-web', 'aria-hidden': true }, ov.web.map(([a, b]) => {
        const p = byId.get(a);
        const q = byId.get(b);
        if (!p || !q) return null;
        const lit = hover && (a === hover || b === hover);
        // Connections across directions are always drawn; those within one direction appear for the star in focus.
        if (!lit && p.sector === q.sector) return null;
        const mx = c + ((p.x + q.x) / 2 - c) * 0.35;
        const my = c + ((p.y + q.y) / 2 - c) * 0.35;
        return h('path', { key: a + '|' + b, d: `M ${p.x} ${p.y} Q ${mx} ${my} ${q.x} ${q.y}`, className: cx('atlas-link-arc', lit && 'is-lit', (focusSector || (related && !lit)) && 'is-faded') });
      })),
      h('g', { className: 'atlas-edges', 'aria-hidden': true }, layout.edges.map((e) => h('line', { key: e.to.id, x1: e.from.x, y1: e.from.y, x2: e.to.x, y2: e.to.y, stroke: e.color, className: cx('atlas-edge', (faded(e.to) || faded(e.from)) && 'is-faded') }))),
      h('g', { className: 'atlas-spokes', 'aria-hidden': true }, layout.stars.filter((s) => s.depth === 0).map((s) => h('line', { key: s.id, x1: c, y1: c, x2: s.x, y2: s.y, className: cx('atlas-spoke', faded(s) && 'is-faded') }))),
      h('g', { className: 'atlas-core', role: 'button', tabIndex: 0, 'aria-label': `Root note: ${ov.title}`, onClick: () => go({ view: 'doc', path: ov.rootFile }), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go({ view: 'doc', path: ov.rootFile }); } } },
        h('circle', { cx: c, cy: c, r: 44, fill: 'url(#atlas-core)' }),
        h('circle', { cx: c, cy: c, r: 9, fill: '#fff6dd' }),
        h('title', null, ov.title)),
      h('g', { className: 'atlas-stars' }, layout.stars.map((s) => {
        const gi = gradients.indexOf(s.color);
        const lit = hover === s.id;
        return h('g', {
          key: s.id, className: cx('atlas-star', faded(s) && 'is-faded', lit && 'is-lit'), role: 'button', tabIndex: 0,
          'aria-label': `${s.t.title}${s.t.latest ? `; latest: ${s.t.latest.name}, ${s.t.latest.date}` : ''}`,
          onMouseEnter: () => setHover(s.id), onFocus: () => setHover(s.id), onBlur: () => setHover(null),
          onClick: () => open(s), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(s); } },
        },
          s.glow ? h('circle', { cx: s.x, cy: s.y, r: s.size * 4.2, fill: `url(#atlas-glow-${gi})`, opacity: s.glow }) : null,
          h('circle', { cx: s.x, cy: s.y, r: s.size + 2, className: 'atlas-star-ring', strokeDasharray: s.t.reached ? undefined : '2 2' }),
          h('circle', { cx: s.x, cy: s.y, r: s.size, fill: s.color }),
          h('circle', { cx: s.x, cy: s.y, r: Math.max(12, s.size + 6), fill: 'transparent' }));
      })),
      h('g', { className: 'atlas-labels' }, layout.labels.map((l) => h('g', { key: l.id, className: cx('atlas-chart-label', faded(l.star) && 'is-faded'), 'aria-hidden': true },
        h('line', { x1: l.star.x, y1: l.star.y, x2: c + (r + 12) * Math.cos(l.star.theta), y2: c + (r + 12) * Math.sin(l.star.theta), className: 'atlas-leader' }),
        h('text', { x: l.x, y: l.y, textAnchor: l.anchor }, l.text))))),
    hovered ? h(StarTip, { s: hovered, ov, left: hovered.x * scale, top: hovered.y * scale, width }) : null);
}

function StarTip({ s, ov, left, top, width }) {
  const t = s.t;
  const dir = ov.directions.find((d) => d.slug === topicDirection(ov, t.id));
  const flip = left > width * 0.55;
  const counts = t.counts || {};
  const facts = [['notes', 'note'], ['papers', 'paper'], ['branches', 'branch']].filter(([k]) => counts[k]).map(([k, one]) => plural(counts[k], one, one === 'branch' ? 'branches' : undefined));
  return h('div', { className: 'atlas-tip', style: { left: flip ? undefined : left + 16, right: flip ? width - left + 16 : undefined, top: Math.max(8, top - 24) }, role: 'tooltip' },
    dir ? h('div', { className: 'atlas-tip-dir' }, h('span', { className: 'atlas-dot', style: { background: s.color } }), dir.heading) : null,
    h('div', { className: 'atlas-tip-title' }, t.title),
    t.context || t.lead ? h('div', { className: 'atlas-tip-text' }, t.context || t.lead) : null,
    t.latest ? h('div', { className: 'atlas-tip-latest' }, h(StatusTag, { status: t.latest.status }), h('span', null, t.latest.name), h('span', { className: 'atlas-date' }, t.latest.date)) : null,
    facts.length ? h('div', { className: 'atlas-tip-facts' }, facts.join(' · ')) : null,
    t.reached ? null : h('div', { className: 'atlas-tip-facts' }, 'Not linked from the root or its parent note'));
}

function UniverseView({ overview: ov, go, filter, flash }) {
  const words = useWords(filter);
  const [focusSector, setFocusSector] = useState(null);
  const dim = useMemo(() => {
    if (words.length === 0) return null;
    const hit = new Set();
    for (const t of Object.values(ov.topics)) if (matches(words, t.title, t.lead, t.context, t.latest && t.latest.name)) hit.add(t.id);
    return hit;
  }, [ov, words]);
  const navigate = useNavigate(go, flash);
  usePublishFocus({ kind: 'universe', topic: { id: '', title: ov.title || 'Root note', path: ov.rootFile } }, [ov.rootFile, ov.title]);
  const total = ov.counts;
  const stats = [[total.topics, 'topics'], [ov.directions.length, 'directions'], [total.papers, 'papers'], [total.entries, 'knowledge entries']];
  const activity = ov.timeline.slice(0, 14);
  return h('div', { className: 'atlas-page is-wide' },
    h('header', { className: 'atlas-hero' },
      h('div', { className: 'atlas-hero-text' },
        h('p', { className: 'atlas-kicker' }, 'Research universe'),
        h('h1', null, ov.title),
        ov.lead ? h('p', { className: 'atlas-lede' }, ov.lead) : null,
        h('dl', { className: 'atlas-stats' }, stats.map(([n, label]) => h('div', { key: label }, h('dt', null, label), h('dd', null, n))))),
      h('div', { className: 'atlas-hero-actions' },
        h(AskMenu, { asks: [
          { key: 'next', label: 'What should I work on next?', hint: 'Across all directions', prompt: 'Look across my research programme and tell me which topic most deserves the next session, and why.' },
          { key: 'continue', label: 'Continue the research', hint: 'Resume the authorized task', prompt: 'Continue the research.' },
          { key: 'idea', label: 'Develop a new idea', hint: 'From a seed to a concrete project', prompt: "I have a research idea I'd like to develop into a concrete project. Let's brainstorm it: I'll describe it next." },
          { key: 'learn', label: 'Learn a topic', hint: 'Guided study with derivations', prompt: "I want to learn a topic in depth, with derivations and figures. I'll name it next; start from what I already know." },
          { key: 'review', label: 'Review this week', hint: 'The independent review across sessions', prompt: "Review this week's research sessions against the notes: what was decided, what was left unrecorded, what a later session contradicted." },
        ] }),
        h(Button, { quiet: true, icon: 'note', onClick: () => go({ view: 'doc', path: ov.rootFile }) }, 'Root note'))),
    h('section', { className: 'atlas-universe' },
      h(StarChart, { ov, go, dim, focusSector, onFocusSector: setFocusSector }),
      h('aside', { className: 'atlas-pulse', 'aria-label': 'Activity' },
        h(WaitingList, { ov, go, compact: true, limit: 4 }),
        h('h2', null, 'Recent activity'),
        activity.length === 0 ? h(Empty, null, 'No dated Current work entries yet.') : null,
        h('ol', null, activity.map((e, i) => {
          const t = ov.topics[e.id];
          const color = e.id === '' ? '#fff0c2' : directionColor(ov, topicDirection(ov, e.id));
          return h('li', { key: i }, h('button', { type: 'button', className: 'atlas-pulse-row', onClick: () => t && go({ view: 'doc', path: t.file }) },
            h('span', { className: 'atlas-pulse-mark', style: { background: color } }),
            h('span', { className: 'atlas-date' }, e.date),
            h('span', { className: 'atlas-pulse-topic' }, t ? shortTitle(t.title, 30) : 'Root note'),
            h('span', { className: 'atlas-pulse-name' }, e.name),
            e.status ? h(StatusTag, { status: e.status }) : null));
        })),
        h(Discussions, { match: () => true, title: 'Discussions', compact: true, limit: 5 }))),
    h('div', { className: 'atlas-legend', role: 'list', 'aria-label': 'Directions' },
      ov.directions.map((d) => h('button', {
        key: d.slug, type: 'button', role: 'listitem', className: cx('atlas-legend-item', focusSector === d.slug && 'is-on'),
        onMouseEnter: () => setFocusSector(d.slug), onMouseLeave: () => setFocusSector(null), onFocus: () => setFocusSector(d.slug), onBlur: () => setFocusSector(null),
        onClick: () => { const el = document.getElementById('atlas-dir-' + d.slug); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
      }, h('span', { className: 'atlas-dot', style: { background: directionColor(ov, d.slug) } }), h('span', null, d.heading.replace(/^\d+\.\s*/, '')), h('span', { className: 'atlas-count' }, d.topics.length))),
      ov.other.length + ov.unreached.length ? h('span', { className: 'atlas-legend-item is-static' }, h('span', { className: 'atlas-dot', style: { background: OTHER_COLOR } }), 'Beyond the directions') : null,
      h('span', { className: 'atlas-legend-note' }, 'Brightness: Current work in the last week, month, quarter · dashed ring: not linked')),
    ov.directions.map((d) => h(DirectionSection, { key: d.slug, d, ov, go, words, navigate })),
    h(TopicGroup, { title: 'Other topics', note: 'Linked from the root, outside its directions.', ids: ov.other, ov, go, words }),
    h(TopicGroup, { title: 'Not linked from the root', note: 'A folder scan found these notes; no link from the root reaches them.', ids: ov.unreached, ov, go, words }),
    words.length ? null : h('section', { className: 'atlas-root-sections' },
      h('h2', null, 'From the root note'),
      ov.beside.map((s) => h(Fold, { key: s.slug, id: 'root#' + s.slug, title: s.heading, count: s.isCurrentWork ? ov.rootThreads.length : undefined, icon: s.isCurrentWork ? 'spark' : 'note' }, () => (s.isCurrentWork
        ? h(ThreadList, { threads: ov.rootThreads, baseFile: ov.rootFile, navigate, bare: true })
        : h(Markdown, { text: s.markdown, baseFile: ov.rootFile, onNavigate: navigate }))))));
}

function DirectionSection({ d, ov, go, words, navigate }) {
  const color = directionColor(ov, d.slug);
  const ids = d.topics.filter((id) => matches(words, ...subtreeText(ov, id)));
  if (words.length && ids.length === 0) return null;
  return h('section', { className: 'atlas-direction', id: 'atlas-dir-' + d.slug, style: { '--dir': color } },
    h('header', { className: 'atlas-direction-head' },
      h('span', { className: 'atlas-direction-bar', 'aria-hidden': true }),
      h('div', null, h('h2', null, d.heading), d.lead && !words.length ? h('p', { className: 'atlas-direction-lead' }, d.lead) : null)),
    ids.length ? h('div', { className: 'atlas-cards' }, ids.map((id) => h(TopicCard, { key: id, t: ov.topics[id], ov, go }))) : null,
    d.markdown ? h(Fold, { id: 'root#' + d.slug, title: 'No topic serves this direction yet — read it' }, () => h(Markdown, { text: d.markdown, baseFile: ov.rootFile, onNavigate: navigate })) : null);
}

function subtreeText(ov, id) {
  const out = [];
  const walk = (k) => {
    const t = ov.topics[k];
    if (!t) return;
    out.push(t.title, t.lead, t.context, t.latest && t.latest.name);
    t.children.forEach(walk);
  };
  walk(id);
  return out;
}

function TopicGroup({ title, note, ids, ov, go, words }) {
  const list = ids.filter((id) => matches(words, ...subtreeText(ov, id)));
  if (list.length === 0) return null;
  return h('section', { className: 'atlas-direction is-quiet', style: { '--dir': OTHER_COLOR } },
    h('header', { className: 'atlas-direction-head' }, h('span', { className: 'atlas-direction-bar', 'aria-hidden': true }), h('div', null, h('h2', null, title), h('p', { className: 'atlas-direction-lead' }, note))),
    h('div', { className: 'atlas-cards' }, list.map((id) => h(TopicCard, { key: id, t: ov.topics[id], ov, go }))));
}

const COUNT_ORDER = [['branches', 'branch'], ['notes', 'note'], ['papers', 'paper'], ['writing', 'writing'], ['reports', 'report'], ['code', 'code'], ['data', 'data']];

function TopicCard({ t, ov, go }) {
  const color = directionColor(ov, topicDirection(ov, t.id));
  const counts = t.counts || {};
  return h('button', { type: 'button', className: 'atlas-card', style: { '--dir': color }, onClick: () => go({ view: 'doc', path: t.file }) },
    h('span', { className: 'atlas-card-head' },
      h('span', { className: 'atlas-dot is-star', style: { background: color, boxShadow: glowOf(t) ? `0 0 ${6 + glowOf(t) * 14}px ${color}` : 'none' } }),
      h('span', { className: 'atlas-card-title' }, t.title)),
    t.context || t.lead ? h('span', { className: 'atlas-card-text' }, t.context || t.lead) : null,
    t.latest ? h('span', { className: 'atlas-card-latest' }, t.latest.status ? h(StatusTag, { status: t.latest.status }) : null, h('span', { className: 'atlas-card-thread' }, t.latest.name)) : null,
    h('span', { className: 'atlas-card-foot' },
      h('span', { className: 'atlas-card-counts' }, COUNT_ORDER.filter(([k]) => counts[k]).map(([k, icon]) => h('span', { key: k, title: `${counts[k]} ${k}` }, h(Icon, { name: GROUP_ICON[k] || icon, size: 13 }), counts[k]))),
      t.reached ? null : h(Chip, { dot: '#fab219' }, 'unlinked'),
      h('span', { className: 'atlas-date', title: t.dated === 'entry' ? 'Newest Current work entry' : 'When the note last changed' }, t.date)));
}
