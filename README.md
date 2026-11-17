# AITP Atlas

A DeepSeek Harness plugin that turns AITP research into one workspace for learning, exploring and
researching physics: the whole programme as a universe of directions and topics, every document read
and written inside DSH, new papers and lectures brought in, LaTeX built beside its PDF, discussions
and agent teams beside whatever you are reading, and their edits reviewed before they stay. AITP
keeps the memory and guides the research through its own Skills; Atlas gives the AI only pointers
to what you are looking at. The reasoning is in [DESIGN.md](DESIGN.md).

## What you see

Open **Atlas** from the left sidebar. The top bar holds four places (Universe, Activity, Library,
Learn), Search (`/`), Add (`+`), Ask (Ctrl+J) and the theme: **Auto** follows DSH's own appearance,
**Day** and **Night** stay put.

- **Universe**: a star chart of the root `research.md`. Each direction is a colored sector in the
  root's order; topics are stars on the inner ring, branches on the outer rings; a star glows when
  its Current work moved recently; a dashed ring marks a note no link reaches. Beside it, **Waiting
  on you** lists the Current work entries that wait on your decision, then **Recent activity**.
- **Activity**: every entry waiting on you, with *Open the thread*, *Discuss*, *Start a team*, and,
  when the entry lays out lettered options, *Decide*: choosing one starts a discussion that records
  your decision in the note the AITP way. Below, what is running, grouped by topic: discussions,
  agent teams with each member's name, role, task and model, and DSH's other sessions.
- **A topic**: what the root says, the opening, Current work, the account section by section, its
  branches, everything it links sorted by kind, and its discussions. A banner names edits that
  discussions made to the note and you have not reviewed yet.
- **Documents**, all inside DSH: Markdown with equations and figures; PDFs with selectable text, so
  a passage can be asked about or kept; LaTeX, BibTeX, code, tables, notebooks, images, video and
  folders. A link opens its target at the place it names: a heading, an `<a id>` anchor, a line
  (`#L849`), or a PDF page (`paper.pdf#page=13`).
- **Beside the page**: a file you open (a link in a note, a topic's contents, the Library, Search,
  Learn) opens in a panel beside the page, which stays where it was. Links inside the panel open
  there too, with Back; *Open as the page* moves the file into the page. Topics and the other
  places fill the page as before. With a discussion open as well, page, file and discussion stand
  side by side; when the window cannot fit three columns, the file and the discussion share the
  side as two tabs. A discussion started from either is told what is open beside it.
- **Library**: the **Shelf**, **By topic**, the **Knowledge index**, and **Discover and add**.
- **Learn**: a topic's question, its reading route (from the note's own route section or the route
  note it links; stages whose paper is in the library open its PDF here), and a concept map drawn
  from the links between the knowledge entries it uses; *Explain at my level*, *Write what I
  understand* (a dated note in the topic) and *Check my understanding*. Nothing tracks progress.
- **Search** (`/`): every word must appear; results from notes, knowledge entries and papers (paper
  maps and the abstracts of their TeX sources), with the words marked.

## Bringing material in

*Discover and add* (or `+` in the top bar):

- **Saved searches** per topic: words such as `long-range Heisenberg · level statistics` (each
  phrase must appear in the title or abstract); arXiv's newest matches, marked new since you last
  looked. *Add to library*, *Ask about it*, or *Not relevant* to set one aside.
- **INSPIRE: who cites what you rely on**: the citation counts of the arXiv papers a topic's note
  names, how many are new since your last visit, and the newest citing papers.
- **From your open questions**: a discussion reads the topic's Current work and searches for papers
  that bear on it; it adds nothing.
- **Add anything**: an arXiv ID or link, a DOI or an INSPIRE link is looked up (metadata only: title,
  authors, journal, INSPIRE citations, whether your notes cite it, whether the library has it). *Add*
  downloads the exact edition to `library/arxiv/<id>v<n>/paper.pdf` with a
  `paper.pdf.provenance.json` (URL, date, size, SHA-256), the TeX source as `source.tar` unpacked
  into `source/`, and on request a paper map `papers/<id>.md` from the collection's own
  `templates/paper.md`. A **lecture video** becomes a source note in `sources/` with its link and the
  transcript you supply (timestamps let a note link a moment); Atlas downloads no video. **Files**
  dropped here (papers, slides, notes) go to the topic's `readings/` or `library/files/`.

Nothing is saved until you press Add (reading a paper beside a note fetches its PDF without keeping
it), and nothing existing is overwritten.

## Reading and writing

- **A paper a note cites** by its web address (arXiv, a DOI or an INSPIRE record) opens beside the
  page instead of in a browser: its details and, for arXiv, the PDF itself, read through Atlas and
  not saved. *Add to the library*, with **For** set to the topic it serves (preset to the one you are
  reading), downloads the edition with its TeX source and starts its paper map, whose "Why I'm
  reading it" names that topic; the library's copy then opens in its place. A paper the library has
  opens as the library's copy. The Library's *By topic* lists a paper under the topics whose notes
  cite it and the topic its paper map is for. Other sites still open in the browser.
- **A library paper** opens with its reading note beside the PDF: *Keep in note* adds a selected
  passage to the paper map's "Your reading" with a link to its page, and those page links open the
  PDF there. *Start a reading note* creates the map if there is none.
- **LaTeX** opens in a workspace beside its PDF: line numbers, *Build* (Ctrl+B, saving first) with
  the TeX installations found on Windows and in WSL (BibTeX and reruns as needed), the log's
  problems by file and line, **SyncTeX** both ways (Ctrl+click a source line to see it in the PDF,
  Ctrl+click the PDF to jump to its line, in whichever file), an outline, and **Cite**: the
  document's `.bib`, then your library (citing adds the entry: INSPIRE's BibTeX when it answers,
  otherwise one made from the paper's metadata), then arXiv. A section file builds its document
  (found by `% !TEX root`, or the file that `\input`s it).
- *Save* everywhere refuses to overwrite a file another session changed meanwhile, unless you
  choose to.

## Discussing, teams and review

- **Select a passage** for *Ask*, *Explain*, *Derive*, *Check*, *Papers* or *Make a task*; in a PDF
  the selection carries its page. **Ctrl+J** asks about what is on screen. A discussion is a real
  DSH session shown in a pane on the right; its first message opens with an `Atlas context` block
  of pointers, never whole files.
- **Agent teams** start from a thread (*Start a team*): a DSH session with Agent Teams on leads;
  with Oh-My-BBFF installed, each seat is a role (a core member that keeps its context, or a one-shot
  job) with its own model tier. The lead's brief names the goal, the limits, the seats, the run
  directory for members' reports, and the rules: only the lead proposes note edits, after review,
  and no cluster job is submitted without your yes.
- **Review**: when Atlas starts a discussion or a team it keeps a copy of the notes in scope (the
  topic note, its parent and branches, the document in focus). The pane then shows *What this
  discussion changed*: each edit by section, the removed and added words marked, with *Keep* or
  *Revert* (only where the note still shows the edit), *Keep all*, *Run an independent review* and
  *File the settled result*. The copies live in Atlas's state folder, never in the research, and
  are dropped when you resolve the discussion.

## What it reads and writes

Only AITP's own conventions, so any AITP research displays without preparation: the root note's
`##` sections, each note's title, opening and `## Current work`, the links of a note, the knowledge
`index.md`, and the library as the collection keeps it.

Atlas writes only on your action: a saved or created note; an added paper, lecture or file; a
passage kept in a paper map; a citation added to a `.bib`; a reverted edit; the saved searches in
`library/discover.json`. LaTeX builds leave their products beside the source, as LaTeX does.
Every request passes DSH's own browser sign-in.

It asks arXiv and INSPIRE only for what you look up, search, read or add, carrying identifiers and search
words, never your files. Requests go through the proxy in `HTTPS_PROXY`/`HTTP_PROXY` (with
`NO_PROXY`), or the one the config names; `web: false` stops them all.

## Install

Atlas needs DeepSeek Harness 0.2.2 or later, and research kept the AITP way
([AITP-Research-Protocol](https://github.com/bhjia-phys/AITP-Research-Protocol)). Clone it, quit DSH
completely, then link the folder into your profile:

```powershell
git clone https://github.com/bhjia-phys/aitp-atlas C:/path/to/aitp-atlas
$dsh = "$env:LOCALAPPDATA\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd"
& $dsh plugin --profile desktop add link:C:/path/to/aitp-atlas
```

Then set the research root in the profile's `cordis.patch.yml` (an id-targeted patch replaces the
whole config, so restate every field you change):

```yaml
- id: aitp-atlas
  name: aitp-atlas
  config:
    root: //wsl.localhost/Ubuntu/home/you/research/topics
    excludePaths: []
    # web: false             # no requests to arXiv or INSPIRE
    # proxy: http://127.0.0.1:7890
    # stateDir: C:/Users/you/.aitp-atlas   # copies kept for review (this is the default)
    # theme: auto             # auto (DSH's appearance), day, night, or a name from `themes`
    # themes:                 # your own themes: a base theme and the tokens it changes
    #   sepia:
    #     base: day
    #     label: Sepia
    #     tokens: { sky-0: '#f4ecd8', panel: '#fbf6ea', ink-1: '#3b2f2f', link: '#8a4b14' }
```

The theme tokens are listed in `client/05-theme.js` (`sky-0`, `panel`, `ink-1`…`ink-3`, `link`, `gold`,
the `status-*` dots and the `*-rgb` tints); a value must be a color (`#hex`, `rgb()`, `hsl()`), or
`r, g, b` for an `-rgb` token. Anything else is ignored. The top bar's theme button walks Auto, Day,
Night and then your own themes, and remembers the choice per window.

`knowledge` defaults to the folder of the `index.md` that the root note links to, then
`../knowledge`; `library` defaults to `<knowledge>/library`. Agent teams need DSH's Agent Teams;
their roles and model tiers come from [Oh-My-BBFF](https://github.com/BB-84C/Oh-My-BBFF) Team.

## Develop

```sh
node build-client.mjs   # client.js from client/*.js
npm test                # reader, host, client, web, LaTeX and review tests (a real WSL build when TeX is there)
npm run test:dsh        # inside a throwaway DSH: headless, web with sign-in, the editor
```

`client/*.js` are concatenated, in file-name order, into one factory scope inside DSH's module
loader; they use React and `@deepseek-ai/dsh-client-ui-primitives` from the host. `vendor/pdfjs/`
holds PDF.js 6.3.289 (Apache-2.0, see its `LICENSE`), served by Atlas and loaded only when a PDF
opens; its text layer makes PDF text selectable.

## Limits

- SyncTeX needs the `synctex` program of the TeX installation that built the PDF; this computer's
  Windows TeX Live lacks it, so source↔PDF jumps use TeX Live in WSL. biber is not installed, so a
  biblatex/biber document builds with unresolved citations (BibTeX documents are fine).
- Review compares against the copies Atlas kept when it started the discussion: edits to notes
  outside that scope, or by discussions started elsewhere, are not listed.
- Search reads notes linked from topics, the knowledge index and the paper maps; text inside PDFs
  is searched only through their TeX sources' abstracts.
- The discussion index lives in this window's storage: clearing it leaves the sessions in DSH's
  list but no longer listed by topic.
- Branches are found by folder nesting; a branch kept elsewhere appears as its own topic.
- Tested in DSH's web profile with a stand-in model (teams included) and a real WSL TeX build; not
  yet seen in the desktop window itself.
