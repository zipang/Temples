# Task List: Temples 1.0

Tasks are ordered by dependency. Each task should be completable in a single focused session.
Follow `test-driven-development` for each task: failing test first, then implementation.

---

## Phase 1: Foundation

- [ ] **T1: Project tooling setup**
  - Acceptance: `package.json` has working `dev`, `test`, `typecheck`, `demo` scripts. `bun test` runs (even with 0 tests). `bun run typecheck` passes with no errors.
  - Verify: `bun test` and `bun run typecheck` both exit 0.
  - Files: `package.json`, `tsconfig.json` (if adjustments needed)

- [ ] **T2: TemplesComponent skeleton + define() + template cloning**
  - Acceptance: `TemplesComponent.define(tagName, Class, { template })` parses the HTML string into a `<template>` element, calls `customElements.define()`. On `connectedCallback`, the template content is cloned into the component's children. On `disconnectedCallback`, children are cleaned up.
  - Verify: Unit test defines a trivial component with `<p data-bind="title">Hello</p>` template, creates an instance via `document.createElement`, appends to a test DOM, and asserts `children.length > 0` with the `<p>` present.
  - Files: `index.ts`, `index.test.ts`

- [ ] **T3: registerEvents() helper**
  - Acceptance: `registerEvents(host, eventMap)` queries selectors within the host element and attaches event listeners. Handlers receive the `host` as argument. Returns a cleanup function that removes all listeners. `connectedCallback` calls it; `disconnectedCallback` calls the cleanup.
  - Verify: Unit test registers a `click .btn` handler, simulates a click on the matching element, and asserts the handler was called with the host. Then calls cleanup, clicks again, and asserts the handler is NOT called.
  - Files: `index.ts` (or separate `register-events.ts`), `register-events.test.ts`

## Phase 2: Binding Engine

- [ ] **T4: data-bind — simple text/html bindings + shorthand**
  - Acceptance: `data-bind="title"` sets the element's text content from `this.data.title`. `data-bind="html=content"` sets `innerHTML`. Shorthand omission works (text for divs, value for inputs). `render()` walks all `data-bind` elements in the component.
  - Verify: Unit test with mock data `{ title: "Hello", content: "<b>World</b>" }` — asserts text content and innerHTML are correctly set after `render()`.
  - Files: `index.ts`, `binding-engine.test.ts`

- [ ] **T5: data-bind — typed bindings (value=, attr=) + multiple bindings**
  - Acceptance: `data-bind="value=name"` sets input value. `data-bind="src=avatar, title=name"` sets multiple attributes. `data-bind="text=label"` sets text content explicitly. All typed bindings work in combination.
  - Verify: Unit test with an `<img data-bind="src=user.avatar, title=user.name">` and `<input data-bind="value=user.name">` — asserts attributes and values match mock data after `render()`.
  - Files: `index.ts`, `binding-engine.test.ts`

- [ ] **T6: data-bind — special class[a|b|c] syntax**
  - Acceptance: `data-bind="class[article|quote|tweet]=article.type"` evaluates the path, sets the matching class value, and removes the non-matching ones from the toggle set. Other classes on the element are preserved.
  - Verify: Unit test with `<div class="row container" data-bind="class[article|quote|tweet]=article.type">` and mock data `{ article: { type: "quote" } }` — asserts class is `"row container quote"` (not article, not tweet). Test with a second data set where type is "article".
  - Files: `index.ts`, `binding-engine.test.ts`

- [ ] **T7: data-iterate — collection iteration + variable naming + synonyms**
  - Acceptance: `data-iterate="quote: article.quotes"` clones the first child element for each item in the collection, binding `quote` to the current item. Auto-naming drops trailing `s` (`article.tags` → `tag`). `data-each` works as synonym. `from` keyword works (`quote from article.quotes`).
  - Verify: Unit test with a list template and mock data containing a 3-item array — asserts 3 cloned children, each with correct bound values. Test with all syntax variants.
  - Files: `index.ts`, `binding-engine.test.ts`

- [ ] **T8: data-render-if — conditional rendering**
  - Acceptance: `data-render-if="article.featured"` shows the element when the path evaluates truthy, hides it (or removes from DOM) when falsy. Function values in the data are called and their return value is evaluated.
  - Verify: Unit test with two `data-render-if` elements, one truthy and one falsy — asserts only the truthy one is visible. Test with a function-valued path.
  - Files: `index.ts`, `binding-engine.test.ts`

## Phase 3: Reactivity

- [ ] **T9: Attribute aggregation → this.data + attributeChangedCallback re-render**
  - Acceptance: On `connectedCallback`, observed attribute values are aggregated into `this.data`. When an observed attribute changes via `setAttribute`, `attributeChangedCallback` updates `this.data` and triggers `render()`. The component re-renders with the new values automatically.
  - Verify: Unit test creates a component with `observedAttributes = ["title"]`, sets `title="Hello"`, asserts `data-bind="title"` element shows "Hello". Then `setAttribute("title", "World")` and asserts it updates to "World".
  - Files: `index.ts`, `reactivity.test.ts`

- [ ] **T10: update() — partial path patching + targeted re-render**
  - Acceptance: `update("article.title", "New Title")` patches `this.data.article.title` and re-renders only the binding(s) for that path, not the entire component. An internal binding map (path → element) is maintained during `render()` for O(1) lookup.
  - Verify: Unit test with multiple bindings — calls `update()` on one path and asserts only that element changes, while others remain unchanged. Verify `this.data` is correctly patched.
  - Files: `index.ts`, `reactivity.test.ts`

## Phase 4: Example & Polish

- [ ] **T11: Flipping-card example component**
  - Acceptance: All four files are implemented (`flipping-card.html`, `flipping-card.js`, `flipping-card.css`, `index.ts`). The component renders a flip card with front/back faces. `flip()` and `unflip()` state-transition methods work by setting the `flipped` attribute. Click events on buttons trigger flips.
  - Verify: `bun run typecheck` passes. Component can be imported and instantiated in a test DOM.
  - Files: `example/components/flipping-card/flipping-card.html`, `flipping-card.js`, `flipping-card.css`, `index.ts`

- [ ] **T12: Demo page + bun demo script**
  - Acceptance: `example/index.html` loads the flipping-card component and displays it. `bun demo` (or equivalent) serves the example page. The card visibly flips when clicked.
  - Verify: Run `bun demo`, open the page in a browser (or `agent-browser`), click the flip button, confirm the card flips. Screenshot for evidence.
  - Files: `example/index.html`, `package.json` (demo script)

- [ ] **T13: Final README review + example/README.md fill**
  - Acceptance: README.md accurately reflects the implemented API (no drift between docs and code). `example/README.md` documents the example directory structure and how to run the demo.
  - Verify: Read through both READMEs against the actual code. Cross-check every code example in the README against the real implementation.
  - Files: `README.md`, `example/README.md`
