// --------------------------------------------------------------- shared UI ---

const ICONS = {
  universe: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 0 0 0-17zM3.5 12h17M12 3.5c2.6 2.3 3.9 5.1 3.9 8.5s-1.3 6.2-3.9 8.5c-2.6-2.3-3.9-5.1-3.9-8.5s1.3-6.2 3.9-8.5z',
  library: 'M5 4h3v16H5zM10 4h3v16h-3zM15.2 4.6l2.9-.8 3.6 15.4-2.9.8z',
  note: 'M6 3.5h8l4 4V20.5H6zM14 3.5v4h4M9 12h6M9 15.5h6',
  paper: 'M6 3.5h8l4 4V20.5H6zM14 3.5v4h4M8.8 16.5l2-6 2 6M9.5 14.5h2.6',
  writing: 'M19.5 4.5c-6 1-11 6-12.5 13l-1 3.5 3.5-1c7-1.5 12-6.5 13-12.5M6 21l5-5',
  desk: 'M3.5 18.5a8.5 8.5 0 0 1 17 0M2.5 18.5h19M12 10V6.5M7.5 12.3 5.7 10.5M16.5 12.3l1.8-1.8',
  chat: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-9l-4.5 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  mark: 'M12 3.5a8.5 8.5 0 1 0 .01 0zM12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22M4.64 16.25a8.5 3.2 -30 1 1 14.72-8.5a8.5 3.2 -30 1 1-14.72 8.5zM12 10a2 2 0 1 0 .01 0z',
  more: 'M5.5 11a1 1 0 1 0 .01 0zM12 11a1 1 0 1 0 .01 0zM18.5 11a1 1 0 1 0 .01 0z',
  chevron: 'm7 10 5 5 5-5', check: 'm5 12.5 4.5 4.5L19 7.5', send: 'M12 19V5M6.5 10.5 12 5l5.5 5.5',
  keyboard: 'M2.5 6h19v12h-19zM6 10h1m2 0h1m2 0h1m2 0h1M7 14h10',
  settings: 'M4 7h4m4 0h8M10 5v4M4 17h10m4 0h2M16 15v4',
  attach: 'M19.5 11.5 12 19a5 5 0 0 1-7-7l8.3-8.3a3.3 3.3 0 0 1 4.7 4.7L9.7 16.7a1.7 1.7 0 0 1-2.4-2.4L14.8 7',
  split: 'M3.5 5h17v14h-17zM12 5v14', move: 'M3.5 6h6l2 2h9v11h-17zM9.5 13h6m-2.5-2.5 2.5 2.5-2.5 2.5',
  collapse: 'M4 10h6V4m10 10h-6v6M3 3l7 7m11 11-7-7',
  report: 'M5 4.5h14v15H5zM8 15v-3M12 15V9M16 15v-5',
  code: 'M9 7l-5 5 5 5M15 7l5 5-5 5',
  data: 'M4 19.5h16M7 16.5v-4M11 16.5v-8M15 16.5v-6M19 16.5V6',
  knowledge: 'M12 4l8 4-8 4-8-4zM6 10.5v4.2c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.2',
  folder: 'M3.5 6.5h6l2 2h9v10h-17z',
  branch: 'M7 4v10M7 14a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM17 4a3 3 0 1 0 0 6a3 3 0 0 0 0-6zM17 10c0 4-4 4-10 4',
  topics: 'M5 12a2 2 0 1 0 0.01 0zM19 6a2 2 0 1 0 0.01 0zM19 18a2 2 0 1 0 0.01 0zM7 11l10-4M7 13l10 4',
  web: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 0 0 0-17zM3.5 12h17M12 3.5v17',
  edit: 'M4 20l4-1 10.5-10.5-3-3L5 16z',
  plus: 'M12 5v14M5 12h14',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  refresh: 'M19 8a7.5 7.5 0 1 0 1.5 6M19 3.5V8h-4.5',
  back: 'M15 5l-7 7 7 7',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 9.5a1.5 1.5 0 1 0 0.01 0z',
  close: 'M6 6l12 12M18 6L6 18',
  panel: 'M4 5h16v14H4zM14.5 5v14',
  activity: 'M3 12h4l2.5-6.5 5 13 2.5-6.5H21',
  learn: 'm4 16 11-6.5 2 3.4L6 19.4zM15 9.5l3.5-2 2 3.4-3.5 2M8.5 18l-1 3.5M11 16.5l2.5 5',
  search: 'M10.5 4a6.5 6.5 0 1 0 0 13a6.5 6.5 0 0 0 0-13zM15.4 15.4L20 20',
  team: 'M12 9.8a2.2 2.2 0 1 0 .01 0zM4.5 7.6a1.4 1.4 0 1 0 .01 0zM19 5.1a1.4 1.4 0 1 0 .01 0zM17.5 16.6a1.4 1.4 0 1 0 .01 0zM5.8 9.5l4.1 1.8M17.8 7.4l-4.2 3.3M16.4 17l-2.9-3.5',
  sun: 'M12 8.3a3.7 3.7 0 1 0 0 7.4a3.7 3.7 0 0 0 0-7.4zM12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5',
  moon: 'M19.6 14.6A7.8 7.8 0 0 1 9.4 4.4a7.8 7.8 0 1 0 10.2 10.2z',
  contrast: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 0 0 0-17zM12 3.5v17M12 7.5h4.5M12 11.5h7M12 15.5h5.5',
  expand: 'M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7',
};

function Icon({ name, size = 16, title }) {
  return h('svg', { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': title ? undefined : true, role: title ? 'img' : undefined, className: 'atlas-icon' },
    title ? h('title', null, title) : null,
    h('path', { d: ICONS[name] || ICONS.note }));
}

const GROUP_ICON = { branches: 'branch', notes: 'note', papers: 'paper', writing: 'writing', reports: 'report', code: 'code', data: 'data', knowledge: 'knowledge', topics: 'topics', folders: 'folder', web: 'web' };
const TYPE_ICON = { markdown: 'note', pdf: 'paper', tex: 'writing', bib: 'writing', code: 'code', notebook: 'code', image: 'image', video: 'data', audio: 'data', table: 'data', text: 'note', folder: 'folder', topic: 'topics', arxiv: 'paper', doi: 'paper', url: 'web' };

/** A small tag; `dot` adds a colored marker beside ink-colored text. */
function Chip({ children, dot, tone, variant, auto, selected, contextKey, onClick, className, ...props }) {
  return h(onClick ? 'button' : 'span', { ...props, type: onClick ? 'button' : undefined, onClick,
    'aria-pressed': onClick && selected !== undefined ? selected : undefined,
    className: cx('atlas-chip', tone && 'is-' + tone, variant && 'atlas-chip-' + variant, auto && 'atlas-chip-auto', className) },
    dot ? h('span', { className: 'atlas-dot', style: { background: dot }, 'aria-hidden': true }) : null,
    contextKey ? h('span', { className: 'atlas-chip-key' }, contextKey) : null, children,
    auto ? h('em', { className: 'atlas-chip-auto-label' }, 'auto') : null);
}

const STATUS_DOT = { concluded: 'var(--status-done)', done: 'var(--status-done)', agreed: 'var(--status-done)', waiting: 'var(--status-waiting)', blocked: 'var(--status-blocked)', active: 'var(--status-active)', running: 'var(--status-active)', proposed: 'var(--status-proposed)' };
/** A status word with a marker; the color never carries the meaning alone. */
function StatusTag({ status }) {
  if (!status) return null;
  const key = Object.keys(STATUS_DOT).find((k) => String(status).toLowerCase().startsWith(k));
  return h(Chip, { dot: key ? STATUS_DOT[key] : 'var(--status-other)' }, status);
}

function Button({ children, primary, small, icon, quiet, buttonRef, className, ...props }) {
  return h('button', { type: 'button', ...props, ref: buttonRef, className: cx('atlas-button', primary && 'is-primary', small && 'is-small', quiet && 'is-quiet', className) },
    icon ? h(Icon, { name: icon }) : null, children != null ? h('span', null, children) : null);
}

function TextButton({ children, className, ...props }) {
  return h('button', { type: 'button', ...props, className: cx('atlas-link', className) }, children);
}

function Empty({ children }) {
  return h(EmptyState, null, children);
}

function Loading({ label }) {
  return h('div', { className: 'atlas-page' }, h(Skeleton, { label: label || 'Reading the research…' }));
}

function WorkspaceSetup({ setup, onRetry }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const initialize = async () => {
    setBusy(true);
    setError('');
    try {
      await api('workspace/init', { method: 'POST', body: {} });
      onRetry();
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return h('section', { className: 'atlas-setup' },
    h('h2', null, 'Set up your research workspace'),
    setup.code === 'unconfigured' ? h(React.Fragment, null,
      h('p', null, 'Choose an existing folder on the machine running DSH. Set its absolute path in the profile’s ', h('code', null, 'cordis.patch.yml'), ' and restart DSH.'),
      h('pre', null, '- id: aitp-atlas\n  name: aitp-atlas\n  config:\n    root: /absolute/path/to/workspace'))
      : h(React.Fragment, null,
        h('p', null, 'Configured folder: ', h('code', null, setup.root)),
        setup.code === 'missing-note'
          ? h('p', null, 'Open an existing AITP workspace by restoring its ', h('code', null, 'research.md'), ' here, or initialize this folder with a starter note.')
          : h('p', null, setup.code === 'missing-folder' ? 'This folder is unavailable. Create it or update the profile’s root path and restart DSH.' : 'Atlas needs a readable research.md file at this path. Repair the existing entry and try again.')),
    h('div', { className: 'atlas-actions' },
      setup.code === 'missing-note' ? h(Button, { primary: true, disabled: busy, onClick: initialize }, busy ? 'Initializing…' : 'Initialize workspace') : null,
      h(Button, { quiet: true, disabled: busy, onClick: onRetry }, 'Read workspace again')),
    error ? h('p', { className: 'atlas-askbar-error', role: 'alert' }, error) : null);
}

function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return h('div', { className: 'atlas-page' },
    h('div', { className: 'atlas-error', role: 'alert' }, h('span', null, error.message || String(error)), onRetry ? h(TextButton, { onClick: onRetry }, 'Retry') : null));
}

class Boundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return h('div', { className: 'atlas-error', role: 'alert' }, 'Atlas could not draw this view: ', String(this.state.error.message || this.state.error), ' ',
        h(TextButton, { onClick: () => this.setState({ error: null }) }, 'Try again'));
    }
    return this.props.children;
  }
}

/** A relative link target as a file next to `baseFile`. */
function linkedFile(baseFile, target) {
  let decoded = target;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    decoded = target;
  }
  return joinPath(dirOf(baseFile), decoded.split('#')[0]);
}

/** Images inside running text, outside code: an in-app address for a figure, a link for anything else. */
function inlineImages(text, baseFile) {
  if (!baseFile) return text;
  let fence = false;
  return text.split('\n').map((line) => {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (fence || /^\s*(```|~~~)/.test(line)) return line;
    return line.replace(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?[^)]*\)/g, (m, alt, target) => {
      if (/^(https?:|data:)/i.test(target)) return m;
      const file = linkedFile(baseFile, target);
      return typeOf(file) === 'image' ? `![${alt}](${rawUrl(file)})` : `[▣ ${alt || baseName(target)}](${target})`;
    });
  }).join('\n');
}

/**
 * A note as pieces: a line that is only an image becomes a figure Atlas draws itself (DSH's
 * renderer shows images as their alt text); lines that are only `<a id>` anchors are dropped,
 * since the renderer omits HTML; everything else stays Markdown.
 */
function markdownPieces(text, baseFile) {
  const out = [];
  let buffer = [];
  let fence = false;
  const flush = () => {
    if (buffer.join('').trim()) out.push({ text: inlineImages(buffer.join('\n'), baseFile) });
    buffer = [];
  };
  for (const line of String(text || '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    if (!fence && ANCHOR_ONLY_LINE.test(line)) continue;
    const image = !fence && baseFile && /^!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)\s*$/.exec(line);
    if (image && !/^(https?:|data:)/i.test(image[2])) {
      const file = linkedFile(baseFile, image[2]);
      if (typeOf(file) === 'image') {
        flush();
        out.push({ figure: true, file, src: rawUrl(file), alt: image[1] });
        continue;
      }
    }
    buffer.push(line);
  }
  flush();
  return out;
}

/**
 * DSH's renderer passes a relative link to `openFile` without its `#fragment` (only `#L12` line
 * references survive). Encoding the `#` keeps a section link intact through it; `openFile` below
 * splits it again. Line references and absolute URLs are left as written.
 */
function encodeFragments(text) {
  let fence = false;
  return String(text || '').split('\n').map((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      return line;
    }
    if (fence) return line;
    return line.replace(/\]\(\s*(<[^>]*>|[^)\s]+)/g, (match, target) => {
      const angled = target.startsWith('<');
      const raw = angled ? target.slice(1, -1) : target;
      const hash = raw.indexOf('#');
      if (hash < 0 || /^[a-z][a-z0-9+.-]*:/i.test(raw) || /^L\d+(?:-L\d+)?$/.test(raw.slice(hash + 1))) return match;
      const encoded = raw.slice(0, hash) + '%23' + raw.slice(hash + 1);
      return '](' + (angled ? '<' + encoded + '>' : encoded);
    });
  }).join('\n');
}

/** What DSH's renderer needs to make a note's links and figures work inside Atlas. */
function useMarkdownDelegate(baseFile, onNavigate) {
  return useMemo(() => {
    if (!baseFile) return null;
    const fileOf = (target) => joinPath(dirOf(baseFile), String(target || '').split('#')[0]);
    return {
      openFile: onNavigate
        ? (target, options) => {
          const text = String(target || '');
          const hash = text.indexOf('#');
          const rel = hash < 0 ? text : text.slice(0, hash);
          const anchor = hash >= 0 ? text.slice(hash + 1) : options && options.line ? 'L' + options.line : '';
          onNavigate({ path: rel ? joinPath(dirOf(baseFile), rel) : baseFile, anchor });
        }
        : undefined,
      // A paper's web address opens in a tab (read in Atlas); any other site in the browser.
      openExternalLink: (url) => (onNavigate && paperLink(url) ? onNavigate({ url }) : window.open(url, '_blank', 'noopener')),
      fileImages: {
        resolve: (target) => (typeOf(fileOf(target)) === 'image' ? rawUrl(fileOf(target)) : undefined),
        labels: { loading: 'Loading the figure…', failed: 'The figure could not be loaded' },
      },
    };
  }, [baseFile, onNavigate]);
}

/**
 * The strings DSH's Markdown renderer needs: a code block's copy and wrap controls, and the heading of
 * footnotes. DSH's own views pass theirs; without them any note with a fenced code block or a footnote
 * failed to draw ("Cannot read properties of undefined (reading 'code')"). One constant keeps the
 * memoized renderer from redrawing.
 */
const MARKDOWN_LABELS = {
  code: { copyLabel: 'Copy', copiedLabel: 'Copied', toolbarLabels: { codeLabel: 'Code', wrapLabel: 'Wrap lines', unwrapLabel: 'Do not wrap lines' } },
  footnotes: 'Footnotes',
};

/** Markdown with equations, rendered by DSH; relative links and figures resolve against `baseFile`. */
function Markdown({ text, baseFile, onNavigate, compact }) {
  const pieces = useMemo(() => markdownPieces(encodeFragments(text), baseFile), [text, baseFile]);
  const delegate = useMarkdownDelegate(baseFile, onNavigate);
  const onClick = (event) => {
    const anchor = event.target && event.target.closest ? event.target.closest('a') : null;
    if (!anchor) return;
    const href = anchor.getAttribute('href') || '';
    event.preventDefault();
    event.stopPropagation();
    if (/^https?:/i.test(href)) {
      if (onNavigate && paperLink(href)) onNavigate({ url: href });
      else window.open(href, '_blank', 'noopener');
      return;
    }
    if (href.startsWith(API)) return;
    if (!baseFile || !onNavigate) return;
    // A fragment alone points inside this note: navigate to the same file at that section.
    if (href.startsWith('#')) {
      onNavigate({ path: baseFile, anchor: href.slice(1) });
      return;
    }
    const [target, part] = href.split('#');
    let decoded = target;
    try {
      decoded = decodeURIComponent(target);
    } catch {
      decoded = target;
    }
    onNavigate({ path: joinPath(dirOf(baseFile), decoded), anchor: part || '' });
  };
  const body = pieces.map((piece, i) => {
    if (piece.figure) {
      return h('figure', { key: i, className: 'atlas-md-figure' },
        h('img', { src: piece.src, alt: piece.alt, loading: 'lazy', title: onNavigate ? 'Open the figure' : piece.alt, onClick: onNavigate ? () => onNavigate({ path: piece.file, anchor: '' }) : undefined }));
    }
    if (!primitives.MarkdownText) return h('div', { key: i, className: 'atlas-plain' }, piece.text);
    const rendered = h(primitives.MarkdownText, { text: piece.text, variant: 'body', omitHtml: true, labels: MARKDOWN_LABELS });
    return h(Boundary, { key: i }, delegate && primitives.MarkdownDelegateProvider ? h(primitives.MarkdownDelegateProvider, delegate, rendered) : rendered);
  });
  return h('div', { className: cx('atlas-markdown', compact && 'is-compact'), onClickCapture: onClick }, body);
}

/** A link fragment as a note writes it: without `#`, decoded, lower-cased. */
function normalizeAnchor(anchor) {
  let text = String(anchor || '').replace(/^#/, '');
  try {
    text = decodeURIComponent(text);
  } catch {
    // keep the fragment as written
  }
  return text.trim().toLowerCase();
}

/** The GitHub-style slug that notes link to: inline Markdown and punctuation dropped, spaces as hyphens. */
function headingSlug(text) {
  return String(text || '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[((?:[^\[\]]|\[[^\]]*\])*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*`]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

const ANCHOR_ONLY_LINE = /^\s*(?:<a\s+(?:id|name)="[^"]*"\s*>\s*<\/a>\s*)+$/i;

/**
 * Where a link fragment points in a Markdown text: the heading whose slug it is, or the place of
 * an explicit `<a id>` (the heading right after it, otherwise the section it sits in). `section`
 * counts `##` sections (−1 before the first), `heading` counts every heading, and `sub` is the
 * target's place among the headings of its `##` section (0 for the section heading itself).
 */
function anchorTarget(text, anchor) {
  const wanted = normalizeAnchor(anchor);
  if (!wanted) return null;
  let fence = false;
  let section = -1;
  let heading = -1;
  let sectionHeading = -1;
  let pending = false;
  const here = () => ({ section, heading, sub: section < 0 ? 0 : heading - sectionHeading });
  for (const line of String(text || '').split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      continue;
    }
    if (fence) continue;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) {
      heading += 1;
      if (match[1].length === 2) {
        section += 1;
        sectionHeading = heading;
      }
      if (pending || headingSlug(match[2]) === wanted) return here();
      continue;
    }
    if (pending && line.trim() && !ANCHOR_ONLY_LINE.test(line)) return here();
    for (const id of line.matchAll(/<a\s+(?:id|name)="([^"]+)"/gi)) if (id[1].toLowerCase() === wanted) pending = true;
  }
  return pending ? here() : null;
}

/** The nth heading rendered inside an element. */
function nthHeading(element, n) {
  if (!element || n < 0) return null;
  return element.querySelectorAll('h1, h2, h3, h4, h5, h6')[n] || null;
}

/** Scroll an element into view and mark it for a moment, so the eye lands where the link pointed. */
function revealElement(element) {
  if (!element || !element.scrollIntoView) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  element.classList.remove('atlas-target');
  void element.offsetWidth;
  element.classList.add('atlas-target');
  setTimeout(() => element.classList.remove('atlas-target'), 1900);
}

/** A section that opens on demand; `children` may be a function, rendered only when open. A changed `reveal` opens it. */
function Fold({ id, title, count, children, defaultOpen, icon, reveal, domId }) {
  const [open, setOpen] = useState(() => storageGet('fold:' + id, Boolean(defaultOpen)));
  useEffect(() => {
    if (!reveal) return;
    setOpen(true);
    storageSet('fold:' + id, true);
  }, [reveal, id]);
  const toggle = () => {
    setOpen(!open);
    storageSet('fold:' + id, !open);
  };
  return h('section', { id: domId, className: cx('atlas-fold', open && 'is-open') },
    h('button', { type: 'button', className: 'atlas-fold-head', 'aria-expanded': open, onClick: toggle },
      h('span', { className: 'atlas-fold-mark', 'aria-hidden': true }, '▸'),
      icon ? h(Icon, { name: icon }) : null,
      h('span', { className: 'atlas-fold-title' }, title),
      count !== undefined && count !== null ? h('span', { className: 'atlas-count' }, count) : null),
    open ? h('div', { className: 'atlas-fold-body' }, typeof children === 'function' ? children() : children) : null);
}

// Compatibility: old callers can still flash a string and render <Flash message={message}>.
function useFlash() {
  const [message, setMessage] = useState('');
  const pending = useRef(null);
  useEffect(() => () => { clearTimeout(pending.current); pending.current = null; }, []);
  const flash = useCallback((text, options = {}) => {
    clearTimeout(pending.current);
    pending.current = null;
    if (!text) { setMessage(''); return; }
    const expire = () => { if (pending.current === timer) { pending.current = null; setMessage(''); } };
    const timer = setTimeout(expire, options.duration ?? 4000);
    pending.current = timer;
    const action = options.action;
    setMessage(action ? { text, action: { label: action.label, onClick: (event) => {
      if (pending.current !== timer) return; // A replaced or already-used action cannot run.
      clearTimeout(timer);
      expire();
      action.onClick(event);
    } } } : text);
  }, []);
  return [message, flash];
}

function Flash({ message }) {
  return h(Toast, { message });
}

async function handOff(folder, prompt, flash) {
  try {
    await draftSession(folder, prompt);
    flash('The prompt is in a new session: edit it and send it when ready.');
  } catch (error) {
    try {
      await navigator.clipboard.writeText(prompt);
      flash(`${error.message} The prompt was copied instead.`);
    } catch {
      flash(error.message);
    }
  }
}

/** The research moves for what is on screen: each opens a discussion beside it, with what you are viewing as context. */
function AskMenu({ asks, label }) {
  const actions = React.useContext(AtlasActions);
  const [initial, setInitial] = useState(null);
  const trigger = useRef(null);
  const pane = React.useContext(PaneContext);
  const run = (a) => actions.ask(focusContext(paneFocus(focusStore.get(), pane)), 'ask', a.prompt, a.label);
  const first = asks[0];
  const menuLabel = 'More ways to work with the AI';
  const items = asks.map(a => ({ id: a.key, label: a.label, hint: a.hint, title: a.prompt, onSelect: () => run(a) }));
  items.push({ id: 'own', label: 'Ask your own question…', hint: 'Ctrl+J, here or over a selected passage', onSelect: () => actions.startAsk({}) });
  return h('div', { className: 'atlas-ask' },
    h(Button, { primary: true, className: 'is-split', icon: 'spark', title: first.prompt, onClick: () => run(first) }, label || first.label),
    h(IconButton, { label: menuLabel, icon: 'chevron', buttonRef: trigger, className: 'atlas-button is-primary is-caret', 'aria-haspopup': 'menu', 'aria-expanded': !!initial,
      onClick: () => setInitial(initial ? null : 'first'), onKeyDown: event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setInitial(event.key === 'ArrowUp' ? 'last' : 'first'); }
      } }),
    initial ? h(Menu, { anchor: trigger, label: menuLabel, items, initial, onClose: () => setInitial(null) }) : null);
}

/** Names of topics that link to a note, each opening that topic; long lists show their first few. */
function LinkedFrom({ refs, go, label, limit = 3 }) {
  const [all, setAll] = useState(false);
  if (!refs || refs.length === 0) return null;
  const shown = all ? refs : refs.slice(0, limit);
  return h('p', { className: 'atlas-linked' },
    h('span', { className: 'atlas-label' }, label || 'Linked from'), ' ',
    shown.map((r, i) => h('span', { key: r.id }, i ? ' · ' : '', h(TextButton, { 'data-atlas-open': true, onClick: () => go({ view: 'doc', path: r.file }) }, r.title))),
    refs.length > shown.length ? h('span', null, ' · ', h(TextButton, { onClick: () => setAll(true) }, `${refs.length - shown.length} more`)) : null);
}

/** Breadcrumbs: Universe › direction › ancestors › here. */
function Crumbs({ items, go }) {
  return h('nav', { className: 'atlas-crumbs', 'aria-label': 'Where this is' },
    items.map((item, i) => h('span', { key: i, className: 'atlas-crumb' },
      i ? h('span', { className: 'atlas-crumb-sep', 'aria-hidden': true }, '›') : null,
      item.go ? h(TextButton, { onClick: () => go(item.go) }, item.dot ? h('span', { className: 'atlas-dot', style: { background: item.dot } }) : null, item.label)
        : h('span', { className: 'atlas-crumb-here' }, item.dot ? h('span', { className: 'atlas-dot', style: { background: item.dot } }) : null, item.label))));
}

