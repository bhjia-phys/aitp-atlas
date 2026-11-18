# Atlas 1.0 design package

Status: **proposed**, 2026-11-18, for the researcher's approval before implementation.
Design lead: Claude. Implementer: Codex (GPT-6.2-Sol, high reasoning), milestone by milestone,
each milestone reviewed against this package before the next starts.

Atlas 1.0 turns Atlas from a set of pages around one conversation into a research environment:
you start talking from the Desk without choosing a topic, keep several discussions and teams
going at once, give any tab the whole screen, and run a native AITP research team whose work
you can watch and steer.

## The look: a celestial atlas

Atlas is an atlas of a research programme, so it looks like one: **the observatory by night** (deep
indigo sky, starlight blue, a gold sun for what needs you) and **the engraved chart by day** (warm
paper, blue-black ink, ochre, hand-tinted washes). The Desk opens on a sky of your topics; as you
type, Atlas lights the star your question belongs to and draws a path to it. A team is a
constellation: the lead at the center, members on their orbit, light flowing along the work in
flight. A serif with small caps speaks for the research; the sans speaks for the controls. Topic
colors are one harmonious OKLCH family, validated for color-blind readers.

## Read in this order

| File | What it decides |
| --- | --- |
| [SPEC.md](SPEC.md) | Product and interaction: principles, places, tabs, shell, focus, Desk, discussions, Map, server API, migration |
| [VISUAL.md](VISUAL.md) | Visual system: tokens (both themes), type, spacing, components with exact sizes and states, rules |
| [TEAM.md](TEAM.md) | The native research team: roles, charter, run directory, protocol, DSH integration, Team room |
| [team-templates/](team-templates/) | The lead brief, role cards and artifact formats the team uses, verbatim |
| [mockups/atlas-1.0.html](mockups/atlas-1.0.html) | Reference screens in both themes, built from the VISUAL.md tokens: the visual contract |
| [PLAN.md](PLAN.md) | Milestones M1–M4: tasks, files, acceptance checks, tests, review gates |
| [CODEX-BRIEF.md](CODEX-BRIEF.md) | Instructions for the implementing agent |

Requirement IDs (`SH-3`, `DK-8`, `TM-12`, …) are cited in reviews. When the text and a mockup
disagree, the text wins and the mockup is corrected.

## The four problems this answers

1. **One discussion at a time.** Discussions become first-class: any number open as tabs, a
   Discussions place to find them, a server-side registry instead of one browser's storage.
2. **No natural starting point; a cluttered home.** The Desk opens on a composer. Atlas suggests
   the topic as you type and files the discussion there; you can leave it unfiled or move it
   later, and the AI is told. The long right-hand column is gone.
3. **Teams depend on Oh-My-BBFF.** Teams are built on DSH's native Agent Teams and AITP's rules for
   parallel work: a lead that integrates, members with role cards and their own models, reports,
   independent review, and a Team room that shows the work as it flows.
4. **Heavy chrome, no full screen, unpolished UI.** One 40 px row of tabs and a collapsible rail
   replace the top bar; Focus gives a tab the whole window (DSH's sidebar folds too) and Full
   screen gives it the monitor; the celestial-atlas language (above) applies everywhere.
