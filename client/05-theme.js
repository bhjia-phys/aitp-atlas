// Atlas 1.0: observatory at night, engraved chart by day (VISUAL §2).
// Scope all tokens to the Atlas root, including the bridge inherited by embedded DSH content.
const MOOD_TOKENS = {
  night: {
    'bg': '#070B17', 'surface': '#0C1222', 'raised': '#131A2E', 'sunken': '#090E1B',
    'overlay': 'rgba(3, 5, 12, .66)', 'hover': 'rgba(200, 214, 255, .05)', 'pressed': 'rgba(200, 214, 255, .08)', 'selected': 'rgba(157, 184, 255, .12)',
    'border': 'rgba(160, 180, 255, .11)', 'border-strong': 'rgba(160, 180, 255, .22)', 'border-control': '#5D6991',
    'text-1': '#E9ECF5', 'text-2': '#AEB5CC', 'text-3': '#8A93B0', 'text-on-accent': '#0A0F1F',
    'accent': '#9DB8FF', 'accent-hover': '#B6C9FF', 'accent-soft': 'rgba(157, 184, 255, .14)', 'glow': 'rgba(157, 184, 255, .45)',
    'gold': '#F4CE7A', 'gold-soft': 'rgba(244, 206, 122, .12)', 'gold-on': '#0A0F1F',
    'success-text': '#79D69A', 'success-soft': 'rgba(121, 214, 154, .13)',
    'shadow-1': 'none', 'shadow-2': '0 10px 30px rgba(0, 0, 0, .5), 0 0 0 1px rgba(160, 180, 255, .06)', 'shadow-3': '0 28px 70px rgba(0, 0, 0, .6)',
    'n1': '#588CDA', 'n2': '#03886D', 'n3': '#BD891C', 'n4': '#CB5E93', 'n5': '#6B5FCA', 'n6': '#C5582F', 'n7': '#31A1BD', 'n8': '#66A43E',
    'sky-line': 'rgba(170, 190, 255, .09)', 'sky-line-2': 'rgba(170, 190, 255, .18)', 'star': '#EEF2FF', 'wash': '.055',
    'paper': '#FFFFFF', 'paper-ink': '#1B1B1F', 'table': '#050811',
    'dx': '#898781', 'map-sky': '#0b1020', 'map-nebula': '#2A3A78', 'map-nebula-edge': '#0B1020',
    'danger': '#D03B3B', 'danger-text': '#ffb4b4', 'danger-soft': 'rgba(208, 59, 59, .12)',
    'accent-rgb': '157, 184, 255', 'gold-rgb': '244, 206, 122', 'map-glow-rgb': '220, 230, 255', 'map-gold-rgb': '255, 220, 150',
    'idle': '#5d6890', 'mark-bg': '#ffd27a', 'mark-ink': '#0a0f1f',
    'code-key': '#9db8ff', 'code-math': '#ffd27a', 'code-comment': '#7c86a5',
    'del-ink': '#ff8f8f', 'del-text': '#ffd0d0', 'ins-ink': '#6fd58f', 'ins-text': '#d2f7de',
    'status-active': '#9db8ff', 'status-proposed': '#aeb6cf', 'status-waiting': '#fab219', 'status-blocked': '#d03b3b', 'status-done': '#0ca30c', 'status-other': '#7c86a5',
    'ins-rgb': '80, 200, 120', 'del-rgb': '255, 110, 110', 'del-2-rgb': '255, 143, 143',
    'media-black': '#000000', 'page-shadow': '0 0 0 1px rgba(0,0,0,.04), 0 2px 4px rgba(0,0,0,.14), 0 18px 48px rgba(0,0,0,.28)',
  },
  day: {
    'bg': '#ECE7DC', 'surface': '#FAF8F2', 'raised': '#FFFEFA', 'sunken': '#F2EEE4',
    'overlay': 'rgba(28, 32, 51, .30)', 'hover': 'rgba(28, 32, 51, .045)', 'pressed': 'rgba(28, 32, 51, .08)', 'selected': 'rgba(44, 79, 163, .09)',
    'border': 'rgba(40, 45, 70, .12)', 'border-strong': 'rgba(40, 45, 70, .22)', 'border-control': '#827C70',
    'text-1': '#1C2033', 'text-2': '#474C61', 'text-3': '#5F6375', 'text-on-accent': '#FFFFFF',
    'accent': '#2C4FA3', 'accent-hover': '#233F86', 'accent-soft': 'rgba(44, 79, 163, .10)', 'glow': 'rgba(44, 79, 163, .22)',
    'gold': '#8F5A00', 'gold-soft': 'rgba(201, 138, 20, .14)', 'gold-on': '#FFFFFF',
    'success-text': '#1E7A3C', 'success-soft': 'rgba(30, 122, 60, .10)',
    'shadow-1': '0 1px 2px rgba(60, 50, 30, .06)', 'shadow-2': '0 10px 28px rgba(60, 50, 30, .14), 0 0 0 1px rgba(40, 45, 70, .06)', 'shadow-3': '0 28px 70px rgba(60, 50, 30, .20)',
    'n1': '#3067B8', 'n2': '#08856A', 'n3': '#A77601', 'n4': '#A93772', 'n5': '#5341B1', 'n6': '#B84412', 'n7': '#0B8FAA', 'n8': '#4A871B',
    'sky-line': 'rgba(40, 45, 70, .10)', 'sky-line-2': 'rgba(40, 45, 70, .22)', 'star': '#1C2033', 'wash': '.06',
    'paper': '#FFFFFF', 'paper-ink': '#1B1B1F', 'table': '#E3DDCF',
    'dx': '#8A8578', 'map-sky': '#eceff6', 'map-nebula': '#C9D4F5', 'map-nebula-edge': '#F5F6FA',
    'danger': '#C62828', 'danger-text': '#b42318', 'danger-soft': 'rgba(198, 40, 40, .12)',
    'accent-rgb': '44, 79, 163', 'gold-rgb': '143, 90, 0', 'map-glow-rgb': '36, 87, 197', 'map-gold-rgb': '154, 98, 0',
    'idle': '#9aa2bb', 'mark-bg': '#ffe08a', 'mark-ink': '#241a00',
    'code-key': '#1f5fbf', 'code-math': '#8a5a00', 'code-comment': '#6b7390',
    'del-ink': '#c0362c', 'del-text': '#7a1a12', 'ins-ink': '#1a7f37', 'ins-text': '#0d4a1f',
    'status-active': '#2f6fe0', 'status-proposed': '#7c86a5', 'status-waiting': '#fab219', 'status-blocked': '#d03b3b', 'status-done': '#0ca30c', 'status-other': '#8b93ad',
    'ins-rgb': '26, 127, 55', 'del-rgb': '220, 60, 50', 'del-2-rgb': '200, 50, 40',
    'media-black': '#000000', 'page-shadow': '0 0 0 1px rgba(0,0,0,.04), 0 2px 4px rgba(0,0,0,.14), 0 18px 48px rgba(0,0,0,.28)',
  },
};
// Both moods use the same geometry and type. Font-role tokens are CSS font
// shorthands (weight + size/leading + family); small caps also need --cap-*.
const ATLAS_SCALE = {
  'font-ui': '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
  'font-serif': '"Source Serif 4", "Iowan Old Style", "Charter", "Cambria", Georgia, serif',
  'font-mono': 'ui-monospace, "Cascadia Code", "SFMono-Regular", Consolas, monospace',
  ...Object.fromEntries(Object.entries({
    display: ['italic 400', 40, 48, 'serif'], h1: [600, 26, 32, 'serif'], h2: [600, 22, 28, 'serif'], h3: [600, 16, 22, 'serif'],
    read: [400, 16, 26, 'serif'], 'read-compact': [400, 15, 24, 'serif'], body: [400, 14, 20, 'ui'], ui: [400, 13, 18, 'ui'],
    meta: [400, 12, 16, 'ui'], cap: [600, 12, 16, 'serif'], count: ['italic 400', 13, 18, 'serif'], mono: [400, 12.5, 20, 'mono'],
  }).flatMap(([role, [weight, size, leading, family]]) => [
    [`t-${role}`, `${weight} ${size}px/${leading}px var(--font-${family})`], [`fs-${role}`, `${size}px`],
  ])),
  'cap-variant': 'all-small-caps', 'cap-tracking': '.09em',
  ...Object.fromEntries([4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 72].map((n) => [`s-${n}`, `${n}px`])),
  'r-xs': '4px', 'r-sm': '6px', 'r-tab': '8px', 'r-md': '10px', 'r-lg': '16px', 'r-full': '999px',
  'control-24': '24px', 'control-28': '28px', 'control-32': '32px', 'row-36': '36px', 'row-40': '40px', 'row-44': '44px', 'row-58': '58px',
  'ease': 'cubic-bezier(.2, .7, .2, 1)', 'motion-hover': '120ms', 'motion-panel': '160ms', 'motion-dialog': '220ms',
  'motion-twinkle': '2.4s', 'motion-flow': '1.6s', 'motion-flow-slow': '2.2s',
  'star-shape': 'polygon(50% 0, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0 50%, 40% 40%)',
  'z-strip': '10', 'z-focus': '20', 'z-rail': '30', 'z-popover': '40', 'z-toast': '50', 'z-dialog': '60', 'z-palette': '70',
};
const THEME_TOKENS = Object.fromEntries(Object.entries(MOOD_TOKENS).map(([base, colors]) => [base, { ...ATLAS_SCALE, ...colors }]));
const TOKEN_NAMES = new Set(Object.keys(MOOD_TOKENS.night));

/** The star chart's sun, sky and starfield. */
const UNIVERSE_COLORS = {
  night: { coreA: '#fff4d6', coreB: '#ffd27a', coreC: '#ff9f43', nebula: 'var(--map-nebula)', nebulaEdge: 'var(--map-nebula-edge)', field: '#dfe6ff', coreDot: '#fff6dd', root: '#fff0c2' },
  day: { coreA: '#fff1c4', coreB: '#f2b84b', coreC: '#e8873a', nebula: 'var(--map-nebula)', nebulaEdge: 'var(--map-nebula-edge)', field: '#7d89b3', coreDot: '#e09a2b', root: '#b7791f' },
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

// Compatibility is confined to this *input* boundary. Never publish 0.9 CSS properties.
const LEGACY_THEME_KEYS = {
  'sky-0': 'bg', 'sky-1': 'bg', sky: 'bg', panel: 'surface', 'panel-0': 'surface', 'panel-1': 'surface',
  'panel-2': 'raised', 'panel-3': 'raised', bubble: 'raised', selector: 'selected',
  deep: 'sunken', 'checker-a': 'sunken', 'checker-b': 'sunken', 'input-major': 'sunken',
  line: 'border', 'line-2': 'border-strong', 'ink-0': 'text-1', 'ink-1': 'text-1', 'ink-2': 'text-2', 'ink-3': 'text-3',
  link: 'accent', 'accent-a': 'accent', 'accent-b': 'accent', blue: 'accent',
  'accent-a-hover': 'accent-hover', 'accent-b-hover': 'accent-hover', 'on-accent': 'text-on-accent', 'on-gold': 'gold-on',
  'danger-ink': 'danger-text', 'danger-ink-2': 'danger-text', 'danger-ink-3': 'danger-text', good: 'success-text',
  'nebula-a': 'map-nebula', 'nebula-b': 'map-nebula-edge', 'glow-rgb': 'map-glow-rgb',
  'gold-2-rgb': 'map-gold-rgb', 'gold-3-rgb': 'gold-rgb', warn: 'gold',
};

function safeToken(name, v) {
  if (name.endsWith('-rgb')) return /^\d{1,3},\s*\d{1,3},\s*\d{1,3}$/.test(v) && v.split(',').every((n) => Number(n) <= 255);
  if (name === 'wash' || name === 'shadow-k') return /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(v) && Number(v) <= (name === 'wash' ? 1 : 2);
  return /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(v) || /^(rgb|hsl)a?\(\s*[\d.,%\s/]+\)$/i.test(v);
}

/** Translate safe legacy inputs first; explicit semantic colors always win, independent of key order. */
function adaptThemeTokens(raw, base) {
  const old = {}, modern = {};
  let shadowTint, strength;
  for (const [key, val] of Object.entries(raw || {})) {
    if (typeof val !== 'string' && typeof val !== 'number') continue;
    const value = String(val).trim();
    if (!safeToken(key, value)) continue;
    if (key === 'shadow-rgb') { shadowTint = value; continue; }
    if (key === 'shadow-k') { strength = Number(value); continue; }
    if (TOKEN_NAMES.has(key)) {
      // Shadows are composed from the shipped geometry, never from arbitrary CSS.
      if (!key.includes('shadow')) modern[key] = value;
      continue;
    }
    const channels = key.endsWith('-rgb');
    const name = channels ? key.slice(0, -4) : key;
    const target = LEGACY_THEME_KEYS[key] || LEGACY_THEME_KEYS[name] || (channels && (name === 'danger' || name === 'idle') ? name : null);
    if (!TOKEN_NAMES.has(target)) continue;
    if (target.endsWith('-rgb')) old[target] = value;
    else if (channels && name === 'line') {
      old.border = `rgba(${value}, ${base === 'night' ? '.11' : '.12'})`;
      old['border-strong'] = `rgba(${value}, .22)`;
    } else old[target] = channels ? `rgb(${value})` : value;
  }
  const tokens = { ...old, ...modern };
  // Tints follow a custom accent even if its color is HSL. Keep separate 0.9
  // channels if supplied (many old themes used different link and tint colors).
  for (const [color, tints] of Object.entries({ accent: ['accent-soft', 'glow', 'selected'], gold: ['gold-soft'], danger: ['danger-soft'] })) {
    const channels = tokens[color + '-rgb'];
    const paint = channels ? `rgb(${channels})` : tokens[color];
    if (!paint) continue;
    if (!tokens[color]) tokens[color] = paint;
    for (const tint of tints) {
      const opacity = Number(THEME_TOKENS[base][tint].match(/, ([.\d]+)\)$/)[1]);
      if (!tokens[tint]) tokens[tint] = `color-mix(in srgb, ${paint} ${Math.round(opacity * 100)}%, transparent)`;
    }
  }
  if (shadowTint !== undefined || strength !== undefined) {
    for (const key of ['shadow-1', 'shadow-2', 'shadow-3']) {
      tokens[key] = THEME_TOKENS[base][key].replace(/rgba\(([\d, ]+), ([.\d]+)\)/g, (_, rgb, a) =>
        `rgba(${shadowTint || rgb}, ${Math.min(1, Number(a) * (strength ?? 1))})`);
    }
  }
  return tokens;
}

/** The config's themes, kept only where every name and value is safe CSS: unknown tokens and odd values are dropped. */
function cleanThemes(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [name, def] of Object.entries(raw)) {
    if (!/^[a-z][a-z0-9-]{0,30}$/i.test(name) || THEME_LABEL[name] || !def || typeof def !== 'object') continue;
    const base = def.base === 'day' ? 'day' : 'night';
    out[name] = { base, label: typeof def.label === 'string' && def.label.trim() ? def.label.trim().slice(0, 40) : name, tokens: adaptThemeTokens(def.tokens, base) };
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
