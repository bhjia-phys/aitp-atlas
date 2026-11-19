# Atlas 1.0 — implementation plan

Status: proposed, 2026-11-18. Four milestones, each ending at a review gate. Requirement IDs refer
to SPEC.md, VISUAL.md and TEAM.md.

## How the work runs

- **Where**: `F:\AI_Workspace\_aitp-atlas-next`, one local branch per milestone —
  `redesign/m1-shell`, `redesign/m2-discussions`, `redesign/m3-team`, `redesign/m4-polish` — each
  cut from the previous milestone's reviewed tip (M1 from `main`).
- **Commits**: one local commit per task (`M1.4 Rail`). No push, no merge into `main`, no install,
  no changes outside the repository (never `F:\AI_Workspace\aitp-atlas`, never the DSH profile).
- **Versions**: M1 → 0.10.0, M2 → 0.11.0, M3 → 0.12.0, M4 → 1.0.0, set in the milestone's last commit.
- **Tests**: `npm test` and `npm run test:dsh` pass at every commit; each task lists the tests it adds.
- **Review gate** at the end of each milestone: the implementer writes
  `design/1.0/reports/M<n>.md` (each requirement ID: done / changed with the reason / not done; tests
  added; known gaps) and stops. Claude reviews the code and the running preview against the spec and
  the mockups and returns findings; the implementer fixes them; the researcher tries it; Atlas is
  installed only after the researcher says DSH is closed.

## M0 — Preview harness (before M1)

| # | Task | Files | Done when |
| --- | --- | --- | --- |
| 0.1 | `scripts/preview.mjs`: materialize the test fixture (`test/fixture.mjs`) into a temporary folder (or use `ATLAS_PREVIEW_ROOT`), start a throwaway DSH web profile with the dev plugin the way `test/dsh-e2e.mjs` does, with a mock model that streams a short reply containing one Markdown file link and one arXiv link, and print the launch URL | `scripts/preview.mjs`, `package.json` (`"preview"`) | `npm run preview` prints a URL that opens Atlas on the fixture; it never reads the researcher's real research |

## M1 — Shell and visual system (0.10.0)

| # | Task | Requirements | Files |
| --- | --- | --- | --- |
| 1.1 | Color tokens for both moods (observatory and engraved chart), including the nebula palette `--n1…--n8`, sky tokens and the light table; apply the 0.9 → 1.0 mapping everywhere (styles and inline styles); DSH bridge variables; delete the 0.9 names | VISUAL §2 | `client/05-theme.js`, `client/80-styles.js`, all `client/*.js` |
| 1.2 | Type: vendor Source Serif 4 (OFL; variable roman and italic `woff2` with `OFL.txt` under `vendor/fonts/`, `@font-face` with `font-display: swap`) and the type tokens; space, radius, motion (twinkle, flow) and z tokens; replace literal values that map to them | VISUAL §3–5 | `vendor/fonts/`, `client/05-theme.js`, `client/80-styles.js` |
| 1.3 | Component primitives: Button, IconButton (label required), chips, Input, Select, Checkbox, Toggle, Segmented, Menu (roles and arrow keys), Popover (anchor, flip), Dialog (focus trap and return), Tooltip, Kbd, Banner, EmptyState, Skeleton, StatusDot, SeatGlyph, Toast (replaces Flash) | VISUAL §6 | `client/10-ui.js` |
| 1.4 | The rail: groups, badges, tooltips, modes (icons, labels, hidden with hot edge), Alt+1…7 | SH-2, SH-3, SH-7…10 | new `client/71-rail.js` |
| 1.5 | Tabs v2: Desk, place and topic tabs; preview tabs; reopen closed; strip visuals and tools; pane menu; overflow list; routing rules; 0.8 layout migration | TB-1…5, RT-1…8, SH-11…16, MG-2 | new `client/72-tabs.js`; `client/70-shell.js` keeps composition only |
| 1.6 | Remove the top bar; global actions on the rail; toasts | SH-1, SH-5 | `client/70-shell.js` |
| 1.7 | Focus and full screen, folding DSH's sidebar through `ctx.layout` | FC-1…7 | new `client/73-focus.js`, `client/90-register.js` |
| 1.8 | Command palette; keyboard map with DSH conflict check; shortcuts dialog | SH-17…21 | new `client/74-palette.js` |
| 1.9 | The Map: full-bleed chart, overlays, hover card, no side column | MP-1…3 | `client/20-universe.js` |
| 1.10 | The Desk: the sky band from a pure layout function over the overview (sectors, stars, constellation lines, labels, the greeting box kept clear), the composer on the horizon wired to today's discussion start (topic picker without Auto routing; Team mode hidden until M3), and the almanac from today's data | DK-1…10, DK-14…18, VISUAL §6.6–6.8 | new `client/21-desk.js`, new `client/22-sky.js` |
| 1.11 | Restyle the topic page, documents, PDF toolbar, Library, Learn, Write, Search, review panel, add-or-write panel and setup card with tokens and components only | OS-1…4 | existing views |

Tests added: the nebula palette (exact hex values per mood, and the validator's checks — lightness band, chroma floor, adjacent CVD ΔE ≥ 8, normal ΔE ≥ 15, contrast ≥ 3 — recomputed in the test); the sky layout (deterministic for the same overview, sector angles proportional to topic counts, every star inside its sector and outside the greeting box, labels not overlapping); token coverage (both themes define the same tokens; every `var(--x)` used is defined;
no hex literal outside the theme module and the Map block); tab model (preview replacement and
promotion, reopen-closed stack, routing table RT-1…8 as a pure function, 0.8 → v2 migration);
palette matching (ranking and prefixes); focus state machine (enter, sidebar fold only when expanded,
restore only what Atlas folded, Esc rules); unique top-level names (existing).

M1 is accepted when:

- [ ] No top bar; one 40 px strip per pane; the rail at 56 / 208 / hidden with the hot edge.
- [ ] Desk (sky band, composer on the horizon, almanac), workspace split, Focus and palette match the
      mockups at 1440×900 in both moods; Source Serif 4 loads from the vendored files offline
      (Claude's visual review: spacing, type sizes, colors, states).
- [ ] Focus hides all Atlas chrome, folds DSH's sidebar when it was open, and restores it on exit.
- [ ] Every action in SPEC §3.5 works from the keyboard (or its documented alternative).
- [ ] 0.8 behavior intact: drag and drop, preview of LaTeX, conversation links, unsaved-edit prompts.
- [ ] `npm test` and `npm run test:dsh` pass; no console errors on any screen of the preview.

## M2 — Desk and discussions (0.11.0)

| # | Task | Requirements | Files |
| --- | --- | --- | --- |
| 2.1 | Discussions registry with atomic writes; routes | DS-1…3, SPEC §10 | new `lib/discussions.js`, `lib/routes.js` |
| 2.2 | Import from 0.x storage | MG-1, MG-3 | `client/61-discussions.js` |
| 2.3 | Routing service and route | DS-14, DS-15 | new `lib/route.js`, `lib/routes.js` |
| 2.4 | The Desk completed: Auto routing chips, the routed star and its light path in the sky band, model menu from DSH's catalog, starters, the almanac from the registry and `needs` | DK-4…19 | `client/21-desk.js`, `client/22-sky.js` |
| 2.5 | Discussion tabs: any number mounted (cap in DS-11), header, rename, model change, unread and running, resolve and reopen; remove the single companion | DS-8…13 | new `client/61-discussions.js`, `client/60-threads.js` |
| 2.6 | Moving, with the delayed note and Undo; bulk move | DS-16…18 | `client/61-discussions.js` |
| 2.7 | The Discussions place, including adopting DSH's other sessions | DS-4…7 | `client/61-discussions.js` |
| 2.8 | Ask bar and selection tools targeting; Discuss from a topic | DS-19…21 | `client/60-threads.js`, `client/30-topic.js` |
| 2.9 | `needs` route; retire Activity | SPEC §10, §12 | `lib/routes.js`, remove `client/65-activity.js` parts as they move |
| 2.10 | Stretch: continue in another workspace | DS-22 | `client/61-discussions.js` |

Tests added: registry (create, patch, move with history, import idempotence, atomic write survives a
crash between write and rename, unknown session hidden); routing (on the fixture: six queries with
their expected first topic, the confident flag true and false cases, 300 synthetic topics under
150 ms); move (Undo inside the window sends nothing; after it, one message); migration from a saved
0.9 storage snapshot.

M2 is accepted when:

- [ ] Two discussions stream at once in two tabs; switching between them never remounts either.
- [ ] Typing on the Desk shows routing chips within 400 ms; Auto files confidently-routed
      discussions and leaves the rest unfiled; the first message carries DK-13's line.
- [ ] Moving shows Undo; the AI receives the move note only after the Undo window.
- [ ] A 0.9 window's discussions appear in the registry after the first load.
- [ ] Activity is gone and nothing it showed is lost (SPEC §12).

## M3 — The native research team (0.12.0)

| # | Task | Requirements | Files |
| --- | --- | --- | --- |
| 3.1 | Team templates shipped in the package; rendering of the lead brief, seat calls and charter | TEAM §4, team-templates/ | new `templates/team/…`, `lib/teams.js` |
| 3.2 | Teams registry; run-directory scaffold; artifact parser for the restricted YAML front matter (scalars, lists, one-level and inline maps; no new dependency); events log; decision answers; routes | TM-9, TM-10, TM-16, TM-25…27, TEAM §9 | new `lib/teams.js`, `lib/routes.js` |
| 3.3 | The team dialog ("Assemble a team"): the form, the crew column with its live mini constellation, templates, seat cards, validation, DSH's model catalog | TEAM §7.3, TM-7, TM-8 | new `client/66-teams.js` |
| 3.4 | Start sequence and seat verification; capability checks | TM-11…14 | `client/66-teams.js` |
| 3.5 | The Team room: the constellation band (constellation layout function, progress rings, twinkles, light paths, seat cards, hidden seat list) with the mission; the Flow pipeline, Board and Timeline; the logbook; the team composer with `@name`; member tabs | TM-19…24, TEAM §7.4, VISUAL §6.10–6.12 | `client/66-teams.js`, new `client/67-constellation.js` |
| 3.6 | The Teams place; Desk and rail integration | TEAM §7.1, DK-16, DK-17, SH-8 | `client/66-teams.js`, `client/21-desk.js` |
| 3.7 | Remove the Oh-My-BBFF launcher; import legacy teams read-only | TEAM §10 | `client/65-activity.js` (deleted), `client/66-teams.js` |

Tests added: the constellation layout (lead centered; members evenly on the ellipse from 200°; progress ring fractions; light paths chosen by the rules in VISUAL §6.10, at most six); brief and seat-call rendering (exact text for a three-seat template, route fields only
when a model is chosen, name validation); front matter parser (every example in
`team-templates/roles/README.md`, malformed files reported as unformatted); pipeline derivation
(rows from a fixture board plus fixture reports and reviews, including a report without a task and a
review task without a review file); decision answer (file appended, status flipped, message text);
`@seat` routing; no Oh-My-BBFF names left outside the legacy reader.

M3 is accepted when:

Implementation evidence is in the [M3 review report](reports/M3.md); these are implementer checks, not design-lead sign-off.

- [x] A real fixture-only DSH lead has Agent Teams enabled. Both named children received the rendered task and successfully read their generated role cards; the run directory and canonical topic baseline exist.
- [x] A fixture run directory and native board feed the Flow, Board and Timeline views. A real `task-1` is joined to its report and review on one observed Flow row.
- [x] Answering a decision writes the file once and messages the lead; `@numerics` reaches only that member and an unknown seat receives nothing.
- [x] The Team room was compared at 1440×900 in both moods, with the sole host sidebar. Logbook and stacked mission were exercised at actual room widths on both sides of 1040 and 760 px.

## M4 — Polish and documentation (1.0.0)

| # | Task | Requirements |
| --- | --- | --- |
| 4.1 | Accessibility pass: roles, focus order, a keyboard-only walk through every screen, reduced motion, a contrast check over the tokens | QB-1 |
| 4.2 | Performance pass: tab switch, Desk paint, route latency, many mounted conversations | QB-2 |
| 4.3 | Resilience pass: run with DSH services missing (no layout, no Agent Teams, no model selection) | QB-3 |
| 4.4 | README and `docs/guide.md` for 1.0; screenshots from the fixture only, both themes | — |

[Candidate review: implementation evidence and exceptions](reports/M4.md). The 150 ms routing bar is measured from request dispatch separately from DK-12's 250 ms debounce; it is **not met** if measured from the last keystroke. This is the local release-candidate gate, not approval to publish or install into the daily profile.

## Definition of done (every task)

Requirement IDs implemented as written, or the deviation and its reason recorded in the milestone
report; only tokens for color, type, space, radius, shadow and motion; tests added and green; no
console errors in the preview; unique top-level names across client modules; nothing from the
researcher's real research in code, tests, fixtures or screenshots.

## Implementation review notes (2026-11-18)

- M0: isolate the DSH home, research, knowledge/library, browser storage and Atlas `stateDir`. A preview must never read the ordinary `~/.aitp-atlas` review or registry, nor run a real model. Exercise mock Markdown and arXiv links in the isolated installation.
- M2 navigation amendment (accepted after reviewing M1): DSH owns the only persistent left sidebar. Use one labeled, non-tab `Atlas ▾` button in the existing first strip, including in split view; measure against the same fixture, theme, scroll position and host state. Updated SH-2/3/7…10 and VISUAL §6.1 supersede the mockup rail. [Matched evidence](reports/nav/measurements.md).
- M2: one DSH route owner per path (dispatch by method, with explicit subpath handling if needed); all mutating methods must receive the existing authentication and same-origin/JSON checks. Test the actual registration, not just a map that silently replaces duplicates.
- M2/M3: import legacy entries by session ID from each source, even into a nonempty registry. Acknowledge discussion and legacy-team import separately; test retry after a partial import and a second browser with different records. This supersedes MG-1's empty-registry condition.
- M2/M3: the review baseline records observed file changes, not their author. Test two sessions watching the same note plus a human edit; do not label shared changes as one session's, or offer misleading per-author rollback. Link a team report to a note edit only with explicit provenance. Exercise interleaved mock replies, pane moves and release of the seventh hidden conversation in a real client.
- M3: every rendered seat call must contain a task-bearing `prompt` as well as the short `description`. Use routes the lead may actually delegate. Require a named member to start and receive the expected role card and task, not merely creation of the lead and its folder. Include an unavailable-model case.
- Later research-workflow refinement (not an M0/M1 feature): discuss a readable, physics-led derivation plan with the researcher before dispatching Goals or tasks; preserve assumptions, decisive steps and failure criteria. Look up literature for concrete uncertainties. Success is a result the researcher can assess, not a count of completed tasks.

## Risks

| Risk | Response |
| --- | --- |
| DSH API differences (`ctx.layout`, `remote.session.selectModel`, `remote.agentTeams`, session rows) | Probe each at start-up; degrade per QB-3; record what was found in the milestone report |
| Many mounted conversations cost memory | DS-11 cap: at most six conversations mounted; the least recently shown hidden one releases first |
| The lead model does not follow the brief | TM-13 verification and one-click re-ask; keep the brief's calls verbatim |
| Visual drift from the mockups | Copy the mockup CSS; review gate with side-by-side screenshots |
