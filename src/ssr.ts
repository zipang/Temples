import { parseHTML } from "linkedom";
import type { TemplesComponent } from "./component";
import { Renderer, type TemplesData } from "./engine";

export { Renderer };

/**
 * Options that reconfigure how `prepare` renders a template.
 */
export interface PrepareOptions {
	/**
	 * Include the TemplesComponent library in the output so custom elements
	 * rehydrate (mount and activate) in the browser.
	 */
	rehydrate?: boolean;

	/**
	 * Remove every Temples trace from the output: all `data-*` binding
	 * attributes and every used component, rendered to plain static markup.
	 */
	removeDataBinding?: boolean;

	/**
	 * The `TemplesComponent` classes used by the template. `prepare` registers
	 * each class so its custom tag renders through the component engine.
	 */
	webComponents?: (typeof TemplesComponent)[];
}

/**
 * A prepared render function: given a data dictionary, returns the rendered
 * markup as an HTML string.
 */
export type PreparedRender = (data: TemplesData) => string;

/**
 * The DOM globals that a linkedom window exposes for server-side rendering.
 *
 * `parseHTML` returns these as non-own properties, so they are read explicitly
 * and installed on `globalThis` inside `prepare`. Installing them lets the engine
 * and `TemplesComponent` (whose class extends `HTMLElement`) evaluate against a
 * real DOM on the server.
 */
const DOM_GLOBALS = [
	"document",
	"Document",
	"DocumentFragment",
	"Element",
	"HTMLElement",
	"Node",
	"DOMParser",
	"customElements",
	"Event",
	"CustomEvent",
	"MutationObserver",
	"ShadowRoot"
] as const;

/**
 * Prepare a template source into a reusable render function.
 *
 * `prepare` is string-only: the source is an HTML string with exactly one root
 * element. It parses the source with linkedom, installs the resulting DOM on
 * `globalThis`, then loads the engine and `TemplesComponent` only after those
 * globals exist. The returned `render(data)` builds a fresh `Renderer` on every
 * call, so consecutive calls are independent and no state leaks between data sets.
 * Each call returns the rendered markup as an HTML string.
 *
 * @param source - HTML string with a single root element.
 * @param options - Rendering options; all flags default to `false`.
 * @returns A render function producing an HTML string per data dictionary.
 */
export const prepare = (source: string, options: PrepareOptions = {}): PreparedRender => {
	const dom = parseHTML(source) as unknown as Record<string, unknown>;

	for (const key of DOM_GLOBALS) {
		const value = dom[key];

		if (value !== undefined && (globalThis as Record<string, unknown>)[key] === undefined) {
			(globalThis as Record<string, unknown>)[key] = value;
		}
	}

	// `component.ts` declares `class TemplesComponent extends HTMLElement`, so it
	// must load only after `HTMLElement` exists. `engine.ts` is imported
	// statically; it touches no DOM at module load.
	const { TemplesComponent: TComponent } = require("./component") as {
		TemplesComponent: typeof TemplesComponent;
	};

	const components = options.webComponents ?? [];

	for (const ctor of components) {
		ctor.define();
	}

	// Validate the source has a single root element before returning.
	new Renderer(source);

	return (data: TemplesData): string => {
		TComponent.globalStore = data;

		const renderer = new Renderer(source);

		if (components.length > 0) {
			document.body.appendChild(renderer.rootElt);
		}

		renderer.render(data);

		if (options.removeDataBinding === true) {
			unwrapComponents(renderer.rootElt, TComponent);
		}

		const html = renderer.toHtml();

		if (components.length > 0) {
			renderer.rootElt.remove();
		}

		const css = components
			.map((ctor) => ctor.css)
			.filter((value) => value !== "")
			.join("\n");
		const style = css !== "" ? `<style>${css}</style>` : "";

		return style + html;
	};
};

/**
 * Replace every component instance in a subtree with its rendered children.
 *
 * Walks the subtree and, for each component element, moves its children into the
 * element's place and removes the element itself. The result is plain markup with
 * no custom tag remaining.
 *
 * @param root - The subtree root to unwrap.
 * @param componentClass - The component class used to detect instances.
 */
const unwrapComponents = (root: Element, componentClass: typeof TemplesComponent): void => {
	const instances = [root, ...Array.from(root.querySelectorAll("*"))].filter(
		(element) => element instanceof componentClass
	);

	for (const element of instances) {
		const parent = element.parentNode;

		if (parent === null) continue;

		while (element.firstChild !== null) {
			parent.insertBefore(element.firstChild, element);
		}

		parent.removeChild(element);
	}
};
