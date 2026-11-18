# How this team writes things down

Atlas reads these files to show the team's work to the researcher. Keep the front matter exact;
write the account below it in Markdown with LaTeX. Paths are relative to the run directory.

Numbering: reports `R01, R02, …` in `reports/NN-<seat>-<slug>.md` (NN is the number without the R;
`00-lead-closing.md` is the lead's closing report); reviews `V01, …` in
`reviews/NN-<seat>-on-RNN.md`; decisions `D01, …` in `decisions/DNN-<slug>.md`. Take the next free
number when you create a file.

## Report (members, and the lead's closing report)

```yaml
---
kind: report
id: R03
seat: theorist
task: task-4                 # the board task it answers, if any
title: One line saying what was found
status: submitted            # draft | submitted | accepted | needs-work | rejected | superseded
claims:
  - id: R03.1
    text: One checkable statement.
    basis: derived           # derived | computed | cited | conjectured
assumptions: [each assumption the claims need]
evidence: [work/theorist/file.md#where, results paths, sources with equation or page]
checks: [what you actually checked, and how]
open: [what remains unresolved]
implication: What this means for the topic's main note, in one or two sentences.
---
```

Only the lead changes `status` after submission (to accepted, needs-work, rejected or superseded).

## Review (the referee)

```yaml
---
kind: review
id: V02
seat: referee
on: R03
verdict: holds               # holds | holds-with-changes | fails | cannot-check
claims: { R03.1: holds }     # each claim: holds | fails | unverified
findings:
  - severity: major          # blocking | major | minor
    where: R03, eq. (7)
    text: What is wrong or missing, and what would settle it.
---
```

## Decision request (the lead)

```yaml
---
kind: decision
id: D01
from: lead
status: open                 # open | answered | withdrawn
question: The decision, as a question the researcher can answer.
options:
  A: First option, with its consequence (an exact command if it is a job).
  B: Second option.
recommendation: B
---
```

Atlas appends the researcher's answer as `## Answer (<date>, researcher)` and sets `status:
answered`; the answer also reaches the lead as a message.
