import { parseHTML } from "linkedom";
import { Renderer } from "./engine";

export { Renderer };

/**
 * Install a linkedom-backed DOM as the global document.
 *
 * The engine operates on the DOM through globals such as `document`, `Element`,
 * and `HTMLElement`. On the server those globals do not exist, so this module
 * creates a linkedom document and assigns the DOM constructors to globalThis.
 * Each global is set only when it is missing, so a real browser environment is
 * left untouched.
 *
 * The main entry never imports this module, so browser bundles stay free of
 * linkedom.
 */
const dom = parseHTML("<!doctype html><html><head></head><body></body></html>");

const globals: Record<string, unknown> = {
	document: dom.document,
	Document: dom.Document,
	DocumentFragment: dom.DocumentFragment,
	Element: dom.Element,
	HTMLElement: dom.HTMLElement,
	Node: dom.Node,
	DOMParser: dom.DOMParser,
	customElements: dom.customElements,
	CustomElementRegistry: dom.CustomElementRegistry,
	Event: dom.Event,
	CustomEvent: dom.CustomEvent,
	MutationObserver: dom.MutationObserver,
	ShadowRoot: dom.ShadowRoot
};

for (const [key, value] of Object.entries(globals)) {
	if (value !== undefined && (globalThis as Record<string, unknown>)[key] === undefined) {
		(globalThis as Record<string, unknown>)[key] = value;
	}
}
