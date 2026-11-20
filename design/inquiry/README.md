# Atlas 1.1 research inquiry · candidate walkthrough

This change keeps the existing Desk, one Atlas sidebar entry, the ordinary DSH transcript, and the native team room. No daily DSH profile was installed into or restarted. All screenshots here come from a disposable local DSH session with explicitly scripted answers about a synthetic Schwarzschild–AdS example; they contain no user chat, solver results or live-model scientific evaluation.

## Try it

From this checkout with Node 22+ and the supported DSH runtime:

```sh
npm run build
npm run preview:inquiry
```

Open the private local URL it prints, then **Atlas → Desk → Discuss**. Choose the schematic AdS topic. The launcher prints four messages for one discussion: learn what a radial profile represents, map two routes, edit a proposed team without starting it, then inspect the prepared schematic and its data. Leave the preview with `q` + Enter or Ctrl+C. Starting the standard preview will not activate this scenario.

## What to look for

1. Open **Frame the inquiry**: today's question need not be the research horizon. Add an earlier excerpt. A pasted URL is a pointer; a separate opt-in for an exact public ChatGPT share URL asks the model to read it anonymously if supported. An inaccessible conversation must not be reported as read.
2. Open **Branching routes** and expand a step: inspect a status, assumptions, and actual cited files. A prose-only answer is valid. After a teaching follow-up the prior route may remain labelled as such; the old proposal cannot be launched from it. Corrections are sent to the same conversation.
3. Select **Review team proposal…** to edit first tasks and the acceptance test. Inspect the brief or cancel. Only **Start the team** creates the registered run and asks DSH to start its lead. The proposal, a partially started team, an authored report and a scientific result are different things.
4. Select real team reports and reviews in the original inquiry, then explicitly request assessment. File revisions and the original session are rechecked. Follow citations or choose **Explain this step**; Atlas never treats a review verdict as certification. Missing prerequisites for a plot produce a limitation, not a made-up curve.

[View the actual Desk before sending](screens/desk-night-1440.png).

| Day | Night |
| --- | --- |
| [Questions and route, 1440px](screens/routes-day-1440.png) | [Questions and route, 1440px](screens/routes-night-1440.png) |
| [Expanded fork at 1024px](screens/routes-day-1024.png) | [Expanded fork at 1024px](screens/routes-night-1024.png) |
| [Team proposal, not started](screens/proposal-day.png) | [Team proposal, not started](screens/proposal-night.png) |
| [Schematic samples](screens/schematic-day.png) | [Schematic samples](screens/schematic-night.png) |

## Verification and limits

- `npm test` reported **242 passed, 0 failed, 1 opt-in Chromium check skipped** (243 total); rerunning the contrast suite with `ATLAS_M4_CONTRAST_UI=1` also passed the skipped check in Chromium (5/5). It checks the generated client and regression suite. New cases cover seed limits and sharing opt-in, assistant-only settled transcript records, stale action retirement, citation scope, scoped draft recovery, duplicate starts and changed evidence, and chart data validation.
- `node test/inquiry-ui.mjs` drives a real DSH host and browser against a local scripted model, including an actual confirmed launch, selected fixture reports returned to the originating discussion, and a schematic read from files. It checks no team exists before confirmation. Screenshots are visible-region crops; chart rows and report/review files were authored for the test, not produced by a scientific team.
- `npm run test:dsh -- dist/aitp-atlas-1.1.0-rc.1.tgz` passed all 15 offline packed-bundle checks (including reinstall and workspace restart) in isolated headless/web/Desktop profiles, with synthetic Skills. No change to the original 1.0.0 archive or launcher.
- The lead's initial directions are part of the native first message, not a hidden system hook. The bracketed model records project only when a supported model emits them. Session guidance does not override DSH's permission settings. No model-quality, public-link availability or physics-accuracy claim follows from these tests.
