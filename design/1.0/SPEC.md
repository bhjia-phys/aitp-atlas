# Atlas 1.0 — product and interaction specification

Status: proposed, 2026-11-18. Read with [VISUAL.md](VISUAL.md) (how everything looks),
[TEAM.md](TEAM.md) (the research team) and the [mockups](mockups/atlas-1.0.html).
Each requirement has an ID; reviews cite them. "Must" is mandatory; "should" may yield to a
documented technical reason; "may" is optional.

## 0. Starting point

Atlas 0.9.2 (this repository's `main`): a DSH plugin with a shared-scope client (`client/*.js`,
concatenated by `build-client.mjs`), a host-side server (`index.js`, `lib/*.js`), tabs in two panes
(0.8), one embedded discussion at a time (the "companion"), a top bar with five places, a team
launcher that briefs a lead to hire Oh-My-BBFF seats, and a first-run workspace setup (0.9.1).
Everything below changes that; what is not mentioned keeps its current behavior.

## 1. Principles

- **P1 Conversation first.** The Desk opens on a composer. Places are context opened beside a
  conversation, not gates in front of it.
- **P2 Everything is a tab.** At most two panes; the pane strips are the only row of chrome.
- **P3 Content gets the screen.** Chrome is at most 40 px tall plus a 56 px rail, both collapsible;
  Focus removes all of it.
- **P4 Topics own knowledge.** Discussions and teams are *filed* to a topic; they can start unfiled
  and move. Filing is an index entry, never a copy of note content.
- **P5 AITP is the protocol.** Atlas adds no memory layer. Its registries are interface state in
  the state directory; research material lives in topic folders as AITP lays them out.
- **P6 Reviewable changes.** Every edit an AI makes to a note is reviewable edit by edit before it
  stands (the existing review panel).
- **P7 Native.** Teams use DSH's Agent Teams and AITP's parallel-work rules. No Oh-My-BBFF.
- **P8 A celestial atlas, harmonious by construction.** One idea in two moods — the observatory by
  night, the engraved chart by day (VISUAL §1). One focal element per screen, balanced by a calm
  information area; one primary action per region. Ornament carries data (where a question belongs,
  who is working, how work flows) and never appears in reading surfaces. Color carries meaning:
  accent = interactive or selected, gold = needs you, the nebula palette = topic or seat identity,
  status colors = state (always with a label).

## 2. Information architecture

### 2.1 Places (rail order)

| # | Place | Icon | Purpose | Replaces |
| --- | --- | --- | --- | --- |
| 1 | Desk | `desk` | Start anything; continue; what needs you; what is running | Universe as home |
| 2 | Discussions | `chat` | Every discussion: running, needs you, pinned, by topic, unfiled, resolved | Activity's lists, the companion |
| 3 | Teams | `team` | Native research teams and their Team rooms | Activity's teams, the BBFF launcher |
| 4 | Map | `universe` | The research universe chart, full-bleed | Universe |
| 5 | Library | `library` | Shelf, by topic, knowledge index, discover and add | unchanged |
| 6 | Learn | `learn` | Reading routes and concept maps | unchanged |
| 7 | Write | `writing` | LaTeX documents | unchanged |

Activity is retired; §12 says where each part goes. Search (`/`), New (`N`), the command palette,
the theme and the settings menu are actions on the rail, not places.

### 2.2 Tab kinds

| Kind | One tab per | Title | Closable | Preview-able |
| --- | --- | --- | --- | --- |
| `desk` | window (pinned first in the left pane) | Desk | no | no |
| `place` | place (discussions, teams, map, library, learn, write, search) | place name | yes | no |
| `topic` | topic note path | topic short title | yes | yes |
| `file` | file path | file label (0.8 `sideLabel`) | yes | yes |
| `paper` | URL | `arXiv 2401.01234v5` etc. | yes | yes |
| `preview` | LaTeX main file | `Preview · main.pdf` | yes | no |
| `discussion` | DSH session id | discussion title | yes | no |
| `team` | team id | team name | yes | no |
| `member` | member session id | `<seat> · <team name>` | yes | no |

- **TB-1** 0.8's single `page` tab that navigated between places is removed. Places and topics are
  tabs of their own; the Desk is the only tab that cannot close. Rail items open or activate their
  place tab. The 0.8 top-bar Back button is removed.
- **TB-2 Preview tabs.** A topic, file or paper opened with a plain click from a list or a link opens
  as a *preview tab* (label in italic). Each pane holds at most one preview tab; the next preview in
  that pane replaces it.
- **TB-3** A preview tab becomes permanent when its strip label is double-clicked, when it is
  edited, when a passage in it is asked about or kept, when it is dragged, or when it was opened
  with Ctrl/Cmd+click or a middle click (which open permanent tabs directly).
- **TB-4** Opening something that already has a tab activates that tab where it is and passes the
  new anchor (0.8 behavior).
- **TB-5** Closed tabs are kept in a per-window stack of 20; Ctrl+Shift+T reopens the last one.

### 2.3 Where things open

- **RT-1** Places open in the left pane, or activate where they already are.
- **RT-2** A topic, file or paper opened from a place tab (Desk, hubs, Map, Library, Learn, Write,
  Search) opens in the right pane, which is created if needed; the place stays visible.
- **RT-3** Opened from a topic, file or paper tab: in the other pane if two exist, otherwise the
  right pane is created.
- **RT-4** Opened from a discussion or member conversation: in the pane opposite it (0.8).
- **RT-5** Ctrl/Cmd+click opens in the same pane as a permanent tab; Shift+click opens in the other
  pane.
- **RT-6** A new discussion from the Desk opens in the Desk's pane, active. A discussion started
  from content (Ask bar, selection tools, a topic's Discuss) opens in the pane opposite that content.
- **RT-7** A Team room opens in the left pane; its member conversations open in the right pane.
- **RT-8** A LaTeX Preview opens opposite its source (0.8).

### 2.4 Persistence

| What | Where | Key |
| --- | --- | --- |
| Tabs and pane layout | per window, `localStorage` | `aitp-atlas:tabs.v2` |
| Rail state, theme mode, model choice, composer drafts | per window, `localStorage` | `aitp-atlas:prefs.v1` |
| Discussions registry | server state directory | `discussions.json` |
| Teams registry and observed team events | server state directory | `teams.json`, `teams/<id>.events.jsonl` |
| Team work (charter, reports, reviews, decisions, state) | the topic's run directory (§TEAM) | files |

Every `localStorage` read and write is wrapped in try/catch and the app renders correctly without it.

## 3. Shell

### 3.1 Frame

```
┌ DSH sidebar ┐┌Rail┐┌────────── left pane ───────────┬────────── right pane ──────────┐
│  (DSH's)    ││ 56 ││ strip 40: tabs …       [⤢][⋯] │ strip 40: tabs …       [⤢][⋯] │
│             ││    ││                                │                                │
│             ││    ││ tab content                    │ tab content                    │
└─────────────┘└────┘└────────────────────────────────┴────────────────────────────────┘
```

- **SH-1** There is no top bar. The 0.x brand, nav, filter box, Ask, search, add, theme and refresh
  controls leave the top; the only horizontal chrome is the pane strips (40 px).
- **SH-2** Rail: 56 px wide, `--bg`, right border 1 px `--border`, full height.
- **SH-3** Rail modes: *icons* (56 px, default), *labels* (208 px, icons plus names, set from the
  rail's More menu), *hidden* (0 px; Ctrl+\ toggles hidden ⇄ previous mode). Hidden leaves a 6 px
  hot edge at the left: hovering it 150 ms reveals the rail as an overlay (`--raised`, `--shadow-2`)
  that hides 300 ms after the pointer leaves. The mode is a per-window preference.
- **SH-4** Panes keep 0.8's model: any tab in either pane, drag to reorder, onto the other strip or
  body to move, onto the split zone to split; divider 20–80 %, double-click for 50/50; contents
  never remount when moved; hidden tabs use `content-visibility: hidden`.
- **SH-5** Toasts (the 0.x "flash"): bottom center of the panes area, 16 px above the bottom, max
  480 px wide, a pill on `--raised` with `--shadow-2`, 4 s, one at a time, `aria-live="polite"`. A toast may carry one
  action (for example Undo).
- **SH-6** Below 720 px of Atlas width, a second pane cannot be created; an existing right pane
  becomes tabs of the left pane (restored when the width returns).

### 3.2 Rail

Top to bottom:

1. **Atlas mark** (22 px glyph): opens the command palette. Tooltip "Commands · Ctrl+Shift+P".
2. **Work** group: Desk, Discussions, Teams.
3. A 4 px dot (`--border-strong`) with 10 px above and below.
4. **Knowledge** group: Map, Library, Learn, Write.
5. Flexible space.
6. **Actions**: Search (`/`), New (`N`; opens the 0.7 add-or-write panel), Theme (cycles Auto →
   Day → Night; icon shows the current mode), More (menu: Read the files again, Keyboard shortcuts,
   Show labels / Hide labels, Hide the rail, About Atlas with the version).

- **SH-7** Item: 40×40 px hit area, icon 20 px, 4 px between items. States in VISUAL §6.1. The
  active place shows `--selected` behind the icon, the icon in `--accent`, and a 7 px four-point star
  in `--accent` at the rail's left edge (VISUAL §5).
- **SH-8** Badges: Discussions shows unread replies (accent); Teams shows items needing you (gold).
  16 px min width, 10 px bold, placed at the item's top-right inside the hit area; hidden at zero;
  "99+" above 99.
- **SH-9** Tooltips after 400 ms: the name and its shortcut. Labels mode shows names instead.
- **SH-10** Alt+1 … Alt+7 open the places in rail order.

### 3.3 Pane strip and tabs

- **SH-11** Strip: 40 px, `--bg`, bottom border 1 px `--border`; tabs scroll horizontally (wheel
  scrolls them); the shown tab is kept in view (0.8).
- **SH-12** Tab (exact sizes in VISUAL §6.2): icon 16, label 13 px, max 220 px with ellipsis, a 20 px
  *status slot* at the right that shows, in order of priority: the close button on hover or when the
  tab is shown; else the twinkle for a working discussion, team or member; else an unsaved dot
  (`--text-2`); else nothing. The slot is always reserved, so tabs never jump.
- **SH-13** Tabs are pills (VISUAL §6.2). The shown tab is `--raised`; in the pane used last it is
  `--accent-soft` with its icon in `--accent`, so the active pane is always visible.
- **SH-14** Strip end tools (28 px icon buttons, 8 px from the edge): **Focus** (`⤢`, §4) and the
  pane menu `⋯`: Move tab to the other pane (Ctrl+Alt+←/→), Split (when one pane), Close other tabs,
  Close tabs to the right, Reopen closed tab, and for file and paper tabs "Copy path" / "Open in the
  browser". When tabs overflow, a chevron button before the tools lists the pane's tabs.
- **SH-15** Drag and drop keeps 0.8's behavior and markers.
- **SH-16** Middle click closes a tab; Ctrl+Tab / Ctrl+Shift+Tab cycle tabs in the pane used last
  (most-recent order while Ctrl is held is a *may*).

### 3.4 Command palette

- **SH-17** Ctrl+Shift+P or the Atlas mark. A scrim (`--overlay`) and a panel 640 px wide (max
  100 % − 32 px), 12 vh from the top, `--r-lg`, `--raised`, `--shadow-3`.
- **SH-18** Input row 52 px, 17 px text, search icon, placeholder "Type a command, a place, a topic
  or a discussion…". Results in groups with 11 px caps headers: Commands, Places, Topics,
  Discussions, Teams, Recent files. Row 36 px: icon, label, secondary text (`--text-3`), shortcut at
  the right.
- **SH-19** Matching: case-insensitive subsequence with bonuses for word starts and recency; at most
  6 per group and 30 in all. ↑/↓ move, Enter runs, Shift+Enter opens in the other pane, Esc closes.
  Prefixes narrow the groups: `>` commands, `#` topics, `@` discussions and teams.
- **SH-20** Commands: New discussion, New team, Search, Add a paper, New note, New LaTeX document,
  Focus pane, Full screen, Toggle the rail, Split, Move tab to the other pane, Reopen closed tab,
  Theme: Auto/Day/Night, Read the files again, Keyboard shortcuts.

### 3.5 Keyboard

DSH owns Ctrl+K and Ctrl+B (its sidebar) and its own composer keys. Atlas shortcuts apply only while
Atlas is the visible panel, and single-key shortcuts never fire while focus is in an input, a text
area, a contenteditable or DSH's conversation.

| Action | Keys | Alternative if DSH claims it |
| --- | --- | --- |
| Command palette | Ctrl+Shift+P | Ctrl+. |
| Search | `/` | — |
| Add or write | `N` | — |
| New discussion (Desk composer) | Ctrl+Shift+J | — |
| Ask about this (Ask bar) | Ctrl+J | — |
| Toggle rail | Ctrl+\ | Ctrl+Shift+\ |
| Focus pane | Ctrl+Shift+F | Ctrl+Alt+F |
| Full screen (while focused) | Shift+F11 | — |
| Exit focus | Esc | — |
| Next / previous tab | Ctrl+Tab / Ctrl+Shift+Tab | Ctrl+PageDown / Ctrl+PageUp |
| Close tab | Ctrl+W | Ctrl+Alt+W |
| Reopen closed tab | Ctrl+Shift+T | — |
| Move tab to other pane | Ctrl+Alt+← / → | — |
| Places | Alt+1 … Alt+7 | — |

- **SH-21** Before binding, check DSH's shortcut registry (`dsh-client-shortcuts`; the keyboard
  shortcuts list in DSH settings) and use the alternative when a key is taken. The More menu's
  Keyboard shortcuts dialog lists the effective bindings.

## 4. Focus and full screen

- **FC-1 Focus** (strip `⤢`, Ctrl+Shift+F, palette): the shown tab of the pane used last fills the
  whole Atlas area. The rail, both strips and the other pane are hidden (the other pane stays
  mounted). Content keeps its own rules (reading width, PDF fit).
- **FC-2** On entering Focus, if DSH's left sidebar is expanded, Atlas folds it with
  `ctx.layout.toggleSidebar()` and remembers that it did; on leaving Focus it unfolds it only if
  Atlas folded it. Read the state from the DOM (the sidebar column's width; expanded > 120 px).
  Without `ctx.layout`, skip silently.
- **FC-3 Focus header**: hidden by default. A 6 px zone at the top edge reveals it after 120 ms: a
  floating pill 38 px tall, centered, max 560 px, `--raised`, `--shadow-2`: tab icon and title,
  then **Full screen** and **Exit focus · Esc**. It hides 600 ms after the pointer leaves, and stays
  while a menu from it is open.
- **FC-4** Esc leaves Focus unless a menu, dialog or the palette is open (those close first), or the
  keyboard focus is in a text field or DSH's conversation (then use Ctrl+Shift+F).
- **FC-5 Full screen** (header button, Shift+F11, palette): `requestFullscreen()` on the Atlas root
  while in Focus, so the focused tab fills the monitor. Leaving full screen (the browser's Esc) keeps
  Focus. If the request is refused, show a toast "Full screen is not available here".
- **FC-6** Focus and full screen are not restored after a reload.
- **FC-7** A tab may also be focused from its own content: a PDF's toolbar and a discussion's header
  carry a Focus button (same action).

## 5. The Desk

### 5.1 Layout

```
            ANALYTIC CONTINUATION          TOPOLOGICAL INSULATORS          CRITICAL PHENOMENA
        ·  ✧   ·        ✧—✧             ✧—✧          ·         ✧              ·
      ✧ Worm algorithm ◉ ·.            RESEARCH PROGRAMME · TUESDAY 18 NOVEMBER     ✧—✧
    WORM ALGORITHM   ·.  ·.                    Good evening.                     METHODS
  ───────────────────────·.·.·┌──────────── composer on the horizon ───────────┐─────────────
                              │ Why does the worm algorithm's autocorrelation…  │
                              │ [⌀] [● Worm algorithm ▾] [GPT-6.2-Sol · High ▾] [Discuss│Team] (↑)│
                              └─────────────────────────────────────────────────┘
                          LIKELY TOPIC  (● Worm algorithm auto)  (● Critical exponents)
  ────────────────────────────────────────────────────────────────────────────────────────
   CONTINUE            All discussions │ NEEDS YOU three              All │ RUNNING two
   ✧ Why is the worm mixing … · · 2 min│ ● Window choice … · · [Decide]   │ ✧ Team · Padé … · · 4 of 9
   ● Padé window choice … · · · · 1 h  │ ● Run the 64³ lattice … [Answer] │ ✧ Why is the worm … replying
```

- **DK-1** Content column max 1120 px, centered, side padding 32 px (16 px under 640 px). From top:
  the **sky band** (VISUAL §6.7), the composer overlapping the horizon by 34 px, the routing chips
  14 px below it, and the **almanac** (VISUAL §6.8) 48 px below them.
- **DK-2** The sky band shows the research as a dome of stars: one sector per direction, one star per
  topic, constellation lines between parents and branches, the direction names along the dome. It is
  drawn by a pure layout function from the overview (deterministic: the same research draws the same
  sky). Hovering a star shows its card (title, direction, last activity, **Open**, **Discuss**);
  clicking opens the topic beside (RT-2). The kicker (root title and date, `--t-cap`) and the greeting
  ("Good morning / afternoon / evening.", `--t-display`) sit centered in the dome.
- **DK-3** No side column on the Desk, at any width. Under 900 px of pane width the sky band is 240
  tall and shows direction names only on hover.

### 5.2 Composer

- **DK-4** Anatomy and sizes in VISUAL §6.6. Max 720 px wide, centered. The text area grows from 3
  to 12 lines, then scrolls. Placeholder: "Ask, think out loud, or start a line of work…".
- **DK-5** It takes focus when the Desk is opened from the rail or with Ctrl+Shift+J, not when a
  window is restored with another tab active.
- **DK-6** Controls row, left to right: **Attach** (`+`: Add files…, Add a paper by link or ID,
  Include what is open in the other pane); **Topic** (§5.3); **Model** (a menu of DSH's model
  catalog, grouped by provider, with reasoning efforts; default: DSH's default model; remembered per
  window); **Mode** segmented: Discuss | Team. Right: the hint "Shift+Enter for a new line"
  (`--text-3`, hidden under 600 px) and **Send** (32 px round, accent).
- **DK-7** Enter sends; Shift+Enter inserts a line; an empty composer disables Send. While starting,
  Send shows a spinner and the text stays; on success the discussion opens (RT-6) and the composer
  clears; on failure a one-line error appears under the composer with Retry. The draft survives a
  reload (prefs).
- **DK-8** Team mode turns Send into **Set up team…**, which opens the team sheet (TEAM §7.3) with
  the text as the goal and the chosen topic.
- **DK-9** Attachments appear as chips inside the composer above the controls row (file name or
  paper label, ×); files are passed to the discussion as paths in the context block, papers as
  links; nothing is copied into the research.
- **DK-10 Starters**: while the composer is empty, up to four quiet chips under it: "What should I
  work on next?", "Continue the research", "Develop a new idea", and "Review what is waiting (N)"
  when N > 0. A click fills the composer and focuses it; it does not send.

### 5.3 Topic routing

- **DK-11** Topic menu: **Auto** (default), **No topic**, then the topic tree (searchable, direction
  dots, branches indented 16 px).
- **DK-12** In Auto, after 12 typed characters and 250 ms of rest, the client asks `GET /route`
  (§10) and shows up to three candidate chips under the composer, labelled "Likely topic". When the
  server marks the first candidate *confident*, its chip shows "auto" and is the one used on send;
  otherwise none is preselected and the discussion starts unfiled. Clicking a chip pins that topic
  (the Topic control shows it; "auto" disappears). In the sky band, the auto or pinned topic's star
  brightens and a light path flows from the horizon's center to it (VISUAL §6.7); candidates that are
  not chosen glow faintly. Routing becomes visible: the researcher sees where the question is going.
- **DK-13** The first message of an auto-filed or unfiled discussion carries, in the context block,
  the candidates and this line: "Atlas filed this under <topic> (or: left it unfiled). If another
  topic fits better, say so in your first sentence." The researcher moves it with one click (§6.5).

### 5.4 The almanac

- **DK-14** Three equal columns under a hairline — Continue, Needs you, Running — separated by
  vertical hairlines (VISUAL §6.8); two columns under 960 px of content width (Running drops under
  Continue), one under 640. Each shows at most five leader rows and a heading link to the full list.
  Empty states are one italic line, never an illustration.
- **DK-15 Continue**: the five most recently active open discussions and teams. Row: status mark
  (twinkle when working), title, dotted leader, italic relative time. Click opens (RT-6 rules for
  existing tabs).
- **DK-16 Needs you** (heading in gold): waiting Current work entries (0.5 `waitingItems`), open team
  decision requests, and discussions whose note edits await review. Row: gold dot, title, leader, one
  secondary button (**Decide**, **Answer** or **Review**). The heading link opens the Discussions place
  filtered to Needs you.
- **DK-17 Running**: discussions, team leads and members working now. Row: twinkle, title, leader,
  what it shows ("4 of 9" tasks for a team, "replying" for a discussion).
- **DK-18** There is no separate topics strip: the sky band is the topic overview, and the Map is one
  click away on the rail.
- **DK-19 First run**: while the workspace is not set up (0.9.1 `WorkspaceSetup`), the Desk shows
  the setup card in place of the cards, and the composer is disabled with one line saying why.

## 6. Discussions

### 6.1 Registry

- **DS-1** The server keeps `discussions.json` in the state directory (`stateDir`, default
  `~/.aitp-atlas`), written atomically (temporary file, then rename). Record:

```json
{
  "id": "<DSH session id>",
  "title": "Why is the worm mixing so slow?",
  "created": 1763452800000,
  "updated": 1763456400000,
  "status": "open",
  "pinned": false,
  "topic": { "id": "mc/worm", "path": "<abs>/topics/mc/worm/research.md", "title": "Worm algorithm" },
  "filing": "auto",
  "moves": [{ "at": 1763453000000, "from": null, "to": "mc/worm", "told": true }],
  "origin": "desk",
  "intent": "ask",
  "question": "…",
  "context": { "topic": null, "doc": null, "page": "", "section": "", "lines": "", "selection": "" },
  "model": { "provider": "openai-codex", "model": "gpt-6.2-sol", "effort": "high" },
  "teamId": null,
  "seenAt": 1763456400000
}
```

`topic` is null when unfiled; `filing` is `user`, `auto` or `none`; `origin` is `desk`, `ask`,
`selection`, `topic`, `decide`, `team` or `import`.

- **DS-2** The client creates the DSH session (0.4 `startThread`, extended with the model, §6.3),
  then posts the record. The DSH session list stays the source of truth for running state and for
  existence: a record whose session DSH no longer knows is hidden (0.5 `knownThread`).
- **DS-3** `updated` moves forward when the session's row reports a new turn (row update time, or
  a running → idle transition the client observes) and on registry edits.

### 6.2 The Discussions place

- **DS-4** Layout: a filter column 220 px (`--surface`, right border) and the list. Filters: All,
  Running, Needs you, Unread, Pinned, Unfiled, then each topic with a count (tree, collapsible), then
  Resolved, then "Other DSH sessions" (DSH's root sessions Atlas did not start; each can be
  *adopted*: filed into the registry with origin `import`).
- **DS-5** List header: a search field (title, question, topic), a sort menu (Recent activity,
  Created, Title), and a Select toggle for bulk actions (Move, Resolve, Pin).
- **DS-6** Row 58 px, two lines (VISUAL §6.9): (1) status mark (twinkle when working), title (14 px,
  600 when unread), unread dot, italic relative time at the right; (2) topic chip or "Unfiled", model name, the first 90 characters of the question
  (`--text-3`). Hover reveals Pin, Move, Resolve and `⋯` at the right; the row opens the discussion
  tab (RT-2 for a place).
- **DS-7** Empty states: "No discussions yet. Ask from the Desk, or select a passage and press
  Ctrl+J." / filtered: "Nothing here."

### 6.3 A discussion tab

- **DS-8** Header 48 px, sticky: status mark; title (serif, `--t-h3`; click to rename inline, Enter
  saves the registry and DSH's session title); topic chip (dashed outline while `filing` is `auto`;
  click opens Move, §6.5); model chip (opens the model menu; changes use
  `remote.session.selectModel` and apply to the next turn); at the right: **Add what is open beside**
  (icon), **Focus** (icon), and `⋯`: Move to a topic…, Pin, Rename, Open in DSH's chat, Continue in
  another workspace… (§6.8), Resolve or Reopen, Copy the session id. The title keeps at least
  140 px and truncates last; chips truncate first (max 200 px each); under 720 px of header width
  the model chip collapses to an icon button with the model in its tooltip.
- **DS-9** Marginalia under the header (context chips 24 px tall, 8 px padding; collapsible, collapsed
  after the first reply): the 0.4 chips of what the discussion was given; overflow shows "+N".
- **DS-10** Review banner when this discussion's note edits await review: one line on `--gold-soft`
  — "3 edits to notes await your review" and **Review**, which expands the existing review panel
  inline.
- **DS-11** The embedded DSH conversation fills the rest (0.4 slot recipe). Several discussion tabs
  may be mounted at once; each retains its own session reference and releases it when its tab
  closes. At most six conversations (discussions and members) stay mounted: beyond that, the least
  recently shown hidden one releases its session and shows "Reopening…" while it remounts when shown
  again. Clicks on links inside it open in Atlas (0.8 `conversationLink`, RT-4).
- **DS-12** Unread: when a discussion finishes a turn while its tab is not shown, it is unread until
  shown; unread shows an accent dot on its tab's status slot, its rows, and counts in the rail badge.
  Showing the tab sets `seenAt`.
- **DS-13** Resolve (0.4): archives the session in DSH and marks the record; it leaves open tabs
  open with a "Resolved" chip in the header and **Reopen**.

### 6.4 Routing service

- **DS-14** `GET /route?q=<text>&topic=<id?>` ranks topics for a text. Corpus per topic, with
  weights: title ×3, branch titles ×2, the opening's first paragraph ×2, Current work entry titles
  ×1.5, agreed-choice and keyword lines ×1, titles of knowledge entries it links ×0.5. Tokens:
  lower case, accents folded, stop words removed, a light English stemmer; LaTeX commands stripped,
  their arguments kept. Score: BM25 (k1 1.2, b 0.75) plus a recency bonus
  `0.15 × exp(−days since newest Current work / 30)`.
- **DS-15** Response: `{ candidates: [{ topic: { id, path, title, direction }, score, reasons }],
  confident }` with at most five candidates; `reasons` are the matched terms that contributed most.
  `confident` is true when the first score ≥ 2.0 and ≥ 1.6 × the second. Built from the in-memory
  atlas index; under 150 ms for 300 topics. The thresholds are tested on the fixture and may be tuned
  with a recorded reason.

### 6.5 Moving a discussion

- **DS-16** Move popover (from the topic chip, a row, the palette): 360 px, a search field, then
  "Unfiled", then the topic tree with direction dots (current topic checked), then a checkbox "Tell
  the AI" (on by default) and **Move**.
- **DS-17** Moving updates the registry (`filing: user`, a `moves` entry) and shows the toast
  "Moved to <topic>. Undo" for 6 s. When "Tell the AI" is on, Atlas queues this message to the
  session *after* the undo window closes: "Atlas: this discussion is now filed under “<title>”
  (<path>). Read that note before you continue; earlier turns may have assumed another topic." Undo
  restores the previous filing and sends nothing.
- **DS-18** Bulk move applies the same to each selected discussion, with one toast.

### 6.6 Asking from content

- **DS-19** The Ask bar (Ctrl+J) gains a target row: "Ask in" — **New discussion** or an existing
  discussion (menu of open discussion tabs, then recent ones). Default: the discussion shown in the
  other pane if there is one, else New discussion.
- **DS-20** Selection tools: **Ask** follows DS-19's default; **Add to discussion** appears when a
  discussion is shown in the other pane and drafts the passage into its input (0.4
  `draftIntoThread`). Both make a preview tab permanent (TB-3).

### 6.7 Starting from a topic

- **DS-21** A topic tab's header offers **Discuss** (a new discussion filed to that topic, opened
  beside it) and **Start a team** (the team sheet with the topic preset).

### 6.8 Continue in another workspace (M2 stretch)

- **DS-22** For work that belongs to another DSH workspace (for example a code repository), "Continue
  in another workspace…" lists DSH's workspaces, creates a session there whose first message is an
  AITP hand-off built from the registry record (question, topic note path, context pointers, the
  previous session id with an instruction to read it with DSH's session query tool), marks the old
  record `movedTo` with the new id, and opens the new session as a discussion tab. DSH sessions
  cannot change workspace in place; this is the honest equivalent.

## 7. The Map

- **MP-1** The Universe chart fills its tab (no side column). Overlays: top left, the root title
  and the four counts on one line (12 px, `--text-2`) on a translucent `--surface`; top right, the
  direction legend (collapsible); bottom left, zoom in, zoom out, reset.
- **MP-2** Hovering a star shows a card (raised, 280 px): title, direction, last Current work date,
  status counts, **Open** and **Discuss**. A click opens the topic beside (RT-2).
- **MP-3** The Map uses the same sky language as the Desk's band (VISUAL §6.7) at full size: the same
  sectors, star sizes, constellation lines, labels and nebula palette, so the Desk's dome reads as a
  small window onto the Map.

## 8. Other surfaces

- **OS-1** Topic, documents, Library, Learn, Write, Search, review and the add-or-write panel keep
  their behavior and adopt VISUAL's tokens and components in M1 (no new features there).
- **OS-2** A topic's side column becomes sticky with collapsible sections; each shows at most five
  items and "Show all (N)". Its discussions section lists this topic's discussions from the registry.
- **OS-3** PDF toolbar: 36 px, compact: page n / N, zoom −/+, fit, Focus.
- **OS-4** Reading surfaces use the reading type (VISUAL §3) with a 72 ch measure.

## 9. Teams

Specified in [TEAM.md](TEAM.md): the Teams place, the team sheet, the Team room, member tabs, the
run directory and the protocol.

## 10. Server API (new or changed)

All under the plugin's existing API base and auth. JSON in and out; errors as `{ error: { code,
message } }` with the right status.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `discussions` | `?status=open|resolved|all&topic=<id>|unfiled&q=` → `{ discussions }`, newest activity first |
| POST | `discussions` | create a record `{ id, … }` (idempotent by id) |
| PATCH | `discussions/<id>` | `title`, `pinned`, `status`, `seenAt`, `topic` (a move: `{ to, told }`), `model`, `movedTo` |
| POST | `discussions/import` | `{ records }` from 0.x `localStorage`; idempotent; returns counts |
| GET | `route` | `?q=&topic=` → candidates (§6.4) |
| GET | `needs` | Needs-you items: waiting entries, team decisions, discussions with pending edits (cached 30 s) |
| … | `teams…` | TEAM §9 |

## 11. Migration from 0.9

- **MG-1** On first load, if the registry is empty and `localStorage` holds 0.x `threads`, the client
  posts them to `discussions/import` (discussions become records; `kind: 'team'` records become
  legacy teams, TEAM §10) and sets `aitp-atlas:threads-imported`. The old keys stay one release.
- **MG-2** `tabs` (0.8) → `tabs.v2`: the `page` tab becomes the Desk plus, when its saved route was
  not home, a tab for that route (a place, topic or file); the `discussion` tab becomes
  `discussion:<id>` for the companion's session; file, paper and preview tabs keep their ids.
- **MG-3** `companion` and `companion-last` are read once for MG-2, then ignored.

## 12. Retiring Activity

| 0.x Activity part | 1.0 home |
| --- | --- |
| Waiting on you, Decide | Desk "Needs you"; Discussions "Needs you" filter (Decide buttons kept) |
| Running sessions by topic | Discussions "Running" filter, grouped by topic; Desk "Running" |
| Agent teams with members | Teams place; Team rooms |
| DSH's other sessions | Discussions "Other DSH sessions" (adoptable) |
| Start a team (BBFF) | Team sheet (native) |

## 13. Quality bars

- **QB-1 Accessibility**: `tablist`/`tab`/`tabpanel` roles with `aria-selected` and keyboard
  movement; menus with `menu`/`menuitem`; dialogs trap focus and return it; every icon-only button
  has a label; text contrast ≥ 4.5:1 and control boundaries ≥ 3:1 (VISUAL tokens are checked); status
  never by color alone; `prefers-reduced-motion` removes motion.
- **QB-2 Performance**: switching tabs never remounts (target < 50 ms); the Desk paints from cached
  data within 300 ms of the overview; route suggestions within 150 ms; a hidden tab costs no layout
  (`content-visibility`).
- **QB-3 Resilience**: missing DSH services (sessions, layout, Agent Teams, model selection) degrade
  with a one-line explanation where the feature would be, never a crash; every view sits in the
  existing error boundary.

## 14. Not in 1.0

Syncing tabs between windows; moving a DSH session between workspaces in place (§6.8 is the
substitute); a theme editor (themes stay in the config); layouts below 640 px beyond stacking;
voice input; scheduling.
