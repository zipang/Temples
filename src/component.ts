import { Renderer, type TemplesData } from "./engine";
import { reactive, subscribe } from "./reactive";
import { type EventMap, registerEvents } from "./register-events";

export type { EventMap };
export { registerEvents };

/**
 * Type an observed attribute's value as it flows into `state`.
 *
 * Without a type, an attribute writes a raw string. `boolean` maps `"false"`
 * and `"0"` to `false`, `number` parses a number, and `json` parses an object
 * or array literal.
 */
export type AttributeType = "boolean" | "number" | "json" | "string";

/**
 * Base class for declarative Web Components with reactive state.
 *
 * A subclass declares its `tag`, `template`, and optional `events`,
 * `observedAttributes`, and `attributeTypes` as static fields. `define()`
 * parses the template once and registers the custom element. On connection the
 * state is rendered from the template, and any state mutation re-renders.
 */
export class TemplesComponent extends HTMLElement {
	/**
	 * The custom element tag name, e.g. `"todo-app"`.
	 */
	static tag = "";

	/**
	 * The HTML template string, parsed once by `define()`.
	 */
	static template = "";

	/**
	 * Optional declarative event map, `"eventType selector": handler`.
	 */
	static events: EventMap = {};

	/**
	 * Attribute names observed for changes, written into `state`.
	 */
	static observedAttributes: string[] = [];

	/**
	 * Optional coercion map from attribute name to `AttributeType`.
	 */
	static attributeTypes: Record<string, AttributeType> = {};

	/**
	 * Reactive component state.
	 *
	 * Subclasses assign an initial `reactive({ ... })` value. Mutations to this
	 * object re-render the component automatically.
	 */
	declare state: Record<string, unknown>;

	private renderer: Renderer | null = null;
	private unsubscribeState: (() => void) | null = null;
	private cleanupEvents: (() => void) | null = null;

	constructor() {
		super();
		this.state = reactive({});
	}

	/**
	 * Register the custom element.
	 *
	 * Ensures a `<template id="tag">` exists in the document head, then calls
	 * `customElements.define(this.tag, this)`.
	 */
	static define(): void {
		const ctor = this as typeof TemplesComponent;

		TemplesComponent.resolveTemplate(ctor);
		customElements.define(ctor.tag, ctor);
	}

	/**
	 * Resolve the class template in the document head, creating it if missing.
	 *
	 * The template is identified by the tag name: `template#<tag>`. When it is
	 * absent, a `<template id="<tag>">` is created, filled from the class
	 * `template` string, and appended to the head. Keeping templates in the
	 * document makes them inspectable and lets components clone their content
	 * without re-parsing the string.
	 *
	 * @param ctor - The component class whose template to resolve.
	 * @returns The template element in the document head.
	 */
	private static resolveTemplate(ctor: typeof TemplesComponent): HTMLTemplateElement {
		let template = document.head.querySelector<HTMLTemplateElement>(`template#${ctor.tag}`);

		if (template === null) {
			template = document.createElement("template");
			template.id = ctor.tag;
			template.innerHTML = ctor.template;
			document.head.appendChild(template);
		}

		return template;
	}

	/**
	 * Render the state, seed attributes, and attach events.
	 *
	 * The template content is rendered into an internal container and then
	 * adopted into the host. The host's own attributes are left untouched so a
	 * parent component can feed it through `data-bind`; rendering against the
	 * container prevents the renderer from stripping those attributes.
	 *
	 * Called by the browser when the element connects to the DOM.
	 */
	connectedCallback(): void {
		const ctor = this.constructor as typeof TemplesComponent;
		const template = TemplesComponent.resolveTemplate(ctor);
		const content = template.content.cloneNode(true) as DocumentFragment;
		const container = document.createElement("div");

		container.appendChild(content);
		this.renderer = new Renderer(container);

		for (const name of ctor.observedAttributes) {
			if (this.hasAttribute(name)) {
				this.state[name] = this.coerceAttribute(name, this.getAttribute(name));
			}
		}

		this.unsubscribeState = subscribe(this.state, () => this.rerender());
		this.cleanupEvents = registerEvents(this, ctor.events);
		this.rerender();
	}

	/**
	 * Release the event listeners, the state subscription, and the children.
	 *
	 * Called by the browser when the element disconnects from the DOM.
	 */
	disconnectedCallback(): void {
		if (this.cleanupEvents !== null) {
			this.cleanupEvents();
			this.cleanupEvents = null;
		}

		if (this.unsubscribeState !== null) {
			this.unsubscribeState();
			this.unsubscribeState = null;
		}

		this.renderer = null;
		this.replaceChildren();
	}

	/**
	 * Write a coerced attribute into `state` and re-render.
	 *
	 * Called by the browser for every attribute listed in the subclass's
	 * `observedAttributes` array.
	 *
	 * @param name - The changed attribute name.
	 * @param _oldValue - The previous value, or null when newly set.
	 * @param newValue - The new value, or null when removed.
	 */
	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
		this.state[name] = this.coerceAttribute(name, newValue);
		this.rerender();
	}

	/**
	 * Re-render every binding from the current state.
	 *
	 * The container is re-rendered and its children are adopted into the host.
	 * Keyed reconciliation reuses the same node objects across renders, so the
	 * adoption moves them without losing input focus or scroll position.
	 */
	private rerender(): void {
		if (this.renderer === null) return;

		const container = this.renderer.rootElt;

		while (this.firstChild !== null) container.appendChild(this.firstChild);

		this.renderer.render(this.state as TemplesData);

		while (container.firstChild !== null) this.appendChild(container.firstChild);
	}

	/**
	 * Coerce a raw attribute value according to its declared type.
	 *
	 * An untyped attribute writes a raw string. `boolean` maps `"false"` and
	 * `"0"` to `false`, `number` parses a number (falling back to the raw
	 * string), and `json` parses an object or array (falling back to the raw
	 * string). A removed attribute (`null`) yields the neutral value.
	 *
	 * @param name - The attribute name, used to look up its declared type.
	 * @param raw - The raw attribute value, or null when removed.
	 * @returns The coerced value written into `state`.
	 */
	private coerceAttribute(name: string, raw: string | null): unknown {
		const ctor = this.constructor as typeof TemplesComponent;
		const type = ctor.attributeTypes[name] ?? "string";

		switch (type) {
			case "boolean":
				return raw === null ? false : raw !== "false" && raw !== "0";
			case "number": {
				if (raw === null) return 0;

				const value = Number(raw);

				return Number.isNaN(value) ? raw : value;
			}
			case "json": {
				if (raw === null) return null;

				try {
					return JSON.parse(raw);
				} catch {
					return raw;
				}
			}
			default:
				return raw ?? "";
		}
	}
}
