# Implementation Plan: Temples 1.0

## Architecture Overview

Temples 1.0 is a declarative templating base class (`TemplesComponent`) for Web Components.
It replaces the jQuery-based original with a standards-compliant implementation using the Web Component lifecycle.

```
User authors a component:
  <component>.html    → markup with data-bind/data-iterate/data-render-if
  <component>.js      → event handler map
  <component>.css     → tag-scoped styles
  index.ts            → class definition + TemplesComponent.define() assembly

TemplesComponent (the engine):
  ┌─────────────────────────────────────────────────────┐
  │  TemplesComponent.define()                          │
  │    → parse template HTML into <template> (once)     │
  │    → customElements.define()                        │
  │                                                     │
  │  connectedCallback()                                │
  │    → clone template.content into Light DOM          │
  │    → registerEvents(host, events)                   │
  │    → aggregate attributes → this.data               │
  │    → render() — walk bindings, apply values         │
  │                                                     │
  │  attributeChangedCallback()                         │
  │    → update this.data with new attribute value      │
  │    → render() — re-render affected bindings         │
  │                                                     │
  │  disconnectedCallback()                             │
  │    → remove event listeners                         │
  └─────────────────────────────────────────────────────┘

Binding Engine (used by render/update):
  → resolve data paths (dotted notation) against this.data
  → data-bind: set text/html/attribute/class values
  → data-iterate: clone sub-template per collection item
  → data-render-if: show/hide based on boolean condition
```

## Module Breakdown

### 1. `TemplesComponent` base class (`index.ts`)
The core engine. Contains:
- `static define()` — template parsing + custom element registration
- `static observedAttributes` — subclass-overridden attribute list
- `connectedCallback` — template cloning, event registration, initial render
- `disconnectedCallback` — cleanup
- `attributeChangedCallback` — aggregate attribute → `this.data`, trigger render
- `render()` (internal) — full binding walk and apply
- `update(propertyPath, value)` (internal) — partial binding update
- `this.data` (private) — aggregated state from attributes + internal enrichment

### 2. Binding engine (inside `TemplesComponent`)
The sub-system that walks the DOM tree and resolves bindings:
- **Path resolver** — resolves dotted paths (`article.title`) against `this.data`
- **`data-bind` handler** — typed bindings (`value=`, `text=`, `html=`, `<attr>=`), shorthand, multiple bindings, special `class[a|b|c]` syntax
- **`data-iterate` handler** — collection iteration, variable naming (`:` / `from` / auto), `data-each` synonym, first-child as sub-template
- **`data-render-if` handler** — boolean conditional show/hide

### 3. `registerEvents()` helper
Standalone exported function:
- Takes `(host, eventMap)` where eventMap is `{ "eventType selector": handler }`
- Queries selectors within the host, attaches listeners
- Returns cleanup function for `disconnectedCallback`

### 4. Flipping-card example component
The reference implementation demonstrating all features:
- `example/components/flipping-card/` — all four files (html, js, css, index.ts)
- `example/index.html` — demo page using the component

### 5. Project tooling
- `package.json` scripts: `dev`, `test`, `lint`, `typecheck`, `demo`
- Bun test setup (`*.test.ts` files alongside source)
- Type checking via `bun tsc`

## Implementation Order

Tasks are ordered by dependency — each builds on the previous.

```
Phase 1: Foundation
  T1: Project tooling setup (package.json scripts, test config)
  T2: TemplesComponent skeleton + define() + template cloning
  T3: registerEvents() helper

Phase 2: Binding Engine (thin vertical slices, test each)
  T4: data-bind — simple text/html bindings + shorthand
  T5: data-bind — typed bindings (value=, attr=) + multiple bindings
  T6: data-bind — special class[a|b|c] syntax
  T7: data-iterate — collection iteration + variable naming + synonyms
  T8: data-render-if — conditional rendering

Phase 3: Reactivity
  T9: Attribute aggregation → this.data + attributeChangedCallback re-render
  T10: update() — partial path patching + targeted re-render

Phase 4: Example & Polish
  T11: Flipping-card example component (all four files)
  T12: Demo page (example/index.html) + bun demo script
  T13: Final README review + example/README.md fill
```

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| `data-iterate` template cloning is complex (must store original template, re-clone on update) | Implement T7 with TDD; store the original first-child as a `<template>` fragment for re-stamping |
| `class[a\|b\|c]` parsing is fiddly (regex edge cases) | Write exhaustive unit tests for the parser before wiring into the binding engine |
| Light DOM template stamping may conflict with user-provided children | Document clearly that template replaces children; test with pre-existing children case |
| Bun HTML import behavior may differ from expected (string vs. parsed nodes) | Verify with a simple import test in T2 before building on it |
| `update()` partial re-render needs to find the specific DOM element bound to a path | Maintain an internal binding map (path → element) during `render()` for O(1) lookup |

## Verification Checkpoints

After each phase, verify before proceeding:

- **After Phase 1:** A custom element can be defined, instantiated in a test DOM, and its template content appears as children. Events fire and call handlers.
- **After Phase 2:** All binding types work in isolation — unit tests for each `data-*` attribute against mock data.
- **After Phase 3:** Attribute changes trigger automatic re-render; `update()` patches a single path without full re-render.
- **After Phase 4:** The flipping-card demo works end-to-end in a browser (verified with `agent-browser` or manual `bun demo`).

## Open Questions

These were identified during the spec interview and need resolution during implementation:

1. **Attribute value types** — HTML attributes are always strings. How should non-string values (arrays, objects, numbers, booleans) be handled? Options: JSON-encoded attributes, comma-separated arrays, or a component-level `parseAttribute(name, value)` hook. Default assumption: string values, component enriches `this.data` via internal logic.

2. **Import path for `TemplesComponent`** — The README uses `import { TemplesComponent } from "./Temples"`. The actual export is in `index.ts`. Should we rename `index.ts` → `Temples.ts`, or export from `index.ts` and adjust import paths? Resolve during T1.

3. **`render()` / `update()` TypeScript visibility** — They are conceptually internal but event handlers (standalone functions) need to call them on the `host` instance. `protected` won't work (handlers aren't methods). Likely solution: public methods documented as internal, or a privileged `internals` object passed to handlers. Resolve during T3.

4. **`data-iterate` re-rendering** — When a collection changes, the old cloned items must be removed and new ones stamped. The binding map needs to track iterated blocks specifically. Resolve during T7.
