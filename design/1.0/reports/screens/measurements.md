# M1 — independent browser measurements, 0.10.0

The version was read from **More → About Atlas** in the private synthetic DSH fixture, not inferred from a manifest. The images here show the actual mounted panel. An independent temporary, incognito Chromium context captured PNGs at device scale 1; no message was sent, no research note was changed. No personal DSH or browser profile was inspected.

| Prior issue | 0.10.0 result |
| --- | --- |
| P2 — narrow Map | At 1024×768 with host sidebar expanded, Split leaves 344 px per pane. Labels now render at **11.5 CSS px** (formerly 3.96) and all five interactive circles are **32×32 CSS px** (formerly 6.88×6.88); centre-point hit tests resolve to the circles. Long labels abbreviate or are omitted to avoid collisions. Down opens a star's details and focuses Open; Esc returns to that star. Topic list names all five. [Split](m1-split-night-1024.png) |
| P3 — truncated programme/date | At 1440×900, Day and Night show the entire date: width/scrollWidth **400/400 px** (previously 320/344). At 1024×768 the 688 px single pane still yields **320/344 px**, so truncation is still present there. [Day, wide](m1-desk-day-1440.png) · [Night, narrow](m1-desk-night-1024.png) |
| P3 — undiscoverable palette filters | The visible footer now names `# topics`, `@ discussions & teams`, and `> commands`. `#worm` yielded two topic results. The palette was 640 px wide and began at y=108 in a 900 px viewport. [Palette](m1-palette-night-1440.png) |

At 1440 px, the host starts with a 280 px sidebar and Atlas has a 56 px rail, a 40 px strip, and a 720 px composer. Almanac is three columns (about 347 px each); at 1024 px it becomes two columns of 312 px. Neither document gained horizontal overflow. See [Night, wide](m1-desk-night-1440.png) and [Day, narrow](m1-desk-day-1024.png).

- **Focus:** expanded sidebar 280 → 56 → 280 px; already collapsed 56 → 56 → 56. Focus hid the Atlas rail and strips; Map occupied 1384×900. Esc closed the palette before leaving Focus. [Focus](m1-focus-night-1440.png)
- **Navigation:** clicked Discussions, Teams, Learn, Write and Search; their respective panel content rendered. A native Chromium drag moved Search from the left tab strip to the right after Map (verified both strips before and after).
- **Network/console:** packaged Roman and Italic Source Serif 4 returned HTTP 200 `font/woff2`, both font faces `loaded`. No HTTP ≥400, console errors/warnings, uncaught page exceptions or off-origin page requests observed on these paths. This is not a test of sending or editing.
