# AITP is the memory; Atlas is the workspace

> Historical design for Atlas 0.x. References below to Activity and the BBFF team runner are not current functionality or permission guarantees. For the current workbench, use the [user guide](docs/guide.md); for the redesign record, see the [1.0 plan](design/1.0/PLAN.md). This historical document is not in the installable package.

## The story

A research idea becomes a result through one continuous loop: an idea is discussed and
sharpened, derivations are worked through until they are clear, calculations and proofs are
delegated and then inspected, what holds is written up, and what was learned is kept so the next
step starts from it. AITP carries the memory of that loop and the judgment of how to work in it:
the root `research.md` with its directions, a living note for every topic and branch (its opening
states the question and the current answer at its true strength; Current work holds each live
thread's next step), the knowledge collection and the papers library, and Skills for learning,
brainstorming, research, verification, writing and distillation.

DeepSeek Harness runs the AI sessions in which that work happens. Atlas is the researcher's side
of the same loop inside DSH: where the whole research is seen at once, where any note, paper,
manuscript or figure is read and written, and where any page or passage is discussed with the AI
beside it, without leaving it. It adds no second memory: everything it shows is read from the
files when it is shown.

## Principles

- **One source of truth.** Atlas stores no research. Its views are drawn from the files on each
  read, and it writes only on the researcher's action: a save (refused when the file changed since
  it was opened), an added paper or lecture, a kept passage, a citation, a reverted edit, the saved
  searches. Beside the view's own state, Atlas keeps an index of which discussion is about what
  and, for review, copies of the notes a discussion started with, in its own state folder; the
  discussions themselves are DSH sessions.
- **AITP's conventions, not new ones.** Directions, topics, Current work, contents and the
  knowledge index come from structures AITP already defines; no fields, schemas or generated
  files.
- **Everything inside DSH.** Documents open in Atlas, not in other applications; the system app
  remains a secondary action for what Atlas cannot show.
- **The AI gets pointers, not a second memory.** Guidance lives in one place, AITP's Skills. A
  discussion opens with an `Atlas context` block naming the note, section, lines, page or quoted
  passage, and the Skills take over from the note itself; Atlas adds no tools, prompt sections or
  injected memory.
- **Clarity before decoration.** The universe is a chart with a method: one validated color per
  direction in the root's order (the dark categorical palette, checked for color-vision
  deficiencies against the night background), brightness for recency, rings for depth, labels
  only where they fit, details on hover and focus, and the same research as a list below it.

## The places

| Place | Shows | Discusses with the AI |
| --- | --- | --- |
| Universe | Directions as sectors, topics and branches as stars, cross-direction links, recent activity, the latest discussions, topic cards, the root's other sections | What next, continue, a new idea, a topic to learn, the week's review |
| Topic | What the root says, opening, Current work timeline, account, discussions, branches, contents by kind, who links here | Continue, explain, brainstorm, derive, implement, verify, write up |
| Document | Notes, PDFs, LaTeX, code, tables, notebooks, figures, video, folders; editor with preview | Discuss, explain, check, continue; the page in view; any selected passage or lines |
| Activity | What waits on the researcher; discussions, teams and sessions by topic | Discuss a waiting decision, decide among its options, start a team |
| Library | Shelf, by topic, knowledge index; Discover and add | Ask about a new paper; papers for the open questions |
| Learn | A topic's question, reading route, concept map | Explain at my level, check my understanding |
| Write | LaTeX with its PDF in a Preview tab, problems, SyncTeX, citations | (through the documents it builds) |
| Search | Notes, knowledge entries and papers holding every word | (through what it opens) |

## Discussing in place

Asking should not move the researcher away from what prompted the question. A discussion is
therefore a real DSH session shown in a tab beside what it is about, not a chat Atlas imitates:

- **Real sessions.** Atlas creates the session in the research root's workspace, names it
  `Atlas · topic · question`, and sends the context block with the question. Tools, approvals,
  models, the transcript and AITP's review across sessions all work as in any session, and
  *Open in chat* continues it in DSH's full view.
- **DSH's own conversation, embedded.** Atlas's main view declares a session-scoped child slot and
  renders DSH's conversation in its embedded form inside it, the way DSH's own subagent pane does;
  Atlas draws only the frame: the labels of what was given, *Add what I'm viewing*, *Resolve*.
- **Context is pointed to, and shown.** Every view publishes what it shows (topic, document, PDF
  page); a selection adds the section it sits in (a Current work entry, an account section, a
  heading, a LaTeX `\section`) and its lines. The same pointers become the labels the researcher
  sees and the block the AI reads, so there is nothing hidden between them.
- **Discussions belong to topics.** Each topic lists its discussions; *Resolve* archives the
  session in DSH, so DSH's list holds only live work while the topic keeps the record of what was
  asked. What a discussion settles is recorded where AITP says it belongs, by the Skills, not by
  Atlas.

## Bringing material in

A paper enters the way the knowledge collection already keeps one, so nothing downstream needs to
know Atlas: the exact edition's PDF and TeX source under `library/arxiv/<id>v<n>/`, each with a
provenance record (URL, date, size, SHA-256), and a paper map from the collection's own template,
with what reading must supply left to the reader. A lookup reads metadata only, so the researcher
sees what a paper is, who cites it and whether the notes already use it before anything is
downloaded. Lectures become source notes with their official link; moments are time-stamped links,
and a transcript is what the researcher supplies, since a recording Atlas cannot play cannot be
read. arXiv and INSPIRE are asked only about what the researcher looks up or saves as a search,
through the researcher's proxy, and `web: false` stops it.

## Teams and review

A team is a DSH session with Agent Teams on, staffed through Oh-My-BBFF's roles, because DSH and
BBFF already enforce what each member may do and which model it uses; Atlas only writes the lead's
brief from the thread it started from, and lists the members under their lead. The brief carries
AITP's rule for parallel work: one integrator, the lead, proposes note edits after an independent
check, and members report into the team's run directory.

What any discussion changes in the notes is reviewed edit by edit, beside the discussion. Atlas
compares the notes with the copies it kept when it started the discussion, names each edit by its
section and paragraph, and reverts only where the note still shows that edit, so a revert can never
undo later work. Keep moves the copy forward. The copies are review state, not memory: they live
outside the research and are dropped when the discussion is resolved.

## How the universe is drawn

- **Directions** are the root's `##` sections in order, except those the backbone keeps beside
  them (connections, seeds, agreed choices, standing agreements, Current work). Every direction
  keeps its sector and color, even one no topic serves yet: removing it would place colors next to
  each other that some readers cannot tell apart.
- **Topics** are the `research.md` files that links reach from the root, plus those a folder scan
  finds. Each appears once: in the first direction whose section links it, under its parent when
  the parent is in the same direction, or among the topics beyond the directions.
- **Rings** are depth: topics, branches, sub-branches. Sector widths follow how many leaves each
  direction holds.
- **Brightness** is the date of the newest Current work entry: the last week, month or quarter.
- **Links** across directions are drawn faintly; those of the star in focus light up.

## Lessons from "The components of agent memory", and where AITP has them

| The article found | In AITP |
| --- | --- |
| A small memory that keeps what the environment cannot tell beats an exhaustive one | "No durable change means no write"; each result has one home |
| A dashboard holding the goal and next steps, rewritten as work proceeds | The root note, each opening and Current work, which Atlas puts first |
| Good rules carry how they were verified and mark what is unconfirmed | The answer at its true strength, linked evidence, provisional and confirmed labels |
| Tell the model what memory is for, not how to use it | The memory Skill opens with its purpose |
| A wiki with search beats either alone | The knowledge index, browsed with the host's search and Atlas's filter |
| One writer per page | One owner per fact; the editor refuses to overwrite another writer's change |
| Dreaming checks memory against transcripts | AITP's independent review, at natural pauses or across a period on request |

## History

Atlas 0.1 built a second memory beside AITP (cards, a generated index, records, agent tools, a
guard, a dreaming engine) and was retired: AITP's README rules out those layers. Atlas 0.2 was a
read-only display. Atlas 0.3 made it a workspace: the universe, topics with sorted contents,
documents read and edited inside DSH, the library, and hand-offs that opened new sessions. Atlas
0.4 replaces those hand-offs with discussions in place, as described above. Atlas 0.4.1 makes a
note's links work inside it: DSH's renderer shows a relative link as plain text and an image as its
alt text unless the host supplies file handling, so Atlas now supplies it (keeping each link's
section), draws standalone figures, and opens a linked section where it is. Atlas 0.5 makes it a
place to learn, explore and research end to end: Activity (what waits on the researcher, what is
running, agent teams with Oh-My-BBFF), Discover and add (arXiv, INSPIRE, lectures, files), reading
with selectable PDF text and page links, LaTeX built beside its PDF with SyncTeX and citations,
review of what a discussion changed, Search and Learn. This repository starts at 0.5; the earlier
versions are described here, not kept in its history.

## 0.6 (2026-11-17): beside the page, day and night

**Files open beside the page.** Opening a note or a PDF used to replace the page, so following a
reference lost the place it came from. Now every file opens in a side panel and the page stays; topics
and the other places still fill the page, because they are where one works rather than what one
consults. One rule decides (`paneFor`): another view, a place, or *Open as the page* fills the page; a
section of the document already open stays in its pane, as does a jump inside a LaTeX workspace
(SyncTeX, a problem line); links inside documents and every other file open beside. DSH's own right
sidebar was considered and set aside: it belongs to a chat session, and its preview has none of Atlas's
reading (links opening notes at a section or PDFs at a page, passages asked about or kept in a paper
map, reading notes).

What used to be single now belongs to a pane: the focus a discussion is told about (with what is open
in the other pane, as *Open beside it*), unsaved edits, the paper map *Keep in note* writes to, and a
topic's section ids. With a discussion open too, the three stand side by side while the page keeps at
least 420 px (`sideLayout`); below that the file and the discussion become two tabs that keep their
state, laid out over the same column so DSH's conversation is never remounted.

**Day and night.** Every color is a token (`client/05-theme.js`); the stylesheet has no literal colors
but paper white and video black. Night keeps the observatory's exact values; day is a light sky with
dark ink, the direction colors are the validated light steps of the same categorical palette (four sit
below 3:1 on the light surface, so a direction is always named beside its color), and the status steps
are the same in both. Auto follows DSH's appearance, which DSH's presenter marks as
`body[data-ds-dark-theme]` and `html { color-scheme }`. The config can name the default (`theme`) and
add themes (`themes`), each a base theme with token overrides; the client keeps only known tokens with
color values, so a config cannot inject CSS.

**Papers beside the page.** A note's link to a paper (arXiv, a DOI, an INSPIRE record) used to leave
DSH for a browser. It now opens beside the page as the paper: its metadata and, for arXiv, its PDF,
fetched through Atlas and its proxy on the click and kept in memory only (`web/pdf`; the last four).
A paper the library has opens as the library's copy. *Add to the library* asks for the topic the paper
is for, preset to the topic being read; the library stays one shelf by edition (`arxiv/<id>v<n>/`), so
"filing" a paper means its paper map's "Why I'm reading it" line names the topic, and *By topic* counts
that link beside the topics whose notes cite the paper. No folder per subject: a paper serves several
topics, and the citation and the reading note are where that is said.

## 0.7 (2026-11-17): writing and adding from anywhere

Adding a paper meant going to the Library's *Discover and add*; a note was started from its topic's
page; and LaTeX had no place of its own. Now the `+` button (or N) opens a small panel over whatever is
on screen, for a paper (looked up, then added for a topic, or read first beside the page), a note, or a
LaTeX document. Each starts with the topic in view, so recording something while reading takes a title
and Enter. A note opens beside the page in the editor; a document opens as the page, where its PDF fits.

The **Write** page lists the LaTeX documents the topic notes link, by topic and newest first, with their
build state. It reads what the notes link, not the whole tree: a research tree also holds unpacked arXiv
sources, standalone figures and old versions (a census of one tree found about 500 files declaring a
document class), and the notes say which documents matter. A linked section stands for its document
(`mainFileOf`); a standalone figure is not a document.

## 0.8 (2026-11-17): tabs in two panes

The 0.6 side panel had fixed places: the page on the left, a file and the discussion on the right,
side by side or as two tabs. Now every view is a tab, and two panes hold the tabs: drag a tab to
reorder it, onto the other pane to move it, or to the edge to split; drag the divider to resize. One
rule still decides where an opened thing lands (`routeFor`): another view, a place or *Open as the
page* fills the page tab; a section of the document a tab shows stays in that tab, as does a jump
inside a LaTeX workspace; every other file or paper gets a tab of its own (the one it already has, if
open) in the pane that shows files, and from the discussion, in the pane opposite it. All tab bodies
are drawn in one layer and only positioned per pane, so a move never remounts one: a discussion, a
PDF's place and an unsaved edit survive it, and a hidden tab keeps its scroll
(`content-visibility: hidden`). The layout is kept per window; the 0.7 side panel's file comes back as
a tab on the right.

What belonged to the two panes now belongs to a tab: the focus a view publishes, unsaved edits, a
topic's section ids. The ask bar reads the tab used last; the discussion is about what the other pane
shows, and the tab there is what it is told is open beside.

**The compiled PDF is a Preview tab.** The PDF used to share the LaTeX workspace with the source,
squeezed into half of one pane. It is now a tab labelled *Preview*, opened in the pane opposite the
source when the document opens with a PDF, after each build, and on a jump to it; a build reloads it
at the page it showed. The workspace publishes each document's PDF, build time and SyncTeX mark, and
registers what a Ctrl+click in the Preview asks of it (the source line). Outline, Problems and Cite
are a panel beside the source, closed until asked for, so the source has the pane.

**Links in the discussion open in Atlas.** DSH draws a file the AI names as a button and opens it in
its own right sidebar, which belongs to a chat session; inside Atlas there is none, and DSH reported
"no session surface is mounted". Atlas now takes those clicks first: a file opens in a tab beside the
discussion (`path:line` at its line, a relative path inside the research, a Linux path inside the WSL
the research lives in), a paper in a paper tab, any other site in the browser. *Add to discussion*
falls back to the clipboard again: a callback named `navigator` had hidden the browser's.
