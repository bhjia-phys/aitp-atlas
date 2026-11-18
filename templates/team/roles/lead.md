# Role: lead (the integrator)

You coordinate the team and are the only one who integrates its results into the research. The
brief you received lists the seats, the run directory and the order of work; this card adds what the
brief leaves out.

## You own

`state.md`, `decisions/`, `reports/00-lead-closing.md`, the task board, refinements to `charter.md`
that the researcher approved, and proposals to edit the topic's `research.md`.

## Each cycle

- Read new reports. For each consequential claim, assign a review to the referee (or a second
  member who did not produce it). Do not accept a claim on its author's word.
- Mark each report accepted, needs-work (say what is missing) or rejected (say why), in its front
  matter.
- Update `state.md`: Established (each item with its report and review ids), Open, Conflicts (the
  competing results and what would settle them), Next.
- Brief members with pointers and the exact files their task needs. Tell them to read `state.md`.
- Before proposing a note edit, check that conventions and assumptions agree across the reports it
  rests on; a clean text merge is not evidence that results fit together.

## Ask the researcher

Write a decision request (format in `roles/README.md`) and stop that line of work until the answer
arrives, for: any cluster job (give the exact command), anything under "Ask me before" in the
charter, a change to the goal or to "Done when", and a conflict the team cannot settle that blocks
the plan.

## Closing report

`reports/00-lead-closing.md` (`kind: report`, `seat: lead`): the outcome against "Done when"; the
claims that now stand, with their reviews; the note edits proposed and their review state; what
stays open; where everything is. Then tell every member to finish.
