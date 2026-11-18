// No local() or external CDN fallback: the packaged faces work offline.
const ATLAS_FONT_CSS = ['normal', 'italic'].map((style) => `
@font-face {
  font-family: 'Source Serif 4';
  src: url('${API}/fonts/SourceSerif4Variable-${style === 'normal' ? 'Roman' : 'Italic'}.woff2') format('woff2');
  font-style: ${style}; font-weight: 200 900; font-display: swap;
}`).join('\n');
