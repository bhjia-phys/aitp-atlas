/**
 * A small AITP research tree in a temporary folder: a root note with two
 * directions, topics with openings, Current work and a branch, a note no link
 * reaches, an excluded folder, a knowledge index, a paper map and a library PDF.
 */
import { promises as fsp } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// A small valid PDF with a real text layer for both preview and byte-range tests.
// All fields (including the stream) are ASCII, so character and byte offsets agree.
function readingSample() {
  const stream = 'BT /F1 24 Tf 52 675 Td (Atlas reading fixture) Tj\n/F1 12 Tf 0 -36 Td (This synthetic page demonstrates selectable text.) Tj ET\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 540 720] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const entries = ['0000000000 65535 f '];
  for (const [index, object] of objects.entries()) {
    entries.push(`${String(pdf.length).padStart(10, '0')} 00000 n `);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  return pdf + `xref\n0 ${entries.length}\n${entries.join('\n')}\ntrailer\n<< /Size ${entries.length} /Root 1 0 R >>\nstartxref\n${pdf.length}\n%%EOF\n`;
}
const READING_PDF = readingSample();

const FILES = {
  'topics/research.md': `# Research programme

> **Adopted backbone (2026-10-08).** Assembled from the topic notes.

This root note is the top of the research backbone. It names the directions and how the topics connect.

## 1. Reliable Monte Carlo methods

The overarching question is whether Monte Carlo estimates can be made reproducible.

| Topic | What it currently implies for the direction |
| --- | --- |
| [Worm algorithm](mc/worm/research.md), with its [stability branch](mc/worm/stability/research.md) | Equilibration needs two separate checks; a stable energy alone supplies neither. |
| [Analytic continuation](mc/continuation/research.md) | Real-axis quantities carry an uncontrolled continuation error. |

## 2. Topology and anomalies

- [Topological phases](topology/research.md): a learning synthesis of edge states and quantized response.

## 3. Study directions in the shared collection

Study routes live in the [knowledge index](../knowledge/index.md); no topic owns them yet.

## Connections between topics

The [Worm algorithm](mc/worm/research.md) winding estimator meets [topology](topology/research.md) in lattice models.

## Seeds

- **A shared invariant in both topics** *(not yet discussed)*. A possible first check.

## Standing agreements

No workspace-wide delegation is recorded here. The shared [knowledge index](../knowledge/index.md) lists concepts.

## Current work

- **Parallel tempering → independent topic** — active · 2026-11-07. The researcher established it as a topic.
- **Critical exponents** — proposed · 2026-11-11. A seed awaiting a choice.
- **Window choice → [continuation](mc/continuation/research.md#current-work)** — waiting on the researcher · 2026-10-20.
`,
  'topics/mc/worm/research.md': `# Worm algorithm: equilibration and reproducibility

The question is whether the worm sampler produces reproducible estimates with controlled error. It serves the [Monte Carlo direction](../../research.md#1-reliable-monte-carlo-methods).

## Current work

- **Upstream packaging → [release owner](../workspace/README.md#worm)** —
  Pull request #12 approved and merged; review threads resolved · 2026-10-27.
  The release keeps the published defaults.
- **Mixing test** — paused · 2026-11-02. Waiting for the cluster; see [the plan](plans/mixing.md).

## Branches

- [Sampling stability](stability/research.md): whether the estimator is stable.

## The equilibrium distribution

The chain reaches it when the moves are ergodic; see the [Berry note](../../../knowledge/atoms/berry.md) and arXiv 1510.07698.

![Gap convergence](figures/gap.png)

The [mixing driver](code/mix.py) writes [the gap series](data/gap.csv).
`,
  'topics/mc/worm/figures/gap.png': Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex'),
  'topics/mc/worm/code/mix.py': 'print("mix")\n',
  'topics/mc/worm/data/gap.csv': 'step,gap\n1,0.52\n2,0.51\n',
  'topics/topology/readings/thouless.pdf': READING_PDF,
  'topics/topology/manuscript/draft.tex': '\\documentclass{article}\n\\begin{document}\n\\section{Edge}\n\\end{document}\n',
  'topics/mc/worm/stability/research.md': `# Sampling stability of the worm estimator

The question is whether the estimator survives a longer run. See the [parent](../research.md).
`,
  'topics/mc/continuation/research.md': `# Analytic continuation: stability of spectra

The question is how much real-frequency structure survives continuation. Its winding meets [the topology topic](../../topology/research.md).

## Current work

- **Padé ensemble** — active · 2026-09-30. Compare the ensemble spread with the residual.
- **Window choice** — waiting on the researcher · 2026-10-20. Two windows give different spreads; which one sets the error bar?
`,
  'topics/topology/research.md': `# Topological insulators and anomalies

The question is how band topology becomes quantized response. Read [Thouless's paper](readings/thouless.pdf) and [arXiv:1510.07698](https://arxiv.org/abs/1510.07698); the [draft](manuscript/draft.tex) collects the argument.
`,
  'topics/orphan/research.md': `# A note nobody links

The question is whether anything reaches this note.

## Current work

- **Orphan decision** — waiting on the researcher · 2026-09-01. Nothing links here.
`,
  'topics/mc/workspace/scratch/research.md': `# Excluded scratch

This lives in an excluded workspace folder.
`,
  'knowledge/index.md': `---
title: Index
---

# Index

**Start here.** Then open the entries the task needs.

## Stories and reading routes

| Story | Area | State |
|---|---|---|
| [Algebras in gravity](topics/algebras/story.md) | Gravity | Integrated |

Two short reading routes begin with the [Berry connection](atoms/berry.md).

## Band topology and response

| Entry | Kind | What it answers; scope | Note | Where to read | Support |
|---|---|---|---|---|---|
| Berry connection; Berry phase | concept | How to compare eigenstates with arbitrary phases; a $|\\psi\\rangle$ example | [berry.md](atoms/berry.md) | [1510.07698](https://arxiv.org/abs/1510.07698) §1.1 | source |
| Does a winding estimator fix the response? | question | A sampling question, cited from research | [research note](../topics/mc/worm/research.md#the-equilibrium-distribution) | — | provisional (research: worm algorithm); awaiting review |
`,
  'knowledge/atoms/berry.md': `# Berry connection

How to compare eigenstates whose phases are arbitrary.
`,
  'knowledge/papers/1510.07698.md': `# [Map] Three lectures on topological phases of matter

**Establishes.** The band-topology lectures.
`,
  'knowledge/papers/1510.07698/01-intro.md': `# Section 1
`,
  'knowledge/library/arxiv/1510.07698v2/paper.pdf': READING_PDF,
};

export async function makeFixture() {
  const base = await fsp.mkdtemp(path.join(os.tmpdir(), 'atlas-fixture-'));
  for (const [rel, content] of Object.entries(FILES)) {
    const file = path.join(base, rel);
    await fsp.mkdir(path.dirname(file), { recursive: true });
    await fsp.writeFile(file, content);
  }
  const root = path.join(base, 'topics');
  return {
    base,
    root,
    knowledge: path.join(base, 'knowledge'),
    file: (rel) => path.join(base, rel),
    cleanup: () => fsp.rm(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
  };
}

/** Every file under `dir` with its size and modification time, to show that nothing changed. */
export async function snapshot(dir) {
  const out = {};
  const walk = async (folder) => {
    for (const entry of await fsp.readdir(folder, { withFileTypes: true })) {
      const abs = path.join(folder, entry.name);
      if (entry.isDirectory()) await walk(abs);
      else {
        const stat = await fsp.stat(abs);
        out[path.relative(dir, abs)] = `${stat.size}:${stat.mtimeMs}`;
      }
    }
  };
  await walk(dir);
  return out;
}
