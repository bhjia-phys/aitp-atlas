// Working surfaces stay flat: the document, not the chrome, is the focal point.
// Appended after the legacy layouts so PDF selection layers and editors retain their geometry.
const ATLAS_SURFACE_CSS = `
.atlas-root :is(.atlas-topic,.atlas-doc,.atlas-library,.atlas-learn,.atlas-write-page,.atlas-search,.atlas-setup) { color: var(--text-1); }
.atlas-root :is(.atlas-topic,.atlas-doc,.atlas-library,.atlas-learn,.atlas-write-page,.atlas-search,.atlas-setup) h1 { font: var(--t-h1); }
.atlas-root :is(.atlas-kicker,.atlas-label,.atlas-section > h2,.atlas-learn-h,.atlas-topic-side > .atlas-fold > .atlas-fold-head,.atlas-paper-aside > h2) { font: var(--t-cap); font-variant-caps: var(--cap-variant); letter-spacing: var(--cap-tracking); text-transform: none; }
.atlas-root :is(.atlas-topic,.atlas-doc,.atlas-library,.atlas-learn,.atlas-write-page,.atlas-search,.atlas-setup) .atlas-kicker::before { content: none; }
.atlas-root :is(.atlas-count,.atlas-date) { font: var(--t-count); letter-spacing: normal; font-variant-numeric: tabular-nums; }
.atlas-root .atlas-path { font: var(--t-mono); }
.atlas-root :is(.atlas-topic-main,.atlas-reading,.atlas-notebook,.atlas-paper-aside) .atlas-markdown,
.atlas-root :is(.atlas-lede,.atlas-learn-question,.atlas-setup p,.atlas-ref-abstract) { font: var(--t-read); max-width: 72ch; }
.atlas-root .atlas-reading { max-width: none; }
.atlas-topic .atlas-context { gap: var(--s-12); padding: var(--s-12) var(--s-16); border-block: 0; border-inline-end: 0; border-radius: 0; }
.atlas-topic .atlas-context > :last-child { font: var(--t-read); max-width: 72ch; }
.atlas-topic .atlas-topic-side { align-self: start; gap: 0; padding-inline-start: var(--s-16); border-inline-start: 1px solid var(--border); }
.atlas-topic-side .atlas-fold-body { padding: var(--s-4) 0 var(--s-12); }
.atlas-topic-side .atlas-fold .atlas-fold { margin-inline-start: var(--s-8); }
.atlas-topic-side .atlas-fold-head { width: 100%; }
.atlas-shelf-more { display: block; margin-block: var(--s-4); padding: var(--s-4) var(--s-8); border: 0; border-radius: var(--r-sm); background: transparent; font: var(--t-ui); color: var(--accent); cursor: pointer; }
.atlas-shelf-more:hover { background: var(--hover); }
.atlas-shelf-more:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.atlas-shelf-hint { margin: 0 0 var(--s-4); font: var(--t-meta); color: var(--text-3); }
.atlas-root .atlas-pdf { min-width: 0; align-items: safe center; background: var(--table); gap: var(--s-16); border-radius: var(--r-sm); }
.atlas-root .atlas-pdf-bar { box-sizing: border-box; height: var(--row-36); min-height: var(--row-36); gap: var(--s-4); padding: 0 var(--s-8); border-radius: 0; background: var(--surface); white-space: nowrap; }
.atlas-pdf-place { font: var(--t-ui); color: var(--text-2); font-variant-numeric: tabular-nums; }
.atlas-pdf-zoom { font: var(--t-meta); font-variant-numeric: tabular-nums; }
.atlas-root .atlas-pdf-num { inset: auto var(--s-4) auto auto; top: 100%; color: var(--text-3); font: var(--t-meta); }
.atlas-add-write-dialog .atlas-control-dialog-body { display: grid; gap: var(--s-12); }
.atlas-add-write-dialog .atlas-quick-more { font: var(--t-meta); }
.atlas-root :is(.atlas-newnote,.atlas-quick-found,.atlas-setup) { border: 1px solid var(--border); border-radius: var(--r-md); background: var(--surface); padding: var(--s-16); }
.atlas-root .atlas-review { border: 1px solid var(--border-strong); border-inline-start: 3px solid var(--gold); border-radius: var(--r-md); background: var(--surface); }
.atlas-root .atlas-review-head { padding: var(--s-8) var(--s-12); font: var(--t-ui); }
.atlas-root .atlas-review-body > .atlas-muted { font: var(--t-meta); color: var(--text-2); }
.atlas-root .atlas-edit-text { font: var(--t-read); max-width: 72ch; }
.atlas-root :is(.atlas-library,.atlas-learn,.atlas-write-page,.atlas-search) :is(.atlas-item,.atlas-paper-title,.atlas-result-title,.atlas-ref-title) { color: var(--text-1); }
.atlas-root :is(.atlas-library,.atlas-learn,.atlas-write-page,.atlas-search) .atlas-item { padding: var(--s-8); border-radius: var(--r-sm); font: var(--t-body); }
.atlas-root .atlas-setup pre { padding: var(--s-12); border-radius: var(--r-sm); font: var(--t-mono); }
@container (min-width: 901px) { .atlas-topic .atlas-topic-side { position: sticky; top: var(--s-12); max-height: calc(100vh - var(--s-72) - var(--s-48)); overflow: auto; } }
@container (max-width: 900px) { .atlas-topic .atlas-topic-side { position: static; padding: 0; border: 0; border-block-start: 1px solid var(--border); } }
@container (max-width: 640px) {
  .atlas-root :is(.atlas-topic-main,.atlas-reading,.atlas-notebook,.atlas-paper-aside) .atlas-markdown,
  .atlas-root :is(.atlas-lede,.atlas-learn-question,.atlas-setup p,.atlas-ref-abstract,.atlas-edit-text),
  .atlas-topic .atlas-context > :last-child { font: var(--t-read-compact); }
}
`;
