# Atlas 1.0 — the native research team

Status: proposed, 2026-11-18. Replaces the Oh-My-BBFF team launcher. Read with SPEC.md (shell,
tabs) and VISUAL.md (components). Verbatim texts the team uses are in
[team-templates/](team-templates/).

## 1. What a team is

A **team** is a group of AI agents working on one research goal within one topic (or the root),
under AITP's rules for parallel work (`aitp-memory/references/handoffs.md`, "Work in parallel" and
"standing team"). It is built from DSH's native machinery:

| Team concept | DSH mechanism |
| --- | --- |
| The lead (integrator) | a root DSH session with **Use Agent Teams** on (`remote.agentTeams.setEnabled`) |
| A member (seat) | a named subagent the lead starts with DSH's `subagent` tool (`name`, `description`, `provider`, `model`, `reasoning_effort`) |
| Messages between agents | DSH's `send_message` / `list_agents` (subagent runtime) |
| Shared task list | DSH's Agent Teams task board (`agentTeam` projection: tasks with status, owner, `blockedBy`, `writeScopes`) |
| The researcher talking to an agent | a prompt to that agent's session from an embedded conversation |
| Shared files | the team's **run directory** in the topic folder |

AITP rules the team keeps (from handoffs.md):

- **TM-1** The lead is the only integrator: only the lead proposes edits to `research.md`, the
  root note or the shared knowledge index, and only after an independent check of the claims they
  carry. The researcher reviews those edits in Atlas, edit by edit (P6).
- **TM-2** Each substantive file has one writer. Members write in their own work folder and their
  reports; shared inputs and baselines are read-only.
- **TM-3** Members return the result, assumptions, evidence locations, checks actually made,
  unresolved issues and the proposed implication for the parent — the report format (§4.2).
- **TM-4** A conflict the evidence cannot resolve stays visible as an open question; results are
  never averaged into a conclusion.
- **TM-5** No member submits cluster jobs. The lead prepares the exact command as a decision request
  and waits for the researcher's answer.
- **TM-6** While the team works, the topic's Current work has one entry naming its goal and run
  directory (written by the lead, reviewed by the researcher).

## 2. Roles

Role cards (verbatim in `team-templates/roles/`) give each seat its responsibility, what it may write
and how it reports. Seats are named by role unless two share one (`theorist`, `theorist-2`).

| Role | Seat name | Responsible for | Writes | AITP skills it leans on |
| --- | --- | --- | --- | --- |
| Lead | `lead` (the root) | the plan, the board, briefs, routing reviews, integration, `state.md`, decisions, the closing report | `charter.md` (refinements), `state.md`, `decisions/`, `reports/00-lead-*`, note edits (reviewed) | aitp-memory, aitp-research |
| Theorist | `theorist` | derivations and analytic arguments | `work/theorist/`, `reports/` | aitp-research, aitp-verify, aitp-writing |
| Numerics | `numerics` | code, local calculations, benchmarks, figures | `work/numerics/`, `reports/` | aitp-research, aitp-verify |
| Literature | `literature` | sources: what is established, by whom, where (equation and page) | `work/literature/`, `reports/` | aitp-research (synthesis), aitp-verify (citations) |
| Referee | `referee` | independent checks of reports; never fixes what it checks | `reviews/` | aitp-verify |
| Writer | `writer` | drafts of note or manuscript sections from accepted results | `work/writer/` or charter-allowed manuscript files, `reports/` | aitp-writing |
| Custom | chosen | as written in its role card | as the card says | — |

- **TM-7** A seat is *core* (keeps its context for the whole team) or *one-shot* (one task, then
  finishes). Referee and Literature default to core; any seat can be one-shot.
- **TM-8** Model per seat: default "Same as the lead". The sheet offers DSH's model catalog with
  reasoning efforts. It suggests (does not force) a different provider for the referee when the
  catalog has one, to reduce shared blind spots.

### 2.1 Templates

| Template | Seats |
| --- | --- |
| Derive and check | lead, theorist, referee |
| Theory and numerics | lead, theorist, numerics, referee |
| Literature survey | lead, literature, literature-2, referee |
| Write-up | lead, writer, referee |
| Custom | lead only, then add |

## 3. The charter

The researcher writes the charter in the team sheet; Atlas saves it as `charter.md` and the lead
reads it first. Fields:

| Field | Required | Meaning |
| --- | --- | --- |
| Goal | yes | the question the team answers, one or two sentences |
| Done when | yes | success criteria and stopping conditions |
| Topic | yes | the topic note it serves (preset from context); the run directory lives in its folder |
| Conventions and assumptions | no | units, signs, notation, approximations every seat must use |
| Allowed files | yes (prefilled) | what each seat may write; defaults: the run directory's own folders only |
| Ask me before | yes (prefilled) | always: note edits (reviewed in Atlas) and cluster jobs; optional: "starting a new seat", "more than N turns per seat", "web downloads" |
| Inputs | no | files and papers the team starts from |

## 4. The run directory

- **TM-9** Location: `<topic folder>/runs/team-<YYYYMMDD>-<slug>/` (AITP keeps `runs/` as a valid
  material name; legacy BBFF teams used `calculations/team-…` and stay where they are).

```
runs/team-20261118-pade-check/
  charter.md                     the researcher's charter (lead may refine with approval)
  state.md                       the lead's current synthesis: established · open · conflicts · next
  roles/README.md                the artifact formats (copied from templates)
  roles/<seat>.md                each seat's role card (copied, editable before start)
  reports/NN-<seat>-<slug>.md    member reports; 00-lead-closing.md at the end
  reviews/NN-<seat>-on-<report>.md
  decisions/DNN-<slug>.md        requests to the researcher
  work/<seat>/                   each seat's own derivations, code, data, figures
```

- **TM-10** Atlas creates the folder, `charter.md`, `state.md` (empty skeleton), `roles/README.md`,
  the role cards and `work/<seat>/` when the team starts. Atlas writes nothing else there afterwards
  except the answer note in a decision file (§5.4).

### 4.1 Front matter

Every report, review and decision starts with YAML front matter (formats verbatim in
`team-templates/roles/README.md`). Atlas parses it to draw the Team room; unparseable files still
show, as "unformatted", with their title from the first heading.

### 4.2 Report

```yaml
---
kind: report
id: R03
seat: theorist
task: task-4
title: Ward identity fixes the vertex at q = 0
status: submitted        # draft | submitted | accepted | needs-work | rejected | superseded
claims:
  - id: R03.1
    text: The ladder vertex correction vanishes at q = 0 to all orders.
    basis: derived       # derived | computed | cited | conjectured
assumptions: [ladder approximation, T = 0]
evidence: [work/theorist/ward.md#eq-7]
checks: [q → 0 limit matches Ref. 3, Eq. 12]
open: [finite-q behaviour]
implication: Supports dropping vertex corrections in the static limit (research.md, Screening).
---
```

### 4.3 Review

```yaml
---
kind: review
id: V02
seat: referee
on: R03
verdict: holds           # holds | holds-with-changes | fails | cannot-check
claims: { R03.1: holds }
findings:
  - severity: minor      # blocking | major | minor
    where: R03, eq. (7)
    text: Sign of the second term flips under the stated convention; the conclusion is unchanged.
---
```

### 4.4 Decision request

```yaml
---
kind: decision
id: D01
from: lead
status: open             # open | answered | withdrawn
question: Run the 64^3 lattice on the cluster?
options:
  A: Submit now — sbatch -p cpu --time=04:00:00 run64.sh
  B: Shrink to 32^3 and run locally (about 20 min)
recommendation: B
---
```

## 5. Protocol

### 5.1 Start (what Atlas does)

- **TM-11** On **Start team**: Atlas server creates the run directory (TM-10) and the team record;
  the client creates the lead session in the research workspace, selects the lead's model
  (`remote.session.selectModel`), turns Agent Teams on, renames it `Atlas team · <topic> · <goal>`,
  and sends the **lead brief** (`team-templates/lead-brief.md`, filled in).
- **TM-12** The lead brief tells the lead to start each seat with one `subagent` call, using exactly
  the listed `name`, `description`, `provider`, `model` and `reasoning_effort`, and to give each its
  role card path and only the files its first task needs. Atlas does not start members itself:
  starting them through the lead keeps them in the lead's Agent Team tree, where DSH routes messages
  and task ownership.
- **TM-13** Atlas watches the lead's `subagentCatalog` projection. Each seat shows "starting" until
  a member with its name appears; after 3 minutes without it, the seat shows "not started" with
  **Ask the lead to start it** (sends a one-line message). A member whose phase is `failed` shows its
  error.
- **TM-14** If DSH lacks Agent Teams or the model routes, the sheet says so before starting
  ("This DSH cannot run teams: …") and offers nothing that would fail later.

### 5.2 Work

1. The lead reads the charter and the note, writes the plan into `state.md` (Next), and puts tasks on
   the board with dependencies and write scopes (`work/<seat>/`, `reports/`).
2. Members claim tasks, work in `work/<seat>/`, write a report, message the lead with its path, and
   complete the task.
3. For a report that carries a consequential claim, the lead creates a review task owned by the
   referee (never the author).
4. The referee reviews independently and writes `reviews/…`; the lead marks the report accepted,
   needs-work or rejected.
5. The lead updates `state.md` (Established with report and review ids; Open; Conflicts; Next).
6. For accepted results that change the topic, the lead proposes note edits; Atlas shows them for the
   researcher's review (Keep / Revert per edit) through the existing review machinery, with the lead
   session as the reviewed session.

### 5.3 The researcher's controls

| Control | Effect |
| --- | --- |
| Message the team | a prompt to the lead |
| `@seat` in the team composer | a prompt to that member's session (DSH routes browser prompts to child sessions) |
| Open a seat | the member's conversation as a `member` tab (RT-7) |
| Answer a decision | sends the answer to the lead (§5.4) |
| Review edits | the review panel for the lead's note edits |
| Ask the team to pause | message to the lead: finish current steps, start nothing new, report state |
| Resume | message to the lead: continue from `state.md` Next |
| Add a seat | message to the lead with the new seat's exact start call; Atlas adds its role card first |
| End the team | message to the lead: write the closing report and tell members to finish; the team becomes "Ending", then "Done" when the closing report exists |

- **TM-15** Pause and end are requests to the lead, labelled as such ("Asked the team to pause"):
  DSH's interrupt tool is off by default and Atlas does not force-stop agents.

### 5.4 Decisions

- **TM-16** An open decision file appears in the Team room's Needs you panel, on the Desk (Needs
  you) and as the gold Teams badge. **Answer** opens an inline form: the options as radio buttons
  (the lead's recommendation marked) and a note field. Submitting appends
  `## Answer (<date>, researcher)` with the choice and note to the decision file, sets
  `status: answered` in its front matter, and sends the lead "Decision D01 answered: B. <note>".
- **TM-17** A cluster command in an option is shown in a code block with a warning chip "Runs on the
  cluster"; answering never runs it — the lead runs nothing either (TM-5); the researcher runs it or
  tells the lead what to do next.

### 5.5 End

- **TM-18** The lead writes `reports/00-lead-closing.md` (`kind: report`, `seat: lead`) with the
  outcome against "Done when", the integrated changes, what stays open, and where everything is.
  Atlas marks the team Done when that file exists and the lead is idle.

## 6. Team states

| State | Shown when | Pill |
| --- | --- | --- |
| Starting | lead created, seats not all present | accent, with the twinkle |
| Working | any member or the lead running | accent, with the twinkle |
| Waiting on you | an open decision, or lead edits await review | gold |
| Idle | nothing running, nothing waiting | neutral |
| Paused | after "Ask the team to pause" until "Resume" (local flag) | neutral |
| Ending / Done | after "End the team" / closing report present and lead idle | neutral / done |

## 7. Interface

### 7.1 The Teams place

List of teams (Waiting on you first, then Working, then the rest by activity), one row each: a
48 × 32 thumbnail of the team's constellation, the name (serif), topic chip, state pill, "4 of 9
tasks" and an italic last-activity time. Filters: Active,
Waiting on you, Done. **New team** (primary) at the top right. Legacy BBFF teams list with a "legacy"
chip and open read-only (members and board from DSH; no run-directory view).

### 7.2 The Team room (a `team` tab)

Two columns: the **main column** (the constellation band with the mission, then the work, then the
composer) and the **logbook** (300). The constellation is the room's focal element; the logbook is
its calm counterweight.

```
┌ main ─────────────────────────────────────────────────────────────┬ logbook 300 ───────────┐
│        ·            ✧ numerics              A TEAM ON ● Analytic   │ NEEDS YOU · two         │
│  ✧ theorist ·  ·   ◉ lead  · · ·            Padé stability check   │  ⚑ Run 64³?  [Answer]   │
│   idle · 2 reports      ·.·.·.✧ referee      Does the window choice │  ☰ 3 edits   [Review]   │
│        (orbit, progress rings, light paths)  explain the poles…?   │ LOGBOOK · state.md      │
│                                             (✧ Working) ━━━━ 4 of 9 │  ▾ Established   2      │
│                                             [Message team] [Pause] │   ● Baseline… R01·V01   │
├────────────────────────────────────────────────────────────────────┤  ▸ Open        3        │
│ (Flow) Board  Timeline        each row follows one line of work…   │  ▸ Conflicts   1        │
│ WORK                 │ REPORT       │ REVIEW        │ INTEGRATED    │  ▸ Next        2        │
│ (T) task-3 Spurious… │ R03 submitted│ V02 reviewing │      —        │ CHARTER                 │
│ (N) task-5 Pole dri… │   not yet    │      —        │      —        │  Done when the poles…   │
├────────────────────────────────────────────────────────────────────┤  Open charter.md        │
│ composer: Message the team… type @ to address one member      (↑)  │                         │
└────────────────────────────────────────────────────────────────────┴─────────────────────────┘
```

- **TM-19 Constellation band** (main column top, bottom hairline): left, the constellation (VISUAL
  §6.10), at least 360 wide; right, the **mission**: "A team on" (`--t-cap`) with the topic chip; the
  team name (`--t-h1`); the goal in italic serif (`--t-read` italic, `--text-2`); the state pill with a
  progress line (tasks completed / all tasks, accent → `--n7`) and "4 of 9 tasks · 32 min"; then
  **Message team** and **Pause / Resume** (secondary) and `⋯` (Add a member, Edit the charter — opens
  `charter.md` beside, Open the run folder, End the team).
- **TM-20 Members in the constellation.** The lead is the central star; members are stars on the
  orbit in charter order, colored by seat slot, each with its progress ring (share of its board tasks
  completed), a twinkle while working, and two label lines (name in small caps; state and current
  task, or "starting", "not started", "failed"). Light paths flow from an author to the referee while
  a review is in progress, and from an author to the lead while a submitted report waits to be
  routed. A star is a button: clicking opens the member's conversation as a `member` tab (RT-7);
  hovering shows a seat card (name, role, model and effort, current task, reports and reviews,
  **Message** — prefills `@name` in the composer — and **Open**). "Not started" seats show a dashed
  star with **Ask the lead to start it** in their card (TM-13). A visually hidden list repeats every
  seat for assistive technology.
- **TM-21 Center views** (segmented, persisted per team):
  - **Flow** (default): a *pipeline table*. Each row is one line of work: a board task that is not a
    review task, followed through AITP's stages in four columns — **Work** (the task: owner glyph,
    subject clamped to two lines, `task-N · status`), **Report** (the report whose `task` names it),
    **Review** (the review whose `on` names that report, or the review task assigned for it, or "lead
    routing" while a submitted report has neither), **Integrated** (the report accepted, and the lead's
    note edits resting on it with their review state). Cells follow VISUAL §6.11; a stage not reached
    is a dashed empty cell. Rows order: in progress, then waiting on review, then done, newest first;
    reports with no task get their own row headed "(no task)". Hovering a row tints it; clicking a
    cell opens its file beside (RT-3). The header row is sticky and shows each column's count. This
    view answers "how far has each line of work got?" at a glance and stays readable at 520 px.
  - **Board**: DSH's task board as a table: status, subject, owner glyph and name, blocked by,
    write scopes (and overlap warnings in `--status-waiting`); grouped Ready, Blocked, In progress,
    Done.
  - **Timeline**: newest first; each event a row with time, actor glyph, verb and object: "theorist
    submitted R03", "lead assigned task-5 to referee", "referee: R03 holds", "lead proposed 3 note
    edits", "D01 answered (B)". Sources (TM-27).
- **TM-22 Logbook** (300, VISUAL §6.12), top to bottom: **Needs you** — open decisions (**Answer**),
  pending note edits (**Review**), members not started (**Ask the lead**); collapses to one italic
  line when empty. **Logbook** — the lead's `state.md`: Established (open by default), Open, Conflicts,
  Next, each with its count and items linked to their reports and reviews. **Charter** — "Done when"
  and **Open charter.md**.
- **TM-23 Composer** at the bottom of the main column: the composer's team variant (VISUAL §6.6).
  Typing `@` opens a member menu; a message with exactly one leading `@name` goes to that member,
  otherwise to the lead ("goes to the lead" hint). The sent message also appears in the Timeline
  ("You → theorist").
- **TM-24** Under 1040 px of tab width the logbook becomes a toggle panel (a **Logbook** button in the
  mission's actions; it opens as an overlay from the right, with the Needs-you count as its badge);
  under 760 px the mission stacks under the constellation.

### 7.3 Assembling a team (the team dialog)

Dialog 900 wide (VISUAL §6.13), titled **Assemble a team**, in two columns with a sticky footer.

Left, the form:

1. **The question**: What should the team find out? (textarea, 2–6 lines), Done when (textarea),
   Topic (topic picker; preset from context) and Lead model (DSH's model catalog with efforts).
2. **Rules**: Conventions and assumptions (textarea); Ask me before (checkboxes; "Any edit to a note"
   and "Any cluster job" checked and disabled); Allowed files (prefilled summary with **Edit**);
   Inputs (attach files or papers); the run folder path in mono, `--text-3`.

Right, **the crew** (340, `--surface`): a live mini constellation that redraws as members change;
template chips (§2.1); one seat card per member — seat glyph, name in small caps (editable, validated
`^[a-z][a-z0-9-]{0,31}$`, not `lead`, unique), role (in the card's menu), model ("Same as the lead"
by default) and effort selects, core / one-shot in the card's menu, remove; **Add a member**; the
referee hint (TM-8) as one italic line when applicable; a collapsed "Brief the lead will receive"
(mono, read-only).

Footer: at the left, "The lead starts N members and puts the work on the task board."; at the right,
Cancel (quiet) and **Start the team** (primary). Validation errors appear under their fields; Start
is disabled until the question, Done when and topic are set and the names are valid and unique.

### 7.4 Member tabs

A `member` tab embeds that member's conversation (DS-11 recipe) with a header: seat glyph, name,
role · model, team name (link to the Team room), state; no model menu (DSH exposes none for subagent
sessions).

## 8. Data sources and refresh

- **TM-25** Live: DSH session rows (`running`, `projectionValues.subagentCatalog`,
  `projectionValues.agentTeam`, `modelSelection`) through the existing `useSessionRows`.
- **TM-26** Files: `GET teams/<id>/artifacts` returns parsed front matter and titles for `reports/`,
  `reviews/`, `decisions/`, plus `state.md` sections and `charter.md` fields, with mtimes. The client
  re-reads it when a seat's row changes from running to idle, every 20 s while the Team room is
  visible, and on demand.
- **TM-27** Observed events: while a Team room is open, the client diffs board snapshots and seat
  states and posts the differences to `teams/<id>/events` (append-only JSONL in the state
  directory), so the Timeline survives reloads. Events are labelled "observed" when their time is
  when Atlas saw them rather than when they happened.

## 9. Server API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `teams` | `{ teams }` with state inputs (registry + counts from artifacts) |
| POST | `teams` | create: validates the charter and seats, creates the run directory and files, returns `{ team, brief }` (the client then starts the lead and patches `leadId`) |
| PATCH | `teams/<id>` | `leadId`, `name`, `paused`, `ending`, `view` |
| GET | `teams/<id>/artifacts` | parsed artifacts (TM-26) |
| POST | `teams/<id>/events` | append observed events |
| GET | `teams/<id>/events` | `?since=` events |
| POST | `teams/<id>/decisions/<did>/answer` | `{ choice, note }` → appends the answer and flips the status (TM-16); returns the message text for the lead |

Team record (`teams.json`): `{ id, name, topic, runDir, leadId, created, seats: [{ name, role,
model: { provider, model, effort } | null, mode }], template, paused, ending, legacy }`.

## 10. Legacy teams

0.5–0.9 teams (`kind: 'team'` in the old thread index) import as `legacy: true` records: the Teams
place lists them, and their Team room shows seats and the board from DSH but no Flow (no run
directory format). The BBFF-specific code (`TEAM_ROLES`, `bbff_team_*` brief text, `memberLabel`'s
`[role]` parsing as the primary source) is removed in M3; `memberLabel` stays only to read legacy
labels.

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| The lead model does not start seats exactly as briefed | TM-13 verification and one-click re-ask; the brief lists each call verbatim |
| Agents ignore the report format | Atlas still lists unformatted files; the role cards repeat the format; the referee's review checks the format as well as the content |
| Long teams cost a lot | "Ask me before" turn limits in the charter; state pill and running time always visible; Pause is one click |
| Several agents write the same file | write scopes on tasks (DSH warns on overlap) and TM-2 in every role card |
| Model routes missing for a seat's provider | the sheet only offers models in DSH's catalog; TM-14 |
