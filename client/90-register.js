// ---------------------------------------------------------------- register ---
// One entry in the left sidebar, opening Atlas in the main area. The main area
// declares a session-scoped child slot, so DSH's own conversation can sit in
// the companion pane beside a document (the recipe of DSH's subagent pane).

return {
  inject: ['slots'],
  apply(ctx) {
    pluginCtx = ctx;
    injectStyles();
    // For development: with localStorage `aitp-atlas:debug` set, the console can reach DSH's services.
    try {
      if (window.localStorage.getItem('aitp-atlas:debug')) window.__aitpAtlas = { svc, team: () => teamScope };
    } catch {
      // Storage may be unavailable; the hook is only a convenience.
    }
    ctx.slots.inject('sidebar.panellist', () =>
      ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_KEY, order: 58, label: () => 'Atlas' }, AtlasIcon));
    ctx.slots.inject('main', () =>
      ctx.slots.register({ name: 'main', key: PANEL_KEY, children: { [CONVERSATION_SLOT]: { kind: 'single', scope: 'session' } } }, function AtlasMain(props) {
        const kit = useMemo(() => ({ SessionProvider: props.SessionProvider, renderSlot: props.renderSlot }), [props.SessionProvider, props.renderSlot]);
        return h(SlotKit.Provider, { value: kit }, h(Boundary, null, h(AtlasApp)));
      }));
    ctx.slots.inject(CONVERSATION_SLOT, () =>
      ctx.slots.register({ name: CONVERSATION_SLOT }, AtlasConversationPanel));
    // Optional chrome services may appear or be disposed after Atlas mounts.
    for (const name of ['layout', 'shortcuts']) ctx.inject([name], scope => {
      scope.effect(() => atlasBindChromeService(name, scope.get(name)), 'aitp-atlas: ' + name);
    });
    // Agent Teams, the way DSH's own team control reaches it; absent, Atlas starts no teams.
    ctx.inject(['remote', 'remote.agentTeams'], (scope) => {
      scope.effect(() => {
        teamScope = scope;
        return () => {
          if (teamScope === scope) teamScope = null;
        };
      }, 'aitp-atlas: agent teams');
    });
  },
};
