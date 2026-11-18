// Desk window onto the Map. All drawing coordinates (including exclusions and
// label boxes) belong to the layout, not to mouse position, Date.now or the DOM.
function layoutDeskSky(ov, { paneWidth = 1120, hasDraft = false } = {}) {
  const bandHeight = paneWidth < 900 || !hasDraft ? 240 : 330;
  // At phone widths, keep the readable greeting above the dome rather than
  // shrinking it to an illegible SVG label. Reserve the horizon underlap below.
  const stacked = paneWidth < 640;
  const skyHeight = stacked ? bandHeight - 108 : bandHeight;
  const scale = Math.min(Math.max(1, paneWidth) / 1000, skyHeight / 330);
  const greetingWidth = paneWidth >= 900 ? 400 : 320;
  const w = Math.max(360, stacked ? 0 : greetingWidth / scale), h = Math.max(110, stacked ? 0 : 76 / scale);
  const keepOut = { left: 500 - w / 2, right: 500 + w / 2, top: 188 - h / 2, bottom: 188 + h / 2 };
  const g = atlasChartLayout(ov, { width: 1000, height: 330, hitRadius: Math.ceil(12 / scale), cx: 500, cy: 312, rx: 440, ry: 270, start: Math.PI, span: Math.PI, keepOut });
  let seed = 1 + g.stars.length;
  const unit = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const dust = [];
  while (dust.length < 12) {
    const x = 20 + 960 * unit(), y = 12 + 285 * unit(), r = 0.7 + 0.4 * unit();
    if (x + r < keepOut.left || x - r > keepOut.right || y + r < keepOut.top || y - r > keepOut.bottom) dust.push({ x, y, r });
  }
  // The wide composer can cover even the outer rays when the SVG is letterboxed.
  // Lift the art (not the horizon-overlapping composer) just enough that a
  // whole star is above its top edge, including in a very dense first sector.
  const skyBottom = stacked ? 34 : Math.max(0, 34 - (330 - 312 - 3) * scale);
  return { ...g, dust, bandHeight, skyHeight, skyBottom, scale, stacked, greetingWidth, greetingY: bandHeight - skyBottom - (330 - 188) * scale, showNames: paneWidth >= 900 };
}

function DeskSky({ ov, go, hasDraft, onDiscuss }) {
  const host = useRef(null), card = useAtlasStarCard(host), id = React.useId();
  const [width, setWidth] = useState(1120);
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    const readWidth = () => { if (el.clientWidth) setWidth(el.clientWidth); };
    readWidth();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(readWidth); ro.observe(el); return () => ro.disconnect();
  }, []);
  const g = useMemo(() => layoutDeskSky(ov, { paneWidth: width, hasDraft }), [ov, width, hasDraft]);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const hour = now.getHours(), greeting = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
  const date = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const open = (s, e) => go({ view: 'doc', path: s.t.file }, e);
  return h('div', { className: cx('atlas-desk-sky', !g.showNames && 'is-narrow', g.stacked && 'is-stacked'), style: { height: g.bandHeight }, ref: host, onKeyDown: card.dismiss },
    h('svg', { viewBox: '0 0 1000 330', preserveAspectRatio: 'xMidYMax meet', role: 'group', 'aria-label': `Research sky, ${plural(g.stars.length, 'topic')}. The topic picker lists the same topics.`, style: { height: g.skyHeight, bottom: g.skyBottom } },
      h('defs', null, h('radialGradient', { id: id + '-sun', cx: '50%', cy: '100%', r: '62%' }, h('stop', { offset: 0, stopColor: 'var(--accent)', stopOpacity: 0.16 }), h('stop', { offset: 1, stopColor: 'var(--accent)', stopOpacity: 0 }))),
      h('rect', { width: 1000, height: 330, fill: `url(#${id}-sun)` }),
      h('g', { 'aria-hidden': true, fill: 'var(--star)', opacity: 0.35 }, g.dust.map((d, i) => h('circle', { key: i, cx: d.x, cy: d.y, r: d.r }))),
      h('g', { 'aria-hidden': true, stroke: 'var(--sky-line-2)' }, h('line', { x1: 20, y1: 312, x2: 980, y2: 312 }), Array.from({ length: 9 }, (_, i) => h('line', { key: i, x1: 60 + i * 110, x2: 60 + i * 110, y1: 312, y2: i === 4 ? 303 : 306 }))),
      h(ChartMarks, { g, ov, onOpen: open, onPoint: card.point, onLeave: card.leave, onInspect: card.inspect, hoverSector: card.tip?.star.sector })),
    h('header', { className: 'atlas-desk-greeting', style: g.stacked ? undefined : { top: g.greetingY, width: g.greetingWidth } }, h('p', { title: `${ov.title} · ${date}` }, `${ov.title} · ${date}`), h('h1', null, greeting)),
    h(ChartCard, { state: card, onOpen: open, onDiscuss }));
}
