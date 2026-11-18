// ------------------------------------------------------------------ styles ---
// Two themes over one set of tokens (05-theme.js): the night observatory and day. One
// color per direction (the validated categorical slots), serif for what is read, sans for controls.

const STYLES = `
.atlas-root {
  --dir: var(--link);
  --serif: "Iowan Old Style", "Charter", "Cambria", "Georgia", serif;
  --sans: system-ui, -apple-system, "Segoe UI", sans-serif;
  --mono: ui-monospace, "Cascadia Code", "SFMono-Regular", Consolas, monospace;
  --dsw-alias-label-primary: var(--ink-1); --dsw-alias-label-secondary: var(--ink-2); --dsw-alias-label-tertiary: var(--ink-3);
  --dsw-alias-bg-base: var(--panel); --dsw-alias-bg-layer-1: var(--panel-2); --dsw-alias-bg-layer-2: var(--panel-3);
  --dsw-alias-border-l1: var(--line); --dsw-alias-border-l2: var(--line-2); --dsw-alias-brand-primary: var(--link);
  --dsw-alias-interactive-bg-hover: rgba(var(--accent-rgb), .08);
  /* DSH's embedded conversation (input box, message bubbles, menus) in Atlas's theme, whatever DSH's. */
  --dsw-specific-input-major: var(--input-major); --dsw-specific-bubble: var(--bubble); --dsw-specific-selector: var(--selector);
  --dsw-alias-border-l3: rgba(var(--accent-rgb), .2); --dsw-alias-border-l4: rgba(var(--accent-rgb), .26);
  --dsw-alias-label-caption: var(--ink-3); --dsw-alias-separator-primary: var(--line);
  --dsw-alias-scrollbar-bg-l2: rgba(var(--accent-rgb), .22); --dsw-alias-scrollbar-hover-l2: rgba(var(--accent-rgb), .34);
  --dsw-elevation-stroke-color: rgba(var(--accent-rgb), .22);
  container-type: inline-size;
  display: flex; flex-direction: column; height: 100%; min-height: 0;
  background: radial-gradient(1100px 520px at 78% -12%, rgba(var(--nebula-a-rgb), .20), transparent 62%), radial-gradient(900px 520px at -8% 108%, rgba(var(--nebula-b-rgb), .14), transparent 60%), var(--sky-0);
  color: var(--ink-1); font: 14px/1.55 var(--sans);
}
.atlas-root *, .atlas-root *::before, .atlas-root *::after { box-sizing: border-box; }
.atlas-icon { flex: none; }

/* ---- top bar ---- */
.atlas-top { display: flex; align-items: center; gap: 14px; padding: 9px 18px; border-bottom: 1px solid var(--line); background: rgba(var(--sky-rgb), .72); backdrop-filter: blur(10px); flex: none; }
.atlas-brand { display: inline-flex; align-items: center; gap: 8px; border: 0; background: none; color: var(--ink-1); font: 600 15px var(--sans); letter-spacing: .02em; cursor: pointer; padding: 4px 6px; border-radius: 8px; }
.atlas-brand svg { color: var(--gold); }
.atlas-nav { display: flex; gap: 2px; }
.atlas-nav-item { display: inline-flex; align-items: center; gap: 6px; border: 0; background: transparent; color: var(--ink-2); padding: 6px 11px; border-radius: 8px; font: inherit; cursor: pointer; }
.atlas-nav-item:hover { color: var(--ink-1); background: rgba(var(--accent-rgb), .08); }
.atlas-nav-item.is-on { color: var(--ink-1); background: rgba(var(--accent-rgb), .13); box-shadow: inset 0 0 0 1px var(--line-2); }
.atlas-tools { margin-left: auto; display: flex; align-items: center; gap: 6px; flex: 0 1 320px; }
.atlas-input { width: 100%; font: inherit; color: var(--ink-1); background: rgba(var(--panel-rgb), .9); border: 1px solid var(--line-2); border-radius: 9px; padding: 6px 11px; }
.atlas-input::placeholder { color: var(--ink-3); }
.atlas-input:focus { outline: 2px solid rgba(var(--accent-rgb), .55); outline-offset: 0; }
.atlas-icon-button { flex: none; display: inline-grid; place-items: center; width: 32px; height: 32px; border: 0; border-radius: 9px; background: transparent; color: var(--ink-2); cursor: pointer; }
.atlas-icon-button:hover { color: var(--ink-1); background: rgba(var(--accent-rgb), .1); }
.atlas-icon-button.is-busy svg { animation: atlas-spin 1.1s linear infinite; }

/* ---- page frame ---- */
.atlas-page { max-width: 980px; margin: 0 auto; padding: 22px 28px 80px; }
.atlas-page.is-wide { max-width: 1260px; }
.atlas-kicker { display: inline-flex; align-items: center; gap: 7px; margin: 0 0 6px; font-size: 11.5px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-3); }
.atlas-kicker::before { content: ""; width: 18px; height: 2px; border-radius: 2px; background: var(--dir); box-shadow: 0 0 10px var(--dir); }
.atlas-page h1 { margin: 0 0 8px; font: 600 30px/1.18 var(--serif); letter-spacing: -.01em; color: var(--ink-1); overflow-wrap: anywhere; }
.atlas-lede { margin: 0 0 12px; color: var(--ink-2); max-width: 680px; font-size: 15px; }
.atlas-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; color: var(--ink-3); font-size: 12.5px; margin-bottom: 12px; }
.atlas-path { font-family: var(--mono); font-size: 12px; color: var(--ink-3); overflow-wrap: anywhere; }
.atlas-date { font-family: var(--mono); font-size: 11.5px; color: var(--ink-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.atlas-label { font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); }
.atlas-muted { color: var(--ink-3); }
.atlas-count { margin-left: 8px; font: 500 12px var(--sans); color: var(--ink-3); }
.atlas-empty { color: var(--ink-3); margin: 8px 0; }
.atlas-setup { max-width: 680px; padding: 24px; margin: 0 auto; overflow-wrap: anywhere; }
.atlas-setup pre { background: var(--sky-1); border: 1px solid var(--line); border-radius: 8px; padding: 12px; overflow: auto; }
.atlas-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 6px 0 14px; }
.atlas-section { margin-top: 30px; }
.atlas-section > h2, .atlas-root-sections > h2, .atlas-side-block > h2, .atlas-pulse > h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font: 600 13px var(--sans); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-2); }

/* ---- buttons, chips, links ---- */
.atlas-button { display: inline-flex; align-items: center; gap: 7px; font: 500 13px var(--sans); color: var(--ink-1); background: rgba(var(--accent-rgb), .07); border: 1px solid var(--line-2); border-radius: 9px; padding: 6px 13px; cursor: pointer; transition: background .15s, border-color .15s, box-shadow .15s; }
.atlas-button:hover:not(:disabled) { background: rgba(var(--accent-rgb), .14); border-color: rgba(var(--accent-rgb), .45); }
.atlas-button:disabled { opacity: .45; cursor: default; }
.atlas-button.is-primary { color: var(--on-accent); background: linear-gradient(180deg, var(--accent-a), var(--accent-b)); border-color: transparent; box-shadow: 0 0 0 1px rgba(var(--accent-rgb), .3), 0 6px 22px -10px rgba(var(--accent-rgb), .9); }
.atlas-button.is-primary:hover:not(:disabled) { background: linear-gradient(180deg, var(--accent-a-hover), var(--accent-b-hover)); }
.atlas-button.is-quiet { background: transparent; border-color: transparent; color: var(--ink-2); }
.atlas-button.is-quiet:hover:not(:disabled) { color: var(--ink-1); background: rgba(var(--accent-rgb), .08); border-color: transparent; }
.atlas-button.is-small { padding: 3px 9px; font-size: 12px; border-radius: 7px; }
.atlas-button:focus-visible, .atlas-link:focus-visible, .atlas-card:focus-visible, .atlas-item:focus-visible, .atlas-nav-item:focus-visible, .atlas-fold-head:focus-visible, .atlas-seg-item:focus-visible, .atlas-pulse-row:focus-visible, .atlas-branch:focus-visible, .atlas-legend-item:focus-visible, .atlas-paper-title:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.atlas-ask { position: relative; display: inline-flex; }
.atlas-button.is-split { border-radius: 9px 0 0 9px; }
.atlas-button.is-caret { border-radius: 0 9px 9px 0; padding: 6px 9px; margin-left: 1px; }
.atlas-menu { position: absolute; z-index: 20; top: calc(100% + 6px); left: 0; min-width: 300px; padding: 6px; background: rgba(var(--panel-rgb), .98); border: 1px solid var(--line-2); border-radius: 12px; box-shadow: 0 18px 50px -12px rgba(var(--shadow-rgb), calc(.7 * var(--shadow-k))); }
.atlas-menu-item { display: grid; gap: 1px; width: 100%; text-align: left; border: 0; background: transparent; color: var(--ink-1); padding: 8px 10px; border-radius: 8px; cursor: pointer; font: inherit; }
.atlas-menu-item:hover, .atlas-menu-item:focus-visible { background: rgba(var(--accent-rgb), .12); outline: none; }
.atlas-menu-label { font-weight: 500; }
.atlas-menu-hint { font-size: 12px; color: var(--ink-3); }
.atlas-link { display: inline-flex; align-items: center; gap: 4px; border: 0; background: transparent; color: var(--link); font: inherit; padding: 0; cursor: pointer; text-align: left; }
.atlas-link:hover { text-decoration: underline; text-underline-offset: 3px; }
.atlas-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; line-height: 1.7; padding: 0 9px; border-radius: 999px; white-space: nowrap; color: var(--ink-2); background: rgba(var(--accent-rgb), .07); border: 1px solid var(--line); }
.atlas-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; flex: none; box-shadow: 0 0 0 2px rgba(var(--sky-rgb), .8); }
.atlas-dot.is-star { width: 10px; height: 10px; }
.atlas-linked { margin: 10px 0 0; font-size: 13px; color: var(--ink-2); }
.atlas-linked .atlas-label { margin-right: 4px; }
.atlas-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; margin-bottom: 14px; font-size: 13px; color: var(--ink-3); }
.atlas-crumb { display: inline-flex; align-items: center; gap: 4px; }
.atlas-crumb .atlas-link { color: var(--ink-2); gap: 6px; }
.atlas-crumb-sep { margin: 0 6px; color: var(--ink-3); }
.atlas-crumb-here { display: inline-flex; align-items: center; gap: 6px; color: var(--ink-1); }

/* ---- feedback ---- */
.atlas-loading { display: flex; align-items: center; gap: 12px; color: var(--ink-2); padding: 40px 0; }
.atlas-orbit { position: relative; width: 22px; height: 22px; border-radius: 50%; border: 1px solid var(--line-2); }
.atlas-orbit::after { content: ""; position: absolute; top: -3px; left: 8px; width: 6px; height: 6px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 10px var(--gold); transform-origin: 3px 14px; animation: atlas-spin 1.2s linear infinite; }
@keyframes atlas-spin { to { transform: rotate(360deg); } }
.atlas-error { display: flex; gap: 12px; align-items: baseline; color: var(--danger-ink); background: rgba(var(--danger-rgb), .12); border: 1px solid rgba(var(--danger-rgb), .35); border-radius: 10px; padding: 10px 14px; margin: 12px 0; }
.atlas-flash { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 10px; padding: 9px 20px; background: linear-gradient(90deg, rgba(var(--accent-rgb), .2), rgba(var(--accent-rgb), .06)); border-bottom: 1px solid var(--line-2); color: var(--ink-1); font-size: 13px; }
.atlas-flash svg { color: var(--gold); }
.atlas-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 14px; margin-bottom: 12px; border-radius: 10px; background: rgba(var(--accent-rgb), .08); border: 1px solid var(--line-2); font-size: 13px; }
.atlas-banner svg { color: var(--gold); }
.atlas-banner code { font-family: var(--mono); font-size: 12px; background: rgba(var(--shadow-rgb), calc(.3 * var(--shadow-k))); padding: 2px 6px; border-radius: 6px; }
.atlas-banner.is-warn { background: rgba(var(--warn-rgb), .1); border-color: rgba(var(--warn-rgb), .4); }
.atlas-panel { padding: 18px; border-radius: 12px; background: var(--panel); border: 1px solid var(--line); }
.atlas-root kbd { font: 500 10.5px var(--mono); color: var(--ink-3); border: 1px solid var(--line-2); border-bottom-width: 2px; border-radius: 5px; padding: 0 5px; background: rgba(var(--sky-rgb), .6); }
.atlas-menu-item.is-own { margin-top: 4px; padding-top: 10px; border-top: 1px solid var(--line); border-radius: 0 0 8px 8px; }

/* ---- two panes of tabs: every view is a tab; drag one to reorder it, to the other pane, or to the edge to split ---- */
.atlas-body { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.atlas-strips { display: flex; flex: none; min-width: 0; border-bottom: 1px solid var(--line); background: rgba(var(--sky-rgb), .55); }
.atlas-strip { flex: none; display: flex; align-items: flex-end; gap: 4px; min-width: 0; padding: 5px 6px 0; }
.atlas-strip-tabs { position: relative; flex: 1; min-width: 0; display: flex; align-items: flex-end; gap: 2px; padding: 0 3px; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
.atlas-strip-tabs::-webkit-scrollbar { display: none; }
.atlas-strip + .atlas-strip { border-left: 1px solid var(--line-2); }
.atlas-strip.is-drop { background: rgba(var(--accent-rgb), .07); }
.atlas-ptab { position: relative; flex: none; max-width: 230px; display: inline-flex; align-items: center; gap: 6px; height: 31px; padding: 0 5px 0 10px; border: 1px solid transparent; border-bottom: 0; border-radius: 9px 9px 0 0; color: var(--ink-2); font: 500 12.5px var(--sans); cursor: pointer; user-select: none; white-space: nowrap; }
.atlas-ptab:hover { color: var(--ink-1); background: rgba(var(--accent-rgb), .07); }
.atlas-ptab.is-on { color: var(--ink-1); background: rgba(var(--panel-rgb), .92); border-color: var(--line-2); box-shadow: inset 0 2px 0 var(--link); }
.atlas-ptab.is-on > .atlas-icon { color: var(--link); }
.atlas-ptab:focus-visible { outline: 2px solid var(--link); outline-offset: -2px; }
.atlas-ptab.is-dragging { opacity: .4; }
.atlas-ptab.is-insert::before, .atlas-ptab-end { content: ""; position: absolute; left: -3px; top: 6px; bottom: 6px; width: 2px; border-radius: 2px; background: var(--link); }
.atlas-ptab-end { position: relative; left: 0; top: 0; align-self: center; flex: none; height: 19px; margin-bottom: 6px; }
.atlas-ptab-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.atlas-ptab-close { flex: none; display: inline-grid; place-items: center; width: 20px; height: 20px; border: 0; border-radius: 5px; background: transparent; color: var(--ink-3); cursor: pointer; opacity: 0; }
.atlas-ptab:hover .atlas-ptab-close, .atlas-ptab.is-on .atlas-ptab-close, .atlas-ptab-close:focus-visible { opacity: 1; }
.atlas-ptab-close:hover { color: var(--ink-1); background: rgba(var(--accent-rgb), .15); }
.atlas-strip-tool { width: 28px; height: 28px; align-self: center; margin-bottom: 2px; }
.atlas-panes { position: relative; flex: 1; min-height: 0; }
.atlas-tab-body { position: absolute; top: 0; bottom: 0; min-width: 0; overflow-y: auto; container-type: inline-size; scrollbar-color: rgba(var(--accent-rgb), .25) transparent; }
.atlas-tab-body.is-hidden { content-visibility: hidden; visibility: hidden; pointer-events: none; }
.atlas-tab-body.is-discussion { overflow: hidden; display: flex; flex-direction: column; }
.atlas-pane-divider { position: absolute; z-index: 6; top: 0; bottom: 0; width: 9px; margin-left: -4px; cursor: col-resize; touch-action: none; }
.atlas-pane-divider::after { content: ""; position: absolute; top: 0; bottom: 0; left: 4px; width: 1px; background: var(--line-2); transition: background .15s, box-shadow .15s; }
.atlas-pane-divider:hover::after, .atlas-pane-divider:active::after { background: rgba(var(--accent-rgb), .7); box-shadow: 0 0 0 1px rgba(var(--accent-rgb), .35); }
.atlas-root.is-dragging-tab .atlas-tab-body { pointer-events: none; }
.atlas-drop-pane { position: absolute; z-index: 20; top: 0; bottom: 0; }
.atlas-drop-pane.is-over { background: rgba(var(--accent-rgb), .06); box-shadow: inset 0 0 0 2px rgba(var(--accent-rgb), .45); }
.atlas-drop-split { position: absolute; z-index: 21; top: 10px; bottom: 10px; width: min(36%, 420px); display: grid; place-content: center; justify-items: center; gap: 8px; border: 2px dashed rgba(var(--accent-rgb), .42); border-radius: 14px; background: rgba(var(--sky-rgb), .72); color: var(--ink-2); font: 500 13px var(--sans); }
.atlas-drop-split.is-right { right: 10px; }
.atlas-drop-split.is-left { left: 10px; }
.atlas-drop-split.is-over { border-color: var(--link); background: rgba(var(--accent-rgb), .13); color: var(--ink-1); }
.atlas-ask-top { display: inline-flex; align-items: center; gap: 7px; flex: none; border: 1px solid rgba(var(--accent-rgb), .32); background: rgba(var(--accent-rgb), .09); color: var(--ink-1); border-radius: 9px; padding: 5px 9px 5px 10px; font: 500 13px var(--sans); cursor: pointer; }
.atlas-ask-top:hover { background: rgba(var(--accent-rgb), .17); border-color: rgba(var(--accent-rgb), .5); }
.atlas-ask-top:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; }
.atlas-ask-top svg { color: var(--gold); }
.atlas-companion { position: relative; flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; background: linear-gradient(180deg, rgba(var(--panel-rgb), .97), rgba(var(--panel-0-rgb), .99)); }
.atlas-companion-head { display: flex; align-items: center; gap: 6px; padding: 9px 8px 7px 14px; flex: none; }
.atlas-companion-head .atlas-icon-button { width: 28px; height: 28px; }
.atlas-companion-title { flex: 1; min-width: 0; font: 600 13.5px/1.3 var(--sans); color: var(--ink-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.atlas-light { flex: none; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--idle); box-shadow: 0 0 0 2px rgba(var(--idle-rgb), .2); }
.atlas-light.is-running { background: var(--link); animation: atlas-beacon 1.6s ease-out infinite; }
.atlas-light.is-done { background: var(--good); box-shadow: none; }
@keyframes atlas-beacon { 0% { box-shadow: 0 0 0 0 rgba(var(--accent-rgb), .6); } 100% { box-shadow: 0 0 0 7px rgba(var(--accent-rgb), 0); } }
.atlas-chips { display: flex; flex-wrap: wrap; gap: 5px; padding: 0 14px 9px; }
.atlas-ctx { display: inline-flex; align-items: baseline; gap: 6px; max-width: 100%; min-width: 0; padding: 2px 8px; border-radius: 6px; background: rgba(var(--accent-rgb), .07); border: 1px solid var(--line); font-size: 12px; color: var(--ink-2); }
.atlas-ctx-label { flex: none; font-size: 10px; font-weight: 600; letter-spacing: .09em; text-transform: uppercase; color: var(--ink-3); }
.atlas-ctx-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.atlas-ctx.is-accent { border-color: rgba(var(--gold-rgb), .32); background: rgba(var(--gold-rgb), .07); color: var(--ink-1); }
.atlas-companion-actions { display: flex; align-items: center; gap: 14px; padding: 0 14px 9px; font-size: 12.5px; border-bottom: 1px solid var(--line); flex: none; }
.atlas-spacer { flex: 1; }
.atlas-companion-body, .atlas-embedded { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.atlas-embedded > * { flex: 1; min-height: 0; }
.atlas-companion-wait { display: flex; align-items: center; gap: 12px; padding: 26px 16px; color: var(--ink-3); }
.atlas-companion-fallback { display: grid; justify-items: start; gap: 10px; padding: 18px 16px; color: var(--ink-2); }

/* ---- a paper in a tab: details, add to the library for a topic ---- */
.atlas-ref-add { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin: 10px 0 12px; padding: 10px 12px; border: 1px solid var(--line-2); border-radius: 12px; background: rgba(var(--accent-rgb), .06); }
.atlas-ref-add > .atlas-input { flex: 1 1 200px; width: auto; min-width: 0; }
.atlas-ref-for { display: inline-flex; align-items: center; gap: 7px; flex: 1 1 260px; min-width: 0; }
.atlas-ref-for > span { font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
.atlas-ref-for > select { flex: 1; min-width: 0; }
.atlas-ref-abstract { margin: 0; color: var(--ink-2); line-height: 1.6; }

/* ---- adding and writing from anywhere: the + panel and the Write page ---- */
.atlas-quick { position: absolute; z-index: 40; top: 16px; left: 50%; transform: translateX(-50%); width: min(620px, calc(100% - 32px)); display: grid; gap: 10px; padding: 12px; background: rgba(var(--panel-rgb), .985); border: 1px solid rgba(var(--accent-rgb), .4); border-radius: 14px; box-shadow: 0 26px 70px -18px rgba(var(--shadow-rgb), calc(.9 * var(--shadow-k))), 0 0 0 4px rgba(var(--accent-rgb), .05); }
.atlas-quick .atlas-seg { justify-self: start; }
.atlas-quick-body { display: grid; gap: 8px; }
.atlas-quick-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.atlas-quick-row > .atlas-input { flex: 1 1 260px; width: auto; min-width: 0; }
.atlas-quick-folder { flex: 0 1 220px; }
.atlas-quick-found { display: grid; gap: 4px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 10px; background: rgba(var(--accent-rgb), .04); }
.atlas-quick-title { margin: 0; font: 600 14.5px/1.35 var(--serif); color: var(--ink-1); }
.atlas-quick-found .atlas-muted { margin: 0; }
.atlas-quick-more { margin: 0; font-size: 12px; color: var(--ink-3); }
.atlas-write-row { display: flex; align-items: center; gap: 8px; }
.atlas-write-row > .atlas-item { flex: 1; min-width: 0; }

/* ---- asking: the ask bar and the selection tools ---- */
.atlas-askbar { position: absolute; z-index: 40; top: 16px; left: 50%; transform: translateX(-50%); width: min(660px, calc(100% - 32px)); padding: 12px 12px 10px; background: rgba(var(--panel-rgb), .985); border: 1px solid rgba(var(--accent-rgb), .4); border-radius: 14px; box-shadow: 0 26px 70px -18px rgba(var(--shadow-rgb), calc(.9 * var(--shadow-k))), 0 0 0 4px rgba(var(--accent-rgb), .05); }
.atlas-askbar .atlas-chips { padding: 0 2px 10px; }
.atlas-askbar-row { display: flex; align-items: center; gap: 10px; padding: 4px 4px 4px 11px; border: 1px solid var(--line-2); border-radius: 10px; background: rgba(var(--sky-rgb), .7); }
.atlas-askbar-row:focus-within { border-color: rgba(var(--accent-rgb), .6); }
.atlas-askbar-row > svg { color: var(--gold); }
.atlas-askbar-input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--ink-1); font: 15px/1.4 var(--sans); padding: 6px 0; }
.atlas-askbar-input::placeholder, .atlas-seltools-input::placeholder { color: var(--ink-3); }
.atlas-askbar-error { margin: 6px 4px 0; font-size: 12.5px; color: var(--danger-ink-3); }
.atlas-askbar-moves { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
.atlas-move { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); background: rgba(var(--accent-rgb), .05); color: var(--ink-2); border-radius: 8px; padding: 4px 9px; font: 500 12.5px var(--sans); cursor: pointer; }
.atlas-move:hover, .atlas-move:focus-visible { color: var(--ink-1); background: rgba(var(--accent-rgb), .13); border-color: var(--line-2); outline: none; }
.atlas-hint { font-size: 11.5px; color: var(--ink-3); }
.atlas-seltools { position: absolute; z-index: 35; display: flex; flex-wrap: wrap; align-items: center; gap: 2px; max-width: calc(100% - 16px); padding: 3px; background: rgba(var(--panel-rgb), .985); border: 1px solid rgba(var(--accent-rgb), .36); border-radius: 10px; box-shadow: 0 14px 40px -12px rgba(var(--shadow-rgb), calc(.85 * var(--shadow-k))); }
.atlas-seltool { display: inline-flex; align-items: center; gap: 5px; border: 0; background: transparent; color: var(--ink-2); padding: 4px 8px; border-radius: 7px; font: 500 12.5px var(--sans); white-space: nowrap; cursor: pointer; }
.atlas-seltool:hover, .atlas-seltool:focus-visible { color: var(--ink-1); background: rgba(var(--accent-rgb), .14); outline: none; }
.atlas-seltool.is-primary { color: var(--on-accent); background: linear-gradient(180deg, var(--accent-a), var(--accent-b)); }
.atlas-seltool.is-primary:hover, .atlas-seltool.is-primary:focus-visible { color: var(--on-accent); background: linear-gradient(180deg, var(--accent-a-hover), var(--accent-b-hover)); }
.atlas-seltools-sep { width: 1px; align-self: stretch; margin: 3px; background: var(--line-2); }
.atlas-seltools-ask { display: flex; align-items: center; gap: 8px; width: min(520px, calc(100vw - 48px)); padding: 0 2px 0 9px; }
.atlas-seltools-ask > svg { color: var(--gold); }
.atlas-seltools-input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--ink-1); font: 13.5px var(--sans); padding: 5px 0; }

/* ---- discussions ---- */
.atlas-discussions .atlas-items { margin-bottom: 6px; }
.atlas-discussions > .atlas-button { margin-top: 6px; }
.atlas-thread-item .atlas-light { align-self: flex-start; margin-top: 6px; }
.atlas-thread-item.is-current { background: rgba(var(--accent-rgb), .1); box-shadow: inset 2px 0 0 var(--link); }
.atlas-pulse .atlas-discussions { margin-top: 18px; padding: 0; background: none; border: 0; }
.atlas-topic-side .atlas-discussions .atlas-empty { font-size: 12.5px; }
.atlas-doc-threads .atlas-light { width: 7px; height: 7px; margin-right: 6px; }

/* ---- universe ---- */
.atlas-hero { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px 30px; margin-bottom: 8px; }
.atlas-hero-text { max-width: 760px; }
.atlas-hero h1 { font-size: 32px; }
.atlas-hero-actions { display: flex; align-items: center; gap: 8px; }
.atlas-stats { display: flex; flex-wrap: wrap; gap: 8px 26px; margin: 4px 0 0; }
.atlas-stats div { display: flex; flex-direction: column-reverse; }
.atlas-stats dt { font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
.atlas-stats dd { margin: 0; font: 600 24px var(--serif); color: var(--ink-1); }
.atlas-universe { display: grid; grid-template-columns: minmax(0, 1fr) 330px; gap: 22px; align-items: start; margin-top: 10px; }
.atlas-chart { position: relative; max-width: 760px; width: 100%; justify-self: center; }
.atlas-chart svg { display: block; width: 100%; height: auto; }
.atlas-grid circle, .atlas-grid line { stroke: rgba(var(--accent-rgb), .09); stroke-width: 1; fill: none; stroke-dasharray: 2 7; }
.atlas-sector { fill: none; stroke-width: 4; stroke-linecap: round; opacity: .9; cursor: pointer; transition: opacity .2s; }
.atlas-sector.is-faded { opacity: .18; }
.atlas-edge { stroke-width: 1.3; opacity: .55; transition: opacity .2s; }
.atlas-spoke { stroke: rgba(var(--gold-2-rgb), .12); stroke-width: 1; transition: opacity .2s; }
.atlas-link-arc { fill: none; stroke: rgba(var(--glow-rgb), .16); stroke-width: 1; transition: stroke .2s, opacity .2s; }
.atlas-link-arc.is-lit { stroke: rgba(var(--gold-2-rgb), .75); stroke-width: 1.4; }
.atlas-star { cursor: pointer; transition: opacity .2s; outline: none; }
.atlas-star-ring { fill: var(--sky-1); stroke: rgba(var(--glow-rgb), .3); stroke-width: 1; }
.atlas-star.is-lit .atlas-star-ring, .atlas-star:focus-visible .atlas-star-ring { stroke: var(--ink-0); stroke-width: 2; }
.atlas-core { cursor: pointer; outline: none; }
.atlas-core:focus-visible circle:last-of-type { stroke: var(--ink-0); stroke-width: 2; }
.atlas-chart-label text { fill: var(--ink-2); font: 500 12.5px var(--sans); }
.atlas-leader { stroke: rgba(var(--glow-rgb), .14); stroke-width: 1; stroke-dasharray: 1 4; }
.atlas-edge.is-faded, .atlas-spoke.is-faded, .atlas-star.is-faded, .atlas-chart-label.is-faded, .atlas-link-arc.is-faded { opacity: .14; }
.atlas-tip { position: absolute; z-index: 10; width: 300px; padding: 12px 14px; pointer-events: none; background: rgba(var(--panel-1-rgb), .97); border: 1px solid var(--line-2); border-radius: 12px; box-shadow: 0 18px 50px -14px rgba(var(--shadow-rgb), calc(.8 * var(--shadow-k))); display: grid; gap: 6px; }
.atlas-tip-dir { display: flex; align-items: center; gap: 7px; font-size: 11.5px; color: var(--ink-3); }
.atlas-tip-title { font: 600 15px/1.3 var(--serif); color: var(--ink-1); }
.atlas-tip-text { font-size: 12.5px; color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
.atlas-tip-latest { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12.5px; color: var(--ink-1); }
.atlas-tip-facts { font-size: 12px; color: var(--ink-3); }
.atlas-pulse { padding: 16px; border-radius: 16px; background: linear-gradient(180deg, rgba(var(--panel-2-rgb), .85), rgba(var(--panel-rgb), .7)); border: 1px solid var(--line); }
.atlas-pulse ol { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.atlas-pulse-row { display: grid; grid-template-columns: 3px auto minmax(0, 1fr); grid-template-areas: "mark date topic" "mark name name" "mark status status"; column-gap: 9px; row-gap: 1px; width: 100%; text-align: left; border: 0; background: transparent; color: inherit; font: inherit; padding: 7px 8px; border-radius: 9px; cursor: pointer; }
.atlas-pulse-row:hover { background: rgba(var(--accent-rgb), .08); }
.atlas-pulse-mark { grid-area: mark; border-radius: 2px; }
.atlas-pulse-row .atlas-date { grid-area: date; }
.atlas-pulse-topic { grid-area: topic; font-size: 12.5px; font-weight: 600; color: var(--ink-1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.atlas-pulse-name { grid-area: name; font-size: 12.5px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.atlas-pulse-row .atlas-chip { grid-area: status; justify-self: start; margin-top: 2px; }
.atlas-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin: 16px 0 6px; }
.atlas-legend-item { display: inline-flex; align-items: center; gap: 7px; padding: 4px 11px; border-radius: 999px; border: 1px solid var(--line); background: rgba(var(--panel-rgb), .7); color: var(--ink-2); font: inherit; font-size: 12.5px; cursor: pointer; }
.atlas-legend-item:hover, .atlas-legend-item.is-on { color: var(--ink-1); border-color: var(--line-2); background: rgba(var(--accent-rgb), .1); }
.atlas-legend-item.is-static { cursor: default; }
.atlas-legend-item .atlas-count { margin-left: 2px; }
.atlas-legend-note { font-size: 12px; color: var(--ink-3); margin-left: 6px; }

/* ---- directions and topic cards ---- */
.atlas-direction { margin-top: 40px; scroll-margin-top: 16px; }
.atlas-direction-head { display: flex; gap: 14px; align-items: stretch; margin-bottom: 14px; }
.atlas-direction-bar { flex: none; width: 4px; border-radius: 4px; background: var(--dir); box-shadow: 0 0 14px var(--dir); }
.atlas-direction-head h2 { margin: 0 0 4px; font: 600 20px/1.25 var(--serif); color: var(--ink-1); }
.atlas-direction-lead { margin: 0; color: var(--ink-2); font-size: 13.5px; max-width: 820px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.atlas-direction.is-quiet .atlas-direction-head h2 { color: var(--ink-2); }
.atlas-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.atlas-card { position: relative; display: flex; flex-direction: column; gap: 8px; text-align: left; font: inherit; color: inherit; padding: 14px 16px 12px; border-radius: 14px; cursor: pointer; background: linear-gradient(180deg, rgba(var(--panel-3-rgb), .55), rgba(var(--panel-rgb), .55)); border: 1px solid var(--line); transition: border-color .18s, transform .18s, box-shadow .18s; }
.atlas-card::before { content: ""; position: absolute; left: 14px; right: 14px; top: 0; height: 1px; background: linear-gradient(90deg, transparent, var(--dir), transparent); opacity: .65; }
.atlas-card:hover { border-color: var(--line-2); transform: translateY(-1px); box-shadow: 0 14px 40px -22px var(--dir); }
.atlas-card-head { display: flex; align-items: center; gap: 10px; }
.atlas-card-title { font: 600 15px/1.3 var(--serif); color: var(--ink-1); overflow-wrap: anywhere; }
.atlas-card-text { font-size: 13px; color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.atlas-card-latest { display: flex; align-items: center; gap: 8px; min-width: 0; font-size: 12.5px; color: var(--ink-1); }
.atlas-card-thread { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.atlas-card-foot { display: flex; align-items: center; gap: 10px; margin-top: auto; padding-top: 6px; border-top: 1px solid var(--line); }
.atlas-card-counts { display: flex; flex-wrap: wrap; gap: 10px; color: var(--ink-3); font-size: 12px; }
.atlas-card-counts span { display: inline-flex; align-items: center; gap: 4px; }
.atlas-card-foot .atlas-date { margin-left: auto; }
.atlas-root-sections { margin-top: 44px; }

/* ---- folds ---- */
.atlas-fold { border-top: 1px solid var(--line); }
.atlas-fold-head { display: flex; align-items: center; gap: 9px; width: 100%; text-align: left; border: 0; background: transparent; color: var(--ink-1); font: 500 14px var(--sans); padding: 10px 4px; cursor: pointer; }
.atlas-fold-head:hover { color: var(--ink-0); }
.atlas-fold-head svg { color: var(--ink-3); }
.atlas-fold-mark { width: 12px; color: var(--ink-3); font-size: 11px; transition: transform .15s; }
.atlas-fold.is-open > .atlas-fold-head .atlas-fold-mark { transform: rotate(90deg); }
.atlas-fold-title { flex: 1; min-width: 0; }
.atlas-fold-body { padding: 2px 4px 16px 25px; }

/* ---- figures inside notes ---- */
.atlas-md-figure { margin: 16px 0 8px; }
.atlas-md-figure img { display: block; max-width: 100%; height: auto; border-radius: 8px; border: 1px solid var(--line); background: #fff; }
.atlas-md-figure img[title='Open the figure'] { cursor: zoom-in; }

/* ---- where a link to a section lands ---- */
.atlas-fold, .atlas-opening, .atlas-section, .atlas-markdown :is(h1, h2, h3, h4, h5, h6) { scroll-margin-top: 14px; }
.atlas-target { border-radius: 8px; animation: atlas-target 1.8s ease-out; }
@keyframes atlas-target { 0% { box-shadow: 0 0 0 2px rgba(var(--gold-rgb), .6); background-color: rgba(var(--gold-rgb), .1); } 100% { box-shadow: 0 0 0 2px rgba(var(--gold-rgb), 0); background-color: transparent; } }
@media (prefers-reduced-motion: reduce) { .atlas-target { animation: none; box-shadow: 0 0 0 2px rgba(var(--gold-rgb), .5); } }

/* ---- topic workspace ---- */
.atlas-topic-head { position: relative; padding: 6px 0 4px; }
.atlas-topic-head::before { content: ""; position: absolute; inset: -40px -60px auto -60px; height: 180px; background: radial-gradient(560px 140px at 18% 30%, color-mix(in srgb, var(--dir) 24%, transparent), transparent 70%); pointer-events: none; z-index: 0; }
.atlas-topic-head > * { position: relative; z-index: 1; }
.atlas-meta-fact { color: var(--ink-2); }
.atlas-context { display: flex; gap: 12px; align-items: baseline; margin: 8px 0 22px; padding: 12px 16px; border-radius: 12px; border: 1px solid var(--line); border-left: 3px solid var(--dir); background: rgba(var(--panel-rgb), .75); font-size: 14px; color: var(--ink-1); }
.atlas-context .atlas-label { flex: none; }
.atlas-topic-grid { display: grid; grid-template-columns: minmax(0, 1fr) 350px; gap: 34px; align-items: start; }
.atlas-topic-side { position: sticky; top: 12px; display: grid; gap: 16px; }
.atlas-side-block { padding: 14px 14px 10px; border-radius: 14px; background: rgba(var(--panel-rgb), .78); border: 1px solid var(--line); }
.atlas-side-block > h2 svg { color: var(--ink-3); }
.atlas-side-block .atlas-fold:first-of-type { border-top: 0; }
.atlas-side-block .atlas-fold-body { padding: 0 0 8px; }
.atlas-branch { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px; width: 100%; text-align: left; border: 0; background: transparent; color: inherit; font: inherit; padding: 8px 8px; border-radius: 9px; cursor: pointer; }
.atlas-branch:hover { background: rgba(var(--accent-rgb), .08); }
.atlas-branch-title { font-weight: 500; color: var(--ink-1); font-size: 13.5px; }
.atlas-branch-latest { grid-column: 1 / -1; display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink-2); min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.atlas-items { list-style: none; margin: 0; padding: 0; display: grid; gap: 1px; }
.atlas-item { display: flex; align-items: flex-start; gap: 9px; width: 100%; text-align: left; border: 0; background: transparent; color: var(--ink-1); font: inherit; padding: 7px 8px; border-radius: 9px; cursor: pointer; }
.atlas-item:hover:not(:disabled) { background: rgba(var(--accent-rgb), .08); }
.atlas-item > svg { margin-top: 2px; color: var(--ink-3); }
.atlas-item.is-missing { opacity: .55; cursor: default; }
.atlas-item-text { display: grid; min-width: 0; flex: 1; }
.atlas-item-label { font-size: 13px; overflow-wrap: anywhere; }
.atlas-item-sub { font-family: var(--mono); font-size: 11px; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.atlas-item .atlas-date { margin-left: auto; }
.atlas-opening { margin-bottom: 8px; }
.atlas-timeline { list-style: none; margin: 4px 0 0; padding: 0 0 0 18px; position: relative; }
.atlas-timeline::before { content: ""; position: absolute; left: 5px; top: 8px; bottom: 8px; width: 1px; background: linear-gradient(180deg, var(--dir), rgba(var(--accent-rgb), .08)); }
.atlas-thread { position: relative; padding: 4px 0 14px 10px; }
.atlas-thread-node { position: absolute; left: -17px; top: 9px; width: 9px; height: 9px; border-radius: 50%; background: var(--sky-0); border: 2px solid var(--dir); box-shadow: 0 0 8px var(--dir); }
.atlas-thread-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 2px; }
.atlas-thread-name { font-weight: 600; color: var(--ink-1); }
.atlas-thread-head .atlas-date { margin-left: auto; }
.atlas-newnote { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 10px 12px; margin: 4px 0 12px; padding: 14px; border-radius: 12px; background: rgba(var(--panel-rgb), .9); border: 1px solid var(--line-2); max-width: 760px; }
.atlas-newnote label { display: grid; gap: 4px; font-size: 12px; color: var(--ink-3); }
.atlas-newnote .atlas-seg { grid-column: 1 / -1; justify-self: start; }
.atlas-newnote-foot { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; }
.atlas-newnote-foot .atlas-path { flex: 1; }
.atlas-seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: rgba(var(--sky-rgb), .6); border: 1px solid var(--line); }
.atlas-seg-item { display: inline-flex; align-items: center; border: 0; background: transparent; color: var(--ink-2); padding: 5px 12px; border-radius: 7px; font: inherit; font-size: 13px; cursor: pointer; }
.atlas-seg-item.is-on { color: var(--ink-1); background: rgba(var(--accent-rgb), .16); box-shadow: inset 0 0 0 1px var(--line-2); }
.atlas-seg.is-tabs { margin-top: 4px; }

/* ---- reading ---- */
.atlas-markdown { font-size: 15px; line-height: 1.72; overflow-wrap: anywhere; color: var(--ink-1); }
.atlas-markdown.is-compact { font-size: 13.5px; line-height: 1.6; color: var(--ink-2); }
.atlas-markdown a { color: var(--link); }
.atlas-markdown table { display: block; overflow-x: auto; }
.atlas-markdown pre { overflow-x: auto; }
.atlas-markdown img { max-width: 100%; height: auto; border-radius: 8px; background: #fff; }
.atlas-opening .atlas-markdown, .atlas-reading .atlas-markdown, .atlas-fold-body > .atlas-markdown { font-family: var(--serif); font-size: 16.5px; line-height: 1.74; max-width: 46em; }
.atlas-plain { white-space: pre-wrap; }
.atlas-doc-head { margin-bottom: 4px; }
.atlas-doc-body { position: relative; margin-top: 16px; }
.atlas-reading { max-width: 860px; }
.atlas-source { border-radius: 12px; background: rgba(var(--sky-rgb), .75); border: 1px solid var(--line); padding: 14px 0; overflow-x: auto; }
.atlas-lines { list-style: none; counter-reset: line; margin: 0; padding: 0; font: 12.5px/1.65 var(--mono); color: var(--ink-1); }
.atlas-lines li { counter-increment: line; position: relative; padding: 0 16px 0 5em; white-space: pre-wrap; overflow-wrap: anywhere; }
.atlas-lines li::before { content: counter(line); position: absolute; left: 0; width: 3.6em; text-align: right; color: rgba(var(--ink-3-rgb), .55); }
.atlas-lines .k { color: var(--code-key); }
.atlas-lines .m { color: var(--code-math); }
.atlas-lines .c { color: var(--code-comment); font-style: italic; }
.atlas-table-wrap { overflow: auto; max-height: 75vh; border-radius: 12px; border: 1px solid var(--line); }
.atlas-table { border-collapse: collapse; font: 12.5px var(--mono); }
.atlas-table th, .atlas-table td { padding: 5px 12px; border-bottom: 1px solid var(--line); text-align: left; white-space: nowrap; }
.atlas-table th { position: sticky; top: 0; background: var(--panel-2); color: var(--ink-1); }
.atlas-notebook { display: grid; gap: 12px; max-width: 920px; }
.atlas-cell.is-code { border-left: 2px solid rgba(var(--accent-rgb), .4); padding-left: 12px; }
.atlas-cell-code, .atlas-cell-out { margin: 0; padding: 10px 12px; border-radius: 9px; background: rgba(var(--sky-rgb), .75); font: 12.5px/1.6 var(--mono); white-space: pre-wrap; overflow-x: auto; }
.atlas-cell-out { margin-top: 6px; color: var(--ink-2); background: transparent; border: 1px dashed var(--line); }
.atlas-cell-img { display: block; max-width: 100%; margin-top: 8px; border-radius: 8px; background: #fff; }
.atlas-figure { margin: 0; display: grid; place-items: center; padding: 18px; border-radius: 14px; background: repeating-conic-gradient(var(--checker-a) 0% 25%, var(--checker-b) 0% 50%) 50% / 22px 22px; }
.atlas-figure img { max-width: 100%; height: auto; border-radius: 6px; }
.atlas-video { width: 100%; max-height: 75vh; border-radius: 12px; background: #000; }
.atlas-pdf { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 0 0 24px; border-radius: 14px; background: radial-gradient(800px 300px at 50% 0, rgba(var(--nebula-a-rgb), .14), transparent 70%), var(--deep); border: 1px solid var(--line); }
.atlas-pdf-bar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 8px 14px; background: rgba(var(--sky-rgb), .92); border-bottom: 1px solid var(--line); border-radius: 14px 14px 0 0; }
.atlas-pdf-zoom { display: inline-flex; align-items: center; gap: 4px; }
.atlas-pdf-page { position: relative; background: #fff; box-shadow: 0 12px 40px -14px rgba(var(--shadow-rgb), calc(.9 * var(--shadow-k))); border-radius: 2px; }
.atlas-pdf-page canvas { display: block; }
.atlas-pdf-num { position: absolute; right: -36px; bottom: 4px; font: 11px var(--mono); color: var(--ink-3); }
.atlas-folder { display: grid; gap: 16px; max-width: 860px; }
.atlas-readme { padding: 14px 18px; border-radius: 14px; background: rgba(var(--panel-rgb), .78); border: 1px solid var(--line); }

/* ---- editor ---- */
.atlas-editor { display: grid; gap: 10px; }
.atlas-editor-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; position: sticky; top: 0; z-index: 6; padding: 8px 0; background: linear-gradient(180deg, var(--sky-0) 70%, transparent); }
.atlas-editor-status { margin-left: auto; font-size: 12.5px; color: var(--ink-3); }
.atlas-editor-status.is-dirty { color: var(--gold); }
.atlas-editor-status.is-error { color: var(--danger-ink); }
.atlas-editor-split { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; }
.atlas-editor-split.has-preview, .atlas-editor-split:has(.atlas-tex-aside) { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.atlas-editor-split:has(.atlas-tex-aside) { grid-template-columns: minmax(0, 1fr) 260px; }
.atlas-editor-text { width: 100%; min-height: 62vh; height: calc(100vh - 290px); resize: vertical; padding: 16px 18px; border-radius: 12px; border: 1px solid var(--line-2); background: rgba(var(--sky-rgb), .85); color: var(--ink-1); font: 13.5px/1.7 var(--mono); tab-size: 2; caret-color: var(--gold); }
.atlas-editor-text:focus { outline: 2px solid rgba(var(--accent-rgb), .45); outline-offset: 0; }
.atlas-editor-preview { min-height: 62vh; height: calc(100vh - 290px); overflow-y: auto; padding: 14px 22px; border-radius: 12px; border: 1px solid var(--line); background: rgba(var(--panel-rgb), .55); }
.atlas-tex-aside { padding: 14px; border-radius: 12px; border: 1px solid var(--line); background: rgba(var(--panel-rgb), .7); align-self: start; display: grid; gap: 8px; }
.atlas-tex-aside > h2 { margin: 0; font: 600 12px var(--sans); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-2); }
.atlas-outline { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 13px; color: var(--ink-1); }
.atlas-outline .is-subsection { padding-left: 12px; color: var(--ink-2); }
.atlas-outline .is-subsubsection { padding-left: 24px; color: var(--ink-3); }

/* ---- library ---- */
.atlas-toolbar { display: flex; align-items: center; gap: 10px; margin: 6px 0 12px; }
.atlas-shelf { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.atlas-paper { display: grid; grid-template-columns: 54px minmax(0, 1fr) auto; gap: 14px; align-items: start; padding: 12px 14px; border-radius: 12px; background: rgba(var(--panel-rgb), .7); border: 1px solid var(--line); }
.atlas-paper-spine { font: 600 13px var(--mono); color: var(--gold); padding-top: 2px; }
.atlas-paper-main { display: grid; gap: 4px; min-width: 0; }
.atlas-paper-title { border: 0; background: transparent; padding: 0; text-align: left; font: 600 15px/1.35 var(--serif); color: var(--ink-1); cursor: pointer; }
.atlas-paper-title:hover:not(:disabled) { color: var(--ink-0); text-decoration: underline; text-underline-offset: 3px; }
.atlas-paper-title:disabled { cursor: default; }
.atlas-paper-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; color: var(--ink-2); }
.atlas-paper-actions { display: flex; gap: 6px; }
.atlas-paper .atlas-linked { margin: 2px 0 0; font-size: 12.5px; }
.atlas-bytopic { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 14px; margin-top: 18px; }
.atlas-bytopic .atlas-side-block > h2 { text-transform: none; letter-spacing: 0; font: 600 14.5px var(--serif); color: var(--ink-1); }
.atlas-entries { display: grid; gap: 6px; }
.atlas-entry { padding: 10px 12px; border-radius: 10px; border: 1px solid transparent; }
.atlas-entry:hover { background: rgba(var(--panel-rgb), .75); border-color: var(--line); }
.atlas-entry-head { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: baseline; }
.atlas-entry-title { font: 600 14.5px/1.35 var(--serif); color: var(--ink-1); }
.atlas-entry-tags { display: inline-flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.atlas-entry-scope { margin: 3px 0 0; font-size: 13px; color: var(--ink-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.atlas-entry-foot { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: baseline; margin-top: 4px; font-size: 12.5px; }
.atlas-entry-foot .atlas-linked { margin: 0; font-size: 12.5px; }

/* ---- activity: what waits on you, what is running, teams ---- */
.atlas-nav-badge { min-width: 18px; height: 18px; display: inline-grid; place-items: center; padding: 0 5px; border-radius: 9px; background: rgba(var(--gold-rgb), .16); color: var(--gold); font: 600 11px var(--sans); font-variant-numeric: tabular-nums; }
.atlas-waiting > h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 10px; font: 600 13px var(--sans); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-2); }
.atlas-waiting > h2::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--gold); box-shadow: 0 0 10px rgba(var(--gold-rgb), .7); }
.atlas-waiting ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.atlas-waiting-item { padding: 12px 14px; border-radius: 12px; background: rgba(var(--gold-rgb), .05); border: 1px solid rgba(var(--gold-rgb), .22); }
.atlas-waiting-head { display: flex; align-items: baseline; gap: 10px; }
.atlas-waiting-title { flex: 1; min-width: 0; text-align: left; border: 0; background: none; padding: 0; color: var(--ink-1); font: 600 14.5px/1.35 var(--serif); cursor: pointer; overflow-wrap: anywhere; }
.atlas-waiting-title:hover { color: var(--link); text-decoration: underline; text-underline-offset: 3px; }
.atlas-waiting-title:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; border-radius: 4px; }
.atlas-waiting-topic { margin: 2px 0 0; font-size: 12px; color: var(--ink-3); }
.atlas-waiting-text { margin: 8px 0 0; color: var(--ink-2); font-size: 13.5px; max-width: 760px; }
.atlas-waiting-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.atlas-waiting.is-compact { margin-bottom: 20px; }
.atlas-waiting.is-compact ul { gap: 6px; }
.atlas-waiting.is-compact .atlas-waiting-item { padding: 8px 10px; border-radius: 10px; }
.atlas-waiting.is-compact .atlas-waiting-title { font: 600 13px/1.35 var(--sans); }
.atlas-waiting.is-compact > .atlas-link { margin-top: 8px; font-size: 12.5px; }
.atlas-activity-group { margin: 0 0 18px; }
.atlas-activity-group > h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font: 600 14px var(--serif); color: var(--ink-1); }
.atlas-activity-group > ul, .atlas-activity-others { list-style: none; margin: 0; padding: 0; border-radius: 12px; border: 1px solid var(--line); background: rgba(var(--panel-rgb), .55); }
.atlas-activity-row { display: grid; grid-template-columns: 92px minmax(0, 1fr) auto auto; align-items: start; gap: 12px; padding: 9px 14px; border-top: 1px solid var(--line); }
.atlas-activity-row:first-child { border-top: 0; }
.atlas-activity-kind { font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); padding-top: 2px; }
.atlas-activity-main { min-width: 0; }
.atlas-activity-main > .atlas-link { text-align: left; overflow-wrap: anywhere; }
.atlas-activity-state { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--ink-2); padding-top: 3px; }
.atlas-activity-row > .atlas-date { padding-top: 3px; }
.atlas-activity-members { list-style: none; margin: 6px 0 0; padding: 0 0 0 12px; border-left: 1px solid var(--line-2); display: grid; gap: 3px; }
.atlas-activity-members li { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px 8px; font-size: 13px; }
.atlas-activity-members .atlas-light { align-self: center; }
.atlas-activity-task { flex: 1 1 220px; min-width: 0; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.atlas-activity-team > .atlas-muted { margin: 4px 0 0; font-size: 12.5px; }
.atlas-activity-main > .atlas-link { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.atlas-team-form { display: grid; gap: 14px; max-width: 820px; margin-top: 10px; }
.atlas-field { display: grid; gap: 5px; }
.atlas-field > span, .atlas-team-seat label > span { font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
.atlas-team-form textarea.atlas-input { resize: vertical; line-height: 1.5; }
.atlas-team-seats { margin: 0; padding: 12px 14px 10px; border: 1px solid var(--line); border-radius: 12px; display: grid; gap: 10px; }
.atlas-team-seats > legend { padding: 0 6px; font-size: 11px; font-weight: 600; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-2); }
.atlas-team-seat { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 32px; grid-template-areas: "role how model remove" "task task task task"; align-items: end; gap: 8px 10px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
.atlas-team-seat:last-of-type { border-bottom: 0; }
.atlas-seat-role { grid-area: role; } .atlas-seat-how { grid-area: how; } .atlas-seat-task { grid-area: task; } .atlas-seat-model { grid-area: model; } .atlas-seat-remove { grid-area: remove; }
.atlas-team-seat select:disabled { opacity: .65; }
.atlas-team-seat label { display: grid; gap: 4px; min-width: 0; }
.atlas-team-seat select.atlas-input { padding: 6px 8px; }
.atlas-team-seats > .atlas-link { justify-self: start; font-size: 13px; }
/* ---- PDF text layer (PDF.js 6): transparent text over the drawn page, for selection ---- */
.atlas-pdf-page { --scale-round-x: 1px; --scale-round-y: 1px; --total-scale-factor: 1; }
.atlas-pdf-text { position: absolute; text-align: initial; inset: 0; overflow: clip; opacity: 1; line-height: 1; -webkit-text-size-adjust: none; text-size-adjust: none; forced-color-adjust: none; transform-origin: 0 0; caret-color: CanvasText; z-index: 0; --min-font-size: 1; --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size)); --min-font-size-inv: calc(1 / var(--min-font-size)); }
.atlas-pdf-text :is(span, br) { color: transparent; position: absolute; white-space: pre; cursor: text; transform-origin: 0% 0%; }
.atlas-pdf-text > :not(.markedContent), .atlas-pdf-text .markedContent span:not(.markedContent) { z-index: 1; --font-height: 0; font-size: calc(var(--text-scale-factor) * var(--font-height)); --scale-x: 1; --rotate: 0deg; transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv)); }
.atlas-pdf-text .markedContent { display: contents; }
.atlas-pdf-text span[role="img"] { user-select: none; cursor: default; }
.atlas-pdf-text ::selection { background: rgba(var(--blue-rgb), .32); }
.atlas-pdf-text br::selection { background: transparent; }
.atlas-pdf-text .endOfContent { display: block; position: absolute; inset: 100% 0 0; z-index: 0; cursor: default; user-select: none; }
.atlas-pdf-page.atlas-target { animation: atlas-target 1.6s ease-out; }

/* ---- a paper and its reading note ---- */
.atlas-pdf-layout.has-aside { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
.atlas-paper-aside { position: sticky; top: 12px; display: grid; gap: 10px; padding: 14px; border-radius: 14px; border: 1px solid var(--line); background: rgba(var(--panel-rgb), .78); max-height: calc(100vh - 140px); overflow: auto; }
.atlas-paper-aside > h2, .atlas-paper-users > h2 { margin: 0; font: 600 12px var(--sans); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-2); }
.atlas-paper-note { display: grid; gap: 8px; }
.atlas-paper-note-title { text-align: left; font: 600 14px/1.35 var(--serif); }
.atlas-paper-yours { font-size: 13px; }
.atlas-paper-yours .atlas-markdown { font-size: 13px; }
.atlas-paper-start { display: grid; gap: 8px; }
.atlas-paper-start .atlas-muted { margin: 0; font-size: 12.5px; }
.atlas-paper-aside .atlas-actions { margin: 0; }
.atlas-paper-users { display: grid; gap: 4px; justify-items: start; }
.atlas-paper-tip { margin: 0; font-size: 12px; }

/* ---- discover and add ---- */
.atlas-discover { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 22px; align-items: start; margin-top: 18px; }
.atlas-discover-main > .atlas-section:first-of-type { margin-top: 14px; }
.atlas-discover-for { display: flex; align-items: center; gap: 10px; max-width: 640px; }
.atlas-discover-for .atlas-input { flex: 1; }
.atlas-inline-form { display: flex; gap: 8px; align-items: center; margin: 8px 0 10px; max-width: 720px; }
.atlas-inline-form .atlas-input { flex: 1; }
.atlas-search-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.atlas-search-chip { display: inline-flex; align-items: center; gap: 6px; padding: 3px 4px 3px 10px; border-radius: 999px; border: 1px solid var(--line-2); background: rgba(var(--accent-rgb), .07); font-size: 13px; }
.atlas-search-x { display: inline-grid; place-items: center; width: 20px; height: 20px; border: 0; border-radius: 50%; background: transparent; color: var(--ink-3); cursor: pointer; }
.atlas-search-x:hover { color: var(--ink-1); background: rgba(var(--accent-rgb), .14); }
.atlas-search-results { margin: 14px 0 4px; }
.atlas-search-results > h3 { margin: 0 0 8px; font: 600 14px var(--serif); color: var(--ink-1); }
.atlas-paper-cards { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.atlas-paper-cards.is-nested { margin: 8px 0 4px 14px; padding-left: 12px; border-left: 1px solid var(--line-2); }
.atlas-paper-card { padding: 11px 14px; border-radius: 12px; border: 1px solid var(--line); background: rgba(var(--panel-rgb), .6); }
.atlas-paper-card-head { display: flex; align-items: baseline; gap: 8px; }
.atlas-paper-name { flex: 1; min-width: 0; color: var(--ink-1); font: 600 14.5px/1.35 var(--serif); text-decoration: none; overflow-wrap: anywhere; }
a.atlas-paper-name:hover { color: var(--link); text-decoration: underline; text-underline-offset: 3px; }
.atlas-paper-meta { margin: 4px 0 0; font-size: 12.5px; color: var(--ink-3); overflow-wrap: anywhere; }
.atlas-paper-why { margin: 6px 0 0; font-size: 13px; color: var(--ink-2); }
.atlas-abstract { margin-top: 6px; font-size: 13px; color: var(--ink-2); }
.atlas-abstract > summary { cursor: pointer; color: var(--ink-3); font-size: 12.5px; }
.atlas-abstract > p { margin: 6px 0 0; max-width: 780px; line-height: 1.55; }
.atlas-paper-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.atlas-chip.is-new { color: var(--on-gold); background: var(--gold); border-color: transparent; font-weight: 600; }
.atlas-cited { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.atlas-cited > li { padding: 8px 0; border-top: 1px solid var(--line); }
.atlas-cited > li:first-child { border-top: 0; }
.atlas-cited-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; }
.atlas-cited-title { flex: 1 1 320px; min-width: 0; font: 600 14px/1.35 var(--serif); color: var(--ink-1); }
.atlas-cited-count { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ink-2); }
.atlas-add { position: sticky; top: 12px; display: grid; gap: 12px; padding: 16px; border-radius: 16px; border: 1px solid var(--line-2); background: linear-gradient(180deg, rgba(var(--panel-2-rgb), .9), rgba(var(--panel-rgb), .8)); }
.atlas-add > h2 { margin: 0; font: 600 13px var(--sans); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-2); }
.atlas-add-body { display: grid; gap: 10px; }
.atlas-add-body .atlas-inline-form { margin: 0; }
.atlas-add-note { margin: 0; font-size: 12px; color: var(--ink-3); }
.atlas-found { display: grid; gap: 7px; padding: 12px; border-radius: 12px; border: 1px solid var(--line); background: rgba(var(--sky-rgb), .45); }
.atlas-found-title { margin: 0; font: 600 15px/1.35 var(--serif); color: var(--ink-1); }
.atlas-found-line { margin: 0; font-size: 12.5px; color: var(--ink-2); overflow-wrap: anywhere; }
.atlas-found-line code { font: 12px var(--mono); color: var(--ink-1); }
.atlas-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink-2); }
.atlas-field-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; }
.atlas-drop { position: relative; display: grid; place-items: center; gap: 6px; padding: 22px 12px; border-radius: 12px; border: 1.5px dashed var(--line-2); color: var(--ink-2); text-align: center; font-size: 13px; cursor: pointer; }
.atlas-drop.is-over, .atlas-drop:hover { border-color: var(--link); background: rgba(var(--accent-rgb), .07); color: var(--ink-1); }
.atlas-drop-input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.atlas-dropped { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; font-size: 13px; }
/* ---- write: the LaTeX source, a helper panel beside it ---- */
.atlas-write { display: grid; gap: 10px; }
.atlas-write-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.atlas-write-engine { width: auto; max-width: 320px; padding: 5px 9px; font-size: 13px; }
.atlas-write-main { margin: 0; font-size: 12.5px; }
.atlas-write-split { display: grid; grid-template-columns: minmax(240px, var(--write-split, 64%)) 10px minmax(220px, 1fr); gap: 0; height: calc(100vh - 290px); min-height: 420px; }
.atlas-write-split.is-solo { grid-template-columns: minmax(0, 1fr); }
.atlas-write-source { display: grid; grid-template-columns: auto minmax(0, 1fr); min-height: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: rgba(var(--deep-rgb), .65); }
.atlas-write-gutter { margin: 0; padding: 12px 8px 12px 12px; overflow: hidden; text-align: right; color: var(--ink-3); font: 12.5px/1.6 var(--mono); user-select: none; border-right: 1px solid var(--line); background: rgba(var(--panel-rgb), .55); min-width: 44px; }
.atlas-write-text.atlas-editor-text { height: 100%; min-height: 0; margin: 0; border: 0; border-radius: 0; outline: none; resize: none; padding: 12px; background: transparent; color: var(--ink-1); font: 12.5px/1.6 var(--mono); white-space: pre; overflow: auto; tab-size: 2; box-shadow: none; }
.atlas-write-divider { position: relative; cursor: col-resize; touch-action: none; }
.atlas-write-divider::after { content: ""; position: absolute; top: 12px; bottom: 12px; left: 4px; width: 2px; border-radius: 2px; background: var(--line); transition: background .15s; }
.atlas-write-divider:hover::after, .atlas-write-divider:active::after { background: rgba(var(--accent-rgb), .55); }
.atlas-write-side { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: rgba(var(--panel-rgb), .5); }
.atlas-write-side-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 5px 5px 12px; border-bottom: 1px solid var(--line); font: 600 11px var(--sans); letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3); }
.atlas-write-side-head .atlas-icon-button { width: 26px; height: 26px; }
.atlas-write-panels { flex: none; }
.atlas-write-panels .atlas-seg-item { padding: 4px 10px; font-size: 12.5px; }
.atlas-seg-item.is-alert { color: var(--danger-ink-2); }
.atlas-write-pane { overflow: auto; min-height: 0; padding: 0; }
.atlas-write-pane > .atlas-empty, .atlas-write-pane > .atlas-muted { padding: 14px; margin: 0; }
.atlas-write-hint { margin: 0; font-size: 12px; color: var(--ink-3); }

/* ---- a LaTeX document's compiled PDF in its own tab ---- */
.atlas-preview { display: flex; flex-direction: column; min-height: 100%; }
.atlas-preview-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 8px 14px; border-bottom: 1px solid var(--line); background: rgba(var(--sky-rgb), .6); font-size: 12.5px; color: var(--ink-2); }
.atlas-preview-label { display: inline-flex; align-items: center; gap: 6px; padding: 2px 10px 2px 8px; border-radius: 999px; background: rgba(var(--gold-rgb), .14); border: 1px solid rgba(var(--gold-rgb), .3); color: var(--ink-1); font: 600 11px var(--sans); letter-spacing: .12em; text-transform: uppercase; }
.atlas-preview-label > svg { color: var(--gold); }
.atlas-preview-of { display: inline-flex; align-items: baseline; gap: 4px; min-width: 0; }
.atlas-preview .atlas-pdf { flex: 1; border: 0; border-radius: 0; }
.atlas-preview .atlas-pdf-bar { border-radius: 0; }
.atlas-preview > .atlas-empty { padding: 18px; }
.atlas-pdf.is-synced .atlas-pdf-page { cursor: text; }
.atlas-sync-mark { position: absolute; z-index: 3; pointer-events: none; border-radius: 2px; background: rgba(var(--gold-rgb), .30); box-shadow: 0 0 0 2px rgba(var(--gold-3-rgb), .85); animation: atlas-sync 3.2s ease-out forwards; }
@keyframes atlas-sync { 0%, 65% { opacity: 1; } 100% { opacity: 0; } }
.atlas-problems { list-style: none; margin: 0; padding: 8px; display: grid; gap: 4px; }
.atlas-problems > li { display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; gap: 10px; align-items: baseline; padding: 7px 8px; border-radius: 8px; font-size: 13px; }
.atlas-problems > li:hover { background: rgba(var(--accent-rgb), .06); }
.atlas-problem-kind { font: 600 11px var(--sans); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.atlas-problems > li.is-error .atlas-problem-kind { color: var(--danger-ink-2); }
.atlas-problems > li.is-warning .atlas-problem-kind { color: var(--gold); }
.atlas-problem-text { color: var(--ink-1); overflow-wrap: anywhere; }
.atlas-write-outline { padding: 12px 14px; }
.atlas-write-outline li { display: flex; justify-content: space-between; gap: 8px; }
.atlas-cite { display: grid; gap: 8px; padding: 12px; }
.atlas-cite .atlas-inline-form { margin: 0; }
.atlas-cite-note { margin: 0; font-size: 12px; }
.atlas-cite h3 { margin: 6px 0 0; font: 600 11px var(--sans); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
.atlas-cite-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.atlas-cite-item { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px; width: 100%; text-align: left; padding: 8px 10px; border-radius: 9px; border: 1px solid var(--line); background: rgba(var(--sky-rgb), .4); color: inherit; font: inherit; cursor: pointer; }
.atlas-cite-item:hover:not(:disabled), .atlas-cite-item:focus-visible { border-color: var(--link); background: rgba(var(--accent-rgb), .08); outline: none; }
.atlas-cite-item:disabled { opacity: .55; cursor: default; }
.atlas-cite-title { grid-column: 1; font: 600 13.5px/1.35 var(--serif); color: var(--ink-1); }
.atlas-cite-meta { grid-column: 1; font-size: 12px; color: var(--ink-3); }
.atlas-cite-item > code, .atlas-cite-item > .atlas-chip { grid-column: 2; grid-row: 1 / span 2; align-self: center; font: 11.5px var(--mono); color: var(--ink-2); }
/* ---- review: what a discussion changed ---- */
.atlas-review { flex: none; display: flex; flex-direction: column; min-height: 0; max-height: 46%; margin: 8px 12px; border-radius: 12px; border: 1px solid rgba(var(--gold-rgb), .38); background: rgba(var(--gold-rgb), .05); }
.atlas-review-head { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 12px; border: 0; background: transparent; color: var(--ink-1); font: 600 12.5px var(--sans); text-align: left; cursor: pointer; }
.atlas-review-head:focus-visible { outline: 2px solid var(--link); outline-offset: -2px; border-radius: 12px; }
.atlas-review-toggle { margin-left: auto; font-weight: 500; color: var(--ink-3); }
.atlas-review-body { display: grid; gap: 8px; min-height: 0; overflow: auto; padding: 0 12px 10px; }
.atlas-review-body > .atlas-muted { margin: 0; font-size: 12px; }
.atlas-edit { display: grid; gap: 4px; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line); background: rgba(var(--sky-rgb), .55); }
.atlas-edit-where { font: 600 11px var(--sans); letter-spacing: .06em; text-transform: uppercase; color: var(--ink-3); }
.atlas-edit-del, .atlas-edit-ins { display: grid; grid-template-columns: 14px minmax(0, 1fr); gap: 6px; font-size: 13px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
.atlas-edit-del { color: var(--ink-2); }
.atlas-edit-ins { color: var(--ink-1); }
.atlas-edit-sign { font: 700 13px var(--mono); }
.atlas-edit-del .atlas-edit-sign { color: var(--del-ink); }
.atlas-edit-ins .atlas-edit-sign { color: var(--ins-ink); }
.atlas-edit-del del { color: var(--del-text); background: rgba(var(--del-rgb), .2); text-decoration: line-through; text-decoration-color: rgba(var(--del-2-rgb), .8); border-radius: 3px; }
.atlas-edit-ins ins { color: var(--ins-text); background: rgba(var(--ins-rgb), .2); text-decoration: none; border-radius: 3px; }
.atlas-edit-actions, .atlas-review-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.atlas-edit-actions { margin-top: 2px; }
.atlas-pending { margin: 0 0 12px; }
/* ---- search and learn ---- */
.atlas-search-form { display: flex; align-items: center; gap: 10px; margin: 6px 0 14px; padding: 6px 6px 6px 14px; border-radius: 14px; border: 1px solid var(--line-2); background: rgba(var(--panel-rgb), .85); }
.atlas-search-form > svg { color: var(--ink-3); }
.atlas-search-form .atlas-input { flex: 1; border: 0; background: transparent; font-size: 16px; padding: 8px 4px; }
.atlas-search-form .atlas-input:focus { outline: none; }
.atlas-results { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 4px; }
.atlas-result { padding: 10px 12px; border-radius: 12px; }
.atlas-result:hover { background: rgba(var(--accent-rgb), .05); }
.atlas-result-head { display: flex; align-items: baseline; gap: 10px; }
.atlas-result-kind { flex: none; width: 74px; font: 600 11px var(--sans); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3); }
.atlas-result-title { min-width: 0; text-align: left; border: 0; background: none; padding: 0; color: var(--ink-1); font: 600 15px/1.35 var(--serif); cursor: pointer; overflow-wrap: anywhere; }
.atlas-result-title:hover { color: var(--link); text-decoration: underline; text-underline-offset: 3px; }
.atlas-result-title:focus-visible { outline: 2px solid var(--link); outline-offset: 2px; border-radius: 4px; }
.atlas-result-where { margin: 2px 0 0 84px; font-size: 12px; color: var(--ink-3); overflow-wrap: anywhere; }
.atlas-result-snippet { margin: 4px 0 0 84px; font-size: 13.5px; color: var(--ink-2); line-height: 1.55; overflow-wrap: anywhere; }
.atlas-result-snippet mark, .atlas-learn mark { color: var(--mark-ink); background: var(--mark-bg); border-radius: 3px; padding: 0 2px; }
.atlas-learn-pick { max-width: 560px; margin: 4px 0 18px; }
.atlas-learn-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 28px; align-items: start; }
.atlas-learn-main h1 { margin-bottom: 14px; }
.atlas-learn-main h1 .atlas-link { font: inherit; color: inherit; text-align: left; }
.atlas-learn-question { margin: 4px 0 10px; font: 500 21px/1.4 var(--serif); color: var(--ink-1); max-width: 780px; }
.atlas-learn-h { margin: 26px 0 10px; font: 600 13px var(--sans); letter-spacing: .1em; text-transform: uppercase; color: var(--ink-2); }
.atlas-route { margin: 0; padding-left: 22px; display: grid; gap: 8px; font-size: 14px; }
.atlas-route .atlas-link { text-align: left; }
.atlas-learn-foot { font-size: 12px; margin-top: 12px; }
.atlas-learn-side { padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line); background: rgba(var(--panel-rgb), .6); }
.atlas-learn-side .atlas-learn-h { margin-top: 0; }
.atlas-concepts { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.atlas-concepts > li { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.atlas-concept { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line-2); background: rgba(var(--accent-rgb), .07); color: var(--ink-1); font: 500 12.5px var(--sans); cursor: pointer; }
.atlas-concept:hover { border-color: var(--link); background: rgba(var(--accent-rgb), .14); }
.atlas-concept-arrow { color: var(--ink-3); }
.atlas-decide { display: grid; gap: 6px; margin-top: 10px; }
.atlas-decide-option { display: grid; grid-template-columns: 22px minmax(0, 1fr); gap: 8px; align-items: baseline; width: 100%; text-align: left; padding: 7px 10px; border-radius: 9px; border: 1px solid rgba(var(--gold-rgb), .3); background: rgba(var(--sky-rgb), .4); color: var(--ink-1); font: inherit; font-size: 13px; cursor: pointer; }
.atlas-decide-option:hover, .atlas-decide-option:focus-visible { border-color: var(--gold); background: rgba(var(--gold-rgb), .1); outline: none; }
.atlas-decide-letter { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: rgba(var(--gold-rgb), .18); color: var(--gold); font: 700 12px var(--sans); }
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
  .atlas-top { flex-wrap: wrap; gap: 8px 12px; padding: 8px 12px; }
  .atlas-tools { flex: 1 1 100%; margin-left: 0; order: 3; }
  .atlas-page { padding: 16px 14px 60px; }
  .atlas-page h1, .atlas-hero h1 { font-size: 24px; }
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
  .atlas-write-split { grid-template-columns: minmax(0, 1fr); height: auto; gap: 12px; }
  .atlas-write-divider { display: none; }
  .atlas-write-source { height: 60vh; }
  .atlas-write-side { height: 70vh; }
  .atlas-ask-top kbd { display: none; }
  .atlas-activity-row { grid-template-columns: minmax(0, 1fr) auto; }
  .atlas-activity-kind, .atlas-activity-row > .atlas-date { display: none; }
  .atlas-team-seat { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 32px; grid-template-areas: "role how remove" "model model ." "task task task"; }
}
@media (prefers-reduced-motion: reduce) {
  .atlas-root * { animation: none !important; transition: none !important; }
}
`;

function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById('aitp-atlas-styles')) return;
  const style = document.createElement('style');
  style.id = 'aitp-atlas-styles';
  style.textContent = themeCss() + '\n' + STYLES;
  document.head.appendChild(style);
}

function AtlasIcon() {
  return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true },
    h('circle', { cx: 12, cy: 12, r: 2.6, fill: 'currentColor', stroke: 'none' }),
    h('ellipse', { cx: 12, cy: 12, rx: 9.5, ry: 4.2, transform: 'rotate(-28 12 12)' }),
    h('circle', { cx: 19.6, cy: 8, r: 1.3, fill: 'currentColor', stroke: 'none' }));
}
