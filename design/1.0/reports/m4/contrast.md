# M4.1 · Contrast and reduced motion (QB-1)

**Pass for Atlas's two shipped palettes and the tested control states.** Auto selects one of those palettes; it is not a third palette. User-defined colors, third-party DSH conversation internals and user document/PDF contents are outside this claim. This is not a claim that every pixel or screen meets WCAG.

## Method and evidence

[The regression](../../../../test/m4-contrast.test.mjs) parses the product tokens, composites each foreground/background alpha in sRGB over its real base, linearizes each channel (`c/12.92` below .04045; otherwise `((c+.055)/1.055)^2.4`), then uses `(lighter+.05)/(darker+.05)` with WCAG luminance coefficients. Assertions use the unrounded result: 4.5 for text including metadata and labels; 3 for control outlines, focus and meaningful marks. Positive/negative calibration includes black/white = 21 and `#777` on white = 4.478 (fails 4.5).

- Sweep: `bg`, `surface`, `raised`, `sunken`, alone and with hover, pressed, selected, accent-soft, gold-soft, danger-soft and success-soft. Role-specific tests check each status ink against its meaning-matched wash; primary/text-on-accent including hover, gold-on, search marks, paper ink, code tokens and eight named nebula slots plus overflow.
- Separately, private DSH + Chromium measured **computed styles from the rebuilt plugin**, not mockup or injected CSS. The fixture's actual Desk composer and textarea supplied body/placeholder, resting border and focused border colors. Inert semantic specimens mounted inside the fixture's Atlas root supplied otherwise unavailable button/select/checkbox, badge and motion states using shipped component classes. Their CSS was not overridden. A keyboard-only walk is a separate acceptance check.
- Reduced-motion emulation in both moods: six marks (working tab, almanac mark, running discussion, constellation twinkle, active edge and Desk route path) had an animation with no preference; all six had `animation-name: none` with reduce. Buttons had zero transition duration. An independent function test observed a section link requesting `instant` rather than `smooth` *and keeping its static landing mark*. Static status labels and connecting paths remain present.

| Worst tested ratio | Observatory | Engraved chart |
|---|---:|---:|
| Primary / secondary / tertiary text on flat and tinted surfaces | 11.040 / 6.383 / 4.651 | 10.939 / 5.764 / 4.602 |
| Status text on matching semantic washes | 6.664 | 4.584 |
| Code text on flat surfaces | 4.783 | 4.807 |
| Solid fills: primary, gold, search mark, paper | 9.749 | 6.782 |
| Interactive boundary | 3.181 | 3.246 |
| Accent focus indicator | 6.664 | 5.178 |
| Labelled status marks (non-text) | 3.181 | 3.174 |
| Topic/seat identity marks on surface/sunken | 3.657 | 3.281 |

**Computed samples (night / day):** Desk placeholder 6.17 / 6.71; secondary button outline against raised 4.22 / 4.74; Desk composer outline against surface 4.55 / 4.50, changing to 9.54 / 7.18 on focus. Primary text 9.75 / 7.62; warning text 8.79 / 5.87, success 7.48 / 5.93 and error 10.24 / 6.69. Inputs, selects and checkboxes passed on both sides of their boundary. Zero browser console/page errors and zero HTTP errors during this run.

## Corrections and decisions

- Raised night surfaces plus the accent wash reduced tertiary text to **4.272**; a day frame plus danger wash gave **4.042**. Adjusted muted ink in both palettes. Day success on its surface wash was **4.432**; day code comments on sunken **4.046**. Adjusted semantic ink/marks where needed, keeping the reference hues and nebula order. The assembly error now uses error *text* rather than the danger boundary pigment.
- Day's legacy gold waiting dot against the frame was **1.488**; idle **2.062**. Adjusted the status/idle and overflow markers. No chart palette was cycled or regenerated. Every dot tested as a status mark also has a text label; the first letter in a seat glyph is ordinary text ink, not the rim's categorical color.
- The former translucent hairlines were suitable for layout, not for finding the edge of a text field or selected option. Secondary button borders (including hover), the selected segment's rim and the composer now use `border-control`. Card outlines, graticules, separators and inset shadows stay decorative; they are not counted as control edges or focus indicators. Quiet/icon controls use their visible label/icon and an accent focus indicator. Disabled states are excluded from the enabled-control minimum.
- Explicit smooth scroll ignored the OS preference even with CSS animations disabled. Section reveals now query the target's owning window; reduced CSS also disables transitions/animations on pseudo-elements. Reduced motion does not erase the destination highlight.

## Reproduce

```powershell
node --test test/m4-contrast.test.mjs                   # no browser needed
$env:ATLAS_M4_CONTRAST_UI='1'                           # rebuilt client.js and isolated preview required
node --test test/m4-contrast.test.mjs                   # all five checks, both palettes
Remove-Item Env:ATLAS_M4_CONTRAST_UI
```

The isolated run passed **5/5**; the browser option uses only a fresh local Chromium profile, disposable DSH profile, fixture and mock. It does not install or test on the researcher's profile.
