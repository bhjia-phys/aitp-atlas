// ------------------------------------------------------------------ themes ---
// Every color Atlas draws is a named token. Two themes ship: night (the
// observatory, as Atlas always looked) and day. The config can define more
// (`themes:`, each a base theme plus token overrides) and pick the default
// (`theme: auto | day | night | <name>`); the top bar switches per window.
// Auto follows DSH's own appearance, which its presenter marks on the page.

const THEME_RGB = {
  night: {
    accent: '157, 184, 255', panel: '16, 23, 43', gold: '255, 210, 122', sky: '7, 11, 22', shadow: '0, 0, 0', glow: '220, 230, 255',
    'nebula-a': '70, 92, 190', 'nebula-b': '124, 66, 170', 'gold-2': '255, 220, 150', 'gold-3': '255, 190, 70', warn: '250, 178, 25',
    'panel-0': '11, 16, 32', 'panel-1': '13, 19, 38', 'panel-2': '21, 30, 56', 'panel-3': '26, 36, 68', deep: '5, 7, 15',
    danger: '208, 59, 59', line: '140, 160, 230', idle: '93, 104, 144', ins: '80, 200, 120', blue: '57, 135, 229',
    del: '255, 110, 110', 'del-2': '255, 143, 143', 'ink-3': '138, 148, 179',
  },
  day: {
    accent: '36, 87, 197', panel: '255, 255, 255', gold: '154, 98, 0', sky: '245, 246, 250', shadow: '20, 28, 56', glow: '36, 87, 197',
    'nebula-a': '110, 140, 230', 'nebula-b': '170, 130, 220', 'gold-2': '154, 98, 0', 'gold-3': '176, 110, 0', warn: '196, 128, 0',
    'panel-0': '250, 251, 253', 'panel-1': '248, 249, 252', 'panel-2': '243, 245, 250', 'panel-3': '232, 236, 245', deep: '227, 231, 240',
    danger: '198, 40, 40', line: '40, 60, 120', idle: '120, 128, 155', ins: '26, 127, 55', blue: '36, 87, 197',
    del: '220, 60, 50', 'del-2': '200, 50, 40', 'ink-3': '91, 101, 132',
  },
};

const THEME_COLORS = {
  night: {
    'sky-0': '#070b16', 'sky-1': '#0b1020', panel: '#10172b', 'panel-2': '#151e38', 'panel-3': '#1b2648',
    line: 'rgba(140, 160, 230, .14)', 'line-2': 'rgba(140, 160, 230, .28)',
    'ink-0': '#fff', 'ink-1': '#e8ebf5', 'ink-2': '#aeb6cf', 'ink-3': '#8a94b3', link: '#9db8ff', gold: '#ffd27a',
    'on-accent': '#0a0f1f', 'on-gold': '#0a0f1f', 'mark-bg': '#ffd27a', 'mark-ink': '#0a0f1f',
    'accent-a': '#c6d6ff', 'accent-b': '#9db8ff', 'accent-a-hover': '#d6e2ff', 'accent-b-hover': '#adc4ff',
    'danger-ink': '#ffb4b4', 'danger-ink-2': '#ff9b9b', 'danger-ink-3': '#f2a7a7',
    idle: '#5d6890', good: '#0ca30c', 'code-key': '#9db8ff', 'code-math': '#ffd27a', 'code-comment': '#7c86a5',
    'del-ink': '#ff8f8f', 'del-text': '#ffd0d0', 'ins-ink': '#6fd58f', 'ins-text': '#d2f7de',
    'checker-a': '#121a30', 'checker-b': '#0e1528', deep: '#05070f',
    'input-major': '#18213d', bubble: '#1d2848', selector: '#222e52',
    'status-active': '#9db8ff', 'status-proposed': '#aeb6cf', 'status-waiting': '#fab219', 'status-blocked': '#d03b3b', 'status-done': '#0ca30c', 'status-other': '#7c86a5',
  },
  day: {
    'sky-0': '#f5f6fa', 'sky-1': '#eceff6', panel: '#ffffff', 'panel-2': '#f3f5fa', 'panel-3': '#e8ecf5',
    line: 'rgba(40, 60, 120, .14)', 'line-2': 'rgba(40, 60, 120, .26)',
    'ink-0': '#05070f', 'ink-1': '#161c30', 'ink-2': '#3e4766', 'ink-3': '#5b6584', link: '#2457c5', gold: '#9a6200',
    'on-accent': '#ffffff', 'on-gold': '#ffffff', 'mark-bg': '#ffe08a', 'mark-ink': '#241a00',
    'accent-a': '#3d72e3', 'accent-b': '#2457c5', 'accent-a-hover': '#4b7fec', 'accent-b-hover': '#2c62d6',
    'danger-ink': '#b42318', 'danger-ink-2': '#b42318', 'danger-ink-3': '#b42318',
    idle: '#9aa2bb', good: '#12852f', 'code-key': '#1f5fbf', 'code-math': '#8a5a00', 'code-comment': '#6b7390',
    'del-ink': '#c0362c', 'del-text': '#7a1a12', 'ins-ink': '#1a7f37', 'ins-text': '#0d4a1f',
    'checker-a': '#eef1f7', 'checker-b': '#e2e7f1', deep: '#e3e7f0',
    'input-major': '#ffffff', bubble: '#eef2fa', selector: '#e2e8f6',
    // The status steps are fixed across themes (they ship with a label, never color alone).
    'status-active': '#2f6fe0', 'status-proposed': '#7c86a5', 'status-waiting': '#fab219', 'status-blocked': '#d03b3b', 'status-done': '#0ca30c', 'status-other': '#8b93ad',
  },
};

/** Every token of a theme, as CSS custom properties name → value (rgb tokens hold "r, g, b"). */
const THEME_TOKENS = Object.fromEntries(Object.keys(THEME_COLORS).map((base) => [base, {
  ...THEME_COLORS[base],
  ...Object.fromEntries(Object.entries(THEME_RGB[base]).map(([k, v]) => [k + '-rgb', v])),
  'shadow-k': base === 'day' ? '.3' : '1',
}]));
const TOKEN_NAMES = new Set(Object.keys(THEME_TOKENS.night));

// Directions take the validated categorical slots in the root note's order (dark steps at night,
// light steps by day); past eight, they share "other". By day four slots sit below 3:1 on the
// surface, so a direction is always named beside its color.
const DIRECTION_SLOTS = {
  night: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'],
  day: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
};
const OTHER_SLOT = { night: '#898781', day: '#8a8578' };
/** The star chart's sun, sky and starfield. */
const UNIVERSE_COLORS = {
  night: { coreA: '#fff4d6', coreB: '#ffd27a', coreC: '#ff9f43', nebula: '#2a3a78', nebulaEdge: '#0b1020', field: '#dfe6ff', coreDot: '#fff6dd', root: '#fff0c2' },
  day: { coreA: '#fff1c4', coreB: '#f2b84b', coreC: '#e8873a', nebula: '#c9d4f5', nebulaEdge: '#f5f6fa', field: '#7d89b3', coreDot: '#e09a2b', root: '#b7791f' },
};
const THEME_LABEL = { auto: 'Auto (follows DSH)', day: 'Day', night: 'Night' };
const THEME_ICON = { auto: 'contrast', day: 'sun', night: 'moon' };

/** The base theme being drawn; the shell sets it before each render so colors chosen in code match. */
let activeBase = 'night';

/** The theme to draw: `mode` (auto, day, night or a configured name) against DSH's appearance and the config's themes. */
function resolveTheme(mode, dshDark, themes) {
  const custom = themes && mode && Object.prototype.hasOwnProperty.call(themes, mode) ? themes[mode] : null;
  if (custom) return { name: mode, base: custom.base, label: custom.label, tokens: custom.tokens };
  const base = mode === 'day' || mode === 'night' ? mode : dshDark === false ? 'day' : 'night';
  return { name: mode === 'day' || mode === 'night' ? mode : 'auto', base, label: THEME_LABEL[mode] || THEME_LABEL.auto, tokens: {} };
}

/** A token value the config may set: a color for color tokens, "r, g, b" for rgb tokens, a number for shadow-k. */
function safeToken(name, value) {
  const v = String(value === undefined || value === null ? '' : value).trim();
  if (name.endsWith('-rgb')) return /^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test(v) && v.split(',').every((n) => Number(n) <= 255);
  if (name === 'shadow-k') return /^(0|1|2)?(\.\d+)?$/.test(v) && v !== '' && Number(v) <= 2;
  return /^#[0-9a-f]{3,8}$/i.test(v) || /^(rgb|hsl)a?\(\s*[0-9.,%\s/]+\)$/i.test(v);
}

/** The config's themes, kept only where every name and value is safe CSS: unknown tokens and odd values are dropped. */
function cleanThemes(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [name, def] of Object.entries(raw)) {
    if (!/^[a-z][a-z0-9-]{0,30}$/i.test(name) || THEME_LABEL[name] || !def || typeof def !== 'object') continue;
    const tokens = {};
    for (const [key, value] of Object.entries(def.tokens || {})) if (TOKEN_NAMES.has(key) && safeToken(key, value)) tokens[key] = String(value).trim();
    out[name] = { base: def.base === 'day' ? 'day' : 'night', label: typeof def.label === 'string' && def.label.trim() ? def.label.trim().slice(0, 40) : name, tokens };
  }
  return out;
}

/** The order the theme button walks: auto, day, night, then the config's own themes. */
function themeCycle(themes) {
  return ['auto', 'day', 'night', ...Object.keys(themes || {})];
}

/** Inline custom properties for a configured theme's overrides. */
function themeStyle(theme) {
  const style = {};
  for (const [key, value] of Object.entries((theme && theme.tokens) || {})) style['--' + key] = value;
  return style;
}

/** The token blocks of both shipped themes; a configured theme overrides them inline on the root. */
function themeCss() {
  return Object.entries(THEME_TOKENS).map(([base, tokens]) =>
    `.atlas-root[data-theme-base="${base}"] { color-scheme: ${base === 'day' ? 'light' : 'dark'}; ${Object.entries(tokens).map(([k, v]) => `--${k}: ${v};`).join(' ')} }`).join('\n');
}

/** Whether DSH shows its dark appearance: its presenter sets body[data-ds-dark-theme] and html's color-scheme. */
function dshIsDark() {
  if (typeof document === 'undefined') return true;
  const body = document.body;
  if (body && body.hasAttribute('data-ds-dark-theme')) return !/^(false|0|no|light)$/i.test(body.getAttribute('data-ds-dark-theme') || '');
  const scheme = String(document.documentElement.style.colorScheme || '').trim();
  if (scheme === 'dark') return true;
  if (scheme === 'light') return false;
  return !(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
}

const themeModeStore = externalStore(null, 'theme-mode');
const dshThemeStore = externalStore(true);
let dshThemeWatched = false;

/** Follow DSH's appearance while Atlas is open (it can change from DSH's settings at any time). */
function watchDshTheme() {
  if (dshThemeWatched || typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  dshThemeWatched = true;
  const update = () => {
    const dark = dshIsDark();
    if (dark !== dshThemeStore.get()) dshThemeStore.set(dark);
  };
  update();
  const watch = new MutationObserver(update);
  if (document.body) watch.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] });
  watch.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  if (media && media.addEventListener) media.addEventListener('change', update);
}
