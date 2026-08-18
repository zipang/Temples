# Temples: Declarative HTML Templates

![Temples logo](assets/temples-logo.png)

This project is a rewriting of the original [Temples](https://github.com/zipang/Temples/tree/v0) template system based on jQuery.
The new iteration replaces jQuery with a standard, DOM-based templating engine.

## Synopsis

`Temples` (templ*at*es that you won't hate) is a templating system for HTML.
`Temples` syntax is _very_ easy to use and can be learned in 5 minutes.
`Temples` is a declarative, DOM-based rendering engine, with a special ability for real-time and partial updates.
_Templates_ are plain HTML blocks or fragments decorated with a few `data-bind` attributes.
`Temples` works in the browser and on the server, with the same engine and the same templates everywhere.

## Motivations

I want a template system that :

- is easy to use, easy to read, and predictable in its syntax.
- won't break my pages with ugly non-HTML syntax that my IDE does not recognize.
- is reliable, so that web designers can work on the markup and the CSS with very little chance of breaking the bindings.
- can support real-time live updates of only the relevant data, without rendering the whole thing.
- works seamlessly with structured data at any level of nesting.
- is built on web platform standards, so that components stay reusable without a framework.

I want to :

- use genuine HTML pages, full of example text, and transform them with the addition of a few `data-bind` attributes.
- understand how it works in 2 minutes.
- render the same templates in the browser and on the server, for fast and SEO-friendly pages.

## Features

- Fully HTML5 compliant. Won't break your pages.
- Declarative bindings with a predictable syntax.
- Transparent rendering of structured data, with functions as computed values.
- Real-time partial updates of only the bound values.
- Standalone engine, free of any framework dependency.
- Web Components made declarative through the `TemplesComponent` base class.
- Server-side rendering (SSR) and static site generation (SSG) with [linkedom](https://github.com/WebReflection/linkedom), on Bun, Node.js, or Deno.
- Optional jQuery plugin for jQuery-based pages.

## The engine in three forms

- The standalone `Renderer` class for direct use in the browser and for server-side rendering (SSR) in Bun, Node.js, or Deno.
- The `TemplesComponent` base class for declarative Web Components.
- A jQuery plugin (`temples/jquery`) that renders data into matched elements.

## DATA BINDING SYNTAX

The syntax stays the same, only relying on a few specific data attributes : `data-bind` (inline values), `data-iterate` (loop), `data-render-if` (condition).

All binding paths are resolved against the component's internal `this.data` object (see [Attributes: the single source of truth](#5-attributes-the-single-source-of-truth)).

### `data-bind` — inline values

Expressions are of the form : `[value|text|html|<attr-name>]=<path.to.data>`
Multiple updates can be specified, separated by a comma ','.

Here is for example the block of markup you'd wish to use to display the currently logged user :

```html
<div id="logged-user">
    <img data-bind="src=user.avatar, title=user.fullname" title="John DOE" src="http://avatar.com/johndoe" />
    <div data-bind="user.fullname, class=user.status" class="active">John DOE</div>
</div>
```

Notice how _we don't have to get rid_ of the sample text, so that the markup still displays nicely in the browser before the data is bound.

Depending on the context, `value=` or `html=` can be omitted so that :

```html
<div data-bind="html=user.fullname">John DOE</div>
```
is equivalent to :
```html
<div data-bind="user.fullname">John DOE</div>
```

and
```html
<input type="text" data-bind="value=user.name" />
```
is equivalent to :
```html
<input type="text" data-bind="user.name" />
```

#### Binding the `class` attribute

There is a special syntax for the `class` attribute allowing you to specify the values you want to toggle.
Because the `class` attribute is a space-separated list of values, you usually want to toggle certain values within a particular range, leaving the others untouched.
This is exactly what you can do with the extended `data-bind` syntax for the class attribute :

```html
<div class="row container" data-bind="class[article|quote|tweet]=article.type" />
```

In this example, the binding value of `article.type` will be evaluated, and used to replace one of these values within the class attribute : `article`, `quote` or `tweet`.
All other class values (ie : `row` and `container` in our example) will be left untouched.

### `data-iterate` — loops

Temples can iterate over collections to build a list of items.
This is done with the `data-iterate` attribute that designates the collection to iterate on, optionally names the variable to hold the iteration value, and uses _the first-level sub-template_ to render the child elements.

If no variable name is provided, Temples will automatically choose one by suppressing the final `s` on the collection's name.

```html
<!-- Introducing a list of quotes -->
<div data-iterate="quote: article.quotes">
    <div class="quote" data-bind="quote">I ain't a native : I was born there!</div>
</div>

<!-- Will automatically iterate on the 'tag' variable -->
<ul data-iterate="article.tags">
    <li><a data-bind="tag.label, href=tag.url">peace</a></li>
</ul>
```

#### Alternate syntax

This attribute offers several syntactical variants to suit your expressive needs :

- `data-each` can be used in place of `data-iterate`.
- The variable name can be introduced with `:` or with the `from` keyword.

So that each of these iterative blocks have the same meaning :

```html
<div data-iterate="article.quotes">...</div>

<div data-iterate="quote: article.quotes">...</div>

<div data-iterate="quote from article.quotes">...</div>

<div data-each="quote from article.quotes">...</div>
```

### `data-render-if` — conditionals

Another useful feature is the possibility to associate the rendering of a block element to a condition.
This is done with the `data-render-if` attribute, whose value must evaluate to a boolean condition.

```html
<!-- Display a special icon if this article is 'featured' -->
<div class="icon" data-render-if="article.featured">
  <img src="featured.png" />
</div>

<!-- Display another icon if this article is 'popular' -->
<div class="icon" data-render-if="article.popular">
    <img src="popular.png" />
</div>
```

The test can be done against a function in the data if needed :

```javascript
{
    article: {
        featured: true,
        popular: function() {
            return (this.comments.length > 20);
        }
    }
}
```

## STANDALONE TEMPLATE ENGINE

The binding engine is a standalone module. It does not depend on the Web Component lifecycle.
Build a renderer with the `Renderer` class.

> The v0 name-based `Temples` registry (`prepare()`, `render(name, ...)`, `update(name, ...)`, `renderToString(name, ...)`, `destroy(name)`) is **deprecated**. It stored Renderer instances by name, and a forgotten `destroy(name)` left zombie templates. Direct `Renderer` instances are owned by the caller, so no registry and no `destroy()` are needed.

### The `Renderer` class

The template source can be :

- an HTML string with the full template content.
- a DOM element.

```javascript
const renderer = new Renderer(document.getElementById("logged-user")); // DOM element
const renderer = new Renderer('<div><span data-bind="user.firstname">John</span></div>'); // HTML string
```

### `render(data)`

Renders the template with the data and returns the updated template DOM.
`render` touches only the paths present in `data`; absent paths keep their current state.
Pass a full dictionary to render everything, or a partial dictionary to re-render only the paths it carries.
The returned DOM lets you insert, clone, or serialize the result.

```javascript
const renderer = new Renderer(document.getElementById("logged-user"));
const result = renderer.render(user);
document.body.appendChild(result);
```

To update a single path in real time, use `update` instead (see below).

### `update(propertyPath, value)`

Updates a single path and re-renders only the binding for that exact path.
The path is a dotted path such as `"user.status"`.
This enables efficient real-time partial updates without re-rendering the whole template.

```javascript
// Real-time partial update of one path only
renderer.update("user.status", "away");
```

### `toHtml()` / `renderToString()`

Returns the serialized HTML of the rendered template.
`renderToString()` is a synonym for `toHtml()`.
This method is the entry point for server-side rendering (SSR) and static site generation (SSG).

```javascript
import { Renderer } from "temples";
import "temples/ssr";

const renderer = new Renderer(articleTemplateMarkup);
renderer.render({
  article: {
    title: "The Great Race",
    quotes: ["Quiet!", "Pardon me Mr Partner."]
  }
});

const html = renderer.renderToString();

// Write the HTML string to a file with your runtime file API (Bun, Node.js, Deno).
```

### Server-side rendering

The engine operates on a DOM.
In the browser it uses the native `document`.
On the server there is no DOM, so the engine uses [linkedom](https://github.com/WebReflection/linkedom) to parse and serialize the HTML.

Import the SSR entry to use the engine on the server :

```javascript
import "temples/ssr";
```

The `temples/ssr` entry wires the engine to linkedom.
The main entry never imports linkedom, so browser bundles stay small.

## WEB COMPONENT IMPLEMENTATION

### 1. Declaration

The Web Component implementation is contained in our exported class `TemplesComponent`.
Instead of inheriting from `HTMLElement` to create a new Web component, you inherit from `TemplesComponent` :

```typescript
import { TemplesComponent } from "./Temples";

/**
 * Classical Web component class definition
 */
export class MyComponent extends HTMLElement {
}

/**
 * Use TemplesComponent to inherit the full declarative templating system
 */
export class MyTemplesComponent extends TemplesComponent {
}
```

### 2. Component structure (html template, script, style)

Each aspect of the component : the markup (with the `data-*` binding attributes), the style and the event handling for dynamic components with state MUST be written in separate source files with their according type, and an `index.ts` file binds all these sources together to export the `TemplesComponent` :

* `<component>.html` — the component's markup template with `data-*` binding attributes
* `<component>.[ts|js]` — the component's event handlers (exported as an event map)
* `<component>.css` — the component's styles, scoped by the component's tag name
* `index.ts` — assembles all parts, defines the component class, and registers the custom element

A user could inline all parts in a single file, but we propose this clean approach where each concern is separated into its own file.
This lets designers work on markup and CSS freely, with very little chance of breaking the binding logic.

### 3. Assembly in `index.ts`

The `index.ts` file is where all the parts come together.
It imports the template and styles, defines the component class, and registers the custom element with `TemplesComponent.define()` :

```typescript
import { TemplesComponent } from "../Temples";
import template from "./flipping-card.html";
import "./flipping-card.css";

export class FlippingCard extends TemplesComponent {
  static observedAttributes = ["title", "flipped"];

  // Declarative event bindings, mapping a binding to a handler method name.
  static events = {
    "click .flip-btn": "flip",
    "click .back-btn": "unflip"
  };

  // Semantic state-transition methods (public API)
  flip() { this.setAttribute("flipped", "true"); }
  unflip() { this.setAttribute("flipped", "false"); }
}

// Register the custom element with its template
TemplesComponent.define("flipping-card", FlippingCard, { template });
```

Bun natively supports importing `.html` files as strings and `.css` files (which are injected into the page).
No additional build step is required.

### 4. The `<template>` mechanism

When `TemplesComponent.define()` is called, the template HTML string is parsed **once** into a `<template>` element and stored on the class.
Each time a component instance connects to the DOM (`connectedCallback`), the template content is cloned via `template.content.cloneNode(true)` and appended as the component's children.

This is the cleanest and most efficient approach — the HTML is parsed a single time, and each instance receives a fast DOM clone rather than a re-parse or an `innerHTML` assignment.

### 5. Attributes: the single source of truth

A component's data is derived from its **plain HTML attributes** (no `data-` prefix — that prefix is reserved for internal template bindings).
The component declares which attributes it observes via the standard `static observedAttributes` array :

```typescript
static observedAttributes = ["title", "flipped"];
```

When any observed attribute changes (including the initial values present in the markup), `attributeChangedCallback` fires, the attribute's value is aggregated into the internal `this.data` object, and a re-render is triggered automatically.

```html
<!-- Attributes are the idiomatic way to configure a component -->
<flipping-card title="Hello World" flipped="false"></flipping-card>
```

```javascript
// Mutating an attribute triggers a re-render
card.setAttribute("flipped", "true");
```

`this.data` is **private** — it cannot be directly modified from outside.
It may contain additional internal state properties that are not exposed as attributes (enriched by the component's own logic), but the attributes are the authoritative source that dictates the component's state.

### 6. State and reactivity

The internal rendering pipeline :

- **`this.data`** (private) — the aggregated state object, built from observed attributes and optionally enriched by internal logic.
- **`render()`** (internal) — re-renders all `data-bind` / `data-iterate` / `data-render-if` bindings from the current `this.data`.
- **`update(propertyPath, value)`** (internal) — patches a single path in `this.data` (e.g. `"article.title"`) and re-renders only the affected binding. This enables efficient partial updates, ideal for real-time pushed notifications.

These methods are **internal to the component**.
External code must not call `render(data)` to arbitrarily overwrite component state.
The current attribute values are the source of truth that dictates the component state.
The same binding engine is public through the `Renderer` class (see [Standalone template engine](#standalone-template-engine)).

To change a component's state, use either :

1. **Mutate attributes** (idiomatic) — `element.setAttribute("flipped", "true")`
2. **Call semantic state-transition methods** (state machine pattern) — `element.flip()`

State-transition methods are public methods defined by the component author that internally change attributes or call `update()` :

```typescript
flip() { this.setAttribute("flipped", "true"); }
```

### 7. Event handling

Events are handled by the component's `static events` map, which maps each binding to the name of a handler **method** on the class.
The handler runs with `this` bound to the component instance, so it can read `this.state` and call other component methods directly.

There are two kinds of bindings, unified in the same map :

- **DOM events** — a key with a space, `"<eventType> <selector>"` (e.g. `"click .flip-btn"`). The handler runs when an event of that type bubbles from an element matching the selector inside the component.
- **Inter-component messages** — a key without a space, `"<tag>:<message>"` (e.g. `"shopping-item:updated"`). The handler runs when another component emits that message on the shared event bus.

```typescript
export class ShoppingApp extends TemplesComponent {
  static events = {
    "submit .add-form": "onAdd",          // DOM event
    "shopping-item:updated": "onUpdated", // inter-component message
    "shopping-item:removed": "onRemoved",
    "shopping-vault:recalled": "onRecalled"
  };

  onAdd(evt: Event) { /* this is the component instance */ }
  onUpdated(evt: CustomEvent) { /* evt.detail carries the payload */ }
}
```

The class `events` map is registered automatically when the component connects and unsubscribed when it disconnects, so no manual lifecycle wiring is needed.
The `events` map can also be passed to `TemplesComponent.define()` :

```typescript
TemplesComponent.define("shopping-app", ShoppingApp, {
  template,
  events: { "submit .add-form": "onAdd" }
});
```

To send an inter-component message, call `emit(name, detail)` ; it is delivered under the fully qualified name `<tag>:<name>`.

### 8. Styling

Styles live in the component's `.css` file and are imported via Bun's CSS import (`import "./component.css"`).
Since we use **Light DOM** (no Shadow DOM), all CSS rules **must be scoped by the component's tag name** to avoid clashes with the page's global styles :

```css
/* flipping-card.css */
flipping-card {
  display: inline-block;
  perspective: 1000px;
}

flipping-card .card-inner {
  transition: transform 0.6s;
  transform-style: preserve-3d;
}

flipping-card[flipped="true"] .card-inner {
  transform: rotateY(180deg);
}
```

This approach allows the component to inherit and use all global theming variables available on the page, while preventing style collisions through tag-name scoping.

Shadow DOM support may be added in a future version for use cases that require full style encapsulation.

## TemplesComponent API Reference

### Static methods

#### `TemplesComponent.define(tagName, ComponentClass, options)`

Registers a custom element and associates it with its template and events.
Parses the template HTML string into a `<template>` element (once) and calls `customElements.define()`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `tagName` | `string` | The custom element tag name (must contain a hyphen) |
| `ComponentClass` | `typeof TemplesComponent` | The class extending `TemplesComponent` |
| `options.template` | `string` | The HTML template string (imported from the `.html` file) |
| `options.events` | `EventMap` | Optional event bindings, `binding: handlerMethodName` |

```typescript
TemplesComponent.define("flipping-card", FlippingCard, { template, events });
```

### Static properties (overridden by subclasses)

#### `static observedAttributes: string[]`

Standard Web Component property.
Lists the plain attribute names that the component observes.
When any of these attributes change, the value is aggregated into `this.data` and a re-render is triggered.

```typescript
static observedAttributes = ["title", "flipped"];
```

#### `static events: EventMap`

The declarative event bindings, mapping a binding to a handler method name.
A binding with a space is a DOM event, `"<eventType> <selector>"` ; a binding without a space is an inter-component message, `"<tag>:<message>"`.
Handlers run with `this` bound to the component instance.

```typescript
static events = {
  "click .flip-btn": "flip",
  "shopping-item:updated": "onUpdated"
};
```

### Instance properties

#### `this.data` (private)

The internal state object.
Built from observed attributes on connection, and optionally enriched by the component's internal logic via `update()`.
Not directly accessible or modifiable from outside the component.

### Event methods

#### `on(events: EventMap)`

Registers a map of event bindings on this instance, merging them into the instance's active bindings.
DOM bindings are served by a shared document listener ; message bindings subscribe to the shared event bus.
The class `events` map is registered automatically on connection, so this method is mainly for runtime additions.

```typescript
this.on({ "click .refresh": "onRefresh" });
```

#### `emit(name, detail?)`

Emits an inter-component message on the shared event bus.
The message is delivered under the fully qualified name `<tag>:<name>`, so an emitter writes a short local name and classes never collide.

```typescript
this.emit("updated", { id: 1, label: "Milk" });
```

### Internal methods

#### `render()`

Re-renders all `data-bind`, `data-iterate`, and `data-render-if` bindings from the current `this.data`.
Called automatically when attributes change.
Accessible from event handlers and internal component logic, but **internal to the component**.
Delegates to the shared `Renderer` engine (see [Standalone template engine](#standalone-template-engine)).

#### `update(propertyPath, value)`

Patches a single path in `this.data` (e.g. `"article.title"`) and re-renders only the affected binding.
Enables efficient partial updates without re-rendering the entire component.
Accessible from event handlers and internal component logic, but **internal to the component**.
Delegates to the shared engine's `update()` method.

### Public methods (user-defined)

State-transition methods defined by the component author.
These are the idiomatic way to change a component's state programmatically — they encapsulate state changes behind a meaningful API rather than exposing raw attribute manipulation :

```typescript
flip() { this.setAttribute("flipped", "true"); }
unflip() { this.setAttribute("flipped", "false"); }
```

### Lifecycle hooks

`TemplesComponent` implements the standard Web Component lifecycle :

| Hook | Behavior |
|------|----------|
| `connectedCallback` | Clones the template content into the component, registers the class `events` map, performs initial render from current attribute values |
| `disconnectedCallback` | Unsubscribes the instance's event bindings and frees bound resources |
| `attributeChangedCallback` | Aggregates the changed attribute into `this.data` and triggers a re-render |

## JQUERY PLUGIN

A separate, tree-shakeable export provides the jQuery-compatible version of the engine.
Import the `temples/jquery` entry to register the plugin :

```javascript
import "temples/jquery";
```

The plugin adds the `$.fn.temples` method :

```javascript
$(".list").temples(data); // render data into each matched element
const renderer = $(".list").temples(); // get the prepared Renderer
```

jQuery is a peer dependency of this export.
The main entry never touches `$`.

