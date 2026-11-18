# Atlas 1.0 — visual system: a celestial atlas

Status: proposed, 2026-11-18 (second direction, after the researcher asked for a more imaginative,
better balanced and more harmonious design). The [mockups](mockups/atlas-1.0.html) implement this
file; port their CSS (with `atlas-` class names, CODEX-BRIEF) rather than re-deriving it. Every
color, size, radius, shadow and duration comes from the tokens below; a value that is not a token is
a defect unless this file names it.

## 1. The idea

Atlas is an atlas of a research programme, so it looks like one. **Night is the observatory**: deep
indigo sky, starlight blue, a gold sun for what needs you. **Day is the engraved chart**: warm paper,
blue-black ink, ochre, hand-tinted washes. One idea in two moods: the same shapes, palette order and
type, only the light changes.

Six rules keep it harmonious:

1. **Harmony by construction.** Surfaces come from one hue family (indigo at night, warm paper by
   day). There is one accent (starlight / ink blue) and one warm signal (sun gold / ochre). Topic
   colors are one OKLCH family with matched chroma, ordered so neighbours stay apart (§2.3).
2. **Two voices of type.** The serif (Source Serif 4) speaks the research: titles, the greeting,
   reading text, section labels in small caps, counts and times in italic. The sans speaks the
   controls: buttons, inputs, tabs, menus.
3. **Balance, not boxes.** Each screen has one focal element (the sky and composer on the Desk, the
   constellation in a Team room, the page in a reader), balanced by a calm information area. Spacing
   separates groups first, a tinted hairline second, never a box inside a box.
4. **Ornament carries data.** The sky band shows where a question belongs; the constellation shows
   who is doing what; graticules and dot leaders guide the eye. No ornament without that job, and
   none in reading surfaces.
5. **Motion is starlight.** A four-point star twinkles while an agent works; dashed light flows along
   a path while work is in flight; nothing else moves. Reduced motion stops both.
6. **One primary action per region**, accessible always: contrast ≥ 4.5:1 for text, ≥ 3:1 for control
   boundaries, status never by color alone.

## 2. Color

Tokens live in `client/05-theme.js`, emitted on `.atlas-root` for `night` and `day`; `*-rgb`
companions exist where alpha is needed.

### 2.1 Surfaces, ink, lines

| Token | Night | Day | Use |
| --- | --- | --- | --- |
| `--bg` | `#070B17` | `#ECE7DC` | rail, strips, the frame behind panes |
| `--surface` | `#0C1222` | `#FAF8F2` | pane content (Desk, readers, rooms), shown tab |
| `--raised` | `#131A2E` | `#FFFEFA` | composer, cards, cells, menus, popovers, dialogs |
| `--sunken` | `#090E1B` | `#F2EEE4` | inputs, code, wells, segmented tracks |
| `--table` | `#050811` | `#E3DDCF` | the light table under PDF pages |
| `--overlay` | `rgba(3, 5, 12, .66)` | `rgba(28, 32, 51, .30)` | scrims |
| `--hover` | `rgba(200, 214, 255, .05)` | `rgba(28, 32, 51, .045)` | hover fills |
| `--pressed` | `rgba(200, 214, 255, .08)` | `rgba(28, 32, 51, .08)` | pressed fills |
| `--selected` | `rgba(157, 184, 255, .12)` | `rgba(44, 79, 163, .09)` | selected rows, active rail item |
| `--border` | `rgba(160, 180, 255, .11)` | `rgba(40, 45, 70, .12)` | hairlines (tinted starlight / ink) |
| `--border-strong` | `rgba(160, 180, 255, .22)` | `rgba(40, 45, 70, .22)` | outlines of secondary buttons, the composer, stage rules |
| `--border-control` | `#5D6991` | `#827C70` | inputs and checkboxes (3.46 / 3.9 : 1 on surface) |
| `--text-1` | `#E9ECF5` | `#1C2033` | primary ink |
| `--text-2` | `#AEB5CC` | `#474C61` | secondary ink |
| `--text-3` | `#8A93B0` | `#5F6375` | meta, captions, placeholders (≥ 4.5 : 1 on every surface) |
| `--text-on-accent` | `#0A0F1F` | `#FFFFFF` | ink on accent fills |
| `--sky-line` | `rgba(170, 190, 255, .09)` | `rgba(40, 45, 70, .10)` | graticule |
| `--sky-line-2` | `rgba(170, 190, 255, .18)` | `rgba(40, 45, 70, .22)` | constellation lines, orbits, horizon |
| `--star` | `#EEF2FF` | `#1C2033` | stars (light at night, ink by day) |
| `--wash` | `.055` | `.06` | opacity of a direction's sector wash |

### 2.2 Accent and signals

| Token | Night | Day | Use |
| --- | --- | --- | --- |
| `--accent` | `#9DB8FF` | `#2C4FA3` | links, focus ring, primary fills, the routed star, light paths |
| `--accent-hover` | `#B6C9FF` | `#233F86` | hover on accent |
| `--accent-soft` | `rgba(157, 184, 255, .14)` | `rgba(44, 79, 163, .10)` | the active tab of the pane used last, selections, info |
| `--glow` | `rgba(157, 184, 255, .45)` | `rgba(44, 79, 163, .22)` | star halos (radial gradients only) |
| `--gold` / `--gold-on` | `#F4CE7A` / `#0A0F1F` | `#8F5A00` / `#FFFFFF` | needs you: headings, dots, badges |
| `--gold-soft` | `rgba(244, 206, 122, .12)` | `rgba(201, 138, 20, .14)` | needs-you rows and banners |
| `--success-text` / `--success-soft` | `#79D69A` / `rgba(121, 214, 154, .13)` | `#1E7A3C` / `rgba(30, 122, 60, .10)` | accepted, holds |
| `--danger`, `--danger-text`, `--danger-soft` | 0.9 values | 0.9 values | destructive and error |

Diff, code and status steps keep their validated 0.9 values and names.

### 2.3 Topic colors: the nebula palette

Directions (and, in a team, seats) take these slots in this fixed order, never cycled; past eight,
they share `--dx` (0.9 "other"). All sixteen values were generated in OKLCH with matched chroma and
validated with the dataviz palette validator against their surface:

| Slot | Name | Night (on `#0D1325`) | Day (on `#FAF8F2`) |
| --- | --- | --- | --- |
| `--n1` | starlight blue | `#588CDA` | `#3067B8` |
| `--n2` | teal | `#03886D` | `#08856A` |
| `--n3` | amber | `#BD891C` | `#A77601` |
| `--n4` | rose | `#CB5E93` | `#A93772` |
| `--n5` | violet | `#6B5FCA` | `#5341B1` |
| `--n6` | coral | `#C5582F` | `#B84412` |
| `--n7` | cyan | `#31A1BD` | `#0B8FAA` |
| `--n8` | spring green | `#66A43E` | `#4A871B` |

Validator results: night — lightness band, chroma floor and contrast pass; worst adjacent pair under
color-vision deficiency ΔE 11.1 (target 8); worst adjacent pair for full color vision 17.3 (floor
15). Day — all pass; worst CVD 9.1, worst normal 17.3. Colors never stand alone: a direction or seat
is always named beside its color.

### 2.4 Shadows

| Token | Night | Day |
| --- | --- | --- |
| `--shadow-1` (cells, cards) | none | `0 1px 2px rgba(60, 50, 30, .06)` |
| `--shadow-2` (composer, menus, popovers, toasts, focus header) | `0 10px 30px rgba(0, 0, 0, .5), 0 0 0 1px rgba(160, 180, 255, .06)` | `0 10px 28px rgba(60, 50, 30, .14), 0 0 0 1px rgba(40, 45, 70, .06)` |
| `--shadow-3` (dialogs, palette) | `0 28px 70px rgba(0, 0, 0, .6)` | `0 28px 70px rgba(60, 50, 30, .20)` |

Day shadows are warm (sepia), never gray-blue.

### 2.5 Migration from 0.9 names

| 0.9 | 1.0 |
| --- | --- |
| `sky-0`, `sky-1` | `--bg` (working views); the Map keeps its own sky tokens |
| `panel`, `panel-0`, `panel-1` | `--surface` |
| `panel-2`, `panel-3`, `bubble`, `selector` | `--raised`; selection → `--selected` |
| `deep`, `checker-*`, `input-major` | `--sunken` |
| `line` / `line-2` | `--border` / `--border-strong` or `--border-control` (inputs) |
| `ink-0`, `ink-1` / `ink-2` / `ink-3` | `--text-1` / `--text-2` / `--text-3` |
| `link`, `accent-a`, `accent-b`, `blue` | `--accent` |
| `on-accent`, `on-gold` | `--text-on-accent`, `--gold-on` |
| `danger-ink*`, `good` | `--danger-text`, `--success-text` |
| direction slots | `--n1` … `--n8` (§2.3) |
| `nebula-*`, `glow` | Map only; `--glow` (new) for halos |

DSH bridge variables (`--dsw-*`) map labels → `--text-1/2/3`, backgrounds → `--surface` / `--raised` /
`--sunken`, borders → `--border` / `--border-strong`, brand → `--accent`, input major → `--sunken`,
bubble → `--raised`, selector → `--selected`.

## 3. Type

| Family | Stack | Use |
| --- | --- | --- |
| Serif | `"Source Serif 4", "Iowan Old Style", "Charter", "Cambria", Georgia, serif` | titles, greeting, reading, small-caps labels, italic counts and times, AI replies in the mockup |
| Sans | `"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif` | controls, tabs, lists, inputs, chips |
| Mono | `ui-monospace, "Cascadia Code", "SFMono-Regular", Consolas, monospace` | ids, paths, code, LaTeX source |

**Source Serif 4** (SIL Open Font License) is vendored under `vendor/fonts/` (variable roman and
italic, `woff2`, with its `OFL.txt`) and declared with `@font-face` (`font-display: swap`); it has
optical sizes and true small caps. Without it the stack falls back gracefully.

Scale (major third on 13 px, rounded to a 4 px baseline):

| Token | Size / line | Weight, style | Family | Use |
| --- | --- | --- | --- | --- |
| `--t-display` | 40 / 48 | 400 italic | serif | the Desk greeting |
| `--t-h1` | 26 / 32 | 600 | serif | Team room and place titles, document titles |
| `--t-h2` | 22 / 28 | 600 | serif | dialog titles, list page titles |
| `--t-h3` | 16 / 22 | 600 | serif | discussion titles, popover titles |
| `--t-read` | 16 / 26 | 400 | serif | notes and long text (15 / 24 under 640 px) |
| `--t-body` | 14 / 20 | 400 | sans | lists, forms, row titles |
| `--t-ui` | 13 / 18 | 400 or 500 | sans | buttons, tabs, chips, menus |
| `--t-meta` | 12 / 16 | 400 | sans | meta, hints |
| `--t-cap` | 12 / 16 | 600, all small caps, +0.09 em | serif | section labels, legends, almanac headings (15 / 20 there) |
| `--t-count` | 13 / 18 | 400 italic | serif | counts and relative times ("2 min", "three") |
| `--t-mono` | 12.5 / 20 | 400 | mono | ids, paths, code |

Small counts in serif headings may be spelled out ("Needs you · three"); badges, tables and anything
compared at a glance use digits.

## 4. Space, shape, motion

| Scale | Values |
| --- | --- |
| Space `--s-*` | 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 72 |
| Radius | `--r-xs` 4 (kbd), `--r-sm` 6 (inputs, buttons, cells), `--r-md` 10 (cards, menus, rail items, needs-you rows), `--r-lg` 16 (composer, dialogs, palette), `--r-full` (tabs are 8; chips, segmented controls, pills, toasts, the focus header, stars) |
| Controls | 24, 28, 32 tall; send 32 round; tabs 30 inside the 40 strip |
| Rows | 36 (menus, palette), 40 (almanac leaders), 44 (lists), 58 (two-line discussion rows) |
| Widths | rail 56 / 208; Desk column 1120 with a 720 composer; reading 72 ch; logbook 300; dialogs 560 / 900; palette 640 |
| Motion | hover 120 ms; panels 160 ms; dialogs 220 ms; easing `cubic-bezier(.2, .7, .2, 1)`; **twinkle** 2.4 s (scale .75 → 1.1, rotate 45°, opacity .65 → 1); **flow** dashes 1.6–2.2 s linear (dash 3, gap 6) |
| Z order | strips 10, focus zone 20, rail overlay 30, popovers 40, toasts 50, dialogs 60, palette 70 |

## 5. Icons and marks

Line icons, 24 viewBox, 1.5 stroke, round caps and joins, `currentColor`, 16 px in chrome, 20 px in
the rail. Celestial where it helps meaning: **Desk** a sunrise over the horizon, **Teams** a small
constellation, **Map** a globe with its graticule, **Learn** a telescope, **Write** a quill, the
**Atlas mark** an astrolabe (circle, crosshair ticks, an orbit, a central sun) drawn in `--gold`. The
**twinkle** is a four-point star (`clip-path` polygon) used for "working". The active rail item's
marker is a 7 px four-point star in `--accent` at the rail's left edge.

## 6. Components

States: rest, hover (`--hover`), pressed (`--pressed`), focus-visible (`outline: 2px solid
var(--accent); outline-offset: 2px`, `-2px` inside tabs and rows), disabled (40 % opacity),
selected (`--selected`).

### 6.1 Workspace switcher (post-M1 navigation review)
DSH owns the only persistent left sidebar. In the first pane strip, a 28 px high compact outlined
button has the gold Atlas mark, the word **Atlas**, and a downward chevron. It is not a tab. One
240 px menu groups named **Places** above **Workspace actions**; 32 px rows have readable names,
effective shortcuts and, where applicable, real counts. Focus is visible and returns on Escape.
The 56/208 px rail values and rail markers elsewhere in this historical style sheet and mockup
are superseded. See [the running comparison](reports/nav/nav-comparison-final.png).

### 6.2 Strip and tabs
Strip 40, `--bg`, bottom hairline, padding 0 4 0 6. Tabs are **pills**: 30 tall, radius 8, padding
0 4 0 10, gap 7, label `--t-ui` `--text-2`, icon 16 `--text-3`, status slot 20. Hover `--hover`.
Shown tab: `--raised` with an inset 1 px `--border`; in the pane used last, `--accent-soft` with an
inset 1 px `--border-strong` and the icon in `--accent`. Preview tabs italic. Working: the twinkle in
the status slot; unread: a 6 px accent dot; unsaved: an 8 px `--text-2` dot.

### 6.3 Buttons
Primary: `--accent` fill, `--text-on-accent`, 500. Secondary: transparent with a 1 px `--border-strong`
outline (an engraved line, not a filled box). Quiet: text only. Heights 28 / 32, radius sm (radius
full in the focus header and toasts). Icon 16 with 6 before the label. Icon buttons 28 or 24 with a
label and tooltip.

### 6.4 Chips
Pills: 24 tall, radius full, 1 px `--border`, `--t-ui` 12 / 500. Topic chip: direction dot + short
title; auto-filed: dashed `--border-control` and an italic serif "auto". Needs-you chip: `--gold-soft`
fill, `--gold` text, no border. Context chips (marginalia): radius sm, `--sunken`, a small-caps serif
key then the value. Suggestion chips (starters, routing): 28 tall, radius full, transparent with a
hairline; selected: accent outline on `--accent-soft`.

### 6.5 Inputs
Inputs and selects 32, radius sm, `--sunken`, 1 px `--border-control`; focus: `--accent` border plus
the ring. Segmented controls are pills: track `--sunken` with an inset hairline, selected segment
`--raised` with a `--border-strong` ring.

### 6.6 Composer
`--raised`, 1 px `--border-strong`, radius lg, padding 14 16 10, `--shadow-2`. Focus-within:
`--accent` border, 4 px `--accent-soft` ring. Text 15 / 23 sans. Controls row 32, gap 6: attach icon
button; topic and model as pill quiet buttons with chevrons; Discuss | Team segmented; hint
(`--t-meta`); Send 32 round in `--accent` with a 4 px `--accent-soft` halo. The team composer is the
same at one line.

### 6.7 The sky band (Desk)
An SVG band, 330 tall (240 without a draft or when the pane is under 900 wide), full content width,
`preserveAspectRatio="xMidYMax meet"`, drawn in a 1000 × 330 viewBox:

- A **dome**: the horizon at y = 312 (hairline `--sky-line-2` with tick marks every 110 units, the
  center tick taller); three concentric arcs (`--sky-line`); dotted meridians between sectors.
- **Sectors**, one per direction in root order, spanning the dome from left horizon to right horizon
  in proportion to each direction's topic count, each filled with its `--nX` at `--wash` opacity.
  The direction's name sits just inside the outer arc at the sector's middle angle, in `--t-cap` at
  11.5 px with +0.14 em tracking, `--text-3`.
- **Stars**: one per topic, inside its sector; radius from 1.7 (quiet) to 2.6 (active this week) by
  the newest Current work date; `--star`. Topics linked parent → branch are joined by 1 px
  `--sky-line-2` lines (`fill: none`). A dozen dust stars at 35 % opacity, deterministic from the
  topic count.
- A soft radial glow (`--accent` at 16 % → 0) centered on the horizon behind the greeting.
- **The routed star** (SPEC DK-12): its radius grows to 3.6 in `--accent` with a 16-radius halo
  (`--glow`), its title appears above it in italic serif 12.5, and a dashed light path (1.3 px, dash 2
  gap 5, flowing) runs from the horizon's center to it as a cubic curve.
- Hovering any star shows its title and opens a small card (title, direction, last activity, Open,
  Discuss) after 300 ms; stars are keyboard focusable buttons with labels.
- The greeting block (kicker in `--t-cap`, greeting in `--t-display`) is centered with its baseline
  near y = 200; stars are kept out of a 360 × 110 box around it by the layout function.

### 6.8 The almanac (Desk)
Three equal columns under a top hairline, separated by vertical hairlines; padding 18 24 0. Heading:
`--t-cap` at 15 / 20, `--text-1` (Needs you in `--gold`), an italic count, and a quiet link at the
right. Rows are **leader rows**: 40 tall — status mark, title (`--t-body`), a dotted leader (1 px dots
every 6 px in `--border-strong`) that fills the space, then an italic serif time or a small secondary
button. Empty state: one italic serif line.

### 6.9 Lists (Discussions)
Rows 58: status mark, title (500 when unread), unread dot, italic time at the right; second line
chips and the question in `--t-meta`. Rows separated by inset hairlines that disappear around a
hovered row; hover `--hover`, radius md. Filter column 228: items 32, small-caps group headings,
italic counts.

### 6.10 The constellation (Team room)
SVG, 230 tall, in the band's left column (≥ 360 wide). The **lead** at the center: 6.5 radius in
`--accent` with a 22 halo and a twinkle above it while it works. **Members** on an ellipse (rx 0.35 ×
width, ry 0.31 × height) evenly from 200° clockwise, colored by seat slot (`--n1`…), radius 5.5,
each wrapped by a 13-radius **progress ring** (2.2 stroke: the share of its tasks completed, starting
at 12 o'clock, over a `--sky-line-2` track) and a twinkle while working. Labels under each star: name
in `--t-cap` 13 and one line of `--t-meta` 10.5 (state and current task). **Light paths**: 1.4 px
dashed accent curves, flowing, from author to referee for each review in progress and from author to
lead for each submitted report awaiting routing; at most six; each curve bows away from the center.
Faint graticule ellipses behind. Stars are focusable buttons; a visually hidden list repeats every
seat's name, role, model, state and task.

### 6.11 Pipeline (Team room Flow)
As before, with: header row 30 tall, `--t-cap` names, italic counts, a `--border-strong` rule; stage
cells joined to the previous column by a 10 px hairline "track"; cells `--raised`, radius sm, padding
6 9; id in mono 11 / 600; verdict pills (accepted and holds in `--success-*`, review and needs-work in
gold, in progress in accent, submitted neutral); not reached: dashed hairline, italic serif text.

### 6.12 Logbook (Team room right column)
300 wide, `--surface`, left hairline, padding 20, sections 22 apart: **Needs you** (gold small-caps
heading; rows on `--gold-soft`, radius md, padding 10 12, an icon, the text, a secondary button),
**Logbook** (`state.md`: foldable sections in serif 14 with italic counts, entries as serif lines on
hairlines with a status mark and mono references), **Charter** (serif 14 `--text-2` and a link).

### 6.13 Dialogs and the crew builder
Dialog `--raised`, radius lg, `--shadow-3`; header 60 with a `--t-h2` title; footer 64 with a summary
line at the left and the actions at the right. The team dialog is 900 wide: the form (left) and the
**crew** (right, 340, `--surface`): a live mini constellation (120 tall) that redraws as seats change,
template chips, seat cards (`--raised`, radius md, padding 10: seat glyph 28, name in small caps,
remove; model and effort selects), Add a member, and the referee hint in italic serif.

### 6.14 Reading: the light table
A PDF page is paper (`#FFFFFF`, ink `#1B1B1F`) on the light table: a radial gradient from `--sunken`
to `--table`, padding 28 24, page shadow `0 0 0 1px rgba(0,0,0,.04), 0 2px 4px rgba(0,0,0,.14),
0 18px 48px rgba(0,0,0,.28)`. The PDF toolbar is 36 tall with an italic serif "page 3 of 12".

### 6.15 Toasts, focus header, palette, banners, tooltips, empty and loading states
Toast and focus header are pills (`--raised`, `--shadow-2`). The palette: 640 wide, input 52 tall at
17 px, small-caps group headings, rows 36. Banners: one line, radius md, `--gold-soft` / `--accent-soft`
/ `--danger-soft`. Tooltips: `--raised`, `--shadow-2`, radius sm, `--t-meta`. Empty states: one
italic serif line in `--text-3`. Loading: a 2 px top progress bar or skeleton rows; never a spinner
over a pane.

## 7. Layout patterns

- **Desk**: sky band (focal), composer on the horizon, routing chips, almanac (calm).
- **Team room**: main column (constellation band + mission, then the pipeline, then the composer)
  and the logbook column.
- **Reader**: the content on its surface or the light table; marginalia chips above; 72 ch measure.
- **List place**: filter column 228 and a list with a serif page title.
- Under 640 px of tab width, side columns move below the main column, and filter columns become a
  select.

## 8. Data visualization

The sky band, the Map, the constellation and the pipeline follow the dataviz method: categorical
colors in fixed order (§2.3), never cycled; status colors only with labels; a text alternative for
every drawing (the Desk's topic list in the palette and the Map's list, the constellation's hidden
seat list, the Board and Timeline views); hover details on every mark.

## 9. Do and don't

| Don't | Do |
| --- | --- |
| A long side column of mixed lists | One focal element balanced by a calm information area |
| Gray boxes inside boxes | Space, then a tinted hairline |
| Ornament for its own sake | Ornament that shows data (routing, team state, structure) |
| A sans everywhere | The serif for the research, the sans for controls |
| Rainbow or generated hues | The validated nebula palette, in order |
| Gold as decoration | Gold only for what needs the researcher |
| Anything that moves without meaning | Twinkle for working, flowing light for work in flight |
| Spinners over panes | A top progress bar or skeleton rows |
| Raw hex, px or ms in CSS | Tokens; new values only through this file |
