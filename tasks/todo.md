# Task List: Temples 1.0

Tasks are ordered by dependency. Each task should be completable in a single focused session.
Follow `test-driven-development` for each task: failing test first, then implementation.

---

## Phase 1: Foundation

- [x] **T1: Project tooling setup**
  - Acceptance: `package.json` has working `dev`, `test`, `typecheck`, `demo` scripts. The `exports` map lists `./engine`, `./ssr`, and `./jquery` entry points (files may be empty stubs). `bun test` runs (even with 0 tests). `bun run typecheck` passes with no errors.
  - Verify: `bun test` and `bun run typecheck` both exit 0.
  - Files: `package.json`, `tsconfig.json` (if adjustments needed)

## Phase 2: Core Engine

- [x] **T2: Renderer skeleton + template sources + basic data-bind**
  - Acceptance: `new Renderer(source)` accepts a DOM element or an HTML string. The string form is parsed once into a container. `render(data)` walks `data-bind` elements and sets text content for bare paths (shorthand) and innerHTML for `html=`. Shorthand defaults to text for non-input elements; the input→value shorthand arrives in T3 with `value=`. The `#id` selector form is handled by the `Temples` registry in T6.
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
  - Acceptance: `render(data)` resolves every dotted path present in `data` and applies only the operations bound to that exact path; absent paths keep their current state. A flat delta `{ "article.title": "New" }` re-renders one binding (replacing a separate `update()` method). An internal path → operation map gives O(1) lookup. Iterate seeds and render-if conditions participate through the same map.
  - Verify: Unit test renders two bindings then a single-path delta, asserting only that element changes. Tests cover untouched absent paths, explicit empty-value clearing, iterate re-stamp, and render-if re-evaluation.
  - Files: `src/engine.ts`, `src/engine.test.ts`, `README.md`
  - Notes: `update()` was dropped to keep the API minimal — `render(data)` renders only what it receives. The DOM is the state; no data is retained between calls. Bindings inside an iterated sub-template are not individually updatable; the iterate re-stamp refreshes them.

- [ ] **T6: Temples registry + toHtml()/renderToString()**
  - Acceptance: `Temples.prepare(name, source)` registers a template. `Temples.render(name, data)` returns the template DOM (a flat dotted-path delta re-renders one path). `Temples.renderToString(name, data)` returns serialized HTML. `Temples.destroy(name)` works. `register` is a synonym for `prepare`. `Renderer#toHtml()` matches `renderToString()`.
  - Verify: Unit test registers a template by name, renders data, asserts the returned DOM and the serialized string match expected markup.
  - Files: `src/temples.ts`, `temples.test.ts`

## Phase 3: SSR

- [ ] **T7: ./ssr entry — linkedom wiring**
  - Acceptance: Importing `temples/ssr` sets up a linkedom-backed DOM so `Temples.prepare(name, htmlString)` and `Temples.renderToString(name, data)` work on the server without a browser. The main entry does not statically import linkedom.
  - Verify: Unit test run on the server prepares a template from an HTML string and asserts `renderToString` output matches the browser path on the same template and data. Round-trip test for entities and void tags.
  - Files: `src/ssr.ts`, `ssr.test.ts`

## Phase 4: Web Component

- [ ] **T8: TemplesComponent skeleton + define() + engine-backed render**
  - Acceptance: `TemplesComponent.define(tagName, Class, { template })` parses the HTML string into a `<template>` element and calls `customElements.define()`. On `connectedCallback`, the template content is cloned and bindings are rendered through the engine. On `disconnectedCallback`, children are cleaned up.
  - Verify: Unit test defines a trivial component with `<p data-bind="title">Hello</p>`, sets `title="Hello"`, appends to a test DOM, asserts the `<p>` shows "Hello".
  - Files: `index.ts`, `index.test.ts`

- [ ] **T9: registerEvents() helper**
  - Acceptance: `registerEvents(host, eventMap)` attaches listeners per `"eventType selector"` entries, passes the host to handlers, and returns a cleanup function. `connectedCallback` calls it; `disconnectedCallback` calls the cleanup.
  - Verify: Unit test registers a `click .btn` handler, simulates a click, asserts the handler ran with the host. Then calls cleanup, clicks again, and asserts the handler is NOT called.
  - Files: `src/register-events.ts`, `register-events.test.ts`

- [ ] **T10: Attribute aggregation + attributeChangedCallback + update**
  - Acceptance: Observed attribute values aggregate into `this.data`. When an observed attribute changes via `setAttribute`, `attributeChangedCallback` updates `this.data` and triggers `render()`. `update(path, value)` delegates to the engine's partial update.
  - Verify: Unit test sets `title="Hello"`, asserts the bound element shows "Hello". Then `setAttribute("title", "World")` and asserts it updates to "World".
  - Files: `index.ts`, `reactivity.test.ts`

## Phase 5: jQuery plugin

- [ ] **T11: ./jquery entry — $.fn.temples(data)**
  - Acceptance: Importing `temples/jquery` registers `$.fn.temples(data)` to render data into each matched element. `$.fn.temples()` returns the prepared Renderer. jQuery is a peer dependency. The absence of `$` throws a clear error.
  - Verify: Unit test (jquery as devDependency) prepares a list template, calls `$(".list").temples(data)`, asserts rendered output. Test with two matched elements.
  - Files: `src/jquery.ts`, `jquery.test.ts`

## Phase 6: Example & Polish

- [ ] **T12: Flipping-card example component**
  - Acceptance: All four files are implemented (`flipping-card.html`, `flipping-card.js`, `flipping-card.css`, `index.ts`). The component renders a flip card with front/back faces. `flip()` and `unflip()` state-transition methods work by setting the `flipped` attribute.
  - Verify: `bun run typecheck` passes. The component can be imported and instantiated in a test DOM.
  - Files: `example/components/flipping-card/flipping-card.html`, `flipping-card.js`, `flipping-card.css`, `index.ts`

- [ ] **T13: Demo page + bun demo script**
  - Acceptance: `example/index.html` loads the flipping-card component and displays it. `bun demo` (or equivalent) serves the example page.
  - Verify: Run `bun demo`, open the page in a browser (or `agent-browser`), click the flip button, confirm the card flips. Screenshot for evidence.
  - Files: `example/index.html`, `package.json` (demo script)

- [ ] **T14: Final README review**
  - Acceptance: README.md reflects the standalone engine, the `Temples` API, the SSR entry, the jQuery plugin, and the component API with no drift.
  - Verify: Read the README against the actual code. Cross-check every code example in the README against the real implementation.
  - Files: `README.md`, `example/README.md`
