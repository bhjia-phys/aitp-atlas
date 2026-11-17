// ----------------------------------------------------------------- papers ---
// A paper a note cites by its web address (arXiv, a DOI, an INSPIRE record) opens beside the page
// instead of in a browser: its details, and for arXiv its PDF read through Atlas (fetched on the
// researcher's click, never saved). One step adds it to the library for the topic it serves, with
// a paper map that says so; the library's copy then opens in its place. A paper the library has
// opens as the library's copy, with its reading note.

/** A link to a paper Atlas can look up: arXiv (abs, pdf, html), a DOI, or an INSPIRE record; otherwise null. */
function paperLink(url) {
  let u;
  try {
    u = new URL(String(url || ''));
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  if (host === 'arxiv.org' || host === 'export.arxiv.org') {
    const m = /^\/(?:abs|pdf|html)\/([a-z-]+(?:\.[a-z]{2})?\/\d{7}|\d{4}\.\d{4,5})(v\d+)?(?:\.pdf)?\/?$/i.exec(u.pathname);
    return m ? { kind: 'arxiv', id: m[1], version: m[2] || '', q: m[1] + (m[2] || ''), label: `arXiv ${m[1]}${m[2] || ''}` } : null;
  }
  if (host === 'doi.org' || host === 'dx.doi.org') {
    let doi = '';
    try {
      doi = decodeURIComponent(u.pathname.slice(1));
    } catch {
      doi = u.pathname.slice(1);
    }
    return /^10\.\d{4,9}\/\S+$/.test(doi) ? { kind: 'doi', doi, q: url, label: `DOI ${doi}` } : null;
  }
  if (host === 'inspirehep.net') {
    const m = /^\/(?:api\/)?literature\/(\d+)/.exec(u.pathname);
    return m ? { kind: 'inspire', recid: m[1], q: url, label: `INSPIRE ${m[1]}` } : null;
  }
  return null;
}

/** The topics a paper can be filed for, root first, branches under their topic's name. */
function topicChoices(ov) {
  const all = Object.values((ov && ov.topics) || {}).filter((t) => t && t.file && t.id !== '');
  const name = (t) => {
    const chain = [];
    for (let cur = t; cur && cur.id !== ''; cur = cur.parent !== undefined && cur.parent !== null ? ov.topics[cur.parent] : null) chain.unshift(shortTitle(cur.title, 36));
    return chain.join(' › ');
  };
  return all.map((t) => ({ file: t.file, label: name(t) })).sort((a, b) => a.label.localeCompare(b.label));
}

function PaperRefView({ url, topic, overview: ov, go, flash, anchor, anchorAt }) {
  const ref = paperLink(url) || { kind: 'url', q: url, label: url };
  const { data, error, loading } = useApi('web/lookup', { q: ref.q }, ref.q);
  if (loading && !data) return h(Loading, { label: `Looking up ${ref.label}…` });
  if (error) {
    return h('div', { className: 'atlas-page' },
      h('div', { className: 'atlas-error', role: 'alert' }, h('span', null, error.message), h(TextButton, { onClick: () => window.open(url, '_blank', 'noopener') }, 'Open in the browser')));
  }
  // Already in the library: the library's copy, with its reading note.
  if (data.inLibrary && data.inLibrary.pdf) return h(DocView, { path: data.inLibrary.pdf, overview: ov, go, flash, anchor, anchorAt });
  const readable = data.kind === 'arxiv';
  const cited = data.mentionedBy || [];
  const authors = data.authors || [];
  const byline = [authors.slice(0, 6).join(', ') + (authors.length > 6 ? ', et al.' : ''), data.year || '', data.journal || ''].filter(Boolean).join(' · ');
  const preferred = [topic, ...cited.map((t) => t.file)].find((f) => f && topicChoices(ov).some((c) => pathKey(c.file) === pathKey(f))) || '';
  return h('div', { className: 'atlas-page is-wide atlas-doc atlas-ref' },
    h('header', { className: 'atlas-doc-head' },
      h('p', { className: 'atlas-kicker' }, h(Icon, { name: 'paper', size: 14 }), readable ? `arXiv ${data.id}${data.version} · not in your library` : 'Paper · not in your library'),
      h('h1', null, data.title || ref.label),
      byline ? h('p', { className: 'atlas-lede' }, byline) : null,
      h('div', { className: 'atlas-meta' },
        data.inspire && data.inspire.citations ? h('span', null, plural(data.inspire.citations, 'citation') + ' on INSPIRE') : null,
        cited.length ? h('span', null, 'Cited in ', cited.map((t, i) => h('span', { key: t.file }, i ? ', ' : '', h(TextButton, { onClick: () => go({ view: 'doc', path: t.file }) }, shortTitle(t.title, 44))))) : null),
      readable ? h(AddToLibrary, { entry: data, ov, preferred, go, flash }) : null,
      h('div', { className: 'atlas-actions' },
        h(Button, { quiet: true, icon: 'external', onClick: () => window.open(readable ? `https://arxiv.org/abs/${data.id}${data.version}` : url, '_blank', 'noopener') }, readable ? 'Open on arXiv' : 'Open in the browser'))),
    data.summary ? h(Fold, { id: 'abstract:' + ref.q, title: 'Abstract' }, () => h('p', { className: 'atlas-ref-abstract' }, data.summary)) : null,
    readable
      ? h(PaperPdf, { url, src: `${API}/web/pdf?id=${encodeURIComponent(data.id + data.version)}`, title: data.title || ref.label, flash, anchor, anchorAt })
      : h(Empty, null, 'This record has no arXiv edition, so it cannot be read inside Atlas.'));
}

/** The arXiv PDF, read through Atlas; what the ask bar and the selection tools see as "this PDF". */
function PaperPdf({ url, src, title, flash, anchor, anchorAt }) {
  usePublishFocus({ kind: 'doc', topic: null, doc: { type: 'pdf', title: String(title), path: url } }, [url, title]);
  return h(PdfView, { path: url, src, flash, anchor, anchorAt });
}

/** Add the edition to the library for a topic: the PDF and its TeX source, and a paper map that says which topic it is for. */
function AddToLibrary({ entry, ov, preferred, go, flash }) {
  const choices = useMemo(() => topicChoices(ov), [ov]);
  const [forTopic, setForTopic] = useState(preferred || '');
  const [why, setWhy] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const r = await api('web/add', { method: 'POST', body: { id: entry.id, version: entry.version, source: true, note: true, why: why.trim(), topic: forTopic, meta: entry } });
      const chosen = choices.find((c) => c.file === forTopic);
      flash(`Added ${r.id}${r.version} to the library${chosen ? `, for ${chosen.label}` : ''}; its paper map is started.`);
      go({ view: 'doc', path: r.pdf, stay: true });
    } catch (error) {
      flash(error.message);
    } finally {
      setBusy(false);
    }
  };
  return h('form', { className: 'atlas-ref-add', onSubmit: add },
    h('span', { className: 'atlas-label' }, 'Add to the library'),
    h('label', { className: 'atlas-ref-for' }, h('span', null, 'For'),
      h('select', { className: 'atlas-input', value: forTopic, onChange: (e) => setForTopic(e.target.value), 'aria-label': 'The topic this paper is for' },
        h('option', { value: '' }, 'No topic yet'),
        choices.map((c) => h('option', { key: c.file, value: c.file }, c.label)))),
    h('input', { className: 'atlas-input', value: why, onChange: (e) => setWhy(e.target.value), placeholder: 'Why you are reading it (optional)', 'aria-label': 'Why you are reading it' }),
    h('button', { type: 'submit', className: 'atlas-button is-primary is-small', disabled: busy }, busy ? 'Adding…' : 'Add'));
}
