# Implementation Plan: Temples 1.0

## Architecture Overview

Temples 1.0 is a declarative templating engine for HTML. It is a rewriting of the original [Temples](https://github.com/zipang/Temples/tree/v0) template system, with jQuery replaced by a standard, DOM-based engine.

The core is a standalone, DOM-based engine that three consumer surfaces share :

- The `Temples` object with `prepare()` / `render()` / `renderToString()` for direct use in the browser and for server-side rendering (SSR) in Bun, Node.js, or Deno.
- The `TemplesComponent` base class for Web Components.
- The jQuery plugin export (`temples/jquery`).

```
Standalone engine (DOM-based, shared):
  ┌────────────────────────────────────────────────────────────┐
  │  Renderer (per template)                                   │
  │    template source: DOM element | HTML string | #id        │
  │    render(data)   → walk bindings, apply values            │
  │    update({path: value}) → partial re-render (binding map) │
  │    toHtml() / renderToString() → serialized HTML           │
  │    destroy()                                              │
  │                                                            │
  │  Temples registry                                          │
  │    prepare(name, source) / register(...)                   │
  │    render(name, data) / renderToString(name, data)         │
  │    update(name, partial) / destroy(name)                   │
  └────────────────────────────────────────────────────────────┘

Consumers:
  TemplesComponent (browser)      Temples / Renderer (direct)     jQuery plugin
    lifecycle hooks                 Temples.renderToString           $.fn.temples(data)
    engine over its own root        SSR via ./ssr entry              jQuery peer dep

Binding Engine (inside Renderer):
  → resolve data paths (dotted notation) against data
  → data-bind: text/html/value/attr/class bindings, shorthand, multiple, class[a|b|c]
  → data-iterate: clone sub-template per collection item (all syntax variants)
  → data-render-if: show/hide based on boolean condition
```

## Module Breakdown

### 1. Core engine — `Renderer` (`src/renderer.ts`)
The standalone, DOM-based engine. Contains:
- Template parsing: accept a DOM element or an HTML string, parse the string once into a container.
- Path resolver — resolves dotted paths (`article.title`) against data, evaluates function values.
- `data-bind` handler — typed bindings (`value=`, `text=`, `html=`, `<attr>=`), shorthand, multiple bindings, special `class[a|b|c]` syntax.
- `data-iterate` handler — collection iteration, variable naming (`:` / `from` / auto), `data-each` synonym, first-child as sub-template.
- `data-render-if` handler — boolean conditional show/hide.
- `render(data)` — full binding walk and apply.
- `update({ path: value })` — partial binding update via the internal binding map (path → element).
- `toHtml()` / `renderToString()` — serialized HTML of the rendered template.
- `destroy()` — release bindings (fights zombie templates).

### 2. `Temples` registry (`src/temples.ts`)
The static API, faithful to the original:
- `prepare(name, source)` and `register(name, source)` (synonym) — `source` is a DOM element, an HTML string, or a `#id` selector (browser only).
- `render(name, data)` — returns the updated template DOM.
- `renderToString(name, data)` — returns the serialized HTML string.
- `update(name, partial)` — partial re-render.
- `destroy(name)` — release the registered renderer.

### 3. `TemplesComponent` base class (`index.ts`)
A thin consumer of the core engine. Contains:
- `static define()` — template parsing + custom element registration.
- Lifecycle hooks — `connectedCallback`, `disconnectedCallback`, `attributeChangedCallback`.
- `render()` (internal) — delegates to the engine over its own root.
- `update(path, value)` (internal) — convenience wrapper over the engine's partial update.
- `this.data` (private) — aggregated state from attributes.

The component's `render()` and `update()` stay internal to the component. The same binding engine is public through the `Temples` object and the `Renderer` class.

### 4. SSR entry (`src/ssr.ts`)
Wires the engine to linkedom so string templates parse and serialize on the server without a browser.
- Export path: `temples/ssr`.
- Enables `Temples.prepare(name, htmlString)` and `Temples.renderToString(name, data)` on the server.
- The main entry must not statically import linkedom, so browser bundles stay clean.

### 5. jQuery plugin (`src/jquery.ts`)
- Export path: `temples/jquery`.
- Registers `$.fn.temples(data)` — renders data into each matched element.
- `$.fn.temples()` returns the prepared Renderer.
- jQuery is a peer dependency. Only this entry touches `$`.

### 6. `registerEvents()` helper (`src/register-events.ts`)
- Takes `(host, eventMap)` where eventMap is `{ "eventType selector": handler }`.
- Queries selectors within the host, attaches listeners, returns a cleanup function.

### 7. Flipping-card example component
The reference implementation demonstrating all features:
- `example/components/flipping-card/` — all four files (html, js, css, index.ts).
- `example/index.html` — demo page.

### 8. Project tooling
- `package.json` `exports` map with `sideEffects` flags for tree-shaking.
- Scripts: `dev`, `test`, `lint`, `typecheck`, `demo`.
- Bun test setup (`*.test.ts` files alongside source).
- Type checking via `tsc --noEmit`.

## Implementation Order

Engine first, consumers second. Each consumer builds on the standalone engine.

```
Phase 1: Foundation
  T1: Project tooling (scripts, exports map skeleton)

Phase 2: Core engine (DOM-based, browser)
  T2: Renderer skeleton + template sources (element | string) + data-bind text/html + shorthand
  T3: data-bind typed bindings + multiple + class[a|b|c]
  T4: data-iterate (all variants) + data-render-if
  T5: update({path: value}) partial re-render via binding map
  T6: Temples registry + toHtml()/renderToString()

Phase 3: SSR
  T7: ./ssr entry — linkedom wiring; prepare(string) + renderToString on the server

Phase 4: Web Component
  T8: TemplesComponent skeleton + define() + template cloning + engine-backed render
  T9: registerEvents() helper + event map wiring
  T10: attribute aggregation → this.data + attributeChangedCallback + update(path, value)

Phase 5: jQuery plugin
  T11: ./jquery entry — $.fn.temples(data); jQuery peer dep

Phase 6: Example & Polish
  T12: Flipping-card example
  T13: Demo page + bun demo script
  T14: README + example/README review
```

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `data-iterate` template cloning is complex (must store original template, re-clone on update) | Implement with TDD; store the original first-child as a `<template>` fragment for re-stamping |
| `class[a\|b\|c]` parsing is fiddly (regex edge cases) | Write exhaustive unit tests for the parser before wiring it into the engine |
| linkedom serialization may differ from the browser (entities, attribute order, void tags) | Round-trip tests that compare browser and server serialization on the same template and data |
| The main bundle may include linkedom or jQuery, breaking tree-shaking | Separate entry points (`./ssr`, `./jquery`) plus `sideEffects` flags; verify with a build check |
| jQuery peer dependency missing → plugin import fails | Detect the absence of `$` and throw a clear error |
| Light DOM template stamping may conflict with user-provided children | Document that the template replaces children; test with pre-existing children |
| `update()` partial re-render needs to find the specific DOM element bound to a path | Maintain an internal binding map (path → element) during `render()` for O(1) lookup |

## Verification Checkpoints

After each phase, verify before proceeding:

- **After Phase 2:** A template prepared from an HTML string and from a DOM element renders identical output. All binding types pass unit tests.
- **After Phase 3:** The same template and data produce identical HTML from the browser path and the SSR path (`renderToString`).
- **After Phase 4:** A custom element renders from its template, attributes trigger re-render, events fire and call handlers.
- **After Phase 5:** `$('.list').temples(data)` renders data into each matched element.
- **After Phase 6:** The flipping-card demo works end-to-end in a browser (verified with `agent-browser` or manual `bun demo`).

## Open Questions

Resolved during the plan review:

1. **Engine encapsulation** (RESOLVED) — The binding engine is a standalone `Renderer` / `Temples` module, shared by the web component, direct use, and the jQuery plugin.
2. **Server DOM strategy** (RESOLVED) — Single DOM-based engine. The `./ssr` entry wires linkedom for server-side rendering. `renderToString` works in the browser and on the server.
3. **Component SSR** (RESOLVED — not included) — `TemplesComponent` stays browser-only. The standalone engine covers the SSG use case.
4. **`render()` / `update()` visibility** (RESOLVED) — The component's `render()` / `update()` stay internal to the component and delegate to the engine. The engine is public through `Temples` and `Renderer`.
5. **`update()` semantics** (RESOLVED) — The engine uses the original `{ path: value }` map form. The component keeps the `(path, value)` pair as a convenience wrapper.

Still open:

6. **Attribute value types** — HTML attributes are always strings. How should non-string values (arrays, objects, numbers, booleans) be handled? Options: JSON-encoded attributes, comma-separated arrays, or a component-level `parseAttribute(name, value)` hook. Default assumption: string values, component enriches `this.data` via internal logic.
7. **Import path for `TemplesComponent`** — The README uses `import { TemplesComponent } from "./Temples"`. The actual export is in `index.ts`. Should we rename `index.ts` → `Temples.ts`, or export from `index.ts` and adjust import paths? Resolve during T1.
8. **`data-iterate` re-rendering** — When a collection changes, old cloned items are removed and new ones stamped. The binding map tracks iterated blocks. Resolve during T4/T5.