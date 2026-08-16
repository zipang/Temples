import { parseHTML } from "linkedom";
import type { TemplesComponent } from "./component";
import type { TemplesData } from "./engine";

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
export type PreparedRender = (data: TemplesData) => Promise<string>;

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
 * `prepare` is string-only. It parses the source with linkedom and installs the
 * resulting DOM on `globalThis`. The source is either a whole HTML document
 * (its root is `<html>`) or a single node (a fragment with one root element).
 * Both are handled: a whole document serializes with its doctype, while a single
 * node serializes as that node.
 *
 * The returned `render(data)` is async: it loads the `Renderer` (and, only when
 * `webComponents` are declared, `TemplesComponent`) with `await import()` after
 * the DOM globals exist. Each call renders the parsed document with the provided
 * data and returns the markup as an HTML string.
 *
 * @param source - HTML string: a whole document or a single root node.
 * @param options - Rendering options; all flags default to `false`.
 * @returns An async render function producing an HTML string per data dictionary.
 */
export const prepare = (source: string, options: PrepareOptions = {}): PreparedRender => {
	const dom = parseHTML(source) as unknown as {
		document: {
			documentElement: Element | null;
			head: Element;
			toString: () => string;
			createElement: (tag: string) => Element & { textContent: string };
		};
	};

	const domWindow = dom as unknown as Record<string, unknown>;

	const components = options.webComponents ?? [];
	const isFullDocument = dom.document.documentElement?.tagName === "HTML";
	const root = dom.document.documentElement;

	// A non-document source must have exactly one root element.
	if (!isFullDocument && root !== null) {
		const container = dom.document.createElement("div");
		container.innerHTML = source.trim();

		if (container.children.length > 1) {
			throw new Error("Template string must have a single root element");
		}
	}

	let renderer: { rootElt: Element; render: (data: TemplesData) => Element } | null = null;

	return async (data: TemplesData): Promise<string> => {
		// Scope the DOM globals to this render call, then restore them so the
		// mutation does not leak into the surrounding environment.
		const previous = new Map<string, unknown>();

		for (const key of DOM_GLOBALS) {
			previous.set(key, (globalThis as Record<string, unknown>)[key]);
		}

		for (const key of DOM_GLOBALS) {
			const value = domWindow[key];

			if (value !== undefined) {
				(globalThis as Record<string, unknown>)[key] = value;
			}
		}

		try {
			const { Renderer } = await import("./engine");

			let TComponent: typeof TemplesComponent | undefined;

			if (components.length > 0) {
				const mod = await import("./component");
				TComponent = mod.TemplesComponent;

				for (const ctor of components) {
					ctor.define({ globalStore: data });
				}
			}

			if (root === null) return "";

			if (renderer === null) {
				renderer = new Renderer(root);
			}

			renderer.render(data);

			if (options.removeDataBinding === true && TComponent !== undefined) {
				unwrapComponents(renderer.rootElt, TComponent);
			}

			const style = components
				.map((ctor) => ctor.css)
				.filter((value) => value !== "")
				.join("\n");

			if (isFullDocument) {
				if (style !== "") {
					const styleEl = dom.document.createElement("style");
					styleEl.textContent = style;
					dom.document.head.appendChild(styleEl);
				}

				return dom.document.toString();
			}

			// A fragment is a single node; linkedom's synthetic head (which holds
			// the component `<template>` and, if any, a `<style>`) must not leak
			// into it.
			dom.document.head.remove();

			return (style !== "" ? `<style>${style}</style>` : "") + renderer.rootElt.outerHTML;
		} finally {
			for (const [key, value] of previous) {
				if (value === undefined) {
					delete (globalThis as Record<string, unknown>)[key];
				} else {
					(globalThis as Record<string, unknown>)[key] = value;
				}
			}
		}
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
