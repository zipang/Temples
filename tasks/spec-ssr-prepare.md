# Spec: SSR `prepare(source, options)` templating API

## Objective

Extend the SSR entry (`temples/ssr`) so the engine can be used as a server-side
templating engine. A template source (HTML string with a single root element) is
prepared once into a reusable `render(data)` function. Each call returns the
rendered markup as an HTML string, ready for multiple data sets.

The feature adds `prepare(source, options)` alongside the existing
`new Renderer(html)` / `renderer.renderToString()` path. It does not replace it.

This feature reverses the earlier decision "Component SSR — RESOLVED not
included" (plan.md §Alternative decisions). `webComponents` requires rendering
`TemplesComponent` instances on the server.

## Tech Stack

- Bun (`bun build`, `bun test`)
- TypeScript (strict, `noImplicitOverride`, `noUncheckedIndexedAccess`)
- linkedom for the server DOM (installed by `ssr.ts` at import time)
- Biome for format/lint

## Commands

```
Build:    bun run build
Test:     bun test src/ssr.test.ts
Typecheck: bun run typecheck
Check:    bun run check
```

## Project Structure

- `src/ssr.ts` — add `prepare`, `PrepareOptions`, `PreparedRender`.
- `src/engine.ts` — add engine support the options require (see Open Questions).
- `src/component.ts` — expose what `webComponents` SSR needs to render a
  `TemplesComponent` by tag (template, css, events).
- `src/ssr.test.ts` — tests for `prepare` and each option.
- `tasks/plan.md` — document the new API and the reversed component-SSR decision.
- `tasks/todo.md` — add the tasks.
- `package.json` — mark `./dist/ssr.js` as side-effectful (see Boundaries).

## Public API

```ts
export interface PrepareOptions {
  rehydrate?: boolean;
  removeDataBinding?: boolean;
  webComponents?: typeof TemplesComponent[];
}

export type PreparedRender = (data: TemplesData) => Promise<string>;

export function prepare(source: string, options: PrepareOptions = {}): PreparedRender;
```

`render(data)` is async: `prepare()` parses the source with linkedom and
returns a function that loads the `Renderer` (and, only when `webComponents` is
declared, `TemplesComponent`) with `await import()`. Loading is deferred until
after the linkedom DOM globals are installed on `globalThis`, so the component
class (`extends HTMLElement`) evaluates against a real DOM. The globals are
restored after each render call so the mutation does not leak into the
surrounding environment.

- `source`: an HTML string with exactly one root element. A fragment or a whole
  page whose root is a single element (e.g. `<html>`) is allowed. A source with
  zero or multiple root elements throws. `prepare` is string-only; it never
  accepts an `Element` or `DocumentFragment` (server-side, the template is a
  string).
- `options` is optional. `rehydrate` and `removeDataBinding` default to `false`.
  `webComponents` defaults to an empty list.
- `webComponents` is a list of `TemplesComponent` classes, not a boolean. It is
  how `prepare` identifies which tags in the source are custom components. Each
  class is registered on the linkedom `customElements` registry via
  `define({ globalStore })` before rendering.
- The returned `render(data)` creates a fresh `Renderer` internally on every call
  (re-parses the source), so consecutive calls are independent and no state leaks
  between data sets. It always returns an HTML string.

## Component data — global store

Components receive their initial state through a global store, in addition to
their own attributes.

- `TemplesComponent.define(options?)` gains an options object with an optional
  `globalStore` key: `define({ globalStore: data })`.
- The store is a flat `TemplesData` dictionary. On mount, a component resolves
  each observed attribute by name: it reads the top-level key of the same name
  from the store.
- Precedence: an explicit attribute on the tag **wins** over the store. The store
  is the fallback, consulted only when the attribute is absent.
- A list (e.g. `data-each` rendering N `todo-item` components) passes per-item
  data as an attribute on each child tag (`<todo-item todo="...">`). That
  attribute masks any same-named store key, so per-instance data is preserved.

## Component styles

- `TemplesComponent` gains a `static css = ""` property.
- The browser path keeps bun's automatic CSS bundling: `import stylesheet from
  "./component.css"` feeds the `css` static. `prepare()` completes (not replaces)
  this by concatenating every used component's `css` into one `<style>` tag in the
  rendered HTML.

## Option semantics

### `rehydrate: false` (default)

Control attributes are stripped from the output (clean markup), matching the
current engine behavior. The output contains no `data-bind`, `data-each`,
`data-iterate`, `data-key`, or `data-render-if`.

### `rehydrate: true`

The rendered HTML string includes the TemplesComponent library in the page source
so that, when the page renders in a browser, every custom element
(`TemplesComponent`) is rehydrated — mounted and active (reactive state and event
wiring). This is the final and most difficult task.

### `removeDataBinding: true`

All traces of Temples disappear from the output:

- every `data-*` binding attribute is removed, and
- every used `TemplesComponent` is rendered to its plain static markup, with no
  custom tag remaining and no Temples event wiring.

`removeDataBinding` and `rehydrate` are mutually exclusive: `removeDataBinding`
produces static markup with no Temples footprint, while `rehydrate` keeps
components active in the browser.

### `webComponents`

Support `TemplesComponent` usage in the template:

- `webComponents` is a list of `TemplesComponent` classes.
- `prepare` registers each class on the linkedom `customElements` registry via
  `define({ globalStore })`, then renders the source; the DOM upgrades each custom
  tag to its class and `connectedCallback` renders its template from the store and
  its attributes.
- the component's `template` defines the markup and its `css` is concatenated into
  one `<style>` tag in the output,
- events are wired only when `rehydrate` is also true.

`webComponents` and `removeDataBinding` together render components to plain markup
with no Temples footprint.

## Testing Strategy

- Unit tests in `src/ssr.test.ts`, using the linkedom globals installed by
  `ssr.ts`.
- TDD: write failing tests first, then implement.
- Test cases:
  - `prepare` rejects zero/multiple root elements.
  - `render(data)` returns an HTML string.
  - `render` is reusable: two calls with different data sets produce independent
    correct output (no state leak with partial data).
  - `rehydrate: true` includes the TemplesComponent library in the output so
    custom elements rehydrate in the browser.
  - default strips `data-*` attributes.
  - `removeDataBinding: true` removes all binding attributes and component traces.
  - `webComponents` renders a `TemplesComponent` tag to its template + css markup.
  - `webComponents` + `rehydrate: true` wires events.
  - the global store seeds a component's observed attributes; an explicit
    attribute on the tag masks the same-named store key.

## Success Criteria

- `prepare(source)` returns a function `(data) => string`.
- `render` is reusable across data sets with no stale-value leakage.
- Each option produces the output described above.
- `bun run typecheck`, `bun run check`, and `bun test` all pass.
- `bun run build` emits `dist/ssr.js` containing `prepare`.
- The spec and new API are documented in `tasks/plan.md` / `tasks/todo.md`.

## Boundaries

- Always:
  - Write a failing test before implementing each behavior.
  - Keep `Renderer` SSR path working; `prepare` is additive.
  - Mark `./dist/ssr.js` as side-effectful in `package.json`
    (`"sideEffects": ["./dist/ssr.js"]`) because `prepare()` installs the
    linkedom DOM on `globalThis` on every call. `ssr.ts` does not touch
    `globalThis` at import time: `prepare()` calls `parseHTML(source)`, installs
    the DOM globals, and only then loads the engine and `TemplesComponent` with
    `require()`. `TemplesComponent` must load lazily because its class extends
    `HTMLElement`, which must exist first.
- Ask first:
  - Any change to the `Renderer` constructor signature or the public exports of
    `src/index.ts`.
  - Any new dependency.
- Never:
  - Let `src/index.ts` statically import linkedom (browser bundles must stay
    clean).
  - Remove or rename the existing `Renderer` SSR path.

## Open Questions

1. ~~Does `webComponents` need `customElements.define` on the linkedom registry?~~
   RESOLVED — yes. linkedom's `customElements` is reliable: the component tests
   prove `define()`, element upgrade (`instanceof`), and `connectedCallback` all
   work under linkedom (via `test/setup.ts`). `prepare` uses the same registry
   path.
2. ~~How does `webComponents` SSR obtain styles?~~ RESOLVED — add a
   `static css` property to `TemplesComponent`, fed by bun's
   `import stylesheet from "./component.css"`. `prepare` concatenates all used
   component `css` into one `<style>` tag.
3. ~~`disappear` vs `rehydrate` conflict~~ RESOLVED — renamed `disappear` to
   `removeDataBinding`. `removeDataBinding` (static output, no Temples footprint)
   and `rehydrate` (components active in the browser) are mutually exclusive.
4. ~~Should `prepare` accept an `Element`/`DocumentFragment` source?~~ RESOLVED —
   string-only. The template is a string on the server.
5. ~~`define()` options type~~ RESOLVED — `define(options?: { globalStore?:
   TemplesData })`, still callable with no arguments.
