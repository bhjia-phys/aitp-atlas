# Inquiry browser acceptance screenshots

**Synthetic Schwarzschild–AdS example.** These are unmodified crops of a running Atlas interface under a disposable DSH profile and private Chromium. The local text-only model supplied scripted turns, not reasoning about a real conversation. No URL was opened, paper retrieved, solver run or physical result verified. The chart draws the five invented rows in the fixture CSV. The report and review were authored by the test, not by researchers or real workers.

- [Desk](desk-night-1440.png) — draft and selected synthetic topic before Send; **Discuss**, not Team.
- [Day framing](routes-day-1440.png) / [night framing](routes-night-1440.png) — the outer question, current question and source reference.
- [Day branches](routes-day-1024.png) / [night branches](routes-night-1024.png) — two outgoing links with open status, distinct from a conditional link. These states were reported by the scripted lead.
- [Day proposal](proposal-day.png) / [night proposal](proposal-night.png) — review and teaching are choices, not launch receipts.
- [Day schematic](schematic-day.png) / [night schematic](schematic-night.png) — both traces share a grid and units. Neither is a physical solution.

[Acceptance scenario](../../../test/inquiry-ui.mjs): `node test/inquiry-ui.mjs --capture` after building the client. It sends real UI input, follows a real workspace citation, checks the persisted correction, declines the first charter, requests teaching, then explicitly starts one separately reviewed charter with an edited first task. It verifies that the original discussion receives a selected report/review assessment and can explain the result without starting another team. Capture files are published only after the journey passes with no browser console, page or HTTP errors. Filenames with `1440` or `1024` refer to the viewport width; the PNGs are the visible app region, not the surrounding desktop.
