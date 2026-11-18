/** Local topic routing (DS-14/15). Never read a note while the researcher types.
 * A new store snapshot gets a new index; old snapshots can be garbage-collected.
 */
const corpora = new WeakMap();
const stop = new Set('a an and are as at be been being but by can could did do does for from had has have how i if in into is it its me more most my of on or our should so some than that the their them these this those to us use using was we were what when where which who why will with would you your'.split(' '));

function stem(term) {
  if (!/^[a-z]+$/.test(term) || term.length < 4) return term;
  if (term.endsWith('ies') && term.length > 4) return term.slice(0, -3) + 'y';
  if (/(ches|shes|sses|xes|zes)$/.test(term)) return term.slice(0, -2);
  if (term.endsWith('s') && !/(ss|us|is)$/.test(term)) return term.slice(0, -1);
  if (/ing$/.test(term) && term.length > 5 || /ed$/.test(term) && term.length > 4) return term.replace(/(?:ing|ed)$/, '').replace(/([bdgmnprt])\1$/, '$1');
  return term;
}

function terms(text) {
  return String(text ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/\\[a-z]+\*?/g, ' ').match(/[\p{L}\p{N}]+/gu)?.filter((x) => x.length > 1 && !stop.has(x)) || [];
}

function indexOfAtlas(atlas) {
  const knowledge = new Map(), branches = new Map();
  for (const area of atlas.index?.areas || []) for (const entry of area.entries || []) {
    for (const id of new Set(entry.usedBy || [])) {
      if (!knowledge.has(id)) knowledge.set(id, []);
      knowledge.get(id).push(entry.title);
    }
  }
  for (const t of atlas.topics.values()) if (t.parent) {
    if (!branches.has(t.parent)) branches.set(t.parent, []);
    branches.get(t.parent).push(t.title);
  }
  let total = 0;
  const docs = [], df = new Map();
  for (const t of atlas.topics.values()) {
    if (!t.id) continue; // Root is the programme, never an auto-filing target.
    const tf = new Map(); let length = 0;
    const add = (text, weight) => {
      for (const word of terms(text)) { const key = stem(word); tf.set(key, (tf.get(key) || 0) + weight); length++; }
    };
    add(t.title, 3);
    for (const text of branches.get(t.id) || []) add(text, 2);
    add(t.routeOpening || t.lead, 2);
    for (const thread of t.threads || []) add(thread.name, 1.5);
    add(t.routeKeywords, 1);
    for (const title of knowledge.get(t.id) || []) add(title, 0.5);
    let inherited = t;
    while (inherited && !inherited.direction && inherited.parent) inherited = atlas.topics.get(inherited.parent);
    const latest = (t.threads || []).reduce((last, th) => th.date && th.date > last ? th.date : last, '');
    docs.push({ topic: { id: t.id, path: t.file, title: t.title, direction: inherited?.direction || '' }, tf, length, latest: Date.parse(latest) });
    for (const key of tf.keys()) df.set(key, (df.get(key) || 0) + 1);
    total += length;
  }
  const index = { docs, df, mean: total / docs.length || 1 };
  corpora.set(atlas, index);
  return index;
}

export function routeTopics(atlas, query, topicId = '', now = Date.now()) {
  const words = new Map();
  for (const word of terms(String(query || '').slice(0, 4096))) { const key = stem(word); if (!words.has(key)) words.set(key, word); }
  if (!words.size) return { candidates: [], confident: false };
  const { docs, df, mean } = corpora.get(atlas) || indexOfAtlas(atlas);
  const weightedTerms = [...words].filter(([key]) => df.has(key)).map(([key, word]) => ({ key, word, idf: Math.log1p((docs.length - df.get(key) + 0.5) / (df.get(key) + 0.5)) }));
  const ranked = [];
  for (const d of docs) {
    const reasons = [], norm = 1.2 * (0.25 + 0.75 * d.length / mean);
    let score = 0;
    for (const { key, word, idf } of weightedTerms) {
      const tf = d.tf.get(key);
      if (!tf) continue;
      const contribution = idf * tf * 2.2 / (tf + norm);
      reasons.push({ word, contribution }); score += contribution;
    }
    if (!reasons.length) continue; // Recency alone is not evidence of relevance.
    if (Number.isFinite(d.latest)) score += 0.15 * Math.exp(-Math.max(0, (now - d.latest) / 86400000) / 30);
    reasons.sort((a, b) => b.contribution - a.contribution || a.word.localeCompare(b.word));
    ranked.push({ topic: d.topic, score, reasons: reasons.slice(0, 5).map((r) => r.word) });
  }
  // Optional context breaks exact ties only: it must not manufacture confidence.
  ranked.sort((a, b) => b.score - a.score || Number(b.topic.id === topicId) - Number(a.topic.id === topicId) || a.topic.id.localeCompare(b.topic.id));
  return { candidates: ranked.slice(0, 5), confident: !!ranked.length && ranked[0].score >= 2 && ranked[0].score >= 1.6 * (ranked[1]?.score || 0) };
}
