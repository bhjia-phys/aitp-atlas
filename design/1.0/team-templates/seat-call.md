How Atlas renders one line of `{{seatCalls}}` in the lead brief (one per seat, in charter order).

With a model chosen for the seat:

```
- subagent(name="{{name}}", description="{{role}} for: {{goalShort}}. Read {{runDir}}/roles/{{name}}.md first.", provider="{{provider}}", model="{{model}}", reasoning_effort="{{effort}}")
```

With "Same as the lead" (omit the route fields so DSH uses the lead's route):

```
- subagent(name="{{name}}", description="{{role}} for: {{goalShort}}. Read {{runDir}}/roles/{{name}}.md first.")
```

A one-shot seat adds, after the call: `  (one-shot: give it one task; it finishes after reporting)`.

`goalShort` is the goal cut at 120 characters on a word boundary. Names follow DSH's rule
`^[a-z][a-z0-9-]{0,31}$` and are never `lead`.
