# @embeddr/zen-shell

The plugin host and windowing runtime for Embeddr.

Zen Shell provides the infrastructure that lets Embeddr load, render, and manage plugins as floating panels — including UMD bundle loading, a draggable window manager, a tiling layout engine, WebSocket connectivity, and a global event bus.

## What's in here

| Area | Path | Purpose |
| --- | --- | --- |
| Shell | `src/shell/ZenShell.tsx` | Root shell component — mounts providers, plugin runtime, panel manager |
| Panels | `src/panels/` | Draggable floating panels, panel manager, UMD panel host |
| Plugin runtime | `src/runtime/`, `src/plugins/` | UMD bundle loading, manifest parsing, plugin registry, error boundaries |
| Tiling layout | `src/layouts/tiling.tsx` | `TilingLayout` component for grid-based panel arrangement |
| Event bus | `src/events/event-bus.ts` | Global typed event bus; `core-ui-event-bridge` bridges to embeddr-core events |
| Providers | `src/providers/` | WebSocket, theme, toast, and shell context providers |
| Stores | `src/stores/` | Zustand stores for panel state and global shell state |
| Hooks | `src/hooks/` | `useTheme`, `useLocalStorage`, `useScreenSafeArea` |
| Client | `src/client/` | Plugin-scoped API factory and adapter (sandboxes plugin API calls) |

## Usage

Zen Shell is a source-only package — it has no build step and is consumed by packages that do their own bundling (currently `embeddr-frontend`).

```ts
import { ZenShell } from '@embeddr/zen-shell'
import { globalEventBus } from '@embeddr/zen-shell'
import { TilingLayout } from '@embeddr/zen-shell'
```

The `ZenShell` component is the top-level host. Mount it inside your app's providers:

```tsx
<ZenShell pluginManifestUrl="/api/v1/plugins/manifest" />
```

## Plugin system

Plugins are loaded as UMD bundles at runtime. Each plugin declares a manifest that describes its panels, capabilities, and required permissions. The runtime:

1. Fetches the plugin manifest from the embeddr-cli API
2. Loads UMD bundles via dynamic `<script>` injection (`umd-loader.ts`)
3. Registers panel types in the plugin registry (`registry.ts`)
4. Renders panels inside `UmdPanelHost` with a scoped API surface (`api-factory.ts`)

Plugins receive a sandboxed `EmbeddrPluginApi` object — they cannot access the broader app directly.

## Event bus

A global typed event bus decouples plugin panels from the shell and from each other:

```ts
import { globalEventBus } from '@embeddr/zen-shell'

// Emit
globalEventBus.emit('artifact:selected', { id: '...' })

// Subscribe
const off = globalEventBus.on('artifact:selected', ({ id }) => {
  console.log('artifact selected:', id)
})

// Cleanup
off()
```

The `CoreUiEventBridge` component wires embeddr-core WebSocket events into the event bus automatically when mounted inside `ZenShell`.

## Tiling layout

`TilingLayout` arranges children in a responsive grid. Panels registered as "tiling" panels are managed through this layout rather than the floating panel manager:

```tsx
import { TilingLayout } from '@embeddr/zen-shell'

<TilingLayout columns={2}>
  <MyPanel />
  <AnotherPanel />
</TilingLayout>
```

## WebSocket

`WebSocketProvider` maintains a persistent WebSocket connection to the embeddr-cli server and reconnects automatically. Components and plugins can subscribe to real-time events (execution progress, artifact updates) via the event bus bridge.

## Relation to other packages

```text
embeddr-core          (domain models, plugin interfaces)
    ↓
embeddr-plugins       (21+ bundled plugins, UMD bundles)
    ↓
embeddr-cli           (FastAPI server, serves plugin manifests + UMD bundles)
    ↓
@embeddr/react-ui     (shared component library)
    ↓
@embeddr/zen-shell    (plugin host, windowing runtime)  ← you are here
    ↓
embeddr-frontend      (main React app, mounts ZenShell)
```

## License

Copyright 2026 Embeddr Labs and Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this project except in compliance with the License.
You may obtain a copy of the License at:

<http://www.apache.org/licenses/LICENSE-2.0>
