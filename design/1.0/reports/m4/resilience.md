# M4 · Optional DSH services (QB-3)

**Result:** all five isolated browser fault cases passed. Losing AI or layout capabilities did not take down Atlas. A missing model operation did not silently change a saved preference or create a stray session.

| Capability withheld from Atlas alone | Observed in Chromium |
| --- | --- |
| `sessions` | Desk explained why discussions cannot start; its composer was disabled. Library navigation, opening the synthetic paper, and PDF.js rendering page 1 still worked. |
| `layout` | Focus still worked within Atlas. Its notice said the DSH sidebar would remain as it was. Escape exited Focus and Library was still reachable. |
| `remote.agentTeams` | The team sheet stayed readable and explained that Agent Teams was unavailable. **Start the team** stayed disabled with a filled question, stopping condition and selected topic. No lead was created and the host team registry stayed empty. |
| `remote.session.modelCatalog` only | A persisted explicit choice remained visible with an unavailable-catalog reason. Neither Send nor Enter created a session. Selecting **Use DSH default** enabled Send; exactly one session was created and the visible transcript contained both this test question and the fixture model's reply. |
| `remote.session.selectModel` only | Same no-orphan and explicit-default checks, with a switching-specific reason. The catalog remained readable; that by itself was not permission to mutate a session's model. |

## Evidence and scope

Run from the repository root with Node, an installed DSH, and a local Chromium/Chrome/Edge:

```sh
node --test test/m4-degraded.test.mjs
node test/m4-degraded-ui.mjs
```

The [browser gate](../../../../test/m4-degraded-ui.mjs) used the shared [headless browser runner](../../../../test/ui-smoke.mjs) and [private DSH preview](../../../../scripts/preview.mjs), with real React, real Atlas slot registration, actual fixture host endpoints, a local fake model and a fresh Chromium profile. Only the temporary staged client was instrumented: it passed Atlas a restricted view of Cordis and counted its calls to session creation. It did **not** unload required services from the host shell or install a permanent test mode. The final run reported **zero browser console, page and HTTP errors**. This fault gate tests current client source, not the byte identity of the shipping bundle; normal unmodified distribution smoke tests remain separate.

The [lifecycle tests](../../../../test/m4-degraded.test.mjs) use a documented-shape **mock** context to drive registration, overlapping replacement, disposal and a catalog response arriving after its service disappeared. They do not simulate DSH actually uninstalling a plugin during an active model turn. Together with the targeted session-binding, team-start, client, context, preview and sky suites, **60 tests passed**. No ordinary profile, session history, or research tree was used.

## Contract and behavior

The inspected installation was DSH **0.2.2-rc.3**. Client Service Inspect timed out; the public contracts were checked against the shipped session-controller session reference implementation, model-selection catalog/directory, Agent Teams mount and layout package documentation. In particular, catalog reads do not need a session ID; selection mutates one named session; the native Teams UI injects `remote.agentTeams` before invoking `setEnabled(sessionId, enabled)`.

Only `slots` is mandatory in the [Atlas plugin entry](../../../../client/90-register.js). Optional sessions/workspace and team availability changes invalidate the mounted view, rather than replacing the panel or its tabs. An embedded conversation releases its old provider's reference on replacement. Catalog loss and mutation loss have distinct [model-selection behavior](../../../../client/62-models.js); the [Desk](../../../../client/21-desk.js) and [discussion startup](../../../../client/60-threads.js) both guard an explicit override before creating a session. A valid default session needs neither a model lookup nor a mutation. Team creation still requires a verifiable lead route: a missing catalog is not license to guess one.
