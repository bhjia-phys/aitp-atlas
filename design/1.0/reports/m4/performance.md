# QB-2 — tab, Desk and routing performance

**Result:** In the measured Windows desktop fixture, all 40 retained-tab switches reached the next frame in less than 50 ms with both original transcript nodes intact. The configured Desk reached its first ready frame within 300 ms of all eight warm overview responses. Route service and rendering finished well within 150 ms **after dispatch**, but no keystroke-to-suggestion sample met 150 ms: the specified 250 ms debounce is part of the user-visible wait. Seven open discussions retained six transcript bodies. Geometry changes inside both a hidden discussion and a hidden Desk caused zero layout passes in the sample.

## Environment and reproduction

Run `node test/m4-performance-ui.mjs` from the repository with a built `client.js`, installed DSH and Chromium-compatible browser. The [benchmark](../../../../test/m4-performance-ui.mjs) launches the [private preview](../../../../scripts/preview.mjs) and a fresh headless browser, creates seven real DSH sessions using the local fixture model, and removes the profile at exit. It does not install anything, use a real account or seed React state. Measurements are logged with every sample in acquisition order; milliseconds are rounded to one decimal, percentiles use nearest rank.

Full run: Windows `10.0.26200`, i9-13900HX (32 logical CPUs), DSH desktop executable product version `0.2.2.0`, Chrome `157.0.8103.79`, Node `v24.14.0`, viewport 1568 × 897 CSS pixels (DPR 1), built client SHA-256 prefix `6b6b9681bd63`. No network or CPU throttling; loopback fixture, foreground tab. No browser, page or HTTP errors. These results are not a claim about cold app startup, production research tree sizes, remote inference or a low-power mobile display.

## Latencies

| Boundary | n | Min | p50 | p95 | Max | Count within target |
|---|---:|---:|---:|---:|---:|---|
| Trusted tab click → next frame showing the chosen retained transcript | 40 | 10.5 | 12.1 | 13.8 | 14.2 | 40/40 < 50 ms |
| Overview response end → first frame with configured Desk sky and enabled composer | 8 | 21.1 | 25.5 | 43.5 | 43.5 | 8/8 < 300 ms |
| Last trusted input → route request start (debounce + scheduling) | 12 | 251.6 | 254.4 | 256.9 | 256.9 | DK-12 specifies a 250 ms pause |
| Route request start (`requestStart`) → first response byte | 12 | 0.6 | 0.8 | 2.5 | 2.5 | 12/12 < 150 ms |
| Route resource start → response end | 12 | 1.4 | 1.7 | 3.5 | 3.5 | — |
| Route resource start → first frame showing the new suggestion | 12 | 5.9 | 9.2 | 16.2 | 16.2 | 12/12 < 150 ms |
| Last trusted input → first frame showing the new suggestion | 12 | 258.5 | 263.6 | 272.6 | 272.6 | **0/12 < 150 ms** |

The benchmark timestamps inside the page, not around CDP calls or test waits. A ready frame is a `requestAnimationFrame` callback that sees the requested tab selected and its panel visible, or sees the expected Desk/suggestion DOM. It measures the browser's next rendering opportunity, **not** monitor scanout. Desk samples are separate page reloads in the same private session with an already-warm host index; they exclude network time before `overview.responseEnd`. Time to first byte includes loopback transport and host scheduling, not just routing CPU. Each routing sample types three edits 25 ms apart and verifies that exactly one request was issued for the final text. For small n the nearest-rank p95 equals the maximum: all samples count, not just the best frame.

For run-to-run context, a second private profile using the prior built client `df83607c5051` measured retained-tab p50/p95/max **16.8/24.5/28.2 ms** (40/40 < 50), Desk **31.0/36.9/36.9 ms** (8/8 < 300), and last-input-to-suggestion **263.8/271.3/271.3 ms** (0/12 < 150). These runs are not pooled; no causal speedup is inferred from the different builds.

## Identity, eviction and hidden work

- Alternating between two already-retained real discussions 40 times preserved both exact assistant link DOM objects (`isConnected` and identity under their original panel); the test waits for the complete reference link before measuring. Provider eviction at capacity is deliberately measured separately from ordinary switches.
- Seven open conversation panels had exactly six retained providers **and six actual transcript body elements**. Session 1 (the oldest hidden one) had been evicted; reopening it displayed its existing assistant reply.
- After replies settled, the probe alternated padding in a real transcript subtree and read Chrome's renderer-wide `Performance.LayoutCount` before and after three frames. Ten hidden edits produced `[0,0,0,0,0,0,0,0,0,0]`; ten visible edits of the same kind produced `[1,1,1,1,1,1,1,1,1,1]`. Repeating in the Desk composer (a browsing panel, not a transcript) gave the same hidden/visible arrays. Every hidden tab wrapper computed to `content-visibility: hidden`. No geometry reads on hidden descendants were used to force layout. This demonstrates skipped layout in these samples, not zero JS, memory, or all possible host activity.

**Acceptance boundary:** Treat the 150 ms route target as request-to-result if retaining DK-12 unchanged. If 150 ms is intended from the last input, QB-2 remains unmet by design even with an instantaneous route handler. No product change or debounce bypass was made for the benchmark.
