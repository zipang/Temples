import { parseHTML } from "linkedom";
import type { TemplesComponent } from "./component";
import type { TemplesData } from "./engine";
import { extractDomGlobals, installGlobals, restoreGlobals } from "./utilities/dom-globals";

/**
 * The linkedom surface `prepare` needs: the parsed document and the DOM
 * globals exposed on the window.
 */
interface SsrWindow extends Record<string, unknown> {
	document: SsrDocument;
}

/**
 * The minimal `document` shape `prepare` reads from a linkedom window.
 */
interface SsrDocument {
	documentElement: Element | null;
	head: Element;
	toString: () => string;
	createElement: (tag: string) => Element & { textContent: string };
}

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
	removeDataBindings?: boolean;

	/**
	 * The `TemplesComponent` classes used by the template. `prepare` registers
	 * each class so its custom tag renders through the component engine.
	 */
	templesComponents?: (typeof TemplesComponent)[];
}

/**
 * A prepared render function:
 * renders data through the Temples data binding engine with support of TemplesComponents
 * @returns HTML string.
 */
export type RenderFunction = (data: TemplesData) => Promise<string>;

export type PrepareFunction = (source: string, options?: PrepareOptions) => RenderFunction;

/**
 * Prepare a template source into a reusable render function.
 *
 * `prepare` is string-only. The source is either a whole HTML document (its
 * root is `<html>`) or a single node (a fragment with one root element). Both
 * are handled: a whole document serializes with its doctype, while a single
 * node serializes as that node.
 *
 * Each `render(data)` call re-parses the source with linkedom and installs the
 * resulting DOM on `globalThis`, then restores the previous globals before
 * returning. Re-parsing keeps renders independent: the same prepared template
 * can be rendered many times with different data, with no state leak between
 * calls and no repeated custom-element registration.
 *
 * The render call is async: it loads the `Renderer` (and, only when
 * `templesComponents` are declared, `TemplesComponent`) with `await import()`
 * after the DOM globals exist.
 *
 * @param source - HTML string: a whole document or a single root node.
 * @param options - Rendering options; all flags are optional.
 * @returns An async render function producing an HTML string per data dictionary.
 */
export const prepare: PrepareFunction = (
	source,
	{ removeDataBindings = true, templesComponents = [] } = {}
) => {
	assertSingleRoot(source);

	return async (data: TemplesData): Promise<string> => {
		const dom = parseHTML(source) as unknown as SsrWindow;
		const root = dom.document.documentElement;

		const previous = installGlobals(extractDomGlobals(dom));

		try {
			const { Renderer } = await import("./engine");

			let componentClass: typeof TemplesComponent | undefined;

			if (templesComponents.length > 0) {
				({ TemplesComponent: componentClass } = await import("./component"));

				for (const tc of templesComponents) {
					// linkedom allows a given class to be defined only once, in
					// any window, for its lifetime. Each render re-parses into a
					// fresh window, so it registers a fresh subclass that
					// inherits the declaration and the custom element upgrades.
					const renderClass = class extends tc {};

					renderClass.define({ globalStore: data });
				}
			}

			if (root === null) return "";

			const renderer = new Renderer(root);
			renderer.render(data);

			if (removeDataBindings && componentClass !== undefined) {
				unwrapComponents(renderer.rootElt, componentClass);
			}

			const style = componentStyles(templesComponents);

			if (root.tagName === "HTML") {
				if (style !== "") {
					const styleElement = dom.document.createElement("style");
					styleElement.textContent = style;
					dom.document.head.appendChild(styleElement);
				}

				return dom.document.toString();
			}

			// A linkedom fragment is a single node composed of linkedom's
			// synthetic head (which holds the component `<template>`) and the
			// body. The style, if any, is prepended to the fragment markup.
			dom.document.head.remove();

			return (style !== "" ? `<style>${style}</style>` : "") + renderer.rootElt.outerHTML;
		} finally {
			restoreGlobals(previous);
		}
	};
};

/**
 * Assert that a fragment source has a single root element.
 *
 * A whole document always has one `<html>` root and skips the check. A
 * fragment is re-parsed into a container: more than one child element means
 * the template cannot map to a single renderer root. The source never changes
 * between renders, so the check runs once, at prepare time.
 *
 * @param source - The template source string.
 */
const assertSingleRoot = (source: string): void => {
	const dom = parseHTML(source) as unknown as SsrWindow;
	const root = dom.document.documentElement;

	if (root === null || root.tagName === "HTML") return;

	const container = dom.document.createElement("div");
	container.innerHTML = source.trim();

	if (container.children.length > 1) {
		throw new Error("Template string must have a single root element");
	}
};

/**
 * Concatenate the declared component stylesheets.
 *
 * The styles are joined with a newline and serve either a full document (one
 * `<style>` tag in the head) or a fragment (a `<style>` tag prepended to the
 * markup).
 *
 * @param components - The component classes used by the template.
 * @returns The concatenated stylesheet, or an empty string.
 */
const componentStyles = (components: readonly (typeof TemplesComponent)[]): string =>
	components
		.map((component) => component.css)
		.filter(Boolean)
		.join("\n");

/**
 * Replace every component instance in a subtree with its rendered children.
 *
 * Walks the subtree and, for each component element, moves its children into
 * the element's place and removes the element itself. The result is plain
 * markup with no custom tag remaining.
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
