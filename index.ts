import { Renderer, type TemplesData, type TemplesDataValue } from "./src/engine";
import { type EventMap, registerEvents } from "./src/register-events";
import { setProperty } from "./src/utilities/properties";

export * from "./src/engine";
export type { EventMap };
export { registerEvents };

/**
 * Options passed to `TemplesComponent.define()`.
 */
export interface TemplesComponentOptions {
	/**
	 * The HTML template string parsed into a `<template>` element once.
	 */
	template: string;
	/**
	 * Optional declarative event map, `"eventType selector": handler`.
	 */
	events?: EventMap;
}

/**
 * Base class for declarative Web Components.
 *
 * A subclass declares its observed attributes, and `TemplesComponent.define()`
 * registers the custom element with its HTML template. On connection the
 * template content is cloned into the component, the bindings are rendered
 * from the aggregated attribute data, and the event map is attached.
 */
export class TemplesComponent extends HTMLElement {
	/**
	 * The parsed `<template>` element, stored by `define()` on the class.
	 */
	static templateElement: HTMLTemplateElement | null = null;

	/**
	 * The declarative event map, stored by `define()` on the class.
	 */
	static eventMap: EventMap = {};

	private renderer: Renderer | null = null;
	private cleanup: (() => void) | null = null;
	protected data: TemplesData = {};

	/**
	 * Register a custom element with its template and event map.
	 *
	 * The template HTML string is parsed once into a `<template>` element and
	 * stored on the class, then `customElements.define()` is called.
	 *
	 * @param tagName - Custom element tag name, must contain a hyphen.
	 * @param ComponentClass - The class extending `TemplesComponent`.
	 * @param options - Template and optional event map.
	 */
	static define<T extends typeof TemplesComponent>(
		tagName: string,
		ComponentClass: T,
		options: TemplesComponentOptions
	): void {
		const template = document.createElement("template");

		template.innerHTML = options.template;
		ComponentClass.templateElement = template;
		ComponentClass.eventMap = options.events ?? {};

		customElements.define(tagName, ComponentClass);
	}

	/**
	 * Clone the template content, render the bindings, and attach events.
	 *
	 * Called by the browser when the element connects to the DOM.
	 */
	connectedCallback(): void {
		const template = (this.constructor as typeof TemplesComponent).templateElement;

		if (template === null) {
			throw new Error("TemplesComponent has no template; call TemplesComponent.define()");
		}

		const content = template.content.cloneNode(true) as DocumentFragment;

		this.replaceChildren(content);
		this.renderer = new Renderer(this);
		this.renderer.render(this.data);
		this.cleanup = registerEvents(this, (this.constructor as typeof TemplesComponent).eventMap);
	}

	/**
	 * Release the event listeners, the renderer, and the children.
	 *
	 * Called by the browser when the element disconnects from the DOM.
	 */
	disconnectedCallback(): void {
		if (this.cleanup !== null) {
			this.cleanup();
			this.cleanup = null;
		}

		this.renderer = null;
		this.replaceChildren();
	}

	/**
	 * Aggregate an observed attribute change and re-render.
	 *
	 * Called by the browser for every attribute listed in the subclass's
	 * `observedAttributes` array.
	 *
	 * @param name - The changed attribute name.
	 * @param _oldValue - The previous value, or null when newly set.
	 * @param newValue - The new value, or null when removed.
	 */
	attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
		this.data[name] = newValue ?? "";
		this.renderer?.render(this.data);
	}

	/**
	 * Re-render every binding from the current attribute data.
	 *
	 * Internal to the component. External code must not call it to overwrite
	 * component state.
	 */
	render(): void {
		this.renderer?.render(this.data);
	}

	/**
	 * Patch a single path and re-render only the affected binding.
	 *
	 * Internal to the component. Event handlers may use it for efficient
	 * partial updates.
	 *
	 * @param path - Dotted path to the property, e.g. `"article.title"`.
	 * @param value - The value to assign to the property.
	 */
	update(path: string, value: TemplesDataValue): void {
		setProperty(this.data, path, value);
		this.renderer?.update(path, value);
	}
}
