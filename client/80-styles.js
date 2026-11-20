// ------------------------------------------------------------------ styles ---
// Two themes over one set of tokens (05-theme.js): the night observatory and the engraved chart. One
// color per direction (the validated categorical slots), serif for what is read, sans for controls.

const STYLES = `
.atlas-root {
  --dir: var(--accent);
  --dsw-alias-label-primary: var(--text-1); --dsw-alias-label-secondary: var(--text-2); --dsw-alias-label-tertiary: var(--text-3);
  --dsw-alias-bg-base: var(--surface); --dsw-alias-bg-layer-1: var(--raised); --dsw-alias-bg-layer-2: var(--sunken);
  --dsw-alias-border-l1: var(--border); --dsw-alias-border-l2: var(--border-strong); --dsw-alias-brand-primary: var(--accent);
  --dsw-alias-interactive-bg-hover: var(--hover);
  /* DSH's embedded conversation (input box, message bubbles, menus) in Atlas's theme, whatever DSH's. */
  --dsw-specific-input-major: var(--sunken); --dsw-specific-bubble: var(--raised); --dsw-specific-selector: var(--selected);
  --dsw-alias-border-l3: var(--border-strong); --dsw-alias-border-l4: var(--border-strong);
  --dsw-alias-label-caption: var(--text-3); --dsw-alias-separator-primary: var(--border);
  --dsw-alias-scrollbar-bg-l2: var(--border-strong); --dsw-alias-scrollbar-hover-l2: var(--border-control);
  --dsw-elevation-stroke-color: var(--border-strong);
  container-type: inline-size;
  display: flex; flex-direction: column; height: 100%; min-height: 0;
  background: var(--bg);
  color: var(--text-1); font: var(--t-body);
}
.atlas-root *, .atlas-root *::before, .atlas-root *::after { box-sizing: border-box; }
.atlas-icon { flex: none; }

/* ---- top bar ---- */
.atlas-top { display: flex; align-items: center; gap: 14px; padding: 9px 18px; border-bottom: 1px solid var(--border); background: var(--bg); flex: none; }
.atlas-brand { display: inline-flex; align-items: center; gap: var(--s-8); border: 0; background: none; color: var(--text-1); font: var(--t-body); font-weight: 600; letter-spacing: .02em; cursor: pointer; padding: var(--s-4) 6px; border-radius: var(--r-tab); }
.atlas-brand svg { color: var(--gold); }
.atlas-nav { display: flex; gap: 2px; }
.atlas-nav-item { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--text-2); padding: 6px 11px; border-radius: var(--r-tab); font: inherit; cursor: pointer; }
.atlas-nav-item:hover { color: var(--text-1); background: var(--hover); }
.atlas-nav-item.is-on { color: var(--text-1); background: var(--selected); box-shadow: inset 0 0 0 1px var(--border-strong); }
.atlas-tools { margin-left: auto; display: flex; align-items: center; gap: 6px; flex: 0 1 320px; }
.atlas-input { width: 100%; font: inherit; color: var(--text-1); background: var(--sunken); border: 1px solid var(--border-control); border-radius: var(--r-sm); padding: 6px 11px; }
.atlas-input::placeholder { color: var(--text-3); }
.atlas-input:focus { outline: 2px solid var(--accent); outline-offset: 0; }
.atlas-icon-button { flex: none; display: inline-grid; place-items: center; width: var(--control-32); height: var(--control-32); border: 0; border-radius: var(--r-sm); background: transparent; color: var(--text-2); cursor: pointer; }
.atlas-icon-button:hover { color: var(--text-1); background: var(--hover); }

/* ---- page frame ---- */
.atlas-page { max-width: 980px; margin: 0 auto; padding: 22px 28px 80px; }
.atlas-page.is-wide { max-width: 1260px; }
.atlas-kicker { display: inline-flex; align-items: center; gap: 7px; margin: 0 0 6px; font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-3); }
.atlas-kicker::before { content: ""; width: 18px; height: 2px; border-radius: var(--r-xs); background: var(--dir); }
.atlas-page h1 { margin: 0 0 var(--s-8); font: var(--t-h1); letter-spacing: -.01em; color: var(--text-1); overflow-wrap: anywhere; }
.atlas-lede { margin: 0 0 var(--s-12); color: var(--text-2); max-width: 680px; font-size: var(--fs-body); }
.atlas-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; color: var(--text-3); font-size: var(--fs-meta); margin-bottom: var(--s-12); }
.atlas-path { font-family: var(--font-mono); font-size: var(--fs-meta); color: var(--text-3); overflow-wrap: anywhere; }
.atlas-date { font: var(--t-count); color: var(--text-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.atlas-label { font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-3); }
.atlas-muted { color: var(--text-3); }
.atlas-count { margin-left: var(--s-8); font: var(--t-count); color: var(--text-3); }
.atlas-empty { color: var(--text-3); margin: var(--s-8) 0; }
.atlas-setup { max-width: 680px; padding: var(--s-24); margin: 0 auto; overflow-wrap: anywhere; }
.atlas-setup pre { background: var(--sunken); border: 1px solid var(--border); border-radius: var(--r-tab); padding: var(--s-12); overflow: auto; }
.atlas-actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-8); margin: 6px 0 14px; }
.atlas-section { margin-top: 30px; }
.atlas-section > h2, .atlas-root-sections > h2, .atlas-side-block > h2, .atlas-pulse > h2 { display: flex; align-items: center; gap: var(--s-8); margin: 0 0 10px; font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-2); }

/* ---- buttons, chips, links ---- */
.atlas-button { display: inline-flex; align-items: center; gap: 7px; font: var(--t-ui); font-weight: 500; color: var(--text-1); background: transparent; border: 1px solid var(--border-strong); border-radius: var(--r-sm); padding: 6px 13px; cursor: pointer; transition: background var(--motion-hover) var(--ease), border-color var(--motion-hover) var(--ease), box-shadow var(--motion-hover) var(--ease); }
.atlas-button:hover:not(:disabled) { background: var(--hover); border-color: var(--accent); }
.atlas-button:disabled { opacity: .4; cursor: default; }
.atlas-button.is-primary { color: var(--text-on-accent); background: var(--accent); border-color: transparent; }
.atlas-button.is-primary:hover:not(:disabled) { background: var(--accent-hover); }
.atlas-button.is-quiet { background: transparent; border-color: transparent; color: var(--text-2); }
.atlas-button.is-quiet:hover:not(:disabled) { color: var(--text-1); background: var(--hover); border-color: transparent; }
.atlas-button.is-small { padding: 3px 9px; font-size: var(--fs-meta); border-radius: var(--r-sm); }
.atlas-button:focus-visible, .atlas-link:focus-visible, .atlas-card:focus-visible, .atlas-item:focus-visible, .atlas-nav-item:focus-visible, .atlas-fold-head:focus-visible, .atlas-seg-item:focus-visible, .atlas-pulse-row:focus-visible, .atlas-branch:focus-visible, .atlas-legend-item:focus-visible, .atlas-paper-title:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.atlas-ask { position: relative; display: inline-flex; }
.atlas-button.is-split { border-radius: var(--r-md) 0 0 var(--r-md); }
.atlas-button.is-caret { border-radius: 0 var(--r-md) var(--r-md) 0; padding: 6px 9px; margin-left: 1px; }
.atlas-menu { position: absolute; z-index: var(--z-popover); top: calc(100% + 6px); left: 0; min-width: 300px; padding: 6px; background: var(--raised); border: 1px solid var(--border-strong); border-radius: var(--r-md); box-shadow: var(--shadow-2); }
.atlas-menu-item { display: grid; gap: 1px; width: 100%; text-align: left; border: 0; background: transparent; color: var(--text-1); padding: var(--s-8) 10px; border-radius: var(--r-tab); cursor: pointer; font: inherit; }
.atlas-menu-item:hover, .atlas-menu-item:focus-visible { background: var(--hover); outline: none; }
.atlas-menu-label { font-weight: 500; }
.atlas-menu-hint { font-size: var(--fs-meta); color: var(--text-3); }
.atlas-link { display: inline-flex; align-items: center; gap: var(--s-4); border: 0; background: transparent; color: var(--accent); font: inherit; padding: 0; cursor: pointer; text-align: left; }
.atlas-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.atlas-chip { display: inline-flex; align-items: center; gap: 6px; font-size: var(--fs-meta); line-height: 1.7; padding: 0 9px; border-radius: var(--r-full); white-space: nowrap; color: var(--text-2); background: var(--sunken); border: 1px solid var(--border); }
.atlas-dot { display: inline-block; width: 8px; height: 8px; border-radius: var(--r-full); flex: none; box-shadow: none; }
.atlas-dot.is-star { width: 10px; height: 10px; }
.atlas-linked { margin: 10px 0 0; font-size: var(--fs-ui); color: var(--text-2); }
.atlas-linked .atlas-label { margin-right: var(--s-4); }
.atlas-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; margin-bottom: 14px; font-size: var(--fs-ui); color: var(--text-3); }
.atlas-crumb { display: inline-flex; align-items: center; gap: var(--s-4); }
.atlas-crumb .atlas-link { color: var(--text-2); gap: 6px; }
.atlas-crumb-sep { margin: 0 6px; color: var(--text-3); }
.atlas-crumb-here { display: inline-flex; align-items: center; gap: 6px; color: var(--text-1); }

/* ---- feedback ---- */
.atlas-loading { display: flex; align-items: center; gap: var(--s-12); color: var(--text-2); padding: var(--s-40) 0; }
.atlas-orbit { width: var(--s-24); height: 2px; border-radius: var(--r-full); background: var(--accent); }
.atlas-error { display: flex; gap: var(--s-12); align-items: baseline; color: var(--danger-text); background: var(--danger-soft); border: 1px solid var(--danger); border-radius: var(--r-md); padding: 10px 14px; margin: var(--s-12) 0; }
.atlas-flash { position: sticky; top: 0; z-index: var(--z-toast); display: flex; align-items: center; gap: 10px; padding: 9px var(--s-20); background: var(--accent-soft); border-bottom: 1px solid var(--border-strong); color: var(--text-1); font-size: var(--fs-ui); }
.atlas-flash svg { color: var(--accent); }
.atlas-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 14px; margin-bottom: var(--s-12); border-radius: var(--r-md); background: var(--accent-soft); border: 1px solid var(--border-strong); font-size: var(--fs-ui); }
.atlas-banner svg { color: var(--accent); }
.atlas-banner code { font-family: var(--font-mono); font-size: var(--fs-meta); background: var(--sunken); padding: 2px 6px; border-radius: var(--r-sm); }
.atlas-banner.is-warn { background: var(--gold-soft); border-color: var(--gold); }
.atlas-panel { padding: 18px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); }
.atlas-root kbd { font: var(--t-mono); font-weight: 500; color: var(--text-3); border: 1px solid var(--border-strong); border-bottom-width: 2px; border-radius: var(--r-xs); padding: 0 5px; background: var(--sunken); }
.atlas-menu-item.is-own { margin-top: var(--s-4); padding-top: 10px; border-top: 1px solid var(--border); border-radius: 0 0 var(--r-tab) var(--r-tab); }

/* ---- two panes of tabs: every view is a tab; drag one to reorder it, to the other pane, or to the edge to split ---- */
.atlas-body { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.atlas-strips { display: flex; flex: none; min-width: 0; border-bottom: 1px solid var(--border); background: var(--bg); }
.atlas-strip { flex: none; display: flex; align-items: flex-end; gap: var(--s-4); min-width: 0; padding: 5px 6px 0; }
.atlas-strip-tabs { position: relative; flex: 1; min-width: 0; display: flex; align-items: flex-end; gap: 2px; padding: 0 3px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.atlas-strip-tabs::-webkit-scrollbar { display: none; }
.atlas-strip + .atlas-strip { border-left: 1px solid var(--border-strong); }
.atlas-strip.is-drop { background: var(--accent-soft); }
.atlas-ptab { position: relative; flex: none; max-width: 230px; display: inline-flex; align-items: center; gap: 6px; height: 31px; padding: 0 5px 0 10px; border: 1px solid transparent; border-bottom: 0; border-radius: var(--r-md) var(--r-md) 0 0; color: var(--text-2); font: var(--t-meta); font-weight: 500; cursor: pointer; user-select: none; white-space: nowrap; }
.atlas-ptab:hover { color: var(--text-1); background: var(--hover); }
.atlas-ptab.is-on { color: var(--text-1); background: var(--surface); border-color: var(--border-strong); box-shadow: inset 0 2px 0 var(--accent); }
.atlas-ptab.is-on > .atlas-icon { color: var(--accent); }
.atlas-ptab:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.atlas-ptab.is-dragging { opacity: .4; }
.atlas-ptab.is-insert::before, .atlas-ptab-end { content: ""; position: absolute; left: -3px; top: 6px; bottom: 6px; width: 2px; border-radius: var(--r-xs); background: var(--accent); }
.atlas-ptab-end { position: relative; left: 0; top: 0; align-self: center; flex: none; height: 19px; margin-bottom: 6px; }
.atlas-ptab-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.atlas-ptab-close { flex: none; display: inline-grid; place-items: center; width: 20px; height: 20px; border: 0; border-radius: var(--r-xs); background: transparent; color: var(--text-3); cursor: pointer; opacity: 0; }
.atlas-ptab:hover .atlas-ptab-close, .atlas-ptab.is-on .atlas-ptab-close, .atlas-ptab-close:focus-visible { opacity: 1; }
.atlas-ptab-close:hover { color: var(--text-1); background: var(--hover); }
.atlas-strip-tool { width: var(--control-28); height: var(--control-28); align-self: center; margin-bottom: 2px; }
.atlas-panes { position: relative; flex: 1; min-height: 0; }
.atlas-tab-body { background: var(--surface); position: absolute; top: 0; bottom: 0; min-width: 0; overflow-y: auto; container-type: inline-size; scrollbar-color: var(--border-strong) transparent; }
.atlas-tab-body.is-hidden { content-visibility: hidden; visibility: hidden; pointer-events: none; }
.atlas-tab-body.is-discussion { overflow: hidden; display: flex; flex-direction: column; }
.atlas-pane-divider { position: absolute; z-index: 6; top: 0; bottom: 0; width: 9px; margin-left: calc(-1 * var(--s-4)); cursor: col-resize; touch-action: none; }
.atlas-pane-divider::after { content: ""; position: absolute; top: 0; bottom: 0; left: 4px; width: 1px; background: var(--border-strong); transition: background var(--motion-hover) var(--ease), box-shadow var(--motion-hover) var(--ease); }
.atlas-pane-divider:hover::after, .atlas-pane-divider:active::after { background: var(--hover); box-shadow: 0 0 0 1px var(--accent); }
.atlas-root.is-dragging-tab .atlas-tab-body { pointer-events: none; }
.atlas-drop-pane { position: absolute; z-index: 20; top: 0; bottom: 0; }
.atlas-drop-pane.is-over { background: var(--accent-soft); box-shadow: inset 0 0 0 2px var(--accent); }
.atlas-drop-split { position: absolute; z-index: 21; top: 10px; bottom: 10px; width: min(36%, 420px); display: grid; place-content: center; justify-items: center; gap: var(--s-8); border: 2px dashed var(--border-strong); border-radius: var(--r-lg); background: var(--bg); color: var(--text-2); font: var(--t-ui); font-weight: 500; }
.atlas-drop-split.is-right { right: 10px; }
.atlas-drop-split.is-left { left: 10px; }
.atlas-drop-split.is-over { border-color: var(--accent); background: var(--accent-soft); color: var(--text-1); }
.atlas-ask-top { display: inline-flex; align-items: center; gap: 7px; flex: none; border: 1px solid var(--border-strong); background: var(--accent-soft); color: var(--text-1); border-radius: var(--r-sm); padding: 5px 9px 5px 10px; font: var(--t-ui); font-weight: 500; cursor: pointer; }
.atlas-ask-top:hover { background: var(--hover); border-color: var(--accent); }
.atlas-ask-top:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.atlas-ask-top svg { color: var(--accent); }
.atlas-companion { position: relative; flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; background: var(--surface); }
.atlas-companion-head { display: flex; align-items: center; gap: 6px; padding: 9px var(--s-8) 7px 14px; flex: none; }
.atlas-companion-head .atlas-icon-button { width: var(--control-28); height: var(--control-28); }
.atlas-companion-title { flex: 1; min-width: 0; font: var(--t-ui); font-weight: 600; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.atlas-light { flex: none; display: inline-block; width: 8px; height: 8px; border-radius: var(--r-full); background: var(--idle); box-shadow: none; }
.atlas-light.is-running { border-radius: 0; clip-path: var(--star-shape); background: var(--accent); animation: atlas-twinkle var(--motion-twinkle) var(--ease) infinite; }
.atlas-light.is-done { background: var(--success-text); box-shadow: none; }
.atlas-chips { display: flex; flex-wrap: wrap; gap: 5px; padding: 0 14px 9px; }
.atlas-ctx { display: inline-flex; align-items: baseline; gap: 6px; max-width: 100%; min-width: 0; padding: 2px var(--s-8); border-radius: var(--r-sm); background: var(--sunken); border: 1px solid var(--border); font-size: var(--fs-meta); color: var(--text-2); }
.atlas-ctx-label { flex: none; font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-3); }
.atlas-ctx-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.atlas-ctx.is-accent { border-color: var(--accent); background: var(--accent-soft); color: var(--text-1); }
.atlas-companion-actions { display: flex; align-items: center; gap: 14px; padding: 0 14px 9px; font-size: var(--fs-meta); border-bottom: 1px solid var(--border); flex: none; }
.atlas-spacer { flex: 1; }
.atlas-companion-body, .atlas-embedded { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.atlas-embedded > * { flex: 1; min-height: 0; }
.atlas-companion-wait { display: flex; align-items: center; gap: var(--s-12); padding: 26px var(--s-16); color: var(--text-3); }
.atlas-companion-fallback { display: grid; justify-items: start; gap: 10px; padding: 18px var(--s-16); color: var(--text-2); }

/* ---- a paper in a tab: details, add to the library for a topic ---- */
.atlas-ref-add { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-8) 10px; margin: 10px 0 var(--s-12); padding: 10px var(--s-12); border: 1px solid var(--border-strong); border-radius: var(--r-md); background: var(--accent-soft); }
.atlas-ref-add > .atlas-input { flex: 1 1 200px; width: auto; min-width: 0; }
.atlas-ref-for { display: inline-flex; align-items: center; gap: 7px; flex: 1 1 260px; min-width: 0; }
.atlas-ref-for > span { font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-3); }
.atlas-ref-for > select { flex: 1; min-width: 0; }
.atlas-ref-abstract { margin: 0; color: var(--text-2); line-height: 1.6; }

/* ---- adding and writing from anywhere: the + panel and the Write page ---- */
.atlas-quick { position: absolute; z-index: var(--z-popover); top: 16px; left: 50%; transform: translateX(-50%); width: min(620px, calc(100% - 32px)); display: grid; gap: 10px; padding: var(--s-12); background: var(--raised); border: 1px solid var(--border-strong); border-radius: var(--r-lg); box-shadow: var(--shadow-3); }
.atlas-quick .atlas-seg { justify-self: start; }
.atlas-quick-body { display: grid; gap: var(--s-8); }
.atlas-quick-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-8); }
.atlas-quick-row > .atlas-input { flex: 1 1 260px; width: auto; min-width: 0; }
.atlas-quick-folder { flex: 0 1 220px; }
.atlas-quick-found { display: grid; gap: var(--s-4); padding: 10px var(--s-12); border: 1px solid var(--border); border-radius: var(--r-md); background: var(--accent-soft); }
.atlas-quick-title { margin: 0; font: var(--t-h3); color: var(--text-1); }
.atlas-quick-found .atlas-muted { margin: 0; }
.atlas-quick-more { margin: 0; font-size: var(--fs-meta); color: var(--text-3); }
.atlas-write-row { display: flex; align-items: center; gap: var(--s-8); }
.atlas-write-row > .atlas-item { flex: 1; min-width: 0; }

/* ---- asking: the ask bar and the selection tools ---- */
.atlas-askbar { position: absolute; z-index: var(--z-popover); top: 16px; left: 50%; transform: translateX(-50%); width: min(660px, calc(100% - 32px)); padding: var(--s-12) var(--s-12) 10px; background: var(--raised); border: 1px solid var(--border-strong); border-radius: var(--r-lg); box-shadow: var(--shadow-3); }
.atlas-askbar .atlas-chips { padding: 0 2px 10px; }
.atlas-askbar-row { display: flex; align-items: center; gap: 10px; padding: var(--s-4) var(--s-4) var(--s-4) 11px; border: 1px solid var(--border-control); border-radius: var(--r-sm); background: var(--sunken); }
.atlas-askbar-row:focus-within { border-color: var(--accent); }
.atlas-askbar-row > svg { color: var(--accent); }
.atlas-askbar-input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--text-1); font: var(--t-body); padding: 6px 0; }
.atlas-askbar-input::placeholder, .atlas-seltools-input::placeholder { color: var(--text-3); }
.atlas-askbar-error { margin: 6px var(--s-4) 0; font-size: var(--fs-meta); color: var(--danger-text); }
.atlas-askbar-moves { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
.atlas-move { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); background: var(--accent-soft); color: var(--text-2); border-radius: var(--r-tab); padding: var(--s-4) 9px; font: var(--t-meta); font-weight: 500; cursor: pointer; }
.atlas-move:hover, .atlas-move:focus-visible { color: var(--text-1); background: var(--hover); border-color: var(--border-strong); outline: none; }
.atlas-hint { font-size: var(--fs-meta); color: var(--text-3); }
.atlas-seltools { position: absolute; z-index: var(--z-popover); display: flex; flex-wrap: wrap; align-items: center; gap: 2px; max-width: calc(100% - 16px); padding: 3px; background: var(--raised); border: 1px solid var(--border-strong); border-radius: var(--r-md); box-shadow: var(--shadow-2); }
.atlas-seltool { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: var(--text-2); padding: var(--s-4) var(--s-8); border-radius: var(--r-sm); font: var(--t-meta); font-weight: 500; white-space: nowrap; cursor: pointer; }
.atlas-seltool:hover, .atlas-seltool:focus-visible { color: var(--text-1); background: var(--hover); outline: none; }
.atlas-seltool.is-primary { color: var(--text-on-accent); background: var(--accent); }
.atlas-seltool.is-primary:hover, .atlas-seltool.is-primary:focus-visible { color: var(--text-on-accent); background: var(--accent-hover); }
.atlas-seltools-sep { width: 1px; align-self: stretch; margin: 3px; background: var(--border-strong); }
.atlas-seltools-ask { display: flex; align-items: center; gap: var(--s-8); width: min(520px, calc(100vw - 48px)); padding: 0 2px 0 9px; }
.atlas-seltools-ask > svg { color: var(--accent); }
.atlas-seltools-input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--text-1); font: var(--t-ui); padding: 5px 0; }

/* ---- discussions ---- */
.atlas-discussions .atlas-items { margin-bottom: 6px; }
.atlas-discussions > .atlas-button { margin-top: 6px; }
.atlas-thread-item .atlas-light { align-self: flex-start; margin-top: 6px; }
.atlas-thread-item.is-current { background: var(--selected); box-shadow: inset 2px 0 0 var(--accent); }
.atlas-pulse .atlas-discussions { margin-top: 18px; padding: 0; background: none; border: 0; }
.atlas-topic-side .atlas-discussions .atlas-empty { font-size: var(--fs-meta); }
.atlas-doc-threads .atlas-light { width: 7px; height: 7px; margin-right: 6px; }

/* ---- universe ---- */
.atlas-hero { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px 30px; margin-bottom: var(--s-8); }
.atlas-hero-text { max-width: 760px; }
.atlas-hero h1 { font: var(--t-h1); }
.atlas-hero-actions { display: flex; align-items: center; gap: var(--s-8); }
.atlas-stats { display: flex; flex-wrap: wrap; gap: var(--s-8) 26px; margin: var(--s-4) 0 0; }
.atlas-stats div { display: flex; flex-direction: column-reverse; }
.atlas-stats dt { font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-3); }
.atlas-stats dd { margin: 0; font: var(--t-h1); color: var(--text-1); }
.atlas-universe { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 22px; align-items: start; margin-top: 10px; }
.atlas-chart { position: relative; max-width: 760px; width: 100%; justify-self: center; }
.atlas-chart svg { display: block; width: 100%; height: auto; }
.atlas-grid circle, .atlas-grid line { stroke: var(--sky-line); stroke-width: 1; fill: none; stroke-dasharray: 2 7; }
.atlas-sector { fill: none; stroke-width: 4; stroke-linecap: round; opacity: .9; cursor: pointer; transition: opacity var(--motion-hover) var(--ease); }
.atlas-sector.is-faded { opacity: .18; }
.atlas-edge { stroke-width: 1.3; opacity: .55; transition: opacity var(--motion-hover) var(--ease); }
.atlas-spoke { stroke: rgba(var(--map-gold-rgb), .12); stroke-width: 1; transition: opacity var(--motion-hover) var(--ease); }
.atlas-link-arc { fill: none; stroke: rgba(var(--map-glow-rgb), .16); stroke-width: 1; transition: stroke var(--motion-hover) var(--ease), opacity var(--motion-hover) var(--ease); }
.atlas-link-arc.is-lit { stroke: rgba(var(--map-gold-rgb), .75); stroke-width: 1.4; }
.atlas-star { cursor: pointer; transition: opacity var(--motion-hover) var(--ease); outline: none; }
.atlas-star-ring { fill: var(--map-sky); stroke: rgba(var(--map-glow-rgb), .3); stroke-width: 1; }
.atlas-star.is-lit .atlas-star-ring, .atlas-star:focus-visible .atlas-star-ring { stroke: var(--text-1); stroke-width: 2; }
.atlas-core { cursor: pointer; outline: none; }
.atlas-core:focus-visible circle:last-of-type { stroke: var(--text-1); stroke-width: 2; }
.atlas-chart-label text { fill: var(--text-2); font: var(--t-meta); font-weight: 500; }
.atlas-leader { stroke: rgba(var(--map-glow-rgb), .14); stroke-width: 1; stroke-dasharray: 1 4; }
.atlas-edge.is-faded, .atlas-spoke.is-faded, .atlas-star.is-faded, .atlas-chart-label.is-faded, .atlas-link-arc.is-faded { opacity: .14; }
.atlas-tip { position: absolute; z-index: var(--z-popover); width: 300px; padding: var(--s-12) 14px; pointer-events: none; background: var(--raised); border: 1px solid var(--border-strong); border-radius: var(--r-md); box-shadow: var(--shadow-2); display: grid; gap: 6px; }
.atlas-tip-dir { display: flex; align-items: center; gap: 7px; font-size: var(--fs-meta); color: var(--text-3); }
.atlas-tip-title { font: var(--t-h3); color: var(--text-1); }
.atlas-tip-text { font-size: var(--fs-meta); color: var(--text-2); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.atlas-tip-latest { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: var(--fs-meta); color: var(--text-1); }
.atlas-tip-facts { font-size: var(--fs-meta); color: var(--text-3); }
.atlas-pulse { padding: var(--s-16); border-radius: var(--r-lg); background: var(--raised); border: 1px solid var(--border); }
.atlas-pulse ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.atlas-pulse-row { display: grid; grid-template-columns: 3px auto minmax(0, 1fr); grid-template-areas: "mark date topic" "mark name name" "mark status status"; column-gap: 9px; row-gap: 1px; width: 100%; text-align: left; border: 0; background: transparent; color: inherit; font: inherit; padding: 7px var(--s-8); border-radius: var(--r-md); cursor: pointer; }
.atlas-pulse-row:hover { background: var(--hover); }
.atlas-pulse-mark { grid-area: mark; border-radius: var(--r-xs); }
.atlas-pulse-row .atlas-date { grid-area: date; }
.atlas-pulse-topic { grid-area: topic; font-size: var(--fs-meta); font-weight: 600; color: var(--text-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.atlas-pulse-name { grid-area: name; font-size: var(--fs-meta); color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.atlas-pulse-row .atlas-chip { grid-area: status; justify-self: start; margin-top: 2px; }
.atlas-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px var(--s-8); margin: var(--s-16) 0 6px; }
.atlas-legend-item { display: inline-flex; align-items: center; gap: 7px; padding: var(--s-4) 11px; border-radius: var(--r-full); border: 1px solid var(--border); background: var(--surface); color: var(--text-2); font: inherit; font-size: var(--fs-meta); cursor: pointer; }
.atlas-legend-item:hover, .atlas-legend-item.is-on { color: var(--text-1); border-color: var(--border-strong); background: var(--hover); }
.atlas-legend-item.is-static { cursor: default; }
.atlas-legend-item .atlas-count { margin-left: 2px; }
.atlas-legend-note { font-size: var(--fs-meta); color: var(--text-3); margin-left: 6px; }

/* ---- directions and topic cards ---- */
.atlas-direction { margin-top: var(--s-40); scroll-margin-top: var(--s-16); }
.atlas-direction-head { display: flex; gap: 14px; align-items: stretch; margin-bottom: 14px; }
.atlas-direction-bar { flex: none; width: 4px; border-radius: var(--r-xs); background: var(--dir); }
.atlas-direction-head h2 { margin: 0 0 var(--s-4); font: var(--t-h2); color: var(--text-1); }
.atlas-direction-lead { margin: 0; color: var(--text-2); font-size: var(--fs-body); max-width: 820px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.atlas-direction.is-quiet .atlas-direction-head h2 { color: var(--text-2); }
.atlas-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--s-12); }
.atlas-card { position: relative; display: flex; flex-direction: column; gap: var(--s-8); text-align: left; font: inherit; color: inherit; padding: 14px var(--s-16) var(--s-12); border-radius: var(--r-md); cursor: pointer; background: var(--raised); border: 1px solid var(--border); box-shadow: var(--shadow-1); transition: border-color var(--motion-hover) var(--ease), box-shadow var(--motion-hover) var(--ease); }
.atlas-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-1); }
.atlas-card-head { display: flex; align-items: center; gap: 10px; }
.atlas-card-title { font: var(--t-h3); color: var(--text-1); overflow-wrap: anywhere; }
.atlas-card-text { font-size: var(--fs-ui); color: var(--text-2); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.atlas-card-latest { display: flex; align-items: center; gap: var(--s-8); min-width: 0; font-size: var(--fs-meta); color: var(--text-1); }
.atlas-card-thread { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.atlas-card-foot { display: flex; align-items: center; gap: 10px; margin-top: auto; padding-top: 6px; border-top: 1px solid var(--border); }
.atlas-card-counts { display: flex; flex-wrap: wrap; gap: 10px; color: var(--text-3); font-size: var(--fs-meta); }
.atlas-card-counts span { display: inline-flex; align-items: center; gap: var(--s-4); }
.atlas-card-foot .atlas-date { margin-left: auto; }
.atlas-root-sections { margin-top: 44px; }

/* ---- folds ---- */
.atlas-fold { border-top: 1px solid var(--border); }
.atlas-fold-head { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; border: 0; background: transparent; color: var(--text-1); font: var(--t-body); font-weight: 500; padding: 10px var(--s-4); cursor: pointer; }
.atlas-fold-head:hover { color: var(--text-1); }
.atlas-fold-head svg { color: var(--text-3); }
.atlas-fold-mark { width: 12px; color: var(--text-3); font-size: var(--fs-meta); transition: transform var(--motion-hover) var(--ease); }
.atlas-fold.is-open > .atlas-fold-head .atlas-fold-mark { transform: rotate(90deg); }
.atlas-fold-title { flex: 1; min-width: 0; }
.atlas-fold-body { padding: 2px var(--s-4) var(--s-16) 25px; }

/* ---- figures inside notes ---- */
.atlas-md-figure { margin: var(--s-16) 0 var(--s-8); }
.atlas-md-figure img { display: block; max-width: 100%; height: auto; border-radius: var(--r-tab); border: 1px solid var(--border); background: var(--paper); }
.atlas-md-figure img[title='Open the figure'] { cursor: zoom-in; }

/* ---- where a link to a section lands ---- */
.atlas-fold, .atlas-opening, .atlas-section, .atlas-markdown :is(h1, h2, h3, h4, h5, h6) { scroll-margin-top: 14px; }
.atlas-target { border-radius: var(--r-xs); outline: 2px solid var(--accent); outline-offset: -2px; }
@keyframes atlas-twinkle {
  0%, 100% { transform: scale(.75) rotate(0deg); opacity: .65; }
  50% { transform: scale(1.1) rotate(45deg); opacity: 1; }
}

/* ---- topic workspace ---- */
.atlas-topic-head { position: relative; padding: 6px 0 var(--s-4); }
.atlas-topic-head > * { position: relative; z-index: 1; }
.atlas-meta-fact { color: var(--text-2); }
.atlas-context { display: flex; gap: var(--s-12); align-items: baseline; margin: var(--s-8) 0 22px; padding: var(--s-12) var(--s-16); border-radius: var(--r-md); border: 1px solid var(--border); border-left: 3px solid var(--dir); background: var(--surface); font-size: var(--fs-body); color: var(--text-1); }
.atlas-context .atlas-label { flex: none; }
.atlas-topic-grid { display: grid; grid-template-columns: minmax(0, 1fr) 350px; gap: 34px; align-items: start; }
.atlas-topic-side { position: sticky; top: 12px; display: grid; gap: var(--s-16); }
.atlas-side-block { padding: 14px 14px 10px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); }
.atlas-side-block > h2 svg { color: var(--text-3); }
.atlas-side-block .atlas-fold:first-of-type { border-top: 0; }
.atlas-side-block .atlas-fold-body { padding: 0 0 var(--s-8); }
.atlas-branch { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px; width: 100%; text-align: left; border: 0; background: transparent; color: inherit; font: inherit; padding: var(--s-8) var(--s-8); border-radius: var(--r-md); cursor: pointer; }
.atlas-branch:hover { background: var(--hover); }
.atlas-branch-title { font-weight: 500; color: var(--text-1); font-size: var(--fs-body); }
.atlas-branch-latest { grid-column: 1 / -1; display: flex; align-items: center; gap: 6px; font-size: var(--fs-meta); color: var(--text-2); min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.atlas-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; }
.atlas-item { display: flex; align-items: flex-start; gap: 9px; width: 100%; text-align: left; border: 0; background: transparent; color: var(--text-1); font: inherit; padding: 7px var(--s-8); border-radius: var(--r-md); cursor: pointer; }
.atlas-item:hover:not(:disabled) { background: var(--hover); }
.atlas-item > svg { margin-top: 2px; color: var(--text-3); }
.atlas-item.is-missing { opacity: .55; cursor: default; }
.atlas-item-text { display: grid; min-width: 0; flex: 1; }
.atlas-item-label { font-size: var(--fs-ui); overflow-wrap: anywhere; }
.atlas-item-sub { font-family: var(--font-mono); font-size: var(--fs-meta); color: var(--text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.atlas-item .atlas-date { margin-left: auto; }
.atlas-opening { margin-bottom: var(--s-8); }
.atlas-timeline { list-style: none; margin: var(--s-4) 0 0; padding: 0 0 0 18px; position: relative; }
.atlas-timeline::before { content: ""; position: absolute; left: 5px; top: 8px; bottom: 8px; width: 1px; background: var(--border-strong); }
.atlas-thread { position: relative; padding: var(--s-4) 0 14px 10px; }
.atlas-thread-node { position: absolute; left: -17px; top: 9px; width: 9px; height: 9px; border-radius: var(--r-full); background: var(--bg); border: 2px solid var(--dir); }
.atlas-thread-head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-8); margin-bottom: 2px; }
.atlas-thread-name { font-weight: 600; color: var(--text-1); }
.atlas-thread-head .atlas-date { margin-left: auto; }
.atlas-newnote { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 10px var(--s-12); margin: var(--s-4) 0 var(--s-12); padding: 14px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border-strong); max-width: 760px; }
.atlas-newnote label { display: grid; gap: var(--s-4); font-size: var(--fs-meta); color: var(--text-3); }
.atlas-newnote .atlas-seg { grid-column: 1 / -1; justify-self: start; }
.atlas-newnote-foot { grid-column: 1 / -1; display: flex; align-items: center; gap: var(--s-8); }
.atlas-newnote-foot .atlas-path { flex: 1; }
.atlas-seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: var(--r-md); background: var(--sunken); border: 1px solid var(--border); }
.atlas-seg-item { display: inline-flex; align-items: center; border: 0; background: transparent; color: var(--text-2); padding: 5px var(--s-12); border-radius: var(--r-sm); font: inherit; font-size: var(--fs-ui); cursor: pointer; }
.atlas-seg-item.is-on { color: var(--text-1); background: var(--selected); box-shadow: inset 0 0 0 1px var(--border-strong); }
.atlas-seg.is-tabs { margin-top: var(--s-4); }

/* ---- reading ---- */
.atlas-markdown { font-size: var(--fs-body); line-height: 1.72; overflow-wrap: anywhere; color: var(--text-1); }
.atlas-markdown.is-compact { font-size: var(--fs-body); line-height: 1.6; color: var(--text-2); }
.atlas-markdown a { color: var(--accent); }
.atlas-markdown table { display: block; overflow-x: auto; }
.atlas-markdown pre { overflow-x: auto; }
.atlas-markdown img { max-width: 100%; height: auto; border-radius: var(--r-tab); background: var(--paper); }
.atlas-opening .atlas-markdown, .atlas-reading .atlas-markdown, .atlas-fold-body > .atlas-markdown { font: var(--t-read); max-width: 72ch; }
.atlas-plain { white-space: pre-wrap; }
.atlas-doc-head { margin-bottom: var(--s-4); }
.atlas-doc-body { position: relative; margin-top: var(--s-16); }
.atlas-reading { max-width: 860px; }
.atlas-source { border-radius: var(--r-sm); background: var(--sunken); border: 1px solid var(--border); padding: 14px 0; overflow-x: auto; }
.atlas-lines { list-style: none; counter-reset: line; margin: 0; padding: 0; font: var(--t-mono); color: var(--text-1); }
.atlas-lines li { counter-increment: line; position: relative; padding: 0 var(--s-16) 0 5em; white-space: pre-wrap; overflow-wrap: anywhere; }
.atlas-lines li::before { content: counter(line); position: absolute; left: 0; width: 3.6em; text-align: right; color: var(--text-3); }
.atlas-lines .k { color: var(--code-key); }
.atlas-lines .m { color: var(--code-math); }
.atlas-lines .c { color: var(--code-comment); font-style: italic; }
.atlas-table-wrap { overflow: auto; max-height: 75vh; border-radius: var(--r-sm); border: 1px solid var(--border); }
.atlas-table { border-collapse: collapse; font: var(--t-mono); }
.atlas-table th, .atlas-table td { padding: 5px var(--s-12); border-bottom: 1px solid var(--border); text-align: left; white-space: nowrap; }
.atlas-table th { position: sticky; top: 0; background: var(--raised); color: var(--text-1); }
.atlas-notebook { display: grid; gap: var(--s-12); max-width: 920px; }
.atlas-cell.is-code { border-left: 2px solid var(--border-strong); padding-left: var(--s-12); }
.atlas-cell-code, .atlas-cell-out { margin: 0; padding: 10px var(--s-12); border-radius: var(--r-sm); background: var(--sunken); font: var(--t-mono); white-space: pre-wrap; overflow-x: auto; }
.atlas-cell-out { margin-top: 6px; color: var(--text-2); background: transparent; border: 1px dashed var(--border); }
.atlas-cell-img { display: block; max-width: 100%; margin-top: var(--s-8); border-radius: var(--r-tab); background: var(--paper); }
.atlas-figure { margin: 0; display: grid; place-items: center; padding: 18px; border-radius: var(--r-lg); background: var(--sunken); }
.atlas-figure img { max-width: 100%; height: auto; border-radius: var(--r-sm); }
.atlas-video { width: 100%; max-height: 75vh; border-radius: var(--r-md); background: var(--media-black); }
.atlas-pdf { display: flex; flex-direction: column; align-items: center; gap: var(--s-16); padding: 0 0 var(--s-24); border-radius: var(--r-lg); background: radial-gradient(ellipse at top, var(--sunken), var(--table)); border: 1px solid var(--border); }
.atlas-pdf-bar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; width: 100%; padding: var(--s-8) 14px; background: var(--bg); border-bottom: 1px solid var(--border); border-radius: var(--r-lg) var(--r-lg) 0 0; }
.atlas-pdf-zoom { display: inline-flex; align-items: center; gap: var(--s-4); }
.atlas-pdf-page { position: relative; color: var(--paper-ink); background: var(--paper); box-shadow: var(--page-shadow); border-radius: var(--r-xs); }
.atlas-pdf-page canvas { display: block; }
.atlas-pdf-num { position: absolute; right: -36px; bottom: 4px; font: var(--t-mono); color: var(--text-3); }
.atlas-folder { display: grid; gap: var(--s-16); max-width: 860px; }
.atlas-readme { padding: 14px 18px; border-radius: var(--r-md); background: var(--surface); border: 1px solid var(--border); }

/* ---- editor ---- */
.atlas-editor { display: grid; gap: 10px; }
.atlas-editor-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-8); position: sticky; top: 0; z-index: 6; padding: var(--s-8) 0; background: var(--surface); }
.atlas-editor-status { margin-left: auto; font-size: var(--fs-meta); color: var(--text-3); }
.atlas-editor-status.is-dirty { color: var(--gold); }
.atlas-editor-status.is-error { color: var(--danger-text); }
.atlas-editor-split { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--s-16); }
.atlas-editor-split.has-preview, .atlas-editor-split:has(.atlas-tex-aside) { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.atlas-editor-split:has(.atlas-tex-aside) { grid-template-columns: minmax(0, 1fr) 260px; }
.atlas-editor-text { width: 100%; min-height: 62vh; height: calc(100vh - 290px); resize: vertical; padding: var(--s-16) 18px; border-radius: var(--r-sm); border: 1px solid var(--border-control); background: var(--sunken); color: var(--text-1); font: var(--t-mono); tab-size: 2; caret-color: var(--accent); }
.atlas-editor-text:focus { outline: 2px solid var(--accent); outline-offset: 0; }
.atlas-editor-preview { min-height: 62vh; height: calc(100vh - 290px); overflow-y: auto; padding: 14px 22px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--surface); }
.atlas-tex-aside { padding: 14px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--surface); align-self: start; display: grid; gap: var(--s-8); }
.atlas-tex-aside > h2 { margin: 0; font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-2); }
.atlas-outline { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: var(--fs-ui); color: var(--text-1); }
.atlas-outline .is-subsection { padding-left: var(--s-12); color: var(--text-2); }
.atlas-outline .is-subsubsection { padding-left: var(--s-24); color: var(--text-3); }

/* ---- library ---- */
.atlas-toolbar { display: flex; align-items: center; gap: 10px; margin: 6px 0 var(--s-12); }
.atlas-shelf { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-8); }
.atlas-paper { display: grid; grid-template-columns: 54px minmax(0, 1fr) auto; gap: 14px; align-items: start; padding: var(--s-12) 14px; border-radius: var(--r-md); background: var(--raised); border: 1px solid var(--border); }
.atlas-paper-spine { font: var(--t-mono); font-weight: 600; color: var(--accent); padding-top: 2px; }
.atlas-paper-main { display: grid; gap: var(--s-4); min-width: 0; }
.atlas-paper-title { border: 0; background: transparent; padding: 0; text-align: left; font: var(--t-h3); color: var(--text-1); cursor: pointer; }
.atlas-paper-title:hover:not(:disabled) { color: var(--text-1); text-decoration: underline; text-underline-offset: 3px; }
.atlas-paper-title:disabled { cursor: default; }
.atlas-paper-meta { display: flex; flex-wrap: wrap; gap: var(--s-4) var(--s-12); font-size: var(--fs-meta); color: var(--text-2); }
.atlas-paper-actions { display: flex; gap: 6px; }
.atlas-paper .atlas-linked { margin: 2px 0 0; font-size: var(--fs-meta); }
.atlas-bytopic { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 14px; margin-top: 18px; }
.atlas-bytopic .atlas-side-block > h2 { font-variant-caps: normal; letter-spacing: 0; font: var(--t-h3); color: var(--text-1); }
.atlas-entries { display: grid; gap: 6px; }
.atlas-entry { padding: 10px var(--s-12); border-radius: var(--r-md); border: 1px solid transparent; }
.atlas-entry:hover { background: var(--surface); border-color: var(--border); }
.atlas-entry-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--s-12); align-items: baseline; }
.atlas-entry-title { font: var(--t-h3); color: var(--text-1); }
.atlas-entry-tags { display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.atlas-entry-scope { margin: 3px 0 0; font-size: var(--fs-ui); color: var(--text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.atlas-entry-foot { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: baseline; margin-top: var(--s-4); font-size: var(--fs-meta); }
.atlas-entry-foot .atlas-linked { margin: 0; font-size: var(--fs-meta); }

/* ---- activity: what waits on you, what is running, teams ---- */
.atlas-nav-badge { min-width: 18px; height: 18px; display: inline-grid; place-items: center; padding: 0 5px; border-radius: var(--r-md); background: var(--gold-soft); color: var(--gold); font: var(--t-meta); font-weight: 600; font-variant-numeric: tabular-nums; }
.atlas-waiting > h2 { display: flex; align-items: center; gap: var(--s-8); margin: 0 0 10px; font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--gold); }
.atlas-waiting > h2::before { content: ""; width: 8px; height: 8px; border-radius: var(--r-full); background: var(--gold); }
.atlas-waiting ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.atlas-waiting-item { padding: var(--s-12) 14px; border-radius: var(--r-md); background: var(--gold-soft); border: 1px solid var(--gold); }
.atlas-waiting-head { display: flex; align-items: baseline; gap: 10px; }
.atlas-waiting-title { flex: 1; min-width: 0; text-align: left; border: 0; background: none; padding: 0; color: var(--text-1); font: var(--t-h3); cursor: pointer; overflow-wrap: anywhere; }
.atlas-waiting-title:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
.atlas-waiting-title:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(--r-xs); }
.atlas-waiting-topic { margin: 2px 0 0; font-size: var(--fs-meta); color: var(--text-3); }
.atlas-waiting-text { margin: var(--s-8) 0 0; color: var(--text-2); font-size: var(--fs-body); max-width: 760px; }
.atlas-waiting-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.atlas-waiting.is-compact { margin-bottom: var(--s-20); }
.atlas-waiting.is-compact ul { gap: 6px; }
.atlas-waiting.is-compact .atlas-waiting-item { padding: var(--s-8) 10px; border-radius: var(--r-md); }
.atlas-waiting.is-compact .atlas-waiting-title { font: var(--t-ui); font-weight: 600; }
.atlas-waiting.is-compact > .atlas-link { margin-top: var(--s-8); font-size: var(--fs-meta); }
.atlas-activity-group { margin: 0 0 18px; }
.atlas-activity-group > h3 { display: flex; align-items: center; gap: var(--s-8); margin: 0 0 6px; font: var(--t-h3); color: var(--text-1); }
.atlas-activity-group > ul, .atlas-activity-others { list-style: none; margin: 0; padding: 0; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--surface); }
.atlas-activity-row { display: grid; grid-template-columns: 92px minmax(0, 1fr) auto auto; align-items: start; gap: var(--s-12); padding: 9px 14px; border-top: 1px solid var(--border); }
.atlas-activity-row:first-child { border-top: 0; }
.atlas-activity-kind { font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-3); padding-top: 2px; }
.atlas-activity-main { min-width: 0; }
.atlas-activity-main > .atlas-link { text-align: left; overflow-wrap: anywhere; }
.atlas-activity-state { display: inline-flex; align-items: center; gap: 7px; font-size: var(--fs-meta); color: var(--text-2); padding-top: 3px; }
.atlas-activity-row > .atlas-date { padding-top: 3px; }
.atlas-activity-members { list-style: none; margin: 6px 0 0; padding: 0 0 0 var(--s-12); border-left: 1px solid var(--border-strong); display: grid; gap: 3px; }
.atlas-activity-members li { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--s-4) var(--s-8); font-size: var(--fs-ui); }
.atlas-activity-members .atlas-light { align-self: center; }
.atlas-activity-task { flex: 1 1 220px; min-width: 0; color: var(--text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.atlas-activity-team > .atlas-muted { margin: var(--s-4) 0 0; font-size: var(--fs-meta); }
.atlas-activity-main > .atlas-link { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.atlas-team-form { display: grid; gap: 14px; max-width: 820px; margin-top: 10px; }
.atlas-field { display: grid; gap: 5px; }
.atlas-field > span, .atlas-team-seat label > span { font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-3); }
.atlas-team-form textarea.atlas-input { resize: vertical; line-height: 1.5; }
.atlas-team-seats { margin: 0; padding: var(--s-12) 14px 10px; border: 1px solid var(--border); border-radius: var(--r-md); display: grid; gap: 10px; }
.atlas-team-seats > legend { padding: 0 6px; font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-2); }
.atlas-team-seat { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 32px; grid-template-areas: "role how model remove" "task task task task"; align-items: end; gap: var(--s-8) 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border); }
.atlas-team-seat:last-of-type { border-bottom: 0; }
.atlas-seat-role { grid-area: role; } .atlas-seat-how { grid-area: how; } .atlas-seat-task { grid-area: task; } .atlas-seat-model { grid-area: model; } .atlas-seat-remove { grid-area: remove; }
.atlas-team-seat select:disabled { opacity: .65; }
.atlas-team-seat label { display: grid; gap: var(--s-4); min-width: 0; }
.atlas-team-seat select.atlas-input { padding: 6px var(--s-8); }
.atlas-team-seats > .atlas-link { justify-self: start; font-size: var(--fs-ui); }
/* ---- PDF text layer (PDF.js 6): transparent text over the drawn page, for selection ---- */
.atlas-pdf-page { --scale-round-x: 1px; --scale-round-y: 1px; --total-scale-factor: 1; }
.atlas-pdf-text { position: absolute; text-align: initial; inset: 0; overflow: clip; opacity: 1; line-height: 1; -webkit-text-size-adjust: none; text-size-adjust: none; forced-color-adjust: none; transform-origin: 0 0; caret-color: CanvasText; z-index: 0; --min-font-size: 1; --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size)); --min-font-size-inv: calc(1 / var(--min-font-size)); }
.atlas-pdf-text :is(span, br) { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0% 0%; }
.atlas-pdf-text > :not(.markedContent), .atlas-pdf-text .markedContent span:not(.markedContent) { z-index: 1; --font-height: 0; font-size: calc(var(--text-scale-factor) * var(--font-height)); --scale-x: 1; --rotate: 0deg; transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv)); }
.atlas-pdf-text .markedContent { display: contents; }
.atlas-pdf-text span[role="img"] { user-select: none; cursor: default; }
.atlas-pdf-text ::selection { background: var(--accent-soft); }
.atlas-pdf-text br::selection { background: transparent; }
.atlas-pdf-text .endOfContent { display: block; position: absolute; inset: 100% 0 0; z-index: 0; cursor: default; user-select: none; }

/* ---- a paper and its reading note ---- */
.atlas-pdf-layout.has-aside { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: var(--s-16); align-items: start; }
.atlas-paper-aside { position: sticky; top: 12px; display: grid; gap: 10px; padding: 14px; border-radius: var(--r-lg); border: 1px solid var(--border); background: var(--surface); max-height: calc(100vh - 140px); overflow: auto; }
.atlas-paper-aside > h2, .atlas-paper-users > h2 { margin: 0; font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-2); }
.atlas-paper-note { display: grid; gap: var(--s-8); }
.atlas-paper-note-title { text-align: left; font: var(--t-h3); }
.atlas-paper-yours { font-size: var(--fs-ui); }
.atlas-paper-yours .atlas-markdown { font-size: var(--fs-ui); }
.atlas-paper-start { display: grid; gap: var(--s-8); }
.atlas-paper-start .atlas-muted { margin: 0; font-size: var(--fs-meta); }
.atlas-paper-aside .atlas-actions { margin: 0; }
.atlas-paper-users { display: grid; gap: var(--s-4); justify-items: start; }
.atlas-paper-tip { margin: 0; font-size: var(--fs-meta); }

/* ---- discover and add ---- */
.atlas-discover { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 22px; align-items: start; margin-top: 18px; }
.atlas-discover-main > .atlas-section:first-of-type { margin-top: 14px; }
.atlas-discover-for { display: flex; align-items: center; gap: 10px; max-width: 640px; }
.atlas-discover-for .atlas-input { flex: 1; }
.atlas-inline-form { display: flex; gap: var(--s-8); align-items: center; margin: var(--s-8) 0 10px; max-width: 720px; }
.atlas-inline-form .atlas-input { flex: 1; }
.atlas-search-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.atlas-search-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px var(--s-4) 3px 10px; border-radius: var(--r-full); border: 1px solid var(--border-strong); background: var(--sunken); font-size: var(--fs-ui); }
.atlas-search-x { display: inline-grid; place-items: center; width: 20px; height: 20px; border: 0; border-radius: var(--r-full); background: transparent; color: var(--text-3); cursor: pointer; }
.atlas-search-x:hover { color: var(--text-1); background: var(--hover); }
.atlas-search-results { margin: 14px 0 var(--s-4); }
.atlas-search-results > h3 { margin: 0 0 var(--s-8); font: var(--t-h3); color: var(--text-1); }
.atlas-paper-cards { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-8); }
.atlas-paper-cards.is-nested { margin: var(--s-8) 0 var(--s-4) 14px; padding-left: var(--s-12); border-left: 1px solid var(--border-strong); }
.atlas-paper-card { padding: 11px 14px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--raised); }
.atlas-paper-card-head { display: flex; align-items: baseline; gap: var(--s-8); }
.atlas-paper-name { flex: 1; min-width: 0; color: var(--text-1); font: var(--t-h3); text-decoration: none; overflow-wrap: anywhere; }
a.atlas-paper-name:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
.atlas-paper-meta { margin: var(--s-4) 0 0; font-size: var(--fs-meta); color: var(--text-3); overflow-wrap: anywhere; }
.atlas-paper-why { margin: 6px 0 0; font-size: var(--fs-ui); color: var(--text-2); }
.atlas-abstract { margin-top: 6px; font-size: var(--fs-ui); color: var(--text-2); }
.atlas-abstract > summary { cursor: pointer; color: var(--text-3); font-size: var(--fs-meta); }
.atlas-abstract > p { margin: 6px 0 0; max-width: 780px; line-height: 1.55; }
.atlas-paper-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.atlas-chip.is-new { color: var(--text-on-accent); background: var(--accent); border-color: transparent; font-weight: 600; }
.atlas-cited { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.atlas-cited > li { padding: var(--s-8) 0; border-top: 1px solid var(--border); }
.atlas-cited > li:first-child { border-top: 0; }
.atlas-cited-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px var(--s-12); }
.atlas-cited-title { flex: 1 1 320px; min-width: 0; font: var(--t-h3); color: var(--text-1); }
.atlas-cited-count { display: inline-flex; align-items: center; gap: var(--s-8); font-size: var(--fs-meta); color: var(--text-2); }
.atlas-add { position: sticky; top: 12px; display: grid; gap: var(--s-12); padding: var(--s-16); border-radius: var(--r-lg); border: 1px solid var(--border-strong); background: var(--raised); }
.atlas-add > h2 { margin: 0; font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-2); }
.atlas-add-body { display: grid; gap: 10px; }
.atlas-add-body .atlas-inline-form { margin: 0; }
.atlas-add-note { margin: 0; font-size: var(--fs-meta); color: var(--text-3); }
.atlas-found { display: grid; gap: 7px; padding: var(--s-12); border-radius: var(--r-md); border: 1px solid var(--border); background: var(--sunken); }
.atlas-found-title { margin: 0; font: var(--t-h3); color: var(--text-1); }
.atlas-found-line { margin: 0; font-size: var(--fs-meta); color: var(--text-2); overflow-wrap: anywhere; }
.atlas-found-line code { font: var(--t-mono); color: var(--text-1); }
.atlas-check { display: flex; align-items: center; gap: var(--s-8); font-size: var(--fs-ui); color: var(--text-2); }
.atlas-field-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--s-8); }
.atlas-drop { position: relative; display: grid; place-items: center; gap: 6px; padding: 22px var(--s-12); border-radius: var(--r-md); border: 1.5px dashed var(--border-strong); color: var(--text-2); text-align: center; font-size: var(--fs-ui); cursor: pointer; }
.atlas-drop.is-over, .atlas-drop:hover { border-color: var(--accent); background: var(--hover); color: var(--text-1); }
.atlas-drop-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.atlas-dropped { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: var(--fs-ui); }
/* ---- write: the LaTeX source, a helper panel beside it ---- */
.atlas-write { display: grid; gap: 10px; }
.atlas-write-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-8); }
.atlas-write-engine { width: auto; max-width: 320px; padding: 5px 9px; font-size: var(--fs-ui); }
.atlas-write-main { margin: 0; font-size: var(--fs-meta); }
.atlas-write-split { display: grid; grid-template-columns: minmax(240px, var(--write-split, 64%)) 10px minmax(220px, 1fr); gap: 0; height: calc(100vh - 290px); min-height: 420px; }
.atlas-write-split.is-solo { grid-template-columns: minmax(0, 1fr); }
.atlas-write-source { display: grid; grid-template-columns: auto minmax(0, 1fr); min-height: 0; border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden; background: var(--sunken); }
.atlas-write-gutter { margin: 0; padding: var(--s-12) var(--s-8) var(--s-12) var(--s-12); overflow: hidden; text-align: right; color: var(--text-3); font: var(--t-mono); user-select: none; border-right: 1px solid var(--border); background: var(--surface); min-width: 44px; }
.atlas-write-text.atlas-editor-text { height: 100%; min-height: 0; margin: 0; border: 0; border-radius: 0; outline: none; resize: none; padding: var(--s-12); background: transparent; color: var(--text-1); font: var(--t-mono); white-space: pre; overflow: auto; tab-size: 2; box-shadow: none; }
.atlas-write-divider { position: relative; cursor: col-resize; touch-action: none; }
.atlas-write-divider::after { content: ""; position: absolute; top: 12px; bottom: 12px; left: 4px; width: 2px; border-radius: var(--r-xs); background: var(--border); transition: background var(--motion-hover) var(--ease); }
.atlas-write-divider:hover::after, .atlas-write-divider:active::after { background: var(--hover); }
.atlas-write-side { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden; background: var(--surface); }
.atlas-write-side-head { display: flex; align-items: center; justify-content: space-between; gap: var(--s-8); padding: 5px 5px 5px var(--s-12); border-bottom: 1px solid var(--border); font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-3); }
.atlas-write-side-head .atlas-icon-button { width: 26px; height: 26px; }
.atlas-write-panels { flex: none; }
.atlas-write-panels .atlas-seg-item { padding: var(--s-4) 10px; font-size: var(--fs-meta); }
.atlas-seg-item.is-alert { color: var(--danger-text); }
.atlas-write-pane { overflow: auto; min-height: 0; padding: 0; }
.atlas-write-pane > .atlas-empty, .atlas-write-pane > .atlas-muted { padding: 14px; margin: 0; }
.atlas-write-hint { margin: 0; font-size: var(--fs-meta); color: var(--text-3); }

/* ---- a LaTeX document's compiled PDF in its own tab ---- */
.atlas-preview { display: flex; flex-direction: column; min-height: 100%; }
.atlas-preview-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: var(--s-8) 14px; border-bottom: 1px solid var(--border); background: var(--bg); font-size: var(--fs-meta); color: var(--text-2); }
.atlas-preview-label { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px 2px var(--s-8); border-radius: var(--r-full); background: var(--accent-soft); border: 1px solid var(--accent); color: var(--text-1); font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); }
.atlas-preview-label > svg { color: var(--accent); }
.atlas-preview-of { display: inline-flex; align-items: baseline; gap: var(--s-4); min-width: 0; }
.atlas-preview .atlas-pdf { flex: 1; border: 0; border-radius: 0; }
.atlas-preview .atlas-pdf-bar { border-radius: 0; }
.atlas-preview > .atlas-empty { padding: 18px; }
.atlas-pdf.is-synced .atlas-pdf-page { cursor: text; }
.atlas-sync-mark { position: absolute; z-index: 3; pointer-events: none; border-radius: var(--r-xs); background: var(--accent-soft); box-shadow: 0 0 0 2px var(--accent); }
.atlas-problems { list-style: none; margin: 0; padding: var(--s-8); display: grid; gap: var(--s-4); }
.atlas-problems > li { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: 10px; align-items: baseline; padding: 7px var(--s-8); border-radius: var(--r-tab); font-size: var(--fs-ui); }
.atlas-problems > li:hover { background: var(--hover); }
.atlas-problem-kind { font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-3); }
.atlas-problems > li.is-error .atlas-problem-kind { color: var(--danger-text); }
.atlas-problems > li.is-warning .atlas-problem-kind { color: var(--gold); }
.atlas-problem-text { color: var(--text-1); overflow-wrap: anywhere; }
.atlas-write-outline { padding: var(--s-12) 14px; }
.atlas-write-outline li { display: flex; justify-content: space-between; gap: var(--s-8); }
.atlas-cite { display: grid; gap: var(--s-8); padding: var(--s-12); }
.atlas-cite .atlas-inline-form { margin: 0; }
.atlas-cite-note { margin: 0; font-size: var(--fs-meta); }
.atlas-cite h3 { margin: 6px 0 0; font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-3); }
.atlas-cite-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-4); }
.atlas-cite-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px; width: 100%; text-align: left; padding: var(--s-8) 10px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--sunken); color: inherit; font: inherit; cursor: pointer; }
.atlas-cite-item:hover:not(:disabled), .atlas-cite-item:focus-visible { border-color: var(--accent); background: var(--hover); outline: none; }
.atlas-cite-item:disabled { opacity: .55; cursor: default; }
.atlas-cite-title { grid-column: 1; font: var(--t-h3); color: var(--text-1); }
.atlas-cite-meta { grid-column: 1; font-size: var(--fs-meta); color: var(--text-3); }
.atlas-cite-item > code, .atlas-cite-item > .atlas-chip { grid-column: 2; grid-row: 1 / span 2; align-self: center; font: var(--t-mono); color: var(--text-2); }
/* ---- review: what a discussion changed ---- */
.atlas-review { flex: none; display: flex; flex-direction: column; min-height: 0; max-height: 46%; margin: var(--s-8) var(--s-12); border-radius: var(--r-md); border: 1px solid var(--gold); background: var(--gold-soft); }
.atlas-review-head { display: flex; align-items: center; gap: var(--s-8); width: 100%; padding: var(--s-8) var(--s-12); border: 0; background: transparent; color: var(--text-1); font: var(--t-meta); font-weight: 600; text-align: left; cursor: pointer; }
.atlas-review-head:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: var(--r-md); }
.atlas-review-toggle { margin-left: auto; font-weight: 500; color: var(--text-3); }
.atlas-review-body { display: grid; gap: var(--s-8); min-height: 0; overflow: auto; padding: 0 var(--s-12) 10px; }
.atlas-review-body > .atlas-muted { margin: 0; font-size: var(--fs-meta); }
.atlas-edit { display: grid; gap: var(--s-4); padding: var(--s-8) 10px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--sunken); }
.atlas-edit-where { font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-3); }
.atlas-edit-del, .atlas-edit-ins { display: grid; grid-template-columns: 14px minmax(0, 1fr); gap: 6px; font-size: var(--fs-ui); line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.atlas-edit-del { color: var(--text-2); }
.atlas-edit-ins { color: var(--text-1); }
.atlas-edit-sign { font: var(--t-mono); font-weight: 700; }
.atlas-edit-del .atlas-edit-sign { color: var(--del-ink); }
.atlas-edit-ins .atlas-edit-sign { color: var(--ins-ink); }
.atlas-edit-del del { color: var(--del-text); background: rgba(var(--del-rgb), .2); text-decoration: line-through; text-decoration-color: rgba(var(--del-2-rgb), .8); border-radius: var(--r-xs); }
.atlas-edit-ins ins { color: var(--ins-text); background: rgba(var(--ins-rgb), .2); text-decoration: none; border-radius: var(--r-xs); }
.atlas-edit-actions, .atlas-review-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.atlas-edit-actions { margin-top: 2px; }
.atlas-pending { margin: 0 0 var(--s-12); }
/* ---- search and learn ---- */
.atlas-search-form { display: flex; align-items: center; gap: 10px; margin: 6px 0 14px; padding: 6px 6px 6px 14px; border-radius: var(--r-lg); border: 1px solid var(--border-control); background: var(--sunken); }
.atlas-search-form > svg { color: var(--text-3); }
.atlas-search-form .atlas-input { flex: 1; border: 0; background: transparent; font-size: var(--fs-h3); padding: var(--s-8) var(--s-4); }
.atlas-search-form .atlas-input:focus { outline: none; }
.atlas-results { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: var(--s-4); }
.atlas-result { padding: 10px var(--s-12); border-radius: var(--r-md); }
.atlas-result:hover { background: var(--hover); }
.atlas-result-head { display: flex; align-items: baseline; gap: 10px; }
.atlas-result-kind { flex: none; width: 74px; font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-3); }
.atlas-result-title { min-width: 0; text-align: left; border: 0; background: none; padding: 0; color: var(--text-1); font: var(--t-h3); cursor: pointer; overflow-wrap: anywhere; }
.atlas-result-title:hover { color: var(--accent); text-decoration: underline; text-underline-offset: 3px; }
.atlas-result-title:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(--r-xs); }
.atlas-result-where { margin: 2px 0 0 84px; font-size: var(--fs-meta); color: var(--text-3); overflow-wrap: anywhere; }
.atlas-result-snippet { margin: var(--s-4) 0 0 84px; font-size: var(--fs-body); color: var(--text-2); line-height: 1.55; overflow-wrap: anywhere; }
.atlas-result-snippet mark, .atlas-learn mark { color: var(--mark-ink); background: var(--mark-bg); border-radius: var(--r-xs); padding: 0 2px; }
.atlas-learn-pick { max-width: 560px; margin: var(--s-4) 0 18px; }
.atlas-learn-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 28px; align-items: start; }
.atlas-learn-main h1 { margin-bottom: 14px; }
.atlas-learn-main h1 .atlas-link { font: inherit; color: inherit; text-align: left; }
.atlas-learn-question { margin: var(--s-4) 0 10px; font: var(--t-h2); font-weight: 500; color: var(--text-1); max-width: 780px; }
.atlas-learn-h { margin: 26px 0 10px; font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); color: var(--text-2); }
.atlas-route { margin: 0; padding-left: 22px; display: grid; gap: var(--s-8); font-size: var(--fs-body); }
.atlas-route .atlas-link { text-align: left; }
.atlas-learn-foot { font-size: var(--fs-meta); margin-top: var(--s-12); }
.atlas-learn-side { padding: 14px var(--s-16); border-radius: var(--r-lg); border: 1px solid var(--border); background: var(--surface); }
.atlas-learn-side .atlas-learn-h { margin-top: 0; }
.atlas-concepts { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-8); }
.atlas-concepts > li { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.atlas-concept { padding: var(--s-4) 10px; border-radius: var(--r-full); border: 1px solid var(--border-strong); background: var(--accent-soft); color: var(--text-1); font: var(--t-meta); font-weight: 500; cursor: pointer; }
.atlas-concept:hover { border-color: var(--accent); background: var(--hover); }
.atlas-concept-arrow { color: var(--text-3); }
.atlas-decide { display: grid; gap: 6px; margin-top: 10px; }
.atlas-decide-option { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: var(--s-8); align-items: baseline; width: 100%; text-align: left; padding: 7px 10px; border-radius: var(--r-md); border: 1px solid var(--gold); background: var(--sunken); color: var(--text-1); font: inherit; font-size: var(--fs-ui); cursor: pointer; }
.atlas-decide-option:hover, .atlas-decide-option:focus-visible { border-color: var(--gold); background: var(--gold-soft); outline: none; }
.atlas-decide-letter { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: var(--r-full); background: var(--gold-soft); color: var(--gold); font: var(--t-meta); font-weight: 700; }
@container (max-width: 1180px) {
  .atlas-universe { grid-template-columns: minmax(0, 1fr) 290px; }
  .atlas-topic-grid { grid-template-columns: minmax(0, 1fr) 310px; gap: 26px; }
}
@container (max-width: 900px) {
  .atlas-universe, .atlas-topic-grid { grid-template-columns: minmax(0, 1fr); }
  .atlas-topic-side { position: static; }
  .atlas-chart { max-width: 640px; }
}
@container (max-width: 760px) {
  .atlas-top { flex-wrap: wrap; gap: var(--s-8) var(--s-12); padding: var(--s-8) var(--s-12); }
  .atlas-tools { flex: 1 1 100%; margin-left: 0; order: 3; }
  .atlas-page { padding: var(--s-16) 14px 60px; }
  .atlas-page h1, .atlas-hero h1 { font-size: var(--fs-h2); }
  .atlas-editor-split.has-preview, .atlas-editor-split:has(.atlas-tex-aside) { grid-template-columns: minmax(0, 1fr); }
  .atlas-paper { grid-template-columns: minmax(0, 1fr); }
  .atlas-paper-spine { display: none; }
  .atlas-chart-label { display: none; }
}
@container (max-width: 1000px) {
  .atlas-learn-grid { grid-template-columns: minmax(0, 1fr); }
  .atlas-result-where, .atlas-result-snippet { margin-left: 0; }
  .atlas-discover { grid-template-columns: minmax(0, 1fr); }
  .atlas-add { position: static; order: -1; }
  .atlas-pdf-layout.has-aside { grid-template-columns: minmax(0, 1fr); }
  .atlas-paper-aside { position: static; max-height: none; }
}
@container (max-width: 640px) {
  .atlas-opening .atlas-markdown, .atlas-reading .atlas-markdown, .atlas-fold-body > .atlas-markdown { font: var(--t-read-compact); }
  .atlas-write-split { grid-template-columns: minmax(0, 1fr); height: auto; gap: var(--s-12); }
  .atlas-write-divider { display: none; }
  .atlas-write-source { height: 60vh; }
  .atlas-write-side { height: 70vh; }
  .atlas-ask-top kbd { display: none; }
  .atlas-activity-row { grid-template-columns: minmax(0, 1fr) auto; }
  .atlas-activity-kind, .atlas-activity-row > .atlas-date { display: none; }
  .atlas-team-seat { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 32px; grid-template-areas: "role how remove" "model model ." "task task task"; }
}
@keyframes atlas-twinkle {
  0%, 100% { transform: scale(.75) rotate(0deg); opacity: .65; }
  50% { transform: scale(1.1) rotate(45deg); opacity: 1; }
}
@keyframes atlas-flow { to { stroke-dashoffset: -18; } }
@media (prefers-reduced-motion: reduce) {
  .atlas-root, .atlas-root *, .atlas-root *::before, .atlas-root *::after {
    animation: none !important; transition: none !important; scroll-behavior: auto !important;
  }
}
`;

function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById('aitp-atlas-styles')) return;
  const style = document.createElement('style');
  style.id = 'aitp-atlas-styles';
  style.textContent = [ATLAS_FONT_CSS, themeCss(), STYLES, ATLAS_CONTROL_CSS, ATLAS_RAIL_CSS, ATLAS_TAB_CSS,
    ATLAS_FOCUS_CSS, ATLAS_PALETTE_CSS, ATLAS_MAP_CSS, ATLAS_DESK_CSS, ATLAS_INQUIRY_CSS, ATLAS_SURFACE_CSS, ATLAS_DISCUSSION_CSS, registryViewStyles, ATLAS_CONSTELLATION_CSS, ATLAS_TEAM_ASSEMBLY_CSS, ATLAS_TEAM_ROOM_CSS, ATLAS_TEAM_SEAT_CSS].join('\n');
  document.head.appendChild(style);
}

function AtlasIcon() {
  return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    h('circle', { cx: 12, cy: 12, r: 2.6, fill: 'currentColor', stroke: 'none' }),
    h('ellipse', { cx: 12, cy: 12, rx: 9.5, ry: 4.2, transform: 'rotate(-28 12 12)' }),
    h('circle', { cx: 19.6, cy: 8, r: 1.3, fill: 'currentColor', stroke: 'none' }));
}
