# Task List: Temples 1.0

Tasks are ordered by dependency. Each task is completable in a single focused session.
Follow `test-driven-development`: failing test first, then implementation.

---

## Phase 1: Foundation

- [x] **T1: Project tooling setup**
  - Acceptance: `package.json` has working `dev`, `test`, `typecheck`, `demo` scripts. The `exports` map lists `./engine`, `./ssr`, and `./jquery` entry points (files may be empty stubs). `bun test` runs (even with 0 tests). `bun run typecheck` passes with no errors.
  - Verify: `bun test` and `bun run typecheck` both exit 0.
  - Files: `package.json`, `tsconfig.json` (if adjustments needed)

## Phase 2: Core Engine

- [x] **T2: Renderer skeleton + template sources + basic data-bind**
  - Acceptance: `new Renderer(source)` accepts a DOM element or an HTML string. The string form is parsed once into a container. `render(data)` walks `data-bind` elements and sets text content for bare paths (shorthand) and innerHTML for `html=`. Shorthand defaults to text for non-input elements; the input→value shorthand arrives in T3 with `value=`. There is no `#id` selector form (deprecated with the `Temples` registry).
  - Verify: Unit test prepares the same template from an HTML string and from a DOM element, renders both with `{ title: "Hello", content: "<b>World</b>" }`, and asserts identical text and innerHTML.
  - Files: `src/engine.ts`, `src/engine.test.ts`

- [x] **T3: data-bind typed bindings + multiple + class[a|b|c]**
  - Acceptance: `value=`, `text=`, `<attr>=` typed bindings work. Multiple bindings separated by commas work together. `class[article|quote|tweet]=article.type` toggles the matched class value and preserves other classes.
  - Verify: Unit test with `<img data-bind="src=user.avatar, title=user.name">`, `<input data-bind="value=user.name">`, and the class-toggle div — asserts attributes, value, and class list against mock data. Test a second data set for the class toggle.
  - Files: `src/engine.ts`, `src/engine.test.ts`

- [x] **T4: data-iterate + data-render-if**
  - Acceptance: `data-iterate="quote: article.quotes"` clones the first child per item, binding `quote`. Auto-naming drops trailing `s` (`article.tags` → `tag`). `data-each` and `from` variants work. `data-render-if` shows/hides based on a truthy condition; function values are called.
  - Verify: Unit test with a 3-item array asserts 3 cloned children with correct bound values, for all syntax variants. Two `data-render-if` elements, one truthy, one falsy.
  - Files: `src/engine.ts`, `src/engine.test.ts`
  - Notes: Done in three slices. Slice 1 = iterate machinery + `name: path` + auto-naming. Slice 2 = `from` keyword + `data-each` synonym. Slice 3 = `data-render-if` (truthy/falsy, function conditions, re-render flip, combination with `data-bind`). Combining `data-render-if` with `data-iterate` on one element is not implemented (v0 supports it; deferred).

- [x] **T5: render only the paths present in the data (unified full/partial render)**
  - Acceptance: `render(data)` resolves every dotted path present in `data` and applies only the operations bound to that exact path; absent paths keep their current state. A partial dictionary re-renders only the paths it carries. `update(path, value)` re-renders only the binding for that exact path (e.g. `"article.title"`), replacing the flat dotted-path delta. An internal path → operation map gives O(1) lookup. Iterate seeds and render-if conditions participate through the same map.
  - Verify: Unit test renders two bindings then a single-path update, asserting only that element changes. Tests cover untouched absent paths, explicit empty-value clearing, iterate re-stamp, and render-if re-evaluation.
  - Files: `src/engine.ts`, `src/engine.test.ts`, `README.md`

- [x] **T6: Renderer toHtml()/renderToString() serialization**
  - Acceptance: `Renderer#toHtml()` returns the serialized HTML of the rendered root. `renderToString()` is a synonym for `toHtml()`. There is no `Temples` registry and no `destroy()` (the v0 name-based registry is deprecated and removed).
  - Verify: Unit test renders a template from an HTML string and a DOM element, and asserts the serialized output matches expected markup.
  - Files: `src/engine.ts`, `src/engine.test.ts`

- [x] **T7: Engine correctness fixes (from adversarial review)**
  - Acceptance:
    - `data-iterate` uses keyed reconciliation: rows are tracked by a key (`data-key` attribute or item `id`); re-render inserts/removes/moves only changed rows, preserving input focus and scroll.
    - Boolean attributes (`checked`, `disabled`, `hidden`) toggle via the DOM property, not `setAttribute` (presence-based).
    - `<select>` shorthand sets the selected option, not an inert `value` attribute.
    - `parseLoop` no longer mis-parses `from`/`:` inside a path (`messages.from.user`); auto-naming only strips a plural `s` (`status` stays `status`).
    - `data-render-if` restores a visible state even when the element is authored `display:none`.
    - `render()` clears bindings whose value is `null`/`undefined` (not just `""`).
    - `toElement` rejects or documents multi-root string sources instead of silently dropping siblings.
    - `properties.ts` uses strict array-index detection (drop the `parseInt` heuristic).
  - Verify: Unit tests for each fix. `bun run check` and `bun run typecheck` pass.
  - Files: `src/engine.ts`, `src/utilities/properties.ts`, `src/engine.test.ts`

## Phase 3: SSR

- [x] **T8: ./ssr entry — linkedom wiring**
  - Acceptance: Importing `temples/ssr` sets up a linkedom-backed DOM so `new Renderer(htmlString)` renders and `renderer.renderToString()` serializes on the server without a browser. The main entry does not statically import linkedom.
  - Verify: Unit test run on the server creates a Renderer from an HTML string and asserts `renderToString` output matches the browser path on the same template and data. Round-trip test for entities and void tags.
  - Files: `src/ssr.ts`, `src/ssr.test.ts`

## Phase 4: Reactive state + Web Component

- [x] **T9: reactive() proxy utility**
  - Acceptance: `reactive(target)` returns a deep proxy; mutating nested properties/arrays notifies subscribers. Subscribers can be attached and detached.
  - Verify: Unit test mutates a nested property and an array element, asserting the subscriber fired; detaches and asserts it stops firing.
  - Files: `src/reactive.ts`, `src/reactive.test.ts`

- [x] **T10: TemplesComponent reactive state + define()**
  - Acceptance:
    - `static tag`, `static template`, `static events`, `static observedAttributes`, `static attributeTypes` fields.
    - `TodoApp.define()` parses the template once and calls `customElements.define(this.tag, this)`.
    - `this.state` is a reactive proxy; any mutation re-renders (full re-render + keyed reconciliation).
    - Observed attributes write into `state` (coerced via `attributeTypes`); attribute change → state → render.
    - The old `update()`/`render()` public methods and `this.data` are removed.
    - Templates live in the document head as `<template id="tag">`; `define()` inserts them, components clone their content into the body.
  - Verify: Unit test defines a component, mutates `state`, asserts re-render; sets an attribute, asserts coerced state and re-render.
  - Files: `src/component.ts`, `src/component.test.ts`

## Phase 5: Events & messaging

- [ ] **T11: registerEvents() — (event, host) signature**
  - Acceptance: Handlers receive `(event, host)`; `host` is typed `TemplesComponent`; `"eventType selector"` keys are validated at registration (not lazily at event time).
  - Verify: Unit test registers a `click .btn` handler, simulates a click, asserts the handler ran with `(event, host)`. Then calls cleanup, clicks again, and asserts the handler is NOT called.
  - Files: `src/register-events.ts`, `src/register-events.test.ts`

- [ ] **T12: emit()/on() messaging**
  - Acceptance: `this.emit(name, detail)` dispatches a bubbling `CustomEvent`; `this.on(name, handler)` subscribes and returns an unsubscribe function. Works across sibling components.
  - Verify: Unit test emits from one component and asserts a sibling's `on` handler receives the detail; unsubscribes and asserts it stops.
  - Files: `src/component.ts`, tests.

## Phase 6: jQuery plugin

- [ ] **T13: ./jquery entry — $.fn.temples(data)**
  - Acceptance: Importing `temples/jquery` registers `$.fn.temples(data)` to render data into each matched element. `$.fn.temples()` returns the prepared Renderer. jQuery is a peer dependency. The absence of `$` throws a clear error.
  - Verify: Unit test (jquery as devDependency) prepares a list template, calls `$(".list").temples(data)`, asserts rendered output. Test with two matched elements.
  - Files: `src/jquery.ts`, `src/jquery.test.ts`

## Phase 7: Tree-shakeable build

- [ ] **T14: Build + public exports**
  - Acceptance:
    - `src/index.ts` exports `Renderer`, `TemplesComponent`, `reactive`, `registerEvents`, `EventMap`, and the data types.
    - `package.json` adds `"sideEffects": false`.
    - `bun run build` emits ESM to `dist/` (`index.js`, `engine.js`, `ssr.js`, `jquery.js`).
    - The main bundle contains no linkedom/jquery (tree-shake check).
  - Verify: `bun run build` succeeds; inspect `dist/index.js` exports and confirm no `linkedom`/`jquery` import.
  - Files: `src/index.ts`, `package.json`, build script.

## Phase 8: Example (TODO app, real integration test)

- [ ] **T15: TODO app example — no bundling**
  - Acceptance:
    - `example/index.html` loads `../dist/index.js` via `<script type="module">`; no Bun `.html`/`.ts` import magic.
    - Components: `todo-app` (list + input + form), `todo-item` (keyed row), `todo-counter` (messaging consumer via `on("todo-count-changed")`).
    - Demonstrates reactive state, keyed list, two-way input, `submit` with `preventDefault`, and `emit`/`on`.
    - `demo` script = `bun run build` then static serve of `example/`.
  - Verify: Run `bun run demo`, open the page in a browser (or `agent-browser`), add/remove/complete todos, confirm the counter updates. Screenshot for evidence.
  - Files: `example/index.html`, `example/components/*.js`, `example/demo.css`, `package.json`.

- [ ] **T16: README + example/README review**
  - Acceptance: README reflects the reactive-state API, `(event, host)` handlers, `emit`/`on`, keyed reconciliation, and the no-bundling example. Cross-check every code example.
  - Verify: Read the README against the actual code. Cross-check every code example in the README against the real implementation.
  - Files: `README.md`, `example/README.md`
