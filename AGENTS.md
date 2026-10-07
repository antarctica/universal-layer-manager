# Agent instructions

Universal Layer Manager is a TypeScript monorepo. `@ulm/core` owns layer state. `@ulm/leaflet` pushes that state onto a Leaflet map. Examples are demos, not the library.

## Defaults

- Smallest change that solves the task. Read the code you touch and match its names and layout.
- No git, commit, push, PR, or publish unless the prompt asks.
- No `any`. No `React.FC`. React imports use `import * as React from 'react'`.
- Comments are rare. Add one only when the code cannot show the reason.

The public API is [`LayerManager`](packages/core/src/LayerManager.ts). It calls methods on [`LayerManagerAdapter`](packages/core/src/adapters/types.ts). [`LeafletLayerManagerAdapter`](packages/leaflet/src/leaflet-adapter.ts) is the Leaflet implementation. A new map library is a new adapter, not a branch inside core.

Machines live in `packages/core/src/layerMachines/` and `layerManagerMachines/`. This repo uses XState 5. Read the [XState docs](https://stately.ai/docs/xstate) before you change a machine.

## Tests

New behaviour is test-driven. One behaviour at a time:

```
RED:      one test → it fails
GREEN:    the smallest code that passes
REFACTOR: one Fowler move, tests stay green
```

Do not write the whole test file first.

A test describes behaviour a caller can observe: a layer appears, visibility changes, the map gains a layer. It does not mention private functions, machine context fields, or the order of internal calls. A rename or an extracted function leaves the test green. If a refactor keeps the behaviour and the test fails, the test is tied to the implementation. Change the test.

Test through `LayerManager` and assert on that result. Machine tests in [`packages/core/test/`](packages/core/test) are only for actor rules `LayerManager` does not expose. Use the helpers in [`packages/core/test/utils/layer-manager-helpers.ts`](packages/core/test/utils/layer-manager-helpers.ts).

Leaflet tests drive the manager and assert on a real Leaflet map in headless Chromium, through Vitest browser mode. Follow [`packages/leaflet/test/leaflet-adapter.test.ts`](packages/leaflet/test/leaflet-adapter.test.ts). Do not mock the map library or load a basemap over the network.

The expected value is a literal you know is right. Do not compute it with the same formula as the code under test. Run `npm test`.

## Structure

Refactor with Martin Fowler's catalogue: [refactoring.com/catalog](https://refactoring.com/catalog/). One move at a time, and only while the tests are green. Name the move in the reply (Extract Function, Rename Variable, Move Function, Inline Function). Do not mix a refactor with a behaviour change, and do not refactor code the task did not touch.

Use a pattern from [Patterns.dev](https://www.patterns.dev/) only when the problem matches it. This library already uses an adapter (`LayerManagerAdapter`), a push-style observer (`LayerManager` calls the adapter), and a factory (`LeafletLayerFactory`).

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
