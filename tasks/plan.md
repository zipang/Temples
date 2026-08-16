# Implementation Plan: Temples 1.0

## Architecture Overview

Temples 1.0 is a declarative templating engine for HTML. It is a rewriting of the original [Temples](https://github.com/zipang/Temples/tree/v0) template system, with jQuery replaced by a standard, DOM-based engine.

The core is a standalone, DOM-based engine that three consumer surfaces share :

- The `Renderer` class for direct use in the browser and for server-side rendering (SSR) in Bun, Node.js, or Deno.
- The `TemplesComponent` base class for Web Components.
- The jQuery plugin export (`temples/jquery`).

The v0 name-based `Temples` registry (`prepare()`, `register()`, `render(name, ...)`, `renderToString(name, ...)`, `destroy(name)`) is **deprecated and removed**. It stored Renderer instances by name, and a forgotten `destroy(name)` left zombie templates. Direct `Renderer` instances are owned by the caller, so no registry and no `destroy()` are needed.

```
Standalone engine (DOM-based, shared):
  ┌────────────────────────────────────────────────────────────┐
  │  Renderer (per template)                                   │
  │    template source: DOM element | HTML string              │
  │    render(data)   → render only the paths present in data  │
  │    toHtml() / renderToString() → serialized HTML           │
  └────────────────────────────────────────────────────────────┘

Consumers:
  TemplesComponent (browser)      Renderer (direct)              jQuery plugin
    reactive state                  Renderer.renderToString        $.fn.temples(data)
    lifecycle hooks                 SSR via ./ssr entry           jQuery peer dep

Binding Engine (inside Renderer):
  → resolve data paths (dotted notation) against data
  → data-bind: text/html/value/attr/class bindings, shorthand, multiple, class[a|b|c]
  → data-iterate: keyed reconciliation per collection item (all syntax variants)
  → data-render-if: show/hide based on boolean condition
```

## Module Breakdown

### 1. Core engine — `Renderer` (`src/engine.ts`)
The standalone, DOM-based engine. Contains:
- Template parsing: accept a DOM element or an HTML string, parse the string once into a container.
- Path resolver — resolves dotted paths (`article.title`) against data, evaluates function values.
- `data-bind` handler — typed bindings (`value=`, `text=`, `html=`, `<attr>=`), shorthand, multiple bindings, special `class[a|b|c]` syntax. The shorthand (no `=`) defaults to `text=` semantics for non-input elements (a deliberate, safer deviation from the original v0, which defaulted to `html=`) and to `value=` semantics on form controls (INPUT, TEXTAREA, SELECT).
- `data-iterate` handler — collection iteration with **keyed reconciliation**. Rows are tracked by a key (`data-key` attribute or item `id`); re-render inserts/removes/moves only changed rows, preserving input focus and scroll. Variable naming (`:` / `from` / auto), `data-each` synonym, first-child as sub-template.
- `data-render-if` handler — boolean conditional show/hide.
- `render(data)` — renders only the paths present in the data. `update(path, value)` re-renders the bindings affected by that path.
- `toHtml()` / `renderToString()` — serialized HTML of the rendered template.
- No `destroy()` — the caller owns the renderer and releases it by dropping the reference.

### 2. v0 `Temples` registry — removed
The v0 name-based `Temples` registry is **deprecated and removed**. Storing Renderer instances by name invites zombie templates when `destroy(name)` is forgotten. The caller holds a `Renderer` directly instead.

### 3. Reactive state — `reactive()` (`src/reactive.ts`)
A deep `Proxy` wrapper that notifies subscribers when any nested property or array element changes. The component subscribes its render effect; any mutation of `this.state` triggers a re-render. This replaces the old `this.data` + `update(path, value)` model.

### 4. `TemplesComponent` base class (`src/component.ts`)
A thin consumer of the core engine. Contains:
- `static tag` / `static template` / `static events` / `static observedAttributes` / `static attributeTypes` fields.
- `static define()` — ensures a `<template id="tag">` exists in the document head, then calls `customElements.define(this.tag, this)`.
- Templates live in the document head, keyed by tag name (`template#<tag>`), so they are inspectable and never re-parsed. `define()` inserts them; `connectedCallback` clones `template.content` into the component body.
- Rendering targets an internal container rather than the host element, so a parent component can feed a child through `data-bind` without the child's renderer stripping those attributes.
- Lifecycle hooks — `connectedCallback`, `disconnectedCallback`, `attributeChangedCallback`.
- `this.state` — a reactive proxy; mutations re-render automatically.
- `emit(name, detail)` / `on(name, handler)` — messaging over a shared event bus. `emit` names the message `<tag>:<name>`; `on("<tag>:<name>", handler)` subscribes and returns an unsubscribe function.
- Attribute values are coerced via `attributeTypes` and written into `state`.

The old `this.data`, `render()`, and `update()` public methods are **removed**. State lives in `this.state`; rendering is driven by reactive mutations.

### 5. Events — document-level delegation (`src/component.ts`)
- Each event type registers **one** listener on `document`, shared by every component class and instance. `define()` registers a listener for every event type in the class `events` map; listeners are deduplicated by event type.
- Handlers receive `(event, component)` — the `Event` first, the resolved component second — so handlers can call `preventDefault()`, read `event.target.value`, and target individual list items.
- The listener resolves the **closest** `TemplesComponent` ancestor of the event target via `composedPath()` and consults only that component's `events` map. Outer components are untouched when the innermost component has no matching selector.
- Selectors are matched within the resolved component's subtree (`matchesSelector` walks the composed path from the target up to the component).
- Document listeners persist for the lifetime of the document. Because the listener reads `component.constructor.events` at event time, a hot-reloaded class with updated `events` is picked up without re-registering.
- `registerEvents` is **removed** from the public API; `EventMap`/`EventHandler` types are exported from `component.ts`.

### 6. SSR entry (`src/ssr.ts`)
Wires the engine to linkedom so string templates parse and serialize on the server without a browser.
- Export path: `temples/ssr`.
- Enables `new Renderer(htmlString)` and `renderer.renderToString()` on the server.
- The main entry must not statically import linkedom, so browser bundles stay clean.

### 7. jQuery plugin (`src/jquery.ts`)
- Export path: `temples/jquery`.
- Registers `$.fn.temples(data)` — renders data into each matched element.
- `$.fn.temples()` returns the prepared Renderer.
- jQuery is a peer dependency. Only this entry touches `$`.

### 8. TODO app example (integration test)
The reference implementation is a multi-component TODO app that runs against the built `dist/` with **no bundling**:
- `example/index.html` loads `../dist/index.js` via `<script type="module">`.
- Components are plain ESM `.js` files with inline template strings and linked `.css`.
- Demonstrates reactive state, keyed lists, two-way input, form `submit` with `preventDefault`, and `emit`/`on` messaging between components.

### 9. Project tooling

**Source and output layout**
- TypeScript sources live in `src/`. Tests (`*.test.ts`) sit alongside their source file.
- `src/index.ts` is the package's main entry source and aggregates the full public API.
- The build compiles the sources into `dist/` as ready-to-use JavaScript. `dist/` is gitignored and never committed.

**Build process (decision)**
- Build tool: `bun build` (not `tsc` — `tsc` is typecheck-only with `noEmit: true`).
- The build script runs three steps in order:
  1. `tsc --noEmit` — fail the build on type errors.
  2. Browser-targeted build for the main entry, the engine, and the jQuery plugin:
     `bun build src/index.ts src/ssr.ts src/jquery.ts --outdir dist --format esm --target browser --packages external --entry-naming "[name].[ext]"`
  3. Node-targeted build for the SSR entry (linkedom):
     `bun build src/ssr.ts --outdir dist --format esm --target node --packages external --entry-naming "[name].[ext]"`
- `--packages external` keeps `jquery` and `linkedom` as runtime imports instead of bundling them. This keeps the browser bundle clean and satisfies the jQuery peer-dependency contract.
- `--entry-naming "[name].[ext]"` flattens the output so every entry lands directly in `dist/`.
- The output files are `dist/index.js`, `dist/engine.js`, `dist/ssr.js`, `dist/jquery.js`.

**Public exports (decision)**
- `src/index.ts` exports the full public API: `Renderer`, `TemplesComponent`, `reactive`, `EventMap`, `EventHandler`, `MessageHandler`, and the data types.
- `package.json` declares `"sideEffects": false` so bundlers can tree-shake.
- The `exports` map points to the built `.js` files in `dist/`, never to TypeScript sources:
  - `.` → `./dist/index.js`
  - `./engine` → `./dist/engine.js`
  - `./ssr` → `./dist/ssr.js`
  - `./jquery` → `./dist/jquery.js`
- Separate subpath entries make tree-shaking work: importing `temples` never pulls in linkedom or jQuery.

**Type declarations (decision — deferred)**
- `bun build` does not emit `.d.ts` files. Exports are JavaScript-only for now. Generating publishable declarations is a follow-up before release.

**Test setup (decision)**
- `bun test` is scoped to `src/` via `bunfig.toml` (`root = "src"`, `preload = ["./test/setup.ts"]`).
- Tests import source modules by relative path, never by package name.

**Scripts**
- `dev` — `bun --hot example/index.html`
- `test` — `bun test`
- `lint` — `biome lint .`
- `format` / `format:check` — Biome format in place / check-only
- `check` — `biome check .`
- `typecheck` — `tsc --noEmit`
- `build` — typecheck then the two `bun build` steps above
- `demo` — `bun run build` then serve `example/` statically

## Implementation Order

Engine first, consumers second. Each consumer builds on the standalone engine.

```
Phase 1: Foundation
  T1: Project tooling (scripts, exports map skeleton)

Phase 2: Core engine (DOM-based, browser)
  T2: Renderer skeleton + template sources + data-bind text/html + shorthand
  T3: data-bind typed bindings + multiple + class[a|b|c]
  T4: data-iterate (all variants) + data-render-if
  T5: render(data) renders only the paths present in the data
  T6: Renderer toHtml()/renderToString() (serialization)
  T7: Engine correctness fixes (keyed reconciliation, boolean attrs, select, parseLoop, render-if, render clearing, toElement, properties)

Phase 3: SSR
  T8: ./ssr entry — linkedom wiring

Phase 4: Reactive state + Web Component
  T9: reactive() proxy utility
  T10: TemplesComponent reactive state + define()

Phase 5: Events & messaging
  T11: registerEvents() — (event, host) signature
  T12: emit()/on() messaging

Phase 6: jQuery plugin
  T13: ./jquery entry — $.fn.temples(data)

Phase 7: Tree-shakeable build
  T14: Build + public exports + sideEffects

Phase 8: Example (TODO app, integration test)
  T15: TODO app example — no bundling
  T16: README + example/README review
```

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Keyed reconciliation is complex (must track rows by key, diff insert/remove/move) | Implement with TDD; store the sub-template once and reconcile against a keyed row map |
| `class[a\|b\|c]` parsing is fiddly (regex edge cases) | Write exhaustive unit tests for the parser before wiring it into the engine |
| linkedom serialization may differ from the browser (entities, attribute order, void tags) | Round-trip tests that compare browser and server serialization on the same template and data |
| The main bundle may include linkedom or jQuery, breaking tree-shaking | Separate entry points (`./ssr`, `./jquery`) plus `sideEffects: false`; verify with a build check |
| jQuery peer dependency missing → plugin import fails | Detect the absence of `$` and throw a clear error |
| Light DOM template stamping may conflict with user-provided children | Document that the template replaces children; test with pre-existing children |
| Reactive proxy may miss mutations (array `splice`, `delete`, nested assignment) | Cover `set`, `deleteProperty`, and array-mutating methods in the proxy traps; unit-test each |
| Attribute→state coercion (boolean/number/json) may mis-parse values | Centralize coercion in one `coerceAttribute` helper; unit-test `"true"`/`"false"`/numbers/JSON |

## Verification Checkpoints

After each phase, verify before proceeding:

- **After Phase 2:** A template prepared from an HTML string and from a DOM element renders identical output. All binding types pass unit tests. Keyed reconciliation preserves DOM identity across list edits.
- **After Phase 3:** The same template and data produce identical HTML from the browser path and the SSR path (`renderToString`).
- **After Phase 4:** A custom element renders from its template, `state` mutations trigger re-render, attributes flow into `state` with coercion.
- **After Phase 5:** Events fire with `(event, host)`; `emit`/`on` deliver messages across components.
- **After Phase 6:** `$('.list').temples(data)` renders data into each matched element.
- **After Phase 7:** `dist/index.js` exports the full API and contains no linkedom/jquery.
- **After Phase 8:** The TODO app runs in a browser from `dist/` with no bundling (verified with `agent-browser`).

## Open Questions

Resolved during the plan review:

1. **Engine encapsulation** (RESOLVED) — The binding engine is a standalone `Renderer` module, shared by the web component, direct use, and the jQuery plugin.
2. **Server DOM strategy** (RESOLVED) — Single DOM-based engine. The `./ssr` entry wires linkedom for server-side rendering.
3. **Component SSR** (RESOLVED — not included) — `TemplesComponent` stays browser-only. The standalone engine covers the SSG use case.
4. **State model** (RESOLVED) — Reactive proxy. `this.state` is a deep `Proxy`; mutations re-render automatically. The old `this.data` + `update(path, value)` model is removed.
5. **Event handler signature** (RESOLVED) — Handlers receive `(event, component)`, the `Event` first and the resolved component second. Registration is document-level: one listener per event type, resolving the closest component ancestor.
6. **Inter-component messaging** (RESOLVED) — A shared module-level event bus. `emit(name, detail)` delivers a message named `<tag>:<name>`; `on("<tag>:<name>", handler)` subscribes and returns an unsubscribe function. Any component can talk to any other regardless of class or DOM position; the tag prefix avoids name collisions.
7. **List rendering** (RESOLVED) — Keyed reconciliation in `data-iterate`. Rows are tracked by key (`data-key` or item `id`).
8. **Attribute value types** (RESOLVED) — Observed attributes write raw strings into `state` by default; an optional `static attributeTypes` map coerces `boolean`/`number`/`json` values.
9. **`define()` shape** (RESOLVED) — Static `tag`/`template`/`events`/`observedAttributes`/`attributeTypes` fields; `TodoApp.define()` registers the element. The redundant class parameter is dropped.
10. **Re-render granularity** (RESOLVED) — Reactive mutation triggers a full re-render; keyed reconciliation preserves DOM identity. Path-targeted updates are a later optimization, not a correctness requirement.
11. **Shorthand binding default** (RESOLVED) — The `data-bind` shorthand (no `=`) defaults to `text=` for non-input elements and `value=` on form controls.
12. **Iterate context** (RESOLVED) — `data-iterate` renders each item with the variable merged into a shallow copy of the data dictionary, so the caller's data object is never mutated.
13. **`data-render-if` hiding** (RESOLVED) — A falsy condition hides the element with `display: none`; a visible state is restored when the condition turns truthy, even for elements authored `display:none`.
14. **v0 `Temples` registry** (RESOLVED — deprecated) — Removed. Direct `Renderer` instances are caller-owned.
15. **Example as integration test** (RESOLVED) — The TODO app example runs against the built `dist/` with no bundling (no Bun `.html`/`.css`/`.ts` import magic).
