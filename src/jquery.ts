import { Renderer, type TemplesData } from "./engine";

/**
 * Augment the jQuery object so `.temples()` is typed on every collection.
 */
declare global {
	interface JQuery<TElement = HTMLElement> {
		temples(data?: TemplesData): JQuery | Renderer;
	}
}

/**
 * Resolve the jQuery object from the global scope.
 *
 * The plugin never imports jQuery; it expects the host page to have loaded it
 * first, so this entry stays tree-shakeable and jQuery stays a peer dependency.
 *
 * @returns The jQuery object, or null when jQuery is not loaded.
 */
const resolveJQuery = (): JQueryStatic | null => {
	const globalScope = globalThis as Record<string, unknown>;
	const dollar = globalScope.$ as JQueryStatic | undefined;

	return dollar ?? (globalScope.jQuery as JQueryStatic | undefined) ?? null;
};

const jquery = resolveJQuery();

if (jquery === null) {
	throw new Error("temples/jquery requires jQuery to be loaded before importing the plugin");
}

/**
 * The renderers prepared for each matched element, so `$.fn.temples()` can
 * return the same renderer it prepared during `$.fn.temples(data)`.
 */
const renderers = new WeakMap<Element, Renderer>();

/**
 * Get or prepare the renderer for a matched element.
 *
 * @param el - The matched element.
 * @returns The cached renderer, or a freshly prepared one.
 */
const getRenderer = (el: Element): Renderer => {
	let renderer = renderers.get(el);

	if (renderer === undefined) {
		renderer = new Renderer(el);
		renderers.set(el, renderer);
	}

	return renderer;
};

/**
 * Render data into each matched element, or return the prepared renderer.
 *
 * With data, each matched element is prepared as a template and rendered.
 * Without data, the first matched element's prepared renderer is returned, so
 * callers can reach `render()`, `update()`, and `renderToString()` directly.
 *
 * @param this - The jQuery collection.
 * @param data - Optional data dictionary to render.
 * @returns The jQuery collection when rendering, or the prepared Renderer.
 */
jquery.fn.temples = function (this: JQuery, data?: TemplesData): JQuery | Renderer {
	const elements = this.toArray();
	const first = elements[0];

	if (data === undefined) {
		return first === undefined ? this : getRenderer(first);
	}

	for (const el of elements) getRenderer(el).render(data);

	return this;
};
